import {
  compareModelCode,
  confirmBrandCodeInTitle,
  decideCandidateEvidence,
  extractForeignModelCode,
  fetchDomesticModelCode,
  isColorUnverified,
  isSelfReferenceCandidate,
  refreshDomesticProductPrice,
  searchDomesticShops,
  withConfidence,
  enrichCandidatePrices,
  supportsDomesticIdentifierExtraction,
  type CandidateEvidenceDecision,
  type ComparisonCandidate,
  type MatchTruth,
  type ModelEvidenceResult,
} from "@commerce/crawler";
import { sourceFitsScopes } from "@commerce/category";
import {
  buildCrossSellerSearchQueries,
  productFactsFromIdentityDna,
  type ProductIdentityDna,
} from "@commerce/shared";
import { isCollectableAccess } from "../../comparison-shops/_lib/comparison-shop";
/* 🔴 MI-GEMINI-INTEGRATION-005 — flag 기본 OFF. OFF 면 아래 분기가 한 줄도 돌지 않고
 *    기존 동작이 **100% 유지** 된다(§13). */
import {
  collectGeminiCandidatePool,
  isGeminiDiscoveryEnabled,
  normalizeCandidateUrl,
  GEMINI_VIRTUAL_SHOP_ID,
  type GeminiPoolMetrics,
} from "./gemini-candidate-pool";
import {
  classifyCandidateMarket,
  type CandidateMarket,
  type CandidateMarketBasis,
} from "./candidate-market";
import type { DomesticPriceSource } from "../../domestic-price-sources/_lib/domestic-price-source";
import { listDomesticPriceSources, recordDomesticSourceCheckAttempt } from "../../domestic-price-sources/_lib/domestic-price-source";
import {
  listDomesticProductLinks,
  priceTierFromLink,
  toDomesticMatchType,
  upsertDomesticProductLink,
  type DomesticMatchType,
  type DomesticPriceTier,
} from "../../domestic-price-sources/_lib/domestic-product-link";
import { buildMatchProvenanceReasons } from "../../domestic-price-sources/_lib/match-provenance";
import {
  findCachedVisionEvidence,
  MEDIA_RESOLUTION as VISION_MEDIA_RESOLUTION,
  observeVision,
  runVisionEvidence,
  VISION_MODEL as VISION_MODEL_NAME,
  VISION_PROMPT_VERSION,
  type VisionEvidence,
} from "./vision-evidence";
// P0-A.30.2 ㉠ — 관측 전용 저장소. 🔴 가격 경로는 이 표를 읽지 않는다.
import { hasVisionObservation, pickE1Candidate, recordVisionObservation } from "./vision-observation";
import { hasObservationToday, recordPriceObservations } from "./price-observations";

/**
 * N-4.07 2차(대표님 지시: "동일상품 매칭 → 검증 → 가격관측 → 일자별 이력 →
 * 가격변동/마진 판단") — 국내 편집샵 파이프라인 전체를 한 함수로 묶는다.
 * runPriceCheck(해외 원가)와 나란히 존재하며 daily cron/수동 "지금 확인"이
 * 둘 다 호출한다.
 *
 * 절대 금지(migration 029 주석, 작업지시서 Part 2) — 검색으로 후보를 찾았다고
 * 바로 가격에 반영하지 않는다. STEP 1(매칭)에서 만든 링크가 verified=true인
 * 것만 STEP 2(가격 관측)에서 실제로 조회한다.
 *
 * N-4.18-C STEP3(대표님 지시: "등록상품의 Product DNA를 기준으로 최소한의
 * 후보만 찾는다") — 입력을 title/brand/sourceUrl/sku 개별 필드가 아니라
 * ProductIdentityDna 하나로 받는다. 검색 API에 보낼 검색어(searchTerm)는
 * buildDomesticShopQuery로 DNA 우선순위(SKU 단독 > 브랜드+모델명 > 브랜드+
 * 핵심 상품명)로 최소화하고, 동일상품 판정(scoreCandidateMatch)에 쓰는
 * title/brand/sku는 기존과 동일하게 원본 값을 그대로 넘긴다 — 검색어를
 * 좁히는 것과 매칭 신호를 넓게 쓰는 것은 별개 관심사다.
 */
export interface DomesticPriceCheckInput {
  snapshotId: string;
  dna: ProductIdentityDna;
  /** GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — 어느 판매자의 편집샵 목록으로
   * 검색할지. 선택 인자로 두지 않는다 — 안 넘기면 조용히 "전체 카탈로그"로
   * 검색되어, 판매자가 꺼 둔 편집샵까지 매일 크롤링하고 그 가격이 링크로
   * 저장된다(끈 사실이 무의미해진다). 호출부는 requireUser()가 정한 값을
   * 그대로 넘긴다. */
  workspaceId: string;
  skipIfCheckedToday?: boolean;
  /** N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — modelCode 증거(H-3-2)의
   * 해외측 원문 소스. ProductIdentityDna에는 없는 필드라(설계 원칙: "이미
   * 확보한 값만으로 DNA를 만든다") 이 함수 입력에만 선택적으로 추가한다 —
   * 없으면(undefined) modelCode 증거는 그냥 unavailable로 정직하게 처리되고
   * 기존 동작이 그대로 유지된다(호출부를 안 고쳐도 회귀 없음). */
  description?: string;
  /**
   * TTAEJYO 2.0(CEO 지시, 2026-09-12) — 이 상품에 맞는 국내 판매처 범위
   * (domestic_price_sources.category_scope와 대조할 값). resolveCategoryScopes가
   * 정한다.
   *
   * 선택 인자인 이유는 workspaceId와 정반대다. 안 넘기면 "전부 검색"이 되는데,
   * 그건 **오늘의 동작 그대로**라 넘기지 않은 호출부가 조용히 손해를 보지
   * 않는다(workspaceId는 안 넘기면 남의 설정을 무시하게 되므로 필수였다).
   */
  categoryScopes?: string[] | null;
}

/**
 * 🔴🔴 **영구 entity 가 아니다.** 등록 «순간» 의 판단 근거로만 쓰고 버린다
 *    (지시서 §5: DB 저장 ❌ · links 저장 ❌ · 가격 이력 ❌ · 장기 캐시 ❌).
 *
 * 🟢 값은 전부 **기존 MI 가 이미 계산한 것** 이다 — 새 판정기를 만들지 않았다
 *    (`judgeDomesticCandidate` → `priceTierFromLink`). 🔴 Gemini 전용 규칙 0.
 */
export interface GeminiTransientEvidence {
  /** 🔴 출처를 잃지 않는다 — 기존 국내 후보와 섞여도 구분 가능해야 한다(§7). */
  source: "GEMINI_DISCOVERY";
  /** 🔴 가상 shopId 가 아니라 **실제 판매처 도메인** 이다. */
  domain: string;
  discoveredUrl: string;
  matchTruth: MatchTruth | null;
  verified: boolean;
  /** 🟢 `priceTierFromLink` 를 **호출해서** 얻는다 — 복제 계산 금지(헌장 §12). */
  priceTier: DomesticPriceTier;
  matchType: DomesticMatchType | null;
  crossSellerVerdict: string | null;
  confidence: number | null;
  matchReasons: string[];
  crossSellerBlockers: string[];
  crossSellerConflicts: string[];
  /**
   * 🔴🔴 010R — 가격은 **기존 owner 가 확인한 것만** 싣는다
   *    (`enrichCandidatePrices` → `priceStatus: "VERIFIED_CURRENT"`).
   * 🔴 `priceKrw` 는 **통화가 KRW 일 때만** 채운다 — 임의 FX 환산을 하지 않는다.
   *    그래서 해외 샵(EUR/USD)은 `priceKrw: null` 이고, 기존 집계기가
   *    `priceKrw != null` 필터로 **자동 제외** 한다(price-history.ts:498).
   *    🟢 즉 「국내 가격 증거」 게이트가 **내 규칙이 아니라 기존 규칙** 이다.
   */
  priceAmount: number | null;
  priceCurrency: string | null;
  priceKrw: number | null;
  priceStatus: string | null;
  /**
   * 🔴🔴 MI-020 §4 — 이 가격이 «어느 시장» 의 가격인가. `classifyCandidateMarket`
   *    (candidate-market.ts)이 **증거 둘의 교차** 로만 낸다.
   * 🔴 `UNKNOWN` 을 국내로 승격하지 않는다 — 그 금지가 집계 게이트에 박혀 있다
   *    (market-intelligence.ts). 충돌(등록부 ↔ 외화)도 UNKNOWN 이다.
   */
  market: CandidateMarket;
  /** 🔴 왜 그렇게 판정했는지 — 숫자를 해석할 때 이 칸 없이 읽으면 또 추측이 된다. */
  basis: CandidateMarketBasis;
}

export interface DomesticPriceCheckResult {
  linksCreatedOrUpdated: number;
  pricesRecorded: number;
  sourceErrors: string[];
  /** 🔴 MI-GEMINI-005 §10 — flag OFF 면 `null` 이다(「0 회」가 아니라 「안 돌았다」). */
  geminiMetrics?: GeminiPoolMetrics | null;
  /**
   * 🔴🔴 MI-GEMINI-REGISTRATION-DECISION-009 — **transient evidence.**
   *
   * Gemini 후보는 `domestic_product_links` 에 저장되지 않는다(§5/§19). 그래서
   * 판정 결과가 지금까지 `continue` 와 함께 **버려졌다**. 이 칸이 그것을 런타임
   * 객체로 들고 나온다 — **DB 저장 0 · 캐시 0 · 요청 범위 안에서만 존재한다.**
   *
   * 🔴 `null` = flag OFF(경로가 안 돌았다) · `[]` = 켰는데 후보가 없었다. 섞지 않는다.
   */
  geminiEvidence?: GeminiTransientEvidence[] | null;
  /** 🔴 010R §6 — Gemini 가격 보강 호출 수. 국내 상세 fetch 와 **다른 칸** 이다. */
  geminiPriceEnrichCalls?: number;
  /**
   * 🔴 016 — Gemini 를 **부르지 않은 이유**. `null` 이면 불렀거나 flag OFF 다.
   *    🟢 「0 회」와 「건너뛴 이유가 있다」를 가른다 — 비용 보고가 그것을 구분해야 한다.
   */
  geminiSkipReason?: "DETERMINISTIC_HIT" | "ALREADY_CHECKED_TODAY" | null;
  /**
   * 🔴 016 ⑥ — **Vision 은 Discovery 와 별도 비용이다.** 같은 `GEMINI_API_KEY` 를
   *    쓰지만 이미지를 보내므로 단가 구조가 다르다. 합산하지 않는다.
   */
  visionCalls?: number;
  /** N-4.18-Q3 PART H-3-11 STEP 7(대표님 지시, 2026-08-27: "실제로 네트워크
   * 요청이 생략됐는지 확인한다") — 이번 호출에서 실제로 발생한 국내 식별자
   * (modelCode) 추출 시도 총 횟수. isEvidenceEvaluationWorthwhile 가드가
   * 판단 결과에는 영향을 주지 않으면서 이 값만 줄이는지를 응답값으로
   * 직접 확인할 수 있게 하는 관측용 필드다. P-28(2026-09-03)에서
   * foretforetModelCodeFetchCount → domesticModelCodeFetchCount로 개명
   * (foretforet.com 전용이 아니게 됐으므로 — bobochoses.com 등 URL 기반
   * 추출은 실제 HTTP fetch가 없지만 "시도 횟수"라는 의미는 동일하다). */
  domesticModelCodeFetchCount: number;
}

