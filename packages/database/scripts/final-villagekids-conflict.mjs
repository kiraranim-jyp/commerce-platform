/** FINAL QUALITY GATE ② — villagekids 사람 판정 충돌 복원 (READ-ONLY · 쓰기 0 · 삭제 0) */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const URL = "https://villagekids.co.uk/products/pale-blue-3d-logo-t-shirt";

const rows = await p.$queryRawUnsafe(
  `select id, snapshot_id, origin_code, candidate_title, market, system_verdict, match_truth,
          price_tier, price_amount, price_currency, price_status, sold_out,
          human_verdict, human_note, source, image_url,
          first_seen_at, last_seen_at, reviewed_at, blockers, match_reasons
   from candidate_reviews where candidate_url = $1
   order by reviewed_at nulls last, first_seen_at`,
  URL,
);
console.log(`═══ 같은 URL 전수 ${rows.length}행 ═══`);
const judged = rows.filter((r) => r.human_verdict != null);
console.log(`사람 판정이 있는 행: ${judged.length}\n`);
for (const r of judged) {
  console.log(`── ${r.human_verdict} ──────────────────────────────────`);
  console.log(`  id            ${String(r.id).slice(0, 8)}   snapshot ${String(r.snapshot_id).slice(0, 8)}`);
  console.log(`  reviewed_at   ${r.reviewed_at ?? "(null)"}`);
  console.log(`  first_seen    ${r.first_seen_at}`);
  console.log(`  last_seen     ${r.last_seen_at}`);
  console.log(`  🔴 human_note ${r.human_note ?? "(없음)"}`);
  console.log(`  origin_code   ${r.origin_code}`);
  console.log(`  후보 상품명    ${r.candidate_title ?? "-"}`);
  console.log(`  system        ${r.system_verdict} / truth ${r.match_truth} / tier ${r.price_tier}`);
  console.log(`  가격          ${r.price_currency ?? "-"} ${r.price_amount ?? "-"} · status ${r.price_status ?? "null"} · 품절 ${r.sold_out ?? "null"}`);
  console.log(`  source        ${r.source ?? "-"}`);
  console.log(`  이미지        ${r.image_url ? "있음" : "🔴 없음"}`);
  console.log(`  blockers      ${JSON.stringify(r.blockers)}`);
  const mr = r.match_reasons;
  console.log(`  근거/보류     ${mr ? JSON.stringify(mr).slice(0, 300) : "(없음)"}`);
}

/** 🔴 두 판정 사이에 «원상품» 이 바뀌었는지 — 같은 origin_code 라도 스냅샷이 다르다. */
const snapIds = [...new Set(judged.map((r) => r.snapshot_id).filter(Boolean))];
if (snapIds.length) {
  const snaps = await p.$queryRawUnsafe(
    `select id, title, source_url, status, created_at, updated_at
     from product_snapshots where id = any($1::uuid[]) order by created_at`, snapIds);
  console.log(`\n═══ 그 판정들이 달린 원상품 스냅샷 ${snaps.length}건 ═══`);
  for (const s of snaps) {
    console.log(`  ${String(s.id).slice(0, 8)} ${String(s.created_at).slice(0, 16)} status=${s.status}`);
    console.log(`     제목 ${s.title}`);
    console.log(`     URL  ${String(s.source_url).slice(0, 90)}`);
  }
}
await p.$disconnect();
