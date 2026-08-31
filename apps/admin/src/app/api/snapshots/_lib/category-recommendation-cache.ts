import { normalizeUrl, stripShopifyLocalePrefix } from "@commerce/crawler";
import type { CanonicalProduct } from "@commerce/shared";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * P-13C-2 STEP3-B(CPO 승인, 2026-08-31) — CPO 지시: "동일 상품 재크롤링 시
 * 기존 READY 캐시를 재사용하여 외부 Coupang API를 다시 호출하지 않는다."
 *
 * apps/api/price-history/_lib/brand-market.ts의 productIdentityKey()와 같은
 * 정규화 방식(normalizeUrl + stripShopifyLocalePrefix)을 재사용한다 — 그
 * 함수 자체(스냅샷 간 브랜드 표본 dedup용, snapshotId 폴백 포함)는 이번
 * 목적과 스코프가 달라 그대로 가져다 쓰지 않고, 정규화 로직만 공유한다.
 */
export function computeSourceUrlKey(sourceUrl: string): string {
  if (!sourceUrl) return "";
  try {
    return normalizeUrl(stripShopifyLocalePrefix(sourceUrl));
  } catch {
    return sourceUrl;
  }
}

export type CategoryRecommendationCache = NonNullable<CanonicalProduct["categoryRecommendationCache"]>;

interface CacheRow {
  id: string;
  sourceUrl: string | null;
  cache: CategoryRecommendationCache | null;
  updatedAt: string;
}

/** 정규화된 sourceUrlKey가 같은 다른 스냅샷 중 status===READY인 캐시를 찾는다
 * (가장 최근에 갱신된 것 1개). brand-market.ts의 computeBrandMarketProfileFor()와
 * 같은 패턴 — workspace 전체가 아니라 필요한 jsonb path만 가볍게 select하고,
 * PostgREST jsonb 경로 필터 대신(이 코드베이스에 검증된 선례가 없어) 애플리케이션
 * 코드에서 필터링한다. */
export async function findReadyCategoryRecommendationCache(
  sourceUrlKey: string,
  excludeSnapshotId?: string,
): Promise<CategoryRecommendationCache | null> {
  if (!sourceUrlKey) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("product_snapshots")
    .select(
      "id, sourceUrl:workspace->canonicalProduct->>sourceUrl, cache:workspace->canonicalProduct->categoryRecommendationCache, updatedAt:updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error || !data) return null;

  const rows = data as unknown as CacheRow[];
  const match = rows.find(
    (row) =>
      row.id !== excludeSnapshotId &&
      row.cache?.status === "READY" &&
      row.sourceUrl &&
      computeSourceUrlKey(row.sourceUrl) === sourceUrlKey,
  );
  return match?.cache ?? null;
}
