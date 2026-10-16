/** WU-038 — 실제 원상품 스냅샷 2건을 하니스 입력으로 덤프한다. 🔴 읽기 전용. */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const p = new PrismaClient();
const ids = ["c1b54b9a-f325-415e-b338-eeae08c3c814", "cd93efd9-6c34-42a3-b733-d1178e968113"];
const rows = await p.$queryRawUnsafe(
  `select id, source_url, title, workspace->'canonicalProduct' as canonical_product
     from product_snapshots where id = any($1::uuid[])`, ids);
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "wu-038-origins.json"), JSON.stringify(rows, null, 2));
for (const r of rows) console.log(r.id, "|", r.title, "|", r.source_url, "| brand=", JSON.stringify(r.canonical_product?.brand?.value));
await p.$disconnect();
