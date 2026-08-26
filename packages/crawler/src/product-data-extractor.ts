import type { Page } from "playwright-core";
import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";
import { resolveSourcePrice, type PriceValidity } from "@commerce/pricing";

export type ProductDataSource = "json-ld" | "microdata" | "open-graph" | "dom" | "shopify-json";

export interface ExtractedProductData {
  title?: string;
  brand?: string;
  price?: { amount: number; currency: string };
  /** N-4.18-Q2 P0-1(대표님 지시, 2026-08-26: "정상가와 할인가를 분리한다") —
   * Shopify variants[].compare_at_price(할인 전 정가)에서만 채워진다(실측
   * 확인: junioredition.com). price보다 클 때만 값이 있다(같거나 작으면
   * "실제 할인 아님"으로 보고 undefined) — 지어내지 않는다. Shopify가 아닌
   * 소스(json-ld/microdata/open-graph/dom)는 정가/할인가 분리 마크업을 아직
   * 실측 확인하지 못해 항상 undefined다. */
  regularPrice?: { amount: number; currency: string };
  /** N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고") — price가
   * undefined인 이유를 구분한다. MISSING은 가격 필드 자체를 못 찾은 경우,
   * INVALID는 가격 텍스트/값은 찾았지만 숫자로 해석 불가하거나 0 이하인
   * 경우다(예: "가격 확인 필요" 같은 텍스트, 또는 price:"0") — 화면이 "원본
   * 가격을 확인할 수 없습니다" 경고를 보여줄 때 이 구분으로 근거를 남긴다.
   * price가 정의돼 있으면 항상 VALID다. */
  priceValidity?: PriceValidity;
  /** priceValidity가 INVALID일 때만 채운다 — 파싱에 실패한 원본 텍스트
   * 그대로(지어내지 않는다, UI가 "이 텍스트를 찾았지만 인식하지 못했습니다"로
   * 보여줄 수 있게). */
  priceRawText?: string;
  sku?: string;
  description?: string;
  /** @deprecated optionGroups[].name으로 대체됐다 — Shopify처럼 값 목록/Variant까지
   * 나오는 소스는 optionGroups/variants를 채운다. 이 필드는 이름만 필요한 기존
   * 코드(검색태그 등) 하위호환용으로 남겨뒀다. */
  options: string[];
  /** Shopify처럼 옵션 값 목록까지 구조화 데이터로 주는 소스에서만 채워진다 —
   * DOM 드롭다운만 있는 사이트는 사이트마다 구조가 너무 달라 이번 범위에서
   * 다루지 않는다(빈 배열). */
  optionGroups?: CanonicalProductOptionGroup[];
  variants?: CanonicalProductVariant[];
  material?: string;
  /** Sprint A-2(Category Resolver 보강) — JSON-LD BreadcrumbList가 있으면
   * ["Home", "Kids", "Shoes", "Sneakers"]처럼 사이트가 자체적으로 분류해둔
   * 카테고리 경로를 그대로 담는다. title/description에 나이·성별 신호가 전혀
   * 없는 상품(예: Veja 스니커즈 — 성인/키즈 라인이 이름만으로 구분 안 됨)도
   * 사이트 자신의 분류(예: "Kids Shoes" 섹션)는 갖고 있는 경우가 많아서,
   * 쿠팡 predict API의 오분류를 잡아내는 추가 신호로 쓴다. */
  breadcrumbPath?: string[];
  /** Sprint A-2.5(Category Resolver 2.0) — schema.org Product.category(있으면).
   * "Apparel > Shoes" 처럼 슬래시/화살표로 구분된 문자열이거나 단일 카테고리명
   * 문자열이다. 사이트가 자체적으로 붙인 값이라 breadcrumbPath와 같은 급의
   * 신호다(둘 다 없는 사이트도 많다). */
  jsonLdCategory?: string;
  /** Sprint A-2.5(Category Resolver 2.0) — Shopify 전용 신호. Shopify 상품은
   * fast-path(shopify-product-json.ts)로 처리되어 breadcrumbPath/jsonLdCategory를
   * 채우는 JSON-LD 파싱을 안 타는 경우가 많다 — vendor 필드에 시즌코드가 들어오는
   * 매장(bobochoses.com 실측: vendor="SS26")도 있어 tags/product_type이 나이·성별·
   * 상품유형을 판단할 유일한 신호가 되는 경우가 있다. Shopify가 아닌 소스는 항상
   * undefined. */
  shopifyTags?: string;
  shopifyProductType?: string;
}

