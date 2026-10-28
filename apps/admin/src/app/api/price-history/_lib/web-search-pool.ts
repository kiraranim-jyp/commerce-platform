import {
  buildCompositeDiscoveryQuery,
  buildDiscoverySearchQuery,
} from "@commerce/crawler/src/discovery-core/query-planner";
import type { ProductIdentity } from "@commerce/crawler/src/discovery-core/types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🟢🟢🟢 SEARCH-PROVIDER-07 — **외부 Search Provider 를 «상품당 1회» 부른다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-27) — 최종 Discovery Query 는 **`"{MODEL_CODE}"` 하나** 이고
 * **1 Product = 1 Search** 다. 그 근거는 SPRINT-05/06 실측이다(품번 정확 일치만
 * 상품 4개 전부에서 국내+해외를 **같이** 냈다).
 *
 * ── 🔴 이 파일이 «하지 않는» 것 ────────────────────────────────────────────
 * ```
 * ❌ 후보 생성 · fetch · 판정 — 산출은 **URL 목록 뿐** 이다
 *    (후보 생성은 기존 `collectUrlCandidatePool` 이 한다 · CORE-2R-4 와 같은 패턴)
 * ❌ 2차 Search — 결과가 적어도 **다시 부르지 않는다**(CPO §7 특히 금지)
 * ❌ 질의 fallback — 품번이 없으면 **검색하지 않는다**(브랜드/상품명으로 대신하지 않는다)
 * ❌ 국내/해외 분리 질의 · 한글 질의 · 언어 유도
 * ❌ 재시도 — 실패는 **실패로 적는다**(「결과 0」으로 적지 않는다)
 * ❌ 토큰을 로그/응답/오류 메시지에 **싣지 않는다**
 * ```
 *
 * ── 🔴🔴 「키가 없다」와 「결과가 없다」를 가른다 ───────────────────────────
 * ```
 * 토큰이 없으면 `notConfigured: true` 이고 **URL 은 빈 배열** 이다. 🔴 그 상태를
 * 「웹에 동일상품이 없다」로 읽으면 안 된다 — **못 물어본 것** 이다.
 * (메모 `absence-requires-execution` · GOLF-01.5-C 와 같은 규약)
 * ```
 */

