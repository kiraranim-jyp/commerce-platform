import type { SearchTrendStatus } from "@commerce/crawler";

/**
 * P-30(CPO 지시, 2026-09-03) — SEARCH_INTEREST 캐시의 "얼마나 오래 믿을
 * 것인가" 규칙만 모아둔 순수 모듈이다. Supabase/crawler 런타임에 의존하지
 * 않으므로(위 import는 타입 전용이라 런타임에 사라진다) 단위 테스트가 가능하다.
 *
 * 기존 문제: 성공이든 실패든 결과를 똑같이 7일 캐싱했다. 인증 오류나 일시적
 * 네트워크 실패 한 번이 "검색 관심 확인 불가"를 일주일 동안 고정시켰고,
 * 원인을 고쳐도 캐시 때문에 재확인이 막혔다.
 */
export const SEARCH_INTEREST_OK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export const CACHE_TTL_BY_STATUS: Record<SearchTrendStatus, number> = {
  // 정상 데이터 — 기존 전략 유지(브랜드당 주 1회면 신호로 충분).
  OK: SEARCH_INTEREST_OK_TTL_MS,
  // API는 정상인데 집계 결과가 없는 키워드. 실패가 아니라 "사실"이지만,
  // 검색어 전략(브랜드명 vs 상품명)이 바뀌면 결과도 바뀌므로 1일만 유지한다.
  NO_DATA: 24 * 60 * 60 * 1000,
  // 설정을 고치기 전에는 재시도해도 결과가 같다 — 반복 호출을 막되,
  // 고친 뒤 하루를 기다리지 않도록 6시간으로 둔다.
  AUTH_ERROR: 6 * 60 * 60 * 1000,
  REQUEST_ERROR: 6 * 60 * 60 * 1000,
  // 일시적 오류(429/5xx/타임아웃) — 짧게만 막고 곧 다시 시도할 수 있게 한다.
  TRANSIENT_ERROR: 30 * 60 * 1000,
  // 외부 호출을 하지 않은 경우라 애초에 캐시에 저장하지 않는다.
  NOT_CONFIGURED: 0,
};

export interface SearchInterestCacheValue {
  ratio: number | null;
  keyword: string;
  /** P-30에서 추가 — 그 이전에 저장된 행에는 없다(아래 호환 처리). */
  status?: SearchTrendStatus;
}

/**
 * 캐시된 값이 아직 유효한지 판단한다.
 *
 * P-30 이전에 저장된 행에는 status가 없다. 그중 ratio가 숫자인 행은 정상
 * 조회 결과가 분명하므로 기존 7일 TTL을 그대로 인정한다. 반면 `ratio: null`만
 * 남아 있는 행은 "정상인데 데이터가 없었다"인지 "인증 실패였다"인지 구분할
 * 수 없다 — 실패를 7일간 정상처럼 고정하던 바로 그 문제이므로, 신뢰하지 않고
 * 만료된 것으로 취급해 다음 조회 때 한 번 다시 확인한다(수동 DB 삭제 불필요).
 */
export function isSearchInterestCacheFresh(value: SearchInterestCacheValue, ageMs: number): boolean {
  if (!value.status) return value.ratio != null && ageMs < SEARCH_INTEREST_OK_TTL_MS;
  return ageMs < (CACHE_TTL_BY_STATUS[value.status] ?? 0);
}