/**
 * N-3.17(CPO 지시: "27.200000 문제") + N-3.54(CPO 지시: "원본 가격을 못
 * 읽었으면 가격을 계산하지 말고, 계산했으면 그 가격의 근거가 무엇인지
 * 보여줘야 한다") — 실제 파싱/반올림/통화 추측/유럽식 콤마 소수점 처리는
 * packages/pricing의 resolveSourcePrice() 하나로 통일한다(크롤러 파싱과
 * canonical-product.ts 조립, PriceEditor.tsx 등록 게이트가 전부 같은 함수를
 * 쓴다 — 여기서만 다른 규칙을 쓰지 않는다). explicitCurrency는 schema.org
 * Offer의 형제 필드(priceCurrency)에서 온 값이다 — price 자체는 "2450"처럼
 * 통화 기호 없는 순수 숫자인 경우가 흔해서, 있으면 이걸 최우선으로 신뢰한다.
 * VALID/INVALID/MISSING 전체 판정을 돌려준다 — extractProductData()가 price
 * 소스 여러 개(json-ld/microdata/open-graph) 중 VALID를 우선하고, 전부
 * 실패하면 INVALID(원문 있음) vs MISSING(원문 자체 없음)을 구분해서 고를 때
 * 쓴다. */
function resolvePriceField(
  raw: unknown,
  explicitCurrency?: string,
): ReturnType<typeof resolveSourcePrice> {
  if (raw != null && typeof raw !== "number" && typeof raw !== "string") {
    return { validity: "MISSING", amount: null, currency: null };
  }
  return resolveSourcePrice(raw as number | string | null | undefined, explicitCurrency);
}

/** JSON-LD Product 노드에서 name/brand/offers/sku/description을 뽑는다.
 * 이미지 추출용 json-ld.strategy.ts와 같은 스크립트 태그를 다시 파싱하지만, 여기서는
 * 이미지가 아니라 상품 정보 필드가 관심사라 별도 파서로 둔다(관심사 분리).
 * shopify.site-strategy.ts가 통화(currency) 보강용으로 재사용하므로 export한다. */
export function extractFromJsonLd(html: string): ExtractedProductData | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let productResult: ExtractedProductData | null = null;
  let breadcrumbPath: string[] | undefined;
  for (const match of html.matchAll(scriptRe)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!productResult) {
        const product = findProductNode(node);
        if (product) {
          const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;
          const offerCurrency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;
          const priceResolution = offers
            ? resolvePriceField(
                offers.price ?? offers.priceSpecification?.price,
                typeof offerCurrency === "string" ? offerCurrency : undefined,
              )
            : { validity: "MISSING" as const, amount: null, currency: null };
          productResult = {
            title: typeof product.name === "string" ? product.name : undefined,
            brand: typeof brand === "string" ? brand : undefined,
            price:
              priceResolution.validity === "VALID"
                ? { amount: priceResolution.amount as number, currency: priceResolution.currency as string }
                : undefined,
            priceValidity: priceResolution.validity,
            priceRawText: priceResolution.rawText,
            sku: typeof product.sku === "string" ? product.sku : undefined,
            description: typeof product.description === "string" ? product.description : undefined,
            options: [],
            material: typeof product.material === "string" ? product.material : undefined,
            jsonLdCategory: typeof product.category === "string" ? product.category : undefined,
          };
        }
      }
      // BreadcrumbList는 보통 Product와 같은 @graph 안에 형제로 있다 — Product를
      // 찾았다고 바로 끝내지 않고 나머지 노드도 계속 훑어서 같이 챙긴다.
      if (!breadcrumbPath) {
        breadcrumbPath = findBreadcrumbPath(node) ?? undefined;
      }
    }
  }
  if (!productResult) return null;
  return breadcrumbPath ? { ...productResult, breadcrumbPath } : productResult;
}

