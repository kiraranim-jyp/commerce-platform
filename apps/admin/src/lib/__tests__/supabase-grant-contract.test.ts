import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SUPABASE-GRANT-01 ② — **새 `public` 테이블은 «같은 migration 안에서» 권한을 적는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 배경(Supabase 변경 · 2026-10-30): 그 날 이후 `public` 에 **새로 만드는** 테이블은
 *    명시적 `GRANT` 가 없으면 Data API(PostgREST/GraphQL/supabase-js)에서 접근 불가.
 *    🟢 **기존 테이블의 현재 권한은 유지** 된다 ⟹ 이 계약은 **앞으로의 migration** 만 본다.
 *
 * 🔴🔴 **이 계약은 DB 를 바꾸지 않는다** — 파일 검사다. 운영 GRANT 축소/확대 **0**.
 *
 * ── 🔴 CPO 가 고정한 경계 ──────────────────────────────────────────────────
 * ```
 * ❌ 모든 테이블에 **같은** GRANT 를 강제하지 않는다 — 테이블별 실제 소비 role 에 맞춘다
 * ❌ 기존 테이블을 **소급 수정하지 않는다** ⟹ 아래 LEGACY 목록으로 고정한다
 * ❌ `grant ... on all tables in schema public to anon, ...` 류 전체 공개식 금지
 * 🔴 `anon` 에 CRUD 를 무차별 부여하지 않는다(메일 예시를 그대로 쓰지 않는다)
 * ```
 *
 * 🟢 실측 근거(2026-10-21 · `supabase-grant-audit.mjs`): anon 경로의
 *    `.from`/`.rpc` 호출이 **0건** 이다 ⟹ 새 테이블에 `anon` 권한이 필요한 경우는
 *    **현재 코드베이스에 없다**. 그래서 아래 D 가 `anon` 을 **기본 금지** 로 둔다.
 */

/**
 * 🔴 이 파일이 `packages/database` 가 아니라 여기 있는 이유 — vitest `include` 가
 *    database 패키지를 **수집하지 않는다**(crawler·pricing·shared·category·listing 만).
 *    🔴 거기 두면 「계약이 있는데 한 번도 안 돈다」가 된다
 *    (메모 `local-toolchain-silent-noops` 와 같은 함정 · 실제로 1차에 그렇게 됐다).
 * 🟢 이 테스트는 **파일만 읽으므로** 위치가 판정에 영향을 주지 않는다.
 */
const DB = path.resolve(__dirname, "..", "..", "..", "..", "..", "packages", "database", "prisma");
const MIG_DIR = path.join(DB, "migrations_manual");
const INIT_DIR = path.join(DB, "migrations", "20260716012739_init");

/** 주석을 벗긴다 — 주석에 적힌 `grant` 를 배선으로 읽으면 가드가 거짓 통과한다(헌장 §5). */
const strip = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\/|--.*$/gm, "");

function sqlFiles(dir: string): { name: string; sql: string }[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  } catch {
    return [];
  }
  return names.map((name) => ({ name, sql: strip(readFileSync(path.join(dir, name), "utf8")) }));
}

const CREATE_PUBLIC_TABLE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?("?[a-z_][a-z0-9_]*"?)/gi;

