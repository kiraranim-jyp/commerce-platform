import {
  createProductionGoogleDiscovery,
  createLivePageProbe,
  buildPrimaryQuery,
  resolveCandidate,
  type GoogleDiscoveryUsage,
  type ProductIdentity,
  type DiscoveryQuery,
  type QueryId,
} from "@commerce/crawler/src/discovery-core";
import { factsFromProductUrl, type ComparisonCandidate, type ComparisonSearchResult } from "@commerce/crawler";
import type { ProductIdentityDna } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-INTEGRATION-005 — Gemini 후보를 «일시» Candidate Pool 로 만든다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **저장하지 않는다.** 이 모듈이 돌려주는 것은 메모리 배열이고, 호출부는
 *    그것을 `searchResults` 에 합쳐 **판정까지만** 쓴다. `domestic_product_links`
 *    에 넣지 않는다(§5/§19). 그 분기는 호출부가 `VIRTUAL_SHOP_ID` 로 가른다.
 *
 * 🔴 **새 판정 로직을 만들지 않는다**(§6). 후보를 `ComparisonCandidate` 로 만들어
 *    주기만 하고, 동일/유사 판단은 기존 `withConfidence` → `judgeDomesticCandidate`
 *    가 한다. 🟢 `factsFromProductUrl` 이 이미 그 모양을 돌려준다.
 *
 * ── 🔴🔴 scope 정책 (§3 — 가장 중요한 선행 조건) ────────────────────────
 *   `isBatchSurveyTarget` 가 쓰는 **같은 scope 값**(`categoryScopes`)으로 통과한
 *   샵들의 도메인을 Gemini 의 `preferredDomains` 에 **주입** 한다.
 *   🟢 그래서 테니스 상품은 테니스 scope 샵 도메인을, 아동복 상품은 아동복 scope
 *      샵 도메인을 선호 축으로 받는다 — **기존 정책을 재사용** 한다(우회가 아니다).
 *   🔴 단 Gemini 는 preferredDomains 를 «선호» 할 뿐 다른 도메인도 돌려준다
 *      (실측: dinossi.us · hiveboutiques.com 은 등록부에 없다). 그것을 **버리지
 *      않는다** — 그 후보 하나가 품번 없이 `SAME`(0.81)을 낸 것이 이 WU 의 근거다.
 *   🟢 대신 카테고리 불일치는 **MI 가 이미 잡는다** — `compareCrossSellerProducts`
 *      가 상품군·대상 축으로 `CONFLICT`/`UNKNOWN` 을 낸다. 🔴 그래서 여기서
 *      별도 카테고리 판정기를 만들지 않는다(§6 「별도 identity matcher 금지」).
 *   🔴 **그것이 실제로 막는지는 E2E 로 측정한다** — 가정으로 두지 않는다.
 *
 * ── 🔴 Gemini 호출 전략 (§8 — 고정 N회 금지) ────────────────────────────
 *   쿼리 축을 **순서대로** 쓰고, 쓸 만한 후보가 `targetUsable` 개 모이면 **조기
 *   종료** 한다. 🔴 「상품당 Gemini 5회」처럼 고정하지 않는다.
 *   🔴 threshold 는 건드리지 않는다 — 조기 종료 기준은 «후보 수» 이고 판정값이 아니다.
 */

/** 🔴 등록부에 없는 가상 샵이다 — 호출부가 이 id 로 「저장하지 않을 것」을 가린다. */
export const GEMINI_VIRTUAL_SHOP_ID = "__gemini_discovery__";
export const GEMINI_VIRTUAL_SHOP_NAME = "Gemini Web Discovery(일시)";

/** 🔴 flag 규약이 기존에 «없었다»(grep 0건). 이것이 첫 사례다. 기본 OFF. */
export const GEMINI_DISCOVERY_FLAG = "MI_GEMINI_DISCOVERY_ENABLED";

export function isGeminiDiscoveryEnabled(): boolean {
  return process.env[GEMINI_DISCOVERY_FLAG] === "true";
}

