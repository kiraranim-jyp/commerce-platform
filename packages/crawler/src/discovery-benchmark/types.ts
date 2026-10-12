
/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-LONGSPRINT-P1 / P1.1 — Discovery Benchmark 계약
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 디렉터리는 **실험 하니스** 다. Production 런타임이 여기 있는 것을 하나도
 * import 하지 않는다.
 *
 * 🔴 **MI-P0-02b ⑥(2026-10-11) 정정.** 이 자리에 원래
 *    「그 사실을 `__tests__/no-production-coupling.test.ts` 가 지킨다」고 적혀
 *    있었다. **그 파일은 존재하지 않았고, 그 문장은 거짓이었다.** 실제 가드는
 *    `discovery-benchmark.test.ts` 하나였고 그것은 `index.ts` 의 **export 만**
 *    봤다 — 그래서 Production 의 `comparison-search/product-url-facts.ts` 가
 *    `discovery-benchmark/url-resolver` 를 **직접 import 하는 것을 막지 못했다.**
 *    가드가 자기보다 나중에 생긴 경로를 몰랐다.
 *
 *    지금은 둘 다 고쳐져 있다:
 *      ① 그 import 를 없앴다 — URL 모양 로직은 Production 이 소유한다
 *         (`comparison-search/url-shape.ts`). 방향은 benchmark → Production 하나다.
 *      ② `__tests__/no-production-coupling.test.ts` 를 **실제로 만들었다.**
 *         파일명이 아니라 **import graph** 를 본다 — 새 역방향 import 가 생기면
 *         그 테스트가 깨진다.
 *    🔴 주석이 주장하는 가드가 실재하는지 확인하지 않으면, 그 주석 자체가
 *       다음 사람에게 거짓 안전감을 준다.
 *
 * 🔴 절대원칙 — CPO 확정:
 *
 *     Search = Recall        외부 검색은 «후보 URL 발견» 까지만 한다
 *     MI     = Precision/Truth   동일성·가격의 진실은 기존 MI 가 정한다
 *
 * 그래서 이 계약에는 **외부 검색이 SAME/SIMILAR 를 말할 자리가 없다.** 외부가
 * 무엇을 주장해도 들어올 수 있는 값은 `DiscoveredUrl` 하나뿐이다.
 *
 * 🔴 그리고 여기에는 Identity 판정도 가격 판정도 «구현하지 않는다». 전부 기존
 *    함수를 주입받아 호출한다(`MiAdapter`·`CrawlerAdapter`). 하니스가 판정을
 *    흉내 내면 벤치마크가 기존 MI 를 재는 것이 아니라 내 구현을 재게 된다.
 */

/* ───────────────────────── 원상품(검색 입력) ───────────────────────── */

/**
 * 작업지시서 §4 의 입력 고정 스키마. 🔴 «없는 값을 지어내지 않는다» — 모르는
 * 칸은 null 이고, QueryGenerator 는 null 칸을 쿼리에서 빼는 것으로 대응한다.
 */
/* ─────────── Core 계약은 `discovery-core` 가 소유한다 ───────────
 * MI-DISCOVERY-CORE-IMPLEMENTATION-004 — 아래 8개는 **여기서 선언하지 않는다.**
 * Production 도 같은 계약을 쓰기 때문이다(그 이유는 discovery-core/types.ts 에 있다).
 * 🟢 benchmark → core 는 허용 방향이므로 기존 하니스는 한 줄도 바뀌지 않는다. */
/* 🔴 `export type { … } from` 은 **재내보내기만** 한다 — 지역 스코프에 들어오지
 * 않는다. 아래 benchmark 전용 타입들이 Core 를 «참조» 하므로 import 도 필요하다.
 * (처음에 re-export 만 두고 TS2304 를 5개 냈다.) */
import type {
  ProductIdentity,
  QueryId,
  DiscoveryQuery,
  DiscoveredUrl,
  DiscoveryProvider,
  ResolutionStep,
  ResolutionClass,
  ResolvedCandidate,
} from "../discovery-core/types";

export type {
  ProductIdentity,
  QueryId,
  DiscoveryQuery,
  DiscoveredUrl,
  DiscoveryProvider,
  ResolutionStep,
  ResolutionClass,
  ResolvedCandidate,
} from "../discovery-core/types";

export type GroundTruthVerdict = "SAME" | "SIMILAR" | "UNRELATED";

export interface GroundTruthEntry {
  url: string;
  sellerLabel: string;
  market: "DOMESTIC" | "OVERSEAS";
  verdict: GroundTruthVerdict;
  /** 왜 그렇게 판정했는지 — 사람이 적는다. 하니스가 추론하지 않는다. */
  basis: string;
}

/**
 * JOB 하나의 Ground Truth 상태.
 * 🔴 `UNKNOWN` 이면 KPI 계산에서 **제외** 한다(0 으로 세지 않는다, §9).
 */
