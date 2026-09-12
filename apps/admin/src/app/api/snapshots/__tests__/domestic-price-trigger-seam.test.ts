import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DOMESTIC-PRICE-TRIGGER-1(CEO 지시, 2026-09-12) — "분석 직후 1회".
 *
 * 이 파일이 고정하는 것은 **이음새(seam) 하나**다: 국내 가격 조사가 붙는 자리가
 * "새 분석의 첫 스냅샷 저장"이고, 그 자리는 분석 한 번에 정확히 한 번만 지나간다.
 *
 * 왜 여기인가 — pipeline/page.tsx는 분석이 끝나면 id 없이 POST /api/snapshots를
 * 한 번 보내고(그 응답이 snapshotId를 채운다), 이후의 모든 편집 저장은 그 id를
 * 실어 보낸다. 즉 "id가 없다"는 사실 자체가 "이번이 새 분석"과 동치다 —
 * saveSnapshot()의 insert/update 분기와 같은 기준이라, 한 번만 돌게 하려고
 * 새 플래그나 상태를 만들 필요가 없다. 그리고 이 자리에는 국내 조사가 요구하는
 * 두 값(workspaceId는 세션에서, snapshotId는 방금 만든 행에서)이 둘 다 있다.
 *
 * 없앤 일 1회 배치(51758aa)를 되살리지 않는다는 점도 여기서 같이 지켜진다 —
 * 이 트리거는 방금 만들어진 스냅샷 하나만 건드리고, 기존 스냅샷을 훑지 않는다.
 */

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const NEW_SNAPSHOT_ID = "0767b19b-0000-0000-0000-000000000001";

const hoisted = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
  triggerCalls: [] as Array<{ snapshotId: string; workspaceId: string; canonicalProduct: unknown }>,
  triggerImpl: vi.fn(async () => null as unknown),
  saveSnapshotImpl: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    // 실제 after()는 응답이 나간 뒤에 콜백을 돌린다. 테스트에서는 "언제
    // 돌았는지"를 직접 보기 위해 캡처만 하고, 필요할 때 수동으로 실행한다 —
    // 응답을 기다리게 만들지 않는다는 성질을 그대로 관찰할 수 있다.
    after: (fn: () => unknown) => {
      hoisted.afterCallbacks.push(fn);
    },
  };
});

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: async () => ({ ok: true, user: { id: "user-1", workspaceId: WORKSPACE_ID } }),
}));

vi.mock("../_lib/snapshot", () => ({
  listRecentSnapshots: async () => [],
  saveSnapshot: hoisted.saveSnapshotImpl,
}));

vi.mock("../_lib/attempts-summary", () => ({
  getAttemptsSummaryBySnapshot: async () => ({}),
}));

vi.mock("../../price-history/_lib/trigger-domestic-price-check", () => ({
  runDomesticPriceCheckForNewSnapshot: (input: { snapshotId: string; workspaceId: string; canonicalProduct: unknown }) => {
    hoisted.triggerCalls.push(input);
    return hoisted.triggerImpl();
  },
}));

