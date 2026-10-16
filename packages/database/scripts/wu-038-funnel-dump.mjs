/**
 * WU-038 — **「유사상품 11개」가 왜 11개인가** 를 실제 상품 하나로 전수 추적한다.
 * 🔴 읽기 전용. 새 스키마 0 · 쓰기 0 · AI 0 · 외부 HTTP 0.
 * 사용법: node --env-file=.env scripts/wu-038-funnel-dump.mjs <검색어>
 */
import { PrismaClient } from "@prisma/client";
const needle = process.argv[2] ?? "b226ac043";
const prisma = new PrismaClient();
const c = { query: async (sql, params = []) => ({ rows: await prisma.$queryRawUnsafe(sql, ...params) }), end: () => prisma.$disconnect() };
const show = (t, rows) => { console.log("\n=== " + t + " (" + rows.length + ") ==="); for (const r of rows) console.log("  " + JSON.stringify(r)); };

const snaps = (await c.query(
  `select id, title, source_url, status, created_at,
          workspace->'canonicalProduct'->'brand'->>'value' as brand
     from product_snapshots
    where source_url ilike $1 or title ilike $1
    order by created_at desc limit 5`, ["%" + needle + "%"])).rows;
show("원상품 스냅샷", snaps);
if (!snaps.length) { await c.end(); process.exit(0); }
const id = snaps[0].id;

show("① 저장된 국내 링크 domestic_product_links", (await c.query(
  `select l.match_truth, l.cross_seller_verdict, l.status, l.matched_brand, l.external_url
     from domestic_product_links l
    where l.snapshot_id = $1::uuid order by l.match_truth`, [id])).rows);

show("② 가격 관측 price_observations", (await c.query(
  `select source, count(*)::int n, min(price_krw)::int min_krw, max(checked_at) last
     from price_observations where snapshot_id = $1::uuid group by source order by n desc`, [id])).rows);

show("③ 해외 비교 후보 (저장되는가)", (await c.query(
  `select table_name from information_schema.tables
    where table_schema='public' and table_name ilike '%comparison%'`, [])).rows);

show("④ 같은 브랜드 다른 상품의 링크 보유 현황(대조군)", (await c.query(
  `select ps.title, count(l.id)::int links
     from product_snapshots ps
     left join domestic_product_links l on l.snapshot_id = ps.id
    where ps.workspace->'canonicalProduct'->'brand'->>'value' ilike '%bobo%'
    group by ps.id, ps.title having count(l.id) > 0 order by links desc limit 8`, [])).rows);

await c.end();
