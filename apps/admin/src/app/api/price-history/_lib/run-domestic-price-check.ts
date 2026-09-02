import {
  compareModelCode,
  decideCandidateEvidence,
  extractForeignModelCode,
  fetchDomesticModelCode,
  refreshDomesticProductPrice,
  searchDomesticShops,
  supportsDomesticIdentifierExtraction,
  type CandidateEvidenceDecision,
  type ComparisonCandidate,
  type ModelEvidenceResult,
} from "@commerce/crawler";
import { buildDomesticShopQuery, type ProductIdentityDna } from "@commerce/shared";
import { listDomesticPriceSources, recordDomesticSourceCheckAttempt } from "../../domestic-price-sources/_lib/domestic-price-source";
import {
  listDomesticProductLinks,
  priceTierFromLink,
  toDomesticMatchType,
  upsertDomesticProductLink,
} from "../../domestic-price-sources/_lib/domestic-product-link";
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
  skipIfCheckedToday?: boolean;
  /** N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — modelCode 증거(H-3-2)의
   * 해외측 원문 소스. ProductIdentityDna에는 없는 필드라(설계 원칙: "이미
   * 확보한 값만으로 DNA를 만든다") 이 함수 입력에만 선택적으로 추가한다 —
   * 없으면(undefined) modelCode 증거는 그냥 unavailable로 정직하게 처리되고
   * 기존 동작이 그대로 유지된다(호출부를 안 고쳐도 회귀 없음). */
  description?: string;
}

export interface DomesticPriceCheckResult {
  linksCreatedOrUpdated: number;
  pricesRecorded: number;
  sourceErrors: string[];
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
  if (candidates[0].matchLevel !== "low") return true;
  return foreignModelCode !== null && domain === "foretforet.com";
}

export interface CandidateSelection {
  candidate: ComparisonCandidate;
  modelCodeEvidence: ModelEvidenceResult;
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
  if (!supportsDomesticIdentifierExtraction(domain)) {
    return { candidate: candidates[0], modelCodeEvidence: compareModelCode(foreignModelCode, null), skippedConflictCount: 0 };
  }

  const evaluated: { candidate: ComparisonCandidate; modelCodeEvidence: ModelEvidenceResult }[] = [];
  for (const candidate of candidates.slice(0, MAX_EVIDENCE_CANDIDATES)) {
    // N-4.18-Q3 PART H-3-11 STEP 7(대표님 지시, 2026-08-27: "실제로 네트워크
    // 요청이 생략됐는지 확인한다") — isEvidenceEvaluationWorthwhile 가드가
    // 실제로 이 fetch 자체를 막는지 Vercel 로그로 관측할 수 있게 하는 관측용
    // 로그 한 줄. 판정 로직에는 전혀 관여하지 않는다.
    console.log(`[H-3-11] domestic modelCode fetch (${domain}): ${candidate.url}`);
    const domesticModelCode = await fetchModelCode(candidate.url);
    evaluated.push({ candidate, modelCodeEvidence: compareModelCode(foreignModelCode, domesticModelCode) });
  }
  const winnerIndex = evaluated.findIndex((e) => e.modelCodeEvidence !== "conflict");
  if (winnerIndex === -1) return { ...evaluated[0], skippedConflictCount: 0 };
  return { ...evaluated[winnerIndex], skippedConflictCount: winnerIndex };
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

  const searchTitle = stripLeadingDevTag(input.dna.title);
  const searchTerm = stripLeadingDevTag(buildDomesticShopQuery(input.dna));
  const sku = input.dna.identifier?.tier === "SKU" ? input.dna.identifier.value : undefined;

