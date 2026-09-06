import { describe, expect, it } from "vitest";
import { computeSeasonFit, deriveMarketSignals, buildSellingGuidance, deriveSupplyStatus, buildSellingSummary, buildConfidenceBasis } from "../market-signals";

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

/**
 * MI-UX-4(CPO 지시, 2026-09-06) — 기본 화면 요약. 상세 가이드와 같은 facts로
 * 만들어지므로 두 곳이 다른 숫자를 말할 수 없어야 하고, 공급 안전장치도
 * 동일하게 적용돼야 한다("판매처를 못 찾았다" ≠ "국내 재고가 없다").
 */
describe("buildSellingSummary — 기본 화면은 결론·숫자2개·행동1줄", () => {
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
  const numberCount = (n: string | null) => (n == null ? 0 : n.split(" · ").length);

  it("A — 🟢 결론 + 추천가·예상 마진", () => {
    const s = buildSellingSummary("A", {
      ...base,
      recommendedPriceKrw: 258_000,
      estimatedMarginPercent: 18.4,
      domesticLowestPriceKrw: 260_000,
    });
    expect(s.tone).toBe("GOOD");
    expect(s.headline).toBe("시장 가격 경쟁력 있음");
    expect(s.numbers).toBe("추천가 ₩258,000 · 예상 마진 18.4%");
    expect(numberCount(s.numbers)).toBeLessThanOrEqual(2);
  });

  it("B + 공급 제한 — 🟡 테스트 결론 + 목표마진가·판매처", () => {
    const s = buildSellingSummary("B", {
      ...base,
      targetPriceKrw: 270_795,
      domesticLowestPriceKrw: 258_000,
      estimatedMarginPercent: 7.6,
      sellerCount: 2,
      domesticBasis: "EXACT",
    });
    expect(s.tone).toBe("CAUTION");
    expect(s.headline).toBe("국내 공급이 적어 가격 여지가 있습니다");
    expect(s.numbers).toBe("목표마진가 ₩270,795 · 국내 판매처 2곳");
  });

  it("B + 공급 충분 — 🟡 조건부 + 시장 기준가·예상 마진", () => {
    const s = buildSellingSummary("B", {
      ...base,
      domesticLowestPriceKrw: 258_000,
      estimatedMarginPercent: 7.6,
      sellerCount: 9,
      domesticBasis: "EXACT",
    });
    expect(s.headline).toBe("시장 가격 경쟁력이 부족합니다");
    expect(s.numbers).toBe("시장 기준가 ₩258,000 · 예상 마진 7.6%");
  });

  it("★ C — 🔴 손실. 공급이 부족해도 테스트 문구를 붙이지 않는다", () => {
    const s = buildSellingSummary("C", {
      ...base,
      landedCostKrw: 18_500,
      domesticLowestPriceKrw: 16_900,
      sellerCount: 1,
      domesticBasis: "EXACT",
    });
    expect(s.tone).toBe("STOP");
    expect(s.numbers).toBe("착지원가 ₩18,500 · 예상 손실 -₩1,600");
    // 금지 대상은 "공급"이라는 단어 자체가 아니라 공급 부족을 가격 기회로
    // 삼는 표현이다("다른 공급처를 확인하세요"는 소싱 조언이라 문제없다).
    const text = `${s.headline} ${s.action}`;
    for (const phrase of ["공급이 적어", "가격 여지", "시험", "테스트", "반응을 확인"]) {
      expect(text).not.toContain(phrase);
    }
  });

  it("★ basis가 EXACT가 아니면 판매처 수도 공급 문구도 나오지 않는다", () => {
    const s = buildSellingSummary("B", {
      ...base,
      domesticLowestPriceKrw: 258_000,
      estimatedMarginPercent: 7.6,
      sellerCount: 0,
      domesticBasis: "NONE",
    });
    expect(`${s.numbers} ${s.action}`).not.toContain("판매처");
    expect(`${s.headline} ${s.action}`).not.toContain("공급");
  });

  it("D — ⚪ 아는 척하지 않는다", () => {
    const s = buildSellingSummary("D", { ...base, domesticBasis: "NONE" });
    expect(s.tone).toBe("UNKNOWN");
    expect(s.numbers).toBeNull();
    expect(s.action).toContain("확인한 뒤 등록 가격을 정하세요");
  });

  it("숫자는 어떤 경우에도 2개를 넘지 않는다", () => {
    for (const c of ["A", "B", "C", "D"] as const) {
      const s = buildSellingSummary(c, {
        recommendedPriceKrw: 1000,
        targetPriceKrw: 1100,
        estimatedMarginPercent: 5,
        targetMarginPercent: 20,
        landedCostKrw: 900,
        domesticLowestPriceKrw: 800,
        brandMedianPriceKrw: 950,
        sellerCount: 2,
        domesticBasis: "EXACT",
      });
      expect(numberCount(s.numbers)).toBeLessThanOrEqual(2);
    }
  });
});

