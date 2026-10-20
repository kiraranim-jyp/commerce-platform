/**
 * WU-133 — **읽기 전용** GT 원상품 가용성 덤프
 *
 * 🔴 READ ONLY · DB 쓰기 0 · 외부 API 0 · AI 0 · schema 0.
 *
 * 🔴🔴 **왜 이것이 1단계인가** — human SAME GT 를 「현재 시스템에서 재현되는가」로
 *    추적하려면 **그 원상품 스냅샷이 DB 에 있어야** 한다. 없으면 그 GT 는
 *    「MI 가 못 잡았다」가 아니라 **「측정 자체가 불가능」** 이다. 🔴 그 둘을 섞으면
 *    「MI 실패 N건」이라는 거짓 숫자가 나온다(WU-102 의 분모 오류와 같은 계열).
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-133-gt-origin-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(OUT, { recursive: true });

/** 🔴 GT 에 등장하는 원상품 축 전부(코드에 박지 않고 인자로 받는다). */
const ORIGINS = (process.env.WU_133_ORIGINS ?? "B226AC009,B226AC010,B226AC042").split(",");

const found = {};
for (const code of ORIGINS) {
  const lower = code.toLowerCase();
  /**
   * 🔴 **칸 이름을 추측하지 않는다** — `product_snapshots` 의 원상품 식별은
   *    `source_url`(품번이 slug 에 들어간다) 과 `workspace->canonicalProduct` 다.
   *    🟢 WU-130 의 덤프가 같은 방식으로 골랐다.
   */
  const rows = await prisma.$queryRawUnsafe(
    `select id, source_url, title, workspace_id, created_at
       from product_snapshots
      where lower(source_url) like '%' || $1 || '%'
      order by created_at desc
      limit 5`,
    lower,
  );
  found[code] = rows.map((r) => ({
    id: r.id,
    sourceUrl: r.source_url,
    title: r.title,
    workspaceId: r.workspace_id,
    createdAt: r.created_at,
  }));
  console.log(`${code}: 스냅샷 ${rows.length}건` + (rows.length ? ` → ${rows[0].title}` : " 🔴 **없다(측정불가)**"));
}

/** 🟢 전체 스냅샷 수도 같이 적는다 — 「DB 가 비었다」와 「그 상품이 없다」를 가른다. */
const total = await prisma.$queryRawUnsafe(`select count(*)::int n from product_snapshots`);
console.log("product_snapshots 전체:", total[0].n);

writeFileSync(
  path.join(OUT, "wu-133-gt-origins.json"),
  JSON.stringify({ origins: found, totalSnapshots: total[0].n }, null, 2),
  "utf8",
);
console.log("→", path.join(OUT, "wu-133-gt-origins.json"));
await prisma.$disconnect();
