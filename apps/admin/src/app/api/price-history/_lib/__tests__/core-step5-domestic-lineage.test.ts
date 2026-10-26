import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";
import type { CandidateOverseasPriceRecord } from "../candidate-market";
import {
  buildMarketJudgement,
  isPriceConfirmed,
  saleState,
  selectMiSameCandidates,
  transientDisplayTier,
} from "../../../../pipeline/commerce/mi-same-candidates";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-NEXT STEP 5-1 / 5-2 — **국내 참고가격 ↔ SAME candidate lineage**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시(2026-10-26) — 「구현부터 들어가면 또 다른 가격 파이프라인을 만들 위험이
 *    있다. **실제 `KRW 88,000` 이 어떤 후보에서 왔는지부터 증명** 하게 한다」.
 * 🔴 **운영 코드 변경 0** — 이 파일은 운영 함수를 **운영 호출 순서 그대로** 부르고
 *    숫자를 읽기만 한다(판정 0 · 집계 식 0 · 새 규칙 0).
 *
 * ── 🔴🔴 측정하는 것은 «두 자격 술어의 차이» 하나다 ─────────────────────────
 * ```
 * UI SAME 축        transientDisplayTier(row) === "SAME"  (+ 판매중 + 가격확인)
 *                   ⟸ matchTruth EXACT_IDENTIFIER | STRONG_IDENTIFIER
 * 국내 참고가격 축   market === "KR" && priceKrw != null
 *                   && priceTier ∈ { EXACT, COMPARISON }     (market-intelligence:318)
 *                   ⟸ priceTier: TEXT_CONFIRMED → **COMPARISON** · matchTruth null →
 *                      `verified ? EXACT : COMPARISON`       (priceTierFromLink:86)
 * ⟹ 🔴 **TEXT_CONFIRMED(= 화면에서 「보류」) 후보의 가격이 참고가격에 들어간다.**
 *    그 사실을 **실제 후보로** 증명하는 것이 이 하니스의 목적이다.
 * ```
 *
 * 🔴 **URL 을 지어내지 않았다** — 원상품/후보 URL 전부 기존 GT fixture 의 값이다
 *    (`wu-112` · `wu-116` · `core-2m-ceo-visual-gt`).
 * 🔴 게이트 `CORE_STEP5_PROBE=1` 없으면 SKIP(외부 HTTP).
 */
const LIVE = process.env.CORE_STEP5_PROBE === "1";
const loose = (u: string) =>
  String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

