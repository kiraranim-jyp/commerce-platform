import type { MarketProbeResult } from "./market-probe-result";
import {
  extractShopifyHandle,
  fetchShopifyProductJson,
  fetchShopifyShopMeta,
  shipsToCountry,
  type ShopifyShopMeta,
} from "./shopify-product-json";

/**
 * Sprint N-3.2 — 한 상품 URL에 대해 여러 Shopify Markets locale(예: "en-kr")을
 * probe해서 실제로 존재하는 market의 가격만 모은다. 새 fetch 로직을 만들지
 * 않고 이미 검증된 fetchShopifyProductJson(로케일 프리픽스가 있으면
 * price_currency를 그대로 신뢰, 없으면 shopCurrency로 override하는 로직 포함)을
 * 그대로 재사용한다 — 이 파일은 "어떤 marketCode를 어떤 순서로 시도할지"만
 * 관장한다.
 *
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — 이 파일은 **Shopify 전용**이다.
 * 비-Shopify 사이트를 여기서 일반화하지 않는다: 이 경로의 가격 정확도는
 * `/meta.json` 권위·로케일 프리픽스·`?country=` 같은 Shopify 고유 사실 위에
 * 서 있어서, 다른 사이트를 끼워 넣는 순간 그 근거가 전부 조건문이 된다.
 * 어느 probe를 쓸지 고르는 일은 market-probe.ts가 한다.
 */

/** Shopify probe의 결과. 모양은 시장 관측 공통 타입 그대로다(파일 두 개가 서로
 * 다른 모양을 주면 저장부가 갈라진다) — 이름만 기존 호출부를 위해 남긴다. */
export type ShopifyMarketProbeResult = MarketProbeResult;

async function probeMarket(origin: string, handle: string, marketCode: string): Promise<ShopifyMarketProbeResult | null> {
  const prefix = marketCode ? `/${marketCode}` : "";
  const url = `${origin}${prefix}/products/${handle}`;
  const result = await fetchShopifyProductJson(url);
  const price = result?.productData.price;
  if (!price || !price.currency) return null;
  return {
    marketCode,
    amount: price.amount,
    currency: price.currency,
    sourceUrl: `${url}.json`,
    shopMeta: result?.shopMeta ?? null,
    regularPrice: result?.productData.regularPrice ?? null,
    available: result?.productData.available,
  };
}

/** 기본 조회 — 원본(사이트 기본, 프리픽스 없음) + 한국(en-kr) 두 곳만.
 * PART H(비용 최적화) — "기본 요청에서는 국가별 가격 전체 조회를 하지 않는다."
 * handle을 못 뽑으면(Shopify가 아니거나 URL 형식이 다름) null. */
export async function probeOriginAndKrMarkets(
  sourceUrl: string,
): Promise<{ origin: ShopifyMarketProbeResult | null; kr: ShopifyMarketProbeResult | null } | null> {
  const handle = extractShopifyHandle(sourceUrl);
  if (!handle) return null;
  const origin = new URL(sourceUrl).origin;
  const [originResult, krResult] = await Promise.all([
    probeMarket(origin, handle, ""),
    probeMarket(origin, handle, "en-kr"),
  ]);
  return { origin: originResult, kr: krResult };
}

/** 확장 조회 — 흔히 쓰이는 Shopify Markets locale 코드 후보를 실제로 찔러보고
 * 성공한 것만 반환한다. 이 목록은 "존재를 단정"하는 게 아니라 "확인해볼
 * 후보"일 뿐이다 — 404/오류가 나면 그 market은 존재하지 않는 것으로 취급하고
 * 결과에서 완전히 제외한다(추측으로 채우지 않는다).
 *
 * N-3.2 실측(2026-08-10) — "xx"(언어만, 지역 없음) 형태 후보("fr","de","es",
 * "ja")는 junioredition.com에서 200을 반환하지만 실제로는 별도 market이
 * 아니라 그냥 기본(원본) 가격을 그대로 되돌려줬다(4개 코드 전부 정확히
 * 같은 GBP 74 — 우연이라기엔 너무 정확히 일치). 이걸 "실제 market"으로
 * 보여주면 실제로는 없는 프랑스/독일/스페인/일본 시장이 있는 것처럼
 * 오해를 준다(CPO 금지 원칙 위반) — 그래서 확인된 진짜 Shopify Markets
 * 프리픽스 형태("xx-yy", 예: "en-kr"/"en-au")만 후보로 남긴다.
 *
 * GLOBAL-MARKET ③ 실측(Bobo Choses B226AC043, 2026-09-11) — "en-int"(국제
 * 배송용 시장)를 후보에 추가한다. 위 "xx"(언어만) 케이스와 달리 실제로 기본
 * 가격과 다른 값을 냈다: 루트/en-de는 €75.00인데 /en-int는 €84.00이었다 —
 * 기본 가격을 되돌려주는 가짜 market이 아니라는 실증이다. 단, "int"는 국가가
 * 아니므로 이 코드는 끝까지 어떤 국가로도 변환하지 않는다(집계/화면 쪽
 * marketRegionOf 정규식이 2글자 지역만 인정해 자연히 null이 된다). */
