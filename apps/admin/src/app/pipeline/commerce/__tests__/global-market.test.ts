import { describe, expect, it } from "vitest";
import {
  buildGlobalMarketCard,
  marketDisplayName,
  pickJudgingMarketRow,
  type MarketObservationInput,
} from "../global-market";
import { domesticMatchDisplay } from "../match-display";
import { buildMarketContext, buildOriginalPriceHeadline, PRICE_MEANING_LABEL } from "../price-hierarchy";
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
    // 카드가 내놓는 것은 줄 목록과 불변식 한 줄뿐이다. 요약 숫자가 생기면
    // 어느 시장에서도 살 수 없는 "글로벌 평균가"가 화면에 뜬다.
    expect(Object.keys(CARD).sort()).toEqual(["empty", "invariant", "note", "rows", "title"]);
    // 불변식은 문장 하나다 — 금액 필드가 아니다.
    expect(Object.keys(CARD.invariant).sort()).toEqual(["icon", "text"]);
  });
});

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — 나라마다 숫자 하나.
 *
 *   🇰🇷 한국   ₩113,629  (원 표시가 €73)
 *   🇫🇷 프랑스  €75      🇯🇵 일본 €81      🇺🇸 미국 €79
 *
 * 한국 줄만 원화가 대표값이다. 다른 나라 줄은 그 나라에서 관측된 통화 그대로이고,
 * 관측이 없으면 "—"다 — 다른 나라 가격을 옮겨 적어 칸을 채우지 않는다.
 */
