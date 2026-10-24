import { canonicalizeProductUrl } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { expandDomesticListing, extractHrefs } from "./domestic-listing-hop";
import {
  codeVariants,
  collectListingEntries,
  extractPageLinks,
  pickByListingText,
  type ListingEntry,
} from "./domestic-listing-hop-2";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R-4 STEP 2 — **1-hop / 2-hop 수집기를 운영 후보 경로에 «연결» 한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-24) — 「기존 모듈 `domestic-listing-hop.ts` · `-hop-2.ts` 를
 * **실제 production 후보 생성 경로에 연결** 한다」 · 「기준은 WU-130
 * `__overseas_auto__` transient producer 패턴」 · 「**Dono 전용 hardcode 금지** ·
 * 신규 adapter 금지 · 신규 검색엔진/API 금지」.
 *
 * ── 🔴🔴 왜 «등록부 검색» 으로는 열 수 없었나 (CORE-2R-4 §4 확정) ───────────────
 * ```
 * packages/crawler/src/comparison-search/index.ts
 *   :271  collectionStrategy 가 AUTO_API/AUTO_SCRAPE 가 아니면 → status "unsupported"
 *   :278  findPriceSourceAdapter(domain,"DOMESTIC") 가 없으면  → status "unsupported"
 * ⟹ 게이트가 **둘** 이고 둘 다 「어댑터를 만들라」고 요구한다 — CPO 가 금지한 방향이다.
 * 🟢 그래서 붙일 자리는 **transient 생산자** 다(WU-024/130/132 가 이미 셋을 그렇게 붙였다).
 * ```
 *
 * ── 🔴🔴 이 모듈이 «하지 않는» 것 ──────────────────────────────────────────────
 * ```
 * 🔴 **판정 0** — MI·SAME·가격·시장 분류를 한 줄도 하지 않는다. 산출은 **URL 문자열** 뿐이다.
 * 🔴 **URL 을 지어내지 않는다** — 전부 그 사이트가 내놓은 실제 `href` 중에서 고른다.
 * 🔴 **사이트 전용 상수 0** — `donokids`/`shopdetail.html`/`xcode` 가 이 파일에 **없다**.
 *    상세 경로 표식과 분류 파라미터는 **그 사이트의 HTML 에서 «배운다»**(아래 ⑤).
 * 🔴 **전수 크롤링 0** — 사이트 수 · 사이트당 fetch · 페이지 수에 **전부 상한** 이 있고
 *    상한에 걸려 못 본 것은 `metrics` 에 **남긴다**(조용히 버리지 않는다).
 * 🔴 **robots 를 먼저 본다** — 전면 금지면 그 사이트는 **건드리지 않는다**(hop-1 소유 규칙).
 * 🔴 새 fetch 스택 0 — `fetchPlainHtml`(SSRF/DNS 가드 · 429 폴백) 하나만 쓴다.
 * ```
 */

/**
 * 🔴 한 번의 확인에서 **목록을 뒤질 사이트 수** 상한. 초과분은 metrics 에 남긴다.
 *
 * 🔴🔴 CORE-2R-7 — **6 이 정답 샵을 잘랐다**(CEO Production FAIL 의 실제 원인).
 *    운영 등록부 실측: 아동 scope 대상 19곳을 `(priority, domain)` 으로 정렬하면
 *    데이터가 있는 유일한 샵 `donokids.com`(P1)이 **10번째** 라 상한 밖이었다 ⟹
 *    그 샵을 **한 번도 방문하지 않았고** 국내 후보가 구조적으로 0 이었다.
 * 🟢 CPO 승인(⒝) — 무작정 전수로 늘리지 않고 **포털/오픈마켓을 제외한 전문몰** 만
 *    전수로 본다(아래 `isListingHopTarget`). 실측 대상 수는 **12~13** 이라 이 상한은
 *    **백스톱** 으로만 남는다(발화하면 metrics 에 남고, 남으면 그 사실이 보고된다).
 */
export const MAX_LISTING_HOP_SITES = 14;

