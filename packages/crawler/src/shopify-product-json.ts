import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";
import type { ExtractedProductData } from "./product-data-extractor";
import { fetchWithDomainRateLimit } from "./rate-limit/domain-rate-limiter";
import type { ImageCandidate } from "./strategies/types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 상품 URL(/products/{handle} 또는 /ko/products/{handle} 등 로케일 프리픽스 포함)에서
 * handle을 뽑는다. Shopify의 공개 상품 JSON/JS 엔드포인트는 항상 이 handle 하나로만
 * 접근할 수 있어서, 이 정규식이 URL 기반 Shopify 판별의 유일한 근거가 된다. */
export function extractShopifyHandle(url: string): string | null {
  const match = /\/products\/([a-z0-9-]+)/i.exec(new URL(url).pathname);
  return match ? match[1] : null;
}

function toAbsoluteUrl(src: string): string {
  return src.startsWith("//") ? `https:${src}` : src;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface ShopifyJsonImage {
  id?: number;
  src: string;
  width?: number;
  height?: number;
  /** 이 이미지가 연결된 variant id 목록 — 매장이 옵션별(주로 색상) 대표컷을
   * 지정해뒀을 때만 값이 있다. */
  variant_ids?: number[];
}
interface ShopifyJsonVariant {
  id?: number;
  title?: string;
  price?: string;
  price_currency?: string;
  /** N-4.18-Q2 P0-1(대표님 지시, 2026-08-26) — 실측 확인(2026-08-26, curl로
   * `/products/{handle}.json` 직접 조회): 할인 없는 상품은 빈 문자열("")
   * — null/undefined가 아니다 —, 실제 할인 상품(60s Headband by Ketiketa,
   * junioredition.com)은 할인 전 정가 문자열("29600", 현재가는
   * "8900")이 그대로 들어있다. */
  compare_at_price?: string;
  compare_at_price_currency?: string;
  sku?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  inventory_quantity?: number;
  /** inventory_management가 없으면(null) 매장이 재고 추적을 안 한다는 뜻이라
   * inventory_quantity 숫자를 신뢰할 수 없다 — 이 경우 stockQuantity를 채우지
   * 않는다("모른다"를 "0이다"로 취급하지 않는다). */
  inventory_management?: string | null;
  /** N-4.18-Q2 P0-3 — 실측 확인(2026-08-26): `/products/{handle}.json`
   * (이 파일이 실제로 호출하는 엔드포인트)에는 `available` 불리언이 없다
   * (컬렉션 목록 `/collections/{handle}/products.json`에만 있음 — 다른
   * 엔드포인트, 혼동 금지). "재고 추적 안 함(inventory_management=null)이면
   * 항상 구매 가능", "inventory_policy=continue면 품절이어도 계속 판매",
   * 그 외엔 inventory_quantity>0"이라는 Shopify 공식 판매 가능 여부 공식을
   * 그대로 쓴다(추측이 아니라 위 inventory_management 주석과 동일 전제). */
  inventory_policy?: string | null;
  image_id?: number | null;
}

/** N-4.18-Q2 P0-3 — Shopify 공식 "구매 가능" 판정 공식(위 inventory_policy 주석
 * 참고): 재고추적 안 함 또는 backorder 허용 또는 실재고>0. */
function isVariantAvailable(variant: ShopifyJsonVariant): boolean {
  if (!variant.inventory_management) return true;
  if (variant.inventory_policy === "continue") return true;
  return (variant.inventory_quantity ?? 0) > 0;
}

/** N-4.18-Q2 P0-1(대표님 지시: "정상가와 현재 판매가가 같으면 중복 표시 안 함") —
 * compare_at_price가 있어도 현재가보다 크지 않으면(할인이 실제로 없으면) null.
 * 통화는 로케일 프리픽스가 있으면 compare_at_price_currency를, 없으면 매장
 * 고정통화(shopCurrency)를 price와 동일한 규칙으로 우선한다. */
function resolveRegularPrice(
  variant: ShopifyJsonVariant,
  currentAmount: number | undefined,
  localePrefix: string,
  shopCurrency: string | null,
): { amount: number; currency: string } | undefined {
  const raw = variant.compare_at_price;
  if (!raw) return undefined;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  if (currentAmount != null && amount <= currentAmount) return undefined;
  const currency =
    localePrefix && variant.compare_at_price_currency
      ? variant.compare_at_price_currency.toUpperCase()
      : (shopCurrency ?? (variant.compare_at_price_currency ?? "").toUpperCase());
  return { amount, currency };
}
interface ShopifyJsonOption {
  name?: string;
  values?: string[];
}
interface ShopifyJsonProduct {
  title?: string;
  body_html?: string;
  vendor?: string;
  images?: ShopifyJsonImage[];
  variants?: ShopifyJsonVariant[];
  options?: ShopifyJsonOption[];
  /** Sprint A-2.5(Category Resolver 2.0) — Shopify 상품은 breadcrumbPath/
   * jsonLdCategory 경로를 안 타므로(fillMissingCurrency만 HTML을 보강 조회한다)
   * vendor에 시즌코드("SS26")가 들어오는 등 브랜드 필드가 신뢰 안 될 때도
   * tags/product_type이 유일하게 남는 나이·성별·상품유형 신호인 경우가 실측으로
   * 확인됐다(bobochoses.com: vendor="SS26"이지만 tags에 "children","Kid" 포함). */
  tags?: string;
  product_type?: string;
}

/** variants[].option1/2/3 + options[].name을 CanonicalProductVariant.optionValues
 * (옵션명 -> 선택값 맵)로 합친다 — Shopify는 옵션을 이름이 아니라 순서(1/2/3)로
 * variant에 연결하기 때문에 options 배열의 순서와 맞춰서 읽어야 한다. */
function buildOptionValues(
  variant: ShopifyJsonVariant,
  optionNames: string[],
): Record<string, string> {
  const positions = [variant.option1, variant.option2, variant.option3];
  const optionValues: Record<string, string> = {};
  optionNames.forEach((name, index) => {
    const value = positions[index];
    if (value) optionValues[name] = value;
  });
  return optionValues;
}

interface ShopifyJsMedia {
  src: string;
  width?: number;
  height?: number;
  media_type?: string;
}
interface ShopifyJsVariant {
  price?: number;
}
interface ShopifyJsOption {
  name?: string;
}
interface ShopifyJsProduct {
  title?: string;
  description?: string;
  vendor?: string;
  price?: number;
  images?: string[];
  media?: ShopifyJsMedia[];
  variants?: ShopifyJsVariant[];
  options?: ShopifyJsOption[];
}

export interface ShopifyProductResult {
  images: ImageCandidate[];
  productData: Partial<ExtractedProductData>;
  /** N-3.7 — 이 요청이 내부적으로 이미 가져온 판매처 메타(country/name/currency).
   * shopify-market-probe.ts가 별도로 /meta.json을 다시 fetch하지 않고 이 값을
   * 그대로 재사용하도록 노출한다. */
  shopMeta: ShopifyShopMeta | null;
}

export interface ShopifyShopMeta {
  currency: string | null;
  /** N-3.7 — 판매처(편집샵) 원본 시장 국가. `/meta.json`이 실제로 그 매장의
   * 등록 국가를 돌려준다(실측 확인, 2026-08-11: junioredition.com/meta.json →
   * country: "GB"). URL locale이나 브랜드 국가로 추정하지 않고 이 값을 그대로
   * 쓴다 — 지금까지는 currency만 뽑고 이 필드를 버리고 있었다. */
  country: string | null;
  /** 매장 표시명(예: "Junior Edition") — 있으면 UI에 그대로 쓴다. */
  name: string | null;
}

/** 실측 확인(2026-08-03, CEO 리포트) — Shopify Markets를 쓰는 스토어는
 * `/products/{handle}.json`의 `variants[].price_currency`가 "요청이 어느
 * 지역에서 왔는지"에 따라 달라진다(presentment currency, 지오 기반). 영국
 * 매장(junioredition.com, GB)을 로컬에서 curl하면 GBP가 오지만 Vercel(미국
 * 리전) 서버에서 같은 요청을 보내면 USD로 바뀌는 걸 실측으로 확인했다 —
 * 상품 원가가 실제와 다른 통화로 잘못 표시/환산되는 심각한 버그였다.
 * `/meta.json`(모든 Shopify 스토어가 공개하는 매장 메타데이터)의 `currency`
 * 필드는 매장 관리자가 설정한 고정 기준 통화라 지역에 관계없이 항상 같다 —
 * 이 값을 always-authoritative override로 쓴다(있으면 무조건 우선, 없을 때만
 * variant.price_currency로 폴백). */
export async function fetchShopifyShopMeta(origin: string): Promise<ShopifyShopMeta | null> {
  try {
    const response = await fetchWithDomainRateLimit(`${origin}/meta.json`, {
      headers: { Accept: "application/json", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const meta = (await response.json()) as { currency?: string; country?: string; name?: string };
    return {
      currency: meta.currency ? meta.currency.toUpperCase() : null,
      country: meta.country ? meta.country.toUpperCase() : null,
      name: meta.name ? meta.name.trim() : null,
    };
  } catch {
    return null;
  }
}

/** URL에 Shopify Markets 로케일 프리픽스(/en-kr/products/... 등)가 있으면 그대로
 * 돌려준다("/en-kr") — 없으면 "". 이 프리픽스가 붙은 상품 JSON 요청은 방문자의
 * 실제 로케일로 고정된 가격(예: KRW 직접 표시가)을 돌려주므로, 프리픽스 없는
 * 기본 요청과 섞어 쓰면 안 된다(아래 shopCurrency 오버라이드 분기 참고).
 *
 * 로케일 세그먼트만 뽑는다(경로 시작 바로 뒤, xx-xx 형태) — "/products/" 앞의 전체
 * 문자열을 취하면 "/en-kr/collections/pepe-shoes/products/handle"처럼 중간에 다른
 * 경로 세그먼트가 낀 실제 URL(컬렉션 경유 상품 링크)에서 "/en-kr/collections/pepe-shoes"를
 * 통째로 잘못 붙잡아 존재하지 않는 경로를 만들고 404가 나는 버그가 있었다(Sprint B-1.5
 * 실측 확인). */
export function extractShopifyLocalePrefix(url: string): string {
  const pathname = new URL(url).pathname;
  const match = /^\/([a-z]{2}-[a-z]{2})\//i.exec(pathname);
  return match ? `/${match[1]}` : "";
}

/** P-4-DATA-6 P0-2(CPO 지시, 2026-08-29: "Shopify locale 가격을 일반 환산가로
 * 혼용하지 않는다") — extractShopifyLocalePrefix()와 짝을 이루는 유일한 "벗기기"
 * 구현. 원래 site-strategies/shopify.site-strategy.ts에만 있었지만(원본 가격
 * 추출용), comparison-search도 실측으로 같은 문제를 겪었다(F5: 실제 저장된
 * sourceUrl은 전부 /en-kr/ 프리픽스가 붙어 있고, 그 로케일로 후보 상세가를
 * 재조회하면 Shopify Markets 자체 환산 KRW가 나와 우리 앱의 Frankfurter 환율과
 * 최대 6% 어긋났다) — 중복 구현 대신 여기로 옮겨 두 호출부가 공유한다. */
export function stripShopifyLocalePrefix(url: string): string {
  const localePrefix = extractShopifyLocalePrefix(url);
  if (!localePrefix) return url;
  const parsed = new URL(url);
  if (parsed.pathname.startsWith(localePrefix)) {
    parsed.pathname = parsed.pathname.slice(localePrefix.length) || "/";
  }
  return parsed.toString();
}

/** Shopify 공개 REST 엔드포인트 — 인증 불필요, 모든 스토어에서 동작한다.
 * .json은 variants[].price_currency까지 포함해서 통화까지 한 번에 확정할 수 있어
 * 1순위로 쓴다(.js는 가격이 센트 단위 정수로만 있고 통화 코드가 없다).
 *
 * 이 함수는 "요청받은 URL 그대로"를 신뢰한다(로케일 프리픽스가 있으면 그 로케일의
 * presentment 가격을 그대로 돌려준다) — shopify-market-probe.ts(N-3.2, 여러
 * market의 실제 표시가를 비교하는 기능)와 comparison-search(해외 가격비교, 같은
 * 로케일끼리 비교)가 의도적으로 이 동작에 의존한다. "원본 가격"(CanonicalProduct
 * 추출) 목적으로 호출하는 곳(shopify.site-strategy.ts)은 호출 전에 로케일
 * 프리픽스를 직접 벗겨서 넘겨야 한다 — 그 이유는 그 파일의 주석 참고
 * (N-3.76 2차, en-kr URL이 실제 통화를 KRW로 잘못 표시한 버그). */
export async function fetchShopifyProductJson(url: string): Promise<ShopifyProductResult | null> {
  const handle = extractShopifyHandle(url);
  if (!handle) return null;
  const origin = new URL(url).origin;
  const localePrefix = extractShopifyLocalePrefix(url);

  // N-4.19(대표님 지시, 2026-08-26: "원본 가격이 £37.00인데 가격도 잘못가져와") —
  // 실측으로 확인(junioredition.com, Booty Ghosts T-Shirt): 로케일 프리픽스가
  // 없는 기본 요청은 Vercel 서버리스 IP가 Shopify에 의해 실제와 다른 국가로
  // 지오로케이션되면(예: US로 추정) 그 국가 통화로 자동환산된 "숫자" 자체가
  // 돌아온다 — `?currency=USD`로 직접 요청하면 63.00 USD가 나오는데, 이게 바로
  // Vercel이 지오프리픽스 없이 요청했을 때 그대로 받던 숫자였다(실제 정가는
  // 37.00 GBP). 기존 코드는 통화 "라벨"만 shopMeta.currency로 강제 교정했지만
  // 숫자 자체는 손대지 않아서, 환산된 숫자에 잘못된 원래 라벨(GBP)을 붙이는
  // 결과가 됐다 — 라벨은 맞는데 값은 틀린, 더 위험한 형태의 오류.
  // `?currency=<매장 기준통화>` 쿼리파라미터는 실측 확인(2026-08-26): 요청자
  // 지오로케이션과 무관하게 그 통화로 고정된 숫자를 돌려준다(`?currency=GBP` →
  // 항상 37.00 GBP). 그래서 shopMeta(기준통화)를 먼저 가져와 쿼리파라미터로
  // 강제한 뒤에만 상품 JSON을 요청한다 — 병렬(Promise.all)에서 순차로 바꾼
  // 이유가 바로 이 순서 의존성이다. 로케일 프리픽스가 있는 요청(/en-kr/ 등)은
  // 이미 그 자체로 지오로케이션 무관하게 고정된 가격을 돌려주는 것으로 실측
  // 확인되어 있어(위 함수 설명 참고) currency 파라미터를 붙이지 않는다.
  const shopMeta = await fetchShopifyShopMeta(origin);
  const shopCurrency = shopMeta?.currency ?? null;
  const currencyParam = !localePrefix && shopCurrency ? `?currency=${shopCurrency}` : "";

  let response: Response;
  try {
    response = await fetchWithDomainRateLimit(
      `${origin}${localePrefix}/products/${handle}.json${currencyParam}`,
      {
        headers: { Accept: "application/json", "User-Agent": CHROME_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let product: ShopifyJsonProduct | undefined;
  try {
    product = ((await response.json()) as { product?: ShopifyJsonProduct }).product;
  } catch {
    return null;
  }
  if (!product) return null;

  const images: ImageCandidate[] = (product.images ?? [])
    .filter((img) => Boolean(img.src))
    .map((img) => ({
      url: toAbsoluteUrl(img.src),
      width: img.width,
      height: img.height,
      source: "shopify" as const,
    }));

  // 로케일 프리픽스가 있는 요청(/en-kr/products/...)은 방문자가 실제로 보는
  // 로케일에 고정된 가격+통화 쌍을 돌려준다(예: 248200 KRW) — 이 경우
  // price_currency를 그대로 믿는다. 로케일이 없는 기본 요청만 shopCurrency
  // 오버라이드를 쓴다(요청 서버 위치에 따라 presentment currency가 흔들리는
  // 문제를 막기 위한 기존 처리, 로케일이 명시된 요청에는 적용 대상이 아니다).
  // N-4.18-Q2 P0-3(대표님 지시: "판매 가능한 variant 우선 → 그 variant의 현재
  // 판매가 사용") — 첫 variant를 무조건 쓰지 않고, 구매 가능한 첫 variant를
  // 우선한다(전부 품절이면 기존처럼 variants[0]로 폴백 — 그래도 가격 자체는
  // 보여줘야 한다).
  const availableVariant = product.variants?.find(isVariantAvailable);
  const variant = availableVariant ?? product.variants?.[0];
  const price =
    variant?.price != null
      ? {
          amount: Number(variant.price),
          currency:
            localePrefix && variant.price_currency
              ? variant.price_currency.toUpperCase()
              : (shopCurrency ?? (variant.price_currency ?? "").toUpperCase()),
        }
      : undefined;
  const regularPrice = variant ? resolveRegularPrice(variant, price?.amount, localePrefix, shopCurrency) : undefined;
  // P-12A(대표님/CPO 지시, 2026-08-31) — "구매 가능 variant가 하나라도 있으면
  // 판매중"(availableVariant가 이미 이 기준으로 골라져 있다, 위 참고). variants가
  // 아예 없으면(이론상 발생 안 하지만) undefined로 남긴다 — "판매중"을 지어내지
  // 않는다.
  const available = product.variants?.length ? availableVariant != null : undefined;

  const optionNames = (product.options ?? []).map((o) => o.name).filter((n): n is string => Boolean(n));
  const optionGroups: CanonicalProductOptionGroup[] = (product.options ?? [])
    .filter((o): o is Required<Pick<ShopifyJsonOption, "name" | "values">> => Boolean(o.name && o.values))
    .map((o) => ({ name: o.name, values: o.values }));
  // 옵션이 하나뿐이고 값도 하나뿐이면(사실상 "옵션 없음"과 같은 Shopify 기본
  // 상태 — 매장이 옵션을 안 쓰면 항상 {name:"Title", values:["Default Title"]}
  // 하나만 온다) variant를 별도로 만들 필요가 없다.
  const hasRealOptions = optionGroups.length > 0 && !(optionGroups.length === 1 && optionGroups[0].values.length === 1);
  const variants: CanonicalProductVariant[] = hasRealOptions
    ? (product.variants ?? [])
        .filter((v) => v.id != null)
        .map((v) => ({
          id: String(v.id),
          optionValues: buildOptionValues(v, optionNames),
          sku: v.sku || undefined,
          skuSource: v.sku ? "ORIGINAL" : undefined,
          price:
            v.price != null
              ? {
                  amount: Number(v.price),
                  currency:
                    localePrefix && v.price_currency
                      ? v.price_currency.toUpperCase()
                      : (shopCurrency ?? (v.price_currency ?? "").toUpperCase()),
                }
              : undefined,
          priceSource: v.price != null ? "ORIGINAL" : undefined,
          // Sprint A-4(CPO 지시: "값이 있으면 어떤 의미인지 명시한다") — Shopify
          // variants[].price는 Shopify 스키마상 항상 그 variant의 절대 판매가다
          // (차액 필드가 아니다). computeVariantFinalPriceKrw의 암묵적 기본값에
          // 기대지 않고 여기서 직접 명시한다.
          priceMode: v.price != null ? "ABSOLUTE" : undefined,
          // inventory_management가 없으면(재고 추적 꺼진 매장) 숫자를 신뢰할 수
          // 없어서 채우지 않는다 — "모른다"를 "0개"로 잘못 전달하지 않기 위함.
          stockQuantity: v.inventory_management ? v.inventory_quantity : undefined,
          stockQuantitySource: v.inventory_management ? "ORIGINAL" : undefined,
          // TODO(P1-6): image_id는 Shopify 내부 이미지 id라 파이프라인이 다운로드 후
          // 새로 부여하는 CanonicalProductImage.id와 다르다 — URL 기준 매칭이
          // 필요하다(canonical-product.ts가 원본 URL을 알고 있을 때만 가능).
          // 지금은 채우지 않는다(빈 값 = "모른다", 지어내지 않는다).
        }))
    : [];

  return {
    images,
    shopMeta,
    productData: {
      title: product.title,
      brand: product.vendor,
      description: product.body_html ? stripHtmlTags(product.body_html) : undefined,
      price,
      regularPrice,
      available,
      options: optionNames,
      optionGroups,
      variants,
      shopifyTags: product.tags,
      shopifyProductType: product.product_type,
    },
  };
}

/** .json이 실패했을 때(커스텀 테마가 응답 스키마를 바꿨거나 일시적 오류인 경우)의
 * 2차 시도. .js는 통화 코드가 없으므로 호출부(shopify.site-strategy.ts)가 필요하면
 * plain HTML fetch로 별도 보강한다. */
export async function fetchShopifyProductJs(url: string): Promise<ShopifyProductResult | null> {
  const handle = extractShopifyHandle(url);
  if (!handle) return null;
  const origin = new URL(url).origin;

  // N-4.19 — .json 경로와 같은 이유(위 fetchShopifyProductJson 주석 참고)로
  // shopMeta를 먼저 가져와 `?currency=` 쿼리파라미터로 강제한다. .js는 통화
  // 코드 필드 자체가 없어서(주석대로) 지오 기반 환산 여부를 사후 검증할 방법이
  // 아예 없다 — 그래서 요청 시점에 확정하는 이 방식이 .json보다 오히려 더
  // 필요하다.
  const shopMeta = await fetchShopifyShopMeta(origin);
  const shopCurrency = shopMeta?.currency ?? null;
  const currencyParam = shopCurrency ? `?currency=${shopCurrency}` : "";

  let response: Response;
  try {
    response = await fetchWithDomainRateLimit(`${origin}/products/${handle}.js${currencyParam}`, {
      headers: { Accept: "application/json", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let product: ShopifyJsProduct;
  try {
    product = (await response.json()) as ShopifyJsProduct;
  } catch {
    return null;
  }

  // media[]가 있으면 width/height가 붙어 있어 images[](문자열 배열, 해상도 정보
  // 없음)보다 낫다 — 있을 때만 우선 사용한다.
  const mediaImages = (product.media ?? []).filter((m) => !m.media_type || m.media_type === "image");
  const images: ImageCandidate[] =
    mediaImages.length > 0
      ? mediaImages
          .filter((m) => Boolean(m.src))
          .map((m) => ({
            url: toAbsoluteUrl(m.src),
            width: m.width,
            height: m.height,
            source: "shopify" as const,
          }))
      : (product.images ?? [])
          .filter(Boolean)
          .map((src) => ({ url: toAbsoluteUrl(src), source: "shopify" as const }));

  const centsAmount = product.variants?.[0]?.price ?? product.price;

  return {
    images,
    shopMeta,
    productData: {
      title: product.title,
      brand: product.vendor,
      description: product.description ? stripHtmlTags(product.description) : undefined,
      price: centsAmount != null ? { amount: centsAmount / 100, currency: shopCurrency ?? "" } : undefined,
      options: (product.options ?? []).map((o) => o.name).filter((n): n is string => Boolean(n)),
    },
  };
}

/** Playwright 없이 plain fetch로만 HTML을 가져온다 — 통화처럼 Shopify JSON에
 * 빠져 있는 필드를 JSON-LD/OpenGraph 메타에서 보강할 때만 쓰는 best-effort 헬퍼다. */
export async function fetchPlainHtml(url: string): Promise<string | null> {
  try {
    const response = await fetchWithDomainRateLimit(url, {
      headers: { "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
