/**
 * P-13C-2 NEXT Sprint 6(CPO 지시, 2026-09-01) — saveSnapshotToServer()의 동시성
 * 판단(P0-2 재발 방지 + Sprint 5-A stale response 방지)을 page.tsx의 ref 기반
 * 클로저에서 분리한 순수 함수. jsdom 없이도 이 판단 로직 자체를 테스트할 수
 * 있게 한다 — page.tsx는 이 함수들을 호출하기만 한다(동작을 바꾸지 않는 리팩터).
 */

export type SnapshotSaveAction = { kind: "insert" } | { kind: "queue-retry" } | { kind: "update" };

/**
 * "이번 호출이 최초 insert를 시도해야 하는가, 이미 진행 중인 insert 뒤에
 * 줄을 서야 하는가, 아니면 그냥 update로 진행하면 되는가"를 결정한다.
 * insertInFlight는 creatingSnapshotRef.current, isFirstInsert는
 * snapshotIdRef.current === null 이다.
 */
export function resolveSnapshotSaveAction(isFirstInsert: boolean, insertInFlight: boolean): SnapshotSaveAction {
  if (!isFirstInsert) return { kind: "update" };
  if (insertInFlight) return { kind: "queue-retry" };
  return { kind: "insert" };
}

/**
 * 이 요청을 쏜 시점의 세대(startGeneration)와 지금 세대(currentGeneration)가
 * 다르면, 그 사이 resetWorkspace()가 실행돼(사용자가 "새 상품 분석") 이
 * 응답은 이제 화면에 없는 이전 상품의 것이다 — 완전히 무시해야 한다.
 */
export function isStaleSnapshotResponse(startGeneration: number, currentGeneration: number): boolean {
  return startGeneration !== currentGeneration;
}

/**
 * P-18 Sprint 8(CPO 지시, 2026-09-01) — DomesticPriceIntelligencePanel이
 * autoChecking prop의 true→false 전환(=page.tsx가 쏜 자동 가격 확인이 방금
 * 끝남)에서만 데이터를 다시 읽어야 한다는 판단을 컴포넌트 밖으로 뽑았다.
 * wasAutoChecking은 직전 렌더의 값, isAutoChecking은 이번 렌더의 값이다.
 * 리렌더(false→false)나 탭 재진입(마운트 시 이미 false)에서는 refetch하지
 * 않는다 — 오직 "실제로 진행 중이었다가 끝난" 경우만 true를 반환한다.
 */
export function shouldRefetchAfterAutoCheck(wasAutoChecking: boolean, isAutoChecking: boolean): boolean {
  return wasAutoChecking && !isAutoChecking;
}
