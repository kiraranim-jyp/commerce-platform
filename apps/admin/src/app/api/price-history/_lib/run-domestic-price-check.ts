import {
  compareModelCode,
  decideCandidateEvidence,
  extractForeignModelCode,
  fetchForetforetModelCode,
  refreshDomesticProductPrice,
  searchDomesticShops,
  type CandidateEvidenceDecision,
} from "@commerce/crawler";
import { buildDomesticShopQuery, type ProductIdentityDna } from "@commerce/shared";
import { listDomesticPriceSources, recordDomesticSourceCheckAttempt } from "../../domestic-price-sources/_lib/domestic-price-source";
import {
  listDomesticProductLinks,
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
 * decision==="unchanged"일 때는 baseAutoVerified/baseReasons를 그대로
 * 돌려준다 — 이 순수 함수를 독립적으로 테스트할 수 있어 회귀(특히 "unchanged가
 * 절대 기존 결과를 안 바꾼다")를 실제 코드로 고정할 수 있다. */
export function applyEvidenceDecision(
  baseAutoVerified: boolean,
  baseReasons: string[],
  decision: CandidateEvidenceDecision,
): { verified: boolean; matchReasons: string[] } {
  if (decision.decision === "auto_confirm") {
    return { verified: true, matchReasons: [...baseReasons, ...decision.reasons] };
  }
  if (decision.decision === "review_required") {
    return { verified: false, matchReasons: [...baseReasons, ...decision.reasons] };
  }
  return { verified: baseAutoVerified, matchReasons: baseReasons };
}

export async function runDomesticPriceCheck(input: DomesticPriceCheckInput): Promise<DomesticPriceCheckResult> {
  const sourceErrors: string[] = [];
  let linksCreatedOrUpdated = 0;

  const alreadyChecked = input.skipIfCheckedToday
    ? await hasObservationToday(input.snapshotId, "DOMESTIC_SHOP")
    : false;
  if (alreadyChecked) return { linksCreatedOrUpdated: 0, pricesRecorded: 0, sourceErrors: [] };

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
    const best = result.candidates[0]; // withConfidence가 이미 confidence 내림차순 정렬
    const { matchType, autoVerified } = toDomesticMatchType(best.matchLevel ?? "low");
    if (matchType === "NOT_MATCHED") continue;

    // N-4.18-Q3 PART H-3-6(대표님 지시, 2026-08-27) — Evidence Decision을
    // 기존 matchType/matchConfidence/threshold 계산과 완전히 분리된 안전장치로
    // 얹는다. modelCode만 실제로 연결한다(options/image는 이 흐름에 아직
    // 배선되지 않았으므로 unavailable로 정직하게 둔다 — H-3-4 실측대로
    // unavailable/weak_or_no_evidence는 아래에서 verified를 절대 바꾸지 않는다).
    // 현재 실제 modelCode 추출이 확인된 사이트는 FORETFORET뿐이다(H-3-2) —
    // 다른 도메인은 domesticModelCode가 항상 null이라 compareModelCode가
    // "unavailable"을 반환하고, decideCandidateEvidence는 그 경우 항상
    // "unchanged"이므로 기존 동작과 완전히 동일하다.
    const foreignModelCode = extractForeignModelCode(input.description);
    const domesticModelCode =
      result.domain === "foretforet.com" ? await fetchForetforetModelCode(best.url) : null;
    const modelCodeEvidence = compareModelCode(foreignModelCode, domesticModelCode);
    const evidenceDecision = decideCandidateEvidence({
      match: { confidence: best.confidence, level: best.matchLevel ?? "low", reasons: best.matchReasons ?? [] },
      modelCode: modelCodeEvidence,
      options: "unavailable",
      image: "unavailable",
    });

    const { verified: finalVerified, matchReasons: finalMatchReasons } = applyEvidenceDecision(
      autoVerified,
      best.matchReasons ?? [],
      evidenceDecision,
    );

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
    });
    if (upsertResult.ok) linksCreatedOrUpdated += 1;
    else sourceErrors.push(`${result.shopName}: 링크 저장 실패 — ${upsertResult.error}`);
  }

  // STEP 2 — verified && ACTIVE 링크만 실제 가격을 다시 조회해서 저장한다.
  const links = (await listDomesticProductLinks(input.snapshotId)).filter(
    (l) => l.verified && l.status === "ACTIVE",
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
  };
}
