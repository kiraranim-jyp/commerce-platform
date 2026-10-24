import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2F — **국내 판매처 목록/sitemap → 상품 상세 URL 1-hop**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「AI Search 가 국내 판매처를 발견했을 때 **브랜드 목록/검색
 * 결과 페이지에서 실제 상품 상세 URL 까지 확보** 하여 기존 Pipeline 에 넣을 수 있게
 * 한다」 · 「**새 검색 API 를 만들지 않는다**」.
 *
 * ── 🔴🔴 URL 을 «지어내지» 않는다 — 출처가 둘뿐이다 ────────────────────────
 * ```
 * ⒜ 그 사이트의 공식 **`sitemap.xml`**(sitemaps.org 표준 · robots 가 가리키는 그 파일)
 * ⒝ 진입 페이지 HTML 의 **실제 `href`**
 * 🔴 경로를 **추측해 만들지 않는다**(`/product/<code>` 같은 조합 금지)
 * 🔴 **샵 내부 검색을 구현하지 않는다** — `search.html` 류는 robots 가 막는 곳도 있다
 * ```
 *
 * ── 🔴 robots 를 «먼저» 본다(WU-154 의 보몽드 선례) ──────────────────────
 * ```
 * 🔴 `Disallow: /` 면 **아무것도 하지 않는다**(보몽드가 그 경우다 · 어댑터를 폐기한 이유).
 * 🔴 요청하려는 경로가 Disallow 에 걸리면 **그 경로를 쓰지 않는다**.
 * 🟢 실측(2026-10-23) — `donokids.com` **Allow: /** · `miniboutique.co.kr` 은
 *    관리·주문·`search.html` 만 금지(상품/목록 허용).
 * ```
 *
 * ── 🔴🔴 이 모듈이 «하지 않는» 것 ────────────────────────────────────────
 * ```
 * 🔴 **운영 호출부가 0 이다**(`query-planner` 선례) — 측정이 먼저고 배선은 CPO 결정이다
 * 🔴 **MI·가격·시장 분류를 건드리지 않는다** — URL 문자열만 고른다
 * 🔴 「국내 사이트니까 KRW」 같은 **시장 추정을 하지 않는다**(CPO 절대 금지)
 * 🔴 **목록을 전부 밀어넣지 않는다** — 품번이 **slug 에 있는** 것만 고른다
 *    (WU-121 이 측정한 그 함정: 목록 href 를 그대로 쓰면 SNS·기프트카드가 섞인다)
 * 🟢 fetch 는 **기존 owner** `fetchPlainHtml` 하나다 — SSRF/DNS 가드(WU-025/026)와
 *    429 폴백(WU-084)을 그대로 지난다. 새 fetch 스택을 만들지 않는다.
 * ```
 */

/** 🔴 한 진입점에서 검사할 링크 상한 — 목록이 커도 메모리/로그가 터지지 않게. */
export const LISTING_LINK_LIMIT = 5000;
/** 🔴 고를 상세 URL 상한 — 같은 품번이 색상별로 여러 개일 수 있다. */
export const DETAIL_PICK_LIMIT = 10;
/**
 * 🔴 품번이 **이보다 짧으면 고르지 않는다** — 짧은 토큰은 slug 어디에나 끼어
 *    오탐을 만든다(기존 `slugCarriesCode` 가 쓰는 것과 **같은 기준** 이다).
 */
export const MIN_CODE_LENGTH = 4;

/**
 * 🟢 **순수 선별기** — 링크 목록에서 품번이 들어간 것만 고른다.
 *
 * 🔴 **URL 을 만들지 않는다** — 받은 문자열 중에서 고르기만 한다.
 * 🔴 `http(s)` 가 아닌 것은 버린다 · 중복 제거 · 상한 적용.
 */
export function pickDetailUrlsForCode(links: readonly string[], code: string | null | undefined): string[] {
  const needle = (code ?? "").trim().toLowerCase();
  if (needle.length < MIN_CODE_LENGTH) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of links.slice(0, LISTING_LINK_LIMIT)) {
    if (!/^https?:\/\//i.test(raw)) continue;
    if (!raw.toLowerCase().includes(needle)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= DETAIL_PICK_LIMIT) break;
  }
  return out;
}

