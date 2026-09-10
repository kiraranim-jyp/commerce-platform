import { describe, expect, it } from "vitest";
import { computeRadar, type RadarInput } from "@commerce/pricing";

/**
 * MI-RADAR-REASON-1(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **결측 축을 "확인 불가"라고만 쓰지 않는다.**
 *
 * 같은 화면에 "📈 예상 수익 ₩34,000"이 있는데 "💰 수익성 — 확인 불가"가 붙으면 둘 중
 * 하나가 고장 난 것처럼 읽힌다. 실제로는 예상 수익이 "내가 정한 판매가에서 얼마
 * 남는가"(산술)이고, 수익성 축은 "그게 시장 대비 좋은 수익인가"(판단)라 국내 가격을
 * 모르면 계산이 안 되는 것이다.
 *
 * computeRadar가 이미 사유 문장을 갖고 있으므로 계산·판정은 그대로 두고 그 문장을
 * 화면에 쓴다. 이 테스트는 UI가 의존하는 그 계약을 고정한다 — 사유가 비거나
 * 일반 문구로 퇴화하면 즉시 실패한다.
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
const axis = (r: ReturnType<typeof computeRadar>, key: string) => r.axes.find((a) => a.key === key)!.state;

/** MiRadar.stateLabel과 같은 규칙. */
const label = (s: ReturnType<typeof axis>) =>
  s.status === "SCORED" ? { HIGH: "높음", MEDIUM: "보통", LOW: "낮음" }[s.level] : s.reason;

describe("결측 축은 사유를 그대로 보여준다", () => {
  it("핵심 회귀: 수익성이 CASE D면 왜 모르는지가 문장으로 나온다", () => {
    const s = axis(computeRadar({ ...BASE, marketCase: "D" }), "profitability");
    expect(s.status).toBe("UNAVAILABLE");
    expect(label(s)).toContain("국내 동일상품 가격");
    expect(label(s)).not.toBe("확인 불가");
  });

  it("원가를 못 읽었을 때는 다른 사유가 나온다 — 두 결측을 같은 말로 뭉개지 않는다", () => {
    const s = axis(computeRadar({ ...BASE, landedCostKrw: null }), "profitability");
    expect(label(s)).toContain("원본 상품 가격");
    expect(label(s)).not.toBe(label(axis(computeRadar({ ...BASE, marketCase: "D" }), "profitability")));
  });

  it("모든 결측 축의 사유가 비어 있지 않다", () => {
    const r = computeRadar({
      ...BASE,
      marketCase: "D",
      landedCostKrw: null,
      domesticBasis: "NONE",
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      recommendedPriceKrw: null,
      searchInterest: "unknown",
    });
    for (const a of r.axes) {
      if (a.state.status !== "SCORED") expect(label(a.state)!.length).toBeGreaterThan(0);
    }
  });
});

describe("정상 케이스는 길어지지 않는다", () => {
  it.each([
    ["A", "높음"],
    ["B", "보통"],
    ["C", "낮음"],
  ])("CASE %s → %s 한 단어", (marketCase, expected) => {
    const s = axis(computeRadar({ ...BASE, marketCase: marketCase as RadarInput["marketCase"] }), "profitability");
    expect(label(s)).toBe(expected);
  });
});
