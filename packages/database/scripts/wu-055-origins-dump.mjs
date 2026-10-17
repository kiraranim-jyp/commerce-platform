/** WU-055 — GT 6개 원상품 스냅샷을 source_url 로 찾아 덤프한다. 🔴 읽기 전용. */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const p = new PrismaClient();
const out = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const gt = JSON.parse(readFileSync(path.join(out, "wu-036-3way.json"), "utf8")).rows;
const origins = [...new Set(gt.map((r) => r.originUrl))];
/** 🔴 `=` 로 못 찾을 수 있다(쿼리/로케일) — handle 조각으로도 찾는다. */
const rows = await p.$queryRawUnsafe(
  `select id, source_url, title, workspace->'canonicalProduct' as canonical_product
     from product_snapshots where source_url = any($1::text[]) order by created_at desc`,
  origins,
);
const found = new Set(rows.map((r) => r.source_url));
const missing = origins.filter((o) => !found.has(o));
writeFileSync(path.join(out, "wu-055-origins.json"), JSON.stringify(rows, null, 2));
console.log("origins 요청:", origins.length, "· 찾음:", rows.length, "· 미발견:", missing.length);
for (const r of rows)
  console.log(
    " 🟢", r.id, "|", (r.title ?? "").slice(0, 40),
    "| brand=", JSON.stringify(r.canonical_product?.brand?.value),
    "| id=", JSON.stringify(r.canonical_product?.identifier?.value ?? null),
  );
for (const m of missing) console.log(" 🔴 미발견:", m.slice(0, 92));
await p.$disconnect();
