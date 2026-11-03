import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-RUN-OBSERVABILITY-02 — **실행 관측값을 스냅샷에 남긴다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜** — Vercel tail 로그가 지나가면 `[SP07-websearch]` 가 사라져서 「Search 가
 *    왜 실패했는가」를 확인하려고 **사람에게 재실행을 요구** 하게 됐다(그 루프가 반복됐다).
 * 🔴 저장 위치 `product_snapshots.workspace.searchRun`(CPO 확정 · migration **0**) ·
 *    의미는 **「마지막 분석 실행의 Search 실행 관측값」**(상품 사실 아님).
 *
 * 🔴 네트워크 0 · DB 0 — **소스 앵커** 로 본다(이 경로는 service-role 키가 필요해
 *    로컬에서 실행할 수 없다 · 메모 `production-secrets-are-write-only`).
 */

const LIB = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SNAP = strip(readFileSync(join(LIB, "..", "..", "snapshots", "_lib", "snapshot.ts"), "utf8"));
const ROUTE = strip(readFileSync(join(LIB, "..", "check", "route.ts"), "utf8"));

describe("SEARCH-RUN-OBSERVABILITY-02", () => {
  /* ── A. 저장 계약 ─────────────────────────────────────────────────────── */
  it("A-1 🔴 `workspace.searchRun` 에 저장하는 helper 가 있다", () => {
    expect(SNAP).toContain("export async function saveSnapshotSearchRun");
    expect(SNAP).toContain("searchRun");
    expect(SNAP).toContain('.from("product_snapshots")');
  });

  it("A-2 🔴 `/check` 가 그 helper 를 부른다", () => {
    expect(ROUTE).toContain("saveSnapshotSearchRun");
    expect(ROUTE).toContain("snapshotId, auth.user.workspaceId");
  });

  it("A-3 🔴 저장값 열 칸 + producer 넷이 전부 실린다", () => {
    for (const k of [
      /**
       * 🔵 SPRINT4-GATE-01 — **질의 원문이 관측값에 들어간다.**
       * 🔴 이 칸이 없으면 「운영이 무슨 질의를 보냈는가」가 **로그 보존 창(1시간)**
       *    밖에서 영구히 사라진다(Gate C1 이 실제로 그 벽에 막혔다 — 24시간에 1건).
       */
      "query",
      "searches",
      "pages",
      "perPage",
      "organic",
      "failed",
      "errorName",
      "errorStatus",
      "errorCode",
      "timeout",
    ]) {
      expect(ROUTE, `🔴 저장값에 ${k} 가 없다`).toContain(`${k}:`);
    }
    for (const p of ["WEB_SEARCH", "OVERSEAS_AUTO", "DOMESTIC_LISTING", "GEMINI"]) {
      expect(ROUTE, `🔴 producer ${p} 가 없다`).toContain(`${p}:`);
    }
  });

  /* ── B. 🔴🔴 보안 계약 ────────────────────────────────────────────────── */
  it("B-1 🔴 토큰·헤더·쿠키·본문·URL·message 전문을 저장하지 않는다", () => {
    const at = ROUTE.indexOf("saveSnapshotSearchRun");
    const block = ROUTE.slice(Math.max(0, at - 1400), at + 1400);
    for (const banned of [
      "APIFY_API_TOKEN",
      "Authorization",
      "cookie",
      "token",
      "responseBody",
      "errorMessage",
      ".message",
      "res.url",
      "headers",
    ]) {
      expect(block, `🔴 저장 블록에 위험한 값이 들어갔다: ${banned}`).not.toContain(banned);
    }
  });

  it("B-2 🔴 helper 자신도 비밀을 만들지 않는다", () => {
    for (const banned of ["APIFY_API_TOKEN", "Authorization", "cookie"]) {
      expect(SNAP, `🔴 helper 에 ${banned} 가 있다`).not.toContain(banned);
    }
  });

  /* ── C. 🔴 다른 workspace 칸 불변 ─────────────────────────────────────── */
  it("C-1 🔴 helper 가 기존 workspace 를 읽어 «한 칸만» 덮는다", () => {
    const at = SNAP.indexOf("export async function saveSnapshotSearchRun");
    const body = SNAP.slice(at, at + 1200);
    /** 🟢 읽고 → 전개 → searchRun 만 교체. */
    expect(body).toContain('.select("workspace")');
    expect(body).toMatch(/\{\s*\.\.\.current,\s*searchRun\s*\}/);
    /** 🔴 다른 칸 이름을 **쓰지 않는다**(덮어쓰면 상품 데이터가 날아간다). */
    for (const other of ["canonicalProduct", "marketCategoryProfileId", "priceOverrideKrw"]) {
      expect(body, `🔴 helper 가 ${other} 를 건드린다`).not.toContain(other);
    }
  });

  it("C-2 🔴 workspace_id 로 남의 스냅샷을 덮지 못한다", () => {
    const at = SNAP.indexOf("export async function saveSnapshotSearchRun");
    const body = SNAP.slice(at, at + 1200);
    expect(body.split('.eq("workspace_id", workspaceId)').length - 1, "🔴 읽기·쓰기 둘 다 막아야 한다").toBe(2);
  });

  /* ── D. 🔴 fail-soft ─────────────────────────────────────────────────── */
  it("D-1 🔴 helper 는 throw 하지 않고 boolean 을 돌려준다", () => {
    const at = SNAP.indexOf("export async function saveSnapshotSearchRun");
    const body = SNAP.slice(at, at + 1200);
    expect(body).toContain("Promise<boolean>");
    expect(body, "🔴 helper 가 throw 한다").not.toMatch(/\bthrow\b/);
  });

  it("D-2 🔴 호출부가 try/catch 로 감싸 분석을 죽이지 않는다", () => {
    /**
     * 🔴 **import 줄을 집으면 안 된다** — 괄호까지 본다(이 트랙에서 두 번째로 밟은 함정).
     */
    const at = ROUTE.indexOf("saveSnapshotSearchRun(");
    expect(at, "🔴 호출부가 없다").toBeGreaterThan(0);
    const before = ROUTE.slice(Math.max(0, at - 600), at);
    expect(before, "🔴 저장 호출이 try 로 감싸여 있지 않다").toContain("try {");
  });
});
