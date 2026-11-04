/** 🔵 STAGE 7-2 효과 — 운영 blockers 가 금액 자격을 어떻게 가르는가. READ-ONLY. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const OBS = new Set(["MATERIAL","FIT","SIZE_SYSTEM","GARMENT_FORM","BRAND_MISMATCH","AUDIENCE_LINE","NO_TITLE_OVERLAP","SAME_SELLER_DISTINCT_LISTING","MODEL_CODE_AGE_LINE"]);
const codes = ["B226AC073","B226AC033","B226AC110","B226AC043"];
for (const code of codes) {
  const rows = await p.$queryRawUnsafe(`
    select snapshot_id, candidate_domain, candidate_title, price_currency, price_amount,
           price_status, price_tier, blockers
    from candidate_reviews
    where origin_code = $1 and price_amount is not null
      and snapshot_id = (select snapshot_id from candidate_reviews where origin_code = $1
                         order by first_seen_at desc limit 1)
    order by candidate_domain`, code);
  console.log(`\n═══ ${code} · 후보 ${rows.length} ═══`);
  for (const r of rows) {
    const blk = Array.isArray(r.blockers) ? r.blockers : [];
    const obs = blk.filter((b) => OBS.has(b));
    console.log(
      `  ${String(r.candidate_domain).padEnd(24)} ${String(r.price_currency)} ${String(r.price_amount).padEnd(9)}` +
      ` ${String(r.price_status ?? "null").padEnd(18)} ${obs.length ? "🔴차이[" + obs.join("·") + "]" : "🟢차이없음"}`,
    );
    console.log(`      「${String(r.candidate_title ?? "-").slice(0, 62)}」 보류전수[${blk.join("·") || "-"}]`);
  }
}
await p.$disconnect();
