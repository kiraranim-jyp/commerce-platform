/** WU-040 — 소싱 후보 ↔ 가격비교 연결 추적. 🔴 읽기 전용. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = async (t, sql, ...a) => { const r = await p.$queryRawUnsafe(sql, ...a); console.log("\n=== " + t + " (" + r.length + ") ==="); for (const x of r) console.log("  " + JSON.stringify(x)); return r; };

await q("① B226AC042 / AC043 스냅샷",
  `select id, source_url, title,
          workspace->'canonicalProduct'->'brand'->>'value' as brand, created_at
     from product_snapshots where source_url ilike '%b226ac04%' order by created_at desc limit 6`);

await q("② sourcing_candidates 칸",
  `select column_name from information_schema.columns
    where table_name='sourcing_candidates' order by ordinal_position`);

await q("③ 최근 등록된 소싱 후보 (CEO 가 넣은 LF·dmont)",
  `select product_id, source_site, source_url, price_amount, currency, identity_match_truth, created_at
     from sourcing_candidates order by created_at desc limit 6`);

await q("④ 소싱 후보 ↔ domestic_product_links 교집합 (연결 증거)",
  `select count(*)::int n from domestic_product_links l
     where l.external_url in (select source_url from sourcing_candidates)`);
await p.$disconnect();
