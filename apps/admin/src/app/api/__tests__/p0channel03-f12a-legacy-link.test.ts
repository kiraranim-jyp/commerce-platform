import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { linkLegacyRegistration } from "../_lib/link-legacy-registration";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a — **기존 등록을 «한 건씩» 잇는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 「잘 이어진다」가 아니라 «잘못 이어지지 않는다» 다.
 * 잘못 이으면 지금 팔리고 있는 상품과의 연결이 끊기거나, 남의 상품이 내
 * 워크스페이스로 들어온다 — 둘 다 되돌리기 어렵다.
 */

/** 최소한의 Supabase 흉내 — 체인만 맞춰 주고 지정한 결과를 돌려준다. */
function fakeDb(tables: Record<string, { data?: unknown[]; error?: { message: string } }>) {
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const make = (table: string) => {
    const result = tables[table] ?? { data: [] };
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const k of ["select", "eq", "is", "order", "limit", "in"]) chain[k] = self;
    chain.maybeSingle = async () => ({ data: (result.data ?? [])[0] ?? null, error: result.error ?? null });
    chain.single = async () => ({ data: (result.data ?? [])[0] ?? null, error: result.error ?? null });
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(resolve);
    chain.insert = (payload: unknown) => {
      writes.push({ table, op: "insert", payload });
      return make(table);
    };
    chain.update = (payload: unknown) => {
      writes.push({ table, op: "update", payload });
      return make(table);
    };
    return chain;
  };
  return { db: { from: (t: string) => make(t) } as never, writes };
}

const ATTEMPT = { id: "a1", snapshot_id: "s1" };
const SNAPSHOT = { id: "s1", product_id: null, workspace_id: "w1", title: "테스트 상품" };

