import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
for (const id of ["c27d4727-2248-4fe0-9084-8c239737a889"]) {
  const r = await p.$queryRawUnsafe(
    `select id::text as id, source_url, title, status from product_snapshots where id=$1::uuid`, id);
  for (const x of r) console.log("원상품:", x.source_url, "\n  title:", x.title, "| status:", x.status);
}
const q = await p.$queryRawUnsafe(
  `select id::text as id, source_url, title, status, updated_at
     from product_snapshots
    where upper(coalesce(workspace->'canonicalProduct'->'sku'->>'value','')) in ('B226AC009','B226AC010')
    order by updated_at desc limit 6`);
console.log("\n=== B226AC009 / AC010 스냅샷 ===");
for (const x of q) console.log(" ", x.id, "|", x.status, "|", String(x.source_url).slice(0,95));
await p.$disconnect();
