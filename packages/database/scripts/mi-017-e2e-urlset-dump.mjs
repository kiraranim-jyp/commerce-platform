/**
 * WU-017-E2E — 「AI 가 찾아온 URL → 따져가 검증」 측정용 **읽기 전용** 덤프
 *
 * 🔴 **READ ONLY.** INSERT/UPDATE/DELETE 0 · migration 0 · 외부 API 0 · Gemini 0 · AI 0.
 * 🔴 **이 덤프는 「AI 가 찾아온 URL」이 아니다.** CTO 는 브라우저 AI 를 쓸 수 없으므로
 *    (§12 소비자 AI 웹 UI 금지 · API 금지) 입력 URL 의 출처를 **운영 DB 실데이터** 로 둔다.
 *    🟢 측정 대상은 **URL 의 출처가 아니라 그 뒤 체인의 정확도** 이고, 체인은 URL 이
 *       어디서 왔는지 모른다(`collectAiAnswerCandidatePool` 은 텍스트만 받는다).
 *    🔴 그래서 보고서에 「AI Recall」을 적지 않는다 — 분모가 AI 가 아니다.
 *
 * 모으는 것 — 전부 **실제로 운영에 들어 있는 URL** 이다:
 *   ① 원상품 (KIDS / TENNIS) — source_url · title · brand · 품번
 *   ② 국내 링크 external_url + 그때 운영이 남긴 matched_title/brand/match_truth
 *      🔴 match_truth 는 **우리 판정** 이다. GT 로 쓰지 않는다(참조용으로만 담는다).
 *   ③ price_observations.source_product_url — 원산지/시장 probe 가 실제로 본 URL
 *      (같은 상품의 KR/JP/Global 쌍이 여기서 나온다)
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mi-017-e2e-urlset-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🟢 scope 조건은 선행 덤프(mi-gemini-005-dump.mjs)의 **그 조건** 을 그대로 쓴다. */
const SCOPE = {
  kids: `(ps.workspace->'canonicalProduct'->'brand'->>'value') NOT ILIKE '%sergio%'
         AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') NOT LIKE '%楽天%'
         AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') NOT ILIKE '%ゴルフ%'`,
  tennis: `(ps.workspace->'canonicalProduct'->'brand'->>'value') ILIKE '%sergio%'`,
};

async function snapshots(scopeKey) {
  return prisma.$queryRawUnsafe(
    `SELECT ps.id,
            ps.source_url,
            coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','')  AS title,
            coalesce(ps.workspace->'canonicalProduct'->'brand'->>'value','')  AS brand,
            ps.workspace->'canonicalProduct'->'sku'->>'value'                 AS sku,
            ps.workspace->'canonicalProduct'->'description'->>'value'         AS description,
            ps.workspace->'canonicalProduct'->'price'                         AS price
       FROM product_snapshots ps
      WHERE ps.workspace->'canonicalProduct' IS NOT NULL
        AND coalesce(ps.workspace->'canonicalProduct'->'title'->>'value','') NOT ILIKE '[TEST]%'
        AND ${SCOPE[scopeKey]}
      ORDER BY ps.created_at DESC`,
  );
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

  const kids = await snapshots("kids");
  const tennis = await snapshots("tennis");
  const ids = [...kids, ...tennis].map((r) => r.id);
  console.log(`원상품 KIDS ${kids.length} · TENNIS ${tennis.length}`);

  /** ② 🔴 칸 이름은 선행 덤프(mi-021)가 information_schema 로 확인한 그 목록이다. */
  const links = await prisma.$queryRawUnsafe(
    `SELECT snapshot_id, source_id, external_url, matched_title, matched_brand, matched_color,
            match_confidence, match_truth, match_type, cross_seller_verdict, verified, status
       FROM domestic_product_links
      WHERE snapshot_id = any($1::uuid[])
        AND external_url IS NOT NULL`,
    ids,
  );

  /** ③ 같은 상품의 시장별 URL — probe 가 실제로 본 것. */
  const observations = await prisma.$queryRawUnsafe(
    `SELECT snapshot_id, source, source_label, source_product_url, market_code, market_country,
            currency, price_amount, price_krw, checked_at
       FROM price_observations
      WHERE snapshot_id = any($1::uuid[])
        AND source_product_url IS NOT NULL
      ORDER BY checked_at DESC`,
  ids,
  );

  const out = {
    kids,
    tennis,
    links,
    observations,
    counts: {
      kids: kids.length,
      tennis: tennis.length,
      links: links.length,
      observations: observations.length,
      linkHosts: [...new Set(links.map((l) => safeHost(l.external_url)))].sort(),
      observationHosts: [...new Set(observations.map((o) => safeHost(o.source_product_url)))].sort(),
    },
  };
  writeFileSync(path.join(OUT, "mi-017-e2e-urlset.json"), JSON.stringify(out, null, 2), "utf8");
  console.log(`링크 ${links.length} · 관측 ${observations.length}`);
  console.log(`링크 host: ${out.counts.linkHosts.join(", ")}`);
  console.log(`관측 host: ${out.counts.observationHosts.join(", ")}`);
  console.log(`→ ${path.join(OUT, "mi-017-e2e-urlset.json")}`);
}

function safeHost(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return `(파싱불가)`;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
