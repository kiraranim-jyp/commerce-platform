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
 * WU-109 — **운영 집계 규칙으로 다시 센다 + Trenbe 가격 진단** (LIVE · 구현 0 으로 시작)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **WU-108 의 집계가 내 하니스 오류였다.** 운영은 `transientEvidenceSink.push` 를
 *    **한 곳**(run-domestic-price-check.ts:1255)에서만 부르고, 그것은 `JUDGED` 분기
 *    **안** 이라 **샵당 `best` 1건** 만 집계 입력이 된다.
 *    ⟹ 🔴 `UNJUDGED` 라는 상태는 **운영에 존재하지 않는다**. 내가 전 후보를 넣었다.
 * 🟢 이 하니스는 **샵당 best 1건만** 넣어 운영을 재현한다.
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);
const TRENBE =
  "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p";

const CASES = [
  { sid: "S1", code: "B226AC010", origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt" },
  { sid: "S2", code: "B226AC009", origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt" },
] as const;

describe("WU-109 — 운영 집계 재현 + Trenbe 진단 (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "샵당 best 1건만 집계한다 · Trenbe 가격 원인",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as {
        rows: { searchId: string; candidates?: string[]; dropped?: { url: string }[]; knownAnswersFound?: string[]; unverifiedNew?: string[] }[];
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
          urls: ex.urls, originUrl: q.sourceUrl ?? null, maxUrls: 200, existingCanonicalUrls: new Set<string>(),
        });

        /** 🟢 **운영과 같은 모양** — 샵당 JUDGED 1건만 sink 에 들어간다. */
        const sink: Record<string, unknown>[] = [];
        let shops = 0;
        let droppedShops = 0;
        for (const r of pool.searchResults) {
          shops += 1;
          const notSelf = r.candidates.filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url));
          if (notSelf.length === 0) continue;
          const priced = await enrichCandidatePrices(withConfidence(q, notSelf), r.domain, q);
          const t = await attachMatchTruth([{ ...r, candidates: priced }], q.facts?.brandModelCode ?? null, q.facts?.colorText ?? null);
          const j = await judgeDomesticCandidate({
            domain: r.domain, candidates: t[0].candidates, sourceUrl: q.sourceUrl,
            foreignModelCode: q.facts?.brandModelCode ?? null, foreignColor: q.facts?.colorText ?? null,
            fetchModelCode: async () => null,
          });
          if (j.kind !== "JUDGED") { droppedShops += 1; continue; }
          const best = j.best;
          const m = classifyCandidateMarket({
            domain: r.domain, currency: best.price?.currency ?? null, isRegisteredDomesticShop: false,
          });
          sink.push({
            domain: r.domain, url: best.url, market: m.market, basis: String(m.basis),
            priceAmount: best.price?.amount ?? null, priceCurrency: best.price?.currency ?? null,
            priceStatus: best.priceStatus ?? null, priceTier: j.priceTier, matchTruth: j.matchTruth,
            priceKrw: best.priceStatus === "VERIFIED_CURRENT" && best.price?.currency === "KRW" ? best.price.amount : null,
            sameByUrl: best.url.toUpperCase().includes(c.code),
          });
        }

        /** 🟢 운영 적재 규칙 그대로(market-intelligence.ts:226~). */
        const osRec: CandidateOverseasPriceRecord[] = [];
        const krRec: CandidateOverseasPriceRecord[] = [];
        for (const e of sink) {
          const market = String(e.market);
          const cur = String(e.priceCurrency ?? "").toUpperCase();
          if (market !== "KR") {
            if (cur === "KRW") continue; // 🟢 WU-051 — KRW 를 해외에 넣지 않는다
            if (e.priceAmount != null && cur)
              osRec.push({ market, currency: cur, amount: e.priceAmount as number, priceTier: String(e.priceTier) });
            continue;
          }
          if (e.priceKrw != null && (e.priceTier === "EXACT" || e.priceTier === "COMPARISON"))
            krRec.push({ market, currency: "KRW", amount: e.priceKrw as number, priceTier: String(e.priceTier) });
        }
        const krSum = summarizeCandidateOverseasPrices(krRec);
        const osSum = summarizeCandidateOverseasPrices(osRec);

        // eslint-disable-next-line no-console
        console.log(`\n======== ${c.sid} / ${c.code} — 샵 ${shops}(DROPPED ${droppedShops}) · sink **${sink.length}** ========`);
        for (const e of sink)
          // eslint-disable-next-line no-console
          console.log(
            `  ${e.sameByUrl ? "[SAME-URL]" : "[        ]"} ${String(e.domain).slice(0, 24).padEnd(25)}` +
              ` tier=${String(e.priceTier).padEnd(11)} ${String(e.market).padEnd(8)}` +
              ` ${e.priceAmount == null ? "price=null" : `${e.priceCurrency} ${e.priceAmount}`} ${String(e.priceStatus)}`,
          );
        // eslint-disable-next-line no-console
        console.log(`  [KR-SUM] ${JSON.stringify(krSum)}`);
        // eslint-disable-next-line no-console
        console.log(`  [OS-SUM] ${JSON.stringify(osSum)}`);
        // eslint-disable-next-line no-console
        console.log(`  [TIER] ${JSON.stringify(osSum.byPriceTier)} / KR ${JSON.stringify(krSum.byPriceTier)}`);
        out.push({ sid: c.sid, sink, krSum, osSum });
      }

      /* ── STEP 2 — Trenbe 가격 null 원인 ── */
      // eslint-disable-next-line no-console
      console.log(`\n======== STEP2 Trenbe 가격 진단 ========`);
      const f = await factsFromProductUrl(TRENBE);
      // eslint-disable-next-line no-console
      console.log(`  운영 owner — status=${f.status} fetchPath=${f.fetchPath} httpCalls=${f.httpCalls}`);
      // eslint-disable-next-line no-console
      console.log(`  price=${JSON.stringify(f.candidate?.price)} priceStatus=${JSON.stringify(f.candidate?.priceStatus)}`);
      const r = await fetch(TRENBE, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0" },
        signal: AbortSignal.timeout(30000),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }) as unknown as Response);
      const html = await r.text();
      // eslint-disable-next-line no-console
      console.log(`  raw fetch — HTTP ${r.status} · 본문 ${html.length} bytes`);
      const has = (re: RegExp) => (html.match(re) || []).length;
      // eslint-disable-next-line no-console
      console.log(
        `  가격 원천 — ld+json ${has(/application\/ld\+json/gi)} · "price" ${has(/"price"/gi)} ·` +
          ` itemprop=price ${has(/itemprop=["']price["']/gi)} · og:price ${has(/og:price/gi)} ·` +
          ` priceCurrency ${has(/priceCurrency/gi)}`,
      );
      const krw = html.match(/[0-9][0-9,]{4,}\s*원/g) ?? [];
      // eslint-disable-next-line no-console
      console.log(`  본문 「N원」 패턴 ${krw.length}건 ${JSON.stringify(krw.slice(0, 5))}`);

      writeFileSync(path.join(OUT, "wu-109.json"), JSON.stringify(out, null, 1));
      expect(out).toHaveLength(2);
    },
    3_600_000,
  );
});
