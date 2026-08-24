import {
  convertToKrw,
  createNaverShoppingSearchSource,
  buildDomesticSearchQueries,
  classifyListingMatch,
  isUsableForCompetitionPrice,
} from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { getNaverSearchCredentials } from "./naver-search-env";
import { recordPriceObservations, hasObservationToday, type NewPriceObservation } from "./price-observations";

/**
 * N-4.01/N-4.03(대표님 지시) — 스냅샷 하나에 대해 "해외 원가" 1건 +
 * "국내 시장 리스팅" N건을 한 번에 관측하고 저장한다. 수동 "지금 확인" API와
 * daily cron이 이 함수 하나를 공유한다(같은 판정 로직을 두 곳에서 따로
 * 만들지 않는다는 이 프로젝트의 반복 원칙, compute-readiness.ts와 동일).
 *
 * N-4.03 Part 2/3/4 — 검색어는 title 전체가 아니라 "브랜드+모델명 →
 * 브랜드+상품명 → 모델명" 우선순위로 시도한다(buildDomesticSearchQueries).
 * 검색 결과가 나와도 다른 상품일 수 있어(classifyListingMatch) REJECT로
 * 판정된 리스팅은 저장하지 않는다 — "다른 상품의 최저가격을 우리 상품
 * 경쟁가격으로 쓰지 않는다"는 명시적 지시 때문이다. match 등급 자체는
 * 이번 스프린트엔 DB에 별도 컬럼이 없어 저장하지 않는다(스키마 변경은
 * schema cache 문제가 해결된 뒤 별도로 판단 — 필터링 목적으로만 쓴다).
 *
 * 실패에 관대하다 — 국내 검색이 NOT_CONFIGURED/ERROR여도 해외 원가만이라도
 * 저장한다(부분 실패를 조용히 전체 실패로 만들지 않는다).
 */
export interface PriceCheckInput {
  snapshotId: string;
  title: string;
  brand: string;
  modelName: string;
  /** N-4.18 P1-PRICE-SEARCH STEP4 — 있으면 classifyListingMatch의 색상
   * 불일치 감점 신호로 쓴다(없으면 그 신호를 그냥 안 쓴다, 추측 금지). */
  color?: string;
  originalPriceAmount: number;
  originalCurrency: string;
  /** N-4.03 Part 22 — true면 오늘 이미 저장된 소스(SELLER_ORIGIN/NAVER_SHOPPING)는
   * 재조회/재저장을 건너뛴다. daily cron 전용(재시도/재배포로 하루 중 두 번 돌아도
   * 중복 관측치를 쌓지 않기 위함) — 수동 "지금 확인"은 사용자가 명시적으로 새로
   * 확인을 요청한 것이므로 기본값 false로 항상 재조회한다. */
  skipIfCheckedToday?: boolean;
}

export type DomesticSearchStatus = "OK" | "NOT_CONFIGURED" | "NO_RESULTS" | "ERROR" | "SKIPPED";

/** N-4.03 Part 2 — 파이프라인 전체의 요약 상태. domesticStatus(검색 API
 * 자체의 상태)와는 다른 층위다 — "검색 API는 OK인데 우리 상품과 일치하는
 * 리스팅이 하나도 없어서 결국 NO_RESULT" 같은 경우를 구분해야 한다. */
export type PriceCheckPipelineStatus = "NOT_CONFIGURED" | "NO_RESULT" | "SUCCESS" | "PARTIAL" | "ERROR";

export interface PriceCheckResult {
  ok: boolean;
  status: PriceCheckPipelineStatus;
  savedCount: number;
  domesticStatus: DomesticSearchStatus;
  domesticListingCount: number;
  domesticQueryUsed: string | null;
  errors: string[];
}

