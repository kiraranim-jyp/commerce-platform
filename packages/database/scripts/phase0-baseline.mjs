/** 🔵 PHASE 0 기준선 — Smallable 시장 관측의 통화 분포(문서의 「45행 전부 EUR」 재확인). READ-ONLY. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select market_country, currency, count(*)::int as n,
         min(price_amount)::float as lo, max(price_amount)::float as hi
  from price_observations
  where source_product_url ilike '%smallable%' and market_country is not null
  group by market_country, currency order by market_country, currency
`);
console.log("=== Smallable 시장 관측 (market_country × currency) ===");
for (const r of rows) console.log(`  ${String(r.market_country).padEnd(4)} ${String(r.currency).padEnd(5)} n=${String(r.n).padEnd(4)} ${r.lo}~${r.hi}`);
console.log("  합계 행:", rows.reduce((s, r) => s + r.n, 0));
const other = await p.$queryRawUnsafe(`
  select currency, count(*)::int as n from price_observations
  where market_country is not null group by currency order by n desc
`);
console.log("\n=== 전체 시장 관측 통화 분포 ===");
for (const r of other) console.log(`  ${String(r.currency).padEnd(5)} ${r.n}`);
await p.$disconnect();