/**
 * SmartStore 플로우 개선 STEP3(CPO 지시 — "ProductGroup/hasVariant 구조를 옵션
 * extractor가 놓치고 있지 않은지 확인") — findProductNode()는 ProductGroup을
 * 찾으면 offers가 있는 variant 하나만 뽑아 가격 계산에만 썼다(N-3.54).
 * hasVariant[] 안의 나머지 variant들(색상/사이즈별 개별 Product, 각자
 * color/size/offers를 가짐)은 그동안 완전히 버려졌다 — 옵션이 실제로 여러
 * 개인 상품(예: Smallable의 색상+사이즈 조합)에서 optionGroups/variants가
 * 항상 비어 있던 근본 원인이다. 여기서는 하나만 고르지 않고 hasVariant
 * 전체를 순회해서 실제 옵션축(색상/사이즈)과 조합별 실제 가격/SKU/재고를
 * 그대로 옮긴다 — 축 이름이 없는 값은 절대 지어내지 않는다(값이 없으면
 * 그 축 자체를 만들지 않는다).
 */
function findProductGroupNode(node: unknown): Record<string, any> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, any>;
  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) {
      const found = findProductGroupNode(child);
      if (found) return found;
    }
    return null;
  }
  const type = obj["@type"];
  const isProductGroup = type === "ProductGroup" || (Array.isArray(type) && type.includes("ProductGroup"));
  if (isProductGroup && Array.isArray(obj.hasVariant)) return obj;
  return null;
}

/** additionalProperty는 schema.org의 PropertyValue[] 형태(name/value)로 색상/
 * 사이즈 외 임의 축을 표현하는 표준 방식이다 — 사이트가 실제로 이 형식을 쓸
 * 때만 읽는다(형식이 다르면 그 축은 그냥 비운다, 추측하지 않는다). */
function readAdditionalProperties(obj: Record<string, any>): Record<string, string> {
  const result: Record<string, string> = {};
  const props = Array.isArray(obj.additionalProperty) ? obj.additionalProperty : [];
  for (const p of props) {
    const name = typeof p?.name === "string" ? p.name.trim() : "";
    const value = typeof p?.value === "string" ? p.value.trim() : typeof p?.value === "number" ? String(p.value) : "";
    if (name && value) result[name] = value;
  }
  return result;
}

export function extractProductGroupOptions(
  html: string,
): { optionGroups: CanonicalProductOptionGroup[]; variants: CanonicalProductVariant[] } | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let groupNode: Record<string, any> | null = null;
  for (const match of html.matchAll(scriptRe)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      groupNode = findProductGroupNode(node);
      if (groupNode) break;
    }
    if (groupNode) break;
  }
  if (!groupNode) return null;

  // 각 variant Product에서 축(color/size/additionalProperty)을 그대로 읽는다 —
  // 값을 정규화/추론하지 않고 원문 그대로 보존한다.
  type RawVariant = { axes: Record<string, string>; sku?: string; price?: { amount: number; currency: string }; availability?: string };
  const rawVariants: RawVariant[] = [];
  for (const variant of groupNode.hasVariant) {
    if (!variant || typeof variant !== "object") continue;
    const v = variant as Record<string, any>;
    const axes: Record<string, string> = {};
    if (typeof v.color === "string" && v.color.trim()) axes["Color"] = v.color.trim();
    if (typeof v.size === "string" && v.size.trim()) axes["Size"] = v.size.trim();
    Object.assign(axes, readAdditionalProperties(v));
    if (Object.keys(axes).length === 0) continue; // 축을 하나도 못 찾으면 이 variant는 옵션 조합에 못 쓴다 — 건너뛴다(지어내지 않는다).

    const offers = Array.isArray(v.offers) ? v.offers[0] : v.offers;
    const offerCurrency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;
    const priceResolution = offers
      ? resolvePriceField(offers.price ?? offers.priceSpecification?.price, typeof offerCurrency === "string" ? offerCurrency : undefined)
      : null;
    const availabilityRaw = typeof offers?.availability === "string" ? offers.availability : undefined;
    // "https://schema.org/InStock" → "InStock" (원문 마지막 세그먼트만, 지어내지 않는다).
    const availability = availabilityRaw ? availabilityRaw.split("/").pop() : undefined;

    rawVariants.push({
      axes,
      sku: typeof v.sku === "string" ? v.sku : undefined,
      price: priceResolution?.validity === "VALID" ? { amount: priceResolution.amount as number, currency: priceResolution.currency as string } : undefined,
      availability,
    });
  }
  if (rawVariants.length === 0) return null;

  // 축 이름별로 실제 등장한 값만 순서대로 모은다(중복 제거) — 등장하지 않은
  // 조합을 채워넣지 않는다.
  const axisNames: string[] = [];
  const axisValues = new Map<string, string[]>();
  for (const rv of rawVariants) {
    for (const [axisName, value] of Object.entries(rv.axes)) {
      if (!axisValues.has(axisName)) {
        axisValues.set(axisName, []);
        axisNames.push(axisName);
      }
      const values = axisValues.get(axisName)!;
      if (!values.includes(value)) values.push(value);
    }
  }
  const optionGroups: CanonicalProductOptionGroup[] = axisNames.map((name) => ({
    name,
    values: axisValues.get(name)!,
  }));

  const variants: CanonicalProductVariant[] = rawVariants.map((rv, i) => ({
    id: `variant-${i}`,
    optionValues: rv.axes,
    sku: rv.sku,
    price: rv.price,
    // Sprint A-4(CPO 지시: "값이 있으면 어떤 의미인지 명시한다") — 여기서
    // 읽는 offers.price는 schema.org 표준상 항상 그 variant의 절대 판매가다
    // (기본가 대비 차액을 표현하는 필드가 아니다). computeVariantFinalPriceKrw의
    // `mode ?? "ABSOLUTE"` 기본값에 암묵적으로 기대지 않고 이 추출 지점에서
    // 직접 명시한다.
    priceMode: rv.price ? "ABSOLUTE" : undefined,
    stockQuantity: rv.availability === "InStock" ? undefined : rv.availability === "OutOfStock" ? 0 : undefined,
    skuSource: rv.sku ? "ORIGINAL" : undefined,
    priceSource: rv.price ? "ORIGINAL" : undefined,
  }));

  return { optionGroups, variants };
}

