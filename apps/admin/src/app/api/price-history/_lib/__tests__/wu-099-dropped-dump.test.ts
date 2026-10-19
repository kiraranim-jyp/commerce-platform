import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "@commerce/crawler/src/comparison-search/ai-answer-urls";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { withConfidence, enrichCandidatePrices, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-099 — **DROPPED 후보 가치 검증용 덤프** (LIVE · Review-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 금지: matchLevel 완화 ❌ · threshold ❌ · 8축 ❌ · **priceTier 생성 ❌** ·
 *    **matchTruth 생성 ❌** · MI 전달 ❌ · price_alerts ❌ · JUDGED 경로 변경 ❌ ·
 *    운영 가격비교 UI 변경 ❌
 * 🔴 보존 범위 — **샵당 top 1건**(`DROPPED.observed.candidate`) ⟹ 계약 변경 **0**
 */
const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const SEARCH = path.join(OUT, "mi-019a-search-result.json");
const LIVE = process.env.MI_P0_02_LIVE === "1";
const READY = existsSync(SEARCH);
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt";

describe("WU-099 — DROPPED top-1 덤프 (LIVE)", () => {
  (READY && LIVE ? it : it.skip)(
    "운영 judgeDomesticCandidate 의 DROPPED 만 모은다",
    async () => {
      const s = JSON.parse(readFileSync(SEARCH, "utf8")) as { rows: { candidates: string[]; dropped?: { url: string }[] }[] };
      const all = new Set<string>();
      for (const r of s.rows) {
        r.candidates.forEach((u) => all.add(u));
        (r.dropped ?? []).forEach((d) => all.add(d.url));
      }
      const ex = extractCandidateUrlsFromAiAnswer([...all].map((u, i) => `${i + 1}. ${u}`).join("\n"), null);
      const of_ = await factsFromProductUrl(ORIGIN);
      const query = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts } as ComparisonQuery;
      const pool = await collectUrlCandidatePool({ urls: ex.urls, originUrl: query.sourceUrl ?? null, maxUrls: 400, existingCanonicalUrls: new Set<string>() });

      const dropped: Record<string, unknown>[] = [];
      let judgedCount = 0;
      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const priced = await enrichCandidatePrices(withConfidence(query, notSelf), r.domain, query);
        /** 🟢 운영 owner 를 그대로 부른다. 🔴 추가 HTTP 0. */
        const j = await judgeDomesticCandidate({
          domain: r.domain, candidates: priced, sourceUrl: query.sourceUrl,
          foreignModelCode: query.facts?.brandModelCode ?? null,
          foreignColor: query.facts?.colorText ?? null,
          fetchModelCode: async () => null,
        });
        if (j.kind === "JUDGED") { judgedCount += 1; continue; }
        if (j.kind !== "DROPPED") continue;
        const c = j.observed.candidate;
        const m = classifyCandidateMarket({ domain: r.domain, currency: c.price?.currency ?? null, isRegisteredDomesticShop: false });
        dropped.push({
          /** 🔴 **있는 값만** 옮긴다 — priceTier / matchTruth / verified 는 **만들지 않는다**. */
          domain: r.domain, title: c.title, url: c.url, imageUrl: c.imageUrl ?? null,
          brand: c.facts?.brand ?? null, modelCode: c.facts?.brandModelCode ?? null,
          color: c.facts?.colorText ?? null,
          price: c.price ?? null, priceStatus: c.priceStatus ?? null,
          market: m.market, basis: String(m.basis),
          crossSellerVerdict: c.crossSellerVerdict ?? null,
          crossSellerBlockers: (c.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
          crossSellerConflicts: (c.crossSellerConflicts ?? []).map((x) => (typeof x === "string" ? x : x.conflict)),
          matchReasons: c.matchReasons ?? [],
          matchLevel: c.matchLevel ?? null,
          dropGate: j.gate,
          candidateCount: j.candidateCount,
          /** 🔴 **CTO 가 채우지 않는다** — CEO 가 화면에서 채운다. */
          humanValue: null,
        });
      }
      const t: Record<string, number> = {};
      for (const d of dropped) t[String(d.crossSellerVerdict)] = (t[String(d.crossSellerVerdict)] ?? 0) + 1;
      // eslint-disable-next-line no-console
      console.log(`\nDROPPED 샵 **${dropped.length}** · JUDGED ${judgedCount} · verdict ${JSON.stringify(t)}`);
      // eslint-disable-next-line no-console
      /** 🔴 reduce 누적 타입을 명시한다 — 생략하면 `{}` 로 추론돼 `+` 가 막힌다(이 트랙 반복). */
      const gates: Record<string, number> = {};
      for (const d of dropped) gates[String(d.dropGate)] = (gates[String(d.dropGate)] ?? 0) + 1;
      // eslint-disable-next-line no-console
      console.log(`gate ${JSON.stringify(gates)}`);
      writeFileSync(path.join(OUT, "wu-099.json"), JSON.stringify({ dropped }, null, 1));
      expect(dropped.length).toBeGreaterThan(0);
    },
    3_600_000,
  );
});
