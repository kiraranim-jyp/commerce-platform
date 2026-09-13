import { describe, expect, it } from "vitest";
import { buildOriginProductLink, shortenUrlForDisplay } from "../origin-product";
import { buildGlobalMarketCard, type MarketObservationInput } from "../global-market";
import { PRICE_SECTION_TITLE } from "../price-hierarchy";
import { readSourceAt, stripComments } from "./source-text";

function read(relativeToThisFile: string): string {
  return readSourceAt(new URL(relativeToThisFile, import.meta.url));
}

/**
 * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — 고정하려는 실제 화면.
 *
 *   원본 상품
 *   Bobo Choses Bolder Half-Zipped Sweatshirt
 *   🔗 원본 상품 보기   https://www.smallable.com/en/product/…
 *
 * MI는 여러 판매처의 가격을 나란히 세우는 화면이다. 기준이 되는 상품이 화면에
 * 적혀 있지 않으면 목록의 어느 줄이 원본인지도, 지금 보는 판정이 어느 상품의
 * 것인지도 셀러가 확인할 방법이 없다.
 */
const SMALLABLE_URL =
  "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701";

describe("원본 상품은 이름과 주소로 먼저 말한다", () => {
  const link = buildOriginProductLink({ title: "Bobo Choses Zipped Sweat Organic Cotton | Heather grey", sourceUrl: SMALLABLE_URL });

  it("제목은 ① 원본 상품과 같은 말을 쓴다 — 같은 사실에 이름이 둘이 되지 않는다", () => {
    expect(link.title).toBe(PRICE_SECTION_TITLE.ORIGINAL);
  });

  it("여는 주소는 판매자가 등록한 값 그대로다(자르지 않는다)", () => {
    expect(link.url).toBe(SMALLABLE_URL);
  });

  it("눈에 보이는 주소만 접는다 — 앞(판매처)과 뒤(상품 번호)를 둘 다 남긴다", () => {
    expect(link.displayUrl).toContain("smallable.com");
    expect(link.displayUrl).toContain("430701");
    expect(link.displayUrl).toContain("…");
    expect(link.displayUrl!.length).toBeLessThan(SMALLABLE_URL.length);
  });

  it("짧은 주소는 접지 않는다", () => {
    expect(shortenUrlForDisplay("https://bobochoses.com/products/b226ac114")).toBe("bobochoses.com/products/b226ac114");
  });

  it("열 수 없는 값은 링크로 만들지 않는다 — 못 여는 주소를 '보기'라고 부르지 않는다", () => {
    const broken = buildOriginProductLink({ title: "x", sourceUrl: "smallable.com/no-scheme" });
    expect(broken.url).toBeNull();
    expect(broken.displayUrl).toBeNull();
    expect(broken.productTitle).toBe("x");
  });

  it("아무것도 없으면 지어내지 않는다", () => {
    const empty = buildOriginProductLink({});
    expect(empty.productTitle).toBeNull();
    expect(empty.url).toBeNull();
  });
});

/**
 * 이 줄이 지켜야 하는 단 하나의 규칙 — **다른 판매처 URL로 바뀌지 않는다.**
 * 매칭으로 찾아낸 동일상품(🟢)의 주소가 아무리 확실해도 이 자리에 오면 안 된다.
 * 그 순간 "원본"이 "우리가 원본이라고 판단한 것"이 되고, 셀러가 붙여넣은 주소와
 * 화면의 주소가 다른 이유를 물을 수 없게 된다.
 */
describe("원본 주소는 매칭 결과로 대체될 수 없다", () => {
  it("이 함수는 후보 목록을 인자로 받을 수 없다 — 넘길 자리가 없으면 바뀔 수도 없다", () => {
    const input: Parameters<typeof buildOriginProductLink>[0] = { title: "x", sourceUrl: SMALLABLE_URL };
    expect(Object.keys(input).sort()).toEqual(["sourceUrl", "title"]);
    // 소스에 매칭/후보/시장 관측을 읽는 코드가 아예 없다.
    const source = stripComments(read("../origin-product.ts"));
    for (const forbidden of ["matchTruth", "crossSeller", "candidates", "observations", "globalMarket"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("동일상품으로 확인된 판매처 주소가 있어도 원본 줄은 원본을 가리킨다", () => {
    // 같은 화면에 Bobo 공식몰 관측이 함께 있는 상황을 그대로 만든다.
    const observations: MarketObservationInput[] = [
      {
        marketCode: "en-kr",
        marketCountry: "ES",
        currency: "KRW",
        priceAmount: 168000,
        priceKrw: 168000,
        soldOut: false,
        productUrl: "https://bobochoses.com/en-kr/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
        checkedAt: "2026-09-13T02:00:00.000Z",
      },
    ];
    const card = buildGlobalMarketCard({ observations });
    const link = buildOriginProductLink({ title: "Bobo Choses Zipped Sweat Organic Cotton | Heather grey", sourceUrl: SMALLABLE_URL });

    expect(card.rows[0]!.productUrl).toContain("bobochoses.com");
    expect(link.url).toBe(SMALLABLE_URL);
    expect(link.url).not.toContain("bobochoses.com");
  });
});
