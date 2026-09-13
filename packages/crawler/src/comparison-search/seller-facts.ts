/**
 * MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 판매처가 실제로 내려주는 응답을
 * ProductFacts로 옮기는 어댑터.
 *
 * 왜 판매처별 어댑터가 필요한가: 같은 사실이 사이트마다 다른 칸에 들어 있다.
 * 색상은 Smallable에서는 JSON-LD `color`이고 Bobo 공식몰에서는 설명문 첫 문장이다
 * ("Light heather grey sweatshirt."). 대상 연령은 Smallable에서는 breadcrumb이고
 * Bobo에서는 상품 태그다. 이 차이를 판정기(cross-seller.ts) 안에 넣으면 판정
 * 규칙이 사이트 수만큼 갈라진다 — 그래서 차이는 전부 여기서 흡수하고, 판정기는
 * 사이트를 모른다.
 *
 * 값을 지어내지 않는다는 규칙은 여기서도 같다. 원문에서 못 읽은 칸은 null이다.
 */
import {
  buildCoreTitleTokens,
  extractCodeLikeSlugSegment,
  extractFitPhrase,
  extractLabeledProductCode,
  extractLeadingColorPhrase,
  extractUrlSlug,
  parseMaterialComposition,
  type ProductFacts,
} from "@commerce/shared";
import { extractColor, extractColorFromTitle } from "../description-facts";

/** HTML 태그를 걷어내고 공백을 정리한다. Shopify description/Smallable
 * longDescription 둘 다 HTML 조각으로 온다(실측). */
function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coreTokens(title: string, brand: string | null, color: string | null, material: string | null): string[] {
  const fabrics = parseMaterialComposition(material).map((c) => c.fabric).join(" ");
  return buildCoreTitleTokens(title, [brand, color, fabrics]);
}

/**
 * 브랜드 공식몰은 상품마다 브랜드명을 적지 않는다 — 가게 전체가 그 브랜드이기
 * 때문이다(실측: bobochoses.com의 `vendor` 필드에는 브랜드가 아니라 시즌코드
 * "AW26"이 들어 있고, 상품 title에도 브랜드가 없는 상품이 많다). 그래서 "이
 * 도메인은 이 브랜드의 공식몰"이라는 사실만 여기에 둔다. 추측이 아니라 관측된
 * 사실이고, 목록에 없는 도메인은 아무 브랜드도 부여하지 않는다.
 */
const OFFICIAL_STORE_BRANDS: Record<string, string> = {
  "bobochoses.com": "Bobo Choses",
};

const SEASON_CODE_ONLY_RE = /^(ss|aw|fw|pe)\d{2}$/i;

/* ───────────────────────── Shopify(브랜드 공식몰/편집샵) ───────────────────────── */

/** `/search/suggest.json`의 product 항목과 `/products/{handle}.js` 응답이 공유하는
 * 부분집합. 둘 다 실제로 이 칸들을 준다(실측) — 어느 쪽이 오든 같은 어댑터로
 * 처리하려고 optional로 둔다. */
export interface ShopifyProductLike {
  title?: string;
  handle?: string;
  url?: string;
  /** `/products/*.js`는 description, `suggest.json`은 body에 같은 HTML을 준다. */
  description?: string;
  body?: string;
  vendor?: string;
  type?: string;
  tags?: string[] | string;
  options?: { name?: string; values?: string[] }[];
  images?: string[];
  featured_image?: { url?: string } | string | null;
  image?: string | null;
}

function shopifyTags(input: ShopifyProductLike): string[] {
  if (Array.isArray(input.tags)) return input.tags;
  if (typeof input.tags === "string") return input.tags.split(/[,;]/);
  return [];
}

function shopifyImages(input: ShopifyProductLike): string[] {
  const out: string[] = [];
  for (const image of input.images ?? []) {
    if (typeof image === "string") out.push(image.startsWith("//") ? `https:${image}` : image);
  }
  const featured =
    typeof input.featured_image === "string"
      ? input.featured_image
      : (input.featured_image?.url ?? input.image ?? null);
  if (featured) out.unshift(featured.startsWith("//") ? `https:${featured}` : featured);
  return [...new Set(out)];
}

