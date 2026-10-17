/** WU-056-R — 화면의 「≈ ₩58,000」이 어느 저장 관측에서 왔는지 확인한다. 🔴 읽기 전용. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(
  `select source, source_label, currency, price_amount, price_krw, exchange_rate, market_code, checked_at
     from price_observations
    where currency = 'EUR' and price_amount between 39 and 41
    order by checked_at desc limit 8`,
);
console.log("EUR 39~41 관측 행:", rows.length);
for (const r of rows)
  console.log(
    " ", String(r.source).padEnd(14), String(r.source_label ?? "-").padEnd(22),
    `${r.currency} ${r.price_amount}`.padEnd(12),
    "priceKrw=" + String(r.price_krw).padEnd(10),
    "rate=" + String(r.exchange_rate ?? "-").padEnd(10),
    "market=" + String(r.market_code ?? "-"),
  );
await p.$disconnect();
