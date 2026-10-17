/** WU-051 — 원상품 3건(AC009 · AC042 · AC043)을 하니스 입력으로 덤프한다. 🔴 읽기 전용. */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const p = new PrismaClient();
/** 🔴 AC042 는 id 를 모른다 — 제목/품번으로 찾는다(추측 금지). */
const rows = await p.$queryRawUnsafe(
  `select id, source_url, title, workspace->'canonicalProduct' as canonical_product
     from product_snapshots
    where id = any($1::uuid[])
       or source_url ilike '%b226ac042%'
       or workspace->'canonicalProduct'->>'brandModelCode' ilike '%B226AC042%'
    order by created_at desc`,
  ["c1b54b9a-f325-415e-b338-eeae08c3c814", "cd93efd9-6c34-42a3-b733-d1178e968113"],
);
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "wu-051-origins.json"), JSON.stringify(rows, null, 2));
console.log("rows:", rows.length);
for (const r of rows)
  console.log(
    r.id, "|", (r.title ?? "").slice(0, 50), "|", (r.source_url ?? "").slice(0, 60),
    "| brand=", JSON.stringify(r.canonical_product?.brand?.value),
    "| code=", JSON.stringify(r.canonical_product?.brandModelCode),
  );
await p.$disconnect();
