import { describe, expect, it } from "vitest";
import { computeGolfLandedCost } from "../golf-landed-cost";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLF-03 — 해외 3축 ↔ 국내 2축 «동일상품» 가격 비교 (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * GOLF-02 는 국내가를 «다나와 최저가» 한 칸으로만 봤다. CEO 가 비교 구조를
 * 다섯 축으로 다시 세웠고, 그중 «국내②»(공식몰·전문몰 등 실제 판매처)가
 * 이번에 처음 채워졌다. 이 파일은 그 축이 들어오면 무엇이 달라지는지를
 * 계산으로 붙잡는다.
 *
 * 🔴 새 계산기가 아니다. computeGolfLandedCost 를 그대로 부른다. 새 세율도,
 *    새 배송비표도, 임의 점수도 만들지 않았다.
 *
 * 🔴 지어낸 값이 없다. 아래 숫자는 전부 응답 본문에서 읽었다:
 *   해외①  kakaku.com  AggregateOffer.lowPrice   (2026-09-16 · GOLF-02 실측 재사용)
 *   해외③  d-sports-online.dunlop.co.jp 상세     (2026-09-16 · GOLF-02 실측 재사용)
 *   국내①  prod.danawa.com JSON-LD AggregateOffer.lowPrice (2026-09-16 재확인)
 *   국내②  dunlopsportskorea.co.kr JSON-LD Offer.price     (2026-09-16 신규)
 *          avesports.com 상품 상세 판매가                    (2026-09-16 신규)
 *   환율    /api/exchange-rates 와 같은 소스(Frankfurter/ECB) 2026-09-15 자
 *
 * ⚪ 해외②(편집샵/전문 판매처)는 이 파일에 없다. 값이 없어서가 아니라
 *    «허용된 소스가 0개» 여서다. 빈 축은 빈 축으로 둔다.
 */

/** Frankfurter(ECB) 2026-09-15. GOLF-02 와 같은 상수 — 두 보고서의 숫자가 같아야 한다. */
const RATES_2026_09_15 = { JPY: 1568.32 / 178.86 } as const;

/** 골프공 1개 최대 중량 45.93g(R&A/USGA) × 12. 포장 미포함 «하한». */
const DOZEN_BALL_MIN_WEIGHT_KG = 0.55116;

interface FiveAxis {
  label: string;
  /** 해외① 일반 판매처(kakaku.com 최저가, 税込). 없으면 null. */
  overseasGeneralJpy: number | null;
  /** 해외③ 공식 브랜드몰(税込). 없으면 null. */
  overseasOfficialJpy: number | null;
  /** 국내① 다나와 최저가(KRW) + 그 판매처 배송비(KRW). */
  domesticDanawaKrw: number;
  domesticDanawaShippingKrw: number;
  /**
   * 국내② 실제 판매처(공식몰/전문몰) 판매가(KRW). 없으면 null.
   * 🔴 이 칸과 국내①을 하나의 «국내가» 로 뭉개지 않는다 — 그게 이 파일의 요점이다.
   */
  domesticRetailKrw: number | null;
  /** 국내② 배송비(KRW). 응답에 «고객직접선택» 이라 금액이 없으면 null — 0 으로 적지 않는다. */
  domesticRetailShippingKrw: number | null;
  actualWeightKg: number;
}

/** 2026-09-16 실측. 셀은 보고서 ①표와 1:1 대응한다. */
const AXES: FiveAxis[] = [
  {
    // 해외① kakaku K0001668395 ¥4,950(送料無料) / 해외③ dunlop item/10360217 ¥6,930
    // 국내① danawa pcode=75989531「던롭 스릭슨 Z-STAR 9 (12개)」₩36,432(+3,500)
    // 국내② dunlopsportskorea /product/z-star9/9517/ ₩59,000 (소비자가 ₩84,000)
    label: "스릭슨 Z-STAR 9 (2025년형) 화이트 1더즌",
    overseasGeneralJpy: 4950,
    overseasOfficialJpy: 6930,
    domesticDanawaKrw: 36432,
    domesticDanawaShippingKrw: 3500,
    domesticRetailKrw: 59000,
    // ⚪ 상세의 「배송 비용 : 고객직접선택」 — 금액이 응답에 없다. 0 이 아니라 모른다.
    domesticRetailShippingKrw: null,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // 해외① kakaku K0001663838 ¥4,950 / 해외③ ⚪ 상세 URL 미확인(목록·검색이 JS)
    // 국내① danawa pcode=75989573 ₩36,432(+3,500)
    // 국내② dunlopsportskorea /product/z-star9-xv/9267/ ₩59,000 (소비자가 ₩84,000)
    label: "스릭슨 Z-STAR 9 XV (2025년형) 화이트 1더즌",
    overseasGeneralJpy: 4950,
    overseasOfficialJpy: null,
    domesticDanawaKrw: 36432,
    domesticDanawaShippingKrw: 3500,
    domesticRetailKrw: 59000,
    domesticRetailShippingKrw: null, // ⚪ 위와 같다 — 「고객직접선택」
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // 해외① kakaku K0001676143 ¥5,904(送料無料) / 해외③ ⚪ 미조사
    // 국내① danawa pcode=75374075「타이틀리스트 프로 V1 (12개)」₩58,560(무료배송)
    // 국내② ⚪ titleist.co.kr 403 · 아베골프 미취급
    label: "타이틀리스트 프로 V1 (2025년형) 화이트 1더즌",
    overseasGeneralJpy: 5904,
    overseasOfficialJpy: null,
    domesticDanawaKrw: 58560,
    domesticDanawaShippingKrw: 0,
    domesticRetailKrw: null,
    domesticRetailShippingKrw: null,
    actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
  },
  {
    // 해외① ⚪ kakaku 는 글러브를 등재하지 않는다 / 해외③ dunlop item/10317517 ¥2,200
    // 국내① danawa pcode=14520566 ₩17,940(+3,000)
    // 국내② avesports goodsNo=132646 ₩15,000(+3,000) — 「수입정품 · 수입자 던롭스포츠코리아」
    label: "스릭슨 투어 클라리노 글러브 GGG-S029",
    overseasGeneralJpy: null,
    overseasOfficialJpy: 2200,
    domesticDanawaKrw: 17940,
    domesticDanawaShippingKrw: 3000,
    domesticRetailKrw: 15000,
    domesticRetailShippingKrw: 3000,
    actualWeightKg: 0.06,
  },
];

function sellerCostKrw(jpy: number, weightKg: number): number {
  const cost = computeGolfLandedCost({
    sourcePriceAmount: jpy,
    sourcePriceCurrency: "JPY",
    liveRates: RATES_2026_09_15,
    actualWeightKg: weightKg,
    originCountry: "JP",
  });
  expect(cost.productCostKrw).not.toBeNull();
  expect(cost.internationalShippingKrw).not.toBeNull();
  return (cost.productCostKrw as number) + (cost.internationalShippingKrw as number);
}

describe("GOLF-03 — 다섯 축 동일상품 비교", () => {
  it("국내①(다나와 최저가)과 국내②(실제 판매처)는 같은 상품에서도 최대 1.6배 벌어진다 — 하나의 «국내가»로 뭉개면 안 된다", () => {
    const both = AXES.filter((a) => a.domesticRetailKrw != null);
    expect(both.length).toBeGreaterThanOrEqual(3);

    const ratios = both.map((a) => (a.domesticRetailKrw as number) / a.domesticDanawaKrw);
    // Z-STAR 9 / XV: 59,000 ÷ 36,432 = 1.619…  글러브: 15,000 ÷ 17,940 = 0.836…
    // 🔴 방향조차 상품마다 다르다. 「다나와가 항상 싸다」 같은 규칙을 세울 수 없다.
    expect(Math.max(...ratios)).toBeGreaterThan(1.6);
    expect(Math.min(...ratios)).toBeLessThan(1);
  });

  /**
   * 🔴 SHIPPING-POLICY-01 ①(2026-09-16) — **이 테스트의 주장이 약해졌다. 숨기지 않는다.**
   *
   * 예전 주장은 "어느 국내축을 기준으로 잡아도 «판매자 원가가 더 높다»" 였고,
   * `bestDomestic − bestCost < 0` 으로 고정돼 있었다. 그 부등호는 EMS 요금표가
   * 다섯 칸(2/3/5/7/10kg)뿐이라 0.551kg 골프공에 **2kg 요금 ¥3,400(₩29,813)** 이
   * 붙던 덕에 성립했다. 공개 요금표의 실제 요금은 600g 구간 ¥1,600(₩14,029) 이다.
   *
   * 역방향 증명(수정 전 코드에 대면):
   *   스릭슨 Z-STAR 9 (2025년형) 화이트 1더즌: expected 1567 to be less than 0
   *
   * ── 그래서 사실은 무엇인가 ─────────────────────────────────────────────
   * Z-STAR 9 / XV 두 건은 «국내② 공식몰 정가 ₩59,000» 을 기준으로 잡으면
   * 판매자 원가(₩57,433)보다 **₩1,567 높다**. 즉 "원가가 언제나 더 높다"는
   * 문장은 더 이상 사실이 아니다.
   *
   * 다만 그 ₩1,567 은 **플랫폼 수수료 한 칸도 못 낸다** — 판매가 ₩59,000 의
   * 기본 수수료율 10%(DEFAULT_PRICE_BREAKDOWN_INPUT.feePercent)는 ₩5,900 이다.
   * 마진은커녕 수수료에서 이미 적자다. 결론(«판매 후보가 아니다»)은 유지되지만,
   * 그 결론을 떠받치는 계산이 «원가 > 국내가» 에서 «매출총이익 < 수수료» 로
   * 바뀌었다. 테스트가 재는 것도 그쪽으로 바꾼다 — 예전 부등호를 남겨 두면
   * 그건 과대계상된 배송비가 만든 결론을 계속 참이라고 우기는 일이다.
   */
  it("어느 국내축을 기준으로 잡아도 매출총이익이 플랫폼 수수료조차 못 낸다 — 축을 바꿔도 후보가 되지 않는다", () => {
    // 이 저장소의 기본 수수료율(DEFAULT_PRICE_BREAKDOWN_INPUT.feePercent = 10).
    const PLATFORM_FEE_RATE = 0.1;
    for (const a of AXES) {
      const overseas = [a.overseasGeneralJpy, a.overseasOfficialJpy].filter((v): v is number => v != null);
      expect(overseas.length, `${a.label}: 해외 가격 축이 하나도 없다`).toBeGreaterThan(0);
      // 셀러에게 가장 유리한 가정 = 해외 축 중 «가장 싼» 매입가.
      const bestCost = Math.min(...overseas.map((jpy) => sellerCostKrw(jpy, a.actualWeightKg)));
      // 셀러에게 가장 유리한 가정 = 국내 축 중 «가장 비싼» 판매가.
      const bestDomestic = Math.max(
        a.domesticDanawaKrw + a.domesticDanawaShippingKrw,
        // 🔴 배송비가 null 인 칸은 0 으로 메우지 않는다 — 상품가만 더한다.
        a.domesticRetailKrw != null ? a.domesticRetailKrw + (a.domesticRetailShippingKrw ?? 0) : 0,
      );
      const grossProfit = bestDomestic - bestCost;
      expect(grossProfit, `${a.label}: 매출총이익이 수수료를 넘는다`).toBeLessThan(bestDomestic * PLATFORM_FEE_RATE);
    }
  });

  it("🔴 «배송비가 결론을 지배한다»는 GOLF-03 의 문장은 다섯 칸 요금표가 만든 것이었다", () => {
    const shippingKrw = computeGolfLandedCost({
      sourcePriceAmount: 1,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      // GOLF-04 STEP 1 — 이 축의 상품은 전부 일본 판매처다. 출발국을 적지 않으면
      // 배송비가 «확인 필요»로 나가고, 그건 이 테스트가 재려는 값이 아니다.
      originCountry: "JP",
    }).internationalShippingKrw as number;

    const domesticSpread = AXES.filter((a) => a.domesticRetailKrw != null).map((a) =>
      Math.abs((a.domesticRetailKrw as number) - a.domesticDanawaKrw),
    );

    // 0.551kg → EMS 600g 구간 ¥1,600 = ₩14,029. 예전 값(2kg 구간 ¥3,400 = ₩29,813)의 절반 이하다.
    expect(shippingKrw).toBe(Math.round(1600 * RATES_2026_09_15.JPY));
    // 역방향 증명(수정 전 코드): AssertionError: expected 14029 to be greater than 22568
    //
    // 🔴 부등호가 뒤집혔다. 국내 두 축의 최대 격차(₩22,568)가 이제 국제배송비보다
    //    크다 — 즉 "경량 상품에서는 배송비 한 칸이 국내 축 차이보다 크다"는 결론은
    //    사실이 아니었고, 과대계상된 요금이 만든 착시였다. 어느 «국내가»를 쓰느냐가
    //    배송비보다 더 크게 결론을 흔든다는 것이 실제 그림이다.
    expect(shippingKrw).toBeLessThan(Math.max(...domesticSpread));
  });

  it("관부가세는 여전히 판매자 원가 components 에 없다 (b5becbd 구조 유지)", () => {
    const cost = computeGolfLandedCost({
      sourcePriceAmount: 4950,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: "JP",
    });
    expect(Object.keys(cost.components).sort()).toEqual(["internationalShippingKrw", "sourceProductPriceKrw"]);
    expect(cost.buyerImportCharge).toBeTruthy();
  });
});
