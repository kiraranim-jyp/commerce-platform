/** 🔵 PHASE 1 — Smallable 관측의 market_code / market_country 분포. READ-ONLY. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.$queryRawUnsafe(`
  select coalesce(market_code,'(null)') as mc, coalesce(market_country,'(null)') as cty,
         currency, count(*)::int as n, min(price_amount)::float as lo, max(price_amount)::float as hi,
         max(checked_at) as last
  from price_observations where source_product_url ilike '%smallable%'
  group by 1,2,3 order by n desc
`);
console.log("=== Smallable: market_code × market_country × currency ===");
for (const x of r) console.log(`  code=${String(x.mc).padEnd(8)} country=${String(x.cty).padEnd(8)} ${x.currency} n=${String(x.n).padEnd(4)} ${x.lo}~${x.hi}  last=${String(x.last).slice(0,10)}`);
await p.$disconnect();
