import type { MarketProbeResult } from "./market-probe-result";
import {
  extractShopifyHandle,
  extractShopifySelectedVariantId,
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

/**
 * MI-ORIGIN-FX-VARIANT-WIRING-04(CPO 승인, 2026-11-21) — **원본 URL 이 가리키는
 * 옵션을 시장 관측에서도 보존한다.**
 *
 * ── 무엇이 틀려 있었나(운영 전수 실측) ──────────────────────────────────
 * CEO 지시 **P0-A.29-E ㉮**(2026-09-20 · 커밋 `683d9d83`)가 「URL 이 «UK 11» 을
 * 가리키는데 «UK 4» 가격을 쓰던 것」을 고쳤다. 그런데 그 수정은 **추출 경로** 에만
 * 들어갔고, 이 파일은 URL 을 **새로 조립** 하면서 `?variant=` 를 버렸다
 * (이 파일의 마지막 변경은 2026-09-13 으로 그 수정보다 **먼저** 다).
 *
 * 실측(`MI-ORIGIN-FX-DISCREPANCY-03` · junioredition Lulu T Bar Shoes):
 * 한 상품이 사이즈마다 **£115(UK 4·5) / £119(UK 7~11) / £123(UK 11.5·12)** 이고
 * 셀러가 준 URL 은 `?variant=40096037535807`(29 EUR / UK 11 / **£119**)인데
 * 원가 관측(ORIGIN_FX)은 **£115** 를 적고 있었다 — 그 URL 이 가리킨 옵션이 아니다.
 * ⟹ 착지원가·마진·CASE 가 **가장 싼 옵션 기준** 으로 섰다.
 *
 * ── 고치는 범위 ─────────────────────────────────────────────────────────
 * 🔴 **새 규칙을 만들지 않았다.** 옵션 선택·품절 판정·「못 찾으면 가격을 내놓지
 *    않는다」는 전부 `fetchShopifyProductJson`(shopify-product-json.ts:426-446)에
 *    **이미 구현돼 있다**. 이 파일이 할 일은 그 함수에 **URL 을 온전히 넘기는 것** 뿐이다.
 * 🟢 그래서 `selectedVariantId` 를 받아 쿼리로 다시 붙인다(없으면 **예전 URL 그대로**).
 * 🔴 가격·통화·환산 정책 · market 후보 목록 · `marketMayBeObserved` 게이트 ·
 *    요청 수는 **한 글자도 바꾸지 않았다**.
 *
 * ── 지정했는데 못 찾은 경우 ─────────────────────────────────────────────
 * 🔴 **조용히 다른 사이즈 가격으로 갈아타지 않는다.** 그 경우
 *    `fetchShopifyProductJson` 이 `price` 를 **내놓지 않고**, 아래 `if (!price …)`
 *    가 **null** 을 돌려준다 ⟹ 그 시장 관측 행이 **생기지 않는다**.
 *    🟢 원가는 그때 `run-price-check` 의 기존 폴백(= 스냅샷 추출가)으로 서고,
 *       그 추출가는 **이미 variant 를 존중한다** ⟹ 어느 경로로도 「다른 옵션의 가격」이 되지 않는다.
 */
async function probeMarket(
  origin: string,
  handle: string,
  marketCode: string,
  selectedVariantId: string | null,
): Promise<ShopifyMarketProbeResult | null> {
  const prefix = marketCode ? `/${marketCode}` : "";
  const base = `${origin}${prefix}/products/${handle}`;
  /** 🔴 `${base}.json` 뒤에 붙인다 — 쿼리를 경로 앞에 섞으면 `.json` 이 쿼리 안으로 들어간다. */
  const variantQuery = selectedVariantId ? `?variant=${selectedVariantId}` : "";
  const result = await fetchShopifyProductJson(`${base}${variantQuery}`);
  const price = result?.productData.price;
  if (!price || !price.currency) return null;
  return {
    marketCode,
    amount: price.amount,
    currency: price.currency,
    /** 🟢 실제로 무엇을 물었는지 그대로 남긴다(GLOBAL-MARKET ③ 과 같은 이유). */
    sourceUrl: `${base}.json${variantQuery}`,
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
  /** 🟢 WIRING-04 — 원본 URL 이 옵션을 가리키면 두 시장에 **같은 옵션** 을 묻는다. */
  const selectedVariantId = extractShopifySelectedVariantId(sourceUrl);
  const [originResult, krResult] = await Promise.all([
    probeMarket(origin, handle, "", selectedVariantId),
    probeMarket(origin, handle, "en-kr", selectedVariantId),
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
  /**
   * 🟢 WIRING-04 — 확장 시장에도 **같은 옵션** 을 묻는다.
   * 🔴 한 스냅샷 안에서 원가(ORIGIN_FX)와 시장 관측(MARKET_PROBE)이 **서로 다른 옵션**
   *    가격을 들고 있으면 같은 화면이 두 사실을 말한다(실측: ORIGIN_FX £115 ↔ en-int £115
   *    인데 그 URL 이 가리킨 옵션은 £119 였다) ⟹ 두 경로를 **같이** 보존한다.
   * 🔴 후보 목록·게이트·요청 수는 **불변** 이다.
   */
  const selectedVariantId = extractShopifySelectedVariantId(sourceUrl);
  const candidates = EXPAND_CANDIDATE_MARKET_CODES.filter(
    (code) => !excludeMarketCodes.includes(code) && marketMayBeObserved(shopMeta, code),
  );
  const results = await Promise.all(candidates.map((code) => probeMarket(origin, handle, code, selectedVariantId)));
  return results.filter((r): r is ShopifyMarketProbeResult => r !== null);
}
