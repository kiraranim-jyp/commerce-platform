import { decodeHtmlEntities } from "./html-entities";
import { productFactsFromListing, productFactsFromShopifyProduct } from "./seller-facts";
import { classifyUrlShape, toCrawlerUrl } from "../discovery-benchmark/url-resolver";
import { extractShopifyHandle, fetchPlainHtml } from "../shopify-product-json";
import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-B.1(CPO 승인, 2026-10-07) — **AI 가 준 «맨 URL» 을 기존 MI
 * 입력으로 바꾸는 입력 seam.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 새 파일이 필요한가 — 기존 Light Fetch 경로는 «검색 응답» 에 묶여 있다:
 *
 *   searchShopifySuggest   suggest.json 응답의 body/vendor/type/tags → facts
 *   국내 Cafe24 파서        검색 HTML 의 목록 마크업 → facts
 *
 * AI(Google/Naver)가 돌려주는 것은 상품 URL 하나이고, 그 URL 에는 목록 마크업도
 * 검색 응답도 없다. 그래서 「URL → facts」 한 칸이 비어 있었다.
 *
 * 🔴 **새 MI 판정 로직이 아니다.** 이 파일은 판정을 한 줄도 하지 않는다 —
 *    `ProductFacts` 를 만들어 기존 `withConfidence` →
 *    `compareCrossSellerProducts` → `deriveMatchTruth` 에 넘길 뿐이다.
 * 🔴 **URL 정규화를 새로 만들지 않는다.** `classifyUrlShape` / `toCrawlerUrl`
 *    (MI-DISCOVERY-LONGSPRINT-P1.1 에서 이 목적으로 만든 것)을 그대로 쓴다 —
 *    로케일 제거·목록 경로 제거·dedupeKey 가 거기 이미 있다.
 *
 * ── 가격을 만들지 «않는다» ──────────────────────────────────────────────────
 * 🔴 Shopify `/products/{handle}.json` 의 `variants[].price` 는 **통화 코드가
 *    없다**. 통화를 알려면 `/meta.json` 을 한 번 더 받아야 하고(= 비용 2배),
 *    그러면 PRICE-ACCURACY-REGRESSION-1.1 이 고친 「매장 기준 market 고정」
 *    규칙을 이 자리에서 다시 구현하게 된다.
 *
 * 그래서 `price: null` 로 둔다. 가격은 이미 검증된 기존 경로
 * (`enrichCandidatePrices` / `verifySourcePriceDirect`)가 담당하고, 그때까지
 * `price-truth.ts` 게이트가 이 후보를 가격비교에서 **정직하게 제외** 한다.
 * 「모르는 가격」을 숫자로 만들지 않는다.
 */
export type ProductUrlFactsStatus =
  /** facts 를 만들었다. */
  | "OK"
  /** URL 모양이 상품 페이지가 아니다(목록·루트·판별 불가). HTTP 를 쓰지 않았다. */
  | "NOT_PRODUCT_URL"
  /** 상품 URL 로 보였지만 응답을 받지 못했다. 「상품이 없다」가 아니다. */
  | "UNREACHABLE"
  /** 응답은 받았지만 상품명조차 읽지 못했다 — 지어내지 않고 멈춘다. */
  | "NO_FACTS";