/** N-4.07 3차(실측 발견, 2026-08-23) — 개발/테스트용으로 제목 앞에 붙는
 * "[TEST]" 같은 대괄호 태그는 실제 상품명이 아니다. Shopify suggest.json으로
 * 직접 확인한 결과 이 태그가 남아있으면 진짜 동일상품(B126AC050)조차 검색
 * 결과가 0건으로 나온다(태그를 뗀 같은 문자열로는 정상적으로 나옴) — 검색
 * 엔진 자체가 이 문자열을 토큰으로 처리 못 하는 것으로 보인다. 실제 상품명
 * 텍스트는 전혀 건드리지 않고, 맨 앞 "[...]" 패턴만 제거한다(가운데/끝에 있는
 * 괄호는 실제 모델 정보일 수 있어 손대지 않는다). */
function stripLeadingDevTag(title: string): string {
  return title.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
}

/** N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — decideCandidateEvidence의
 * 3단계 결정을 실제 링크 필드(verified/matchReasons)에 반영하는 안전장치.
 * matchType(EXACT/HIGH_CONFIDENCE/REVIEW_REQUIRED/NOT_MATCHED) 라벨 자체는
 * 여전히 toDomesticMatchType(기존 matchLevel 기반)이 그대로 정한다 — 여기서
 * 바꾸는 건 verified 플래그뿐이다("자동확정 가능/금지"는 결국 verified가
 * true여야만 STEP 2 가격 관측 대상이 되므로, 이 필드 하나로 대표님이 요청한
 * "자동확정 가능/금지"가 실제 기능으로 연결된다).
 *
 * decision==="unchanged"일 때는 verified는 baseAutoVerified를 그대로 돌려준다
 * (자동확정 여부는 절대 안 바뀐다) — 이 순수 함수를 독립적으로 테스트할 수 있어
 * 회귀(특히 "unchanged가 절대 기존 verified를 안 바꾼다")를 실제 코드로 고정할
 * 수 있다.
 *
 * N-4.18-Q3 UI 후속(대표님 지시, 2026-08-27: "왜 REVIEW_REQUIRED인지, modelCode
 * partial/conflict을 화면에서 보여줘야 한다") — matchReasons는 unchanged일 때도
 * decision.reasons를 덧붙인다. decideCandidateEvidence()는 partial/exact(승격
 * 안 됨)/strong_overlap/possible_match 같은 경우에도 이미 설명용 reasons를
 * 만들어 두고 있었는데(decision.ts), 지금까지는 verified/matchType을 안 바꾸는
 * "unchanged"일 때 이 reasons를 통째로 버렸다 — 그래서 modelCode가 partial로
 * 확인됐어도 화면 어디에도 그 사실이 안 보였다. verified/matchType 계산에는
 * 전혀 관여하지 않고, 오직 "왜 이 판단인지" 설명 텍스트만 추가한다. */
export function applyEvidenceDecision(
  baseReasons: string[],
  decision: CandidateEvidenceDecision,
): { verified: boolean; matchReasons: string[] } {
  if (decision.decision === "auto_confirm") {
    return { verified: true, matchReasons: [...baseReasons, ...decision.reasons] };
  }
  if (decision.decision === "review_required") {
    return { verified: false, matchReasons: [...baseReasons, ...decision.reasons] };
  }
  // P-19-B Sprint 6(CPO 지시, 2026-09-02: "SKU·모델코드·Article Code 등 식별자
  // 근거 없이, 텍스트 유사도 95% 이상이라는 이유만으로 동일상품 확인/verified
  // 처리 금지") — decision==="unchanged"는 modelCode가 "unavailable"이라는 뜻
  // (식별자 증거 자체를 비교할 수 없음, truth는 TEXT_CONFIRMED/SIMILAR/
  // INSUFFICIENT_EVIDENCE 중 하나). 과거(P-7-C 시절)엔 이 분기에서 텍스트-only
  // autoVerified 값을 그대로 넘겨받아 verified=true가 될 수 있었다("Bobo Choses
  // Golden Case") — 이번 지시로 그 경로를 막는다. 식별자 근거가 없으면 텍스트
  // 점수가 아무리 높아도 항상 verified=false(=🟡 비교상품, 동일상품 가격에는
  // 반영하지 않고 시장 참고가격으로만 사용 — priceTierFromLink 참고).
  return { verified: false, matchReasons: [...baseReasons, ...decision.reasons] };
}

/** N-4.18-Q3 PART H-3-9(대표님 지시, 2026-08-27) — H-3-7 실측(PèPè golden case)에서
 * 확인된 문제: 텍스트 confidence 1위 후보가 실제로는 다른 상품(modelCode conflict)인
 * 경우, 진짜 동일상품(3위, modelCode partial)이 evidence 평가 기회조차 얻지 못하고
 * DB에는 틀린 1위만 저장됐다. 이 함수는 confidence 순위 자체는 전혀 건드리지
 * 않는다(scoreCandidateMatch/classifyMatchLevel/threshold 재계산 없음, candidates는
 * withConfidence가 이미 정렬해 온 그대로 사용) — 그 순서 안에서 "conflict로 확인된
 * 후보를 최종 대표 후보에서만 제외"하는 안전장치를 얹는다.
 *
 * FORETFORET 외 사이트는 지금도 modelCode 추출이 없으므로(H-3-2) 최상위 후보 1건만
 * 즉시 반환한다 — 기존 top-1 동작과 100% 동일하고, 불필요한 evaluated 루프/함수
 * 호출도 만들지 않는다.
 *
 * FORETFORET는 상위 MAX_EVIDENCE_CANDIDATES(3)개까지만 순서대로 modelCode를
 * 평가해서, conflict가 아닌 첫 번째 후보(=남은 후보 중 confidence 최고, 배열이 이미
 * 정렬돼 있으므로)를 최종 후보로 고른다. 전부 conflict면 evaluated[0](=candidates[0],
 * 기존 top-1과 동일)을 그대로 반환한다 — "전부 conflict → 기존 1위를 REVIEW_REQUIRED로
 * 유지"라는 대표님 정책은 여기서 강제로 만들지 않고, 그 후보의 modelCode=conflict가
 * 그대로 decideCandidateEvidence로 흘러가 기존 review_required/verified=false 규칙이
 * 자연히 적용되게 둔다(새 상태값을 만들지 않는다).
 *
 * fetchModelCode 실패(네트워크 오류 등)는 각 도메인 추출기(fetchForetforetModelCode
 * 등, domestic-identifiers.ts 레지스트리) 자체가 이미 null을 반환하도록 설계돼
 * 있고(H-3-2), compareModelCode(x, null)은 "unavailable"이며
 * "unavailable"은 conflict가 아니므로 이 필터를 그대로 통과한다 — 네트워크 오류 때문에
 * 정상 후보가 부당하게 탈락하는 경로가 없다(실측 확인, H-3-9 STEP 3). */
const MAX_EVIDENCE_CANDIDATES = 3;

/** N-4.18-Q3 PART H-3-11(대표님 지시, 2026-08-27) — H-3-10 실측(Konges Sløjd/
 * Emile et Ida)에서 발견: confidence 1위 후보가 이미 matchLevel="low"면 이
 * 검색결과 안의 모든 후보가 low다(withConfidence가 이미 confidence 내림차순
 * 정렬해 뒀고, matchLevel은 confidence의 단조 계단함수라 1위보다 순위가 낮은
 * 후보의 confidence는 1위 이하일 수밖에 없다 — classifyMatchLevel/threshold를
 * 재계산하지 않고 이미 계산된 결과의 성질만 이용한다).
 *
 * P-7-C STEP 2 P1(대표님 지시, 2026-08-29) — 이 가드의 원래 전제("low면 Top-N
 * 중 뭘 고르든 결과가 NOT_MATCHED로 절대 안 바뀐다")가 P-7-B 이후로는 더 이상
 * 참이 아니다. 실측(P-7-C STEP 1, production): 포레포레 정답 후보가 텍스트
 * confidence 42%(low)인데 SKU는 partial 일치한다 — 식별자 증거가 있으면 low도
 * 결과가 바뀔 수 있다(deriveMatchTruth). 따라서 "식별자를 비교할 가능성이
 * 전혀 없는 경우"에만 원래 최적화(스킵)를 유지한다: foreignModelCode 자체가
 * 없거나(해외측 원문에서 품번을 못 뽑았다), 국내측 modelCode 추출 기능이 아예
 * 없는 사이트다(P-28 이전엔 FORETFORET만 있었다 — 이제
 * supportsDomesticIdentifierExtraction()으로 일반화됨, 2026-09-03). 이 두 조건이 아니면
 * "무조건 살리는" 게 아니라 "평가라도 해본다" — 실제로 conflict/unavailable로
 * 나오면 여전히 NOT_MATCHED로 끝난다(성능 비용은 MAX_EVIDENCE_CANDIDATES=3건
 * fetch로 그대로 제한됨). */
export function isEvidenceEvaluationWorthwhile(
  candidates: ComparisonCandidate[],
  foreignModelCode: string | null,
  domain: string,
): boolean {
  if (candidates.length === 0) return false;
  // MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — 이 가드의 전제는 "low면
  // 뭘 골라도 NOT_MATCHED로 끝난다"였고, 그 전제를 무너뜨리는 증거가 식별자
  // 하나뿐이던 시절에 쓰였다. 이제는 교차판매처 판정도 텍스트 등급과 무관하게
  // 등급을 바꾼다(deriveMatchTruth: SAME → STRONG_IDENTIFIER).
  //
  // 실측 그대로다: Smallable 430701과 Bobo B226AC114는 상품명 어휘가 거의 겹치지
  // 않아 텍스트로는 low인데, 브랜드·상품군·색상·소재·핏·대상이 동시에 맞아
  // 동일상품이다. 이 가드가 그 후보를 평가 전에 버리면 판정기가 아무리 정확해도
  // 닿을 자리가 없다 — MI에서 Bobo가 아예 사라지던 경로 중 하나가 여기였다.
  if (candidates.some((c) => c.crossSellerVerdict === "SAME" || c.crossSellerVerdict === "PRESUMED_SAME")) return true;
  if (candidates[0].matchLevel !== "low") return true;
  /**
   * MI-DISCOVERY-P5.2 Step 1(CPO 지시, 2026-10-07) — 이 가드가 지키는 것은 **HTTP
   * 비용** 이다(아래 줄의 도메인 하드코딩이 그 증거다 — 품번을 fetch 로 읽는
   * 도메인만 통과시킨다). 그런데 `confirmBrandCodeInTitle` 은 이미 손에 있는
   * 제목을 보는 순수 함수라 요청을 하나도 쓰지 않는다 — 가드의 전제가 성립하지
   * 않는다.
   *
   * 🔴 실측(2026-10-07): deuxbebe 후보 제목이 `AW26MS185 - Bubble Sweatshirt -
   *    Fern Green` 인데, 이 줄이 foretforet 만 허용해서 **눈에 보이는 품번을 비교조차
   *    못 하고** 후보 전체가 EVIDENCE_NOT_WORTHWHILE 로 버려졌다.
   *
   * 🔴 추가 전용이다 — false 를 true 로만 바꾼다. 기존에 통과했던 입력은 모두
   *    그대로 통과한다(아래 줄을 지우지 않는다).
   */
  if (foreignModelCode !== null && candidates.some((c) => confirmBrandCodeInTitle(foreignModelCode, c.title) !== null)) {
    return true;
  }
  return foreignModelCode !== null && domain === "foretforet.com";
}

