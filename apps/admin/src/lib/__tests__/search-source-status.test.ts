import { describe, expect, it } from "vitest";
import { deriveSearchSourceStatus, searchSourceStatusDisplay } from "../search-source-status";

/** MI-UX-9(CPO 지시, 2026-09-07 §10) — "결과가 없다는 이유만으로 `수동 확인 필요`
 * 라고 판단하지 않는다"를 코드 레벨로 고정한다. 국내/해외 표가 둘 다 이 함수를
 * 거치므로, 여기 테스트가 통과하면 두 화면 모두 같은 규칙을 따른다. */

describe("MI-UX-9 §10 — 자동검색 미지원과 결과 없음을 구분한다", () => {
  it("자동 검색을 지원하지 않는 사이트(unsupported) → MANUAL_REQUIRED", () => {
    expect(deriveSearchSourceStatus({ status: "unsupported", candidates: [] })).toBe("MANUAL_REQUIRED");
  });

  it("자동 검색은 했지만 결과가 0건 → NO_RESULT (수동 확인 필요가 아니다)", () => {
    expect(deriveSearchSourceStatus({ status: "ok", candidates: [] })).toBe("NO_RESULT");
  });

  it("핵심 회귀: 후보 0건이라는 사실만으로 MANUAL_REQUIRED가 되지 않는다", () => {
    // 두 상태 모두 candidates가 비어 있지만 셀러가 해야 할 행동이 다르다.
    const unsupported = deriveSearchSourceStatus({ status: "unsupported", candidates: [] });
    const noResult = deriveSearchSourceStatus({ status: "ok", candidates: [] });
    expect(unsupported).not.toBe(noResult);
  });

  it("자동 검색 지원 + 이번 검색 실패 → SEARCH_FAILED", () => {
    expect(deriveSearchSourceStatus({ status: "error", candidates: [] })).toBe("SEARCH_FAILED");
  });

  it("검색 성공 + 후보 있음 → AUTO_SUPPORTED", () => {
    expect(deriveSearchSourceStatus({ status: "ok", candidates: [{}] })).toBe("AUTO_SUPPORTED");
  });

  it("status가 없는 구버전/변형 응답 → UNKNOWN (임의로 단정하지 않는다)", () => {
    expect(deriveSearchSourceStatus({})).toBe("UNKNOWN");
  });

  it("§14 — status=ok인데 candidates가 배열이 아니면 0건이라고 단정하지 않고 UNKNOWN", () => {
    expect(deriveSearchSourceStatus({ status: "ok", candidates: undefined })).toBe("UNKNOWN");
  });
});

describe("MI-UX-9 §15 — 기술적 에러 원문을 셀러 문구에 넣지 않는다", () => {
  it("검색 실패 문구에 서버 예외 메시지가 섞이지 않는다", () => {
    // 회귀 대상: DomesticShopSearch가 `검색 실패: ${r.error}`로 예외 원문을
    // 그대로 노출하던 코드. 이제 note는 입력 error 문자열을 아예 받지 않는다.
    const { note } = searchSourceStatusDisplay({ status: "error", candidates: [] });
    expect(note).not.toMatch(/TypeError|undefined|at \w+/);
    expect(note).toContain("검색 실패");
  });

  it("429(RATE_LIMITED)는 일반 오류와 다른 문구를 준다", () => {
    const limited = searchSourceStatusDisplay({ status: "error", candidates: [], errorKind: "RATE_LIMITED" }).note;
    const generic = searchSourceStatusDisplay({ status: "error", candidates: [], errorKind: "TEMPORARY_ERROR" }).note;
    expect(limited).not.toBe(generic);
    expect(limited).toContain("요청이 많아");
  });

  it("미지원 사이트 문구는 '수동 확인 필요'라고 분명히 말한다", () => {
    expect(searchSourceStatusDisplay({ status: "unsupported", candidates: [] }).note).toContain("수동 확인 필요");
  });

  it("결과 없음 문구는 '수동 확인'이라고 말하지 않는다", () => {
    const { note } = searchSourceStatusDisplay({ status: "ok", candidates: [] });
    expect(note).toContain("검색 결과 없음");
    expect(note).not.toContain("수동 확인");
  });
});

/**
 * GOLF-01.5 축 C(CEO 지시, 2026-09-16) — «키가 없다»는 네 번째 사실이다.
 *
 * 🔴 이 저장소가 반복해서 고쳐 온 실패가 정확히 "서로 다른 사실을 한 문구로
 *    말하는 것"이다. 여기서 네 상태가 실제로 서로 다른 값·다른 문구로
 *    갈라지는지를 실행으로 고정한다.
 */
describe("GOLF-01.5-C — 키 없음(NOT_CONFIGURED)은 네 번째 사실이다", () => {
  const notConfigured = { status: "not_configured" as const, candidates: [] };
  const unsupported = { status: "unsupported" as const, candidates: [] };
  const noResult = { status: "ok" as const, candidates: [] };
  const failed = { status: "error" as const, candidates: [] };

  it("🔴 네 상태가 전부 서로 다른 값이다", () => {
    const values = [notConfigured, unsupported, noResult, failed].map(deriveSearchSourceStatus);
    expect(values).toEqual(["NOT_CONFIGURED", "MANUAL_REQUIRED", "NO_RESULT", "SEARCH_FAILED"]);
    expect(new Set(values).size, "두 사실이 같은 값으로 뭉개졌다").toBe(4);
  });

  it("🔴 셀러에게 «직접 확인하라»고 말하지 않는다 — 셀러가 풀 수 없는 상태다", () => {
    const note = searchSourceStatusDisplay(notConfigured).note;
    expect(note).toContain("연동 대기");
    expect(note).toContain("API 키");
    expect(note, "셀러가 할 수 없는 일을 시킨다").not.toContain("수동 확인");
    expect(note, "물어보지도 않고 결과가 없다고 말한다").not.toContain("검색 결과 없음");
  });

  it("🔴 네 문구가 전부 다르다", () => {
    const notes = [notConfigured, unsupported, noResult, failed].map((r) => searchSourceStatusDisplay(r).note);
    expect(new Set(notes).size, "두 상태가 같은 문구를 쓴다").toBe(4);
  });
});
