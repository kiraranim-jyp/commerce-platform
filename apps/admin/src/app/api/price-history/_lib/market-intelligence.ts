import type { GeminiTransientEvidence } from "./run-domestic-price-check";
/** 🔴 MI-020 — 해외 가격의 «읽는 쪽». 순수 함수다(DB·환율 없다). */
import {
  summarizeCandidateOverseasPrices,
  /** 🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §3-4(⑥) — 순수 함수 · 판정 0 · 파생 정보다. */
  compareDomesticVsOverseasKrw,
  type CandidateOverseasPriceRecord,
} from "./candidate-market";
import { backfillCanonicalProduct } from "@commerce/shared";
import {
  computePriceDecision,
  computePriceChange,
  computePriceTrend,
  computePriceRecommendation,
  /**
   * 🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **별도 축**(CPO 승인 2026-11-09).
   * 🔴 바로 위 `computePriceRecommendation`(CASE A~D)과 **독립** 이다 — 서로의 입력이 아니다.
   */
  computeReferenceProfitability,
  computePriceAlertSignal,
  summarizeDomesticMarketSplit,
  groupMarketObservations,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  computePriceBreakdown,
  /**
   * 🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §3-2 — **환산 owner 는 이 함수 하나다.**
   * 🔴 모르는 통화에 `null` 을 돌려준다 ⟹ 임의 환율로 만든 숫자가 들어올 수 없다.
   * 🔴 새 환율표·새 상수를 만들지 않았다(`packages/pricing/src/currency.ts:73`).
   */
  convertToKrwStrict,
  computeSellerAction,
  priceLevelFromVerdict,
  computeSellability,
  computeUnifiedPriceDecision,
  deriveRepresentativeSellerVerdict,
  toSellerFacingVerdict,
  deriveMarketSignals,
  buildSellingGuidance,
  buildSellingSummary,
  buildConfidenceBasis,
  buildSellerDecision,
  resolveBuyerImportCharge,
  resolveCategoryCostPolicy,
  resolveOverseasShipping,
  type UnifiedPriceDecision,
  type PriceObservationRecord,
} from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { getSearchInterestRatio } from "./market-signals-cache";
import { getDefaultSellerProfile } from "@/app/api/coupang/_lib/seller-profile";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { getPriceHistory, selectCostBasisOriginObservations } from "./price-observations";
import { computeBrandMarketProfileFor } from "./brand-market";
import { listDomesticProductLinks, priceTierFromLink } from "../../domestic-price-sources/_lib/domestic-product-link";
import { listDomesticPriceSources } from "../../domestic-price-sources/_lib/domestic-price-source";
/**
 * 🔵 CANDIDATE-UX-REFINE-04 B-3 — **재진입 복원.** 🔴 리더는 `snapshot_id` 범위만
 *    보는 전용 함수이고(`listCandidateReviews` 아니다 · 그 이유는 그 파일에 있다),
 *    변환기는 **순수 함수** 다(판정 0 · 집계 0).
 */
import { listSnapshotCandidateReviews } from "./candidate-review";
import { toSavedCandidateRows, type SavedCandidateRow } from "./saved-candidate-rows";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-URL-INPUT-UNIFICATION(CPO 결정, 2026-10-06) — **이 상품을 해외에서
 * 들여오는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **통화로 판별하지 않는다.** 해외 사이트가 원화로 파는 경우가 실재한다 —
 * 이 저장소의 실측 기록: Bobo Choses `/en-kr` ₩162,000 · `/en-de` €75.
 * `currency === "KRW"` 로 가르면 그 상품이 국내 소싱으로 «오판» 된다.
 *
 * 그래서 **등록된 국내 판매처 도메인** 과 맞춰 본다. 이미 있는 데이터다
 * (`domestic_price_sources.domain`, 029~074 가 조사해서 채운 카탈로그).
 *
 * 🔴 **카탈로그에 없는 호스트는 「해외」로 둔다.** 「모르는 곳이니 국내일 수도」
 * 로 열면 해외 상품의 착지원가에서 국제배송비가 조용히 빠진다 — 기존 숫자가
 * 변하는 쪽이라 그 방향으로는 틀리지 않는다(해외 회귀 0 보장).
 */
/* 🔴 테스트가 «동작으로» 재도록 export 한다 — 소스 문자열 검사만으로는
   「통화로 판별하지 않는다」를 증명할 수 없다. */
export async function isDomesticSourcedProduct(sourceUrl: string, workspaceId: string): Promise<boolean> {
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    /* URL 을 못 읽으면 판별하지 않는다 — 기존 동작(해외)을 유지한다. */
    return false;
  }
  if (!host) return false;
  const sources = await listDomesticPriceSources(workspaceId);
  return sources.some((source) => {
    const domain = (source.domain ?? "").replace(/^www\./, "").toLowerCase();
    if (!domain) return false;
    /* 서브도메인도 같은 판매처다(shop.example.com ↔ example.com). */
    return host === domain || host.endsWith(`.${domain}`);
  });
}

/**
 * N-4.18-K STEP K-2(대표님 지시, 2026-08-26: "새로운 가격판정 엔진을 만들지
 * 않는다") — 기존 /api/price-history/[snapshotId] GET이 계산하던 로직을
 * 그대로 함수로 뽑아낸다. computeMarketAlert()(price_alerts 갱신)와 GET
 * 응답 둘 다 이 함수를 공유해야, "화면에 보이는 값"과 "알림을 만드는 기준값"이
 * 서로 다른 계산을 하는 사고가 나지 않는다.
 */
/**
 * 🔴🔴 MI-GEMINI-REGISTRATION-DECISION-009 — `geminiEvidence` 인자 하나를 추가했다.
 *
 * 🔴 **왜 인자인가.** 이 함수는 원래 `(snapshotId, workspaceId)` 만 받고 **전부 DB
 *    에서 읽는다.** 그런데 Gemini 후보는 저장이 금지돼 있어(§5/§19) DB 에 없다 →
 *    **구조적으로 이 판정면에 닿을 수 없었다.** 그래서 지시서 §5 가 요구한 대로
 *    「영구 entity 없이 런타임 객체로」 전달한다.
 *
 * 🔴🔴 **그리고 이 값은 아래 어떤 계산에도 들어가지 않는다.** 반환 객체의 별도
 *    칸으로만 나간다. 그것이 설계다:
 *      · `sellerAction` · tier 버킷 · 가격 · alert 에 **한 글자도 영향이 없다**
 *      · 그래서 「Gemini `SAME` 하나만으로 자동 STOP」이 **구조적으로 불가능** 하다(§4)
 *      · 그래서 flag OFF 든 ON 이든 **기존 판정 결과가 동일** 하다(§12 의 즉시 STOP 조건)
 *    🔴 threshold 를 바꾸지 않았고 Gemini 전용 규칙도 만들지 않았다.
 *
 * 🔴 `undefined`/`null` = 경로가 안 돌았다 · `[]` = 켰는데 후보가 없었다. 섞지 않는다.
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 **B-3** — 네 번째 인자 `options` 하나를 더했다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 `geminiEvidence` 에 싣지 않는가.** 그 칸은 **가격 집계 입력** 이다
 *    (아래 `for (const e of geminiEvidence ?? [])`). 저장분을 거기 실으면 재진입이
 *    **과거 저장 금액까지 집계에 먹여** 「복원이 집계를 바꾼다」가 된다(B3-04 가 금지).
 *    🟢 그래서 **표시 전용 칸**(`savedCandidateRows`)으로만 나간다 — 바로 위
 *    `geminiEvidence` 블록이 적어 둔 격리 원칙을 **그대로** 따른다.
 *
 * 🔴 **왜 플래그인가(항상 읽지 않는가).** 이 함수는 POST `/check` 도 쓴다. 그 경로엔
 *    **방금 만든 live 후보** 가 있어 복원이 필요 없고, 거기서 읽으면 ⒜ 불필요한 DB
 *    질의가 늘고 ⒝ `/check` 응답 모양이 바뀐다. 🟢 플래그로 두면 **`/check` 경로가
 *    한 글자도 바뀌지 않는다** — 회귀 표면이 GET 하나로 좁아진다.
 * 🔴 **읽기만 한다** — Search/Crawl/`/check` 를 부르지 않는다(B3-09 · §B-4).
 */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 MI-SOURCING-MARKET-PRICE-INTEGRATION — 국내 가격 집계 루프가 **읽는 칸만**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `GeminiTransientEvidence` **전체를 요구하지 않는다.** 그러면 복원분에 없는 칸
 *    (`source`·`verified`·`confidence`·`title` …)을 **지어내야** 하고, 그중 `source`
 *    는 **provenance** 다 — `saved-candidate-rows.ts` 의 LOCK 이 「출처를 추측해서
 *    바꾸지 않는다」고 못박은 바로 그 값이다.
 * 🟢 그래서 **루프가 실제로 읽는 12칸** 만 받는다(`Pick`). 🔴 칸을 더 읽게 되면
 *    타입이 먼저 FAIL 한다 — 그것이 이 좁은 타입을 두는 이유다.
 */
type AggregationEvidence = Pick<
  GeminiTransientEvidence,
  | "domain"
  | "discoveredUrl"
  | "market"
  | "priceAmount"
  | "priceCurrency"
  | "priceKrw"
  | "priceStatus"
  | "priceTier"
  | "matchTruth"
  | "crossSellerVerdict"
  | "crossSellerBlockers"
> & { basis: GeminiTransientEvidence["basis"] | null };

/**
 * 🔴 **URL 단위** 중복 제거(CPO 지시). 🔴 판매처(도메인)로 접지 **않는다** —
 *    같은 샵의 «다른 상품» 관측을 합치면 그것이 더 큰 오류다.
 * 🟢 먼저 온 것을 남긴다(POST 는 이번 수집, GET 은 저장분 — 둘이 섞이지 않는다).
 */
