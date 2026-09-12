import { createElement, useState, type ReactElement, type ReactNode } from "react";
import { JSDOM } from "jsdom";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
// MI-MARKET-EVIDENCE-1 — 해외 가격비교 응답 fixture는 **서버가 실제로 돌려주는
// 타입**으로 못박는다. 손으로 적은 모양이 유니온 밖의 값을 갖고 있어 화면이
// 죽고 코드 경로 하나가 통째로 숨었던 적이 있다(이 파일 위쪽 주석 참고).
import type { ComparisonSearchResult } from "@commerce/crawler/src/comparison-search/types";
import type { MarketEvidenceSummary } from "../market-evidence";
import { MiPanelView, type DomesticCandidate, type PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { ActionCenter } from "../ActionCenter";
import { PriceCalculationDetail } from "../PriceCalculationDetail";
import { PriceEditor } from "../PriceEditor";
import { SourceDataView } from "../SourceDataView";
import { MissingFieldsBulkPanel } from "../MissingFieldsBulkPanel";
import { DomesticShopSearch } from "../DomesticShopSearch";
import { ComparisonShopSearch } from "../ComparisonShopSearch";
import { BacklogPanel } from "../BacklogPanel";
import { ImageInlineEditor } from "../../ImageInlineEditor";
import { StageBody } from "../StageBody";
import { resolveStageFocus } from "../stage-focus";
import { resolveWorkflow } from "../workflow";
import { computeProfitabilityNumbers } from "../profitability";
import type { RegistrationChannel } from "../registration-channels";
import {
  buildSellingGuidance,
  buildSellingSummary,
  type SellingGuidanceFacts,
} from "@commerce/pricing";

/**
 * MI-FINAL-UX-3 REWORK(CEO 지시, 2026-09-12) — **화면 하나를 통째로 조립한다.**
 *
 * ── 왜 이 파일이 필요한가 ────────────────────────────────────────────────
 * 앞선 세 번의 시도가 전부 "줄였다"고 보고했는데 프로덕션 화면은 길었다. 세 번
 * 모두 원인은 코드가 아니라 **측정 대상**이었다:
 *
 *   ① 소스를 잘라 본문 줄 수를 셌다 — 자른 구간 밖은 애초에 시야에 없었다.
 *   ② 자식 하나를 렌더해 `html === ""`를 확인했다 — "그 자식이 없다"는 명제는
 *      "화면이 짧다"와 다른 명제다.
 *   ③ MiPanelView만 손으로 만든 fixture로 렌더했다 — 패널 **바깥**(상품정보
 *      탭의 나머지 절반)은 한 번도 측정된 적이 없다.
 *
 * 그래서 이 파일은 `CommerceWorkspace`가 상품정보 탭에서 실제로 조립하는 그
 * 트리를 같은 순서·같은 컴포넌트·같은 prop으로 다시 조립한다. 셀러가 보는
 * 것이 MI인지 그 아래 다른 면인지를 **렌더 결과**가 답하게 하려는 것이다.
 *
 * 여기서 숫자를 지어내지 않는다. fixture는 CEO 스크린샷의 상품(원본 €50 ·
 * 국제배송비 ₩12,000 · 수수료 10% · 목표 마진 12% · 관측 환율 1 EUR = ₩1,556.56 ·
 * 국내 비교상품 0건 · CASE D)을 그대로 옮긴 값이고, 수익성 세 숫자는 상세 계산이
 * 부르는 그 함수(computeProfitabilityNumbers)가 낸다 — 손으로 적은 기대값이
 * 아니라 제품 코드의 결과다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 관측 환율. CEO 스크린샷의 "1 EUR = ₩1,557"이 나오는 값이다. */
export const RATES = { EUR: 1556.56 };
export const ROUNDING_UNIT = 100;
/** Settings의 판매자 공통 기본값. MI-COST-POLICY STOP 대상이라 화면에서 지우지 않는다. */
export const DOMESTIC_SHIPPING_COST_KRW = 3000;

export function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/en/products/b226ac043",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    /**
     * ② 시장 판단 단계에서 셀러는 아직 아무 가격도 확정하지 않는다. 이 null이
     * 서버의 currentPrice.sellingPriceKrw / unifiedDecision을 통째로 null로
     * 만들던 값이다(profitability.ts의 주석 참고) — 프로덕션의 기본 상태다.
     */
    priceOverrideKrw: undefined,
  };
}

