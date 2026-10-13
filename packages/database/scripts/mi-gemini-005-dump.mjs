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
  /* 🔴 WU-011 §12 — 표본을 넓힌다(아동 12 + 테니스 6). 브랜드를 열거하지 않고
   *    **테니스가 아닌 것** 으로 잡는다 — 열거하면 Pèpè·TAO·Mini Rodini 처럼
   *    실재하는 브랜드가 조용히 빠진다(실측: 고유상품 104 중 아동계열 95). */
  /* 🔴🔴 **WU-011 실측에서 이 조건이 표본을 오염시켰다.** `NOT ILIKE '%sergio%'`
   *    로 넓히니 **아동의류가 아닌 것** 이 KIDS_FASHION scope 로 들어왔다 —
   *    일본 라쿠텐 리스팅 2건(그중 하나는 **골프 드라이버**)이 Gemini 호출 2회와
   *    후보 6개를 소모했고, `store.shopping.yahoo.co.jp` 가 COMPARISON tier 를
   *    받았다(일본 야후가 「국내 비교가격」 증거가 될 뻔했다).
   * 🟢 그래서 **브랜드가 실제로 있는 아동 브랜드만** 받는다. 브랜드 공백과
   *    「AW26」(브랜드가 아니다 — 헌장 §12)·라쿠텐/야후 제목을 명시적으로 뺀다.
   * 🔴 브랜드를 열거하지 않고 「제외」로 가는 이유: 열거하면 Pèpè·TAO·Mini Rodini
   *    처럼 실재 브랜드가 조용히 빠진다(실측: 고유상품 104 중 아동계열 95). */
  kids: `
    (ps.workspace->'canonicalProduct'->'brand'->>'value') NOT ILIKE '%sergio%'
    AND coalesce(ps.workspace->'canonicalProduct'->'brand'->>'value','') <> ''
    AND coalesce(ps.workspace->'canonicalProduct'->'brand'->>'value','') NOT ILIKE 'AW26'
    AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') NOT LIKE '%楽天%'
    AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') NOT ILIKE '%ゴルフ%'
  `,
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
      LIMIT 14
    `);
  }
  /** 🟢 하니스가 kids/kids2/tennis 세 칸을 읽으므로 kids 를 둘로 가른다. */
  urls.kids2 = urls.kids.slice(7);
  urls.kids = urls.kids.slice(0, 7);

  /* 🔴🔴 §5-B CONTROL 선정 — 「Production 이 «이미» 결과를 만든 입력」을 섞는다.
   *    1차 덤프는 그것을 안 해서 CONTROL 링크가 **0건** 이었다(측정 성립 불가).
   *
   * 🔴 그리고 **아무 링크나 쓰면 안 된다.** 링크 36%의 출처인 bobochoses.com 은
   *    등록부에서 **disabled** 다(헌장 §12) → 재검색에서 아예 안 뒤지므로 재현이
   *    구조적으로 불가능하다. 선행 WU 가 바로 그 이유로 CONTROL 2건을 날렸고
   *    「하니스 결함이 아니었다」고 기록돼 있다.
   * 🟢 그래서 **실제로 검색되는 AUTO 샵** 의 링크만 고른다. */
  urls.control = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT ON (ps.id)
           ps.id,
           ps.source_url,
           coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') AS title,
           coalesce(ps.workspace->'canonicalProduct'->'brand'->>'value','')  AS brand
    FROM domestic_product_links l
    JOIN product_snapshots ps ON ps.id = l.snapshot_id
    JOIN domestic_price_sources s ON s.id = l.source_id
    WHERE s.collection_strategy IN ('AUTO_API','AUTO_SCRAPE')
      AND s.status = 'ACTIVE'
      AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') NOT ILIKE '[TEST]%'
      AND l.match_truth IS NOT NULL
    ORDER BY ps.id, l.created_at DESC
    LIMIT 4
  `);

  const ids = Object.values(urls).flat().map((r) => r.id);
  const snapRows = await prisma.$queryRawUnsafe(
    /* 🔴 description 을 같이 싣는다 — 운영은 `extractForeignModelCode(input.description)`
     *    를 먼저 보고 없을 때만 dna.brandModelCode 로 간다(run-domestic-price-check:787).
     *    description 을 빠뜨리면 foreignModelCode 가 달라져 **판정이 갈린다.** */
    `SELECT id, workspace->'canonicalProduct' AS "canonicalProduct",
            workspace->'canonicalProduct'->'description'->>'value' AS description
     FROM product_snapshots WHERE id = ANY($1::uuid[])`,
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

  /* 🔴🔴 §5-B CONTROL 재료 — 「운영이 낸 «그 값»」이다.
   *    VALIDATION-CLOSE 의 ①(judgeDomesticCandidate 까지 타게 한다)을 검증하려면
   *    내 하니스 산출이 **운영 링크의 match_truth / verified / price_tier 를 재현**
   *    해야 한다. 「후보가 나왔다」는 통과 조건이 아니다(헌장 §5-B).
   *    🔴 읽기만 한다. */
  /* 🔴 price_tier 칸은 **없다**(추측해서 42703 을 냈다 — 이 트랙 일곱 번째).
   *    tier 는 저장되지 않고 priceTierFromLink({matchTruth, verified}) 가 계산한다
   *    (헌장 §12: 「복제하지 않고 그 함수를 호출한다」).
   * 🔴🔴 그리고 이 주석을 처음엔 아래 템플릿 리터럴 «안» 에 넣었는데, 주석 안의
   *    백틱이 **리터럴을 닫아** SyntaxError 가 났다. 백틱 함정을 또 밟았다 —
   *    템플릿 리터럴 안에는 백틱을 쓰지 않는다. */
  const links = await prisma.$queryRawUnsafe(`
    SELECT l.snapshot_id, l.source_id, s.domain, s.name AS shop_name,
           l.match_truth, l.verified, l.match_type, l.cross_seller_verdict,
           l.external_url, l.matched_title, l.match_confidence, l.status
    FROM domestic_product_links l
    JOIN domestic_price_sources s ON s.id = l.source_id
    WHERE l.snapshot_id = ANY($1::uuid[])
    ORDER BY l.snapshot_id, s.domain
  `, ids);

  /* 🔴 WU-011 §9/§13 — before/after 집계 비교에 **기존 국내 가격 관측** 이 필요하다.
   *    transient 레코드를 섞기 «전/후» 를 같은 집계기로 돌려야 효과를 말할 수 있다.
   *    🔴 읽기만 한다. */
  const obs = await prisma.$queryRawUnsafe(`
    SELECT o.snapshot_id, o.id, o.source, o.source_label, o.source_product_url,
           o.source_ref_id, o.currency, o.price_amount, o.price_krw, o.sold_out,
           o.market_code, o.checked_at
    FROM price_observations o
    WHERE o.snapshot_id = ANY($1::uuid[]) AND o.source = 'DOMESTIC_SHOP'
    ORDER BY o.snapshot_id, o.checked_at DESC
  `, ids);
  writeFileSync(path.join(OUT, "e2e-observations.json"), JSON.stringify(obs, null, 1), "utf8");
  writeFileSync(path.join(OUT, "e2e-links.json"), JSON.stringify(links, null, 1), "utf8");
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
        "🔴 CONTROL 운영 링크": links.length,
        "국내 가격 관측": obs.length,
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
