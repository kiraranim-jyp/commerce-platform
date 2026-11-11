/**
 * SMALLABLE-LOCAL-CURRENCY-FOLLOWUP — 🔴 **읽기 전용 전수.**
 *
 * 🔴🔴 **`a0b3c08` 을 재조사하지 않는다.** 그 WU 는 CPO CLOSED 다(2026-11-07) —
 *    JP 는 EUR 이고 `?currency=` 는 표시 계층이라는 **판정이 이미 내려져 있다**.
 * 🟢 이 스크립트가 묻는 것은 **다른 것** 이다(CPO 「한 사이트의 예외 처리가 목적이 아니다」):
 *    **「국가별 가격·통화 정확성을 판정하는 기준을 운영 전수에 적용하면 무엇이 나오는가」**
 *
 * 🔴 수집 정책·통화 정책·판정 로직을 **바꾸지 않는다**(측정 전용).
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.SLCF1_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "slcf-1");
mkdirSync(OUT, { recursive: true });
const q = async (t, sql, ...a) => {
  const r = await prisma.$queryRawUnsafe(sql, ...a);
  console.log(`\n=== ${t} (${r.length}) ===`);
  for (const x of r) console.log("  " + JSON.stringify(x));
  return r;
};

/** 🔴 source_label 을 추측하지 않는다 — 분포를 먼저 본다. */
await q(
  "① MARKET_PROBE 식별 — source / source_label 분포",
  `select source, coalesce(source_label,'(null)') label, count(*)::int n,
          count(distinct market_code)::int markets, count(distinct currency)::int currencies
     from price_observations
    group by 1,2 order by n desc limit 12`,
);

/** ② 호스트 × 통화 격자 — 🔴 이것이 「기준」의 입력이다. */
const GRID = await prisma.$queryRawUnsafe(`
  select split_part(regexp_replace(coalesce(source_product_url, ''), '^https?://', ''), '/', 1) as host,
         snapshot_id,
         coalesce(market_code,'(null)') as market_code,
         currency,
         price_amount::float as amount,
         count(*)::int as rows
    from price_observations
   where source_label = 'MARKET_PROBE'
     and price_amount is not null and currency is not null
   group by 1,2,3,4,5
   order by host, snapshot_id, market_code, currency
`);
console.log(`\n=== ② MARKET_PROBE 격자 행 ${GRID.length} ===`);

/** ③ 호스트별 통화 집합 — 🔴 「통화 1개」와 「수집 실패」를 가른다. */
await q(
  "③ 호스트별 통화 집합과 시장 수",
  `select split_part(regexp_replace(coalesce(source_product_url,''), '^https?://',''), '/', 1) as host,
          count(*)::int rows,
          count(distinct snapshot_id)::int products,
          count(distinct market_code)::int markets,
          count(distinct currency)::int currencies,
          array_agg(distinct currency order by currency) currency_set
     from price_observations
    where source_label = 'MARKET_PROBE' and price_amount is not null and currency is not null
    group by 1 order by currencies desc, rows desc limit 20`,
);

/** ④ 🔴 수집 «실패» 는 다른 칸이다 — 가격이 없는 MARKET_PROBE 행. */
await q(
  "④ 수집 실패/가격 부재 — 「확인 불가」와 섞지 않는다",
  `select split_part(regexp_replace(coalesce(source_product_url,''), '^https?://',''), '/', 1) as host,
          count(*) filter (where price_amount is null)::int no_price,
          count(*) filter (where currency is null)::int no_currency,
          count(*)::int rows
     from price_observations
    where source_label = 'MARKET_PROBE'
    group by 1 having count(*) filter (where price_amount is null or currency is null) > 0
    order by no_price desc limit 15`,
);

/** ⑤ JP 축 — 🔴 닫힌 판정의 **재확인만** 한다(재조사 아님 · 숫자 1줄). */
await q(
  "⑤ market_code='jp' 통화 분포(닫힌 판정 재확인)",
  `select currency, count(*)::int n from price_observations
    where source_label = 'MARKET_PROBE' and lower(coalesce(market_code,'')) = 'jp'
    group by 1 order by n desc`,
);

const json = (v) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? Number(x) : x), 1);
writeFileSync(path.join(OUT, "market-currency-grid.json"), json(GRID));
console.log(`\n덤프 → ${OUT}/market-currency-grid.json`);
await prisma.$disconnect();
