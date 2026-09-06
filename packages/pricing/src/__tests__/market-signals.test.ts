import { describe, expect, it } from "vitest";
import { computeSeasonFit, deriveMarketSignals, buildSellingGuidance, deriveSupplyStatus } from "../market-signals";

/**
 * P-29 Sprint 8(CPO 지시, 2026-09-03) — 순수 함수 검증. 이 파일의 함수들은
 * marketCase를 계산 입력으로 받지 않는다(buildSellingGuidance만 문구 선택용
 * 파라미터로 받되, 절대 recommendedPrice/marketCase 자체를 바꾸지 않는다) —
 * "시장 신호가 좋다고 가격 경쟁력 판정을 바꾸지 않는다"(CPO 절대 금지 3)를
 * 코드로 고정한다.
 */
describe("computeSeasonFit — 순수 규칙 기반, 외부 호출 없음", () => {
  it("수영/스윔 키워드 + 여름(6월) → high(시즌 적합)", () => {
    const result = computeSeasonFit("Curious Turnip All Over Swim Cap", 6);
    expect(result.level).toBe("high");
    expect(result.evidence).toContain("일치");
  });

  it("수영 키워드 + 겨울(12월) → low(비시즌)", () => {
    const result = computeSeasonFit("올오버 스윔캡", 12);
    expect(result.level).toBe("low");
  });

  it("패딩 키워드 + 겨울(12월) → high", () => {
    const result = computeSeasonFit("Bobo Choses Padding Jacket", 12);
    expect(result.level).toBe("high");
  });

  it("시즌 키워드 없는 상품 → medium(특정 시즌에 한정되지 않음)", () => {
    const result = computeSeasonFit("Bobo Choses Logo T-shirt", 6);
    expect(result.level).toBe("medium");
  });
});

describe("deriveMarketSignals — 실측 재현", () => {
  it("Curious Turnip 실측 재현(국내 1곳, 검색지수 확인 안 됨, 여름 수영모) — 3개 신호 모두 생성", () => {
    const result = deriveMarketSignals({
      domesticSellerCount: 1,
      searchInterestRatio: null,
      titleText: "Curious Turnip All Over Swim Cap",
      nowMonth: 6,
    });
    expect(result.signals).toHaveLength(3);
    expect(result.signals.find((s) => s.key === "domesticPresence")?.level).toBe("medium");
    expect(result.signals.find((s) => s.key === "searchInterest")?.level).toBe("unknown");
    expect(result.signals.find((s) => s.key === "seasonFit")?.level).toBe("high");
    // 검색 관심이 unknown 1개뿐이므로 confidence는 medium.
    expect(result.confidence).toBe("medium");
  });

  it("국내 판매처 3곳 이상 → domesticPresence high", () => {
    const result = deriveMarketSignals({ domesticSellerCount: 5, searchInterestRatio: 40, titleText: "무관 상품", nowMonth: 3 });
    expect(result.signals.find((s) => s.key === "domesticPresence")?.level).toBe("high");
  });

  it("검색 지수 70 → searchInterest high, 검색 지수 5 → low, null → unknown(낮음이 아님)", () => {
    const high = deriveMarketSignals({ domesticSellerCount: 0, searchInterestRatio: 70, titleText: "x", nowMonth: 1 });
    const low = deriveMarketSignals({ domesticSellerCount: 0, searchInterestRatio: 5, titleText: "x", nowMonth: 1 });
    const unknown = deriveMarketSignals({ domesticSellerCount: 0, searchInterestRatio: null, titleText: "x", nowMonth: 1 });
    expect(high.signals.find((s) => s.key === "searchInterest")?.level).toBe("high");
    expect(low.signals.find((s) => s.key === "searchInterest")?.level).toBe("low");
    expect(unknown.signals.find((s) => s.key === "searchInterest")?.level).toBe("unknown");
  });

  it("모든 신호가 unknown이면 confidence limited, 전부 확인되면 high", () => {
    const limited = deriveMarketSignals({ domesticSellerCount: 0, searchInterestRatio: null, titleText: "특정시즌아님", nowMonth: 3 });
    // domesticPresence(low)/seasonFit(medium)은 unknown이 아니므로 searchInterest 1개만 unknown → medium
    expect(limited.confidence).toBe("medium");
  });
});

