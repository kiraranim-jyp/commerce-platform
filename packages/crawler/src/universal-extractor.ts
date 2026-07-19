import type { Page } from "playwright-core";
import type { ExtractedImage } from "@commerce/shared";
import { launchChromium } from "./browser-launcher";
import { loadCrawlerConfig } from "./config";
import { scoreAndFilter, type ExtractionTrace } from "./scoring";
import { jsonLdStrategy } from "./strategies/json-ld.strategy";
import { openGraphStrategy } from "./strategies/open-graph.strategy";
import { shopifyStrategy } from "./strategies/shopify.strategy";
import { nextDataStrategy } from "./strategies/next-data.strategy";
import { domScanStrategy } from "./strategies/dom-scan.strategy";
import type { ExtractionContext, ExtractionStrategy, ImageCandidate, StrategySource } from "./strategies/types";

const STRATEGIES: ExtractionStrategy[] = [
  jsonLdStrategy,
  openGraphStrategy,
  shopifyStrategy,
  nextDataStrategy,
  domScanStrategy,
];

export interface UniversalExtractOptions {
  /** true면 각 후보의 점수/제외사유를 담은 trace를 함께 반환한다(Extractor Test 페이지용). */
  debug?: boolean;
}

export interface UniversalExtractResult {
  images: ExtractedImage[];
  trace?: ExtractionTrace[];
  strategyCounts?: Record<StrategySource, number>;
}

async function autoScroll(page: Page, passes: number): Promise<void> {
  for (let i = 0; i < passes; i++) {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let scrolled = 0;
        const step = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          scrolled += step;
          if (scrolled >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    });
  }
}

async function runStrategies(ctx: ExtractionContext): Promise<ImageCandidate[]> {
  const results = await Promise.all(
    STRATEGIES.filter((strategy) => strategy.canHandle(ctx)).map((strategy) =>
      strategy.extract(ctx).catch(() => [] as ImageCandidate[]),
    ),
  );
  return results.flat();
}

function countBySource(candidates: ImageCandidate[]): Record<StrategySource, number> {
  const counts: Record<StrategySource, number> = {
    "json-ld": 0,
    "open-graph": 0,
    shopify: 0,
    "next-data": 0,
    "dom-scan": 0,
  };
  for (const candidate of candidates) counts[candidate.source]++;
  return counts;
}

/**
 * 구조화 데이터 계열(JSON-LD/OpenGraph/Shopify/Next) Strategy를 전부 병렬로 시도해서
 * 후보 풀에 합치고, DOM 스캔은 항상 함께 돌려 안전망 역할을 하게 한다(구조화 데이터는
 * 보통 대표 이미지 1장뿐이라 이것만으로는 갤러리 전체를 못 채운다). 후보가 하나도 없으면
 * (완전 실패) 스크롤/대기를 늘려 한 번만 재시도한다.
 */
export async function universalExtract(
  url: string,
  options: UniversalExtractOptions = {},
): Promise<UniversalExtractResult> {
  const config = loadCrawlerConfig();
  const browser = await launchChromium();

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    // 채팅 위젯/분석 스크립트가 계속 폴링하는 사이트(특히 Shopify)는 네트워크가 절대
    // idle 상태가 안 돼서 networkidle 대기가 타임아웃난다. 그런 경우 페이지 자체는
    // 이미 렌더링됐을 가능성이 높으니 domcontentloaded로 한 번 더 시도해서 살린다.
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: config.navigationTimeoutMs });
    } catch (error) {
      console.warn(
        `[universal-extractor] networkidle 대기 타임아웃, domcontentloaded로 재시도: ${url}`,
        error,
      );
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: config.navigationTimeoutMs,
      });
      await page.waitForTimeout(2000);
    }
    await autoScroll(page, 1);
    await page.waitForTimeout(500);

    let html = await page.content();
    let candidates = await runStrategies({ url, html, page });
    let strategyCounts = countBySource(candidates);
    let { images, trace } = scoreAndFilter(candidates, config);

    // 후보가 있어도 전부 로고/추천상품/저해상도로 걸러져 최종 0장이면(예: 갤러리가 아직
    // 로드 안 된 경우) 스크롤/대기를 늘려 한 번만 재시도한다.
    if (images.length === 0) {
      await autoScroll(page, 2);
      await page.waitForTimeout(1500);
      html = await page.content();
      candidates = await runStrategies({ url, html, page });
      strategyCounts = countBySource(candidates);
      ({ images, trace } = scoreAndFilter(candidates, config));
    }

    return {
      images,
      trace: options.debug ? trace : undefined,
      strategyCounts,
    };
  } finally {
    await browser.close();
  }
}
