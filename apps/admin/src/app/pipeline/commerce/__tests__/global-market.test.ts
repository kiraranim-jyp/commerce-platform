import { describe, expect, it } from "vitest";
import { buildGlobalMarketCard, marketDisplayName, type MarketObservationInput } from "../global-market";
import { buildMarketContext, PRICE_MEANING_LABEL } from "../price-hierarchy";

/**
 * UX 2.4(CEO 지시, 2026-09-11) — 고정하려는 실제 화면.
 *
 * GLOBAL-MARKET ②③이 시장별 가격(en-kr ₩ · en-us $ · en-fr/en-de/en-int €)을
 * 전부 수집해 저장했는데 화면에는 한 줄도 나오지 않았다. 그리고 화면에는
 * "한국 가격"이라 부를 수 있는 것이 둘 있다:
 *
 *   🇰🇷 판매자 한국 가격  ₩78,000   이 판매처가 직접 한국에 파는 값
 *   🇰🇷 국내 비교상품     ₩116,600  다른 한국 판매자들이 파는 값
 *
 * 이 테스트가 못박는 것:
 *   ① 두 한국 가격은 라벨도 집계도 절대 공유하지 않는다.
 *   ② 시장 이름/국기는 관측된 market_code에서만 나온다(en-int는 국가가 아니다).
 *   ③ 판매자 신고 국가는 기본 화면에 쓰이는 값이 아니다.
 *   ④ 같은 숫자를 한 줄에서 두 번 쓰지 않는다(원화 관측에 원화 환산을 덧붙이지 않음).
 */
const OBSERVATIONS: MarketObservationInput[] = [
  {
    marketCode: "en-kr",
    marketCountry: "ES",
    currency: "KRW",
    priceAmount: 78000,
    priceKrw: 78000,
    soldOut: false,
    productUrl: "https://bobochoses.com/en-kr/products/x",
    checkedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    marketCode: "en-us",
    marketCountry: "ES",
    currency: "USD",
    priceAmount: 53,
    priceKrw: 71221,
    soldOut: null,
    productUrl: null,
    checkedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    marketCode: "en-de",
    marketCountry: "ES",
    currency: "EUR",
    priceAmount: 37,
    priceKrw: 57756,
    soldOut: true,
    productUrl: null,
    checkedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    marketCode: "en-int",
    marketCountry: "ES",
    currency: "EUR",
    priceAmount: 37,
    priceKrw: 57756,
    soldOut: false,
    productUrl: null,
    checkedAt: "2026-09-11T02:00:00.000Z",
  },
];

const CARD = buildGlobalMarketCard({ observations: OBSERVATIONS, costBasisIsTargetMarket: true });

describe("시장 이름과 국기는 관측된 market_code에서만 나온다", () => {
  it("코드에 적힌 지역 글자를 그대로 읽는다", () => {
    expect(marketDisplayName("en-kr")).toEqual({ flag: "🇰🇷", name: "한국" });
    expect(marketDisplayName("en-us")).toEqual({ flag: "🇺🇸", name: "미국" });
    expect(marketDisplayName("en-de")).toEqual({ flag: "🇩🇪", name: "독일" });
    expect(marketDisplayName("en-fr")).toEqual({ flag: "🇫🇷", name: "프랑스" });
  });

  it("en-int은 어느 나라도 아니다 — 국기를 붙이지 않는다", () => {
    // 실측(Bobo Choses B226AC043): /en-de €75와 /en-int €84가 동시에 존재한다.
    // en-int을 독일이나 "유럽"으로 접으면 둘이 다른 시장이라는 사실이 사라진다.
    const label = marketDisplayName("en-int");
    expect(label.name).toBe("국제");
    expect(label.flag).toBe("🌎");
    // 어떤 국가 국기(regional indicator)도 아니다.
    expect(/[\u{1F1E6}-\u{1F1FF}]/u.test(label.flag)).toBe(false);
  });

  it("이름을 모르는 지역은 코드를 그대로 쓴다 — 나라 이름을 지어내지 않는다", () => {
    expect(marketDisplayName("en-es").name).toBe("ES");
  });
});

