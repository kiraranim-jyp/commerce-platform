import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER_ORDER,
  defaultLimitForTier,
  domesticMatchDisplay,
  isDefaultVisibleTier,
  overseasMatchDisplay,
  SIMILAR_DEFAULT_LIMIT,
} from "../match-display";

/** MI-UX-9(CPO 지시, 2026-09-07 §5/§6/§7) — 기본 가격비교 리스트에 무엇이 들어가고
 * 무엇이 "더 보기" 뒤로 가는지를 코드 레벨로 고정한다.
 *
 * 국내/해외 표가 둘 다 이 정책 함수를 거치므로(각 컴포넌트의
 * displayTierForCandidate → isDefaultVisibleTier), 여기 테스트가 통과하면 두
 * 화면이 같은 규칙을 따른다는 게 보장된다. 판정 알고리즘 자체는 이 파일의
 * 관심사가 아니다 — 판정 결과를 "보여줄지 말지"만 다룬다. */

describe("MI-UX-9 §5 — 매칭 가능성이 있는 등급은 기본 노출", () => {
  it("국내 동일상품(EXACT_IDENTIFIER/STRONG_IDENTIFIER)은 기본 노출", () => {
    expect(isDefaultVisibleTier(domesticMatchDisplay("EXACT_IDENTIFIER").tier)).toBe(true);
    expect(isDefaultVisibleTier(domesticMatchDisplay("STRONG_IDENTIFIER").tier)).toBe(true);
  });

  it("국내 동일상품 추정(TEXT_CONFIRMED)과 유사상품(SIMILAR)은 기본 노출", () => {
    expect(isDefaultVisibleTier(domesticMatchDisplay("TEXT_CONFIRMED").tier)).toBe(true);
    expect(isDefaultVisibleTier(domesticMatchDisplay("SIMILAR").tier)).toBe(true);
  });

  it("해외 동일상품/추정/유사도 같은 기준으로 기본 노출", () => {
    expect(isDefaultVisibleTier(overseasMatchDisplay("EXACT_PRODUCT").tier)).toBe(true);
    expect(isDefaultVisibleTier(overseasMatchDisplay("CONFIRMED_PRODUCT").tier)).toBe(true);
    expect(isDefaultVisibleTier(overseasMatchDisplay("VERY_SIMILAR").tier)).toBe(true);
    expect(isDefaultVisibleTier(overseasMatchDisplay("SIMILAR").tier)).toBe(true);
  });

  it("해외 SAME_MODEL_VARIANT(동일 모델 · 옵션 다름)는 참고 가격으로 기본 노출", () => {
    expect(isDefaultVisibleTier(overseasMatchDisplay("SAME_MODEL_VARIANT").tier)).toBe(true);
  });
});

describe("MI-UX-9 §6 — CONFLICT / INSUFFICIENT_EVIDENCE는 기본 가격근거에서 제외", () => {
  it("국내 CONFLICT는 기본 노출에서 제외", () => {
    expect(isDefaultVisibleTier(domesticMatchDisplay("CONFLICT").tier)).toBe(false);
  });

  it("국내 INSUFFICIENT_EVIDENCE는 기본 노출에서 제외", () => {
    expect(isDefaultVisibleTier(domesticMatchDisplay("INSUFFICIENT_EVIDENCE").tier)).toBe(false);
  });

  it("해외 CONFLICT는 기본 노출에서 제외 — 텍스트 점수가 높아도 마찬가지", () => {
    // 회귀 대상: 해외 표의 이전 기본 필터가 `matchLevel !== "low"`였다. 판정이
    // CONFLICT(식별자 충돌)여도 텍스트 유사도만 높으면 기본 노출에 남았다.
    expect(isDefaultVisibleTier(overseasMatchDisplay("CONFLICT").tier)).toBe(false);
  });

  it("해외 INSUFFICIENT_EVIDENCE는 기본 노출에서 제외", () => {
    expect(isDefaultVisibleTier(overseasMatchDisplay("INSUFFICIENT_EVIDENCE").tier)).toBe(false);
  });
});

describe("MI-UX-9 §7/§12 — 그룹 순서와 유사상품 상한", () => {
  it("동일상품이 항상 추정/유사보다 먼저 온다", () => {
    expect(DEFAULT_TIER_ORDER[0]).toBe("SAME");
    expect(DEFAULT_TIER_ORDER.indexOf("PRESUMED_SAME")).toBeLessThan(DEFAULT_TIER_ORDER.indexOf("SIMILAR"));
  });

  it("기본 노출 순서에는 CONFLICT/UNKNOWN이 들어가지 않는다", () => {
    expect(DEFAULT_TIER_ORDER).not.toContain("CONFLICT");
    expect(DEFAULT_TIER_ORDER).not.toContain("UNKNOWN");
  });

  it("DEFAULT_TIER_ORDER의 모든 등급은 기본 노출 대상이다(정의가 서로 어긋나지 않는다)", () => {
    for (const tier of DEFAULT_TIER_ORDER) expect(isDefaultVisibleTier(tier)).toBe(true);
  });

  it("유사상품만 상위 N건으로 자른다 — 동일상품/추정은 자르지 않는다", () => {
    expect(defaultLimitForTier("SIMILAR")).toBe(SIMILAR_DEFAULT_LIMIT);
    expect(defaultLimitForTier("SAME")).toBeNull();
    expect(defaultLimitForTier("PRESUMED_SAME")).toBeNull();
    expect(defaultLimitForTier("SAME_MODEL_OPTION_DIFF")).toBeNull();
  });
});
