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
  computeUnifiedPriceDecision,
  type UnifiedPriceDecision,
} from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { getDefaultSellerProfile } from "@/app/api/coupang/_lib/seller-profile";
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

  // P-3-2(대표님 지시, 2026-08-28) — P-3-1에서 확정한 설계: 국내 배송원가는
  // 상품마다 다시 입력하지 않는 판매자 기본값(SellerProfile), 관세/부가세는
  // 카테고리마다 달라 상품별 입력(CanonicalProduct)이다. 둘 다 값이 없으면
  // 여전히 unknown으로 전달된다 — 이 조회가 실패하거나 프로필이 없어도
  // 기존과 완전히 동일하게(unknown) 동작한다.
  const sellerProfile = await getDefaultSellerProfile();

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

  // P-1-3 STEP 6/7(대표님 지시, 2026-08-28) — "PriceEditor와 Market Intelligence가
  // 서로 다른 마진을 계산한다"는 P-1-2 실측 문제를 여기서 고친다. 기존
  // computePriceDecision(costPriceKrw=해외원가만) 호출은 그대로 두고(회귀 보존,
  // decision/margin 필드도 그대로 반환), computeUnifiedPriceDecision()으로 배송비/
  // 수수료까지 포함한 "진짜 원가" 기준 판단을 별도 필드(unifiedDecision)로 추가
  // 제공한다.
  //
  // P-3-2(대표님 지시, 2026-08-28) — P-3-1 조사 이전에는 sellerDomesticShippingCostKrw/
  // customerChargedShippingKrw/customsDutyKrw/customsVatKrw 4개가 전부 하드코딩된
  // unknown이었다(추적하는 곳이 없었다). 이제 국내 배송원가는 SellerProfile
  // 기본값, 관세/부가세는 상품별 입력(product.customsDutyKrw/customsVatKrw)에서
  // 실제로 채워진 값만 "actual"로 전달한다 — 값이 없으면(아직 입력 전) 여전히
  // unknown이다(0으로 지어내지 않는다). customerChargedShippingKrw는
  // SellerProfile.deliveryCharge(고객 청구 배송비)를 그대로 통과시킨다 —
  // computeUnifiedPriceDecision()의 LANDED_COST_PARTS에 포함되지 않는 정보용
  // 필드라(unified-price-decision.ts 참고) 원가 합산에는 전혀 영향이 없다.
  const unifiedDecision: UnifiedPriceDecision | null =
    cost != null && currentSellingPriceKrw != null
      ? computeUnifiedPriceDecision({
          sourceProductPriceKrw: { value: cost.costKrw, status: cost.isRateEstimate ? "estimated" : "actual" },
          exchangeRate: { value: cost.exchangeRate, status: cost.isRateEstimate ? "estimated" : "actual" },
          internationalShippingKrw: { value: cost.shippingKrw, status: "estimated", source: "seller_default" },
          sellerDomesticShippingCostKrw:
            sellerProfile?.domesticShippingCostKrw != null
              ? { value: sellerProfile.domesticShippingCostKrw, status: "estimated", source: "SellerProfile.domesticShippingCostKrw" }
              : { value: null, status: "unknown" },
          customerChargedShippingKrw:
            sellerProfile?.deliveryCharge != null
              ? { value: sellerProfile.deliveryCharge, status: "actual", source: "SellerProfile.deliveryCharge" }
              : { value: null, status: "unknown" },
          customsDutyKrw:
            product.customsDutyKrw?.value != null
              ? { value: product.customsDutyKrw.value, status: "actual", source: "product.customsDutyKrw" }
              : { value: null, status: "unknown" },
          customsVatKrw:
            product.customsVatKrw?.value != null
              ? { value: product.customsVatKrw.value, status: "actual", source: "product.customsVatKrw" }
              : { value: null, status: "unknown" },
          platformFeeRate: { value: cost.feePercent, status: "estimated", source: "default" },
          currentSellingPriceKrw: { value: currentSellingPriceKrw, status: "actual" },
          domesticCompetitivePrice: {
            lowest: domesticSummary.lowestPriceKrw,
            average: domesticSummary.averagePriceKrw,
          },
        })
      : null;

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
    unifiedDecision,
    recommendation,
    alertSignal,
    /** K-1 threshold 판정에 쓸 원재료(가격 알림 저장 로직에서만 사용, GET
     * 응답 스키마에는 그대로 노출하지 않는다 — 화면은 sellerAction만 본다). */
    _alertInputs: { domesticChange: domesticChangeForAlert, originChange: originChangeForAlert },
  };
}

export type MarketIntelligence = NonNullable<Awaited<ReturnType<typeof computeMarketIntelligence>>>;
