/**
 * WU-008 — `B226AC117` **가격 provenance 읽기 전용** 덤프
 *
 * 🔴 **READ ONLY.** INSERT/UPDATE/DELETE 0 · migration 0 · schema 0 · 외부 API 0 ·
 *    Gemini 0 · AI 0 · 가격 추정/환산 0.
 *
 * 🔴🔴 **먼저 검증할 전제** — CEO 화면의 `¥26,400` 이
 *    ⒜ 「엉뚱한 판매처 가격이 원본 가격으로 섞인 것」인가
 *    ⒝ 「원본 URL 이 **일본 스토어**(bobochoses.co.jp)라서 나온 **그 시장의 원본 가격**」인가
 *    → DB 의 `source_url` · 관측 행의 `source`/`currency`/`market_code` 로 **갈라 읽는다.**
 *    🔴 둘을 추측으로 단정하지 않는다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mi-008-b226ac117-provenance-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const CODE = "B226AC117";

async function main() {
  mkdirSync(OUT, { recursive: true });

  /** 🔴 칸 이름을 추측하지 않는다 — 먼저 읽는다(이 트랙 아홉 번째 함정). */
  const cols = async (t) =>
    (
      await prisma.$queryRawUnsafe(
        `select column_name, data_type from information_schema.columns
          where table_name = $1 order by ordinal_position`,
        t,
      )
    ).map((r) => `${r.column_name}:${r.data_type}`);

  const schema = {
    product_snapshots: await cols("product_snapshots"),
    price_observations: await cols("price_observations"),
  };

  /** ① 그 품번을 가진 스냅샷 전수. 🔴 여러 workspace 에 있을 수 있다. */
  const snaps = await prisma.$queryRawUnsafe(
    `select id, source_url, title, status, workspace_id, created_at, updated_at,
            workspace->'canonicalProduct' as canonical_product
       from product_snapshots
      where source_url ilike $1
         or title ilike $1
         or workspace::text ilike $1
      order by updated_at desc`,
    `%${CODE}%`,
  );

  /** ② 그 스냅샷들의 관측 전수 — 🔴 **전 source** 를 담는다(필터하지 않는다). */
  const ids = snaps.map((s) => s.id);
  const observations = ids.length
    ? await prisma.$queryRawUnsafe(
        /* 🔴 `observed_at` 은 **없는 칸** 이다(42703 실측). 정렬은 실재하는 칸으로만 한다. */
        `select * from price_observations
          where snapshot_id = any($1::uuid[])
          order by created_at desc`,
        ids,
      )
    : [];

  /** ③ 국내 링크 + 등록부 조인(링크 테이블에 domain 칸이 **없다**). */
  const links = ids.length
    ? await prisma.$queryRawUnsafe(
        `select l.*, s.domain as source_domain, s.name as source_name,
                s.collection_strategy, s.category_scope
           from domestic_product_links l
           join domestic_price_sources s on s.id = l.source_id
          where l.snapshot_id = any($1::uuid[])`,
        ids,
      )
    : [];

  /** ④ 🔴 CPO 가 제시한 국내 판매처(miniboutique)가 **등록부에 있는가**.
   *     없으면 ③(실제 동일상품 Evidence)은 **구조적으로 측정 불가** 다. */
  const registryProbe = await prisma.$queryRawUnsafe(
    `select id, name, domain, collection_strategy, enabled, category_scope
       from domestic_price_sources
      where domain ilike any (array['%cafe24%','%ljm8481%','%miniboutique%','%bobochoses%'])
      order by domain`,
  );

  /** 🟢 추측을 줄이기 위해 실제 칸 목록을 **먼저 찍는다.** */
  console.log("=== ⓞ price_observations 칸 전수");
  console.log("  " + schema.price_observations.join("\n  "));

  const payload = { code: CODE, schema, snapshots: snaps, observations, links, registryProbe };
  writeFileSync(
    path.join(OUT, "wu008-provenance.json"),
    JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1),
    "utf8",
  );

  console.log(`=== ① 스냅샷 ${snaps.length}건`);
  for (const s of snaps) {
    console.log(`  ${s.id} | ${s.status} | ws=${s.workspace_id}`);
    console.log(`     source_url: ${s.source_url}`);
    console.log(`     title     : ${String(s.title).slice(0, 70)}`);
    const cp = s.canonical_product ?? {};
    const pick = (k) => {
      const v = cp?.[k];
      return v && typeof v === "object" ? JSON.stringify(v) : String(v);
    };
    console.log(`     brand=${pick("brand")} price=${pick("price")} currency=${pick("currency")}`);
  }

  console.log(`\n=== ② 관측 ${observations.length}건 (전 source)`);
  for (const o of observations.slice(0, 40)) {
    console.log(
      `  ${String(o.observed_at ?? o.created_at).slice(0, 10)} | ${String(o.source).padEnd(14)} | ` +
        `${String(o.price ?? o.amount ?? "-").padStart(10)} ${String(o.currency ?? "-").padEnd(4)} | ` +
        `krw=${String(o.price_krw ?? "-").padStart(9)} | market=${String(o.market_code ?? "-").padEnd(6)} | ` +
        `basis=${String(o.cost_basis ?? "-")} | ${String(o.source_product_url ?? "").slice(0, 60)}`,
    );
  }

  console.log(`\n=== ③ 국내 링크 ${links.length}건`);
  for (const l of links) {
    console.log(`  ${l.source_domain} | truth=${l.match_truth} | verified=${l.verified} | ${String(l.external_url).slice(0, 70)}`);
  }

  console.log(`\n=== ④ 등록부 조회 (cafe24 / ljm8481 / miniboutique / bobochoses)`);
  for (const r of registryProbe) {
    console.log(`  ${r.domain.padEnd(28)} ${r.collection_strategy.padEnd(14)} enabled=${r.enabled} scope=${JSON.stringify(r.category_scope)}`);
  }
  if (registryProbe.length === 0) console.log("  (없음)");

  console.log(`\n🟢 wu008-provenance.json 기록 완료 (DB 쓰기 0)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
