/**
 * STAGE 5 — 등록 MISSING 7 의 «출처» 를 가른다 (READ-ONLY · 네트워크 0 · 쓰기 0)
 * 🔴 WU-135 하니스는 seller_settings 를 읽지 않는다 ⟹ 그 MISSING 이 운영 값인지 알 수 없었다.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const show = (v) => (v === null || v === undefined || String(v).trim() === "" ? "🔴 비어 있음" : `🟢 ${String(v).slice(0, 40)}`);
try {
  const cols = await p.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_name='seller_settings' order by ordinal_position`,
  );
  console.log("seller_settings 칸 수:", cols.length);
  const rows = await p.$queryRawUnsafe(`select * from seller_settings`);
  console.log("행 수:", rows.length);
  for (const r of rows) {
    console.log("\n═══ seller_settings row ═══");
    for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(34)} ${show(v)}`);
  }
} catch (e) {
  console.log("🔴 seller_settings 조회 실패:", e.message.slice(0, 200));
}
await p.$disconnect();
