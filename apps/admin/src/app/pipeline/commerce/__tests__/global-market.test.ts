import { describe, expect, it } from "vitest";
import {
  buildGlobalMarketCard,
  marketDisplayName,
  pickJudgingMarketRow,
  type MarketObservationInput,
} from "../global-market";
import { buildMarketComparison } from "../market-comparison";
import { buildMarketContext, buildOriginalPriceHeadline, PRICE_MEANING_LABEL } from "../price-hierarchy";
import { readSourceAt, stripComments } from "./source-text";

/** 화면에 나가는 문자열만 검사한다 — 주석은 "왜 지웠나"를 설명해야 하므로 걷어낸다. */
function read(relativeToThisFile: string): string {
  return readSourceAt(new URL(relativeToThisFile, import.meta.url));
}

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL(CEO 확정, 2026-09-13) — 고정하려는 실제 화면.
 *
 * Production DB 실측(Smallable 430701, 최신 스냅샷, 2026-09-13):
 *
 *     source_label   market_code  currency  price_amount  price_krw
 *     ORIGIN_FX      NULL         EUR       75            116742    ← 원본가
 *     MARKET_PROBE   fr           EUR       75            116742
 *     MARKET_PROBE   kr           EUR       73            113629
 *     MARKET_PROBE   us           EUR       79            122968
 *     MARKET_PROBE   jp           EUR       81            126081
 *
 * 그 다섯 행이 만들어야 하는 카드:
 *
 *     🌐 글로벌 시장 가격
 *     🇫🇷 프랑스   €75.00   ≈ ₩116,742
 *     🇰🇷 한국     €73.00   ≈ ₩113,629
 *     🇺🇸 미국     €79.00   ≈ ₩122,968
 *     🇯🇵 일본     €81.00   ≈ ₩126,081
 */
const SMALLABLE_430701: MarketObservationInput[] = [
  { marketCode: "fr", currency: "EUR", priceAmount: 75, priceKrw: 116742 },
  { marketCode: "kr", currency: "EUR", priceAmount: 73, priceKrw: 113629 },
  { marketCode: "us", currency: "EUR", priceAmount: 79, priceKrw: 122968 },
  { marketCode: "jp", currency: "EUR", priceAmount: 81, priceKrw: 126081 },
];

/** 관측 통화가 나라마다 다른 경우(Bobo Choses 계열) — 같은 규칙이 그대로 적용된다. */
const MIXED_CURRENCY: MarketObservationInput[] = [
  { marketCode: "en-kr", currency: "KRW", priceAmount: 78000, priceKrw: 78000 },
  { marketCode: "en-us", currency: "USD", priceAmount: 53, priceKrw: 71221 },
  { marketCode: "en-de", currency: "EUR", priceAmount: 37, priceKrw: 57756 },
  { marketCode: "en-int", currency: "EUR", priceAmount: 37, priceKrw: 57756 },
];

const CARD = buildGlobalMarketCard({ observations: SMALLABLE_430701 });

const rowOf = (observations: MarketObservationInput[], marketCode: string) =>
  buildGlobalMarketCard({ observations }).rows.find((r) => r.marketCode === marketCode)!;

describe("시장 이름과 국기는 관측된 market_code에서만 나온다", () => {
  it("코드에 적힌 지역 글자를 그대로 읽는다", () => {
    expect(marketDisplayName("en-kr")).toEqual({ flag: "🇰🇷", name: "한국" });
    expect(marketDisplayName("en-us")).toEqual({ flag: "🇺🇸", name: "미국" });
    expect(marketDisplayName("en-de")).toEqual({ flag: "🇩🇪", name: "독일" });
    expect(marketDisplayName("en-fr")).toEqual({ flag: "🇫🇷", name: "프랑스" });
    // 사이트별 probe는 두 글자 국가 코드를 그대로 쓴다(smallable: fr/kr/us/jp).
    expect(marketDisplayName("jp")).toEqual({ flag: "🇯🇵", name: "일본" });
  });

  it("en-int은 어느 나라도 아니다 — 국기를 붙이지 않는다", () => {
    // 실측(Bobo Choses B226AC043): /en-de €75와 /en-int €84가 동시에 존재한다.
    // en-int을 독일이나 "유럽"으로 접으면 둘이 다른 시장이라는 사실이 사라진다.
    const label = marketDisplayName("en-int");
    expect(label.name).toBe("국제");
    expect(label.flag).toBe("🌎");
    expect(/[\u{1F1E6}-\u{1F1FF}]/u.test(label.flag)).toBe(false);
  });

  it("이름을 모르는 지역은 코드를 그대로 쓴다 — 나라 이름을 지어내지 않는다", () => {
    expect(marketDisplayName("en-es").name).toBe("ES");
  });
});

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL §3 — **각 행은 그 시장에서 실제 관측된
 * 통화·금액을 그대로 보여준다.**
 */
