/**
 * 🔴 WU-025 — outbound 경계는 **깊은 경로로** 가져온다. barrel(`@commerce/crawler`)에
 *    올리면 `node:dns` 가 클라이언트 번들로 끌려가 **빌드가 깨진다**(실측).
 *    🟢 이 파일은 서버 전용(API route `_lib`)이라 깊은 import 가 안전하다.
 */
import { classifyOutboundUrl } from "@commerce/crawler/src/utils/outbound-guard";
import {
  canonicalizeProductUrl,
  extractCandidateUrlsFromAiAnswer,
  factsFromProductUrl,
  type AiUrlDropReason,
  type ComparisonCandidate,
  type ComparisonSearchResult,
  type ProductUrlFactsResult,
  type ProductUrlFactsStatus,
} from "@commerce/crawler";
import {
  groupCandidatesByHost,
  TRANSIENT_URL_SHOP_ID,
  TRANSIENT_URL_SHOP_NAME,
} from "./transient-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-024 — **Registry 밖 후보 URL 을 일시 pipeline 에 공급하는 생산자**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **AI 가 아니다.** 이 모듈은 provider 를 부르지 않는다 — Gemini/OpenAI/
 *    Search API 호출 **0** · 키 **0** · 비용 **0**. 입력은 **URL 목록 하나** 다.
 *
 * ── 이 모듈이 푸는 문제 ─────────────────────────────────────────────────────
 * WU-023 이 확정한 병목:
 *   · 🟢 소비자(`run-domestic-price-check` 의 일시 분기)는 **Registry 를 요구하지 않는다**
 *   · 🔴 그런데 생산자가 `collectGeminiCandidatePool` 하나뿐이고 그 함수는
 *        `dna` 를 받아 **스스로 Gemini 를 호출** 한다 → 후보 URL 을 넣을 칸이 없다
 *
 * 그래서 **Gemini 호출 뒤 구간만** 떼어 같은 산출물을 내는 생산자를 하나 더 둔다.
 * Gemini 경로의 `discovery.urls` 이후 흐름과 **같은 함수들** 을 같은 순서로 쓴다:
 * ```
 * URL 목록 → extractCandidateUrlsFromAiAnswer   입력 경계(순수 · HTTP 0)
 *          → isPubliclyRoutableHttpUrl          🔴 서버측 fetch 안전 경계
 *          → factsFromProductUrl                페이지를 **열어** 사실을 읽는다
 *          → groupCandidatesByHost              host 별 ComparisonSearchResult
 *          → (호출부) withConfidence → judgeDomesticCandidate → 기존 MI
 * ```
 *
 * 🔴 **새 판정 규칙 0 · 새 상태 어휘 0 · 새 정규화기 0 · 새 추출기 0.**
 *    제외 사유는 기존 두 어휘(`AiUrlDropReason` + `ProductUrlFactsStatus`)의
 *    합집합이고, 여기서 추가하는 것은 **보안 경계 하나**(`NOT_PUBLIC_HOST`)뿐이다.
 *
 * 🔴 **점수를 매기지 않는다.** `withConfidence` 는 호출부가 **배열 단위 1회** 부른다
 *    (Gemini 경로와 같은 자리 · 두 번 부르면 정렬/`priceStatus` 가 갈린다).
 *
 * ── 🔴 `extractCandidateUrlsFromAiAnswer` 를 쓰는 이유 (이름이 AI 인데도) ──────
 *    그 함수의 계약은 **「텍스트에서 URL 만 꺼낸다」** 이고 AI 의 주장은 한 글자도
 *    읽지 않는다(그 파일 머리 주석이 그렇게 적어 뒀다). 우리가 넘기는 것은 줄바꿈으로
 *    이은 URL 목록이다. 🔴 **사본을 만들지 않기 위해** 그 함수를 쓴다 — 거기에는
 *    이미 `canonicalizeProductUrl`(WU-009C) · `isSelfReferenceCandidate`(008A) ·
 *    `classifyUrlShape` 세 경계가 **검증된 순서로** 들어 있고, 손으로 다시 적으면
 *    그 셋이 갈라진다. 🟢 그래서 **AI 전제를 제거한 채 코드만 재사용** 한다.
 */