/**
 * 🔴🔴 CORE-2R-7 — **포털/오픈마켓은 목록 탐색 대상이 아니다.**
 *
 * 🟢 **새 분류 규칙을 만들지 않았다** — 등록부가 이미 들고 있는 `sourceType` 을 읽는다.
 *    그리고 그 판단은 메모 `portal-scraping-blocked-by-terms` 가 이미 확정한 것이다
 *    (「자동수집은 포털이 아니라 **판매처** 로 늘린다」 · robots 허용 ≠ 약관 허용).
 * 🔴 **허용 목록이 아니라 거부 목록이다.** `sourceType` 이 `null` 인 행은 「분류되지
 *    않음」이지 「포털」이 아니다(그 타입의 주석이 그렇게 적어 뒀다) — allowlist 로
 *    짜면 `donokids.com`(실측 `source_type = NULL`)이 **다시 잘린다**.
 */
export function isListingHopTarget(source: { sourceType: string | null }): boolean {
  return source.sourceType !== "MARKETPLACE";
}
/** 🔴 사이트당 **목록/페이지 fetch** 상한(robots·진입 페이지는 hop-1 이 따로 센다). */
export const MAX_LISTING_FETCHES_PER_SITE = 4;
/** 🔴 한 사이트에서 열어 볼 **목록 URL** 수 상한. */
export const MAX_LISTING_URLS_PER_SITE = 2;
/** 🔴 사이트 전체에서 고를 상세 URL 상한 — 아래 후보 풀의 fetch 비용과 직결된다. */
export const MAX_DETAIL_URLS_PER_SITE = 5;

export interface DomesticListingSite {
  /** 등록부 host(소문자 · `www.` 없음). 🔴 추측하지 않고 등록부 값을 그대로 받는다. */
  domain: string;
  /** 🔴 등록부의 `url` 칸 그대로. **진입점을 지어내지 않는다.** */
  entryUrl: string;
}

export interface DomesticListingSiteOutcome {
  domain: string;
  /** 🔴 `null` = robots 를 못 받았다(모른다). 「허용」과 구분한다. */
  robotsAllowed: boolean | null;
  /** 어디서 상세 URL 을 얻었는가 — 추측이 아니라 **출처** 다. */
  source: "URL_CODE" | "ENTRY_TEXT" | "BRAND_LISTING" | "NONE";
  httpCalls: number;
  detailUrls: string[];
  /** 🔴 막혔으면 **어디서** 막혔는지 적는다. */
  note: string | null;
}

export interface DomesticListingPoolMetrics {
  /** 분모 — 호출부가 넘긴 사이트 수(상한 적용 «전»). */
  suppliedSites: number;
  /** 실제로 뒤진 사이트 수. */
  visitedSites: number;
  /** 🔴 상한 때문에 **보지 않은** 사이트. 「후보가 없다」가 아니다. */
  skippedOverLimit: string[];
  /** 🔴 실제로 쓴 HTTP 요청 수(사이트 합). */
  httpCalls: number;
  /** 🔴 MI 로 넘어가는 **상세 URL** 수(중복 제거 후). */
  detailUrls: number;
  /** 사이트별 결과 — 조용히 버리지 않는다. */
  outcomes: DomesticListingSiteOutcome[];
  /** 🟢 외부 AI/검색 provider 호출 수. **구조상 언제나 0** 이다. */
  providerCalls: 0;
}

export interface DomesticListingPoolInput {
  sites: readonly DomesticListingSite[];
  /** 원상품 품번. 🔴 없거나 너무 짧으면 **아무것도 하지 않는다**(오탐 방지). */
  code: string | null;
  /**
   * 🔴 브랜드 표기 후보. **호출부가 기존 데이터로 만든다**(`dna.brand.value` +
   *    `lookupBrandAlias` 의 실측 등록 표기). 🔴 이 모듈이 번역/음역을 **만들지 않는다**.
   */
  brandTerms: readonly string[];
  maxSites?: number;
  maxFetchesPerSite?: number;
  /** 🟢 테스트/측정용 주입구. 기본값이 **운영 함수** 다(이 저장소의 방식). */
  fetchHtml?: (url: string) => Promise<string | null>;
  expand?: typeof expandDomesticListing;
}

export interface DomesticListingPoolResult {
  /** 🟢 그대로 `collectUrlCandidatePool` 에 넘길 수 있는 URL 목록. */
  urls: string[];
  metrics: DomesticListingPoolMetrics;
}