describe("판매자 글로벌 시장 가격은 국내 비교상품과 절대 섞이지 않는다", () => {
  it("두 한국 가격은 같은 라벨을 쓰지 않는다", () => {
    const kr = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    const context = buildMarketContext({
      domesticBasis: "EXACT",
      domesticAveragePriceKrw: 116600,
      domesticLowestPriceKrw: 109000,
      domesticSellerCount: 3,
      domesticUnresolved: false,
    });
    expect(kr.name).toBe("한국");
    expect(context.comparable.label).toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
    expect(kr.name).not.toBe(context.comparable.label);
    // 카드 제목도 국내 비교상품과 겹치지 않는다.
    expect(CARD.title).not.toContain(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("두 값은 같은 집계에 들어갈 수 없다 — 서로의 자리를 갖고 있지 않다", () => {
    // 글로벌 카드에는 "국내 비교상품" 줄이 들어설 칸이 없고, 한국 경쟁시장
    // 블록에는 시장 코드가 들어설 칸이 없다. 한쪽 값이 다른 쪽 목록으로
    // 흘러들려면 둘 중 하나에 새 필드를 뚫어야 한다 — 그때 이 테스트가 깨진다.
    const context = buildMarketContext({
      domesticBasis: "EXACT",
      domesticAveragePriceKrw: 116600,
      domesticLowestPriceKrw: 109000,
      domesticSellerCount: 3,
      domesticUnresolved: false,
    });
    expect(JSON.stringify(context)).not.toContain("marketCode");
    expect(JSON.stringify(CARD)).not.toContain("DOMESTIC_COMPARABLE_PRICE");
    expect(JSON.stringify(CARD)).not.toContain(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("카드는 그 값이 국내 비교가가 아니라는 사실을 항상 함께 말한다", () => {
    expect(CARD.note).toContain("이 판매처가 직접 파는 값");
    expect(CARD.note).toContain("비교상품 가격이 아닙니다");
  });

  it("시장끼리 평균·최저를 내지 않는다 — 아홉 번째 가격을 만들지 않는다", () => {
    // 카드가 내놓는 것은 줄 목록뿐이다. 요약 숫자가 생기면 어느 시장에서도
    // 살 수 없는 "글로벌 평균가"가 화면에 뜬다.
    expect(Object.keys(CARD).sort()).toEqual(["empty", "note", "rows", "title"]);
  });
});

describe("시장 한 줄은 시장·통화·환산·판매 상태를 말한다", () => {
  it("관측된 통화 그대로의 금액이 줄의 주인공이다", () => {
    const us = CARD.rows.find((r) => r.marketCode === "en-us")!;
    expect(us.observedPrice).toContain("53");
    expect(us.krwPrice).toBe("₩71,221");
  });

  it("원화로 관측된 시장에는 원화 환산을 덧붙이지 않는다", () => {
    // "₩78,000 ≈ ₩78,000"은 정보가 아니라 같은 숫자의 두 번째 사본이다.
    const kr = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    expect(kr.observedPrice).toBe("₩78,000");
    expect(kr.krwPrice).toBeNull();
  });

  it("재고 세 상태를 하나로 뭉개지 않는다", () => {
    expect(CARD.rows.find((r) => r.marketCode === "en-de")!.availability.text).toBe("품절");
    expect(CARD.rows.find((r) => r.marketCode === "en-int")!.availability.text).toBe("판매중");
    // null은 "판매중"이 아니다 — 확인하지 못한 것이다.
    expect(CARD.rows.find((r) => r.marketCode === "en-us")!.availability.text).toBe("재고 확인 불가");
  });

  it("통화가 같아도 시장이 다르면 다른 줄이다", () => {
    const de = CARD.rows.find((r) => r.marketCode === "en-de")!;
    const int = CARD.rows.find((r) => r.marketCode === "en-int")!;
    expect(de.marketCode).not.toBe(int.marketCode);
    expect(de.name).not.toBe(int.name);
  });
});

describe("판매자 신고 국가는 기본 화면의 값이 아니다", () => {
  it("줄의 이름은 신고 국가가 아니라 관측된 시장이다", () => {
    // DB 실측: market_code=en-de인데 market_country=ES다(Bobo Choses는 모든
    // 시장에서 country=ES). 신고 국가를 이름으로 쓰면 독일 시장 가격이
    // 스페인 가격이 된다.
    const de = CARD.rows.find((r) => r.marketCode === "en-de")!;
    expect(de.declaredCountry).toBe("ES");
    expect(de.name).toBe("독일");
    expect(de.code).toBe("en-de");
  });

  it("기본 화면에 그리는 문자열 어디에도 신고 국가가 섞이지 않는다", () => {
    for (const row of CARD.rows) {
      for (const shown of [row.name, row.code, row.observedPrice, row.krwPrice ?? "", row.availability.text]) {
        expect(shown).not.toContain(row.declaredCountry ?? " ");
      }
    }
  });
});

describe("착지원가 기준 줄은 두 번째 사실인 척하지 않는다", () => {
  it("원가가 한국 표시가에서 나왔으면 그 줄에만 표시가 붙는다", () => {
    expect(CARD.rows.filter((r) => r.isCostBasis).map((r) => r.marketCode)).toEqual(["en-kr"]);
  });

  it("원가가 원문 통화 환산이면 어느 줄도 원가 기준이 아니다", () => {
    const card = buildGlobalMarketCard({ observations: OBSERVATIONS, costBasisIsTargetMarket: false });
    expect(card.rows.some((r) => r.isCostBasis)).toBe(false);
  });

  it("판단 시장 관측이 둘이면 아무 줄에도 붙이지 않는다 — 모르면 말하지 않는다", () => {
    const card = buildGlobalMarketCard({
      observations: [...OBSERVATIONS, { ...OBSERVATIONS[0]!, marketCode: "kr" }],
      costBasisIsTargetMarket: true,
    });
    expect(card.rows.some((r) => r.isCostBasis)).toBe(false);
  });
});

describe("관측된 시장이 없을 때", () => {
  it("판단 실패가 아니라 '검색 데이터 없음'이다", () => {
    const card = buildGlobalMarketCard({ observations: [], costBasisIsTargetMarket: false });
    expect(card.rows).toHaveLength(0);
    expect(card.empty?.chip).toBe("⚪ 검색 데이터 없음");
  });
});