describe("나라 줄은 그 시장에서 관측된 통화로 말한다", () => {
  it("CEO가 확정한 네 줄이 그대로 만들어진다", () => {
    expect(CARD.rows.map((r) => [r.flag, r.name, r.observedPrice, r.krwEquivalent])).toEqual([
      ["🇫🇷", "프랑스", "€75.00", "≈ ₩116,742"],
      ["🇰🇷", "한국", "€73.00", "≈ ₩113,629"],
      ["🇺🇸", "미국", "€79.00", "≈ ₩122,968"],
      ["🇯🇵", "일본", "€81.00", "≈ ₩126,081"],
    ]);
  });

  it("한국 줄도 다른 줄과 같은 모양이다 — 원화로 접지 않는다", () => {
    // 직전 화면(7a3250b)은 한국 줄만 "₩113,629 (원 표시가 €73.00)"였다. 그러면
    // 네 줄이 같은 축에서 비교되지 않는다 — 🇰🇷가 ₩이고 🇫🇷가 €일 때 어느 쪽이
    // 싼지 눈으로 답할 수 없다.
    const kr = rowOf(SMALLABLE_430701, "kr");
    expect(kr.observedPrice).toBe("€73.00");
    expect(kr.krwEquivalent).toBe("≈ ₩113,629");
    expect(JSON.stringify(CARD)).not.toContain("원 표시가");
  });

  it("관측 통화가 이미 원화면 환산값을 따로 붙이지 않는다", () => {
    // "₩78,000 ≈ ₩78,000"은 정보가 아니라 같은 숫자의 두 번째 사본이다.
    const kr = rowOf(MIXED_CURRENCY, "en-kr");
    expect(kr.observedPrice).toBe("₩78,000");
    expect(kr.krwEquivalent).toBeNull();
  });

  it("나라마다 관측 통화가 달라도 각자 자기 통화로 말한다", () => {
    expect(rowOf(MIXED_CURRENCY, "en-us").observedPrice).toBe("US$53.00");
    expect(rowOf(MIXED_CURRENCY, "en-de").observedPrice).toBe("€37.00");
    // 환산값이 대표값 자리에 서는 경로가 없다.
    expect(rowOf(MIXED_CURRENCY, "en-us").observedPrice).not.toContain("71,221");
  });

  it("관측이 없는 시장은 — 다 — 다른 나라 값을 옮겨 적지 않는다", () => {
    const card = buildGlobalMarketCard({
      observations: [{ marketCode: "fr", currency: "EUR", priceAmount: null, priceKrw: 113629 }],
    });
    // priceKrw가 저장돼 있어도 프랑스 줄의 대표값이 되지 않는다 — 프랑스에서
    // 관측된 유로 금액이 없다는 것이 이 줄의 사실이다. 환산만 덩그러니 붙이지도 않는다.
    expect(card.rows[0]!.observedPrice).toBe("—");
    expect(card.rows[0]!.krwEquivalent).toBeNull();
    expect(JSON.stringify(card)).not.toContain("113,629");
  });
});

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL §4 — **일본 줄은 날조하지 않는다.**
 *
 * CEO 원문: "실제 JP 시장에서 JPY로 관측된 데이터가 있어야 한다. 없으면 임의
 * 환산하지 않는다."
 */
