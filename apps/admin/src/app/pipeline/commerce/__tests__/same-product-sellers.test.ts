import { describe, expect, it } from "vitest";
import {
  buildSameProductSellersCard,
  SAME_PRODUCT_SELLERS_TITLE,
  sellerNameFromUrl,
  type SameProductSellersInput,
} from "../same-product-sellers";
import { buildGlobalMarketCard, pickJudgingMarketRow, type MarketObservationInput } from "../global-market";
import { domesticMatchDisplay } from "../match-display";
import { readSourceAt, stripComments } from "./source-text";

function read(relativeToThisFile: string): string {
  return readSourceAt(new URL(relativeToThisFile, import.meta.url));
}

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — 고정하려는 실제 화면.
 *
 *   동일상품 판매처
 *   Smallable     ₩113,629
 *   Bobo Choses   ₩168,000
 *   🟢 동일상품
 *
 * 값은 전부 실제 상품에서 왔다: Smallable 430701(한국 페이지 €73 = ₩113,629)과
 * 같은 상품인 bobochoses.com B226AC114(₩168,000).
 */
const SMALLABLE_URL =
  "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701";
const BOBO_URL = "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt";

function input(overrides: Partial<SameProductSellersInput> = {}): SameProductSellersInput {
  return {
    origin: { sourceUrl: SMALLABLE_URL, price: "₩113,629" },
    sameProductListings: [{ mallName: "Bobo Choses 공식몰", priceKrw: 168000, productUrl: BOBO_URL }],
    ...overrides,
  };
}

describe("동일상품 판매처는 여러 판매처의 같은 상품을 나란히 세운다", () => {
  const card = buildSameProductSellersCard(input());

  it("등록한 판매처가 첫 줄이고, 같은 상품의 다른 판매처가 그 아래 온다", () => {
    expect(card.title).toBe(SAME_PRODUCT_SELLERS_TITLE);
    expect(card.rows.map((r) => [r.sellerName, r.price])).toEqual([
      ["Smallable", "₩113,629"],
      ["Bobo Choses 공식몰", "₩168,000"],
    ]);
    // 기준이 목록 가운데 섞이면 비교의 방향이 사라진다.
    expect(card.rows[0]!.isOrigin).toBe(true);
    expect(card.rows[1]!.isOrigin).toBe(false);
  });

  it("등급은 카드에 한 번이다 — 줄마다 달라지는 값이 아니다", () => {
    expect(card.verdict).toEqual({ icon: "🟢", label: "동일상품" });
    // 🟢 동일상품과 **같은 말**을 쓴다. 여기서 두 번째 이름을 만들면 같은 판정이
    // 화면마다 다르게 불린다(MATCHING-UNIFY-1이 없앤 문제 그 자체).
    expect(card.verdict.label).toBe(domesticMatchDisplay("STRONG_IDENTIFIER").label);
    for (const row of card.rows) expect(Object.keys(row)).not.toContain("verdict");
  });

  it("최저가도 평균가도 차액도 내지 않는다 — 나란히 놓는 것까지가 이 카드의 일이다", () => {
    expect(Object.keys(card).sort()).toEqual(["empty", "note", "rows", "title", "verdict"]);
    expect(JSON.stringify(card)).not.toContain("평균");
    expect(JSON.stringify(card)).not.toContain("최저");
  });

  it("판매처 이름은 등록된 주소에 적힌 글자에서 읽는다 — 별칭 표를 두지 않는다", () => {
    expect(sellerNameFromUrl(SMALLABLE_URL)).toBe("Smallable");
    expect(sellerNameFromUrl("https://bobochoses.com/products/x")).toBe("Bobochoses");
    // 열 수 없는 값에서는 이름을 지어내지 않는다.
    expect(sellerNameFromUrl("smallable.com/no-scheme")).toBeNull();
    expect(sellerNameFromUrl(null)).toBeNull();
    // 별칭 표가 없다는 것을 소스로 고정한다 — 표가 생기면 표에 없는 판매처가
    // 이름을 잃고, 그때 화면은 "이 가격이 어디 것인지"를 말하지 못한다.
    const source = stripComments(read("../same-product-sellers.ts"));
    expect(source).not.toContain("스몰러블");
    expect(source).not.toContain("smallable.com");
  });
});

