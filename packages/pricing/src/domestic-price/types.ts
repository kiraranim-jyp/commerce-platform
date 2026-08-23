/**
 * N-4.01 Part G/H(대표님 지시) — "국내 가격비교"를 특정 사이트 하나에
 * 종속시키지 않는다. `DomesticPriceSource` 인터페이스를 구현하는 어댑터를
 * 여러 개 붙일 수 있게 하되, 지금 실제로 연결하는 건 네이버 쇼핑 검색
 * (공식 오픈API, `openapi.naver.com/v1/search/shop.json`)뿐이다 — 다나와/
 * 에누리는 공식 공개 API가 확인되지 않아(대표님 지시: "실제 API/접근 가능
 * 여부를 조사하고 추정 구현하지 않는다") 이번에는 어댑터를 만들지 않는다.
 */
export interface DomesticPriceListing {
  mallName: string | null;
  priceKrw: number;
  productUrl: string | null;
  /** N-4.03 Part 4(대표님 지시) — 경쟁상품 매칭 신뢰도(match-confidence.ts)를
   * 계산하려면 리스팅 제목이 필요하다. 최저가만 보고 "우리 상품 경쟁가격"으로
   * 쓰면 다른 상품의 가격을 잘못 가져올 위험이 있다 — 그 오분류를 막는
   * 최소한의 신호다. */
  title: string | null;
}

export type DomesticPriceSearchStatus = "OK" | "NOT_CONFIGURED" | "NO_RESULTS" | "ERROR";

export interface DomesticPriceSearchResult {
  status: DomesticPriceSearchStatus;
  source: string;
  listings: DomesticPriceListing[];
  message?: string;
}

/** 이 인터페이스 하나만 구현하면 검색/저장/집계 코드는 그대로 재사용된다
 * (PriceSource 공통 아키텍처, PART H). */
export interface DomesticPriceSource {
  readonly id: string;
  readonly label: string;
  search(query: string): Promise<DomesticPriceSearchResult>;
}
