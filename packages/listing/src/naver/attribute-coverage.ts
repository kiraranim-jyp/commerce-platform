import type { NaverAttributeResolutionResult } from "./attribute-resolver";

/**
 * N-4.05 Track D(대표님 지시) — resolveNaverProductAttributes()가 이미 만드는
 * MATCHED/UNRESOLVED/NOT_AVAILABLE 결과를 집계만 한다(새 판정 로직 없음 —
 * 이 프로젝트의 반복 원칙과 동일, readiness.ts/compute-readiness.ts 참고).
 * 이 결과를 그대로 노란불 UX(Track G의 issues 배열)와 Golden Test 검증에
 * 재사용한다.
 */
export interface AttributeCoverage {
  total: number;
  matched: number;
  unresolved: number;
  notAvailable: number;
  /** matched / (matched + unresolved) — notAvailable(이 마켓/카테고리에 아예
   * 없는 속성)은 분모에서 제외한다. 셀러가 채울 수 없는 값을 "미달성"으로
   * 세면 억울한 낮은 점수가 나온다. */
  matchRatePercent: number;
}

export function computeAttributeCoverage(results: NaverAttributeResolutionResult[]): AttributeCoverage {
  const matched = results.filter((r) => r.status === "MATCHED").length;
  const unresolved = results.filter((r) => r.status === "UNRESOLVED").length;
  const notAvailable = results.filter((r) => r.status === "NOT_AVAILABLE").length;
  const applicable = matched + unresolved;
  const matchRatePercent = applicable > 0 ? Math.round((matched / applicable) * 100) : 100;
  return { total: results.length, matched, unresolved, notAvailable, matchRatePercent };
}