describe("시장 한 줄은 나라와 금액 하나만 말한다", () => {
  it("판단 시장이 아닌 줄의 대표값은 그 나라에서 관측된 통화 그대로다", () => {
    const us = CARD.rows.find((r) => r.marketCode === "en-us")!;
    expect(us.observedPrice).toContain("53");
    // 환산 원화가 비-한국 줄의 대표값이 되는 경로 자체가 없다.
    expect(us.observedPrice).not.toContain("71,221");
    expect(us.observedOriginPrice).toBeNull();
  });

  it("한 줄에 금액은 하나뿐이다 — 환산 칸이라는 두 번째 금액 자리가 없다", () => {
    // 여기 있던 krwPrice("원화 환산 ₩57,756")를 지웠다. 그 칸이 있는 동안
    // 프랑스 줄은 €75와 ₩116,742 두 금액을 동시에 말했고, 그 둘이 한 화면의
    // 다른 원화 금액들과 같은 층으로 읽혔다.
    for (const row of CARD.rows) {
      expect(Object.keys(row)).not.toContain("krwPrice");
    }
    expect(JSON.stringify(CARD)).not.toContain("원화 환산");
  });

  it("원화로 관측된 한국 줄에는 원 표시가를 덧붙이지 않는다", () => {
    // "₩78,000 (원 표시가 ₩78,000)"은 정보가 아니라 같은 숫자의 두 번째 사본이다.
    const kr = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    expect(kr.observedPrice).toBe("₩78,000");
    expect(kr.observedOriginPrice).toBeNull();
  });

  it("관측 금액이 없으면 다른 나라 값을 옮겨 적지 않고 — 로 남긴다", () => {
    const card = buildGlobalMarketCard({
      observations: [
        { ...OBSERVATIONS[0]!, marketCode: "en-fr", currency: "EUR", priceAmount: null, priceKrw: 113629 },
      ],
    });
    // priceKrw가 저장돼 있어도 프랑스 줄의 대표값이 되지 않는다 — 프랑스에서
    // 관측된 유로 금액이 없다는 것이 이 줄의 사실이다.
    expect(card.rows[0]!.observedPrice).toBe("—");
    expect(card.rows[0]!.observedPrice).not.toContain("113,629");
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
      for (const shown of [row.name, row.code, row.observedPrice, row.observedOriginPrice ?? "", row.availability.text]) {
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

  it("줄에는 가격 의미 라벨이 아예 없다 — 나라와 금액 둘뿐이다", () => {
    // MI-MATCHING-INTEGRATION-2 — 여기 있던 "원본 판매자 한국 표시가"는 한국
    // 줄에만 붙던 라벨이었고, 그 라벨 때문에 줄 하나가 "라벨 · 외화 · 환산"
    // 세 조각으로 읽혔다. 그 값이 무슨 값인지는 카드가 note로 한 번 말한다.
    for (const row of CARD.rows) {
      expect(Object.keys(row)).not.toContain("priceMeaningLabel");
    }
    expect(JSON.stringify(CARD)).not.toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
  });
});

/**
 * MI/PRICE-2 — ②의 동일성은 매칭이 아니라 구성으로 성립한다.
 *
 *   🌎 판매자 글로벌 시장   같은 판매자가 여러 시장에서 파는 가격   구성으로 동일
 *   🇰🇷 국내 경쟁시장       다른 판매자의 비교 가능 상품           매칭으로 판정
 */
describe("글로벌 시장의 동일 상품 표시는 줄이 아니라 카드가 한 번 단다", () => {
  it("줄에는 배지가 없다 — 달라지지 않는 사실을 네 줄에 네 번 적지 않는다", () => {
    for (const row of CARD.rows) {
      expect(Object.keys(row)).not.toContain("identity");
    }
    // 카드에는 정확히 한 번 있다. 줄의 🟢는 재고 상태(판매중)라 다른 사실이다 —
    // 동일 상품이라는 말이 붙은 자리가 카드 하나뿐인지를 센다.
    expect(CARD.invariant.icon).toBe("🟢");
    expect(JSON.stringify(CARD).match(/동일 ?상품/g) ?? []).toHaveLength(0);
    expect(CARD.invariant.text).not.toContain("동일상품");
  });

  it("국내 매칭 상태와 같은 말을 쓰지 않는다 — 두 개념이 한 어휘로 합쳐지지 않는다", () => {
    // 국내는 matchTruth가 판정한 결과라 등급이 흔들린다(match-display.ts).
    for (const domestic of [
      domesticMatchDisplay("EXACT_IDENTIFIER").label,
      domesticMatchDisplay("TEXT_CONFIRMED").label,
      domesticMatchDisplay("SIMILAR").label,
    ]) {
      expect(CARD.invariant.text).not.toBe(domestic);
    }
    // 지운 것은 문구 자체다 — "동일 상품 · 판매자 직접 관측"이 어느 줄에도 없다.
    expect(JSON.stringify(CARD)).not.toContain("동일 상품 · 판매자 직접 관측");
  });

  it("불변식은 관측 방식을 말한다 — 줄마다 판정된 등급이 아니다", () => {
    expect(CARD.invariant.text).toContain("시장 코드만");
    expect(CARD.invariant.text).toContain("같은 상품 페이지");
  });

  it("같은 상품 경로는 펼친 상세의 값이고, 관측에 적힌 것만 말한다", () => {
    const kr = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    // 시장 코드를 뗀 상품 경로 — 여러 줄에 같은 경로가 적히는 것이 곧 증거다.
    expect(kr.sameProductPath).toBe("/products/x");
  });

  it("URL이 없으면 경로를 지어내지 않는다", () => {
    const us = CARD.rows.find((r) => r.marketCode === "en-us")!;
    expect(us.productUrl).toBeNull();
    expect(us.sameProductPath).toBeNull();
  });
});

/**
 * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — 고정하려는 실제 화면.
 *
 * 오늘:
 *   🇰🇷 한국 KR · 원본 판매자 한국 표시가 €73.00 · 원화 환산 ₩113,629   ❌
 *
 * 요구:
 *   🇰🇷 한국 · 🟢 동일 상품 · 판매자 직접 관측
 *   ₩113,629
 *   원 표시가 €73.00
 *
 * 한국 시장 줄을 읽는 사람은 한국에서 파는 사람이다. 그 줄의 대표 숫자가 유로면
 * 이 줄이 답해야 하는 질문("이 판매처는 한국에서 얼마를 받나")에 셀러가 환산을
 * 한 번 더 해야 답이 나온다. 사실은 셋 다 그대로 남는다 — 시장은 KR, 관측 통화는
 * EUR, 환산은 KRW. 바뀌는 것은 어느 쪽을 크게 쓰는가 하나다.
 */
describe("한국 시장 줄의 대표 숫자는 원화다", () => {
  const KR_IN_EUR: MarketObservationInput = {
    marketCode: "en-kr",
    marketCountry: "ES",
    currency: "EUR",
    priceAmount: 73,
    priceKrw: 113629,
    soldOut: false,
    productUrl: "https://www.smallable.com/en-kr/product/x-430701",
    checkedAt: "2026-09-13T02:00:00.000Z",
  };
  const card = buildGlobalMarketCard({ observations: [KR_IN_EUR, OBSERVATIONS[1]!, OBSERVATIONS[2]!] });
  const kr = card.rows.find((r) => r.marketCode === "en-kr")!;

  it("큰 숫자 자리에 원화가 서고, 원 표시가는 지워지지 않고 뒤에 남는다", () => {
    expect(kr.observedPrice).toBe("₩113,629");
    expect(kr.observedOriginPrice).toBe("€73.00");
    // 본문 한 줄 요약도 같은 문자열을 쓴다(두 자리가 다른 금액을 말할 수 없다).
    expect(kr.compact).toBe("🇰🇷 KR ₩113,629");
  });

  it("지시가 지목한 그 줄이 화면에서 사라졌다", () => {
    // 오늘의 화면: "원본 판매자 한국 표시가 €73.00 · 원화 환산 ₩113,629"
    const shown = JSON.stringify(card);
    expect(shown).not.toContain("원화 환산");
    expect(shown).not.toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
  });

  it("환율을 다시 계산하지 않는다 — 관측에 저장된 원화값 그대로다", () => {
    expect(kr.observedPrice).toBe(`₩${(113629).toLocaleString("ko-KR")}`);
  });

  it("판단 시장이 아닌 줄은 그대로 그 시장의 통화가 주인공이다", () => {
    const us = card.rows.find((r) => r.marketCode === "en-us")!;
    expect(us.observedPrice).toContain("53");
    expect(us.observedOriginPrice).toBeNull();
  });

  it("관측 통화가 이미 원화면 바꿀 것이 없다 — 원 표시가 줄도 만들지 않는다", () => {
    const krwObserved = CARD.rows.find((r) => r.marketCode === "en-kr")!;
    expect(krwObserved.observedPrice).toBe("₩78,000");
    expect(krwObserved.observedOriginPrice).toBeNull();
  });

  it("①로 넘어가는 값도 같은 줄에서 나온다 — 그 숫자가 환산이라는 사실을 기준이 말한다", () => {
    const row = pickJudgingMarketRow(card)!;
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
        price: row.observedPrice,
        marketCode: row.code,
        observedOriginPrice: row.observedOriginPrice,
      },
    });
    expect(headline.krMarket?.value).toBe("₩113,629");
    // "직접 관측 · 환율 환산이 아닙니다"라고 말하면 거짓이 된다 — 이 값은 환산이다.
    expect(headline.krMarket?.basis).toContain("€73.00");
    expect(headline.krMarket?.basis).toContain("환산");
    expect(headline.krMarket?.basis).not.toContain("환율 환산이 아닙니다");
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
