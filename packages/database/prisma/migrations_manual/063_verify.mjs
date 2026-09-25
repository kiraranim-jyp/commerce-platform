/**
 * 063 migration 안전성 검증 — 🔴 READ ONLY. insert/update/delete 0.
 *
 * 적용 «전» 과 «후» 에 각각 돌려서 숫자가 같은지 본다. 이 migration 은 전부
 * additive·nullable 이라 기존 데이터가 한 행도 바뀌면 안 된다.
 *
 *   cd packages/database && node --env-file=.env prisma/migrations_manual/063_verify.mjs
 *
 * 🔴 「테이블이 생겼는지」가 아니라 «기존 값이 그대로인지» 를 본다. 이 세션에서
 * 개수만 세고 값을 안 봐서 놓친 사고가 있었다(E-1 의 cert_count).
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const q = (sql) => p.$queryRawUnsafe(sql);
const one = async (sql) => Number((await q(sql))[0].n);

/** 적용 전 실측값(2026-09-25). 이 숫자가 달라지면 migration 이 데이터를 건드린 것이다. */
const BASELINE = { product: 0, snapshots: 381, attempts: 97 };

/** 🔴 실제 Production 외부 상품번호 — 한 글자도 바뀌면 안 된다. */
const EXTERNAL_IDS = [
  "13713593585", // SmartStore · Bubble Sweatshirt (정상 등록)
  "16394846257", // Coupang   · Bubble Sweatshirt (정상 등록)
  "13668016862", "13669115052", "13670383541",
  "13672230124", "13672322468", "13713032117", // SmartStore 중복 6건 — 보존 대상
  "16336681622", "16338809221", "16340176952", // Coupang 중복 3건 — 보존 대상
];

const fail = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  console.log(`${ok ? "✅" : "🔴"} ${label}: ${actual}${ok ? "" : ` (기대 ${expected})`}`);
  if (!ok) fail.push(label);
};

const product = await one(`select count(*)::int as n from products`);
check("Product 행", product, BASELINE.product);
check("product_snapshots 행", await one("select count(*)::int as n from product_snapshots"), BASELINE.snapshots);
check("registration_attempts 행", await one("select count(*)::int as n from registration_attempts"), BASELINE.attempts);

/* 외부 상품번호가 «값 그대로» 남아 있는가 — 개수가 아니라 값을 본다. */
const found = (await q(`
  select external_product_id from registration_attempts
  where external_product_id in (${EXTERNAL_IDS.map((x) => `'${x}'`).join(",")})
`)).map((r) => r.external_product_id);
for (const id of EXTERNAL_IDS) {
  check(`external_product_id ${id}`, found.includes(id) ? 1 : 0, 1);
}

/* snapshot 연결이 끊기지 않았는가 — 7개 표 중 등록 관련 둘만 대표로 본다. */
check(
  "snapshot 을 잃은 attempt",
  await one(`select count(*)::int as n from registration_attempts r
             where r.snapshot_id is not null
               and not exists (select 1 from product_snapshots s where s.id = r.snapshot_id)`),
  0,
);
check(
  "snapshot 을 잃은 확인기록",
  await one(`select count(*)::int as n from seller_compliance_confirmations c
             where c.snapshot_id is not null
               and not exists (select 1 from product_snapshots s where s.id = c.snapshot_id)`),
  0,
);

/* 적용 «후» 에만 의미가 있는 확인 — 새 칸이 전부 비어 있어야 한다(backfill 0). */
const applied = (await q(`
  select count(*)::int as n from information_schema.columns
  where table_name='product_snapshots' and column_name='product_id'`))[0].n > 0;
if (applied) {
  console.log("── migration 적용됨 — backfill 이 없었는지 확인 ──");
  check("productId 가 채워진 snapshot", await one("select count(*)::int as n from product_snapshots where product_id is not null"), 0);
  check("channel_products 행", await one("select count(*)::int as n from channel_products"), 0);
  check("operation 이 채워진 attempt", await one("select count(*)::int as n from registration_attempts where operation is not null"), 0);
  /* 🔴 @unique(product_id, channel) 이 «없어야» 한다 — 중복 정리 전이다. */
  check(
    "channel_products UNIQUE 제약",
    await one(`select count(*)::int as n from information_schema.table_constraints
               where table_name='channel_products' and constraint_type='UNIQUE'`),
    0,
  );
} else {
  console.log("── migration 미적용 (적용 전 기준선) ──");
}

console.log(fail.length === 0 ? "\n🟢 전부 통과" : `\n🔴 실패 ${fail.length}건: ${fail.join(", ")}`);
await p.$disconnect();
process.exit(fail.length === 0 ? 0 : 1);
