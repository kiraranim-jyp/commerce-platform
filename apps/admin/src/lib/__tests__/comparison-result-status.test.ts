import { describe, expect, it } from "vitest";
import {
  deriveComparisonResultState,
  getComparisonResultHeadline,
  type ComparisonResultShopInput,
} from "../comparison-result-status";

/** P-4-DATA-8(CPO 지시, 2026-08-29) — F4(P-4-DATA-2에서 발견: 429로 검색이
 * 막힌 상황이 "찾지 못했습니다"와 구분 없이 보였던 사고) 재발 방지를 위한
 * ST-01~06 고정. 핵심 원칙: 검색 상태(이 파일)와 가격 상태(price-truth.ts)는
 * 절대 하나의 enum으로 합치지 않는다 — 이 테스트는 오직 "판매처 검색이 셀러에게
 * 어떻게 보여야 하는가"만 검증한다. */

function shop(overrides: Partial<ComparisonResultShopInput>): ComparisonResultShopInput {
  return { status: "ok", candidates: [], ...overrides };
}

describe("ST-01 — 모든 판매처 성공 + 후보 0건 → NO_RESULTS", () => {
  it("검색은 전부 성공했고 실제로 일치하는 상품이 없었다는 뜻이므로 NO_RESULTS", () => {
    const results = [shop({ status: "ok", candidates: [] }), shop({ status: "ok", candidates: [] })];
    expect(deriveComparisonResultState(results)).toBe("NO_RESULTS");
  });

  it("셀러 문구는 '찾지 못했습니다'가 아니라 CPO 지정 문구를 그대로 쓴다", () => {
    const { message } = getComparisonResultHeadline("NO_RESULTS", 0);
    expect(message).toContain("현재 검색 가능한 판매처에서는 일치하는 상품이 확인되지 않았습니다.");
  });
});

describe("ST-02 — 1개 이상 후보 존재 → RESULTS_FOUND", () => {
  it("다른 판매처가 전부 에러여도(429 포함) 이미 찾은 후보가 있으면 RESULTS_FOUND가 우선한다", () => {
    const results = [
      shop({ status: "ok", candidates: [{ matchLevel: "very_high" }] }),
      shop({ status: "error", errorKind: "RATE_LIMITED", candidates: [] }),
    ];
    expect(deriveComparisonResultState(results)).toBe("RESULTS_FOUND");
  });

  it("matchLevel='low'만 있는 후보는 카운트에서 제외된다(N-4.21 70% 경계 원칙 유지)", () => {
    const results = [shop({ status: "ok", candidates: [{ matchLevel: "low" }] })];
    expect(deriveComparisonResultState(results)).toBe("NO_RESULTS");
  });
});

describe("ST-03 — 일부 판매처만 RATE_LIMITED → PARTIAL_FAILURE(NO_RESULTS 금지)", () => {
  it("2곳 중 1곳만 429면 전체 제한이 아니라 부분 실패로 구분한다", () => {
    const results = [
      shop({ status: "ok", candidates: [] }),
      shop({ status: "error", errorKind: "RATE_LIMITED", candidates: [] }),
    ];
    const state = deriveComparisonResultState(results);
    expect(state).not.toBe("NO_RESULTS");
    expect(state).toBe("PARTIAL_FAILURE");
  });
});

describe("ST-04 — 모든 대상 판매처 RATE_LIMITED → RATE_LIMITED", () => {
  it("'일부'가 아니라 검색 자체가 전체적으로 막혔다는 사실을 명확히 구분한다", () => {
    const results = [
      shop({ status: "error", errorKind: "RATE_LIMITED", candidates: [] }),
      shop({ status: "error", errorKind: "RATE_LIMITED", candidates: [] }),
    ];
    expect(deriveComparisonResultState(results)).toBe("RATE_LIMITED");
  });

  it("unsupported(파서 없음) 사이트는 '검색 대상'에서 제외하고 판단한다", () => {
    const results = [
      shop({ status: "unsupported", candidates: [] }),
      shop({ status: "error", errorKind: "RATE_LIMITED", candidates: [] }),
    ];
    expect(deriveComparisonResultState(results)).toBe("RATE_LIMITED");
  });

  it("셀러 문구는 RATE_LIMITED라는 내부 상태명 대신 '요청이 많아' 문구를 쓴다", () => {
    const { message } = getComparisonResultHeadline("RATE_LIMITED", 0);
    expect(message).not.toContain("RATE_LIMITED");
    expect(message).toContain("잠시 후 다시 시도");
  });
});

describe("ST-05 — 네트워크/API ERROR(전부) → ERROR, NO_RESULTS 문구 금지", () => {
  it("전부 TEMPORARY_ERROR(429 아님)면 RATE_LIMITED가 아니라 ERROR로 구분한다", () => {
    const results = [
      shop({ status: "error", errorKind: "TEMPORARY_ERROR", candidates: [] }),
      shop({ status: "error", errorKind: "TEMPORARY_ERROR", candidates: [] }),
    ];
    expect(deriveComparisonResultState(results)).toBe("ERROR");
  });

  it("RATE_LIMITED와 TEMPORARY_ERROR가 섞여 전부 에러면(전부 429는 아님) ERROR로 처리한다", () => {
    const results = [
      shop({ status: "error", errorKind: "RATE_LIMITED", candidates: [] }),
      shop({ status: "error", errorKind: "TEMPORARY_ERROR", candidates: [] }),
    ];
    expect(deriveComparisonResultState(results)).toBe("ERROR");
  });

  it("ERROR 상태 문구는 '찾지 못했습니다'/NO_RESULTS 계열 문구를 쓰지 않는다", () => {
    const { message } = getComparisonResultHeadline("ERROR", 0);
    expect(message).not.toContain("확인되지 않았습니다");
    expect(message).toContain("오류");
  });
});

describe("ST-06 — 일부 SUCCESS + 일부 ERROR(후보 없음) → PARTIAL_FAILURE", () => {
  it("성공한 판매처 기준으로도 일치 후보가 없다는 사실과 일부 미확인 사실을 둘 다 전달한다", () => {
    const results = [
      shop({ status: "ok", candidates: [] }),
      shop({ status: "error", errorKind: "TEMPORARY_ERROR", candidates: [] }),
    ];
    expect(deriveComparisonResultState(results)).toBe("PARTIAL_FAILURE");
    const { message } = getComparisonResultHeadline("PARTIAL_FAILURE", 0);
    expect(message).toContain("일부 판매처를 확인하지 못했습니다");
  });
});

describe("가격 상태와 검색 상태 분리 원칙(CPO 지시, 절대 유지)", () => {
  it("검색 SUCCESS + 후보 존재 상태는 그 후보의 가격 검증 여부와 무관하게 RESULTS_FOUND다", () => {
    // 이 파일은 candidate.priceStatus를 전혀 보지 않는다 — matchLevel(매칭 여부)만
    // 본다. 가격이 PRICE_UNAVAILABLE이어도 검색 결과 자체는 RESULTS_FOUND가 맞다.
    const results = [shop({ status: "ok", candidates: [{ matchLevel: "very_high" }] })];
    expect(deriveComparisonResultState(results)).toBe("RESULTS_FOUND");
  });
});
