/**
 * MI-UX-9(CPO 지시, 2026-09-07 §10/§11) — "결과가 없다"와 "그 사이트는 원래
 * 자동 검색을 못 한다"를 구분한다.
 *
 * 문제였던 상황: 화면이 결과 없음을 전부 한 덩어리로 취급해서, 셀러가
 * `수동 확인 필요`를 보고도 그게 "우리가 아직 지원하지 않는 사이트"라는 뜻인지
 * "이번에 검색이 깨졌다"는 뜻인지 알 수 없었다. 둘은 셀러가 해야 할 행동이
 * 다르다 — 전자는 직접 사이트에 들어가 봐야 하고, 후자는 잠시 후 재검색하면 된다.
 *
 * 판정 근거는 이미 서버에 있다. 새로 만들지 않고 그대로 쓴다:
 *  - 국내: domestic_price_sources.collectionStrategy가 MANUAL/NOT_AVAILABLE이면
 *    crawler가 실제 요청을 보내지 않고 status="unsupported"로 응답한다
 *    (packages/crawler/src/comparison-search/index.ts의 searchOneDomesticShop).
 *  - 해외: 해당 도메인 파서가 없으면 같은 자리에서 status="unsupported".
 * 즉 "unsupported = 자동 검색 capability 없음"은 이미 서버가 아는 사실이고,
 * 여기서는 그 사실을 셀러 언어로 옮기기만 한다. 새 crawler 구조를 만들지 않는다.
 *
 * 이 파일은 판정하지 않는다 — 매칭 알고리즘, 가격 반영 정책과 무관하다.
 */
export type SearchSourceStatus =
  /** 자동 검색을 지원하고, 이번 검색에서 후보를 찾았다. */
  | "AUTO_SUPPORTED"
  /** 이 사이트는 자동 검색 자체를 지원하지 않는다 → 셀러가 직접 확인해야 한다. */
  | "MANUAL_REQUIRED"
  /** 자동 검색은 지원하지만 이번 요청이 실패했다 → 재시도하면 된다. */
  | "SEARCH_FAILED"
  /** 자동 검색이 정상 수행됐고, 결과가 정말 없었다. */
  | "NO_RESULT"
  /** 위 어느 것으로도 확정할 수 없다(구버전 응답 등) → 아는 척하지 않는다. */
  | "UNKNOWN";

/** 화면이 status 문자열을 그대로 쓰지 않도록, 이 모듈이 라벨까지 같이 준다.
 * 국내/해외가 같은 상황을 다른 문구로 부르던 것(MATCHING-UNIFY-1이 매칭 라벨에
 * 대해 해결한 것)을 검색 상태에 대해서도 똑같이 막는다. */
export interface SearchSourceStatusDisplay {
  status: SearchSourceStatus;
  /** 표의 "상품" 칸에 후보 대신 들어가는 한 줄. */
  note: string;
}

/** crawler의 ComparisonSearchResult에서 이 판정에 필요한 부분만. 국내/해외
 * 컴포넌트가 각자 선언한 SearchResult 인터페이스 둘 다 이 모양을 만족한다. */
export interface SearchSourceStatusInput {
  status?: "ok" | "unsupported" | "error";
  candidates?: unknown[];
  /** P-4-DATA-4에서 이미 있던 구분 — 429는 일반 오류와 셀러 문구가 다르다. */
  errorKind?: "RATE_LIMITED" | "TEMPORARY_ERROR";
}

export function deriveSearchSourceStatus(result: SearchSourceStatusInput): SearchSourceStatus {
  if (result.status === "unsupported") return "MANUAL_REQUIRED";
  if (result.status === "error") return "SEARCH_FAILED";
  if (result.status === "ok") {
    // candidates가 배열이 아니면(malformed 응답) 0건이라고 단정하지 않는다.
    if (!Array.isArray(result.candidates)) return "UNKNOWN";
    return result.candidates.length > 0 ? "AUTO_SUPPORTED" : "NO_RESULT";
  }
  return "UNKNOWN";
}

export function searchSourceStatusDisplay(result: SearchSourceStatusInput): SearchSourceStatusDisplay {
  const status = deriveSearchSourceStatus(result);
  switch (status) {
    case "MANUAL_REQUIRED":
      return { status, note: "수동 확인 필요 — 이 사이트는 자동 검색을 지원하지 않습니다" };
    case "SEARCH_FAILED":
      // MI-UX-9 §15 — 기술적 에러 원문(result.error)은 여기에 넣지 않는다.
      // 이전 국내 표는 `검색 실패: ${r.error}`로 서버 예외 메시지를 그대로
      // 셀러에게 보여줬다. 원인 문자열은 진단용으로 응답에 남아 있고, 화면은
      // 셀러가 할 수 있는 행동만 말한다.
      return {
        status,
        note:
          result.errorKind === "RATE_LIMITED"
            ? "검색 실패 — 요청이 많아 확인하지 못했습니다. 잠시 후 다시 시도하세요"
            : "검색 실패 — 잠시 후 다시 시도하세요",
      };
    case "NO_RESULT":
      return { status, note: "검색 결과 없음" };
    case "UNKNOWN":
      return { status, note: "확인 불가" };
    case "AUTO_SUPPORTED":
      return { status, note: "" };
  }
}
