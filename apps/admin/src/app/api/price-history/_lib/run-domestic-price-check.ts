import { refreshDomesticProductPrice, searchDomesticShops } from "@commerce/crawler";
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
 * runPriceCheck(해외 원가+네이버)와 나란히 존재하며 daily cron/수동 "지금 확인"이
 * 둘 다 호출한다.
 *
 * 절대 금지(migration 029 주석, 작업지시서 Part 2) — 검색으로 후보를 찾았다고
 * 바로 가격에 반영하지 않는다. STEP 1(매칭)에서 만든 링크가 verified=true인
 * 것만 STEP 2(가격 관측)에서 실제로 조회한다.
 */
export interface DomesticPriceCheckInput {
  snapshotId: string;
  title: string;
  brand?: string;
  sourceUrl?: string;
  sku?: string;
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

  const searchTitle = stripLeadingDevTag(input.title);

  // STEP 1 — 활성 소스 대상으로 검색해서 동일상품 후보를 찾고, 신뢰도에 따라
  // domestic_product_links를 만들거나 갱신한다(NOT_MATCHED는 링크를 만들지 않는다).
  const sources = (await listDomesticPriceSources()).filter((s) => s.enabled && s.status === "ACTIVE");
  const searchResults = await searchDomesticShops(
    { title: searchTitle, brand: input.brand, sourceUrl: input.sourceUrl, sku: input.sku },
    sources.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
  );

  for (const result of searchResults) {
    if (result.status === "error") {
      sourceErrors.push(`${result.shopName}: ${result.error ?? "검색 실패"}`);
      void recordDomesticSourceCheckAttempt(result.shopId, false);
      continue;
    }
    if (result.status === "unsupported" || result.candidates.length === 0) continue;

    void recordDomesticSourceCheckAttempt(result.shopId, true);
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
  const sourceById = new Map(sources.map((s) => [s.id, s]));
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
