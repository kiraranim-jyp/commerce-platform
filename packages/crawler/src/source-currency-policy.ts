/**
 * OVERSEAS-CURRENCY-POLICY-1(CPO 지시, 2026-09-10).
 *
 * 정책: **해외 원본가격은 원본 사이트 국가 기준 통화로 확보한다.** 그 통화를
 * TTAEJYO 환율로 환산해서 착지원가를 계산하지, 사이트가 접속 지역을 보고 보여주는
 * 원화 표시가를 원본가격으로 쓰지 않는다(그 값에는 사이트 자체 환율 스프레드가 이미
 * 들어 있다).
 *
 * 이 파일은 **국가에서 통화를 추론하지 않는다.** "영국이니까 GBP"처럼 기본값을
 * 짐작하는 방식은 CPO가 명시적으로 금지했다 — 확인되지 않은 추론이 금액 데이터에
 * 들어가면 되돌리기 어렵다. 실제 요청으로 확인된 source만 아래에 등록한다.
 *
 * Shopify 매장은 여기 등록하지 않는다. `/meta.json`의 매장 기준통화를 쓰는 경로가
 * 이미 있고(shopify-product-json.ts, SHOP_META_AUTHORITY), 그게 더 강한 근거다 —
 * 매장 관리자가 설정한 고정값이라 지역과 무관하다. 실측으로 junioredition=GBP,
 * kidsatelier=USD, nickis=EUR가 확인됐다.
 */
export type CurrencyAcquisitionMethod = "URL_QUERY_OVERRIDE";

interface SourceCurrencyRule {
  /** 호스트 접미사 매칭 — www 유무와 하위 도메인을 함께 받는다. */
  hostSuffix: string;
  /** 이 source의 원본 국가 통화. 실제 요청으로 확인된 값만 적는다. */
  currency: string;
  method: CurrencyAcquisitionMethod;
  /** URL_QUERY_OVERRIDE일 때 붙일 쿼리 파라미터 이름. */
  queryParam: string;
  /**
   * SMALLABLE-PRICE-1(CPO 지시, 2026-09-12) — 통화만으로는 금액이 하나로 정해지지
   * 않는 source를 위한 배송국가 고정값. **선택 필드다**: 여기 값이 없는 source는
   * 지금까지와 완전히 같이 동작한다(국가 파라미터를 붙이지 않는다).
   *
   * 국가를 통화에서 추론하지 않고, 통화를 국가에서 추론하지도 않는다. 두 값 모두
   * 판매자가 공개한 판매조건 + 실측으로 확인해서 개별 등록한다.
   */
  country?: { queryParam: string; value: string };
}

/**
 * 실측 근거(2026-09-10, 조사 OVERSEAS-CURRENCY-POLICY-1):
 *  - smallable.com은 파라미터가 없으면 접속 지역 통화를 준다(서울에서 KRW 98,784).
 *    `?currency=EUR`을 붙이면 EUR 63을 준다. EUR/USD/GBP/JPY 전부 동작하고, 인식할 수
 *    없는 값(XXX)을 주면 조용히 기본값으로 돌아간다 — 그래서 응답 통화를 반드시
 *    다시 확인해야 한다(아래 expectedCurrencyFor를 호출부가 검증에 쓴다).
 *
 * SMALLABLE-PRICE-1(CPO 지시, 2026-09-12) — `?currency=EUR`만으로는 부족했다.
 * smallable은 **배송국가별로 다른 EUR 금액**을 준다. 같은 상품, 같은 EUR인데:
 *
 *     country=   430651   430705
 *     KR           73       63
 *     FR           75       65     ← 원본 상품가격
 *     US           79       68
 *     JP           81       70
 *
 * 파라미터를 안 붙이면 접속 지역이 국가를 정한다. Production 크롤러의 egress는 JP로
 * 지오로케이션돼 있어서 여태 JP 가격(81/70)이 원본가격으로 들어가고 있었다 — 어느
 * 나라 값인지 아무도 고르지 않았는데 인프라 위치가 대신 골라준 셈이다.
 *
 * FR로 고정하는 이유는 smallable이 스스로 공시한 판매조건이다: 표시가는 프랑스
 * 부가세가 포함된 EUR이고, EU 밖으로 배송하면 프랑스 부가세를 빼고 도착국가의
 * 세금·관세를 따로 물린다. 배송비도 도착지별로 따로 계산한다. 즉 **프랑스 가격이
 * 세금·관세·배송이 아직 섞이지 않은 원본 상품가격**이고, 나머지 국가 값은 그 위에
 * 도착지 비용이 얹힌 결과다. KR 73은 "한국까지 배송된 값"이라 원본가격으로 쓰면
 * 국제배송비·수입비용 정책과 경계가 뭉개진다.
 *
 * 실측(2026-09-12, 실제 추출 경로 universalExtract로 확인):
 *   430651 sku=AAA1804641 → EUR 75.00
 *   430705 sku=AAA1804944 → EUR 65.00  ← 63이 아니다. 짐작하지 않고 재봤다.
 *
 * KR/JP/US 값은 여전히 **시장 관측치**다(Source + Market 모델). 여기서 FR을 고정하는
 * 것은 sourcePrice 하나를 정하는 것이지, 다른 국가를 관측하는 능력을 없애는 게
 * 아니다 — `?country=XX`는 그대로 동작한다.
 */