function createsPublicTable(sql: string): string[] {
  /** 🔴 `create temp table` 은 `public` 이 아니다 — 세지 않는다. */
  if (/create\s+(temp|temporary|unlogged)\s+table/i.test(sql)) return [];
  return [...sql.matchAll(CREATE_PUBLIC_TABLE)].map((m) => m[1].replace(/"/g, ""));
}

/**
 * 🔴🔴 **기존 migration 은 소급 수정하지 않는다**(CPO 명시). 그래서 지금 시점에
 *    `create table` 을 가진 파일을 **예외로 고정** 한다.
 * 🔴 이 목록은 **줄어드는 방향으로만** 바뀐다 — 새 파일을 여기 추가하면
 *    아래 C 가 FAIL 한다(그래야 계약이 우회되지 않는다).
 */
/**
 * 🔴🔴🔴 **1차 구현의 구멍 — 음성 대조가 잡았다.**
 *    처음에는 이 집합을 **파일에서 파생** 했다(`create table` 을 가진 파일을 전부 LEGACY).
 *    🔴 그러면 **새 파일이 `create table` 을 가지면 자동으로 면제** 되어 B-1/B-2 를
 *    건너뛴다 — 실제로 GRANT·RLS 가 **둘 다 없는** probe 파일이 **통과했다**.
 * 🟢 그래서 **이름을 박았다.** 새 파일은 이 목록에 없으므로 **반드시** B-1/B-2 를 지난다.
 * 🔴 이 목록은 **줄어드는 방향으로만** 바뀐다 — 추가는 소급 수정이고 CPO 금지다.
 */
const LEGACY = new Set([
  "001_coupang_seller_settings.sql",
  "002_support_inquiries.sql",
  "003_registration_attempts.sql",
  "004_coupang_seller_profiles.sql",
  "005_coupang_description_templates.sql",
  "008_brand_dictionary.sql",
  "014_coupang_brand_profiles.sql",
  "016_product_snapshots.sql",
  "017_image_assets.sql",
  "019_comparison_shops.sql",
  "023_commerce_accounts.sql",
  "024_seller_compliance_confirmations.sql",
  "025_job_key.sql",
  "027_price_observations.sql",
  "028_audit_log.sql",
  "029_domestic_price_sources.sql",
  "031_price_observations_schema_reload.sql",
  "039_price_alerts.sql",
  "042_market_signal_cache.sql",
  "043_workspaces_and_snapshot_ownership.sql",
  "045_exchange_rates.sql",
  "047_workspace_domestic_shop_settings.sql",
  "057_vision_observations.sql",
  "058_lotteon_seller_settings.sql",
  "059_seller_settings.sql",
  "063_product_identity_and_channel_product.sql",
  "075_sourcing_candidates.sql",
  "078_commerce_egress.sql",
  "079_candidate_reviews.sql",
  "migration.sql",
]);

describe("SUPABASE-GRANT-01 ② — 신규 migration 권한 계약", () => {
  it("🟢 A-1 migration 디렉터리를 실제로 읽었다 (경로 추측 금지)", () => {
    const all = [...sqlFiles(MIG_DIR), ...sqlFiles(INIT_DIR)];
    expect(all.length, "migration .sql 을 하나도 못 읽었다 — 경로가 틀렸다").toBeGreaterThan(0);
  });

  it("🟢 A-2 기존 `create table` 파일을 예외로 «고정» 했다 (소급 수정 금지)", () => {
    /** 🔴 실측(2026-10-21): 그런 파일이 존재한다. 0 이면 LEGACY 가 비어 계약이 무력해진다. */
    expect(LEGACY.size).toBeGreaterThan(0);
  });

  it("🔴🔴 B-1 **새** migration 이 public 테이블을 만들면 같은 파일에 RLS 가 있다", () => {
    for (const f of sqlFiles(MIG_DIR)) {
      if (LEGACY.has(f.name)) continue;
      const tables = createsPublicTable(f.sql);
      if (tables.length === 0) continue;
      expect(
        /enable\s+row\s+level\s+security/i.test(f.sql),
        `${f.name}: public 테이블(${tables.join(",")})을 만드는데 RLS 를 켜지 않았다`,
      ).toBe(true);
    }
  });

  it("🔴🔴 B-2 **새** migration 이 public 테이블을 만들면 같은 파일에 GRANT 가 있다", () => {
    for (const f of sqlFiles(MIG_DIR)) {
      if (LEGACY.has(f.name)) continue;
      const tables = createsPublicTable(f.sql);
      if (tables.length === 0) continue;
      /**
       * 🔴 2026-10-30 이후 명시적 GRANT 가 없으면 Data API 에서 보이지 않는다.
       * 🔴 「필요 없다」면 **그 사실을 주석이 아니라 코드로** 적어야 한다 —
       *    `grant select on … to authenticated;` 처럼 최소 권한 한 줄.
       */
      expect(
        /\bgrant\b/i.test(f.sql),
        `${f.name}: public 테이블(${tables.join(",")})을 만드는데 명시적 GRANT 가 없다`,
      ).toBe(true);
    }
  });

  it("🔴🔴 C-1 LEGACY 목록이 실제 파일과 «일치» 한다 (유령 면제 금지)", () => {
    /**
     * 🔴 목록에 있는데 **파일이 없으면** 그 면제는 유령이고, 누군가 그 이름으로 새
     *    파일을 만들면 **조용히 면제** 된다. 🟢 그래서 양방향으로 맞춘다.
     * 🔴 실측(2026-10-21): `create table` 을 가진 기존 파일은 **30개** 다.
     */
    const present = new Set([...sqlFiles(MIG_DIR), ...sqlFiles(INIT_DIR)].map((f) => f.name));
    for (const name of LEGACY) {
      expect(present.has(name), `LEGACY 에 있는데 파일이 없다: ${name}`).toBe(true);
    }
    expect(LEGACY.size).toBe(30);
  });

  it("🔴🔴 D-1 **전체 공개식 GRANT 를 쓰지 않는다** (CPO 금지 · 메일 예시 그대로 금지)", () => {
    for (const f of [...sqlFiles(MIG_DIR), ...sqlFiles(INIT_DIR)]) {
      expect(
        /grant[\s\S]{0,80}on\s+all\s+tables\s+in\s+schema\s+public/i.test(f.sql),
        `${f.name}: \`on all tables in schema public\` 류 전체 공개식 GRANT`,
      ).toBe(false);
    }
  });

  it("🔴🔴 D-2 `anon` 에 쓰기 권한을 주지 않는다 (실측: anon 경로의 테이블 접근 0건)", () => {
    for (const f of [...sqlFiles(MIG_DIR), ...sqlFiles(INIT_DIR)]) {
      for (const m of f.sql.matchAll(/grant\s+([^;]*?)\s+on\s+[^;]*?\bto\b([^;]*);/gi)) {
        const privs = m[1].toLowerCase();
        const roles = m[2].toLowerCase();
        if (!/\banon\b/.test(roles)) continue;
        for (const w of ["insert", "update", "delete", "truncate", "all"]) {
          expect(privs.includes(w), `${f.name}: anon 에 ${w.toUpperCase()} 를 줬다`).toBe(false);
        }
      }
    }
  });

  it("🔴 D-3 default privilege 를 migration 에서 바꾸지 않는다 (CPO: 임의 revoke 금지)", () => {
    for (const f of [...sqlFiles(MIG_DIR), ...sqlFiles(INIT_DIR)]) {
      expect(/alter\s+default\s+privileges/i.test(f.sql), `${f.name}: ALTER DEFAULT PRIVILEGES`).toBe(
        false,
      );
    }
  });
});
