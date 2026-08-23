import { NextResponse } from "next/server";
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
} from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { getPriceHistory } from "../_lib/price-observations";

/**
 * N-4.01 Part L(대표님 지시) — 가격 대시보드가 필요로 하는 데이터를 한 번에
 * 묶어서 돌려준다(UI는 이번 스프린트에서 만들지 않는다 — 데이터 계약만).
 * 계산은 packages/pricing의 순수 함수만 쓴다 — 이 라우트에서 새 판정
 * 로직을 만들지 않는다(readiness.ts 등 이 프로젝트의 반복 원칙과 동일).
 *
 * N-4.03 Part 9 — {product, currentPrice, domesticCompetition, priceHistory,
 * fx, cost, margin, decision, recommendation} 스키마로 확장한다. cost/fx는
 * 새 판정을 만들지 않고 기존 computePriceBreakdown(P0-1, breakdown.ts)을
 * 그대로 재사용한다 — product.priceBreakdown(사용자가 PriceEditor에서 저장한
 * 값)이 있으면 그걸, 없으면 DEFAULT_PRICE_BREAKDOWN_INPUT을 쓴다(새 기본값을
 * 지어내지 않는다). recommendation의 totalCostKrw도 이 landedCostKrw를 그대로
 * 재사용해 "원가" 개념이 화면마다 다르게 계산되는 걸 막는다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const { snapshotId } = await params;

  const snapshot = await getSnapshot(snapshotId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);

  const [originHistory, domesticHistory, domesticShopHistory] = await Promise.all([
    getPriceHistory(snapshotId, "SELLER_ORIGIN"),
    getPriceHistory(snapshotId, "NAVER_SHOPPING"),
    // N-4.07 2차 — DOMESTIC_SHOP(사전 등록 편집샵 동일상품 관측치)이 있으면
    // summarizeDomesticMarket이 PRIMARY로, 없으면 NAVER_SHOPPING을 SECONDARY로
    // 쓴다(N-4.06에서 이미 만든 계약). 이 라우트가 지금까지 NAVER_SHOPPING만
    // 넘겨서 DOMESTIC_SHOP 관측치가 실제로 있어도 대시보드에 절대 반영되지
    // 않았다 — 이번에 두 소스를 합쳐서 넘긴다.
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
        marginChangePercentPoints: null, // 마진 이력을 별도로 저장하지 않아 계산 불가 — 지어내지 않는다.
      })
    : null;

  let cost: ReturnType<typeof computePriceBreakdown> | null = null;
  let recommendation: ReturnType<typeof computePriceRecommendation> | null = null;
  const originalAmount = product.price.value.amount;
  const originalCurrency = product.price.value.currency;
  if (product.priceValidity === "VALID" && originalAmount > 0 && originalCurrency) {
    const exchangeRates = await fetchLiveExchangeRates();
    const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
    cost = computePriceBreakdown(
      { originalAmount, originalCurrency, ...breakdownInput },
      exchangeRates.rates,
    );
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

  return NextResponse.json({
    ok: true,
    snapshotId,
    product: { title: product.title.value, brand: product.brand.value, sourceUrl: product.sourceUrl },
    currentPrice: { sellingPriceKrw: currentSellingPriceKrw, costPriceKrw },
    domesticCompetition: domesticSummary,
    priceHistory: {
      origin: { records: originHistory, change: originChange, trend7d: originTrend7d, trend30d: originTrend30d },
      domestic: { records: domesticHistory, trend7d: domesticTrend7d, trend30d: domesticTrend30d },
      // N-4.07 2차 — DOMESTIC_SHOP 전용 이력. domesticCompetition(요약)이
      // "지금" 스냅샷이라면, 이건 "지난 N일간 어떻게 바뀌었는지"를 편집샵별로
      // 볼 때 쓴다(sourceLabel로 사이트별 필터링 가능).
      domesticShop: {
        records: domesticShopHistory,
        trend7d: domesticShopTrend7d,
        trend30d: domesticShopTrend30d,
      },
    },
    fx: cost ? { rate: cost.exchangeRate, isEstimate: cost.isRateEstimate } : null,
    cost,
    margin: decision ? { percent: decision.marginPercent } : null,
    decision,
    recommendation,
    alertSignal,
  });
}
