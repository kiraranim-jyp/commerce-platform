import type { ComparisonCandidate } from "./types";

/** Sprint B-1.8 — 사이트당 상세 가격 확인 요청 상한. 검색 결과가 몇 건이든 이 숫자를
 * 넘겨서 상세 API를 호출하지 않는다(비용 제한, CPO 지시). */
export const MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2;

/** P-4-DATA-4(CPO 지시, 2026-08-29) — 기존엔 medium(70~84%) 후보가 상세 검증
 * 대상에서 아예 제외됐다. 실측 확인된 실제 버그 2건(Booty Ghosts 반팔 £59→£35,
 * Misha & Puff Mink £270→£159)이 정확히 이 사각지대였다 — 둘 다 medium이라
 * 검증 자체를 시도하지 않았고, 검색 인덱스의 부정확한 값이 그대로 노출될 뻔했다.
 *
 * 그렇다고 "medium을 무조건 다 검증"하지 않는다(P-4-DATA-2 조사에서 확인: 상한을
 * 유지한 채 우선순위만 조정해도 이번 두 사례 모두 잡힌다 — very_high가 이미 슬롯
 * 1개만 쓰고 있었으므로 남는 슬롯이 medium으로 자동 채워지는 구조). 우선순위는
 * very_high > high > medium이고, 그 안에서는 confidence 내림차순(candidates
 * 배열이 이미 withConfidence()에서 정렬된 순서 — 이 함수는 그 순서를 그대로
 * 신뢰한다)이다. 사이트당 상한(MAX_DETAIL_CONFIRMATIONS_PER_SHOP)은 그대로
 * 유지 — 무제한 API 호출 증가를 막는다는 기존 원칙은 바뀌지 않는다. */
export function selectCandidatesForDetailConfirmation(candidates: ComparisonCandidate[]): number[] {
  const eligible = candidates
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.matchLevel === "very_high" || c.matchLevel === "high" || c.matchLevel === "medium");
  const rank = (level: ComparisonCandidate["matchLevel"]): number =>
    level === "very_high" ? 0 : level === "high" ? 1 : 2;
  eligible.sort((a, b) => rank(a.c.matchLevel) - rank(b.c.matchLevel));
  return eligible.slice(0, MAX_DETAIL_CONFIRMATIONS_PER_SHOP).map(({ i }) => i);
}