export async function runPriceCheck(input: PriceCheckInput): Promise<PriceCheckResult> {
  const errors: string[] = [];
  const observations: NewPriceObservation[] = [];
  let originSaved = false;

  const originAlreadyChecked = input.skipIfCheckedToday
    ? await hasObservationToday(input.snapshotId, "SELLER_ORIGIN")
    : false;

  const exchangeRates = originAlreadyChecked ? null : await fetchLiveExchangeRates();

  if (originAlreadyChecked) {
    originSaved = true; // 오늘 이미 저장돼 있음 — 상태 계산상 "저장됨"으로 취급.
  } else if (input.originalPriceAmount > 0 && input.originalCurrency && exchangeRates) {
    const converted = convertToKrw(input.originalPriceAmount, input.originalCurrency, exchangeRates.rates);
    observations.push({
      snapshotId: input.snapshotId,
      source: "SELLER_ORIGIN",
      currency: input.originalCurrency,
      priceAmount: input.originalPriceAmount,
      exchangeRate: exchangeRates.rates[input.originalCurrency.toUpperCase()] ?? null,
      priceKrw: converted.amountKrw,
    });
    originSaved = true;
  }

  const domesticAlreadyChecked = input.skipIfCheckedToday
    ? await hasObservationToday(input.snapshotId, "NAVER_SHOPPING")
    : false;

  const queries = domesticAlreadyChecked
    ? []
    : buildDomesticSearchQueries({
        brand: input.brand,
        title: input.title,
        modelName: input.modelName,
      });

  let domesticStatus: DomesticSearchStatus = domesticAlreadyChecked ? "OK" : "SKIPPED";
  let domesticListingCount = 0;
  let domesticQueryUsed: string | null = null;
  const naverSource = createNaverShoppingSearchSource(getNaverSearchCredentials());

  for (const query of queries) {
    const result = await naverSource.search(query);
    domesticQueryUsed = query;
    if (result.status === "NOT_CONFIGURED") {
      domesticStatus = "NOT_CONFIGURED";
      break; // 다음 검색어로 재시도해도 credential 문제는 그대로다.
    }
    if (result.status === "ERROR") {
      domesticStatus = "ERROR";
      errors.push(result.message ?? "네이버 쇼핑 검색 실패");
      break; // API 자체 오류도 검색어를 바꾼다고 해결되지 않는다.
    }
    if (result.status === "NO_RESULTS") {
      domesticStatus = "NO_RESULTS";
      continue; // 다음 우선순위 검색어로 재시도.
    }
    // status === "OK" — 매칭 신뢰도로 다시 거른다.
    const matched = result.listings
      .map((listing) => ({ listing, match: classifyListingMatch(
        { brand: input.brand, modelName: input.modelName, title: input.title, color: input.color },
        { title: listing.title },
      ) }))
      .filter(({ match }) => isUsableForCompetitionPrice(match.level));
    if (matched.length === 0) {
      // 검색 API는 결과를 줬지만 전부 다른 상품으로 판정됨 — 이 검색어로는
      // 못 찾은 것과 같으니 다음 검색어를 시도한다.
      domesticStatus = "NO_RESULTS";
      continue;
    }
    domesticStatus = "OK";
    domesticListingCount = matched.length;
    for (const { listing } of matched) {
      observations.push({
        snapshotId: input.snapshotId,
        source: "NAVER_SHOPPING",
        sourceLabel: listing.mallName,
        sourceProductUrl: listing.productUrl,
        currency: "KRW",
        priceAmount: listing.priceKrw,
        priceKrw: listing.priceKrw,
      });
    }
    break; // 유의미한 결과를 찾았으니 더 낮은 우선순위 검색어는 시도하지 않는다.
  }
  if (queries.length === 0) domesticQueryUsed = null;

  const saveResult = await recordPriceObservations(observations);
  if (!saveResult.ok) errors.push(saveResult.error);

  let status: PriceCheckPipelineStatus;
  if (!saveResult.ok) {
    status = "ERROR";
  } else if (domesticStatus === "NOT_CONFIGURED" && !originSaved) {
    status = "NOT_CONFIGURED";
  } else if (originSaved && domesticStatus === "OK") {
    status = "SUCCESS";
  } else if (originSaved || domesticStatus === "OK") {
    status = "PARTIAL";
  } else if (domesticStatus === "NO_RESULTS") {
    status = "NO_RESULT";
  } else {
    status = errors.length > 0 ? "ERROR" : "NO_RESULT";
  }

  return {
    ok: status === "SUCCESS" || status === "PARTIAL",
    status,
    savedCount: saveResult.ok ? saveResult.count : 0,
    domesticStatus,
    domesticListingCount,
    domesticQueryUsed,
    errors,
  };
}
