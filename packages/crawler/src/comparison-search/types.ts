export interface ComparisonCandidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
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
}

/** comparison_shops 테이블 행의 최소 부분집합 — packages/crawler는 apps/admin에 의존하지 않으므로
 * 호출 측(admin API 라우트)에서 이 형태로 넘겨준다. */
export interface ComparisonShopRef {
  id: string;
  name: string;
  domain: string;
  currency: string | null;
}
