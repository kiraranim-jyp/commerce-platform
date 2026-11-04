import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const show = (v) => (v === null || v === undefined || String(v).trim() === "" ? "🔴 비어 있음" : `🟢 ${String(v).slice(0, 34)}`);
const rows = await p.$queryRawUnsafe(`select * from coupang_seller_profiles`);
console.log("coupang_seller_profiles 행 수:", rows.length);
for (const r of rows) {
  console.log("\n═══ row ═══");
  for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(36)} ${show(v)}`);
}
await p.$disconnect();
