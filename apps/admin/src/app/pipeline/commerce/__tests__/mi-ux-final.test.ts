import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MiPanelView,
  type DomesticCandidate,
  type PriceHistoryResponse,
} from "../DomesticPriceIntelligencePanel";
import { GLOBAL_MARKET_HINT_LABEL, GLOBAL_MARKET_UNAVAILABLE_NOTE } from "../global-market";
import { buildMiVerdictExplanation, MI_VERDICT_EVIDENCE_TOGGLE_LABEL } from "../mi-verdict-copy";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
import { computeProfitabilityNumbers } from "../profitability";
import { readSourceAt, stripComments } from "./source-text";

/**
 * MI-UX-FINAL-REVIEW(CEO 지시, 2026-09-12) — **화면을 통째로 그려서 확인한다**.
 *
 * ── 왜 이 파일이 따로 필요한가 ───────────────────────────────────────────
 * 앞선 두 번(MI-SIMPLIFY-1 / MI-POLISH-2)은 "본문을 줄였다"고 보고했고 테스트도
 * 전부 통과했는데, 프로덕션 화면은 그대로 길었다. 원인은 측정 도구였다:
 *
 *   · 소스 텍스트를 잘라 보는 검사는 **자른 구간 밖**을 보지 못한다.
 *     지금까지의 `miBody()`는 판정 카드(`{hasAnyData && (` ~ 재조회 주석)만
 *     잘랐고, 카드 아래에 접힘 없이 서 있던 다섯 덩어리(🔄 다시 확인 · 💡 기회 ·
 *     🇰🇷 국내 비교상품 · 동일상품 근거 · 안내 두 문단)는 애초에 시야 밖이었다.
 *   · 자식 하나만 렌더하는 검사는 "그 자식이 없다"만 증명한다. 화면이 짧아졌다는
 *     것과는 다른 명제다.
 *   · 줄 수 상한은 **코드 줄**을 세는 것이지 화면 높이를 세는 것이 아니다.
 *
 * 그래서 이 파일은 패널이 실제로 그리는 마크업 하나만 본다. 셀러가 아무것도
 * 누르지 않은 상태(모든 접힘 = 기본값)에서 나오는 문자열이 곧 첫 화면이고,
 * 금지 항목이 그 문자열 안에 있으면 실패한다. 툴팁(title 속성)은 태그와 함께
 * 지운다 — 툴팁은 읽히는 본문이 아니라 마우스를 올려야 나오는 근거다.
 */

/* ─────────────────────────── 렌더 도구 ─────────────────────────── */

/** 마크업에서 셀러가 **읽는 글자**만 남긴다. 태그를 통째로 지우므로 title/
 * aria-label 같은 속성(= 근거 계층)은 자연히 빠진다. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** 슬롯으로 들어오는 상세 계산 화면. 실제 PriceCalculationDetail 대신 표식
 * 하나를 넣는다 — 첫 화면에 이 글자가 보이면 계산서가 본문에 서 있는 것이다. */
const PRICE_CALC_SENTINEL = "상세계산슬롯";
const priceCalculationDetail = createElement("div", null, PRICE_CALC_SENTINEL);

/**
 * MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 그 슬롯이 실제로 그리는 숫자.
 *
 * PriceCalculationDetail이 자기 안에서 부르는 그 함수를, 같은 입력(실측 상품의
 * 원본가 €75 · 국제배송비 ₩10,000 · 수수료 10% · 목표 마진 20% · 관측 환율)으로
 * 여기서도 부른다. 요약이 "상세와 같은 값"을 말하는지를 검사하려면 기준이
 * 손으로 적은 숫자가 아니라 **상세가 쓰는 함수의 결과**여야 한다.
 */
const PROFIT = computeProfitabilityNumbers(
  {
    originalAmount: 75,
    originalCurrency: "EUR",
    breakdownInput: { shippingKrw: 10000, feePercent: 10, marginPercent: 20 },
    priceResolved: true,
    priceOverrideKrw: null,
  },
  { EUR: 1556.56 },
  10,
)!;

