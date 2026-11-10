/**
 * MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 §3 — 🔴 **읽기 전용.**
 *
 * 🔴 칸 이름은 **추측하지 않았다** — `information_schema` 출력(candidate_url ·
 *    candidate_domain · price_amount · price_currency · market · price_tier ·
 *    price_status · system_verdict)을 그대로 쓴다(1차에 42703 을 맞았다).
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const q = async (t, sql, ...a) => {
  const r = await p.$queryRawUnsafe(sql, ...a);
  console.log(`\n=== ${t} (${r.length}) ===`);
  for (const x of r) console.log("  " + JSON.stringify(x));
  return r;
};

/** 🔴 해외 축 자격 = 가격 + 통화 + market 비KR + 통화 비KRW(market-intelligence 루프와 같은 조건). */
const OVERSEAS_ELIGIBLE = `price_amount is not null and price_currency is not null
      and coalesce(market,'') <> 'KR' and upper(coalesce(price_currency,'')) <> 'KRW'`;

await q(
  "⑦ 🔴🔴 **한 스냅샷에 「SAME 가격」과 「추정 가격」이 같이 있는가** — 표시 분기가 갈리는 모양",
  `select snapshot_id,
          count(*) filter (where price_tier in ('EXACT','CONFIRMED'))::int same_priced,
          count(*) filter (where price_tier = 'COMPARISON')::int presumed_priced,
          count(*) filter (where price_tier = 'REFERENCE')::int reference_priced,
          count(*) filter (where price_tier = 'EXCLUDED')::int excluded_priced,
          min(price_amount) filter (where price_tier in ('EXACT','CONFIRMED'))::float same_lo,
          min(price_amount) filter (where price_tier = 'COMPARISON')::float presumed_lo,
          array_agg(distinct price_currency) currencies
     from candidate_reviews
    where ${OVERSEAS_ELIGIBLE}
    group by snapshot_id
   having count(*) filter (where price_tier in ('EXACT','CONFIRMED')) > 0
      and count(*) filter (where price_tier = 'COMPARISON') > 0
    order by presumed_priced desc limit 15`,
);

await q(
  "⑧ 해외 자격 행의 tier 전수 분포(분모)",
  `select coalesce(price_tier,'(null)') tier, coalesce(price_status,'(null)') status,
          count(*)::int n, count(distinct snapshot_id)::int snaps
     from candidate_reviews where ${OVERSEAS_ELIGIBLE}
    group by 1,2 order by n desc`,
);

await q(
  "⑨ 🔴 같은 통화 안에서 「SAME 최저」 ↔ 「추정 포함 최저」가 **다른** 스냅샷",
  `select snapshot_id, price_currency,
          min(price_amount) filter (where price_tier in ('EXACT','CONFIRMED'))::float same_lo,
          min(price_amount)::float all_lo,
          count(*) filter (where price_tier = 'COMPARISON')::int presumed
     from candidate_reviews
    where ${OVERSEAS_ELIGIBLE} and coalesce(price_status,'') = 'VERIFIED_CURRENT'
    group by snapshot_id, price_currency
   having count(*) filter (where price_tier in ('EXACT','CONFIRMED')) > 0
      and min(price_amount) filter (where price_tier in ('EXACT','CONFIRMED')) <> min(price_amount)
    order by presumed desc limit 15`,
);

await p.$disconnect();