/** 🔴 제외된 URL 과 이유. 기존 두 어휘 + **보안 경계 하나.** */
export type UrlCandidateDropReason =
  | AiUrlDropReason
  | ProductUrlFactsStatus
  /** 🔴 공개 인터넷으로 라우팅되지 않는 호스트(사설/루프백/링크로컬/비표준 포트). */
  | "NOT_PUBLIC_HOST"
  /** 🔴 호출부가 이미 같은 상품을 후보로 갖고 있다 — HTTP 를 쓰지 않는다. */
  | "ALREADY_CANDIDATE"
  /**
   * 🔴🔴🔴 POLICY-GATE-01 — **그 사이트는 자동수집 대상이 아니다**(약관).
   *
   * 등록부(`domestic_price_sources.collection_strategy`)가 `NOT_AVAILABLE` 인 사이트다.
   * 🔴 「URL 을 못 찾았다」가 **아니다** — 찾았고 **일부러 열지 않았다**.
   * 🔴 그래서 `NOT_PRODUCT_PAGE`/`UNREACHABLE` 과 **같은 칸에 넣지 않는다**(원인이 다르다).
   */
  | "COLLECTION_NOT_AVAILABLE";

export interface UrlCandidateDrop {
  url: string;
  reason: UrlCandidateDropReason;
}

export interface UrlCandidatePoolInput {
  /** 🔴 셀러/운영이 공급한 후보 URL. **AI 가 만든 값이 아니다.** */
  urls: readonly string[];
  /** 원본 상품 URL — 자기참조 제거에 쓴다. 없으면 그 검사만 건너뛴다. */
  originUrl: string | null;
  /**
   * 🔴 페이지를 열어 볼 URL 수 상한. **임의 상한을 모듈에 박지 않는다** — 호출부가
   *    준다(`gemini-candidate-pool` §9 와 같은 규약). 상한을 넘은 URL 은 조용히
   *    버리지 않고 `notFetchedOverLimit` 에 남긴다.
   */
  maxUrls: number;
  /**
   * 기존 후보의 `canonicalizeProductUrl` 키(소문자) — 중복 fetch 를 막는다.
   * 🔴 `normalizeCandidateUrl`(쿼리 전체 제거) 키를 쓰지 «않는다» — 국내 Cafe24 계열은
   *    식별자가 쿼리에 있어서 서로 다른 상품이 한 키로 접힌다(leaf 모듈 주석).
   */
  existingCanonicalUrls: ReadonlySet<string>;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 POLICY-GATE-01 — **자동수집이 «금지» 된 사이트의 도메인 집합**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * CPO 확정(2026-10-28): 「수집 가능 여부는 **어디서 URL 을 발견했는가** 가 아니라
   * **어떤 사이트인가** 를 기준으로 **동일하게** 적용한다.」
   *
   * 🔴 그 전까지 비대칭이 실재했다 — 등록부 검색은 `collection_strategy` 게이트를
   *    지나는데(`comparison-search/index.ts:285`) **이 풀은 지나지 않아서**,
   *    `NOT_AVAILABLE` 인 `11st.co.kr` 을 AI Search 경로로 **실제로 크롤하고 있었다**
   *    (E2E-06/08 실측).
   *
   * 🔴 **`NOT_AVAILABLE` 만 넣는다.** `MANUAL` 은 「약관 금지」가 아니라 **「아직
   *    조사하지 않았다」** 이고(메모 `manual-means-uninvestigated-not-uncollectable`),
   *    넣으면 danawa 같은 **정상 후보가 사라진다**.
   * 🔴 값은 **등록부 도메인 그대로** 다 — 여기서 정책을 «해석» 하지 않는다.
   * 🟢 비우면 **오늘 동작 그대로** 다(기존 호출부 무영향).
   */
  notAvailableDomains?: ReadonlySet<string>;
  /**
   * 🟢 테스트/측정용 주입구. 기본값이 **운영 함수** 다 — 하니스가 운영과 다른 경로를
   *    타지 않게 기본을 운영으로 두는 것이 이 저장소의 방식이다
   *    (`judgeDomesticCandidate` 의 `fetchModelCode` 와 같은 모양).
   */
  fetchFacts?: (url: string) => Promise<ProductUrlFactsResult>;
  /**
   * 🔴🔴 WU-132 — **산출물에 달릴 일시 샵 id.** 기본값은 WU-024 의 그 값이므로
   *    기존 호출부와 계약은 **한 줄도 바뀌지 않는다**.
   *
   * 왜 열었나 — 이 모듈이 하는 일(「URL 목록을 열어 후보를 만든다」)은 **출처와
   * 무관** 한데, 산출물의 출처 배지는 `shopId` 로 갈린다. 「셀러가 붙여넣은 URL」과
   * 「이전에 동일상품으로 판단한 URL」은 **다른 사실** 이라 같은 배지를 달면 화면이
   * 거짓을 말한다(§7 출처 보존 · WU-130 이 세 번째 id 를 만든 그 이유).
   * 🔴 **저장 차단과는 무관하다** — 어느 값이든 `isTransientShopId` 가 막는다.
   *    여기서 열리는 것은 **화면이 읽는 출처** 하나다.
   */
  shopId?: string;
  shopNamePrefix?: string;
}

