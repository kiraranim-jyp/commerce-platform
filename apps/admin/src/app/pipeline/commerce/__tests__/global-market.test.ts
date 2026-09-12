import { describe, expect, it } from "vitest";
import {
  buildGlobalMarketCard,
  marketDisplayName,
  pickJudgingMarketRow,
  type MarketObservationInput,
} from "../global-market";
import { domesticMatchDisplay } from "../match-display";
import { buildMarketContext, PRICE_MEANING_LABEL } from "../price-hierarchy";
import { readSourceAt, stripComments } from "./source-text";

/** 화면에 나가는 문자열만 검사한다 — 주석은 "왜 지웠나"를 설명해야 하므로 걷어낸다. */
function read(relativeToThisFile: string): string {
  return readSourceAt(new URL(relativeToThisFile, import.meta.url));
}

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

const CARD = buildGlobalMarketCard({ observations: OBSERVATIONS });

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

/**
 * MI/PRICE-2(CEO 지시, 2026-09-12) — 고정하려는 실제 화면.
 *
 *   🇰🇷 한국 · en-kr    착지원가 기준    ₩162,000
 *
 * ₩162,000은 착지원가가 아니다. 그건 Bobo Choses가 한국 방문자에게 직접 보여주는
 * **관측된 시장가**이고, 착지원가는 €75 → ₩116,742 + 국제배송비다. 관측된
 * 시장가에 원가 라벨이 붙는 순간 "판매자가 그 시장에서 받는 값"과 "내가 들여오는
 * 데 드는 돈"의 경계가 사라지고, 그 혼동은 GLOBAL 판매처마다 반복된다.
 */
describe("관측된 시장가를 원가라고 부르지 않는다", () => {
  it("줄에도 카드에도 착지원가가 없다 — 그 값은 ④ 수익성에만 있다", () => {
    // 주석(왜 지웠는지)은 남아 있어도 되지만, 화면에 나가는 문자열에는 없어야 한다.
    expect(JSON.stringify(CARD)).not.toContain("착지원가");
    expect(stripComments(read("../global-market.ts"))).not.toContain("착지원가");
  });

  it("원가를 넘길 수 있는 인자 자체가 없다 — 배지가 되살아날 자리를 없앴다", () => {
    // 이 카드가 받는 것은 관측 목록 하나뿐이다. 새 인자를 뚫어야만 원가가 다시
    // 들어올 수 있고, 그때 이 테스트가 먼저 깨진다.
    const input: Parameters<typeof buildGlobalMarketCard>[0] = { observations: OBSERVATIONS };
    expect(Object.keys(input)).toEqual(["observations"]);
  });

  it("판단 시장 줄은 자기 라벨을 달고, 그 라벨은 가격 계층 표에서 온다", () => {
    const kr = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    expect(kr.priceMeaningLabel).toBe(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
    // 관측된 값이라는 사실을 말하지, 무엇의 기준이라고 말하지 않는다.
    expect(kr.priceMeaningLabel).toContain("표시가");
    expect(kr.priceMeaningLabel).not.toContain("기준");
  });

  it("부딪힐 상대가 없는 시장 줄에는 라벨을 억지로 붙이지 않는다", () => {
    // "🇩🇪 독일 · en-de · €75"로 충분하다 — 화면에 다른 독일 가격이 없다.
    expect(CARD.rows.find((r) => r.marketCode === "en-de")!.priceMeaningLabel).toBeNull();
    expect(CARD.rows.find((r) => r.marketCode === "en-int")!.priceMeaningLabel).toBeNull();
  });
});

/**
 * MI/PRICE-2 — ②의 동일성은 매칭이 아니라 구성으로 성립한다.
 *
 *   🌎 판매자 글로벌 시장   같은 판매자가 여러 시장에서 파는 가격   구성으로 동일
 *   🇰🇷 국내 경쟁시장       다른 판매자의 비교 가능 상품           매칭으로 판정
 */
describe("글로벌 시장 줄의 동일 상품 표시는 매칭 등급이 아니다", () => {
  it("모든 줄이 같은 🟢 하나를 단다 — 등급이 없다", () => {
    for (const row of CARD.rows) {
      expect(row.identity.icon).toBe("🟢");
      expect(row.identity.text).toBe("동일 상품 · 판매자 직접 관측");
    }
    expect(new Set(CARD.rows.map((r) => r.identity.text)).size).toBe(1);
  });

  it("국내 매칭 상태와 같은 말을 쓰지 않는다 — 두 개념이 한 어휘로 합쳐지지 않는다", () => {
    // 국내는 matchTruth가 판정한 결과라 등급이 흔들린다(match-display.ts).
    for (const row of CARD.rows) {
      for (const domestic of [
        domesticMatchDisplay("EXACT_IDENTIFIER").label,
        domesticMatchDisplay("TEXT_CONFIRMED").label,
        domesticMatchDisplay("SIMILAR").label,
      ]) {
        expect(row.identity.text).not.toBe(domestic);
      }
    }
  });

  it("근거는 줄이 아니라 펼친 상세가 들고, 관측에 적힌 것만 말한다", () => {
    const kr = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    expect(kr.identity.evidence).toContain("동일 판매처 · 동일 상품 경로");
    // 시장 코드를 뗀 상품 경로 — 여러 줄에 같은 경로가 적히는 것이 곧 증거다.
    expect(kr.identity.evidence).toContain("/products/x");
    expect(kr.identity.evidence).toContain("시장 코드만 en-kr로 바꿔 관측");
    // 줄에 보이는 짧은 말에는 근거가 섞이지 않는다(줄이 길어지면 가격이 밀린다).
    expect(kr.identity.text).not.toContain("경로");
  });

  it("URL이 없으면 경로를 지어내지 않는다", () => {
    const us = CARD.rows.find((r) => r.marketCode === "en-us")!;
    expect(us.productUrl).toBeNull();
    expect(us.identity.evidence).not.toContain("/products");
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
    expect(pickJudgingMarketRow(CARD)?.marketCode).toBe("en-kr");
    expect(pickJudgingMarketRow(buildGlobalMarketCard({ observations: [] }))).toBeNull();
    const twoKr = buildGlobalMarketCard({
      observations: [...OBSERVATIONS, { ...OBSERVATIONS[0]!, marketCode: "kr" }],
    });
    expect(pickJudgingMarketRow(twoKr)).toBeNull();
  });
});
