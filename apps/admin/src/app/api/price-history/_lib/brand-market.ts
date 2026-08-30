import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveBrand } from "@commerce/crawler";
import { computeBrandMarketProfile, type BrandMarketProfile } from "@commerce/pricing";

/**
 * P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품이 없을 때, 같은 브랜드로
 * 정규화되는 다른 상품들의 "최신 SELLER_ORIGIN 관측값 중 판매 가능한 가격"을
 * 모아 BrandMarketProfile을 계산한다. 신규 집계 테이블 없이 매 요청 실시간
 * 계산이다(Single Source of Truth 원칙 — price_observations/product_snapshots가
 * 유일한 진실, 별도 테이블로 복제하면 P-12에서 겪은 "여러 가격이 서로 다른
 * 파이프라인에서 움직이는" 문제가 또 생긴다).
 */
interface SnapshotBrandRow {
  id: string;
  brand: string | null;
}

interface PriceObservationRow {
  snapshot_id: string;
  price_krw: number | null;
  sale_price_krw: number | null;
  sold_out: boolean | null;
  checked_at: string;
}

export async function computeBrandMarketProfileFor(brandRaw: string | undefined): Promise<BrandMarketProfile | null> {
  const resolved = resolveBrand(brandRaw);
  if (!resolved) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  // workspace 전체(이미지 등 포함, 상품당 1MB+)를 끌어오지 않고 brand 값만
  // PostgREST JSON path select로 가볍게 조회한다.
  const { data: snapshots, error: snapErr } = await supabase
    .from("product_snapshots")
    .select("id, brand:workspace->canonicalProduct->brand->>value");
  if (snapErr || !snapshots) return null;

  const matchingIds = (snapshots as SnapshotBrandRow[])
    .filter((s) => s.brand && resolveBrand(s.brand)?.normalizedBrandKey === resolved.normalizedBrandKey)
    .map((s) => s.id);
  if (matchingIds.length === 0) return null;

  const { data: observations, error: obsErr } = await supabase
    .from("price_observations")
    .select("snapshot_id, price_krw, sale_price_krw, sold_out, checked_at")
    .in("snapshot_id", matchingIds)
    .eq("source", "SELLER_ORIGIN")
    .order("checked_at", { ascending: false });
  if (obsErr || !observations) return null;

  // 상품(snapshot)당 최신 관측 1건만 — 이미 checked_at desc로 정렬돼 있으니
  // 먼저 만난 것이 최신이다.
  const latestPerSnapshot = new Map<string, PriceObservationRow>();
  for (const row of observations as PriceObservationRow[]) {
    if (!latestPerSnapshot.has(row.snapshot_id)) latestPerSnapshot.set(row.snapshot_id, row);
  }

  const pricesKrw: number[] = [];
  for (const obs of latestPerSnapshot.values()) {
    // 품절 상품은 브랜드 시장 가격 분포에서 제외한다(P-12B와 같은 원칙 —
    // 지금 실제로 살 수 없는 가격을 시장가로 취급하지 않는다).
    if (obs.sold_out === true) continue;
    const priceKrw = obs.sale_price_krw ?? obs.price_krw;
    if (priceKrw != null) pricesKrw.push(priceKrw);
  }

  return computeBrandMarketProfile(pricesKrw);
}