function EMPTY_COMPETITION(): PriceHistoryResponse["domesticCompetition"] {
  return {
    tier: "NONE",
    lowestPriceKrw: null,
    highestPriceKrw: null,
    averagePriceKrw: null,
    sellerCount: 0,
    sampleListings: [],
    soldOutListings: [],
    checkedAt: null,
  };
}

/**
 * CASE D(국내 동일상품 0건)에서 서버가 buildSellingSummary/buildSellingGuidance에
 * 넘기는 facts. 값은 아래 응답의 cost/recommendation과 같은 숫자다.
 */
const CASE_D_FACTS: SellingGuidanceFacts = {
  recommendedPriceKrw: null,
  targetPriceKrw: 115200,
  estimatedMarginPercent: null,
  targetMarginPercent: 12,
  landedCostKrw: 89828,
  domesticLowestPriceKrw: null,
  brandMedianPriceKrw: 84459,
  sellerCount: null,
  domesticBasis: "NONE",
};

/**
 * 국내 비교상품이 0건인 상품 — CEO 스크린샷의 상태이자 프로덕션에서 가장 흔한
 * 상태다(CASE D · 🟡 조건부 판매 · 글로벌 시장 관측도 0건).
 */
export function productionData(): PriceHistoryResponse {
  return {
    ok: true,
    product: {
      title: "Terry Bermuda Shorts",
      brand: "Bobo Choses",
      sourceUrl: "https://bobochoses.com/en/products/b226ac043",
    },
    currentPrice: { sellingPriceKrw: null, costPriceKrw: 77828, costBasis: "ORIGIN_FX" },
    sellerGlobalMarkets: [],
    domesticCompetition: { ...EMPTY_COMPETITION(), sellers: [], priceMarketBasis: "SINGLE" },
    priceHistory: {
      origin: {
        change: null,
        records: [
          {
            checkedAt: "2026-09-12T08:00:00.000Z",
            priceKrw: 77828,
            currency: "EUR",
            priceAmount: 50,
            exchangeRate: 1556.56,
          },
        ],
      },
      domesticShop: { records: [], trend7d: null, trend30d: null },
    },
    fx: { rate: 1556.56, isEstimate: false },
    cost: {
      originalAmount: 50,
      originalCurrency: "EUR",
      costKrw: 77828,
      shippingKrw: 12000,
      landedCostKrw: 89828,
      suggestedPriceKrw: 115200,
    },
    costSource: "LATEST_PRICE",
    brandMarketProfile: null,
    decision: null,
    recommendation: {
      minimumPrice: 112300,
      targetPrice: 115200,
      marketCase: "D",
      recommendedPrice: null,
      estimatedMarginPercent: null,
      competitiveBasis: "BRAND_MEDIAN",
      referencePriceKrw: 84459,
    },
    sellerAction: {
      status: "PRICE_KEEP",
      icon: "🟡",
      title: "조건부 판매",
      signals: [],
      reasons: [],
      opportunity: null,
    },
    sellability: {
      level: "YELLOW",
      title: "조건부",
      reason: "국내 비교 근거가 부족합니다",
      estimatedMarginPercent: null,
    },
    unifiedDecision: null,
    representativeVerdict: {
      code: "REVIEW_PRICE",
      icon: "🟡",
      title: "가격 확인 필요",
      description:
        "국내 동일상품 가격이 확인되지 않아 참고 기준으로 산정했습니다. 등록 전에 가격을 한 번 더 확인하세요.",
      reasons: ["국내 동일상품 0곳"],
    },
    sellerFacingVerdict: { code: "CONDITIONAL", icon: "🟡", title: "조건부 판매", reasons: [] },
    domesticMarketSplit: { basis: "NONE", exact: EMPTY_COMPETITION(), comparison: EMPTY_COMPETITION() },
    marketSignals: {
      signals: [{ key: "searchInterest", label: "검색 관심", level: "unknown", evidence: "확인되지 않음" }],
      confidence: "limited",
    },
    /**
     * 이 두 값은 손으로 적지 않는다. 서버(market-intelligence.ts)가 부르는 그
     * 함수를 같은 facts로 부른다 — CASE D의 문구/tone을 fixture가 임의로
     * 정하는 순간, 화면이 그 문구를 어떻게 다루는지 검사하는 의미가 사라진다.
     * (실제로 손으로 적었을 때 tone이 타입에 없는 값이라 근거를 펼치는 순간
     *  화면이 죽었다 — fixture가 서버와 갈라져 있으면 이런 경로가 숨는다.)
     */
    sellingGuidance: buildSellingGuidance("D", [], CASE_D_FACTS),
    sellingSummary: buildSellingSummary("D", CASE_D_FACTS),
    confidenceBasis: { confirmedCount: 1, totalCount: 4, items: [] },
    sellerDecision: {
      finalVerdict: "CONDITIONAL",
      priceVerdict: "CONDITIONAL",
      downgradedByMarket: false,
      outlook: "UNKNOWN",
      outlookSummary: "국내 판매처를 확인하지 못했습니다",
      knownSignalCount: 0,
      factors: [],
      reasons: [],
    },
  };
}

