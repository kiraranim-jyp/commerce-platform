import { convertToKrw } from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { recordPriceObservations, hasObservationToday, type NewPriceObservation } from "./price-observations";

/**
 * N-4.01/N-4.03(대표님 지시) — 스냅샷 하나에 대해 "해외 원가" 관측을 저장한다.
 * 수동 "지금 확인" API와 daily cron이 이 함수 하나를 공유한다(같은 판정
 * 로직을 두 곳에서 따로 만들지 않는다는 이 프로젝트의 반복 원칙,
 * compute-readiness.ts와 동일).
 *
 * N-4.18-C(대표님 지시, 2026-08-25) — "국내 최저가 검색"이 아니라 "수입 키즈
 * 전문 편집샵과 비교하는 Product Market Intelligence"로 서비스 방향이
 * 재정의되면서, 이 함수가 하던 네이버 쇼핑 검색 기반 국내가격 매칭
 * (createNaverShoppingSearchSource/buildDomesticSearchQueries/
 * classifyListingMatch, N-4.01 Part G ~ N-4.18 P1-PRICE-SEARCH)을 전부
 * 제거했다 — NAVER_SEARCH_CLIENT_ID/SECRET은 실제로 한 번도 설정된 적이
 * 없었고(라이브 호출 미검증 상태로 남아있었다), 국내가격비교는 이제
 * runDomesticPriceCheck(국내 편집샵 domestic_price_sources 기반, 완전히
 * 별도 파이프라인)만 담당한다. SMARTSTORE_CLIENT_ID/SECRET(등록/연동용,
 * getNaverCredentials)과는 처음부터 다른 자격증명이라 이번 정리로 영향받지
 * 않는다.
 */
export interface PriceCheckInput {
  snapshotId: string;
  originalPriceAmount: number;
  originalCurrency: string;
  /** N-4.03 Part 22 — true면 오늘 이미 저장된 SELLER_ORIGIN 관측은 재조회/재저장을
   * 건너뛴다. daily cron 전용(재시도/재배포로 하루 중 두 번 돌아도 중복 관측치를
   * 쌓지 않기 위함) — 수동 "지금 확인"은 사용자가 명시적으로 새로 확인을 요청한
   * 것이므로 기본값 false로 항상 재조회한다. */
  skipIfCheckedToday?: boolean;
}

export type PriceCheckPipelineStatus = "SUCCESS" | "NO_RESULT" | "ERROR";

export interface PriceCheckResult {
  ok: boolean;
  status: PriceCheckPipelineStatus;
  savedCount: number;
  errors: string[];
}

export async function runPriceCheck(input: PriceCheckInput): Promise<PriceCheckResult> {
  const errors: string[] = [];
  const observations: NewPriceObservation[] = [];
  let originSaved = false;

  const originAlreadyChecked = input.skipIfCheckedToday
    ? await hasObservationToday(input.snapshotId, "SELLER_ORIGIN")
    : false;

  if (originAlreadyChecked) {
    originSaved = true; // 오늘 이미 저장돼 있음 — 상태 계산상 "저장됨"으로 취급.
  } else if (input.originalPriceAmount > 0 && input.originalCurrency) {
    const exchangeRates = await fetchLiveExchangeRates();
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

  const saveResult = await recordPriceObservations(observations);
  if (!saveResult.ok) errors.push(saveResult.error);

  let status: PriceCheckPipelineStatus;
  if (!saveResult.ok) {
    status = "ERROR";
  } else if (originSaved) {
    status = "SUCCESS";
  } else {
    status = "NO_RESULT";
  }

  return {
    ok: status === "SUCCESS",
    status,
    savedCount: saveResult.ok ? saveResult.count : 0,
    errors,
  };
}
