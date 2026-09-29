import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMERCE-LIFECYCLE-FINAL-02 ①② (CPO P0, 2026-09-29) — **동작으로 재는 빗장**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지금까지 이 빗장의 검사는 전부 «소스 문자열» 이었다(호출 형태·순서·fail-closed
 * 분기). 그것으로는 「같은 URL 에 utm 이 붙으면 어떻게 되는가」를 답할 수 없다.
 *
 * 🔴 CPO 가 **실제 재등록 실험을 금지** 했다 — 차단을 확인하려고 외부 상품을 하나
 * 더 만드는 것은 대가가 너무 크다. 그래서 여기서는 DB 를 가짜로 세우고 함수를
 * 직접 돌린다. 외부 커머스 API 는 이 파일에서 한 번도 닿지 않는다(그 사실 자체를
 * 아래 ⑤ 가 확인한다 — 이 모듈은 fetch 를 쓰지 않는다).
 *
 * 재는 것 넷:
 *   ① 같은 원본 상품의 «다른 스냅샷» 성공 이력을 본다        → true(차단)
 *   ② 추적 파라미터만 다른 URL 로 우회되지 않는다            → true(차단)
 *   ③ 남의 워크스페이스 이력으로 내 등록을 막지 않는다        → false(통과)
 *   ④ 확인하지 «못하면» 막는다(조회 실패 · 스캔 창 포화)      → null
 */

interface SnapshotRow {
  id: string;
  source_url: string | null;
  workspace_id: string | null;
}
interface AttemptRow {
  snapshot_id: string;
  platform: string;
  status: string;
}

const hoisted = vi.hoisted(() => ({
  snapshots: [] as SnapshotRow[],
  attempts: [] as AttemptRow[],
  /** 이 테이블 조회를 실패시킨다 — fail-closed 경로를 재기 위한 것. */
  failTable: null as string | null,
}));

