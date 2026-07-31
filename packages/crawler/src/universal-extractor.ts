import type { Page } from "playwright-core";
import type { ExtractedImage } from "@commerce/shared";
import { launchChromium } from "./browser-launcher";
import { loadCrawlerConfig } from "./config";
import {
  extractProductData,
  type ExtractedProductData,
  type ProductDataSource,
} from "./product-data-extractor";
import { acquireDomainSlot, recordRateLimitResponse } from "./rate-limit/domain-rate-limiter";
import { scoreAndFilter, type ExtractionTrace } from "./scoring";
import { trySiteStrategies } from "./site-strategies/registry";
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
  productData: ExtractedProductData;
  productDataSources: Record<string, ProductDataSource>;
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

/** SiteStrategy(Partial<ExtractedProductData>)가 채운 필드를 전부 "shopify-json"
 * 출처로 표시한다 — canonical-product.ts의 confidence 계산이 이 값을 읽는다. */
function buildSiteStrategySources(
  data: Partial<ExtractedProductData>,
): Record<string, ProductDataSource> {
  const sources: Record<string, ProductDataSource> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    sources[key] = "shopify-json";
  }
  return sources;
}

/**
 * Playwright를 아예 켜지 않고 등록된 SiteStrategy(현재는 Shopify)만으로 이미지+
 * 상품데이터를 확정할 수 있는지 시도한다. URL이 어떤 전략에도 안 걸리거나, 걸려도
 * 실제 fetch가 실패하면 null을 반환해 호출부가 기존 Playwright 파이프라인을
 * 그대로 타게 한다 — 이 경로를 타지 않는 사이트는 동작이 전혀 바뀌지 않는다.
 */
async function tryFastPath(
  url: string,
  config: ReturnType<typeof loadCrawlerConfig>,
  debug: boolean,
): Promise<UniversalExtractResult | null> {
  const siteResult = await trySiteStrategies(url);
  if (!siteResult) return null;

  const { images, trace } = scoreAndFilter(siteResult.images, config);
  if (images.length === 0) return null;

  const productData: ExtractedProductData = {
    title: siteResult.productData.title,
    brand: siteResult.productData.brand,
    price: siteResult.productData.price,
    sku: siteResult.productData.sku,
    description: siteResult.productData.description,
    material: siteResult.productData.material,
    options: siteResult.productData.options ?? [],
    optionGroups: siteResult.productData.optionGroups ?? [],
    variants: siteResult.productData.variants ?? [],
    breadcrumbPath: siteResult.productData.breadcrumbPath,
    jsonLdCategory: siteResult.productData.jsonLdCategory,
    shopifyTags: siteResult.productData.shopifyTags,
    shopifyProductType: siteResult.productData.shopifyProductType,
  };

  return {
    images,
    trace: debug ? trace : undefined,
    strategyCounts: countBySource(siteResult.images),
    productData,
    productDataSources: buildSiteStrategySources(siteResult.productData),
  };
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

  // Epic 1-3: Shopify처럼 Playwright 없이도 신뢰도 높은 데이터를 얻을 수 있는
  // 사이트는 브라우저를 켜기 전에 먼저 시도한다 — 이 URL이 어떤 SiteStrategy에도
  // 안 걸리면 fastResult는 null이고, 그 아래 기존 Playwright 파이프라인이 지금까지와
  // 완전히 동일하게 실행된다(회귀 없음).
  const fastResult = await tryFastPath(url, config, options.debug ?? false);
  if (fastResult) return fastResult;

  const browser = await launchChromium();

  try {
    // 기본 Playwright 컨텍스트는 navigator.webdriver=true 등 자동화 신호를 그대로
    // 노출해서 일부 사이트(Zalando/Babyshop처럼 엔터프라이즈급 봇 차단이 걸린 곳)가
    // 페이지 콘텐츠 자체를 안 내려준다. 실제 Chrome처럼 보이도록 UA/locale/헤더를
    // 맞춘다 — 강력한 지문 인식(Cloudflare/Akamai 등)까지 뚫는다는 보장은 없지만
    // 비용 없이 시도할 가치가 있는 최소한의 개선이다.
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "Europe/Amsterdam",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    // 채팅 위젯/분석 스크립트가 계속 폴링하는 사이트(특히 Shopify)는 네트워크가 절대
    // idle 상태가 안 돼서 networkidle 대기가 타임아웃난다. 그런 경우 페이지 자체는
    // 이미 렌더링됐을 가능성이 높으니 domcontentloaded로 한 번 더 시도해서 살린다.
    //
    // Epic 4: 이 네비게이션도 도메인별 속도 제어를 거친다 — 같은 인스턴스에서 같은
    // 도메인으로 짧은 시간에 여러 번 재시도/재검증할 때 요청이 몰리는 걸 줄인다.
    // 429를 받으면 recordRateLimitResponse가 그 도메인을 blockedUntil까지 쉬게
    // 기록해서, 다음 요청(같은 URL의 재시도든 다른 이미지 다운로드든)이 곧바로
    // 같은 벽에 다시 부딪히지 않게 한다.
    const releaseDomainSlot = await acquireDomainSlot(url);
    try {
      let response;
      try {
        response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: config.navigationTimeoutMs,
        });
      } catch (error) {
        console.warn(
          `[universal-extractor] networkidle 대기 타임아웃, domcontentloaded로 재시도: ${url}`,
          error,
        );
        response = await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: config.navigationTimeoutMs,
        });
        await page.waitForTimeout(2000);
      }
      if (response) {
        const headers = await response.allHeaders().catch(() => ({}) as Record<string, string>);
        recordRateLimitResponse(url, response.status(), headers["retry-after"] ?? null);
      }
    } finally {
      releaseDomainSlot();
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

    // 이미지 추출에 쓴 것과 같은 page/html을 재사용한다 — 상품 정보만 보려고
    // 페이지를 한 번 더 열 필요가 없다.
    const { data: productData, sources: productDataSources } = await extractProductData(
      html,
      page,
    );

    return {
      images,
      trace: options.debug ? trace : undefined,
      strategyCounts,
      productData,
      productDataSources,
    };
  } finally {
    await browser.close();
  }
}
