import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const t of ["domestic_product_links", "price_observations"]) {
  const r = await p.$queryRawUnsafe(
    `select column_name, data_type from information_schema.columns where table_name = $1 order by ordinal_position`, t);
  console.log("=== " + t + " ===");
  console.log("  " + r.map((x) => x.column_name).join(" · "));
}
await p.$disconnect();
