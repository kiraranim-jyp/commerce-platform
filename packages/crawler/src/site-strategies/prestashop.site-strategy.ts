import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ExtractedProductData } from "../product-data-extractor";
import type { ImageCandidate } from "../strategies/types";
import type { SiteStrategy, SiteStrategyResult } from "./types";

/**
 * SITE-EXTENSION-IMPLEMENTATION-1(CPO 지시, 2026-09-08) — PrestaShop 전용 경로.
 *
 * Shopify와 같은 이유로 만든다: Playwright를 켜기 전에 plain fetch만으로 상품
 * 데이터를 얻을 수 있으면 훨씬 빠르고, 브라우저 자동화를 차단하는 사이트도
 * 통과한다.
 *
 * ── 실측으로 확인한 것(2026-09-08) ────────────────────────────────────
 * 두 사이트 모두 PrestaShop이고, 둘 다 JSON-LD가 없고 schema.org **Microdata**
 * (itemprop 속성)로 상품 정보를 노출한다:
 *
 *   lojadada.com  — PrestaShop 1.6 계열. generator meta 없음.
 *                   전역 JS(var productPrice / id_product / combinations)로 식별.
 *                   price=37 EUR, availability=InStock, big_default 이미지 3장.
 *   lillamode.com — generator meta = "PrestaShop".
 *                   price=344.5 SEK, sku=240325-NU-4315, brand=NUNUNU.
 *
 * 그래서 JSON-LD/OpenGraph 전략은 이 사이트들에서 아무것도 못 건진다.
 * (open-graph는 og:price조차 없다 — 실측 확인.)
 *
 * ── detect()가 URL만 보는 문제(§4) ────────────────────────────────────
 * SiteStrategy 계약상 detect()에는 HTML이 없다. PrestaShop은 URL만으로 확정할
 * 수 없고(`/{id}-{slug}.html`은 다른 CMS도 쓴다), 무리하게 확정하면 false
 * positive로 멀쩡한 사이트의 수집을 망친다.
 *
 * 그래서 계약을 바꾸지 않고 2단계로 나눴다:
 *   detect()  — URL 힌트(느슨). 여기서 틀려도 손해가 없다.
 *   extract() — HTML을 받아 PrestaShop 시그니처를 확인하고, 아니면 null 반환.
 * null을 반환하면 오케스트레이터가 기존 Playwright 파이프라인으로 그대로
 * 넘어간다(§8 fallback 유지). 즉 이 전략이 틀려도 수집 성공률이 떨어지지 않는다.
 */

/** PrestaShop 기본 URL 형식: `/{카테고리}/{상품id}-{슬러그}.html`
 * 느슨한 힌트일 뿐이다 — 확정은 extract()의 시그니처 검사에서 한다. */
const PRODUCT_URL_PATTERN = /\/\d+[-_][a-z0-9][a-z0-9-]*\.html(?:$|[?#])/i;

export function looksLikePrestaShopUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return PRODUCT_URL_PATTERN.test(parsed.pathname + parsed.search);
  } catch {
    return false;
  }
}

/**
 * HTML이 실제로 PrestaShop인지 확인한다.
 *
 * 1.7+는 generator meta를 넣지만 1.6(lojadada)은 넣지 않는다. 그래서 단서
 * 하나에 의존하지 않고 여러 신호를 본다 — 하나라도 확실한 게 있으면 통과.
 */
export function isPrestaShopHtml(html: string): boolean {
  // 1.7+ : <meta name="generator" content="PrestaShop">
  if (/<meta[^>]+name=["']generator["'][^>]+content=["']PrestaShop/i.test(html)) return true;
  // 1.6 : 전역 JS 변수 조합. 하나만으로는 약해서 두 개 이상 함께 있을 때만 인정한다.
  const legacySignals = [
    /var\s+id_product\s*=/,
    /var\s+productPrice\s*=/,
    /var\s+productReference\s*=/,
    /var\s+combinations\s*=/,
    /var\s+static_token\s*=/,
  ].filter((re) => re.test(html)).length;
  return legacySignals >= 2;
}

/** 태그 사이 텍스트에서 HTML 엔티티/공백을 정리한다. */
function decodeText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * itemprop 값을 읽는다.
 *
 * **문서에 나오는 첫 번째 해당 요소**를 찾은 다음, 그 요소에서 값을 꺼낸다.
 * 순서가 중요하다 — 처음에는 "content 속성을 먼저, 없으면 텍스트"로 짰는데,
 * lojadada에는 `<h1 itemprop="name">상품명</h1>` 뒤에 브랜드 블록의
 * `<meta itemprop="name" content="BOBO CHOSES">`가 또 있어서 상품명 자리에
 * 브랜드가 들어갔다(실측으로 잡은 버그). 속성 종류가 아니라 위치가 기준이다.
 *
 * 값의 위치는 세 가지다:
 *   content="..."  — <meta itemprop="price" content="37">
 *   href="..."     — <link itemprop="availability" href="...schema.org/InStock">
 *   내부 텍스트     — <h1 itemprop="name">상품명</h1>
 */