  // STEP 1 — 활성 소스 대상으로 검색해서 동일상품 후보를 찾고, 신뢰도에 따라
  // domestic_product_links를 만들거나 갱신한다(NOT_MATCHED는 링크를 만들지 않는다).
  //
  // N-4.18-J STEP J-4/J-13(대표님 지시, 2026-08-25: "P0 우선 검색 → 95% 후보
  // 발견 → P1 검색 중단 가능", "검색 요청량/비용이 불필요하게 증가하지 않게") —
  // P0 소스를 먼저 검색하고, very_high(95%+) 매칭이 하나라도 나오면 P1/P2
  // 소스는 검색하지 않는다(사이트별 실제 HTTP 요청 자체를 절약). P0에서 확실한
  // 동일상품을 못 찾았을 때만 나머지 소스까지 검색한다 — recall(후보를 최대한
  // 놓치지 않는다) 원칙은 그대로 유지하면서, 이미 충분한 경우에만 비용을 아낀다.
  const allSources = (await listDomesticPriceSources()).filter((s) => s.enabled && s.status === "ACTIVE");
  const p0Sources = allSources.filter((s) => s.priority === "P0");
  const otherSources = allSources.filter((s) => s.priority !== "P0");
  const query = {
    title: searchTitle,
    brand: input.dna.brand.value || undefined,
    sourceUrl: input.dna.sourceUrl,
    sku,
    searchTerm,
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
  // H-3-6에서 루프 안에서 매 반복 재계산하던 것을 H-3-9에서 loop 밖으로 뺐다 — result에
  // 의존하지 않는 순수 파생값이라 동작은 동일하다(성능/가독성 정리).
  const foreignModelCode = extractForeignModelCode(input.description);

  for (const result of searchResults) {
    if (result.status === "error") {
      sourceErrors.push(`${result.shopName}: ${result.error ?? "검색 실패"}`);
      // N-4.18-M STEP M-8 — fetch/parser 예외를 같은 catch로 묶어 던지므로 더
      // 세분화된 코드(FETCH_FAILED 등)를 추측하지 않고 실제 예외 메시지만 남긴다.
      void recordDomesticSourceCheckAttempt(result.shopId, { code: "SEARCH_ERROR", message: result.error ?? "검색 실패" });
      continue;
    }
    if (result.status === "unsupported") continue; // 파서 자체가 없음 — 실제 요청을 보내지 않았으므로 "확인"으로 기록하지 않는다
    if (result.candidates.length === 0) {
      void recordDomesticSourceCheckAttempt(result.shopId, "NO_RESULT");
      continue;
    }

    void recordDomesticSourceCheckAttempt(result.shopId, "OK");

    // N-4.18-Q3 PART H-3-11 — 어차피 NOT_MATCHED로 끝날 검색결과는 Evidence
    // HTTP 비용을 쓰지 않는다(isEvidenceEvaluationWorthwhile 주석 참고).
    if (!isEvidenceEvaluationWorthwhile(result.candidates, foreignModelCode, result.domain)) continue;

    // N-4.18-Q3 PART H-3-9(대표님 지시, 2026-08-27) — 기존엔 candidates[0](confidence
    // 1위)만 무조건 대표 후보로 썼다. H-3-7 실측(PèPè)에서 1위가 실제로는 다른
    // 상품(modelCode conflict)이고 진짜 동일상품은 3위였던 사례가 확인돼, 국내측
    // 식별자 추출을 지원하는 도메인(supportsDomesticIdentifierExtraction)에 한해
    // 상위 3개까지 modelCode를 평가하고 conflict가 아닌 후보를 대표로 고른다
    // (selectDomesticCandidate 주석 참고 — confidence 정렬/threshold는 안 건드림).
    // P-28(2026-09-03) — fetchModelCode를 result.domain에 맞는 추출기로 위임한다
    // (fetchDomesticModelCode 레지스트리, foretforet.com 하드코딩 제거).
    const { candidate: best, modelCodeEvidence, skippedConflictCount } = await selectDomesticCandidate(
      result.candidates,
      result.domain,
      foreignModelCode,
      (url) => {
        domesticModelCodeFetchCount += 1;
        return fetchDomesticModelCode(result.domain, url);
      },
    );
    const { matchType: initialMatchType } = toDomesticMatchType(best.matchLevel ?? "low");
    let matchType = initialMatchType;
    // P-7-C STEP 2 P1/P2(대표님 지시, 2026-08-29) — matchLevel=low는
    // toDomesticMatchType 기준으로 항상 NOT_MATCHED다. 하지만 modelCode가
    // exact/partial로 확인되면(=식별자 증거가 있으면) 텍스트 점수가 낮다는
    // 이유만으로 후보 자체를 버리지 않는다 — REVIEW_REQUIRED로 살려서 아래
    // decideCandidateEvidence(deriveMatchTruth 공통 기준)가 verified 여부를
    // 식별자 증거로 판단하게 한다. matchConfidence는 여전히 best.confidence
    // 그대로 저장된다(42%를 high로 승격하지 않는다 — P2) — REVIEW_REQUIRED는
    // medium-tier 후보가 쓰는 것과 동일한 정직한 라벨일 뿐이다.
    if (matchType === "NOT_MATCHED" && (modelCodeEvidence === "exact" || modelCodeEvidence === "partial")) {
      matchType = "REVIEW_REQUIRED";
    }
    if (matchType === "NOT_MATCHED") continue;

    // N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — Evidence Decision을
    // 기존 matchType/matchConfidence/threshold 계산과 완전히 분리된 안전장치로
    // 얹는다. modelCode만 실제로 연결한다(options/image는 이 흐름에 아직
    // 배선되지 않았으므로 unavailable로 정직하게 둔다 — H-3-4 실측대로
    // unavailable/weak_or_no_evidence는 아래에서 verified를 절대 바꾸지 않는다).
    const evidenceDecision = decideCandidateEvidence({
      match: { confidence: best.confidence, level: best.matchLevel ?? "low", reasons: best.matchReasons ?? [] },
      modelCode: modelCodeEvidence,
      options: "unavailable",
      image: "unavailable",
    });

    const { verified: finalVerified, matchReasons: evidenceMatchReasons } = applyEvidenceDecision(
      best.matchReasons ?? [],
      evidenceDecision,
    );
    // N-4.18-Q3 UI 후속(대표님 지시, 2026-08-27) — selectDomesticCandidate()가
    // top-1이 아닌 후보를 골랐을 때만("왜 이 후보인지") 설명을 덧붙인다.
    // skippedConflictCount===0(원래도 top-1)이면 아무것도 추가하지 않는다 —
    // H-3-9 이전과 화면이 달라 보이면 안 되는 대다수 케이스에서 회귀가 없다.
    const finalMatchReasons =
      skippedConflictCount > 0
        ? [...evidenceMatchReasons, `텍스트 유사도 상위 ${skippedConflictCount}건은 modelCode 충돌로 제외하고 이 후보를 선택함`]
        : evidenceMatchReasons;

    const upsertResult = await upsertDomesticProductLink({
      snapshotId: input.snapshotId,
      sourceId: result.shopId,
      externalUrl: best.url,
      matchedBrand: best.brand ?? null,
      matchedTitle: best.title,
      matchedColor: null,
      matchedModelName: null,
      matchType,
      matchConfidence: best.confidence,
      matchReasons: finalMatchReasons,
      verified: finalVerified,
      // P-10 STEP 4(대표님/CPO 지시, 2026-08-30) — decideCandidateEvidence()가
      // 이미 계산한 값을 그대로 저장한다(재계산 없음).
      matchTruth: evidenceDecision.truth,
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
      observations.push({
        snapshotId: input.snapshotId,
        source: "DOMESTIC_SHOP",
        sourceLabel: source.name,
        sourceProductUrl: link.externalUrl,
        sourceRefId: source.id,
        // domestic_price_sources.currency는 항상 KRW — 가격을 못 찾았어도
        // 통화 자체는 안다(국내 소스이므로).
        currency: priceResult.price?.currency ?? source.currency,
        priceAmount: priceResult.price?.amount ?? null,
        priceKrw: priceResult.price?.amount ?? null,
        // N-4.18-G STEP G-1/G-3(대표님 지시, 2026-08-25) — 실측된 사이트(RULII)만
        // 값이 있고, 나머지는 undefined→null로 저장된다(추측 없음).
        salePriceKrw: priceResult.salePriceKrw ?? null,
        originalPriceKrw: priceResult.originalPriceKrw ?? null,
        soldOut: priceResult.soldOut ?? null,
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
  };
}