function findProductNode(node: unknown): Record<string, any> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, any>;
  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) {
      const found = findProductNode(child);
      if (found) return found;
    }
    return null;
  }
  const type = obj["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
  if (isProduct) return obj;
  // N-3.54 STEP1(CPO 지시, 실측: Smallable) — 다색상/다변형 상품은 최상위
  // JSON-LD 노드가 schema.org 표준 패턴대로 ProductGroup이고, 실제 가격은
  // 그 노드 자체가 아니라 hasVariant[] 안의 개별 Product(각자 offers를
  // 가짐)에 있다. 지금까지 이 함수가 ProductGroup을 전혀 인식하지 못해
  // extractFromJsonLd()가 페이지 전체에서 null을 반환했다 — "가격이
  // 0.00"이 아니라 "JSON-LD를 아예 못 읽었다"가 진짜 원인이었다. offers가
  // 있는(=실제 가격 정보가 있는) variant를 우선하고, 없으면 이름/설명이라도
  // 쓸 수 있게 첫 Product 후보로 폴백한다.
  const isProductGroup = type === "ProductGroup" || (Array.isArray(type) && type.includes("ProductGroup"));
  if (isProductGroup && Array.isArray(obj.hasVariant)) {
    let fallback: Record<string, any> | null = null;
    for (const variant of obj.hasVariant) {
      const found = findProductNode(variant);
      if (!found) continue;
      if (found.offers) return found;
      if (!fallback) fallback = found;
    }
    if (fallback) return fallback;
  }
  return null;
}

/** schema.org BreadcrumbList — itemListElement를 position 순으로 정렬해서
 * 이름만 뽑는다("item": {"name": ...}} 형태와 바로 "name" 형태 둘 다 흔하다). */
function findBreadcrumbPath(node: unknown): string[] | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, any>;
  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) {
      const found = findBreadcrumbPath(child);
      if (found) return found;
    }
    return null;
  }
  const type = obj["@type"];
  const isBreadcrumb = type === "BreadcrumbList" || (Array.isArray(type) && type.includes("BreadcrumbList"));
  if (!isBreadcrumb || !Array.isArray(obj.itemListElement)) return null;
  const items = [...obj.itemListElement]
    .sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((item: any) => {
      const name = item?.name ?? item?.item?.name;
      return typeof name === "string" ? name.trim() : undefined;
    })
    .filter((name): name is string => !!name);
  return items.length > 0 ? items : null;
}

