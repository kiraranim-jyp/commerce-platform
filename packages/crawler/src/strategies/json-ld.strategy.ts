import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

const SCRIPT_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/** LD-JSON의 image 필드는 문자열 하나, 문자열 배열, 또는 {url: "..."} 객체(배열)로 온다. */
function collectImageUrls(value: unknown, out: string[]): void {
  if (!value) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageUrls(item, out);
    return;
  }
  if (typeof value === "object" && "url" in (value as Record<string, unknown>)) {
    collectImageUrls((value as { url: unknown }).url, out);
  }
}

/** node가 Product 타입(또는 @graph 안에 Product를 포함)이면 image 필드를 뽑아낸다. */
function extractFromNode(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"] as unknown[]) extractFromNode(child, out);
    return;
  }

  const type = obj["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
  if (isProduct && "image" in obj) {
    collectImageUrls(obj.image, out);
  }
}

/** Product 스키마를 갖춘 사이트가 "이게 진짜 상품 이미지다"라고 직접 명시한 값이라
 * 신뢰도가 가장 높다. 보통 대표 이미지 1~수 장이라 다른 Strategy와 병행 실행한다. */
export const jsonLdStrategy: ExtractionStrategy = {
  name: "json-ld",
  canHandle(ctx) {
    return ctx.html.includes("application/ld+json");
  },
  async extract(ctx: ExtractionContext): Promise<ImageCandidate[]> {
    const urls = new Set<string>();

    for (const match of ctx.html.matchAll(SCRIPT_RE)) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      const found: string[] = [];
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) extractFromNode(node, found);
      for (const u of found) urls.add(u);
    }

    return Array.from(urls, (url) => ({ url, source: "json-ld" as const }));
  },
};
