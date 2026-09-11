import { describe, expect, it } from "vitest";
import { STAGE_ORDER, resolveStageProgress } from "../stage-progress";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 4단계 진행 규칙.
 *
 * ── 이 파일이 지키는 가장 중요한 것 ─────────────────────────────────────
 * 카테고리다. 이번 개편에서 "카테고리 확인"은 헤드라인 단계 자리를 잃고
 * ③ 등록 준비 안의 한 항목으로 내려갔는데, 그걸 "카테고리는 이제 필요 없다"로
 * 오해하면 안 된다. 카테고리는 실제 등록 payload에 들어가는 값이고
 * (smartstore leafCategoryId / coupang displayCategoryCode), 확정되지 않은
 * 채로 register API를 부르면 서버가 CP001로 거부한다. 그래서 카테고리가
 * 비어 있으면 ④ 커머스 등록은 여전히 잠겨야 한다 — 아래 테스트가 그 게이트다.
 */
describe("resolveStageProgress()", () => {
  const ALL_DONE = { imagesDone: true, categoryDone: true, contentDone: true, verdictKnown: true };

  it("4단계 순서는 상품 수집 → 시장 판단 → 등록 준비 → 커머스 등록", () => {
    expect(STAGE_ORDER).toEqual(["collect", "market", "prepare", "register"]);
  });

  it("카테고리가 비면 등록 준비가 끝나지 않고 커머스 등록이 잠긴다", () => {
    const p = resolveStageProgress({ ...ALL_DONE, categoryDone: false });
    expect(p.pendingPrepareItems).toContain("category");
    expect(p.statuses.prepare).toBe("NEEDS_ACTION");
    expect(p.statuses.register).toBe("LOCKED");
  });

  it("카테고리를 포함해 준비 항목이 전부 끝나야 커머스 등록이 열린다", () => {
    const p = resolveStageProgress(ALL_DONE);
    expect(p.pendingPrepareItems).toEqual([]);
    expect(p.statuses.prepare).toBe("COMPLETED");
    expect(p.statuses.register).toBe("NEEDS_ACTION");
  });

  it("판단이 아직 안 나온 상태를 '문제 있음'으로 표시하지 않는다", () => {
    // 분석 중인 것과 확인이 필요한 것은 다르다 — 경고(NEEDS_ACTION)가 아니다.
    const p = resolveStageProgress({ ...ALL_DONE, verdictKnown: false });
    expect(p.statuses.market).toBe("IN_PROGRESS");
    expect(p.currentStage).toBe("market");
  });

  it("현재 단계는 아직 끝나지 않은 첫 단계다", () => {
    expect(resolveStageProgress({ ...ALL_DONE, imagesDone: false }).currentStage).toBe("prepare");
    expect(resolveStageProgress(ALL_DONE).currentStage).toBe("register");
  });

  it("상품 수집은 이 화면에 도달한 시점에 이미 끝나 있다", () => {
    expect(resolveStageProgress({ ...ALL_DONE, verdictKnown: false }).statuses.collect).toBe("COMPLETED");
  });
});
