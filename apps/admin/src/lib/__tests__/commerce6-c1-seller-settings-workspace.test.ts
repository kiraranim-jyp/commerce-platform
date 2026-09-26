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

describe("③ 이번에 «하지 않은» 것 — 호출부를 일부만 바꾸지 않았다", () => {
  const LIB = readFileSync(join(__dirname, "..", "seller-settings.ts"), "utf8");

  it("쓰기도 같은 인자를 받는다 — 읽기만 바뀌면 값이 갈라진다", () => {
    expect(LIB).toContain("workspaceId?: string | null,");
    expect(LIB).toContain("workspace_id: workspaceId ?? null");
  });

  it("🔴 임의의 workspace 를 지어내지 않는다", () => {
    expect(LIB).not.toMatch(/workspace_id:\s*["'][0-9a-f-]{8,}/i);
  });

  /* 🔴 호출부 8곳(읽기 7 · 쓰기 1)은 «아직» 인자를 넘기지 않는다. 한꺼번에
     바꾸는 것이 다음 단계다 — 그때까지 동작은 오늘과 같다. */
  it("호출부가 아직 인자를 넘기지 않는다 — 동작이 오늘과 같다", () => {
    const route = readFileSync(
      join(__dirname, "..", "..", "app", "api", "settings", "seller-settings", "route.ts"),
      "utf8",
    );
    expect(route).toContain("loadSellerSettings()");
    expect(route).toContain("saveSellerSettings(fields)");
  });
});