vi.mock("@/lib/supabase-admin", () => {
  type State = {
    table: string;
    eq: Record<string, unknown>;
    inList: Record<string, unknown[]>;
    limit: number | null;
  };

  const rowsFor = (s: State): unknown[] => {
    if (s.table === "product_snapshots") {
      let rows = hoisted.snapshots;
      if ("id" in s.eq) rows = rows.filter((r) => r.id === s.eq.id);
      if ("workspace_id" in s.eq) rows = rows.filter((r) => r.workspace_id === s.eq.workspace_id);
      return s.limit ? rows.slice(0, s.limit) : rows;
    }
    if (s.table === "registration_attempts") {
      let rows = hoisted.attempts;
      const ids = s.inList.snapshot_id;
      if (ids) rows = rows.filter((r) => ids.includes(r.snapshot_id));
      if ("platform" in s.eq) rows = rows.filter((r) => r.platform === s.eq.platform);
      if ("status" in s.eq) rows = rows.filter((r) => r.status === s.eq.status);
      return s.limit ? rows.slice(0, s.limit) : rows;
    }
    return [];
  };

  const build = (table: string) => {
    const s: State = { table, eq: {}, inList: {}, limit: null };
    const result = () =>
      hoisted.failTable === table
        ? { data: null, error: { message: `${table} 조회 실패(테스트)` } }
        : { data: rowsFor(s), error: null };
    const api = {
      select: () => api,
      order: () => api,
      limit: (n: number) => {
        s.limit = n;
        return api;
      },
      eq: (column: string, value: unknown) => {
        s.eq[column] = value;
        return api;
      },
      in: (column: string, values: unknown[]) => {
        s.inList[column] = values;
        return api;
      },
      maybeSingle: async () => {
        const r = result();
        return r.error ? r : { data: (r.data as unknown[])[0] ?? null, error: null };
      },
      /* 쿼리 빌더를 그대로 await 하는 경로(목록 조회)를 흉내낸다. */
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return api;
  };

  return { getSupabaseAdmin: () => ({ from: (table: string) => build(table) }) };
});

const WS = "ws-mine";
const OTHER_WS = "ws-other";
const URL_PLAIN = "https://example.com/products/jogging-pants";
const URL_TRACKED = "https://example.com/products/jogging-pants?utm_source=instagram&fbclid=abc";

async function ask(snapshotId: string, platform = "lotteon") {
  const { hasPriorSuccessfulAttempt } = await import("../snapshots/_lib/attempts-summary");
  return hasPriorSuccessfulAttempt(snapshotId, platform);
}

beforeEach(() => {
  vi.resetModules();
  hoisted.snapshots = [];
  hoisted.attempts = [];
  hoisted.failTable = null;
});

describe("① 같은 원본 상품의 «다른 스냅샷» 성공 이력을 본다", () => {
  it("🔴 재분석으로 만든 새 스냅샷도 차단된다 — 이것이 중복 CREATE 의 입구였다", async () => {
    hoisted.snapshots = [
      { id: "old", source_url: URL_PLAIN, workspace_id: WS },
      { id: "new", source_url: URL_PLAIN, workspace_id: WS },
    ];
    hoisted.attempts = [{ snapshot_id: "old", platform: "lotteon", status: "SUBMITTED" }];
    /* 새 스냅샷 «자신» 에는 이력이 한 건도 없다 — 그런데도 막혀야 한다. */
    expect(await ask("new")).toBe(true);
  });

  it("성공 이력이 없으면 통과한다 — 진짜 신규는 막지 않는다", async () => {
    hoisted.snapshots = [{ id: "new", source_url: URL_PLAIN, workspace_id: WS }];
    hoisted.attempts = [{ snapshot_id: "old", platform: "lotteon", status: "FAILED" }];
    expect(await ask("new")).toBe(false);
  });

  it("다른 채널의 성공은 이 채널을 막지 않는다", async () => {
    hoisted.snapshots = [
      { id: "old", source_url: URL_PLAIN, workspace_id: WS },
      { id: "new", source_url: URL_PLAIN, workspace_id: WS },
    ];
    hoisted.attempts = [{ snapshot_id: "old", platform: "smartstore", status: "SUBMITTED" }];
    expect(await ask("new", "lotteon")).toBe(false);
    expect(await ask("new", "smartstore")).toBe(true);
  });
});

describe("🔴 ② 추적 파라미터로 우회되지 않는다 (CPO ① 명시)", () => {
  it("utm·fbclid 만 다른 URL 이어도 같은 상품으로 본다", async () => {
    hoisted.snapshots = [
      { id: "old", source_url: URL_PLAIN, workspace_id: WS },
      { id: "new", source_url: URL_TRACKED, workspace_id: WS },
    ];
    hoisted.attempts = [{ snapshot_id: "old", platform: "lotteon", status: "SUBMITTED" }];
    expect(await ask("new"), "추적 파라미터를 붙이면 중복 차단이 열린다").toBe(true);
  });

  it("반대 방향도 같다 — 먼저 등록된 쪽에 파라미터가 있어도 본다", async () => {
    hoisted.snapshots = [
      { id: "old", source_url: URL_TRACKED, workspace_id: WS },
      { id: "new", source_url: URL_PLAIN, workspace_id: WS },
    ];
    hoisted.attempts = [{ snapshot_id: "old", platform: "lotteon", status: "SUBMITTED" }];
    expect(await ask("new")).toBe(true);
  });

  it("🔴 «다른 상품» 은 여전히 통과한다 — 과잉 차단은 그 자체로 사고다", async () => {
    hoisted.snapshots = [
      { id: "old", source_url: "https://example.com/products/other-item", workspace_id: WS },
      { id: "new", source_url: URL_PLAIN, workspace_id: WS },
    ];
    hoisted.attempts = [{ snapshot_id: "old", platform: "lotteon", status: "SUBMITTED" }];
    expect(await ask("new")).toBe(false);
  });
});

describe("③ 워크스페이스 격리 — 남의 이력으로 내 등록을 막지 않는다", () => {
  it("같은 URL 이어도 다른 워크스페이스의 성공은 보지 않는다", async () => {
    hoisted.snapshots = [
      { id: "theirs", source_url: URL_PLAIN, workspace_id: OTHER_WS },
      { id: "mine", source_url: URL_PLAIN, workspace_id: WS },
    ];
    hoisted.attempts = [{ snapshot_id: "theirs", platform: "lotteon", status: "SUBMITTED" }];
    expect(await ask("mine")).toBe(false);
  });
});

describe("🔴 ④ 확인하지 «못하면» 막는다 — 모름을 「없음」으로 읽지 않는다", () => {
  it("스냅샷 조회가 실패하면 null", async () => {
    hoisted.snapshots = [{ id: "new", source_url: URL_PLAIN, workspace_id: WS }];
    hoisted.failTable = "product_snapshots";
    expect(await ask("new")).toBeNull();
  });

  it("이력 조회가 실패하면 null", async () => {
    hoisted.snapshots = [{ id: "new", source_url: URL_PLAIN, workspace_id: WS }];
    hoisted.failTable = "registration_attempts";
    expect(await ask("new")).toBeNull();
  });

  it("🔴 스캔 창이 가득 차면 null — 못 본 것을 「없다」로 읽지 않는다", async () => {
    /* 창(1000)을 넘기면 더 오래된 등록을 보지 못한다. 그 상태의 false 는
       「성공한 적 없다」가 아니라 「모른다」다. */
    hoisted.snapshots = Array.from({ length: 1000 }, (_, i) => ({
      id: `s${i}`,
      source_url: `https://example.com/products/item-${i}`,
      workspace_id: WS,
    }));
    hoisted.snapshots[0] = { id: "new", source_url: URL_PLAIN, workspace_id: WS };
    expect(await ask("new")).toBeNull();
  });

  it("스냅샷이 아예 없으면 «이 스냅샷» 이력만 본다 — 기존 흐름을 깨지 않는다", async () => {
    hoisted.snapshots = [];
    hoisted.attempts = [{ snapshot_id: "ghost", platform: "lotteon", status: "SUBMITTED" }];
    expect(await ask("ghost")).toBe(true);
  });

  it("snapshotId 가 없으면 false — 스냅샷 없이 등록하는 기존 흐름을 막지 않는다", async () => {
    const { hasPriorSuccessfulAttempt } = await import("../snapshots/_lib/attempts-summary");
    expect(await hasPriorSuccessfulAttempt(null, "lotteon")).toBe(false);
  });
});

describe("🔴 ⑤ 이 빗장은 «읽기만» 한다 — 외부 호출도 자동 병합도 없다", () => {
  it("모듈이 fetch 를 쓰지 않는다(외부 커머스 API 호출 0회)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "snapshots", "_lib", "attempts-summary.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toContain("fetch(");
    /* 🔴 자동 병합 금지 — 빗장이 상품을 «묶지» 않는다. */
    for (const write of ["insert(", "update(", "upsert(", "delete("]) {
      expect(src, `빗장이 데이터를 쓰고 있다: ${write}`).not.toContain(write);
    }
  });
});
