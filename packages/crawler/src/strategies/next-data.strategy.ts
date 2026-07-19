import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

const SCRIPT_RE =
  /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp|avif)(\?|$)/i;

/** __NEXT_DATA__는 사이트마다 상품 데이터 구조가 제각각이라 스키마를 가정하지 않고,
 * 트리 전체를 재귀 순회하며 이미지 확장자를 가진 문자열 값을 전부 후보로 모은다.
 * 노이즈가 섞일 수 있어 점수화 단계의 해상도/키워드 필터가 걸러낸다. */
function walk(value: unknown, out: string[], depth = 0): void {
  if (depth > 12 || value == null) return;

  if (typeof value === "string") {
    if (IMAGE_EXTENSION_RE.test(value) && /^https?:\/\//i.test(value)) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      walk(item, out, depth + 1);
    }
  }
}

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

    const urls: string[] = [];
    walk(parsed, urls);

    return Array.from(new Set(urls), (url) => ({ url, source: "next-data" as const }));
  },
};
