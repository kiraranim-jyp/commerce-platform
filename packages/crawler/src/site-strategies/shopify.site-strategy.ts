import { extractFromJsonLd, extractFromOpenGraph } from "../product-data-extractor";
/** 🔴 WU-134 — 거부 판정은 **브랜드 규칙 owner** 가 한다(사본 금지). */
import { resolveBrandName } from "../brand-resolver";
import { extractSiteBrandName } from "../site-brand-name";
import {
  extractShopifyHandle,
  fetchPlainHtml,
  fetchShopifyProductJs,
  fetchShopifyProductJson,
  stripShopifyLocalePrefix,
  type ShopifyProductResult,
} from "../shopify-product-json";
import type { SiteStrategy, SiteStrategyResult } from "./types";

/** N-3.76(2차, CPO 지시: "원본 통화와 판매가격 통화를 절대로 같은 필드로 처리하지
 * 않는다" / "en-kr URL → 한국 상품 → KRW 금지") — 사용자가 입력한 sourceUrl에
 * 로케일 프리픽스(/en-kr/ 등)가 붙어 있으면(예: 한국 로케일로 브라우징하다 복사한
 * 링크) fetchShopifyProductJson이 그 로케일의 presentment 가격(방문자 로케일에
 * 맞춰 변환된 표시가, 실제 매장 통화가 아님)을 그대로 돌려준다 — 이게 Junior
 * Edition(shopMeta.country=GB, shopMeta.currency=GBP)인데도 원본 가격이 ₩로
 * 표시되던 버그의 root cause였다(실측 확인: en-kr 요청은 GBP 90짜리 상품을
 * KRW로 반환). CanonicalProduct의 "원본 가격/원본 통화"는 매장의 실제 기준
 * 통화여야 하므로, 이 파일(extract())은 항상 로케일 프리픽스를 벗긴 URL로만
 * 요청한다 — handle은 매장 전체에서 유일해서 로케일을 빼도 항상 같은 상품을
 * 정확히 찾는다.
 *
 * P-4-DATA-6(2026-08-29) 정정 — 이 주석은 원래 "shopify-market-probe.ts와
 * comparison-search는 의도적으로 로케일을 그대로 쓴다"고 적혀 있었으나 틀렸다.
 * comparison-search도 실측으로 같은 문제(F5, 최대 6% 가격 불일치)를 겪었고
 * 이제 여기(shopify-product-json.ts)로 옮긴 stripShopifyLocalePrefix export를
 * 그대로 재사용해 동일하게 로케일을 벗긴다. shopify-market-probe.ts만 "여러
 * market의 실제 표시가를 의도적으로 비교"하는 목적이라 로케일을 그대로 쓴다. */

/** .json/.js 둘 다 통화 정보가 없을 때만(.json은 보통 variants[].price_currency로
 * 있음 — 드문 경우) plain fetch로 HTML을 한 번 더 가져와 JSON-LD/OpenGraph 메타에서
 * 통화를 보강한다. 이미 통화가 있으면 추가 요청을 하지 않는다 — "가능하면 HTML을
 * 아예 안 읽는다"는 원칙을 지키면서도 가격 표시에 통화가 비는 걸 막는다. */
