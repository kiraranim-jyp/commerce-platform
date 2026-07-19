import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

const OG_IMAGE_RE =
  /<meta[^>]+property=["'](?:og:image(?::secure_url)?)["'][^>]+content=["']([^"']+)["']/gi;
// content가 property보다 먼저 오는 마크업도 흔하다.
const OG_IMAGE_RE_REVERSED =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og:image(?::secure_url)?)["']/gi;

/** og:image는 보통 대표 이미지 1~2장뿐이지만, 다른 Strategy가 놓친 대표컷을 보강하거나
 * 여러 소스가 같은 URL을 가리킬 때 점수 보너스를 주는 확인용으로도 쓸모 있다. */
export const openGraphStrategy: ExtractionStrategy = {
  name: "open-graph",
  canHandle(ctx) {
    return ctx.html.includes("og:image");
  },
  async extract(ctx: ExtractionContext): Promise<ImageCandidate[]> {
    const urls = new Set<string>();
    for (const re of [OG_IMAGE_RE, OG_IMAGE_RE_REVERSED]) {
      for (const match of ctx.html.matchAll(re)) {
        if (match[1]) urls.add(match[1]);
      }
    }
    return Array.from(urls, (url) => ({ url, source: "open-graph" as const }));
  },
};