export const EXPAND_CANDIDATE_MARKET_CODES = [
  "en-us",
  "en-gb",
  "en-fr",
  "en-de",
  "en-jp",
  "en-au",
  "en-ca",
  "en-int",
];

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL(CEO 확정, 2026-09-13) — **그 시장이 실재하는지
 * 확인할 수 있을 때만 관측한다.**
 *
 * ── 무엇이 문제였나 ─────────────────────────────────────────────────────
 * 실측(2026-09-13): Bobo Choses는 일본에 배송하지 않는다(`/meta.json`의
 * `ships_to_countries`에 JP가 없다). 그런데 일본을 요청하면 404가 아니라
 * **본국(스페인) 가격을 그대로** 돌려준다 — `?country=JP`와 `?country=XX`(존재
 * 하지 않는 국가)의 응답이 구별되지 않는다. 그 응답을 저장하면 €75가 "일본
 * 시장에서 관측된 가격"이 되고, 화면은 존재하지 않는 시장 하나를 진짜처럼
 * 보여준다. 관측이 0건인 것보다 나쁘다 — 틀렸다는 것을 알 방법이 없기 때문이다.
 *
 * ── 왜 이 축인가 ────────────────────────────────────────────────────────
 * 응답 자체는 증거가 되지 못한다(위 참고). 판매처가 **스스로 공시한 배송 국가
 * 목록**이 우리가 가진 유일한 독립 근거이고, 그건 이미 받아오고 있던 값이다
 * (`/meta.json` — 새 엔드포인트도, 새 요청 축도 만들지 않는다).
 *
 * ── 확인할 수 없으면 기록하지 않는다 ─────────────────────────────────────
 * 목록을 못 읽으면 그 매장의 **국가 시장은 하나도 관측하지 않는다**(null을 "배송
 * 한다"로 해석하지 않는다). "모르는 것은 null"이라는 이 저장소의 규칙 그대로다.
 *
 * ── 국가가 아닌 시장 코드는 이 문을 지나지 않는다 ─────────────────────────
 * "en-int"는 어느 나라도 아니라서 배송 국가로 검증할 대상 자체가 없다(화면도 이
 * 코드를 끝까지 국가로 바꾸지 않는다 — 🌎 국제). 이 줄이 주장하는 것은 "일본
 * 가격"이 아니라 "국제 시장 가격"이고, 그 주장은 이 가드가 막으려는 종류의
 * 거짓말이 아니다. 국가를 주장하지 않는 코드에 배송 국가 검증을 걸면, 실측으로
 * 다른 값이 확인된 진짜 시장(en-de €75 vs en-int €84)이 근거 없이 사라진다.
 *
 * 실측 영향(2026-09-13 `/meta.json` 확인): bobochoses는 en-jp 하나만 빠지고
 * (en-us/en-gb/en-fr/en-de/en-au/en-ca/en-int는 그대로), junioredition은
 * `ships_to_countries`가 `"*"`로 시작해 한 건도 빠지지 않는다.
 */
function marketMayBeObserved(shopMeta: ShopifyShopMeta | null, marketCode: string): boolean {
  // 시장 코드 끝의 2글자 지역만 국가 주장이다("en-de"→DE, "en-int"→없음).
  const region = /-([a-z]{2})$/i.exec(marketCode)?.[1];
  if (!region) return true;
  return shipsToCountry(shopMeta, region) === true;
}

/**
 * SMALLABLE-MARKET-PROBE-1 — 이름이 바뀌었다(probeAdditionalMarkets →
 * probeAdditionalShopifyMarkets). 바깥에서 부르던 이름은 market-probe.ts가
 * 이어받아 "Shopify면 이 함수"로 넘긴다.
 *
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL — 후보 목록과 요청 방식은 그대로이고, 그
 * 앞에 문이 하나 생겼다(marketMayBeObserved). 문을 요청 **전**에 두는 이유는
 * PART H(비용)다 — 배송하지 않는 나라에는 HTTP 요청을 한 건도 보내지 않는다.
 * `/meta.json`은 각 probeMarket이 어차피 한 번씩 부르던 것이라 여기서 먼저
 * 불러도 요청 수는 늘지 않는 쪽에 가깝다(오히려 걸러진 만큼 줄어든다).
 */
export async function probeAdditionalShopifyMarkets(
  sourceUrl: string,
  excludeMarketCodes: string[],
): Promise<ShopifyMarketProbeResult[]> {
  const handle = extractShopifyHandle(sourceUrl);
  if (!handle) return [];
  const origin = new URL(sourceUrl).origin;
  const shopMeta = await fetchShopifyShopMeta(origin);
  const candidates = EXPAND_CANDIDATE_MARKET_CODES.filter(
    (code) => !excludeMarketCodes.includes(code) && marketMayBeObserved(shopMeta, code),
  );
  const results = await Promise.all(candidates.map((code) => probeMarket(origin, handle, code)));
  return results.filter((r): r is ShopifyMarketProbeResult => r !== null);
}
