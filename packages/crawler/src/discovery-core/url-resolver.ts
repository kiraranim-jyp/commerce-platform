import { classifyUrlShape, toCrawlerUrl } from "../comparison-search/url-shape";
import type { DiscoveredUrl, ResolutionClass, ResolutionStep, ResolvedCandidate } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-LONGSPRINT-P1.1 §1 — URL Resolver (독립 계층)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 검색이 준 URL 을 **크롤러에 넣을 수 있는 상품 URL** 로 바꾸거나, 바꿀 수 없음을
 * 분류한다. 실측(2026-10-07, 표본 10 · 일반 웹검색)이 이 계층을 요구했다:
 *
 *     사용 가능한 상품 URL      1
 *     목록/브랜드 페이지        7   ← 그냥 크롤러에 넣으면 전부 오염된다
 *     404(낡은 검색 색인)       1
 *     302 → 홈                 1   ← URL 모양은 /products/ 인데 상품이 아니다
 *
 * 🔴 **목록 페이지에서 상품을 추출하지 않는다**(P1.1 §2). LISTING_PAGE 로 «정확히
 *    식별하고 보류» 한다. 추출을 시작하면 외부 Search Discovery 가 다시
 *    사이트별 Parser 프로젝트가 되고, 그게 Closed Registry 의 비용 그 자체다.
 */

/* ───────────────────────── 페이지 탐침(주입) ───────────────────────── */

/**
 * 🔴 HTTP 를 이 모듈 «안에서» 하지 않는다. 주입받는다 — 그래야 테스트가
 *    네트워크 없이 모든 분기를 덮을 수 있다(그리고 하니스가 호출량을 센다).
 */
export interface PageProbe {
  (url: string): Promise<{ status: number; finalUrl: string; canonicalUrl: string | null }>;
}

/* ───────────── 경로 분류 · 크롤러 URL 재조립 — 🔴 Production 이 소유한다 ───────────── */

/**
 * 🔴 MI-P0-02b ⑥(2026-10-11) — `classifyUrlShape` · `toCrawlerUrl` 과 그 정규식은
 *    **`comparison-search/url-shape.ts` 로 옮겼다. 로직은 한 줄도 바뀌지 않았다.**
 *
 *    옮긴 이유: Production 인 `comparison-search/product-url-facts.ts` 가 이 파일을
 *    직접 import 하고 있었다. 즉 이 디렉터리 주석의 「Production 이 하나도 import
 *    하지 않는다」가 거짓이었고, 가드는 `index.ts` export 만 봐서 그것을 못 막았다.
 *    URL 모양 판별은 애초에 Production 로직이므로 Production 이 소유하게 하고,
 *    benchmark 가 그것을 쓴다 — 방향이 benchmark → Production 하나로 고정된다.
 *
 * 🔴 아래 re-export 는 기존 import 경로(`../url-resolver`)를 그대로 살려 둔다.
 *    benchmark 테스트를 한 줄도 고치지 않았다 — 이동이 «동작 변경이 아님» 을
 *    기존 단언들이 그대로 증명하게 하는 것이 목적이다.
 */
export { classifyUrlShape, toCrawlerUrl, type CrawlerUrlResult } from "../comparison-search/url-shape";

/* ───────────────────────── 해석 ───────────────────────── */

export async function resolveCandidate(
  searchUrl: string,
  provenance: DiscoveredUrl[],
  probe: PageProbe,
): Promise<ResolvedCandidate> {
  const steps: ResolutionStep[] = ["SEARCH_URL"];
  const base = (over: Partial<ResolvedCandidate>): ResolvedCandidate => ({
    searchUrl,
    finalUrl: searchUrl,
    crawlerUrl: null,
    classification: "UNUSABLE",
    steps,
    httpStatus: null,
    dedupeKey: null,
    provenance,
    ...over,
  });

  let probed: { status: number; finalUrl: string; canonicalUrl: string | null };
  try {
    probed = await probe(searchUrl);
  } catch {
    // 🔴 「네트워크가 안 됐다」를 「상품이 없다」로 적지 않는다.
    return base({ classification: "UNUSABLE" });
  }

  if (probed.status === 404 || probed.status === 410) {
    // 실측 1건: wonderforkids.nl — 검색 색인이 낡아 상품이 사라졌다.
    return base({ finalUrl: probed.finalUrl, httpStatus: probed.status, classification: "NOT_FOUND" });
  }

  if (probed.finalUrl !== searchUrl) steps.push("REDIRECTED");

  let target = probed.finalUrl;
  if (probed.canonicalUrl && probed.canonicalUrl !== probed.finalUrl) {
    target = probed.canonicalUrl;
    steps.push("CANONICALIZED");
  }

  const shapeBefore = classifyUrlShape(searchUrl);
  let shape = classifyUrlShape(target);

  /**
   * 🔴 실측 1건(main-story.com): 검색 URL 은 `/products/bubble-sweatshirt-grey-melange`
   *    인데 302 로 **홈** 으로 간다. URL 모양만 보면 상품인데 도착지는 상품이 아니다.
   *    이것을 PRODUCT 로 두면 크롤러가 홈페이지를 상품으로 읽는다.
   */
  if (shapeBefore === "PRODUCT_PAGE" && shape !== "PRODUCT_PAGE") {
    shape = "UNUSABLE";
  }

  const { crawlerUrl, localeNormalized, dedupeKey } = toCrawlerUrl(target, shape);
  if (localeNormalized) steps.push("LOCALE_NORMALIZED");

  return base({
    finalUrl: target,
    httpStatus: probed.status,
    classification: shape,
    crawlerUrl,
    dedupeKey,
  });
}

/**
 * 🔴 크롤러에 넘길 자격 — **PRODUCT_PAGE 이고 crawlerUrl 이 있을 때만**.
 *    LISTING_PAGE 는 여기서 걸러진다(P1.1 §2 「무조건 넘기지 않는다」).
 */
export function isCrawlable(candidate: ResolvedCandidate): boolean {
  return candidate.classification === "PRODUCT_PAGE" && candidate.crawlerUrl !== null;
}