/** 🔴 정규식 특수문자를 가진 표식(`shopdetail.html` 의 `.`)을 그대로 쓰지 않는다. */
function escapeForRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** 🟢 블록 텍스트를 사람이 읽는 글자로 — 태그 사이에 끼어 있어도 브랜드를 본다. */
function blockText(entry: ListingEntry): string {
  return entry.text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

/**
 * 🟢 **브랜드 표기가 붙어 있는 상세 링크** — 사이트의 상세 경로와 분류 파라미터를
 *    여기서 «배운다». 🔴 사이트별 상수를 박지 않기 위한 유일한 수단이다.
 */
function brandTaggedHrefs(entries: readonly ListingEntry[], brandTerms: readonly string[], host: string): string[] {
  const terms = brandTerms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
  if (terms.length === 0) return [];
  const out = new Set<string>();
  for (const e of entries) {
    const hay = blockText(e).toLowerCase();
    if (!terms.some((t) => hay.includes(t))) continue;
    if (hostOf(e.href) !== host) continue;
    out.add(e.href);
  }
  return [...out];
}

/** 가장 많이 쓰인 pathname — 그 사이트의 **상세 경로** 다(데이터에서 배운다). */
function dominantPathname(urls: readonly string[]): string | null {
  const count = new Map<string, number>();
  for (const u of urls) {
    try {
      const p = new URL(u).pathname;
      count.set(p, (count.get(p) ?? 0) + 1);
    } catch {
      /* 깨진 URL 은 센지 않는다 */
    }
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [p, n] of count) {
    if (n > bestN) {
      best = p;
      bestN = n;
    }
  }
  return best;
}

/**
 * 🟢 브랜드 상세 링크들이 **전부 공유하는** 쿼리 `key=value` — 그 사이트가 쓰는
 *    **브랜드 분류 값** 이다(예: 분류코드). 🔴 상품마다 다른 키(상품 id · 추적 토큰)는
 *    「전부 공유」 조건에서 **자동으로 떨어진다** — 제외 목록을 손으로 적지 않는다.
 */
function sharedQueryPairs(urls: readonly string[]): string[] {
  let shared: Set<string> | null = null;
  for (const u of urls) {
    const pairs = new Set<string>();
    try {
      for (const [k, v] of new URL(u).searchParams) {
        if (!v.trim()) continue;
        pairs.add(`${k}=${v}`);
      }
    } catch {
      continue;
    }
    if (shared === null) shared = pairs;
    else for (const p of [...shared]) if (!pairs.has(p)) shared.delete(p);
  }
  return shared ? [...shared] : [];
}

/**
 * 🟢 진입 페이지의 실제 href 중 **목록으로 보이는 것** 을 고른다.
 *
 * 🔴 조건 셋 — ⒜ 같은 host ⒝ 상세 경로와 **다른 pathname** ⒞ 브랜드 분류 값을 **가진다**.
 * 🔴 정렬은 **결정적** 이다(일치한 분류 값 수 내림차순 → URL 길이 오름차순).
 */
function pickBrandListingUrls(
  allHrefs: readonly string[],
  host: string,
  detailPath: string,
  pairs: readonly string[],
  limit: number,
): string[] {
  if (pairs.length === 0) return [];
  const scored: { url: string; hits: number }[] = [];
  const seen = new Set<string>();
  for (const raw of allHrefs) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (hostOf(raw) !== host) continue;
    let pathname: string;
    let search: string;
    try {
      const u = new URL(raw);
      pathname = u.pathname;
      search = u.search;
    } catch {
      continue;
    }
    if (pathname === detailPath) continue;
    const hits = pairs.filter((p) => search.includes(p)).length;
    if (hits === 0) continue;
    scored.push({ url: raw, hits });
  }
  scored.sort((a, b) => b.hits - a.hits || a.url.length - b.url.length || (a.url < b.url ? -1 : 1));
  return scored.slice(0, limit).map((s) => s.url);
}

