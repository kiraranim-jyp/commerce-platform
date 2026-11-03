import {
  buildCompositeDiscoveryQuery,
  buildDiscoverySearchQuery,
} from "@commerce/crawler/src/discovery-core/query-planner";
import type { ProductIdentity } from "@commerce/crawler/src/discovery-core/types";
import type { ProductIdentityDna } from "@commerce/shared";

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
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-SUPPLY — **1 → 2 페이지**(CPO 결정 2026-11-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 과금 단위가 **검색 페이지** 라 이 숫자가 곧 비용이다. 그래서 **2 로 고정** 하고
 *    **질의 수는 늘리지 않는다**(`MAX_SEARCHES_PER_PRODUCT = 1` 유지).
 *
 * 🔴 **왜 1 로는 부족한가 — 실측이다**(저장분 `search-provider-05-raw` S1 전수):
 * ```
 * 질의 1회가 돌려준 URL   최대 **10** · 중위 **9** · 최소 0
 * 그 수율을 대면 샵 대표가 **1~2곳** 이고 셀러에게 비교 재료가 없다
 * (같은 상품 33질의 합집합 159 → Crawl 41 → 샵 대표 21 이 「더 찾을 수 있다」의 증거다)
 * ```
 * 🔴 그 **159 를 운영 분모로 쓰지 않는다** — 33질의 합집합이고 운영은 1질의다.
 * 🔴 3페이지 이상은 **별도 비용 결정** 이다(CPO 명시) · 질의 variation 추가 **금지**.
 */
const MAX_PAGES_PER_QUERY = 2;
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
  /** 🔴 **중복 제거 «후»** 의 URL 수다 — 그 값이 다음 단계(후보 풀)의 입력 분모다. */
  organicResults: number;
  /**
   * 🔵🔵 SEARCH-SUPPLY — **페이지별 organic 수**(CPO 가 요구한 측정 칸).
   *
   * 🔴 그 전까지 계측이 **총합 하나** 뿐이라 「1페이지 → 2페이지로 늘려서 무엇이
   *    늘었는가」를 **구조적으로 답할 수 없었다**. 🟢 그래서 **페이지별 raw 수** 와
   *    **중복 제거 후** 를 같이 남긴다(「page 1 → page 2 → dedupe」 세 칸).
   * 🔴 주입구(`search`)로 돌 때는 페이지를 가를 근거가 없어 **한 칸** 이다.
   * 🟢 옵셔널이 아니다 — 비면 그 자체로 「측정 못 했다」가 되므로 **빈 배열** 로 둔다.
   */
  organicPerPage: number[];
  /** 🔴 provider 가 실제로 돌려준 **페이지 수**(요청한 상한과 다를 수 있다). */
  pagesReturned: number;
  /** 🔴 호출하지 않았다면 그 이유. 호출했으면 null. */
  skipped: WebSearchSkipReason | null;
  /** 🔴 호출했는데 실패했는가. 🔴 실패를 「결과 0」으로 적지 않기 위한 칸이다. */
  failed: boolean;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 SEARCH-FAILURE-OBSERVABILITY-01 — **왜 실패했는지를 «한 번» 으로 안다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 그 전까지 `catch` 가 오류를 **통째로 삼켰다**(`void err`) ⟹ 운영 로그에
   *    `failed:true` 만 남고 **timeout 인지 provider 오류인지 설정 문제인지 구분 불가** 였다.
   *    실측: B226AC017 운영 실행이 `failed:true · organic:0` 인데 **이유가 없었다.**
   *
   * 🔴🔴 **보안이 최우선이다.** 토큰이 **URL 에** 들어가는 호출이므로 아래를 **절대**
   *    남기지 않는다 — 토큰 · Authorization · 전체 header · **response body** ·
   *    URL · credential · cookie · **오류 message**.
   * 🟢 남기는 것은 **오류의 «종류»** 뿐이다(이름 · HTTP 상태 · 코드 · timeout 여부).
   */
  /** 🟢 `err.name`(예: `AbortError` · `TypeError`). 실패가 아니면 `null`. */
  errorName: string | null;
  /** 🟢 provider 가 준 **HTTP 상태코드**. 네트워크 단계 실패면 `null`. */
  errorStatus: number | null;
  /** 🟢 런타임 오류 코드(예: undici `UND_ERR_*`). 없으면 `null`. */
  errorCode: string | null;
  /** 🔴 **timeout 인가** — `TIMEOUT_MS` 로 우리가 끊은 경우 `true`. */
  timeout: boolean;
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

/**
 * 🔵 SEARCH-SUPPLY — **페이지별 수를 같이 돌려준다.** 🔴 URL 배열만 돌려주면
 *    「1페이지 → 2페이지로 무엇이 늘었는가」를 영원히 답할 수 없다(CPO 측정 요구).
 */
interface ApifySearchOutcome {
  urls: string[];
  /** 🔴 **중복 제거 «전»** 의 페이지별 raw 수. */
  perPage: number[];
}

/**
 * 🔵 SEARCH-FAILURE-OBSERVABILITY-01 — **상태코드를 «오류에 실어» 보낸다.**
 * 🔴 전에는 상태를 **message 문자열** 에만 담았는데, message 는 보안상 로그에 쓸 수 없다
 *    ⟹ 그래서 `failed:true` 만 남고 이유가 사라졌다. 🟢 칸으로 들고 간다.
 */
class SearchHttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    /** 🔴 message 에 **URL·본문을 넣지 않는다**(토큰이 URL 에 있다). */
    super(`search HTTP ${status}`);
    this.name = "SearchHttpError";
    this.status = status;
  }
}

