import { backfillCanonicalProduct } from "@commerce/shared";
import {
  computePriceDecision,
  computePriceChange,
  computePriceTrend,
  computePriceRecommendation,
  computePriceAlertSignal,
  summarizeDomesticMarketSplit,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  computePriceBreakdown,
  computeSellerAction,
  priceLevelFromVerdict,
  computeSellability,
  computeUnifiedPriceDecision,
  deriveRepresentativeSellerVerdict,
  toSellerFacingVerdict,
  type UnifiedPriceDecision,
  type PriceObservationRecord,
} from "@commerce/pricing";
import { fetchLiveExchangeRates } from "@/lib/exchange-rates";
import { getDefaultSellerProfile } from "@/app/api/coupang/_lib/seller-profile";
import { getSnapshot } from "../../snapshots/_lib/snapshot";
import { getPriceHistory } from "./price-observations";
import { computeBrandMarketProfileFor } from "./brand-market";
import { listDomesticProductLinks, priceTierFromLink } from "../../domestic-price-sources/_lib/domestic-product-link";

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

  // P-19-B Sprint 7(CPO 지시, 2026-09-02) — "🟢 동일상품 확인" 가격과 "🟡 비교상품"
  // 시장 참고가격을 완전히 분리된 두 버킷으로 집계한다. domestic_product_links의
  // matchTruth(이미 계산된 값, P-10 STEP 4)로 DOMESTIC_SHOP 관측치를 sourceRefId
  // 기준으로 나눈다 — 새 매칭 로직이 아니라 priceTierFromLink() 하나로 기존 판정을
  // 재사용하는 분류다. NAVER_SHOPPING(동일상품 검증 없는 검색 후보)은 기존과
  // 동일하게 비교상품 버킷에 포함한다(과거 tier="SECONDARY"와 같은 신뢰도 취급).
  const domesticLinks = await listDomesticProductLinks(snapshotId);
  const tierBySourceId = new Map(domesticLinks.map((l) => [l.sourceId, priceTierFromLink(l)]));
  const exactShopRecords: PriceObservationRecord[] = [];
  const comparisonShopRecords: PriceObservationRecord[] = [];
  for (const record of domesticShopHistory) {
    const tier = record.sourceRefId ? tierBySourceId.get(record.sourceRefId) : undefined;
    if (tier === "EXACT") exactShopRecords.push(record);
    else if (tier === "COMPARISON") comparisonShopRecords.push(record);
    // tier === "EXCLUDED" 또는 매칭 링크를 못 찾은 레코드(레거시)는 어느
    // 버킷에도 넣지 않는다 — 추측으로 분류하지 않는다.
  }
  const domesticMarketSplit = summarizeDomesticMarketSplit(exactShopRecords, [...comparisonShopRecords, ...domesticHistory]);
  // 1순위 동일상품가격, 없으면 2순위 비교상품 시장가격(대표님 지시, Sprint 7
  // 우선순위) — 아래 decision/unifiedDecision/sellerAction/sellability/
  // representativeVerdict는 전부 이 하나의 변수만 받으므로, 우선순위 로직을
  // 여기 한 곳에서만 바꾸면 전체에 일관되게 적용된다(재계산 없음, 새 판정
  // 로직 추가 없음).
  const domesticSummary = domesticMarketSplit.resolved;

  // P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품 데이터가 없을 때만(Level 1
  // 없음) 브랜드 시장 데이터를 2차 판단 근거로 계산한다. 동일상품 데이터가
  // 있으면 항상 그게 우선이라 브랜드 시장은 계산할 필요가 없다(불필요한 조회
  // 방지). confidence가 INSUFFICIENT(표본 1~2개)면 가격 추천에 쓰지 않는다
  // (CPO 명시: "표본이 적으면 분석하지 않는다") — computePriceRecommendation에
  // 넘기지 않고 UI 표시에서도 제외한다.
  const brandMarketProfile =
    domesticSummary.tier === "NONE" ? await computeBrandMarketProfileFor(product.brand.value).catch(() => null) : null;
  const usableBrandMarketProfile =
    brandMarketProfile && brandMarketProfile.confidence !== "INSUFFICIENT" ? brandMarketProfile : null;
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

  // P-12B(대표님/CPO 지시, 2026-08-31) — 착지원가/추천판매가는 과거 크롤링
  // 시점의 canonicalProduct.price(정적)가 아니라 최근 실제 확인된 구매가능
  // 가격을 우선 사용한다. 우선순위: ①최신 observation.soldOut!==true &&
  // salePriceKrw → LATEST_SALE, ②같은 조건 && priceKrw → LATEST_PRICE,
  // ③최신 observation 없음/품절 → STATIC_SNAPSHOT(기존 동작 그대로). 품절
  // observation은 최신이어도 원가 기준으로 승격하지 않는다(CPO 명시).
  // originalPriceKrw(정가)는 이 우선순위 어디에도 없다 — 원가 계산에 사용 금지,
  // 표시 전용(CPO 명시).
  type CostSource = "LATEST_SALE" | "LATEST_PRICE" | "STATIC_SNAPSHOT";
  const latestOrigin = originHistory[0] ?? null;
  let costSource: CostSource = "STATIC_SNAPSHOT";
  let resolvedOriginalAmount = product.price.value.amount;
  let resolvedOriginalCurrency = product.price.value.currency;
  if (latestOrigin && latestOrigin.soldOut !== true) {
    if (latestOrigin.salePriceKrw != null) {
      costSource = "LATEST_SALE";
      resolvedOriginalAmount = latestOrigin.salePriceKrw;
      resolvedOriginalCurrency = "KRW";
    } else if (latestOrigin.priceKrw != null) {
      costSource = "LATEST_PRICE";
      resolvedOriginalAmount = latestOrigin.priceKrw;
      resolvedOriginalCurrency = "KRW";
    }
  }

  let cost: ReturnType<typeof computePriceBreakdown> | null = null;
  let recommendation: ReturnType<typeof computePriceRecommendation> | null = null;
  // STATIC_SNAPSHOT일 때만 기존 priceValidity 게이트를 그대로 유지한다(회귀
  // 방지). LATEST_SALE/LATEST_PRICE는 이미 실측된 값이라 이 게이트와 무관하다.
  const hasResolvedPrice = resolvedOriginalAmount > 0 && Boolean(resolvedOriginalCurrency);
  const canComputeCost =
    costSource !== "STATIC_SNAPSHOT" ? hasResolvedPrice : product.priceValidity === "VALID" && hasResolvedPrice;
  if (canComputeCost) {
    const exchangeRates = await fetchLiveExchangeRates();
    const breakdownInput = product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
    cost = computePriceBreakdown(
      { originalAmount: resolvedOriginalAmount, originalCurrency: resolvedOriginalCurrency, ...breakdownInput },
      exchangeRates.rates,
    );
    // P-24 Sprint 4(CPO 지시, 2026-09-02) — 실측(PèPè): 국내 EXACT 최저가
    // ₩258,000이 있는데도 화면 "추천 판매가"는 cost.suggestedPriceKrw(원가×
    // 목표마진, 시장가 무관 역산)인 ₩346,286을 그대로 보여줬다. 원인은 이
    // 조건 — computePriceRecommendation()(시장가를 이미 우선 반영하는 기존
    // 함수, 새로 만들지 않음)이 currentSellingPriceKrw!=null일 때만 호출됐는데,
    // 실제 프로덕션에는 판매가가 확정된 스냅샷이 사실상 없다(P-12B 주석과
    // 동일한 이유). currentSellingPriceKrw는 이 함수 내부에서 애초에 쓰이지
    // 않는 값이라(price-recommendation.ts 참고) 게이트를 없애도 계산 자체는
    // 그대로다 — DomesticPriceIntelligencePanel.tsx는 이미 recommendation이
    // 있으면 그 값을, 없으면 cost.suggestedPriceKrw를 쓰도록 되어 있었으므로
    // (`recommendation?.recommendedPrice ?? cost.suggestedPriceKrw`) 이 한 곳만
    // 고치면 화면이 자동으로 시장가 기준 값을 보여준다.
    // P-26 Sprint 1-2(CPO 지시, 2026-09-03) — domesticBasis(EXACT/COMPARISON/
    // NONE)를 넘겨야 CASE A/B/C(시장경쟁 판단)와 CASE D(EXACT 아님, 판단 보류)를
    // 구분할 수 있다. domesticMarketSplit.basis는 이미 위에서 계산된 값 그대로다.
    recommendation = computePriceRecommendation({
      totalCostKrw: cost.landedCostKrw,
      currentSellingPriceKrw: currentSellingPriceKrw ?? undefined,
      domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
      domesticAveragePriceKrw: domesticSummary.averagePriceKrw,
      domesticBasis: domesticMarketSplit.basis,
      minimumMarginPercent: 10,
      targetMarginPercent: breakdownInput.marginPercent,
      // P-13A — EXACT 시장가가 없을 때(CASE D)만 이 값이 실제로 쓰인다.
      brandMedianPriceKrw: usableBrandMarketProfile?.medianPriceKrw ?? null,
    });
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

  // P-8 STEP 2(대표님 지시, 2026-08-30) — "화면 최상단에 대표 판단 1개만 둔다."
  // unifiedDecision/sellability를 재계산하지 않고, 이미 위에서 낸 결과를 그대로
  // 단일 대표 상태로 압축한다(deriveRepresentativeSellerVerdict는 새 판정을
  // 만들지 않는 presentation-layer 함수 — packages/pricing 참고).
  const representativeVerdict = deriveRepresentativeSellerVerdict({
    unifiedDecision,
    sellability,
    domesticMatched: domesticSummary.sellerCount > 0,
    domesticSellerCount: domesticSummary.sellerCount,
    // P-22(CPO 지시, 2026-09-02) — domesticSummary(=domesticMarketSplit.resolved)가
    // EXACT에서 왔는지 COMPARISON에서 왔는지를 그대로 전달한다(새 판정 없음,
    // summarizeDomesticMarketSplit()이 이미 낸 값 재사용).
    domesticBasis: domesticMarketSplit.basis,
    // P-26(CPO 지시, 2026-09-03) — computePriceRecommendation()이 이미
    // CASE A/B/C/D를 계산해 낸다(marketCase). 여기서 가격을 다시 비교하지
    // 않고 그 결과를 그대로 전달한다(추천가 계산과 판매 판단 단일화).
    marketCase: recommendation?.marketCase ?? null,
    recommendation: recommendation
      ? { recommendedPrice: recommendation.recommendedPrice, estimatedMarginPercent: recommendation.estimatedMarginPercent }
      : null,
    domesticLowestPriceKrw: domesticSummary.lowestPriceKrw,
    landedCostKrw: cost?.landedCostKrw ?? null,
  });
  // P-19-B Sprint 8(CPO 지시, 2026-09-02) — 판매자에게 최종적으로 보여줄 화면은
  // 무조건 3단계(🟢 판매 추천/🟡 조건부 판매/🔴 판매 비추천)로 통합한다. 기존
  // 5단계(representativeVerdict) 내부 판정은 그대로 유지한다(재계산 없음) —
  // toSellerFacingVerdict()는 그 값을 화면용으로 압축만 하는 presentation layer.
  const sellerFacingVerdict = toSellerFacingVerdict(representativeVerdict);

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
    // P-19-B Sprint 7/9(CPO 지시, 2026-09-02) — UI가 "동일상품 가격"인지 "국내 유사
    // 시장가격(참고용)"인지 문구를 구분해서 보여줄 수 있도록 두 버킷과 basis를
    // 그대로 노출한다. domesticCompetition(=resolved)은 하위호환을 위해 그대로 둔다.
    domesticMarketSplit,
    sellerAction,
    sellability,
    representativeVerdict,
    sellerFacingVerdict,
    priceHistory: {
      origin: { records: originHistory, change: originChange, trend7d: originTrend7d, trend30d: originTrend30d },
      domestic: { records: domesticHistory, trend7d: domesticTrend7d, trend30d: domesticTrend30d },
      domesticShop: { records: domesticShopHistory, trend7d: domesticShopTrend7d, trend30d: domesticShopTrend30d },
    },
    fx: cost ? { rate: cost.exchangeRate, isEstimate: cost.isRateEstimate } : null,
    cost,
    // P-12B — cost가 실제로 어떤 기준으로 계산됐는지 UI까지 전달한다("최신
    // 확인가 기준" vs "저장된 가격 기준" 구분 표시용).
    costSource: cost ? costSource : null,
    // P-13A — 국내 동일상품이 없을 때 UI가 "왜 이 가격인가"에 쓸 브랜드 시장
    // 근거. confidence=INSUFFICIENT면 null(가격 판단에 안 쓴다는 뜻과 동일 —
    // usableBrandMarketProfile과 표시 여부를 일치시킨다).
    brandMarketProfile: usableBrandMarketProfile,
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
