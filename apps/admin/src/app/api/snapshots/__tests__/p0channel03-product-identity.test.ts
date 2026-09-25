import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 E-2(CPO 확정, 2026-09-25) — **상품 정체성은 «최초 수집» 에서
 * 한 번만 발급된다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지금까지 정체성이 없어서 `snapshot_id` 하나로 외부 상품에 연결했다. snapshot 은
 * 「수집·분석 1회」라 재분석하면 새로 생기고, 그때 이전 등록과의 연결이 끊어진다.
 * 그 결과가 실제 Production 에 있다 — 한 상품이 SmartStore 외부번호 6개로 갈라졌다.
 *
 *     Product A ─┬─ Snapshot 1
 *                ├─ Snapshot 2   (재분석해도 같은 Product)
 *                └─ Snapshot 3
 *
 * 이 파일이 지키는 것:
 *   · 발급은 «최초 insert» 에서만. 편집(update)에서는 다시 만들지 않는다.
 *   · 🔴 sourceUrl 로 기존 Product 를 «찾지 않는다» — URL 은 식별자가 아니다.
 *   · 🔴 앱은 Supabase 로만 DB 에 닿는다. Prisma runtime 을 들이지 않는다.
 *   · 🔴 실패해도 스냅샷 저장을 막지 않는다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const LIB = join(__dirname, "../_lib/snapshot.ts");
const SRC = codeOnly(readFileSync(LIB, "utf8"));
const RAW = readFileSync(LIB, "utf8");

describe("① 발급은 «최초 수집» 에서 한 번만", () => {
  const insertPath = SRC.slice(SRC.indexOf("const jobKey = await generateJobKey();"));
  const updatePath = SRC.slice(
    SRC.indexOf("if (input.id) {"),
    SRC.indexOf("const productId = await createProductIdentity("),
  );

  it("job_key 와 «같은 자리» 에서 발급한다 — 새 Job 이 처음 생기는 순간", () => {
    const flat = SRC.replace(/\s+/g, " ");
    expect(flat).toContain("const productId = await createProductIdentity(supabase, input); const jobKey");
  });

  it("🔴 편집(update) 경로에서는 다시 만들지 않는다", () => {
    expect(updatePath).not.toContain("createProductIdentity");
    expect(updatePath).toContain('.from("product_snapshots")');
    expect(updatePath).toContain(".update(");
  });

  it("최초 insert 에만 product_id 를 싣는다", () => {
    expect(insertPath).toContain("product_id: productId");
  });
});

describe("② 🔴 sourceUrl 로 기존 Product 를 찾지 않는다", () => {
  it("조회 없이 «항상 새로» 발급한다", () => {
    const fn = SRC.slice(
      SRC.indexOf("async function createProductIdentity("),
      SRC.indexOf("export async function saveSnapshot("),
    );
    expect(fn).toContain('.from("products")');
    expect(fn).toContain(".insert(");
    /* 조회로 매칭하면 URL 이 사실상 식별자가 된다 — 같은 상품이 URL 을 바꿀 수
       있고, 같은 URL 에서 상품이 바뀔 수도 있다. */
    expect(fn).not.toContain(".select(\"id\").eq(");
    expect(fn).not.toContain("maybeSingle");
    expect(fn).not.toContain("upsert");
    expect(fn).not.toContain("findUnique");
  });

  it("sourceUrl 은 metadata 로만 실린다", () => {
    expect(SRC).toContain("sourceUrl: input.sourceUrl");
  });
});

describe("③ 🔴 경계를 지킨다", () => {
  it("앱 runtime 에 Prisma 를 들이지 않는다", () => {
    expect(RAW).not.toContain("@prisma/client");
    expect(RAW).not.toContain("PrismaClient");
    expect(SRC).toContain("getSupabaseAdmin()");
  });

  it("실제 표 이름은 snake_case `products` 다", () => {
    expect(SRC).toContain('.from("products")');
    expect(SRC).not.toContain('.from("Product")');
  });
});

describe("④ 🔴 정체성이 없다고 셀러의 분석 결과를 버리지 않는다", () => {
  it("발급 실패 시 null 을 내고 계속한다", () => {
    const fn = SRC.slice(
      SRC.indexOf("async function createProductIdentity("),
      SRC.indexOf("export async function saveSnapshot("),
    );
    expect(fn).toContain("return null;");
    expect(fn).not.toContain("throw");
  });

  it("job_key 와 같은 원칙 — 없어도 스냅샷은 저장된다", () => {
    /* 재시도 경로는 row 만 쓴다(job_key·product_id 없이). 컬럼이 없는 환경에서도
       저장 자체가 막히지 않는다. */
    const retry = SRC.slice(SRC.indexOf("if (error) {", SRC.indexOf("const jobKey")));
    expect(retry).toContain(".insert(row)");
    expect(retry).not.toContain("product_id");
  });
});

describe("⑤ 🔴 기존 데이터를 건드리지 않는다", () => {
  it("backfill 코드가 없다", () => {
    for (const forbidden of ["update({ product_id", "backfill", "is null"]) {
      expect(SRC).not.toContain(forbidden);
    }
  });
});
