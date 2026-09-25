import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12c — **테이블 이름은 타입이 잡아 주지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Supabase 클라이언트는 테이블명을 «문자열» 로 받는다. 그래서 오타나 옛 이름을
 * 써도 typecheck·build 가 전부 통과하고, Production 에서 처음 터진다.
 *
 * 실제로 터졌다: migration 065 가 `ALTER TABLE "Product" RENAME TO products`
 * 로 바꿨는데 F-12a 의 연결 복구 코드가 옛 이름 `"Product"` 를 쓰고 있었다.
 *
 *     Could not find the table 'public.Product' in the schema cache
 *
 * 그 바람에 레거시 등록 연결 복구가 «전부» 막혔고, 그 상품은 수정도 신규 등록도
 * 못 하는 상태가 됐다(신규는 중복 방어가 정상 차단).
 *
 * 🔴 같은 종류의 가드가 이미 있었지만 `snapshot.ts` «한 파일만» 보고 있었다.
 * 새로 만든 파일은 그 밖이었고, 그래서 못 잡았다. 파일 하나를 지키는 검사는
 * 다음 파일을 지키지 못한다 — 저장소 «전체» 를 본다.
 */

const SRC_ROOT = join(__dirname, "../../..");
const MIGRATIONS = join(__dirname, "../../../../../../packages/database/prisma/migrations_manual");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** 마이그레이션이 «실제로» 만드는 테이블 이름. */
function migratedTables(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    /* 🔴 `--` 주석을 먼저 걷어낸다 — 롤백 SQL 을 주석으로 달아 두는 관례가
       있어서(063 등), 걷지 않으면 «지워진» 이름까지 유효하다고 읽는다. */
    const sql = readFileSync(join(MIGRATIONS, file), "utf8").replace(/--.*$/gm, "");
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi)) {
      names.add(m[1]!.toLowerCase());
    }
    /* RENAME 은 «새 이름» 을 더하고 옛 이름을 뺀다 — 그것이 이번 사고의 핵심이다. */
    for (const m of sql.matchAll(/alter\s+table\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+rename\s+to\s+"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi)) {
      names.delete(m[1]!.toLowerCase());
      names.add(m[2]!.toLowerCase());
    }
  }
  return names;
}

/** 코드가 «쓰는» 테이블 이름 — 파일별로 모은다(어디를 고쳐야 하는지 말하려고). */
function usedTables(): { table: string; file: string }[] {
  const out: { table: string; file: string }[] = [];
  for (const file of walk(SRC_ROOT)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/\.from\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]*)["'`]\s*\)/g)) {
      out.push({ table: m[1]!, file: file.slice(SRC_ROOT.length + 1).replace(/\\/g, "/") });
    }
  }
  return out;
}

describe("🔴 코드가 부르는 테이블이 «실제로 있는가»", () => {
  const migrated = migratedTables();
  const used = usedTables();

  it("마이그레이션에서 테이블 목록을 읽어 냈다 — 검사가 빈손이 아니다", () => {
    /* 목록이 비면 아래 검사가 전부 통과해 버린다. 그 상태를 먼저 막는다. */
    expect(migrated.size).toBeGreaterThan(10);
    expect(migrated.has("products")).toBe(true);
    expect(migrated.has("channel_products")).toBe(true);
    expect(used.length).toBeGreaterThan(10);
  });

  it("🔴 rename 된 옛 이름은 «유효하지 않다»", () => {
    /* 065 가 Product → products 로 바꿨다. 옛 이름이 살아 있으면 이 검사는
       이번 사고를 다시 놓친다. */
    expect(migrated.has("product")).toBe(false);
  });

  it("🔴 모든 .from(...) 테이블이 마이그레이션에 있다", () => {
    const unknown = used.filter((u) => !migrated.has(u.table.toLowerCase()));
    expect(
      unknown.map((u) => `${u.file}: .from("${u.table}")`),
      "마이그레이션에 없는 테이블을 부른다 — Production 에서만 터진다",
    ).toEqual([]);
  });

  it("🔴 대소문자가 다른 이름을 쓰지 않는다 — Postgres 는 따옴표 없으면 소문자다", () => {
    const miscased = used.filter((u) => u.table !== u.table.toLowerCase());
    expect(miscased.map((u) => `${u.file}: .from("${u.table}")`)).toEqual([]);
  });
});
