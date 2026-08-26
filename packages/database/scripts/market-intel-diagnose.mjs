/**
 * N-4.18-M STEP M-1/M-4/M-6/M-9/M-10/M-11(대표님 지시, 2026-08-26) — "코드를
 * 더 만드는 단계가 아니다"라는 이번 스프린트 원칙에 맞춰, 새 스키마나 새
 * 판정 로직 없이 기존 테이블(price_observations/domestic_product_links/
 * domestic_price_sources/price_alerts/product_snapshots)만 읽어서 운영
 * 상태를 보여주는 읽기 전용 진단 스크립트. smartstore-diagnose.ts(N-3.73)와
 * 같은 원칙 — "대표님이 매번 DB를 직접 조회하지 않도록"만이 목적이다.
 * 데이터가 없으면 없는 그대로 0/N/A로 표시한다(임의 데이터 생성 금지).
 *
 * 사용법: node --env-file=.env scripts/market-intel-diagnose.mjs
 *   (packages/database 디렉터리에서 실행 — .env의 DATABASE_URL 사용)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function heading(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  heading("M-1. Daily Watch 데이터 축적");
  const [totalObs, bySource, snapshotCount] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM price_observations`),
    prisma.$queryRawUnsafe(
      `SELECT source, count(*)::int as c, count(DISTINCT snapshot_id)::int as snaps FROM price_observations GROUP BY source ORDER BY source`,
    ),
    prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM product_snapshots`),
  ]);
  console.log("전체 등록 상품(snapshots):", snapshotCount[0].c);
  console.log("전체 price_observations:", totalObs[0].c);
  for (const row of bySource) {
    console.log(`  - ${row.source}: ${row.c}건 (${row.snaps}개 상품)`);
  }

  const [priceChanges, soldOutChanges] = await Promise.all([
    prisma.$queryRawUnsafe(`
      WITH ordered AS (
        SELECT snapshot_id, source, source_product_url, price_krw,
          lag(price_krw) OVER (PARTITION BY snapshot_id, source, source_product_url ORDER BY checked_at) AS prev_price
        FROM price_observations
      )
      SELECT count(*)::int as c FROM ordered WHERE prev_price IS NOT NULL AND prev_price <> price_krw
    `),
    prisma.$queryRawUnsafe(`
      WITH ordered AS (
        SELECT snapshot_id, source, source_product_url, sold_out,
          lag(sold_out) OVER (PARTITION BY snapshot_id, source, source_product_url ORDER BY checked_at) AS prev_sold_out
        FROM price_observations WHERE sold_out IS NOT NULL
      )
      SELECT count(*)::int as c FROM ordered WHERE prev_sold_out IS NOT NULL AND prev_sold_out <> sold_out
    `),
  ]);
  console.log("실제 가격 변화 건수(반복 관측 중 값이 달라진 경우):", priceChanges[0].c);
  console.log("실제 품절 상태 변화 건수:", soldOutChanges[0].c);

  heading("M-4. Alert Lifecycle");
  const alertRows = await prisma.$queryRawUnsafe(`
    SELECT status, count(*)::int as c FROM price_alerts GROUP BY status ORDER BY status
  `).catch(() => null);
  if (!alertRows) {
    console.log("price_alerts 테이블 없음(마이그레이션 미실행)");
  } else if (alertRows.length === 0) {
    console.log("Alert 0건(아직 발생한 알림 없음)");
  } else {
    for (const row of alertRows) console.log(`  - ${row.status}: ${row.c}건`);
  }

  heading("M-6/M-9. 국내 편집샵 Source 품질");
  const sources = await prisma.$queryRawUnsafe(`
    SELECT name, domain, priority, collection_strategy, enabled, last_checked_at, last_success_at, last_error_code, last_error_message
    FROM domestic_price_sources ORDER BY priority, name
  `);
  for (const s of sources) {
    const strategy = s.collection_strategy;
    const autoCapable = strategy === "AUTO_API" || strategy === "AUTO_SCRAPE";
    console.log(
      `  [${s.priority}] ${s.name} (${s.domain}) — ${autoCapable ? "자동검색 가능" : "파서 없음(MANUAL)"}` +
        (s.enabled ? "" : " [비활성]"),
    );
    if (autoCapable) {
      console.log(
        `      마지막 확인: ${s.last_checked_at ?? "없음"} | 마지막 성공: ${s.last_success_at ?? "없음"} | ` +
          `최근 오류: ${s.last_error_code ?? "없음"}${s.last_error_message ? ` (${s.last_error_message})` : ""}`,
      );
    }
  }

  const matchDistribution = await prisma.$queryRawUnsafe(`
    SELECT s.name as source_name, l.match_type, count(*)::int as c
    FROM domestic_product_links l JOIN domestic_price_sources s ON s.id = l.source_id
    GROUP BY s.name, l.match_type ORDER BY s.name, l.match_type
  `);
  console.log("\n  Source별 매칭 결과 분포(domestic_product_links):");
  if (matchDistribution.length === 0) {
    console.log("    아직 매칭된 링크 없음");
  } else {
    for (const row of matchDistribution) console.log(`    ${row.source_name} / ${row.match_type}: ${row.c}건`);
  }

  heading("M-10. Candidate → Verified 전환");
  const verifiedDist = await prisma.$queryRawUnsafe(`
    SELECT match_type, verified, count(*)::int as c FROM domestic_product_links
    GROUP BY match_type, verified ORDER BY match_type, verified
  `);
  if (verifiedDist.length === 0) {
    console.log("아직 링크 없음");
  } else {
    for (const row of verifiedDist) {
      console.log(`  ${row.match_type} / verified=${row.verified}: ${row.c}건`);
    }
  }

  heading("N-6. 가격 데이터 품질(변동 유무 vs 관측 부족 구분)");
  const obsQuality = await prisma.$queryRawUnsafe(`
    SELECT
      snapshot_id,
      source,
      count(*)::int AS observation_count,
      count(DISTINCT price_krw)::int AS unique_price_count,
      count(sale_price_krw)::int AS sale_price_present_count,
      count(original_price_krw)::int AS original_price_present_count,
      count(sold_out)::int AS sold_out_observed_count,
      max(checked_at) AS last_observed_at
    FROM price_observations
    GROUP BY snapshot_id, source
    ORDER BY observation_count DESC
    LIMIT 15
  `);
  console.log("(상위 15건 — 전체는 " + obsQuality.length + "건 중 일부, observation_count 내림차순)");
  for (const row of obsQuality) {
    console.log(
      `  ${row.snapshot_id.slice(0, 8)}.../${row.source}: 관측 ${row.observation_count}건, ` +
        `고유가격 ${row.unique_price_count}종, sale_price 있음 ${row.sale_price_present_count}건, ` +
        `original_price 있음 ${row.original_price_present_count}건, sold_out 관측 ${row.sold_out_observed_count}건, ` +
        `최근 관측 ${row.last_observed_at}`,
    );
  }
  console.log(
    "\n판단 기준: unique_price_count가 1이고 observation_count가 여러 건이면 " +
      "'가격이 안 변한 것'(반복 관측했지만 값이 동일), observation_count가 1건뿐이면 " +
      "'아직 충분히 관측 못한 것'(반복 관측 자체가 없음)으로 구분해서 읽는다.",
  );

  heading("M-11. Today Dashboard 지표 정합성");
  const [totalSnaps, verifiedLinkedSnaps, obsSnaps, alertSnaps] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT count(*)::int as c FROM product_snapshots`),
    prisma.$queryRawUnsafe(
      `SELECT count(DISTINCT snapshot_id)::int as c FROM domestic_product_links WHERE verified = true AND status = 'ACTIVE'`,
    ),
    prisma.$queryRawUnsafe(
      `SELECT count(DISTINCT snapshot_id)::int as c FROM price_observations WHERE source = 'DOMESTIC_SHOP'`,
    ),
    prisma
      .$queryRawUnsafe(`SELECT count(DISTINCT snapshot_id)::int as c FROM price_alerts WHERE status IN ('OPEN','ACKNOWLEDGED')`)
      .catch(() => [{ c: "N/A(테이블 없음)" }]),
  ]);
  console.log("전체 상품:", totalSnaps[0].c);
  console.log("Verified URL 보유 상품(국내 비교 가능):", verifiedLinkedSnaps[0].c);
  console.log("국내 가격 관측이 실제로 기록된 상품:", obsSnaps[0].c);
  console.log("활성 Alert 보유 상품:", alertSnaps[0].c);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
