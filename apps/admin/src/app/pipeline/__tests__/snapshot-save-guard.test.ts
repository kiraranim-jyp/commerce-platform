import { describe, expect, it } from "vitest";
import { isStaleSnapshotResponse, resolveSnapshotSaveAction, shouldRefetchAfterAutoCheck } from "../snapshot-save-guard";

/**
 * P-13C-2 NEXT Sprint 6(CPO 지시, 2026-09-01) — page.tsx의 saveSnapshotToServer()
 * 동시성 판단을 그대로 검증한다. CPO가 지정한 T-1~T-6 중 T-2~T-5(캐시
 * hydrate/priming/fetch 판단)는 이미 category-cache-hydrate.test.ts의 D-1~D-9가
 * 다룬다 — 여기서는 이번에 새로 추가된 snapshot insert 동시성(T-1)과 세대
 * 기반 stale response 판단(T-6)만 다룬다.
 */
describe("resolveSnapshotSaveAction", () => {
  it("T-1: 최초 insert이고 다른 insert가 진행 중이 아니면 — insert 진행", () => {
    expect(resolveSnapshotSaveAction(true, false)).toEqual({ kind: "insert" });
  });

  it("T-1: 최초 insert인데 다른 insert가 이미 진행 중이면 — queue-retry(중복 insert 금지)", () => {
    expect(resolveSnapshotSaveAction(true, true)).toEqual({ kind: "queue-retry" });
  });

  it("snapshotId가 이미 있으면(최초 insert 아님) — insertInFlight와 무관하게 항상 update", () => {
    expect(resolveSnapshotSaveAction(false, false)).toEqual({ kind: "update" });
    expect(resolveSnapshotSaveAction(false, true)).toEqual({ kind: "update" });
  });
});

describe("isStaleSnapshotResponse", () => {
  it("세대가 같으면(reset 없었음) — stale 아님, 정상 처리", () => {
    expect(isStaleSnapshotResponse(0, 0)).toBe(false);
    expect(isStaleSnapshotResponse(3, 3)).toBe(false);
  });

  it("T-6: 세대가 다르면(응답 대기 중 resetWorkspace로 새 상품 분석 시작) — stale, 무시해야 함", () => {
    // 상품 A의 save가 시작된 시점 generation=0으로 캡처.
    // 그 사이 사용자가 "새 상품 분석"을 눌러 세대가 1로 올라갔다(상품 B).
    // A의 응답이 이제 도착해도 stale로 판정되어 B의 상태를 건드리면 안 된다.
    expect(isStaleSnapshotResponse(0, 1)).toBe(true);
  });

  it("여러 번 reset된 뒤에도(세대가 여러 번 올라가도) 정확히 비교한다", () => {
    expect(isStaleSnapshotResponse(0, 5)).toBe(true);
    expect(isStaleSnapshotResponse(5, 5)).toBe(false);
  });
});

/**
 * P-18 Sprint 8(CPO 지시, 2026-09-01) — DomesticPriceIntelligencePanel이
 * autoChecking prop 전환을 보고 refetch 여부를 결정하는 순수 함수 검증.
 * Sprint 2의 재호출 금지 케이스(B: 탭 진입, C: 리렌더)를 커버한다.
 */
describe("shouldRefetchAfterAutoCheck", () => {
  it("false→false(리렌더, Case C) — 진행 중이었던 적이 없으므로 refetch 안 함", () => {
    expect(shouldRefetchAfterAutoCheck(false, false)).toBe(false);
  });

  it("false→false(탭 재진입, Case B — 마운트 시 이미 완료 상태) — refetch 안 함", () => {
    expect(shouldRefetchAfterAutoCheck(false, false)).toBe(false);
  });

  it("true→false(자동 확인이 방금 끝남) — 딱 이 전환에서만 refetch", () => {
    expect(shouldRefetchAfterAutoCheck(true, false)).toBe(true);
  });

  it("true→true(아직 확인 진행 중) — refetch 안 함(중간에 끼어들지 않음)", () => {
    expect(shouldRefetchAfterAutoCheck(true, true)).toBe(false);
  });

  it("false→true(방금 확인이 시작됨) — 완료 전환이 아니므로 refetch 안 함", () => {
    expect(shouldRefetchAfterAutoCheck(false, true)).toBe(false);
  });
});