/**
 * MATCHING-2.0-INTEGRATION-1 — 교차판매처 판정이 있으면 그 판정이 텍스트 순위보다
 * 먼저다.
 *
 * selectDomesticCandidate는 지금까지 "confidence 1위 중 modelCode conflict가 아닌
 * 첫 후보"를 골랐다. 판매처마다 자기 SKU를 쓰는 쌍에서는 modelCode가 언제나
 * "unavailable"이라 그 필터가 발화하지 않고, 결국 텍스트 1위가 그대로 대표가 된다.
 * 그런데 같은 라인의 다른 색상이 텍스트로는 더 높게 나오는 일이 실제로 있다
 * (B226AC042 ↔ B226AC043은 제목이 글자 하나까지 같다) — 그때 그 판매처는 반증된
 * 후보 하나 때문에 통째로 버려진다.
 *
 * 판정이 하나도 붙어 있지 않으면 입력 순서를 **그대로** 돌려준다. 기존 경로의
 * 대표 후보는 한 건도 달라지지 않는다.
 */
const CROSS_SELLER_PREFERENCE: Record<string, number> = { SAME: 0, PRESUMED_SAME: 1, CONFLICT: 3 };

export function orderByCrossSellerVerdict(candidates: ComparisonCandidate[]): ComparisonCandidate[] {
  if (!candidates.some((c) => c.crossSellerVerdict)) return candidates;
  // 판정이 없는 후보(2)는 동일상품/추정보다 뒤, 반증(3)보다 앞. Array.sort는
  // 안정 정렬이라 같은 등급 안에서는 confidence 내림차순이 그대로 유지된다.
  const rank = (c: ComparisonCandidate) =>
    c.crossSellerVerdict ? (CROSS_SELLER_PREFERENCE[c.crossSellerVerdict] ?? 2) : 2;
  return [...candidates].sort((a, b) => rank(a) - rank(b));
}

export interface CandidateSelection {
  candidate: ComparisonCandidate;
  modelCodeEvidence: ModelEvidenceResult;
  /**
   * MATCHING-FIX-01 Phase C(CEO 지시, 2026-09-16) — 이 후보에서 **실제로 읽어낸**
   * 국내측 브랜드 품번. 지금까지 이 값은 compareModelCode 에 들어갔다가 그 자리에서
   * 버려졌고, 그래서 링크 행의 matched_model_name 이 늘 null 이었다
   * ("판정에 쓴 근거가 저장되지 않는다"의 실제 모습).
   *
   * 🔴 판정에는 쓰이지 않는다 — modelCodeEvidence 가 이미 그 일을 끝냈다. 이 칸은
   *    같은 값을 **밖으로 내보내기만** 한다. 추출을 지원하지 않는 도메인이면 null.
   */
  domesticModelCode: string | null;
  /** N-4.18-Q3 UI 후속(대표님 지시, 2026-08-27: "왜 이 후보가 선택됐는지 보여줘야
   * 한다") — 대표 후보보다 앞선 순위에서 modelCode conflict로 건너뛴 후보 수.
   * 0이면 원래도 top-1이 그대로 선택된 것(H-3-9 이전과 동일 결과) — UI가 이 값으로
   * "1위가 아니라 이 후보를 왜 골랐는지"를 문장으로 보여줄 수 있다. 판정 로직에는
   * 전혀 쓰이지 않는 순수 설명용 값이다. */
  skippedConflictCount: number;
}

export async function selectDomesticCandidate(
  candidates: ComparisonCandidate[],
  domain: string,
  foreignModelCode: string | null,
  fetchModelCode: (url: string) => Promise<string | null>,
): Promise<CandidateSelection> {
  // MATCHING-2.0-INTEGRATION-1 — 판정이 있으면 판정 순으로 먼저 세운다(없으면
  // 입력 그대로). 아래 두 분기가 모두 이 목록을 쓰므로, 식별자 추출을 지원하지
  // 않는 도메인에서도 반증된 후보가 대표가 되지 않는다.
  const ordered = orderByCrossSellerVerdict(candidates);
  /**
   * MI-DISCOVERY-P5.2 Step 1(CPO 지시, 2026-10-07) — 제목에서 «이미 확정된» 품번을
   * 확인하는 경로는 **도메인 등록부와 무관** 하다. HTTP 요청이 필요 없고
   * (`confirmBrandCodeInTitle` 은 순수 함수), 돌려주는 값이 해외 품번 아니면 null
   * 둘뿐이라 어떤 도메인에서도 `conflict` 를 만들 수 없다.
   *
   * 🔴 그래서 예전처럼 「추출기 없는 도메인 → 즉시 unavailable」 로 끊지 않는다.
   *    실측(2026-10-07): deuxbebe 가 `AW26MS185 - Bubble Sweatshirt - Fern Green`
   *    처럼 품번을 제목에 그대로 적는데, 추출기 등록부에 없다는 이유만으로 품번을
   *    비교조차 못 하고 있었다.
   *
   * 🔴 HTTP 를 쓰는 기존 추출기는 **제목 확인이 실패했을 때만** 부른다 — 요청 수가
   *    늘지 않고, 기존 도메인(foretforet/bobochoses)은 제목에 품번이 없으면 예전과
   *    «완전히 동일한» 경로를 탄다.
   */
  const canExtract = supportsDomesticIdentifierExtraction(domain);
  if (ordered.length === 0) {
    // 🔴 예전 코드는 후보가 없을 때 `ordered[0]`(undefined)을 그대로 돌려줬다. 그
    //    동작을 바꾸지 않는다 — 여기서 throw 하면 호출부 가드가 달라진다.
    return {
      candidate: ordered[0],
      modelCodeEvidence: compareModelCode(foreignModelCode, null),
      domesticModelCode: null,
      skippedConflictCount: 0,
    };
  }

  const evaluated: {
    candidate: ComparisonCandidate;
    modelCodeEvidence: ModelEvidenceResult;
    domesticModelCode: string | null;
  }[] = [];
  for (const candidate of ordered.slice(0, MAX_EVIDENCE_CANDIDATES)) {
    let domesticModelCode = confirmBrandCodeInTitle(foreignModelCode, candidate.title);
    if (domesticModelCode === null && canExtract) {
      // N-4.18-Q3 PART H-3-11 STEP 7(대표님 지시, 2026-08-27: "실제로 네트워크
      // 요청이 생략됐는지 확인한다") — isEvidenceEvaluationWorthwhile 가드가
      // 실제로 이 fetch 자체를 막는지 Vercel 로그로 관측할 수 있게 하는 관측용
      // 로그 한 줄. 판정 로직에는 전혀 관여하지 않는다.
      console.log(`[H-3-11] domestic modelCode fetch (${domain}): ${candidate.url}`);
      domesticModelCode = await fetchModelCode(candidate.url);
    }
    // MATCHING-FIX-01 Phase C — 판정에 쓴 그 값을 그대로 함께 들고 나간다(재계산 없음).
    evaluated.push({
      candidate,
      modelCodeEvidence: compareModelCode(foreignModelCode, domesticModelCode),
      domesticModelCode,
    });
  }
  // MATCHING-2.0-INTEGRATION-1 — 반증의 종류가 둘이 됐다. 품번이 어긋나는 것과
  // 대상·색상·상품군이 어긋나는 것은 같은 강도의 반증이고(match-truth.ts가 둘 다
  // CONFLICT로 끝낸다), 대표 후보에서 빼는 규칙도 같아야 한다.
  const winnerIndex = evaluated.findIndex(
    (e) => e.modelCodeEvidence !== "conflict" && e.candidate.crossSellerVerdict !== "CONFLICT",
  );
  if (winnerIndex === -1) return { ...evaluated[0], skippedConflictCount: 0 };
  return { ...evaluated[winnerIndex], skippedConflictCount: winnerIndex };
}

/**
 * P0-A.30.2 §C(CEO 지시, 2026-09-20) — **실제 Gemini 호출 상한.**
 *
 * 🔴 서버리스에서는 요청마다 프로세스가 새로 뜨므로 이 카운터는 «한 번의 가격
 *    조사 안에서만» 유효하다. 전역 상한을 만들려면 DB 카운터가 필요한데, 그건
 *    관측을 위해 또 다른 쓰기 경로를 만드는 일이다. 대신 더 강한 보호를 택했다:
 *    VISION_GATE_MODE 를 켜지 않으면 이 경로 자체가 돌지 않는다. 켜는 순간에도
 *    한 상품이 한 번에 부를 수 있는 최대는 이 숫자다.
 */
const VISION_TEST_CAP = Number(process.env.VISION_TEST_CAP ?? 30);

/**
 * E1 후보 «하나» 를 관측해서 vision_observations 에 남긴다.
 *
 * 🔴 링크를 만들지 않는다. 가격 경로에 닿는 것이 한 줄도 없다. 실패해도 삼킨다 —
 *    관측이 실패했다고 가격 조사가 멈추면 그건 관측이 아니라 의존이다.
 */
async function observeE1Candidate(args: {
  snapshotId: string;
  sourceId: string;
  shopDomain: string;
  candidate: { url: string; imageUrl: string | null; crossSellerVerdict?: string };
  originImageUrl: string;
  callCount: { n: number };
}): Promise<void> {
  if (args.callCount.n >= VISION_TEST_CAP) {
    console.warn("VISION_TEST_CAP_REACHED");
    return;
  }
  const candidateImageUrl = args.candidate.imageUrl;
  if (!candidateImageUrl) return;
  try {
    const seen = await hasVisionObservation({
      snapshotId: args.snapshotId,
      candidateUrl: args.candidate.url,
      model: VISION_MODEL_NAME,
      promptVersion: VISION_PROMPT_VERSION,
      mediaResolution: VISION_MEDIA_RESOLUTION,
      originImageUrl: args.originImageUrl,
      candidateImageUrl,
    });
    if (seen) return;
    args.callCount.n += 1;
    const observation = await observeVision(args.originImageUrl, candidateImageUrl);
    await recordVisionObservation({
      snapshotId: args.snapshotId,
      sourceId: args.sourceId,
      shopDomain: args.shopDomain,
      candidateUrl: args.candidate.url,
      originImageUrl: args.originImageUrl,
      candidateImageUrl,
      crossSellerVerdict: args.candidate.crossSellerVerdict ?? null,
      gate: "E1_TEST",
      observation,
    });
  } catch (e) {
    console.warn("[vision-observation] 관측 실패(가격 경로에는 영향 없음):", e instanceof Error ? e.message : e);
  }
}