/** OpenGraph 메타 태그 — JSON-LD가 없거나 일부 필드가 비어 있을 때 보강용으로 쓴다.
 * shopify.site-strategy.ts가 통화(currency) 보강용으로 재사용하므로 export한다. */
export function extractFromOpenGraph(html: string): Partial<ExtractedProductData> {
  const get = (property: string): string | undefined => {
    const re = new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    return re.exec(html)?.[1];
  };
  const title = get("og:title");
  const description = get("og:description");
  const priceAmount = get("product:price:amount") ?? get("og:price:amount");
  const priceCurrency = get("product:price:currency") ?? get("og:price:currency");
  const brand = get("product:brand") ?? get("og:brand");

  const priceResolution = resolvePriceField(priceAmount, priceCurrency);

  return {
    title,
    description,
    brand,
    price: priceResolution.validity === "VALID" ? { amount: priceResolution.amount as number, currency: priceResolution.currency as string } : undefined,
    priceValidity: priceAmount != null ? priceResolution.validity : undefined,
    priceRawText: priceResolution.rawText,
  };
}

/**
 * schema.org Microdata(itemprop 속성) — JSON-LD가 없는 사이트에서 흔히 이 방식으로
 * 구조화 데이터를 노출한다(PrestaShop 계열이 대표적: LillaMode/LojaDada 등 이미
 * 검증된 사이트도 실제로 이 형식을 쓴다 — JSON-LD가 아예 없고 OpenGraph에도 가격이
 * 없어서, 개선 전에는 price가 항상 0으로 빠졌다). price/priceCurrency는 반드시
 * itemprop="offers" 범위 안에서 우선 찾는다 — 그래야 같은 페이지의 관련상품 가격과
 * 섞이지 않는다.
 */
async function extractFromMicrodata(page: Page): Promise<Partial<ExtractedProductData>> {
  const raw = await page.evaluate(() => {
    const text = (el: Element | null | undefined) => el?.textContent?.trim() || undefined;
    const attr = (el: Element | null | undefined, name: string) =>
      el?.getAttribute(name)?.trim() || undefined;

    const offerScope = document.querySelector('[itemprop="offers"]');
    const priceEl =
      offerScope?.querySelector('[itemprop="price"]') ?? document.querySelector('[itemprop="price"]');
    const currencyEl =
      offerScope?.querySelector('[itemprop="priceCurrency"]') ??
      document.querySelector('[itemprop="priceCurrency"]');
    const nameEl = document.querySelector('[itemprop="name"]');
    const brandEl = document.querySelector('[itemprop="brand"]');
    const skuEl = document.querySelector('[itemprop="sku"]');

    return {
      title: text(nameEl),
      brand: attr(brandEl, "content") || text(brandEl),
      priceRaw: attr(priceEl, "content") || text(priceEl),
      currency: attr(currencyEl, "content") || text(currencyEl),
      sku: attr(skuEl, "content") || text(skuEl),
    };
  });

  const priceResolution = raw.priceRaw
    ? resolvePriceField(raw.priceRaw, raw.currency)
    : ({ validity: "MISSING" as const, amount: null, currency: null });

  return {
    title: raw.title,
    brand: raw.brand,
    sku: raw.sku,
    price: priceResolution.validity === "VALID" ? { amount: priceResolution.amount as number, currency: priceResolution.currency as string } : undefined,
    priceValidity: raw.priceRaw ? priceResolution.validity : undefined,
    priceRawText: priceResolution.rawText,
  };
}

/** <title>/<h1> 같은 아주 기본적인 DOM 요소 — 구조화 데이터가 전혀 없는 사이트를 위한
 * 최후의 보루. 신뢰도가 가장 낮으므로(Confidence 계산에서 낮게 잡는다) 다른 소스가
 * 있으면 절대 우선순위를 뺏지 않는다. */
async function extractFromDom(page: Page): Promise<Partial<ExtractedProductData>> {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.trim();
    const title = h1 || document.title.trim();
    return { title: title || undefined };
  });
}

