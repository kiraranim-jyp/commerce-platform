/**
 * N-4.18-Q3 PART H-3-5(대표님 지시, 2026-08-27) — Evidence 기반 안전장치.
 * 기존 confidence 계산식(match.ts scoreCandidateMatch/classifyMatchLevel)은
 * 이 파일에서 절대 다시 계산하지 않는다 — 새 점수 합산 엔진이 아니라, 기존
 * MatchResult(confidence/level) 위에 독립적으로 얹는 "자동확정/검토필요/
 * 기존판단유지" 3단계 결정 레이어다.
 *
 * P-7-C STEP 2(대표님 지시, 2026-08-29 — "실시간 검색과 저장 파이프라인이
 * 서로 다른 상품 진실 판정 기준을 가지면 안 된다") — 이 함수의 자동확정
 * 판단을 match-truth.ts의 deriveMatchTruth()로 통일한다. 새 판정 로직을
 * 복제하지 않는다. H-3-5의 "modelCode=exact여도 기존 level이 medium/low면
 * auto_confirm 안 함" 규칙은 이번 지시로 명시적으로 대체됐다 — 실측(P-7-C
 * STEP 1, production): 포레포레 정답 후보가 이 저장 파이프라인이 실제로
 * 보는 라이브 검색 컨텍스트에서는 텍스트 confidence 42%(low)로 나오는데,
 * SKU는 partial 일치한다. 예전 규칙대로면 이 후보는 domestic_product_links에
 * 아예 생기지도 않는다(matchLevel=low→NOT_MATCHED). 대표님 지시 원문:
 * "텍스트 점수가 낮아도(medium 이하) 식별자가 없는 후보보다 항상 위에
 * 온다" — "이하"에는 low도 포함된다.
 *
 * 여전히 유지되는 원칙:
 * 1. modelCode="conflict"는 기존 level과 무관하게 항상 review_required.
 * 2. modelCode="exact"/"partial"(=식별자 증거)이면 텍스트 level과 무관하게
 *    auto_confirm — 단, "42% → high로 승격"처럼 matchConfidence/matchType
 *    라벨 자체를 조작하지 않는다(P-7-C P2). 오직 verified 플래그만 이
 *    별도 근거로 바뀐다 — 텍스트 confidence는 계속 분리해서 그대로 저장된다.
 * 3. image/options의 weak_or_no_evidence/unavailable/partial_overlap은
 *    "0점 또는 영향 없음"이다 — 절대로 기존 very_high/high/medium 후보를
 *    낮추거나 탈락시키지 않는다.
 * 4. modelCode="unavailable"(식별자 증거 자체가 없음)이면 텍스트 level이
 *    아무리 높아도(SIMILAR/TEXT_CONFIRMED) 절대 이 함수가 임의로 승격하지
 *    않는다(듀베베 72%가 자동으로 동일상품 취급되지 않아야 하는 이유).
 */
import type { MatchResult } from "./match";
import type { ImageEvidenceResult, ModelEvidenceResult, OptionEvidenceResult } from "./evidence";
import { deriveMatchTruth, type MatchTruth } from "./match-truth";

export type AutoDecision = "auto_confirm" | "review_required" | "unchanged";

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
  /** P-10 STEP 4(대표님/CPO 지시, 2026-08-30) — deriveMatchTruth()가 이미 계산하던
   * 값을 밖으로 꺼내기만 한다(재계산 없음, 새 판정 로직 아님). 지금까지는 이
   * 함수 안에서만 쓰이고 버려졌다 — 저장/API/UI가 matchReasons 문자열을 다시
   * 파싱해서 우회 추론하던 근본 원인이었다. */
  truth: MatchTruth;
}

export function decideCandidateEvidence(input: CandidateEvidenceInput): CandidateEvidenceDecision {
  const reasons: string[] = [];
  const truth = deriveMatchTruth(input.match.level, input.modelCode);

  if (truth === "CONFLICT") {
    reasons.push(
      `modelCode 충돌(기존 매칭 level=${input.match.level}) — 자동확정 금지, 검토 필요로 전환`,
    );
    return { decision: "review_required", reasons, truth };
  }

  if (truth === "EXACT_IDENTIFIER" || truth === "STRONG_IDENTIFIER") {
    reasons.push(
      `modelCode ${input.modelCode === "exact" ? "완전" : "부분"} 일치(식별자 근거) + 기존 매칭 level=${input.match.level} — 텍스트 점수와 무관하게 식별자 증거로 자동확정`,
    );
    if (input.options === "strong_overlap") reasons.push("옵션 구성도 강하게 일치(보조 근거)");
    if (input.image === "strong_match") reasons.push("이미지도 강하게 일치(보조 근거)");
    return { decision: "auto_confirm", reasons, truth };
  }

  // 이 아래는 전부 "기존 판단 유지"(truth는 TEXT_CONFIRMED/SIMILAR/
  // INSUFFICIENT_EVIDENCE 중 하나 — modelCode는 항상 "unavailable"이다,
  // exact/partial/conflict는 위에서 전부 처리됨). image/options가 무엇이든
  // (strong_match/possible_match 포함) 여기서는 승격시키지 않고 보조 근거로만
  // 기록한다 — 대표님 지시: "약한 긍정 증거"는 참고만, 확정 근거로 쓰지 않음.
  // 텍스트 level이 아무리 높아도(TEXT_CONFIRMED) 식별자 증거가 없으면 이
  // 레이어가 임의로 승격하지 않는다 — 듀베베(72%, SIMILAR)가 자동으로
  // 동일상품 취급되지 않아야 하는 이유가 바로 이 분기다.
  if (input.options === "strong_overlap") reasons.push("옵션 구성 강하게 일치 — 보조 근거(단독으로 승격시키지 않음)");
  if (input.image === "strong_match") reasons.push("이미지 강하게 일치 — 보조 근거(단독으로 승격시키지 않음)");
  if (input.image === "possible_match") reasons.push("이미지 약한 긍정 근거 — 참고만, 확정에 사용하지 않음");
  // options=partial_overlap/unavailable, image=weak_or_no_evidence/unavailable,
  // modelCode=unavailable: 전부 "영향 없음"이라 reasons에도 안 남긴다(정말
  // 아무 영향이 없다는 것 자체가 이 레이어의 안전장치이므로).

  return { decision: "unchanged", reasons, truth };
}
