/**
 * P-9-A(대표님 지시, 2026-08-30) — "72% 유사상품이 42% 검증된 동일상품보다
 * 위에 보인다"는 문제를 고친다. 새 매칭 판정을 만들지 않는다(deriveMatchTruth,
 * modelCode/SKU 판정, verified 판정 조건은 전부 그대로) — 이미 API가 돌려주는
 * matchTruth/verified/matchReasons/matchConfidence만으로 "화면에 보여줄 순서"만
 * 정한다.
 *
 * P-10 STEP 5(대표님/CPO 지시, 2026-08-30) — matchTruth가 있으면(신규/재확인된
 * 행) 그 값과 MATCH_TRUTH_RANK로만 정렬한다. matchReasons 문자열에서 "식별자
 * 근거"를 다시 찾는 우회 추론은 더 이상 하지 않는다 — CPO 지시 "문자열 파싱을
 * 신규 경로에서 제거한다"를 그대로 반영. matchTruth가 null인 행(마이그레이션
 * 030 이전에 저장된 레거시 데이터, backfill 없음)만 예전 verified/matchReasons
 * 기반 로직으로 처리한다 — 신규 데이터와 레거시 데이터를 같은 로직인 것처럼
 * 섞지 않는다(CPO 지시).
 *
 * 우선순위:
 * 1. matchTruth 있는 후보가 없는 후보(레거시)보다 항상 위(신뢰도 정보가 있는
 *    쪽을 우선한다 — 정보 없음보다 정보 있음이 낫다).
 * 2. matchTruth끼리는 MATCH_TRUTH_RANK 내림차순(EXACT_IDENTIFIER > ... >
 *    CONFLICT), 동률이면 matchConfidence 내림차순.
 * 3. matchTruth 없는(레거시) 후보끼리는 예전 방식 그대로: verified 우선(그 안에서
 *    matchReasons의 "식별자 근거" 마커로 재확인), 그다음 matchConfidence 내림차순.
 */
import { MATCH_TRUTH_RANK, type MatchTruth } from "./match-truth";

export interface DomesticCandidateTrust {
  verified: boolean;
  matchConfidence: number;
  matchReasons: string[];
  /** null이면 레거시 데이터(마이그레이션 030 이전 저장) — legacy fallback 경로로 처리한다. */
  matchTruth?: MatchTruth | null;
}

/** 레거시(matchTruth=null) 전용 fallback — 신규 데이터 경로에서는 쓰지 않는다. */
function hasIdentifierEvidenceLegacyFallback(reasons: string[]): boolean {
  return reasons.some((r) => r.includes("식별자 근거"));
}

export function compareDomesticCandidateTrust<T extends DomesticCandidateTrust>(a: T, b: T): number {
  const aHasTruth = a.matchTruth != null;
  const bHasTruth = b.matchTruth != null;

  if (aHasTruth !== bHasTruth) return aHasTruth ? -1 : 1;

  if (aHasTruth && bHasTruth) {
    const rankDiff = MATCH_TRUTH_RANK[b.matchTruth as MatchTruth] - MATCH_TRUTH_RANK[a.matchTruth as MatchTruth];
    if (rankDiff !== 0) return rankDiff;
    return b.matchConfidence - a.matchConfidence;
  }

  // 레거시 fallback(둘 다 matchTruth=null)
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  if (a.verified) {
    const aId = hasIdentifierEvidenceLegacyFallback(a.matchReasons);
    const bId = hasIdentifierEvidenceLegacyFallback(b.matchReasons);
    if (aId !== bId) return aId ? -1 : 1;
  }
  return b.matchConfidence - a.matchConfidence;
}

export function sortDomesticCandidatesByTrust<T extends DomesticCandidateTrust>(candidates: readonly T[]): T[] {
  return [...candidates].sort(compareDomesticCandidateTrust);
}
