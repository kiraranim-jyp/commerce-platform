import { convertToKrwStrict } from "@commerce/pricing";
import {
  probeOriginAndKrMarkets,
  probeAdditionalMarkets,
  supportsSiteMarketProbe,
  type ShopifyMarketProbeResult,
} from "@commerce/crawler";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import {
  recordPriceObservations,
  hasObservationToday,
  getObservedMarketKeysToday,
  normalizeMarketKey,
  MARKET_PROBE_SOURCE_LABEL,
  type NewPriceObservation,
} from "./price-observations";

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

/** probeOriginAndKrMarkets가 이미 확인하는 두 곳 — 확장 조회에서 다시 찌르지
 * 않는다(price-intelligence route와 같은 제외 목록). */
const BASIC_PROBE_MARKET_CODES = ["", "en-kr"];

/**
 * GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — probeAdditionalMarkets가 "실제로
 * 응답한 시장"만 돌려준 결과를 시장당 한 행씩 SELLER_ORIGIN 관측으로 바꾼다.
 * 지금까지 이 값들은 화면(price-intelligence route)에서만 보이고 DB에는 한
 * 번도 남지 않아서, 다음 날이 되면 "이 상품이 DE에서는 얼마였는지"가 사라졌다.
 *
 * 지켜야 할 것(전부 "관측한 사실만 적는다"의 변주다):
 *  - marketCode    : 실제로 요청한 코드 그대로. 통화·URL·판매처 국가에서
 *                    시장을 역추론하지 않는다(EUR→DE, KRW→KR, .kr→KR 전부 금지).
 *                    "en-int"는 끝까지 국가로 바꾸지 않는다 — 실측상 국제
 *                    배송용 시장이지 어느 나라도 아니다.
 *  - marketCountry : 그 매장이 /meta.json에 스스로 적어 둔 기준 국가만
 *                    (Bobo Choses는 모든 시장에서 country=ES다 — 즉 이 값은
 *                    "시장의 국가"가 아니라 "판매처가 선언한 국가"다).
 *  - ""/null       : "시장 미확인"이므로 추가 시장으로 저장하지 않는다. 저장하면
 *                    원본(프리픽스 없는) 관측과 구분이 불가능해진다.
 *  - 중복          : source+market_code가 같으면 저장하지 않는다. en-kr은 위
 *                    origin/KR 관측(KR_MARKET)으로 이미 들어가 있는 경우가
 *                    많다 — 같은 실행에서 두 번 쌓으면 안 된다.
 *
 * 순수 함수로 뽑아 둔 이유는 이 규칙들을 네트워크/DB 없이 그대로 테스트하기
 * 위함이다(가격 판정 로직은 여기서 아무것도 하지 않는다 — 환산은 기존
 * convertToKrwStrict 그대로다).
 */
