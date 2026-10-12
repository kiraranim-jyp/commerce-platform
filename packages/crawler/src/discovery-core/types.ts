import type { UrlShape } from "../comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Discovery Core 계약 — **Production-safe**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * MI-DISCOVERY-CORE-IMPLEMENTATION-004(CPO 승인) — `discovery-benchmark/types.ts`
 * 에서 **Core 8개만** 그대로 옮겼다. 🔴 타입 본문은 한 글자도 바뀌지 않았다.
 *
 * ── 🔴 이 디렉터리가 benchmark 와 «다른» 이유 ────────────────────────────
 *   `discovery-benchmark/` 는 실험 하니스이고 **Production 이 import 하면 안 된다**
 *   (`discovery-benchmark/__tests__/no-production-coupling.test.ts` 가 지킨다).
 *   🟢 그런데 「상품을 어떻게 찾고 URL 을 어떻게 해석하는가」의 계약 자체는
 *      실험 전용이 아니다 — Production 도 같은 계약을 쓴다.
 *   → 🟢 그래서 **공통 core** 로 뺐다. 방향은 이렇게 유지된다:
 *
 *        discovery-core  ←  Production          🟢 허용
 *        discovery-core  ←  discovery-benchmark 🟢 허용
 *        discovery-benchmark  ←  Production     🔴 **금지(가드 유지)**
 *
 * ── 🔴 여기 «들어오지 않는» 것 ─────────────────────────────────────────
 *   정답표(GroundTruth*) · 픽스처(JobFixture) · 어댑터 주입(CrawlerAdapter ·
 *   MiAdapter) · 레인 결과(LaneResult · BenchmarkCandidateResult) · FailureStage ·
 *   CurrentCandidateRow — 전부 **측정 하니스 어휘** 이므로 benchmark 에 남는다.
 *   🟢 실측으로 확인했다 — Core 8개가 그 11개를 **하나도 참조하지 않는다.**
 */

export interface ProductIdentity {
  brand: string | null;
  productName: string | null;
  productType: string | null;
  genderAge: string | null;
  color: string | null;
  size: string | null;
  season: string | null;
  /** 상품코드 / SKU / MPN. 🔴 실측(2026-10-07) — Discovery 축으로 «약하다»
   *  (Shopify suggest 는 색인하지 않고, 웹검색은 상품 URL 0/10 이었다).
   *  그래도 빼지 않는다 — 상품군·엔진에 따라 강할 수 있고, 그 판단은
   *  benchmark 결과가 한다(사전 우선순위 확정 금지, P1.1 §4). */
  productCode: string | null;
  sourceUrl: string;
  sourceSite: string | null;
  sourceCountry: string | null;
  market: string | null;
}

/* ───────────────────────── 쿼리 ───────────────────────── */

/** 작업지시서 §4 Query Set. 🔴 id 는 고정 — KPI 가 쿼리별 Recall 을 이 id 로 센다. */
export type QueryId = "Q1" | "Q2" | "Q3" | "Q4" | "Q5" | "Q6" | "Q7" | "Q8";

export interface DiscoveryQuery {
  id: QueryId;
  /** 사람이 읽는 축 이름(보고서 표의 행 이름이 된다). */
  axis: string;
  text: string;
  /** 이 쿼리를 만드는 데 실제로 쓰인 칸들 — 「왜 이 쿼리가 비었는가」를 설명한다. */
  usedFields: (keyof ProductIdentity)[];
}

/* ───────────────────────── Discovery ───────────────────────── */

/**
 * 외부/내부 Discovery 가 돌려줄 수 있는 **유일한** 값.
 *
 * 🔴 `title`·`snippet`·`priceHint` 는 **참고 정보** 다. 어떤 판정에도 입력으로
 *    쓰지 않는다(P1.1 §9: Google/Naver 가격 ≠ 최종 비교가격). 기록하는 이유는
 *    「검색은 찾았는데 우리가 못 읽었다」와 「검색도 못 찾았다」를 가르기 위해서다.
 */
export interface DiscoveredUrl {
  url: string;
  providerId: string;
  queryId: QueryId;
  rank: number;
  title: string | null;
  snippet: string | null;
  /** 🔴 참고만. 통화도 신뢰하지 않는다 — 기존 가격 검증이 진실이다. */
  priceHint: string | null;
}

/** 🔴 provider 는 «발견» 만 한다. 반환 타입에 판정이 들어갈 자리가 없다. */
export interface DiscoveryProvider {
  id: string;
  label: string;
  /** Lane 식별 — 보고서의 Lane 열이 된다. */
  lane: "CURRENT" | "EXTERNAL";
  discover(identity: ProductIdentity, query: DiscoveryQuery): Promise<DiscoveredUrl[]>;
}

/* ───────────────────────── URL Resolver (P1.1 §1) ───────────────────────── */

/**
 * URL 한 건이 거쳐 간 **사건** 들. 🔴 분류(최종 상태)와 섞지 않는다 —
 * 「리다이렉트됐다」와 「상품 페이지다」는 동시에 참일 수 있다.
 */
export type ResolutionStep =
  | "SEARCH_URL"
  | "REDIRECTED"
  | "CANONICALIZED"
  | "LOCALE_NORMALIZED";

/**
 * URL 한 건의 **최종 분류**. 🔴 정확히 하나다.
 *
 * 🔴 MI-P0-02b ⑥(2026-10-11) — 이 타입의 정의는 **Production 이 소유한다**
 *    (`comparison-search/url-shape.ts` 의 `UrlShape`). 값을 두 군데 적으면
 *    한쪽만 늘어나는 순간 benchmark 와 Production 의 분류 어휘가 갈린다 —
 *    이 저장소가 등록부를 세 벌 적었다가 Rakuten 을 unsupported 로 만든 그 실패다.
 *    이름(`ResolutionClass`)은 benchmark 어휘로 그대로 둔다.
 */
export type ResolutionClass = UrlShape;

export interface ResolvedCandidate {
  /** 검색이 준 «원문» URL. 🔴 보존한다 — 실패 원인을 되짚는 유일한 근거다. */
  searchUrl: string;
  /** 리다이렉트·canonical 을 따라간 최종 URL. 실패하면 searchUrl 과 같다. */
  finalUrl: string;
  /**
   * 🔴 **크롤러에 넘길 URL.** P1.1 §3 — 검색 URL 을 그대로 가격검증 입력으로
   * 쓰지 않는다. origin + handle 로 재조립해 로케일을 떼어 낸다.
   * 재조립할 수 없으면 null 이고, 그러면 크롤러에 넘기지 않는다.
   */
  crawlerUrl: string | null;
  classification: ResolutionClass;
  steps: ResolutionStep[];
  httpStatus: number | null;
  /** 같은 판매처의 같은 상품을 가리키는 중복 제거 키. 🔴 판매처는 «합치지 않는다». */
  dedupeKey: string | null;
  provenance: DiscoveredUrl[];
}

/* ───────────────────────── Ground Truth (§8) ───────────────────────── */

/** 🔴 현재 MI 결과를 Ground Truth 로 쓰지 않는다(지시서 금지3). 별도로 적는다. */
