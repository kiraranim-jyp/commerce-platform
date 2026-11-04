/** FINAL QUALITY GATE ④ — price_status null 이 «운영 상태» 인가 «저장 artifact» 인가 (READ-ONLY) */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const d = await p.$queryRawUnsafe(`
  select coalesce(price_status,'(null)') as status,
         count(*)::int as n,
         min(first_seen_at) as first, max(first_seen_at) as last
  from candidate_reviews where price_amount is not null
  group by 1 order by n desc`);
console.log("═══ 가격 보유 행의 price_status 분포 (전수) ═══");
for (const r of d) {
  console.log(`  ${String(r.status).padEnd(20)} ${String(r.n).padStart(4)}건 · ${String(r.first).slice(0,16)} → ${String(r.last).slice(0,16)}`);
}
const tot = await p.$queryRawUnsafe(`select count(*)::int as n from candidate_reviews where price_amount is not null`);
console.log(`  합계 ${tot[0].n}`);

console.log("\n═══ 🔴 null 이 «시간대» 로 갈리는가(저장 결함이면 경계가 보인다) ═══");
const t = await p.$queryRawUnsafe(`
  select date_trunc('day', first_seen_at) as day,
         count(*) filter (where price_status is null)::int as nulls,
         count(*) filter (where price_status is not null)::int as filled
  from candidate_reviews where price_amount is not null
  group by 1 order by 1`);
for (const r of t) console.log(`  ${String(r.day).slice(0,10)}  null ${String(r.nulls).padStart(3)} · 채워짐 ${String(r.filled).padStart(3)}`);
await p.$disconnect();