function workspaceState() {
  return {
    url: "https://example.com/products/test-item",
    pipelineResponse: { metadata: {}, report: {}, storageNote: "" },
    canonicalProduct: { sourceUrl: "https://example.com/products/test-item", title: { value: "Test Item" } },
    items: [],
    thumbnails: {},
    representativeId: null,
    activeTab: "source",
    developerMode: false,
    platformSettings: {},
  };
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function runAfterCallbacks() {
  for (const fn of hoisted.afterCallbacks) await fn();
}

beforeEach(() => {
  hoisted.afterCallbacks.length = 0;
  hoisted.triggerCalls.length = 0;
  hoisted.triggerImpl.mockReset();
  hoisted.triggerImpl.mockResolvedValue(null);
  hoisted.saveSnapshotImpl.mockReset();
  hoisted.saveSnapshotImpl.mockImplementation(async (input: { id?: string }) => ({
    ok: true as const,
    snapshot: { id: input.id ?? NEW_SNAPSHOT_ID, sourceUrl: "", title: null },
  }));
});

describe("DOMESTIC-PRICE-TRIGGER-1: 분석 직후 국내 가격 조사가 정확히 한 번 걸린다", () => {
  it("1) 새 분석(첫 저장, id 없음) → 국내 가격 조사가 딱 한 번, 그 스냅샷/워크스페이스로 실행된다", async () => {
    const { POST } = await import("../route");

    const res = await POST(postRequest({ sourceUrl: "https://example.com/x", workspace: workspaceState() }));
    expect(res.status).toBe(200);
    await runAfterCallbacks();

    expect(hoisted.triggerCalls).toHaveLength(1);
    expect(hoisted.triggerCalls[0].snapshotId).toBe(NEW_SNAPSHOT_ID);
    // GLOBAL-MARKET ③-2 — 판매자가 켜 둔 편집샵으로만 뒤지려면 세션이 정한
    // workspaceId가 반드시 함께 넘어가야 한다(선택 인자가 아니다).
    expect(hoisted.triggerCalls[0].workspaceId).toBe(WORKSPACE_ID);
  });

  it("2) 같은 분석의 이후 저장(id 있음 = update) → 다시 조사하지 않는다", async () => {
    const { POST } = await import("../route");

    // 첫 저장 1회 + 편집 저장 3회. pipeline/page.tsx의 2초 디바운스 저장은
    // 셀러가 이미지를 고르거나 카테고리를 바꿀 때마다 계속 들어온다 — 그때마다
    // 편집샵을 다시 크롤링하면 없앤 배치보다 더 나쁜 물건이 된다.
    await POST(postRequest({ sourceUrl: "https://example.com/x", workspace: workspaceState() }));
    for (let i = 0; i < 3; i += 1) {
      await POST(postRequest({ id: NEW_SNAPSHOT_ID, sourceUrl: "https://example.com/x", workspace: workspaceState() }));
    }
    await runAfterCallbacks();

    expect(hoisted.triggerCalls).toHaveLength(1);
  });

  it("3) 저장 자체가 실패하면 조사도 걸지 않는다(없는 스냅샷을 조사할 수는 없다)", async () => {
    hoisted.saveSnapshotImpl.mockResolvedValue({ ok: false, error: "스냅샷을 찾을 수 없습니다." });
    const { POST } = await import("../route");

    await POST(postRequest({ sourceUrl: "https://example.com/x", workspace: workspaceState() }));
    await runAfterCallbacks();

    expect(hoisted.triggerCalls).toHaveLength(0);
  });

  it("4) 국내 조사는 응답을 기다리게 하지 않는다 — 응답이 나간 뒤에야 돈다", async () => {
    const { POST } = await import("../route");

    const res = await POST(postRequest({ sourceUrl: "https://example.com/x", workspace: workspaceState() }));
    const body = (await res.json()) as { ok: boolean; snapshot?: { id: string } };

    // 응답이 이미 완성된 이 시점에 조사는 아직 시작조차 하지 않았다.
    // = 편집샵 크롤링 10~30초가 snapshotId 확보를 막지 않는다.
    expect(body.ok).toBe(true);
    expect(body.snapshot?.id).toBe(NEW_SNAPSHOT_ID);
    expect(hoisted.triggerCalls).toHaveLength(0);
    expect(hoisted.afterCallbacks).toHaveLength(1);
  });

  it("5) 국내 조사가 터져도 스냅샷 저장(=상품 분석)은 그대로 성공한다", async () => {
    hoisted.triggerImpl.mockRejectedValue(new Error("편집샵 검색 전체 실패"));
    const { POST } = await import("../route");

    const res = await POST(postRequest({ sourceUrl: "https://example.com/x", workspace: workspaceState() }));
    const body = (await res.json()) as { ok: boolean };

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // 콜백이 실제로 거부되더라도 이미 나간 응답을 되돌릴 수 없다는 것을
    // 명시적으로 확인한다(격리의 근거가 "우연히 안 터짐"이 아님을 고정).
    await expect(runAfterCallbacks()).rejects.toThrow("편집샵 검색 전체 실패");
    expect(body.ok).toBe(true);
  });
});
