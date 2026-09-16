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
 * ── 중량을 몰라도 결론이 흔들리지 않는 이유 ─────────────────────────────────
 * 우리 EMS 표(parcel-weight.ts)의 최하 구간은 «2kg 이하 ¥3,400» 하나뿐이고,
 * 2kg 미만 구간은 확인된 적이 없다(그 파일의 🟡 주석 그대로). 따라서 과금중량이
 * 0 초과 2kg 이하이면 **어떤 값을 넣어도 배송비는 같은 ¥3,400** 이다. 골프공
 * 1더즌(≥0.551kg)도, 장갑 한 짝도 전부 그 범위 안이다 — 그래서 포장 무게를
 * 추정하지 않아도 배송비 항이 바뀌지 않는다. 아래 테스트가 그 사실 자체를
 * 검증한다(sameBracketAcrossPlausibleWeights).
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
  it("2kg 이하에서는 어떤 중량을 넣어도 EMS 구간과 배송비가 같다 (중량 추정이 결론을 바꾸지 않는다)", () => {
    const shipping = [0.06, 0.55116, 0.9, 1.5, 2].map(
      (kg) =>
        computeGolfLandedCost({
          sourcePriceAmount: 4950,
          sourcePriceCurrency: "JPY",
          liveRates: RATES_2026_09_15,
          actualWeightKg: kg,
        }).internationalShippingKrw,
    );
    expect(new Set(shipping).size).toBe(1);
    expect(shipping[0]).not.toBeNull();
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
