/**
 * N-4.18-Q3 PART H-3-5(대표님 지시, 2026-08-27) — Evidence 기반 안전장치.
 * 기존 confidence 계산식(match.ts scoreCandidateMatch/classifyMatchLevel)은
 * 이 파일에서 절대 다시 계산하지 않는다 — 새 점수 합산 엔진이 아니라, 기존
 * MatchResult(confidence/level) 위에 독립적으로 얹는 "자동확정/검토필요/
 * 기존판단유지" 3단계 결정 레이어다.
 *
 * 대표님 지시 원칙(H-3-4 실측 결과 반영):
 * 1. modelCode="conflict"는 기존 level과 무관하게 항상 review_required —
 *    자동확정을 절대 허용하지 않는다(브랜드/텍스트가 아무리 강해도 품번이
 *    서로 다르면 다른 상품일 위험이 있다는 대표님 H-3 refinement 원칙 #1의
 *    연장).
 * 2. modelCode="exact" + 기존 level이 high 이상일 때만 auto_confirm —
 *    "exact"만으로는 부족하고 기존 텍스트 매칭도 이미 강해야 한다(대표님
 *    예시 표 그대로: "기존 high + modelCode exact → 매우 강한 근거").
 *    medium/low에서는 exact여도 auto_confirm하지 않는다(대표님 예시에
 *    명시된 조합이 아님 — 임의로 확장하지 않는다).
 * 3. image/options의 weak_or_no_evidence/unavailable/partial_overlap은
 *    "0점 또는 영향 없음"이다 — 절대로 기존 very_high/high/medium 후보를
 *    낮추거나 탈락시키지 않는다(H-3-4 실측: 진짜 동일상품도 dHash
 *    distance=86으로 weak_or_no_evidence가 나왔기 때문 — 이걸로 강등하면
 *    실제 골든케이스를 스스로 깎아내리는 꼴이 된다).
 * 4. modelCode="partial"은 강등도 승격도 아닌 보조 근거로만 reasons에
 *    기록한다(기존 판단 유지).
 */
import type { MatchLevel, MatchResult } from "./match";
import type { ImageEvidenceResult, ModelEvidenceResult, OptionEvidenceResult } from "./evidence";

export type AutoDecision = "auto_confirm" | "review_required" | "unchanged";

/** modelCode="exact"만으로 auto_confirm을 주지 않는다 — 기존 텍스트 매칭도
 * 이미 high 이상이어야 한다(대표님 예시 표 그대로, 확장하지 않음). */
const AUTO_CONFIRM_ELIGIBLE_LEVELS: ReadonlySet<MatchLevel> = new Set(["high", "very_high"]);

export interface CandidateEvidenceInput {
  /** match.ts scoreCandidateMatch()의 결과 그대로 — 이 함수는 재계산하지 않고
   * 참조만 한다. */
  match: MatchResult;
  modelCode: ModelEvidenceResult;
  /** 아직 해외측 옵션 추출 함수가 없는 사이트는 항상 "unavailable"로 정직하게
   * 전달한다(H-3-3은 국내 3개 Cafe24 사이트의 옵션 추출까지만 확보했고, 해외
   * 쪽 옵션 비교 로직은 이번 단계 범위 밖 — 지어내지 않는다). */
  options: OptionEvidenceResult;
  image: ImageEvidenceResult;
}

export interface CandidateEvidenceDecision {
  decision: AutoDecision;
  /** 결정에 실제로 영향을 준 근거만 담는다(대표님 지시: "왜 91%인가"가 아니라
   * "무슨 증거 때문에 이렇게 판정했는가"를 알 수 있어야 함, evidence.ts와 동일
   * 설계 원칙). */
  reasons: string[];
}

export function decideCandidateEvidence(input: CandidateEvidenceInput): CandidateEvidenceDecision {
  const reasons: string[] = [];

  if (input.modelCode === "conflict") {
    reasons.push(
      `modelCode 충돌(기존 매칭 level=${input.match.level}) — 자동확정 금지, 검토 필요로 전환`,
    );
    return { decision: "review_required", reasons };
  }

  if (input.modelCode === "exact" && AUTO_CONFIRM_ELIGIBLE_LEVELS.has(input.match.level)) {
    reasons.push(`modelCode 완전 일치 + 기존 매칭 level=${input.match.level} — 강한 동일상품 근거로 자동확정`);
    if (input.options === "strong_overlap") reasons.push("옵션 구성도 강하게 일치(보조 근거)");
    if (input.image === "strong_match") reasons.push("이미지도 강하게 일치(보조 근거)");
    return { decision: "auto_confirm", reasons };
  }

  // 이 아래는 전부 "기존 판단 유지" — modelCode partial/unavailable, 또는
  // exact이지만 기존 level이 medium/low인 경우. image/options가 무엇이든
  // (strong_match/possible_match 포함) 여기서는 강등하지 않고 보조 근거로만
  // 기록한다 — 대표님 지시: "약한 긍정 증거"는 참고만, 확정 근거로 쓰지 않음.
  if (input.modelCode === "partial") reasons.push("modelCode 부분 일치 — 보조 근거로만 사용, 기존 판단 유지");
  if (input.modelCode === "exact") {
    reasons.push(`modelCode 완전 일치했으나 기존 매칭 level=${input.match.level}(medium/low)이라 자동확정 대상 아님 — 기존 판단 유지`);
  }
  if (input.options === "strong_overlap") reasons.push("옵션 구성 강하게 일치 — 보조 근거(단독으로 승격시키지 않음)");
  if (input.image === "strong_match") reasons.push("이미지 강하게 일치 — 보조 근거(단독으로 승격시키지 않음)");
  if (input.image === "possible_match") reasons.push("이미지 약한 긍정 근거 — 참고만, 확정에 사용하지 않음");
  // options=partial_overlap/unavailable, image=weak_or_no_evidence/unavailable,
  // modelCode=unavailable: 전부 "영향 없음"이라 reasons에도 안 남긴다(정말
  // 아무 영향이 없다는 것 자체가 이 레이어의 안전장치이므로).

  return { decision: "unchanged", reasons };
}
