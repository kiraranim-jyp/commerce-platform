/** P-4-DATA-8(CPO 지시, 2026-08-29) — ComparisonShopSearch.tsx의 ResultHeadline이
 * JSX 안에서 직접 판단하던 "검색이 실제로 실패했는가 vs 상품이 없는가"를 pure
 * function으로 뽑았다. F4(P-4-DATA-2에서 발견: 429로 검색이 막힌 상황이 "찾지
 * 못했습니다"와 구분 없이 보였던 사고)의 재발을 코드 레벨에서 막는 게 목적이다.
 *
 * 핵심 원칙(CPO 지시, 절대 유지) — 검색 상태(이 파일)와 가격 상태(price-truth.ts)는
 * 서로 다른 축이다. 검색이 SUCCESS인데 가격이 PRICE_UNAVAILABLE인 경우와, 검색
 * 자체가 RATE_LIMITED인 경우는 완전히 다른 문제이므로 하나의 enum으로 합치지
 * 않는다 — 이 파일은 오직 "검색 시스템이 셀러에게 무엇을 말해야 하는가"만 다룬다. */

export type ComparisonResultState = "RESULTS_FOUND" | "NO_RESULTS" | "PARTIAL_FAILURE" | "RATE_LIMITED" | "ERROR";

/** ComparisonShopSearch.tsx의 실제 SearchResult/Candidate 타입과 구조적으로 호환되는
 * 최소 입력 — 이 파일이 API 응답 타입 전체를 몰라도 되게 한다(결합도를 낮춘다). */
export interface ComparisonResultShopInput {
  status: "ok" | "unsupported" | "error";
  errorKind?: "RATE_LIMITED" | "TEMPORARY_ERROR";
  candidates: Array<{ matchLevel?: "very_high" | "high" | "medium" | "low" }>;
}

/**
 * P-4-DATA-8 STEP1 — status/errorKind/candidates만 보고 셀러에게 보여줄 상태
 * 하나를 결정한다. 우선순위(위에서부터 먼저 만족하는 조건이 이긴다):
 *
 * 1. 매칭 가능한(matchLevel !== "low") 후보가 하나라도 있으면 다른 판매처가
 *    전부 에러여도 RESULTS_FOUND(ST-02) — 판매처 일부 실패가 이미 찾은 결과를
 *    지우지 않는다.
 * 2. "unsupported"(파서 없음)만 제외한 나머지가 하나도 없으면 NO_RESULTS —
 *    비교 가능한 사이트 자체가 없었다는 뜻.
 * 3. 에러가 하나도 없고 후보도 없으면 NO_RESULTS(ST-01) — 검색은 전부 성공했고
 *    실제로 일치하는 상품이 없었다는 뜻.
 * 4. 검색 대상 전부가 에러이고 전부 RATE_LIMITED면 RATE_LIMITED(ST-04) — "일부"가
 *    아니라 "전체가 지금 막혔다"는 걸 명확히 구분한다.
 * 5. 검색 대상 전부가 에러이지만(3)을 만족하지 못하면(RATE_LIMITED가 아닌 에러가
 *    섞여 있으면) ERROR(ST-05) — 네트워크/API 오류를 "찾지 못함"으로 위장하지 않는다.
 * 6. 그 외(성공 일부 + 에러 일부 혼재, ST-03/ST-06) — PARTIAL_FAILURE.
 */
export function deriveComparisonResultState(results: ComparisonResultShopInput[]): ComparisonResultState {
  const acceptableCount = results.reduce(
    (sum, r) => sum + r.candidates.filter((c) => c.matchLevel && c.matchLevel !== "low").length,
    0,
  );
  if (acceptableCount > 0) return "RESULTS_FOUND";

  const considered = results.filter((r) => r.status !== "unsupported");
  if (considered.length === 0) return "NO_RESULTS";

  const errored = considered.filter((r) => r.status === "error");
  if (errored.length === 0) return "NO_RESULTS";

  const allErrored = errored.length === considered.length;
  const allRateLimited = allErrored && errored.every((r) => r.errorKind === "RATE_LIMITED");
  if (allRateLimited) return "RATE_LIMITED";
  if (allErrored) return "ERROR";
  return "PARTIAL_FAILURE";
}

/** 상태별 셀러 문구 — 개발자 상태 이름(RATE_LIMITED 등)이 화면에 직접 노출되지
 * 않도록 여기서만 문구를 관리한다. acceptableCount는 RESULTS_FOUND일 때만 쓰인다. */
export function getComparisonResultHeadline(
  state: ComparisonResultState,
  acceptableCount: number,
): { tone: "success" | "warning" | "neutral"; message: string } {
  switch (state) {
    case "RESULTS_FOUND":
      return { tone: "success", message: `비교 가능한 동일/유사 상품이 ${acceptableCount}건 발견되었습니다 (매칭 신뢰도 70% 이상).` };
    case "NO_RESULTS":
      return {
        tone: "neutral",
        message: "현재 검색 가능한 판매처에서는 일치하는 상품이 확인되지 않았습니다. ※ 해외에서 판매되지 않는다는 의미는 아닙니다.",
      };
    case "PARTIAL_FAILURE":
      return {
        tone: "warning",
        message: "일부 판매처를 확인하지 못했습니다 — 확인된 판매처 기준으로는 일치하는 상품이 없습니다.",
      };
    case "RATE_LIMITED":
      return { tone: "warning", message: "현재 가격 비교 요청이 많아 검색하지 못했습니다 — 잠시 후 다시 시도해주세요." };
    case "ERROR":
      return { tone: "warning", message: "일시적인 오류로 가격 비교를 진행하지 못했습니다 — 잠시 후 다시 시도해주세요." };
  }
}
