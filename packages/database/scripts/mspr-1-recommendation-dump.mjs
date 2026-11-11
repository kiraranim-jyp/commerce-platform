/**
 * MI-SELLER-PRICE-RECOMMENDATION-VALIDATION-1 — 🔴 **읽기 전용 덤프.**
 *
 * 🔴 INSERT/UPDATE/DELETE 0 · migration 0 · 외부 API 0.
 * 🔴🔴 **WU-021 이 남긴 구멍을 메운다** — 그 하니스는 「환율이 필요해서 `marketCase` 를
 *    측정하지 않았다」고 적어 뒀다(`mi-021-final-decision-trace.test.ts:149·189`).
 *    ⟹ 이 덤프는 **추천가격 사슬의 입력 전부**(원가·배송·수수료·목표마진·국내 basis)를 모은다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mspr-1-recommendation-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MSPR1_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mspr-1");
mkdirSync(OUT, { recursive: true });

/**
 * 🔴 **표본을 손으로 고르지 않는다** — 「국내 링크가 있거나 해외 자격 후보가 있는」
 *    스냅샷을 **데이터가 고르게** 한다(CPO §4 의 9 시나리오가 실재하는 곳).
 */
const SNAPS = await prisma.$queryRawUnsafe(`
  with scored as (
    select s.id,
           s.source_url,
           s.title,
           s.workspace->'canonicalProduct'->'brand'->>'value'            as brand,
           s.workspace->'canonicalProduct'->'sku'->>'value'              as sku,
           s.workspace->'canonicalProduct'->'price'->'value'->>'amount'  as price_amount,
           s.workspace->'canonicalProduct'->'price'->'value'->>'currency' as price_currency,
           s.workspace->'canonicalProduct'->>'priceValidity'             as price_validity,
           s.workspace->'canonicalProduct'->'priceBreakdown'             as price_breakdown,
           (select count(*) from domestic_product_links l where l.snapshot_id = s.id)::int as links,
           (select count(*) from price_observations o
             where o.snapshot_id = s.id and o.source = 'DOMESTIC_SHOP' and o.price_krw is not null)::int as dom_obs,
           (select count(*) from candidate_reviews c
             where c.snapshot_id = s.id and c.price_amount is not null)::int as cand_priced,
           (select count(distinct c.price_currency) from candidate_reviews c
             where c.snapshot_id = s.id and c.price_amount is not null)::int as cand_currencies
      from product_snapshots s
  ),
  ranked as (
    select *,
           row_number() over (
             partition by coalesce(brand,''), coalesce(sku, source_url)
             order by (links > 0)::int desc, cand_priced desc, dom_obs desc
           ) as rn
      from scored
     where links > 0 or cand_priced > 0
  )
  select * from ranked
   where rn = 1
   order by (links > 0)::int + (cand_priced > 0)::int desc,
            greatest(links, cand_priced) desc, dom_obs desc
   limit 16
`);
/**
 * 🔴🔴 **1차 선정이 틀렸고 그대로 적는다.** `order by links desc` 만 썼더니
 *    **같은 상품(Pèpè Shoes 01195)의 스냅샷 12개** 가 뽑혔다 — CPO §6 의
 *    「실제 상품 최소 5개」를 **하나도 충족하지 않는** 표본이었다.
 * 🟢 그래서 `(brand, sku)` 단위로 **대표 1개** 만 남긴다(상품 단위 표본).
 */

const ids = SNAPS.map((s) => s.id);
console.log(`대상 스냅샷 ${ids.length}개`);
for (const s of SNAPS) {
  console.log(
    `  ${s.id.slice(0, 8)} ${String(s.brand ?? "-").padEnd(16)} ${String(s.sku ?? "-").padEnd(14)}` +
      ` price=${s.price_amount ?? "-"} ${s.price_currency ?? "-"} validity=${s.price_validity ?? "-"}` +
      ` links=${s.links} domObs=${s.dom_obs} candPriced=${s.cand_priced} cur=${s.cand_currencies}` +
      ` breakdown=${s.price_breakdown ? JSON.stringify(s.price_breakdown) : "null"}`,
  );
}

/** ② 국내 링크 — 🔴 tier 산출 입력(`priceTierFromLink`)이고 값을 만들지 않는다. */
const LINKS = await prisma.$queryRawUnsafe(
  `select l.snapshot_id, l.source_id, l.match_truth, l.verified, l.status,
          l.cross_seller_verdict, l.external_url
     from domestic_product_links l where l.snapshot_id = any($1::uuid[])`,
  ids,
);

/** ③ 관측 전 source — 🔴 원가 축(SELLER_ORIGIN)과 국내 축(DOMESTIC_SHOP)을 **둘 다** 쓴다. */
const OBS = await prisma.$queryRawUnsafe(
  `select snapshot_id, id, source, source_label, source_product_url, source_ref_id,
          currency, price_amount, price_krw, shipping_cost_amount, tax_amount, exchange_rate,
          sale_price_krw, original_price_krw, sold_out, market_code, market_country, checked_at
     from price_observations where snapshot_id = any($1::uuid[]) order by checked_at desc`,
  ids,
);

/** ④ 후보 — 해외 소싱가/통화/신뢰도(시나리오 ③④⑤⑨). */
const CANDS = await prisma.$queryRawUnsafe(
  `select snapshot_id, candidate_domain, candidate_url, price_amount, price_currency, market,
          price_tier, price_status, system_verdict, match_truth, blockers, sold_out, human_verdict
     from candidate_reviews where snapshot_id = any($1::uuid[]) order by snapshot_id, price_amount`,
  ids,
);

/** ⑤ 환율 — 🔴 **DB 표를 그대로** 쓴다(외부 API 0). 운영도 이 표를 먼저 본다. */
const RATES = await prisma.$queryRawUnsafe(
  `select * from exchange_rates order by 1 limit 20`,
);

const json = (v) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x), 1);
writeFileSync(path.join(OUT, "snapshots.json"), json(SNAPS));
writeFileSync(path.join(OUT, "links.json"), json(LINKS));
writeFileSync(path.join(OUT, "observations.json"), json(OBS));
writeFileSync(path.join(OUT, "candidates.json"), json(CANDS));
writeFileSync(path.join(OUT, "rates.json"), json(RATES));
console.log(
  `\n덤프 완료 → ${OUT}\n  links ${LINKS.length} · obs ${OBS.length} · cands ${CANDS.length} · rates ${RATES.length}`,
);
await prisma.$disconnect();
