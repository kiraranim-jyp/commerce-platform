import { extractShopifyHandle, extractShopifyLocalePrefix } from "../shopify-product-json";
import type { DiscoveredUrl, ResolutionClass, ResolutionStep, ResolvedCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-LONGSPRINT-P1.1 §1 — URL Resolver (독립 계층)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 검색이 준 URL 을 **크롤러에 넣을 수 있는 상품 URL** 로 바꾸거나, 바꿀 수 없음을
 * 분류한다. 실측(2026-10-07, 표본 10 · 일반 웹검색)이 이 계층을 요구했다:
 *
 *     사용 가능한 상품 URL      1
 *     목록/브랜드 페이지        7   ← 그냥 크롤러에 넣으면 전부 오염된다
 *     404(낡은 검색 색인)       1
 *     302 → 홈                 1   ← URL 모양은 /products/ 인데 상품이 아니다
 *
 * 🔴 **목록 페이지에서 상품을 추출하지 않는다**(P1.1 §2). LISTING_PAGE 로 «정확히
 *    식별하고 보류» 한다. 추출을 시작하면 외부 Search Discovery 가 다시
 *    사이트별 Parser 프로젝트가 되고, 그게 Closed Registry 의 비용 그 자체다.
 */

/* ───────────────────────── 페이지 탐침(주입) ───────────────────────── */

/**
 * 🔴 HTTP 를 이 모듈 «안에서» 하지 않는다. 주입받는다 — 그래야 테스트가
 *    네트워크 없이 모든 분기를 덮을 수 있다(그리고 하니스가 호출량을 센다).
 */
export interface PageProbe {
  (url: string): Promise<{ status: number; finalUrl: string; canonicalUrl: string | null }>;
}

/* ───────────────────────── 경로 분류 (§2 A/B) ───────────────────────── */

/**
 * 🔴 **상품 판별이 목록 판별보다 먼저다.** Shopify 는 목록 «아래» 에 상품을 둔다 —
 *    실측 URL: `/en-kr/collections/misha-and-puff-sale/products/voyage-dress-...`
 *    (저장소 scripts/register-voyage-dress-live.ts 에 그대로 있다). 순서를 뒤집으면
 *    진짜 상품 URL 이 LISTING_PAGE 로 버려진다.
 */
const PRODUCT_PATH = /(?:^|\/)(?:products|product|dp|itm|goods)\/[^/]+/i;
/** 지시서 §2-A 가 `/...html` 을 상품 후보로 넣었다(실측 근거: wonderforkids 의
 *  `main-story-bubble-sweatshirt-grey-melange-fleece.html`). 🔴 다만 `.html` «자체» 는
 *  상품의 증거가 아니다 — 아래 제외 목록이 없으면 `about.html`·`index.html` 까지
 *  상품이 되고, 크롤러가 회사소개 페이지를 상품으로 읽는다. */
const PRODUCT_SUFFIX = /\.html?$/i;
/** 🔴 `.html` 이지만 상품일 수 없는 파일명. 모르는 이름은 여기 넣지 «않는다» —
 *  넣으면 진짜 상품을 버린다. 확실한 것만 적는다. */
const NON_PRODUCT_FILE =
  /(?:^|\/)(?:index|default|home|main|about|about-?us|contact|contact-?us|terms|privacy|policy|faq|help|login|signin|register|cart|checkout|sitemap|search|category|categories|collection|collections|list|brand|brands)\.html?$/i;
/** 🔴 `/shop/`·`/search/` 는 목록이다. 단 위 상품 패턴이 먼저 걸리면 상품이다. */
const LISTING_PATH = /(?:^|\/)(?:collections|collection|category|categories|search|shop|brands?|c)\/?/i;

export function classifyUrlShape(url: string): ResolutionClass {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return "UNUSABLE";
  }
  if (PRODUCT_PATH.test(pathname)) return "PRODUCT_PAGE";
  if (PRODUCT_SUFFIX.test(pathname)) {
    // 🔴 확실히 상품이 아닌 파일명은 목록 쪽으로도 올리지 않는다 — «모른다» 가 답이다.
    return NON_PRODUCT_FILE.test(pathname) ? "UNKNOWN_PAGE" : "PRODUCT_PAGE";
  }
  if (LISTING_PATH.test(pathname)) return "LISTING_PAGE";
  // 🔴 루트(`/`)도, 모르는 모양도 PRODUCT 로 올리지 않는다. 「모른다」를 남긴다.
  return "UNKNOWN_PAGE";
}

/* ───────────────────────── 크롤러용 URL 재조립 (§3) ───────────────────────── */

export interface CrawlerUrlResult {
  crawlerUrl: string | null;
  localeNormalized: boolean;
  dedupeKey: string | null;
}

