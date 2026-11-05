/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 BRAND-CONFLICT-PRICE — **가격 자격 회귀의 «운영 입력» 덤프** (read-only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §2 가 요구한 필수 회귀 사례를 **운영 데이터로** 채우기 위한 덤프다.
 *    🔴 CTO 가 레코드를 **지어내지 않는다** — `candidate_reviews` 가 운영 판정·가격·
 *       blocker 를 **이미 저장해 둔** 행을 그대로 꺼낸다.
 *
 * 🔴 칸 이름은 운영 호출부(`market-intelligence.ts:305~319`)와 **같은 모양** 으로
 *    맞춰 내보낸다 — 테스트가 매핑을 또 만들지 않게 한다.
 * 🔴 쓰기 0 · 외부 호출 0.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/** 🔴 `blockers` 는 jsonb 다(텍스트 배열이 아니다 — 한 번 틀린 자리다). */
const rows = await p.$queryRawUnsafe(`
  select candidate_domain, candidate_title, market, system_verdict, match_truth,
         price_tier, price_amount, price_currency, price_status,
         coalesce(blockers, '[]'::jsonb) as blockers
    from candidate_reviews
   where price_amount is not null
   order by candidate_domain, price_amount
`);

/** 🟢 운영 호출부와 **같은 칸 이름** 으로 바꾼다(테스트가 다시 매핑하지 않는다). */
const records = rows.map((r) => ({
  domain: r.candidate_domain,
  title: r.candidate_title,
  market: r.market,
  verdict: r.system_verdict,
  matchTruth: r.match_truth,
  priceTier: r.price_tier,
  amount: r.price_amount == null ? null : Number(r.price_amount),
  currency: r.price_currency,
  priceStatus: r.price_status,
  blockers: Array.isArray(r.blockers) ? r.blockers : [],
}));

const has = (rec, t) => rec.blockers.includes(t);
const census = {
  total: records.length,
  BRAND_MISMATCH: records.filter((r) => has(r, "BRAND_MISMATCH")).length,
  BRAND_UNCONFIRMED: records.filter((r) => has(r, "BRAND_UNCONFIRMED")).length,
  NO_TITLE_OVERLAP: records.filter((r) => has(r, "NO_TITLE_OVERLAP")).length,
  SAME_SELLER_DISTINCT_LISTING: records.filter((r) => has(r, "SAME_SELLER_DISTINCT_LISTING")).length,
  /** 🔴 CPO 필수 사례 — **브랜드 충돌 «그리고» 품번 일치** 가 같이 있는 후보. */
  BRAND_MISMATCH_AND_MODEL_CODE: records.filter(
    (r) => has(r, "BRAND_MISMATCH") && has(r, "MODEL_CODE"),
  ).length,
  /** 🟢 blocker 가 전혀 없는(또는 표기 축만) 후보 — 통과해야 하는 쪽이다. */
  noDisqualifyingBlocker: records.filter(
    (r) =>
      !has(r, "BRAND_MISMATCH") &&
      !has(r, "NO_TITLE_OVERLAP") &&
      !has(r, "SAME_SELLER_DISTINCT_LISTING"),
  ).length,
  byVerdict: records.reduce((a, r) => {
    a[r.verdict ?? "null"] = (a[r.verdict ?? "null"] ?? 0) + 1;
    return a;
  }, {}),
  byPriceStatus: records.reduce((a, r) => {
    a[r.priceStatus ?? "null"] = (a[r.priceStatus ?? "null"] ?? 0) + 1;
    return a;
  }, {}),
};

const dir = path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "brand-conflict-price.json");
writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), census, records }, null, 1), "utf8");

console.log("=== BRAND-CONFLICT-PRICE 입력 덤프(운영 저장분) ===");
console.log(JSON.stringify(census, null, 1));
console.log("→", file);

await p.$disconnect();