/** Sprint A-9(작업3 — CEO 실측: "Size 2-3 Years/3-5 Years/5-7 Years가 실제
 * 상세페이지에 있는데 옵션이 비어있다") — 이 파일 상단 주석에 "DOM 드롭다운만
 * 있는 사이트는 이번 범위에서 다루지 않는다"고 명시돼 있었는데, 실제로는
 * Shopify(shopify-product-json.ts)가 아닌 사이트는 옵션 추출 경로 자체가
 * 없었다(구조화 데이터에 옵션값 목록이 있는 경우가 거의 없어서). `<select>`
 * 드롭다운은 대부분의 비-Shopify 쇼핑몰(WooCommerce/Cafe24/PrestaShop 등)이
 * 실제로 쓰는 표준 HTML 폼 컨트롤이라, 여기서부터 좁게 시작한다 — "사이즈"류
 * 키워드로 이름이 명확한 select만 채택해서, 언어선택/정렬옵션 같은 무관한
 * select를 옵션으로 잘못 채우는 오탐을 막는다. */
async function extractOptionsFromDom(page: Page): Promise<CanonicalProductOptionGroup[]> {
  return page.evaluate(() => {
    // SmartStore 플로우 개선 STEP3(CPO 지시 — "Color 옵션도 원인 조사에 포함")
    // 실측 확인: 이 함수는 "사이즈"류 키워드만 인식했고 색상 select는 전혀
    // 잡히지 않았다(COLOR_KEYWORD_PATTERN 자체가 없었다) — Color 단일 축
    // 상품에서 옵션이 통째로 비어있던 근본 원인 중 하나다.
    const AXIS_PATTERNS: { name: string; pattern: RegExp }[] = [
      { name: "사이즈", pattern: /size|사이즈|taille|größe|grösse|misura|maat|talla|tamanho/i },
      { name: "색상", pattern: /colou?r|색상|couleur|farbe|colore|kleur|色/i },
    ];
    const PLACEHOLDER_PATTERN = /^(select|choose|please|선택|고르|--|—|-)/i;
    // 실측(lojadada.com "8-9Y - Sold Out"): 재고 상태 표시가 select option 텍스트에
    // 그대로 붙어나오는 사이트가 있다 — 사이즈 값 자체("8-9Y")는 진짜 원문이니
    // 지어내는 게 아니라, 뒤에 붙은 재고 상태 문구만 걷어내는 정제(trim)다.
    const SOLD_OUT_SUFFIX_PATTERN = /\s*[-–(]\s*(sold\s*out|out\s*of\s*stock|품절|매진)\s*\)?\s*$/i;

    function labelFor(select: HTMLSelectElement): string {
      if (select.id) {
        const byFor = document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
        if (byFor?.textContent?.trim()) return byFor.textContent.trim();
      }
      const wrappingLabel = select.closest("label");
      if (wrappingLabel?.textContent?.trim()) return wrappingLabel.textContent.trim();
      const prevLabel = select.previousElementSibling;
      if (prevLabel?.tagName === "LABEL" && prevLabel.textContent?.trim()) {
        return prevLabel.textContent.trim();
      }
      return [select.name, select.id, select.getAttribute("aria-label")].filter(Boolean).join(" ");
    }

    const groups: { name: string; values: string[] }[] = [];
    document.querySelectorAll("select").forEach((select) => {
      const label = labelFor(select);
      const axis = AXIS_PATTERNS.find((a) => a.pattern.test(label));
      if (!axis) return;
      if (groups.some((g) => g.name === axis.name)) return; // 같은 축을 두 번 채택하지 않는다(중복 select 방지).
      const values = Array.from(select.querySelectorAll("option"))
        .map((opt) => (opt.textContent?.trim() ?? "").replace(SOLD_OUT_SUFFIX_PATTERN, "").trim())
        .filter((v) => v.length > 0 && !PLACEHOLDER_PATTERN.test(v));
      // 값이 하나도 안 남거나 딱 1개뿐이면(선택지가 아니라 사실상 고정값) 굳이
      // "옵션"으로 만들 필요가 없다 — 진짜 여러 값 중 고르는 select만 채택한다.
      if (values.length < 2) return;
      groups.push({ name: axis.name, values });
    });
    return groups;
  });
}

/** Sprint A-10(작업3 — CEO 실측: "본문에 2-3 Years/3-5 Years/5-7 Years, Dress
 * length 53cm/56cm 전부 있는데 옵션이 비어있다") — A-9의 extractOptionsFromDom은
 * `<select>` 드롭다운만 본다. 이 값들이 select가 아니라 상세설명 본문에 그냥
 * 텍스트로 나열된 사이트도 있어서, select 스캔이 아무것도 못 찾았을 때만
 * (폴백 — DOM select가 더 구조화된 신호라 항상 우선) 상세 영역 텍스트에서 같은
 * 패턴을 정규식으로 찾는다. 없는 값을 추론하지 않는다 — 실제 본문 문자열만
 * 그대로 추출하고, 애매하면(패턴이 1개만 매칭되면) 채택하지 않는다. */
