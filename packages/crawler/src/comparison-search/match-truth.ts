import type { MatchLevel } from "./match";
import type { ModelEvidenceResult } from "./evidence";

/**
 * P-7-B(CPO 지시, 2026-08-29) — "72%를 60%로 낮추는 땜질"이 아니라, 점수(confidence)와
 * "동일상품인지에 대한 판단"을 분리한다. 실측 골든케이스(Pepe Shoes "Lulu T-Bar
 * Shoes in Vernice Nero"): 포레포레의 진짜 동일상품(PP24KASHE1195NER)은 텍스트
 * 유사도만으로는 71%(medium)에 그치고, 실제로는 전혀 다른 상품인 듀베베 후보가
 * 72%(medium)로 더 높게 나온다 — 이 상태에서는 아무리 배지 색을 바꿔도 두 후보가
 * 화면에서 구분되지 않는다.
 *
 * 이 파일은 새 confidence 계산식이 아니다(scoreCandidateMatch/classifyMatchLevel은
 * 그대로 둔다, decision.ts와 동일 원칙 — "기존 판단은 다시 계산하지 않는다"). 대신
 * 이미 계산된 matchLevel과 modelCode 증거(evidence.ts/model-code.ts, 이미 존재)를
 * 조합해서 "이 후보를 사람이 어떤 근거로 신뢰해야 하는지"를 별도 축으로 매긴다.
 *
 * 우선순위 설계 원칙(CPO 지시):
 * - modelCode가 "conflict"면 텍스트 점수가 아무리 높아도 절대 상위 등급을 주지
 *   않는다(다른 상품이라는 명백한 반증이 있다는 뜻).
 * - modelCode가 "exact"/"partial"이면(=식별자 증거가 있다면) 텍스트 점수가 낮아도
 *   (medium 이하) 식별자가 없는 후보보다 항상 위에 온다 — 실측 케이스 그대로:
 *   포레포레 71%+partial이 듀베베 72%+unavailable보다 신뢰도가 높아야 한다.
 * - modelCode가 "unavailable"(식별자를 아예 비교할 수 없음, 추출 기능이 없는
 *   사이트 포함)이면 텍스트 점수만으로 판단하되, 식별자 확인 후보보다는 절대
 *   위로 올라가지 않는다.
 */
export type MatchTruth =
  | "EXACT_IDENTIFIER"
  | "STRONG_IDENTIFIER"
  | "TEXT_CONFIRMED"
  | "SIMILAR"
  | "CONFLICT"
  | "INSUFFICIENT_EVIDENCE";

/** 값이 클수록 "더 신뢰할 수 있는 동일상품 근거". 서로 다른 판매처의 후보를
 * 비교할 때(예: 포레포레 vs 듀베베) 이 값으로 우선순위를 매긴다 — CONFLICT는
 * 텍스트 점수와 무관하게 항상 최하위(0)로 취급한다. */
export const MATCH_TRUTH_RANK: Record<MatchTruth, number> = {
  EXACT_IDENTIFIER: 5,
  STRONG_IDENTIFIER: 4,
  TEXT_CONFIRMED: 3,
  SIMILAR: 2,
  INSUFFICIENT_EVIDENCE: 1,
  CONFLICT: 0,
};

const HIGH_OR_ABOVE: ReadonlySet<MatchLevel> = new Set(["high", "very_high"]);

/**
 * decision.ts의 decideCandidateEvidence()와 같은 입력(match level + modelCode
 * 증거)을 받지만, 목적이 다르다 — decideCandidateEvidence는 "자동확정해도
 * 되는가"(verified 플래그, 3단계)를 결정하고, 이 함수는 "화면에 어떤 신뢰
 * 등급으로 보여줄 것인가"(6단계 랭크)를 결정한다. 두 함수는 서로 다른
 * 소비자(자동확정 파이프라인 vs UI 배지)를 위한 것이라 별도로 둔다 — 하나를
 * 다른 하나 위에 구현하면 "자동확정 기준"과 "화면 표시 기준"이 우연히 같은 값이
 * 되어야 한다는 잘못된 결합이 생긴다.
 */
export function deriveMatchTruth(level: MatchLevel, modelCode: ModelEvidenceResult): MatchTruth {
  if (level === "low") return "INSUFFICIENT_EVIDENCE";

  if (modelCode === "conflict") return "CONFLICT";

  if (modelCode === "exact") {
    return HIGH_OR_ABOVE.has(level) ? "EXACT_IDENTIFIER" : "STRONG_IDENTIFIER";
  }

  if (modelCode === "partial") return "STRONG_IDENTIFIER";

  // modelCode === "unavailable" — 식별자 증거가 아예 없다. 텍스트 점수만으로 판단한다.
  return HIGH_OR_ABOVE.has(level) ? "TEXT_CONFIRMED" : "SIMILAR";
}
