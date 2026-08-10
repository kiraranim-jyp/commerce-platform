import type { ComparisonCandidate } from "./types";

/** Sprint B-1.8 — 사이트당 상세 가격 확인 요청 상한. 검색 결과가 몇 건이든 이 숫자를
 * 넘겨서 상세 API를 호출하지 않는다(비용 제한, CPO 지시). */
export const MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2;

/** 동일상품일 가능성이 높다고 이미 판단된(very_high/high) 후보 중 앞에서부터 최대
 * MAX_DETAIL_CONFIRMATIONS_PER_SHOP개의 인덱스만 돌려준다 — 순수 함수라(네트워크 호출하는
 * fetchShopifyProductJson과 분리) 별도 dependency 없이 테스트 가능하다. */
export function selectCandidatesForDetailConfirmation(candidates: ComparisonCandidate[]): number[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.matchLevel === "very_high" || c.matchLevel === "high")
    .slice(0, MAX_DETAIL_CONFIRMATIONS_PER_SHOP)
    .map(({ i }) => i);
}
