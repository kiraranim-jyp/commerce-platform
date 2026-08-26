import { backfillCanonicalProduct } from "@commerce/shared";
import {
  computePriceDecision,
  computePriceChange,
  computePriceTrend,
  computePriceRecommendation,
  computePriceAlertSignal,
  summarizeDomesticMarket,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  computePriceBreakdown,
  computeSellerAction,
  priceLevelFromVerdict,
  computeSellability,
} from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { getPriceHistory } from "./price-observations";

/**
 * N-4.18-K STEP K-2(대표님 지시, 2026-08-26: "새로운 가격판정 엔진을 만들지
 * 않는다") — 기존 /api/price-history/[snapshotId] GET이 계산하던 로직을
 * 그대로 함수로 뽑아낸다. computeMarketAlert()(price_alerts 갱신)와 GET
 * 응답 둘 다 이 함수를 공유해야, "화면에 보이는 값"과 "알림을 만드는 기준값"이
 * 서로 다른 계산을 하는 사고가 나지 않는다.
 */
export async function computeMarketIntelligence(snapshotId: string) {
  const snapshot = await getSnapshot(snapshotId);
  if (!snapshot) return null;
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);

  const [originHistory, domesticHistory, domesticShopHistory] = await Promise.all([
    getPriceHistory(snapshotId, "SELLER_ORIGIN"),
    getPriceHistory(snapshotId, "NAVER_SHOPPING"),
    getPriceHistory(snapshotId, "DOMESTIC_SHOP"),
  ]);

  const domesticSummary = summarizeDomesticMarket([...domesticShopHistory, ...domesticHistory]);
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
        })
      : null;

  const alertSignal = originChange
    ? computePriceAlertSignal({
        priceChangeRatePercent: originChange.changeRatePercent,
        marginChangePercentPoints: null,
      })
    : null;

  let cost: ReturnType<typeof computePriceBreakdown> | null = null;
  let recommendation: ReturnType<typeof computePriceRecommendation> | null = null;
  const originalAmount = product.price.value.amount;
  const originalCurrency = product.price.value.currency;
  if (product.priceValidity === "VALID" && originalAmount > 0 && originalCurrency) {
    const exchangeRates = await fetchLiveExchangeRates();
    const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
    cost = computePriceBreakdown({ originalAmount, originalCurrency, ...breakdownInput }, exchangeRates.rates);
    if (currentSellingPriceKrw != null) {
      recommendation = computePriceRecommendation({
        totalCostKrw: cost.landedCostKrw,
        currentSellingPriceKrw,
        domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
        domesticAveragePriceKrw: domesticSummary.averagePriceKrw,
        minimumMarginPercent: 10,
        targetMarginPercent: breakdownInput.marginPercent,
      });
    }
  }

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
  // 되는가"를 판단한다. domesticSummary.sellerCount>0이면 실제로 동일상품을
  // 찾아 가격까지 확인한 것이다(못 찾았으면 0 — summarizeDomesticMarket이
  // 이미 그렇게 집계한다, 새 상태를 지어내지 않는다).
  const sellability = computeSellability({
    costPriceKrw,
    domestic: {
      matched: domesticSummary.sellerCount > 0,
      averagePriceKrw: domesticSummary.averagePriceKrw,
    },
  });

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

  return {
    snapshotId,
    product: { title: product.title.value, brand: product.brand.value, sourceUrl: product.sourceUrl },
    currentPrice: { sellingPriceKrw: currentSellingPriceKrw, costPriceKrw, costBasis },
    domesticCompetition: domesticSummary,
    sellerAction,
    sellability,
    priceHistory: {
      origin: { records: originHistory, change: originChange, trend7d: originTrend7d, trend30d: originTrend30d },
      domestic: { records: domesticHistory, trend7d: domesticTrend7d, trend30d: domesticTrend30d },
      domesticShop: { records: domesticShopHistory, trend7d: domesticShopTrend7d, trend30d: domesticShopTrend30d },
    },
    fx: cost ? { rate: cost.exchangeRate, isEstimate: cost.isRateEstimate } : null,
    cost,
    margin: decision ? { percent: decision.marginPercent } : null,
    decision,
    recommendation,
    alertSignal,
    /** K-1 threshold 판정에 쓸 원재료(가격 알림 저장 로직에서만 사용, GET
     * 응답 스키마에는 그대로 노출하지 않는다 — 화면은 sellerAction만 본다). */
    _alertInputs: { domesticChange: domesticChangeForAlert, originChange: originChangeForAlert },
  };
}

export type MarketIntelligence = NonNullable<Awaited<ReturnType<typeof computeMarketIntelligence>>>;