async function expandOneSite(
  site: DomesticListingSite,
  input: DomesticListingPoolInput,
): Promise<DomesticListingSiteOutcome> {
  const fetchHtml = input.fetchHtml ?? fetchPlainHtml;
  const expand = input.expand ?? expandDomesticListing;
  const budget = input.maxFetchesPerSite ?? MAX_LISTING_FETCHES_PER_SITE;
  const host = site.domain.replace(/^www\./i, "").toLowerCase();

  /** ①②③ robots → sitemap → 진입 href 에서 **URL 에 품번이 있는 것**(hop-1 소유). */
  const hop1 = await expand(site.entryUrl, input.code);
  let httpCalls = hop1.httpCalls;
  if (hop1.robotsAllowed === false) {
    return { domain: host, robotsAllowed: false, source: "NONE", httpCalls, detailUrls: [], note: hop1.note };
  }
  if (hop1.detailUrls.length > 0) {
    return {
      domain: host,
      robotsAllowed: hop1.robotsAllowed,
      source: "URL_CODE",
      httpCalls,
      detailUrls: hop1.detailUrls.slice(0, MAX_DETAIL_URLS_PER_SITE),
      note: null,
    };
  }

  /** 🔴 진입 페이지를 못 받았으면 2-hop 을 할 재료가 없다(추가 fetch 하지 않는다). */
  const entryHtml = hop1.entryHtml;
  if (!entryHtml) {
    return { domain: host, robotsAllowed: hop1.robotsAllowed, source: "NONE", httpCalls, detailUrls: [], note: hop1.note };
  }

  /** ④ 진입 페이지 **텍스트** 에 품번이 있는가(hop-2 소유 · 추가 HTTP 0). */
  const entryEntries = collectListingEntries(entryHtml, site.entryUrl, "");
  const fromEntryText = pickByListingText(entryEntries, input.code);
  if (fromEntryText.length > 0) {
    return {
      domain: host,
      robotsAllowed: hop1.robotsAllowed,
      source: "ENTRY_TEXT",
      httpCalls,
      detailUrls: fromEntryText.slice(0, MAX_DETAIL_URLS_PER_SITE),
      note: null,
    };
  }

  /** ⑤ 브랜드 목록을 **그 사이트의 HTML 에서 배워** 연다. */
  const brandHrefs = brandTaggedHrefs(entryEntries, input.brandTerms, host);
  if (brandHrefs.length === 0) {
    return {
      domain: host,
      robotsAllowed: hop1.robotsAllowed,
      source: "NONE",
      httpCalls,
      detailUrls: [],
      note: "NO_BRAND_BLOCK — 진입 페이지에 그 브랜드 표기가 없다",
    };
  }
  const detailPath = dominantPathname(brandHrefs);
  if (!detailPath) {
    return { domain: host, robotsAllowed: hop1.robotsAllowed, source: "NONE", httpCalls, detailUrls: [], note: "NO_DETAIL_PATH" };
  }
  const detailMarker = escapeForRegex(detailPath.split("/").filter(Boolean).pop() ?? detailPath);
  /**
   * 🔴 분류 값은 **상세 링크끼리** 비교해서 얻는다. 브랜드 블록 안에 목록 링크가
   *    섞여 있으면(창이 넓은 페이지에서 실제로 생긴다) 교집합이 통째로 비어
   *    「목록을 못 찾는다」가 된다 — 그 모양을 계약(B-1)이 문다.
   */
  const brandDetailHrefs = brandHrefs.filter((u) => {
    try {
      return new URL(u).pathname === detailPath;
    } catch {
      return false;
    }
  });
  const listingUrls = pickBrandListingUrls(
    extractHrefs(entryHtml, site.entryUrl),
    host,
    detailPath,
    sharedQueryPairs(brandDetailHrefs),
    MAX_LISTING_URLS_PER_SITE,
  );
  if (listingUrls.length === 0) {
    return {
      domain: host,
      robotsAllowed: hop1.robotsAllowed,
      source: "NONE",
      httpCalls,
      detailUrls: [],
      note: "NO_BRAND_LISTING — 브랜드 분류 값을 가진 목록 링크가 없다",
    };
  }

  const picked: string[] = [];
  let spent = 0;
  for (const listingUrl of listingUrls) {
    if (spent >= budget || picked.length >= MAX_DETAIL_URLS_PER_SITE) break;
    const html = await fetchHtml(listingUrl);
    spent += 1;
    httpCalls += 1;
    if (!html) continue;
    for (const u of pickByListingText(collectListingEntries(html, listingUrl, detailMarker), input.code)) {
      if (!picked.includes(u)) picked.push(u);
    }
    /** 🔴 **번호를 만들지 않는다** — 그 페이지가 내놓은 `page=N` 링크만 연다(hop-2 소유). */
    for (const pageUrl of extractPageLinks(html, listingUrl)) {
      if (spent >= budget || picked.length >= MAX_DETAIL_URLS_PER_SITE) break;
      if (pageUrl === listingUrl) continue;
      const pageHtml = await fetchHtml(pageUrl);
      spent += 1;
      httpCalls += 1;
      if (!pageHtml) continue;
      for (const u of pickByListingText(collectListingEntries(pageHtml, pageUrl, detailMarker), input.code)) {
        if (!picked.includes(u)) picked.push(u);
      }
    }
  }
  return {
    domain: host,
    robotsAllowed: hop1.robotsAllowed,
    source: picked.length > 0 ? "BRAND_LISTING" : "NONE",
    httpCalls,
    detailUrls: picked.slice(0, MAX_DETAIL_URLS_PER_SITE),
    note:
      picked.length > 0
        ? null
        : `BRAND_LISTING_NO_CODE — 목록 ${listingUrls.length}곳에서 품번 일치 0(상한 fetch ${spent})`,
  };
}

