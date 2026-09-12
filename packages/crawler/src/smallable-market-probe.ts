import type { MarketProbeResult } from "./market-probe-result";
import { acquireDomainSlot } from "./rate-limit/domain-rate-limiter";
import { expectedCurrencyFor, withSourceMarketCountry } from "./source-currency-policy";
import { fetchHtmlDirect } from "./utils/direct-html-fetch";

/**
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — smallable.com 시장 관측.
 *
 * ── 왜 Shopify 경로로는 한 건도 안 나왔나 ────────────────────────────────
 * probeAdditionalMarkets는 첫 줄이 extractShopifyHandle(sourceUrl)이었고, 그게
 * null이면 즉시 빈 배열이었다. smallable 상품 URL은 `/en/product/{slug}-{id}`라
 * `/products/{handle}` 정규식에 걸리지 않는다 — 즉 smallable은 "관측에 실패한"
 * 것이 아니라 **관측을 시도조차 한 적이 없다**. price_observations에 시장 행이
 * 하나도 없었던 이유가 그것이고, 그래서 화면의 글로벌 시장 줄도 늘 비어 있었다.
 *
 * ── 이 사이트에서 시장이란 무엇인가 ──────────────────────────────────────
 * Shopify는 시장이 URL 프리픽스(/en-de/)지만 smallable은 **배송국가 쿼리
 * 파라미터**다. 실측(2026-09-13, 실제 HTTP 응답의 JSON-LD):
 *
 *     country=   430632(AAA1804532)   430651(AAA1804641)
 *     FR             €45                  €75      ← 원본 상품가격(정책 고정)
 *     KR             €44                  €73
 *     US             €47                  €79
 *     JP             €49                  €81
 *
 * 430651은 SMALLABLE-PRICE-1이 2026-09-12에 잰 표(73/75/79/81)와 정확히 같다 —
 * 같은 방법이 하루 뒤에도 같은 값을 낸다는 확인이다. 통화는 네 나라 모두 EUR로
 * 고정해 요청한다(`?currency=EUR`): 나라마다 현지 통화를 받으면 사이트 자체 환율
 * 스프레드가 섞여서 시장 간 차이가 "얼마나 다른가"가 아니라 "누구 환율인가"가
 * 된다(OVERSEAS-CURRENCY-POLICY-1과 같은 이유).
 *
 * FR도 후보에 남겨 둔다. 원본가격 행(market_code=NULL)은 집계에서 "시장 미확인"
 * 으로 빠지기 때문에, FR을 관측하지 않으면 화면에 **원본 시장만 없는** 목록이
 * 뜬다(🇰🇷 🇺🇸 🇯🇵 는 있는데 🇫🇷 가 없다). 원본가격을 무엇으로 볼지는 여전히
 * source-currency-policy.ts 혼자 정한다 — 이 행은 MARKET_PROBE 라벨이 붙어
 * 원가 근거에서 제외된다.
 *
 * ── 절대 하지 않는 것 ────────────────────────────────────────────────────
 *  · 가격을 짐작하지 않는다. 아래 세 관문 중 하나라도 못 넘으면 그 시장은 결과에
 *    아예 없다(빈 값이지 추정값이 아니다).
 *  · 다른 상품의 가격을 이 상품의 시장가로 적지 않는다 — JSON-LD `model`이 URL의
 *    상품 id와 같은 노드에서만 금액을 읽는다. smallable 페이지에는 형제 색상
 *    변형과 추천상품이 잔뜩 있어서, "Product 노드 아무거나"는 바로 오염이다.
 *  · 요청한 국가로 응답했다는 증거가 없으면 저장하지 않는다. smallable은 인식하지
 *    못하는 파라미터를 조용히 무시하고 기본값으로 돌아가므로(실측), 그때 저장하면
 *    FR 가격이 KR 시장가로 둔갑한다 — 값이 없는 것보다 훨씬 나쁘다.
 */

/**
 * 실측으로 **서로 다른 금액을 내는 것이 확인된** 배송국가만 후보로 둔다. 목록을
 * 넓히는 유일한 방법은 새로 재보는 것이다 — "EU니까 DE도 되겠지"는 추측이고, 그
 * 추측이 맞아도 값이 어디서 왔는지 아무도 모르게 된다.
 */
export const SMALLABLE_CANDIDATE_MARKET_COUNTRIES = ["FR", "KR", "US", "JP"];

const SMALLABLE_HOST_SUFFIX = "smallable.com";

/** smallable 상품 URL인가. 호스트와 경로 모양 둘 다 봐야 한다 — 목록/브랜드
 * 페이지에 이 probe를 돌리면 그 페이지의 아무 상품 가격을 관측하게 된다. */
export function isSmallableProductUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== SMALLABLE_HOST_SUFFIX && !host.endsWith(`.${SMALLABLE_HOST_SUFFIX}`)) return false;
    return parseSmallableProductId(url) !== null;
  } catch {
    return false;
  }
}

