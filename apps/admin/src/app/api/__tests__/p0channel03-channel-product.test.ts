import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-5 — **현재 연결을 한 곳에서 다룬다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 세 채널 어댑터가 각자 DB 를 건드리면 「쿠팡만 ChannelProduct 를 안 만드는」
 * 같은 상태가 생긴다. 등록 결과를 DB 에 반영하는 일은 이 파일에만 있어야 한다.
 *
 * 🔴 ChannelProduct(상태) ≠ RegistrationAttempt(이력).
 * 「마지막 attempt = 현재 상태」라는 가정이 SmartStore 외부번호 6개를 만들었다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const SRC = codeOnly(readFileSync(join(__dirname, "../_lib/channel-product.ts"), "utf8"));
const RAW = readFileSync(join(__dirname, "../_lib/channel-product.ts"), "utf8");

describe("① 🔴 모르는 상태를 LIVE 라고 적지 않는다", () => {
  it("연결을 만들 때 status 를 지정하지 않는다 — DB 기본값 UNKNOWN 이 남는다", () => {
    /* 🔴 «insert 블록만» 본다 — 함수 전체를 보면 반환 객체의 status: row.status
       까지 걸려서, 검사가 실제로 무엇을 막는지 흐려진다. */
    const link = SRC.slice(SRC.indexOf("export async function linkChannelProduct"), SRC.indexOf("export async function replaceChannelProductLink"));
    const insert = link.slice(link.indexOf(".insert({"), link.indexOf(".select("));
    expect(insert).toContain("external_product_id: input.externalProductId");
    expect(insert).not.toContain("status");
  });

  it("RECREATE 로 갈아끼울 때도 UNKNOWN 으로 되돌린다 — 새 상품의 상태는 모른다", () => {
    const rep = SRC.slice(SRC.indexOf("export async function replaceChannelProductLink"));
    expect(rep).toContain('status: "UNKNOWN"');
  });

  it("어디에도 LIVE 를 쓰지 않는다 — 등록 성공 ≠ 판매 중", () => {
    expect(SRC).not.toContain('"LIVE"');
  });
});

describe("② 🔴 옛 외부 상품번호를 지우지 않는다", () => {
  it("previous_* 칸을 만들지 않았다 — 이력은 attempt 가 갖는다", () => {
    for (const forbidden of ["previous_external", "previousExternal", "old_external"]) {
      expect(SRC).not.toContain(forbidden);
    }
  });

  it("🔴 외부 상품을 지우는 코드가 없다", () => {
    expect(SRC).not.toContain(".delete(");
    expect(SRC).not.toContain('method: "DELETE"');
  });
});

describe("③ 중복 제약이 없는 현실을 견딘다", () => {
  it("🔴 여러 행이 나와도 깨지지 않는다 — single() 이 아니라 최신 1건", () => {
    /* UNIQUE(product_id, channel) 을 아직 걸지 않았다(기존 중복 9건 때문).
       single() 을 쓰면 여러 행일 때 에러가 나서 등록 자체가 막힌다. */
    const find = SRC.slice(SRC.indexOf("export async function findChannelProduct"), SRC.indexOf("export async function linkChannelProduct"));
    expect(find).toContain('.order("updated_at", { ascending: false })');
    expect(find).toContain(".limit(1)");
    expect(find).toContain(".maybeSingle()");
    expect(find).not.toContain(".single()");
  });

  it("없으면 null 을 낸다 — 없는 것을 있다고 하지 않는다", () => {
    const find = SRC.slice(SRC.indexOf("export async function findChannelProduct"), SRC.indexOf("export async function linkChannelProduct"));
    expect(find).toContain("return null;");
  });
});

describe("④ 🔴 경계를 지킨다", () => {
  it("Supabase 로만 접근한다 — Prisma runtime 을 들이지 않는다", () => {
    expect(SRC).toContain("getSupabaseAdmin()");
    expect(RAW).not.toContain("@prisma/client");
    expect(RAW).not.toContain("PrismaClient");
  });

  it("여기서 lifecycle 을 판단하지 않는다 — 판단은 resolveLifecycle 한 곳이다", () => {
    expect(SRC).not.toContain("resolveLifecycle");
    for (const forbidden of ['"CREATE"', '"UPDATE"', '"RECREATE"', '"NOOP"', '"BLOCKED"']) {
      expect(SRC).not.toContain(forbidden);
    }
  });

  it("registration_attempts 를 건드리지 않는다 — 상태와 이력은 다른 표다", () => {
    expect(SRC).not.toContain("registration_attempts");
  });
});

describe("⑤ 네 가지 동작이 각각 있다", () => {
  it.each([
    ["findChannelProduct", "지금 나가 있는가"],
    ["linkChannelProduct", "CREATE 성공 → 새 연결"],
    ["replaceChannelProductLink", "RECREATE 성공 → 연결 교체"],
    ["touchChannelProduct", "UPDATE 성공 → 시각만 갱신"],
  ])("%s — %s", (fn) => {
    expect(SRC).toContain(`export async function ${fn}`);
  });

  it("🔴 UPDATE 는 external_product_id 를 바꾸지 않는다", () => {
    const touch = SRC.slice(SRC.indexOf("export async function touchChannelProduct"));
    expect(touch).toContain("updated_at:");
    expect(touch).not.toContain("external_product_id:");
  });
});
