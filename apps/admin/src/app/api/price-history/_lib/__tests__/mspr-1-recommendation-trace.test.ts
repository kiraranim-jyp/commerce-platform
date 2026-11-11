import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computePriceBreakdown,
  computePriceRecommendation,
  computeSellability,
  deriveRepresentativeSellerVerdict,
  marginPercentAt,
  summarizeDomesticMarketSplit,
  toSellerFacingVerdict,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  type PriceObservationRecord,
} from "@commerce/pricing";
/** 🔴 원가 채택 규칙의 owner — `@commerce/pricing` 이 아니라 admin `_lib` 이다(WU-021 실측). */
import { selectCostBasisOriginObservations } from "../price-observations";
/** 🔴 owner 가 `@commerce/pricing` 이 «아니다» — admin `_lib` 이다(추측 금지 · WU-021 과 같은 자리). */
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
/** 🔴 소스 검사는 **주석을 벗기고** 한다 — 기존 헬퍼를 쓴다(사본 0). */
import { stripComments } from "../../../../pipeline/commerce/__tests__/source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-PRICE-RECOMMENDATION-VALIDATION-1 — **추천가격·CASE 사슬 검증**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **WU-021 이 남긴 구멍을 메운다.** 그 하니스는 「환율이 필요해서 `marketCase` 를
 *    측정하지 않았다」고 **적어 뒀다**(`mi-021-final-decision-trace.test.ts:149·189`).
 *    ⟹ 이번에는 **DB 환율표** 를 써서 원가 → 추천가격 → CASE 까지 끝까지 돈다(외부 API 0).
 *
 * ── 🔴 운영 호출 순서를 그대로 베낀다(복제식 아님) ─────────────────────────────
 * ```
 * market-intelligence.ts:313  listDomesticProductLinks → priceTierFromLink
 *                      :318   DOMESTIC_SHOP 관측을 sourceRefId 로 EXACT/COMPARISON 분류
 *                      :690   summarizeDomesticMarketSplit(exact, [comparison, history])
 *                      :857   computePriceBreakdown({... breakdownInput, shippingKrw}, rates)
 *                      :881   computePriceRecommendation({ totalCostKrw: cost.landedCostKrw, … })
 * ```
 * 🔴 **CONTROL 의 한계를 먼저 적는다**(§5-B) — 운영의 최종 verdict·CASE 는 **DB 에
 *    저장되지 않는다**(WU-021 이 칸 전수로 확인). ⟹ 이 측정은 「사슬이 끝까지 도는가 +
 *    정책을 지키는가」의 증거이고 **「운영이 낸 그 값을 재현했다」가 아니다.**
 *    🟢 단 **입력** 은 운영 실데이터다(스냅샷 16 · 관측 146 · 링크 10 · 환율 12).
 *
 * 🔴 **고치지 않는 것** — CASE A/B/C/D 정책 · 추천가 공식 · 마진/수수료 기본값 ·
 *    국내 basis 규칙 · verdict · 차액(추가 금지).
 */

const OUT = process.env.MSPR1_OUT_DIR ?? "";
const has = (f: string) => OUT !== "" && existsSync(path.join(OUT, f));
const LIVE = has("snapshots.json") && has("observations.json") && has("rates.json");
const read = <T>(f: string): T => JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as T;

interface SnapRow {
  id: string;
  brand: string | null;
  sku: string | null;
  price_amount: string | null;
  price_currency: string | null;
  price_validity: string | null;
  price_breakdown: { shippingKrw?: number; feePercent?: number; marginPercent?: number } | null;
}
interface ObsRow {
  snapshot_id: string;
  id: string;
  source: string;
  source_label: string | null;
  source_product_url: string | null;
  source_ref_id: string | null;
  currency: string | null;
  price_amount: number | null;
  price_krw: number | null;
  shipping_cost_amount: number | null;
  tax_amount: number | null;
  exchange_rate: number | null;
  sale_price_krw: number | null;
  original_price_krw: number | null;
  sold_out: boolean | null;
  market_code: string | null;
  market_country: string | null;
  checked_at: string;
}
interface LinkRow {
  snapshot_id: string;
  source_id: string;
  match_truth: string | null;
  verified: boolean | null;
}

