/**
 * WU-024 — 병목 A: **Registry 밖 후보 URL 의 «기존 출처» 전수 조사** (읽기 전용)
 *
 * 🔴 **READ ONLY.** INSERT/UPDATE/DELETE 0 · migration 0 · 외부 API 0 · AI 0 · HTTP 0.
 *
 * 왜: 전수검토 10축 ④「비-AI producer 가능성 — 실제 코드/데이터에서 연결 가능한
 *     출처가 있는가」를 **추측이 아니라 DB 로** 닫는다. 🔴 칸 이름을 추측하지
 *     않는다(이 트랙이 열 번 넘게 밟은 함정) — `information_schema` 에서 읽는다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-024-url-producer-census.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 WU-022 GT 가 확정한 «Registry 밖» 국내 판매처 5곳 (인수인계 §3-1). */
const GT_DOMAINS = ["biskuit.kr", "m.luxboy.com", "m.web.mustit.co.kr", "beaumonde.co.kr", "donokids.com"];

const hostOf = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
};

async function main() {
  const report = {};

  /* ① 🔴 URL 을 담는 «모든» 칸을 스키마에서 읽는다 — 추측 금지. */
  report.urlColumns = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name ILIKE '%url%' OR column_name ILIKE '%link%' OR column_name ILIKE '%domain%')
    ORDER BY table_name, column_name
  `);

  /* ② 등록부 — 이것이 현재 커버리지 상한이다. */
  report.registry = await prisma.$queryRawUnsafe(`
    SELECT domain, name, collection_strategy, status, enabled, category_scope
    FROM domestic_price_sources
    ORDER BY domain
  `);

  /* ③ 저장된 국내 링크의 host 분포 — 전부 등록부 안인지 확인한다. */
  report.linkHosts = await prisma.$queryRawUnsafe(`
    SELECT external_url FROM domestic_product_links WHERE external_url IS NOT NULL
  `);

  /* ④ 관측 URL 의 host 분포(source 별). */
  report.observationUrls = await prisma.$queryRawUnsafe(`
    SELECT source, source_product_url FROM price_observations WHERE source_product_url IS NOT NULL
  `);

  /* ⑤ 원상품 URL — 「해외 원본」축. 국내 후보 공급원이 될 수 있는지 본다. */
  report.snapshotUrls = await prisma.$queryRawUnsafe(`
    SELECT source_url FROM product_snapshots WHERE source_url IS NOT NULL
  `);

  /* ⑥ 🔴 GT 5곳이 DB 어딘가에 «이미» 있는가 — 있으면 기존 데이터가 producer 가 된다. */
  const likeClauses = GT_DOMAINS.map((d) => `'%${d}%'`).join(", ");
  report.gtHitsInLinks = await prisma.$queryRawUnsafe(
    `SELECT external_url FROM domestic_product_links WHERE external_url ILIKE ANY (ARRAY[${likeClauses}])`,
  );
  report.gtHitsInObservations = await prisma.$queryRawUnsafe(
    `SELECT source, source_product_url FROM price_observations WHERE source_product_url ILIKE ANY (ARRAY[${likeClauses}])`,
  );
  report.gtHitsInSnapshots = await prisma.$queryRawUnsafe(
    `SELECT source_url FROM product_snapshots WHERE source_url ILIKE ANY (ARRAY[${likeClauses}])`,
  );
  report.gtHitsInRegistry = await prisma.$queryRawUnsafe(
    `SELECT domain, name FROM domestic_price_sources WHERE domain ILIKE ANY (ARRAY[${likeClauses}])`,
  );

  /* ─────────── 집계 (분모를 섞지 않는다) ─────────── */
  const registryDomains = new Set(report.registry.map((r) => r.domain.trim().toLowerCase()));
  const tally = (rows, pick) => {
    const m = new Map();
    for (const r of rows) {
      const h = hostOf(pick(r));
      if (!h) continue;
      m.set(h, (m.get(h) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const linkTally = tally(report.linkHosts, (r) => r.external_url);
  const obsTally = tally(report.observationUrls, (r) => r.source_product_url);
  const snapTally = tally(report.snapshotUrls, (r) => r.source_url);

  const summary = {
    registryCount: report.registry.length,
    registryDomains: [...registryDomains].sort(),
    linkHostsTotal: linkTally.length,
    linkHostsOutsideRegistry: linkTally.filter(([h]) => !registryDomains.has(h)),
    observationHostsTotal: obsTally.length,
    observationHostsOutsideRegistry: obsTally.filter(([h]) => !registryDomains.has(h)),
    snapshotHostsTotal: snapTally.length,
    snapshotHostsTop: snapTally.slice(0, 20),
    gt: {
      domains: GT_DOMAINS,
      inRegistry: report.gtHitsInRegistry,
      inLinks: report.gtHitsInLinks.length,
      inObservations: report.gtHitsInObservations.length,
      inSnapshots: report.gtHitsInSnapshots.length,
    },
    urlColumns: report.urlColumns,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "wu-024-url-census.json"), JSON.stringify({ summary, report }, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