function dedupeEvidenceByUrl<T extends { discoveredUrl: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key = r.discoveredUrl?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §3-2 — **후보 «행» 에 환산값을 붙인다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 행에 붙이는가.** UI 의 `:1857` 은 서버 요약(`candidateOverseasPrice`)이 아니라
 *    **클라이언트 `buildPriceGuide`** 산출(`g.byCurrency`)을 읽는다 ⟹ 서버 요약에
 *    최저 환산만 더해도 그 줄은 **그 값을 보지 못한다**. 🟢 그래서 환산값을 **행** 에
 *    실어 보내고, 클라이언트는 그 값을 **고르기만** 한다(환산 0 · 지시서 §2·§3).
 * 🔴 **생산자 타입(`GeminiTransientEvidence`·`SavedCandidateRow`)을 고치지 않았다** —
 *    새 객체를 만들어 칸을 **가산** 하므로 반환 타입이 교차 타입으로 자동 확장된다.
 *    (생산자에 칸을 더하면 그 칸을 «채울 책임» 이 생산자들에게 번진다)
 * 🔴 **원본 칸을 덮지 않는다** — spread 뒤에 파생 칸 하나만 더한다.
 * 🔴 지도에 없으면 **`null`** 이다 — 「환산 못 했다」를 0 이나 누락으로 적지 않는다.
 *    🟢 그래서 POST·GET 어느 경로든 **행마다 이 칸이 «있다»**(있음/없음이 경로에 따라
 *    갈리면 UI 가 「undefined 면 옛 경로」 같은 분기를 만들게 된다).
 */
function attachDerivedKrw<T extends { discoveredUrl: string }>(
  rows: readonly T[] | null | undefined,
  krwByUrl: ReadonlyMap<string, number>,
): (T & { priceKrwDerived: number | null })[] | null {
  if (!rows) return null;
  return rows.map((r) => ({
    ...r,
    priceKrwDerived: krwByUrl.get(r.discoveredUrl?.trim()) ?? null,
  }));
}

/**
 * 🔴 저장분을 집계 입력으로 되돌린다 — **값을 만들지 않는다.**
 * 🔴 `priceTier` 가 없는 행은 **건너뛴다**(tier 를 지어내면 그 후보가 가격 버킷에
 *    들어갈 자격을 «우리가» 준 것이 된다). 🟢 화면 복원은 그 행도 그대로 받는다
 *    (`savedCandidateRows` 는 이 함수와 무관하게 따로 나간다).
 * 🔴 `basis` 는 **저장되지 않는다** ⟹ `null` 이다. 🟢 그 칸은 해외 가지에서만
 *    읽히고 「시장을 왜 그렇게 봤는가」라는 **설명** 이라 집계 숫자를 바꾸지 않는다.
 */
function savedCandidateRowsToEvidence(
  rows: readonly SavedCandidateRow[] | null,
): AggregationEvidence[] {
  if (!rows) return [];
  const out: AggregationEvidence[] = [];
  for (const r of rows) {
    if (!r.priceTier) continue;
    out.push({
      domain: r.domain,
      discoveredUrl: r.discoveredUrl,
      market: r.market as GeminiTransientEvidence["market"],
      priceAmount: r.priceAmount,
      priceCurrency: r.priceCurrency,
      priceKrw: r.priceKrw,
      priceStatus: r.priceStatus,
      priceTier: r.priceTier as GeminiTransientEvidence["priceTier"],
      matchTruth: r.matchTruth as GeminiTransientEvidence["matchTruth"],
      crossSellerVerdict: r.crossSellerVerdict,
      crossSellerBlockers: r.crossSellerBlockers,
      basis: null,
    });
  }
  return out;
}

export async function computeMarketIntelligence(
  snapshotId: string,
  workspaceId: string,
  geminiEvidence?: GeminiTransientEvidence[] | null,
  options?: { restoreSavedCandidates?: boolean },
) {
  const snapshot = await getSnapshot(snapshotId, workspaceId);
  if (!snapshot) return null;
  /**
   * 🔴 저장된 후보를 **그대로** 되돌린다 — 판정 0 · 집계 0 · 가격 생성 0 · tier 생성 0.
   * 🔴 `null` = 복원 경로가 안 돌았다(POST `/check`) · `[]` = 돌았는데 저장이 없다.
   */
  const savedCandidateRows = options?.restoreSavedCandidates
    ? toSavedCandidateRows(await listSnapshotCandidateReviews({ snapshotId, workspaceId }))
    : null;
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);

  const [originRecords, domesticHistory, domesticShopHistory] = await Promise.all([
    getPriceHistory(snapshotId, "SELLER_ORIGIN"),
    getPriceHistory(snapshotId, "NAVER_SHOPPING"),
    getPriceHistory(snapshotId, "DOMESTIC_SHOP"),
  ]);
  // GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — run-price-check가 이제 같은
  // SELLER_ORIGIN 소스에 "확인만 해 둔 다른 시장"(en-de/en-int …) 행도 쌓는다.
  // 아래 원가(costPriceKrw = originHistory[0])·원가추세·costBasis는 전부
  // "최신 SELLER_ORIGIN 1건"을 그대로 읽으므로, 그 행이 섞이면 실측 기준
  // 원가가 ₩162,000(en-kr)에서 €84(en-int) 환산값으로 바뀐다. 원가/마진/CASE
  // 판정 로직은 한 줄도 건드리지 않고, 입력만 예전과 동일하게 유지한다.
  //
  // GLOBAL-ORIGIN-PRICE-WIRING-1(CEO 지시, 2026-09-13) — 이제 한 번의 확인이
  // 원본가(ORIGIN_FX)와 한국 표시가(KR_MARKET)를 **둘 다** 남긴다. 원가는 원본
  // 시장 가격 기준이어야 하므로(₩168,000은 판매처가 한국 방문자에게 보여주는
  // 자체 환산가다) 선택 규칙을 헬퍼 한 곳에 모았다 — 아래 costPriceKrw/costBasis/
  // 원가추세는 전부 이 배열만 읽으므로 판정 로직 자체는 그대로다.
  const originHistory = selectCostBasisOriginObservations(originRecords);

  // P-19-B Sprint 7(CPO 지시, 2026-09-02) — "🟢 동일상품 확인" 가격과 "🟡 비교상품"
  // 시장 참고가격을 완전히 분리된 두 버킷으로 집계한다. domestic_product_links의
  // matchTruth(이미 계산된 값, P-10 STEP 4)로 DOMESTIC_SHOP 관측치를 sourceRefId
  // 기준으로 나눈다 — 새 매칭 로직이 아니라 priceTierFromLink() 하나로 기존 판정을
  // 재사용하는 분류다. NAVER_SHOPPING(동일상품 검증 없는 검색 후보)은 기존과
  // 동일하게 비교상품 버킷에 포함한다(과거 tier="SECONDARY"와 같은 신뢰도 취급).
  const domesticLinks = await listDomesticProductLinks(snapshotId);
  const tierBySourceId = new Map(domesticLinks.map((l) => [l.sourceId, priceTierFromLink(l)]));
  const exactShopRecords: PriceObservationRecord[] = [];
  const comparisonShopRecords: PriceObservationRecord[] = [];
  for (const record of domesticShopHistory) {
    const tier = record.sourceRefId ? tierBySourceId.get(record.sourceRefId) : undefined;
    if (tier === "EXACT") exactShopRecords.push(record);
    else if (tier === "COMPARISON") comparisonShopRecords.push(record);
    // tier === "EXCLUDED" 또는 매칭 링크를 못 찾은 레코드(레거시)는 어느
    // 버킷에도 넣지 않는다 — 추측으로 분류하지 않는다.
  }
  // GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 한 판매처가 여러 시장에 동시에 있을
  // 때(실측: Bobo Choses는 /en-kr ₩162,000 · /en-de €75 · /en-int €84를 동시에
  // 낸다) 예전 집계는 이걸 판매처 3곳으로 세고 세 가격을 하나의 최저/평균으로
  // 뭉갰다. 이 화면이 답하는 질문은 "국내(한국)에 팔 때"이므로 판단 시장을
  // 한국으로 명시해서 넘긴다 — summarizeFrom이 그 시장의 가격만으로 최저/평균을
  // 내고, 나머지 시장은 markets/sellers에 그대로 남는다(숨기지 않는다).
  // market_code가 전부 null/""인 기존 데이터는 시장 그룹이 하나뿐이라 이 옵션이
  // 있어도 예전과 결과가 같다(basis="SINGLE").
  //
  // 🔴 MI-5 / P0-2-B(CEO 지시, 2026-09-26) — 여기 있던 `marketOptions` 를 지웠다.
  //    판단 시장(KR)은 이제 summarizeDomesticMarketSplit 안에 한 번만 적혀 있다
  //    (DOMESTIC_MARKET_AGGREGATION). 이 줄이 «호출부의 책임» 이었던 동안
  //    compute-readiness.ts 는 그것을 넘기지 않았고, 그래서 상품 상세와 대시보드가
  //    서로 다른 시장의 가격으로 판단할 수 있었다. 넘기는 값을 맞추는 대신
  //    넘기는 자리를 없앤다 — 값은 한 글자도 바뀌지 않았다(같은 KR).
  /* ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 MI-GEMINI-010R — 가격이 «확인된» Gemini 후보만 기존 증거 계약에 넣는다.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🟢 **기존 집계 규칙을 한 줄도 바꾸지 않는다.** `summarizeDomesticMarketSplit`
   *    는 런타임 배열을 받으므로(price-history.ts:630) 레코드를 **같은 버킷에
   *    append** 하기만 한다. 그 뒤의 `domesticMatched`/`sellerCount`/`basis`/
   *    `lowestPriceKrw` 의미는 전과 **동일** 하다.
   *
   * 🔴 세 가지를 반드시 맞춘다:
   *   ① `priceKrw != null` — 🟢 사실 이 필터는 집계기가 이미 한다(:498).
   *      여기서 한 번 더 거르는 것은 **버킷에 쓰레기를 넣지 않기 위해서** 다.
   *      (가격 없는 Gemini 후보가 `sellerCount` 를 늘리는 일이 **없어야 한다**)
   *   ② `marketCode: null` · `currency: "KRW"` — 🔴🔴 이것을 틀리면 **기존 증거가
   *      사라진다.** `resolvePriceMarketKey`(:436)는 market key 가 둘 이상이면
   *      「KR 과 정확히 1개 일치」를 요구하고, 아니면 `priceRecords = []` 가 된다.
   *      🟢 운영 전수 실측: `DOMESTIC_SHOP` 279행 전부 `market_code=null`·`KRW`.
   *   ③ `sourceRefId: null` — 등록부 샵이 아니다. 🔴 tier 조회에 끼지 않는다
   *      (위 루프는 DB 레코드만 돌고, 이 레코드는 tier 별 버킷에 **직접** 넣는다).
   *
   * 🔴 **저장하지 않는다.** 이 배열은 이 함수 안에서만 산다 — `price_observations`
   *    에 쓰지 않고 `domestic_product_links` 에도 넣지 않는다(§10).
   */
  /**
   * 🔴🔴 MI-020 §5/§6 — **해외·UNKNOWN 가격은 여기서 갈라진다.**
   *
   * ```
   * 국내 축   market === "KR" && priceKrw != null && tier EXACT|COMPARISON
   * 해외 축   그 외의 «가격 있는» 후보 → overseasEvidence (별 축 · 환산 0)
   * identity  가격이 없는 후보 → 🔴 **버리지 않는다**(§6) · 가격 축에도 넣지 않는다
   * ```
   *
   * 🔴 해외 축을 `SELLER_ORIGIN` 에 얹지 않는다 — 그러면 **원가가 오염된다**
   *    (리포 기존 테스트 `overseas-observation-storage-impact.test.ts` ③이 고정).
   * 🔴 그리고 **환율 변환을 하지 않는다**(§2). 통화별로 모아 두기만 한다.
   * 🔴 저장하지 않는다 — `price_observations` 에 새 source 를 쓰지 않는다(§5·§11).
   */
  /** 🔴 WU-051 — `krwWithoutKrEvidence` 는 「해외로도 국내로도 못 쓴 KRW」 다. 0 과 구분한다. */
  const geminiPricedCount = {
    exact: 0,
    comparison: 0,
    droppedNoPrice: 0,
    overseas: 0,
    marketUnknown: 0,
    krwWithoutKrEvidence: 0,
  };
  const overseasEvidence: {
    domain: string;
    url: string;
    market: string;
    /**
     * 🔵🔵🔵 MI-UNIFIED-MARKET-CANDIDATE-PIPELINE-1 — **`null` 을 허용한다**(해외 복원 대칭)
     *
     * 🔴 `basis`(시장을 그렇게 판정한 근거)는 `candidate_reviews` 에 **저장되지 않는다**
     *    ⟹ 재진입 복원분은 이 값을 가질 수 없다. 직전 WU 는 그래서 **해외 축을 통째로
     *    제외** 했고, 국내만 복원되는 **비대칭** 이 남았다.
     * 🟢🟢 **그런데 이 칸은 «쓰기 전용» 이다**(운영 전수 확인):
     * ```
     * 집계  summarizeCandidateOverseasPrices 의 CandidateOverseasPriceRecord 에 basis 칸이 **없다**
     * 응답  candidateOverseasEvidence 로 나가지만 UI 가 `.basis` 를 **읽지 않는다**
     * ```
     * ⟹ 🔴 값을 **지어내지 않고** `null` 을 그대로 실어도 **집계 숫자가 바뀌지 않는다.**
     * 🔴 그래서 **새 테이블·migration 이 필요 없다**(지시서 §2-C 「기존 구조 우선」).
     * 🔴🔴 나중에 이 칸을 **읽게 되면** null 분기를 먼저 설계해야 한다 — 이 타입이 그 전제다.
     */
    basis: string | null;
    currency: string;
    amount: number | null;
    /**
     * 🔵🔵 §3-2 — **원화 환산 파생값**(원본 `currency`·`amount` 는 위에 그대로 남는다).
     * 🔴 `null` = 환율 미확보 또는 모르는 통화. **0 으로 만들지 않는다.**
     */
    priceKrwDerived: number | null;
    priceTier: string;
    matchTruth: string | null;
    /**
     * 🔴🔴 SPRINT 3 P1 — **집계 자격 축.** 「⚪ 유사상품」 가격이 «동일상품 최저 확인가»
     *    가 되는 것을 막는다(실측: B226AC010 에서 `SIMILAR` 1건이 **TWD 최저가** 였다).
     * 🟢 **이미 계산된 값을 옮기기만** 한다 — 새 판정 0.
     * 🔴 **국내 축(`domesticTransientRecords`)에는 넣지 않는다** — 그 축의 숫자가
     *    바뀌면 회귀다(CPO ④ · 「tier 를 좁혀 국내가 1 → 0」 선례).
     */
    verdict: string | null;
    /**
     * 🔴🔴 STAGE 7-1 — **가격 신뢰도 축.** 「검색 결과에서 주워 온 숫자」가
     *    «확인가» 범위에 들어가는 것을 막는다(실측: 스냅샷 `6cf3e50e` 에서 7건 중
     *    **6건이 `UNVERIFIED_SEARCH`** 였고 `CAD 370 ~ 19,100`(51배)을 만들었다).
     * 🟢 **이미 계산된 값을 옮기기만** 한다(`derivePriceStatus` owner) — 새 판정 0.
     * 🔴 **국내 축에도 같이 넘긴다** — CPO ④ 는 시장을 가리지 않는다.
     */
    priceStatus: string | null;
    blockers: readonly string[] | null;
  }[] = [];
  /**
   * 🔴 WU-056 — **이번 확인으로 들어온 국내 가격** 만 담는다(아래 루프에서 채운다).
   *    🟢 타입은 해외 축과 **같은 레코드** 다 — 집계기도 같은 것을 쓴다(사본 0).
   */
  const domesticTransientRecords: CandidateOverseasPriceRecord[] = [];
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 MI-SOURCING-MARKET-PRICE-INTEGRATION ② — **재진입에서도 후보 가격을 쓴다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **고치는 결함** — POST `/check` 는 후보 가격으로 국내 축을 만들고, GET
   *    재진입은 그 후보를 **표시 칸으로만** 되돌렸다(`savedCandidateRows`).
   *    ⟹ 같은 상품인데 새로고침하면 **국내 참고가격·참고 수익성이 사라졌다.**
   *
   * 🟢 **새 저장소를 만들지 않는다**(CPO 지시 3) — 값은 **이미 저장돼 있다**:
   *    POST 가 `recordSeenCandidates`(check/route.ts:584)로 `candidate_reviews` 에
   *    `price_amount·price_currency·market·price_tier` 를 쓰고, GET 이
   *    `toSavedCandidateRows` 로 되돌린다. 빠진 것은 **이 루프로 오는 길** 뿐이었다.
   * 🔴 migration 0 · 새 테이블 0 · 환율 변환 0.
   *
   * ── 🔴 중복을 막는 방식 (CPO 지시) ───────────────────────────────────────
   * ```
   * POST  geminiEvidence 가 있다 → **그것만** 쓴다(복원분을 섞지 않는다)
   *       ⟹ 같은 후보가 「이번 수집」과 「저장분」으로 두 번 세어지지 않는다
   * GET   geminiEvidence 가 없다 → 복원분을 쓴다
   * 공통  **URL 단위** 중복 제거. 🔴 판매처(도메인)로 접지 않는다 —
   *       같은 샵의 «다른 상품» 관측을 합치면 그것이 더 큰 오류다(CPO 명시).
   * ```
   * 🔴 `priceTier` 가 없는 저장분은 **버리지 않고 건너뛴다** — 이 루프가 담는 것은
   *    `EXACT|COMPARISON` 뿐이고(:359·:381), tier 를 **지어내지 않는다**.
   * 🔴 그래서 **CASE 정책은 한 줄도 바뀌지 않는다** — 복원분이 `COMPARISON` 이면
   *    `domesticBasis` 도 `COMPARISON` 이고 `computePriceRecommendation` 은
   *    그대로 **CASE D** 를 낸다(CPO 결정 2 — EXACT 아니면 D 유지).
   */
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §1 — **환율을 «여기서» 확보한다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **왜 «이 줄 앞» 이어야 하는가.** 직전 인수인계는 「`canComputeCost` 가드 밖으로
   *    옮기면 된다」고 적었는데 **그것으로는 부족하다.** 환율 조회가 원래 `:719` 가드
   *    안이었고, 후보 evidence 가 만들어지는 자리는 **바로 아래**(`savedCandidateRowsToEvidence`
   *    + `dedupeEvidenceByUrl`)다 ⟹ 가드만 걷으면 **GET 재진입 복원 후보가 환율을 못 본다**
   *    (그 경로가 `MI-UNIFIED-PIPELINE-1` 이 살려 둔 길이다). 그래서 **소비보다 위** 로 올렸다.
   * 🟢 ⟹ **POST(`geminiEvidence`)와 GET(복원분)이 «같은» 라이브 환율을 쓴다**(지시서 §1).
   *
   * 🔴🔴 **그런데 `liveRates` 의 의미는 «한 글자도» 바꾸지 않았다.** 그 변수는 아래
   *    `canComputeCost && shippingKrw != null` 가드 **안에서만** 세팅된다 — 기존과 같다.
   *    왜: 그 값이 `computePriceBreakdown`·`buyer-import-charge` 로 흘러가므로, 무조건
   *    세팅하면 **원가/수익성 계산의 입력이 바뀐다**(지시서 §1 「기존 비용 계산 guard와
   *    계산 정책은 그대로 유지」). ⟹ 🟢 가드는 그대로 두고 **재조회만 없앴다**.
   * 🔴 **호출은 1회다.** 아래 가드는 이 `exchangeRates` 를 **재사용** 한다 — 두 번 받으면
   *    두 숫자가 서로 다른 환율 위에 설 수 있다(`:656` 주석이 경고한 그 사고).
   * 🔴 `source === "fallback"` 은 **비상 고정표** 다(`FIXED_RATES_TO_KRW`) ⟹ 환산값과
   *    **같이 내보낸다**. 숨기면 셀러가 고정표 환산을 실제 환율로 오인한다.
   */
  const exchangeRates = await fetchLiveExchangeRates();
  const candidateRates = exchangeRates.rates;

  const aggregationEvidence: AggregationEvidence[] =
    geminiEvidence && geminiEvidence.length > 0
      ? dedupeEvidenceByUrl(geminiEvidence)
      : dedupeEvidenceByUrl(savedCandidateRowsToEvidence(savedCandidateRows));
  /**
   * 🔵 §3-2 — **후보 URL → 서버 환산 KRW.** UI 세 지점(`:1857`·`:2486`·`:2658`)이
   *    **같은 숫자** 를 읽게 하려고 응답 배열에 이 값을 실어 보낸다(아래 반환부).
   * 🔴 키는 `discoveredUrl` 이다 — `dedupeEvidenceByUrl` 이 이미 URL 단위로 접었다.
   */
  const candidateKrwByUrl = new Map<string, number>();
  for (const e of aggregationEvidence) {
    /**
     * 🔴🔴 국내 축의 자격은 **둘** 이다 — KRW 금액 «그리고» `market === "KR"`.
     *    통화만 보면 `bobochoses.com`(등록부 샵인데 EUR)처럼 충돌한 후보가
     *    조용히 국내 최저가가 된다. 그 실측이 이 줄의 근거다(WU-019R §5).
     */
    if (e.market !== "KR") {
      /**
       * 🔴🔴 WU-051 §5 — **KRW 는 「해외 참고가격」에 넣지 않는다.**
       *
       * WU-050 이 실행으로 찾은 결함: `market !== "KR"` 가지가 **UNKNOWN 도 포함** 하므로,
       * 한국 샵의 KRW 가격(등록부 밖 + non-`.kr` → `KRW_WITHOUT_DOMAIN_EVIDENCE`)이
       * WU-049 「🌐 **해외** 참고가격」 구역에 `KRW 88,000` 으로 떴다 — **제목이 거짓** 이다.
       *
       * 🔴 고치는 방향을 「KRW 면 국내로 본다」로 잡지 않았다 — 그것이 CPO 가 WU-020 §4 에서
       *    금지한 **「통화 단독 결정」** 이다. 대신 **어느 가격 축에도 넣지 않는다.**
       * 🟢 그것이 이 파일의 기존 원칙과 **같은 처리** 다(WU-020 §6 — 「귀속시킬 수 없는
       *    가격은 버리지 않지만 가격 축에도 넣지 않는다」). 🟢 후보 자체는 남고, 셀러는
       *    개별 후보 줄에서 그 금액을 **그대로 본다**(WU-028 구역의 `priceText`).
       * 🔴 국내 축은 한 줄도 바뀌지 않는다 — 이 분기는 이미 `market !== "KR"` 안이다.
       */
      if (e.priceCurrency?.trim().toUpperCase() === "KRW") {
        geminiPricedCount.krwWithoutKrEvidence += 1;
        continue;
      }
      /**
       * 🟢 가격이 있으면 **해외/UNKNOWN 축에 남긴다** — 버리지 않는다.
       *
       * 🔵🔵🔵 MI-UNIFIED-MARKET-CANDIDATE-PIPELINE-1 — **해외도 국내와 «같은 길» 로 온다.**
       *
       * 🔴 직전 WU 는 `&& e.basis != null` 로 **복원분을 여기서 막았다**(국내만 복원).
       *    근거는 「`basis` 를 지어내지 않는다」였고 그 원칙은 **지금도 유효** 하다.
       * 🟢🟢 그런데 전수 확인 결과 그 칸은 **아무도 읽지 않는다**(집계 레코드에 없고 UI 도
       *    안 본다) ⟹ **null 을 그대로 실어도 집계 숫자가 바뀌지 않는다.**
       * 🔴 그래서 **값을 만들지 않고 가드만 걷는다** — 지어내기 0 · 새 저장소 0.
       * ⟹ 🟢 국내·해외가 **같은 입력(`aggregationEvidence`) · 같은 루프 · 같은 자격 조건**
       *    을 쓴다(지시서 §2-B 「시장별로 따로 구현하지 않는다」).
       *
       * 🔴🔴 **원화 환산은 여기서 하지 않는다** — 해외 축은 `overseas-reference.ts` 가
       *    「통화별로만 집계 · 합계 칸이 없다」로 잠가 둔 계약이다. 원화 환산 비교는
       *    **CEO 승인이 필요한 정책** 이라 이 WU 에서 구현하지 않았다(보고서 §8).
       */
      if (e.priceAmount != null && e.priceCurrency) {
        /**
         * ════════════════════════════════════════════════════════════════════
         * 🔵🔵🔵 §3-2 — **원화 환산 파생값.** 🔴 위 `:443` 주석이 「여기서 하지
         *    않는다 · CEO 승인이 필요한 정책」이라 적어 둔 **그 자리** 이고,
         *    CPO 가 그것을 열었다 — **「환산(비교용 파생값)」 ≠ 「합산」** 이기 때문이다.
         * ════════════════════════════════════════════════════════════════════
         *
         * 🔴🔴 **원본을 덮어쓰지 않는다** — `currency`·`amount` 는 아래에 **그대로** 실린다.
         * 🔴 `convertToKrwStrict` 는 **모르는 통화에 `null`** 을 준다 ⟹ 「임의 환율로
         *    만든 숫자」가 구조적으로 불가능하다(`GBP 37 → ₩37` 같은 거짓값 0).
         * 🔴 **통화별 집계(`byCurrency`)는 이 값을 읽지 않는다** — 그 계약은 불변이다.
         * 🟢 환산 owner 는 `packages/pricing` 의 그 함수 **하나** 다(새 환율표 0 · 새 상수 0).
         */
        const derived = convertToKrwStrict(e.priceAmount, e.priceCurrency, candidateRates);
        if (derived) candidateKrwByUrl.set(e.discoveredUrl, derived.amountKrw);
        overseasEvidence.push({
          domain: e.domain,
          url: e.discoveredUrl,
          market: e.market,
          basis: e.basis,
          currency: e.priceCurrency,
          amount: e.priceAmount,
          /** 🔵 §3-2 — 환율 미확보/미지 통화면 **`null`**(0 으로 만들지 않는다). */
          priceKrwDerived: derived?.amountKrw ?? null,
          priceTier: e.priceTier,
          matchTruth: e.matchTruth,
          /** 🔴 SPRINT 3 P1 — 지어내지 않는다. 판정이 이미 낸 값 그대로다. */
          verdict: e.crossSellerVerdict ?? null,
          /**
           * 🔴🔴 STAGE 7-1 — **가격 신뢰도도 지어내지 않는다.** `e.priceStatus` 는
           *    `enrichCandidatePrices` → `derivePriceStatus` 가 이미 낸 값이다
           *    (run-domestic-price-check.ts:359). 🔴 여기서 다시 판정하지 않는다.
           */
          priceStatus: e.priceStatus,
          blockers: e.crossSellerBlockers,
        });
        if (e.market === "OVERSEAS") geminiPricedCount.overseas += 1;
        else geminiPricedCount.marketUnknown += 1;
      } else {
        geminiPricedCount.droppedNoPrice += 1;
      }
      continue;
    }
    if (e.priceKrw == null) {
      geminiPricedCount.droppedNoPrice += 1;
      continue;
    }
    const transient: PriceObservationRecord = {
      id: `gemini-transient:${e.domain}:${e.discoveredUrl}`,
      snapshotId,
      source: "DOMESTIC_SHOP",
      sourceLabel: e.domain,
      sourceProductUrl: e.discoveredUrl,
      sourceRefId: null,
      currency: "KRW",
      priceAmount: e.priceAmount,
      shippingCostAmount: null,
      taxAmount: null,
      exchangeRate: null,
      priceKrw: e.priceKrw,
      salePriceKrw: null,
      originalPriceKrw: null,
      soldOut: null,
      marketCode: null,
      marketCountry: null,
      shippingPolicyStatus: null,
      shippingPolicyNote: null,
      checkedAt: new Date().toISOString(),
    };
    if (e.priceTier === "EXACT") {
      exactShopRecords.push(transient);
      geminiPricedCount.exact += 1;
    } else if (e.priceTier === "COMPARISON") {
      comparisonShopRecords.push(transient);
      geminiPricedCount.comparison += 1;
    }
    /**
     * 🔴🔴 WU-056 — **국내 transient 집계를 «별 칸» 으로 내보낸다.**
     *
     * 위 두 버킷은 **DB 후보와 합쳐져** `domesticCompetition` 이 되고, 그 값은
     * GET 경로(transient 미전달)에서도 만들어진다. 그래서 화면이 POST 직후에
     * 「이번 확인으로 새로 들어온 국내 가격」을 **분간할 수 없었다**(WU-056 추적:
     * 패널이 `loadPriceHistory()` 로 GET 값을 덮어쓴다 · Panel:2093).
     *
     * 🟢 **새 계산이 아니다** — 해외 축이 쓰는 **같은 집계기** 를 그대로 부른다.
     *    🔴 그 함수 이름에 `Overseas` 가 붙어 있지만 **해외 전용 로직이 0** 이다
     *       (통화·시장·tier 로만 묶는다). 이름은 역사적이라 그대로 둔다 —
     *       바꾸면 WU-020/039/050 계약 3건이 함께 흔들린다.
     * 🔴 **기존 버킷을 건드리지 않는다.** 이 배열은 읽는 쪽이 따로 있고
     *    `domesticCompetition`·판매판정·국내 최저가 계산에 들어가지 않는다.
     */
    if (e.priceTier === "EXACT" || e.priceTier === "COMPARISON") {
      domesticTransientRecords.push({
        market: e.market,
        currency: "KRW",
        amount: e.priceKrw,
        priceTier: e.priceTier,
        /**
         * 🔴🔴🔴 CORE-2T §5·§13 — **「판매처 N곳」의 단위를 레코드에 실어 보낸다.**
         *
         * 🔴 이 칸이 없던 동안 집계기는 **중복을 막을 방법이 없었다**(레코드에 URL 도
         *    도메인도 없었다) ⟹ 「판매처 N곳」이 **수집 레코드 수** 였다.
         * 🟢 **도메인** 을 쓴다 — 「판매처」의 단위가 그것이고 §15-3 이 「실제 unique
         *    seller 수」를 요구한다. 같은 도메인이 여러 레코드로 오면 집계기가 **그
         *    판매처의 최저 확인가 하나** 로 접는다(D1·D3).
         * 🔴 실측(B226AC009)에서는 **효과가 0** 이다 — 후보 2건 · 고유 URL 2건 ·
         *    도메인 2개(donokids · miniboutique). 🟢 그래도 두는 이유는 그 전제
         *    (sink 가 샵당 1건 · 러너가 canonical URL 중복 제거)가 **바뀌면 숫자가
         *    조용히 틀려지기** 때문이다.
         * 🔴 **해외 축(`overseasEvidence`)에는 넘기지 않는다** — 그 축의 숫자가 바뀌면 §9 위반이다.
         */
        sellerKey: e.domain,
        /**
         * 🔴🔴 STAGE 7-1 — **국내도 같은 규칙이다.** CPO ④ 는 「UNVERIFIED 가격을
         *    VERIFIED 가격 집계에 섞지 말라」이고 **시장을 가리지 않는다**.
         * 🔴 실측 근거 — 국내 유일 가격이던 `KRW 88,000`(miniboutique)의 신뢰도가
         *    `null` 이었다(FINAL 보고 ①). 🟢 `null` 은 **막지 않으므로** 그 줄은
         *    **그대로 남는다**(낡은 저장분 artifact · 집계기 주석 참고).
         */
        priceStatus: e.priceStatus,
        blockers: e.crossSellerBlockers,
      });
    }
    /** 🔴 REFERENCE/EXCLUDED 는 기존 국내 후보와 **같은 이유로** 가격 버킷에
     *     들어가지 않는다(위 루프도 EXACT/COMPARISON 만 담는다). */
  }

  const domesticMarketSplit = summarizeDomesticMarketSplit(exactShopRecords, [
    ...comparisonShopRecords,
    ...domesticHistory,
  ]);
  // 1순위 동일상품가격, 없으면 2순위 비교상품 시장가격(대표님 지시, Sprint 7
  // 우선순위) — 아래 decision/unifiedDecision/sellerAction/sellability/
  // representativeVerdict는 전부 이 하나의 변수만 받으므로, 우선순위 로직을
  // 여기 한 곳에서만 바꾸면 전체에 일관되게 적용된다(재계산 없음, 새 판정
  // 로직 추가 없음).
  const domesticSummary = domesticMarketSplit.resolved;

  // P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품 데이터가 없을 때만(Level 1
  // 없음) 브랜드 시장 데이터를 2차 판단 근거로 계산한다. 동일상품 데이터가
  // 있으면 항상 그게 우선이라 브랜드 시장은 계산할 필요가 없다(불필요한 조회
  // 방지). confidence가 INSUFFICIENT(표본 1~2개)면 가격 추천에 쓰지 않는다
  // (CPO 명시: "표본이 적으면 분석하지 않는다") — computePriceRecommendation에
  // 넘기지 않고 UI 표시에서도 제외한다.
  const brandMarketProfile =
    domesticSummary.tier === "NONE" ? await computeBrandMarketProfileFor(product.brand.value).catch(() => null) : null;
  const usableBrandMarketProfile =
    brandMarketProfile && brandMarketProfile.confidence !== "INSUFFICIENT" ? brandMarketProfile : null;
  const originChange = computePriceChange(originHistory);
  const originTrend7d = computePriceTrend(originHistory, 7);
  const originTrend30d = computePriceTrend(originHistory, 30);
  const domesticTrend7d = computePriceTrend(domesticHistory, 7);
  const domesticTrend30d = computePriceTrend(domesticHistory, 30);
  const domesticShopTrend7d = computePriceTrend(domesticShopHistory, 7);
  const domesticShopTrend30d = computePriceTrend(domesticShopHistory, 30);

  const currentSellingPriceKrw = product.priceOverrideKrw?.value ?? null;
  const costPriceKrw = originHistory[0]?.priceKrw ?? null;
  // N-4.18-Q3 P0-2 — run-price-check.ts가 sourceLabel에 남긴 원가 근거
  // ("KR_MARKET" 실제 한국 표시가 우선 / "ORIGIN_FX" 원문×환율 폴백)를
  // 그대로 읽는다. 이 관측 이전(마이그레이션/코드 배포 이전) 저장분은
  // sourceLabel이 없어 null(과거 관측은 항상 ORIGIN_FX였던 것과 같다).
  const costBasis = (originHistory[0]?.sourceLabel as "KR_MARKET" | "ORIGIN_FX" | null | undefined) ?? null;
  const decision =
    currentSellingPriceKrw != null && costPriceKrw != null
      ? computePriceDecision({
          costPriceKrw,
          currentSellingPriceKrw,
          domesticAveragePriceKrw: domesticSummary.averagePriceKrw,
          domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
          // 🔴 P0-D.2(CEO 결정, 2026-09-20) — 이 숫자가 «동일상품» 에서 왔는지
          //    «비교상품» 에서 왔는지를 판정까지 들고 간다. resolved 는 EXACT 가
          //    없으면 COMPARISON 으로 폴백하므로, 숫자만 넘기면 판정이 그 둘을
          //    구분할 방법이 없다 — 실측 4건이 그래서 CONSIDER_LOWER 였다.
          domesticBasis: domesticMarketSplit.basis,
        })
      : null;

  const alertSignal = originChange
    ? computePriceAlertSignal({
        priceChangeRatePercent: originChange.changeRatePercent,
        marginChangePercentPoints: null,
      })
    : null;

  // P-3-2(대표님 지시, 2026-08-28) — P-3-1에서 확정한 설계: 국내 배송원가는
  // 상품마다 다시 입력하지 않는 판매자 기본값(SellerProfile)이다. 값이 없으면
  // 여전히 unknown으로 전달된다 — 이 조회가 실패하거나 프로필이 없어도
  // 기존과 완전히 동일하게(unknown) 동작한다. (MI-COST-POLICY-1에서 같이 읽던
  // 상품별 관세/부가세 입력은 사라졌다 — 구매자 부담이라 판매자 원가가 아니다.)
  const sellerProfile = await getDefaultSellerProfile();

  // P-12B(대표님/CPO 지시, 2026-08-31) — 착지원가/추천판매가는 과거 크롤링
  // 시점의 canonicalProduct.price(정적)가 아니라 최근 실제 확인된 구매가능
  // 가격을 우선 사용한다. 우선순위: ①최신 observation.soldOut!==true &&
  // salePriceKrw → LATEST_SALE, ②같은 조건 && priceKrw → LATEST_PRICE,
  // ③최신 observation 없음/품절 → STATIC_SNAPSHOT(기존 동작 그대로). 품절
  // observation은 최신이어도 원가 기준으로 승격하지 않는다(CPO 명시).
  // originalPriceKrw(정가)는 이 우선순위 어디에도 없다 — 원가 계산에 사용 금지,
  // 표시 전용(CPO 명시).
  type CostSource = "LATEST_SALE" | "LATEST_PRICE" | "STATIC_SNAPSHOT";
  const latestOrigin = originHistory[0] ?? null;
  let costSource: CostSource = "STATIC_SNAPSHOT";
  let resolvedOriginalAmount = product.price.value.amount;
  let resolvedOriginalCurrency = product.price.value.currency;
  if (latestOrigin && latestOrigin.soldOut !== true) {
    if (latestOrigin.salePriceKrw != null) {
      costSource = "LATEST_SALE";
      resolvedOriginalAmount = latestOrigin.salePriceKrw;
      resolvedOriginalCurrency = "KRW";
    } else if (latestOrigin.priceKrw != null) {
      costSource = "LATEST_PRICE";
      resolvedOriginalAmount = latestOrigin.priceKrw;
      resolvedOriginalCurrency = "KRW";
    }
  }

  let cost: ReturnType<typeof computePriceBreakdown> | null = null;
  let recommendation: ReturnType<typeof computePriceRecommendation> | null = null;
  /**
   * GOLF-01-TAX — 원가 계산에 실제로 쓰인 그 환율표를 아래 구매자 부담 참고정보도
   * 쓴다. 소액면세 한도는 달러로 적혀 있어(관세법 시행규칙 제45조) 원화와
   * 비교하려면 환율이 필요한데, 여기서 환율을 한 번 더 조회하면 같은 응답 안의
   * 두 숫자가 서로 다른 환율 위에 서게 된다.
   */
  let liveRates: Record<string, number> | undefined;
  // STATIC_SNAPSHOT일 때만 기존 priceValidity 게이트를 그대로 유지한다(회귀
  // 방지). LATEST_SALE/LATEST_PRICE는 이미 실측된 값이라 이 게이트와 무관하다.
  const hasResolvedPrice = resolvedOriginalAmount > 0 && Boolean(resolvedOriginalCurrency);
  const canComputeCost =
    costSource !== "STATIC_SNAPSHOT" ? hasResolvedPrice : product.priceValidity === "VALID" && hasResolvedPrice;
  /**
   * 🔴 MI-P0-COST-02(CEO 확정, 2026-09-21) — **UI 기본값과 MI Evidence 를 가른다.**
   *
   * `DEFAULT_PRICE_BREAKDOWN_INPUT` 은 «입력 폼의 초기값» 이다. 그런데 여기서
   * `product.priceBreakdown ?? DEFAULT` 로 받아 `breakdownInput.shippingKrw` 를
   * 그대로 원가에 넣고 있었다 — 즉 **아무도 입력한 적 없는 ₩12,000 이
   * 「확인된 배송비」처럼** 착지원가·마진·판정까지 흘러갔고, 그 사실을 말해 주는
   * `shippingBasis` 는 아래 unifiedDecision 블록 안에 갇혀 화면에 닿지 못했다.
   *
   * 이제 금액은 **사다리(resolveOverseasShipping)가 정한다.** 숫자는 같을 수
   * 있지만(LEGACY_FALLBACK = ₩12,000) **근거가 함께 움직인다.**
   *
   * 🔴 feePercent · marginPercent 는 여전히 폼 기본값을 쓴다 — 그 둘은 셀러가
   *    고르는 «가정값» 이고, 배송비처럼 「측정했는가」를 다투는 값이 아니다.
   */
  const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
  /**
   * P0-C STEP 5 — 근거를 한 번만 구해서 아래로 흘린다(두 번 판정하지 않는다).
   * 🔴 method 는 넘기지 않는다 — 확인된 배송방법 데이터가 0건이므로 UNKNOWN 이다.
   */
  /**
   * 🔴 MI-URL-INPUT-UNIFICATION — 「이 상품을 해외에서 들여오는가」를 여기서
   * 한 번만 구해 아래로 흘린다. 두 번 판정하면 배송비 축과 세금 축이 서로
   * 다른 답을 들고 갈 수 있다.
   */
  const domesticSourced = await isDomesticSourcedProduct(product.sourceUrl, workspaceId);

  const resolvedShipping = resolveOverseasShipping({
    /* 🔴 국내 소싱이면 해외물류비 축이 «적용되지 않는다»(NOT_APPLICABLE).
       ₩0 이 아니다 — 0 은 「확인했더니 0원」이라는 다른 사실이다. */
    overseasInbound: !domesticSourced,
    // 🔴 저장된 priceBreakdown 이 «있을 때만» 판매자 값이다. 없으면 아래
    //    legacyFallbackKrw 가 답한다 — 실측 328건 중 89건이 이 경우다.
    sellerEnteredKrw: product.priceBreakdown ? product.priceBreakdown.shippingKrw : undefined,
    // 🔴 P0-C STEP 3 §8 — ₩12,000 의 «숫자» 는 바꾸지 않는다. 다만 그 값이
    //    적용될 때 LEGACY_FALLBACK 이라는 이름이 붙도록 한다. 예전에는 이 경우
    //    근거가 아예 없었고, 그래서 아무도 모르는 채 원가에 들어갔다.
    legacyFallbackKrw: DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw,
  });
  /**
   * 🔴 P0-C STEP 3 + MI-P0-COST-02 — **배송비를 «모르면» 원가를 만들지 않는다.**
   *
   * `UNKNOWN` 이면 amountKrw 가 null 이고, 아래 `shippingKrw != null` 게이트가
   * cost 를 만들지 않는다 → 착지원가·Gross·Net·판정이 전부 비어 있게 된다.
   *
   * 🔴 `LEGACY_FALLBACK` 은 «계산 가능» 하다(CEO 확정). 다만 그 금액은
   *    「확인된 배송비」가 아니므로 basis 를 잃어버리면 안 된다.
   *    UNKNOWN 과 LEGACY_FALLBACK 을 절대 같은 것으로 합치지 않는다.
   */
  /**
   * 🔴 「해당 없음」은 계산을 멈추는 이유가 «아니다». 국내 소싱 상품의 착지원가는
   * 「국내 소싱가」 하나이고, 국제배송 구간이 없으니 더할 항이 없을 뿐이다.
   * 산술에는 0 을 쓰지만 **근거는 NOT_APPLICABLE 로 따로 흐른다** — 화면이
   * 「₩0 으로 확인됨」이라고 말하지 않게 하는 장치가 그 분리다.
   */
  const shippingNotApplicable = resolvedShipping.basis === "NOT_APPLICABLE";
  const shippingKrw = shippingNotApplicable ? 0 : resolvedShipping.amountKrw;
  if (canComputeCost && shippingKrw != null) {
    /**
     * 🔴 §1 — **재조회하지 않는다.** 환율은 위(후보 evidence 생산 «앞»)에서 **1회**
     *    받았고 이 가드는 그 값을 재사용한다. 🔴 가드 자체와 아래 계산 정책은 **불변** 이다.
     */
    liveRates = exchangeRates.rates;
    cost = computePriceBreakdown(
      {
        originalAmount: resolvedOriginalAmount,
        originalCurrency: resolvedOriginalCurrency,
        ...breakdownInput,
        shippingKrw,
      },
      exchangeRates.rates,
    );
    // P-24 Sprint 4(CPO 지시, 2026-09-02) — 실측(PèPè): 국내 EXACT 최저가
    // ₩258,000이 있는데도 화면 "추천 판매가"는 cost.suggestedPriceKrw(원가×
    // 목표마진, 시장가 무관 역산)인 ₩346,286을 그대로 보여줬다. 원인은 이
    // 조건 — computePriceRecommendation()(시장가를 이미 우선 반영하는 기존
    // 함수, 새로 만들지 않음)이 currentSellingPriceKrw!=null일 때만 호출됐는데,
    // 실제 프로덕션에는 판매가가 확정된 스냅샷이 사실상 없다(P-12B 주석과
    // 동일한 이유). currentSellingPriceKrw는 이 함수 내부에서 애초에 쓰이지
    // 않는 값이라(price-recommendation.ts 참고) 게이트를 없애도 계산 자체는
    // 그대로다 — DomesticPriceIntelligencePanel.tsx는 이미 recommendation이
    // 있으면 그 값을, 없으면 cost.suggestedPriceKrw를 쓰도록 되어 있었으므로
    // (`recommendation?.recommendedPrice ?? cost.suggestedPriceKrw`) 이 한 곳만
    // 고치면 화면이 자동으로 시장가 기준 값을 보여준다.
    // P-26 Sprint 1-2(CPO 지시, 2026-09-03) — domesticBasis(EXACT/COMPARISON/
    // NONE)를 넘겨야 CASE A/B/C(시장경쟁 판단)와 CASE D(EXACT 아님, 판단 보류)를
    // 구분할 수 있다. domesticMarketSplit.basis는 이미 위에서 계산된 값 그대로다.
    recommendation = computePriceRecommendation({
      totalCostKrw: cost.landedCostKrw,
      currentSellingPriceKrw: currentSellingPriceKrw ?? undefined,
      domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
      domesticAveragePriceKrw: domesticSummary.averagePriceKrw,
      domesticBasis: domesticMarketSplit.basis,
      minimumMarginPercent: 10,
      targetMarginPercent: breakdownInput.marginPercent,
      // 🔴 MI-P0-COST-02 — 손익 경계를 Net 으로 옮기는 단 하나의 입력.
      //    「예상 수수료」이지 특정 채널의 실제 요율이 «아니다».
      expectedFeePercent: breakdownInput.feePercent,
      // P-13A — EXACT 시장가가 없을 때(CASE D)만 이 값이 실제로 쓰인다.
      brandMedianPriceKrw: usableBrandMarketProfile?.medianPriceKrw ?? null,
    });
  }

  // P-1-3 STEP 6/7(대표님 지시, 2026-08-28) — "PriceEditor와 Market Intelligence가
  // 서로 다른 마진을 계산한다"는 P-1-2 실측 문제를 여기서 고친다. 기존
  // computePriceDecision(costPriceKrw=해외원가만) 호출은 그대로 두고(회귀 보존,
  // decision/margin 필드도 그대로 반환), computeUnifiedPriceDecision()으로 배송비/
  // 수수료까지 포함한 "진짜 원가" 기준 판단을 별도 필드(unifiedDecision)로 추가
  // 제공한다.
  //
  // P-3-2(대표님 지시, 2026-08-28) — P-3-1 조사 이전에는 sellerDomesticShippingCostKrw/
  // customerChargedShippingKrw가 하드코딩된 unknown이었다(추적하는 곳이 없었다).
  // 이제 국내 배송원가는 SellerProfile 기본값에서 실제로 채워진 값만 전달한다 —
  // 값이 없으면(아직 입력 전) 여전히 unknown이다(0으로 지어내지 않는다).
  // customerChargedShippingKrw는 SellerProfile.deliveryCharge(고객 청구 배송비)를
  // 그대로 통과시킨다 — computeUnifiedPriceDecision()의 LANDED_COST_PARTS에
  // 포함되지 않는 정보용 필드라 원가 합산에는 전혀 영향이 없다.
  //
  // MI-COST-POLICY-1(대표님 결정, 2026-09-12) — P-3-2에서 함께 넘기던 관세/부가세
  // 두 줄은 여기서 사라졌다. 구매자가 통관 때 내는 돈이라 판매자 수익성 계산에
  // 들어갈 자리가 없다. 이 호출부에서 빼는 것만으로는 부족해 엔진의
  // LANDED_COST_PARTS 자체에서도 뺐다(화면에서만 감추면 화면이 거짓말을 한다).
  //
  // MI-UX-FINAL-4(대표님 결정, 2026-09-13) — 국내 배송원가(sellerDomesticShippingCostKrw)도
  // 같은 이유·같은 순서로 빠졌다. 엔진의 LANDED_COST_PARTS에서 먼저 뺐으므로
  // 여기서 넘겨도 무시될 뿐이지만, 넘기는 줄을 남겨두면 "이 값이 마진에
  // 영향을 준다"는 오해가 코드에 그대로 남는다. sellerProfile.domesticShippingCostKrw
  // 자체는 지우지 않는다 — Settings에 저장된 판매자 값이고, 읽는 곳이 없을 뿐이다.
  //
  // GOLF-01 축B(CEO 지시, 2026-09-15) — 카테고리별 비용 정책.
  //
  // 셀러가 "상품 검색"에서 고른 카테고리(workspace.marketCategoryProfileId)를
  // 그대로 읽는다. 새로 추정하지 않는다 — 카테고리를 여기서 또 판정하면 시장조사
  // 소스 필터가 쓰는 값과 원가가 쓰는 값이 언젠가 갈라진다. 값이 없으면(이 기능
  // 이전 스냅샷, 또는 아직 안 고름) null이고 정책은 DEFAULT다 = **오늘까지와
  // 완전히 같은 계산**이다.
  const marketCategoryProfileId = snapshot.workspace.marketCategoryProfileId ?? null;
  const costPolicy = resolveCategoryCostPolicy(marketCategoryProfileId);

  /**
   * 🔴 GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — **이 값은 아래
   * computeUnifiedPriceDecision에 넘어가지 않는다.**
   *
   * d72575f는 골프 카테고리에 한해 통관세를 착지원가 인자로 넘겼다. CEO가 그
   * 방향을 거뒀고, 그래서 이 호출부는 MI-COST-POLICY-1 직후의 모습으로 돌아왔다 —
   * 아래 computeUnifiedPriceDecision(...) 인자 목록 어디에도 세금 칸이 없다.
   *
   * 대신 같은 사실을 **응답의 다른 가지**로 내보낸다. 원가 인자와 참고정보가
   * 서로 다른 변수·다른 응답 필드라 섞일 수 없고, 아동의류든 골프든 **같은
   * 함수**가 같은 모양을 만든다(카테고리별 분기가 이 줄에 없다는 것이 곧
   * "공통 표시 구조"다).
   *
   * 과세가격(CIF) = 환산 상품가 + 국제배송비 — 둘 다 cost에 이미 있는 값이고
   * 여기서 새로 환산하거나 배송비를 만들지 않는다. 소액면세 한도를 재는
   * 물품가격은 국제운임을 뺀 cost.costKrw다.
   *
   * 수입 형태(구매대행/사업자 정식수입)와 배송 조건(DDP/DDU)은 이 저장소가
   * 아직 저장하지 않는 값이라 넘기지 않는다 — 넘길 값이 없다는 사실이 화면에
   * «확인 필요»로 그대로 나오는 것이 맞다.
   */
  const buyerImportCharge =
    /* 🔴 국내에서 사오는 상품에는 «수입» 이 없다 — 관세·부가세 참고정보를
       만들지 않는다. 띄우면 존재하지 않는 비용을 셀러에게 말하는 것이 된다.
       세금 계산 «구조» 는 건드리지 않는다(CEO GOLF-01-TAX 결정 그대로
       착지원가 인자가 아니다). */
    cost != null && !domesticSourced
      ? resolveBuyerImportCharge({
          categoryProfileId: marketCategoryProfileId,
          // 이 제품의 판단 시장은 한국 하나다(KR_TARGET_MARKET).
          destinationCountry: "KR",
          customsValueKrw: cost.landedCostKrw,
          goodsValueKrw: cost.costKrw,
          liveRates,
        })
      : null;

  const unifiedDecision: UnifiedPriceDecision | null =
    cost != null && currentSellingPriceKrw != null
      ? computeUnifiedPriceDecision({
          categoryProfileId: marketCategoryProfileId,
          sourceProductPriceKrw: { value: cost.costKrw, status: cost.isRateEstimate ? "estimated" : "actual" },
          exchangeRate: { value: cost.exchangeRate, status: cost.isRateEstimate ? "estimated" : "actual" },
          /**
           * 🔴 SHIPPING-POLICY-01 ②(CEO 지시, 2026-09-16) — source 가 "seller_default"
           * 로 «고정»돼 있었다. 판매자가 실제 배송비를 입력해 둔 상품도 근거 문자열은
           * "기본값"이라고 말했다는 뜻이다. 마진을 부풀리는 방향은 아니지만, 두 상태를
           * 구분하지 못한다는 점은 같다.
           *
           * 🔴 status 는 손대지 않는다 — "estimated" 그대로다. 이 값이 실측이라고
           * 확인해 주는 장치가 아직 없고, status 를 올리면 dataCompleteness 와
           * verdict 가 따라 움직인다. 바뀌는 것은 근거 문자열 하나뿐이다.
           */
          /**
           * 🔴 P0-C STEP 3(CEO 승인, 2026-09-20) — 근거를 «숫자로 되묻지» 않는다.
           *
           * 여기 있던 식은 `resolveOverseasShippingBasis(숫자).basis === "DEFAULT"`
           * 였다. 「값이 12,000 이면 기본값, 아니면 판매자 입력」이라는 추측이다.
           * 그래서 판매자가 ₩0 을 넣어도 「판매자 입력」이 됐고(실측 14건), 반대로
           * 판매자가 ₩12,000 을 «확정» 해도 「기본값」이 됐다. 이제 판매자가
           * 실제로 넣었는지를 그대로 넘겨 근거를 받는다.
           *
           * 🔴 status 는 여전히 "estimated" 다 — 이 값이 실측이라고 확인해 주는
           *    장치가 아직 없다(그 판단은 STEP 5 의 몫이다). 배송비를 «모르는»
           *    경우는 애초에 여기 오지 않는다: 위에서 cost 가 null 이 되고,
           *    그러면 이 블록 자체가 실행되지 않는다.
           */
          /* 🔴 국내 소싱이면 금액을 «비운다». 위 산술에서는 0 을 더했지만 그
             0 을 성분으로 내보내면 화면이 「국제배송비 ₩0」이라고 말하게 된다.
             합산은 아래 shippingBasis 를 보고 이 항을 건너뛴다(결정 A). */
          internationalShippingKrw: shippingNotApplicable
            ? { value: null, status: "unknown", source: "국내 소싱 — 국제배송 구간 없음" }
            : {
                value: cost.shippingKrw,
                status: "estimated",
                source: resolvedShipping.basis === "SELLER_OVERRIDE" ? "seller_input" : "seller_default",
              },
          /**
           * P0-C STEP 5 — 금액 옆에 «근거» 를 함께 보낸다. landedCostKrw 가
           * 이 둘을 그대로 달고 나가므로, 화면이 「왜 이 값인가」에 답할 수 있다.
           *
           * 🔴 shippingMethod 는 넘기지 않는다 — 오늘 이 값을 «확인한» 데이터가
           *    한 건도 없다(product_snapshots 328건 중 0건). 국가·판매처로
           *    추측하는 것은 CEO 가 금지했다. 그래서 UNKNOWN 으로 남는다.
           */
          shippingBasis: resolvedShipping.basis,
          customerChargedShippingKrw:
            sellerProfile?.deliveryCharge != null
              ? { value: sellerProfile.deliveryCharge, status: "actual", source: "SellerProfile.deliveryCharge" }
              : { value: null, status: "unknown" },
          platformFeeRate: { value: cost.feePercent, status: "estimated", source: "default" },
          currentSellingPriceKrw: { value: currentSellingPriceKrw, status: "actual" },
          domesticCompetitivePrice: {
            lowest: domesticSummary.lowestPriceKrw,
            average: domesticSummary.averagePriceKrw,
            // 🔴 P0-D.2 — 같은 이유로 여기도 출처를 함께 보낸다.
            basis: domesticMarketSplit.basis,
          },
        })
      : null;

  const sellerAction = computeSellerAction({
    priceLevel: priceLevelFromVerdict(decision?.verdict ?? null),
    currentSellingPriceKrw,
    domestic: {
      lowestPriceKrw: domesticSummary.lowestPriceKrw,
      averagePriceKrw: domesticSummary.averagePriceKrw,
      sellerCount: domesticSummary.sellerCount,
      priceGapVsLowestPercent: decision?.priceGapVsLowestPercent ?? null,
      priceGapVsAveragePercent: decision?.priceGapVsAveragePercent ?? null,
      trend: domesticShopTrend7d,
      soldOutCount: domesticSummary.soldOutListings.length,
    },
    origin: { change: originChange },
  });

  // N-4.18-Q3 — "가격 유지/조정" 판단(sellerAction)과 별개로 "이 상품을 등록해도
  // 되는가"를 판단한다.
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴 MI-7 / P0-2(CPO 결정, 2026-09-26) — **가격판정 입력은 EXACT 뿐이다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * ── 무엇이 문제였나 ─────────────────────────────────────────────────────
   * 여기 있던 것은 `domesticSummary`(= `domesticMarketSplit.resolved`) 였다.
   * `resolved` 는 EXACT 가 없으면 **COMPARISON 으로 폴백** 하므로, 동일상품이
   * 확정되지 않은 상품에서 «비교상품 평균가» 가 GREEN/RED 를 만들고 있었다.
   * 그 등급은 `representativeVerdict` 의 기저 판정이 되고, 음수 마진이면
   * 최종 🔴 「판매 비추천」까지 갔다 — 검증되지 않은 «다른 상품» 의 가격으로.
   *
   * 바로 옆 두 소비자는 이미 EXACT 만 쓴다:
   *   computePriceDecision       `domesticBasis !== "EXACT"` → 가격을 null 로 (P0-D.2)
   *   computePriceRecommendation `domesticBasis !== "EXACT"` → CASE D (P-26)
   * 🔴 즉 이 한 곳만 정책 밖에 있었다. P0-D.3 이 대시보드(compute-readiness)에만
   *    같은 수정을 넣었고, 이 파일은 그대로였다.
   *
   * ── 🔴 `resolved` 를 없애지 «않는다» ───────────────────────────────────
   * 화면은 계속 `resolved` 를 본다(`domesticCompetition` · sellerAction ·
   * headline · marketContext). 비교상품 가격을 «지우지» 않는다는 CEO 결정 그대로다.
   * 바뀐 것은 **판정 입력과 표시 입력을 가른 것** 하나다:
   *
   *     표시  resolved   (EXACT 없으면 COMPARISON — 참고자료로 남는다)
   *     판정  exact      (없으면 「확인 필요」 — 가격으로 단정하지 않는다)
   *
   * ── 🔴 `domesticMatched` 는 여기서 바꾸지 않는다 ────────────────────────
   * 아래 `deriveRepresentativeSellerVerdict` 에 넘기는 `domesticMatched` /
   * `domesticSellerCount` 는 `domesticReason()` «문장» 에만 쓰인다(코드 분기에
   * 쓰이지 않는다 — representative-seller-decision.ts 전수 확인). 즉 표시 축이다.
   * `exact` 로 바꾸면 「비교상품 N곳 시장가격 기준」이라는 사실이 문장에서 사라진다.
   */
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2R-5(CPO 확정 2026-10-24) — **판정 입력을 `exact` → `resolved` 로 바꾼다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **바로 위 주석이 세운 분리(「표시 resolved · 판정 exact」)를 이 소비자에서
   *    되돌리는 변경이다. 숨기지 않는다.** 그 분리의 전제는 「COMPARISON 가격을 판정에
   *    쓰지 않는다」였고 CPO 가 그 전제를 바꿨다:
   * ```
   * domestic price evidence
   *   ├─ EXACT      → 우선 사용
   *   └─ COMPARISON → EXACT 가 없을 때 사용  ⟹ 국내 reference → MI sellability
   * ```
   * 🟢 `summarizeDomesticMarketSplit` 의 `resolved` 가 **정확히 그 규칙** 이다
   *    (`exact.sellerCount > 0 ? exact : comparison` · price-history.ts:644) ⟹
   *    🔴 **새 우선순위 로직을 만들지 않았다.** 이미 있는 값을 읽는다.
   *
   * 🔴 왜 지금인가 — CORE-2R-4 실측에서 국내 후보 **2곳이 둘 다 `KRW 88,000`** 인데
   *    등급이 `PRESUMED_SAME → COMPARISON` 이라 `exact` 가 **0** 이었다. 그 상태에서는
   *    「국내 가격을 찾아 놓고 MI 가 쓰지 못한다」가 된다(CPO: 마지막 병목).
   * 🔴 **SAME 게이트 · threshold · identity 를 열지 않았다**(CPO 금지 1~7 그대로).
   *    `PRESUMED_SAME → SAME` 승격 **0**. 바뀐 것은 **소비 경로** 하나다.
   *
   * 🔴 **나머지 두 소비자는 건드리지 않았다** — `computePriceDecision`(P0-D.2)과
   *    `computePriceRecommendation`(P-26)은 여전히 `domesticBasis !== "EXACT"` 를 본다.
   *    그 둘은 **추천가/마진 축** 이고 CPO 가 이번 범위에서 닫아 뒀다.
   * 🟢 그래서 `domesticBasis` 가 **여전히 응답에 실린다** — 셀러 문장이 「비교상품 N곳
   *    시장가격 기준」이라고 **출처를 계속 말한다**(그 사실이 사라지면 안 된다).
   */
  const sellability = computeSellability({
    costPriceKrw,
    domestic: {
      matched: domesticMarketSplit.resolved.sellerCount > 0,
      averagePriceKrw: domesticMarketSplit.resolved.averagePriceKrw,
    },
  });

  // P-8 STEP 2(대표님 지시, 2026-08-30) — "화면 최상단에 대표 판단 1개만 둔다."
  // unifiedDecision/sellability를 재계산하지 않고, 이미 위에서 낸 결과를 그대로
  // 단일 대표 상태로 압축한다(deriveRepresentativeSellerVerdict는 새 판정을
  // 만들지 않는 presentation-layer 함수 — packages/pricing 참고).
  const representativeVerdict = deriveRepresentativeSellerVerdict({
    unifiedDecision,
    sellability,
    domesticMatched: domesticSummary.sellerCount > 0,
    domesticSellerCount: domesticSummary.sellerCount,
    // P-22(CPO 지시, 2026-09-02) — domesticSummary(=domesticMarketSplit.resolved)가
    // EXACT에서 왔는지 COMPARISON에서 왔는지를 그대로 전달한다(새 판정 없음,
    // summarizeDomesticMarketSplit()이 이미 낸 값 재사용).
    domesticBasis: domesticMarketSplit.basis,
    // P-26(CPO 지시, 2026-09-03) — computePriceRecommendation()이 이미
    // CASE A/B/C/D를 계산해 낸다(marketCase). 여기서 가격을 다시 비교하지
    // 않고 그 결과를 그대로 전달한다(추천가 계산과 판매 판단 단일화).
    marketCase: recommendation?.marketCase ?? null,
    recommendation: recommendation
      ? { recommendedPrice: recommendation.recommendedPrice, estimatedMarginPercent: recommendation.estimatedMarginPercent }
      : null,
    domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
    landedCostKrw: cost?.landedCostKrw ?? null,
  });
  // P-19-B Sprint 8(CPO 지시, 2026-09-02) — 판매자에게 최종적으로 보여줄 화면은
  // 무조건 3단계(🟢 판매 추천/🟡 조건부 판매/🔴 판매 비추천)로 통합한다. 기존
  // 5단계(representativeVerdict) 내부 판정은 그대로 유지한다(재계산 없음) —
  // toSellerFacingVerdict()는 그 값을 화면용으로 압축만 하는 presentation layer.
  const sellerFacingVerdict = toSellerFacingVerdict(representativeVerdict);

  // N-4.18-K STEP K-1/K-2 — computeMarketAlert()에 넘길 "변화량"은 국내는
  // domesticShopTrend7d(이미 sellerAction에도 쓰는 값과 동일 소스), 해외는
  // originChange(SELLER_ORIGIN 최근 2건 비교)를 그대로 재사용한다. 새 변화
  // 계산을 만들지 않는다.
  const domesticChangeForAlert =
    domesticShopTrend7d && domesticShopTrend7d.current != null && domesticShopTrend7d.previous != null
      ? {
          amountKrw: domesticShopTrend7d.current - domesticShopTrend7d.previous,
          ratePercent: domesticShopTrend7d.changeRate,
        }
      : null;
  const originChangeForAlert = originChange
    ? { amountKrw: originChange.changeAmountKrw, ratePercent: originChange.changeRatePercent }
    : null;

  // P-29 Sprint 7(CPO 지시, 2026-09-03) — "가격이 좋아도 팔릴지"는 CASE
  // A/B/C/D(가격 경쟁력)와 완전히 별개의 판단이다. deriveMarketSignals()는
  // marketCase를 전혀 참조하지 않는 순수 함수이고(packages/pricing/
  // market-signals.ts), 여기서도 가격 판정을 다시 계산하지 않는다 — 이미
  // 계산된 domesticSummary.sellerCount를 재사용(신규 검색 없음), 검색 관심만
  // Naver DataLab을 브랜드당 캐시로 호출한다(CEO API 호출량 보호 정책 —
  // P-30부터 TTL이 결과 상태별로 다르다, market-signals-cache.ts 참조).
  const searchInterest = await getSearchInterestRatio(product.brand.value);
  const marketSignals = deriveMarketSignals({
    domesticSellerCount: domesticSummary.sellerCount,
    // P-31 — 국내 가격 확인 자체를 못 한 상태(tier NONE + 판매처 0)에서는
    // "판매처 0곳(낮음)"이 아니라 "확인 불가"다. 데이터 부족을 시장 평가로
    // 둔갑시키지 않는다.
    domesticSellerCountKnown: domesticSummary.sellerCount > 0 || domesticSummary.tier !== "NONE",
    searchInterestRatio: searchInterest.ratio,
    searchInterestStatus: searchInterest.status,
    titleText: product.title.value,
    nowMonth: new Date().getMonth() + 1,
  });
  // UX-3(CPO 지시, 2026-09-06) — 전략 가이드가 모든 상품에 같은 문구를 내던
  // 문제를 고친다. 새 계산은 하지 않고, 위에서 이미 계산된 값만 그대로 넘긴다
  // (recommendation은 computePriceRecommendation 결과, landedCost/최저가는
  // cost/domesticSummary 원본). 값이 없으면 null을 넘겨 "없는 숫자를 만들지
  // 않는다" 규칙을 함수 쪽에서 지키게 한다.
  // MI-UX-4(CPO 지시, 2026-09-06) — 요약(기본 화면)과 상세 가이드가 서로 다른
  // 숫자를 말하면 안 되므로 facts를 한 번만 만들어 두 함수에 같이 넘긴다.
  const guidanceFacts = {
    recommendedPriceKrw: recommendation?.recommendedPrice ?? null,
    targetPriceKrw: recommendation?.targetPrice ?? null,
    estimatedMarginPercent: recommendation?.estimatedMarginPercent ?? null,
    // breakdownInput은 위 `if (cost)` 블록 스코프라 여기서 쓸 수 없다.
    // computePriceRecommendation에 넘긴 것과 정확히 같은 소스 표현을 쓴다
    // (새 값이 아니라 동일 값 — 두 곳의 목표 마진율이 어긋나면 안 된다).
    targetMarginPercent: (product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT).marginPercent,
    landedCostKrw: cost?.landedCostKrw ?? null,
    // CASE A/B/C의 "시장 기준가"는 EXACT 동일상품 최저가다. CASE D에서는
    // numericGuidance가 이 값을 쓰지 않는다(동일상품 미확정이므로).
    domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
    brandMedianPriceKrw: usableBrandMarketProfile?.medianPriceKrw ?? null,
    // 확인 자체를 못 한 경우(tier NONE + 0곳)는 0이 아니라 null — "판매처
    // 없음"과 "확인 못 함"을 구분한다(deriveMarketSignals와 동일 기준).
    sellerCount:
      domesticSummary.sellerCount > 0 || domesticSummary.tier !== "NONE" ? domesticSummary.sellerCount : null,
    // MI-SUPPLY-ADVANTAGE-1 — 공급 판정의 게이트. computePriceRecommendation에
    // 넘긴 것과 같은 값이다(새 계산 없음). EXACT가 아니면 공급을 논하지 않는다.
    domesticBasis: domesticMarketSplit.basis,
    // MI-DATA-FRESHNESS-1(CPO 지시, 2026-09-06) — 최저가가 언제 관측된
    // 값인지. getPriceHistory는 기간 필터 없이 최근 60건을 주므로 이 값은
    // "지금 최저가"가 아니다. 화면이 현재가처럼 보여주지 않도록 경과일을
    // 함께 넘긴다. 관측 시점이 없으면 null — 추정하지 않는다.
    domesticLowestAgeDays:
      domesticSummary.lowestPriceCheckedAt != null
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(domesticSummary.lowestPriceCheckedAt).getTime()) / (24 * 60 * 60 * 1000),
            ),
          )
        : null,
    // 착지원가가 실측 판매가 기준인지 저장된 스냅샷 가격 기준인지.
    costSource: cost != null ? costSource : null,
  };
  const sellingGuidance = buildSellingGuidance(
    recommendation?.marketCase ?? null,
    marketSignals.signals,
    guidanceFacts,
  );
  const sellingSummary = buildSellingSummary(recommendation?.marketCase ?? null, guidanceFacts);
  // MI-CONFIDENCE-1 — 같은 facts에서 "무엇이 확인됐는가"만 집계한다(새 점수 없음).
  const confidenceBasis = buildConfidenceBasis(guidanceFacts, marketSignals.signals);

  // P-31 — PRICE REALITY → CASE → MARKET SIGNAL → SELLER GUIDANCE 순서.
  // sellerFacingVerdict(가격/매칭 레이어)가 최종 판정의 단일 소스이고,
  // buildSellerDecision()은 그것을 시장 신호로 "강등만" 할 수 있다.
  const sellerDecision = buildSellerDecision({
    priceVerdict: sellerFacingVerdict.code,
    marketCase: recommendation?.marketCase ?? null,
    estimatedMarginPercent: recommendation?.estimatedMarginPercent ?? null,
    signals: marketSignals.signals,
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * MI-REAL-12(CEO 지시, 2026-09-21) — **읽기 전용 조사 로그. 판정을 바꾸지 않는다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 확정해야 하는 질문 하나: 「Vernice Nero 는 국내 EXACT 가격(₩258,000)을
   * 확보했는데 왜 🟡 조건부 판매인가」. 판정 트리를 읽어 «원가·마진 축» 까지는
   * 좁혔지만(MI-REAL-11), 다섯 경로 중 어느 것인지는 `sellability.level` /
   * `marketCase` / `missingComponents` 없이는 못 가른다. 그 값들은 여기서
   * 계산되고 **어디에도 저장되지 않는다** — 그래서 관측할 자리가 여기뿐이다.
   *
   * 🔴 여기서 계산하는 것은 한 줄도 없다. 이미 만들어진 값을 읽기만 한다.
   * 🔴 로그에 남기는 것은 «판정 값» 뿐이다 — 자격증명·토큰·payload·개인정보 금지.
   *    상품 식별은 snapshotId 하나로 충분하다(제목도 URL도 넣지 않는다).
   */
  console.log(
    `[MI-REAL-12] ${JSON.stringify({
      snapshotId,
      domesticBasis: domesticMarketSplit.basis,
      exactSellers: domesticMarketSplit.exact.sellerCount,
      comparisonSellers: domesticMarketSplit.comparison.sellerCount,
      marketCase: recommendation?.marketCase ?? null,
      // 🔴 MI-P0-COST-02 — 금액과 근거는 «한 세트» 로 움직인다. 예전에는 basis 가
      //    unifiedDecision(Production 에서 항상 null) 안에만 있어 관측되지 않았다.
      shippingKrwResolved: resolvedShipping.amountKrw,
      shippingBasisResolved: resolvedShipping.basis,
      grossMarginPercent: recommendation?.estimatedMarginPercent ?? null,
      netProfitKrw: recommendation?.netProfitKrw ?? null,
      netMarginPercent: recommendation?.netMarginPercent ?? null,
      expectedFeePercent: breakdownInput.feePercent,
      sellability: sellability.level,
      representative: representativeVerdict.code,
      priceVerdict: sellerFacingVerdict.code,
      finalVerdict: sellerDecision.finalVerdict,
      downgradedByMarket: sellerDecision.downgradedByMarket,
      outlook: sellerDecision.outlook,
      landedCostKrw: unifiedDecision?.landedCostKrw.value ?? null,
      estimatedProfitKrw: unifiedDecision?.estimatedProfitKrw.value ?? null,
      shippingBasis: unifiedDecision?.landedCostKrw.shippingBasis ?? null,
      shippingMethod: unifiedDecision?.landedCostKrw.shippingMethod ?? null,
      marginPercent: unifiedDecision?.marginPercent.value ?? null,
      dataCompleteness: unifiedDecision?.dataCompleteness ?? null,
      missingComponents: unifiedDecision?.missingComponents ?? null,
      unifiedVerdict: unifiedDecision?.verdict ?? null,
      reasons: representativeVerdict.reasons,
    })}`,
  );

  /**
   * 🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — 집계를 **한 번만** 부른다.
   *    🔴 전에는 return 안에서 인라인으로 불렀는데, 새 축이 **같은 값** 을 읽어야 해서
   *       두 번 부르면 「두 숫자가 갈릴 수 있는 구조」가 생긴다 ⟹ 변수 하나로 묶는다.
   *    🟢 집계 **내용은 한 글자도 바뀌지 않았다**(같은 함수 · 같은 인자).
   */
  const domesticCandidatePriceSummary = summarizeCandidateOverseasPrices(domesticTransientRecords);
  /**
   * 🔵 §3-4(⑥) — **해외 요약을 «한 번만» 만든다.** 전엔 반환부에서 인라인 호출이었는데
   *    ⑥ 이 그 결과(`lowestKrw`)를 읽어야 해서 const 로 뽑았다.
   * 🔴 **두 번 부르면 두 숫자가 갈릴 수 있다** — 같은 입력이라도 owner 를 둘로 만들지 않는다.
   * 🟢 집계 내용은 **한 글자도 바뀌지 않았다**(같은 함수 · 같은 입력).
   */
  const overseasSummary = summarizeCandidateOverseasPrices(overseasEvidence);

  return {
    snapshotId,
    product: { title: product.title.value, brand: product.brand.value, sourceUrl: product.sourceUrl },
    currentPrice: { sellingPriceKrw: currentSellingPriceKrw, costPriceKrw, costBasis },
    /**
     * UX 2.4(CEO 지시, 2026-09-11) — "원래 얼마고, 이 판매자는 한국/미국/유럽에서
     * 각각 얼마에 팔고 있지?"에 답할 값. GLOBAL-MARKET ②③이 en-kr/en-us/en-fr/
     * en-de/en-int를 전부 price_observations에 저장해 왔는데, 응답이 들고 있는
     * originHistory는 **원가 근거 행만 남긴 것**(MARKET_PROBE 제외)이라 그
     * 시장들이 화면까지 오지 못했다 — DB에는 도착했는데 경험에서 사라진 값이다.
     *
     * 여기서 새로 계산하는 것은 없다. 필터링 전 originRecords를 시장별 최신
     * 1건으로 고르기만 한다(groupMarketObservations). 원가/마진/CASE 판정이 읽는
     * originHistory는 위 그대로라, 이 줄을 더해도 판정 입력은 한 글자도 바뀌지
     * 않는다 — MARKET_PROBE 행은 여전히 원가 근거에서 빠져 있다.
     */
    sellerGlobalMarkets: groupMarketObservations(originRecords),
    domesticCompetition: domesticSummary,
    // P-19-B Sprint 7/9(CPO 지시, 2026-09-02) — UI가 "동일상품 가격"인지 "국내 유사
    // 시장가격(참고용)"인지 문구를 구분해서 보여줄 수 있도록 두 버킷과 basis를
    // 그대로 노출한다. domesticCompetition(=resolved)은 하위호환을 위해 그대로 둔다.
    domesticMarketSplit,
    sellerAction,
    sellability,
    representativeVerdict,
    sellerFacingVerdict,
    marketSignals,
    sellingGuidance,
    // MI-UX-4 — 기본 화면용 한 줄 요약(상세 가이드는 sellingGuidance 그대로).
    sellingSummary,
    confidenceBasis,
    sellerDecision,
    priceHistory: {
      origin: { records: originHistory, change: originChange, trend7d: originTrend7d, trend30d: originTrend30d },
      domestic: { records: domesticHistory, trend7d: domesticTrend7d, trend30d: domesticTrend30d },
      domesticShop: { records: domesticShopHistory, trend7d: domesticShopTrend7d, trend30d: domesticShopTrend30d },
    },
    fx: cost ? { rate: cost.exchangeRate, isEstimate: cost.isRateEstimate } : null,
    cost,
    // P-12B — cost가 실제로 어떤 기준으로 계산됐는지 UI까지 전달한다("최신
    // 확인가 기준" vs "저장된 가격 기준" 구분 표시용).
    costSource: cost ? costSource : null,
    // P-13A — 국내 동일상품이 없을 때 UI가 "왜 이 가격인가"에 쓸 브랜드 시장
    // 근거. confidence=INSUFFICIENT면 null(가격 판단에 안 쓴다는 뜻과 동일 —
    // usableBrandMarketProfile과 표시 여부를 일치시킨다).
    brandMarketProfile: usableBrandMarketProfile,
    margin: decision ? { percent: decision.marginPercent } : null,
    /**
     * GOLF-01 축B — 이 상품의 원가가 **어느 비용 정책으로** 계산됐는가.
     * 화면이 "관세를 왜 세지 않았는지 / 왜 확인 필요인지"를 말할 수 있는 근거다.
     * 정책만 보내고 판정은 보내지 않는다 — 판정은 unifiedDecision 하나뿐이다.
     */
    costPolicy: {
      id: costPolicy.id,
      label: costPolicy.label,
      landedCostTaxBasis: costPolicy.landedCostTaxBasis,
      note: costPolicy.policyNote,
      /** 품목/HS를 확정한 카테고리만 값이 있다. null이면 관세가 «확인 필요»다. */
      hsCode: costPolicy.hsCode,
    },
    /**
     * GOLF-01-TAX — **판매자 원가 밖에** 서는 예상 구매자 부담. 모든 카테고리가
     * 같은 모양으로 받는다(아동의류도 골프도 같은 함수를 지난다). 원가를
     * 계산하지 못한 상품에서는 null이다.
     */
    buyerImportCharge,
    decision,
    unifiedDecision,
    recommendation,
    alertSignal,
    /** K-1 threshold 판정에 쓸 원재료(가격 알림 저장 로직에서만 사용, GET
     * 응답 스키마에는 그대로 노출하지 않는다 — 화면은 sellerAction만 본다). */
    _alertInputs: { domesticChange: domesticChangeForAlert, originChange: originChangeForAlert },
    /**
     * 🔴🔴 **등록 «순간» 의 transient evidence.** 저장되지 않은 Gemini 후보의
     *    기존-MI 판정 결과다(§5). 🔴 위 어떤 값도 이것을 읽지 않는다 —
     *    `sellerAction`·tier·가격·alert 는 이 칸과 **독립** 이다.
     * 🔴 `null` = 경로가 안 돌았다 · `[]` = 켰는데 후보가 없었다.
     */
    /**
     * 🔵 §3-2 — **행에 `priceKrwDerived` 가 실려 나간다**(원본 칸은 그대로).
     * 🔴 POST 경로의 UI 행이 이것이다 ⟹ `:2486`·`:2658` 이 **같은 숫자** 를 읽는다.
     */
    geminiEvidence: attachDerivedKrw(geminiEvidence, candidateKrwByUrl),
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 B-3 — **재진입 복원용 표시 전용 배열**
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴🔴 **위 어떤 계산도 이 칸을 읽지 않는다.** 그것이 이 칸이 따로 있는 이유다 —
     *    `geminiEvidence` 는 가격 집계 입력(`:226` 루프)이고 이 칸은 **화면 전용** 이다.
     *    ⟹ 복원이 `sellerAction`·tier·원가·마진·추천가·alert·`candidateOverseasPrice` 를
     *      **한 글자도 바꾸지 않는다**(B3-04 · 계약이 그것을 문다).
     * 🔴 **이 칸을 `geminiEvidence` 와 합치지 않는다** — 합치는 순간 저장분이 집계에 들어간다.
     * 🔴 `null` = GET 복원이 안 돌았다(POST `/check`) · `[]` = 돌았는데 저장이 없다.
     */
    /**
     * 🔵 §3-2 — **GET 재진입 복원 행도 «같은» 환율의 파생값을 받는다.**
     * 🔴 그래서 POST·GET 이 같은 숫자를 낸다(지시서 §1·§2 「동일한 계약」).
     */
    savedCandidateRows: attachDerivedKrw(savedCandidateRows, candidateKrwByUrl),
    /** 🔴 010R 관측용 — 가격이 붙어 버킷에 들어간 수 / 가격 없어 빠진 수.
     *    🔴 위 판정 계산은 이 칸을 읽지 않는다. */
    geminiPricedCount,
    /**
     * 🔴🔴 MI-020 §5/§6 — **해외 가격의 「읽는 쪽」.** 통화별로만 모으고
     *    **환산하지 않는다.** 🔴 위 국내 판정·원가·마진은 이 칸을 **읽지 않는다** —
     *    그것이 「해외 가격이 원가/국내 가격을 오염시키지 않는다」의 구현이다.
     * 🟢 `UNKNOWN` 을 해외로 합치지 않는다(`byMarket` 로 갈라 센다).
     */
    candidateOverseasPrice: overseasSummary,
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 §3-4(⑥) — **국내 기준 가격 ↔ 해외 최저 환산가 차이.**
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴🔴 **파생 정보다.** 위 `sellerAction`·tier·CASE·추천가·`price_alerts` 는 이 칸을
     *    **읽지 않는다** — 그것이 「기존 판정을 자동으로 바꾸지 않는다」의 구현이다(CPO §1).
     * 🟢 국내 기준값은 **기존 집계 owner** 를 그대로 넘긴다(`domesticSummary.lowestPriceKrw`)
     *    ⟹ 🔴 이 WU 가 국내 가격을 **새로 고르지 않는다**(동일상품 ↔ 유사상품 기준 혼합 0).
     * 🟢 해외 쪽은 `overseasSummary.lowestKrw` 하나 ⟹ **적격성 퍼널을 통과한 후보만**
     *    들어오고 **환산 불가 후보는 애초에 빠져 있다**.
     * 🔴 한쪽이라도 없으면 **`null`** 이다 — 「0원 차이」로 오인시키지 않는다.
     */
    marketKrwComparison: compareDomesticVsOverseasKrw(
      domesticSummary.lowestPriceKrw,
      overseasSummary.lowestKrw,
    ),
    /**
     * 🔴🔴 WU-056 — **이번 확인으로 들어온 «국내» 가격 집계.**
     *    🟢 `domesticCompetition` 과 **다른 칸** 이다 — 그쪽은 DB 후보와 합쳐진
     *       권위값이고 GET 에서도 만들어진다. 이 칸은 **transient 만** 담는다.
     *    🔴 판매판정·국내 최저가 계산에 들어가지 않는다(읽는 쪽이 따로 있다).
     */
    candidateDomesticPrice: domesticCandidatePriceSummary,
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **별도 축**(CPO 승인 2026-11-09)
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴🔴 **기존 경로에 한 글자도 닿지 않는다** — 이 값은 **여기서 처음 만들어지고**
     *    `computePriceRecommendation`(CASE A~D) · `computePriceDecision`(verdict) ·
     *    `buildSellerDecision` · `representativeVerdict` 의 **입력이 아니다**.
     *    ⟹ `marketCase` · `finalVerdict` · `recommendedPriceKrw` **변화 0**.
     * 🟢 입력은 **전부 이미 계산된 값** 이다(새 집계·새 수집 **0**) — 참고가격은 바로 위
     *    집계의 **KRW 최저**, 원가는 `cost.landedCostKrw`, 목표마진은
     *    `breakdownInput.marginPercent`, 제외 수는 그 집계의 두 칸이다.
     * 🔴 **KRW 로 좁혀서** 넘긴다 — 환산하지 않는다(WU-020 외화 보호 유지).
     */
    referenceProfitability: computeReferenceProfitability({
      referencePriceKrw: domesticCandidatePriceSummary.byCurrency.KRW?.lowestAmount ?? null,
      landedCostKrw: cost?.landedCostKrw ?? null,
      targetMarginPercent: breakdownInput.marginPercent,
      sellerCount: domesticCandidatePriceSummary.byCurrency.KRW?.count ?? 0,
      excludedUnverified: domesticCandidatePriceSummary.unverifiedCount,
      excludedObservedDifference: domesticCandidatePriceSummary.observedDifferenceCount,
    }),
    /** 🔴 원본 목록도 같이 돌려준다 — 집계만 주면 「어느 후보였나」를 잃는다. */
    candidateOverseasEvidence: overseasEvidence,
  };
}

export type MarketIntelligence = NonNullable<Awaited<ReturnType<typeof computeMarketIntelligence>>>;