/** 🟢 DB 행 → owner 가 먹는 모양. 🔴 **칸 이름만** 옮긴다(값을 만들지 않는다). */
const toRecord = (o: ObsRow): PriceObservationRecord =>
  ({
    id: o.id,
    snapshotId: o.snapshot_id,
    source: o.source,
    sourceLabel: o.source_label,
    sourceProductUrl: o.source_product_url,
    sourceRefId: o.source_ref_id,
    currency: o.currency,
    priceAmount: o.price_amount,
    shippingCostAmount: o.shipping_cost_amount,
    taxAmount: o.tax_amount,
    exchangeRate: o.exchange_rate,
    priceKrw: o.price_krw,
    salePriceKrw: o.sale_price_krw,
    originalPriceKrw: o.original_price_krw,
    soldOut: o.sold_out,
    marketCode: o.market_code,
    marketCountry: o.market_country,
    shippingPolicyStatus: null,
    shippingPolicyNote: null,
    checkedAt: o.checked_at,
  }) as unknown as PriceObservationRecord;

/* ═══════════════════════ 1) 실제 상품 — 운영 입력으로 끝까지 ═══════════════════════ */

describe.skipIf(!LIVE)("MSPR-1 실측 — 실제 상품의 원가 → 추천가격 → CASE", () => {
  it("상품별 입력과 출력을 한 줄씩 적고 **CASE 정책 불변식** 을 단언한다", () => {
    /* eslint-disable no-console */
    const snaps = read<SnapRow[]>("snapshots.json");
    const obs = read<ObsRow[]>("observations.json");
    const links = read<LinkRow[]>("links.json");
    const rates = Object.fromEntries(
      read<{ currency: string; rate: string }[]>("rates.json").map((r) => [r.currency, Number(r.rate)]),
    );

    expect(snaps.length, "🔴 실제 상품 5개 미만 — CPO §6 미충족").toBeGreaterThanOrEqual(5);
    expect(Object.keys(rates).length, "🔴 환율표가 비었다").toBeGreaterThan(3);

    console.log(
      "\n상품                     원가입력        착지원가    국내basis  국내최저    CASE  추천가      마진%",
    );
    let withRecommendation = 0;
    let caseD = 0;
    for (const s of snaps) {
      const myObs = obs.filter((o) => o.snapshot_id === s.id);
      /** 🔴 운영 :313·:318 — 링크 tier 로 DOMESTIC_SHOP 관측을 가른다(추측 분류 0). */
      const tierBySourceId = new Map(
        links
          .filter((l) => l.snapshot_id === s.id)
          .map((l) => [
            l.source_id,
            priceTierFromLink({ matchTruth: l.match_truth, verified: l.verified } as never),
          ]),
      );
      const exact: PriceObservationRecord[] = [];
      const comparison: PriceObservationRecord[] = [];
      for (const o of myObs.filter((x) => x.source === "DOMESTIC_SHOP")) {
        const tier = o.source_ref_id ? tierBySourceId.get(o.source_ref_id) : undefined;
        if (tier === "EXACT") exact.push(toRecord(o));
        else if (tier === "COMPARISON") comparison.push(toRecord(o));
      }
      const split = summarizeDomesticMarketSplit(exact, comparison);

      /** 🔴 운영 :809 — 셀러가 입력한 값이 없으면 **폼 기본값** 이다(지어내지 않는다). */
      const bi = {
        shippingKrw: s.price_breakdown?.shippingKrw ?? DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw,
        feePercent: s.price_breakdown?.feePercent ?? DEFAULT_PRICE_BREAKDOWN_INPUT.feePercent,
        marginPercent: s.price_breakdown?.marginPercent ?? DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent,
      };
      const amount = Number(s.price_amount ?? 0);
      const currency = s.price_currency ?? "";
      if (!(amount > 0) || currency === "") continue;

      const cost = computePriceBreakdown({ originalAmount: amount, originalCurrency: currency, ...bi }, rates);
      const rec = computePriceRecommendation({
        totalCostKrw: cost.landedCostKrw,
        domesticLowestPriceKrw: split.resolved.lowestPriceKrw,
        domesticAveragePriceKrw: split.resolved.averagePriceKrw,
        domesticBasis: split.basis,
        minimumMarginPercent: 10,
        targetMarginPercent: bi.marginPercent,
        expectedFeePercent: bi.feePercent,
        brandMedianPriceKrw: null,
      });

      /**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵 B 축 — **판매 추천 여부.** 🔴 WU-021 은 `marketCase: null` 로 넘겼다
       *    (환율이 없어서). 🟢 이번에는 **실제 CASE·추천가를 넣어** 그 구멍을 닫는다.
       * 🔴 운영 호출 순서 그대로 — :663 sellability → :675 대표판정 → :698 3단 압축.
       */
      const originHistory = selectCostBasisOriginObservations(
        myObs.filter((x) => x.source === "SELLER_ORIGIN").map(toRecord),
      );
      const costPriceKrw = originHistory[0]?.priceKrw ?? null;
      const sellability = computeSellability({
        costPriceKrw,
        domestic: { matched: split.exact.sellerCount > 0, averagePriceKrw: split.exact.averagePriceKrw },
      } as never);
      const representative = deriveRepresentativeSellerVerdict({
        unifiedDecision: null,
        sellability,
        domesticMatched: split.resolved.sellerCount > 0,
        domesticSellerCount: split.resolved.sellerCount,
        domesticBasis: split.basis,
        marketCase: rec.marketCase,
        recommendation: rec,
        domesticLowestPriceKrw: split.resolved.lowestPriceKrw,
        landedCostKrw: cost.landedCostKrw,
      } as never);
      const facing = toSellerFacingVerdict(representative);

      console.log(
        `  ${String(s.brand ?? "-").slice(0, 14).padEnd(14)} ${String(s.sku ?? "").slice(0, 10).padEnd(10)}` +
          ` ${String(amount).padStart(7)} ${currency.padEnd(4)}` +
          ` ${String(cost.landedCostKrw).padStart(9)}` +
          ` ${split.basis.padEnd(10)} ${String(split.resolved.lowestPriceKrw ?? "-").padStart(9)}` +
          `  ${rec.marketCase}    ${String(rec.recommendedPrice ?? "없음").padStart(9)}` +
          ` ${String(rec.estimatedMarginPercent ?? "-").padStart(5)}` +
          `  ${facing.icon} ${facing.code}`,
      );

      /* ── 🔴 B 축 불변식 — 「근거가 없으면 추천하지 않는다」 ─────────────────── */
      /**
       * 🔴🔴 **1차에 내 단언이 틀렸고 그대로 적는다.** `JSON.stringify(facing).includes("RECOMMENDED")`
       *    로 판정했더니 **`NOT_RECOMMENDED` 안의 `RECOMMENDED`** 가 걸려 **「판매 비추천」을
       *    「추천」으로** 읽었다(Pèpè 200 GBP · CASE C). ⟹ 🔴 enum 이름은 **부분문자열로
       *    비교하지 않는다** — 칸(`code`)을 **타입에서 읽어** 동등 비교한다.
       */
      const saysRecommended = facing.code === "RECOMMENDED";
      /**
       * 🔴🔴 **CPO §3-C 「근거와 최종 결과가 모순되지 않는지」.**
       *    실측에서 **CASE B + 추천가 존재 + 🔴 판매 비추천** 조합이 났다
       *    (Pèpè 258,000 마진 12% · Bobo 88,000 마진 10.4%). 🟢 그것은 **모순이 아니다** —
       *    `SELLER_FACING_MAP` 이 `HOLD → NOT_RECOMMENDED` 하나뿐이고 CASE B 는
       *    **목표마진 미달** 이라 HOLD 로 간다(정책). 🔴 그러나 셀러가 숫자와 결론을
       *    같이 보므로 **근거가 반드시 있어야** 한다 — 그것을 단언한다.
       */
      if (facing.code !== "RECOMMENDED") {
        expect(
          facing.reasons.length,
          `🔴 ${s.id} — ${facing.code} 인데 근거가 비었다(셀러가 왜인지 알 수 없다)`,
        ).toBeGreaterThan(0);
      }
      console.log(`        ↳ ${facing.title} · 근거 ${JSON.stringify(facing.reasons.slice(0, 2))}`);
      if (rec.marketCase === "D") {
        expect(
          saysRecommended,
          `🔴🔴 ${s.id} — CASE D(국내 EXACT 근거 없음)인데 최종 판정이 «추천» 이다`,
        ).toBe(false);
      }
      if (saysRecommended) {
        /** 🔴 추천이면 **추천가가 있어야** 한다 — 금액 없는 추천은 셀러가 실행할 수 없다. */
        expect(rec.recommendedPrice, `🔴 ${s.id} — 추천인데 추천가가 없다`).not.toBeNull();
      }

      /* ── 🔴 불변식 — 정책을 바꾸지 않고 «지키는지» 만 본다 ──────────────────── */
      if (rec.marketCase === "D") caseD += 1;
      if (rec.recommendedPrice != null) withRecommendation += 1;

      /** ① 국내 EXACT 근거가 없으면 **추천가를 만들지 않는다**(CASE D). */
      if (split.basis !== "EXACT" || split.resolved.lowestPriceKrw == null) {
        expect(rec.marketCase, `🔴 ${s.id} — EXACT 근거 없이 CASE ${rec.marketCase}`).toBe("D");
        expect(rec.recommendedPrice, `🔴 ${s.id} — 근거 없이 추천가를 만들었다`).toBeNull();
      }
      /** ② 추천가가 있으면 CASE 는 A 또는 B 다(C·D 는 추천가를 내지 않는다). */
      if (rec.recommendedPrice != null) {
        expect(["A", "B"]).toContain(rec.marketCase);
        /** ③ 🔴 **손실 추천 금지** — 추천가는 착지원가보다 커야 한다. */
        expect(
          rec.recommendedPrice,
          `🔴🔴 ${s.id} — 추천가(${rec.recommendedPrice})가 착지원가(${cost.landedCostKrw}) 이하다`,
        ).toBeGreaterThan(cost.landedCostKrw);
        /** ④ 마진 표기는 추천가·원가에서 파생된 값이어야 한다(다른 공식 금지). */
        expect(rec.estimatedMarginPercent).toBe(marginPercentAt(rec.recommendedPrice, cost.landedCostKrw));
      }
      /** ⑤ CASE A 는 목표가 이상, CASE B 는 시장가 그대로(정책 그대로). */
      if (rec.marketCase === "A") expect(rec.recommendedPrice!).toBeGreaterThanOrEqual(rec.targetPrice);
      if (rec.marketCase === "B") expect(rec.recommendedPrice).toBe(split.resolved.lowestPriceKrw);
    }
    console.log(
      `\n  요약 — 상품 ${snaps.length} · 추천가 산출 ${withRecommendation} · CASE D ${caseD}`,
    );
    /** 🔴 분모 0 을 PASS 로 쓰지 않는다 — 사슬이 한 번도 안 돌았으면 FAIL 이다. */
    expect(caseD + withRecommendation, "🔴 사슬이 한 상품도 돌지 않았다").toBeGreaterThan(0);
  });
});

