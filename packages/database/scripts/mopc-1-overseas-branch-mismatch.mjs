/**
 * MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 §3 — 🔴 **읽기 전용.**
 *
 * 묻는 것: **화면이 「SAME 전용 가격 가이드」로 분기할 때(=sameCount>0),
 *          「참고가격에 반영」이라 적힌 «추정» 후보의 가격이 그 숫자에 «없다».**
 * 🔴 집계기(서버 요약)는 그 후보를 넣는다(verdict 자격 SAME+PRESUMED_SAME) —
 *    즉 카드 라벨은 **서버 요약 기준** 이고 화면 숫자는 **SAME 전용** 이다.
 * 🟢 `blockers` 는 jsonb 라 금액 자격 집합(BRAND_MISMATCH · NO_TITLE_OVERLAP ·
 *    SAME_SELLER_DISTINCT_LISTING)을 **운영과 같은 값** 으로 뺀다.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = async (t, sql, ...a) => {
  const r = await p.$queryRawUnsafe(sql, ...a);
  console.log(`\n=== ${t} (${r.length}) ===`);
  for (const x of r) console.log("  " + JSON.stringify(x));
  return r;
};

const ELIGIBLE = `price_amount is not null and price_currency is not null
      and coalesce(market,'') <> 'KR' and upper(coalesce(price_currency,'')) <> 'KRW'
      and coalesce(price_status,'') = 'VERIFIED_CURRENT'
      and not (coalesce(blockers,'[]'::jsonb) ?| array['BRAND_MISMATCH','NO_TITLE_OVERLAP','SAME_SELLER_DISTINCT_LISTING'])
      and coalesce(system_verdict,'SAME') in ('SAME','PRESUMED_SAME')
      and coalesce(price_tier,'') <> 'EXCLUDED'`;

await q(
  "🔴🔴 ⑩ 카드는 「반영」인데 화면 숫자(SAME 전용)에는 없는 후보 — 스냅샷별",
  `select snapshot_id,
          count(*) filter (where price_tier in ('EXACT','CONFIRMED'))::int same_in_screen,
          count(*) filter (where price_tier not in ('EXACT','CONFIRMED'))::int presumed_says_used,
          min(price_amount) filter (where price_tier in ('EXACT','CONFIRMED'))::float screen_lo,
          min(price_amount)::float aggregate_lo,
          array_agg(distinct price_currency) currencies
     from candidate_reviews
    where ${ELIGIBLE}
    group by snapshot_id
   having count(*) filter (where price_tier in ('EXACT','CONFIRMED')) > 0
      and count(*) filter (where price_tier not in ('EXACT','CONFIRMED')) > 0
    order by presumed_says_used desc limit 15`,
);

await q(
  "⑪ 분모 — 자격 행 전체 · tier 별",
  `select coalesce(price_tier,'(null)') tier, count(*)::int rows,
          count(distinct snapshot_id)::int snaps
     from candidate_reviews where ${ELIGIBLE} group by 1 order by rows desc`,
);

await q(
  "⑫ 🔴 같은 통화 안에서 **화면 최저 ↔ 집계 최저가 다른** 사례(가장 직접적인 모순)",
  `select snapshot_id, price_currency,
          min(price_amount) filter (where price_tier in ('EXACT','CONFIRMED'))::float screen_lo,
          min(price_amount)::float aggregate_lo,
          count(*) filter (where price_tier not in ('EXACT','CONFIRMED'))::int presumed
     from candidate_reviews where ${ELIGIBLE}
    group by snapshot_id, price_currency
   having count(*) filter (where price_tier in ('EXACT','CONFIRMED')) > 0
      and count(*) filter (where price_tier not in ('EXACT','CONFIRMED')) > 0
    order by presumed desc limit 15`,
);

await p.$disconnect();