/** 국내에서 관측된 한 버킷. summarizeDomesticMarketSplit이 돌려주는 모양 그대로다. */
function competitionBucket(sellerCount: number, averagePriceKrw: number | null): PriceHistoryResponse["domesticCompetition"] {
  return {
    ...EMPTY_COMPETITION(),
    tier: sellerCount > 0 ? "PRIMARY" : "NONE",
    lowestPriceKrw: averagePriceKrw,
    highestPriceKrw: averagePriceKrw,
    averagePriceKrw,
    sellerCount,
  };
}

/** 국내 비교상품이 실제로 확인된 상품. 🇰🇷 국내 시장이 숫자를 갖는 경우다. */
export function withDomesticComparable(): PriceHistoryResponse {
  const data = productionData();
  data.domesticCompetition = {
    tier: "PRIMARY",
    lowestPriceKrw: 109000,
    highestPriceKrw: 129000,
    averagePriceKrw: 116600,
    sellerCount: 3,
    sampleListings: [],
    soldOutListings: [],
    stockCounts: { onSale: 3, unknown: 0, soldOut: 0 },
    sellers: [],
    priceMarketCode: "kr",
    priceMarketBasis: "SINGLE",
    checkedAt: "2026-09-12T08:00:00.000Z",
  };
  /**
   * MI-MARKET-EVIDENCE-1 — 세 곳이 **전부 식별자로 확인된 동일상품**인 경우.
   * 서버의 두 버킷은 서로 겹치지 않으므로(summarizeDomesticMarketSplit) 비교상품
   * 버킷은 0곳이고, 그때만 요약이 "🟢 동일상품 기준"이라고 말할 수 있다.
   */
  data.domesticMarketSplit = {
    basis: "EXACT",
    exact: competitionBucket(3, 116600),
    comparison: competitionBucket(0, null),
  };
  data.recommendation = {
    ...data.recommendation!,
    marketCase: "A",
    recommendedPrice: 115200,
    estimatedMarginPercent: 12,
    competitiveBasis: "DOMESTIC_LOWEST",
  };
  return data;
}

/**
 * MI-MARKET-EVIDENCE-1(CPO 추가 지시, 2026-09-12) — 등급이 **섞인** 상품.
 *
 * 🟢 식별자로 확인된 동일상품 1곳 + ⚪ 그렇지 않은 비교 관측 2곳. 대표 가격은
 * 서버가 동일상품 버킷 하나로만 집계한다(basis = EXACT) — 즉 화면이 "비교상품
 * 3곳 · 🟢 동일상품 기준"이라고 말하면 두 곳이 확정으로 포장되고, 대표 가격이
 * 세 곳의 값인 것처럼도 읽힌다. 둘 다 참이 아니다.
 */
export function withMixedTierDomestic(): PriceHistoryResponse {
  const data = withDomesticComparable();
  data.domesticMarketSplit = {
    basis: "EXACT",
    exact: competitionBucket(1, 116600),
    comparison: competitionBucket(2, 121000),
  };
  return data;
}