function shopifySizeLabels(input: ShopifyProductLike): string[] {
  const group = (input.options ?? []).find((o) => /size|사이즈|치수/i.test(o.name ?? ""));
  return group?.values ?? [];
}

export function productFactsFromShopifyProduct(input: ShopifyProductLike, domain: string): ProductFacts {
  const title = input.title ?? "";
  const description = plainText(input.description ?? input.body);
  const url = input.url?.startsWith("http")
    ? input.url
    : `https://${domain}${input.url ?? (input.handle ? `/products/${input.handle}` : "")}`;
  const slug = input.handle ? input.handle.toLowerCase() : extractUrlSlug(url);

  // vendor가 시즌코드인 스토어가 실제로 있다(bobochoses.com). 시즌코드를 브랜드로
  // 쓰면 "AW26 ↔ Bobo Choses" 브랜드 불일치가 되어 진짜 동일상품이 깎인다.
  const vendor = input.vendor?.trim();
  const brand =
    vendor && !SEASON_CODE_ONLY_RE.test(vendor) ? vendor : (OFFICIAL_STORE_BRANDS[domain] ?? null);

  // 색상은 설명문 첫 문장에 그대로 나온다(실측: "Light heather grey sweatshirt.").
  // 수식어가 둘 붙는 표기까지 읽는 extractLeadingColorPhrase를 먼저 쓰고, 그래도
  // 없으면 기존 추출기(라벨형 "Colour - Green" / 제목 안 색 단어)로 내려간다.
  const color =
    extractLeadingColorPhrase(description) ?? extractColor(description) ?? extractColorFromTitle(title) ?? null;
  const material = parseMaterialComposition(description).length > 0 ? description : null;

  return {
    sourceUrl: url,
    urlSlug: slug,
    brand,
    // 브랜드 품번은 설명문 라벨 → URL 앞머리 순으로만 읽는다. 실측상 Bobo 공식몰
    // suggest 응답 본문에는 품번이 없고 handle에만 있다(`b226ac114-…`).
    brandModelCode: extractLabeledProductCode(description) ?? extractCodeLikeSlugSegment(slug),
    sellerSku: null,
    title,
    coreTitleTokens: coreTokens(title, brand, color, material),
    categoryText: input.type?.trim() || null,
    colorText: color,
    materialText: material,
    fitText: extractFitPhrase(description),
    ageRangeText: null,
    sizeLabels: shopifySizeLabels(input),
    audienceSignals: [...shopifyTags(input), ...(input.type ? [input.type] : [])],
    imageUrls: shopifyImages(input),
  };
}

/* ───────────────────────────────── Smallable ───────────────────────────────── */

/**
 * smallable.com 상품 페이지에서 사실을 읽는다.
 *
 * 가격 관측기(smallable-market-probe.ts)와 목적이 다르다 — 저쪽은 "요청한 배송
 * 국가의 금액"만 보고, 여기는 "이 상품이 무엇인가"를 본다. 두 관심사를 한 파서에
 * 합치면 한쪽 사정으로 다른 쪽이 깨진다.
 *
 * 읽는 자리(전부 실측 확인, 2026-09-13):
 *  · JSON-LD Product — name / description / brand.name / model / sku / color
 *  · JSON-LD BreadcrumbList — "Fashion  Children" / "Boy" / "Sweatshirts"
 *    (대상 연령과 상품군이 여기 있다. 제목에는 없다.)
 *  · 페이지에 내장된 declinations 배열 — `{"sku":"AAA1804922","size":"4/5 years"}`
 *    (사이즈 체계를 아는 유일한 자리다.)
 */
const LD_JSON_SCRIPT_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const DECLINATIONS_BLOCK_RE = /declinations\\?":\s*\[([\s\S]*?)\]/;
const DECLINATION_SIZE_RE = /size\\?":\\?"([^"\\]{1,24})/g;

function parseLdJsonNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  for (const match of html.matchAll(LD_JSON_SCRIPT_RE)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
        if (node && typeof node === "object") nodes.push(node as Record<string, unknown>);
      }
    } catch {
      // 깨진 블록 하나 때문에 나머지를 버리지 않는다(market-probe와 같은 원칙).
    }
  }
  return nodes;
}

