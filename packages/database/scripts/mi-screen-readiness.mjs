/** 🔵 MI 통합 — 「한 화면에 무엇이 나오는가」를 운영 산출물로 센다. READ-ONLY. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.$queryRawUnsafe(`
  select snapshot_id, origin_code,
         count(*)::int as cand,
         count(*) filter (where market='KR')::int as kr,
         count(*) filter (where market='OVERSEAS')::int as os,
         count(*) filter (where market is null or market='UNKNOWN')::int as unk,
         count(*) filter (where price_amount is not null)::int as priced,
         count(*) filter (where price_status='VERIFIED_CURRENT')::int as verified,
         count(*) filter (where price_tier in ('EXACT','COMPARISON'))::int as money_tier,
         count(*) filter (where system_verdict='SAME')::int as same,
         count(*) filter (where human_verdict is not null)::int as human,
         max(first_seen_at) as last
  from candidate_reviews group by 1,2
  order by max(first_seen_at) desc limit 12
`);
console.log("=== 최근 스냅샷 12개 — 화면 한 장이 받는 것 ===");
console.log("  snapshot  origin        후보  🇰🇷  🌎  ❔  가격  검증  tier자격 SAME  사람  최근");
for (const x of r)
  console.log(
    `  ${String(x.snapshot_id).slice(0,8)}  ${String(x.origin_code ?? '-').padEnd(12)} ` +
    `${String(x.cand).padStart(4)} ${String(x.kr).padStart(3)} ${String(x.os).padStart(3)} ${String(x.unk).padStart(3)} ` +
    `${String(x.priced).padStart(5)} ${String(x.verified).padStart(5)} ${String(x.money_tier).padStart(7)} ` +
    `${String(x.same).padStart(5)} ${String(x.human).padStart(5)}  ${String(x.last).slice(4,10)}`,
  );
const agg = await p.$queryRawUnsafe(`
  select count(distinct snapshot_id)::int as snaps,
         count(*) filter (where market='KR')::int as kr_total,
         count(distinct snapshot_id) filter (where market='KR')::int as snaps_with_kr,
         count(*) filter (where market='OVERSEAS')::int as os_total
  from candidate_reviews
`);
console.log("\n=== 전수 ===", JSON.stringify(agg[0]));
await p.$disconnect();