export interface GeminiPoolInput {
  dna: ProductIdentityDna;
  /** 🟢 `isBatchSurveyTarget` 를 통과한 샵들의 도메인 — scope 정책을 그대로 받는다. */
  scopedDomains: readonly string[];
  /** 🔴 보고용. scope 가 실제로 좁혀졌는지 적는다. */
  categoryScopes: string[] | null;
  /** 🔴 §9 — 임의 상한을 코드에 박지 않는다. 호출부가 실측 기준으로 준다. */
  maxCandidates: number;
  /** 🔴 §8 — 이만큼 모이면 추가 Gemini 호출을 하지 않는다(조기 종료). */
  targetUsable: number;
  /** 🔴 §8 — 쿼리 축을 몇 개까지 쓸지. 고정 호출 수가 아니라 **상한** 이다. */
  maxQueries: number;
  /** 기존 domestic 결과의 정규화 URL — §5 중복 제거용. */
  existingNormalizedUrls: ReadonlySet<string>;
}

/** §10 — 🔴 Gemini API 호출과 우리 서버의 resolve/fetch 를 **같은 칸에 담지 않는다.** */
export interface GeminiPoolMetrics {
  /** ① Gemini API 호출 수 */
  geminiCalls: number;
  /**
   * 🟢🟢 MI-011 — **측정된다.** 이전에 `null`(측정 불가)로 둔 것은 내가
   *    `usageMetadata` 를 봤기 때문이고, 실제 칸은
   *    `candidates[].groundingMetadata.webSearchQueries` 다.
   * 🔴 Grounded Search 의 **과금 단위** 이고 호출 1회가 여러 쿼리를 낸다
   *    (실측: 1 호출 → 6 쿼리). 호출 수로 비용을 계산하면 과소가 된다.
   */
  groundingQueries: number;
  /** 🔴 MI-014 STEP 7 — 실제 검색어 문자열. 개수만 세면 확장 원인을 못 본다. */
  groundingQueryTexts: string[];
  /** 🔴 MI-014 — 우리가 «통제하는» 것: Primary Query 는 언제나 1개다. */
  primaryQuery: string | null;
  primaryQueryLevel: string | null;
  primaryQueryTokenCount: number;
  inputTokens: number;
  outputTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  model: string | null;
  /** ③ 우리 서버의 URL resolve 수 */
  resolveCalls: number;
  /** ④ 우리 서버의 page fetch 수 */
  fetchCalls: number;
  /** §9 — 네 숫자를 따로 적는다. */
  discoveredUrls: number;
  usableProductUrls: number;
  miEligibleCandidates: number;
  /** 🔴 outcome 을 섞지 않는다 — 「0건」과 「실패」는 다르다(§7). */
  outcomes: Record<string, number>;
  queriesUsed: number;
  earlyStopped: boolean;
  /**
   * 🔴🔴 실패 «사유» 를 버리지 않는다. `outcomes` 는 개수만 세므로
   * 「429 rate limit」과 「timeout」과 「500」이 **같은 칸** 에 들어간다.
   * 실측에서 그 셋이 구분되지 않아 원인을 못 가른 자리가 있었다(⑥ 2차 실행:
   * API_FAILURE 6건의 정체를 metrics 만으로는 알 수 없었다).
   * 🔴 비밀값이 섞이지 않는다 — wrapper 가 `${name}: ${message}` 만 담고
   *    응답 본문을 붙이지 않는다(production-discovery.ts 주석).
   */
  failureDetails: string[];
}

export interface GeminiPoolResult {
  /**
   * 🟢 `searchResults` 에 그대로 append 할 수 있는 모양. 비면 호출부는 아무것도 안 한다.
   *
   * 🔴🔴 **host 별로 «여러 개» 로 쪼갠다.** 처음엔 전부 한 덩어리(가상 domain 하나)로
   *    돌려줬는데 그것이 틀렸다 — `judgeDomesticCandidate(input.domain)` 가 그 값으로
   *    분기한다:
   *      · `isEvidenceEvaluationWorthwhile(..., domain)` — 도메인 하드코딩 가드가 있다
   *      · `fetchDomesticModelCode(domain, url)` — 도메인별 품번 추출기를 고른다
   *      · `selectDomesticCandidate(..., domain, ...)` — **샵당 최선 1건** 만 남긴다
   *    🔴 가상 domain 하나로 묶으면 ① 추출기가 **영구히 null** 이고 ② 서로 다른
   *       판매처의 후보들이 한 샵처럼 경쟁해 **최대 1건만** 살아남는다.
   * 🟢 그래서 `domain` 은 **실제 host** 를 쓰고, `shopId` 만 가상으로 둔다 —
   *    저장 차단은 `shopId` 로 가리므로 그대로 유효하다.
   */
  searchResults: ComparisonSearchResult[];
  metrics: GeminiPoolMetrics;
}