/**
 * 상품 식별자. smallable URL의 마지막 경로 조각 끝에 붙어 있는 숫자이고
 * (`…-bobo-choses-430651`), 같은 값이 JSON-LD의 `model`에도 그대로 들어 있다
 * (실측 확인). 그래서 이 한 값으로 "내가 요청한 상품"과 "응답이 말하는 상품"을
 * 대조할 수 있다 — probe가 상품 동일성을 확보하는 유일한 근거다.
 */
export function parseSmallableProductId(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last) return null;
    const matched = /(\d{3,})$/.exec(last);
    return matched ? matched[1] : null;
  } catch {
    return null;
  }
}

/* ─────────────────────────── 응답 읽기(순수 함수) ─────────────────────────── */

const LD_JSON_SCRIPT_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

function parseLdJsonNodes(html: string): unknown[] {
  const nodes: unknown[] = [];
  for (const match of html.matchAll(LD_JSON_SCRIPT_RE)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      nodes.push(JSON.parse(raw));
    } catch {
      // 깨진 블록 하나 때문에 나머지를 버리지 않는다.
    }
  }
  return nodes;
}

function hasType(node: Record<string, unknown>, type: string): boolean {
  const value = node["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** ProductGroup/hasVariant/@graph/배열 어디에 들어 있든 Product 노드를 전부 모은다. */
function collectProductNodes(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const child of node) collectProductNodes(child, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  const obj = node as Record<string, unknown>;
  if (hasType(obj, "Product")) found.push(obj);
  for (const key of ["@graph", "hasVariant", "isVariantOf", "itemListElement"]) {
    if (obj[key] !== undefined) collectProductNodes(obj[key], found);
  }
  return found;
}

export interface SmallableMarketReading {
  /** JSON-LD `model` — URL의 상품 id와 일치함이 이미 확인된 값이다. */
  productId: string;
  sku: string | null;
  amount: number;
  currency: string;
  /** InStock/OutOfStock을 실제로 읽었을 때만 boolean. 못 읽었으면 undefined다 —
   * "확인 못 함"을 "판매중"으로 바꿔 적지 않는다. */
  available: boolean | undefined;
}

function readAvailability(raw: unknown): boolean | undefined {
  if (typeof raw !== "string") return undefined;
  if (/InStock|LimitedAvailability|PreOrder|BackOrder/i.test(raw)) return true;
  if (/OutOfStock|SoldOut|Discontinued/i.test(raw)) return false;
  return undefined;
}

/**
 * **요청한 상품의** 가격만 읽는다. `model`이 productId와 같은 Product 노드를
 * 찾고, 그 노드의 offers에서만 금액·통화·재고를 가져온다. 노드를 못 찾으면 null —
 * 페이지에 가격이 아무리 많아도 그건 다른 상품의 가격이다.
 */
export function readSmallableMarketPrice(html: string, productId: string): SmallableMarketReading | null {
  for (const root of parseLdJsonNodes(html)) {
    for (const product of collectProductNodes(root)) {
      const model = product.model;
      if (typeof model !== "string" && typeof model !== "number") continue;
      if (String(model).trim() !== productId) continue;

      const rawOffers = product.offers;
      const offer = (Array.isArray(rawOffers) ? rawOffers[0] : rawOffers) as Record<string, unknown> | undefined;
      if (!offer || typeof offer !== "object") return null;

      const amount = Number(offer.price);
      const currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency.trim().toUpperCase() : "";
      if (!Number.isFinite(amount) || amount <= 0 || !currency) return null;

      return {
        productId,
        sku: typeof product.sku === "string" ? product.sku : null,
        amount,
        currency,
        available: readAvailability(offer.availability),
      };
    }
  }
  return null;
}

/**
 * 응답이 "우리가 요청한 배송국가"로 렌더된 것인지 확인한다.
 *
 * 근거는 BreadcrumbList 마지막 항목이다 — smallable은 거기에 **현재 요청 URL을
 * 쿼리까지 그대로** 되싣는다(실측: `…-430651?currency=EUR&country=KR`). 페이지
 * 어딘가에 `country=KR`이 있는지를 전체 검색하지 않는 이유는 국가 선택기 링크가
 * 모든 나라를 다 들고 있기 때문이다 — 그렇게 세면 어떤 국가를 요청해도 통과한다.
 * 되싣은 값이 없으면 null이고, 그러면 이 관측은 버려진다(모르면 저장하지 않는다).
 */
export function readSmallableRequestedCountry(html: string): string | null {
  for (const root of parseLdJsonNodes(html)) {
    for (const node of Array.isArray(root) ? root : [root]) {
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      if (!hasType(obj, "BreadcrumbList")) continue;
      const items = obj.itemListElement;
      if (!Array.isArray(items) || items.length === 0) continue;
      const last = items[items.length - 1] as Record<string, unknown> | undefined;
      const item = last?.item;
      const href =
        typeof item === "string"
          ? item
          : typeof (item as Record<string, unknown>)?.["@id"] === "string"
            ? ((item as Record<string, unknown>)["@id"] as string)
            : typeof (item as Record<string, unknown>)?.url === "string"
              ? ((item as Record<string, unknown>).url as string)
              : null;
      if (!href) continue;
      try {
        const country = new URL(href).searchParams.get("country");
        return country ? country.trim().toUpperCase() : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Next.js가 만드는 클라이언트 리다이렉트 대상.
 *
 * 실측(430632): DB에 저장된 것이 예전 슬러그면 smallable은 HTTP 3xx가 아니라
 * **200 + `<meta http-equiv="refresh">`**를 준다(본문에 상품 JSON-LD가 아예 없다).
 * fetchHtmlDirect는 HTTP 리다이렉트만 따라가므로 여기서 한 번 더 따라가야
 * "예전 링크라서 관측 0건"이 되지 않는다. 상품 id가 같을 때만 따라간다.
 */
export function readMetaRefreshTarget(html: string, baseUrl: string): string | null {
  const tag = /<meta[^>]+http-equiv=["']refresh["'][^>]*>/i.exec(html);
  if (!tag) return null;
  const content = /content=["']([^"']*)["']/i.exec(tag[0]);
  const target = content ? /url\s*=\s*(.+)$/i.exec(content[1].trim()) : null;
  if (!target) return null;
  const href = target[1].trim().replace(/&amp;/g, "&");
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/* ───────────────────────────── 실제 조회 ───────────────────────────── */

async function fetchSmallableHtml(
  url: string,
  productId: string,
  followsLeft = 1,
): Promise<{ html: string; url: string } | null> {
  const release = await acquireDomainSlot(url);
  let response;
  try {
    response = await fetchHtmlDirect(url);
  } finally {
    release();
  }
  if (!response || response.status < 200 || response.status >= 300) return null;

  if (followsLeft > 0 && readSmallableMarketPrice(response.html, productId) === null) {
    const next = readMetaRefreshTarget(response.html, response.finalUrl);
    // 같은 상품 id일 때만 따라간다 — 다른 상품이나 목록으로 새면 그건 이 상품의
    // 시장가가 아니다(관측 0건이 오관측보다 낫다).
    if (next && parseSmallableProductId(next) === productId) {
      return fetchSmallableHtml(next, productId, followsLeft - 1);
    }
  }
  return { html: response.html, url: response.finalUrl };
}

async function probeSmallableMarket(
  sourceUrl: string,
  productId: string,
  countryCode: string,
  expectedCurrency: string,
): Promise<MarketProbeResult | null> {
  const url = withSourceMarketCountry(sourceUrl, countryCode);
  if (!url) return null;

  const fetched = await fetchSmallableHtml(url, productId);
  if (!fetched) return null;

  // 관문 ① 요청한 국가로 응답했는가.
  if (readSmallableRequestedCountry(fetched.html) !== countryCode) return null;
  // 관문 ② 그 응답이 말하는 상품이 내가 요청한 상품인가.
  const reading = readSmallableMarketPrice(fetched.html, productId);
  if (!reading) return null;
  // 관문 ③ 통화가 등록된 원본 통화 그대로인가(인식 못 한 파라미터는 조용히
  // 무시되므로 응답을 반드시 다시 확인한다 — source-currency-policy.ts의 규칙).
  if (reading.currency !== expectedCurrency) return null;

  return {
    marketCode: countryCode.toLowerCase(),
    amount: reading.amount,
    currency: reading.currency,
    sourceUrl: fetched.url,
    // smallable에는 매장 기준 국가를 선언하는 엔드포인트가 없다 — 없는 선언을
    // 요청한 배송국가로 대신 채우지 않는다(market_country는 계속 NULL이다).
    shopMeta: null,
    // 정가/할인 구분은 이 JSON-LD에 없다. 현재가를 정가로 복사하면 할인이 없는
    // 상품에 가짜 할인이 생긴다 — 없으면 없는 채로 둔다.
    regularPrice: null,
    available: reading.available,
  };
}

/**
 * 후보 배송국가를 실제로 찔러 보고, 세 관문을 모두 넘은 것만 돌려준다. 실패한
 * 국가는 결과에서 그냥 빠진다(그 시장을 "확인했는데 같은 값"으로 채우지 않는다).
 */
export async function probeSmallableMarkets(
  sourceUrl: string,
  excludeMarketCodes: string[],
): Promise<MarketProbeResult[]> {
  const productId = parseSmallableProductId(sourceUrl);
  const expectedCurrency = expectedCurrencyFor(sourceUrl);
  if (!productId || !expectedCurrency) return [];

  const excluded = new Set(excludeMarketCodes.map((code) => code.trim().toLowerCase()));
  const candidates = SMALLABLE_CANDIDATE_MARKET_COUNTRIES.filter(
    (country) => !excluded.has(country.toLowerCase()),
  );

  const results = await Promise.all(
    candidates.map((country) =>
      probeSmallableMarket(sourceUrl, productId, country, expectedCurrency).catch(() => null),
    ),
  );
  return results.filter((r): r is MarketProbeResult => r !== null);
}
