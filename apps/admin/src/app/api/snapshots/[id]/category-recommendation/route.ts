import { NextResponse } from "next/server";
import { buildResolverBiasedQuery, resolveProductSignals, ruleBasedCategoryProvider } from "@commerce/category";
import type { CanonicalProduct } from "@commerce/shared";
import { getCoupangCredentials } from "../../../coupang/_lib/env";
import { resolveCategoryV3 } from "../../../coupang/_lib/category-resolver-v3";
import { computeSourceUrlKey, findReadyCategoryRecommendationCache } from "../../_lib/category-recommendation-cache";
import { getSnapshotRaw, saveSnapshot } from "../../_lib/snapshot";
import type { ProductSnapshot } from "../../_lib/types";

/**
 * P-13C-2 STEP3-B(CPO 승인, 2026-08-31) — 신규 상품 스냅샷 최초 저장 직후
 * page.tsx가 1회 호출한다(비차단, void fetch). categoryResolverKpi(사용자 확정
 * 기록)는 절대 건드리지 않는다 — 이 라우트는 categoryRecommendationCache만
 * 쓴다. CPO 지시 흐름을 그대로 구현한다:
 *   ① 이미 이 스냅샷에 READY/PENDING/FAILED 캐시가 있으면 종료(자동 재시도 없음)
 *   ② 동일 sourceUrlKey의 다른 스냅샷에 READY 캐시가 있으면 복사(외부 API 호출 없음)
 *   ③ 없으면 PENDING 저장(동시 호출 잠금) → Resolver 1회 호출 → READY/FAILED 저장
 *
 * 신규 API 호출 없음 — /api/coupang/category-recommend가 이미 쓰는
 * resolveCategoryV3/getCoupangCredentials를 그대로 재사용한다.
 */
async function persistCache(snapshot: ProductSnapshot, product: CanonicalProduct) {
  return saveSnapshot({
    id: snapshot.id,
    sourceUrl: snapshot.sourceUrl,
    title: snapshot.title,
    thumbnailUrl: snapshot.thumbnailUrl,
    workspace: { ...snapshot.workspace, canonicalProduct: product },
  });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await getSnapshotRaw(id);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const product = snapshot.workspace.canonicalProduct;
  const sourceUrlKey = computeSourceUrlKey(product.sourceUrl);
  if (!sourceUrlKey) {
    return NextResponse.json({ ok: true, skipped: "no-source-url" });
  }

  // ① — sourceUrlKey가 일치하는 캐시가 이미 있으면(READY/PENDING/FAILED 무엇이든)
  // 자동으로는 아무 것도 하지 않는다. PENDING은 동시 호출 잠금 역할이고, FAILED는
  // 사용자가 명시적으로 재시도할 때만 다시 시도한다(자동 재시도 금지).
  const existing = product.categoryRecommendationCache;
  if (existing && existing.sourceUrlKey === sourceUrlKey) {
    return NextResponse.json({ ok: true, skipped: `already-${existing.status.toLowerCase()}` });
  }

  // ② — 동일 상품(정규화된 sourceUrl 동일)의 다른 스냅샷에 READY 캐시가 있으면
  // 그대로 복사한다. 외부 API를 다시 부르지 않는다(CPO 옵션 2 결정).
  const reusable = await findReadyCategoryRecommendationCache(sourceUrlKey, id);
  if (reusable) {
    const cache = { ...reusable, sourceUrlKey };
    const saved = await persistCache(snapshot, { ...product, categoryRecommendationCache: cache });
    return NextResponse.json({ ok: saved.ok, status: "READY", reused: true, cache });
  }

  // ③ — PENDING을 먼저 저장해서 잠근 뒤에만 외부 API를 부른다.
  await persistCache(snapshot, { ...product, categoryRecommendationCache: { sourceUrlKey, status: "PENDING" } });

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    // 인증 정보 미설정은 API 실패가 아니라 아직 연결 전인 정상 상태다 — FAILED로
    // 기록하지 않고 캐시를 비워, 연결 완료 후 다음 시도가 자연스럽게 다시 시도되게 한다.
    await persistCache(snapshot, { ...product, categoryRecommendationCache: undefined });
    return NextResponse.json({ ok: true, skipped: "not-configured" });
  }

  try {
    const signals = resolveProductSignals(product);
    const biasedQuery = buildResolverBiasedQuery(signals, product.title.value, false);
    const ruleBasedNames = ruleBasedCategoryProvider.recommendCategory(product, "coupang").map((c) => c.name);
    const result = await resolveCategoryV3(
      credentials,
      biasedQuery,
      signals,
      product.brand.value || undefined,
      ruleBasedNames,
    );
    const cache: NonNullable<CanonicalProduct["categoryRecommendationCache"]> = {
      sourceUrlKey,
      status: "READY",
      candidates: result.candidates.map((c) => ({
        categoryCode: c.categoryCode,
        categoryName: c.categoryName,
        path: c.path,
        hierarchy: c.hierarchy,
        score: c.score,
        metaVerified: c.metaVerified,
      })),
      resolverDecision: result.decision,
      similarityScore: result.best?.score ?? null,
      evidence: [],
      resolvedAt: new Date().toISOString(),
    };
    const saved = await persistCache(snapshot, { ...product, categoryRecommendationCache: cache });
    return NextResponse.json({ ok: saved.ok, status: "READY", reused: false, cache });
  } catch (error) {
    const cache: NonNullable<CanonicalProduct["categoryRecommendationCache"]> = {
      sourceUrlKey,
      status: "FAILED",
      failureReason: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
      resolvedAt: new Date().toISOString(),
    };
    const saved = await persistCache(snapshot, { ...product, categoryRecommendationCache: cache });
    return NextResponse.json({ ok: saved.ok, status: "FAILED", cache });
  }
}