export interface UrlCandidatePoolMetrics {
  /** 분모 — 공급받은 URL 수(중복 포함). */
  suppliedUrls: number;
  /** 입력 경계를 통과해 **열어 볼 자격** 이 생긴 URL 수. */
  acceptedUrls: number;
  /** 🔴 실제로 페이지를 열어 사실을 읽은 수. */
  usableProductUrls: number;
  /** 🔴 MI 후보가 된 수(= 호출부로 넘어가는 후보 수). */
  miEligibleCandidates: number;
  /** 🔴 실제로 쓴 HTTP 요청 수(= 각 `factsFromProductUrl` 의 `httpCalls` 합). */
  fetchCalls: number;
  /** 🔴 `maxUrls` 때문에 **열어 보지 않은** URL. 「상품이 없다」가 아니다. */
  notFetchedOverLimit: string[];
  /** 🔴 제외된 것 전부 + 이유. 조용히 버리지 않는다. */
  dropped: UrlCandidateDrop[];
  /** 🟢 외부 AI/검색 provider 호출 수. **구조상 언제나 0** 이다. */
  providerCalls: 0;
}

export interface UrlCandidatePoolResult {
  /** 🟢 `searchResults` 에 그대로 append 할 수 있는 모양. 비면 호출부는 아무것도 안 한다. */
  searchResults: ComparisonSearchResult[];
  metrics: UrlCandidatePoolMetrics;
}

/**
 * 🔴🔴 **서버측 fetch 의 안전 경계 (SSRF) — 입력 단계의 «첫» 층.**
 *
 * 왜 필요한가 — 이 경로는 **사용자가 준 문자열로 서버가 HTTP 요청을 보낸다.**
 * 기존 입력 경계(`extractCandidateUrlsFromAiAnswer`)는 **URL 의 모양만** 보므로
 * `http://169.254.169.254/products/x` 가 `PRODUCT_PAGE` 로 분류된다.
 *
 * 🔴🔴 **WU-025 — 사설 IP 규칙을 여기서 «다시 적지 않는다».** WU-024 에서는 이 함수가
 *    자기 IP 판별을 들고 있었는데, 그러면 outbound 경계(crawler)와 **규칙이 둘** 이 되고
 *    한쪽만 고쳐진다. 🟢 지금은 **소유자 하나**(`classifyOutboundUrl`)를 호출한다.
 *
 * 🔴 이 층은 **DNS 를 보지 않는다**(순수 · 비용 0). 「정상 DNS 이름이 사설 IP 로
 *    해석되는」 경우와 「리다이렉트가 사설로 가는」 경우는 **요청 직전 층**
 *    (`assertPublicOutboundTarget` · `guardedLookup`)이 막는다. 🟢 두 층이 다 있다.
 * 🟢 그래도 이 층을 남기는 이유: 여기서 걸러야 **이유를 남기고 HTTP 를 0 으로** 끝낼 수 있다.
 */
export function isPubliclyRoutableHttpUrl(raw: string): boolean {
  return classifyOutboundUrl(raw).ok;
}

/**
 * 공급받은 URL → **점수 없는** 후보를 host 별로 묶은 `ComparisonSearchResult[]`.
 *
 * 🔴 **throw 하지 않는다.** 후보 하나의 실패가 나머지를 죽이지 않는다
 *    (`gemini-candidate-pool` 과 같은 격리 패턴).
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 POLICY-GATE-01 — **수집 정책 판정의 owner 는 «여기 하나» 다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 생산자마다 `if (webSearch) … if (registry) …` 로 **복제하지 않는다**(CPO §4).
 *    복제하면 다음 생산자에서 **또** 비대칭이 난다 — 그게 이 WU 가 생긴 이유다.
 * 🟢 그래서 **export** 한다 — Gemini 경로도 같은 술어를 쓴다(사본 0).
 * 🔴 URL 을 파싱할 수 없으면 **막지 않는다** — 그 자리는 이미 `NOT_PUBLIC_HOST` 가
 *    본다. 여기서 「모르면 차단」을 하면 정책이 아니라 **다른 게이트** 가 된다.
 */
export function isCollectionBlocked(url: string, notAvailableDomains?: ReadonlySet<string>): boolean {
  if (!notAvailableDomains || notAvailableDomains.size === 0) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const raw of notAvailableDomains) {
    const d = raw.trim().toLowerCase();
    if (!d) continue;
    if (host === d || host.endsWith(`.${d}`)) return true;
  }
  return false;
}

