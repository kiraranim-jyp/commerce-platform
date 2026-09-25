import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 1(CEO 지시, 2026-09-20) — **등록 근거를 적을 칸이 «있는가».**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무슨 일이 있었나 ────────────────────────────────────────────────────────
 * `registration_attempts.price_breakdown` 칸이 Production 에 없었다(010 미적용).
 * register route 는 칸이 없으면 «하나씩 버리며 재시도»하는데 그 순서가
 *
 *     channel_price_record → brand_resolution → price_breakdown → …
 *
 * 라서, 없는 칸이 세 번째인 탓에 **앞의 둘이 먼저 희생됐다.** 실패는
 * console.warn 한 줄이고 등록은 «성공»으로 보고된다. 그래서 76건 전부
 * price_breakdown 이 없고, 2026-09-14 쿠팡 2건은 048(channel_price_record)이
 * 이미 적용된 뒤인데도 null 이다 — 연쇄 손실의 직접 증거다.
 *
 * ── 🔴 이 테스트가 «못 잡는» 것을 먼저 적는다 ──────────────────────────────
 * 이번 사고의 실제 원인은 「마이그레이션 파일이 없다」가 아니라 **「있는데
 * Production 에 적용되지 않았다」**이다. 단위 테스트는 원격 스키마를 볼 수
 * 없으므로 **이 파일은 그 드리프트를 잡지 못한다.** 실제 검증은 DB 에 직접
 * insert 해 보고 롤백하는 것으로 했고(P0-C STEP 1 보고), 여기서 잡는 것은
 * 그보다 한 단계 앞의 «코드가 마이그레이션 없는 칸에 쓰는 것»이다.
 *
 * 그럼에도 이 계약을 고정해 두는 이유: 다음에 누가 감사 칸을 하나 더 늘릴 때,
 * 마이그레이션을 같이 만들지 않으면 **똑같은 연쇄 폐기가 조용히 재발한다.**
 * 그때 이 테스트가 먼저 깨진다.
 *
 * 관례는 domestic-shipping-02.test.ts 를 따른다 — 그 파일도 054 SQL 을 직접
 * 읽어 어휘가 두 세계에서 갈라지는 것을 막는다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTE = path.join(HERE, "../register/route.ts");
const MIGRATIONS = path.join(HERE, "../../../../../../../packages/database/prisma/migrations_manual");

const routeSource = readFileSync(ROUTE, "utf-8");

/** 마이그레이션들이 registration_attempts 에 «실제로 만드는» 칸 전부. */
function migratedColumns(): Set<string> {
  const cols = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const raw = readFileSync(path.join(MIGRATIONS, file), "utf-8");
    /* 🔴 `--` 주석을 «먼저» 걷어낸다. 이 디렉터리의 마이그레이션들은 롤백 SQL을
       통째로 주석으로 달아 두는 관례라(063 등), 걷어내지 않으면 주석 안의
       ALTER/DROP 까지 읽어 「있지도 않은 칸이 있다」고 말하게 된다. */
    const sql = raw.replace(/--.*$/gm, "");

    /* P0-CHANNEL-03 F-8 — 한 ALTER 문이 칸을 «여러 개» 만드는 형태를 읽는다:
           ALTER TABLE registration_attempts
             ADD COLUMN IF NOT EXISTS channel_product_id TEXT NULL …,
             ADD COLUMN IF NOT EXISTS operation TEXT NULL;
       🔴 전에는 `ALTER TABLE … ADD COLUMN …` 을 한 덩어리로 찾아서 «첫 칸만»
       보였다. 그래서 063 이 만든 operation 이 「마이그레이션 없는 칸」으로
       잡혔다 — 칸은 실제로 있는데 테스트가 못 본 것이다.
       이런 거짓 경보를 그때그때 예외로 빼면 이 파일이 지키려는 계약 자체가
       녹는다. 예외가 아니라 «읽는 법» 을 고친다. */
    for (const stmt of sql.matchAll(/alter\s+table\s+registration_attempts\b([\s\S]*?);/gi)) {
      for (const m of stmt[1]!.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)) {
        cols.add(m[1]!);
      }
    }
    // create table 본문의 칸들(003).
    const created = /create\s+table\s+if\s+not\s+exists\s+registration_attempts\s*\(([\s\S]*?)\n\)/i.exec(sql);
    if (created) {
      for (const line of created[1]!.split("\n")) {
        const m = /^\s*(\w+)\s+(uuid|text|jsonb|integer|timestamptz|boolean)/i.exec(line);
        if (m) cols.add(m[1]!);
      }
    }
  }
  return cols;
}

/** route 가 insert 하는 row 리터럴에서 칸 이름을 읽는다. */
function insertedColumns(): string[] {
  const block = /const row: Record<string, unknown> = \{([\s\S]*?)\n  \};/.exec(routeSource);
  expect(block, "register route 의 insert row 리터럴을 찾지 못했다").not.toBeNull();
  return [...block![1]!.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]!);
}

/** 칸이 없을 때 «버리는» 순서. */
function optionalColumns(): string[] {
  const block = /const optionalColumns = \[([\s\S]*?)\];/.exec(routeSource);
  expect(block, "optionalColumns 배열을 찾지 못했다").not.toBeNull();
  return [...block![1]!.matchAll(/"(\w+)"/g)].map((m) => m[1]!);
}

describe("P0-C STEP 1 — 등록 감사 칸의 코드↔마이그레이션 계약", () => {
  it("🔴 route 가 쓰는 모든 칸에 마이그레이션이 있다 — 없으면 그 칸 때문에 «다른» 칸이 버려진다", () => {
    const migrated = migratedColumns();
    const missing = insertedColumns().filter((c) => !migrated.has(c));
    expect(missing, `마이그레이션 없는 칸: ${missing.join(", ")}`).toEqual([]);
  });

  it("price_breakdown 은 010 이 만든다 — 이번 사고의 당사자라 이름으로 못박는다", () => {
    const sql = readFileSync(path.join(MIGRATIONS, "010_registration_attempts_price_breakdown.sql"), "utf-8");
    expect(sql).toMatch(/add\s+column\s+if\s+not\s+exists\s+price_breakdown\s+jsonb/i);
    expect(migratedColumns().has("price_breakdown")).toBe(true);
  });

  it("세 감사 값이 모두 insert 대상에 들어 있다", () => {
    const inserted = insertedColumns();
    for (const c of ["price_breakdown", "channel_price_record", "brand_resolution"]) {
      expect(inserted, `${c} 가 insert 에서 빠졌다`).toContain(c);
    }
  });

  /**
   * 🔴 이 순서 자체는 «옳다» — 마이그레이션 미적용 환경에서도 payload/response
   *    같은 핵심 데이터를 살리려는 우아한 저하다. 바꾸지 않는다.
   *    다만 그 대가가 「뒤쪽 칸 하나 때문에 앞쪽 칸이 먼저 죽는다」라는 것을
   *    여기 적어 둔다 — 다음 사람이 순서를 볼 때 이 비용을 같이 보게 한다.
   */
  it("버리는 순서가 기록돼 있다 — 뒤쪽 칸이 없으면 앞쪽 칸이 «먼저» 죽는다", () => {
    const order = optionalColumns();
    expect(order.indexOf("channel_price_record")).toBeLessThan(order.indexOf("price_breakdown"));
    expect(order.indexOf("brand_resolution")).toBeLessThan(order.indexOf("price_breakdown"));
    // 이 배열의 모든 칸도 당연히 마이그레이션이 있어야 한다.
    const migrated = migratedColumns();
    expect(order.filter((c) => !migrated.has(c))).toEqual([]);
  });
});