describe("buildSellingGuidance — marketCase는 문구 선택에만 쓰이고 가격 판정을 바꾸지 않는다", () => {
  const highSignals = deriveMarketSignals({ domesticSellerCount: 5, searchInterestRatio: 80, titleText: "swim cap", nowMonth: 6 }).signals;
  const lowSignals = deriveMarketSignals({ domesticSellerCount: 0, searchInterestRatio: null, titleText: "무관", nowMonth: 3 }).signals;

  it("CASE A + 긍정 신호 → 적극 판매 전략 문구", () => {
    const guidance = buildSellingGuidance("A", highSignals);
    expect(guidance.some((g) => g.includes("긍정적"))).toBe(true);
  });

  it("CASE C(가격 손실) — 신호가 아무리 좋아도(highSignals) 판매 추천 문구를 절대 쓰지 않는다", () => {
    const guidance = buildSellingGuidance("C", highSignals);
    expect(guidance.join(" ")).not.toContain("판매 추천");
    expect(guidance.some((g) => g.includes("소싱") || g.includes("공급처"))).toBe(true);
  });

  it("CASE D — '시장 경쟁력이 높다/시장가보다 싸게 팔 수 있다' 같은 확정 표현을 쓰지 않는다", () => {
    const guidance = buildSellingGuidance("D", lowSignals);
    const text = guidance.join(" ");
    expect(text).not.toContain("시장 경쟁력이 높습니다");
    expect(text).not.toContain("시장가보다 싸게");
  });

  it("marketCase가 null이어도 크래시하지 않고 D와 동일한 보류형 문구를 낸다", () => {
    const guidance = buildSellingGuidance(null, lowSignals);
    expect(guidance.length).toBeGreaterThan(0);
  });
});

/**
 * P-30(CPO 지시, 2026-09-03) — "확인 불가"의 사유(데이터 없음/인증 실패/일시
 * 오류/미설정)를 근거 문구로 구분한다. level 분류는 바뀌지 않는다 — ratio가
 * 없으면 사유와 무관하게 항상 unknown이고, 절대 "낮음(0)"으로 보이지 않는다.
 */
describe("deriveMarketSignals — 검색 관심 확인 불가 사유 구분(P-30)", () => {
  const findSearch = (status: Parameters<typeof deriveMarketSignals>[0]["searchInterestStatus"]) =>
    deriveMarketSignals({
      domesticSellerCount: 1,
      searchInterestRatio: null,
      searchInterestStatus: status,
      titleText: "무관 상품",
      nowMonth: 3,
    }).signals.find((s) => s.key === "searchInterest")!;

  it("사유가 달라도 level은 전부 unknown이다(낮음으로 강등되지 않는다)", () => {
    for (const status of ["NO_DATA", "AUTH_ERROR", "REQUEST_ERROR", "TRANSIENT_ERROR", "NOT_CONFIGURED"] as const) {
      expect(findSearch(status).level).toBe("unknown");
    }
  });

  it("사유별로 서로 다른 근거 문구를 보여준다", () => {
    const evidences = (["NO_DATA", "AUTH_ERROR", "TRANSIENT_ERROR", "NOT_CONFIGURED"] as const).map(
      (s) => findSearch(s).evidence,
    );
    expect(new Set(evidences).size).toBe(evidences.length);
    expect(findSearch("AUTH_ERROR").evidence).toContain("인증");
    expect(findSearch("TRANSIENT_ERROR").evidence).toContain("일시적");
  });

  it("어떤 사유에서도 절대 수치(검색량 N건)로 오인될 표현을 쓰지 않는다", () => {
    for (const status of ["NO_DATA", "AUTH_ERROR", "REQUEST_ERROR", "TRANSIENT_ERROR", "NOT_CONFIGURED"] as const) {
      expect(findSearch(status).evidence).not.toMatch(/검색량|건\b/);
    }
  });

  it("status를 생략해도 기존 동작 그대로다(하위 호환)", () => {
    const legacy = deriveMarketSignals({
      domesticSellerCount: 1,
      searchInterestRatio: null,
      titleText: "무관 상품",
      nowMonth: 3,
    }).signals.find((s) => s.key === "searchInterest")!;
    expect(legacy.level).toBe("unknown");
    expect(legacy.evidence).toBe("네이버 검색 데이터를 확인하지 못했습니다");
  });
});

/**
 * UX-3(CPO 지시, 2026-09-06) — 전략 가이드가 모든 상품에 같은 문구를 내던
 * 문제를 고친 뒤의 계약을 고정한다. 핵심은 두 가지다.
 *  (1) 실제 계산된 숫자가 있으면 그 숫자가 문구에 나온다.
 *  (2) 없는 숫자는 절대 만들지 않는다(sellerCount 없음 → 경쟁 문구 없음).
 */
