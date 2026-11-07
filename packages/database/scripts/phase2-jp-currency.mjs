/**
 * 🔵 PHASE 2 — 「JP 조회 결과가 실제 JPY 인가」를 **DB 현재 상태** 로 먼저 답한다.
 * 🔴 READ-ONLY · DB 쓰기 0 · 네트워크 0 · 과금 0 · 운영 코드 변경 0.
 * 🔴 라이브 축은 phase2-smallable-currency-declaration.test.ts 가 따로 잰다(분모를 섞지 않는다).
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const q = (sql) => p.$queryRawUnsafe(sql);
const show = (title, rows) => {
  console.log(`\n═══ ${title} ═══`);
  if (!rows.length) return console.log("  (0행)");
  for (const r of rows) console.log("  " + JSON.stringify(r, (_, v) => (typeof v === "bigint" ? Number(v) : v)));
};

/** ① market_code=jp 관측 전수 — 통화별. 🔴 「JP 행이 JPY 인가」의 직접 답이다. */
show(
  "① market_code = 'jp' 관측 — 통화별 (전수)",
  await q(`
    select currency, count(*)::int as n,
           count(market_country)::int as with_country,
           min(price_amount)::float as min_amt, max(price_amount)::float as max_amt,
           max(checked_at)::text as last
      from price_observations
     where lower(coalesce(market_code,'')) = 'jp'
     group by currency order by n desc`),
);

/** ② 그 중 Smallable 만 — 🔴 이 WU 의 대상이다. */
show(
  "② Smallable 의 jp 행",
  await q(`
    select currency, count(*)::int as n, max(checked_at)::text as last
      from price_observations
     where lower(coalesce(market_code,'')) = 'jp'
       and source_product_url ilike '%smallable%'
     group by currency order by n desc`),
);

/** ③ Smallable 전체 시장 분포 — 시장별 통화. */
show(
  "③ Smallable 시장별 통화",
  await q(`
    select coalesce(nullif(market_code,''),'(원본)') as market, currency,
           count(*)::int as n, count(market_country)::int as with_country,
           max(checked_at)::text as last
      from price_observations
     where source_product_url ilike '%smallable%'
     group by 1,2 order by 1,2`),
);

/** ④ 대조군 — 사이트가 통화를 «선언하는» 경로(Shopify)의 jp 행. 🟢 그쪽은 JPY 가 산다. */
show(
  "④ 대조군 — JPY 관측을 실제로 내는 판매처 (전수)",
  await q(`
    select split_part(split_part(source_product_url,'//',2),'/',1) as host,
           coalesce(nullif(market_code,''),'(원본)') as market,
           count(*)::int as n, max(checked_at)::text as last
      from price_observations
     where currency = 'JPY'
     group by 1,2 order by n desc`),
);

/** ⑤ 🔴 가장 최근 Smallable 상품 URL — 라이브 하니스가 쓸 좌표. */
show(
  "⑤ 라이브 대상 좌표 (최근 Smallable 상품)",
  await q(`
    select split_part(source_product_url,'?',1) as base, max(checked_at)::text as last, count(*)::int as n
      from price_observations
     where source_product_url ilike '%smallable%'
     group by 1 order by last desc limit 3`),
);

await p.$disconnect();