describe("관측되지 않은 통화를 지어내지 않는다", () => {
  it("JP 관측이 EUR 81이면 화면도 €81.00이다 — ¥로 바꾸지 않는다", () => {
    const jp = rowOf(SMALLABLE_430701, "jp");
    expect(jp.observedPrice).toBe("€81.00");
    // 엔화 기호도, JPY라는 글자도 이 카드에 없다. 이 상품의 JPY 관측은 0건이다.
    expect(JSON.stringify(CARD)).not.toContain("¥");
    expect(JSON.stringify(CARD)).not.toContain("JPY");
  });

  it("국가→통화 매핑이 코드에 없다 — 일본이니까 엔화로 바꾸는 표가 없다", () => {
    const source = stripComments(read("../global-market.ts"));
    for (const currency of ["JPY", "USD", "GBP", "EUR"]) expect(source).not.toContain(currency);
  });

  it("환율을 여기서 곱하지 않는다 — 저장된 price_krw를 문장으로 옮길 뿐이다", () => {
    // 관측 시점 환율 1556.56으로 이미 계산돼 저장된 값 그대로여야 한다.
    expect(rowOf(SMALLABLE_430701, "fr").krwEquivalent).toBe("≈ ₩116,742");
    // 카드는 환율을 인자로 받지 못한다 — 받을 수 있으면 언젠가 여기서 곱한다.
    const input: Parameters<typeof buildGlobalMarketCard>[0] = { observations: SMALLABLE_430701 };
    expect(Object.keys(input)).toEqual(["observations"]);
    expect(stripComments(read("../global-market.ts"))).not.toContain("exchangeRate");
  });
});

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL §H — **제거 목록.**
 *
 * URL · 판매중 · 판매자 신고 국가 · 관측 시간 · 원 표시가 · 동일 상품/판매자
 * 직접 관측 배지 · 하단 disclaimer · "원화 환산" 문구 · 크롤링 기술 상태.
 */
describe("카드에서 지운 것들은 되살아날 자리가 없다", () => {
  it("줄이 들고 있는 것은 나라 · 관측가 · 환산 셋뿐이다", () => {
    for (const row of CARD.rows) {
      expect(Object.keys(row).sort()).toEqual([
        "code",
        "compact",
        "flag",
        "isJudgingMarket",
        "krwEquivalent",
        "krwPrice",
        "marketCode",
        "name",
        "observedPrice",
      ]);
    }
  });

  it("지운 값들은 입력으로도 받지 못한다 — 화면에서만 감춘 것이 아니다", () => {
    // 이 카드가 받을 수 있는 관측 필드가 넷뿐이라, 재고·URL·신고 국가·관측
    // 시각을 그리려면 먼저 입력을 다시 뚫어야 한다(그때 이 테스트가 깨진다).
    const observation: MarketObservationInput = SMALLABLE_430701[0]!;
    expect(Object.keys(observation).sort()).toEqual(["currency", "marketCode", "priceAmount", "priceKrw"]);
  });

  it("카드에는 하단 disclaimer도 🟢 불변식 한 줄도 없다", () => {
    expect(Object.keys(CARD).sort()).toEqual(["empty", "rows", "title"]);
    const shown = JSON.stringify(CARD);
    for (const gone of ["동일 상품", "동일상품", "판매자 직접 관측", "원화 환산", "비교상품 가격이 아닙니다"]) {
      expect(shown).not.toContain(gone);
    }
  });

  it("제목은 CEO가 확정한 글자다", () => {
    expect(CARD.title).toBe("🌐 글로벌 시장 가격");
  });

  it("줄에도 카드에도 착지원가가 없다 — 그 값은 수익성에만 있다", () => {
    expect(JSON.stringify(CARD)).not.toContain("착지원가");
    expect(stripComments(read("../global-market.ts"))).not.toContain("착지원가");
  });

  it("줄에는 가격 의미 라벨이 아예 없다 — 나라와 금액뿐이다", () => {
    expect(JSON.stringify(CARD)).not.toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
  });
});

/**
 * 두 한국 가격은 여전히 절대 섞이지 않는다. 카드의 모양이 바뀌어도 이 경계는
 * 그대로다 — 오히려 이번에 한국 줄이 €73.00이 되면서 두 값의 생김새까지 달라졌다.
 */