describe("① 🔴 근거는 «등록 이력» 하나뿐이다", () => {
  it("성공 이력이 없으면 STOP — 연결할 근거가 없다", async () => {
    const { db, writes } = fakeDb({ registration_attempts: { data: [] } });
    const r = await linkLegacyRegistration(db, { externalProductId: "13713593585", channel: "smartstore" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.stop).toContain("등록 이력이 없습니다");
    expect(writes).toHaveLength(0);
  });

  it("🔴 snapshot 이 여럿이면 STOP — 사람이 골라야 한다", async () => {
    /* 재분석으로 갈라진 경우다. 자동으로 하나를 고르면 그 선택이 영구 연결이 된다. */
    const { db, writes } = fakeDb({
      registration_attempts: { data: [ATTEMPT, { id: "a2", snapshot_id: "s2" }] },
    });
    const r = await linkLegacyRegistration(db, { externalProductId: "1", channel: "smartstore" });
    expect(r.ok === false && r.stop).toContain("사람이 골라야");
    expect(writes).toHaveLength(0);
  });

  it("🔴 source_url 을 보지 않는다 — URL 은 식별자가 아니다", () => {
    const src = readFileSync(join(__dirname, "../_lib/link-legacy-registration.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toContain("source_url");
    expect(code).not.toContain("sourceUrl");
  });
});

describe("② 🔴 남의 상품을 잇지 않는다", () => {
  it("워크스페이스가 다르면 STOP", async () => {
    const { db, writes } = fakeDb({
      registration_attempts: { data: [ATTEMPT] },
      product_snapshots: { data: [SNAPSHOT] },
    });
    const r = await linkLegacyRegistration(db, {
      externalProductId: "1",
      channel: "smartstore",
      expectWorkspaceId: "다른-워크스페이스",
    });
    expect(r.ok === false && r.stop).toContain("현재 워크스페이스의 것이 아닙니다");
    expect(writes).toHaveLength(0);
  });

  it("🔴 소유자를 모르면 Product 를 만들지 않는다", async () => {
    const { db, writes } = fakeDb({
      registration_attempts: { data: [ATTEMPT] },
      product_snapshots: { data: [{ ...SNAPSHOT, workspace_id: null }] },
      channel_products: { data: [] },
    });
    const r = await linkLegacyRegistration(db, { externalProductId: "1", channel: "smartstore", apply: true });
    expect(r.ok === false && r.stop).toContain("소유자를 모르는 Product 를 만들지 않습니다");
    expect(writes).toHaveLength(0);
  });
});

describe("③ 🔴 덮어쓰지 않는다", () => {
  it("같은 외부번호가 다른 Product 에 있으면 STOP", async () => {
    const { db, writes } = fakeDb({
      registration_attempts: { data: [ATTEMPT] },
      product_snapshots: { data: [SNAPSHOT] },
      channel_products: { data: [{ id: "cp1", product_id: "다른-product" }] },
    });
    const r = await linkLegacyRegistration(db, { externalProductId: "1", channel: "smartstore", apply: true });
    expect(r.ok === false && r.stop).toContain("이미 다른 Product 에 연결");
    expect(writes).toHaveLength(0);
  });

  it("이미 이 Product 에 이어져 있으면 «할 일 없음» 이다 — 다시 만들지 않는다", async () => {
    const { db, writes } = fakeDb({
      registration_attempts: { data: [ATTEMPT] },
      product_snapshots: { data: [{ ...SNAPSHOT, product_id: "p1" }] },
      channel_products: { data: [{ id: "cp1", product_id: "p1" }] },
    });
    const r = await linkLegacyRegistration(db, { externalProductId: "1", channel: "smartstore", apply: true });
    expect(r.ok && "alreadyLinked" in r && r.alreadyLinked).toBe(true);
    expect(writes).toHaveLength(0);
  });
});

describe("④ 🔴 기본은 «쓰지 않는다»", () => {
  it("apply 없이 부르면 계획만 낸다", async () => {
    const { db, writes } = fakeDb({
      registration_attempts: { data: [ATTEMPT] },
      product_snapshots: { data: [SNAPSHOT] },
      channel_products: { data: [] },
    });
    const r = await linkLegacyRegistration(db, { externalProductId: "1", channel: "smartstore" });
    expect(r.ok && "applied" in r && r.applied).toBe(false);
    expect(writes, "dry-run 인데 썼다").toHaveLength(0);
  });
});

describe("⑤ 🔴 이력을 재작성하지 않는다", () => {
  it("registration_attempts 에 쓰는 코드가 없다", () => {
    const src = readFileSync(join(__dirname, "../_lib/link-legacy-registration.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    /* 읽기(select)는 하되 쓰기는 없어야 한다. */
    expect(code).toContain('.from("registration_attempts")');
    const attemptsBlock = code.slice(code.indexOf('.from("registration_attempts")'));
    expect(attemptsBlock.slice(0, 200)).not.toContain(".insert(");
    expect(attemptsBlock.slice(0, 200)).not.toContain(".update(");
  });

  it("🔴 지우는 코드가 없다", () => {
    const src = readFileSync(join(__dirname, "../_lib/link-legacy-registration.ts"), "utf8");
    expect(src).not.toContain(".delete(");
  });

  it("🔴 status 를 LIVE 로 적지 않는다 — DB 기본값 UNKNOWN 이 남는다", () => {
    const src = readFileSync(join(__dirname, "../_lib/link-legacy-registration.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toContain('"LIVE"');
    /* 🔴 «insert 하는 payload» 만 본다. 파일 전체에서 "status:" 를 금지하면
       검증 결과를 «읽어서» 돌려주는 자리(status: r.status)까지 걸려서, 검사가
       무엇을 막는지 흐려진다 — 이 세션에서 반복한 실수다. */
    const insert = code.slice(code.indexOf('db.from("channel_products").insert({'));
    expect(insert.slice(0, insert.indexOf("});"))).not.toContain("status");
  });
});

describe("⑥ 🔴 라우트와 스크립트가 «같은 함수» 를 쓴다", () => {
  const route = readFileSync(join(__dirname, "../channel-products/link/route.ts"), "utf8");
  const script = readFileSync(
    join(__dirname, "../../../../scripts/p0channel03-f12a-link-legacy-registration.ts"),
    "utf8",
  );

  it("둘 다 linkLegacyRegistration 을 부른다", () => {
    expect(route).toContain("linkLegacyRegistration(");
    expect(script).toContain("linkLegacyRegistration(");
  });

  it("🔴 검사를 각자 다시 쓰지 않았다", () => {
    for (const [name, src] of Object.entries({ route, script })) {
      expect(src, `${name} 이 자기 검사를 따로 만들었다`).not.toContain('.from("channel_products")');
      expect(src, `${name} 이 자기 검사를 따로 만들었다`).not.toContain('.from("product_snapshots")');
    }
  });

  it("🔴 라우트는 세션 워크스페이스로 잠근다 — body 값을 권한 근거로 쓰지 않는다", () => {
    expect(route).toContain("expectWorkspaceId: auth.user.workspaceId");
    expect(route).toContain("requireUser()");
  });

  it("🔴 라우트도 기본이 dry-run 이다", () => {
    expect(route).toContain("body?.apply === true");
  });

  it("dry-run 은 감사 기록을 남기지 않는다 — 있으면 「했다」로 읽힌다", () => {
    /* 🔴 «호출부» 를 본다. indexOf("recordAuditLog") 는 import 줄을 먼저 잡는다. */
    const iGuard = route.indexOf('if ("applied" in result && result.applied) {');
    const iCall = route.indexOf("await recordAuditLog({");
    expect(iGuard, "applied 가드를 찾지 못했다").toBeGreaterThan(-1);
    expect(iGuard).toBeLessThan(iCall);
  });
});
