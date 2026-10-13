/**
 * MI-GEMINI-INTEGRATION-005 ⑥ — E2E 표본 덤프 (READ ONLY)
 *
 * 🔴 **읽기 전용이다.** INSERT/UPDATE/DELETE 0 · migration 0.
 * 🔴 왜 필요한가: `listDomesticPriceSources` 는 로컬에서 `getSupabaseAdmin()` 이
 *    service-role key 를 못 읽어 **조용히 `[]`** 를 준다(헌장 §12 실측). 그대로
 *    두면 「후보 0 = 검색 실패」라는 완전히 틀린 결론이 난다. 그래서 운영과
 *    **같은 머지**(카탈로그 + workspace 설정 · 설정 없으면 ON)를 DB 로 재현한다.
 *
 * 사용법: packages/database 에서  node --env-file=.env scripts/mi-gemini-005-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 아동복 + 테니스 «둘 다» 본다 — 지시서 ⑥ 이 scope 검증을 요구한다. */
const GROUPS = {
  kids: `(ps.workspace->'canonicalProduct'->'brand'->>'value') ILIKE ANY (ARRAY['%bobo%','%bonjour%','%louise%','%bonpoint%','%misha%'])`,
  tennis: `(ps.workspace->'canonicalProduct'->'brand'->>'value') ILIKE '%sergio%'`,
};

async function main() {
  mkdirSync(OUT, { recursive: true });

  const urls = {};
  for (const [key, where] of Object.entries(GROUPS)) {
    /* 🔴🔴 첫 덤프가 **같은 상품 6건**을 냈다 — created_at DESC + LIMIT 만 걸어서
     *    같은 상품의 스냅샷이 반복됐다. §5-B 의 CONTROL 선정 원칙대로 **서로 다른
     *    상품** 이어야 측정이 성립한다. 그래서 title 로 DISTINCT 한다.
     *    🔴 「6건 나왔다」를 「상품 6개」로 읽으면 측정이 거짓말을 한다. */
    urls[key] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT ON (title) * FROM (
        SELECT ps.id,
               ps.source_url,
               coalesce(ps.workspace->'canonicalProduct'->'title'->>'value', '') AS title,
               coalesce(ps.workspace->'canonicalProduct'->'brand'->>'value', '') AS brand,
               ps.created_at
        FROM product_snapshots ps
        WHERE ${where}
          AND ps.workspace->'canonicalProduct' IS NOT NULL
          /* 🔴 [TEST] 접두 상품은 **실상품이 아니다** — 표본에서 뺀다.
           *    첫 덤프에 섞여 있었다. 실상품 E2E 라고 쓰면서 테스트 행을 재면
           *    그 숫자는 아무것도 증명하지 않는다. */
          AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value', '') NOT ILIKE '[TEST]%'
      ) t
      ORDER BY title, created_at DESC
      LIMIT 6
    `);
  }
  /** 🟢 하니스가 kids/kids2/tennis 세 칸을 읽으므로 kids 를 둘로 가른다. */
  urls.kids2 = urls.kids.slice(3);
  urls.kids = urls.kids.slice(0, 3);

  const ids = Object.values(urls).flat().map((r) => r.id);
  const snapRows = await prisma.$queryRawUnsafe(
    `SELECT id, workspace->'canonicalProduct' AS "canonicalProduct" FROM product_snapshots WHERE id = ANY($1::uuid[])`,
    ids,
  );

  /** 🔴 운영 머지 재현 — 카탈로그 enabled 는 «무시» 되고 workspace 설정이 owner 다
   *     (domestic-price-source.ts:187 · 설정이 없으면 ON = fail-open). */
  const sources = await prisma.$queryRawUnsafe(`
    SELECT s.id, s.name, s.domain, s.currency,
           s.collection_strategy   AS "collectionStrategy",
           s.status,
           s.access_status         AS "accessStatus",
           s.category_scope        AS "categoryScope",
           coalesce(w.enabled, true) AS enabled
    FROM domestic_price_sources s
    LEFT JOIN (
      SELECT DISTINCT ON (source_id) source_id, enabled
      FROM workspace_domestic_shop_settings
      ORDER BY source_id, updated_at DESC
    ) w ON w.source_id = s.id
    ORDER BY s.name
  `);

  writeFileSync(path.join(OUT, "e2e-urls.json"), JSON.stringify(urls, null, 1), "utf8");
  writeFileSync(path.join(OUT, "e2e-snapshots.json"), JSON.stringify(snapRows, null, 1), "utf8");
  writeFileSync(path.join(OUT, "e2e-sources.json"), JSON.stringify(sources, null, 1), "utf8");
  console.log(
    JSON.stringify(
      {
        OUT,
        urls: Object.fromEntries(Object.entries(urls).map(([k, v]) => [k, v.length])),
        snapshots: snapRows.length,
        sources: sources.length,
        "enabled=true": sources.filter((s) => s.enabled).length,
        titles: Object.values(urls).flat().map((r) => `${r.brand} / ${r.title}`.slice(0, 70)),
      },
      null,
      1,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
