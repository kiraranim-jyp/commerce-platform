import { refreshDomesticProductPrice, searchDomesticShops } from "@commerce/crawler";
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
      matchReasons: best.matchReasons ?? [],
      verified: autoVerified,
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
    if (priceResult.status === "OK" && priceResult.price) {
      observations.push({
        snapshotId: input.snapshotId,
        source: "DOMESTIC_SHOP",
        sourceLabel: source.name,
        sourceProductUrl: link.externalUrl,
        sourceRefId: source.id,
        currency: priceResult.price.currency,
        priceAmount: priceResult.price.amount,
        priceKrw: priceResult.price.amount, // domestic_price_sources.currency는 항상 KRW
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