async function extractOptionsFromDescriptionText(page: Page): Promise<CanonicalProductOptionGroup[]> {
  return page.evaluate(() => {
    const DETAIL_SELECTOR =
      '[class*="description" i], [class*="detail" i], [id*="description" i], [id*="detail" i], [class*="product-info" i], [class*="product-details" i]';
    const seenText = new Set<string>();
    const chunks: string[] = [];
    document.querySelectorAll(DETAIL_SELECTOR).forEach((el) => {
      const t = (el as HTMLElement).innerText?.trim();
      if (t && !seenText.has(t)) {
        seenText.add(t);
        chunks.push(t);
      }
    });
    const text = chunks.join("\n");
    if (!text) return [];

    const groups: { name: string; values: string[] }[] = [];

    // "2-3 Years", "3-5 Years", "6-12 Months" 류 나이/사이즈 범위 나열.
    const AGE_RANGE_PATTERN = /\b\d{1,2}\s*[-–]\s*\d{1,2}\s*(?:years?|yrs?|months?|mo)\b/gi;
    const ageMatches = Array.from(new Set((text.match(AGE_RANGE_PATTERN) ?? []).map((m) => m.trim())));
    if (ageMatches.length >= 2) {
      groups.push({ name: "사이즈", values: ageMatches });
    }

    // "Dress length: 53cm/56cm", "Waist - 30cm, 32cm" 류 "라벨: 값(cm) 목록" —
    // 옵션값별 상세 스펙(CEO 지시: "옵션별 상세정보도 함께 매핑").
    const SPEC_LINE_PATTERN = /([A-Za-z][A-Za-z ]{2,24}?)\s*[:\-]\s*((?:\d+(?:\.\d+)?\s*cm\s*[/,]?\s*){2,})/gi;
    let specMatch: RegExpExecArray | null;
    while ((specMatch = SPEC_LINE_PATTERN.exec(text)) != null) {
      const label = specMatch[1].trim();
      const values = specMatch[2]
        .split(/[/,]/)
        .map((v) => v.trim())
        .filter((v) => /^\d+(\.\d+)?\s*cm$/.test(v));
      if (values.length >= 2 && !groups.some((g) => g.name.toLowerCase() === label.toLowerCase())) {
        groups.push({ name: label, values });
      }
    }

    return groups;
  });
}

/** JSON-LD → Microdata → OpenGraph → DOM 순으로 시도하고, 필드 단위로 부족한 부분을
 * 다음 소스로 보강한다(예: JSON-LD에 title은 있는데 price가 없으면 Microdata의
 * price로 채운다). Microdata를 OpenGraph보다 앞에 두는 이유: 둘 다 "구조화 데이터"로
 * 신뢰도가 비슷하지만, 실제로 많은 사이트가 og:price를 아예 안 넣는 반면 상품
 * 페이지의 itemprop="offers"는 결제 흐름에 실제로 쓰이는 값이라 더 정확하다. */