/* ─────────────────────── 🌎 해외 판매처 가격 fixture ─────────────────────── */

/** /api/comparison/search가 돌려주는 행 그대로(라우트가 shopCountry를 얹은 모양). */
export type OverseasSearchResult = ComparisonSearchResult & { shopCountry: string | null };

/**
 * 해외 편집샵 세 곳에서 확인된 후보들. 값은 응답 타입이 허용하는 값만 쓴다 —
 * productMatchTruth/priceStatus는 유니온 밖으로 나갈 수 없다.
 *
 * 전부 EXACT_PRODUCT이고 가격이 현재가로 검증된 경우라, 요약이 "🟢 동일상품
 * 기준"이라고 말할 수 있는 유일한 상태다.
 */
export function overseasResults(): OverseasSearchResult[] {
  return [
    {
      shopId: "smallable",
      shopName: "Smallable",
      domain: "smallable.com",
      shopCountry: "FR",
      status: "ok",
      candidates: [
        {
          title: "Terry Bermuda Shorts",
          url: "https://smallable.com/p/430632",
          price: { amount: 45, currency: "EUR" },
          imageUrl: null,
          confidence: 0.91,
          matchLevel: "very_high",
          productMatchTruth: "EXACT_PRODUCT",
          priceStatus: "VERIFIED_CURRENT",
        },
      ],
    },
    {
      shopId: "childrensalon",
      shopName: "Childrensalon",
      domain: "childrensalon.com",
      shopCountry: "GB",
      status: "ok",
      candidates: [
        {
          title: "Terry Bermuda Shorts",
          url: "https://childrensalon.com/p/1",
          price: { amount: 52, currency: "EUR" },
          imageUrl: null,
          confidence: 0.88,
          matchLevel: "high",
          productMatchTruth: "CONFIRMED_PRODUCT",
          priceStatus: "VERIFIED_CURRENT",
        },
      ],
    },
    {
      shopId: "kidsroom",
      shopName: "Kidsroom",
      domain: "kidsroom.de",
      shopCountry: "DE",
      status: "ok",
      candidates: [
        {
          title: "Terry Bermuda Shorts",
          url: "https://kidsroom.de/p/1",
          price: { amount: 49, currency: "EUR" },
          imageUrl: null,
          confidence: 0.9,
          matchLevel: "very_high",
          productMatchTruth: "EXACT_PRODUCT",
          priceStatus: "VERIFIED_CURRENT",
        },
      ],
    },
  ];
}

/**
 * 같은 조회인데 등급이 섞인 경우 — 🟢 하나 + 🟡 동일상품 추정 둘.
 * (VERY_SIMILAR는 match-display가 PRESUMED_SAME으로 옮기는 값이다.)
 */
export function overseasResultsMixedTier(): OverseasSearchResult[] {
  const results = overseasResults();
  results[1]!.candidates[0]!.productMatchTruth = "VERY_SIMILAR";
  results[2]!.candidates[0]!.productMatchTruth = "VERY_SIMILAR";
  return results;
}

/**
 * 수익성 세 줄의 값. 상세 계산(PriceCalculationDetail)이 자기 안에서 부르는 그
 * 함수를 같은 입력으로 부른다 — 기대값을 손으로 적지 않는다.
 */
export const PROFIT = computeProfitabilityNumbers(
  {
    originalAmount: 50,
    originalCurrency: "EUR",
    breakdownInput: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceResolved: true,
    priceOverrideKrw: null,
  },
  RATES,
  ROUNDING_UNIT,
)!;

function noop() {}

