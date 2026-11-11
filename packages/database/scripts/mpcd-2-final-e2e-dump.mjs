/**
 * MI-PRICE-COMPARISON-AND-DECISION-FINAL-E2E — 🔴 **읽기 전용.**
 *
 * 🔴 CPO 가 남긴 세 조건 중 **둘** 의 표본을 운영 DB 에서 찾는다(지어내지 않는다):
 *    ① 국내 링크 **그리고** 해외 후보가 **함께** 있는 상품
 *    ② `price_status = 'VERIFIED_CURRENT'` 인 **실제 가격 후보** 가 있는 상품
 * 🔴 ③(원가 부족)은 운영 표본이 아니라 **함수 계약** 으로 명시한다(CPO §3).
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MPCD2_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mpcd-2");
mkdirSync(OUT, { recursive: true });
const q = async (t, sql, ...a) => {
  const r = await prisma.$queryRawUnsafe(sql, ...a);
  console.log(`\n=== ${t} (${r.length}) ===`);
  for (const x of r) console.log("  " + JSON.stringify(x));
  return r;
};

/** 🔴 해외 후보 자격 = 가격 + 통화 + market 비KR + 통화 비KRW(운영 루프와 같은 조건). */
const OS_CAND = `c.price_amount is not null and c.price_currency is not null
      and coalesce(c.market,'') <> 'KR' and upper(coalesce(c.price_currency,'')) <> 'KRW'`;

/**
 * 🔴🔴 **1차 질의가 틀린 축을 봤다 — 그대로 적는다.**
 *    「국내 링크(`domestic_product_links`) ∧ 해외 후보」로 찾으니 **운영 전체에 0건** 이었다.
 *    🔴 그런데 **화면의 국내 참고가격 owner 는 그 축이 아니다** — `candidateDomesticPrice`
 *       (= transient 후보 집계)다(§24-1). 등록부 링크는 **다른 생산자** 이고 두 경로가
 *       서로 다른 시기·상품에서 돌아 교집합이 0 이었던 것이다.
 * 🟢 그래서 **후보 축**(같은 상품에 `market='KR'` 후보와 비KR 후보가 함께)으로 다시 찾는다 —
 *    그것이 화면에 🇰🇷/🌎 두 블록이 같이 서는 **실제 조건** 이다. ⟹ 실측 **8 상품**.
 */
const BOTH = await q(
  "① 🟢 **국내 후보 ∧ 해외 후보** 가 함께 있는 상품(화면 두 블록의 실제 조건)",
  `select s.id,
          s.workspace->'canonicalProduct'->'brand'->>'value'             as brand,
          s.workspace->'canonicalProduct'->'sku'->>'value'               as sku,
          s.workspace->'canonicalProduct'->'price'->'value'->>'amount'   as price_amount,
          s.workspace->'canonicalProduct'->'price'->'value'->>'currency' as price_currency,
          s.workspace->'canonicalProduct'->>'priceValidity'              as price_validity,
          s.workspace->'canonicalProduct'->'priceBreakdown'              as price_breakdown,
          (select count(*) from domestic_product_links l where l.snapshot_id = s.id)::int as links,
          (select count(*) from price_observations o
            where o.snapshot_id = s.id and o.source = 'DOMESTIC_SHOP' and o.price_krw is not null)::int as dom_obs,
          (select count(*) from candidate_reviews c where c.snapshot_id = s.id and ${OS_CAND})::int as os_cands,
          (select count(*) from candidate_reviews c
            where c.snapshot_id = s.id and coalesce(c.price_status,'') = 'VERIFIED_CURRENT')::int as verified
     from product_snapshots s
    where exists (select 1 from candidate_reviews c
                   where c.snapshot_id = s.id and c.market = 'KR' and c.price_amount is not null)
      and exists (select 1 from candidate_reviews c where c.snapshot_id = s.id and ${OS_CAND})
    order by verified desc, os_cands desc, links desc limit 10`,
);

