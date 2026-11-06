/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCHRUN-PRESERVATION 계약 (CPO 승인 2026-11-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **지켜야 하는 것은 「삭제 ↔ 누락」의 구분** 이다:
 * ```
 * 키 없음 → 보존 │ null → null 저장 │ {} → 빈 객체 저장 │ 신규 → 교체
 * INSERT 경로 불변 │ 다른 workspace 칸 불변
 * ```
 * 🔴 Supabase 클라이언트를 **가짜로** 끼운다 — DB 접근 0 · 네트워크 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** 🟢 호출 기록 — 운영이 **실제로 쓴 workspace** 를 본다(의도가 아니라 산출을 단언한다). */
const written: Array<Record<string, unknown>> = [];
let priorWorkspace: Record<string, unknown> | null = null;
let selectCalls = 0;

/**
 * 🔴 Supabase 체이닝을 최소로 흉내낸다 — `select().eq().eq().maybeSingle()` 과
 *    `update().eq().eq().select().maybeSingle()` 두 모양만 쓰인다.
 */
function makeFakeSupabase() {
  return {
    /** 🟢 INSERT 경로가 `job_key`/상품정체성 발급에 쓴다 — 보존 축과 무관하다. */
    rpc: () => Promise.resolve({ data: null, error: null }),
    from() {
      const ctx: { mode: "select" | "update"; payload?: Record<string, unknown> } = { mode: "select" };
      const chain: Record<string, unknown> = {
        select(_cols?: string) {
          if (ctx.mode !== "update") {
            ctx.mode = "select";
            selectCalls++;
          }
          return chain;
        },
        update(payload: Record<string, unknown>) {
          ctx.mode = "update";
          ctx.payload = payload;
          return chain;
        },
        insert(payload: Record<string, unknown>) {
          ctx.mode = "update";
          ctx.payload = payload;
          written.push(payload);
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle() {
          if (ctx.mode === "update" && ctx.payload) {
            written.push(ctx.payload);
            return Promise.resolve({ data: { id: "snap-1", workspace: ctx.payload.workspace }, error: null });
          }
          return Promise.resolve({ data: priorWorkspace ? { workspace: priorWorkspace } : null, error: null });
        },
        single() {
          return Promise.resolve({ data: { id: "snap-1" }, error: null });
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => makeFakeSupabase() }));

let saveSnapshot: typeof import("../snapshot").saveSnapshot;

beforeEach(async () => {
  written.length = 0;
  selectCalls = 0;
  priorWorkspace = null;
  vi.resetModules();
  ({ saveSnapshot } = await import("../snapshot"));
});
afterEach(() => vi.restoreAllMocks());

const base = { id: "snap-1", sourceUrl: "https://x.test/p/1", title: "t", thumbnailUrl: null, workspaceId: "ws-1" };
/** 🟢 수신 workspace — 🔴 `searchRun` 키가 **없다**(실제 클라이언트가 그렇다). */
const incomingNoKey = { url: "https://x.test/p/1", activeTab: "source", items: [] } as never;
const lastRun = () => written[written.length - 1]?.workspace as Record<string, unknown> | undefined;

describe("SEARCHRUN-PRESERVATION — UPDATE 분기", () => {
  it("🟢 수신에 `searchRun` 키가 **없으면** 기존 값을 보존한다", async () => {
    priorWorkspace = { url: "old", searchRun: { at: "2026-11-05", producers: { WEB_SEARCH: 10 } } };
    await saveSnapshot({ ...base, workspace: incomingNoKey });
    expect(lastRun()?.searchRun).toEqual({ at: "2026-11-05", producers: { WEB_SEARCH: 10 } });
    /** 🔴 **다른 칸은 수신 값 그대로다** — 기존 workspace 를 되살리는 것이 아니다. */
    expect(lastRun()?.url).toBe("https://x.test/p/1");
    expect(lastRun()).not.toHaveProperty("items", undefined);
  });

  it("🔴 `searchRun: null` 은 **명시적 입력** 이다 — null 로 저장한다", async () => {
    priorWorkspace = { searchRun: { at: "old" } };
    await saveSnapshot({ ...base, workspace: { url: "u", searchRun: null } as never });
    expect(lastRun()?.searchRun).toBeNull();
    /** 🔴 보존 조회를 **하지 않는다**(키가 있으므로). */
    expect(selectCalls).toBe(0);
  });

  it("🔴 `searchRun: {}` 도 **명시적 입력** 이다 — 빈 객체로 저장한다", async () => {
    priorWorkspace = { searchRun: { at: "old" } };
    await saveSnapshot({ ...base, workspace: { url: "u", searchRun: {} } as never });
    expect(lastRun()?.searchRun).toEqual({});
  });

  it("🔴 신규 `searchRun` 이 있으면 **그 값으로 교체** 한다", async () => {
    priorWorkspace = { searchRun: { at: "old" } };
    await saveSnapshot({ ...base, workspace: { url: "u", searchRun: { at: "new" } } as never });
    expect(lastRun()?.searchRun).toEqual({ at: "new" });
  });

  it("🟢 기존 행에 `searchRun` 이 **없으면** 아무것도 더하지 않는다", async () => {
    priorWorkspace = { url: "old" };
    await saveSnapshot({ ...base, workspace: incomingNoKey });
    expect(lastRun()).not.toHaveProperty("searchRun");
  });

  it("🟢 기존 행 조회가 **실패해도** 저장을 죽이지 않는다(fail-soft)", async () => {
    priorWorkspace = null;
    const r = await saveSnapshot({ ...base, workspace: incomingNoKey });
    expect(r.ok).toBe(true);
    expect(lastRun()).not.toHaveProperty("searchRun");
  });

  it("🔴 **다른 workspace 칸을 손대지 않는다**", async () => {
    priorWorkspace = { searchRun: { at: "keep" }, canonicalProduct: { 버려질: true }, 몰래살아남지말것: 1 };
    await saveSnapshot({
      ...base,
      workspace: { url: "u", canonicalProduct: { 새것: true }, activeTab: "commerce" } as never,
    });
    expect(lastRun()?.canonicalProduct).toEqual({ 새것: true });
    expect(lastRun()?.activeTab).toBe("commerce");
    /** 🔴🔴 `searchRun` «외» 의 기존 칸은 **되살아나지 않는다** — 그것이 전체 교체 계약이다. */
    expect(lastRun()).not.toHaveProperty("몰래살아남지말것");
  });

  it("🔴 **INSERT 경로는 불변** 이다 — 보존 조회를 하지 않는다", async () => {
    priorWorkspace = { searchRun: { at: "old" } };
    await saveSnapshot({ ...base, id: undefined, workspace: incomingNoKey });
    expect(selectCalls).toBe(0);
    const ins = written.find((w) => w.workspace);
    expect(ins?.workspace).not.toHaveProperty("searchRun");
  });
});