const CASES = [
  {
    code: "B226AC009",
    origin: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
    /** 🔴 전부 기존 fixture 의 실제 URL 이다(human 라벨 포함). */
    gt: [
      {
        url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/",
        human: "SAME",
      },
      { url: "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05", human: "DIFFERENT" },
      /** 🔴 CORE-2R-4/5 가 「KRW 88,000」을 측정한 그 판매처(core-2m GT · 라벨 없음). */
      { url: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785", human: "(라벨없음)" },
    ],
  },
  {
    code: "B226AC010",
    origin: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
    gt: [
      { url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021", human: "SAME" },
      {
        url: "https://luksusbaby.kr/products/bobo-choses-light-blue-booty-ghosts-sweatshirt-1",
        human: "DIFFERENT",
      },
      { url: "https://kream.co.kr/products/1030865", human: "DIFFERENT" },
    ],
  },
] as const;

interface Row {
  code: string;
  host: string;
  human: string;
  /** ② 후보가 생겼는가 */
  candidate: boolean;
  /** ③ 샵 판정이 돌았는가 */
  judged: boolean;
  dropGate: string | null;
  /** ④ MI 산출 */
  matchTruth: string | null;
  displayTier: string | null;
  /** ⑤ 가격 자격 tier(= 참고가격 입력) */
  priceTier: string | null;
  /** ⑥ 시장 */
  market: string | null;
  /** ⑦ 가격 */
  price: string | null;
  priceConfirmed: boolean;
  /** 🔴 두 축의 결론 */
  inSameAxis: boolean;
  inReferencePrice: boolean;
}

describe("CORE-NEXT STEP 5-1/5-2 — 국내 참고가격 lineage", () => {
  it.runIf(LIVE)("KRW 참고가격을 만든 후보 각각의 MI SAME 결과를 적는다", async () => {
    const all: Row[] = [];
    /* eslint-disable no-console */

    for (const c of CASES) {
      /* ── ① 원상품을 운영 경로로 추출 ── */
      const ex = await shopifySiteStrategy.extract(c.origin);
      expect(ex, `원상품 추출 실패: ${c.code}`).not.toBeNull();
      const product = buildCanonicalProduct(
        c.origin,
        ex!.productData as ExtractedProductData,
        {} as Record<string, ProductDataSource>,
        [],
      );
      const dna = buildProductIdentityDna(product);
      const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        searchTerm: terms[0] ?? dna.title,
        searchTerms: terms,
        facts: productFactsFromIdentityDna(dna),
      };
      console.log(
        `\n═══ ${c.code} — brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} ═══`,
      );

      /* ── ② 후보 풀(운영 생산자) ── */
      const pool = await collectUrlCandidatePool({
        urls: c.gt.map((g) => g.url),
        originUrl: dna.sourceUrl,
        maxUrls: c.gt.length,
        existingCanonicalUrls: new Set<string>(),
        shopId: REVIEWED_SAME_SHOP_ID,
        shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
      });
      console.log(`② 후보 풀 — usable ${pool.metrics.usableProductUrls}/${c.gt.length}`);

      const rows: GeminiTransientRow[] = [];
      const byUrl = new Map<string, Row>();
      for (const g of c.gt) {
        byUrl.set(loose(g.url), {
          code: c.code,
          host: (() => {
            try {
              return new URL(g.url).hostname;
            } catch {
              return "?";
            }
          })(),
          human: g.human,
          candidate: false,
          judged: false,
          dropGate: null,
          matchTruth: null,
          displayTier: null,
          priceTier: null,
          market: null,
          price: null,
          priceConfirmed: false,
          inSameAxis: false,
          inReferencePrice: false,
        });
      }

      /* ── ③ 샵별 — 운영 호출 순서 그대로 ── */
      for (const res of pool.searchResults) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        for (const cand of res.candidates) {
          const r = byUrl.get(loose(cand.url));
          if (r) r.candidate = true;
        }
        const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
        const scored = withConfidence(query, notSelf);
        let priced = scored;
        try {
          priced = await enrichCandidatePrices(scored, res.domain, query);
        } catch {
          /* 운영과 같다 */
        }
        const j = await judgeDomesticCandidate({
          domain: res.domain,
          candidates: priced,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
        });
        if (j.kind !== "JUDGED") {
          for (const cand of priced) {
            const r = byUrl.get(loose(cand.url));
            if (r) r.dropGate = j.kind === "DROPPED" ? (j.gate ?? "DROPPED") : j.kind;
          }
          continue;
        }
        const m = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: false,
        });
        /** 🔴 운영 러너가 만드는 그 행 모양 그대로(사본 0). */
        const row: GeminiTransientRow = {
          source: "REVIEWED_SAME",
          domain: res.domain,
          title: j.best.title,
          imageUrl: j.best.imageUrl ?? null,
          soldOut: j.best.soldOut ?? null,
          discoveredUrl: j.best.url,
          matchTruth: j.matchTruth,
          priceTier: priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }),
          crossSellerVerdict: j.best.crossSellerVerdict ?? null,
          confidence: j.best.confidence ?? null,
          matchReasons: j.best.matchReasons ?? [],
          crossSellerBlockers: (j.best.crossSellerBlockers ?? []).map((b) =>
            typeof b === "string" ? b : b.blocker,
          ),
          crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((x) =>
            typeof x === "string" ? x : x.conflict,
          ),
          priceAmount: j.best.price?.amount ?? null,
          priceCurrency: j.best.price?.currency ?? null,
          priceStatus: j.best.priceStatus ?? null,
          market: m.market,
          basis: m.basis,
          priceKrw: m.market === "KR" ? (j.best.price?.amount ?? null) : null,
        } as unknown as GeminiTransientRow;
        rows.push(row);

        const r = byUrl.get(loose(j.best.url));
        if (r) {
          r.judged = true;
          r.matchTruth = j.matchTruth;
          r.displayTier = transientDisplayTier(row);
          r.priceTier = row.priceTier ?? null;
          r.market = m.market;
          r.price = row.priceAmount != null ? `${row.priceCurrency} ${row.priceAmount}` : null;
          r.priceConfirmed = isPriceConfirmed(row);
        }
      }

      /* ── ④ 두 축을 «운영이 쓰는 그 함수» 로 각각 계산한다 ── */
      /** A. UI SAME 축 — `MarketPriceComparison` 이 쓰는 그 선별기. */
      const sameSel = selectMiSameCandidates(rows, "KR");
      for (const row of sameSel.priced) {
        const r = byUrl.get(loose(row.discoveredUrl));
        if (r) r.inSameAxis = true;
      }
      /**
       * B. 국내 참고가격 축 — `market-intelligence.ts:318` 의 **그 조건 그대로** 다.
       *    🔴 식을 바꾸지 않았다(바꾸면 운영 숫자를 재현하지 못한다).
       */
      const domesticPairs: { record: CandidateOverseasPriceRecord; row: GeminiTransientRow }[] = [];
      for (const row of rows) {
        const anyRow = row as unknown as { priceKrw?: number | null };
        if (row.market !== "KR") continue;
        if (anyRow.priceKrw == null) continue;
        if (row.priceTier !== "EXACT" && row.priceTier !== "COMPARISON") continue;
        domesticPairs.push({
          record: {
            market: row.market,
            currency: "KRW",
            amount: anyRow.priceKrw,
            priceTier: row.priceTier,
            sellerKey: row.domain,
          },
          row,
        });
        const r = byUrl.get(loose(row.discoveredUrl));
        if (r) r.inReferencePrice = true;
      }
      const domesticRecords = domesticPairs.map((p) => p.record);
      const reference = summarizeCandidateOverseasPrices(domesticRecords);
      const judgement = buildMarketJudgement(rows);
      /**
       * ════════════════════════════════════════════════════════════════════
       * 🔴🔴 **반사실 — 「SAME 만 참고가격으로」 하면 숫자가 어떻게 되는가**
       * ════════════════════════════════════════════════════════════════════
       *
       * 🔴 STEP 5-3 이 요구하는 변경(「MI 가 SAME 으로 인정한 후보에서만 가격」)의
       *    **효과를 구현 «전» 에** 같은 실행에서 잰다 — CPO 가 「COMPARISON 을 함부로
       *    뒤집지 말라」고 못 박았고, 그 판단에는 **잃는 숫자** 가 필요하다.
       * 🟢 집계기는 **같은 함수** 다(식 변경 0) — 입력 레코드만 SAME 축으로 좁힌다.
       */
      const sameOnlyRecords = domesticPairs
        .filter((p) => transientDisplayTier(p.row) === "SAME")
        .map((p) => p.record);
      const sameOnlyReference = summarizeCandidateOverseasPrices(sameOnlyRecords);

      console.log(`③ 행 ${rows.length}건 · 국내 참고가격 레코드 ${domesticRecords.length}건`);
      console.log(`④ 🇰🇷 참고가격 집계(현행) = ${JSON.stringify(reference)}`);
      console.log(
        `④-CF 🔴 SAME 만 허용하면 = ${JSON.stringify(sameOnlyReference)}` +
          `  (레코드 ${domesticRecords.length} → ${sameOnlyRecords.length})`,
      );
      console.log(
        `⑤ SAME 축(UI) — priced ${sameSel.priced.length} · 제외 ${sameSel.sameButExcluded.length}` +
          ` · verdict ${judgement.verdict} · 판매중 ${judgement.onSaleCount}`,
      );
      for (const row of rows) {
        console.log(
          `    ${row.domain} · sale=${saleState(row)} · truth=${row.matchTruth}` +
            ` · display=${transientDisplayTier(row)} · tier=${row.priceTier}` +
            ` · ${row.priceCurrency ?? "-"} ${row.priceAmount ?? "-"}`,
        );
      }
      all.push(...byUrl.values());
    }

    /* ── ⑥ CPO 가 요구한 lineage 표 — 분모를 포함한다 ── */
    console.log("\n═══ STEP 5-2 lineage (분모 포함) ═══");
    console.log("code | host | human | 후보 | 판정 | matchTruth | display(SAME?) | tier | market | 가격 | SAME축 | 참고가격");
    for (const r of all) {
      console.log(
        [
          r.code,
          r.host,
          r.human,
          r.candidate ? "O" : "X",
          r.judged ? "O" : (r.dropGate ?? "X"),
          r.matchTruth ?? "-",
          r.displayTier ?? "-",
          r.priceTier ?? "-",
          r.market ?? "-",
          r.price ?? "-",
          r.inSameAxis ? "O" : "X",
          r.inReferencePrice ? "O" : "X",
        ].join(" | "),
      );
    }

    /* ── ⑦ Q5 의 답 — SAME 이 아닌데 참고가격에 든 후보 ── */
    const leak = all.filter((r) => r.inReferencePrice && r.displayTier !== "SAME");
    console.log(
      `\n⑦ 🔴 **참고가격에는 들었는데 SAME 축에는 없는 후보 = ${leak.length}건**` +
        (leak.length > 0
          ? `\n    ${leak.map((r) => `${r.host}(${r.displayTier} · ${r.priceTier} · ${r.price})`).join(" · ")}`
          : ""),
    );
    const bothAxes = all.filter((r) => r.inReferencePrice && r.displayTier === "SAME");
    console.log(`    🟢 두 축 모두에 든 후보 = ${bothAxes.length}건`);

    /**
     * 🔴 **열화된 실행으로 결론을 내지 않는다**(「측정불가」≠「0」) — 후보가 절반도
     *    생기지 않았으면 그 run 은 버린다(WU-133 이 박아 둔 게이트와 같은 축).
     */
    expect(all.filter((r) => r.candidate).length, "열화된 실행 — 재실행 필요").toBeGreaterThan(
      all.length / 2,
    );
    /** 🟢 이 하니스는 **판정하지 않는다** — 숫자를 적는 것이 전부다. */
    expect(all.length).toBe(CASES.reduce((n, c) => n + c.gt.length, 0));
  }, 600_000);
});
