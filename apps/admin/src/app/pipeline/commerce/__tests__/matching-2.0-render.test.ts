// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMarketCollectionsForTests } from "../market-collection";
import { GLOBAL_MARKET_HINT_LABEL } from "../global-market";
import { ORIGIN_PRODUCT_LINK_LABEL } from "../origin-product";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
import { SAME_PRODUCT_SELLERS_TITLE } from "../same-product-sellers";
import {
  overseasResults,
  productionData,
  productTabElement,
  regionsOf,
  visibleText,
  type TabOptions,
} from "./product-tab-composition";

/**
 * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — **화면까지 간다.**
 *
 * 앞의 테스트들이 고정하는 것은 값이다(판정이 저장되는가, 집계에 들어가는가).
 * 여기서 확인하는 것은 그 값이 **셀러 눈에 어떤 모양으로 서는가**다. 이 저장소가
 * 여러 번 겪은 사고가 정확히 그 사이에 있었다 — DB까지 도착한 값이 화면에서
 * 사라지거나(GLOBAL-MARKET ②③), 화면에 뜨긴 하는데 다른 사실처럼 읽혔다
 * (₩162,000 "착지원가 기준").
 */

const SMALLABLE_URL =
  "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701";

/** 실측 형태 그대로 — 시장은 KR, 관측 통화는 EUR, 저장된 환산은 KRW. 세 사실이
 * 서로 다른 칸에 그대로 남아 있는 행이다(마이그레이션 046). */
function krMarketInEuro(): TabOptions {
  const data = productionData();
  return {
    marketDone: false,
    data: {
      ...data,
      product: {
        title: "Bobo Choses Zipped Sweat Organic Cotton | Heather grey",
        brand: "Bobo Choses",
        sourceUrl: SMALLABLE_URL,
      },
      sellerGlobalMarkets: [
        {
          marketCode: "en-kr",
          marketCountry: "ES",
          currency: "EUR",
          priceAmount: 73,
          priceKrw: 113629,
          soldOut: false,
          productUrl: "https://www.smallable.com/en-kr/product/bobo-choses-zipped-sweat-430701",
          checkedAt: "2026-09-13T02:00:00.000Z",
        },
      ],
    },
  };
}

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **두 판매처의 가격이 한
 * 화면에 있다.**
 *
 * 실측 그대로다: Smallable이 한국에 €73(₩113,629)로 팔고, 같은 상품
 * (B226AC114)을 Bobo Choses 공식몰이 ₩168,000에 판다. 이 쌍이 이번 작업의
 * 결승선이고, 여기까지 와야 "찾았다"가 "연결됐다"가 된다.
 *
 * 국내 관측은 **EXACT 버킷에만** 넣는다 — 서버가 priceTierFromLink로 이미
 * 나눈 그 버킷이고, 🟡/⚪ 관측은 다른 버킷에 있어서 이 카드에 닿을 수 없다.
 */
function boboConnectedAsSameProduct(): TabOptions {
  const base = krMarketInEuro();
  const data = base.data!;
  const empty = data.domesticMarketSplit.exact;
  return {
    ...base,
    data: {
      ...data,
      domesticMarketSplit: {
        ...data.domesticMarketSplit,
        basis: "EXACT",
        exact: {
          ...empty,
          tier: "PRIMARY",
          lowestPriceKrw: 168000,
          highestPriceKrw: 168000,
          averagePriceKrw: 168000,
          sellerCount: 1,
          stockCounts: { onSale: 1, unknown: 0, soldOut: 0 },
          priceMarketCode: "kr",
          priceMarketBasis: "SINGLE",
          checkedAt: "2026-09-13T02:00:00.000Z",
          sampleListings: [
            {
              mallName: "Bobo Choses 공식몰",
              priceKrw: 168000,
              productUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
              checkedAt: "2026-09-13T02:00:00.000Z",
              salePriceKrw: null,
              originalPriceKrw: null,
            },
          ],
        },
      },
    },
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  resetMarketCollectionsForTests();
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) =>
      String(input).includes("/api/exchange-rates")
        ? Promise.resolve({ ok: true, json: () => Promise.resolve({ rates: { EUR: 1556.56 }, source: "frankfurter" }) })
        : Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                results: overseasResults(),
                sourceVerification: { status: "NOT_APPLICABLE", price: null, regularPrice: null },
              }),
          }),
    ),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function mount(options: TabOptions): Promise<void> {
  await act(async () => {
    root.render(productTabElement(options));
  });
}