/**
 * 이 카드가 지켜야 하는 단 하나의 규칙 — **⚪ 유사상품 가격은 여기에 못 온다.**
 *
 * 🟡 추정도 마찬가지다. 확정되지 않은 등급의 가격이 이 목록에 한 줄이라도 서면,
 * 셀러가 읽는 "같은 상품의 다른 판매처 가격"이 실제로는 다른 상품의 가격이 된다.
 */
describe("확정되지 않은 등급의 가격은 이 카드에 들어올 자리가 없다", () => {
  it("입력에 등급 칸이 없다 — 넘길 자리가 없으면 섞일 수도 없다", () => {
    const shape: SameProductSellersInput = input();
    expect(Object.keys(shape).sort()).toEqual(["origin", "sameProductListings"]);
    // 호출부가 넘길 수 있는 것은 EXACT 버킷 하나뿐이다(domesticMarketSplit.exact).
    // 🟡/⚪를 넣으려면 새 인자를 뚫어야 하고, 그때 이 테스트가 먼저 깨진다.
    const source = stripComments(read("../same-product-sellers.ts"));
    for (const forbidden of ["comparison", "SIMILAR", "TEXT_CONFIRMED", "matchTruth", "유사상품", "추정"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("호출부가 EXACT 버킷만 넘긴다", () => {
    // 패널이 이 카드를 만드는 그 한 줄. comparison 버킷을 읽는 경로가 없다.
    const panel = stripComments(read("../DomesticPriceIntelligencePanel.tsx"));
    expect(panel).toContain("sameProductListings: domesticMarketSplit.exact.sampleListings");
    expect(panel).not.toContain("sameProductListings: domesticMarketSplit.comparison");
  });
});

/**
 * 🌎 글로벌 시장 가격과 이 카드는 **다른 사실**이다.
 *
 *   🌎 글로벌 시장   한 판매처의 여러 나라   구성으로 동일(불변식)
 *   동일상품 판매처   여러 판매처의 같은 상품  판정으로 동일(matchTruth)
 *
 * 합쳐지는 순간 셀러는 "프랑스"가 판매처 이름인지 나라 이름인지부터 골라야 한다.
 */
describe("글로벌 시장 카드와 서로의 입력을 받지 않는다", () => {
  it("두 카드는 각자 자기 입력만 갖는다", () => {
    const source = stripComments(read("../same-product-sellers.ts"));
    for (const forbidden of ["marketCode", "observations", "GlobalMarketCard"]) {
      expect(source).not.toContain(forbidden);
    }
    expect(stripComments(read("../global-market.ts"))).not.toContain("sameProductListings");
  });

  it("원본 판매처의 금액은 ②의 🇰🇷 줄이 이미 완성한 문자열 그대로다", () => {
    // 사본이 아니라 같은 문자열이라, 한쪽만 고쳐지는 날이 올 수 없다.
    const observations: MarketObservationInput[] = [
      {
        marketCode: "en-kr",
        marketCountry: "ES",
        currency: "EUR",
        priceAmount: 73,
        priceKrw: 113629,
        soldOut: false,
        productUrl: `${SMALLABLE_URL}?market=kr`,
        checkedAt: "2026-09-13T02:00:00.000Z",
      },
    ];
    const row = pickJudgingMarketRow(buildGlobalMarketCard({ observations }))!;
    const card = buildSameProductSellersCard(input({ origin: { sourceUrl: SMALLABLE_URL, price: row.observedPrice } }));
    expect(card.rows[0]!.price).toBe(row.observedPrice);
    expect(card.rows[0]!.price).toBe("₩113,629");
  });
});

describe("비교할 상대가 없을 때", () => {
  it("원본 한 줄만 남으면 카드가 아니라 빈 상태다", () => {
    const card = buildSameProductSellersCard(input({ sameProductListings: [] }));
    expect(card.empty?.chip).toBe("⚪ 검색 데이터 없음");
  });

  it("관측이 없으면 다른 판매처의 가격을 옮겨 적지 않는다", () => {
    const card = buildSameProductSellersCard(input({ origin: { sourceUrl: SMALLABLE_URL, price: null } }));
    expect(card.rows[0]!.price).toBe("—");
    expect(card.rows[0]!.price).not.toContain("168,000");
  });

  it("이름을 읽을 수 없는 관측은 줄을 만들지 않는다", () => {
    const card = buildSameProductSellersCard(
      input({ sameProductListings: [{ mallName: null, priceKrw: 168000, productUrl: null }] }),
    );
    expect(card.rows.filter((r) => !r.isOrigin)).toHaveLength(0);
  });
});
