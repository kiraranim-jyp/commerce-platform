import { NextResponse } from "next/server";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { resolveMarketCategoryScopes } from "../../domestic-price-sources/_lib/category-scope";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import {
  listReviewedSameUrls,
  listSnapshotVerifiedSameKeys,
} from "../../price-history/_lib/candidate-review";
import { computeMarketIntelligence } from "../../price-history/_lib/market-intelligence";
import {
  MAX_SUPPLIED_CANDIDATE_URLS,
  runDomesticPriceCheck,
} from "../../price-history/_lib/run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 QUERY-ADOPT-01 §9 — **1회용 E2E 측정 라우트**(실행 후 삭제)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `APIFY_API_TOKEN` 이 Production 전용 Encrypted 라 CTO 가 읽을 수 없다 ⟹
 *    **Production 이 자기 env 로 돌게** 한다(§10 · 검증된 게이팅 패턴).
 *
 * 🔴🔴 **직전 §17 라우트가 빠뜨린 것을 이번에 넣는다** — `reviewedSameUrls` 와
 *    `verifiedSameUrlKeys`. 운영 `/check` 는 그 둘을 넘기는데 그때 안 넘겨서
 *    `__reviewed_same__` 생산자가 한 줄도 돌지 않았고, 그 수치를 제품 결과로
 *    읽을 뻔했다(CANDIDATE-SYNC-01 §C 에 기록).
 *
 * 🔴 Query 는 **운영 기본값**(채택된 신호)을 쓴다 — 이 라우트는 신호를 넘기지 않는다.
 * 🔴 상품당 Search **정확히 1회** · retry 0 · 변형 0 · 국내/해외 분리 0.
 */

export const maxDuration = 300;

const TARGETS = [
  { cat: "KIDS", label: "Bobo Choses", snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "BOSS", snapshotId: "74bbe30a-641c-4226-981d-7ab1552de8ea", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "Louis Louise", snapshotId: "621c1848-372b-4719-96e4-61d808e1de0a", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "Main Story", snapshotId: "c27d4727-2248-4fe0-9084-8c239737a889", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "KIDS", label: "Mini rodini", snapshotId: "96a9766a-f05d-4c35-b4c9-43de8ca495a5", workspaceId: "df50fd5e-6586-499b-a21d-57f5a3e86d70" },
  { cat: "TENNIS", label: "Damarindo Pique Polo", snapshotId: "5f207353-acd3-4ee4-85d1-88f408452620", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Fall Cericho T-Shirt", snapshotId: "dbc1e8b5-aec5-4df3-9bd4-b67a84d4d6db", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Magro Long Sleeve", snapshotId: "614bfeb7-a627-442f-82bb-f6cfed52c428", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Racchetto Polo", snapshotId: "07fde45e-4a28-478d-8ca8-83a6cea6c0e8", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
  { cat: "TENNIS", label: "Trattino Short", snapshotId: "6333f04f-beba-4840-a2de-99073a700208", workspaceId: "b60b0ad7-d750-4f70-a1c3-a4d220f76756" },
] as const;

function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_ADOPT_E2E_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const i = Number(new URL(request.url).searchParams.get("i"));
  const t = TARGETS[i];
  if (!t) return NextResponse.json({ error: "i out of range" }, { status: 400 });

  const snapshot = await getSnapshot(t.snapshotId, t.workspaceId);
  if (!snapshot) return NextResponse.json({ stage: "SNAPSHOT", error: "not found" }, { status: 200 });
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
  const dna = buildProductIdentityDna(product);

  /** 🟢 `/check` 와 **같은 읽기** — 이번엔 빠뜨리지 않는다. */
  let reviewedSameUrls: string[] = [];
  let verifiedSameKeys: string[] = [];
  try {
    reviewedSameUrls = await listReviewedSameUrls({
      snapshotId: t.snapshotId,
      originCode: dna.brandModelCode ? dna.brandModelCode.toUpperCase() : null,
      workspaceId: t.workspaceId,
      limit: MAX_SUPPLIED_CANDIDATE_URLS,
    });
  } catch {
    /* 읽기 실패는 측정에서 0 으로 적는다 — 운영과 같은 fail-soft */
  }
  try {
    verifiedSameKeys = await listSnapshotVerifiedSameKeys({
      snapshotId: t.snapshotId,
      workspaceId: t.workspaceId,
    });
  } catch {
    /* 같은 이유 */
  }

  const r = await runDomesticPriceCheck({
    snapshotId: t.snapshotId,
    workspaceId: t.workspaceId,
    dna,
    description: product.description.value || undefined,
    categoryScopes: resolveMarketCategoryScopes(product, snapshot.workspace.marketCategoryProfileId),
    reviewedSameUrls: reviewedSameUrls.length > 0 ? reviewedSameUrls : undefined,
    verifiedSameUrlKeys: verifiedSameKeys.length > 0 ? verifiedSameKeys : undefined,
    domesticListingHop: true,
    webSearch: true,
  });

  const transient = [
    ...(r.geminiEvidence ?? []),
    ...(r.urlCandidateEvidence ?? []),
    ...(r.overseasAutoEvidence ?? []),
    ...(r.reviewedSameEvidence ?? []),
    ...(r.domesticListingEvidence ?? []),
    ...(r.webSearchEvidence ?? []),
  ];
  let mi: unknown = null;
  try {
    const m = await computeMarketIntelligence(t.snapshotId, t.workspaceId, transient.length ? transient : null);
    mi = m
      ? {
          domesticLowestKrw: m.domesticCompetition?.lowestPriceKrw ?? null,
          candidateDomesticPrice: m.candidateDomesticPrice ?? null,
          candidateOverseasPrice: m.candidateOverseasPrice ?? null,
        }
      : null;
  } catch (e) {
    mi = { error: (e as Error).message.slice(0, 120) };
  }

  const bucket = (m: string) => transient.filter((e) => e.market === m).length;
  return NextResponse.json({
    i,
    cat: t.cat,
    label: t.label,
    origin: { brand: dna.brand.value, code: dna.brandModelCode, title: dna.title },
    search: r.webSearchMetrics ?? null,
    pool: r.webSearchUrlMetrics ?? null,
    reinjected: reviewedSameUrls.length,
    byProducer: {
      webSearch: r.webSearchEvidence?.length ?? 0,
      reviewedSame: r.reviewedSameEvidence?.length ?? 0,
      domesticListing: r.domesticListingEvidence?.length ?? 0,
      overseasAuto: r.overseasAutoEvidence?.length ?? 0,
      urlCandidate: r.urlCandidateEvidence?.length ?? 0,
    },
    verdicts: {
      SAME: transient.filter((e) => e.crossSellerVerdict === "SAME").length,
      PRESUMED_SAME: transient.filter((e) => e.crossSellerVerdict === "PRESUMED_SAME").length,
      SIMILAR: transient.filter((e) => e.crossSellerVerdict === "SIMILAR").length,
      CONFLICT: transient.filter((e) => e.crossSellerVerdict === "CONFLICT").length,
    },
    market: { KR: bucket("KR"), OVERSEAS: bucket("OVERSEAS"), UNKNOWN: bucket("UNKNOWN") },
    rows: transient.map((e) => ({
      source: e.source,
      domain: e.domain,
      market: e.market,
      tier: e.priceTier,
      verdict: e.crossSellerVerdict,
      price: e.priceAmount,
      currency: e.priceCurrency,
      priceStatus: e.priceStatus,
      url: e.discoveredUrl,
    })),
    mi,
    sourceErrors: r.sourceErrors.slice(0, 3),
  });
}