/* ═══════════════════ 2) CPO §4 필수 시나리오 — 정책 불변식 ═══════════════════ */

/** 🟢 실측에서 그대로 가져온 비용 가정(폼 기본값) — 지어낸 값이 아니다. */
const BASE = {
  totalCostKrw: 100_000,
  minimumMarginPercent: 10,
  targetMarginPercent: 12,
  expectedFeePercent: 10,
  brandMedianPriceKrw: null,
} as const;

const rec = (over: Partial<Parameters<typeof computePriceRecommendation>[0]>) =>
  computePriceRecommendation({
    ...BASE,
    domesticLowestPriceKrw: null,
    domesticBasis: "NONE",
    ...over,
  } as Parameters<typeof computePriceRecommendation>[0]);

describe("MSPR-1 A — 🔴 추천가격은 «국내 EXACT 근거» 위에서만 난다", () => {
  it("S1 🟢 국내 SAME 가격이 충분히 높다 → CASE A · 추천가 ≥ 목표가", () => {
    const r = rec({ domesticBasis: "EXACT", domesticLowestPriceKrw: 200_000 });
    expect(r.marketCase).toBe("A");
    expect(r.recommendedPrice).toBeGreaterThanOrEqual(r.targetPrice);
    /** 🔴 시장가보다 **비싸게** 추천하지 않는다(덤핑도 과금도 하지 않는다). */
    expect(r.recommendedPrice!).toBeLessThanOrEqual(200_000);
  });

  it("S2 🔴 국내 SAME 이 없고 유사상품만 있으면 → **CASE D · 추천가 없음**", () => {
    const r = rec({ domesticBasis: "COMPARISON", domesticLowestPriceKrw: 150_000 });
    expect(r.marketCase, "🔴 유사상품 가격으로 추천을 만들면 거짓 근거다").toBe("D");
    expect(r.recommendedPrice).toBeNull();
    expect(r.estimatedMarginPercent).toBeNull();
  });

  it("S3 🔴 국내 근거가 아예 없으면 → CASE D(브랜드 중위값이 있어도 **참고치일 뿐**)", () => {
    const plain = rec({ domesticBasis: "NONE", domesticLowestPriceKrw: null });
    expect(plain.marketCase).toBe("D");
    expect(plain.recommendedPrice).toBeNull();
    const withMedian = rec({ domesticBasis: "NONE", domesticLowestPriceKrw: null, brandMedianPriceKrw: 300_000 });
    expect(withMedian.marketCase).toBe("D");
    expect(withMedian.recommendedPrice, "🔴 중위값으로 추천가를 만들면 안 된다").toBeNull();
    expect(withMedian.competitiveBasis).toBe("BRAND_MEDIAN");
    expect(withMedian.referencePriceKrw).not.toBeNull();
  });

  it("S4 🔴 시장가가 원가+수수료를 못 넘으면 → **CASE C · 추천가 없음**(손실 추천 금지)", () => {
    const r = rec({ domesticBasis: "EXACT", domesticLowestPriceKrw: 105_000 });
    expect(r.marketCase).toBe("C");
    expect(r.recommendedPrice).toBeNull();
    /** 🔴 수수료를 빼면 손실이다 — 그 경계가 **Net** 이라는 것이 MI-P0-COST-02 다. */
    expect(105_000 - BASE.totalCostKrw - 105_000 * 0.1).toBeLessThanOrEqual(0);
  });

  /**
   * 🔴🔴 **1차에 내 숫자가 틀렸고 그대로 적는다.** 125,000 을 「목표가 미달」로 썼는데
   *    `priceForMargin` 은 **원가 ÷ (1 − 마진)** 이라 목표가가 **113,636** 이다
   *    ⟹ 125,000 은 목표가를 **넘어서** CASE **A** 였다(기대값이 틀렸고 코드가 맞았다).
   * 🟢 그래서 CASE B 창을 **식으로** 적는다 — 손익분기(111,112) < 시장가 < 목표가(113,636).
   *    🔴 실측도 그 창을 보여 준다: Pèpè 원가 227,016 · 목표가 258,018 · 시장가 258,000 → **B**.
   */
  it("S5 🟡 손실은 아니지만 목표마진에 못 미치면 → CASE B · **시장가를 그대로** 권장", () => {
    const r = rec({ domesticBasis: "EXACT", domesticLowestPriceKrw: 112_000 });
    expect(r.marketCase).toBe("B");
    expect(r.recommendedPrice, "🔴 시장가보다 비싼 값을 추천하면 안 된다(P-26)").toBe(112_000);
    expect(r.recommendedPrice!).toBeLessThan(r.targetPrice);
    expect(r.netProfitKrw!).toBeGreaterThan(0);
  });

  it("S6 🔴 수익성이 부족해도 **추천가를 억지로 만들지 않는다** — C·D 는 항상 null", () => {
    for (const r of [
      rec({ domesticBasis: "EXACT", domesticLowestPriceKrw: 100_000 }),
      rec({ domesticBasis: "EXACT", domesticLowestPriceKrw: 50_000 }),
      rec({ domesticBasis: "COMPARISON", domesticLowestPriceKrw: 500_000 }),
    ]) {
      expect(r.recommendedPrice).toBeNull();
      expect(r.netProfitKrw).toBeNull();
      expect(r.netMarginPercent).toBeNull();
    }
  });

  it("S7 🔴 **추천가가 나면 반드시 손실이 아니다** — 경계를 전수로 쓸어 확인한다", () => {
    let priced = 0;
    for (let market = 60_000; market <= 400_000; market += 2_500) {
      const r = rec({ domesticBasis: "EXACT", domesticLowestPriceKrw: market });
      if (r.recommendedPrice == null) {
        expect(["C", "D"]).toContain(r.marketCase);
        continue;
      }
      priced += 1;
      expect(["A", "B"]).toContain(r.marketCase);
      /** 🔴 추천가 - 원가 - 수수료 > 0 이어야 한다(그 식이 CASE C 의 경계다). */
      const net = r.recommendedPrice - BASE.totalCostKrw - r.recommendedPrice * 0.1;
      expect(net, `🔴🔴 시장가 ${market} 에서 손실 추천이 났다`).toBeGreaterThan(0);
      expect(r.netProfitKrw!).toBeGreaterThan(0);
    }
    expect(priced, "🔴 추천가가 한 번도 안 났다 — 이 전수는 아무것도 못 지킨다").toBeGreaterThan(10);
  });

  it("S8 🔴 **환율/원가가 없으면 사슬 자체가 돌지 않는다** — 운영 가드를 글자로 잠근다", () => {
    /**
     * 🔴🔴 **주석을 벗긴다.** 1차에 벗기지 않아 FAIL 했다 — 그 파일의 P-24 주석이
     *    `recommendation?.recommendedPrice ?? cost.suggestedPriceKrw` 를 **설명으로**
     *    적어 뒀기 때문이다(메모 `source-scan-must-strip-comments` · 아홉 번째).
     */
    /**
     * 🔴 **정규식을 쓰지 않는다** — 1차에 스크립트로 편집하다 `\r\n` 이 **실제 줄바꿈** 으로
     *    박혀 파일이 구문 오류가 됐다(메모 그 함정 · 세 번째). `split/join` 으로 바꾼다.
     */
    const RAW = readFileSync(path.join(__dirname, "..", "market-intelligence.ts"), "utf8");
    const SRC = stripComments(RAW.split("\r\n").join("\n"));
    /** 🔴 `canComputeCost && shippingKrw != null` 안에서만 recommendation 이 만들어진다. */
    const at = SRC.indexOf("recommendation = computePriceRecommendation({");
    expect(at).toBeGreaterThan(0);
    const guard = SRC.lastIndexOf("if (canComputeCost", 0 + at);
    expect(guard, "🔴 원가 가드 밖에서 추천가를 만들면 환율 없이 숫자가 난다").toBeGreaterThan(0);
    expect(guard).toBeLessThan(at);
    /** 🔴 MI 는 추천가가 없으면 **null 을 내보낸다** — 원가 역산값으로 대체하지 않는다. */
    expect(SRC).toContain("recommendedPriceKrw: recommendation?.recommendedPrice ?? null");
    expect(SRC, "🔴 원가 역산값(suggestedPriceKrw)으로 추천가를 메우면 P-24 결함이 되돌아온다").not.toContain(
      "recommendation?.recommendedPrice ?? cost.suggestedPriceKrw",
    );
  });

  it("S10 🔴🔴 **CASE C 의 근거가 숫자와 모순되지 않는다**(이 WU 가 고친 거짓)", () => {
    /**
     * 🔴 운영 실측(2026-11-11): 착지원가 **189,900** · 국내 최저가 **202,000** → CASE C 인데
     *    사유가 「최저가가 착지원가보다 **낮아**」였다 ⟹ **202,000 > 189,900 이므로 거짓.**
     * 🟢 CASE C 의 실제 조건은 **수수료까지 뺀 손익** 이다(`MI-P0-COST-02`).
     */
    const highMarket = deriveRepresentativeSellerVerdict({
      unifiedDecision: null,
      sellability: computeSellability({
        costPriceKrw: 177_900,
        domestic: { matched: true, averagePriceKrw: 202_000 },
      } as never),
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "EXACT",
      marketCase: "C",
      recommendation: null,
      domesticLowestPriceKrw: 202_000,
      landedCostKrw: 189_900,
    } as never);
    const text = highMarket.reasons.join(" | ");
    expect(text, "🔴 CASE C 사유가 비었다").not.toBe("");
    /** 🔴🔴 최저가가 원가보다 **높은데** 「낮아」라고 적으면 화면이 거짓말한다. */
    expect(text, `🔴🔴 거짓 사유가 되돌아왔다: ${text}`).not.toContain("보다 낮아");
    expect(text).toContain("예상 수수료를 빼면 남지 않습니다");

    /**
     * 🟢 반대 모양(진짜로 최저가가 더 낮다)에서는 **기존 문장이 그대로** 다.
     * 🔴 **sellability 는 위와 같게 둔다** — 1차에 원가/평균가를 바꿨더니 그 판정이
     *    `READY` 가 아니게 되어 `applyMarketCaseGuard` 가 **조기 반환** 했고(CASE C 분기에
     *    도달조차 못 했다) 「사유가 비었다」는 **엉뚱한 FAIL** 이 났다. 🟢 그래서 이
     *    단언이 보는 두 입력(`domesticLowestPriceKrw`·`landedCostKrw`)**만** 바꾼다.
     */
    const lowMarket = deriveRepresentativeSellerVerdict({
      unifiedDecision: null,
      sellability: computeSellability({
        costPriceKrw: 177_900,
        domestic: { matched: true, averagePriceKrw: 202_000 },
      } as never),
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "EXACT",
      marketCase: "C",
      recommendation: null,
      domesticLowestPriceKrw: 258_000,
      landedCostKrw: 373_371,
    } as never);
    expect(lowMarket.reasons.join(" | "), "🟢 참이던 문장을 지우지 않았다").toContain(
      "보다 낮아 시장가로 팔면 손해입니다",
    );
  });

  it("S9 🟢 **CASE 는 네 값뿐** 이고 전이 조건이 서로 겹치지 않는다", () => {
    const seen = new Set<string>();
    for (const basis of ["EXACT", "COMPARISON", "NONE"] as const)
      /** 🔴 112,000 을 빼면 CASE B 가 한 번도 안 나와 이 단언이 **아무것도 못 지킨다**. */
      for (const market of [null, 50_000, 105_000, 112_000, 125_000, 300_000])
        seen.add(rec({ domesticBasis: basis, domesticLowestPriceKrw: market }).marketCase);
    expect([...seen].sort()).toEqual(["A", "B", "C", "D"]);
  });
});
