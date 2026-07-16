export interface CrawlerConfig {
  excludeKeywords: string[];
  minWidth: number;
  minHeight: number;
  navigationTimeoutMs: number;
}

export function loadCrawlerConfig(): CrawlerConfig {
  return {
    excludeKeywords: [
      "banner",
      "advert",
      " ad ",
      "promotion",
      "promo",
      "icon",
      "logo",
      "sprite",
      "review",
      "comment",
      "recommend",
      "related",
      "similar",
      "guess-like",
    ],
    minWidth: Number(process.env.CRAWLER_MIN_IMAGE_WIDTH ?? 200),
    minHeight: Number(process.env.CRAWLER_MIN_IMAGE_HEIGHT ?? 200),
    navigationTimeoutMs: Number(process.env.CRAWLER_NAV_TIMEOUT_MS ?? 30000),
  };
}
