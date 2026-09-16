import { describe, expect, it } from "vitest";
import { computeGolfLandedCost } from "../golf-landed-cost";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLF-02-FEASIBILITY — 경량 골프용품 실제 판매성 파일럿 (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 파일은 **새 계산기가 아니다.** computeGolfLandedCost 를 그대로 부르고,
 * 2026-09-16 에 실제로 수집한 «측정값» 을 입력으로 고정한다. 목적은 하나다 —
 * 보고서에 적힌 숫자가 우리 원가 모델이 실제로 내놓는 숫자와 같다는 것을
 * 코드로 붙잡아 두는 것.
 *
 * 🔴 지어낸 값은 하나도 없다. 아래 네 종류만 들어간다:
 *   ① 해외 판매처가 실제로 표시한 가격  (요청 응답에서 읽은 값)
 *   ② 국내 가격비교가 실제로 표시한 가격 (요청 응답에서 읽은 값)
 *   ③ 환율 — /api/exchange-rates 와 같은 소스(Frankfurter/ECB) 2026-09-15 자
 *   ④ 골프공 12구의 «중량 하한» — R&A/USGA 규칙상 볼 1개 최대 45.93g 에서
 *      유도한 값. 박스·포장 무게는 모르므로 더하지 않는다.
 *
 * ── 🔴 SHIPPING-POLICY-01 ①(2026-09-16) — 이 문단이 틀렸었다 ────────────────
 * 원래 이 자리에는 이렇게 적혀 있었다:
 *
 *   "우리 EMS 표의 최하 구간은 «2kg 이하 ¥3,400» 하나뿐이고 … 따라서 과금중량이
 *    0 초과 2kg 이하이면 어떤 값을 넣어도 배송비는 같은 ¥3,400 이다. … 그래서
 *    포장 무게를 추정하지 않아도 배송비 항이 바뀌지 않는다."
 *
 * 그 문장은 **일본우편 요금표의 사실이 아니라 우리 표가 비어 있었다는 사실**을
 * 적은 것이었다. 공개 요금표(第1地帯)에는 500g·600g·…·1.75kg 구간이 실재하고,
 * 그래서 2kg 이하에서도 중량에 따라 요금이 ¥1,450 ~ ¥3,400 으로 갈린다.
 * 골프공 1더즌(0.551kg)의 실제 요금은 ¥3,400 이 아니라 **¥1,600** 이다 —
 * 우리는 경량 상품의 배송비를 2배 넘게 과대계상하고 있었다.
 *
 * ── 그래서 결론은 어떻게 되는가 ─────────────────────────────────────────────
 * 배송비를 «가장 싼 구간»(500g ¥1,450)까지 낮춰 잡아도 실측 5건은 전부 적자다.
 * 즉 GOLF-02 의 결론은 유지되지만, **그 결론이 서 있던 근거가 바뀌었다** —
 * 예전에는 "중량을 몰라도 요금이 같아서" 였고, 지금은 "중량을 가장 유리하게
 * 가정해도 적자라서" 다. 아래 첫 번째 테스트가 그 새 근거를 검증한다.
 *
 * 역방향 증명(수정 전 코드에 대면):
 *   2kg 이하에서는 어떤 중량을 넣어도 … 배송비가 같다
 *     AssertionError: expected 5 to be 1
 */

/** Frankfurter(ECB) 2026-09-15 기준. EUR 1 = KRW 1568.32 / JPY 178.86 에서 유도. */
const RATES_2026_09_15 = { JPY: 1568.32 / 178.86 } as const;

/** 골프공 1개 최대 중량 45.93g(R&A/USGA) × 12. 포장은 포함하지 않은 «하한»이다. */
const DOZEN_BALL_MIN_WEIGHT_KG = 0.55116;

interface Measured {
  label: string;
  /** 해외 판매처가 표시한 판매가(JPY, 税込). */
  jpy: number;
  /** 국내 가격비교의 최저가(KRW). 배송비는 별도 칸이다. */
  domesticLowestKrw: number;
  /** 국내 최저가 판매처의 배송비(KRW). 무료면 0. */
  domesticShippingKrw: number;
  actualWeightKg: number;
}

/** 2026-09-16 실측. 출처는 보고서 ①표와 같다. */
const MEASURED: Measured[] = [
  {
    // kakaku.com K0001668395 최저 ¥4,950(送料無料) / danawa pcode=75989531 ₩36,432(+3,500)
    label: "스릭슨 Z-STAR 2025 화이트 1더즌 — 일본 최저가 기준",
    jpy: 4950,
    domesticLowestKrw: 36432,
    domesticShippingKrw: 3500,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // d-sports-online.dunlop.co.jp/item/10360217.html ¥6,930(税込)
    label: "스릭슨 Z-STAR 2025 화이트 1더즌 — 일본 공식몰 기준",
    jpy: 6930,
    domesticLowestKrw: 36432,
    domesticShippingKrw: 3500,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // kakaku.com K0001663838 최저 ¥4,950 / danawa pcode=75989573 ₩36,432(+3,500)
    label: "스릭슨 Z-STAR XV 2025 화이트 1더즌 — 일본 최저가 기준",
    jpy: 4950,
    domesticLowestKrw: 36432,
    domesticShippingKrw: 3500,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // kakaku.com K0001676143 최저 ¥5,904(送料無料) / danawa pcode=75374075 ₩58,560(무료배송)
    label: "타이틀리스트 PRO V1 로우넘버 2025 화이트 1더즌 — 일본 최저가 기준",
    jpy: 5904,
    domesticLowestKrw: 58560,
    domesticShippingKrw: 0,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // d-sports-online.dunlop.co.jp/item/10317517.html ¥2,200(税込)
    // danawa pcode=14520566 ₩17,940(+3,000) — 국내명 «스릭슨 투어 클라리노»
    label: "스릭슨 글러브 GGG-S029 — 일본 공식몰 기준",
    jpy: 2200,
    domesticLowestKrw: 17940,
    domesticShippingKrw: 3000,
    actualWeightKg: 0.06,
  },
];

describe("GOLF-02-FEASIBILITY — 경량 골프용품 실측 원가", () => {
  it("🔴 2kg 이하에서도 중량이 배송비를 바꾼다 — «어떤 값을 넣어도 같다»는 옛 주장은 우리 표가 비어 있어서 나온 것이었다", () => {
    const weights = [0.06, 0.55116, 0.9, 1.5, 2] as const;
    const shipping = weights.map(
      (kg) =>
        computeGolfLandedCost({
          sourcePriceAmount: 4950,
          sourcePriceCurrency: "JPY",
          liveRates: RATES_2026_09_15,
          actualWeightKg: kg,
          // GOLF-04 STEP 1 — 출발국을 명시한다. MEASURED 는 전부 일본 판매처
          // (kakaku.com · dunlop.co.jp)라 이 축은 그대로지만, 이제 출발국을 적지
          // 않으면 배송비가 «확인 필요»가 된다 — 통화가 JPY 라는 사실만으로
          // 일본발이라고 가정하지 않기 때문이다.
          originCountry: "JP",
        }).internationalShippingKrw as number,
    );
    // 다섯 중량이 다섯 구간(500g · 600g · 900g · 1.5kg · 2kg)에 각각 걸린다.
    expect(new Set(shipping).size).toBe(weights.length);
    // 중량이 늘면 요금도 늘거나 같다(내려가는 구간이 있으면 표를 잘못 옮긴 것이다).
    for (let i = 1; i < shipping.length; i++) expect(shipping[i]).toBeGreaterThan(shipping[i - 1]);
    // 실제 공시 요금 ¥1,450 / ¥1,600 / ¥2,050 / ¥2,800 / ¥3,400 × 환율.
    expect(shipping).toEqual([1450, 1600, 2050, 2800, 3400].map((jpy) => Math.round(jpy * RATES_2026_09_15.JPY)));
  });

  it("🔴 배송비를 «가장 싼 구간»으로 낮춰 잡아도 실측 5건은 전부 적자다 — 결론은 중량 가정에 기대지 않는다", () => {
    // 공개 요금표의 최저 구간(500g ¥1,450)은 어떤 상품도 그보다 싸게 갈 수 없는
    // 하한이다. 그 하한을 모든 건에 씌우는 것이 셀러에게 «최대한 유리한» 가정이다.
    const cheapestShippingKrw = Math.round(1450 * RATES_2026_09_15.JPY);
    for (const m of MEASURED) {
      const cost = computeGolfLandedCost({
        sourcePriceAmount: m.jpy,
        sourcePriceCurrency: "JPY",
        liveRates: RATES_2026_09_15,
        actualWeightKg: m.actualWeightKg,
        originCountry: "JP",
      });
      expect(cost.internationalShippingKrw, m.label).toBeGreaterThanOrEqual(cheapestShippingKrw);
      const bestCaseSellerCost = (cost.productCostKrw as number) + cheapestShippingKrw;
      expect(bestCaseSellerCost - (m.domesticLowestKrw + m.domesticShippingKrw), m.label).toBeGreaterThan(0);
    }
  });

  it("실측 5건 모두 «판매자 원가 ≥ 국내 실구매가» 다 — 즉 판매 후보가 아니다", () => {
    const rows = MEASURED.map((m) => {
      const cost = computeGolfLandedCost({
        sourcePriceAmount: m.jpy,
        sourcePriceCurrency: "JPY",
        liveRates: RATES_2026_09_15,
        actualWeightKg: m.actualWeightKg,
        originCountry: "JP",
      });
      const productKrw = cost.productCostKrw;
      const shippingKrw = cost.internationalShippingKrw;
      expect(productKrw).not.toBeNull();
      expect(shippingKrw).not.toBeNull();
      const sellerCostKrw = (productKrw as number) + (shippingKrw as number);
      const domesticPaidKrw = m.domesticLowestKrw + m.domesticShippingKrw;
      return { label: m.label, sellerCostKrw, domesticPaidKrw, gapKrw: domesticPaidKrw - sellerCostKrw };
    });

    for (const r of rows) {
      // 🔴 «국내가 − 판매자 원가» 가 0 이하다. 마진이 아니라 적자다.
      expect(r.gapKrw, r.label).toBeLessThanOrEqual(0);
    }

    // 상품가만 비교해도(국제배송비 0원을 가정해도) 여전히 후보가 아닌 건은 몇 건인가.
    const negativeEvenWithFreeShipping = MEASURED.filter((m) => {
      const cost = computeGolfLandedCost({
        sourcePriceAmount: m.jpy,
        sourcePriceCurrency: "JPY",
        liveRates: RATES_2026_09_15,
        actualWeightKg: m.actualWeightKg,
        originCountry: "JP",
      });
      return (cost.productCostKrw as number) >= m.domesticLowestKrw + m.domesticShippingKrw;
    });
    // PRO V1 과 글러브 두 건만 «상품가 자체는» 국내 실구매가보다 싸다. 나머지 3건은
    // 국제배송비를 한 푼도 얹기 전에 이미 진다. 그리고 그 두 건조차 위 루프에서
    // 배송비를 얹는 순간 전부 적자로 돌아선다 — 경량 상품에서 배송비가 상품가와
    // 같은 크기라는 뜻이고, 이번 파일럿의 핵심 발견이다.
    expect(negativeEvenWithFreeShipping).toHaveLength(3);
  });

  it("관부가세는 판매자 원가 components 에 들어오지 않는다 (b5becbd 구조 유지 확인)", () => {
    const cost = computeGolfLandedCost({
      sourcePriceAmount: 4950,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: "JP",
    });
    expect(Object.keys(cost.components).sort()).toEqual(["internationalShippingKrw", "sourceProductPriceKrw"]);
    // 구매자 부담은 별도 필드로만 나간다.
    expect(cost.buyerImportCharge).toBeTruthy();
  });
});