export async function collectUrlCandidatePool(input: UrlCandidatePoolInput): Promise<UrlCandidatePoolResult> {
  const fetchFacts = input.fetchFacts ?? factsFromProductUrl;
  const metrics: UrlCandidatePoolMetrics = {
    suppliedUrls: input.urls.length,
    acceptedUrls: 0,
    usableProductUrls: 0,
    miEligibleCandidates: 0,
    fetchCalls: 0,
    notFetchedOverLimit: [],
    dropped: [],
    providerCalls: 0,
  };
  if (input.urls.length === 0) return { searchResults: [], metrics };

  /* ① 입력 경계 — 기존 순수 함수. HTTP 0. 제외된 것도 이유가 남는다.
   *    🔴 `\n` 으로 이어 넘긴다: 그 함수는 **텍스트에서 URL 만** 본다(파일 머리 주석). */
  const extraction = extractCandidateUrlsFromAiAnswer(input.urls.join("\n"), input.originUrl);
  metrics.dropped.push(...extraction.dropped.map((d) => ({ url: d.url, reason: d.reason as UrlCandidateDropReason })));

  /* ② 🔴 보안 경계 + 중복 — **HTTP 를 쓰기 전에** 거른다. */
  const eligible: string[] = [];
  for (const url of extraction.urls) {
    if (!isPubliclyRoutableHttpUrl(url)) {
      metrics.dropped.push({ url, reason: "NOT_PUBLIC_HOST" });
      continue;
    }
    if (input.existingCanonicalUrls.has(canonicalizeProductUrl(url).toLowerCase())) {
      metrics.dropped.push({ url, reason: "ALREADY_CANDIDATE" });
      continue;
    }
    /**
     * 🔴🔴🔴 POLICY-GATE-01 — **약관 경계. HTTP «앞» 이다.**
     *    🔴 Search 가 그 URL 을 찾은 것 자체는 막지 않는다 — **여는 것** 만 막는다.
     *    🔴 매칭은 저장소의 기존 관용구 그대로다(`host === d || host.endsWith("." + d)`,
     *       `market-intelligence.ts:77` · `supported-sellers.ts:90` 과 같은 식) —
     *       새 규칙을 만들지 않는다.
     */
    if (isCollectionBlocked(url, input.notAvailableDomains)) {
      metrics.dropped.push({ url, reason: "COLLECTION_NOT_AVAILABLE" });
      continue;
    }
    eligible.push(url);
  }
  metrics.acceptedUrls = eligible.length;

  const targets = eligible.slice(0, Math.max(0, input.maxUrls));
  metrics.notFetchedOverLimit = eligible.slice(targets.length);

  /* ③ URL 별로 페이지를 **실제로 열어** 사실을 읽는다. */
  const collected: ComparisonCandidate[] = [];
  const seenDedupeKeys = new Set<string>();
  for (const url of targets) {
    let facts: ProductUrlFactsResult;
    try {
      facts = await fetchFacts(url);
    } catch {
      /* 🔴 예외는 「상품이 없다」가 아니라 **접근 실패/판단 불가** 다. */
      metrics.dropped.push({ url, reason: "UNREACHABLE" });
      continue;
    }
    metrics.fetchCalls += facts.httpCalls;
    if (facts.status !== "OK" || !facts.candidate) {
      /* 🔴 상태를 **그 함수가 낸 값으로** 적는다 — 「상품 페이지가 아니다」와 「접근
       *    실패」와 「사실을 못 읽었다」를 한 칸에 뭉치지 않는다. */
      metrics.dropped.push({ url, reason: facts.status === "OK" ? "NO_FACTS" : facts.status });
      continue;
    }
    metrics.usableProductUrls += 1;

    /* 🔴 서로 다른 입력 URL 이 **같은 페이지** 를 열 수 있다(로케일·추적 파라미터).
     *    🟢 키는 그 함수가 낸 `dedupeKey` 를 쓴다 — 새 정규화기 0. */
    const key = facts.dedupeKey ?? facts.candidate.url;
    if (seenDedupeKeys.has(key)) {
      metrics.dropped.push({ url, reason: "DUPLICATE" });
      continue;
    }
    seenDedupeKeys.add(key);
    collected.push(facts.candidate);
    metrics.miEligibleCandidates += 1;
  }

  if (collected.length === 0) return { searchResults: [], metrics };
  return {
    searchResults: groupCandidatesByHost(collected, {
      /** 🔴 WU-132 — 기본값은 WU-024 의 그 값이다(호출부 무변경). */
      shopId: input.shopId ?? TRANSIENT_URL_SHOP_ID,
      shopNamePrefix: input.shopNamePrefix ?? TRANSIENT_URL_SHOP_NAME,
    }),
    metrics,
  };
}