async function apifySearch(query: string, token: string): Promise<ApifySearchOutcome> {
  const controller = new AbortController();
  /** 🔴 **우리가 끊었는지** 를 구분한다 — provider 가 끊은 것과 섞이면 CASE T 를 못 가른다. */
  let abortedByTimeout = false;
  const timer = setTimeout(() => {
    abortedByTimeout = true;
    controller.abort();
  }, TIMEOUT_MS);
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
    if (!res.ok) throw new SearchHttpError(res.status);
    const items = (await res.json()) as ApifySearchItem[];
    /**
     * ════════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 SEARCH-SUPPLY — **`items[0]` 만 읽으면 2페이지가 버려진다**
     * ════════════════════════════════════════════════════════════════════════
     *
     * 🔴 provider 는 **페이지당 item 하나** 를 돌려준다. 그래서 `maxPagesPerQuery` 만
     *    2 로 올리고 이 줄을 그대로 두면 **변경이 no-op** 이다(비용만 늘고 후보는 그대로).
     * 🟢 그래서 **모든 item 의 `organicResults` 를 이어 붙인다.**
     * 🔴 **질의는 여전히 하나다** — 페이지를 합치는 것이지 검색을 늘리는 것이 아니다.
     * 🔴 **순서를 유지한다**(1페이지가 먼저) · 같은 URL 은 **한 번만** 싣는다 —
     *    뒤 단계(`collectUrlCandidatePool`)가 중복을 또 거르지만, 여기서 합치면서
     *    생기는 중복을 **분모에 넣지 않기** 위해서다(「Search 18」이 거짓이 되지 않게).
     */
    const seen = new Set<string>();
    const urls: string[] = [];
    /** 🔴 페이지별 raw 수를 **중복 제거 전에** 센다 — 그래야 「page1/page2/dedupe」가 갈린다. */
    const perPage: number[] = [];
    for (const item of items) {
      const page = item?.organicResults ?? [];
      perPage.push(page.length);
      for (const o of page) {
        const u = o.url;
        if (typeof u !== "string" || u.length === 0) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        urls.push(u);
      }
    }
    return { urls, perPage };
  } catch (err) {
    /** 🟢 우리가 끊은 abort 를 **timeout 으로 표식** 해서 올려 보낸다(이름만 바꾼다). */
    if (abortedByTimeout && err instanceof Error) {
      const e = new Error("search timeout");
      e.name = "SearchTimeoutError";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 🔵 SEARCH-FAILURE-OBSERVABILITY-01 — **안전 정규화.**
 * 🔴 `message` 를 **쓰지 않는다** — URL·본문·토큰이 섞여 들어올 수 있다.
 * 🟢 쓰는 것은 넷뿐이다 — 이름 · HTTP 상태 · 런타임 코드 · timeout 여부.
 */
function describeSearchError(err: unknown): {
  errorName: string | null;
  errorStatus: number | null;
  errorCode: string | null;
  timeout: boolean;
} {
  const e = err as { name?: unknown; code?: unknown; status?: unknown; cause?: { code?: unknown } } | null;
  const name = typeof e?.name === "string" ? e.name : null;
  const status = typeof e?.status === "number" ? e.status : null;
  /** 🟢 undici 는 `cause.code`(예: `UND_ERR_*`)에 실린다 — 기존 WU-084 와 같은 자리다. */
  const code =
    typeof e?.code === "string" ? e.code : typeof e?.cause?.code === "string" ? e.cause.code : null;
  return {
    errorName: name,
    errorStatus: status,
    errorCode: code,
    timeout: name === "SearchTimeoutError" || name === "AbortError" || code === "UND_ERR_HEADERS_TIMEOUT",
  };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT4-GATE-01 — **「DNA → Search identity」 owner 를 하나로 만든다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 옮겼나** — 이 「칸 옮기기」가 **운영 라우트 안에만** 있었다. 그래서
 *    「운영이 실제로 무슨 질의를 보내는가」를 확인하려면 하니스가 그 블록을
 *    **베껴야** 했고(`search-supply-02` 가 그 모양이다), **베낀 하니스는 운영이
 *    칸 하나를 빠뜨리는 순간 그것을 보지 못한다.**
 *    🔴 그 사고가 실제로 났다 — QUERY-ARCH-01 이 `productName`/`color` 를 **null 로
 *    보내고 있었고** 질의가 **품번 하나** 로 쪼그라들었다(E2E-HISTORY-10 이 「10건 중
 *    8건 `NO_MODEL_CODE`」로 그 결과를 실측했다). 조립기는 그때도 정상이었다.
 * 🟢 그래서 **운영과 하니스가 같은 함수** 를 부른다 — 이제 질의 증명이 **베끼기 없이**
 *    된다(Sprint 4 Gate C1 「선언값이 아니라 실제 전달값」).
 *
 * 🔴 **동작은 바뀌지 않는다** — 기존 블록을 **칸·순서·null 정책 그대로** 옮겼다.
 * 🔴 **지어내지 않는다** — 전부 원본에서 실제로 읽힌 값(`dna`)이다.
 * 🔴 `size`/`genderAge`/`season` 은 **보내지 않는다** — denylist 가 노이즈로 판정한 축이다.
 *
 * ── 🔴🔴 Market neutrality — **시장을 Search 에 넘기지 않는다** ──────────────
 * ```
 * sourceSite · sourceCountry · market 을 **항상 null** 로 둔다.
 * 입력 URL 이 국내든 해외든 **Search 시장을 좁히지 않는다** —
 * 「국내 URL 이면 국내만 / 해외 URL 이면 해외만」은 **제품 전략 위반** 이다.
 * 🟢 계약이 이 셋을 직접 단언하고, 질의가 그 값에 **반응하지 않는 것** 까지 단언한다.
 * ```
 */
export function webSearchIdentityFromDna(dna: ProductIdentityDna, sourceUrl: string): ProductIdentity {
  return {
    brand: dna.brand.value || null,
    /** 🟢 디자인명의 원천. 조립기가 denylist 로 코어 토큰만 남긴다. */
    productName: dna.title || null,
    productType: dna.category?.value ?? null,
    genderAge: null,
    color: dna.color,
    size: null,
    season: null,
    productCode: dna.brandModelCode,
    /** 🔴 상세설명 유래 사실 — 관측된 것만(없으면 빈 배열이고 질의에서 생략된다). */
    facts: [dna.material, dna.fit].filter((v): v is string => Boolean(v)),
    sourceUrl,
    /** 🔴🔴 **시장을 넘기지 않는다**(위 Market neutrality). */
    sourceSite: null,
    sourceCountry: null,
    market: null,
  };
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
    organicPerPage: [],
    pagesReturned: 0,
    skipped: null,
    failed: false,
    errorName: null,
    errorStatus: null,
    errorCode: null,
    timeout: false,
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

  /**
   * 🔵 SEARCH-SUPPLY — 주입구는 **URL 배열** 그대로 받는다(기존 계약 유지).
   *    🔴 그때는 페이지를 가를 근거가 없으므로 `perPage` 를 **한 칸** 으로 둔다 —
   *       지어내지 않고 「가를 수 없었다」를 모양으로 남긴다.
   */
  const run: (q: string) => Promise<ApifySearchOutcome> = input.search
    ? async (q: string) => {
        const got = await input.search!(q);
        return { urls: got, perPage: [got.length] };
      }
    : (q: string) => apifySearch(q, token);
  let urls: string[] = [];
  try {
    metrics.searches = MAX_SEARCHES_PER_PRODUCT;
    const out = await run(query);
    /**
     * 🔴🔴 **중복 제거는 «여기» 가 owner 다.** 1차에 provider 파서 안에만 뒀더니
     *    주입 경로에서 중복이 분모에 남아 **「organicResults = 중복 제거 후」가 거짓**
     *    이 됐다(계약 SS-02-d 가 그것을 FAIL 로 잡았다).
     * 🟢 그래서 **경로와 무관하게** 한 번 더 접는다 — 멱등이고 순서를 유지한다.
     */
    urls = [...new Set(out.urls)];
    /** 🔴 **중복 제거 후** 가 다음 단계의 입력 분모다. */
    metrics.organicResults = urls.length;
    metrics.organicPerPage = out.perPage;
    metrics.pagesReturned = out.perPage.length;
  } catch (err) {
    /**
     * 🔴🔴 실패를 **빈 결과로 바꾸지 않는다.** `failed: true` 가 남아야
     *    「그 상품은 웹에 없다」라는 거짓 결론이 보고에 들어가지 않는다.
     * 🔴 오류 «메시지» 는 남기지 않는다 — 토큰이 URL 에 있는 호출이라 안전측으로 간다.
     */
    metrics.failed = true;
    /**
     * 🔵 SEARCH-FAILURE-OBSERVABILITY-01 — **삼키지 않는다.**
     * 🔴 `void err` 였다 ⟹ 운영에서 `failed:true` 만 남고 **이유가 사라졌다**.
     * 🟢 **오류의 종류만** 남긴다(이름·상태·코드·timeout) — message/body/URL 0.
     */
    Object.assign(metrics, describeSearchError(err));
    return { urls: [], metrics };
  }
  return { urls, metrics };
}
