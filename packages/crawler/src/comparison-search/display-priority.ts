/**
 * P-9-A(대표님 지시, 2026-08-30) — "72% 유사상품이 42% 검증된 동일상품보다
 * 위에 보인다"는 문제를 고친다. 새 매칭 판정을 만들지 않는다(deriveMatchTruth,
 * modelCode/SKU 판정, verified 판정 조건은 전부 그대로) — 이미 API가 돌려주는
 * verified/matchReasons/matchConfidence만으로 "화면에 보여줄 순서"만 정한다.
 * DB 스키마 변경 없음(match_truth 컬럼을 추가하지 않는다) — matchReasons에
 * 이미 있는 "식별자 근거" 마커 텍스트로 식별자 기반 검증 여부를 판별한다
 * (P-8 candidateLabel()에서 쓴 것과 동일한 방식).
 *
 * 우선순위(대표님 지시 원문):
 * 1. verified=true (식별자 근거가 있으면 그 안에서 우선)
 * 2. verified=false — 같은 그룹 안에서는 matchConfidence 내림차순
 */
export interface DomesticCandidateTrust {
  verified: boolean;
  matchConfidence: number;
  matchReasons: string[];
}

function hasIdentifierEvidence(reasons: string[]): boolean {
  return reasons.some((r) => r.includes("식별자 근거"));
}

export function compareDomesticCandidateTrust<T extends DomesticCandidateTrust>(a: T, b: T): number {
  if (a.verified !== b.verified) return a.verified ? -1 : 1;
  if (a.verified) {
    const aId = hasIdentifierEvidence(a.matchReasons);
    const bId = hasIdentifierEvidence(b.matchReasons);
    if (aId !== bId) return aId ? -1 : 1;
  }
  return b.matchConfidence - a.matchConfidence;
}

export function sortDomesticCandidatesByTrust<T extends DomesticCandidateTrust>(candidates: readonly T[]): T[] {
  return [...candidates].sort(compareDomesticCandidateTrust);
}
