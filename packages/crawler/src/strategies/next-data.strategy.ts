import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

const SCRIPT_RE = /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp|avif)(\?|$)/i;
const MAX_WALK_DEPTH = 12;
const MAX_SEARCH_DEPTH = 6;

function isImageUrlString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!IMAGE_EXTENSION_RE.test(value)) return false;
  return /^https?:\/\//i.test(value) || value.startsWith("//");
}

function toAbsoluteUrl(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

/**
 * node가 "상품 하나"처럼 보이는지 덕타이핑으로 판단한다 — name/title과
 * price/prices/offers를 함께 가진 object면 상품 레코드로 간주한다. 사이트마다
 * __NEXT_DATA__ 스키마가 전혀 달라서 특정 키 이름(product, item 등)을 하드코딩하지
 * 않고 이 패턴으로 "메인 상품"과 "추천/동일유형/유사 상품 목록"을 구분한다.
 */
function looksLikeProductNode(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const hasName = typeof obj.name === "string" || typeof obj.title === "string";
  const hasPrice = "price" in obj || "prices" in obj || "offers" in obj;
  return hasName && hasPrice;
}

/** value가 "다른 상품 여러 개의 목록"으로 보이면 true — sameTypeProducts/
 * similarProducts/capsuleProducts류를 키 이름과 무관하게 잡아내서 이미지 수집에서
 * 건너뛴다(현재 상품이 아니라 다른 상품들의 사진이 섞여 들어오는 걸 막는다). */
function looksLikeProductList(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 2) return false;
  const sample = value.slice(0, 5);
  const productLikeCount = sample.filter(looksLikeProductNode).length;
  return productLikeCount / sample.length >= 0.6;
}

/**
 * __NEXT_DATA__ 트리에서 "메인 상품"으로 보이는 첫 노드를 BFS로 찾는다. 얕은
 * depth에서 먼저 찾은 것을 우선해서, 추천상품 배열 안에 우연히 들어있는
 * product-like 항목보다 실제 pageProps.product 같은 최상위 필드를 먼저 채택한다.
 */
function findMainProductNode(root: unknown): Record<string, unknown> | null {
  const queue: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const { value, depth } = queue.shift()!;
    if (depth > MAX_SEARCH_DEPTH || value == null || typeof value !== "object") continue;
    if (seen.has(value)) continue;
    seen.add(value);

    if (looksLikeProductNode(value)) return value;

    const children = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
    for (const child of children) {
      if (child && typeof child === "object") queue.push({ value: child, depth: depth + 1 });
    }
  }
  return null;
}

/** node의 하위 트리를 순회하며 이미지 URL 문자열을 모은다. "다른 상품 목록"으로
 * 보이는 배열은 건너뛴다. */
function collectImages(value: unknown, out: string[], depth = 0): void {
  if (depth > MAX_WALK_DEPTH || value == null) return;

  if (isImageUrlString(value)) {
    out.push(toAbsoluteUrl(value));
    return;
  }
  if (typeof value !== "object") return;

  if (Array.isArray(value)) {
    if (looksLikeProductList(value)) return;
    for (const item of value) collectImages(item, out, depth + 1);
    return;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectImages(item, out, depth + 1);
  }
}

/**
 * __NEXT_DATA__는 사이트마다 상품 데이터 구조가 제각각이라 스키마를 가정하지 않고
 * "이름+가격을 가진 object"를 상품으로 간주하는 덕타이핑으로 메인 상품 노드를 찾은
 * 뒤, 그 하위 트리에서만 이미지를 수집한다. 메인 상품 노드를 못 찾으면 페이지
 * 전체를 훑지 않고 빈 배열을 반환한다 — dom-scan이 항상 함께 실행되는 안전망이므로
 * 상품 범위를 확신할 수 없을 때 굳이 노이즈(추천상품/브랜드 캐러셀 등)를 보태지 않는다.
 */
export const nextDataStrategy: ExtractionStrategy = {
  name: "next-data",
  canHandle(ctx) {
    return ctx.html.includes("__NEXT_DATA__");
  },
  async extract(ctx: ExtractionContext): Promise<ImageCandidate[]> {
    const match = SCRIPT_RE.exec(ctx.html);
    if (!match?.[1]) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      return [];
    }

    const productNode = findMainProductNode(parsed);
    if (!productNode) return [];

    const urls: string[] = [];
    collectImages(productNode, urls);

    return Array.from(new Set(urls), (url) => ({ url, source: "next-data" as const }));
  },
};