const EMPTY_METRICS = (): GeminiPoolMetrics => ({
  geminiCalls: 0,
  groundingQueries: 0,
  groundingQueryTexts: [],
  primaryQuery: null,
  primaryQueryLevel: null,
  primaryQueryTokenCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  thoughtsTokens: 0,
  totalTokens: 0,
  model: null,
  resolveCalls: 0,
  fetchCalls: 0,
  discoveredUrls: 0,
  usableProductUrls: 0,
  miEligibleCandidates: 0,
  outcomes: {},
  queriesUsed: 0,
  earlyStopped: false,
  failureDetails: [],
});

/** 🔴 dedupe 키 — 쿼리스트링·해시·트레일링 슬래시를 떼고 호스트를 소문자로. */
export function normalizeCandidateUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** 🔴 등록부 도메인과 같은 모양으로 맞춘다(www 제거 · 소문자) — 추출기 조회 키다. */
function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return GEMINI_VIRTUAL_SHOP_ID;
  }
}

/** 🔴 DNA → ProductIdentity. 값을 **지어내지 않는다** — 없으면 null 이다. */
function identityFromDna(dna: ProductIdentityDna): ProductIdentity {
  let host: string | null = null;
  try {
    host = new URL(dna.sourceUrl).hostname.replace(/^www\./i, "");
  } catch {
    host = null;
  }
  return {
    brand: dna.brand.value || null,
    productName: dna.title.split("|")[0]?.trim() || dna.title,
    productType: dna.category?.value?.split(">").pop()?.trim() ?? null,
    genderAge: dna.ageRange ?? null,
    color: dna.color ?? null,
    size: null,
    season: null,
    productCode: dna.brandModelCode,
    sourceUrl: dna.sourceUrl,
    sourceSite: host,
    sourceCountry: null,
    market: null,
  };
}

/**
 * 🔴 **절대 throw 하지 않는다.** Gemini 가 어떻게 실패해도 호출부의 기존 흐름이
 *    깨지지 않아야 한다(§13). 실패는 전부 `metrics.outcomes` 로 돌려준다.
 */
