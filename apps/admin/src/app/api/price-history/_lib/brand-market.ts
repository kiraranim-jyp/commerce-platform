import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveBrand, stripShopifyLocalePrefix, normalizeUrl } from "@commerce/crawler";
import { computeBrandMarketProfile, type BrandMarketProfile } from "@commerce/pricing";

/**
 * P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품이 없을 때, 같은 브랜드로
 * 정규화되는 다른 상품들의 "최신 SELLER_ORIGIN 관측값 중 판매 가능한 가격"을
 * 모아 BrandMarketProfile을 계산한다. 신규 집계 테이블 없이 매 요청 실시간
 * 계산이다(Single Source of Truth 원칙 — price_observations/product_snapshots가
 * 유일한 진실, 별도 테이블로 복제하면 P-12에서 겪은 "여러 가격이 서로 다른
 * 파이프라인에서 움직이는" 문제가 또 생긴다).
 *
 * CTO 1차 실측 검증(2026-08-31)에서 발견: 같은 실제 상품을 개발/테스트 중
 * 여러 번 재크롤링하면 product_snapshots에 별도 row가 여러 개 쌓인다(실측—
 * Bobo Choses "Stamp Bloom Denim Pants" 1개 상품이 snapshot 17개로 중복 저장돼
 * 있었다). snapshot 단위로 표본을 세면 이 중복이 표본 수/confidence를
 * 부풀린다 — sourceUrl(로케일 prefix 제거 후) 단위로 묶어 실제 서로 다른
 * 상품 개수만큼만 표본에 반영한다.
 */
interface SnapshotBrandRow {
  id: string;
  brand: string | null;
  sourceUrl: string | null;
}

interface PriceObservationRow {
  snapshot_id: string;
  price_krw: number | null;
  sale_price_krw: number | null;
  sold_out: boolean | null;
  checked_at: string;
}

/** exported for direct unit testing (CPO 2차 검증 항목 1/2) — 재크롤링/로케일
 * URL/쿼리스트링 변형이 같은 상품으로 묶이는지, 서로 다른 상품은 절대
 * 합쳐지지 않는지를 실제 프로덕션 코드 경로로 검증한다. */
export function productIdentityKey(sourceUrl: string | null, snapshotId: string): string {
  if (!sourceUrl) return `no-url:${snapshotId}`;
  try {
    return normalizeUrl(stripShopifyLocalePrefix(sourceUrl));
  } catch {
    return sourceUrl;
  }
}

export async function computeBrandMarketProfileFor(brandRaw: string | undefined): Promise<BrandMarketProfile | null> {
  const resolved = resolveBrand(brandRaw);
  if (!resolved) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  // workspace 전체(이미지 등 포함, 상품당 1MB+)를 끌어오지 않고 brand/sourceUrl
  // 값만 PostgREST JSON path select로 가볍게 조회한다.
  const { data: snapshots, error: snapErr } = await supabase
    .from("product_snapshots")
    .select("id, brand:workspace->canonicalProduct->brand->>value, sourceUrl:workspace->canonicalProduct->>sourceUrl");
  if (snapErr || !snapshots) return null;

  const matching = (snapshots as SnapshotBrandRow[]).filter(
    (s) => s.brand && resolveBrand(s.brand)?.normalizedBrandKey === resolved.normalizedBrandKey,
  );
  if (matching.length === 0) return null;

  const snapshotIdsByProduct = new Map<string, string[]>();
  for (const s of matching) {
    const key = productIdentityKey(s.sourceUrl, s.id);
    const list = snapshotIdsByProduct.get(key) ?? [];
    list.push(s.id);
    snapshotIdsByProduct.set(key, list);
  }

  const { data: observations, error: obsErr } = await supabase
    .from("price_observations")
    .select("snapshot_id, price_krw, sale_price_krw, sold_out, checked_at")
    .in(
      "snapshot_id",
      matching.map((s) => s.id),
    )
    .eq("source", "SELLER_ORIGIN")
    .order("checked_at", { ascending: false });
  if (obsErr || !observations) return null;

  // 상품(snapshot)당 최신 관측 1건만 — 이미 checked_at desc로 정렬돼 있으니
  // 먼저 만난 것이 최신이다.
  const latestPerSnapshot = new Map<string, PriceObservationRow>();
  for (const row of observations as PriceObservationRow[]) {
    if (!latestPerSnapshot.has(row.snapshot_id)) latestPerSnapshot.set(row.snapshot_id, row);
  }

  // 실제 상품(sourceUrl) 단위로 묶어, 같은 상품의 중복 snapshot 중 가장 최근
  // 관측 1건만 표본에 반영한다.
  const pricesKrw: number[] = [];
  for (const snapshotIds of snapshotIdsByProduct.values()) {
    let best: PriceObservationRow | null = null;
    for (const sid of snapshotIds) {
      const obs = latestPerSnapshot.get(sid);
      if (!obs) continue;
      if (!best || obs.checked_at > best.checked_at) best = obs;
    }
    if (!best) continue;
    // 품절 상품은 브랜드 시장 가격 분포에서 제외한다(P-12B와 같은 원칙 —
    // 지금 실제로 살 수 없는 가격을 시장가로 취급하지 않는다).
    if (best.sold_out === true) continue;
    const priceKrw = best.sale_price_krw ?? best.price_krw;
    if (priceKrw != null) pricesKrw.push(priceKrw);
  }

  return computeBrandMarketProfile(pricesKrw);
}