const SOURCE_CURRENCY_RULES: SourceCurrencyRule[] = [
  {
    hostSuffix: "smallable.com",
    currency: "EUR",
    method: "URL_QUERY_OVERRIDE",
    queryParam: "currency",
    // `?deliveryCountry=`는 무시되고 `X-Forwarded-For` 위조도 먹지 않는다. 실측으로
    // 금액을 움직이는 파라미터는 `?country=` 하나뿐이었다.
    country: { queryParam: "country", value: "FR" },
  },
];

function ruleFor(url: string): SourceCurrencyRule | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return SOURCE_CURRENCY_RULES.find((r) => host === r.hostSuffix || host.endsWith(`.${r.hostSuffix}`)) ?? null;
}

/** 등록된 source면 원본 통화를 돌려준다. 등록되지 않았으면 null — 추론하지 않는다. */
export function expectedCurrencyFor(url: string): string | null {
  return ruleFor(url)?.currency ?? null;
}

/**
 * 등록된 source면 원본 통화를 요청하는 URL로 바꿔 돌려준다. 등록되지 않았으면 원본
 * URL 그대로다 — 모든 사이트에 `?currency=`를 붙이지 않는다(CPO 지시).
 *
 * 이미 같은 파라미터가 URL에 있으면 덮어쓴다. 사용자가 붙여넣은 URL에 다른 통화가
 * 들어 있어도 정책이 이긴다.
 *
 * SMALLABLE-PRICE-1 — country가 등록된 source는 배송국가도 같이 고정한다. 통화만
 * 맞춰도 배송국가가 다르면 금액이 달라지기 때문이다(smallable EUR 73/75/79/81).
 * country가 없는 source는 이 줄을 타지 않으므로 동작이 그대로다.
 */
export function withSourceCurrency(url: string): string {
  const rule = ruleFor(url);
  if (!rule) return url;
  try {
    const u = new URL(url);
    u.searchParams.set(rule.queryParam, rule.currency);
    if (rule.country) u.searchParams.set(rule.country.queryParam, rule.country.value);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — **다른 배송국가를 요청하는 URL.**
 *
 * 위 withSourceCurrency()는 한 글자도 바뀌지 않았다. 원본가격이 FR이라는 결정은
 * SMALLABLE-PRICE-1에서 이미 끝났고 여기서 다시 열지 않는다. 이 함수는 전혀 다른
 * 질문에 답한다: **이 판매처는 다른 배송국가에는 얼마를 받는가**(= 시장 관측).
 * 두 질문을 한 함수로 합치면 언젠가 probe 후보 하나가 조용히 원본가격을 바꾼다 —
 * 함수를 나눠 둔 것이 그 사고를 막는 장치다.
 *
 * 국가 규칙이 등록되지 않은 source는 null이다. 아무 사이트에나 `?country=`를 붙여
 * "시장을 관측했다"고 말하지 않는다 — 그 파라미터를 무시하는 사이트에서는 똑같은
 * 가격이 국가만 다른 시장 여러 개로 저장되고, 그건 관측이 아니라 복제다.
 */
export function withSourceMarketCountry(url: string, countryCode: string): string | null {
  const rule = ruleFor(url);
  if (!rule?.country) return null;
  const country = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return null;
  try {
    const u = new URL(url);
    u.searchParams.set(rule.queryParam, rule.currency);
    u.searchParams.set(rule.country.queryParam, country);
    return u.toString();
  } catch {
    return null;
  }
}

/** 이 source가 배송국가별 시장 관측을 지원하는가(= country 규칙이 실측으로 등록돼
 * 있는가). 등록은 여전히 한 줄씩 수동이다 — "글로벌 사이트는 다 되겠지"로 넓히지
 * 않는다. */
export function supportsMarketCountryProbe(url: string): boolean {
  return ruleFor(url)?.country != null;
}