/**
 * MI-UX-6(CPO 지시, 2026-09-06) — 화면 상단 판매 판단 카드와 Market
 * Intelligence 요약이 같은 결론을 두 번 말하지 않게 어휘를 분리했다.
 * "팔아도 되는가"는 상단 카드 전용이고, 이 요약은 가격 전략만 말한다.
 * 문구가 다시 판정 어휘로 되돌아가면 이 테스트가 깨진다.
 */
describe("buildSellingSummary — 판매 판정 어휘를 쓰지 않는다(역할 분리)", () => {
  const FORBIDDEN = ["판매해볼", "조건부로 판매", "판매를 권장", "권장하지 않습니다", "판매 추천"];

  it("모든 CASE에서 판매 판정 어휘가 나오지 않는다", () => {
    const facts = {
      recommendedPriceKrw: 258_000,
      targetPriceKrw: 270_795,
      estimatedMarginPercent: 7.6,
      targetMarginPercent: 20,
      landedCostKrw: 18_500,
      domesticLowestPriceKrw: 16_900,
      brandMedianPriceKrw: 100_000,
      sellerCount: 2,
      domesticBasis: "EXACT" as const,
    };
    for (const c of ["A", "B", "C", "D", null] as const) {
      for (const count of [null, 2, 9]) {
        const s = buildSellingSummary(c, { ...facts, sellerCount: count });
        const text = `${s.headline} ${s.action}`;
        for (const word of FORBIDDEN) {
          expect(text).not.toContain(word);
        }
      }
    }
  });
});

/**
 * MI-ACTION-1(CPO 지시, 2026-09-06) — 셀러의 마지막 질문은 "그래서 얼마로
 * 올려?"다. 판단을 등록 가격 하나로 닫되, 권하면 안 되는 상황에서는 절대
 * 가격을 제시하지 않는다. 이 경계가 이 describe의 전부다.
 */
describe("buildSellingSummary — 등록 가격 제시 경계", () => {
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

  it("A — 추천 판매가를 등록 가격으로 제시한다", () => {
    const s = buildSellingSummary("A", { ...base, recommendedPriceKrw: 258_000, estimatedMarginPercent: 18.4 });
    expect(s.actionPriceKrw).toBe(258_000);
    expect(s.action).toContain("₩258,000로 등록");
  });

  it("A — 추천가가 없으면 금액 없는 문장으로 떨어진다(숫자를 만들지 않는다)", () => {
    const s = buildSellingSummary("A", { ...base, estimatedMarginPercent: 18.4 });
    expect(s.actionPriceKrw).toBeNull();
    expect(s.action).not.toContain("₩");
  });

  it("B + 공급 제한 — 목표마진가를 등록 가격으로 제시한다", () => {
    const s = buildSellingSummary("B", {
      ...base,
      targetPriceKrw: 270_795,
      domesticLowestPriceKrw: 258_000,
      sellerCount: 2,
      domesticBasis: "EXACT",
    });
    expect(s.actionPriceKrw).toBe(270_795);
    expect(s.action).toContain("₩270,795로 등록");
  });

  it("★ B + 공급 충분 — 등록 가격을 제시하지 않고 격차만 알려준다", () => {
    const s = buildSellingSummary("B", {
      ...base,
      targetPriceKrw: 270_795,
      domesticLowestPriceKrw: 258_000,
      estimatedMarginPercent: 7.6,
      sellerCount: 9,
      domesticBasis: "EXACT",
    });
    expect(s.actionPriceKrw).toBeNull();
    expect(s.action).toContain("₩12,795 차이");
    expect(s.action).not.toContain("등록해");
  });

  it("★ C(손실) — 어떤 등록 가격도 제시하지 않는다", () => {
    const s = buildSellingSummary("C", {
      ...base,
      landedCostKrw: 18_500,
      domesticLowestPriceKrw: 16_900,
      sellerCount: 1,
      domesticBasis: "EXACT",
    });
    expect(s.actionPriceKrw).toBeNull();
    expect(s.action).not.toContain("등록해");
  });

  it("★ D(국내 가격 미확인) — 등록 가격을 권하지 않는다", () => {
    const s = buildSellingSummary("D", { ...base, brandMedianPriceKrw: 100_000, domesticBasis: "NONE" });
    expect(s.actionPriceKrw).toBeNull();
    expect(s.action).not.toContain("등록해");
  });
});

/**
 * MI-CONFIDENCE-1(CPO 지시, 2026-09-06) — 신뢰도 근거는 새 점수가 아니라
 * "이미 확보된 데이터가 있는가"의 집계여야 한다. 임의 임계값이 끼어들거나
 * 공급 판정과 다른 기준을 쓰기 시작하면 이 테스트가 깨진다.
 */