/**
 * ══ 배치 조사 대상 선정 (BATCH-ACCESS-FILTER-01, CPO 승인 2026-09-30) ══════
 *
 * 🔴 여기 있던 인라인 필터에 `isCollectableAccess` 가 «빠져» 있었다. 그래서
 * 라이브 검색(domestic-price-sources/search/route.ts:187)은 막힌 사이트를 걸러
 * 내는데 **배치는 매일 계속 두드렸다** — comparison-shop.ts:50 이
 * 「막힌 사이트를 반복 호출하지 않는다(CEO 명시) — 조사 대상을 고르는 모든
 * 자리가 이 함수 하나를 쓴다」고 적어 둔 약속을 이 자리가 지키지 않았다.
 *
 * 🔴 조건을 «새로 쓰지 않는다». 공통 함수를 그대로 부른다 — 그 함수의 계약이
 * 곧 정책이고, 여기서 다시 판단하면 두 곳이 갈라진다.
 *
 * 🔴 `null`(= 확인 안 함)은 «통과» 다. 053 실측 분포가 「국내: null 16 · OK 1 ·
 * LOGIN_REQUIRED 1」이므로, null 을 막으면 국내 조사가 통째로 멈춘다.
 * `MarketSourceAccessStatus` 에 "UNKNOWN" 이라는 값은 «없고» null 이 그 자리다.
 *
 * 🔴 다른 축(enabled · status · category_scope)은 한 글자도 바꾸지 않았다.
 *
 * 이름 있는 함수로 꺼낸 이유: 테스트가 조건을 «베껴 쓰지» 않고 이것을 직접 재게
 * 하기 위해서다(replica 를 만들면 원본이 바뀔 때 테스트가 조용히 거짓이 된다).
 */
