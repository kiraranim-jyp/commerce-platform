import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BETA-SECURITY-2 FINAL §3/§4/§13(CPO 지시, 2026-09-07).
 *
 * 이 파일이 지키는 가장 중요한 불변조건:
 *   "이미 workspace membership이 있는 사용자가 로그인하면 새 workspace를
 *    절대 만들지 않는다."
 *
 * 이게 깨지면 043 마이그레이션으로 대표 workspace에 연결해 둔 기존 운영
 * 스냅샷이 화면에서 통째로 사라진다(데이터는 남아 있지만 새 빈 workspace를
 * 보게 된다). CASE J가 바로 이 상황을 잡는 시나리오다.
 *
 * §13 — Google 로그인과 이메일 로그인은 같은 경로를 쓴다. requireUser()는
 * 어떤 provider로 들어왔는지 보지 않고 Supabase Auth user만 본다. 그래서
 * 이 테스트는 두 로그인 방식 모두를 대표한다.
 */

const USER_ID = "user-1";
const EXISTING_WORKSPACE = "ws-existing";

let authUser: { id: string; email: string } | null = null;
let memberRows: Array<{ workspace_id: string }> = [];
let insertedWorkspaces: number;
let insertedMembers: number;

// requireUser()가 먼저 Admin 사용자 전환 여부를 확인한다(§3). 이 테스트는
// 일반 Seller 로그인 경로를 보는 것이므로 쿠키를 비워 둔다 — 그러면
// readImpersonation()이 Admin 세션 없음으로 판단해 null을 돌려주고,
// 평소의 Supabase 세션 경로로 넘어간다.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () =>
        authUser ? { data: { user: authUser }, error: null } : { data: { user: null }, error: null },
    },
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      if (table === "workspace_members") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: memberRows[0] ?? null, error: null }),
          insert: async () => {
            insertedMembers += 1;
            return { error: null };
          },
        };
        return chain;
      }
      // workspaces
      return {
        insert: () => {
          insertedWorkspaces += 1;
          return {
            select: () => ({ single: async () => ({ data: { id: "ws-new" }, error: null }) }),
          };
        },
      };
    },
  }),
}));

describe("BETA-SECURITY-2 §4 — Workspace 생성은 idempotent해야 한다", () => {
  beforeEach(() => {
    vi.resetModules();
    insertedWorkspaces = 0;
    insertedMembers = 0;
    authUser = { id: USER_ID, email: "owner@example.com" };
    memberRows = [];
  });

  it("CASE J 핵심 — 이미 membership이 있으면 기존 workspace를 그대로 쓴다", async () => {
    memberRows = [{ workspace_id: EXISTING_WORKSPACE }];
    const { requireUser } = await import("../auth/require-user");

    const result = await requireUser();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.workspaceId).toBe(EXISTING_WORKSPACE);
    // 043으로 연결해 둔 대표 workspace가 있는데 새로 만들면 기존 스냅샷이
    // 전부 안 보이게 된다 — 그래서 생성이 0회여야 한다.
    expect(insertedWorkspaces).toBe(0);
  });

  it("로그인을 여러 번 해도 workspace가 늘어나지 않는다", async () => {
    memberRows = [{ workspace_id: EXISTING_WORKSPACE }];
    const { requireUser } = await import("../auth/require-user");

    await requireUser();
    await requireUser();
    await requireUser();

    expect(insertedWorkspaces).toBe(0);
  });

  it("신규 사용자는 Default Workspace와 OWNER membership을 받는다", async () => {
    memberRows = [];
    const { requireUser } = await import("../auth/require-user");

    const result = await requireUser();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.workspaceId).toBe("ws-new");
    expect(insertedWorkspaces).toBe(1);
    expect(insertedMembers).toBe(1);
  });

  it("CASE I — 세션이 없으면 401이고 workspace를 만들지 않는다", async () => {
    authUser = null;
    const { requireUser } = await import("../auth/require-user");

    const result = await requireUser();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    // 인증 실패한 요청이 DB에 흔적을 남기면 안 된다.
    expect(insertedWorkspaces).toBe(0);
  });
});