/** 🟢 `<loc>` 만 읽는다 — sitemaps.org 표준 칸이다. */
export function extractSitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/** 🟢 진입 페이지의 실제 `href` 를 절대 URL 로 만든다. 🔴 없는 링크를 만들지 않는다. */
export function extractHrefs(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].replace(/&amp;/g, "&").trim();
    if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) continue;
    try {
      out.push(new URL(raw, baseUrl).toString());
    } catch {
      /* 깨진 href 는 버린다 */
    }
  }
  return out;
}

/**
 * 🔴 **robots 판정은 보수적으로** 한다 — 「모르면 허용」이 아니라 「전면 금지면 멈춘다」다.
 *
 * 🟢 `User-agent: *` 블록만 본다(우리는 특정 UA 를 주장하지 않는다).
 * 🔴 전체 금지(`Disallow: /`)면 **false** 다. 그 외는 경로별로 호출부가 본다.
 * 🔴 robots 를 못 받으면 **`null`**(모른다) — 「허용」으로 적지 않는다.
 */
export function robotsAllowsAll(robotsTxt: string): boolean {
  let inStar = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    /**
     * 🔴🔴 **값 뒤의 주석을 벗긴다** — RFC 9309 가 허용하는 모양이다.
     *
     * 🔴 1차 구현은 이것을 안 했고, **변이 계약이 그 결함을 찾았다**: 사이트가
     *    `Disallow: /  # block all` 로 적으면 `trim()` 이 `"/  # block all"` 이 되어
     *    `=== "/"` 가 false ⟹ **전면 금지를 「허용」으로 읽는다.**
     * 🔴 그 방향의 오류는 **위험하다**(건드리면 안 되는 사이트를 긁는다) ⟹ 고쳤다.
     */
    const t = rawLine.split("#")[0].trim();
    if (!t) continue;
    const ua = /^user-agent\s*:\s*(.+)$/i.exec(t);
    if (ua) {
      inStar = ua[1].trim() === "*";
      continue;
    }
    if (!inStar) continue;
    const dis = /^disallow\s*:\s*(.*)$/i.exec(t);
    if (dis && dis[1].trim() === "/") return false;
  }
  return true;
}

export interface ListingHopResult {
  host: string;
  /** 🔴 `null` = robots 를 못 받았다(모른다). 「허용」과 구분한다. */
  robotsAllowed: boolean | null;
  /** 어디서 링크를 얻었는가 — 추측이 아니라 **출처** 다. */
  source: "SITEMAP" | "LISTING_HTML" | "NONE";
  linkCount: number;
  detailUrls: string[];
  httpCalls: number;
  /** 🔴 막혔으면 **어디서** 막혔는지 적는다(조용히 0 을 돌려주지 않는다). */
  note: string | null;
  /**
   * 🔴🔴 CORE-2R-4 — **이미 받은 진입 페이지 HTML 을 돌려준다**(추가 필드 · 기존 칸 불변).
   *
   * 왜: 2-hop(목록 **텍스트** 선별)은 같은 HTML 을 다시 봐야 하는데, 호출부가
   * 그것을 **한 번 더 fetch** 하면 사이트마다 HTTP 가 1회씩 더 늘어난다.
   * 🟢 이 칸은 **아무 판정도 하지 않는다** — 이미 쓴 응답을 버리지 않을 뿐이다.
   * 🔴 진입 페이지를 받지 못했거나 sitemap 에서 끝났으면 `null` 이다.
   */
  entryHtml: string | null;
}

/**
 * 🟢 진입점 하나를 상세 URL 로 확장한다.
 *
 * 🔴 순서 — ① robots ② **sitemap 먼저**(HTTP 1회로 전 상품을 본다) ③ 없으면 목록 HTML.
 * 🔴 **페이지네이션을 따라가지 않는다** — 이번 범위는 1-hop 이다(WU-163 이 그 축을 따로 쟀다).
 */