export interface ProductUrlFactsResult {
  status: ProductUrlFactsStatus;
  /** 로케일·목록경로·쿼리스트링을 떼어 낸 정규 상품 URL. */
  crawlerUrl: string | null;
  /** 같은 판매처의 같은 상품을 합치는 키(판매처는 합치지 않는다). */
  dedupeKey: string | null;
  /** 기존 MI 가 그대로 먹는 모양. `withConfidence(query, [candidate])` 로 넘긴다. */
  candidate: ComparisonCandidate | null;
  /**
   * 🔴 이 호출이 실제로 쓴 HTTP 요청 수. 비용을 «코드가 직접» 보고한다 —
   *    밖에서 fetch 를 계측하면 측정 하니스마다 숫자가 달라진다(P5.4-B 에서
   *    실제로 그랬다).
   */
  httpCalls: number;
  /** Shopify JSON 경로를 썼는가(8KB) vs HTML 경로(188~256KB 실측). */
  fetchPath: "SHOPIFY_JSON" | "PLAIN_HTML" | "NONE";
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10000;

/** Shopify `/products/{handle}.json` 의 상품 객체 중 이 seam 이 읽는 칸만. */
interface ShopifyProductJsonBody {
  title?: string;
  handle?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[] | string;
  options?: { name?: string; values?: string[] }[];
  images?: { src?: string }[];
}

/** 🔴 상품명을 «지어내지 않는다» — 둘 중 실제로 있는 것만 읽고, 없으면 null 이다. */
const OG_TITLE_RE = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;

function titleFromHtml(html: string): string | null {
  const raw = OG_TITLE_RE.exec(html)?.[1] ?? TITLE_RE.exec(html)?.[1] ?? null;
  if (!raw) return null;
  const clean = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  return clean || null;
}

/**
 * 🔴 **브랜드를 읽지 않으면 진짜 동일상품이 SAME 에 닿지 못한다.**
 *
 * 실측(2026-10-07, littleluna 4120): 품번·제목·상품군·색상 네 축이 전부 맞았는데
 * `verdict = PRESUMED_SAME` 이었다. 원인은 `blockers = ["BRAND_UNCONFIRMED"]` —
 * `productFactsFromListing({title, url})` 에 브랜드를 넘기지 않아서다.
 * `cross-seller.ts` 의 SAME 조건은 `!blocked && brandOk && …` 이라 보류 하나로 막힌다.
 *
 * 🟢 그런데 브랜드는 상품 페이지에 **실제로 있다** — JSON-LD `brand.name` =
 *    `"MAIN STORY"`. 없는 것을 지어내는 것이 아니라 있는 것을 읽는 것이다.
 *
 * 🔴 읽는 자리를 셋으로 한정한다(모르는 곳에서 추측하지 않는다). 색상·소재·상품군은
 *    **건드리지 않는다** — 그 추출기는 CPO 가 이번 범위에서 금지했다.
 */
const BRAND_PATTERNS: RegExp[] = [
  /<meta[^>]+property=["']og:brand["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+property=["']product:brand["'][^>]+content=["']([^"']+)["']/i,
  /"brand"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/i,
];

function brandFromHtml(html: string): string | null {
  for (const re of BRAND_PATTERNS) {
    const hit = re.exec(html)?.[1];
    if (!hit) continue;
    const clean = decodeHtmlEntities(hit).replace(/\s+/g, " ").trim();
    if (clean) return clean;
  }
  return null;
}

export async function factsFromProductUrl(url: string): Promise<ProductUrlFactsResult> {
  const none = { candidate: null, httpCalls: 0, fetchPath: "NONE" as const };

  // ── ① URL 모양 판별 — 상품이 아니면 요청을 «보내지 않는다» ────────────────
  const shape = classifyUrlShape(url);
  const { crawlerUrl, dedupeKey } = toCrawlerUrl(url, shape);
  if (shape !== "PRODUCT_PAGE" || !crawlerUrl) {
    return { status: "NOT_PRODUCT_URL", crawlerUrl, dedupeKey, ...none };
  }

  let origin: string;
  try {
    origin = new URL(crawlerUrl).origin;
  } catch {
    return { status: "NOT_PRODUCT_URL", crawlerUrl: null, dedupeKey: null, ...none };
  }
  const domain = new URL(crawlerUrl).hostname.replace(/^www\./, "");

  // ── ② Shopify 면 JSON 한 번 — 실측 7,991B vs HTML 255,790B(32배) ──────────
  const handle = extractShopifyHandle(crawlerUrl);
  if (handle) {
    let body: ShopifyProductJsonBody | null = null;
    try {
      const res = await fetchWithDomainRateLimit(`${origin}/products/${handle}.json`, {
        headers: { Accept: "application/json", "User-Agent": CHROME_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) body = ((await res.json()) as { product?: ShopifyProductJsonBody }).product ?? null;
    } catch {
      body = null;
    }
    if (!body?.title) {
      // 🔴 Shopify 로 «보였지만» JSON 이 없는 경우가 있다(실측: 일부 매장이
      //    /products/*.json 을 막는다). 그때는 HTML 로 내려간다 — 「상품 없음」이
      //    아니다. 아래 HTML 경로가 그 일을 한다.
      return htmlPath(crawlerUrl, dedupeKey, domain, 1);
    }
    const facts = productFactsFromShopifyProduct(
      {
        title: body.title,
        handle: body.handle,
        url: crawlerUrl,
        // 🔴 `body_html` 을 그대로 넘긴다 — `productFactsFromShopifyProduct` 가
        //    이미 `plainText()` 로 태그를 벗긴다(seller-facts.ts:103). 여기서 또
        //    벗기면 같은 일을 두 곳에서 하게 되고, 한쪽만 고치면 갈린다.
        body: body.body_html,
        vendor: body.vendor,
        type: body.product_type,
        tags: body.tags,
        options: body.options,
        images: body.images?.map((i) => i.src).filter((s): s is string => !!s),
      },
      domain,
    );
    return {
      status: "OK",
      crawlerUrl,
      dedupeKey,
      candidate: {
        title: body.title,
        url: crawlerUrl,
        // 🔴 통화를 모르므로 가격을 만들지 않는다(파일 머리 주석 참고).
        price: null,
        regularPrice: null,
        imageUrl: facts.imageUrls[0] ?? null,
        confidence: 0,
        brand: facts.brand ?? undefined,
        facts,
      },
      httpCalls: 1,
      fetchPath: "SHOPIFY_JSON",
    };
  }

  // ── ③ Shopify 가 아니면 HTML 한 번 ────────────────────────────────────────
  return htmlPath(crawlerUrl, dedupeKey, domain, 0);
}

/**
 * 🔴 비-Shopify 에는 «일반» 상품 사실 추출기가 없다. 그래서 목록 수준 사실
 *    (상품명·URL)만 만든다 — `productFactsFromListing` 이 바로 그 용도이고,
 *    나머지 축은 null/빈 배열로 남아 판정기가 그것을 「다름」이 아니라
 *    **「근거 없음」** 으로 읽는다(seller-facts.ts 주석의 원칙 그대로).
 *
 * 🔴 사이트별 상세 파서를 여기서 만들지 않는다. 그건 어댑터의 일이고, 이 파일이
 *    도메인 분기를 갖기 시작하면 price-source-adapter 등록부와 둘로 갈린다.
 */
async function htmlPath(
  crawlerUrl: string,
  dedupeKey: string | null,
  _domain: string,
  priorCalls: number,
): Promise<ProductUrlFactsResult> {
  const html = await fetchPlainHtml(crawlerUrl);
  const calls = priorCalls + 1;
  if (html === null) {
    return { status: "UNREACHABLE", crawlerUrl, dedupeKey, candidate: null, httpCalls: calls, fetchPath: "PLAIN_HTML" };
  }
  const title = titleFromHtml(html);
  if (!title) {
    return { status: "NO_FACTS", crawlerUrl, dedupeKey, candidate: null, httpCalls: calls, fetchPath: "PLAIN_HTML" };
  }
  const brand = brandFromHtml(html);
  const facts = productFactsFromListing({ title, url: crawlerUrl, brand });
  return {
    status: "OK",
    crawlerUrl,
    dedupeKey,
    candidate: {
      title,
      url: crawlerUrl,
      price: null,
      regularPrice: null,
      imageUrl: null,
      confidence: 0,
      brand: brand ?? undefined,
      facts,
    },
    httpCalls: calls,
    fetchPath: "PLAIN_HTML",
  };
}
