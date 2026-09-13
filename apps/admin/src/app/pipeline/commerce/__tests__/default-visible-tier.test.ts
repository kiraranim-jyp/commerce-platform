import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIER_ORDER,
  defaultLimitForTier,
  domesticMatchDisplay,
  isDefaultVisibleTier,
  mayShowCandidate,
  MIN_DISPLAY_SIMILARITY,
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

  /**
   * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **확정되지 않은 등급은 셋까지.**
   *
   *   🟢 동일상품      전부
   *   🟡 동일상품 추정  상위 3건
   *   ⚪ 유사상품      상위 3건
   *
   * 🟢만 자르지 않는 이유: 그건 후보가 아니라 "이 상품이 저기에도 있다"는 사실의
   * 목록이다. 넷째 판매처를 감추면 화면이 시장을 실제보다 좁게 말한다. 반대로
   * 확정되지 않은 등급은 길어질수록 판단을 돕는 게 아니라 미루게 만든다.
   */
  it("확정되지 않은 등급만 상위 N건으로 자른다 — 동일상품은 자르지 않는다", () => {
    expect(defaultLimitForTier("SAME")).toBeNull();
    expect(defaultLimitForTier("PRESUMED_SAME")).toBe(SIMILAR_DEFAULT_LIMIT);
    expect(defaultLimitForTier("SIMILAR")).toBe(SIMILAR_DEFAULT_LIMIT);
    // 🔵 동일 모델 · 옵션 다름도 확정되지 않은 참고 등급이라 같은 상한을 쓴다.
    expect(defaultLimitForTier("SAME_MODEL_OPTION_DIFF")).toBe(SIMILAR_DEFAULT_LIMIT);
    expect(SIMILAR_DEFAULT_LIMIT).toBe(3);
  });
});

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **애초에 목록에 설 수 있는
 * 후보인가.**
 *
 * 통과 조건은 다섯이다: 브랜드 일치 · 상품 유형 일치 · 대상 충돌 없음 · 명시적
 * 색상/품번 충돌 없음 · 최소 유사도. 앞의 넷은 compareCrossSellerProducts가
 * CONFLICT로 끝내는 경우 그 자체라(BRAND · CATEGORY · AUDIENCE/GENDER · COLOR ·
 * MODEL_CODE), 화면은 그 값을 **읽기만** 한다 — 같은 비교를 여기서 다시 하면
 * 판정기와 화면이 서로 다른 답을 내는 날이 온다.
 */
describe("목록에 설 수 있는 후보의 조건", () => {
  it("다섯 축 중 하나라도 명시적으로 어긋나면 목록에 서지 못한다", () => {
    expect(mayShowCandidate({ tier: "SAME", confidence: 0.99, crossSellerVerdict: "CONFLICT" })).toBe(false);
    expect(mayShowCandidate({ tier: "CONFLICT", confidence: 0.99 })).toBe(false);
    expect(mayShowCandidate({ tier: "UNKNOWN", confidence: 0.99 })).toBe(false);
  });

  it("텍스트 점수가 낮아도 근거가 있으면 목록에 선다", () => {
    // 실측: Smallable 430701 ↔ Bobo B226AC114은 상품명 어휘가 거의 겹치지 않아
    // 텍스트로는 0.38인데 교차판매처 판정은 SAME이다. 점수 하한이 근거를 이기면
    // 이번 작업이 되살린 바로 그 후보가 다시 화면에서 사라진다.
    expect(mayShowCandidate({ tier: "SAME", confidence: 0.09 })).toBe(true);
    expect(mayShowCandidate({ tier: "SIMILAR", confidence: 0.05, crossSellerVerdict: "SAME" })).toBe(true);
  });

  it("근거도 없고 점수도 바닥이면 '유사상품'이라고 부를 근거조차 없다", () => {
    expect(mayShowCandidate({ tier: "SIMILAR", confidence: 0.05 })).toBe(false);
    expect(mayShowCandidate({ tier: "SIMILAR", confidence: MIN_DISPLAY_SIMILARITY })).toBe(true);
  });
});