/** 🔴 공급자 고정 — 이 WU 의 범위는 「연결」이고 provider 선택이 아니다. */
const ACTOR = "apify~google-search-scraper";
const ENDPOINT = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`;

/**
 * 🔴 **상품당 1회.** 이 상수를 올리는 것은 「1 Product = 1 Search」 계약을 깨는 일이고
 *    CPO 결정 사안이다(계약 테스트가 이 값을 직접 단언한다).
 */
export const MAX_SEARCHES_PER_PRODUCT = 1;
/** 🔴 1 페이지만 받는다 — 과금 단위가 **검색 페이지** 다. */
const MAX_PAGES_PER_QUERY = 1;
const RESULTS_PER_PAGE = 20;
/** 🔴 외부 호출이 오래 끌면 셀러 화면이 멈춘다 — 끊고 「실패」로 적는다. */
const TIMEOUT_MS = 60_000;

export type WebSearchSkipReason =
  /** 🔴 품번이 없어 질의를 만들지 않았다(fallback 금지). */
  | "NO_MODEL_CODE"
  /** 🔴 **못 물어봤다** — 「결과 없음」이 아니다. */
  | "NOT_CONFIGURED";

export interface WebSearchPoolMetrics {
  /** 🔴 실제로 보낸 검색 요청 수. **계약상 0 또는 1** 이다. */
  searches: number;
  /** 🟢 보낸 질의 문자열 그대로(없으면 null). 토큰은 들어가지 않는다. */
  query: string | null;
  /** 검색이 돌려준 organic 결과 수(중복 포함). */
  organicResults: number;
  /** 🔴 호출하지 않았다면 그 이유. 호출했으면 null. */
  skipped: WebSearchSkipReason | null;
  /** 🔴 호출했는데 실패했는가. 🔴 실패를 「결과 0」으로 적지 않기 위한 칸이다. */
  failed: boolean;
}

export interface WebSearchPoolResult {
  /** 🟢 그대로 `collectUrlCandidatePool` 에 넘길 수 있는 URL 목록. */
  urls: string[];
  metrics: WebSearchPoolMetrics;
}

interface ApifySearchItem {
  organicResults?: { url?: string }[];
}

export interface WebSearchPoolInput {
  identity: ProductIdentity;
  /** 🟢 테스트 주입점. 운영은 기본값(실제 HTTP). */
  search?: (query: string) => Promise<string[]>;
  /** 🟢 테스트 주입점 — 운영은 `process.env.APIFY_API_TOKEN`. */
  token?: string | null;
  /**
   * 🔴🔴 **측정 전용 훅**(QUERY-SIGNAL-AB · CPO 2026-10-29) — 같은 10개 상품으로
   *    **판매처 신호 두 개** 를 비교하기 위한 자리다.
   *
   * 🔴 **운영 호출부는 넘기지 않는다** ⟹ 안 넘기면 **오늘 동작 그대로** 다.
   * 🔴 Query **구조/개수** 는 바뀌지 않는다 — 신호 문자열 하나만 갈아 끼운다.
   *    **1 Product = 1 Search** 는 그대로다(`MAX_SEARCHES_PER_PRODUCT = 1`).
   */
  signal?: string | null;
}

async function apifySearch(query: string, token: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: query,
        maxPagesPerQuery: MAX_PAGES_PER_QUERY,
        resultsPerPage: RESULTS_PER_PAGE,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
      }),
      signal: controller.signal,
    });
    /** 🔴 **토큰이 URL 에 있으므로 `res.url`/오류 본문을 로그에 싣지 않는다.** */
    if (!res.ok) throw new Error(`search HTTP ${res.status}`);
    const items = (await res.json()) as ApifySearchItem[];
    return (items[0]?.organicResults ?? [])
      .map((o) => o.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 품번 정확 일치 질의를 **1회** 보내고 URL 목록을 돌려준다.
 *
 * 🔴 **throw 하지 않는다.** 검색 실패가 국내 가격확인 전체를 죽이지 않는다
 *    (`collectOverseasAutoPool` 과 같은 fail-soft 패턴).
 */
export async function collectWebSearchUrls(input: WebSearchPoolInput): Promise<WebSearchPoolResult> {
  const metrics: WebSearchPoolMetrics = {
    searches: 0,
    query: null,
    organicResults: 0,
    skipped: null,
    failed: false,
  };

  /** ① 🔴 질의 owner 는 **하나** 다 — 여기서 문자열을 조립하지 않는다. */
  /**
   * 🔴 Query owner 는 **여전히 하나** 다 — 신호 교체도 그 owner 안에서 일어난다.
   *    🟢 `signal` 을 안 넘기면 `buildDiscoverySearchQuery` 와 **같은 문자열** 이다.
   */
  const query = input.signal
    ? buildCompositeDiscoveryQuery(input.identity, { signal: input.signal }).text
    : buildDiscoverySearchQuery(input.identity);
  if (!query) {
    metrics.skipped = "NO_MODEL_CODE";
    return { urls: [], metrics };
  }
  metrics.query = query;

  const token = (input.token ?? process.env.APIFY_API_TOKEN ?? "").trim();
  if (!input.search && !token) {
    /** 🔴 **못 물어봤다.** 「웹에 없다」가 아니다. */
    metrics.skipped = "NOT_CONFIGURED";
    return { urls: [], metrics };
  }

  const run = input.search ?? ((q: string) => apifySearch(q, token));
  let urls: string[] = [];
  try {
    metrics.searches = MAX_SEARCHES_PER_PRODUCT;
    urls = await run(query);
    metrics.organicResults = urls.length;
  } catch (err) {
    /**
     * 🔴🔴 실패를 **빈 결과로 바꾸지 않는다.** `failed: true` 가 남아야
     *    「그 상품은 웹에 없다」라는 거짓 결론이 보고에 들어가지 않는다.
     * 🔴 오류 «메시지» 는 남기지 않는다 — 토큰이 URL 에 있는 호출이라 안전측으로 간다.
     */
    metrics.failed = true;
    void err;
    return { urls: [], metrics };
  }
  return { urls, metrics };
}
