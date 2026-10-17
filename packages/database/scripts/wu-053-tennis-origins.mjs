/** WU-053 — Sergio Tacchini 원상품(테니스) 스냅샷을 하니스 입력으로 덤프한다. 🔴 읽기 전용. */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(
  `select id, source_url, title, workspace->'canonicalProduct' as canonical_product
     from product_snapshots
    where source_url ilike '%tennis-warehouse%'
    order by created_at desc
    limit 8`,
);
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "wu-053-tennis-origins.json"), JSON.stringify(rows, null, 2));
console.log("rows:", rows.length);
for (const r of rows)
  console.log(
    " ", r.id, "|", (r.title ?? "").slice(0, 46),
    "| sku=", JSON.stringify(r.canonical_product?.sku),
    "| brand=", JSON.stringify(r.canonical_product?.brand?.value),
    "|", (r.source_url ?? "").slice(0, 72),
  );
await p.$disconnect();
