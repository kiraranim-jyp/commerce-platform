/**
 * WU-137 — **등록을 막는 것이 무엇인지 «현재 상태» 로 확인한다** (READ ONLY)
 *
 * 🔴 WU-135 가 「셀러 설정 7칸이 비어 있다」로 닫았다. 🔴 그 뒤 CEO 가 입력했을 수
 *    있으므로 **추측하지 않고 다시 읽는다** — 이것은 «상태» 이고 조사 결론이 아니다.
 * 🔴 DB 쓰기 0 · 외부 API 0 · 비밀값은 **존재 여부만** 적는다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-137-state-dump.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const q = (sql, ...a) => prisma.$queryRawUnsafe(sql, ...a);

const cols = async (t) =>
  (
    await q(
      "select column_name from information_schema.columns where table_name=$1 order by ordinal_position",
      t,
    )
  ).map((r) => r.column_name);

console.log("=== ① seller_settings 칸 (추측 금지 · 실제 이름) ===");
const sc = await cols("seller_settings");
console.log(sc.join(", ") || "(테이블 없음)");

if (sc.length) {
  const rows = await q("select * from seller_settings order by updated_at desc nulls last limit 3");
  console.log(`rows=${rows.length}`);
  for (const row of rows) {
    const filled = Object.entries(row)
      .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
      .map(([k, v]) => `${k}=${String(v).slice(0, 44)}`);
    const empty = Object.entries(row)
      .filter(([, v]) => v === null || v === "")
      .map(([k]) => k);
    console.log("  🟢 채워짐: " + (filled.join(" | ") || "(없음)"));
    console.log("  🔴 빈칸  : " + (empty.join(", ") || "(없음)"));
  }
}

console.log("\n=== ② 배송/프로필 테이블 행수 ===");
const tabs = (
  await q(
    "select table_name from information_schema.tables where table_schema='public' and (table_name like '%deliver%' or table_name like '%shipping%' or table_name like '%profile%' or table_name like '%brand%') order by 1",
  )
).map((r) => r.table_name);
for (const t of tabs) {
  const n = (await q(`select count(*)::int as n from "${t}"`))[0].n;
  console.log(`  ${t}: ${n}행`);
}

console.log("\n=== ③ B226AC009 스냅샷 — brand 가 채워진 «신규» 분석이 있는가 ===");
const snaps = await q(
  `select id, created_at, status,
          workspace->'canonicalProduct'->'brand'->>'value' as brand,
          workspace->'canonicalProduct'->>'brandModelCode' as code
     from product_snapshots
    where source_url ilike '%b226ac009%'
    order by created_at desc`,
);
console.log(`rows=${snaps.length}`);
for (const s of snaps) {
  console.log(
    `  • ${String(s.created_at).slice(0, 19)} | ${s.status} | brand=${JSON.stringify(s.brand)} | code=${s.code ?? "-"} | ${s.id}`,
  );
}

console.log("\n=== ④ 등록 자격증명 (존재 여부만) ===");
const acc = await q(
  "select platform, (client_id is not null and client_id<>'') as has_id, (client_secret is not null and client_secret<>'') as has_secret from commerce_accounts order by platform",
);
for (const a of acc) console.log(`  ${a.platform}: id=${a.has_id ? "✅" : "❌"} secret=${a.has_secret ? "✅" : "❌"}`);

console.log("\n=== ⑤ 스냅샷 상태 분포 (과거 실등록 이력) ===");
for (const r of await q("select status, count(*)::int as n from product_snapshots group by status order by n desc"))
  console.log(`  ${r.status}: ${r.n}`);

await prisma.$disconnect();
