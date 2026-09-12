import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MiPanelView,
  type DomesticCandidate,
  type PriceHistoryResponse,
} from "../DomesticPriceIntelligencePanel";
import { GLOBAL_MARKET_UNAVAILABLE_NOTE } from "../global-market";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
import { readSourceAt } from "./source-text";

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

function renderPanel(
  data: PriceHistoryResponse,
  options: { candidates?: DomesticCandidate[]; openPriceDetailRequest?: number } = {},
): string {
  return renderToStaticMarkup(
    createElement(MiPanelView, {
      data,
      candidates: options.candidates ?? CANDIDATES,
      presentation: "FULL",
      priceCalculationDetail,
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
    currentPrice: { sellingPriceKrw: 143500, costPriceKrw: 116742, costBasis: "ORIGIN_FX" },
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
    unifiedDecision: {
      landedCostKrw: { value: 126742, status: "estimated" },
      platformFeeKrw: { value: 8610, status: "estimated" },
      estimatedProfitKrw: { value: 8148, status: "estimated" },
      marginPercent: { value: 5.7, status: "estimated" },
      verdict: "MAINTAIN",
      level: "GREEN",
      dataCompleteness: "COMPLETE",
      missingComponents: [],
      customerChargedShippingKrw: { value: 0, status: "actual" },
    },
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

  it("셀러가 보는 것은 판정 · ① 원본 · ② 한국 경쟁 · ③ 수익성 · 되물음 한 줄이다", () => {
    // 판정
    expect(text).toContain("판매 추천");
    expect(text).toContain("대한민국 시장 기준");
    // ① 원본 상품 — 원본 통화 금액과 글로벌 시장으로 가는 ⓘ 한 줄
    expect(text).toContain(PRICE_SECTION_TITLE.ORIGINAL);
    expect(text).toContain("€75.00");
    expect(text).toContain("ⓘ 글로벌 시장 가격");
    // ② 한국 시장 경쟁가격
    expect(text).toContain(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(text).toContain("₩116,600");
    // ③ 수익성 — 착지원가 · 권장 판매가 · 예상 이익 · 판정 한 줄 · ⓘ 기준
    expect(text).toContain(PRICE_SECTION_TITLE.PROFITABILITY);
    expect(text).toContain(PRICE_MEANING_LABEL.LANDED_COST);
    expect(text).toContain("₩126,742");
    expect(text).toContain("최종 추천 판매가 ₩143,500");
    expect(text).toContain(PRICE_MEANING_LABEL.EXPECTED_PROFIT);
    expect(text).toContain("설정 마진 기준 판매 가능");
    expect(text).toContain("ⓘ 가격 계산 기준");
    // 되물음 한 줄
    expect(text).toContain("왜 이렇게 판단했나요?");
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

describe("글로벌 시장 관측이 없을 때", () => {
  const html = renderPanel(withoutGlobalMarket());
  const text = visibleText(html);

  it("노란 상자가 아니라 한 줄이다 — 문구는 지시문 그대로다", () => {
    expect(GLOBAL_MARKET_UNAVAILABLE_NOTE).toBe("현재 사이트에서는 글로벌 시장 가격을 확인할 수 없습니다.");
    expect(text).toContain(`ⓘ ${GLOBAL_MARKET_UNAVAILABLE_NOTE}`);
    expect(html).not.toMatch(/warning-soft|error-soft|danger-soft/);
    // 눌러도 나올 것이 없는 토글을 만들지 않는다(버튼 하나가 줄었다).
    expect((html.match(/▸/g) ?? []).length).toBe(2);
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