async function fillMissingCurrency(
  result: ShopifyProductResult,
  url: string,
): Promise<SiteStrategyResult> {
  if (!result.productData.price || result.productData.price.currency) {
    return result;
  }
  const html = await fetchPlainHtml(url);
  if (!html) return result;

  const jsonLd = extractFromJsonLd(html);
  const og = extractFromOpenGraph(html);
  const currency = jsonLd?.price?.currency || og.price?.currency;
  if (!currency) return result;

  return {
    ...result,
    productData: { ...result.productData, price: { ...result.productData.price, currency } },
  };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 WU-134 — **`vendor` 가 브랜드가 아닐 때만** 사이트 이름을 보러 간다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 — WU-133 전수 추적이 찾은 사슬의 머리가 이것이다:
 * ```
 * bobochoses.com(브랜드 **공식몰**) Shopify `vendor` = **"AW26"**(시즌코드)
 *   → `resolveBrandName` 이 올바르게 버린다 → brand.value = ""
 *   → brandKnown=false → 모든 후보 BRAND_UNCONFIRMED → PRESUMED_SAME
 *   → crossSellerReserved → TEXT_CONFIRMED → COMPARISON → 가격비교 **0건**
 * ```
 * 🔴 그런데 이 경로는 **HTML 을 아예 읽지 않는다**(WU-079 가 기록한 그 성질) —
 *    그래서 페이지가 두 자리에 적어 둔 "Bobo Choses" 를 **볼 수가 없었다.**
 *
 * 🟢 **바로 위 `fillMissingCurrency` 와 완전히 같은 모양** 이다 — 「그 값이 비었을
 *    때만 HTML 을 한 번 더 받는다」. 🔴 그래서 추가 HTTP 는 **`vendor` 가 브랜드로
 *    쓸 수 없는 스토어에서만** 발생한다(실측: 후보 17건 중 **0건** · 원상품 1건).
 * 🔴 **브랜드를 여기서 «정하지» 않는다** — `siteBrandName` 칸에 담아 올리고,
 *    쓸지는 `canonical-product.ts` 가 더 좁은 조건에서 정한다.
 */
async function fillRejectedBrand(
  result: SiteStrategyResult,
  url: string,
): Promise<SiteStrategyResult> {
  const raw = result.productData.brand?.trim();
  /** 🔴 brand 가 **애초에 없으면** 보러 가지 않는다 — 「모르면 채우지 않는다」. */
  if (!raw) return result;
  const resolution = resolveBrandName(raw);
  /** 🟢 **거부된 경우만** — 정상 브랜드면 추가 HTTP 0 이고 아무것도 바뀌지 않는다. */
  if (!resolution?.changed || resolution.cleaned.trim()) return result;
  /** 🔴 이미 채워져 있으면 다시 받지 않는다(다른 전략이 넣었을 수 있다). */
  if (result.productData.siteBrandName) return result;

  /**
   * 🟢🟢 WU-FINAL-1 — **그 상점에서 한 번 알아낸 값을 다시 받지 않는다.**
   *
   * 실측(WU-173 · 3상품 × 5회): 이 추가 fetch 가 **429** 로 막혀 brand 복구가
   * **3/15(20%)** 였다. 🔴 그리고 `fetchWithDomainRateLimit` 는 **이미**
   * 429 재시도 1회 + `node:https` 폴백까지 한다 ⟹ 그 셋을 거쳐도 429 다
   * (= **사이트가 거부한다** · 우리 fetch 결함이 아니다).
   *
   * 🟢 결정적 비대칭 — 같은 실행에서 `products.json` 은 **항상** 성공하고 **HTML 만**
   *    막힌다. 그리고 `og:site_name` == JSON-LD `Organization.name` 은
   *    **상점 단위 상수** 다(그 가게의 모든 상품에 같은 값). ⟹ 그 상점에서
   *    **한 번만** 성공하면 된다.
   *
   * 🔴 **새 판정 규칙이 아니다** — 쓸지 말지는 `canonical-product.ts` 가 여전히
   *    「vendor 가 거부됐을 때만」으로 정한다(게이트 불변). 여기서는 **같은 값을
   *    다시 받지 않는 것** 뿐이다.
   * 🔴 **도메인을 브랜드로 쓰는 것이 아니다**(WU-080 금지) — 캐시 키가 호스트일 뿐,
   *    값은 그 상점이 **두 자리에 같은 이름을 적어 둔 사실** 에서만 나온다.
   * 🔴 음성 캐시는 **하지 않는다** — 실패(429)를 기억하면 영구히 포기하게 된다.
   */
  const host = hostOf(url);
  const memo = host ? SITE_BRAND_BY_HOST.get(host) : undefined;
  if (memo) return { ...result, productData: { ...result.productData, siteBrandName: memo } };

  const html = await fetchPlainHtml(url);
  if (!html) return result;
  const site = extractSiteBrandName(html);
  if (!site) return result;
  if (host) SITE_BRAND_BY_HOST.set(host, site.value);
  return { ...result, productData: { ...result.productData, siteBrandName: site.value } };
}

/**
 * 🟢 상점 단위 기억. 🔴 **성공한 값만** 담는다(실패를 담으면 영구 포기가 된다).
 * 🔴 프로세스 수명 동안만 산다 — DB·디스크에 **쓰지 않는다**.
 */
const SITE_BRAND_BY_HOST = new Map<string, string>();

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/** 🔴 테스트가 상태를 격리할 수 있어야 한다 — 운영 호출부는 **없다**. */
export function __resetSiteBrandMemoForTests(): void {
  SITE_BRAND_BY_HOST.clear();
}

/**
 * Shopify는 모든 스토어에 인증 없이 접근 가능한 공개 상품 JSON(`/products/{handle}.json`,
 * `/products/{handle}.js`) 엔드포인트를 제공한다. detect()는 URL의 `/products/{handle}`
 * 패턴만 보고 판별하므로 Playwright 네비게이션이 실행되기 전에도 안전하게 호출할 수
 * 있다 — Cloudflare가 Playwright의 자동화 패턴만 차단하고 plain fetch는 막지 않는
 * 사이트(실측: junioredition.com)에서도 이 경로는 영향을 받지 않는다.
 */
export const shopifySiteStrategy: SiteStrategy = {
  name: "shopify",

  async detect(url) {
    return extractShopifyHandle(url) !== null;
  },

  async extract(url) {
    // PRICE-ACCURACY-REGRESSION-1.1 — 프리픽스를 "벗겨서" 넘기는 대신 매장 기준
    // market으로 고정해서 받는다. 벗기기 정규식이 /en-int/를 놓쳐 International
    // market 가격(€84.00)이 매장 기준가(€75.00) 대신 들어오던 경로를 없앤다.
    const sourceUrl = stripShopifyLocalePrefix(url);
    const result = await fetchShopifyProductJson(url, { forceCanonicalMarket: true });
    if (!result) return null;
    /** 🔴 WU-134 — `vendor` 가 브랜드로 쓸 수 없을 때만 사이트 이름을 보러 간다. */
    return fillRejectedBrand(await fillMissingCurrency(result, sourceUrl), sourceUrl);
  },

  async fallback(url) {
    const result = await fetchShopifyProductJs(url);
    if (!result) return null;
    return fillRejectedBrand(await fillMissingCurrency(result, url), url);
  },
};
