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
}

/**
 * 실측 근거(2026-09-10, 조사 OVERSEAS-CURRENCY-POLICY-1):
 *  - smallable.com은 파라미터가 없으면 접속 지역 통화를 준다(서울에서 KRW 98,784).
 *    `?currency=EUR`을 붙이면 EUR 63을 준다. EUR/USD/GBP/JPY 전부 동작하고, 인식할 수
 *    없는 값(XXX)을 주면 조용히 기본값으로 돌아간다 — 그래서 응답 통화를 반드시
 *    다시 확인해야 한다(아래 expectedCurrencyFor를 호출부가 검증에 쓴다).
 */
const SOURCE_CURRENCY_RULES: SourceCurrencyRule[] = [
  { hostSuffix: "smallable.com", currency: "EUR", method: "URL_QUERY_OVERRIDE", queryParam: "currency" },
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
 */
export function withSourceCurrency(url: string): string {
  const rule = ruleFor(url);
  if (!rule) return url;
  try {
    const u = new URL(url);
    u.searchParams.set(rule.queryParam, rule.currency);
    return u.toString();
  } catch {
    return url;
  }
}