export type GroundTruthState = "CONFIRMED_SAME" | "CONFIRMED_NO_MATCH" | "UNKNOWN";

export interface JobGroundTruth {
  state: GroundTruthState;
  entries: GroundTruthEntry[];
}

/* ───────────────────────── JOB fixture (§11 입력) ───────────────────────── */

/** CEO 가 3개 엔드포인트에서 내려줄 export 를 담는 자리. */
export interface JobFixture {
  jobKey: string;
  snapshotId: string;
  identity: ProductIdentity;
  /** Lane A(Current MI)가 이미 갖고 있던 후보 — `/api/domestic-price-sources/links` */
  currentCandidates: CurrentCandidateRow[];
  groundTruth: JobGroundTruth;
}

/** `links` 응답 한 행에서 벤치마크가 쓰는 칸만. 🔴 tier 는 저장돼 있지 않으므로
 *  `priceTierFromLink` 로 «계산» 한다 — 하니스가 지어내지 않는다. */
export interface CurrentCandidateRow {
  externalUrl: string;
  site: string | null;
  matchedBrand: string | null;
  matchedTitle: string | null;
  matchedModelName: string | null;
  matchedColor: string | null;
  externalProductId: string | null;
  /** `MatchTruth | null` — 레거시 행은 null 이다. 그 사실을 보존한다. */
  matchTruth: string | null;
  verified: boolean;
  price: { amount: number; currency: string } | null;
}

/* ───────────────────────── 주입 경계 (§8·§10 금지 준수) ───────────────────────── */

/**
 * 🔴 크롤러를 여기서 «구현하지 않는다». 기존 것을 주입받는다.
 *    실패를 성공으로 바꾸지 않기 위해 결과에 상태를 함께 받는다.
 */
export interface CrawlerAdapter {
  crawl(crawlerUrl: string): Promise<{ ok: boolean; facts: unknown | null; reason: string | null }>;
}

/**
 * 🔴 Identity·가격 판정을 여기서 «구현하지 않는다». 기존 함수를 주입받는다.
 *    반환 문자열은 기존 어휘 그대로다 — 새 상태를 만들지 않는다.
 */
export interface MiAdapter {
  /** `deriveMatchTruth` 결과를 그대로. */
  identify(original: ProductIdentity, crawledFacts: unknown): Promise<string | null>;
  /** `priceTierFromLink` 결과를 그대로. */
  priceTier(matchTruth: string | null, verified: boolean): string;
}

/* ───────────────────────── 실패 분류 (§13) ───────────────────────── */

export type FailureStage =
  | "SEARCH_QUERY_MISS"
  | "SEARCH_ENGINE_MISS"
  | "SEARCH_RESULT_NO_URL"
  | "SEARCH_URL_INVALID"
  | "SEARCH_REDIRECT_FAILURE"
  | "LISTING_PAGE_HELD"
  | "CRAWLER_MISS"
  | "PARSER_MISS"
  | "IDENTITY_REJECTION"
  | "PRICE_VERIFICATION_FAILURE"
  | "SOURCE_UNAVAILABLE"
  | "OTHER";

/* ───────────────────────── 파이프라인 결과 ───────────────────────── */

/**
 * 후보 한 건이 Search → Resolve → Crawl → MI 를 지나며 남긴 기록.
 *
 * 🔴 각 단계의 결과를 «따로» 적는다. 한 덩어리로 적으면 §13 의 실패 분류가
 *    불가능해진다 — 「검색이 못 찾았다」와 「찾았는데 크롤이 실패했다」와
 *    「크롤은 됐는데 Identity 가 거절했다」는 전부 다른 사실이다.
 */
export interface BenchmarkCandidateResult {
  resolved: ResolvedCandidate;
  /** 크롤을 «시도했는가». 🔴 시도 안 함과 실패를 섞지 않는다. */
  crawlAttempted: boolean;
  crawlOk: boolean;
  crawlReason: string | null;
  /** 기존 `deriveMatchTruth` 가 낸 값 그대로. 미실행이면 null. */
  matchTruth: string | null;
  /** 기존 `priceTierFromLink` 가 낸 값 그대로. 미실행이면 null. */
  priceTier: string | null;
  /** 가격 «검증» 이 성공했는가(기존 가격 진실 게이트 기준). 미실행이면 null. */
  priceVerified: boolean | null;
  /** 이 후보가 떨어진 지점. 통과했으면 null. */
  failureStage: FailureStage | null;
}

export interface LaneResult {
  lane: string;
  jobKey: string;
  queriesAsked: QueryId[];
  queriesUnasked: QueryId[];
  discoveredCount: number;
  candidates: BenchmarkCandidateResult[];
  /** §11-J — 호출량. 🔴 추정하지 않는다. 하니스가 «실제로» 센다. */
  cost: { searchCalls: number; probeCalls: number; crawlCalls: number; miCalls: number };
}
