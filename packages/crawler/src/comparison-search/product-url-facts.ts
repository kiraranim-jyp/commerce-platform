import { CRAWLER_USER_AGENT } from "../utils/user-agent";
/** 🔴 WU-151 — 브랜드 표기 등록부(실측 전용 · 브랜드당 1개). 새 사전을 만들지 않았다. */
import { lookupBrandByAliasInTitle } from "./brand-alias";
import { decodeHtmlEntities } from "./html-entities";
/** 🔴 CORE-2R-4 STEP 3 — **이미 받은 HTML** 에서만 읽는 순수 파서(추가 HTTP 0). */
import { extractMarketEvidence } from "./market-evidence";
/** 🔵 CORE-SAME-SPRINT-02 — 후보 상세설명의 품번을 기존 MODEL_CODE 증거로 «보강» 한다(새 축 0). */
import { recoverModelCodeFromDetail } from "./model-code-from-detail";
import { productFactsFromListing, productFactsFromShopifyProduct } from "./seller-facts";
import { classifyUrlShape, toCrawlerUrl } from "./url-shape";
import { extractShopifyHandle, fetchPlainHtmlWithFinalUrl } from "../shopify-product-json";
import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
/** 🔴 MI-020 — **순수 함수** 하나만 가져온다(HTML 문자열 → JSON-LD). Playwright 없다. */
/** 🔴 WU-053 — microdata 도 **순수 리더** 로만 가져온다(Product scope 1개 게이트 내장). */
import { extractFromJsonLd, extractMicrodataFromHtml } from "../product-data-extractor";
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
  | "NO_FACTS"
  /**
   * 🔴🔴 WU-075 — 상품 URL 로 요청했는데 **도착지가 상품이 아니다**(홈·목록 등).
   *    soft-404 와 「상품 삭제 후 홈으로 보내기」가 여기로 들어온다. HTTP 는
   *    **200** 이므로 `UNREACHABLE` 과 구분한다 — 「못 받았다」가 아니라
   *    **「다른 것을 받았다」** 다.
   */
  | "REDIRECTED_AWAY";

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

const CHROME_UA = CRAWLER_USER_AGENT;
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
  /**
   * 🔴🔴 WU-110 — **가격과 통화는 «이미 받은 이 JSON 안에» 있다.**
   *    실측(global.trenbe.com · B226AC009): `variants[0].price` = `"84.00"` ·
   *    `variants[0].price_currency` = `"USD"` (HTML 의 JSON-LD/og:price 와 일치).
   * 🔴 그런데 이 파일이 그 둘을 읽지 않아 **MI 가 SAME/EXACT 로 판정한 동일상품의
   *    해외 가격이 집계에서 빠졌다**(WU-108/109 실측 1건).
   * 🔴 **추가 HTTP 0** — 같은 응답을 다시 쓴다.
   */
  variants?: {
    price?: string;
    price_currency?: string;
    /**
     * 🔴🔴 WU-136 — **재고 칸은 「올 때만」 믿는다.**
     *    실측(2026-10-20 · Shopify 공개 `/products/{handle}.json` · 호스트 9):
     *    `inventory_management` 는 **9/9 가 `"shopify"`** 인데
     *    `inventory_quantity` 는 **2곳만** 돌려준다(thefrontshop · junioredition).
     * 🔴 그래서 운영 `isVariantAvailable`(shopify-product-json.ts:91)의
     *    `inventory_quantity ?? 0` 을 이 경로에 그대로 쓰면 **7곳이 「품절」로 떨어진다** —
     *    그 파일 주석이 금지한 「『모른다』를 『0이다』로 취급」 그 자체다.
     * 🟢 그래서 아래 `shopifyVariantAvailability` 는 **boolean | null** 을 낸다.
     */
    inventory_management?: string | null;
    inventory_policy?: string | null;
    inventory_quantity?: number;
  }[];
}

