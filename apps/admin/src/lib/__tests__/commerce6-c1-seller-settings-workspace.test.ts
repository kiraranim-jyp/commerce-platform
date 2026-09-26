import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-1 — **「Beta Security 가 인자를 채운다」의 그 인자**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 059 와 seller-settings.ts 가 순서를 미리 적어 두었다: 1순위는 내 workspace 의
 * 행, 레거시 NULL 행은 그 다음. 그 인자를 이제 받는다.
 *
 * 🔴 이번에 «하지 않은» 것도 함께 고정한다 — 호출부를 일부만 바꾸지 않았다.
 * 쓰기만 workspace 로 옮기면 등록 payload 를 조립하는 일곱 곳은 레거시 행을
 * 계속 읽어서, 셀러가 저장한 값이 등록에 반영되지 않는다. 지금보다 나쁘다.
 */

const maybeSingle = vi.fn();
const select = vi.fn();
const getSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => getSupabaseAdmin() }));

/** `.select().eq()/.is().eq().maybeSingle()` 만 흉내 내고, 걸린 조건을 기록한다. */
function stub() {
  const calls: { column: string; value: unknown }[] = [];
  const chain = {
    eq(column: string, value: unknown) {
      calls.push({ column, value });
      return chain;
    },
    is(column: string, value: unknown) {
      calls.push({ column, value });
      return chain;
    },
    maybeSingle,
  };
  select.mockReturnValue(chain);
  getSupabaseAdmin.mockReturnValue({ from: () => ({ select }) });
  return calls;
}

const EMPTY_ROW = {
  manufacturer: null,
  as_contact_number: null,
  quality_guarantee: null,
  kc_exemption_text: null,
  default_country_of_origin: null,
};

async function load(workspaceId?: string | null) {
  const mod = await import("../seller-settings");
  return mod.loadSellerSettings(workspaceId);
}

beforeEach(() => {
  vi.resetModules();
  maybeSingle.mockReset();
  select.mockReset();
  getSupabaseAdmin.mockReset();
});

describe("① workspaceId 를 주지 «않으면» 예전과 똑같다", () => {
  it("레거시 NULL 행 하나만 읽는다", async () => {
    const calls = stub();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await load();
    expect(calls).toEqual([
      { column: "workspace_id", value: null },
      { column: "scope_key", value: "default" },
    ]);
  });
});

describe("② workspaceId 를 주면 «내 행» 이 1순위다", () => {
  it("workspace 행을 먼저 찾고, 있으면 레거시를 쳐다보지 않는다", async () => {
    const calls = stub();
    maybeSingle.mockResolvedValue({ data: { ...EMPTY_ROW, manufacturer: "내 제조사" }, error: null });
    const result = await load("ws-A");
    expect(result.manufacturer).toBe("내 제조사");
    expect(calls).toEqual([
      { column: "workspace_id", value: "ws-A" },
      { column: "scope_key", value: "default" },
    ]);
  });

  /* 🔴 폴백을 «없애지» 않았다. workspace 행이 아직 하나도 없으므로(059 는 NULL
     로만 backfill 했다) 먼저 끊으면 지금 설정이 통째로 사라진다. */
  it("내 행이 없으면 레거시로 내려간다 — migration compatibility", async () => {
    const calls = stub();
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...EMPTY_ROW, manufacturer: "레거시" }, error: null });
    const result = await load("ws-A");
    expect(result.manufacturer).toBe("레거시");
    expect(calls).toEqual([
      { column: "workspace_id", value: "ws-A" },
      { column: "scope_key", value: "default" },
      { column: "workspace_id", value: null },
      { column: "scope_key", value: "default" },
    ]);
  });

  /* 🔴 장애를 「설정 없음」으로 위장하지 않는다(R6-FS 가 없앤 그것). */
  it("내 행 조회가 «실패» 하면 레거시로 흘리지 않는다", async () => {
    const calls = stub();
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const result = await load("ws-A");
    expect(result.failed).toBe(true);
    expect(result.source).toBe("ERROR");
    expect(calls.filter((c) => c.column === "workspace_id")).toHaveLength(1);
  });
});