function hasType(node: Record<string, unknown>, type: string): boolean {
  const value = node["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/**
 * Product 노드는 최상위에 있을 때도 있고 ProductGroup 안에 들어 있을 때도 있다 —
 * 같은 사이트에서 둘 다 실제로 관측된다(실측: 색상 변형이 있는 상품은
 * `ProductGroup.hasVariant[]`, 변형이 없으면 최상위 `Product`). 최상위만 보면
 * 색상 변형이 있는 상품은 통째로 "읽을 게 없음"이 되고, 그게 시장 관측기가
 * 이미 겪어서 collectProductNodes로 고쳐 둔 문제다. 같은 방식으로 훑는다.
 */
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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function extractSmallableSizeLabels(html: string): string[] {
  const block = DECLINATIONS_BLOCK_RE.exec(html);
  if (!block) return [];
  const sizes = [...block[1].matchAll(DECLINATION_SIZE_RE)].map((m) => m[1]);
  return [...new Set(sizes)];
}

/** breadcrumb의 마지막 항목은 상품명 자체다(실측) — 상품명은 이미 title로 세고
 * 있으므로 카테고리 신호에서는 뺀다. */
export function extractSmallableBreadcrumb(html: string): string[] {
  for (const node of parseLdJsonNodes(html)) {
    if (!hasType(node, "BreadcrumbList")) continue;
    const items = node.itemListElement;
    if (!Array.isArray(items)) continue;
    const names = items
      .map((item) => readString((item as Record<string, unknown>)?.name))
      .filter((name): name is string => name !== null);
    return names.slice(0, Math.max(0, names.length - 1));
  }
  return [];
}

/**
 * productId를 주면 **그 상품의** 노드만 읽는다. smallable 페이지에는 형제 색상
 * 변형이 같이 실려 있어서(실측: 430651 페이지에 430650 링크가 함께 있다) 아무
 * Product 노드나 집으면 다른 색의 사실을 이 상품의 사실로 적게 된다. 시장
 * 관측기가 이미 같은 이유로 model 대조를 하고 있고, 같은 근거를 여기서도 쓴다.
 */
export function productFactsFromSmallableHtml(html: string, productId?: string): ProductFacts | null {
  const products = parseLdJsonNodes(html).flatMap((node) => collectProductNodes(node));
  const product = productId
    ? products.find((node) => String(node.model ?? "").trim() === productId)
    : products.find((node) => node.offers !== undefined);
  if (!product) return null;

  const title = readString(product.name) ?? "";
  const description = plainText(readString(product.description));
  const brand = readString((product.brand as Record<string, unknown>)?.name);
  const offers = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as
    | Record<string, unknown>
    | undefined;
  const sourceUrl = readString(offers?.url) ?? "";
  const color = readString(product.color);
  const material = parseMaterialComposition(description).length > 0 ? description : null;
  const breadcrumb = extractSmallableBreadcrumb(html);

  return {
    sourceUrl,
    urlSlug: extractUrlSlug(sourceUrl),
    brand,
    // Smallable 페이지 어디에도 브랜드 품번이 없다(실측). sku(AAA…)와 model(430701)은
    // 둘 다 Smallable 자신의 번호라 여기에 넣지 않는다 — 넣는 순간 "SKU가 다르니 다른
    // 상품"이라는 틀린 규칙이 되살아난다.
    brandModelCode: extractLabeledProductCode(description),
    sellerSku: readString(product.sku),
    title,
    coreTitleTokens: coreTokens(title, brand, color, material),
    // 마지막 한 조각(가장 구체적인 분류)을 카테고리로 쓴다. 앞 조각들은 대상
    // 연령 신호로 따로 쓴다 — 둘은 다른 질문에 답한다.
    categoryText: breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1] : null,
    colorText: color,
    materialText: material,
    fitText: extractFitPhrase(description),
    ageRangeText: null,
    sizeLabels: extractSmallableSizeLabels(html),
    audienceSignals: breadcrumb,
    imageUrls: readString(product.image)
      ? [readString(product.image)!.startsWith("//") ? `https:${readString(product.image)}` : readString(product.image)!]
      : [],
  };
}