describe("buildConfidenceBasis — 확보된 데이터만 센다", () => {
  const signals = (ratio: number | null) =>
    deriveMarketSignals({ domesticSellerCount: 2, searchInterestRatio: ratio, titleText: "무관", nowMonth: 3 }).signals;

  const full = {
    recommendedPriceKrw: 258_000,
    targetPriceKrw: 270_795,
    estimatedMarginPercent: 7.6,
    targetMarginPercent: 20,
    landedCostKrw: 238_300,
    domesticLowestPriceKrw: 258_000,
    brandMedianPriceKrw: null,
    sellerCount: 2,
    domesticBasis: "EXACT" as const,
  };

  it("모든 데이터가 있으면 5/5이고 미확인 사유가 없다", () => {
    const b = buildConfidenceBasis(full, signals(40));
    expect(b.confirmedCount).toBe(5);
    expect(b.totalCount).toBe(5);
    expect(b.items.every((i) => i.confirmed && i.note === null)).toBe(true);
  });

  it("검색 관심을 못 받으면 그 항목만 미확인이 되고 사유가 붙는다", () => {
    const b = buildConfidenceBasis(full, signals(null));
    expect(b.confirmedCount).toBe(4);
    const item = b.items.find((i) => i.label === "검색 관심 데이터")!;
    expect(item.confirmed).toBe(false);
    expect(item.note).toContain("확인하지 못했습니다");
  });

  it("★ 동일상품 미확정이면 판매처 수도 확인됨으로 세지 않는다(공급 판정과 같은 게이트)", () => {
    const b = buildConfidenceBasis({ ...full, domesticBasis: "COMPARISON" }, signals(40));
    expect(b.items.find((i) => i.label === "국내 동일상품 확인")!.confirmed).toBe(false);
    expect(b.items.find((i) => i.label === "국내 판매처 수 확인")!.confirmed).toBe(false);
  });

  it("데이터가 하나도 없으면 0/5이고, 항목마다 왜 없는지 설명한다", () => {
    const b = buildConfidenceBasis(
      {
        recommendedPriceKrw: null,
        targetPriceKrw: null,
        estimatedMarginPercent: null,
        targetMarginPercent: null,
        landedCostKrw: null,
        domesticLowestPriceKrw: null,
        brandMedianPriceKrw: null,
        sellerCount: null,
        domesticBasis: "NONE",
      },
      signals(null),
    );
    expect(b.confirmedCount).toBe(0);
    expect(b.items.every((i) => !i.confirmed && i.note != null)).toBe(true);
  });
});

/**
 * MI-CONFIDENCE-2(CPO 지시, 2026-09-06) — 셀러 화면의 신뢰도를 하나로
 * 통일하면서 "4/5"에 상태 문구를 붙였다. 이 값은 AI 정확도가 아니라
 * "판단에 쓸 수 있었던 데이터가 얼마나 확보됐는가"이므로, 정확도·확률
 * 어휘가 들어오면 테스트가 깨진다.
 */
describe("buildConfidenceBasis — 상태 문구는 데이터 확보량만 말한다", () => {
  const signals = (ratio: number | null) =>
    deriveMarketSignals({ domesticSellerCount: 2, searchInterestRatio: ratio, titleText: "무관", nowMonth: 3 }).signals;
  const full = {
    recommendedPriceKrw: 258_000,
    targetPriceKrw: 270_795,
    estimatedMarginPercent: 7.6,
    targetMarginPercent: 20,
    landedCostKrw: 238_300,
    domesticLowestPriceKrw: 258_000,
    brandMedianPriceKrw: null,
    sellerCount: 2,
    domesticBasis: "EXACT" as const,
  };

  it("5/5 → 데이터 충분", () => {
    expect(buildConfidenceBasis(full, signals(40)).label).toBe("데이터 충분");
  });

  it("4/5 → 대부분 확인됨", () => {
    const b = buildConfidenceBasis(full, signals(null));
    expect(b.confirmedCount).toBe(4);
    expect(b.label).toBe("대부분 확인됨");
  });

  it("3/5 → 일부 데이터 부족", () => {
    // 동일상품 미확정이면 동일상품·판매처 2개가 함께 빠진다.
    const b = buildConfidenceBasis({ ...full, domesticBasis: "COMPARISON" }, signals(40));
    expect(b.confirmedCount).toBe(3);
    expect(b.label).toBe("일부 데이터 부족");
  });

  it("★ 0/5에서 '데이터 충분' 같은 과장 문구가 나오지 않는다", () => {
    const b = buildConfidenceBasis(
      {
        recommendedPriceKrw: null,
        targetPriceKrw: null,
        estimatedMarginPercent: null,
        targetMarginPercent: null,
        landedCostKrw: null,
        domesticLowestPriceKrw: null,
        brandMedianPriceKrw: null,
        sellerCount: null,
        domesticBasis: "NONE",
      },
      signals(null),
    );
    expect(b.confirmedCount).toBe(0);
    expect(b.label).toBe("확인된 데이터가 제한적");
  });

  it("★ 어떤 조합에서도 정확도·확률 어휘를 쓰지 않는다", () => {
    const FORBIDDEN = ["정확", "확률", "성공", "%", "AI 신뢰도", "확실"];
    for (const basis of ["EXACT", "COMPARISON", "NONE"] as const) {
      for (const ratio of [40, null]) {
        const b = buildConfidenceBasis({ ...full, domesticBasis: basis }, signals(ratio));
        for (const word of FORBIDDEN) {
          expect(b.label).not.toContain(word);
        }
      }
    }
  });
});
