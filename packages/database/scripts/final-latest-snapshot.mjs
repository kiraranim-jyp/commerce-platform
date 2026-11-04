import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.$queryRawUnsafe(`
  select snapshot_id, origin_code,
         count(*)::int as n,
         count(*) filter (where price_amount is not null)::int as priced,
         count(*) filter (where price_status is not null)::int as status_filled,
         count(distinct market)::int as markets,
         count(*) filter (where market='KR')::int as kr,
         max(first_seen_at) as latest
  from candidate_reviews
  where snapshot_id is not null and price_status is not null
  group by snapshot_id, origin_code
  order by markets desc, priced desc, latest desc limit 10`);
console.log("═══ price_status 가 채워진 스냅샷 (시장 다양성·가격 순) ═══");
for (const x of r) {
  console.log(`  ${String(x.snapshot_id).slice(0,8)} ${String(x.origin_code).padEnd(12)} 후보 ${String(x.n).padStart(3)} · 가격 ${String(x.priced).padStart(3)} · status채움 ${String(x.status_filled).padStart(3)} · 시장 ${x.markets}(KR ${x.kr}) · ${String(x.latest).slice(0,16)}`);
}
await p.$disconnect();
