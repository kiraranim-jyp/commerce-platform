import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import {
  classifyCandidateMarket,
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-108 — **국내/해외 가격비교 MI 정확도 E2E** (LIVE · 코드 수정 0 으로 시작)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「**코드부터 수정하지 말고** production 경로를 실제 데이터 한 건씩 끝까지
 *    추적해서 **「판정 → 가격 → 화면」 중 어디에서 정확도가 깨지는지 먼저 확정**」
 * 🔴 새 AI 검색 ❌ · 8축 ❌ · 「국내 EXACT 0」 ❌ · Registry ❌ · discovery ❌
 *
 * 🟢 모집단 — **S1(B226AC010) · S2(B226AC009)**. 동일상품이 **실재** 하고(WU-103/104)
 *    국내·해외가 섞여 있다. 🔴 B226AC112 는 **쓰지 않는다**(WU-102 분모 오류).
 *
 * 🔴🔴 **tier 를 지어내지 않는다** — `judgeDomesticCandidate` 가 낸 `JUDGED.priceTier` 를
 *    읽고, 그 값은 **그 샵의 best 1건에만** 있다(운영 구조). 나머지는 `null` 로 적는다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

/** 🔴 국내 축 적재 자격 — **운영 조건 그대로**(market-intelligence.ts:192). */
const domesticEligible = (market: string, priceKrw: number | null, tier: string | null) =>
  market === "KR" && priceKrw != null && (tier === "EXACT" || tier === "COMPARISON");

describe("WU-108 — 가격비교 정확도 E2E (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "후보 한 건씩 facts → MI → market → price → 자격 → 집계",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: {
          searchId: string;
          candidates?: string[];
          dropped?: { url: string }[];
          knownAnswersFound?: string[];
          unverifiedNew?: string[];
        }[];
      };
      const all: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const urls = new Set<string>();
        for (const r of s.rows.filter((x) => x.searchId === c.sid)) {
          (r.candidates ?? []).forEach((u) => urls.add(u));
          (r.dropped ?? []).forEach((d) => urls.add(d.url));
          (r.knownAnswersFound ?? []).forEach((u) => urls.add(u));
          (r.unverifiedNew ?? []).forEach((u) => urls.add(u));
        }
        const supplied = [...urls].filter((u) => u !== c.origin);
        const ex = extractCandidateUrlsFromAiAnswer(supplied.map((u, i) => `${i + 1}. ${u}`).join("\n"), null);
        const of_ = await factsFromProductUrl(c.origin);
        const q = {
          title: of_.candidate!.title,
          sourceUrl: of_.crawlerUrl!,
          facts: of_.candidate!.facts,
        } as ComparisonQuery;
        const pool = await collectUrlCandidatePool({
          urls: ex.urls,
          originUrl: q.sourceUrl ?? null,
          maxUrls: 200,
          existingCanonicalUrls: new Set<string>(),
        });

        const rows: Record<string, unknown>[] = [];
        const overseasRecords: CandidateOverseasPriceRecord[] = [];
        const domesticRecords: CandidateOverseasPriceRecord[] = [];

        for (const r of pool.searchResults) {
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) continue;
          const priced = await enrichCandidatePrices(withConfidence(q, notSelf), r.domain, q);
          const t = await attachMatchTruth(
            [{ ...r, candidates: priced }],
            q.facts?.brandModelCode ?? null,
            q.facts?.colorText ?? null,
          );
          const j = await judgeDomesticCandidate({
            domain: r.domain,
            candidates: t[0].candidates,
            sourceUrl: q.sourceUrl,
            foreignModelCode: q.facts?.brandModelCode ?? null,
            foreignColor: q.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          const judgedTier = j.kind === "JUDGED" ? j.priceTier : null;
          const judgedBest = j.kind === "JUDGED" ? j.best.url : null;
          const dropGate = j.kind === "DROPPED" ? j.gate : null;

          for (const x of t[0].candidates) {
            const m = classifyCandidateMarket({
              domain: r.domain,
              currency: x.price?.currency ?? null,
              isRegisteredDomesticShop: false,
            });
            const tier = judgedBest === x.url ? judgedTier : null;
            const priceKrw =
              x.priceStatus === "VERIFIED_CURRENT" && x.price?.currency === "KRW" ? x.price.amount : null;
            const krOk = domesticEligible(m.market, priceKrw, tier);
            /** 🟢 해외 금액 축 — 운영과 같은 조건(`market !== "KR"` · 가격 있음 · KRW 아님). */
            const osOk = m.market !== "KR" && x.price != null && x.price.currency.toUpperCase() !== "KRW";
            if (krOk) domesticRecords.push({ market: m.market, currency: "KRW", amount: priceKrw, priceTier: tier! });
            if (osOk)
              overseasRecords.push({
                market: m.market,
                currency: x.price!.currency,
                amount: x.price!.amount,
                /** 🔴 tier 가 없는 후보는 **UNJUDGED** 로 적는다 — EXACT 로 **승격하지 않는다**. */
                priceTier: tier ?? "UNJUDGED",
              });
            rows.push({
              sid: c.sid,
              host: new URL(x.url).host,
              url: x.url,
              code: x.facts?.brandModelCode ?? null,
              sameByUrl: x.url.toUpperCase().includes(c.code),
              verdict: x.crossSellerVerdict ?? null,
              matchTruth: x.matchTruth ?? null,
              tier,
              dropGate,
              market: m.market,
              basis: String(m.basis),
              price: x.price ?? null,
              priceStatus: x.priceStatus ?? null,
              priceKrw,
              krBucket: krOk,
              osBucket: osOk,
            });
          }
        }
        const krSum = summarizeCandidateOverseasPrices(domesticRecords);
        const osSum = summarizeCandidateOverseasPrices(overseasRecords);

        // eslint-disable-next-line no-console
        console.log(`\n════════ ${c.sid} / ${c.code} — 후보 ${rows.length} ════════`);
        // eslint-disable-next-line no-console
        console.log(
          `  원상품 code=${JSON.stringify(q.facts?.brandModelCode)} color=${JSON.stringify(q.facts?.colorText)} price=${JSON.stringify(of_.candidate?.price)}`,
        );
        for (const x of rows) {
          // eslint-disable-next-line no-console
          console.log(
            `  ${x.sameByUrl ? "[SAME-URL]" : "[        ]"} ${String(x.host).slice(0, 24).padEnd(25)}` +
              ` MI=${String(x.verdict).slice(0, 8).padEnd(9)} truth=${String(x.matchTruth).slice(0, 20).padEnd(21)}` +
              ` tier=${String(x.tier).padEnd(11)} ${String(x.market).padEnd(8)} ${JSON.stringify(x.price)}` +
              ` ${String(x.priceStatus).padEnd(18)} KR=${x.krBucket ? "YES" : "-"} OS=${x.osBucket ? "YES" : "-"}`,
          );
        }
        // eslint-disable-next-line no-console
        console.log(`  [KR-SUM] ${JSON.stringify(krSum)}`);
        // eslint-disable-next-line no-console
        console.log(`  [OS-SUM] ${JSON.stringify(osSum)}`);
        all.push({ sid: c.sid, rows, krSum, osSum });
      }
      writeFileSync(path.join(OUT, "wu-108.json"), JSON.stringify(all, null, 1));
      expect(all).toHaveLength(2);
    },
    3_600_000,
  );
});