export interface TabOptions {
  /**
   * ② 시장 판단이 끝났는가. false면 현재 단계가 ②라 MI가 FULL로 선다
   * (stage-focus.ts). true면 ③ 등록 준비이고 MI는 한 줄 요약이다.
   */
  marketDone?: boolean;
  /** ③④에서 [가격 판단 상세보기]로 MI를 펼쳐 둔 상태. */
  marketDetailOpen?: boolean;
  data?: PriceHistoryResponse;
  /**
   * MI-MARKET-EVIDENCE-1 — 🌎 해외 시장 요약의 **초기값**.
   *
   * 프로덕션에서 이 값은 아래 해외 가격비교 패널이 조회를 끝낸 뒤 위로 올려보내
   * 채워진다(CommerceWorkspace가 들고 있는 상태 그대로). 서버 렌더는 effect를
   * 돌리지 않으므로, "해외 가격이 실제로 있는 화면"을 서버 렌더로 검사하려면
   * 그 상태의 초기값을 넣어주는 길이 필요하다 — 마운트 뒤에는 패널이 보낸
   * 값으로 덮인다(즉 이 옵션이 패널을 우회하지 않는다).
   */
  overseasMarketEvidence?: MarketEvidenceSummary | null;
}

const CHANNELS: RegistrationChannel[] = [
  {
    id: "smartstore",
    label: "스마트스토어",
    availability: "PREVIEW_ONLY",
    state: null,
    blockingCount: 0,
    provisional: false,
  },
  { id: "coupang", label: "쿠팡", availability: "COMING_SOON", state: null, blockingCount: 0, provisional: false },
  { id: "elevenst", label: "11번가", availability: "COMING_SOON", state: null, blockingCount: 0, provisional: false },
];

/**
 * CommerceWorkspace가 상품정보 탭에서 조립하는 트리 그대로.
 *
 * 왼쪽 기둥(MI + StageBody)과 오른쪽 기둥(ActionCenter)을 같은 컨테이너에 담는다 —
 * 실제 화면의 `grid lg:grid-cols-[minmax(0,1fr)_300px]` 두 칸이 이 둘이다.
 */
export function productTabElement(options: TabOptions = {}): ReactElement {
  return createElement(ProductTab, options);
}

/**
 * MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — 조립이 **컴포넌트**가 됐다.
 *
 * 이유는 하나다: 이번 화면에는 형제 사이를 오가는 상태가 둘 생겼다.
 *   ① 해외 가격비교 패널 → (요약) → MI 🌎 해외 시장
 *   ② MI [▸ 국내/해외 가격 보기] → (펼침) → 그 패널
 * 프로덕션에서 그 둘을 들고 있는 곳은 공통 부모(CommerceWorkspace)다. 여기서도
 * 같은 자리에 같은 상태를 두지 않으면, 드릴다운이 실제로 표를 여는지 · 요약이
 * 정말 그 표의 행에서 나온 값인지를 렌더 결과로 확인할 수가 없다 — 확인할 수
 * 없는 것을 보고하지 않는다는 것이 이 파일의 존재 이유다.
 */
