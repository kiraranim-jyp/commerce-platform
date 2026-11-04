/**
 * 🔵 STAGE 6 보완 ③ — 특별 검증(villagekids · trenbe) **READ-ONLY**.
 * 🔴 쓰기 0 · 네트워크 0 · 과금 0. 사람 판정 이력은 **읽기만** 한다(삭제·덮어쓰기 금지).
 * 🔴 칸 이름은 information_schema 로 **읽어서** 썼다(추측 금지 · 이 트랙 13번째 함정).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.$queryRawUnsafe(`
  select candidate_url, origin_code, candidate_title, system_verdict, match_truth, price_tier,
         price_amount, price_currency, price_status, blockers, human_verdict, human_note,
         (image_url is not null) as has_img, first_seen_at, reviewed_at
  from candidate_reviews
  where candidate_url ilike '%villagekids%' or candidate_url ilike '%trenbe%'
  order by candidate_url, first_seen_at
`);
for (const r of rows) {
  console.log(
    [
      String(r.origin_code ?? "-").padEnd(11),
      String(r.candidate_url).replace(/^https?:\/\//, "").slice(0, 46).padEnd(46),
      String(r.system_verdict ?? "-").padEnd(14),
      String(r.match_truth ?? "-").padEnd(18),
      String(r.price_tier ?? "-").padEnd(11),
      `${r.price_currency ?? "-"} ${r.price_amount ?? "-"}`.padEnd(11),
      `ps=${String(r.price_status ?? "🔴null")}`.padEnd(22),
      `human=${String(r.human_verdict ?? "-")}`.padEnd(15),
      `note=${r.human_note ? JSON.stringify(r.human_note) : "없음"}`.padEnd(12),
      `img=${r.has_img}`,
      String(r.first_seen_at).slice(0, 19),
    ].join(" "),
  );
  console.log(`      title「${String(r.candidate_title ?? "-")}」 blockers=${JSON.stringify(r.blockers)}`);
}
console.log("rows=", rows.length);
await p.$disconnect();
