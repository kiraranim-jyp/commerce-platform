import { describe, expect, it } from "vitest";
import { resolveCategoryCacheAction } from "../category-cache-hydrate";

/**
 * P-13C-2 STEP3-B-UI 야간 버그수정(2026-09-01) STEP D — CPO가 지정한 6개
 * 회귀 케이스. 이 중 D-3(READY+REJECT+candidates:[])이 CPO가 최우선으로
 * 의심한 "캐시 없음으로 오판하는지"를 직접 검증한다. 실측 결과 이 판단
 * 로직 자체는 처음부터 맞았고(별도 조사로 확인 — 실제 버그는 page.tsx가
 * 서버 응답을 버려서 캐시가 애초에 client state에 도달하지 못한 것),
 * 그래도 회귀 방지를 위해 6개 케이스를 전부 고정한다.
 */
describe("resolveCategoryCacheAction", () => {
  it("D-1: READY + AUTO_SELECT — candidates를 그대로 hydrate하고 재조회하지 않는다", () => {
    const action = resolveCategoryCacheAction({
      sourceUrlKey: "k",
      status: "READY",
      candidates: [{ categoryCode: 100, categoryName: "티셔츠", score: 98 }],
      resolverDecision: "AUTO_SELECT",
      similarityScore: 98,
      evidence: [],
      resolvedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(action.kind).toBe("hydrate");
    if (action.kind !== "hydrate") throw new Error("unreachable");
    expect(action.candidates).toHaveLength(1);
    expect(action.candidates[0]?.id).toBe("100");
    expect(action.resolverDecision).toEqual({ decision: "AUTO_SELECT", score: 98 });
  });

  it("D-2: READY + RECOMMEND — candidates를 hydrate한다", () => {
    const action = resolveCategoryCacheAction({
      sourceUrlKey: "k",
      status: "READY",
      candidates: [
        { categoryCode: 200, categoryName: "원피스", score: 80 },
        { categoryCode: 201, categoryName: "치마", score: 55 },
      ],
      resolverDecision: "RECOMMEND",
      similarityScore: 80,
      evidence: ["title match"],
      resolvedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(action.kind).toBe("hydrate");
    if (action.kind !== "hydrate") throw new Error("unreachable");
    expect(action.candidates).toHaveLength(2);
    expect(action.resolverDecision).toEqual({ decision: "RECOMMEND", score: 80 });
  });

  it("D-3(★최우선): READY + REJECT + candidates:[] — 캐시 없음으로 오판하지 않고 hydrate로 처리해 재조회를 막는다", () => {
    const action = resolveCategoryCacheAction({
      sourceUrlKey: "k",
      status: "READY",
      candidates: [],
      resolverDecision: "REJECT",
      similarityScore: null,
      evidence: [],
      resolvedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(action.kind).toBe("hydrate");
    if (action.kind !== "hydrate") throw new Error("unreachable");
    expect(action.candidates).toEqual([]);
    expect(action.resolverDecision).toEqual({ decision: "REJECT", score: 0 });
  });

  it("D-4: 캐시 없음(undefined) — fetch로 실제 API를 호출해야 한다", () => {
    const action = resolveCategoryCacheAction(undefined);
    expect(action.kind).toBe("fetch");
  });

  it("D-5: FAILED — 자동 재시도(fetch)로 빠지지 않고 실패로 처리한다", () => {
    const action = resolveCategoryCacheAction({
      sourceUrlKey: "k",
      status: "FAILED",
      failureReason: "쿠팡 서버 오류",
      resolvedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(action.kind).toBe("failed");
    if (action.kind !== "failed") throw new Error("unreachable");
    expect(action.traceLine).toContain("쿠팡 서버 오류");
  });

  it("D-6: PENDING — 동시 호출 방지를 위해 자동 재호출(fetch)하지 않는다", () => {
    const action = resolveCategoryCacheAction({ sourceUrlKey: "k", status: "PENDING" });
    expect(action.kind).toBe("pending");
  });
});
