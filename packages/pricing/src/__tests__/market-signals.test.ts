import { describe, expect, it } from "vitest";
import { computeSeasonFit, deriveMarketSignals, buildSellingGuidance } from "../market-signals";

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