function page(): HTMLElement {
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) throw new Error("화면이 비어 있다");
  return el;
}

function clickText(label: string): void {
  const button = Array.from(page().querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label));
  if (!button) throw new Error(`"${label}" 버튼이 화면에 없다`);
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("원본 상품이 화면 맨 위에서 자기 이름과 주소를 말한다", () => {
  it("상품명과 원본 URL이 ① 원본 상품 블록 안에 선다", async () => {
    await mount(krMarketInEuro());
    const mi = regionsOf(page().outerHTML).mi;
    const text = visibleText(mi);

    expect(text).toContain(PRICE_SECTION_TITLE.ORIGINAL);
    expect(text).toContain("Bobo Choses Zipped Sweat Organic Cotton | Heather grey");
    expect(text).toContain(ORIGIN_PRODUCT_LINK_LABEL);
    // 눈에 보이는 주소는 접혀 있지만, 어느 판매처의 어느 상품인지는 그대로 읽힌다.
    expect(text).toContain("smallable.com");
    expect(text).toContain("430701");
  });

  it("링크는 판매자가 등록한 주소 그대로이고 새 탭에서 열린다", async () => {
    await mount(krMarketInEuro());
    const anchor = Array.from(page().querySelectorAll("a")).find((a) =>
      (a.textContent ?? "").includes(ORIGIN_PRODUCT_LINK_LABEL),
    );
    expect(anchor).toBeDefined();
    expect(anchor!.getAttribute("href")).toBe(SMALLABLE_URL);
    expect(anchor!.getAttribute("target")).toBe("_blank");
    // 다른 판매처 주소로 바뀌지 않는다 — 화면에 있는 원본 링크는 이 하나뿐이다.
    expect(anchor!.getAttribute("href")).not.toContain("bobochoses.com");
  });
});

describe("한국 시장 줄의 대표 숫자는 원화다", () => {
  it("① 원본 상품의 한국 표시가 줄이 ₩113,629로 선다 — €73.00이 큰 숫자 자리에 오지 않는다", async () => {
    await mount(krMarketInEuro());
    const text = visibleText(regionsOf(page().outerHTML).mi);

    expect(text).toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
    expect(text).toContain("₩113,629");
    // 오늘 화면의 문제였던 조합("… 한국 표시가 €73.00")이 더 이상 만들어지지 않는다.
    expect(text).not.toContain(`${PRICE_MEANING_LABEL.KR_MARKET_PRICE} €73.00`);
  });

  it("글로벌 시장 가격을 펼치면 원화가 앞, 원 표시가가 괄호로 뒤에 남는다", async () => {
    await mount(krMarketInEuro());
    clickText(GLOBAL_MARKET_HINT_LABEL);
    const text = visibleText(regionsOf(page().outerHTML).mi);

    expect(text).toContain("₩113,629");
    // 관측된 외화는 지워지지 않는다 — 지우면 "관측인가 환산인가"를 화면이 못 말한다.
    expect(text).toContain("(원 표시가 €73.00)");
    // MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — 오늘 화면에서 지우는 것 둘.
    // 범위는 이 카드다: ① 원본 상품의 "약 ₩77,828 · 원화 환산"은 다른 사실
    // (원본 통화 → 원화 환산)이고 이 지시가 지목한 줄이 아니다.
    const card = text.slice(text.indexOf(GLOBAL_MARKET_HINT_LABEL), text.indexOf("🇰🇷 국내 시장"));
    expect(card).not.toContain("원화 환산");
    expect(card).not.toContain("🟢 동일 상품 · 판매자 직접 관측");
    expect(card).not.toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
  });

  /**
   * MI-MATCHING-INTEGRATION-2 — 줄마다 반복되던 배지가 카드에 한 번 선다.
   *
   * 지우는 것은 배지이지 사실이 아니다. 이 카드의 줄들이 같은 상품이라는 것은
   * 매칭이 판정한 결과가 아니라 구성으로 참인 불변식이고(같은 페이지, 시장
   * 코드만 바꿈), 그 사실이 화면에서 사라지면 이 카드가 왜 따로 있는지도
   * 사라진다.
   */
  it("동일 상품이라는 사실은 카드에 한 번만 적힌다", async () => {
    await mount(krMarketInEuro());
    clickText(GLOBAL_MARKET_HINT_LABEL);
    const text = visibleText(regionsOf(page().outerHTML).mi);

    const invariant = "시장 코드만 바꿔 관측한 값입니다";
    expect(text).toContain(invariant);
    expect(text.split(invariant)).toHaveLength(2);
  });
});

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **결승선.**
 *
 *   동일상품 판매처
 *   Smallable     ₩113,629
 *   Bobo Choses   ₩168,000
 *   🟢 동일상품
 *
 * "Bobo를 찾았다"와 "MI가 Bobo 가격을 연결했다"는 다른 말이다. 앞엣것은 검색이
 * 한 일이고, 뒤엣것은 이 화면이 한 일이다 — 그 사이에 저장(링크/관측)과 집계가
 * 있고, 그 어느 한 칸이 비어도 셀러 눈에는 아무 일도 일어나지 않은 것과 같다.
 */