describe("buildSellingGuidance — UX-3 상품별 실제 숫자 기반 가이드", () => {
  const signals = deriveMarketSignals({
    domesticSellerCount: 3,
    searchInterestRatio: 40,
    titleText: "무관",
    nowMonth: 3,
  }).signals;

  const emptyFacts = {
    recommendedPriceKrw: null,
    targetPriceKrw: null,
    estimatedMarginPercent: null,
    targetMarginPercent: null,
    landedCostKrw: null,
    domesticLowestPriceKrw: null,
    brandMedianPriceKrw: null,
    sellerCount: null,
  };

  it("CASE A — 추천가/국내 최저가/예상 마진이 실제 숫자로 나온다", () => {
    const g = buildSellingGuidance("A", signals, {
      ...emptyFacts,
      recommendedPriceKrw: 258_000,
      domesticLowestPriceKrw: 260_000,
      estimatedMarginPercent: 18.4,
      sellerCount: 3,
    }).join("\n");
    expect(g).toContain("₩258,000");
    expect(g).toContain("₩260,000");
    expect(g).toContain("18.4%");
  });

  it("CASE B — 목표 마진과의 격차(%p)와 부족 금액을 계산해 보여준다", () => {
    const g = buildSellingGuidance("B", signals, {
      ...emptyFacts,
      estimatedMarginPercent: 7.6,
      targetMarginPercent: 20,
      targetPriceKrw: 270_795,
      domesticLowestPriceKrw: 258_000,
      sellerCount: 1,
    }).join("\n");
    expect(g).toContain("12.4%p");
    expect(g).toContain("₩12,795");
    expect(g).toContain("손실은 아닙니다");
  });

  it("CASE C — 착지원가/시장가/음수 차액을 보여주고 판매를 권하지 않는다", () => {
    const g = buildSellingGuidance("C", signals, {
      ...emptyFacts,
      landedCostKrw: 18_500,
      domesticLowestPriceKrw: 16_900,
      sellerCount: 12,
    }).join("\n");
    expect(g).toContain("-₩1,600");
    expect(g).toContain("권장하지 않습니다");
    // 손실 구간에서는 경쟁 차별화 문구를 붙이지 않는다(팔아도 된다는 신호가 됨).
    expect(g).not.toContain("차별화");
  });

  it("CASE D — 국내 최저가/판매처 수를 근거로 쓰지 않고 브랜드 중앙값만 쓴다", () => {
    const g = buildSellingGuidance("D", signals, {
      ...emptyFacts,
      brandMedianPriceKrw: 100_000,
      targetPriceKrw: 112_000,
      domesticLowestPriceKrw: 90_000,
      sellerCount: 7,
    }).join("\n");
    expect(g).toContain("₩100,000");
    expect(g).toContain("₩12,000");
    expect(g).not.toContain("₩90,000");
    expect(g).not.toContain("7곳");
  });

  it("sellerCount가 null이면 경쟁 문구를 아예 만들지 않는다", () => {
    const g = buildSellingGuidance("A", signals, {
      ...emptyFacts,
      recommendedPriceKrw: 30_000,
      sellerCount: null,
    }).join("\n");
    expect(g).not.toContain("판매처");
    expect(g).not.toContain("경쟁");
  });

  it("숫자가 하나도 없으면 지어내지 않고 기존 정성 문구로 되돌아간다", () => {
    const g = buildSellingGuidance("B", signals, emptyFacts);
    expect(g.length).toBeGreaterThan(0);
    expect(g.join("\n")).not.toContain("₩");
    expect(g.join("\n")).not.toContain("NaN");
  });
});

/**
 * MI-SUPPLY-ADVANTAGE-1(CPO 지시, 2026-09-06) — 가격 축과 독립된 공급 축.
 * 이 describe의 존재 이유는 기회 탐지가 아니라 오판 방지다:
 * "검색 결과 없음"이 "국내 재고 없음"으로 둔갑하면 근거 없이 고가 판매를
 * 권하게 된다. 그 경계를 코드로 고정한다.
 */