/**
 * 🔴 **검색 URL 을 그대로 가격검증 입력으로 쓰지 않는다**(P1.1 §3).
 *
 * 실측: `junioredition.com/products/...` 를 열면 `/en-kr/products/...` 로
 * 리다이렉트된다. 기존 크롤러는 로케일 프리픽스가 있으면 «그 로케일의 가격» 을
 * 믿는 분기를 탄다 — KR 방문자가 보는 KRW 가 들어오고, 그건 원산지 기준가가
 * 아니다. 그래서 origin + handle 로 **재조립** 해 로케일을 떼어 낸다.
 *
 * 🔴 기존 크롤러의 가격 로직을 고치지 «않는다». 보호는 이 adapter 경계에서 한다.
 */
export function toCrawlerUrl(finalUrl: string, shape: ResolutionClass): CrawlerUrlResult {
  if (shape !== "PRODUCT_PAGE") return { crawlerUrl: null, localeNormalized: false, dedupeKey: null };
  let origin: string;
  let pathname: string;
  try {
    const parsed = new URL(finalUrl);
    origin = parsed.origin;
    pathname = parsed.pathname;
  } catch {
    return { crawlerUrl: null, localeNormalized: false, dedupeKey: null };
  }

  const handle = extractShopifyHandle(finalUrl);
  if (handle) {
    const hadLocale = extractShopifyLocalePrefix(finalUrl) !== "";
    return {
      // 🔴 로케일도, 목록 경로도, 쿼리스트링도 떼어 낸 «정규» 상품 URL.
      crawlerUrl: `${origin}/products/${handle}`,
      localeNormalized: hadLocale,
      // 판매처(origin)를 키에 넣는다 — 같은 상품이라도 판매처는 «합치지 않는다».
      dedupeKey: `${origin}|${handle}`,
    };
  }

  // Shopify 가 아니면 안전하게 재조립할 규칙이 없다. 쿼리스트링만 떼고 그대로 쓴다.
  return { crawlerUrl: `${origin}${pathname}`, localeNormalized: false, dedupeKey: `${origin}|${pathname}` };
}

/* ───────────────────────── 해석 ───────────────────────── */

export async function resolveCandidate(
  searchUrl: string,
  provenance: DiscoveredUrl[],
  probe: PageProbe,
): Promise<ResolvedCandidate> {
  const steps: ResolutionStep[] = ["SEARCH_URL"];
  const base = (over: Partial<ResolvedCandidate>): ResolvedCandidate => ({
    searchUrl,
    finalUrl: searchUrl,
    crawlerUrl: null,
    classification: "UNUSABLE",
    steps,
    httpStatus: null,
    dedupeKey: null,
    provenance,
    ...over,
  });

  let probed: { status: number; finalUrl: string; canonicalUrl: string | null };
  try {
    probed = await probe(searchUrl);
  } catch {
    // 🔴 「네트워크가 안 됐다」를 「상품이 없다」로 적지 않는다.
    return base({ classification: "UNUSABLE" });
  }

  if (probed.status === 404 || probed.status === 410) {
    // 실측 1건: wonderforkids.nl — 검색 색인이 낡아 상품이 사라졌다.
    return base({ finalUrl: probed.finalUrl, httpStatus: probed.status, classification: "NOT_FOUND" });
  }

  if (probed.finalUrl !== searchUrl) steps.push("REDIRECTED");

  let target = probed.finalUrl;
  if (probed.canonicalUrl && probed.canonicalUrl !== probed.finalUrl) {
    target = probed.canonicalUrl;
    steps.push("CANONICALIZED");
  }

  const shapeBefore = classifyUrlShape(searchUrl);
  let shape = classifyUrlShape(target);

  /**
   * 🔴 실측 1건(main-story.com): 검색 URL 은 `/products/bubble-sweatshirt-grey-melange`
   *    인데 302 로 **홈** 으로 간다. URL 모양만 보면 상품인데 도착지는 상품이 아니다.
   *    이것을 PRODUCT 로 두면 크롤러가 홈페이지를 상품으로 읽는다.
   */
  if (shapeBefore === "PRODUCT_PAGE" && shape !== "PRODUCT_PAGE") {
    shape = "UNUSABLE";
  }

  const { crawlerUrl, localeNormalized, dedupeKey } = toCrawlerUrl(target, shape);
  if (localeNormalized) steps.push("LOCALE_NORMALIZED");

  return base({
    finalUrl: target,
    httpStatus: probed.status,
    classification: shape,
    crawlerUrl,
    dedupeKey,
  });
}

/**
 * 🔴 크롤러에 넘길 자격 — **PRODUCT_PAGE 이고 crawlerUrl 이 있을 때만**.
 *    LISTING_PAGE 는 여기서 걸러진다(P1.1 §2 「무조건 넘기지 않는다」).
 */
export function isCrawlable(candidate: ResolvedCandidate): boolean {
  return candidate.classification === "PRODUCT_PAGE" && candidate.crawlerUrl !== null;
}
