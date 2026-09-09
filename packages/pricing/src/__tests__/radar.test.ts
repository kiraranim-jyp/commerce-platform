import { describe, expect, it } from "vitest";
import { computeRadar, type RadarInput } from "../radar";

/**
 * MI 2.0 PHASE 1(CPO 지시, 2026-09-09).
 *
 * 이 테스트가 지키는 핵심 불변조건은 하나다:
 *   **"값이 낮다"와 "모른다"가 절대 같아지지 않는다.**
 * 결측이 최하 등급으로 떨어지면 레이더에서 나쁜 상품과 모르는 상품이
 * 똑같아 보인다. 그래서 결측 축은 아예 level을 갖지 않는다.
 */
const BASE: RadarInput = {
  marketCase: "A",
  landedCostKrw: 55000,
  recommendedPriceKrw: 89000,
  domesticLowestPriceKrw: 95000,
  domesticAveragePriceKrw: 110000,
  domesticBasis: "EXACT",
  searchInterest: "high",
  bestMatchTruth: "EXACT_IDENTIFIER",
};

const axis = (r: ReturnType<typeof computeRadar>, key: string) =>
  r.axes.find((a) => a.key === key)!.state;

describe("💰 수익성 — CASE A~D를 그대로 쓴다", () => {
  it("CASE A는 높음", () => {
    expect(axis(computeRadar(BASE), "profitability")).toEqual({ status: "SCORED", level: "HIGH" });
  });

  it("CASE B는 보통", () => {
    expect(axis(computeRadar({ ...BASE, marketCase: "B" }), "profitability")).toEqual({
      status: "SCORED",
      level: "MEDIUM",
    });
  });

  it("CASE C는 낮음 — 손실 구간은 등급이 있는 나쁜 상태다", () => {
    expect(axis(computeRadar({ ...BASE, marketCase: "C" }), "profitability")).toEqual({
      status: "SCORED",
      level: "LOW",
    });
  });

  it("핵심 회귀: CASE D는 '낮음'이 아니라 '확인 불가'다", () => {
    // D는 수익성이 나쁜 게 아니라 국내 가격을 몰라 계산이 안 되는 상태다.
    // LOW로 떨어뜨리면 사실과 다른 말을 하게 된다.
    const state = axis(computeRadar({ ...BASE, marketCase: "D" }), "profitability");
    expect(state.status).toBe("UNAVAILABLE");
    expect(state).not.toHaveProperty("level");
  });

  it("원가를 못 읽었으면 CASE와 무관하게 확인 불가", () => {
    const state = axis(computeRadar({ ...BASE, landedCostKrw: null }), "profitability");
    expect(state.status).toBe("UNAVAILABLE");
  });
});

describe("🏷️ 국내 가격 경쟁력 — 가격 위치만 본다", () => {
  it("국내 최저가 이하면 높음", () => {
    expect(axis(computeRadar(BASE), "priceCompetitiveness")).toEqual({ status: "SCORED", level: "HIGH" });
  });

  it("최저가~평균가 사이면 보통 — 시장 분포가 경계다(임의 상수 없음)", () => {
    const r = computeRadar({ ...BASE, recommendedPriceKrw: 100000, domesticLowestPriceKrw: 95000, domesticAveragePriceKrw: 110000 });
    expect(axis(r, "priceCompetitiveness")).toEqual({ status: "SCORED", level: "MEDIUM" });
  });

  it("평균가를 넘으면 낮음", () => {
    const r = computeRadar({ ...BASE, recommendedPriceKrw: 130000, domesticLowestPriceKrw: 95000, domesticAveragePriceKrw: 110000 });
    expect(axis(r, "priceCompetitiveness")).toEqual({ status: "SCORED", level: "LOW" });
  });

  it("국내 근거가 없으면(basis=NONE) 확인 불가 — 억지로 계산하지 않는다", () => {
    const r = computeRadar({ ...BASE, domesticBasis: "NONE", domesticLowestPriceKrw: null, domesticAveragePriceKrw: null });
    expect(axis(r, "priceCompetitiveness").status).toBe("UNAVAILABLE");
  });

  it("권장가가 없으면(CASE C/D) 확인 불가", () => {
    const r = computeRadar({ ...BASE, marketCase: "C", recommendedPriceKrw: null });
    expect(axis(r, "priceCompetitiveness").status).toBe("UNAVAILABLE");
  });

  it("평균가가 없으면 최저가 기준 2단계로만 떨어진다 — 없는 경계를 만들지 않는다", () => {
    const r = computeRadar({ ...BASE, recommendedPriceKrw: 100000, domesticLowestPriceKrw: 95000, domesticAveragePriceKrw: null });
    expect(axis(r, "priceCompetitiveness")).toEqual({ status: "SCORED", level: "LOW" });
  });

  it("comparison 기준이어도 가격 점수에 신뢰도를 섞지 않는다", () => {
    // 같은 가격이면 basis가 EXACT든 COMPARISON이든 가격 등급은 같아야 한다.
    // 신뢰도 차이는 🎯 축이 따로 말한다.
    const exact = computeRadar({ ...BASE, domesticBasis: "EXACT" });
    const comparison = computeRadar({ ...BASE, domesticBasis: "COMPARISON" });
    expect(axis(exact, "priceCompetitiveness")).toEqual(axis(comparison, "priceCompetitiveness"));
  });
});