export function isBatchSurveyTarget(
  source: Pick<DomesticPriceSource, "enabled" | "status" | "accessStatus" | "categoryScope">,
  categoryScopes: string[] | null,
): boolean {
  return (
    source.enabled &&
    source.status === "ACTIVE" &&
    isCollectableAccess(source.accessStatus) &&
    sourceFitsScopes(source.categoryScope, categoryScopes)
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02c ②(CPO 지시, 2026-10-11) — **저장경로의 최종 판정을 DB 없이 부를 수
 * 있게 한다.** 아래 `runDomesticPriceCheck` 의 판정 구간을 그대로 옮겼다 —
 * 로직은 한 줄도 바뀌지 않았고, 그 함수가 이제 이것을 부른다(사본이 아니다).
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 필요한가.** MI-P0-02b 까지 측정한 것은 실시간 라우트의 `matchTruth`
 *    까지였다. 그런데 Master 가격 사다리인 이 경로에는 **그 뒤에 판정이 더 있다**:
 *
 *      ① 자기참조 제외       isSelfReferenceCandidate            ← 이미 있었다
 *      ② Gate 1              isEvidenceEvaluationWorthwhile      false → 링크 없음
 *      ③ 대표 1건 선정       selectDomesticCandidate
 *      ④ matchType + rescue 둘  toDomesticMatchType              NOT_MATCHED → 링크 없음
 *      ⑤ verified            decideCandidateEvidence → applyEvidenceDecision
 *      ⑥ matchTruth          evidenceDecision.truth
 *      ⑦ 🔴🔴 최종 owner     priceTierFromLink
 *             EXACT · COMPARISON · REFERENCE · EXCLUDED  ← 국내 가격 근거는 이 칸이 정한다
 *
 * 🔴 **실시간 라우트에는 ②④가 «없다».** 라우트는 후보 «전부» 에 matchTruth 를
 *    붙이고, 이 경로는 게이트 둘을 통과한 **샵당 대표 1건** 만 링크로 만든다.
 *    그래서 두 경로의 KPI 분모가 구조적으로 다르다 — 모르고 한쪽 숫자를 다른 쪽에
 *    쓰면 그게 그대로 거짓 보고가 된다.
 *
 * 🔴 **하니스가 이 합성을 재구현하지 않는다.** `runDomesticPriceCheck` 는 DB·
 *    Vision·upsert 를 쓰므로 로컬에서 부를 수 없고, 그래서 1차 측정은 이 구간을
 *    통째로 건너뛰었다. 손으로 다시 쓰면 expected 와 actual 을 같은 손으로 만드는
 *    circular test 가 된다(MI-P0-02 금지 ⑥).
 *
 * 🔴 DB·Vision·upsert 는 옮기지 «않았다» — 판정이 아니고 이 함수 뒤에 온다
 *    (Vision 주석이 「어떤 판정 칸에도 들어가지 않는다」고 못 박아 뒀다).
 * 🔴 게이트 로그(MI-REAL-12 Track B)는 호출부가 그대로 남긴다 — 로그 문장을
 *    바꾸지 않기 위해 필요한 값만 `observed` 로 돌려준다.
 */
/** 🔴 유니온 반환에 타입을 «명시» 한다 — 추론에 맡겼다가 판별자가 죽은 전례가 있다. */
export type DomesticJudgement =
  | { kind: "NO_CANDIDATES"; selfReferenceExcluded: number }
  | {
      kind: "DROPPED";
      /** 🔴 어느 게이트에서 떨어졌는가. 「후보가 없다」와 섞지 않는다. */
      gate: "EVIDENCE_NOT_WORTHWHILE" | "NOT_MATCHED";
      selfReferenceExcluded: number;
      candidateCount: number;
      observed: {
        candidate: ComparisonCandidate;
        modelCodeEvidence: ModelEvidenceResult | null;
        initialMatchType: DomesticMatchType | null;
        orderedRank: number | null;
      };
    }
  | {
      kind: "JUDGED";
      selfReferenceExcluded: number;
      candidateCount: number;
      best: ComparisonCandidate;
      modelCodeEvidence: ModelEvidenceResult;
      domesticModelCode: string | null;
      skippedConflictCount: number;
      matchType: DomesticMatchType;
      verified: boolean;
      matchTruth: MatchTruth;
      matchReasons: string[];
      evidenceDecision: CandidateEvidenceDecision;
      /** 🔴🔴 **최종 owner 의 값.** */
      priceTier: DomesticPriceTier;
    };

export interface JudgeDomesticInput {
  domain: string;
  candidates: ComparisonCandidate[];
  /** 원상품 URL — 자기참조 판정의 기준. */
  sourceUrl: string | undefined;
  foreignModelCode: string | null;
  /** `input.dna.color`. 🔴 색상을 «읽지 못한» 사실이 판정에 들어간다. */
  foreignColor: string | null;
  /** 🔴 주입받는다 — 호출부가 fetch 횟수를 센다. */
  fetchModelCode: (url: string) => Promise<string | null>;
}

export async function judgeDomesticCandidate(input: JudgeDomesticInput): Promise<DomesticJudgement> {
  const candidates = input.candidates.filter((c) => !isSelfReferenceCandidate(input.sourceUrl, c.url));
  const selfReferenceExcluded = input.candidates.length - candidates.length;
  if (candidates.length === 0) return { kind: "NO_CANDIDATES", selfReferenceExcluded };

  const worthwhile = isEvidenceEvaluationWorthwhile(candidates, input.foreignModelCode, input.domain);
  const top = candidates[0]!;
  if (!worthwhile) {
    return {
      kind: "DROPPED",
      gate: "EVIDENCE_NOT_WORTHWHILE",
      selfReferenceExcluded,
      candidateCount: candidates.length,
      observed: { candidate: top, modelCodeEvidence: null, initialMatchType: null, orderedRank: null },
    };
  }

  const { candidate: best, modelCodeEvidence, domesticModelCode, skippedConflictCount } =
    await selectDomesticCandidate(candidates, input.domain, input.foreignModelCode, input.fetchModelCode);

  const { matchType: initialMatchType } = toDomesticMatchType(best.matchLevel ?? "low");
  let matchType = initialMatchType;
  // P-7-C STEP 2 P1/P2 — modelCode 가 exact/partial 이면 텍스트 점수가 낮다는
  // 이유만으로 후보를 버리지 않는다. matchConfidence 는 승격하지 않는다.
  if (matchType === "NOT_MATCHED" && (modelCodeEvidence === "exact" || modelCodeEvidence === "partial")) {
    matchType = "REVIEW_REQUIRED";
  }
  // MATCHING-2.0-INTEGRATION-1 — 같은 이유, 같은 모양(교차판매처 근거).
  if (
    matchType === "NOT_MATCHED" &&
    (best.crossSellerVerdict === "SAME" || best.crossSellerVerdict === "PRESUMED_SAME")
  ) {
    matchType = "REVIEW_REQUIRED";
  }
  if (matchType === "NOT_MATCHED") {
    return {
      kind: "DROPPED",
      gate: "NOT_MATCHED",
      selfReferenceExcluded,
      candidateCount: candidates.length,
      observed: { candidate: best, modelCodeEvidence, initialMatchType, orderedRank: skippedConflictCount },
    };
  }

  const evidenceDecision = decideCandidateEvidence({
    match: { confidence: best.confidence, level: best.matchLevel ?? "low", reasons: best.matchReasons ?? [] },
    modelCode: modelCodeEvidence,
    options: "unavailable",
    image: "unavailable",
    crossSeller: best.crossSellerVerdict,
    crossSellerBlockers: best.crossSellerBlockers,
    crossSellerConflicts: best.crossSellerConflicts,
    colorUnverified: isColorUnverified(input.foreignColor, best.facts?.colorText),
  });

  const { verified, matchReasons: evidenceMatchReasons } = applyEvidenceDecision(
    [...(best.matchReasons ?? []), ...(best.crossSellerReasons ?? [])],
    evidenceDecision,
  );
  const selectionReasons =
    skippedConflictCount > 0
      ? [...evidenceMatchReasons, `텍스트 유사도 상위 ${skippedConflictCount}건은 modelCode 충돌로 제외하고 이 후보를 선택함`]
      : evidenceMatchReasons;
  const matchReasons = [
    ...selectionReasons,
    ...buildMatchProvenanceReasons({
      truth: evidenceDecision.truth,
      modelCode: modelCodeEvidence,
      crossSeller: best.crossSellerVerdict,
      matchLevel: best.matchLevel ?? "low",
      foreignModelCode: input.foreignModelCode,
      domesticModelCode,
    }),
  ];

  return {
    kind: "JUDGED",
    selfReferenceExcluded,
    candidateCount: candidates.length,
    best,
    modelCodeEvidence,
    domesticModelCode,
    skippedConflictCount,
    matchType,
    verified,
    matchTruth: evidenceDecision.truth,
    matchReasons,
    evidenceDecision,
    // 🔴 최종 owner. 새로 계산하지 않고 그 함수를 부른다.
    priceTier: priceTierFromLink({ matchTruth: evidenceDecision.truth, verified }),
  };
}

export async function runDomesticPriceCheck(input: DomesticPriceCheckInput): Promise<DomesticPriceCheckResult> {
  const sourceErrors: string[] = [];
  let linksCreatedOrUpdated = 0;
  // N-4.18-Q3 PART H-3-11 STEP 7 — 아래 fetchDomesticModelCode 호출을 감싸는
  // 카운터 하나만 잰다(판정 로직에는 관여하지 않음). P-28(2026-09-03)에서
  // foretforet.com 하드코딩을 걷어내고 도메인 무관 카운터로 일반화했다.
  let domesticModelCodeFetchCount = 0;

  const alreadyChecked = input.skipIfCheckedToday
    ? await hasObservationToday(input.snapshotId, "DOMESTIC_SHOP")
    : false;
  if (alreadyChecked)
    return { linksCreatedOrUpdated: 0, pricesRecorded: 0, sourceErrors: [], domesticModelCodeFetchCount: 0 };

  /* P0-A.30.2 — 기본값은 «꺼짐». 환경변수를 켜지 않으면 이 배선은 한 줄도
     실행되지 않고, 따라서 Production 일반 사용자 경로는 그대로다(CEO §12). */
  const visionGateMode = process.env.VISION_GATE_MODE ?? null;
  const visionCallCount = { n: 0 };
  const snapshotThumbnailUrl = input.dna.imageUrls[0] ?? null;

  const searchTitle = stripLeadingDevTag(input.dna.title);
  const sku = input.dna.identifier?.tier === "SKU" ? input.dna.identifier.value : undefined;
  /**
   * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **다른 판매자의 검색창에
   * 이 판매자의 재고번호를 넣지 않는다.**
   *
   * searchTerms(후보 질의 사다리)를 채운 뒤에도 이 줄은 여전히
   * buildDomesticShopQuery(dna)였다. tier가 SKU인 상품에서 그 값은 판매처 자신의
   * 재고번호(Smallable AAA1804922)이고, searchTerms가 어떤 이유로든 비면
   * (searchOneDomesticShop의 하위호환 분기) 그 번호가 그대로 Bobo 공식몰로
   * 나간다 — 언제나 0건인 말이 폴백 자리에 장전돼 있는 상태였다.
   *
   * 폴백도 "이 상품을 가리키는 말"이어야 한다. 사다리의 첫 칸이 곧 가장 좁은
   * 그 말이므로 같은 값을 쓴다(두 곳이 다른 정책을 갖지 않는다).
   */
  const searchTerms = buildCrossSellerSearchQueries(input.dna).map(stripLeadingDevTag).filter(Boolean);
  const searchTerm = searchTerms[0] ?? searchTitle;

  // STEP 1 — 활성 소스 대상으로 검색해서 동일상품 후보를 찾고, 신뢰도에 따라
  // domestic_product_links를 만들거나 갱신한다(NOT_MATCHED는 링크를 만들지 않는다).
  //
  // N-4.18-J STEP J-4/J-13(대표님 지시, 2026-08-25: "P0 우선 검색 → 95% 후보
  // 발견 → P1 검색 중단 가능", "검색 요청량/비용이 불필요하게 증가하지 않게") —
  // P0 소스를 먼저 검색하고, very_high(95%+) 매칭이 하나라도 나오면 P1/P2
  // 소스는 검색하지 않는다(사이트별 실제 HTTP 요청 자체를 절약). P0에서 확실한
  // 동일상품을 못 찾았을 때만 나머지 소스까지 검색한다 — recall(후보를 최대한
  // 놓치지 않는다) 원칙은 그대로 유지하면서, 이미 충분한 경우에만 비용을 아낀다.
  //
  // GLOBAL-MARKET ③-2 — s.enabled는 listDomesticPriceSources(workspaceId)가 이미
  // "카탈로그 ON && 이 판매자 ON"으로 합친 실효값이다. 판단 기준은 그대로고,
  // 대상 목록만 판매자별로 좁혀진다(P0 우선 검색/조기 중단 로직은 안 건드림).
  //
  // TTAEJYO 2.0(CEO 지시, 2026-09-12) — 여기에 카테고리 적합도를 한 겹 더 얹는다.
  // domestic_price_sources.category_scope는 029부터 있었고 값도 채워져 있었는데
  // 이 루프가 한 번도 읽지 않았다 — 그래서 어떤 상품이든 아동복 편집샵 전부를
  // 매일 크롤링했고, 맞지 않는 샵의 0건이 화면에서는 "국내 비교상품 없음"으로
  // 읽혔다. 범위를 못 정하면(undefined) 필터는 걸리지 않는다(= 오늘 동작 그대로).
  const registrySources = await listDomesticPriceSources(input.workspaceId);
  /**
   * 🔴 MI-020 §4 — 시장 **충돌 감지** 에 쓰는 도메인 집합이다. 🔴 `allSources`(아래)가
   *    아니라 **필터 «전»** 목록을 쓴다 — scope/활성 필터를 거치면 「등록부에 있는데
   *    외화가 왔다」는 충돌을 그 상품 scope 밖에서는 못 보게 된다.
   * 🔴 이 집합은 **KR 근거가 아니다**(candidate-market.ts 주석).
   */
  const registeredDomains = new Set(registrySources.map((s) => s.domain.trim().toLowerCase()));
  const allSources = registrySources.filter((s) => isBatchSurveyTarget(s, input.categoryScopes ?? null));
  const p0Sources = allSources.filter((s) => s.priority === "P0");
  const otherSources = allSources.filter((s) => s.priority !== "P0");
  /**
   * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — 저장 경로가 쓰던 질의를
   * 라이브 검색 라우트와 **같은 질의**로 맞춘다.
   *
   * ── 무엇이 실제로 빠져 있었나 ────────────────────────────────────────────
   * MATCHING-2.0-CORE는 검색어를 여럿으로 넓히고(buildCrossSellerSearchQueries)
   * 등록상품의 사실 묶음을 질의에 실었다(productFactsFromIdentityDna). 그런데
   * 그 두 줄이 들어간 곳은 /api/domestic-price-sources/search 한 곳뿐이다.
   * DB에 링크와 관측을 남기는 유일한 경로인 이 함수는 예전 모양 그대로였다:
   *
   *   searchTerm  = buildDomesticShopQuery(dna)   ← 단 하나
   *   facts       = 없음                          ← 교차판매처 판정이 돌 수 없음
   *
   * Smallable 상품의 DNA는 identifier.tier="SKU"(AAA1804922)라 그 하나뿐인
   * 검색어가 판매처 자신의 재고번호가 된다. 그 번호로 Bobo 공식몰을 검색하면
   * 언제나 0건이고, 0건이면 링크도 관측도 생기지 않는다 — 프로덕션 MI에서
   * Bobo가 "국내에 없는 상품"으로 보이던 1차 원인이 정확히 이 한 줄이었다.
   *
   * 새 검색 정책도 새 판정도 만들지 않는다. 이미 있는 두 함수를 같은 인자로
   * 부르기만 한다 — 그래야 화면이 🟢이라고 말한 그 판정이 그대로 저장된다.
   */
  const query = {
    title: searchTitle,
    brand: input.dna.brand.value || undefined,
    sourceUrl: input.dna.sourceUrl,
    sku,
    searchTerm,
    searchTerms,
    facts: productFactsFromIdentityDna(input.dna),
  };
  const toRef = (s: (typeof allSources)[number]) => ({
    id: s.id,
    name: s.name,
    domain: s.domain,
    currency: s.currency,
    collectionStrategy: s.collectionStrategy,
  });

  const p0Results = await searchDomesticShops(query, p0Sources.map(toRef));
  const foundVeryHighInP0 = p0Results.some((r) => r.candidates.some((c) => c.matchLevel === "very_high"));
  const otherResults =
    otherSources.length > 0 && !foundVeryHighInP0 ? await searchDomesticShops(query, otherSources.map(toRef)) : [];
  const searchResults = [...p0Results, ...otherResults];

  /* ─────────── 🔴 MI-GEMINI-INTEGRATION-005 ① — Gemini 후보 합류 ───────────
   * flag 기본 OFF. OFF 면 아래가 **한 줄도 돌지 않는다** → 기존 동작 100% 유지.
   *
   * 🔴 **scope 를 우회하지 않는다**(§3) — `preferredDomains` 에 넣는 도메인은
   *    바로 위 `allSources`(= `isBatchSurveyTarget(s, input.categoryScopes)` 를
   *    통과한 샵들)에서 뽑는다. 즉 테니스 상품은 테니스 scope 샵 도메인을,
   *    아동복 상품은 아동복 scope 샵 도메인을 선호 축으로 받는다.
   *
   * 🔴 **저장하지 않는다**(§5/§19) — 가상 샵 id 를 쓰고, 아래 루프가 그 id 를
   *    보고 `recordDomesticSourceCheckAttempt` 와 `upsertDomesticProductLink` 를
   *    **건너뛴다**. DB 에 Gemini 후보가 들어가지 않는다.
   *
   * 🔴 상한은 **여기서** 준다(§9 — 모듈에 박지 않았다). 근거는 실측이다:
   *    MI-GEMINI-INTEG-002 에서 상품당 Gemini 가 준 raw URL 이 0~21개였고,
   *    상한 3 으로 처리했을 때 SAME 1 · PRESUMED_SAME 3 이 나왔다. 그 값을 쓴다.
   *    🔴 「상품당 Gemini N회 고정」이 아니다 — `targetUsable` 이 차면 조기 종료한다.
   */
  /* ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 MI-GEMINI-COST-MINIMUM-ARCHITECTURE-016 — **Gemini 는 최후의 보조층이다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 확정된 개발 원칙(CPO 2026-10-13):
   * ```
   * 기존 MI / 국내 검색 → 결정적으로 찾을 수 있는 후보 우선
   *   → **그래도 못 찾은 경우만** Gemini → 1회 · Primary 1개 · 후보 최대 3
   * ```
   * 🔴 즉 Gemini 를 **기본 검색엔진으로 쓰지 않는다.**
   *
   * 🟢 **새 threshold 를 만들지 않았다.** 아래 ①은 바로 위 `foundVeryHighInP0`
   *    가 쓰는 **그 조건 그대로** 다(`matchLevel === "very_high"`) — 이 리포가 이미
   *    「충분히 찾았으면 더 안 뒤진다」로 쓰고 있는 선례다.
   * 🟢 ②도 기존 멱등 장치(`hasObservationToday`)를 **읽기만** 한다 — 새 저장 0.
   */
  let geminiSkipReason: "DETERMINISTIC_HIT" | "ALREADY_CHECKED_TODAY" | null = null;
  let geminiMetrics: GeminiPoolMetrics | null = null;
  /** 🔴 flag OFF 면 끝까지 `null` 로 나간다 — 「후보 0」과 「경로가 안 돌았다」를 가른다. */
  const geminiEvidence: GeminiTransientEvidence[] = [];
  /** 🔴 010R §6 — 국내 검색 HTTP 와 **구분해서** 센다. */
  let geminiPriceEnrichCalls = 0;
  if (isGeminiDiscoveryEnabled()) {
    /* ① 🟢 **결정적 후보가 이미 있으면 부르지 않는다.**
     *    바로 위 `foundVeryHighInP0` 와 **같은 조건** 이다 — 새 threshold 가 아니다.
     *    🔴 국내 경로가 very_high 를 냈다면 Gemini 를 부를 이유가 없다. */
    const deterministicHit = searchResults.some((r) =>
      r.status === "ok" ? r.candidates.some((c) => c.matchLevel === "very_high") : false,
    );
    /* ② 🟢 **같은 상품을 같은 날 다시 부르지 않는다.**
     *    🔴 전체 경로가 아니라 **Gemini 블록만** 막는다 — `skipIfCheckedToday` 를
     *       켜면 국내 재확인 자체가 막히고 그것은 **기존 제품 동작 변경** 이다
     *       (「지금 확인」 route 는 그 플래그를 쓰지 않는다). 여기서는 읽기만 한다.
     *    🔴 그래서 셀러가 「가격 다시 확인」을 여러 번 눌러도 Gemini 비용은 하루 1회다. */
    const checkedToday = deterministicHit ? false : await hasObservationToday(input.snapshotId, "DOMESTIC_SHOP");

    if (deterministicHit) geminiSkipReason = "DETERMINISTIC_HIT";
    else if (checkedToday) geminiSkipReason = "ALREADY_CHECKED_TODAY";

    /* 🔴 MI-018 §5 — **발화를 세려면 찍혀야 한다.** 비용 최적화의 효과를 나중에
     * 세기 위한 최소 로그 한 줄이다(기존 `[H-3-11]` 규약과 같은 형태).
     * 🟢 flag 분기 «안» 이라 OFF 면 한 줄도 찍히지 않는다 — 기존 동작 불변.
     * 🔴 스키마·DB·UI 를 건드리지 않는다. 🔴 `null` 은 「부를 예정」이다. */
    console.log(
      `[MI-016-gate] snapshot=${input.snapshotId} skip=${geminiSkipReason ?? "NONE"} ` +
        `veryHigh=${deterministicHit} checkedToday=${checkedToday}`,
    );
  }

  if (isGeminiDiscoveryEnabled() && geminiSkipReason === null) {
    const existingUrls = new Set<string>();
    for (const r of searchResults) {
      for (const c of r.candidates) existingUrls.add(normalizeCandidateUrl(c.url));
    }
    const pool = await collectGeminiCandidatePool({
      dna: input.dna,
      scopedDomains: allSources.map((s) => s.domain),
      categoryScopes: input.categoryScopes ?? null,
      maxCandidates: 3,
      targetUsable: 3,
      /**
       * 🔴🔴 WU-023 §2 — **상한을 파라미터가 직접 지키게 한다.**
       *    전에는 `2` 였고, 실제로 1 call 이 된 이유는 `buildPrimaryQuery` 가
       *    **1개짜리 배열** 을 만들어 `.slice(0, max(1, maxQueries))` 에 걸리는
       *    것뿐이었다(gemini-candidate-pool.ts:248-255). 즉 **배열 길이가** 상한을
       *    지키고 파라미터는 지키지 않았다 — Primary 가 2개를 내면 조용히 2 call 이 된다.
       * 🟢 `1` 로 못박아 **어느 쪽이 바뀌어도 상품당 1 call** 이 되게 한다.
       */
      maxQueries: 1,
      existingNormalizedUrls: existingUrls,
    });
    geminiMetrics = pool.metrics;
    /**
     * 🔴🔴 WU-023 §1/§11 — **계측값을 로그로 내보낸다.**
     *
     * 왜 필요한가: `geminiMetrics` 는 POST `/check` 응답으로 **브라우저까지만** 간다
     * (:1329). Production 화면은 로그인 뒤이고 CTO 는 브라우저를 몰 수 없어서,
     * 그대로 두면 §11 의 「추정하지 않고 **실제 계측값만** 보고한다」를 **충족할 수 없다.**
     * 🟢 기존 `[MI-016-gate]` 와 같은 규약의 한 줄이고 flag 분기 «안» 이라 OFF 면 안 찍힌다.
     * 🔴 계산을 하지 않는다 — pool 이 낸 값을 **그대로** 옮긴다(비용 추정 금지).
     * 🔴 `groundingQueryTexts` 는 길어서 **개수만** 여기 찍고 본문은 응답에 남긴다.
     */
    console.log(
      `[MI-023-metrics] ${JSON.stringify({
        snapshot: input.snapshotId,
        model: geminiMetrics.model,
        geminiCalls: geminiMetrics.geminiCalls,
        queriesUsed: geminiMetrics.queriesUsed,
        groundingQueries: geminiMetrics.groundingQueries,
        groundingQueryTextCount: geminiMetrics.groundingQueryTexts.length,
        inputTokens: geminiMetrics.inputTokens,
        outputTokens: geminiMetrics.outputTokens,
        thoughtsTokens: geminiMetrics.thoughtsTokens,
        totalTokens: geminiMetrics.totalTokens,
        primaryQueryLevel: geminiMetrics.primaryQueryLevel,
        primaryQueryTokenCount: geminiMetrics.primaryQueryTokenCount,
        discoveredUrls: geminiMetrics.discoveredUrls,
        usableProductUrls: geminiMetrics.usableProductUrls,
        miEligibleCandidates: geminiMetrics.miEligibleCandidates,
        resolveCalls: geminiMetrics.resolveCalls,
        fetchCalls: geminiMetrics.fetchCalls,
        outcomes: geminiMetrics.outcomes,
        earlyStopped: geminiMetrics.earlyStopped,
        failureDetails: geminiMetrics.failureDetails,
      })}`,
    );
    /* 🔴🔴 **점수를 매겨서** 넣는다. 처음엔 `factsFromProductUrl` 산출을 그대로
     *    넣었는데 그것이 틀렸다 — 국내 경로는 `searchDomesticShops` «안에서»
     *    `withConfidence` 를 부른다(comparison-search/index.ts:197). 그래서 국내
     *    후보에는 `matchLevel`·`crossSellerVerdict`·`confidence` 가 이미 있다.
     *    🔴 점수 없는 후보를 그대로 넘기면 바로 아래 게이트가 틀린 값을 읽는다:
     *       `isEvidenceEvaluationWorthwhile` 가 `candidates[0].matchLevel !== "low"`
     *       를 보는데 `undefined !== "low"` 는 **참** 이라 게이트가 공짜로 열리고,
     *       `selectDomesticCandidate` 는 순서/등급을 근거로 고른다.
     *    🟢 같은 함수를 같은 query 로 부르므로 **국내 후보와 동일한 자** 를 쓴다. */
    for (const r of pool.searchResults) {
      /* 🔴 010R §8 — 자기참조를 **가격 보강 «전»** 에 뺀다. 그러지 않으면 자기
       * 자신의 상세 페이지에 HTTP 가격 요청을 낭비한다. 🟢 008A 로 닫힌
       * `/collections/` 접두사 케이스가 여기서 걸린다. */
      const notSelf = r.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
      const scored = withConfidence(query, notSelf);
      /* 🟢 010R — **기존 owner 로** 가격을 확인한다(price-source-adapter.ts:243).
       * 새 수집기를 만들지 않았다. 상한도 그 함수가 가진 것을 쓴다
       * (matchLevel very_high/high · 샵당 MAX_DETAIL_CONFIRMATIONS_PER_SHOP).
       * 🔴 실패/없음은 `priceStatus: "PRICE_UNAVAILABLE"` 로 돌아온다(fail-soft). */
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, r.domain, query);
        geminiPriceEnrichCalls += 1;
      } catch {
        /* 🔴 가격 보강 실패가 가격확인 전체를 깨뜨리지 않는다 — 점수만 있는
         * 후보로 계속 간다(그러면 priceKrw 가 null 이라 집계에서 빠진다). */
      }
      searchResults.push({ ...r, candidates: priced });
    }
  }
  // H-3-6에서 루프 안에서 매 반복 재계산하던 것을 H-3-9에서 loop 밖으로 뺐다 — result에
  // 의존하지 않는 순수 파생값이라 동작은 동일하다(성능/가독성 정리).
  //
  // MATCHING-2.0-INTEGRATION-1 — 라이브 라우트는 설명문에 코드가 없을 때 원본 URL의
  // 앞머리 조각까지 본다(P-10-F). 저장 경로만 설명문 하나만 보고 있었고, 그래서
  // Bobo 공식몰이 원본인 상품(/products/b226ac114-…)에서도 foreignModelCode가
  // null이 되어 품번 비교가 시작조차 못 했다 — 방향이 바뀌면 결과가 달라지던
  // 자리다. 새 추출기를 만들지 않는다: dna.brandModelCode가 이미 그 규칙으로
  // 채워진 값이다(resolveBrandModelCode).
  const foreignModelCode = extractForeignModelCode(input.description) ?? input.dna.brandModelCode;

  /* 🔴 MI-GEMINI-005 ⑤ — **가상 샵은 등록부에 없다.**
   * `recordDomesticSourceCheckAttempt` 는 `domestic_price_sources.id` 를 키로
   * 쓰고, `upsertDomesticProductLink` 의 `source_id` 는 그 표를 가리키는 FK 다
   * (선행 WU 실측). 즉 가상 id 를 그대로 넘기면 **쓰기가 터지거나 쓰레기 행이
   * 남는다.** 그래서 둘 다 **건너뛴다** — 「일시 Candidate Pool」의 핵심 조건이다.
   * 🟢 판정(`withConfidence` / `judgeDomesticCandidate`)은 그대로 돈다.
   */
  const recordCheckAttempt = (shopId: string, outcome: Parameters<typeof recordDomesticSourceCheckAttempt>[1]): void => {
    if (shopId === GEMINI_VIRTUAL_SHOP_ID) return;
    void recordDomesticSourceCheckAttempt(shopId, outcome);
  };

  for (const result of searchResults) {
    if (result.status === "error") {
      sourceErrors.push(`${result.shopName}: ${result.error ?? "검색 실패"}`);
      // N-4.18-M STEP M-8 — fetch/parser 예외를 같은 catch로 묶어 던지므로 더
      // 세분화된 코드(FETCH_FAILED 등)를 추측하지 않고 실제 예외 메시지만 남긴다.
      recordCheckAttempt(result.shopId, { code: "SEARCH_ERROR", message: result.error ?? "검색 실패" });
      continue;
    }
    if (result.status === "unsupported") continue; // 파서 자체가 없음 — 실제 요청을 보내지 않았으므로 "확인"으로 기록하지 않는다
    // GOLF-01.5 축 C(CEO 지시, 2026-09-16) — 자격증명이 없어 요청을 보내지 않은
    // 소스도 같은 이유로 "확인"이 아니다. 🔴 NO_RESULT 로 기록하면
    // last_error_code 가 "찾지 못함"이 되어, 키만 넣으면 풀릴 일이 "그 사이트에
    // 그 상품이 없다"로 DB 에 굳는다.
    if (result.status === "not_configured") continue;
    if (result.candidates.length === 0) {
      recordCheckAttempt(result.shopId, "NO_RESULT");
      continue;
    }

    recordCheckAttempt(result.shopId, "OK");

    /**
     * P0-A.30.2 ㉠(CEO 결정, 2026-09-20) — **E1 관측. 링크를 만들지 않는다.**
     *
     * 🔴 아래 가드보다 «먼저» 선다. 그게 이 배선의 목적이다 — 가드는 「가격에
     *    쓸 만한 후보인가」를 묻고, 여기는 「눈으로 볼 가치가 있는가」를 묻는다.
     *    E1 후보(교차판매처 SIMILAR 이상)는 대부분 가드에서 떨어지기 때문에,
     *    가드 뒤에 두면 Vision 은 영영 애매한 구간을 못 본다(P0-A.30 실측:
     *    가드를 통과한 3쌍이 «전부 포레포레» 였다).
     *
     * 🔴 이 블록은 가격 경로에 «아무것도» 하지 않는다. 링크를 만들지 않고,
     *    matchType 도 priceTier 도 건드리지 않으며, 예외가 나도 삼켜서
     *    가격 조사를 멈추지 않는다. 기본값은 «꺼짐» 이다.
     */
    if (visionGateMode === "E1_TEST" && snapshotThumbnailUrl) {
      const e1 = pickE1Candidate(result.candidates);
      if (e1?.imageUrl) {
        await observeE1Candidate({
          snapshotId: input.snapshotId,
          sourceId: result.shopId,
          shopDomain: result.domain,
          candidate: e1,
          originImageUrl: snapshotThumbnailUrl,
          callCount: visionCallCount,
        });
      }
    }

    /**
     * MI-REAL-05(CEO 지시, 2026-09-20) — **원본과 «같은 listing» 인 후보를 뺀다.**
     *
     * 실측(MI-REAL-04 #5): 원본이 `foretforet.com/shop/shopdetail.html?branduid=10278273`
     * 이고 후보도 «같은 branduid» 였다. 본문 해시까지 같았고(차이는 검색 추적
     * 파라미터뿐), 그래서 「국내 경쟁가격 ₩70,000」이 자기 자신의 가격이 됐다.
     *
     * 🔴 여기가 자리인 이유: 점수(scoreCandidateMatch)도 선택 규칙
     *    (selectDomesticCandidate)도 건드리지 않고, **선택에 들어가는 목록에서만**
     *    뺀다. 남은 후보의 순서·confidence·판정은 전과 완전히 같다.
     *
     * 🔴 `recordDomesticSourceCheckAttempt(OK)` «뒤» 에 둔다. 그 사이트는 실제로
     *    응답했다 — 자기참조를 거절한 것을 「그 사이트에 그 상품이 없다」(NO_RESULT)로
     *    DB 에 굳히면 안 된다(위 GOLF-01.5 주석과 같은 이유).
     */
    /**
     * 🔴 MI-P0-02c ② — 판정 «전체» 를 `judgeDomesticCandidate` 하나로 부른다.
     *    그 함수는 바로 위에 있고, 여기 있던 구간을 그대로 옮긴 것이다 —
     *    사본이 아니라 유일한 자리다. 로직은 한 줄도 바뀌지 않았다.
     *
     * 🔴 게이트 로그(MI-REAL-12 Track B)는 «여기» 남는다 — 로그 문장과 칸 이름을
     *    바꾸지 않기 위해 판정 함수가 `observed` 로 필요한 값만 돌려준다.
     */
    const judgement = await judgeDomesticCandidate({
      domain: result.domain,
      candidates: result.candidates,
      sourceUrl: query.sourceUrl,
      foreignModelCode,
      foreignColor: input.dna.color,
      fetchModelCode: (url) => {
        domesticModelCodeFetchCount += 1;
        return fetchDomesticModelCode(result.domain, url);
      },
    });
    if (judgement.selfReferenceExcluded > 0) {
      console.log(
        `[MI-REAL-05] self-reference excluded (${result.domain}): ${judgement.selfReferenceExcluded}건 · origin=${query.sourceUrl}`,
      );
    }
    if (judgement.kind === "NO_CANDIDATES") continue;
    if (judgement.kind === "DROPPED") {
      const o = judgement.observed;
      console.log(
        `[MI-REAL-12] ${JSON.stringify({
          gate: judgement.gate,
          sourceDomain: result.domain,
          candidateUrl: o.candidate.url,
          candidateSku: o.candidate.sku ?? null,
          candidateMatchLevel: o.candidate.matchLevel ?? null,
          crossSellerVerdict: o.candidate.crossSellerVerdict ?? null,
          worthwhile: judgement.gate === "NOT_MATCHED",
          ...(judgement.gate === "NOT_MATCHED"
            ? { orderedRank: o.orderedRank, modelCodeEvidence: o.modelCodeEvidence, matchType: o.initialMatchType }
            : { foreignModelCode, candidateCount: judgement.candidateCount }),
          dropGate: judgement.gate,
        })}`,
      );
      continue;
    }
    const {
      best,
      domesticModelCode,
      matchType,
      verified: finalVerified,
      matchReasons: finalMatchReasons,
      matchTruth: finalMatchTruth,
    } = judgement;

    /* 🔴🔴 MI-GEMINI-005 ⑤ — **여기서 멈춘다.** Gemini 후보는 판정까지만 쓰고
     * `domestic_product_links` 에 **남기지 않는다**(§5 「영구 DB 저장 금지」·
     * §19 「외부 URL 장기 보관 금지」). 🔴 그래서 flag ON 이어도 Gemini 후보는
     * `linksCreatedOrUpdated` 를 **올리지 않는다** — 보고에서 그 수를 Gemini
     * 성과로 읽지 않기 위해 이 자리를 명시한다.
     *
     * 🔴🔴 **Vision «앞» 이다.** 처음엔 upsert 바로 앞에 뒀는데 그 사이에 Vision
     *    블록이 있었다 — `findCachedVisionEvidence(snapshotId, result.shopId, ...)`
     *    가 **가상 shopId 로 DB 를 뒤지고**, 캐시가 없으면 `runVisionEvidence` 가
     *    **실제 외부 모델을 호출** 한다. 저장도 안 할 후보에 그 비용을 쓰고
     *    (host 가 달라도 shopId 가 같으니) 캐시 키까지 오염시킨다.
     * 🟢 판정은 이 줄 «위» 에서 이미 끝났다 — Vision 은 upsert 입력일 뿐이고
     *    matchType·verified·matchTruth·priceTier 에 들어가지 않는다(아래 주석). */
    if (result.shopId === GEMINI_VIRTUAL_SHOP_ID) {
      /* 🟢 **버리기 전에 근거만 들고 나온다.** 저장은 여전히 하지 않는다 —
       * 아래 continue 가 upsert 와 관측 기록을 전부 건너뛴다. */
      geminiEvidence.push({
        source: "GEMINI_DISCOVERY",
        domain: result.domain,
        discoveredUrl: best.url,
        matchTruth: finalMatchTruth,
        verified: finalVerified,
        /** 🔴 복제 계산하지 않는다 — 운영 owner 를 그대로 부른다. */
        priceTier: priceTierFromLink({ matchTruth: finalMatchTruth, verified: finalVerified }),
        matchType,
        crossSellerVerdict: best.crossSellerVerdict ?? null,
        confidence: best.confidence ?? null,
        matchReasons: finalMatchReasons,
        crossSellerBlockers: (best.crossSellerBlockers ?? []).map((b) => String(b)),
        crossSellerConflicts: (best.crossSellerConflicts ?? []).map((c) => String(c)),
        priceAmount: best.price?.amount ?? null,
        priceCurrency: best.price?.currency ?? null,
        /** 🔴 KRW 만 국내 가격 증거가 된다 — 환산하지 않는다(위 타입 주석). */
        priceKrw:
          best.priceStatus === "VERIFIED_CURRENT" && best.price?.currency === "KRW"
            ? best.price.amount
            : null,
        priceStatus: best.priceStatus ?? null,
        /**
         * 🔴🔴 MI-020 §4 — 시장을 **같이 닫는다.** 이것 없이 해외 가격을 MI 로 올리면
         *    그 자리에서 또 시장을 추측하게 된다(WU-019R 이 그 공백을 찾았다).
         * 🔴 등록부 소속은 KR 근거가 **아니라 충돌 감지용** 이다 — `bobochoses.com`
         *    (등록부 「Bobo Choses Korea(공식)」)의 가격 증거가 **EUR** 였던 실측 때문이다.
         */
        ...classifyCandidateMarket({
          domain: result.domain,
          currency: best.price?.currency ?? null,
          isRegisteredDomesticShop: registeredDomains.has(result.domain.trim().toLowerCase()),
        }),
      });
      continue;
    }

    /**
     * P0-A.29-B(CEO 승인 ㉮, 2026-09-19) — Vision 을 «관측 데이터 수집기» 로만 부른다.
     *
     * 🔴 이 값은 아래 upsert 의 어떤 판정 칸에도 들어가지 않는다. matchType ·
     *    matchConfidence · verified · matchTruth 는 이 줄보다 «먼저» 확정돼 있고,
     *    priceTierFromLink 는 여전히 matchTruth·verified 만 읽는다. 가격은 한 칸도
     *    움직이지 않는다 — 그게 이번 단계의 조건이었다.
     *
     * 호출 조건(CEO §3):
     *   · 구조적으로 즉시 제외되지 않은 후보 — 여기까지 왔다는 것이 곧 그 뜻이다
     *     (matchType === "NOT_MATCHED" 는 위에서 continue 했고, MODEL_CODE ·
     *      COMPOSITION · AUDIENCE · CATEGORY 충돌은 crossSellerVerdict 가
     *      "CONFLICT" 로 말해 준다)
     *   · 양쪽 이미지가 실제로 있을 것
     *   🔴 BRAND_MISMATCH 는 진입 가능이다 — 그것이 P0-A.29-A 의 목적이었다.
     *
     * 비용(CEO §9): 같은 쌍을 「가격 다시 확인」마다 다시 부르지 않는다.
     * findCachedVisionEvidence 가 (스냅샷, 소스) 로 기존 행을 찾고 프롬프트 판 ·
     * 모델 · 이미지 URL 이 «전부» 같을 때만 재사용한다.
     */
    let visionEvidence: VisionEvidence | undefined;
    const foreignImageUrl = input.dna.imageUrls[0] ?? null;
    const domesticImageUrl = best.imageUrl ?? null;
    if (best.crossSellerVerdict !== "CONFLICT" && foreignImageUrl && domesticImageUrl) {
      const refs = [foreignImageUrl, domesticImageUrl];
      const cached = await findCachedVisionEvidence(input.snapshotId, result.shopId, refs);
      // 🔴 실패하면 undefined 그대로 둔다. 「같다」로도 「다르다」로도 읽지 않는다.
      visionEvidence = cached ?? (await runVisionEvidence(foreignImageUrl, domesticImageUrl)) ?? undefined;
    }

    const upsertResult = await upsertDomesticProductLink({
      snapshotId: input.snapshotId,
      sourceId: result.shopId,
      vision: visionEvidence,
      externalUrl: best.url,
      matchedBrand: best.brand ?? null,
      matchedTitle: best.title,
      /**
       * P0-A.8 MATCHING MEASUREMENT ONLY(CEO 승인, 2026-09-18) — 🔴 판정을 바꾸지
       * 않는다. 바로 위 :496 과 :529 가 **이미 쓰고 있는 그 값**을 저장 칸에도
       * 옮길 뿐이다(새로 계산하지 않는다 — 두 번 계산하면 두 값이 갈라진다).
       *
       * 왜: A/B/C 후보안이 전부 이 값을 입력으로 쓰는데 70행 중 복원되는 행이
       * 0건이었다. 그리고 오늘 국내 비교가격을 공급하는 EXACT 14개가 **전부**
       * 품번 한 축으로 서 있다(품번 근거 아닌 EXACT = 0건). 그 14개가 실제로
       * SAME 이었는지 PRESUMED_SAME 이었는지 모르는 채로는 어느 안도 못 고른다.
       *
       * 🔴 undefined 면 그대로 넘긴다 — 저장 계층이 칸 자체를 빼고, "UNKNOWN"으로
       *    메우지 않는다. 없는 판정을 지어내지 않는 것이 이 작업의 전부다.
       */
      crossSellerVerdict: best.crossSellerVerdict,
      /**
       * MATCHING-FIX-01 Phase C — 여기 세 칸은 지금까지 null 하드코딩이었다
       * (전수 70링크에서 0/70). 판정을 바꾸지 않고 «판정에 쓴 값»을 그대로 적는다.
       *
       * 🔴 추측해서 채우지 않는다. 각 칸의 출처는 하나씩 정해져 있고, 그 출처가
       *    비어 있으면 그대로 null 이다:
       *      matchedModelName    **판정(compareModelCode)에 실제로 들어간 국내측
       *                          코드 그 값**. 도메인 추출기가 상세에서 읽어낸
       *                          값이 있으면 그것이고(없는 도메인은 null),
       *                          없으면 후보 사실 묶음의 브랜드 품번이다.
       *                          🔴 판매처 자신의 재고번호(facts.sellerSku)는
       *                          «넣지 않는다» — 판정이 본 적 없는 값을 근거 칸에
       *                          적으면 이 칸이 다시 추측이 된다. 두 값을 같은
       *                          칸에 섞지 않는다는 원칙(product-facts.ts:578-584)
       *                          이 여기에도 그대로 적용된다.
       *      matchedColor        후보 원문이 말한 색상(facts.colorText). 색을
       *                          제목에서 «추론»하지 않는다.
       *      externalProductId   그 판매처 안에서 이 상품을 가리키는 식별자
       *                          (URL slug). 우리가 만든 값이 아니라 판매처가
       *                          붙인 값이다.
       */
      matchedModelName: domesticModelCode ?? best.facts?.brandModelCode ?? null,
      matchedColor: best.facts?.colorText ?? null,
      externalProductId: best.facts?.urlSlug ?? null,
      matchType,
      matchConfidence: best.confidence,
      matchReasons: finalMatchReasons,
      verified: finalVerified,
      // P-10 STEP 4(대표님/CPO 지시, 2026-08-30) — decideCandidateEvidence()가
      // 이미 계산한 값을 그대로 저장한다(재계산 없음).
      matchTruth: finalMatchTruth,
    });
    if (upsertResult.ok) linksCreatedOrUpdated += 1;
    else sourceErrors.push(`${result.shopName}: 링크 저장 실패 — ${upsertResult.error}`);
  }

  // STEP 2 — P-19-B Sprint 7(CPO 지시, 2026-09-02) — "🟢 동일상품 확인"뿐 아니라
  // "🟡 비교상품"(식별자 없이 브랜드+텍스트만 강하게 유사)도 국내 유사 시장가격
  // 참고용으로 가격을 재조회한다(이전에는 verified===true인 EXACT 링크만
  // 대상이었다). CONFLICT/INSUFFICIENT_EVIDENCE(priceTierFromLink === "EXCLUDED")는
  // 여전히 가격 데이터 어디에도 쓰지 않는다 — market-intelligence.ts가
  // sourceRefId→priceTierFromLink(link) 매핑으로 EXACT/COMPARISON 두 버킷을
  // 분리 집계한다(summarizeDomesticMarketSplit).
  const links = (await listDomesticProductLinks(input.snapshotId)).filter(
    (l) => l.status === "ACTIVE" && priceTierFromLink(l) !== "EXCLUDED",
  );
  const sourceById = new Map(allSources.map((s) => [s.id, s]));
  const observations: Parameters<typeof recordPriceObservations>[0] = [];

  for (const link of links) {
    const source = sourceById.get(link.sourceId);
    if (!source) continue;
    const priceResult = await refreshDomesticProductPrice(source.domain, link.externalUrl);
    // N-4.18-Q3 PART E-1(대표님 지시, 2026-08-27: "price=null + soldOut=true도
    // price_observations에 기록") — 이전엔 priceResult.price가 있을 때만
    // 관측치를 저장해서, RULII가 "완전 품절이라 가격조차 없음"(price=null,
    // soldOut=true, status="UNAVAILABLE")을 정확히 판정해도 그 정보 자체가
    // DB에 통째로 버려지는 실제 버그가 있었다(운영상 "동일상품은 존재하지만
    // 지금은 품절"이라는 중요한 정보). status가 OK든 UNAVAILABLE이든, 가격이
    // 있거나 soldOut===true로 확인됐으면 저장한다 — 둘 다 없으면(예: ERROR,
    // 또는 UNAVAILABLE인데 soldOut도 null) 저장할 실체가 없으므로 스킵한다.
    const hasPrice = priceResult.status === "OK" && Boolean(priceResult.price);
    const hasConfirmedSoldOut = priceResult.soldOut === true;
    if (hasPrice || hasConfirmedSoldOut) {
      // domestic_price_sources.currency는 항상 KRW — 가격을 못 찾았어도
      // 통화 자체는 안다(국내 소스이므로).
      const observedCurrency = priceResult.price?.currency ?? source.currency;
      /**
       * P0-B FINAL FIX(CEO 지시, 2026-09-20) — **환율을 모르면 원화를 만들지 않는다.**
       *
       * 이 줄은 지금까지 `priceKrw: priceResult.price?.amount` 였다. 통화를
       * «보지 않고» 금액을 그대로 원화 칸에 넣는다는 뜻이고, 통화가 KRW가
       * 아닌 순간 그것은 환율 1을 조용히 적용한 값이 된다. SELLER_ORIGIN
       * 경로는 같은 사고를 PRICE-ACCURACY-REGRESSION-1.1(51758aa, 2026-09-11)
       * 에서 convertToKrwStrict로 이미 막았는데, 국내 경로만 남아 있었다.
       *
       * 🔴 오늘 이 가드가 바꾸는 행은 0건이다. 등록된 국내 소스 12곳이 전부
       *    currency=KRW이고, Production의 DOMESTIC_SHOP 관측 250건도 전부
       *    KRW다(2026-09-20 실측). 즉 이것은 «관측된 오류의 수정»이 아니라
       *    «같은 모양의 사고가 남아 있던 마지막 자리»를 닫는 것이다.
       *    refreshDomesticProductPrice의 bobochoses.com 분기는 Shopify
       *    /ko-kr JSON이 말하는 통화를 그대로 돌려주므로, 그 분기가 살아나는
       *    날 이 줄이 환율 1을 적는 자리가 된다.
       *
       * 여기서 환율을 «구하지» 않는 이유: 이 경로에는 exchange_rate 자체가
       * 없다(항상 null로 저장된다). 없는 환율을 이 자리에서 새로 만들면
       * 국내 관측에 두 번째 FX 소스가 생긴다 — computeKrwAmount 하나로
       * 모으기로 한 P-4-DATA-7 불변조건 3을 깨는 일이다. 그래서 여기서는
       * 「원화로 말할 수 없다」만 남긴다.
       *
       * price_amount와 currency는 그대로 보존된다(바로 아래 두 줄). 가격을
       * 버리는 것이 아니라, 원화라고 «주장»하지 않는 것이다. price_krw가
       * null인 행은 기존 규칙대로 최저가/평균에서 제외되고
       * (price-history.ts의 `priceKrw != null` 필터), 남는 것이 없으면
       * 기존 priceMarketBasis="UNRESOLVED"가 그대로 뜬다 — 새 상태를
       * 만들지 않는다.
       */
      const priceKrw =
        priceResult.price != null && observedCurrency.toUpperCase() === "KRW" ? priceResult.price.amount : null;
      observations.push({
        snapshotId: input.snapshotId,
        source: "DOMESTIC_SHOP",
        sourceLabel: source.name,
        sourceProductUrl: link.externalUrl,
        sourceRefId: source.id,
        currency: observedCurrency,
        priceAmount: priceResult.price?.amount ?? null,
        priceKrw,
        // N-4.18-G STEP G-1/G-3(대표님 지시, 2026-08-25) — 실측된 사이트(RULII)만
        // 값이 있고, 나머지는 undefined→null로 저장된다(추측 없음).
        salePriceKrw: priceResult.salePriceKrw ?? null,
        originalPriceKrw: priceResult.originalPriceKrw ?? null,
        soldOut: priceResult.soldOut ?? null,
        // DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 🔴 바로 위 세 줄과 «같은
        // 모양, 같은 규칙»이다: 배송 정책을 실측한 사이트(foretforet.com)만 값이
        // 오고, 나머지 5개 어댑터는 undefined → null로 저장된다(추측 없음).
        //
        // 🔴 P0-C STEP 2(CEO 승인, 2026-09-20) — 이 자리의 규칙이 «좁아졌다».
        //
        //    여기 있던 문장은 「shippingCostAmount는 여기서도 넘기지 않는다」였고,
        //    그 이유는 포레포레의 「3,000원」이 「70,000원 미만일 때만」이기
        //    때문이었다. 그 판단은 «(조건)» 라벨에 대해서는 지금도 그대로 옳다.
        //
        //    바뀐 것은 실측이다. 2026-09-20에 같은 판매처에서 «(고정)» 라벨과
        //    「주문금액에 상관없이 배송비가 3,500원」이라는 문장을 확인했다.
        //    그건 조건이 없는 배송비이고, 그때는 금액 칸이 비어 있는 것이 오히려
        //    아는 것을 모른다고 적는 일이 된다.
        //
        //    🔴 이 줄은 여전히 «해석하지 않는다». 어댑터가 (고정)+숫자 하나를
        //    동시에 확인했을 때만 값이 오고, 그 외에는 undefined → null이다.
        //    FLAT과 금액의 동반은 ForetforetShippingPolicy 유니온이 타입으로
        //    보장하므로, 금액 없는 FLAT이 저장 계층에 도달해 배치를 통째로
        //    거절시키는 일은 여기서 생길 수 없다.
        shippingPolicyStatus: priceResult.shippingPolicyStatus ?? null,
        shippingPolicyNote: priceResult.shippingPolicyNote ?? null,
        shippingCostAmount: priceResult.shippingCostAmount ?? null,
      });
    } else if (priceResult.status === "ERROR") {
      sourceErrors.push(`${source.name} 가격 재조회 실패: ${priceResult.error ?? "알 수 없는 오류"}`);
    }
  }

  const saveResult = await recordPriceObservations(observations);
  if (!saveResult.ok) sourceErrors.push(`가격 저장 실패: ${saveResult.error}`);

  return {
    linksCreatedOrUpdated,
    pricesRecorded: saveResult.ok ? saveResult.count : 0,
    sourceErrors,
    domesticModelCodeFetchCount,
    /** 🔴 flag OFF 면 `null` — 「Gemini 0회」가 아니라 「경로가 안 돌았다」다(§7). */
    geminiMetrics,
    /** 🔴 같은 원칙 — flag OFF 면 `null`, 켰는데 후보가 없으면 `[]`. */
    geminiEvidence: geminiMetrics === null ? null : geminiEvidence,
    /** 🔴 010R §6 — Gemini 가격 보강 HTTP 호출 수(국내 검색과 분리). */
    geminiPriceEnrichCalls,
    /** 🔴 016 — 건너뛴 이유. 「0 회」와 구분한다. */
    geminiSkipReason,
    /** 🔴 016 ⑥ — Vision 호출 수. Discovery 와 **합산하지 않는다**. */
    visionCalls: visionCallCount.n,
  };
}