function krw(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function renderPanel(
  data: PriceHistoryResponse,
  options: {
    candidates?: DomesticCandidate[];
    openPriceDetailRequest?: number;
    profitability?: typeof PROFIT | null;
  } = {},
): string {
  return renderToStaticMarkup(
    createElement(MiPanelView, {
      data,
      candidates: options.candidates ?? CANDIDATES,
      presentation: "FULL",
      priceCalculationDetail,
      // 요약이 보는 값과 상세가 보는 값이 같은 객체다.
      profitability: options.profitability === undefined ? PROFIT : options.profitability,
      openPriceDetailRequest: options.openPriceDetailRequest ?? 0,
      onRequestPriceReview: () => {},
      snapshotOriginPrice: { amount: 75, currency: "EUR" },
    }),
  );
}

/* ───────────────────────── 실제에 가까운 응답 ───────────────────────── */

/**
 * 실측 상품(Bobo Choses B226AC043, 2026-09-11)의 모양을 그대로 옮긴 응답.
 * 숫자를 여기서 새로 만들지 않는다 — 화면이 서버 값을 옮기기만 한다는 규칙을
 * 검사하는 자리라, fixture도 "서버가 실제로 돌려주던 모양"이어야 한다.
 */
function baseData(): PriceHistoryResponse {
  return {
    ok: true,
    product: { title: "Terry Bermuda Shorts", brand: "Bobo Choses", sourceUrl: "https://bobochoses.com/en/products/b226ac043" },
    /**
     * MI-FINAL-UX-3(CEO 지시, 2026-09-12) — **판매가는 아직 확정되지 않았다.**
     *
     * 지금까지 이 fixture는 sellingPriceKrw = 143,500과 완성된 unifiedDecision을
     * 들고 있었다. 그래서 테스트에서는 수익성에 숫자가 떴고, 프로덕션에서는
     * ⚪ 확인 불가가 떴다 — 둘 다 참이었다. 서버의 그 두 값은 전부
     * product.priceOverrideKrw에서 나오는데(market-intelligence.ts:116, 234),
     * MI가 서는 ② 시장 판단 단계에서는 셀러가 아직 아무 가격도 확정하지 않는다.
     *
     * 그래서 fixture를 프로덕션 쪽으로 되돌린다. 여기서 숫자가 보인다면 그건
     * 서버가 아니라 상세 계산과 같은 함수에서 온 것이다 — 이 파일이 검사하려는
     * 명제가 정확히 그것이다.
     */
    currentPrice: { sellingPriceKrw: null, costPriceKrw: 116742, costBasis: "ORIGIN_FX" },
    sellerGlobalMarkets: [
      {
        marketCode: "en-de",
        marketCountry: "ES",
        currency: "EUR",
        priceAmount: 75,
        priceKrw: 116742,
        soldOut: false,
        productUrl: "https://bobochoses.com/en-de/products/b226ac043",
        checkedAt: new Date().toISOString(),
      },
      {
        marketCode: "en-kr",
        marketCountry: "ES",
        currency: "KRW",
        priceAmount: 162000,
        priceKrw: 162000,
        soldOut: false,
        productUrl: "https://bobochoses.com/en-kr/products/b226ac043",
        checkedAt: new Date().toISOString(),
      },
    ],
    domesticCompetition: {
      tier: "PRIMARY",
      lowestPriceKrw: 109000,
      highestPriceKrw: 129000,
      averagePriceKrw: 116600,
      sellerCount: 3,
      sampleListings: [
        {
          mallName: "포레포레",
          priceKrw: 109000,
          productUrl: "https://example.kr/p/1",
          checkedAt: new Date().toISOString(),
          salePriceKrw: null,
          originalPriceKrw: null,
        },
      ],
      soldOutListings: [],
      stockCounts: { onSale: 3, unknown: 0, soldOut: 0 },
      sellers: [],
      priceMarketCode: "kr",
      priceMarketBasis: "SINGLE",
      checkedAt: new Date().toISOString(),
    },
    priceHistory: {
      origin: {
        change: null,
        records: [
          {
            checkedAt: new Date().toISOString(),
            priceKrw: 116742,
            currency: "EUR",
            priceAmount: 75,
            exchangeRate: 1556.56,
          },
        ],
      },
      domesticShop: { records: [], trend7d: null, trend30d: null },
    },
    fx: { rate: 1556.56, isEstimate: false },
    cost: {
      originalAmount: 75,
      originalCurrency: "EUR",
      costKrw: 116742,
      shippingKrw: 10000,
      landedCostKrw: 126742,
      suggestedPriceKrw: 152000,
    },
    costSource: "LATEST_PRICE",
    brandMarketProfile: null,
    decision: {
      verdict: "MAINTAIN",
      marginPercent: 22.4,
      priceGapVsAveragePercent: 23,
      priceGapVsLowestPercent: 31,
      reason: "국내 평균가보다 높지만 마진은 확보됩니다",
    },
    recommendation: {
      minimumPrice: 140900,
      targetPrice: 158400,
      marketCase: "A",
      recommendedPrice: 143500,
      estimatedMarginPercent: 22.4,
      competitiveBasis: "DOMESTIC_LOWEST",
      referencePriceKrw: 109000,
    },
    sellerAction: {
      status: "PRICE_KEEP",
      icon: "🟢",
      title: "현재 가격 유지",
      signals: [{ icon: "📈", title: "국내 최저가 대비", detail: "31% 높습니다" }],
      reasons: ["국내 동일상품 3곳이 확인되었습니다"],
      opportunity: { icon: "💡", title: "지금 유리한 점", detail: "국내 최저가보다 원가가 낮습니다" },
    },
    sellability: {
      level: "GREEN",
      title: "등록 가능",
      reason: "가격 경쟁력이 있습니다",
      estimatedMarginPercent: 22.4,
    },
    // 판매가가 없으면 서버는 이 값을 아예 만들지 않는다(cost != null &&
    // currentSellingPriceKrw != null). 프로덕션의 대부분이 이 상태다.
    unifiedDecision: null,
    representativeVerdict: {
      code: "READY",
      icon: "🟢",
      title: "등록 진행",
      description:
        "확인된 비용 기준으로 예상 마진이 확보되고, 국내 동일상품 가격도 확인되었습니다. 등록을 진행해도 좋습니다.",
      reasons: ["국내 동일상품 3곳 확인", "예상 마진 22.4%"],
    },
    sellerFacingVerdict: { code: "RECOMMENDED", icon: "🟢", title: "판매 추천", reasons: [] },
    domesticMarketSplit: {
      basis: "EXACT",
      exact: EMPTY_COMPETITION(),
      comparison: EMPTY_COMPETITION(),
    },
    marketSignals: {
      signals: [
        { key: "domesticPresence", label: "국내 판매처", level: "high", evidence: "3곳" },
        { key: "searchInterest", label: "검색 관심", level: "medium", evidence: "최근 4주 평균" },
        { key: "seasonFit", label: "시즌 적합성", level: "high", evidence: "여름" },
      ],
      confidence: "high",
    },
    sellingGuidance: ["국내 최저가보다 높게 책정되어 있으니 상세페이지에서 차별점을 보여주세요."],
    sellingSummary: {
      tone: "GOOD",
      headline: "판매해볼 만합니다",
      numbers: "₩143,500 · 마진 22.4%",
      action: "권장 판매가 ₩143,500으로 등록을 진행하세요",
      actionPriceKrw: 143500,
    },
    confidenceBasis: {
      confirmedCount: 3,
      totalCount: 4,
      items: [
        { label: "원본 가격", confirmed: true, note: null },
        { label: "국내 동일상품", confirmed: true, note: null },
        { label: "국제배송비", confirmed: false, note: "기본값 사용" },
      ],
    },
    sellerDecision: {
      finalVerdict: "RECOMMENDED",
      priceVerdict: "RECOMMENDED",
      downgradedByMarket: false,
      outlook: "GOOD",
      outlookSummary: "국내 판매처와 검색 관심이 모두 확인되었습니다",
      knownSignalCount: 3,
      factors: [
        { key: "priceProfitability", label: "가격 수익성", level: "high", detail: "예상 마진 22.4%" },
        { key: "domesticPrice", label: "국내 동일상품", level: "high", detail: "3곳 확인" },
      ],
      reasons: [],
    },
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

const CANDIDATES: DomesticCandidate[] = [
  {
    id: "cand-1",
    matchType: "EXACT",
    matchConfidence: 0.97,
    matchedTitle: "보보쇼즈 테리 버뮤다 쇼츠",
    matchedBrand: "Bobo Choses",
    matchReasons: ["brand_exact", "model_code_exact"],
    matchTruth: "EXACT_IDENTIFIER",
    verified: true,
    externalUrl: "https://example.kr/p/1",
  },
];

/** 국내 비교상품이 하나도 없는 상품(프로덕션에서 가장 흔한 상태). */
function withoutDomestic(): PriceHistoryResponse {
  const data = baseData();
  data.domesticCompetition = { ...EMPTY_COMPETITION(), sellers: [], priceMarketBasis: "SINGLE" };
  data.domesticMarketSplit = { basis: "NONE", exact: EMPTY_COMPETITION(), comparison: EMPTY_COMPETITION() };
  data.recommendation = { ...data.recommendation!, marketCase: "D", recommendedPrice: null, estimatedMarginPercent: null, competitiveBasis: "BRAND_MEDIAN" };
  return data;
}

/** 글로벌 시장 관측이 하나도 없는 상품(Shopify가 아닌 사이트 전부). */
function withoutGlobalMarket(): PriceHistoryResponse {
  const data = baseData();
  data.sellerGlobalMarkets = [];
  return data;
}

/**
 * 첫 화면에 **절대** 서면 안 되는 것들.
 *
 * 하나하나가 CEO 스크린샷에 실제로 찍혀 있던 항목이다. 지운 것이 아니라
 * 「왜 이렇게 판단했나요?」 / ⓘ 툴팁 / 상세 계산 중 하나로 내려간 것들이고,
 * 다시 본문으로 올라오면 여기서 먼저 걸린다.
 */
const BANNED_IN_BODY: { what: string; needle: string }[] = [
  // 상세 가격 산식 — 계산의 중간 단계는 ⓘ 가격 계산 기준 안에만 있다.
  { what: "상세 계산 슬롯", needle: PRICE_CALC_SENTINEL },
  { what: "국제배송비", needle: "국제배송비" },
  { what: "환율", needle: "환율" },
  { what: "예상 수수료", needle: "예상 수수료" },
  { what: "목표 마진", needle: "목표 마진" },
  { what: "최소마진 확보가", needle: "최소마진 확보가" },
  { what: "목표마진 판매가", needle: "목표마진 판매가" },
  // 관세/부가세 — 8ac100d에서 엔진에서 빠졌다. 화면에도 되살아나지 않는다.
  { what: "관세", needle: "관세" },
  { what: "부가세", needle: "부가세" },
  // Radar / 판단 근거 — 축과 그림은 전부 접힘 안이다.
  { what: "④ 판단 근거 제목", needle: PRICE_SECTION_TITLE.DECISION_EVIDENCE },
  { what: "판단 근거 목록", needle: "판단 근거" },
  { what: "시장 신호", needle: "시장 신호" },
  { what: "종합 시장 상태", needle: "종합 시장 상태" },
  { what: "왜 이런 시장 판단이", needle: "왜 이런 시장 판단이 나왔는가" },
  { what: "가격·판매 전략 가이드", needle: "가격·판매 전략 가이드" },
  // 장문 판단 근거 — 판정을 설명하는 문장은 접힘의 첫 줄이다.
  { what: "판정 설명 문장", needle: "등록을 진행해도 좋습니다" },
  { what: "전략 가이드 문장", needle: "상세페이지에서 차별점을" },
  { what: "👉 행동 문장", needle: "👉" },
  { what: "💡 기회", needle: "지금 유리한 점" },
  // 반복 작업 상태 — 재조회는 작업이지 판단이 아니다.
  { what: "다시 확인 버튼", needle: "다시 확인" },
  // 기술적 NO_DATA / 실패 카드
  { what: "아직 확인되지 않은 비용", needle: "아직 확인되지 않은 비용" },
  { what: "동일상품 근거 목록", needle: "동일상품 근거" },
  { what: "국내 비교상품 목록", needle: "가격 변동 이력" },
  // 추가 설명 — 판정의 범위를 말하는 두 문단.
  { what: "상표권 안내", needle: "상표권" },
  { what: "참고용 판단 안내", needle: "참고용 판단입니다" },
  { what: "분석 기준 시장 배너", needle: "분석 기준 시장" },
];

/* ───────────────────── 첫 화면에 서는 것 / 서지 않는 것 ───────────────────── */

describe("패널 전체를 렌더했을 때 첫 화면", () => {
  const html = renderPanel(baseData());
  const text = visibleText(html);

  it("셀러가 보는 것은 판정 · 원본 상품 · 한국 시장 경쟁가격 · 수익성 · 되물음 한 줄이다", () => {
    // 판정
    expect(text).toContain("판매 추천");
    expect(text).toContain("대한민국 시장 기준");
    // 원본 상품 — 원본 통화 금액과 글로벌 시장으로 가는 ⓘ 한 줄
    expect(text).toContain(PRICE_SECTION_TITLE.ORIGINAL);
    expect(text).toContain("€75.00");
    expect(text).toContain(`ⓘ ${GLOBAL_MARKET_HINT_LABEL}`);
    // 한국 시장 경쟁가격
    expect(text).toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(text).toContain("₩116,600");
    // 수익성 — 판정 한 줄 · 착지원가 · 권장 판매가 · 예상 이익 · ⓘ 기준
    expect(text).toContain(PRICE_SECTION_TITLE.PROFITABILITY);
    expect(text).toContain("설정 마진 기준 판매 가능");
    expect(text).toContain(PRICE_MEANING_LABEL.LANDED_COST);
    expect(text).toContain(PRICE_MEANING_LABEL.RECOMMENDED_PRICE);
    expect(text).toContain(PRICE_MEANING_LABEL.EXPECTED_PROFIT);
    expect(text).toContain("ⓘ 가격 계산 기준");
    // 되물음 한 줄
    expect(text).toContain("왜 이렇게 판단했나요?");
  });

  /**
   * ── MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 이번 지시의 핵심 검사 ────────────
   * 프로덕션 화면은 「수익성 ⚪ 확인 불가」인데 바로 아래 [ⓘ 가격 계산 기준]에는
   * 숫자가 있었다. fixture가 판매가를 확정한 상품이라 테스트만 그 사실을 보지
   * 못했다(위 currentPrice 주석 참고). 이제 fixture는 확정 전이고, 그 상태에서
   * 요약 셋이 **상세가 쓰는 함수의 값과 문자 그대로 같은지**를 본다.
   */
  it("수익성 세 숫자가 상세 계산의 값과 정확히 같다 — 판매가 확정 전에도", () => {
    expect(baseData().currentPrice.sellingPriceKrw).toBeNull();
    expect(baseData().unifiedDecision).toBeNull();
    for (const value of [PROFIT.landedCostKrw, PROFIT.recommendedPriceKrw, PROFIT.expectedProfitKrw]) {
      expect(text, `${krw(value)}이(가) 수익성에 없다`).toContain(krw(value));
    }
    // 그 세 줄 어디에도 빈 상태 칩이 서지 않는다.
    expect(text).not.toContain("⚪ 확인 불가");
  });

  it("수익성에는 확정되지 않은 값을 세우지 않는다 — 내 판매가격·예상 마진은 층이 다르다", () => {
    // 둘 다 판매가를 확정해야 나오는 값이라, 이 단계에서는 언제나 빈 칸이었다.
    // 빈 칸이 판정 카드 안에 서면 셀러는 판정이 흔들린 줄 알고 멈춘다.
    expect(text).not.toContain(PRICE_MEANING_LABEL.SELLER_PLANNED_PRICE);
    expect(text).not.toContain(PRICE_MEANING_LABEL.EXPECTED_MARGIN);
  });

  it("건너뛸 수 있는 번호가 화면 어디에도 없다", () => {
    // 국내 비교상품이 0건이면 가운데 블록이 통째로 사라진다. 그때 ①→③ 점프가
    // 보이면 셀러의 질문이 "팔까"에서 "②는 왜 없지"로 바뀐다.
    expect(text).not.toMatch(/[①②③④⑤]/);
  });

  it("금지 항목이 하나도 없다", () => {
    for (const { what, needle } of BANNED_IN_BODY) {
      expect(text, `${what}이(가) 첫 화면에 있다`).not.toContain(needle);
    }
  });

  it("본문에는 경고/실패 색 상자가 없다", () => {
    // 조회가 안 된 것은 판정의 실패가 아니다. 노란/빨간 상자를 세우면 셀러는
    // 판정이 흔들린 줄 알고 멈춘다.
    expect(html).not.toMatch(/warning-soft|error-soft|danger-soft/);
    expect(html).not.toMatch(/border-warning|border-error|border-danger/);
  });

  it("레이더 그림이 그려지지 않는다 — SVG가 한 개도 없다", () => {
    expect(html).not.toContain("<svg");
  });

  it("접힘은 셋뿐이고 전부 닫혀 있다", () => {
    // ⓘ 글로벌 시장 가격 · ⓘ 가격 계산 기준 · 왜 이렇게 판단했나요?
    // 열림 캐럿(▾)이 하나도 없다는 것이 "도착하자마자 닫혀 있다"의 증거다.
    expect(html).not.toContain("▾");
    expect((html.match(/▸/g) ?? []).length).toBe(3);
  });
});

describe("국내 비교상품이 없을 때", () => {
  const html = renderPanel(withoutDomestic());
  const text = visibleText(html);

  it("② 블록이 DOM에 아예 없다 — 빈 칸 두 개짜리 카드가 아니다", () => {
    expect(text).not.toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(text).not.toContain("검색 데이터 없음");
    expect(text).not.toContain(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("①과 ③은 그대로 남는다 — 비교 불가가 계산 불가는 아니다", () => {
    expect(text).toContain(PRICE_SECTION_TITLE.ORIGINAL);
    expect(text).toContain(PRICE_SECTION_TITLE.PROFITABILITY);
    expect(text).toContain(PRICE_MEANING_LABEL.LANDED_COST);
  });

  it("이 상태에서도 금지 항목이 하나도 없다", () => {
    for (const { what, needle } of BANNED_IN_BODY) {
      expect(text, `${what}이(가) 첫 화면에 있다`).not.toContain(needle);
    }
    expect(html).not.toMatch(/warning-soft|error-soft|danger-soft/);
  });
});

/**
 * ── MI-FINAL-UX-3(CEO 지시, 2026-09-12) — ⓘ가 사라지던 자리 ──────────────────
 * 앞선 배치의 보고는 첫 화면이 "원본 상품 가격 €75.00 · ⓘ 글로벌 시장 가격 ▸"로
 * 열린다고 적었는데 대표님 프로덕션 캡처에는 그 줄이 없었다. 지운 적은 없다 —
 * 관측이 하나도 없을 때 GlobalMarketHint가 버튼 대신 **다른 문장**을 본문 한
 * 줄로 그렸기 때문이다. 그리고 그 조건이 프로덕션의 대부분이다(시장별 페이지를
 * 만드는 장치는 Shopify Markets probe 하나뿐이고, handle을 못 뽑으면 관측이
 * 아예 생기지 않는다).
 *
 * 그래서 이 describe가 고정하는 것은 "값이 없어도 **이름은 그 자리에 있다**"이다.
 */
describe("글로벌 시장 관측이 없을 때도 ⓘ 글로벌 시장 가격은 원본 가격 옆에 있다", () => {
  const html = renderPanel(withoutGlobalMarket());
  const text = visibleText(html);

  it("본문에 서는 것은 두 상태 모두 이름 하나다", () => {
    expect(text).toContain(`ⓘ ${GLOBAL_MARKET_HINT_LABEL}`);
    // 데이터가 있는 화면도 같은 이름 하나다(모양이 상태에 따라 달라지지 않는다).
    expect(visibleText(renderPanel(baseData()))).toContain(`ⓘ ${GLOBAL_MARKET_HINT_LABEL}`);
  });

  it("없다는 사실은 팝오버가 말한다 — 본문 줄도, 카드도 아니다", () => {
    expect(GLOBAL_MARKET_UNAVAILABLE_NOTE).toBe("현재 사이트에서는 글로벌 시장 가격을 확인할 수 없습니다.");
    // 닫힌 화면에는 그 문장이 없다(높이를 한 줄도 차지하지 않는다).
    expect(text).not.toContain(GLOBAL_MARKET_UNAVAILABLE_NOTE);
    // 그래도 읽을 수는 있다 — 마우스를 올리면 나오는 근거 자리에 그대로 있다.
    expect(html).toContain(`title="${GLOBAL_MARKET_UNAVAILABLE_NOTE}"`);
    expect(html).not.toMatch(/warning-soft|error-soft|danger-soft/);
  });

  it("데이터가 있을 때는 같은 자리가 시장 목록을 들고 있다", () => {
    const withData = renderPanel(baseData());
    expect(withData).toContain("🇩🇪 DE €75.00");
    expect(withData).toContain("🇰🇷 KR ₩162,000");
    // 그 목록은 본문에 그려지지 않는다 — 툴팁과 팝오버가 맡는다.
    expect(visibleText(withData)).not.toContain("🇩🇪 DE €75.00");
  });

  it("펼침은 본문 흐름 밖에 뜬다 — 열어도 아래 블록이 밀리지 않는다", () => {
    const panel = readSourceAt(new URL("../DomesticPriceIntelligencePanel.tsx", import.meta.url));
    const hint = panel.slice(panel.indexOf("function GlobalMarketHint("), panel.indexOf("function GlobalMarketCardView("));
    // absolute가 아니면 팝오버가 아니라 카드다("never a card, never a new body row").
    expect(hint).toContain("absolute left-0 top-full");
    expect(hint).toContain("{GLOBAL_MARKET_UNAVAILABLE_NOTE}");
    // 관측 유무로 **버튼이 사라지는** 분기가 다시 생기지 않게 한다.
    expect(hint).not.toContain("if (summaryLine == null) return");
  });

  it("접힘 수는 두 상태에서 같다 — 셋, 전부 닫혀 있다", () => {
    expect((html.match(/▸/g) ?? []).length).toBe(3);
    expect(html).not.toContain("▾");
  });

  it("이 상태에서도 금지 항목이 하나도 없다", () => {
    for (const { what, needle } of BANNED_IN_BODY) {
      expect(text, `${what}이(가) 첫 화면에 있다`).not.toContain(needle);
    }
  });
});

describe("판단할 근거가 하나도 없을 때", () => {
  /** 가격 근거가 전무한 상태(hasAnyData === false). 프로덕션에서 분석 직후 잠깐
   * 지나가는 화면이고, 예전에는 이 상태에서 판정 카드가 통째로 사라지면서
   * 「🔄 다시 확인」만 본문에 남았다. */
  function withoutAnyData(): PriceHistoryResponse {
    const data = withoutDomestic();
    data.cost = null;
    data.costSource = null;
    data.currentPrice = { sellingPriceKrw: null, costPriceKrw: null, costBasis: null };
    data.unifiedDecision = null;
    data.recommendation = null;
    return data;
  }
  const html = renderPanel(withoutAnyData(), { candidates: [] });
  const text = visibleText(html);

  it("판단 불가는 한 줄이고, 되물음은 그대로 누를 수 있다", () => {
    expect(text).toContain("판단 불가");
    expect(text).toContain("왜 이렇게 판단했나요?");
  });

  it("이 상태에서도 재조회 버튼이 본문에 서지 않는다", () => {
    // 되물음이 판정 카드 밖으로 나온 덕분에, 근거가 없는 상태에서도 접힘이
    // 존재한다 — 그게 「🔄 다시 확인」을 본문에서 걷어낼 수 있었던 이유다.
    for (const { what, needle } of BANNED_IN_BODY) {
      expect(text, `${what}이(가) 첫 화면에 있다`).not.toContain(needle);
    }
  });
});

/* ──────────────── 지운 것이 아니라 층을 내렸다 ──────────────── */

describe("내려간 것들은 사라지지 않았다", () => {
  const panel = readSourceAt(new URL("../DomesticPriceIntelligencePanel.tsx", import.meta.url));
  const detail = panel.slice(panel.indexOf("{showMarketDetail && ("));

  it("다섯 덩어리 전부가 「왜 이렇게 판단했나요?」 아래에 있다", () => {
    for (const needle of [
      "🔄 다시 확인",
      "{recheckResult.message}",
      "{sellerAction.opportunity.title}",
      "{PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE} (",
      "동일상품 근거 ({candidates.length}건)",
      "상표권,",
      "참고용 판단입니다",
      "<TargetMarketBanner />",
    ]) {
      expect(detail, `${needle}이(가) 상세에 없다`).toContain(needle);
    }
  });

  it("레이더와 축도 그 아래 한 벌만 있다", () => {
    expect(detail).toContain("<MiRadar radar={radar} />");
    expect(detail).toContain("<MiAxisStars radar={radar} />");
    expect(panel.slice(0, panel.indexOf("{showMarketDetail && ("))).not.toContain("<MiRadar");
  });

  it("상세 계산 슬롯은 ⓘ 가격 계산 기준 안에만 있다", () => {
    // 렌더로는 "없다"까지만 증명된다(서버 렌더에는 클릭이 없다). 슬롯이 여전히
    // 연결돼 있고 그 접힘 **안**에 있다는 것은 배치로 확인한다 — 슬롯이 게이트
    // 밖으로 나가면 첫 화면에 계산서가 다시 선다.
    const gateAt = panel.indexOf("{showPriceDetail && (");
    // 바깥 패널이 슬롯을 내려보내는 줄(priceCalculationDetail={priceCalculationDetail})도
    // 같은 글자를 갖는다 — 그리는 자리는 게이트 뒤에 있는 쪽이다.
    const slotAt = panel.indexOf("{priceCalculationDetail}", gateAt);
    expect(gateAt).toBeGreaterThan(-1);
    expect(slotAt).toBeGreaterThan(gateAt);
    expect(panel.indexOf("ⓘ 가격 계산 기준 {caret(showPriceDetail)}")).toBeLessThan(gateAt);
  });
});

/* ─────────────── 「왜 이렇게 판단했나요?」는 네 줄로 끝난다 ─────────────── */

/**
 * MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 되물음이 답하는 질문은 하나다:
 * **왜 이 판정인가.** 지금까지 이 접힘은 화면의 나머지 절반(설명 두 문장 ·
 * 👉 행동 · 근거 목록 · 참고표 · 신호 3종 · 레이더 · 국내 비교상품 · 동일상품
 * 근거 · 안내 두 문단)을 통째로 들고 있었고, 층은 내려갔지만 눌렀을 때 받는
 * 것이 스무 덩어리면 되물음은 답이 아니라 두 번째 화면이다.
 */
describe("되물음의 답은 네 줄이고, 그 안에 계산도 레이더도 없다", () => {
  const CASES = [
    { name: "추천", input: { marketCase: "A" as const, hasComparable: true, evidenceBasis: "EXACT" as const } },
    { name: "조건부", input: { marketCase: "B" as const, hasComparable: true, evidenceBasis: "COMPARISON" as const } },
    { name: "비추천", input: { marketCase: "C" as const, hasComparable: true, evidenceBasis: "EXACT" as const } },
    { name: "판단 보류", input: { marketCase: null, hasComparable: false, evidenceBasis: "NONE" as const } },
  ];

  it("네 판정 전부 정확히 네 줄이다", () => {
    for (const { name, input } of CASES) {
      const lines = buildMiVerdictExplanation(input);
      expect(lines, `${name}이(가) 네 줄이 아니다`).toHaveLength(4);
      // 줄 하나가 문단이 되면 "네 줄"은 숫자만 맞는 약속이 된다.
      for (const line of lines) expect(line.length, `${name}: ${line}`).toBeLessThanOrEqual(40);
    }
  });

  it("네 줄의 모양은 같다 — 수익성 → 가격 경쟁력 → 근거 → 행동", () => {
    for (const { name, input } of CASES) {
      const [margin, price, evidence, action] = buildMiVerdictExplanation(input);
      expect(["🟢", "🟡", "🔴", "⚪"], name).toContain(margin.slice(0, margin.indexOf(" ")));
      expect(price, name).toMatch(/^💰 /);
      expect(evidence, name).toMatch(/^🔎 /);
      expect(action, name).toMatch(/^→ /);
    }
  });

  it("네 줄에는 레이더도, 계산도, 상표권도, 기술 상태도 없다", () => {
    const BANNED = [
      "레이더",
      "축",
      "착지원가 ₩",
      "환율",
      "국제배송비",
      "수수료",
      "상표권",
      "지식재산권",
      "CASE",
      "확인 불가",
      "검색 데이터 없음",
      "다시 확인",
      "신호",
    ];
    for (const { name, input } of CASES) {
      const text = buildMiVerdictExplanation(input).join(" ");
      for (const needle of BANNED) {
        expect(text, `${name}에 "${needle}"이(가) 있다`).not.toContain(needle);
      }
    }
  });

  it("판정이 바뀌면 네 줄도 바뀐다 — 같은 말을 네 번 하지 않는다", () => {
    const rendered = CASES.map(({ input }) => buildMiVerdictExplanation(input).join(" | "));
    expect(new Set(rendered).size).toBe(4);
  });

  it("나머지 전부는 그 네 줄 아래 한 단계 더 들어간다 — 지운 것이 아니다", () => {
    const panel = readSourceAt(new URL("../DomesticPriceIntelligencePanel.tsx", import.meta.url));
    const detail = panel.slice(panel.indexOf("{showMarketDetail && ("));
    // 네 줄이 먼저고, 그다음이 두 번째 토글이고, 나머지는 전부 그 뒤다.
    const linesAt = detail.indexOf("buildMiVerdictExplanation({");
    const toggleAt = detail.indexOf("{MI_VERDICT_EVIDENCE_TOGGLE_LABEL}");
    const gateAt = detail.indexOf("{showMarketEvidence && (");
    expect(linesAt).toBeGreaterThan(-1);
    expect(toggleAt).toBeGreaterThan(linesAt);
    expect(gateAt).toBeGreaterThan(toggleAt);
    expect(MI_VERDICT_EVIDENCE_TOGGLE_LABEL).toBe("판단 근거 자세히 보기");
    for (const needle of [
      "<MiRadar radar={radar} />",
      "{representativeVerdict.description}",
      "🔄 다시 확인",
      "상표권,",
      "참고용 판단입니다",
      "📶 시장 신호",
    ]) {
      expect(detail.indexOf(needle), `${needle}이(가) 두 번째 단계 밖에 있다`).toBeGreaterThan(gateAt);
    }
  });
});

/* ─────────────── 상세 계산에서 지운 문장 셋 ─────────────── */

/**
 * MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 문장은 자기가 설명하는 값 옆에 있을
 * 때만 길잡이이고, 그렇지 않으면 화면이 길어졌다는 신호다.
 */
describe("가격 계산 기준 안의 설명 문단은 링크 하나로 줄었다", () => {
  const detail = readSourceAt(new URL("../PriceCalculationDetail.tsx", import.meta.url));
  // 금지 문구는 **코드에만** 건다 — 이 저장소는 "왜 지웠는지"를 주석으로 길게
  // 남기는 것이 규칙이라, 주석까지 막으면 근거를 지우게 된다(source-text.ts).
  const detailCode = stripComments(detail);

  it("추정치 문단도, 다른 나라 판매가 안내도 없다", () => {
    for (const needle of [
      "국제배송비·예상 수수료·목표 마진은 실제 물류·정산 데이터가 없어 추정치입니다",
      "Settings에서 기본값 변경",
      "다른 나라 판매가",
      "에서 확인하세요",
    ]) {
      expect(detailCode, `"${needle}"이(가) 남아 있다`).not.toContain(needle);
    }
    // 보낼 곳이 없으면 문장도 되살아나지 않는다 — prop 자체를 지웠다.
    expect(detailCode).not.toContain("onOpenMarketComparison");
  });

  it("Settings 링크는 그 링크가 바꾸는 설정 옆에 선다", () => {
    const marginRow = detail.slice(detail.indexOf('<Row label="목표 마진">'), detail.indexOf("</Row>", detail.indexOf('<Row label="목표 마진">')));
    expect(marginRow).toContain('href="/settings"');
    expect(marginRow).toContain("[설정]");
  });

  it("판매자 부담 비용(국내 배송원가)은 그대로다 — 계산에 들어가는 값이라 숨기지 않는다", () => {
    // packages/pricing/unified-price-decision.ts의 LANDED_COST_PARTS에
    // sellerDomesticShippingCostKrw가 그대로 있다: 착지원가 → 예상이익 → 마진 →
    // verdict까지 흐른다. 화면에서만 감추면 셀러가 못 보는 값이 판정을 움직인다.
    expect(detail).toContain("판매자 부담 비용(판매 판단용)");
    expect(detail).toContain('<Row label="국내 배송원가">');
  });
});