describe("🔎 시장 수요 — 상대지수를 절대 수요로 만들지 않는다", () => {
  it("높은 ratio는 높음", () => {
    expect(axis(computeRadar(BASE), "marketDemand")).toEqual({ status: "SCORED", level: "HIGH" });
  });

  it("낮은 ratio는 낮음", () => {
    const r = computeRadar({ ...BASE, searchInterest: "low" });
    expect(axis(r, "marketDemand")).toEqual({ status: "SCORED", level: "LOW" });
  });

  it("핵심 회귀: NO_DATA와 인증 실패는 서로 다른 상태다", () => {
    const noData = axis(computeRadar({ ...BASE, searchInterest: "none" }), "marketDemand");
    const authErr = axis(computeRadar({ ...BASE, searchInterest: "unknown" }), "marketDemand");
    expect(noData.status).toBe("NO_DATA");
    expect(authErr.status).toBe("UNAVAILABLE");
    expect(noData.status).not.toBe(authErr.status);
  });

  it("확인 실패는 기술적 원인을 문구에 노출하지 않는다", () => {
    const state = axis(computeRadar({ ...BASE, searchInterest: "unknown" }), "marketDemand");
    expect(state.status).toBe("UNAVAILABLE");
    if (state.status === "UNAVAILABLE") {
      expect(state.reason).not.toMatch(/401|API|인증|errorCode/);
    }
  });
});

describe("🎯 판단 신뢰도 — 결측이 없다", () => {
  it("식별자 일치는 높음", () => {
    expect(axis(computeRadar(BASE), "matchConfidence")).toEqual({ status: "SCORED", level: "HIGH" });
  });

  it("텍스트 확인/유사는 보통", () => {
    const r = computeRadar({ ...BASE, bestMatchTruth: "TEXT_CONFIRMED" });
    expect(axis(r, "matchConfidence")).toEqual({ status: "SCORED", level: "MEDIUM" });
  });

  it("후보가 없어도 확인 불가가 아니라 '낮음'이다", () => {
    // 근거가 없다는 것 자체가 확인된 사실이다 — 모르는 게 아니다.
    const r = computeRadar({ ...BASE, bestMatchTruth: null });
    expect(axis(r, "matchConfidence")).toEqual({ status: "SCORED", level: "LOW" });
  });

  it("CONFLICT도 낮음으로 표시된다", () => {
    const r = computeRadar({ ...BASE, bestMatchTruth: "CONFLICT" });
    expect(axis(r, "matchConfidence")).toEqual({ status: "SCORED", level: "LOW" });
  });
});

describe("결측 정책 — 0점으로 만들지 않는다", () => {
  it("결측 축은 level 자체를 갖지 않는다", () => {
    const r = computeRadar({ ...BASE, marketCase: "D", domesticBasis: "NONE", domesticLowestPriceKrw: null });
    for (const a of r.axes) {
      if (a.state.status !== "SCORED") expect(a.state).not.toHaveProperty("level");
    }
  });

  it("국내 근거가 없으면 두 축이 동시에 빈다", () => {
    // basis=NONE → CASE D → 수익성/가격경쟁력 둘 다 계산 불가.
    const r = computeRadar({
      ...BASE,
      marketCase: "D",
      domesticBasis: "NONE",
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      recommendedPriceKrw: null,
    });
    expect(axis(r, "profitability").status).toBe("UNAVAILABLE");
    expect(axis(r, "priceCompetitiveness").status).toBe("UNAVAILABLE");
    expect(r.scoredCount).toBe(2); // 시장수요 + 신뢰도만 남는다
  });

  it("축은 언제나 4개다 — 결측이어도 사라지지 않는다", () => {
    const r = computeRadar({
      ...BASE,
      landedCostKrw: null,
      domesticBasis: "NONE",
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      searchInterest: "unknown",
    });
    expect(r.axes).toHaveLength(4);
  });
});

describe("모순 설명 — 숨기지 않는다", () => {
  it("CASE C인데 가격 경쟁력이 높으면 이유를 설명한다", () => {
    // 국내 최저가보다 싸게 팔 수 있지만 그 가격이 원가 이하인 상황.
    const r = computeRadar({
      ...BASE,
      marketCase: "C",
      recommendedPriceKrw: 80000,
      domesticLowestPriceKrw: 95000,
    });
    expect(r.contradiction).toContain("손실");
  });

  it("모순이 없으면 문구를 만들지 않는다", () => {
    expect(computeRadar(BASE).contradiction).toBeNull();
  });
});