export async function collectGeminiCandidatePool(input: GeminiPoolInput): Promise<GeminiPoolResult> {
  const metrics = EMPTY_METRICS();
  const identity = identityFromDna(input.dna);

  /**
   * 🔴🔴 MI-014 — **Primary Query 하나** 만 만든다.
   *
   * 이전에는 `generateQueries(identity).slice(0, maxQueries)` 였다. 그 함수는 8축을
   * SPECS 순서로 열거하므로 `maxQueries = 1` 일 때 **항상 `Q1 = productName` 단독**
   * 이 나갔다 — 브랜드도 품번도 없이. 실측(N=15): Primary 가 Q1 **15/15**,
   * 품번 보유 3상품 중 품번 query 가 Primary 가 된 것 **0**.
   *
   * 🟢 `buildPrimaryQuery` 는 품번이 있으면 `[브랜드] [품번]` 을 쓰고, 없으면
   *    denylist 로 색상·사이즈·시즌·마케팅만 걷어낸 코어 토큰 2~4개를 쓴다.
   * 🔴 `maxQueries` 는 **상한으로만** 남는다(1 이면 1회). Primary 는 언제나 하나다.
   */
  let queries: DiscoveryQuery[];
  try {
    const primary = buildPrimaryQuery(identity);
    if (!primary.text) {
      /** 🔴 검색어를 만들 수 없으면 **호출하지 않는다.** 브랜드만으로 던지면
       *     브랜드 메인 페이지만 돌아오고 비용만 쓴다. */
      metrics.outcomes.NO_PRIMARY_QUERY = 1;
      return { searchResults: [], metrics };
    }
    /** 🔴 `DiscoveryQuery.id` 는 `QueryId`(Q1~Q8)로 **이미 고정된 계약** 이다.
     *     타입을 바꾸지 않고 **의미가 같은 축** 에 매핑한다 — 정확한 level 은
     *     `axis` 가 들고 간다(보고서가 그 값을 읽는다). */
    const idByLevel: Record<string, QueryId> = {
      L1_MODEL_CODE: "Q6", // 브랜드+상품코드
      L2_BRAND_NAME: "Q2", // 브랜드+상품명
      L3_NAME_ONLY: "Q1", // 상품명
    };
    metrics.primaryQuery = primary.text;
    metrics.primaryQueryLevel = primary.level;
    metrics.primaryQueryTokenCount = primary.tokens.length;
    queries = [
      {
        id: idByLevel[primary.level] ?? "Q1",
        axis: `primary:${primary.level}`,
        text: primary.text,
        usedFields: [],
      },
    ].slice(0, Math.max(1, input.maxQueries));
  } catch (error) {
    metrics.outcomes.QUERY_GEN_FAILED = 1;
    metrics.failureDetails.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    return { searchResults: [], metrics };
  }

  const seen = new Set<string>(input.existingNormalizedUrls);
  const candidates: ComparisonCandidate[] = [];
  const probe = createLivePageProbe({
    onResult: () => {
      metrics.fetchCalls += 1;
    },
  });

  for (const query of queries) {
    /** 🔴 §8 — 모였으면 **추가 Gemini 호출을 하지 않는다.** */
    if (candidates.length >= input.targetUsable) {
      metrics.earlyStopped = true;
      break;
    }
    metrics.queriesUsed += 1;
    const discovery = await createProductionGoogleDiscovery(identity, query, {
      /** 🟢 scope 정책 주입 — 비어 있으면 core 기본(등록 판매처 도메인)이 쓰인다. */
      preferredDomains: input.scopedDomains.length > 0 ? input.scopedDomains : undefined,
    });
    metrics.outcomes[discovery.outcome] = (metrics.outcomes[discovery.outcome] ?? 0) + 1;
    if (discovery.failureDetail) metrics.failureDetails.push(discovery.failureDetail);
    accumulateUsage(metrics, discovery.usage, discovery.model);
    if (discovery.outcome !== "OK") continue;
    metrics.discoveredUrls += discovery.urls.length;

    for (const found of discovery.urls) {
      if (candidates.length >= input.maxCandidates) break;
      const key = normalizeCandidateUrl(found.url);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        metrics.resolveCalls += 1;
        const resolved = await resolveCandidate(found.url, [found], probe);
        if (resolved.classification !== "PRODUCT_PAGE") continue;
        const target = resolved.crawlerUrl ?? resolved.finalUrl;
        if (!target) continue;
        const finalKey = normalizeCandidateUrl(target);
        if (finalKey !== key && seen.has(finalKey)) continue;
        seen.add(finalKey);
        metrics.usableProductUrls += 1;
        const facts = await factsFromProductUrl(target);
        metrics.fetchCalls += facts.httpCalls;
        if (facts.status !== "OK" || !facts.candidate) continue;
        candidates.push(facts.candidate);
        metrics.miEligibleCandidates += 1;
      } catch {
        /* 🔴 후보 하나의 실패가 나머지를 죽이지 않는다 — 국내 경로와 같은 원칙. */
      }
    }
  }

  if (candidates.length === 0) return { searchResults: [], metrics };

  /** 🔴 실제 host 로 가른다 — 위 GeminiPoolResult 주석의 이유. */
  const byHost = new Map<string, ComparisonCandidate[]>();
  for (const c of candidates) {
    const host = hostOf(c.url);
    const bucket = byHost.get(host);
    if (bucket) bucket.push(c);
    else byHost.set(host, [c]);
  }
  return {
    searchResults: [...byHost.entries()].map(
      ([host, group]) =>
        ({
          /** 🔴 가상 id — 저장 차단의 유일한 기준이다. host 별로 **같은 값** 을 쓴다. */
          shopId: GEMINI_VIRTUAL_SHOP_ID,
          shopName: `${GEMINI_VIRTUAL_SHOP_NAME} · ${host}`,
          /** 🟢 실제 host — 판정 게이트가 이 값으로 분기한다. */
          domain: host,
          status: "ok",
          candidates: group,
        }) as ComparisonSearchResult,
    ),
    metrics,
  };
}

function accumulateUsage(
  metrics: GeminiPoolMetrics,
  usage: GoogleDiscoveryUsage | null,
  model: string | null,
): void {
  if (!usage) return;
  /** 🔴 `requests` 가 실제 Gemini API 호출 수다 — resolve/fetch 와 섞지 않는다. */
  metrics.geminiCalls += usage.requests;
  metrics.groundingQueries += usage.groundingQueries;
  metrics.groundingQueryTexts.push(...usage.groundingQueryTexts);
  metrics.inputTokens += usage.promptTokens;
  metrics.outputTokens += usage.candidatesTokens;
  metrics.thoughtsTokens += usage.thoughtsTokens;
  metrics.totalTokens += usage.totalTokens;
  if (model) metrics.model = model;
}
