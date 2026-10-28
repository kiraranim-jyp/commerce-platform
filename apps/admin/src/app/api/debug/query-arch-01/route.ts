import { NextResponse } from "next/server";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { resolveMarketCategoryScopes } from "../../domestic-price-sources/_lib/category-scope";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { computeMarketIntelligence } from "../../price-history/_lib/market-intelligence";
import { runDomesticPriceCheck } from "../../price-history/_lib/run-domestic-price-check";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 QUERY-ARCH-01 §17 — **1회용 Production 측정 라우트** (CPO GO 2026-10-28)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 — `APIFY_API_TOKEN` 이 Vercel **Production 전용 · Encrypted** 라
 * `vercel env pull` 로 **빈 문자열** 이 내려온다(§10 실측). 🔴 CTO 가 그 값을 읽을 수
 * 없고 읽어서도 안 된다. 🟢 그래서 **Production 이 «자기» env 로 돌게** 한다 —
 * `debug/naver-product-get-raw` 가 같은 이유로 쓰는 **검증된 게이팅 패턴** 그대로다.
 *
 * ── 🔴 수명주기(§10) — 이 파일은 «지워질» 파일이다 ────────────────────────
 * ```
 * ① 1회용 token 생성 → ② Production Sensitive env 등록 → ③ 이 라우트에만 사용
 * ④ 10회 실행 → ⑤ 필요한 funnel 만 반환 → ⑥ token 즉시 폐기
 * ⑦ 이 파일 삭제 → ⑧ 재배포 → ⑨ source + deployment 로 삭제 증명
 * ```
 * 🔴 **토큰 값을 응답에도 로그에도 싣지 않는다.**
 *
 * ── 🔴 운영 경로를 «그대로» 탄다 ──────────────────────────────────────────
 * ```
 * `/api/price-history/check` 와 **같은 함수 · 같은 인자** 다.
 * 🔴 Query 를 여기서 만들지 않는다 · retry 0 · 상품당 Search 정확히 1회.
 * 🔴 Identity/MI/Market Attribution/Registry 를 건드리지 않는다.
 * ```
 */

export const maxDuration = 300;

/** 🟢 HISTORY-10 — 공개 식별자다(비밀값 아님). */
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
  const expected = process.env.DEBUG_QUERY_ARCH_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const i = Number(new URL(request.url).searchParams.get("i"));
  const t = TARGETS[i];
  if (!t) return NextResponse.json({ error: "i out of range" }, { status: 400 });

  const snapshot = await getSnapshot(t.snapshotId, t.workspaceId);
  if (!snapshot) return NextResponse.json({ stage: "SNAPSHOT", error: "not found" }, { status: 200 });
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
  const dna = buildProductIdentityDna(product);

  /** 🔴 `/check` 와 **같은 인자** 다 — 상품당 Search 정확히 1회. */
  const domesticShop = await runDomesticPriceCheck({
    snapshotId: t.snapshotId,
    workspaceId: t.workspaceId,
    dna,
    description: product.description.value || undefined,
    categoryScopes: resolveMarketCategoryScopes(product, snapshot.workspace.marketCategoryProfileId),
    domesticListingHop: true,
    webSearch: true,
  });

  /** 🔴 응답 조립도 `/check` 와 **같은 합류 자리** 다(새 계산 0). */
  const transient = [
    ...(domesticShop.geminiEvidence ?? []),
    ...(domesticShop.urlCandidateEvidence ?? []),
    ...(domesticShop.overseasAutoEvidence ?? []),
    ...(domesticShop.reviewedSameEvidence ?? []),
    ...(domesticShop.domesticListingEvidence ?? []),
    ...(domesticShop.webSearchEvidence ?? []),
  ];
  let mi: Record<string, unknown> | null = null;
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

  return NextResponse.json({
    i,
    cat: t.cat,
    label: t.label,
    origin: { brand: dna.brand.value, code: dna.brandModelCode, title: dna.title, color: dna.color, material: dna.material, fit: dna.fit },
    search: domesticShop.webSearchMetrics ?? null,
    pool: domesticShop.webSearchUrlMetrics ?? null,
    evidenceByProducer: {
      webSearch: domesticShop.webSearchEvidence?.length ?? 0,
      domesticListing: domesticShop.domesticListingEvidence?.length ?? 0,
      urlCandidate: domesticShop.urlCandidateEvidence?.length ?? 0,
      overseasAuto: domesticShop.overseasAutoEvidence?.length ?? 0,
      reviewedSame: domesticShop.reviewedSameEvidence?.length ?? 0,
      gemini: domesticShop.geminiEvidence?.length ?? 0,
    },
    rows: transient.map((e) => ({
      source: e.source,
      domain: e.domain,
      market: e.market,
      tier: e.priceTier,
      verdict: e.crossSellerVerdict,
      /** 🔴 칸 이름을 추측하지 않는다 — `GeminiTransientEvidence` 타입에서 읽었다
       *    (1차에 `price`/`currency`/`url` 로 썼다가 **typecheck 가 잡았다**). */
      price: e.priceAmount,
      currency: e.priceCurrency,
      priceKrw: e.priceKrw,
      priceStatus: e.priceStatus,
      url: e.discoveredUrl,
    })),
    mi,
    sourceErrors: domesticShop.sourceErrors.slice(0, 5),
  });
}
