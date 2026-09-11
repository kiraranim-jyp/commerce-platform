import { describe, expect, it } from "vitest";
import { emptyStateForAxis, miEmptyState, type MiEmptyKind } from "../mi-empty-state";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 빈 상태 세 가지가 서로 다른 문구여야 하고,
 * 그 문구에 내부 상태명이 새지 않아야 한다.
 *
 * 왜 테스트로 고정하나: 이 프로젝트에서 "확인 불가"는 이미 여러 번 "나쁨"으로
 * 읽혔고(☆☆☆☆☆ 금지, ⚪ 별도 도트 등 그때마다 대책이 붙었다), 반대로 정확하게
 * 쓰려다 NO_DATA/UNAVAILABLE/CASE D/EXACT 같은 내부 이름이 화면에 새어나온
 * 사례도 실제로 있었다. 두 실패 모드를 한 파일에서 막는다.
 */
describe("miEmptyState()", () => {
  it("세 상태가 서로 다른 문구를 쓴다", () => {
    const kinds: MiEmptyKind[] = ["NO_SEARCH_DATA", "UNVERIFIABLE", "UNJUDGEABLE"];
    const chips = kinds.map((k) => miEmptyState(k).chip);
    expect(new Set(chips).size).toBe(3);
    expect(miEmptyState("NO_SEARCH_DATA").chip).toBe("⚪ 검색 데이터 없음");
    expect(miEmptyState("UNVERIFIABLE").chip).toBe("⚪ 확인 불가");
    expect(miEmptyState("UNJUDGEABLE").chip).toBe("⚪ 판단 불가");
  });

  it("칩 문구에 내부 상태명이 들어가지 않는다", () => {
    const kinds: MiEmptyKind[] = ["NO_SEARCH_DATA", "UNVERIFIABLE", "UNJUDGEABLE"];
    for (const kind of kinds) {
      const chip = miEmptyState(kind).chip;
      for (const internal of ["NO_DATA", "UNAVAILABLE", "SCORED", "EXACT", "CASE", "COMPARISON"]) {
        expect(chip).not.toContain(internal);
      }
    }
  });
});

describe("emptyStateForAxis()", () => {
  it("등급이 있는 축은 빈 상태가 아니다", () => {
    expect(emptyStateForAxis({ status: "SCORED", level: "LOW" })).toBeNull();
  });

  it("정상 조회 후 결과 없음과 확인 실패를 다르게 말한다", () => {
    const noData = emptyStateForAxis({ status: "NO_DATA", reason: "검색 데이터가 없습니다" });
    const unavailable = emptyStateForAxis({
      status: "UNAVAILABLE",
      reason: "국내 동일상품 가격을 확인하지 못했습니다",
    });
    expect(noData?.kind).toBe("NO_SEARCH_DATA");
    expect(unavailable?.kind).toBe("UNVERIFIABLE");
    expect(noData?.chip).not.toBe(unavailable?.chip);
  });

  it("확인 불가는 무엇을 확인 못 했는지 사유를 반드시 함께 보여준다", () => {
    const s = emptyStateForAxis({ status: "UNAVAILABLE", reason: "원본 상품 가격을 확인하지 못했습니다" });
    expect(s?.reason).toBe("원본 상품 가격을 확인하지 못했습니다");
  });

  it("검색 데이터 없음은 칩과 같은 말을 두 번 하지 않는다", () => {
    const s = emptyStateForAxis({ status: "NO_DATA", reason: "검색 데이터가 없습니다" });
    expect(s?.reason).toBeNull();
  });
});