export async function expandDomesticListing(entryUrl: string, code: string | null): Promise<ListingHopResult> {
  let host = "";
  let origin = "";
  try {
    const u = new URL(entryUrl);
    host = u.hostname.replace(/^www\./i, "").toLowerCase();
    origin = u.origin;
  } catch {
    return { host: "", robotsAllowed: null, source: "NONE", linkCount: 0, detailUrls: [], httpCalls: 0, note: "ENTRY_URL_INVALID", entryHtml: null };
  }

  let httpCalls = 0;
  /** ① robots — 🔴 전면 금지면 **아무것도 하지 않는다**. */
  httpCalls += 1;
  const robots = await fetchPlainHtml(`${origin}/robots.txt`);
  const robotsAllowed = robots == null ? null : robotsAllowsAll(robots);
  if (robotsAllowed === false) {
    return { host, robotsAllowed, source: "NONE", linkCount: 0, detailUrls: [], httpCalls, note: "ROBOTS_DISALLOW_ALL — 이 사이트는 건드리지 않는다", entryHtml: null };
  }

  /** ② sitemap 먼저 — 🟢 HTTP **1회** 로 그 샵의 상품 URL 전체를 본다. */
  httpCalls += 1;
  const sitemap = await fetchPlainHtml(`${origin}/sitemap.xml`);
  if (sitemap && /<loc>/i.test(sitemap)) {
    const locs = extractSitemapLocs(sitemap);
    const picked = pickDetailUrlsForCode(locs, code);
    if (picked.length > 0) {
      return { host, robotsAllowed, source: "SITEMAP", linkCount: locs.length, detailUrls: picked, httpCalls, note: null, entryHtml: null };
    }
    /** 🔴 sitemap 은 있는데 품번이 없다 — 그 사실을 적는다(「상세 URL 0」의 **이유**). */
    const note = `SITEMAP_HAS_NO_CODE — loc ${locs.length}건 중 품번 일치 0`;
    /** 🟢 그래도 ③ 을 시도한다 — 목록 HTML 에는 있을 수 있다. */
    httpCalls += 1;
    const html = await fetchPlainHtml(entryUrl);
    if (!html)
      return {
        host,
        robotsAllowed,
        source: "SITEMAP",
        linkCount: locs.length,
        detailUrls: [],
        httpCalls,
        note: `${note} · LISTING_UNREACHABLE`,
        entryHtml: null,
      };
    const hrefs = extractHrefs(html, entryUrl);
    const picked2 = pickDetailUrlsForCode(hrefs, code);
    return {
      host,
      robotsAllowed,
      source: picked2.length > 0 ? "LISTING_HTML" : "SITEMAP",
      linkCount: locs.length + hrefs.length,
      detailUrls: picked2,
      httpCalls,
      note: picked2.length > 0 ? note : `${note} · LISTING_HREF ${hrefs.length}건 중에도 품번 일치 0`,
      entryHtml: html,
    };
  }

  /** ③ sitemap 이 없다 — 목록 HTML 의 실제 href 를 본다. */
  httpCalls += 1;
  const html = await fetchPlainHtml(entryUrl);
  if (!html) {
    return {
      host,
      robotsAllowed,
      source: "NONE",
      linkCount: 0,
      detailUrls: [],
      httpCalls,
      note: "NO_SITEMAP · LISTING_UNREACHABLE",
      entryHtml: null,
    };
  }
  const hrefs = extractHrefs(html, entryUrl);
  const picked = pickDetailUrlsForCode(hrefs, code);
  return {
    host,
    robotsAllowed,
    source: picked.length > 0 ? "LISTING_HTML" : "NONE",
    linkCount: hrefs.length,
    detailUrls: picked,
    httpCalls,
    note:
      picked.length > 0
        ? null
        : `NO_SITEMAP · LISTING_HREF ${hrefs.length}건 중 품번 일치 0 — 목록에 품번이 적혀 있지 않다(상세를 열어야 안다)`,
    entryHtml: html,
  };
}