/**
 * 🔴🔴 WU-136 — 후보의 **판매여부**. 모르면 `null` 이고 **품절로 만들지 않는다**.
 *
 * 🟢 판정 축은 운영 owner(`isVariantAvailable`)와 **같은 Shopify 공식** 이다 —
 *    재고추적 안 함 / backorder 허용 / 실재고 > 0. 🔴 다른 것은 **하나** 다:
 *    실재고 칸이 **없으면 `null`**(모른다)이고 `0` 으로 떨어지지 않는다.
 *
 * ```
 * variants 없음                                     → null
 * inventory_management 가 없는 variant 가 있다        → true  (재고추적 안 함 = 구매 가능)
 * inventory_policy === "continue" 인 variant 가 있다  → true  (품절도 계속 판매)
 * inventory_quantity > 0 인 variant 가 있다           → true
 * 모든 variant 가 qty 를 «주고» 전부 0 이하           → false (품절)
 * qty 를 주지 않는 variant 가 남아 있다               → null  (모른다)
 * ```
 * 🔴 **추가 HTTP 0** — 가격과 같은 응답을 다시 읽는다.
 * 🔴 운영 `isVariantAvailable` 은 **고치지 않았다**(원상품 경로 불변).
 */
export function shopifyVariantAvailability(body: ShopifyProductJsonBody): boolean | null {
  const variants = body.variants;
  if (!variants || variants.length === 0) return null;
  let sawUnknownQuantity = false;
  for (const v of variants) {
    if (!v.inventory_management) return true;
    if (v.inventory_policy === "continue") return true;
    if (typeof v.inventory_quantity === "number" && Number.isFinite(v.inventory_quantity)) {
      if (v.inventory_quantity > 0) return true;
    } else {
      sawUnknownQuantity = true;
    }
  }
  return sawUnknownQuantity ? null : false;
}

/**
 * 🔴🔴 WU-110 — Shopify product JSON 의 **첫 variant** 에서 가격을 읽는다.
 *
 * 🔴 **둘 다 있어야 한다**(CPO 고정 안전조건):
 * ```
 * price "84.00" + price_currency "USD"  →  { amount: 84, currency: "USD" }
 * price 있고 통화 없음                   →  null
 * 통화 있고 price 없음                   →  null
 * ```
 * 🔴 숫자로 바꿀 수 없으면(빈 문자열·NaN) **null** 이다 — 0 으로 만들지 않는다.
 * 🔴 통화는 **대문자 3글자** 만 받는다. 그 모양이 아니면 **믿지 않는다**.
 */
/** 🟢 계약 테스트가 **이 함수를 직접** 부른다 — `fetchWithDomainRateLimit` 은 전역
 * `fetch` 를 쓰지 않아(SSRF 가드 경유) 주입으로는 잠글 수 없다. 판정 owner 는 이것이다. */
export function shopifyVariantPrice(
  body: ShopifyProductJsonBody,
): { amount: number; currency: string } | null {
  const v = body.variants?.[0];
  const raw = v?.price;
  const cur = v?.price_currency?.trim().toUpperCase();
  if (!raw || !cur) return null;
  if (!/^[A-Z]{3}$/.test(cur)) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency: cur };
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

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-151 — **네 번째 자리: 상품명이 말하는 브랜드 표기**(국내/해외 공통)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 위 세 자리(og:brand · product:brand · JSON-LD brand)는 **영문권 마크업 전제** 다.
 *    국내 판매처 실측(2026-10-22 · B226AC009):
 * ```
 * beaumonde.co.kr  세 자리 **전부 없음** · og:title 「**보보쇼즈** 26FW … B226AC009」
 * ⟹ facts.brand = null ⟹ MI `BRAND_UNCONFIRMED` ⟹ 품번이 exact 인데도 **보류**
 *    (그 후보의 MI 근거에 「**브랜드 품번 일치**」가 이미 적혀 있었다)
 * ```
 * 🟢 브랜드는 그 페이지에 **실제로 있다.** 없는 것을 지어내는 것이 아니라 읽는 것이다
 *    (바로 위 `BRAND_PATTERNS` 주석이 세운 그 원칙 그대로).
 *
 * ── 🔴 안전 조건 셋(CPO 금지 3·4 를 지키는 방식) ────────────────────────────
 * ```
 * ① **등록부에 실측으로 올라온 표기만** 인식한다(`brand-alias.ts` · 브랜드당 1개)
 * ② **상품명(og:title)만** 본다 — 본문을 보면 「추천 브랜드」를 상품 브랜드로 오인한다
 * ③ 표기 **앞뒤 경계** 를 요구한다 — 「보보쇼즈st」 같은 유사품 표기를 읽지 않는다
 * ```
 * 🔴 **마지막 자리** 다 — 구조화 데이터가 있으면 그쪽이 언제나 이긴다(추가 전용).
 * 🔴 도메인 분기 **0** — 보몽드 전용 예외가 아니다.
 */
