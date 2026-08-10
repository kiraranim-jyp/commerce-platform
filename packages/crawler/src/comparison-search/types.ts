export interface ComparisonCandidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  /** 사이트에서 브랜드가 별도 필드로 확인되는 경우(Shopify vendor, Childrensalon
   * designer 등) — 없으면 title에서 부분일치로만 판단한다. */
  brand?: string;
  /** 사이트에 명시적으로 존재하는 SKU/article code. 없는 사이트는 채우지 않는다(추측 금지). */
  sku?: string;
  /** Sprint B-1.2 — 동일상품 판별 신뢰도 등급. UI 표시용. */
  matchLevel?: "very_high" | "high" | "medium" | "low";
  /** 어떤 신호로 이 confidence가 나왔는지(디버그/설명용). */
  matchReasons?: string[];
}

export interface ComparisonSearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  status: "ok" | "unsupported" | "error";
  candidates: ComparisonCandidate[];
  error?: string;
}

export interface ComparisonQuery {
  title: string;
  brand?: string;
  /** 원본 상품 URL — URL slug 비교 신호에 사용(있으면). */
  sourceUrl?: string;
  /** 원본 상품에서 확인된 SKU/article code(있으면). */
  sku?: string;
}

/** comparison_shops 테이블 행의 최소 부분집합 — packages/crawler는 apps/admin에 의존하지 않으므로
 * 호출 측(admin API 라우트)에서 이 형태로 넘겨준다. */
export interface ComparisonShopRef {
  id: string;
  name: string;
  domain: string;
  currency: string | null;
}
