import { shopifySiteStrategy } from "./shopify.site-strategy";
import type { SiteStrategy, SiteStrategyResult } from "./types";

/** 새 플랫폼(WooCommerce/Cafe24 등)을 추가하려면 SiteStrategy를 구현해서 이
 * 배열에 등록하기만 하면 된다 — 오케스트레이터(universal-extractor.ts)는 이 목록을
 * 순서대로 시도할 뿐 특정 플랫폼을 모른다. */
const SITE_STRATEGIES: SiteStrategy[] = [shopifySiteStrategy];

/** 등록된 SiteStrategy를 순서대로 시도한다 — detect()가 맞으면 extract()를,
 * extract()가 이미지를 못 찾으면 fallback()을 시도하고, 그것도 실패하면 다음
 * 전략으로 넘어간다. 전부 실패하면 null을 반환해 호출부가 기존 Playwright
 * 파이프라인으로 넘어가게 한다. */
export async function trySiteStrategies(url: string): Promise<SiteStrategyResult | null> {
  for (const strategy of SITE_STRATEGIES) {
    const matched = await strategy.detect(url).catch(() => false);
    if (!matched) continue;

    const primary = await strategy.extract(url).catch(() => null);
    if (primary && primary.images.length > 0) return primary;

    const fallback = await strategy.fallback(url).catch(() => null);
    if (fallback && fallback.images.length > 0) return fallback;
  }
  return null;
}