describe("판매자 글로벌 시장 가격은 국내 비교상품과 절대 섞이지 않는다", () => {
  const context = buildMarketContext({
    domesticBasis: "EXACT",
    domesticAveragePriceKrw: 116600,
    domesticLowestPriceKrw: 109000,
    domesticSellerCount: 3,
    domesticUnresolved: false,
  });

  it("두 한국 가격은 같은 라벨을 쓰지 않는다", () => {
    expect(rowOf(SMALLABLE_430701, "kr").name).toBe("한국");
    expect(context.comparable.label).toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
    expect(CARD.title).not.toContain(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("두 값은 같은 집계에 들어갈 수 없다 — 서로의 자리를 갖고 있지 않다", () => {
    expect(JSON.stringify(context)).not.toContain("marketCode");
    expect(JSON.stringify(CARD)).not.toContain(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("시장끼리 평균·최저를 내지 않는다 — 아홉 번째 가격을 만들지 않는다", () => {
    expect(Object.keys(CARD).sort()).toEqual(["empty", "rows", "title"]);
  });
});

/**
 * GLOBAL-SOURCE-PRICE-POLICY-FINAL — 카드가 관측 통화로 말하게 되면서, ①과 ②가
 * 읽는 원화는 **별도 필드**(krwPrice)가 됐다. 두 층이 같은 행에서 나온다는 것이
 * 이 묶음이 고정하는 사실이다.
 */
describe("①/②가 읽는 원화는 같은 관측의 다른 질문에 대한 답이다", () => {
  const card = buildGlobalMarketCard({ observations: SMALLABLE_430701 });
  const row = pickJudgingMarketRow(card)!;

  it("한국 줄은 관측 통화와 원화를 동시에 들고 있다", () => {
    expect(row.observedPrice).toBe("€73.00");
    expect(row.krwPrice).toBe("₩113,629");
    // 환산은 같은 원화값에서 나온다 — 두 문자열이 갈라질 수 없다.
    expect(row.krwEquivalent).toBe(`≈ ${row.krwPrice}`);
  });

  it("② 한국 시장 경쟁가격의 왼쪽 칸은 원화다 — 국내 원화와 나란히 서는 자리다", () => {
    const comparison = buildMarketComparison(
      card,
      buildMarketContext({
        domesticBasis: "EXACT",
        domesticAveragePriceKrw: 116600,
        domesticLowestPriceKrw: 109000,
        domesticSellerCount: 3,
        domesticUnresolved: false,
      }),
    );
    expect(comparison.seller.value).toBe("₩113,629");
    // 그 원화가 환산값이라는 사실은 기준 문장이 관측 통화로 말한다.
    expect(comparison.seller.basis).toContain("€73.00");
  });

  it("① 원본 상품 가격의 한국 표시가 줄도 같은 줄에서 나온다", () => {
    const headline = buildOriginalPriceHeadline({
      observedOriginPrice: null,
      originPrice: null,
      sourcePriceKrw: null,
      exchangeRate: null,
      exchangeRateIsEstimate: false,
      originPriceBasis: null,
      costBasisIsKrMarket: false,
      snapshotOriginPrice: { amount: 75, currency: "EUR" },
      krMarketObservation: {
        price: row.krwPrice!,
        marketCode: row.code,
        observedOriginPrice: row.krwEquivalent ? row.observedPrice : null,
      },
    });
    expect(headline.krMarket?.value).toBe("₩113,629");
    // "직접 관측 · 환율 환산이 아닙니다"라고 말하면 거짓이 된다 — 이 값은 환산이다.
    expect(headline.krMarket?.basis).toContain("€73.00");
    expect(headline.krMarket?.basis).toContain("환산");
    expect(headline.krMarket?.basis).not.toContain("환율 환산이 아닙니다");
  });

  it("원화로 관측된 줄은 krwPrice와 observedPrice가 같은 값이다", () => {
    const kr = rowOf(MIXED_CURRENCY, "en-kr");
    expect(kr.krwPrice).toBe("₩78,000");
    expect(kr.observedPrice).toBe(kr.krwPrice);
  });
});

describe("관측된 시장이 없을 때", () => {
  it("판단 실패가 아니라 '검색 데이터 없음'이다", () => {
    const card = buildGlobalMarketCard({ observations: [] });
    expect(card.rows).toHaveLength(0);
    expect(card.empty?.chip).toBe("⚪ 검색 데이터 없음");
  });
});

describe("판단 시장 줄은 정확히 하나일 때만 골라진다", () => {
  it("하나면 그 줄을, 없거나 둘이면 null을 돌려준다 — 모르면 고르지 않는다", () => {
    expect(pickJudgingMarketRow(CARD)?.marketCode).toBe("kr");
    expect(pickJudgingMarketRow(buildGlobalMarketCard({ observations: [] }))).toBeNull();
    const twoKr = buildGlobalMarketCard({
      observations: [...SMALLABLE_430701, { ...SMALLABLE_430701[1]!, marketCode: "en-kr" }],
    });
    expect(pickJudgingMarketRow(twoKr)).toBeNull();
  });
});
