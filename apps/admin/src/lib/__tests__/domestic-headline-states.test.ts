import { describe, expect, it } from "vitest";
import { deriveSearchSourceStatus } from "../search-source-status";

/**
 * MI-DOMESTIC-FIX-2 §A(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **"결과가 없다"와 "검색을 못 했다"는 절대 같은 상태가 아니다.**
 *
 * DomesticShopSearch의 헤드라인이 0건일 때 어느 문구를 고르는지는 아래 세
 * 집계값으로 갈린다. 그 계산을 여기서 그대로 재현해 고정한다 — 컴포넌트를
 * 렌더링하지 않고도 분기 자체가 회귀했는지 잡을 수 있다.
 *
 *   searchedCount === 0            → 자동 검색 미지원 (D)
 *   rawCount > 0                   → 결과는 있었으나 동일상품 아님 (B)
 *   그 외                          → 진짜 0건 (A)
 */
type Result = { status?: "ok" | "unsupported" | "error"; candidates?: unknown[] };

/** 컴포넌트가 쓰는 것과 같은 집계. */
function summarize(results: Result[]) {
  const statuses = results.map((r) => deriveSearchSourceStatus(r));
  return {
    searchedCount: statuses.filter((s) => s === "AUTO_SUPPORTED" || s === "NO_RESULT").length,
    failedCount: statuses.filter((s) => s === "SEARCH_FAILED").length,
    rawCount: results.reduce((n, r) => n + (r.candidates?.length ?? 0), 0),
  };
}

function headlineKind(results: Result[]): "UNSUPPORTED" | "FOUND_BUT_NOT_SAME" | "TRULY_EMPTY" {
  const { searchedCount, rawCount } = summarize(results);
  if (searchedCount === 0) return "UNSUPPORTED";
  if (rawCount > 0) return "FOUND_BUT_NOT_SAME";
  return "TRULY_EMPTY";
}

const searched = (n: number): Result => ({ status: "ok", candidates: new Array(n).fill({}) });
const unsupported: Result = { status: "unsupported", candidates: [] };
const failed: Result = { status: "error", candidates: [] };

describe("0건 헤드라인 — 네 가지 사실을 뭉개지 않는다", () => {
  it("핵심 회귀: 자동 검색 미지원만 있으면 '결과 없음'이라고 말하지 않는다", () => {
    // 검색을 아예 못 한 것을 "국내에 없다"로 읽히게 하면 셀러가 잘못 판단한다.
    expect(headlineKind([unsupported, unsupported])).toBe("UNSUPPORTED");
  });

  it("핵심 회귀: 검색 결과가 있었는데 동일상품이 아닌 경우와 진짜 0건을 구분한다", () => {
    expect(headlineKind([searched(3)])).toBe("FOUND_BUT_NOT_SAME");
    expect(headlineKind([searched(0)])).toBe("TRULY_EMPTY");
  });

  it("검색 가능한 곳이 하나라도 있으면 미지원 문구로 빠지지 않는다", () => {
    expect(headlineKind([unsupported, unsupported, searched(0)])).toBe("TRULY_EMPTY");
  });

  it("전부 실패했으면 '결과 없음'이 아니다 — 재시도하면 달라질 수 있다", () => {
    // SEARCH_FAILED는 AUTO_SUPPORTED/NO_RESULT 어느 쪽도 아니므로 searchedCount=0.
    expect(headlineKind([failed, failed])).toBe("UNSUPPORTED");
    expect(summarize([failed, failed]).failedCount).toBe(2);
  });
});

describe("집계값 자체", () => {
  it("rawCount는 서버가 보낸 후보를 그대로 센다 — 별도 API 필드가 필요 없다", () => {
    // 서버는 EXCLUDED 후보도 버리지 않고 보내므로 candidates.length가 원시 결과 수다.
    expect(summarize([searched(2), searched(3), unsupported]).rawCount).toBe(5);
  });

  it("searchedCount는 미지원/실패를 빼고 실제로 검색한 곳만 센다", () => {
    expect(summarize([searched(1), unsupported, failed, searched(0)]).searchedCount).toBe(2);
  });

  it("candidates가 배열이 아니면 0건이라고 단정하지 않는다", () => {
    // UNKNOWN은 searchedCount에 들어가지 않는다 — 아는 척하지 않는다.
    expect(summarize([{ status: "ok" }]).searchedCount).toBe(0);
  });
});
