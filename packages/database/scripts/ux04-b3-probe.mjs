/**
 * CANDIDATE-UX-REFINE-04 B-3 — 착수 전 전제 C-2 ① 확인 (read-only)
 * 「migration 081 의 세 칸이 실제로 조회되는가 · 분모가 얼마인가」
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const cols = await p.$queryRawUnsafe(
  `select column_name, data_type, is_nullable from information_schema.columns
     where table_name = 'candidate_reviews' order by ordinal_position`,
);
console.log("=== candidate_reviews 칸 전수 ===");
console.log("  " + cols.map((c) => c.column_name).join(" · "));
for (const c of cols.filter((c) => ["price_status", "sold_out", "match_reasons"].includes(c.column_name))) {
  console.log(`  🔵 ${c.column_name} ${c.data_type} nullable=${c.is_nullable}`);
}

const agg = await p.$queryRawUnsafe(
  `select count(*)::int total,
          count(price_status)::int ps,
          count(sold_out)::int so,
          count(match_reasons)::int mr,
          count(price_tier)::int pt,
          count(*)::int - count(price_tier)::int as pt_null
     from candidate_reviews`,
);
console.log("=== 전체 집계 ===", agg[0]);

const bysrc = await p.$queryRawUnsafe(
  `select source, count(*)::int n, count(price_status)::int ps
     from candidate_reviews group by source order by n desc`,
);
console.log("=== source 분포 ===");
for (const r of bysrc) console.log(`  ${r.source}: ${r.n}행 (price_status ${r.ps})`);

const snap = await p.$queryRawUnsafe(
  `select snapshot_id, count(*)::int n, count(price_status)::int ps, count(price_tier)::int pt
     from candidate_reviews where snapshot_id is not null
     group by snapshot_id order by ps desc, n desc limit 6`,
);
console.log("=== 스냅샷별 상위 6 ===");
for (const r of snap) console.log(`  ${r.snapshot_id}: ${r.n}행 · price_status ${r.ps} · price_tier ${r.pt}`);

const sample = await p.$queryRawUnsafe(
  `select candidate_url, price_status, sold_out, match_reasons, price_tier, source, market, system_verdict
     from candidate_reviews where price_status is not null limit 4`,
);
console.log("=== price_status 가 실제로 있는 행 ===");
for (const r of sample) console.log("  " + JSON.stringify(r));

/** 🔴 같은 스냅샷 안에 같은 candidate_url 이 둘인 행이 있는가(중복 위험 실측) */
const dup = await p.$queryRawUnsafe(
  `select snapshot_id, candidate_url, count(*)::int n from candidate_reviews
     where snapshot_id is not null group by snapshot_id, candidate_url having count(*) > 1 limit 5`,
);
console.log("=== (snapshot_id, candidate_url) 중복 ===", dup.length === 0 ? "0건" : dup);

await p.$disconnect();
