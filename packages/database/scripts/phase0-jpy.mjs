/** 🔵 PHASE 0 — JPY 관측 11행의 출처와 Smallable 관측 부재 확인. READ-ONLY. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const jpy = await p.$queryRawUnsafe(`
  select market_country, source, count(*)::int as n,
         min(checked_at) as lo, max(checked_at) as hi,
         (array_agg(distinct split_part(split_part(source_product_url,'//',2),'/',1)))[1:3] as hosts
  from price_observations where currency='JPY'
  group by market_country, source order by n desc
`);
console.log("=== JPY 관측 ===");
for (const r of jpy) console.log(`  mc=${String(r.market_country ?? '-').padEnd(4)} src=${String(r.source).padEnd(14)} n=${r.n} ${String(r.lo).slice(0,10)}~${String(r.hi).slice(0,10)} ${JSON.stringify(r.hosts)}`);
const sm = await p.$queryRawUnsafe(`
  select count(*)::int as n, count(market_country)::int as with_mc,
         (array_agg(distinct currency))[1:5] as cur
  from price_observations where source_product_url ilike '%smallable%'
`);
console.log("\n=== Smallable 관측 전체 ===", JSON.stringify(sm[0]));
await p.$disconnect();