export async function extractProductData(
  html: string,
  page: Page,
): Promise<{
  data: ExtractedProductData;
  sources: Record<string, ProductDataSource>;
}> {
  const jsonLd = extractFromJsonLd(html);
  const microdata = await extractFromMicrodata(page);
  const og = extractFromOpenGraph(html);
  const dom = await extractFromDom(page);
  // SmartStore 플로우 개선 STEP3 — ProductGroup/hasVariant가 있으면 조합별
  // 실제 색상/사이즈/가격/SKU까지 나온다(DOM select 스캔보다 훨씬 정확한
  // 소스라 있으면 최우선). 없으면 기존 DOM select → 본문 텍스트 순으로
  // 폴백한다(회귀 없음, 우선순위만 추가).
  const productGroupOptions = extractProductGroupOptions(html);
  const domOptionGroups = productGroupOptions ? [] : await extractOptionsFromDom(page);
  const textOptionGroups = domOptionGroups.length === 0 && !productGroupOptions ? await extractOptionsFromDescriptionText(page) : [];
  const resolvedOptionGroups = productGroupOptions?.optionGroups ?? (domOptionGroups.length > 0 ? domOptionGroups : textOptionGroups);

  const sources: Record<string, ProductDataSource> = {};
  const pick = <K extends keyof ExtractedProductData>(
    field: K,
  ): ExtractedProductData[K] | undefined => {
    if (jsonLd?.[field] != null) {
      sources[field as string] = "json-ld";
      return jsonLd[field];
    }
    if (microdata[field] != null) {
      sources[field as string] = "microdata";
      return microdata[field] as ExtractedProductData[K];
    }
    if (og[field] != null) {
      sources[field as string] = "open-graph";
      return og[field] as ExtractedProductData[K];
    }
    if (dom[field] != null) {
      sources[field as string] = "dom";
      return dom[field] as ExtractedProductData[K];
    }
    return undefined;
  };

  // N-3.54(CPO 지시) — price는 일반 pick()과 다른 규칙이 필요하다: 소스가
  // "값 없음"(undefined)이 아니라 "값은 찾았는데 파싱 실패"(priceValidity:
  // INVALID)일 수도 있기 때문이다. json-ld → microdata → open-graph 순으로
  // VALID를 우선 채택하고, VALID가 하나도 없으면 원문이라도 있는 첫 INVALID를
  // 채택해(UI에 원문을 보여주기 위해) MISSING과 구분한다.
  const priceCandidates: Array<{
    source: ProductDataSource;
    price?: { amount: number; currency: string };
    priceValidity?: PriceValidity;
    priceRawText?: string;
  }> = [
    { source: "json-ld", price: jsonLd?.price, priceValidity: jsonLd?.priceValidity, priceRawText: jsonLd?.priceRawText },
    { source: "microdata", price: microdata.price, priceValidity: microdata.priceValidity, priceRawText: microdata.priceRawText },
    { source: "open-graph", price: og.price, priceValidity: og.priceValidity, priceRawText: og.priceRawText },
  ];
  const validPriceCandidate = priceCandidates.find((c) => c.price != null);
  const invalidPriceCandidate = priceCandidates.find((c) => c.priceValidity === "INVALID");
  if (validPriceCandidate) sources.price = validPriceCandidate.source;
  else if (invalidPriceCandidate) sources.price = invalidPriceCandidate.source;

  const data: ExtractedProductData = {
    title: pick("title"),
    brand: pick("brand"),
    price: validPriceCandidate?.price,
    priceValidity: validPriceCandidate ? "VALID" : invalidPriceCandidate ? "INVALID" : "MISSING",
    priceRawText: validPriceCandidate ? undefined : invalidPriceCandidate?.priceRawText,
    sku: pick("sku"),
    description: pick("description"),
    material: pick("material"),
    options: jsonLd?.options ?? [],
    // Sprint A-9(작업3) — Shopify가 아닌 사이트는 이 DOM select 스캔이 우선
    // 옵션 소스다. jsonLd?.optionGroups는 이 함수 안에서 절대 채워지지 않으므로
    // (extractFromJsonLd가 options:[]만 세팅) domOptionGroups를 우선 쓴다.
    // Sprint A-10(작업3) — select가 없으면 상세설명 본문 텍스트 스캔(textOptionGroups)으로
    // 폴백한다.
    optionGroups: resolvedOptionGroups,
    // SmartStore 플로우 개선 STEP3 — DOM select 스캔은 이름/값만 알 뿐 조합별
    // 가격/SKU는 절대 모른다(그런 정보가 select 옵션 텍스트에 없다) — variants는
    // ProductGroup/hasVariant처럼 실제 조합별 데이터가 있을 때만 채운다. 없으면
    // 빈 배열로 둔다(CanonicalProductVariant 주석의 "옵션은 있는데 조합 정보를
    // 못 가져옴" 상태 — 임의로 만들어내지 않는다).
    variants: productGroupOptions?.variants ?? [],
    breadcrumbPath: jsonLd?.breadcrumbPath,
    jsonLdCategory: jsonLd?.jsonLdCategory,
  };
  if (resolvedOptionGroups.length > 0) sources.optionGroups = productGroupOptions ? "json-ld" : "dom";

  return { data, sources };
}