const VERIFIED = await q(
  "② 🔴 `VERIFIED_CURRENT` 실제 가격 후보가 있는 상품",
  `select s.id,
          s.workspace->'canonicalProduct'->'brand'->>'value'             as brand,
          s.workspace->'canonicalProduct'->'sku'->>'value'               as sku,
          s.workspace->'canonicalProduct'->'price'->'value'->>'amount'   as price_amount,
          s.workspace->'canonicalProduct'->'price'->'value'->>'currency' as price_currency,
          s.workspace->'canonicalProduct'->>'priceValidity'              as price_validity,
          s.workspace->'canonicalProduct'->'priceBreakdown'              as price_breakdown,
          (select count(*) from candidate_reviews c
            where c.snapshot_id = s.id and coalesce(c.price_status,'') = 'VERIFIED_CURRENT')::int as verified,
          (select count(*) from candidate_reviews c where c.snapshot_id = s.id)::int as cands,
          (select count(*) from domestic_product_links l where l.snapshot_id = s.id)::int as links
     from product_snapshots s
    where exists (select 1 from candidate_reviews c
                   where c.snapshot_id = s.id and coalesce(c.price_status,'') = 'VERIFIED_CURRENT')
    order by verified desc limit 10`,
);

const ids = [...new Set([...BOTH.map((r) => r.id), ...VERIFIED.map((r) => r.id)])];
console.log(`\n대상 스냅샷 ${ids.length}개`);

const CANDS = await prisma.$queryRawUnsafe(
  `select snapshot_id, candidate_domain, candidate_url, candidate_title, price_amount::float price_amount,
          price_currency, market, price_tier, price_status, system_verdict, match_truth, blockers, sold_out
     from candidate_reviews where snapshot_id = any($1::uuid[]) order by snapshot_id, price_amount`,
  ids,
);
const LINKS = await prisma.$queryRawUnsafe(
  `select snapshot_id, source_id, match_truth, verified from domestic_product_links
    where snapshot_id = any($1::uuid[])`,
  ids,
);
const OBS = await prisma.$queryRawUnsafe(
  `select snapshot_id, id, source, source_label, source_product_url, source_ref_id, currency,
          price_amount, price_krw, shipping_cost_amount, tax_amount, exchange_rate,
          sale_price_krw, original_price_krw, sold_out, market_code, market_country, checked_at
     from price_observations where snapshot_id = any($1::uuid[]) order by checked_at desc`,
  ids,
);
const RATES = await prisma.$queryRawUnsafe(`select currency, rate from exchange_rates`);
/**
 * 🔴🔴🔴 PRODUCTION-UI-MISMATCH — **화면의 권장가는 「반올림 단위」가 같이 만든다.**
 *
 * `CommerceWorkspace` 는 `resolveListingPrice(..., exchangeRates?.rates,
 * priceRoundingUnit ?? undefined)` 로 부르고 그 `priceRoundingUnit` 은
 * **셀러 프로필 값**(`coupang_seller_profiles.price_rounding_unit`)이다.
 * 🔴 하니스가 `10`(패키지 기본값)을 넘기면 **화면과 다른 숫자** 가 나온다 —
 *    내 1차 실측 `₩101,090`(단위 10) ↔ CEO 운영 화면 `₩101,000`(단위 **1000**).
 * 🟢 그래서 운영값을 같이 덤프한다(읽기만 한다 · 없으면 `null` — 기본값을 지어내지 않는다).
 */
const ROUNDING = await prisma.$queryRawUnsafe(
  `select price_rounding_unit from coupang_seller_profiles
    where price_rounding_unit is not null order by created_at limit 1`,
);

const json = (v) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x), 1);
writeFileSync(path.join(OUT, "both.json"), json(BOTH));
writeFileSync(path.join(OUT, "verified.json"), json(VERIFIED));
writeFileSync(path.join(OUT, "candidates.json"), json(CANDS));
writeFileSync(path.join(OUT, "links.json"), json(LINKS));
writeFileSync(path.join(OUT, "observations.json"), json(OBS));
writeFileSync(path.join(OUT, "rates.json"), json(RATES));
writeFileSync(path.join(OUT, "rounding.json"), json(ROUNDING));
console.log(
  `\n덤프 → ${OUT}\n  both ${BOTH.length} · verified ${VERIFIED.length} · cands ${CANDS.length} · links ${LINKS.length} · obs ${OBS.length}`,
);
await prisma.$disconnect();