export function buildAdditionalMarketObservations(params: {
  snapshotId: string;
  probes: ShopifyMarketProbeResult[];
  rates: Record<string, number>;
  /** 이미 저장돼 있거나 이번 실행에서 이미 담은 시장 키(normalizeMarketKey 결과). */
  alreadyRecordedMarketKeys: Set<string>;
}): { observations: NewPriceObservation[]; errors: string[] } {
  const observations: NewPriceObservation[] = [];
  const errors: string[] = [];
  const seen = new Set(params.alreadyRecordedMarketKeys);

  for (const probe of params.probes) {
    const marketKey = normalizeMarketKey(probe.marketCode);
    // ""(=null과 같은 "시장 미확인")는 추가 시장이 아니다 — 건너뛴다.
    if (marketKey === "") continue;
    // snapshot+source+market_code 단위 중복 방지(하루에 시장당 한 행).
    if (seen.has(marketKey)) continue;
    seen.add(marketKey);
    if (!(probe.amount > 0) || !probe.currency) continue;

    // PRICE-ACCURACY-REGRESSION-1.1과 같은 이유 — 환율을 모르면 KRW 시계열에
    // 넣을 값이 없다. €84를 ₩84로 저장하느니 이 시장 행을 저장하지 않는다.
    const converted = convertToKrwStrict(probe.amount, probe.currency, params.rates);
    if (!converted) {
      errors.push(`환율 정보 없음(${probe.currency}) — ${probe.marketCode} 시장 관측을 저장하지 않았습니다.`);
      continue;
    }

    // P-12A와 동일한 규칙을 그대로 적용한다(새 판정 없음): regularPrice가
    // 현재가보다 실제로 클 때만 "할인 중"이다.
    let salePriceKrw: number | null = null;
    let originalPriceKrw: number | null = null;
    if (probe.regularPrice && probe.regularPrice.amount > probe.amount) {
      salePriceKrw = converted.amountKrw;
      originalPriceKrw =
        convertToKrwStrict(probe.regularPrice.amount, probe.regularPrice.currency, params.rates)?.amountKrw ?? null;
    }

    observations.push({
      snapshotId: params.snapshotId,
      source: "SELLER_ORIGIN",
      // 원가 근거(KR_MARKET/ORIGIN_FX)와 구분되는 라벨 — 원가/마진/CASE 판정이
      // 이 행을 원가로 잘못 읽지 않도록 하는 유일한 표식이다.
      sourceLabel: MARKET_PROBE_SOURCE_LABEL,
      // probe가 실제로 가져온 URL 그대로(관측 근거).
      sourceProductUrl: probe.sourceUrl,
      marketCode: probe.marketCode,
      marketCountry: probe.shopMeta?.country ?? null,
      currency: probe.currency,
      priceAmount: probe.amount,
      exchangeRate:
        probe.currency.toUpperCase() === "KRW" ? null : (params.rates[probe.currency.toUpperCase()] ?? null),
      priceKrw: converted.amountKrw,
      salePriceKrw,
      originalPriceKrw,
      // SMALLABLE-MARKET-PROBE-1 — available이 undefined면 "재고를 확인하지
      // 못했다"이지 "판매중"이 아니다. 예전 식(`=== false`)은 그 셋 중 모르는
      // 하나를 판매중으로 바꿔 적었다. Shopify 경로에서는 결과가 바뀌지 않는다:
      // probeMarket()이 가격 없는 응답을 이미 null로 버려서, 결과가 존재하면
      // available은 언제나 boolean이다.
      soldOut: probe.available == null ? null : probe.available === false,
    });
  }

  return { observations, errors };
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
    // PRICE-ACCURACY-REGRESSION-1.1(CPO 결정, 2026-09-11) — price_history는 정의상
    // KRW 시계열이라 환율을 모르면 넣을 값이 없다. 예전엔 convertToKrw가 금액을
    // 그대로 KRW로 돌려줘서 `499 DKK`가 `₩499`로 저장됐고, 한 번 저장되면 마진·
    // CASE 판정까지 그 값을 믿게 된다. 원본가격 자체는 product_snapshots에 통화와
    // 함께 남아 있으므로 여기서 건너뛰어도 "원가를 버리는" 것이 아니다.
    const converted = convertToKrwStrict(priceAmount, currency, exchangeRates.rates);
    if (!converted) errors.push(`환율 정보 없음(${currency}) — 원화 환산 가격을 저장하지 않았습니다.`);

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
    if (chosenProbe && converted) {
      soldOut = chosenProbe.available === false;
      // regularPrice(할인 전 정가)가 있고 현재가보다 실제로 클 때만 "할인 중"이다
      // — 같거나 작으면 할인이 아니다(정가=현재가인 상품을 할인 중으로 지어내지 않는다).
      if (chosenProbe.regularPrice && chosenProbe.regularPrice.amount > chosenProbe.amount) {
        salePriceKrw = converted.amountKrw;
        originalPriceKrw =
          convertToKrwStrict(
            chosenProbe.regularPrice.amount,
            chosenProbe.regularPrice.currency,
            exchangeRates.rates,
          )?.amountKrw ?? null;
      }
    }

    if (converted) {
      observations.push({
        snapshotId: input.snapshotId,
        source: "SELLER_ORIGIN",
        // GLOBAL-SELLER/MARKET 1단계 — probe가 이미 들고 있는 값을 그대로 넘긴다.
        // 여기서 market을 새로 판별하지 않는다(URL로 국가를 추측하지도 않는다).
        // marketCode는 실제로 요청한 코드이고("" 또는 en-kr), market_country는
        // 그 매장이 /meta.json에 스스로 적어 둔 기준 국가다.
        marketCode: chosenProbe?.marketCode ?? null,
        marketCountry: chosenProbe?.shopMeta?.country ?? null,
        // GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — probe가 실제로 조회한 URL을
        // 그대로 남긴다(지금까지 SELLER_ORIGIN은 이 칸이 비어 있었다). 이유는
        // 판매처 식별이다: sellerIdentityKey는 호스트명을 우선 쓰고 없을 때만
        // sourceLabel로 폴백하는데, 아래에서 추가되는 시장 행들은 라벨이
        // MARKET_PROBE라 URL이 없으면 같은 Bobo Choses가 판매처 2곳으로 세어진다
        // (실측 기준 KR/DE/INT는 전부 bobochoses.com 한 곳이다). 판정/계산에
        // 쓰이는 값이 아니라 식별용 근거 URL이다. 비-Shopify(probe 실패)면
        // 예전처럼 null 그대로다.
        sourceProductUrl: chosenProbe?.sourceUrl ?? null,
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
      // 환율을 몰라 아무것도 저장하지 않았는데 SUCCESS로 보고하면 안 된다 —
      // 이 경우 status는 NO_RESULT가 되고 errors에 사유가 남는다.
      originSaved = true;
    }

    // GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — 여기까지는 origin("")과 en-kr
    // 두 곳만 저장했다. 실측(Bobo Choses B226AC043, 2026-09-11): 같은 상품이
    // /en-kr ₩162,000 · /en-de €75 · /en-int €84로 시장마다 다른 값을 내는데,
    // 그 사실이 화면에서만 보이고 DB에는 남지 않아 시계열로 남지 않았다.
    // marketProbe가 null이면 Shopify 상품 URL이 아니므로 확장 조회 자체를
    // 하지 않는다(불필요한 HTTP 요청 금지 — PART H 비용 원칙).
    //
    // SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — 그 게이트가 정확히
    // smallable을 막고 있었다. smallable은 Shopify가 아니라 probeOriginAndKrMarkets가
    // 언제나 null이고, 그래서 확장 조회에 **도달한 적이 없다**(관측 실패가 아니라
    // 시도 부재였다). 게이트를 없애는 대신 조건을 하나 더 둔다: 시장 관측 경로가
    // 실측으로 등록된 사이트만 통과한다. 등록되지 않은 사이트는 예전 그대로
    // HTTP 요청을 한 건도 보내지 않는다(PART H 유지).
    //
    // originAlreadyChecked(cron 재실행)일 때는 이 블록 자체에 도달하지 않는다 —
    // 기존 "오늘 이미 확인했으면 아무것도 하지 않는다" 동작을 그대로 둔다.
    if (marketProbe || supportsSiteMarketProbe(input.sourceUrl)) {
      const extraProbes = await probeAdditionalMarkets(input.sourceUrl, BASIC_PROBE_MARKET_CODES).catch(() => []);
      if (extraProbes.length > 0) {
        // 멱등성은 이제 시장까지 본다 — 같은 날 같은 snapshot+SELLER_ORIGIN에
        // 이미 저장된 market_code는 다시 쌓지 않는다(snapshot+source+
        // market_code+날짜 유일). 조회가 실패하면 빈 집합이라 기존처럼
        // 수집은 계속된다.
        const recordedKeys = await getObservedMarketKeysToday(input.snapshotId, "SELLER_ORIGIN");
        // 이번 실행에서 방금 담은 origin/KR 관측도 같은 시장이면 중복이다 —
        // en-kr은 보통 위 KR_MARKET 관측으로 이미 들어가 있다.
        for (const already of observations) recordedKeys.add(normalizeMarketKey(already.marketCode));
        const extra = buildAdditionalMarketObservations({
          snapshotId: input.snapshotId,
          probes: extraProbes,
          rates: exchangeRates.rates,
          alreadyRecordedMarketKeys: recordedKeys,
        });
        observations.push(...extra.observations);
        errors.push(...extra.errors);
      }
    }
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
