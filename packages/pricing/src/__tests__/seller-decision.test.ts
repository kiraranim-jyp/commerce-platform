import { describe, expect, it } from "vitest";
import {
  applyMarketOutlookToVerdict,
  buildDecisionFactors,
  buildSellerDecision,
  deriveMarketOutlook,
  type MarketOutlook,
} from "../seller-decision";
import { deriveMarketSignals, type MarketSignal, type MarketSignalLevel } from "../market-signals";
import { computePriceRecommendation } from "../price-recommendation";
import type { SellerFacingVerdictCode } from "../representative-seller-decision";

/**
 * P-31(CPO 지시, 2026-09-03) — PRICE REALITY → CASE A/B/C/D → MARKET SIGNAL
 * → SELLER GUIDANCE 순서를 검증한다. 가장 중요한 축 두 개:
 *  ① 시장 신호는 가격 CASE를 절대 바꾸지 않는다.
 *  ② 데이터 부족(unknown)은 절대 "시장이 나쁨(WEAK)"이 되지 않는다.
 */
function signal(key: MarketSignal["key"], level: MarketSignalLevel): MarketSignal {
  return { key, label: key, level, evidence: `${key}=${level}` };
}

/** 원하는 outlook을 만드는 신호 조합 — 조합 테스트에서 재사용한다. */
const SIGNALS_BY_OUTLOOK: Record<MarketOutlook, MarketSignal[]> = {
  GOOD: [signal("domesticPresence", "high"), signal("searchInterest", "high"), signal("seasonFit", "medium")],
  WATCH: [signal("domesticPresence", "medium"), signal("searchInterest", "medium"), signal("seasonFit", "medium")],
  WEAK: [signal("domesticPresence", "low"), signal("searchInterest", "low"), signal("seasonFit", "medium")],
  UNKNOWN: [signal("domesticPresence", "unknown"), signal("searchInterest", "unknown"), signal("seasonFit", "medium")],
};

describe("deriveMarketOutlook — 종합 시장 상태", () => {
  it("모든 데이터 정상 + 긍정 신호 → GOOD", () => {
    expect(deriveMarketOutlook(SIGNALS_BY_OUTLOOK.GOOD).outlook).toBe("GOOD");
  });

  it("불리한 신호가 긍정보다 많으면 WEAK", () => {
    expect(deriveMarketOutlook(SIGNALS_BY_OUTLOOK.WEAK).outlook).toBe("WEAK");
  });

  it("보통만 있으면 WATCH — 억지로 GOOD/WEAK를 만들지 않는다", () => {
    expect(deriveMarketOutlook(SIGNALS_BY_OUTLOOK.WATCH).outlook).toBe("WATCH");
  });

  it("전체 데이터 없음 → UNKNOWN (WEAK가 아니다)", () => {
    const allUnknown = [
      signal("domesticPresence", "unknown"),
      signal("searchInterest", "unknown"),
      signal("seasonFit", "unknown"),
    ];
    expect(deriveMarketOutlook(allUnknown).outlook).toBe("UNKNOWN");
    expect(deriveMarketOutlook(allUnknown).knownSignalCount).toBe(0);
  });

  it("핵심: unknown이 아무리 많아도 WEAK가 되지 않는다(데이터 부족 ≠ 시장 약함)", () => {
    for (const known of ["high", "medium", "low"] as const) {
      const mostlyUnknown = [
        signal("domesticPresence", "unknown"),
        signal("searchInterest", "unknown"),
        signal("seasonFit", known),
      ];
      expect(deriveMarketOutlook(mostlyUnknown).outlook).toBe("UNKNOWN");
      expect(deriveMarketOutlook(mostlyUnknown).outlook).not.toBe("WEAK");
    }
  });

  it("확인된 신호가 2개 이상이어야 GOOD/WEAK 판정을 낸다", () => {
    const twoKnown = [
      signal("domesticPresence", "unknown"),
      signal("searchInterest", "high"),
      signal("seasonFit", "high"),
    ];
    expect(deriveMarketOutlook(twoKnown).outlook).toBe("GOOD");
    expect(deriveMarketOutlook(twoKnown).knownSignalCount).toBe(2);
  });
});

