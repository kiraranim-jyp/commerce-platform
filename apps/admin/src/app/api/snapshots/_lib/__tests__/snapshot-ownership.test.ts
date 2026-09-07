import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BETA-SECURITY-2 §21(CPO 지시, 2026-09-07) — "A 사용자가 로그인해도 B
 * 사용자의 데이터를 읽거나 삭제할 수 없다"를 코드 레벨로 고정한다.
 *
 * 이 테스트가 검증하는 것은 "쿼리에 workspace 조건이 실제로 걸리는가"다.
 * 소유권 검사를 라우트의 if문이 아니라 쿼리 조건 자체에 넣었기 때문에
 * (snapshot.ts 참고), 여기서 쿼리 빌더 호출을 관찰하면 우회 가능성을
 * 직접 확인할 수 있다 — 라우트가 검사를 깜빡할 수 있는 구조가 아니라는
 * 것을 증명하는 게 목적이다.
 */

const WORKSPACE_A = "11111111-1111-1111-1111-111111111111";
const WORKSPACE_B = "22222222-2222-2222-2222-222222222222";
const SNAPSHOT_OF_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

/** eq() 호출을 전부 기록하는 최소 Supabase 쿼리 빌더 스텁.
 * rows는 "이 워크스페이스의 행"만 돌려주도록 eq 조건을 실제로 적용한다. */
function makeSupabaseStub(rows: Array<{ id: string; workspace_id: string }>) {
  const eqCalls: Array<[string, unknown]> = [];

  function builder(table: string) {
    const filters: Array<[string, unknown]> = [];
    let mode: "select" | "update" | "delete" = "select";

    const matched = () =>
      rows.filter((r) => filters.every(([col, val]) => (r as Record<string, unknown>)[col] === val));

    const chain = {
      select: () => {
        // delete().select() 처럼 뒤따라오는 select는 mode를 바꾸지 않는다.
        if (mode === "select") mode = "select";
        return chain;
      },
      update: () => {
        mode = "update";
        return chain;
      },
      delete: () => {
        mode = "delete";
        return chain;
      },
      insert: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        eqCalls.push([col, val]);
        return chain;
      },
      maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
      single: async () => {
        const m = matched()[0];
        return m ? { data: m, error: null } : { data: null, error: { message: "not found" } };
      },
      // delete().select("id") 형태는 await 시 배열을 돌려준다.
      then: (resolve: (v: unknown) => unknown) => resolve({ data: matched(), error: null }),
    };
    void table;
    return chain;
  }

  return { from: builder, eqCalls };
}

let stub: ReturnType<typeof makeSupabaseStub>;

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => stub,
}));

vi.mock("../job-key", () => ({ generateJobKey: async () => "JOB-TEST-001" }));

describe("BETA-SECURITY-2 §21 — 스냅샷 소유권 격리", () => {
  beforeEach(() => {
    vi.resetModules();
    stub = makeSupabaseStub([{ id: SNAPSHOT_OF_A, workspace_id: WORKSPACE_A }]);
  });

  it("CASE E — 자기 workspace의 스냅샷은 정상 조회된다", async () => {
    const { getSnapshot } = await import("../snapshot");
    const result = await getSnapshot(SNAPSHOT_OF_A, WORKSPACE_A);
    expect(result?.id).toBe(SNAPSHOT_OF_A);
  });

  it("CASE B — USER B가 USER A의 스냅샷 id로 조회하면 아무것도 얻지 못한다", async () => {
    const { getSnapshot } = await import("../snapshot");
    const result = await getSnapshot(SNAPSHOT_OF_A, WORKSPACE_B);
    expect(result).toBeNull();
  });

  it("CASE B — 조회 쿼리에 workspace_id 조건이 실제로 걸린다", async () => {
    const { getSnapshot } = await import("../snapshot");
    await getSnapshot(SNAPSHOT_OF_A, WORKSPACE_B);
    expect(stub.eqCalls).toContainEqual(["workspace_id", WORKSPACE_B]);
  });

  it("CASE D — USER B가 USER A의 스냅샷을 삭제하려 하면 실패한다", async () => {
    const { deleteSnapshot } = await import("../snapshot");
    const result = await deleteSnapshot(SNAPSHOT_OF_A, WORKSPACE_B);
    expect(result.ok).toBe(false);
  });

  it("CASE F — 자기 스냅샷은 정상 삭제된다", async () => {
    const { deleteSnapshot } = await import("../snapshot");
    const result = await deleteSnapshot(SNAPSHOT_OF_A, WORKSPACE_A);
    expect(result.ok).toBe(true);
  });

  it("삭제 쿼리에도 workspace_id 조건이 걸린다 — id만으로 지울 수 없다", async () => {
    const { deleteSnapshot } = await import("../snapshot");
    await deleteSnapshot(SNAPSHOT_OF_A, WORKSPACE_B);
    expect(stub.eqCalls).toContainEqual(["workspace_id", WORKSPACE_B]);
  });

  it("목록 조회는 자기 workspace로만 좁혀진다", async () => {
    const { listRecentSnapshots } = await import("../snapshot");
    await listRecentSnapshots(WORKSPACE_B);
    expect(stub.eqCalls).toContainEqual(["workspace_id", WORKSPACE_B]);
  });

  it("CASE G — 새 스냅샷은 호출부가 준 workspace로 귀속된다", async () => {
    const { saveSnapshot } = await import("../snapshot");
    const captured: Array<Record<string, unknown>> = [];
    stub.from = ((): unknown => ({
      insert: (row: Record<string, unknown>) => {
        captured.push(row);
        return {
          select: () => ({ single: async () => ({ data: { ...row, id: "new" }, error: null }) }),
        };
      },
    })) as never;

    await saveSnapshot({
      sourceUrl: "https://example.com/p",
      title: null,
      thumbnailUrl: null,
      workspace: {} as never,
      workspaceId: WORKSPACE_B,
    });
    expect(captured[0]?.workspace_id).toBe(WORKSPACE_B);
  });

  it("CASE H — 남의 스냅샷 id로 덮어쓰기를 시도해도 갱신되지 않는다", async () => {
    const { saveSnapshot } = await import("../snapshot");
    const result = await saveSnapshot({
      id: SNAPSHOT_OF_A,
      sourceUrl: "https://example.com/evil",
      title: "탈취 시도",
      thumbnailUrl: null,
      workspace: {} as never,
      workspaceId: WORKSPACE_B,
    });
    expect(result.ok).toBe(false);
  });

  it("복제도 소유한 스냅샷만 가능하다 — 남의 데이터를 자기 쪽으로 가져올 수 없다", async () => {
    const { duplicateSnapshot } = await import("../snapshot");
    const result = await duplicateSnapshot(SNAPSHOT_OF_A, WORKSPACE_B);
    expect(result.ok).toBe(false);
  });
});