describe("두 판매처의 같은 상품 가격이 한 화면에 선다", () => {
  it("Smallable ₩113,629과 Bobo ₩168,000이 같은 카드에 나란히 온다", async () => {
    await mount(boboConnectedAsSameProduct());
    const text = visibleText(regionsOf(page().outerHTML).mi);

    expect(text).toContain(SAME_PRODUCT_SELLERS_TITLE);
    expect(text).toContain("Smallable");
    expect(text).toContain("₩113,629");
    expect(text).toContain("Bobo Choses 공식몰");
    expect(text).toContain("₩168,000");
    // 등급은 카드에 한 번 붙는다 — 줄마다 붙이면 방금 글로벌 카드에서 고친
    // 그 문제(달라지지 않는 사실을 줄 수만큼 반복)를 그대로 반복하게 된다.
    expect(text).toContain("🟢 동일상품");
  });

  it("Bobo 가격 줄은 Bobo 상품 페이지로 열린다 — 원본 줄은 여전히 Smallable이다", async () => {
    await mount(boboConnectedAsSameProduct());
    const anchors = Array.from(page().querySelectorAll("a"));
    expect(anchors.some((a) => (a.getAttribute("href") ?? "").includes("b226ac114"))).toBe(true);
    // 원본 상품 링크는 매칭 결과로 대체되지 않는다.
    const origin = anchors.find((a) => (a.textContent ?? "").includes(ORIGIN_PRODUCT_LINK_LABEL));
    expect(origin!.getAttribute("href")).toBe(SMALLABLE_URL);
  });

  it("비교할 다른 판매처가 없으면 이 카드는 아예 그려지지 않는다", async () => {
    // 원본 한 줄만 있는 상태는 비교가 아니라 관측 하나이고, 그 관측은 ① 원본
    // 상품이 이미 말하고 있다. 빈 칸 하나짜리 카드는 정보가 아니라 질문이다.
    await mount(krMarketInEuro());
    expect(visibleText(regionsOf(page().outerHTML).mi)).not.toContain(SAME_PRODUCT_SELLERS_TITLE);
  });

  /**
   * CPO 지시(2026-09-13) — 화면 순서:
   *   원본 URL → 글로벌 시장 가격 → 동일상품 판매처 → 관련상품
   *
   * 배치 규칙은 순수 함수로 표현할 수 없고, 깨지는 방식은 늘 같다: 누군가
   * 블록 하나를 "여기가 더 잘 보이니까" 위로 올린다. 그래서 렌더된 화면의
   * 글자 순서로 못박는다.
   */
  it("읽는 순서가 화면 순서다 — 원본 → 글로벌 → 동일상품 판매처 → 관련상품", async () => {
    await mount(boboConnectedAsSameProduct());
    const text = visibleText(regionsOf(page().outerHTML).mi);
    const at = (needle: string) => {
      const i = text.indexOf(needle);
      expect(i, `"${needle}"이 화면에 없다`).toBeGreaterThanOrEqual(0);
      return i;
    };
    expect(at(ORIGIN_PRODUCT_LINK_LABEL)).toBeLessThan(at(GLOBAL_MARKET_HINT_LABEL));
    expect(at(GLOBAL_MARKET_HINT_LABEL)).toBeLessThan(at(SAME_PRODUCT_SELLERS_TITLE));
    expect(at(SAME_PRODUCT_SELLERS_TITLE)).toBeLessThan(at(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION));
  });
});