describe("applyMarketOutlookToVerdict — 시장 신호는 강등만 가능하고 승격은 없다", () => {
  it("시장이 아무리 좋아도 판정을 올리지 않는다", () => {
    for (const outlook of ["GOOD", "WATCH", "UNKNOWN", "WEAK"] as const) {
      expect(applyMarketOutlookToVerdict("NOT_RECOMMENDED", outlook).code).toBe("NOT_RECOMMENDED");
      expect(applyMarketOutlookToVerdict("CONDITIONAL", outlook).code).not.toBe("RECOMMENDED");
    }
  });

  it("WEAK만 RECOMMENDED를 CONDITIONAL로 낮춘다", () => {
    expect(applyMarketOutlookToVerdict("RECOMMENDED", "WEAK")).toEqual({ code: "CONDITIONAL", downgraded: true });
  });

  it("UNKNOWN/WATCH는 판정을 바꾸지 않는다 — 데이터 부족을 불이익으로 삼지 않는다", () => {
    for (const outlook of ["UNKNOWN", "WATCH", "GOOD"] as const) {
      expect(applyMarketOutlookToVerdict("RECOMMENDED", outlook)).toEqual({ code: "RECOMMENDED", downgraded: false });
    }
  });
});

describe("buildDecisionFactors — 판단 근거는 CPO 지정 우선순위 순서로 고정", () => {
  it("항상 5개 항목이 정해진 순서로 나온다", () => {
    const factors = buildDecisionFactors({
      marketCase: "A",
      estimatedMarginPercent: 30.6,
      signals: SIGNALS_BY_OUTLOOK.GOOD,
    });
    expect(factors.map((f) => f.key)).toEqual([
      "priceProfitability",
      "domesticPrice",
      "marketInterest",
      "sellerCompetition",
      "seasonFit",
    ]);
  });

  it("마진 숫자는 전달받은 값을 그대로 쓴다(여기서 다시 계산하지 않는다)", () => {
    const factors = buildDecisionFactors({ marketCase: "A", estimatedMarginPercent: 30.6, signals: [] });
    expect(factors[0].detail).toContain("30.6%");
  });

  it("CASE D는 가격 수익성/동일상품 가격 모두 unknown — '나쁨'으로 표시하지 않는다", () => {
    const factors = buildDecisionFactors({ marketCase: "D", estimatedMarginPercent: null, signals: [] });
    expect(factors[0].level).toBe("unknown");
    expect(factors[1].level).toBe("unknown");
    expect(factors[0].level).not.toBe("low");
  });

  it("CASE C만 가격 수익성이 low다", () => {
    expect(buildDecisionFactors({ marketCase: "C", estimatedMarginPercent: null, signals: [] })[0].level).toBe("low");
  });
});

describe("buildSellerDecision — CASE × 시장상태 조합 매트릭스", () => {
  const run = (priceVerdict: SellerFacingVerdictCode, outlook: MarketOutlook, marketCase: "A" | "B" | "C" | "D") =>
    buildSellerDecision({
      priceVerdict,
      marketCase,
      estimatedMarginPercent: marketCase === "A" ? 30.6 : marketCase === "B" ? 6 : null,
      signals: SIGNALS_BY_OUTLOOK[outlook],
    });

  it("A + GOOD → 판매 추천 유지", () => {
    const r = run("RECOMMENDED", "GOOD", "A");
    expect(r.finalVerdict).toBe("RECOMMENDED");
    expect(r.downgradedByMarket).toBe(false);
  });

  it("A + WEAK → 조건부로 강등되고 그 사유가 근거에 남는다", () => {
    const r = run("RECOMMENDED", "WEAK", "A");
    expect(r.finalVerdict).toBe("CONDITIONAL");
    expect(r.downgradedByMarket).toBe(true);
    expect(r.reasons.some((x) => x.includes("낮췄습니다"))).toBe(true);
  });

  it("A + UNKNOWN → 강등되지 않는다(데이터 부족을 불이익으로 삼지 않는다)", () => {
    const r = run("RECOMMENDED", "UNKNOWN", "A");
    expect(r.finalVerdict).toBe("RECOMMENDED");
    expect(r.downgradedByMarket).toBe(false);
  });

  it("B + GOOD / B + WEAK / B + UNKNOWN — 가격 레이어가 조건부면 시장이 좋아도 추천이 되지 않는다", () => {
    for (const outlook of ["GOOD", "WEAK", "UNKNOWN"] as const) {
      expect(run("CONDITIONAL", outlook, "B").finalVerdict).toBe("CONDITIONAL");
    }
  });

  it("C + GOOD / C + UNKNOWN — 시장 신호와 무관하게 비추천을 유지한다", () => {
    for (const outlook of ["GOOD", "UNKNOWN"] as const) {
      expect(run("NOT_RECOMMENDED", outlook, "C").finalVerdict).toBe("NOT_RECOMMENDED");
    }
  });

  it("D + GOOD / D + UNKNOWN — 가격 근거가 없으면 시장이 좋아도 추천으로 확정하지 않는다", () => {
    for (const outlook of ["GOOD", "UNKNOWN"] as const) {
      const r = run("CONDITIONAL", outlook, "D");
      expect(r.finalVerdict).toBe("CONDITIONAL");
      expect(r.factors[1].level).toBe("unknown");
    }
  });

  it("outlook 값 자체는 신호에서만 나오고 marketCase에 영향받지 않는다", () => {
    for (const marketCase of ["A", "B", "C", "D"] as const) {
      expect(run("CONDITIONAL", "GOOD", marketCase).outlook).toBe("GOOD");
      expect(run("CONDITIONAL", "WEAK", marketCase).outlook).toBe("WEAK");
    }
  });
});

