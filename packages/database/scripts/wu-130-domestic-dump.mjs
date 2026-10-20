/**
 * WU-130 ② — 국내 자동검색 경로 실측용 **읽기 전용** 덤프.
 * 🔴 READ ONLY · DB 쓰기 0 · 외부 API 0 · AI 0.
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-130-domestic-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(OUT, { recursive: true });

const cols = async (t) =>
  (await prisma.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_name='${t}' order by ordinal_position`,
  )).map((r) => r.column_name);
console.log("domestic_price_sources:", (await cols("domestic_price_sources")).join(", "));
console.log("workspace_domestic_shop_settings:", (await cols("workspace_domestic_shop_settings")).join(", "));

const sources = await prisma.$queryRawUnsafe(`select * from domestic_price_sources order by domain`);
const settings = await prisma.$queryRawUnsafe(`select * from workspace_domestic_shop_settings`);
const links = await prisma.$queryRawUnsafe(
  `select l.*, s.domain as source_domain, s.name as source_name
     from domestic_product_links l join domestic_price_sources s on s.id = l.source_id
    order by l.updated_at desc limit 200`,
);
writeFileSync(
  path.join(OUT, "wu130-domestic.json"),
  JSON.stringify({ sources, settings, links }, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1),
  "utf8",
);
console.log(`\n등록부 ${sources.length}행 · workspace 설정 ${settings.length}행 · 링크 ${links.length}행`);
console.log("🟢 wu130-domestic.json 기록 (DB 쓰기 0)");
await prisma.$disconnect();