describe("③ C-1b — 해석을 «한 곳에서» 한다(배선 누락이 불가능하다)", () => {
  const LIB = readFileSync(join(__dirname, "..", "seller-settings.ts"), "utf8");

  /* 🔴 이것이 이 작업의 핵심이다. 호출부 여덟 곳에 인자를 손으로 꽂으면 하나만
     빠져도 「쓰기는 workspace 행, 읽기는 레거시 행」이 된다 — 셀러가 저장한 값이
     등록에 반영되지 않는 상태. 해석을 라이브러리 안에 두면 그 사고가 구조적으로
     일어날 수 없다. */
  it("읽기와 쓰기가 «같은 한 줄» 로 범위를 정한다", () => {
    const resolveLine = "workspaceId === undefined ? await resolveCurrentWorkspaceId() : workspaceId";
    expect((LIB.match(new RegExp(resolveLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [])).toHaveLength(2);
  });

  it("해석은 기존 인증(requireUser)을 재사용한다 — 새 ownership 을 만들지 않았다", () => {
    expect(LIB).toContain('await import("@/lib/auth/require-user")');
    expect(LIB).toContain("auth.ok ? auth.user.workspaceId : null");
  });

  /* 🔴 라이브러리가 조용히 «게이트» 가 되지 않는다 — 401/403 은 라우트의 일이다. */
  it("여기서 접근을 막지 않는다 — 범위만 정한다", () => {
    const fn = LIB.slice(LIB.indexOf("async function resolveCurrentWorkspaceId"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).not.toContain("NextResponse");
    expect(body).not.toContain("401");
    expect(body).not.toContain("throw");
  });

  it("🔴 임의의 workspace 를 지어내지 않는다", () => {
    expect(LIB).not.toMatch(/workspace_id:\s*["'][0-9a-f-]{8,}/i);
    /* 세션이 없으면 null 이고, 그때는 레거시 행이다 — 추정하지 않는다. */
    expect(LIB).toContain("return null;");
  });

  it("🔴 레거시 행을 지우거나 backfill 하지 않는다", () => {
    expect(LIB).not.toContain(".delete()");
    expect(LIB).not.toMatch(/update\([^)]*workspace_id/);
  });
});

/**
 * ══ CPO §7 — cross-workspace 계약 ══
 * 🔴 Production DB 로 확인할 수 없다(C-1 에서 확인: 자격증명 접근 불가).
 * 그래서 «질의 조건» 수준에서 고정한다 — A 요청이 B 조건을 만들지 않는다는 것.
 */
describe("④ A 와 B 가 서로를 읽지 않는다", () => {
  it("A 요청은 A 조건만, B 요청은 B 조건만 만든다", async () => {
    for (const ws of ["ws-A", "ws-B"]) {
      vi.resetModules();
      maybeSingle.mockReset();
      const calls = stub();
      maybeSingle.mockResolvedValue({ data: { ...EMPTY_ROW, manufacturer: ws }, error: null });
      const result = await load(ws);
      expect(result.manufacturer).toBe(ws);
      expect(calls.filter((c) => c.column === "workspace_id")).toEqual([{ column: "workspace_id", value: ws }]);
    }
  });

  it("A 가 저장해도 B 조건이 만들어지지 않는다", async () => {
    vi.resetModules();
    const calls: { column: string; value: unknown }[] = [];
    const chain = {
      eq(column: string, value: unknown) {
        calls.push({ column, value });
        return chain;
      },
      is(column: string, value: unknown) {
        calls.push({ column, value });
        return chain;
      },
      select: () => Promise.resolve({ data: [{ id: "row-A" }], error: null }),
    };
    getSupabaseAdmin.mockReturnValue({ from: () => ({ update: () => chain }) });
    const mod = await import("../seller-settings");
    const result = await mod.saveSellerSettings({ manufacturer: "A 제조사" }, "ws-A");
    expect(result).toEqual({ ok: true });
    expect(calls).toContainEqual({ column: "workspace_id", value: "ws-A" });
    expect(calls).not.toContainEqual({ column: "workspace_id", value: "ws-B" });
  });
});
