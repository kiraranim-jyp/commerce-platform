import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { attachMatchTruth } from "../../../domestic-price-sources/_lib/attach-match-truth";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-112 — **동일상품 후보 «전수» 덤프**(CEO 육안 GT 입력 · 구현 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확정 2026-10-19 — 작업 순서가 고정됐다. 「국내 + 해외 후보를 **최대한 확보** →
 *    목록으로 제시 → **CEO 가 육안으로 SAME/DIFFERENT** → GT 축적」. **가격 작업 전부 보류.**
 *
 * 🔴🔴 그래서 이 하니스는 **⑧ 게이트 뒤의 «샵당 best 1건» 이 아니라 후보 전수** 를 낸다.
 *    WU-096 이 측정한 그 게이트(`isEvidenceEvaluationWorthwhile`)가 샵 전체를 DROPPED 로
 *    떨어뜨리므로, 운영 산출만 쓰면 **CEO 가 볼 후보가 사라진다**.
 * 🟢 운영 판정값은 **그대로 함께** 싣는다(verdict·matchLevel·tier) — 🔴 지어내지 않는다.
 *    판정하지 않은 후보의 `priceTier` 는 **null** 로 둔다(WU-097/098 계약).
 * 🔴 **MI 입력 0 · 저장 0 · 운영 파일 변경 0** — JSON 파일 하나만 쓴다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

describe("WU-112 — 후보 전수 덤프 (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "국내/해외 후보를 전수로 덤프한다",
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
      const out: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const urls = new Set<string>();
        for (const r of s.rows.filter((x) => x.searchId === c.sid)) {
          (r.candidates ?? []).forEach((u) => urls.add(u));
          (r.dropped ?? []).forEach((d) => urls.add(d.url));
          (r.knownAnswersFound ?? []).forEach((u) => urls.add(u));
          (r.unverifiedNew ?? []).forEach((u) => urls.add(u));
        }
        const ex = extractCandidateUrlsFromAiAnswer(
          [...urls].filter((u) => u !== c.origin).map((u, i) => `${i + 1}. ${u}`).join("\n"),
          null,
        );
        const of_ = await factsFromProductUrl(c.origin);
        const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts } as ComparisonQuery;
        const pool = await collectUrlCandidatePool({
          urls: ex.urls,
          originUrl: q.sourceUrl ?? null,
          maxUrls: 200,
          existingCanonicalUrls: new Set<string>(),
        });

        const rows: Record<string, unknown>[] = [];
        for (const r of pool.searchResults) {
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) continue;
          const priced = await enrichCandidatePrices(withConfidence(q, notSelf), r.domain, q);
          const t = await attachMatchTruth(
            [{ ...r, candidates: priced }],
            q.facts?.brandModelCode ?? null,
            q.facts?.colorText ?? null,
          );
          const cands = t[0].candidates;
          /** 🟢 운영 샵 판정(게이트 포함)을 **같이** 기록한다 — 후보를 지우지는 않는다. */
          const j = await judgeDomesticCandidate({
            domain: r.domain,
            candidates: cands,
            sourceUrl: q.sourceUrl,
            foreignModelCode: q.facts?.brandModelCode ?? null,
            foreignColor: q.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          const bestUrl = j.kind === "JUDGED" ? j.best.url : null;
          for (const x of cands) {
            const m = classifyCandidateMarket({
              domain: r.domain,
              currency: x.price?.currency ?? null,
              isRegisteredDomesticShop: false,
            });
            rows.push({
              domain: r.domain,
              url: x.url,
              title: x.title ?? null,
              imageUrl: (x as { imageUrl?: string | null }).imageUrl ?? null,
              market: m.market,
              priceAmount: x.price?.amount ?? null,
              priceCurrency: x.price?.currency ?? null,
              priceStatus: x.priceStatus ?? null,
              matchLevel: x.matchLevel ?? null,
              crossSellerVerdict: (x as { crossSellerVerdict?: string | null }).crossSellerVerdict ?? null,
              crossSellerBlockers: (x as { crossSellerBlockers?: string[] }).crossSellerBlockers ?? [],
              matchTruth: (x as { matchTruth?: string | null }).matchTruth ?? null,
              modelCode: x.facts?.brandModelCode ?? null,
              /** 🔴 샵 판정 산출 — 이 후보가 그 샵의 대표였을 때만 tier 가 있다. 그 외 **null**. */
              shopJudgement: j.kind,
              shopDropGate: j.kind === "DROPPED" ? String(j.gate) : null,
              isShopBest: bestUrl != null && bestUrl === x.url,
              priceTier: bestUrl != null && bestUrl === x.url && j.kind === "JUDGED" ? j.priceTier : null,
            });
          }
        }
        // eslint-disable-next-line no-console
        console.log(
          `${c.sid}/${c.code} — 샵 ${pool.searchResults.length} · 후보 **${rows.length}** ·` +
            ` KR ${rows.filter((x) => x.market === "KR").length} ·` +
            ` OVERSEAS ${rows.filter((x) => x.market === "OVERSEAS").length} ·` +
            ` UNKNOWN ${rows.filter((x) => x.market === "UNKNOWN").length} ·` +
            ` 이미지있음 ${rows.filter((x) => x.imageUrl).length}`,
        );
        out.push({
          sid: c.sid,
          code: c.code,
          originUrl: c.origin,
          originTitle: q.title ?? null,
          originBrand: q.facts?.brand ?? null,
          originColor: q.facts?.colorText ?? null,
          originCode: q.facts?.brandModelCode ?? null,
          candidates: rows,
        });
      }

      writeFileSync(path.join(OUT, "wu-112.json"), JSON.stringify(out, null, 1));
      // eslint-disable-next-line no-console
      console.log(`[WU-112] 총 후보 ${out.reduce((n, o) => n + (o.candidates as unknown[]).length, 0)}`);
      expect(out).toHaveLength(2);
    },
    3_600_000,
  );
});
