/**
 * WU-130 — 합류 E2E 하니스가 쓰는 **읽기 전용** 원상품 덤프.
 *
 * 🔴 READ ONLY · DB 쓰기 0 · 외부 API 0 · AI 0.
 * 🔴🔴 실측(2026-10-20): **`b226ac010` 스냅샷은 DB 에 없다**(전수 검색 — `ac010`·`pop-t-shirt`
 *    패턴 0건). 그래서 두 번째 상품을 **실재하는 `b226ac042`**(Mystery BC half zipped
 *    sweatshirt)로 바꿨다. 🔴 보고에 「B226AC010 으로 E2E 했다」고 적지 않는다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-130-snapshot-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(OUT, { recursive: true });
const pick = async (code) =>
  (await prisma.$queryRawUnsafe(
    `select id, source_url, title, workspace_id, workspace, created_at
       from product_snapshots where source_url ilike '%${code}%'
      order by created_at desc limit 1`,
  ))[0] ?? null;
const a = await pick("b226ac042");
const b = await pick("b226ac009");
for (const [k, r] of [["S1 b226ac042", a], ["S2 b226ac009", b]]) {
  if (!r) { console.log(`${k}: 없음`); continue; }
  const cp = r.workspace?.canonicalProduct ?? null;
  console.log(`${k}: ${r.id}\n  title=${r.title}\n  url=${r.source_url}\n  brand=${JSON.stringify(cp?.brand?.value ?? null)} color=${JSON.stringify(cp?.color?.value ?? null)} sku=${JSON.stringify(cp?.sku?.value ?? null)} mcat=${JSON.stringify(r.workspace?.marketCategoryProfileId ?? null)}`);
}
writeFileSync(path.join(OUT, "wu130-two.json"), JSON.stringify({ s1: a, s2: b }, (_k,v)=> typeof v==="bigint"?Number(v):v, 1), "utf8");
console.log("\n🟢 wu130-two.json 기록 (DB 쓰기 0)");
await prisma.$disconnect();