/** 🔴 WU-151 — 계약 테스트가 **직접 부른다**(네트워크 없이 네 자리를 전부 단언하기 위해).
 *    이 저장소의 기존 패턴과 같다(`brandFromTitleByClause` 도 같은 이유로 export 돼 있다). */
export function brandFromHtml(html: string): string | null {
  for (const re of BRAND_PATTERNS) {
    const hit = re.exec(html)?.[1];
    if (!hit) continue;
    const clean = decodeHtmlEntities(hit).replace(/\s+/g, " ").trim();
    if (clean) return clean;
  }
  const ogTitle = OG_TITLE_RE.exec(html)?.[1];
  if (ogTitle) {
    const viaAlias = lookupBrandByAliasInTitle(decodeHtmlEntities(ogTitle).replace(/\s+/g, " ").trim());
    if (viaAlias) return viaAlias;
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
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 CORE-SAME-SPRINT-02 — **공급 지점은 «여기 하나» 다**(CPO §7)
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴🔴 **새 SAME 축이 아니다.** 기존 `MODEL_CODE` 축에 **증거를 공급** 한다 —
     *    `brandModelCode` 가 **비어 있을 때만** 후보 상세 raw text 에서 승인된 품번
     *    패턴이 **정확히 1개** 찾히면 채운다. 그 뒤는 **기존 matcher 그대로** 통과한다.
     * 🔴 threshold · 8축 · `NO_TITLE_OVERLAP` · BRAND · COLOR · `priceTier` ·
     *    `domesticReference` — **변경 0**.
     *
     * 🟢 **왜 Shopify 경로에만 두는가** — 상세설명 전문이 **이 경로에서만** 들어온다
     *    (위 `body: body.body_html` → `plainText()`). 🔴 HTML 경로는 `description`/
     *    `material` 을 **일부러 넘기지 않는다**(거짓 MATERIAL blocker 때문 ·
     *    `productFactsFromListing` 의 `category` 주석) ⟹ 그 경로에 두면 **발화할 입력이 없다**.
     *    🔴 그래서 실측 발화가 `tinyapple`(Shopify)에 몰린 것은 샵 편향이 아니라
     *       **공급 경로의 구조** 다 — 「모든 판매처에서 검증됐다」로 읽지 않는다.
     *
     * 🟢 실측(GT 33쌍) — SAME 회수 **5/17 유지** · DIFFERENT 누출 **2 → 1** ·
     *    기존 FP **2 → 1** · TN **8 → 9** · 안전조건 **6/6 PASS**.
     * 🟢🟢 **SPRINT-03 — 우회가 «제거» 됐다.** 이 경로의 `facts` 는
     *    `productFactsFromShopifyProduct` 산출이고 그 함수가 이제 **정식
     *    `ProductFacts.description`** 을 싣는다(`seller-facts.ts`). 보강기는 그 칸만
     *    읽는다 — 🔴 `materialText` 폴백 **없음**(CPO §4 alias 금지).
     */
    const suppliedFacts = recoverModelCodeFromDetail(facts);
    return {
      status: "OK",
      crawlerUrl,
      dedupeKey,
      candidate: {
        title: body.title,
        url: crawlerUrl,
        /**
         * 🔴🔴 WU-110 — **통화가 «명시된» 경우에만** 가격을 만든다.
         *    파일 머리 주석의 「통화를 모르므로 가격을 만들지 않는다」는 **그대로 유효** 하다 —
         *    바뀐 것은 **이 JSON 이 통화를 명시한다는 사실을 우리가 읽는다** 는 것뿐이다.
         * 🔴 `price` 와 `price_currency` 가 **둘 다** 있어야 한다. 하나라도 없으면 **null** —
         *    통화 없는 숫자를 가격으로 쓰지 않는다(`resolveSourcePrice` 계약과 같은 방향).
         * 🔴 `variants[0]` 고정이다 — 「구매 가능한 variant 우선」 같은 선택 규칙은
         *    `fetchShopifyProductJson` 소관이고 **이 WU 의 범위가 아니다**(CPO 고정).
         */
        price: shopifyVariantPrice(body),
        regularPrice: null,
        /**
         * 🔴🔴 WU-136 — **판매여부는 가격보다 먼저 쓰이는 축** 이다(셀러의 1순위 질문).
         *    전까지 이 경로는 그 칸을 **아예 세우지 않아** 전건 `null` 이었고, 화면은
         *    「품절만 제외」(`soldOut !== true`)라 **모르는 것을 판매중처럼** 보여줬다.
         * 🔴 `shopifyVariantAvailability` 가 `null` 을 내면 그대로 `null` 이다 —
         *    「모른다」를 「판매중」으로도 「품절」로도 만들지 않는다(CPO WU-136 §G).
         */
        soldOut: ((a) => (a == null ? null : !a))(shopifyVariantAvailability(body)),
        imageUrl: suppliedFacts.imageUrls[0] ?? null,
        confidence: 0,
        brand: suppliedFacts.brand ?? undefined,
        /** 🔵 SPRINT-02 — **품번이 보강된** facts 를 넘긴다(그 외 칸은 그대로다). */
        facts: suppliedFacts,
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
  const fetched = await fetchPlainHtmlWithFinalUrl(crawlerUrl);
  const calls = priorCalls + 1;
  if (fetched === null) {
    return { status: "UNREACHABLE", crawlerUrl, dedupeKey, candidate: null, httpCalls: calls, fetchPath: "PLAIN_HTML" };
  }
  const { html, finalUrl } = fetched;

  /**
   * 🔴🔴 WU-075 — **도착지의 모양을 본다.** (추가 HTTP 0 · 새 규칙 0)
   *
   * 지금까지 ④ 의 통과 조건은 「HTTP ok + `<title>` 존재」**뿐** 이었다. 그래서
   * 「상품 URL → 홈 리다이렉트」가 **상품으로 통과** 했다(WU-074 실측 6/6).
   *
   * 🟢 판별기는 **새로 만들지 않는다** — 입구에서 이미 쓴 `classifyUrlShape` 를
   *    **도착지에** 한 번 더 적용할 뿐이다. 입구에서 `PRODUCT_PAGE` 임을 확인했으므로
   *    여기서 달라졌다면 **서버가 우리를 다른 곳으로 보냈다** 는 뜻이다.
   *
   * 🔴 **측정된 것만 막는다.** JSON-LD 필수화 ❌ · `og:type` 게이트 ❌ ·
   *    soft-404 텍스트 휴리스틱 ❌ — 셋 다 WU-074 에서 **정상 상품을 죽였다**
   *    (JSON-LD 12.5% · og:type 9.4% · 텍스트 17.2% 오차단).
   * 🔴 이 축의 상한도 적어 둔다 — **리다이렉트하지 «않는» 200 soft-404 는 통과한다.**
   *    그 모양은 WU-074 표본에 0건이었고 **미측정** 이다(WU-076 대상).
   */
  if (classifyUrlShape(finalUrl) !== "PRODUCT_PAGE") {
    return {
      status: "REDIRECTED_AWAY",
      crawlerUrl,
      dedupeKey,
      candidate: null,
      httpCalls: calls,
      fetchPath: "PLAIN_HTML",
    };
  }

  const title = titleFromHtml(html);
  if (!title) {
    return { status: "NO_FACTS", crawlerUrl, dedupeKey, candidate: null, httpCalls: calls, fetchPath: "PLAIN_HTML" };
  }
  /**
   * 🔴🔴 WU-053 — **JSON-LD 가 없는 정상 상품 페이지를 살린다.**
   *
   * WU-020 이 남긴 제한사항이 이것이었다 — tennis-warehouse 는 `application/ld+json`
   * 이 **0개** 이고 가격이 **microdata** 에 있어서, 후보 경로가 가격을 영구히 못 읽었다.
   * 🟢 `extractMicrodataFromHtml` 은 **이미 받은 `html`** 만 읽는다(추가 HTTP 0 ·
   *    Playwright 0)이고, Product scope 가 **정확히 1개** 일 때만 값을 낸다.
   *
   * 🔴 **보강만 한다 — 덮어쓰지 않는다.** JSON-LD/`og:*` 가 이미 준 값이 이긴다.
   *    실측(WU-053): JSON-LD 상품 4건은 Product scope **0** 이라 이 줄이 `null` 이고
   *    **기존 결과가 한 글자도 바뀌지 않는다.**
   * 🔴 **`sku` 는 올리지 않는다.** `match.ts:461` 의 SKU exact-match 로 들어가
   *    identity 판정을 바꿀 수 있고, CPO 가 「False SAME 증가 = 즉시 HOLD」로 못 박았다.
   *    가격·브랜드는 identity 축이 아니다(brand 는 기존 축이고 값이 **없을 때만** 채운다).
   */
  const micro = extractMicrodataFromHtml(html);
  const brand = brandFromHtml(html) ?? micro?.brand ?? null;
  /**
   * ══════════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2AC — **이미 받은 HTML 의 상세 증거를 facts owner 까지 «전달» 한다**
   * ══════════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 CORE-2AB 가 측정한 비대칭이 여기서 생겼다 — HTML 을 **받아 놓고** brand/price/
   *    marketEvidence 만 뽑은 뒤 **버렸다**. 그래서 PLAIN_HTML 후보의 ProductFacts 는
   *    일곱 칸이 null/[] 이고, 같은 MI 가 Shopify 후보보다 **적은 축** 을 봤다.
   *
   * 🟢 **새 추출기를 만들지 않았다.** `extractFromJsonLd` 는 이 파일이 **이미**
   *    쓰는 함수다(`priceFromJsonLd` 안 · :497). 그 반환값에 `description` ·
   *    `jsonLdCategory` · `material` 이 **이미 들어 있었고 아무도 읽지 않았다.**
   * 🟢 **추가 HTTP 0** — 같은 문자열을 한 번 더 파싱할 뿐이다(네트워크 0 · Playwright 0).
   * 🔴 `priceFromJsonLd` 를 **고치지 않았다**(가격 경로 변경 금지) — 그래서 파싱이
   *    두 번이다. 가격 규칙의 owner 를 건드리지 않는 쪽을 택했다.
   *
   * 🔴 **보강만 한다 — 덮어쓰지 않는다.** 아래 세 칸은 지금 **전건 null/[]** 이므로
   *    기존 값을 이길 일이 구조적으로 없다(CPO 가 고정한 세 칸 · §1).
   * 🔴 `sku`/`brand`/`price` 는 **올리지 않는다** — WU-053 이 적은 그 이유 그대로다.
   */
  const jsonLd = extractFromJsonLd(html);
  const facts = productFactsFromListing({
    title,
    url: crawlerUrl,
    brand,
    /**
     * 🔴🔴 **분류 하나만 넘긴다.** `description`/`material` 은 **넘기지 않았다** —
     *    실측에서 `materialText` 가 **새 축 0 · 거짓 MATERIAL blocker 1**(organic cotton ↔
     *    cotton)을 만들었다. 근거 전문은 `productFactsFromListing` 의 `category` 주석.
     */
    category: jsonLd?.jsonLdCategory ?? micro?.jsonLdCategory ?? null,
  });
  /**
   * 🔴 WU-151 — 고도몰 **판매가** 필드가 **마지막 자리** 다(추가 전용).
   *    구조화 데이터(JSON-LD · microdata)가 값을 주면 그쪽이 언제나 이긴다 ⟹
   *    기존 후보의 가격은 **한 글자도 바뀌지 않는다**.
   */
  const priced = priceFromJsonLd(html) ?? micro?.price ?? priceFromGodoSaleField(html) ?? null;
  return {
    status: "OK",
    crawlerUrl,
    dedupeKey,
    candidate: {
      title,
      url: crawlerUrl,
      /**
       * 🔴🔴 MI-CANDIDATE-PRICE-EVIDENCE-020 — **이미 받은 `html` 에서만 읽는다.**
       *    추가 HTTP 0 · Playwright 0 · `universalExtract` 호출 0.
       *    통화가 같이 오지 않으면 `null` 이다(위 파일 주석의 이유 그대로).
       */
      price: priced,
      regularPrice: null,
      imageUrl: null,
      confidence: 0,
      brand: brand ?? undefined,
      /**
       * 🔴🔴 WU-055 — **이 한 줄이 없어서 국내 가격비교 도달이 0 이었다.**
       *
       * 이 리포의 가격 신뢰도 규칙은 한 곳에 있다(`derivePriceStatus` · match.ts:537):
       * ```
       * priceSource === "detail"  ⟹  VERIFIED_CURRENT
       * 그 외                      ⟹  UNVERIFIED_SEARCH
       * ```
       * 그 주석이 자격 사례까지 적어 뒀다 — 「**검색 자체가 상세 페이지를 조회하는
       * 경우**」(bobochoses.com 국내 검색). 🟢 이 함수가 **정확히 그 경우** 다:
       * 후보 URL 의 **상세 페이지를 직접 열어** JSON-LD/microdata 에서 가격을 읽는다.
       *
       * 🔴 그런데 `priceSource` 를 세우지 않아서, 바로 아래 흐름에서 **두 번 되돌려졌다**:
       * ```
       * withConfidence(match.ts:646) → derivePriceStatus → UNVERIFIED_SEARCH
       * enrichCandidatePrices        → blanket UNVERIFIED_SEARCH (Shopify handle 만 복구)
       * ⟹ 국내 비-Shopify 후보는 VERIFIED_CURRENT 가 «구조적으로» 불가능 →
       *    `priceKrw` 가 항상 null → 국내 축 진입 0 (WU-055 실측: KR 5건 전건 탈락)
       * ```
       * 🔴 **새 정책이 아니다** — 기존 규칙에 **빠져 있던 사실 하나** 를 적는 것이다.
       * 🔴 가격이 없으면 세우지 않는다(`null`) — 없는 신뢰도를 만들지 않는다.
       */
      priceSource: priced ? "detail" : null,
      /** 🟢 성공 규약을 `enrichCandidatePrices`(price-source-adapter.ts:275)와 맞춘다. */
      priceStatus: priced ? "VERIFIED_CURRENT" : "PRICE_UNAVAILABLE",
      facts,
      /**
       * 🔴🔴 CORE-2R-4 STEP 3 — **시장 증거를 같은 HTML 에서 읽는다**(추가 HTTP **0**).
       *
       * 🔴 `facts`(상품 축)와 **다른 칸** 이다 — 섞으면 「상품 ↔ 판매자/사이트 ↔ 시장」이
       *    다시 뒤섞인다(CPO 가 타입 설계를 그렇게 수정했다).
       * 🔴 **판정하지 않는다** — boolean 다섯 칸이고, KR/OVERSEAS/UNKNOWN 은
       *    `classifyCandidateMarket` 이 **통화와 함께 종합해서** 낸다.
       * 🔴 Shopify JSON 경로에는 본문이 없으므로 이 칸이 **서지 않는다**(= 「모른다」).
       */
      marketEvidence: extractMarketEvidence(html),
    },
    httpCalls: calls,
    fetchPath: "PLAIN_HTML",
  };
}

/**
 * 🔴🔴 **새 추출기를 만들지 않았다.** `extractFromJsonLd`(product-data-extractor.ts:175)는
 *    HTML 문자열만 받는 **순수 함수** 이고, 운영 원상품 경로가 이미 그것을 쓴다
 *    (universalExtract → extractProductData → pipeline/route.ts:151).
 *    여기서는 **같은 함수** 에 **이미 받아 둔 HTML** 을 넘긴다.
 *
 * 🔴 통화 없는 금액은 **버린다**. JSON-LD `offers.price` 는 `priceCurrency` 가
 *    형제 필드이고, 둘 중 하나라도 없으면 「모르는 가격」이다 — 숫자로 만들지 않는다.
 * 🔴 할인/variant/배송비/세금/환율/KRW 환산을 여기서 하지 않는다(WU-020 §2 범위).
 */
function priceFromJsonLd(html: string): { amount: number; currency: string } | null {
  const extracted = extractFromJsonLd(html);
  const price = extracted?.price;
  if (!price) return null;
  if (!Number.isFinite(price.amount) || price.amount <= 0) return null;
  const currency = price.currency?.trim().toUpperCase();
  if (!currency) return null;
  return { amount: price.amount, currency };
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-151 STEP 10/11 — **고도몰 계열의 «판매가» 필드**(사이트 전용 아님)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **WU-079 가 REJECT 한 것과 다른 축이다.** 그때 거부된 것은 ⒜ generic 숫자 parser
 *    (「N원」을 아무 데서나 줍는다 · 성공군 **5/9 오추출**) ⒝ 사이트 전용 adapter 다.
 * 🟢 이것은 **플랫폼(고도몰)이 자기 폼에 쓰는 «이름 있는» 필드** 를 읽는다 —
 *    도메인 분기 **0** · 숫자 줍기 **0**.
 *
 * ── 🔴 WU-059 의 HOLD 근거가 «부분 반증» 됐다(실측 2026-10-22) ────────────────
 * ```
 * WU-059: 「유일한 구조화 후보가 `set_goods_fixedPrice`(= **정가**) ⟹ 가격 오인 위험」
 * 🟢 실측: 그 페이지에는 **둘 다** 있다
 *      set_goods_price       83600      ← **판매가**(셀러가 실제로 파는 값)
 *      set_goods_fixedPrice  88000.00   ← 정가
 * ⟹ 🔴 **판매가 필드만 읽고 정가는 «절대» 읽지 않는다**(CPO STEP 10 명시).
 * ```
 *
 * ── 🔴 통화를 지어내지 않는다(이 저장소의 통화 가드) ───────────────────────────
 * 고도몰이 통화를 적지 않으므로 **두 번째 독립 출처의 동의** 를 요구한다 —
 * 같은 금액이 페이지에 **「…원」** 으로도 적혀 있을 때만 `KRW` 로 확정한다.
 * 🔴 동의가 없으면 **null** 이다(가격을 만들지 않는다).
 */
const GODO_SALE_PRICE_RE = /<input[^>]+name=["']set_goods_price["'][^>]+value=["']([0-9]+(?:\.[0-9]+)?)["']/i;

export function priceFromGodoSaleField(html: string): { amount: number; currency: string } | null {
  const raw = GODO_SALE_PRICE_RE.exec(html)?.[1];
  if (!raw) return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  /**
   * 🔴 두 번째 출처 — 같은 금액이 「원」 표기로도 나타나는가(천단위 쉼표 유무 둘 다).
   *
   * 🔴 **태그를 벗기고 본다.** 1차 구현은 raw HTML 에서 `83,600\s*원` 을 찾았고
   *    **실패했다** — 실제 마크업이 `<strong>83,600</strong><span>원</span>` 이라
   *    숫자와 「원」 사이에 태그가 들어간다. 🟢 그래서 금액 주변만 텍스트로 만든다.
   */
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ");
  const plain = String(Math.round(amount));
  const grouped = plain.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const hasKrwEvidence = new RegExp(`(?:${plain}|${grouped})\\s*원`).test(text);
  if (!hasKrwEvidence) return null;
  return { amount, currency: "KRW" };
}