function readItemprop(html: string, prop: string): string | null {
  const tagMatch = new RegExp(`<([a-z0-9]+)([^>]*\\bitemprop=["']${prop}["'][^>]*)>`, "i").exec(html);
  if (!tagMatch) return null;

  const [fullTag, tagName, attrs] = tagMatch;

  const content = /\bcontent=["']([^"']*)["']/i.exec(attrs);
  if (content?.[1]?.trim()) return content[1].trim();

  // href는 <link>일 때만 값이다. <a itemprop="brand" href="/브랜드페이지">처럼
  // 링크 태그의 href를 값으로 읽으면 브랜드명 자리에 URL이 들어간다(실측으로
  // 잡은 버그 — 그 탓에 brand≠sku가 되어 sku 오염 방지 로직이 안 걸렸다).
  if (tagName.toLowerCase() === "link") {
    const href = /\bhref=["']([^"']*)["']/i.exec(attrs);
    if (href?.[1]?.trim()) return href[1].trim();
  }

  // 내부 텍스트 — 중첩 태그(<a><span>브랜드</span></a>)도 있으므로 닫는
  // 태그까지 잘라내고 태그를 제거한다.
  const start = (tagMatch.index ?? 0) + fullTag.length;
  const closeIdx = html.toLowerCase().indexOf(`</${tagName.toLowerCase()}>`, start);
  const inner = html.slice(start, closeIdx === -1 ? start + 300 : Math.min(closeIdx, start + 1000));
  const decoded = decodeText(inner);
  return decoded || null;
}

/** offers 스코프 안에서만 가격을 찾는다 — 같은 페이지의 추천상품 가격을 집어오지
 * 않기 위해서다(product-data-extractor의 microdata 추출과 같은 원칙). */
function readOfferScope(html: string): string {
  const start = html.search(/itemprop=["']offers["']/i);
  if (start === -1) return html;
  return html.slice(start, start + 4000);
}

function parsePrice(raw: string | null): { amount: number; currency?: string } | null {
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, "");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return { amount: value };
}

/** PrestaShop 이미지 URL: `/{imageId}-{size}_default/{slug}.jpg`
 * 크기 접미사를 임의로 조합해 만들지 않는다(§7) — 페이지에 실제로 있는 URL만 쓴다. */
function extractImages(html: string, baseUrl: string): ImageCandidate[] {
  const urls = new Set<string>();
  const srcPattern = /<img[^>]+(?:src|data-src)=["']([^"']+?\.(?:jpg|jpeg|png|webp))(?:\?[^"']*)?["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = srcPattern.exec(html)) !== null) {
    const raw = match[1];
    // 썸네일(small_default/cart_default)은 갤러리 원본이 따로 있으므로 제외한다.
    if (/(?:small|cart|home)_default/i.test(raw)) continue;
    try {
      urls.add(new URL(raw, baseUrl).toString());
    } catch {
      // 상대경로 해석 실패는 조용히 건너뛴다 — 한 장 때문에 전체를 실패시키지 않는다.
    }
  }
  return [...urls].map((url) => ({ url, source: "prestashop" as const }));
}

export function parsePrestaShopHtml(html: string, url: string): SiteStrategyResult | null {
  if (!isPrestaShopHtml(html)) return null;

  const offerScope = readOfferScope(html);
  const title = readItemprop(html, "name");
  const priceRaw = readItemprop(offerScope, "price");
  const currency = readItemprop(offerScope, "priceCurrency");
  const availability = readItemprop(offerScope, "availability");
  const skuRaw = readItemprop(html, "sku");
  const brandRaw = readItemprop(html, "brand");
  const description = readItemprop(html, "description");

  const price = parsePrice(priceRaw);
  const productData: Partial<ExtractedProductData> = {};

  if (title) productData.title = title;
  if (price && currency) {
    productData.price = { amount: price.amount, currency };
    productData.priceValidity = "VALID";
  } else if (priceRaw) {
    // 가격 텍스트는 찾았는데 숫자로 해석하지 못한 경우 — 0을 지어내지 않고
    // 원문을 남긴다(기존 priceValidity 정책 그대로, §6).
    productData.priceValidity = "INVALID";
    productData.priceRawText = priceRaw;
  } else {
    productData.priceValidity = "MISSING";
  }

  if (availability) productData.available = /InStock/i.test(availability);
  if (description) productData.description = description;

  // lojadada 실측: itemprop="sku"에 SKU가 아니라 브랜드명("BOBO CHOSES")이
  // 들어 있다. 그대로 sku로 넣으면 매칭 로직이 가짜 식별자를 믿게 된다 —
  // 브랜드와 같은 값이면 sku로 쓰지 않는다.
  const brand = brandRaw || undefined;
  const sku = skuRaw && skuRaw.toLowerCase() !== (brand ?? "").toLowerCase() ? skuRaw : undefined;
  if (brand) productData.brand = brand;
  if (sku) productData.sku = sku;

  const images = extractImages(html, url);
  // 제목도 가격도 못 얻었으면 이 전략이 기여할 게 없다 — null을 돌려주고
  // 기존 파이프라인이 처리하게 한다.
  if (!title && !productData.price) return null;

  return { images, productData };
}

export const prestashopSiteStrategy: SiteStrategy = {
  name: "prestashop",

  async detect(url) {
    return looksLikePrestaShopUrl(url);
  },

  async extract(url) {
    const response = await fetchWithDomainRateLimit(url, {
      headers: {
        // 일부 PrestaShop 테마는 기본 UA에 축약 마크업을 준다.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return parsePrestaShopHtml(html, url);
  },

  async fallback() {
    // 별도 폴백 경로를 만들지 않는다. extract()가 실패하면 오케스트레이터가
    // 기존 Playwright + 범용 전략으로 넘어가는 것이 가장 안전하다(§8).
    return null;
  },
};
