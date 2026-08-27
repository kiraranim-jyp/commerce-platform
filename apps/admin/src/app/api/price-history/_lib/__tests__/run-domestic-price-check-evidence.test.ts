import { describe, expect, it } from "vitest";
import { compareModelCode, decideCandidateEvidence } from "@commerce/crawler";
import { toDomesticMatchType } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { applyEvidenceDecision } from "../run-domestic-price-check";

/**
 * N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — decideCandidateEvidence()가
 * 실제 domestic_product_links 필드(verified)에 어떻게 반영되는지 검증한다.
 * applyEvidenceDecision()은 순수 함수라 Supabase 없이 전체 흐름(toDomesticMatchType
 * → decideCandidateEvidence → applyEvidenceDecision)을 그대로 재현할 수 있다.
 *
 * 대표님이 요청한 최소 4개 검증을 그대로 테스트 케이스로 옮긴다:
 *   1. PèPè Golden Case — medium + partial → 기존 검토 상태 유지
 *   2. Bobo Choses Golden Case — 기존 very_high 자동 흐름 회귀 없음
 *   3. conflict 케이스 — 자동확정 차단
 *   4. high + exact 케이스 — 실제 auto_confirm 링크 생성 확인
 */
describe("H-3-6: Evidence Decision → domestic_product_links 연결", () => {
  it("1) PèPè Golden Case: medium + modelCode partial → 기존 REVIEW_REQUIRED/verified=false 유지", () => {
    // 실측(H-3-2/H-3-5): "01195-VERNICE-NERO" vs "PP24KASHE1195NER" -> partial
    const modelCode = compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER");
    expect(modelCode).toBe("partial");

    const { matchType, autoVerified } = toDomesticMatchType("medium");
    expect(matchType).toBe("REVIEW_REQUIRED");
    expect(autoVerified).toBe(false);

    const decision = decideCandidateEvidence({
      match: { confidence: 0.71, level: "medium", reasons: ["모델명 유사도 22%", "브랜드 일치"] },
      modelCode,
      options: "unavailable",
      image: "unavailable",
    });
    expect(decision.decision).toBe("unchanged");

    const result = applyEvidenceDecision(autoVerified, ["모델명 유사도 22%", "브랜드 일치"], decision);
    expect(result.verified).toBe(false); // 기존과 동일 — 강등도 승격도 없음
    expect(result.matchReasons).toEqual(["모델명 유사도 22%", "브랜드 일치"]); // evidence reasons 추가 없음
  });

  it("2) Bobo Choses Golden Case: very_high + evidence 전부 unavailable → 기존 자동확정 흐름 그대로 유지", () => {
    const { matchType, autoVerified } = toDomesticMatchType("very_high");
    expect(matchType).toBe("EXACT");
    expect(autoVerified).toBe(true);

    const decision = decideCandidateEvidence({
      match: { confidence: 1.0, level: "very_high", reasons: ["모델명 유사도 100%"] },
      modelCode: "unavailable",
      options: "unavailable",
      image: "unavailable",
    });
    expect(decision.decision).toBe("unchanged");

    const result = applyEvidenceDecision(autoVerified, ["모델명 유사도 100%"], decision);
    expect(result.verified).toBe(true); // 기존 자동확정 그대로 — 회귀 없음
  });

  it("3) 텍스트는 매우 유사하지만 modelCode conflict → 자동확정 차단(verified=false로 강제 전환)", () => {
    // H-3-2 실측 로직 그대로: 서로 무관한 두 코드
    const modelCode = compareModelCode("B226AC010", "XYZ999QRS");
    expect(modelCode).toBe("conflict");

    // 텍스트 매칭만 보면 very_high(95%+)라 원래는 자동확정됐을 후보
    const { autoVerified } = toDomesticMatchType("very_high");
    expect(autoVerified).toBe(true);

    const decision = decideCandidateEvidence({
      match: { confidence: 0.98, level: "very_high", reasons: ["모델명 유사도 98%", "브랜드 일치"] },
      modelCode,
      options: "unavailable",
      image: "unavailable",
    });
    expect(decision.decision).toBe("review_required");

    const result = applyEvidenceDecision(autoVerified, ["모델명 유사도 98%", "브랜드 일치"], decision);
    expect(result.verified).toBe(false); // 잘못된 자동 링크 방지 — 원래 true였을 걸 강제로 false
    expect(result.matchReasons.some((r) => r.includes("충돌"))).toBe(true);
  });

  it("4) high + modelCode exact → 실제 auto_confirm(verified=true) 링크 생성", () => {
    const modelCode = compareModelCode("B226AC010", "B226AC010");
    expect(modelCode).toBe("exact");

    // 텍스트만 보면 high(85~94%)라 원래는 autoVerified=false(후보로만 표시)
    const { matchType, autoVerified } = toDomesticMatchType("high");
    expect(matchType).toBe("HIGH_CONFIDENCE");
    expect(autoVerified).toBe(false);

    const decision = decideCandidateEvidence({
      match: { confidence: 0.88, level: "high", reasons: ["모델명 유사도 88%", "브랜드 일치"] },
      modelCode,
      options: "unavailable",
      image: "unavailable",
    });
    expect(decision.decision).toBe("auto_confirm");

    const result = applyEvidenceDecision(autoVerified, ["모델명 유사도 88%", "브랜드 일치"], decision);
    expect(result.verified).toBe(true); // 강한 구조화 증거로 자동확정 — 텍스트 점수 자체는 재계산 안 함
    expect(result.matchReasons.some((r) => r.includes("완전 일치"))).toBe(true);
  });
});
