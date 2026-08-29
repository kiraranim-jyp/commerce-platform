export interface ComparisonCandidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  /** N-4.18-Q2 P0-4(대표님 지시, 2026-08-26: "정상가와 현재가를 뭉개지 않는다") —
   * 검색 목록에서 할인판매가(price)와 별도로 정가가 확인될 때만 채운다(실제
   * 할인이 있을 때만, 즉 정가 > 판매가일 때만). 사이트가 정가/할인가를 구분해서
   * 주지 않으면(또는 할인이 없으면) null — 지어내지 않는다. */
  regularPrice?: { amount: number; currency: string } | null;
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
  /** Sprint B-1.8 — "detail"은 상품 상세 API로 실제 가격을 확인한 것(신뢰 가능), "search"는
   * 검색 결과에 딸려온 값을 그대로 쓴 것(참고용). 매칭(동일상품 여부)과 가격확인은 별개
   * 단계이므로, 이 필드로 "이 가격을 얼마나 믿어도 되는지"를 구분한다. */
  priceSource?: "detail" | "search" | null;
  /** P-4-DATA-4(CPO 지시, 2026-08-29: "미검증 가격 숫자는 어떤 경우에도 셀러 화면에
   * 노출하지 않는다") — priceSource만으로는 "검증 대상이 아니었음"과 "검증을 시도했으나
   * 실패함"이 구분되지 않는다(둘 다 priceSource="search"로 남았다 — Hug Hairy Monster
   * 실측 사례: matchLevel=very_high인데 fetch 실패로 조용히 search 값이 남아있었음).
   * priceStatus가 UI가 실제로 숫자를 보여줘도 되는지를 결정하는 단일 진실 — VERIFIED_CURRENT만
   * price를 노출한다. UNVERIFIED_SEARCH/PRICE_UNAVAILABLE은 price 필드가 있어도 절대
   * 숫자를 보여주지 않는다(내부 참고용으로만 유지). */
  /** 원본 파서(shopify-suggest.ts 등 8개)는 이 필드를 채우지 않는다 — match.ts의
   * withConfidence()가 모든 후보 생성 경로가 공통으로 거치는 단일 지점이라, 거기서
   * priceSource 기준으로 기본값을 강제한 뒤에만 API 응답까지 나간다(파서 8개를
   * 개별 수정하지 않기 위한 의도적 설계 — derivePriceStatus 참고). 즉 optional
   * 타입이지만 실제로 API 밖으로 나가는 값은 항상 채워져 있다. */
  priceStatus?: "VERIFIED_CURRENT" | "UNVERIFIED_SEARCH" | "PRICE_UNAVAILABLE";
  /** true=상세 검증을 실제로 시도함(성공/실패 무관), false=애초에 검증 대상이 아니었음
   * (medium/low 등급이라 selectCandidatesForDetailConfirmation에서 제외됐거나 사이트당
   * 상한 초과). UI가 "가격 확인 필요"(시도 안 함) vs "가격 확인 실패"(시도했지만 실패)를
   * 다른 문구로 보여주기 위한 구분 — 둘 다 숫자는 안 보여주지만 셀러에게 주는 설명은 다르다. */
  verificationAttempted?: boolean;
  /** N-4.18-Q3 PART E-2 — 매칭 신뢰도(confidence/matchLevel)와 완전히 분리된 축.
   * true=품절이라고 실측 확인됨, false=판매중이라고 실측 확인됨, null/undefined=그
   * 사이트에서 재고 상태를 확인할 방법이 없거나 실측 근거가 없음(추측 금지 — null이
   * 기본값이며 "판매중"으로 임의 해석하지 않는다). */
  soldOut?: boolean | null;
}

export interface ComparisonSearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  status: "ok" | "unsupported" | "error";
  candidates: ComparisonCandidate[];
  error?: string;
  /** P-4-DATA-4(CPO 지시) — status="error"만으로는 "검색 서비스가 일시적으로 막힘
   * (429)"과 "그 외 오류"가 구분되지 않는다. 429는 "찾지 못했습니다"와 전혀 다른
   * 셀러 문구("요청이 많아 검색하지 못했습니다")를 써야 한다 — 실측 확인(2026-08-29):
   * 세션당 누적 호출량이 쌓이면 여러 Shopify 도메인이 동시에 429를 반환했고, 이게
   * 셀러 화면에는 "찾지 못했습니다"와 구분 없이 보였다. status가 "error"일 때만
   * 의미 있고, 그 외에는 undefined. */
  errorKind?: "RATE_LIMITED" | "TEMPORARY_ERROR";
  /** N-4.18-P-4 STEP P-4-2 — 원문 검색(searchTerm/title)이 0건이라 브랜드 한글
   * alias(brand-alias.ts)로 재검색해서 얻은 결과일 때만 채워진다. 없으면(undefined)
   * 원문 검색 결과라는 뜻 — 하위호환(기존 호출부는 이 필드를 몰라도 됨). */
  querySource?: "brand_alias";
}

export interface ComparisonQuery {
  title: string;
  brand?: string;
  /** 원본 상품 URL — URL slug 비교 신호에 사용(있으면). */
  sourceUrl?: string;
  /** 원본 상품에서 확인된 SKU/article code(있으면). */
  sku?: string;
  /** N-4.18-C STEP3(대표님 지시: "검색 횟수보다 매칭 정확도를 우선한다") — 실제
   * 검색 API/키워드 파라미터에 보낼 최소화된 검색어(packages/shared의
   * buildDomesticShopQuery, SKU 단독 > 브랜드+모델명 > 브랜드+핵심 상품명
   * 순). 없으면 title을 그대로 검색어로 쓴다(하위호환 — B-1 해외 가격비교
   * 등 아직 이 필드를 안 채우는 호출부는 기존 동작 그대로 유지). title
   * 자체는 매칭 스코어링(scoreCandidateMatch)에 계속 그대로 쓰인다 —
   * 검색어를 좁히는 것과 동일상품 판정 신호를 넓게 쓰는 것은 별개다. */
  searchTerm?: string;
}

/** comparison_shops 테이블 행의 최소 부분집합 — packages/crawler는 apps/admin에 의존하지 않으므로
 * 호출 측(admin API 라우트)에서 이 형태로 넘겨준다. */
export interface ComparisonShopRef {
  id: string;
  name: string;
  domain: string;
  currency: string | null;
}

/** N-4.07 — domestic_price_sources 테이블 행의 최소 부분집합. collectionStrategy가
 * AUTO_API/AUTO_SCRAPE인 것만 실제로 검색을 시도한다(MANUAL/NOT_AVAILABLE은 아직
 * 실제 파서가 없다는 뜻이라 "unsupported"로 응답한다 — 추정 파서를 만들지 않는다). */
export interface DomesticSourceRef {
  id: string;
  name: string;
  domain: string;
  currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
}
