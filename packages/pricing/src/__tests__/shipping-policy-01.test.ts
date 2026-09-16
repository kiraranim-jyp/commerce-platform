import { describe, expect, it } from "vitest";
import {
  CATEGORY_COST_POLICIES,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  EMS_RATE_TABLE_ORIGIN_COUNTRY,
  computeGolfLandedCost,
  computePriceBreakdown,
  estimateEmsJapanToKorea,
  hasConfirmedWeightBasedShippingRates,
  resolveOverseasShippingBasis,
  type CostPolicyId,
} from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SHIPPING-POLICY-01 — 해외물류비 정책 정리 + 출발국 오적용 차단
 * (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 최종 목표를 그대로 옮기면:
 *
 *   "12,000원을 «없애는 것»이 아니다. 그 기본값을 정상적으로 «보존»하면서,
 *    실제 배송비를 알 수 있을 때만 정확한 값으로 대체하고, 출발국이 다른데
 *    일본 배송비가 «조용히» 붙는 문제를 완전히 차단하는 것이다."
 *
 * 이 파일은 그 세 문장을 각각 계산으로 붙잡는다. 새 계산기도, 새 요금표도,
 * 새 필드도 만들지 않는다 — 이미 있는 함수를 부르고 결과를 고정할 뿐이다.
 */

/* ═══════════ ① 12,000원은 기본값이고, 그 자리에 그대로 있다 ═══════════ */

describe("SHIPPING-POLICY-01 ①: 기본 해외물류비 ₩12,000 은 보존된다", () => {
  it("기본값은 12,000원 하나뿐이다 — 19,800 으로 재정의되지 않았다", () => {
    expect(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw).toBe(12000);
    // 19,800 은 이 자리에 온 적이 없다. 그 숫자가 실제로 사는 곳은 두 군데다:
    //   apps/admin/src/app/settings/page.tsx  「배송비(원)」 placeholder(구매자 청구 배송비)
    //   apps/admin/fixtures/smartstore/golden-success-03-n371.json  baseFee(네이버 payload fixture)
    // 둘 다 가격엔진이 읽지 않는다.
    expect(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw).not.toBe(19800);
  });

  /**
   * 🔴 회귀 기준선(CEO §12). 실상품 숫자 그대로다:
   *   Bobo Choses B226AC043 €75 → 상품가 ₩111,000 · 원가 ₩123,000 · 권장가 ₩175,714
   * 이 세 숫자가 움직이면 아동의류 전체가 움직인 것이다.
   */
  it("🔴 Kids 회귀 — Bobo Choses €75 의 상품가·원가·권장가가 그대로다", () => {
    const breakdown = computePriceBreakdown({
      originalAmount: 75,
      originalCurrency: "EUR",
      ...DEFAULT_PRICE_BREAKDOWN_INPUT,
    });
    expect(breakdown.costKrw).toBe(111000);
    expect(breakdown.landedCostKrw).toBe(123000);
    expect(breakdown.suggestedPriceKrw).toBe(175714);
    // 원가 − 상품가 = 해외물류비. 이 뺄셈이 12,000 이 아니면 기본값이 움직인 것이다.
    expect(breakdown.landedCostKrw - breakdown.costKrw).toBe(12000);
  });

  it("아동의류는 중량기반 계산에 «진입조차» 하지 않는다 — 이번 변경이 닿을 수 없는 자리다", () => {
    expect(CATEGORY_COST_POLICIES.KIDS_FASHION.weightBasedShipping).toBe(false);
    expect(CATEGORY_COST_POLICIES.KIDS_FASHION.volumetricDivisor).toBeNull();
  });
});

/* ═════════ ② 기본값인지 실제 배송비인지 화면이 구분할 수 있다 ═════════ */

describe("SHIPPING-POLICY-01 ②: 기본값과 실제 배송비를 구분해서 말한다", () => {
  it("기본값과 같은 값은 «기본 해외물류비»로 말한다 — 실제 배송비라고 하지 않는다", () => {
    const basis = resolveOverseasShippingBasis(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw);
    expect(basis.basis).toBe("DEFAULT");
    expect(basis.label).toContain("기본 해외물류비");
    // 🔴 CEO §7 의 금지선. 이 문장이 «실제 배송비입니다»가 되면 안 된다.
    expect(basis.label).toContain("실제 배송비로 확인된 값이 아닙니다");
  });

  it("기본값과 다른 값은 판매자가 넣은 값이다 — shippingKrw 를 쓰는 입력칸이 하나뿐이기 때문이다", () => {
    for (const krw of [0, 9000, 23000, 97520]) {
      const basis = resolveOverseasShippingBasis(krw);
      expect(basis.basis, `${krw}`).toBe("SELLER_INPUT");
      expect(basis.label, `${krw}`).not.toContain("기본");
    }
  });

  it("🔴 «계산 불가»를 기본값으로 메우지 않는다 — 출발국을 모르면 12,000 이 아니라 null 이다", () => {
    const unknownOrigin = computeGolfLandedCost({
      sourcePriceAmount: 41.99,
      sourcePriceCurrency: "USD",
      actualWeightKg: 0.55116,
      originCountry: "US",
    });
    expect(unknownOrigin.internationalShippingKrw).toBeNull();
    expect(unknownOrigin.internationalShippingKrw).not.toBe(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw);
    expect(unknownOrigin.shippingStatus).toBe("unknown");
  });
});

/* ══════ ③ shippingKrw 는 «해외물류비»다 — 다른 배송비와 섞이지 않는다 ══════ */

describe("SHIPPING-POLICY-01 ③: shippingKrw 는 판매자가 치르는 해외물류비다", () => {
  it("해외물류비는 원가에 «들어간다» — landedCost = 상품가 + shippingKrw", () => {
    const b = computePriceBreakdown({
      originalAmount: 100,
      originalCurrency: "EUR",
      shippingKrw: 23000,
      feePercent: 10,
      marginPercent: 20,
    });
    expect(b.landedCostKrw).toBe(b.costKrw + 23000);
  });

  /**
   * 🔴 구매자에게 «청구하는» 배송비(SellerProfile.deliveryCharge)는 원가가 아니다
   * (unified-price-decision.ts:22 의 대표님 결정 그대로). 그 규칙은
   * unified-price-decision.test.ts 가 이미 고정하고 있고, 여기서는 «두 값이
   * 서로의 자리에 들어가지 않는다»는 사실만 다시 못 박는다: computePriceBreakdown
   * 에는 구매자 청구 배송비를 넣을 «칸 자체가 없다».
   */
  it("구매자 청구 배송비를 넣을 칸이 없다 — 이어 붙일 자리가 없어야 새지 않는다", () => {
    const b = computePriceBreakdown({
      originalAmount: 100,
      originalCurrency: "EUR",
      ...DEFAULT_PRICE_BREAKDOWN_INPUT,
    });
    expect(Object.keys(b).sort()).toEqual(
      [
        "costKrw",
        "exchangeRate",
        "feePercent",
        "isRateEstimate",
        "landedCostKrw",
        "marginPercent",
        "originalAmount",
        "originalCurrency",
        "shippingKrw",
        "suggestedPriceKrw",
      ].sort(),
    );
  });
});

/* ══════════ ④ 출발국 안전성 — 골프 밖에도 새는 곳이 없다 ══════════ */

describe("SHIPPING-POLICY-01 ④: 일본 요금표는 출발국이 일본일 때만 열린다", () => {
  it("JP 만 통과한다. US · DE · NZ · GB · 미상은 전부 막힌다", () => {
    expect(EMS_RATE_TABLE_ORIGIN_COUNTRY).toBe("JP");
    expect(hasConfirmedWeightBasedShippingRates("JP")).toBe(true);
    expect(hasConfirmedWeightBasedShippingRates(" jp ")).toBe(true);
    for (const c of ["US", "DE", "NZ", "GB", "CN", "KR", "", null, undefined]) {
      expect(hasConfirmedWeightBasedShippingRates(c), `${c}`).toBe(false);
    }
  });

  /**
   * 🔴 CEO §5 — "aae9bd0 은 computeGolfLandedCost 만 막았다. «다른 경로»에서
   * EMS 를 부르는 곳이 있는지 전수로 확인하라."
   *
   * 전수 확인 결과 estimateEmsJapanToKorea 의 호출부는 프로덕션 코드에서
   * computeGolfLandedCost 한 곳뿐이고, 그 한 곳이 이미 출발국 문 뒤에 있다.
   * 그 «한 곳뿐»이라는 사실을 지키는 장치가 아래 두 테스트다:
   *   ① 중량기반 카테고리는 GOLF 하나뿐이다 — 새 카테고리가 중량기반이 되면
   *      여기서 먼저 깨지고, 그때 출발국 문을 다시 보게 된다.
   *   ② 중량기반이 아닌 카테고리는 출발국이 JP 여도 EMS 를 부르지 않는다.
   */
  it("중량기반 카테고리는 GOLF 하나뿐이다 — 늘어나면 출발국 문을 다시 봐야 한다", () => {
    const weightBased = (Object.keys(CATEGORY_COST_POLICIES) as CostPolicyId[]).filter(
      (id) => CATEGORY_COST_POLICIES[id].weightBasedShipping,
    );
    expect(weightBased).toEqual(["GOLF"]);
  });

  it("중량기반이 아닌 카테고리는 출발국이 JP 여도 일본 요금을 받지 않는다", () => {
    for (const id of Object.keys(CATEGORY_COST_POLICIES) as CostPolicyId[]) {
      if (CATEGORY_COST_POLICIES[id].weightBasedShipping) continue;
      const cost = computeGolfLandedCost({
        sourcePriceAmount: 4950,
        sourcePriceCurrency: "JPY",
        categoryProfileId: id,
        actualWeightKg: 0.55116,
        originCountry: "JP",
      });
      expect(cost.emsEstimate, id).toBeNull();
      expect(cost.internationalShippingKrw, id).toBeNull();
      expect(cost.shippingStatus, id).toBe("unknown");
    }
  });

  it("estimateEmsJapanToKorea 는 스스로 출발국을 묻지 않는다 — 문은 호출부 한 곳에만 있다", () => {
    // 이 함수는 «일본→한국» 요금표 조회기다. 인자에 국가가 없다는 사실 자체가
    // "아무나 부르면 안 된다"는 뜻이고, 그래서 호출부를 세는 것이 의미가 있다.
    expect(estimateEmsJapanToKorea.length).toBe(2);
    expect(estimateEmsJapanToKorea(0.55116)).not.toBeNull();
  });

  it("🔴 출발국 JP · US · DE · 미상 — 네 갈래가 각각 다른 결과를 낸다", () => {
    const base = { sourcePriceAmount: 4950, sourcePriceCurrency: "JPY", actualWeightKg: 0.55116 } as const;
    const jp = computeGolfLandedCost({ ...base, originCountry: "JP" });
    const us = computeGolfLandedCost({ ...base, originCountry: "US" });
    const de = computeGolfLandedCost({ ...base, originCountry: "DE" });
    const none = computeGolfLandedCost(base);

    expect(jp.shippingStatus).toBe("estimated");
    expect(jp.internationalShippingKrw).not.toBeNull();
    for (const [label, r] of [
      ["US", us],
      ["DE", de],
      ["미상", none],
    ] as const) {
      expect(r.shippingStatus, label).toBe("unknown");
      expect(r.internationalShippingKrw, label).toBeNull();
      // 🔴 «모른다»가 일본 값과 같아지면 그건 일본으로 추정했다는 뜻이다.
      expect(r.internationalShippingKrw, label).not.toBe(jp.internationalShippingKrw);
    }
  });
});