/**
 * 국내 판매처 **목록 → 상세 URL**. 🔴 후보를 만들지 않는다 — **URL 만** 돌려준다.
 *
 * 🔴 **throw 하지 않는다.** 한 사이트의 실패가 나머지를 죽이지 않는다
 *    (`collectOverseasAutoPool` 과 같은 fail-soft 패턴).
 */
export async function collectDomesticListingUrls(
  input: DomesticListingPoolInput,
): Promise<DomesticListingPoolResult> {
  const maxSites = input.maxSites ?? MAX_LISTING_HOP_SITES;
  const metrics: DomesticListingPoolMetrics = {
    suppliedSites: input.sites.length,
    visitedSites: 0,
    skippedOverLimit: [],
    httpCalls: 0,
    detailUrls: 0,
    outcomes: [],
    providerCalls: 0,
  };
  /** 🔴 품번이 없거나 짧으면 **아무것도 하지 않는다** — 목록 텍스트 일치가 오탐이 된다. */
  if (codeVariants(input.code).length === 0 || input.sites.length === 0) {
    return { urls: [], metrics };
  }

  const targets = input.sites.slice(0, Math.max(0, maxSites));
  metrics.skippedOverLimit = input.sites.slice(targets.length).map((s) => s.domain);
  metrics.visitedSites = targets.length;

  /** 🟢 사이트끼리는 **병렬** — 서로 다른 host 라 도메인 rate limiter 가 갈라 준다. */
  const settled = await Promise.all(
    targets.map((site) =>
      expandOneSite(site, input).catch(
        (): DomesticListingSiteOutcome => ({
          domain: site.domain,
          robotsAllowed: null,
          source: "NONE",
          httpCalls: 0,
          detailUrls: [],
          note: "SITE_ERROR",
        }),
      ),
    ),
  );

  const urls: string[] = [];
  /**
   * 🔴 같은 상품이 **추적 파라미터만 다른 채** 두 번 뽑힐 수 있다(목록이 정렬/문맥
   *    토큰을 붙인다). 🟢 키는 **기존 owner** `canonicalizeProductUrl`(WU-009C)을 쓴다 —
   *    식별 파라미터(`?branduid=`·`?product_no=`)는 **보존** 되고 추적/검색 문맥만 걷힌다.
   * 🔴 새 정규화기를 만들지 않는다(그러면 국내 Cafe24 계열에서 다른 상품이 접힌다).
   */
  const seenKeys = new Set<string>();
  for (const o of settled) {
    metrics.outcomes.push(o);
    metrics.httpCalls += o.httpCalls;
    for (const u of o.detailUrls) {
      const key = canonicalizeProductUrl(u).toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      urls.push(u);
    }
  }
  metrics.detailUrls = urls.length;
  return { urls, metrics };
}