describe("회귀 방지 — Market Signal은 가격 CASE/추천가/마진을 절대 바꾸지 않는다", () => {
  const priceInput = {
    totalCostKrw: 220000,
    domesticLowestPriceKrw: 300000,
    domesticAveragePriceKrw: 300000,
    domesticBasis: "EXACT" as const,
    minimumMarginPercent: 10,
    targetMarginPercent: 20,
  };

  it("어떤 시장 신호를 넣어도 computePriceRecommendation 결과는 동일하다", () => {
    const baseline = computePriceRecommendation(priceInput);
    for (const outlook of ["GOOD", "WATCH", "WEAK", "UNKNOWN"] as const) {
      buildSellerDecision({
        priceVerdict: "RECOMMENDED",
        marketCase: baseline.marketCase,
        estimatedMarginPercent: baseline.estimatedMarginPercent,
        signals: SIGNALS_BY_OUTLOOK[outlook],
      });
      // 시장 신호 처리 후에도 가격 계산은 재호출 시 동일한 값을 낸다.
      expect(computePriceRecommendation(priceInput)).toEqual(baseline);
    }
  });

  it("buildSellerDecision은 입력 marketCase/마진을 그대로 되돌려줄 뿐 재계산하지 않는다", () => {
    const r = buildSellerDecision({
      priceVerdict: "RECOMMENDED",
      marketCase: "A",
      estimatedMarginPercent: 25.9,
      signals: SIGNALS_BY_OUTLOOK.WEAK,
    });
    // 강등은 판정(verdict)에만 일어나고, 마진 문구는 입력값 그대로다.
    expect(r.factors[0].detail).toContain("25.9%");
    expect(r.priceVerdict).toBe("RECOMMENDED");
  });

  it("신호 배열을 변형하지 않는다(부수효과 없음)", () => {
    const signals = SIGNALS_BY_OUTLOOK.GOOD;
    const before = JSON.stringify(signals);
    buildSellerDecision({ priceVerdict: "RECOMMENDED", marketCase: "A", estimatedMarginPercent: 30, signals });
    expect(JSON.stringify(signals)).toBe(before);
  });
});

describe("통합 — deriveMarketSignals에서 나온 실제 신호로 outlook을 낸다", () => {
  it("국내 가격 확인 전(판매처 미확인) + 검색 실패 → UNKNOWN이지 WEAK가 아니다", () => {
    const { signals } = deriveMarketSignals({
      domesticSellerCount: 0,
      domesticSellerCountKnown: false,
      searchInterestRatio: null,
      searchInterestStatus: "AUTH_ERROR",
      titleText: "특정 시즌과 무관한 상품",
      nowMonth: 3,
    });
    const outlook = deriveMarketOutlook(signals).outlook;
    expect(outlook).toBe("UNKNOWN");
    expect(outlook).not.toBe("WEAK");
  });

  it("판매처를 실제로 확인해서 0곳인 것은 데이터가 있는 것이다(unknown 아님)", () => {
    const { signals } = deriveMarketSignals({
      domesticSellerCount: 0,
      domesticSellerCountKnown: true,
      searchInterestRatio: 70,
      titleText: "무관 상품",
      nowMonth: 3,
    });
    expect(signals.find((s) => s.key === "domesticPresence")?.level).toBe("low");
  });
});
