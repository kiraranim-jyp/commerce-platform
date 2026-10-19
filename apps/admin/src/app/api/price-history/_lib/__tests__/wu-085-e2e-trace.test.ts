import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { classifyCandidateMarket } from "../candidate-market";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import {
  withConfidence,
  enrichCandidatePrices,
  isSelfReferenceCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";


/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-085 — **B226AC112 국내 가격비교 E2E 전수 추적** (LIVE · 측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「더 많이 통과시키기가 목표가 아니다. **왜 도달하지 못하는지** 를 확정한다」
 *    8축 완화 ❌ · KRW 단독 ❌ · domain 단독 ❌ · AI ❌ · Smallable 특수처리 ❌
 *
 * 🟢 **운영 호출 순서를 베낀다**(§5-B · run-domestic-price-check.ts:934-1310):
 * ```
 * collectUrlCandidatePool   (→ factsFromProductUrl)
 *   → isSelfReferenceCandidate 로 거름
 *   → withConfidence(query, notSelf)
 *   → enrichCandidatePrices(scored, domain, query)      ← URL 풀만
 *   → classifyCandidateMarket({domain, currency, isRegisteredDomesticShop})
 *   🔴 priceTierFromLink 는 **부르지 않았다** — 그 입력을 재현할 수 없다(아래 주석)
 * ```
 * 🔴 `judgeDomesticCandidate` 는 **등록부 샵 경로** 이고 URL 풀 경로가 아니다 — 섞지 않는다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const LIVE = process.env.MI_P0_02_LIVE === "1";

/** 🔴 CPO 가 지정한 control. 🔴 URL 을 **지어내지 않았다** — 확인된 것만 넣는다. */
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac112-bobo-choses-pop-t-shirt";
const CANDIDATES = [
  "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac112/28063/category/1/display/3/",
  "https://shinsegaemall.ssg.com/item/itemView.ssg?itemId=1000883221075&salestrNo=6005&siteNo=6004",
  "https://www.smallable.com/en/product/bobo-choses-organic-cotton-t-shirt-ecru-bobo-choses-430700",
];

describe("WU-085 — B226AC112 E2E (LIVE)", () => {
  (LIVE ? it : it.skip)(
    "① URL→fetch ② evidence ③ market ④ price ⑤ UI 자격",
    async () => {
      /* ── 원상품 — 운영 owner 로 만든다(손으로 짓지 않는다) ── */
      const originFacts = await factsFromProductUrl(ORIGIN);
      expect(originFacts.status).toBe("OK");
      const query: ComparisonQuery = {
        title: originFacts.candidate!.title,
        sourceUrl: ORIGIN,
        facts: originFacts.candidate!.facts,
      } as ComparisonQuery;
      // eslint-disable-next-line no-console
      console.log(`\n원상품 ${query.title} · brand=${JSON.stringify(originFacts.candidate!.facts?.brand)} · code=${JSON.stringify(originFacts.candidate!.facts?.brandModelCode)}`);

      /* ── ① URL → fetch (운영 pool) ── */
      const pool = await collectUrlCandidatePool({
        urls: CANDIDATES,
        originUrl: ORIGIN,
        maxUrls: 10,
        existingCanonicalUrls: new Set<string>(),
      });
      // eslint-disable-next-line no-console
      console.log(`\n── ① URL 풀 ──  공급 ${pool.metrics.suppliedUrls} · 통과 ${pool.searchResults.length} · 탈락 ${pool.metrics.dropped.length}`);
      for (const d of pool.metrics.dropped) console.log(`   🔴 ${d.reason.padEnd(18)} ${d.url.slice(0, 70)}`);

      const rows: Record<string, unknown>[] = [];
      for (const r of pool.searchResults) {
        const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const scored = withConfidence(query, notSelf);
        /** 🟢 URL 풀은 운영에서 가격 보강을 **반드시** 탄다(:1078). */
        const priced = await enrichCandidatePrices(scored, r.domain, query);
        for (const c of priced) {
          const market = classifyCandidateMarket({
            domain: r.domain,
            currency: c.price?.currency ?? null,
            /** 🔴 등록부 소속은 **충돌 감지용** 이다. 이 하니스에서는 false(운영과 동일 입력을 못 만든다). */
            isRegisteredDomesticShop: false,
          });
          /**
           * 🔴🔴 **tier 를 여기서 만들지 않는다 — 1차 시도에서 «지어냈다».**
           *    `priceTierFromLink` 의 입력(`matchTruth`·`verified`)은
           *    `judgeDomesticCandidate` → `decideCandidateEvidence`(run-domestic-price-check:716·757)
           *    가 만든다. 내가 `{matchTruth:null, verified:false}` 를 넣어 COMPARISON 을
           *    얻었는데 그건 **입력 산물** 이지 운영 값이 아니다(이 트랙 2번째 같은 실수).
           * 🟢 그래서 tier 는 **측정불가** 로 적고, 측정된 것만 보고한다.
           */
          rows.push({
            domain: r.domain,
            title: c.title,
            brand: c.facts?.brand ?? null,
            modelCode: c.facts?.brandModelCode ?? null,
            colorText: c.facts?.colorText ?? null,
            price: c.price ?? null,
            priceStatus: c.priceStatus ?? null,
            priceSource: (c as { priceSource?: string }).priceSource ?? null,
            verdict: c.crossSellerVerdict ?? null,
            blockers: c.crossSellerBlockers ?? [],
            matchTruth: c.matchTruth ?? null,
            tier: "측정불가(judgeDomesticCandidate 입력 재현 불가)",
            ...market,
          });
        }
      }

      /* ── ②③④ 표 ── */
      // eslint-disable-next-line no-console
      console.log(`\n── ②③④ 후보 전수 (${rows.length}) ──`);
      for (const x of rows) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${String(x.domain).slice(0, 22).padEnd(23)} code=${String(x.modelCode).padEnd(11)} color=${String(x.colorText).padEnd(8)} ` +
            `price=${JSON.stringify(x.price)} ${String(x.priceStatus)} | market=${String(x.market).padEnd(8)} ${String(x.basis).slice(0, 30).padEnd(31)} ` +
            `truth=${String(x.matchTruth).padEnd(18)} tier=${x.tier}`,
        );
        // eslint-disable-next-line no-console
        console.log(`     verdict=${x.verdict} blockers=${JSON.stringify(x.blockers)}`);
      }

      /* ── ⑤ 국내 버킷 자격(운영 기준) ── */
      /**
       * 🔴 tier 를 뺀 **측정 가능한** 자격만 센다 — `market === "KR"` + KRW 가격.
       *    🔴 「국내 가격비교에 실제로 노출된다」로 읽지 않는다. tier 게이트가 뒤에 하나 더 있다.
       */
      const eligible = rows.filter(
        (x) => x.market === "KR" && (x.price as { currency?: string } | null)?.currency === "KRW",
      );
      // eslint-disable-next-line no-console
      console.log(`
── ⑤ **시장+가격** 자격 (market KR && KRW): **${eligible.length}건**  🔴 tier 게이트는 측정불가 ──`);
      for (const e of eligible) console.log(`   🟢 ${e.domain} ${JSON.stringify(e.price)}`);

      writeFileSync(path.join(OUT, "wu-085.json"), JSON.stringify({ dropped: pool.metrics.dropped, rows, eligible: eligible.length }, null, 1));
      expect(rows.length + pool.metrics.dropped.length).toBeGreaterThan(0);
    },
    1_800_000,
  );
});
