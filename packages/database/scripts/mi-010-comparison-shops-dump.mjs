/**
 * WU-010 ③ — `comparison_shops` **읽기 전용** 덤프 (해외 비교 경로의 대상 목록)
 *
 * 🔴 READ ONLY · 외부 API 0 · Gemini 0 · AI 0 · 가격 추정/환산 0.
 *
 * 왜 필요한가 — 해외 비교 경로가 화면에 후보를 넣는다:
 *   ComparisonShopSearch.tsx:218 → POST /api/comparison/search
 *     → listComparisonShops().filter(isActive && isCollectableAccess && sourceFitsScopes)
 *     → searchComparisonShops → attachProductMatchTruth → mayShowCandidate
 * 🔴 `listComparisonShops()` 는 service-role 이 필요해 로컬에서 부를 수 없다(헌장 §10).
 *    그래서 **같은 행** 을 DB 에서 읽어 하니스가 운영 «필터» 를 그대로 적용한다.
 *
 * 🔴 칸 이름을 추측하지 않는다 — `enabled` 는 **없고** `is_active` 다(42703 실측).
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mi-010-comparison-shops-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

async function main() {
  mkdirSync(OUT, { recursive: true });

  const cols = (
    await prisma.$queryRawUnsafe(
      `select column_name from information_schema.columns
        where table_name = 'comparison_shops' order by ordinal_position`,
    )
  ).map((r) => r.column_name);
  console.log("칸:", cols.join(", "));

  const rows = await prisma.$queryRawUnsafe(
    `select id, name, domain, url, country, currency, is_active, access_status,
            category_scope, source_role
       from comparison_shops order by domain`,
  );

  writeFileSync(
    path.join(OUT, "wu010-comparison-shops.json"),
    JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1),
    "utf8",
  );

  console.log(`\n전수 ${rows.length}행`);
  const active = rows.filter((r) => r.is_active);
  console.log(`is_active=true  ${active.length}`);
  const bobo = rows.find((r) => String(r.domain).includes("bobochoses"));
  console.log(
    `🔴 bobochoses.com — ${bobo ? `is_active=${bobo.is_active} · access=${bobo.access_status} · scope=${JSON.stringify(bobo.category_scope)}` : "(없음)"}`,
  );
  console.log("\n🟢 wu010-comparison-shops.json 기록 완료 (DB 쓰기 0)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
