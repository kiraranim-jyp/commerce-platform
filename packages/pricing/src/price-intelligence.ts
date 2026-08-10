/**
 * Sprint N-3.2 — Global Price Intelligence 데이터 모델.
 *
 * CPO 원칙: "원본 데이터 → 환율 변환 → 표시가격" 순서를 지키고, AI/계산값과
 * 원본 데이터를 절대 혼합하지 않는다. `£35 → ₩66,500`처럼 계산 결과 하나만
 * 저장하는 걸 금지 — 원본(PriceObservation)과 계산값(ConvertedPriceKrw)을
 * 항상 별도 객체로 유지한다.
 *
 * 브랜드 국가(brandCountry)와 가격이 실제로 관측된 시장(market)은 서로 다른
 * 개념이다 — "브랜드가 스페인이라고 실제 Shopify 기본 시장이 스페인 EUR라는
 * 보장은 없다"(CPO 지시). `originMarketIsBrandCountryMarket`은 실제로 그
 * 국가의 시장에서 가격을 가져왔을 때만 true다 — 브랜드 국가로부터 추론하지
 * 않는다.
 */

/** 실제로 사이트에서 관측한(fetch 성공) 가격 하나. amount/currency는 그 사이트가
 * 그 market에서 실제로 돌려준 값 그대로다 — 계산이나 변환을 거치지 않는다. */
export interface PriceObservation {
  amount: number;
  currency: string;
  /** 이 market이 속한다고 판단한 국가(ISO 3166-1 alpha-2). 로케일 프리픽스(예:
   * "en-kr"→"KR")처럼 URL 구조 자체가 알려주는 경우, 또는 통화가 사실상 한
   * 국가로만 쓰이는 경우(GBP→GB, KRW→KR 등)만 채운다 — EUR/USD처럼 여러 나라가
   * 같이 쓰는 통화는 국가를 추측하지 않고 null로 둔다. */
  country: string | null;
  /** 이 가격을 가져올 때 실제로 사용한 URL 경로 세그먼트("" = 프리픽스 없는
   * 기본 요청, "en-kr" 등). */
  marketCode: string;
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

export interface PriceIntelligenceResult {
  status: "OK" | "NOT_SUPPORTED" | "FETCH_FAILED";
  message?: string;
  /** 브랜드 프로필(BrandProfile.countryOfOrigin)에서 가져온 참고 정보 — 가격
   * market 선택에 이 값을 강제로 쓰지 않는다(CPO 지시: 브랜드 국가 ≠ 가격 시장). */
  brandCountry: string | null;
  /** Priority 1(브랜드 본국 시장, 실제 확인된 경우만) 또는 Priority 2(사이트
   * 기본/원본 시장). null이면 원본 가격 자체를 못 가져온 것. */
  originMarket: PriceObservation | null;
  /** true면 originMarket이 실제로 brandCountry와 일치하는 시장에서 관측됨
   * (Priority 1). false면 사이트 기본 시장을 쓴 것(Priority 2) — 추측이 아니라
   * 실제로 확인된 사실만 담는다. */
  originMarketIsBrandCountryMarket: boolean;
  /** Priority 3 — 한국(KR) market 가격. 없으면 null(=MISSING, 존재하지 않는
   * 걸 만들어내지 않는다). */
  krMarket: PriceObservation | null;
  /** "국가별 가격 보기"를 눌렀을 때만 채워진다(비용 최적화 — 기본 요청에서는
   * 조회하지 않는다). originMarket/krMarket과 겹치지 않는, 추가로 실제 확인된
   * market만 담는다. */
  additionalMarkets: PriceObservation[];
  /** 이번 요청에서 실제로 probe한 marketCode 목록(성공/실패 무관) — 투명성용. */
  testedMarketCodes: string[];
  /** originMarket을 KRW로 환산한 참고값. originMarket이 없으면 null. */
  convertedOriginToKrw: ConvertedPriceKrw | null;
}
