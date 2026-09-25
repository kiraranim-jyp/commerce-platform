import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12d — **Prisma 가 채워 주던 칸을 raw insert 는 채우지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 저장소의 표는 두 갈래로 만들어졌다:
 *
 *   Prisma migration      "id" TEXT NOT NULL          ← DEFAULT «없음»
 *   (products)            "updatedAt" TIMESTAMP NOT NULL ← DEFAULT «없음»
 *                         → Prisma 클라이언트가 @default(cuid())/@updatedAt 로
 *                           «앱에서» 채운다
 *
 *   수동 migration        id uuid primary key default gen_random_uuid()
 *   (product_snapshots)   → DB 가 채운다
 *
 * 그런데 앱은 Prisma 가 아니라 **Supabase raw insert** 로 쓴다. 앞쪽 표에
 * id/updatedAt 을 비우고 insert 하면 NOT NULL 위반으로 «항상» 실패한다.
 *
 * 🔴 실제로 그렇게 됐다. products 와 channel_products 두 표의 insert 가 전부
 * 비어 있었고, 두 실패 모두 console.warn 후 «조용히» 넘어가도록 설계돼 있어
 * 아무도 몰랐다. 결과: products 행 0건 · ChannelProduct 0건 · 모든 snapshot 의
 * product_id NULL. 13714803530 이 연결 없이 떠 있던 진짜 이유다.
 *
 * 🔴 typecheck 도 build 도 이것을 잡지 못한다 — 컬럼 이름은 문자열이고,
 * 빠진 칸은 «없는 것» 이라 타입에 걸리지 않는다. 그래서 여기서 막는다.
 */

const SRC_ROOT = join(__dirname, "../../..");

/** DB 에 기본값이 «없어» 코드가 반드시 채워야 하는 칸. */
const REQUIRED_ON_INSERT: Record<string, string[]> = {
  /* Prisma 초기 migration: id · updatedAt 둘 다 DEFAULT 없음. */
  products: ["id", "updatedAt"],
  /* 063: `id TEXT PRIMARY KEY` — DEFAULT 없음(created_at/updated_at 은 있다). */
  channel_products: ["id"],
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** `.from("t")` … `.insert({ … })` 한 쌍을 거칠게 잘라 낸다. */
function insertsFor(table: string): { file: string; body: string }[] {
  const found: { file: string; body: string }[] = [];
  for (const file of walk(SRC_ROOT)) {
    const src = readFileSync(file, "utf8");
    const pattern = new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)[\\s\\S]{0,400}?\\.insert\\(\\s*\\{`, "g");
    for (const m of src.matchAll(pattern)) {
      const start = m.index! + m[0].length;
      /* 중괄호 깊이로 객체 리터럴의 끝을 찾는다 — 정규식으로는 중첩을 못 센다. */
      let depth = 1;
      let i = start;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth += 1;
        else if (src[i] === "}") depth -= 1;
        i += 1;
      }
      found.push({ file: file.slice(SRC_ROOT.length + 1).replace(/\\/g, "/"), body: src.slice(start, i) });
    }
  }
  return found;
}

describe("🔴 DB 가 채워 주지 않는 칸을 코드가 채우는가", () => {
  for (const [table, columns] of Object.entries(REQUIRED_ON_INSERT)) {
    describe(`${table}`, () => {
      const inserts = insertsFor(table);

      it("insert 하는 자리를 실제로 찾아냈다 — 검사가 빈손이 아니다", () => {
        /* 못 찾으면 아래 검사가 전부 통과해 버린다. 그 상태를 먼저 막는다. */
        expect(inserts.length).toBeGreaterThan(0);
      });

      it.each(columns)(`🔴 모든 insert 가 %s 를 채운다`, (column) => {
        const missing = inserts
          .filter(({ body }) => !new RegExp(`(^|[\\s{,])${column}\\s*:`).test(body))
          .map(({ file }) => `${file}: .from("${table}").insert({ … }) 에 ${column} 없음`);
        expect(
          missing,
          `DB 에 DEFAULT 가 없는 칸이다 — 비우면 NOT NULL 위반으로 «항상» 실패하고, 그 실패는 조용히 넘어간다`,
        ).toEqual([]);
      });
    });
  }

  it("🔴 이 목록의 근거가 마이그레이션에 남아 있다", () => {
    /* 목록이 「그냥 적어 둔 것」이 되지 않게, 실제 DDL 을 확인한다. */
    const prisma = readFileSync(
      join(__dirname, "../../../../../../packages/database/prisma/migrations/20260716012739_init/migration.sql"),
      "utf8",
    );
    expect(prisma).toMatch(/"id"\s+TEXT\s+NOT\s+NULL,/);
    expect(prisma).toMatch(/"updatedAt"\s+TIMESTAMP\(3\)\s+NOT\s+NULL,/);
    /* 🔴 DEFAULT 가 붙어 있지 않다는 것이 핵심이다. */
    expect(prisma).not.toMatch(/"updatedAt"\s+TIMESTAMP\(3\)\s+NOT\s+NULL\s+DEFAULT/);

    const m063 = readFileSync(
      join(__dirname, "../../../../../../packages/database/prisma/migrations_manual/063_product_identity_and_channel_product.sql"),
      "utf8",
    );
    expect(m063).toMatch(/id\s+TEXT\s+PRIMARY\s+KEY,/);
    expect(m063).not.toMatch(/id\s+TEXT\s+PRIMARY\s+KEY\s+DEFAULT/);
  });
});