function ProductTab(options: TabOptions): ReactElement {
  const data = options.data ?? productionData();
  const product = makeProduct();
  /** CommerceWorkspace가 들고 있는 그 상태 셋 그대로. */
  const [overseasMarketEvidence, setOverseasMarketEvidence] = useState<MarketEvidenceSummary | null>(
    options.overseasMarketEvidence ?? null,
  );
  const [domesticEvidenceOpen, setDomesticEvidenceOpen] = useState(false);
  const [overseasEvidenceOpen, setOverseasEvidenceOpen] = useState(false);

  const workflow = resolveWorkflow({
    collection: { running: false, percent: 100, productReady: true, imageCount: 6, failedImageCount: 0 },
    market: {
      notStarted: false,
      priceProbeDone: true,
      domesticProbeDone: options.marketDone !== false,
      domesticDataFound: data.domesticCompetition.tier !== "NONE",
      demandProbeDone: true,
      demandDataFound: false,
      profitabilityDone: true,
      profitabilityFound: true,
      verdictKnown: true,
      verdictLabel: "조건부 판매",
      loadFailed: false,
    },
    prepare: {
      categoryVerified: false,
      productInfoOk: true,
      productInfoMissing: null,
      optionGroupCount: 0,
      imageCount: 6,
      detailReady: true,
      priceResolved: true,
      priceKrw: PROFIT.recommendedPriceKrw,
      requiredFieldBlockingCount: 2,
    },
    register: {
      channels: CHANNELS.map((c) => ({
        id: c.id,
        label: c.label,
        availability: c.availability,
        registered: false,
      })),
    },
  });

  const focus = resolveStageFocus({
    stage: workflow.currentStepKey,
    surface: "PRODUCT",
    marketDetailOpen: options.marketDetailOpen ?? false,
  });

  /** 제품 전체에서 단 하나뿐인 상세 계산 노드. MI의 접힘 슬롯으로 내려간다. */
  const priceCalculationDetail: ReactNode = createElement(PriceCalculationDetail, {
    product,
    onUpdateOriginalPrice: noop,
    onUpdatePriceBreakdown: noop,
    exchangeRates: { rates: RATES, fetchedAt: "2026-09-12T08:00:00.000Z", source: "frankfurter" as const },
    exchangeRatesLoading: false,
    onRefreshExchangeRates: noop,
    priceRoundingUnit: ROUNDING_UNIT,
    domesticShippingCostKrw: DOMESTIC_SHIPPING_COST_KRW,
  });

  const mi = createElement(MiPanelView, {
    data,
    candidates: [] as DomesticCandidate[],
    snapshotOriginPrice: { amount: 50, currency: "EUR" },
    presentation: focus.mi,
    priceCalculationDetail,
    profitability: PROFIT,
    openPriceDetailRequest: 0,
    onRequestPriceReview: noop,
    // MI-MARKET-EVIDENCE-1 — 요약은 아래 패널이 올려보낸 값 그대로이고,
    // 드릴다운은 그 패널을 여는 일만 한다(표를 여기서 두 번째로 그리지 않는다).
    overseasMarketEvidence,
    onOpenDomesticEvidence: () => setDomesticEvidenceOpen(true),
    onOpenOverseasEvidence: () => setOverseasEvidenceOpen(true),
  });

  const stageBody = createElement(StageBody, {
    focus,
    workflow,
    channels: CHANNELS,
    categoryVerified: false,
    onGoToChannel: noop,
    openPriceSurfaceRequest: 0,
    marketEvidence: createElement(
      "div",
      null,
      createElement(DomesticShopSearch, {
        title: product.title.value,
        brand: product.brand.value,
        sourceUrl: product.sourceUrl,
        sku: product.sku.value,
        description: product.description.value,
        open: domesticEvidenceOpen,
        onToggle: setDomesticEvidenceOpen,
      }),
      createElement(ComparisonShopSearch, {
        title: product.title.value,
        brand: product.brand.value,
        sourceUrl: product.sourceUrl,
        sku: product.sku.value,
        description: product.description.value,
        onRequestPriceReview: noop,
        open: overseasEvidenceOpen,
        onToggle: setOverseasEvidenceOpen,
        onEvidenceChange: setOverseasMarketEvidence,
      }),
    ),
    surfaces: {
      source: createElement(SourceDataView, {
        product,
        onUpdateField: noop,
        onUpdatePrice: noop,
        onUpdateOptions: noop,
        exchangeRates: { rates: RATES },
      }),
      images: createElement(ImageInlineEditor, {
        product,
        items: [],
        thumbnails: {},
        representativeId: null,
        onPreview: noop,
        onSetRepresentative: noop,
        onToggleGalleryUsage: noop,
        onToggleDescriptionUsage: noop,
        onMoveImage: noop,
      }),
      price: createElement(PriceEditor, {
        product,
        recommendedPriceKrw: PROFIT.recommendedPriceKrw,
        onUpdateSalePriceKrw: noop,
        onOpenPriceCalculation: noop,
      }),
      required: createElement(MissingFieldsBulkPanel, { product, onBulkApply: noop }),
    },
    archive: createElement(BacklogPanel, null),
  });

  const actionCenter = createElement(ActionCenter, {
    verdict: { icon: "🟡", title: "조건부 판매", tone: "CAUTION" as const },
    verdictPending: false,
    checklist: [
      { key: "category", label: "카테고리 확인", ok: false, onClick: noop },
      { key: "price", label: "판매가격", ok: true, onClick: noop },
    ],
    checklistMode: focus.actionCenter.checklist,
    channels: CHANNELS,
    channelsMode: focus.actionCenter.channels,
    currentStageLabel: workflow.current.label,
    currentTodo: workflow.currentSubStep?.label ?? null,
    onOpenVerdict: noop,
    onGoToChannel: noop,
  });

  return createElement("div", null, mi, stageBody, actionCenter);
}