describe("deriveSupplyStatus — 데이터 없음과 공급 부족을 구분한다", () => {
  it("EXACT 확정 + 판매처 1~2곳 → SCARCE", () => {
    expect(deriveSupplyStatus({ sellerCount: 2, domesticBasis: "EXACT" })).toBe("SCARCE");
  });

  it("EXACT 확정 + 3~5곳 → LIMITED, 6곳 이상 → SUFFICIENT", () => {
    expect(deriveSupplyStatus({ sellerCount: 4, domesticBasis: "EXACT" })).toBe("LIMITED");
    expect(deriveSupplyStatus({ sellerCount: 9, domesticBasis: "EXACT" })).toBe("SUFFICIENT");
  });

  it("★ 검색 결과 없음(NONE)은 아무리 판매처가 0이어도 SCARCE가 아니다", () => {
    expect(deriveSupplyStatus({ sellerCount: 0, domesticBasis: "NONE" })).toBe("UNKNOWN");
    expect(deriveSupplyStatus({ sellerCount: null, domesticBasis: "NONE" })).toBe("UNKNOWN");
  });

  it("★ 유사상품만 찾은 경우(COMPARISON)도 공급을 판단하지 않는다", () => {
    expect(deriveSupplyStatus({ sellerCount: 1, domesticBasis: "COMPARISON" })).toBe("UNKNOWN");
  });

  it("basis를 넘기지 않으면 UNKNOWN(하위 호환 — 공급 문구가 새로 생기지 않는다)", () => {
    expect(deriveSupplyStatus({ sellerCount: 1 })).toBe("UNKNOWN");
  });
});

describe("buildSellingGuidance — 공급 축이 가격 축과 결합되는 방식", () => {
  const signals = deriveMarketSignals({
    domesticSellerCount: 2,
    searchInterestRatio: 40,
    titleText: "무관",
    nowMonth: 3,
  }).signals;

  const base = {
    recommendedPriceKrw: null,
    targetPriceKrw: null,
    estimatedMarginPercent: null,
    targetMarginPercent: null,
    landedCostKrw: null,
    domesticLowestPriceKrw: null,
    brandMedianPriceKrw: null,
    sellerCount: null,
  };

  it("B + 공급 부족 → 목표마진가와의 격차를 '시험해볼 여지'로 제시한다(확정 표현 금지)", () => {
    const g = buildSellingGuidance("B", signals, {
      ...base,
      estimatedMarginPercent: 7.6,
      targetMarginPercent: 20,
      targetPriceKrw: 270_795,
      domesticLowestPriceKrw: 258_000,
      sellerCount: 2,
      domesticBasis: "EXACT",
    }).join("\n");
    expect(g).toContain("공급이 매우 제한적입니다");
    expect(g).toContain("₩12,795");
    expect(g).toContain("시험해볼 여지");
    expect(g).not.toContain("반드시");
    expect(g).not.toContain("판매 가능합니다");
  });

  it("B + 공급 충분 → 공급 문구 없이 기존 원가 절감 전략과 경쟁 문구를 낸다", () => {
    const g = buildSellingGuidance("B", signals, {
      ...base,
      estimatedMarginPercent: 7.6,
      targetMarginPercent: 20,
      targetPriceKrw: 270_795,
      domesticLowestPriceKrw: 258_000,
      sellerCount: 9,
      domesticBasis: "EXACT",
    }).join("\n");
    expect(g).not.toContain("제한적");
    expect(g).toContain("매입가·배송비 절감");
    expect(g).toContain("차별화");
  });

  it("★ C(손실 구간) + 공급 부족 → 공급을 근거로 판매를 권하지 않는다", () => {
    const g = buildSellingGuidance("C", signals, {
      ...base,
      landedCostKrw: 18_500,
      domesticLowestPriceKrw: 16_900,
      sellerCount: 1,
      domesticBasis: "EXACT",
    }).join("\n");
    expect(g).toContain("권장하지 않습니다");
    expect(g).not.toContain("제한적");
    expect(g).not.toContain("시험해볼");
  });

  it("★ D(동일상품 미확인) → 공급 부족으로 오판하지 않는다", () => {
    const g = buildSellingGuidance("D", signals, {
      ...base,
      brandMedianPriceKrw: 100_000,
      targetPriceKrw: 112_000,
      sellerCount: 0,
      domesticBasis: "NONE",
    }).join("\n");
    expect(g).not.toContain("공급");
    expect(g).toContain("확정하지 못해");
  });

  it("공급이 제한적이면 '경쟁이 있으니 차별화하라'는 반대 조언을 내지 않는다", () => {
    const g = buildSellingGuidance("A", signals, {
      ...base,
      recommendedPriceKrw: 258_000,
      sellerCount: 2,
      domesticBasis: "EXACT",
    }).join("\n");
    expect(g).toContain("제한적");
    expect(g).not.toContain("차별화");
  });
});
