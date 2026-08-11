/**
 * Sprint N-3.2 — Global Price Intelligence 데이터 모델.
 *
 * CPO 원칙: "원본 데이터 → 환율 변환 → 표시가격" 순서를 지키고, AI/계산값과
 * 원본 데이터를 절대 혼합하지 않는다. `£35 → ₩66,500`처럼 계산 결과 하나만
 * 저장하는 걸 금지 — 원본(PriceObservation)과 계산값(ConvertedPriceKrw)을
 * 항상 별도 객체로 유지한다.
 *
 * Sprint N-3.7 — 원본가격의 기준을 "브랜드 본국"에서 "판매처(편집샵) 원본
 * 시장"으로 전면 수정했다(CPO 지시). 실측(2026-08-11): Junior Edition에서
 * 파는 Konges Sløjd 상품을 판매처 기준으로 보면 — Junior Edition 자체의
 * `/meta.json`이 실제 등록 국가를 돌려준다(country 필드, 지금까지는 fetch만
 * 하고 버리고 있었다). 브랜드 본국(예: 덴마크) 공식 사이트를 별도로 검색하는
 * 건 실제로 상품을 판매하는 곳과 무관한 가격을 원본으로 오인시킬 위험이 있고,
 * 비용도 더 든다 — 이미 크롤링하는 판매처 사이트 자신의 메타데이터가 더 싸고
 * 더 정확한 소스다. 이전 스프린트(N-3.6)의 `brandOriginPrice`/
 * `convertedBrandOriginToKrw`/`brandCountry` 기반 market-매칭 로직은 전부
 * 제거했다 — 브랜드 국가는 원산지 등록 등 다른 용도로는 여전히 유효하지만
 * 가격 기준 결정에는 쓰지 않는다.
 *
 * URL locale(`/en-au/`, `/en-kr/` 등)도 원본가격의 기준이 아니다 — 그건
 * "이 판매처가 그 시장에도 서비스한다"는 사실일 뿐이다(additionalMarkets로
 * 분류). 원본가격은 오직 판매처 자신의 실제 등록 국가(`seller.country`,
 * `/meta.json` 실측)에서 결정된다.
 */

/** 실제로 사이트에서 관측한(fetch 성공) 가격 하나. amount/currency는 그 사이트가
 * 그 market에서 실제로 돌려준 값 그대로다 — 계산이나 변환을 거치지 않는다. */
export interface PriceObservation {
  amount: number;
  currency: string;
  /** 이 market이 속한다고 판단한 국가(ISO 3166-1 alpha-2). 로케일 프리픽스(예:
   * "en-kr"→"KR")처럼 URL 구조 자체가 알려주는 경우, 판매처의 실제 등록 국가
   * (seller.country, marketCode=""일 때), 또는 통화가 사실상 한 국가로만
   * 쓰이는 경우(GBP→GB, KRW→KR 등)만 채운다 — EUR/USD처럼 여러 나라가 같이
   * 쓰는 통화는 국가를 추측하지 않고 null로 둔다. */
  country: string | null;
  /** 이 가격을 가져올 때 실제로 사용한 URL 경로 세그먼트("" = 프리픽스 없는
   * 기본 요청, "en-kr" 등). */
  marketCode: string;
  /** N-3.2 실측(2026-08-10) — marketCode=""(로케일 프리픽스 없는 기본 요청)는
   * Shopify Markets의 geo 기반 presentment 때문에 요청이 나가는 서버 위치에
   * 따라 amount가 달라질 수 있다는 걸 직접 확인했다(같은 상품을 로컬(한국
   * IP)에서 조회하면 GBP 35, Vercel(미국 리전) 서버에서 조회하면 같은 GBP
   * 라벨로 74가 나옴 — 통화 라벨은 고정되지만 금액은 아니다). 이런 불안정성이
   * 있는 관측값에는 이유를 설명하는 caveat을 채운다 — "확인됐다"고 조용히
   * 넘기지 않는다(CPO 원칙: 불확실하면 명시). */
  caveat?: string;
  sourceUrl: string;
  sourceType: "SHOPIFY_JSON";
  capturedAt: string;
  /** 실제로 사이트에서 가져온 값이라 항상 HIGH — CALCULATED(환율 계산)와
   * 명확히 구분한다. */
  confidence: "HIGH";
}

/** PriceObservation을 환율로 변환한 참고값. 실제 판매가격이 아니다 — UI에서
 * "환산 참고값"으로만 표시하고 절대 실제 가격처럼 보이면 안 된다(CPO 지시). */
export interface ConvertedPriceKrw {
  amount: number;
  currency: "KRW";
  exchangeRate: number;
  rateSource: "frankfurter" | "fallback";
  calculatedAt: string;
  confidence: "CALCULATED";
}

/** N-3.7 — 판매처(편집샵) 식별 정보. 국가를 임의로 추정하지 않는다 — 실제
 * 소스(지금은 Shopify `/meta.json`)에서 확인된 값만 채우고, 확인 못하면
 * country/countryCode를 null로 둔다("UNKNOWN"으로 정직하게 취급). */
export interface SellerInfo {
  /** 판매처 표시명(예: "Junior Edition") — `/meta.json`의 `name` 필드. 없으면 null. */
  name: string | null;
  /** 판매처의 실제 등록 국가(ISO 3166-1 alpha-2, 예: "GB"). 확인 못하면 null. */
  country: string | null;
  source: "SHOPIFY_META_JSON" | null;
}

export interface PriceIntelligenceResult {
  status: "OK" | "NOT_SUPPORTED" | "FETCH_FAILED";
  message?: string;
  /** N-3.7 — 판매처 식별 정보. seller.country가 null이면 sellerOriginPrice도
   * null이어야 한다(Part 11 원칙 — 국가를 확인 못하면 원본가격을 만들어내지
   * 않는다). */
  seller: SellerInfo;
  /** N-3.7 — 판매처 원본 시장 가격(marketCode="" 기본 요청). 이게 이제 "원본
   * 가격"의 유일한 기준이다 — 브랜드 국가도, URL locale도 아니다. null이면
   * 판매처 자체를 확인 못했거나(Shopify가 아님 등) 국가를 확인 못한 것. */
  sellerOriginPrice: PriceObservation | null;
  /** sellerOriginPrice를 KRW로 환산한 참고값. sellerOriginPrice가 없으면 null. */
  convertedSellerOriginToKrw: ConvertedPriceKrw | null;
  /** 한국(KR) market 가격 — additionalMarkets와 별개로 기본 조회에 항상 포함
   * (비용 최적화, N-3.2 Part H). 없으면 null(=MISSING, 존재하지 않는 걸
   * 만들어내지 않는다). */
  krMarket: PriceObservation | null;
  /** "국가별 가격 보기"를 눌렀을 때만 채워진다(비용 최적화 — 기본 요청에서는
   * 조회하지 않는다). sellerOriginPrice/krMarket과 겹치지 않는, 추가로 실제
   * 확인된 market만 담는다 — 이 market들의 marketCode(locale)는 "이 판매처가
   * 그 시장에도 서비스한다"는 사실일 뿐 원본가격 판정에 쓰이지 않는다. */
  additionalMarkets: PriceObservation[];
  /** 이번 요청에서 실제로 probe한 marketCode 목록(성공/실패 무관) — 투명성용. */
  testedMarketCodes: string[];
}
