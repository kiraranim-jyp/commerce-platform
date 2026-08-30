import { convertToKrw } from "@commerce/pricing";
import { probeOriginAndKrMarkets } from "@commerce/crawler";
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
  /** N-4.18-Q3 P0-2(대표님 지시, 2026-08-26: "한국 IP 실제 구매가격을 우선
   * 원가로 써야 한다") — Shopify 상품이면 이 URL로 실제 한국 로케일(en-kr)
   * 표시가를 확인해 origin×환율 환산가보다 우선한다. */
  sourceUrl: string;
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
    // N-4.18-Q3 P0-2(대표님 지시: "£200×환율보다 실제 한국 표시가가 더 정확한
    // 원가") — 실측 확인(2026-08-26, PèPè 사례): £200×환율=₩377,400인데 실제
    // 한국 로케일(en-kr) 표시가는 ₩234,800이었다(차이 ₩142,600). Shopify
    // 상품이고 en-kr 시장이 KRW로 직접 표시되면 그 값을 원가로 쓴다 — 통화
    // 변환 오차/마진 없이 실제 한국에서 결제되는 금액에 더 가깝다. 실패하면
    // (Shopify가 아니거나 en-kr 시장이 없으면) 기존 원문 통화×환율 그대로 폴백.
    const marketProbe = await probeOriginAndKrMarkets(input.sourceUrl).catch(() => null);
    const krPrice = marketProbe?.kr;
    const useKrMarket = krPrice != null && krPrice.currency === "KRW" && krPrice.amount > 0;

    const priceAmount = useKrMarket ? krPrice.amount : input.originalPriceAmount;
    const currency = useKrMarket ? "KRW" : input.originalCurrency;
    const exchangeRates = await fetchLiveExchangeRates();
    const converted = convertToKrw(priceAmount, currency, exchangeRates.rates);

    // P-12A(대표님/CPO 지시, 2026-08-31) — "실제 구매 가능한 가격"을 Market
    // Intelligence까지 흘려보내려면 할인 여부/정가/품절 여부를 이 시점에
    // 같이 저장해야 한다. useKrMarket으로 이미 고른 kr/origin probe 결과
    // 하나에서만 파생한다(새 fetch 없음, marketProbe는 위에서 이미 받아온 것).
    // price_krw의 기존 의미(실제 판매가)는 그대로 두고, sale_price_krw는
    // "할인 중"이라는 상태 정보로만 쓴다(CPO 확정: price_krw==sale_price_krw여도
    // 무방, 의미가 다르다).
    const chosenProbe = useKrMarket ? krPrice : (marketProbe?.origin ?? null);
    let salePriceKrw: number | null = null;
    let originalPriceKrw: number | null = null;
    let soldOut: boolean | null = null;
    if (chosenProbe) {
      soldOut = chosenProbe.available === false;
      // regularPrice(할인 전 정가)가 있고 현재가보다 실제로 클 때만 "할인 중"이다
      // — 같거나 작으면 할인이 아니다(정가=현재가인 상품을 할인 중으로 지어내지 않는다).
      if (chosenProbe.regularPrice && chosenProbe.regularPrice.amount > chosenProbe.amount) {
        salePriceKrw = converted.amountKrw;
        originalPriceKrw = convertToKrw(
          chosenProbe.regularPrice.amount,
          chosenProbe.regularPrice.currency,
          exchangeRates.rates,
        ).amountKrw;
      }
    }

    observations.push({
      snapshotId: input.snapshotId,
      source: "SELLER_ORIGIN",
      currency,
      priceAmount,
      exchangeRate: useKrMarket ? null : (exchangeRates.rates[currency.toUpperCase()] ?? null),
      priceKrw: converted.amountKrw,
      // N-4.18-Q3 — sourceLabel은 SELLER_ORIGIN에서 지금까지 안 쓰이던
      // 필드라(DOMESTIC_SHOP만 상점명으로 사용) 마이그레이션 없이 원가
      // 근거(KR_MARKET/ORIGIN_FX)를 그대로 재사용한다.
      sourceLabel: useKrMarket ? "KR_MARKET" : "ORIGIN_FX",
      salePriceKrw,
      originalPriceKrw,
      soldOut,
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