/* ───────────────────────────── 읽기 도구 ───────────────────────────── */

/**
 * 한 화면을 **세 덩어리**로 가른다: MI 판단 카드 / 그 아래 단계 본문 /
 * 오른쪽 Action Center.
 *
 * 이 구분이 이 파일의 존재 이유다. "첫 화면이 길다"는 관찰은 MI가 길다는
 * 뜻일 수도 있고 MI 아래가 길다는 뜻일 수도 있는데, 지난 세 번은 그 둘을
 * 구분하지 않은 채 MI만 고쳤다. 경계를 렌더 트리에서 직접 집으므로
 * (productTabElement가 세 노드를 이 순서로 담는다) 눈대중이 끼어들 자리가 없다.
 */
export function regionsOf(html: string): { mi: string; stage: string; aside: string } {
  const root = new JSDOM(`<!doctype html><body>${html}</body>`).window.document.body.firstElementChild;
  if (!root) throw new Error("렌더 결과가 비어 있다");
  const [mi, stage, aside] = Array.from(root.children) as Element[];
  return { mi: mi?.outerHTML ?? "", stage: stage?.outerHTML ?? "", aside: aside?.outerHTML ?? "" };
}

/**
 * 마크업에서 **셀러가 읽는 글자**만 줄 단위로 뽑는다. 태그를 통째로 지우므로
 * title/aria-label(= 근거 계층)은 자연히 빠진다 — 툴팁은 화면 높이를 차지하지
 * 않기 때문이다.
 */
export function visibleLines(html: string): string[] {
  return html
    .replace(/<[^>]*>/g, "\n")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function visibleText(html: string): string {
  return visibleLines(html).join(" ");
}

/**
 * 상품정보 탭에서 셀러가 **아무것도 누르지 않은 상태로** 만나는 최상위 제목들.
 *
 * 화면 구조에서 뽑는다(폰트 크기·클래스 이름이 아니라): CollapsibleSection의
 * 제목, StageBody의 단계 머리말, MI 카드 안에서 한 층을 여는 제목/토글.
 * 무엇이 제목인지를 이 목록이 정하므로, 새 블록이 본문에 생기면 여기 잡힌다.
 */
export const TOP_LEVEL_HEADINGS = [
  // MI 카드
  "Market Intelligence",
  "원본 상품",
  // MI-MARKET-EVIDENCE-1(CEO 지시, 2026-09-12) — 셀러가 묻는 순서의 가운데 두 칸.
  // 이 둘이 서로 다른 질문에 답한다는 사실이 제목에서부터 갈려 있어야 한다.
  "🇰🇷 국내 시장",
  "🌎 해외 시장",
  "수익성",
  "ⓘ 글로벌 시장 가격",
  "ⓘ 가격 계산 기준",
  "왜 이렇게 판단했나요?",
  "🔎 판단 근거",
  // StageBody — 단계 본문과 접힘 목록
  "지금 단계 · 1. 상품 수집",
  "지금 단계 · 2. 시장 판단",
  "지금 단계 · 3. 등록 준비",
  "지금 단계 · 4. 커머스 등록",
  "🇰🇷 한국 시장 · 국내 비교상품 (베타)",
  "🌎 글로벌 시장 · 해외 판매처 가격 (베타)",
  "💰 판매가격 확정",
  "📊 시장 가격 비교",
  "이미지",
  "Source Data",
  "Backlog",
  // ActionCenter(오른쪽 기둥)
  "판매 판단",
  "등록 전 확인",
  "커머스 등록",
] as const;

/** 렌더된 글자 안에서 위 제목들이 **나타난 순서대로** 뽑는다. */
export function headingsInOrder(html: string): string[] {
  const lines = visibleLines(html);
  const found: string[] = [];
  for (const line of lines) {
    for (const heading of TOP_LEVEL_HEADINGS) {
      // 토글은 caret("▸ 왜 이렇게 판단했나요?")과 한 줄에 있다.
      if (line === heading || line.replace(/^[▸▾]\s*/, "").replace(/\s*[▸▾]$/, "") === heading) {
        found.push(heading);
        break;
      }
    }
  }
  return found;
}
