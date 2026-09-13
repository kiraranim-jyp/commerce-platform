// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMarketCollectionsForTests } from "../market-collection";
import { GLOBAL_MARKET_HINT_LABEL } from "../global-market";
import { ORIGIN_PRODUCT_LINK_LABEL } from "../origin-product";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE } from "../price-hierarchy";
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

  it("글로벌 시장 가격을 펼치면 원화가 앞, 원 표시가가 뒤다", async () => {
    await mount(krMarketInEuro());
    clickText(GLOBAL_MARKET_HINT_LABEL);
    const text = visibleText(regionsOf(page().outerHTML).mi);

    expect(text).toContain("🟢 동일 상품 · 판매자 직접 관측");
    expect(text).toContain("₩113,629");
    // 관측된 외화는 지워지지 않는다 — 지우면 "관측인가 환산인가"를 화면이 못 말한다.
    expect(text).toContain("원 표시가 €73.00");
    // "원화 환산 ₩113,629"은 없다(같은 숫자를 두 번 쓰지 않는다).
    expect(text).not.toContain("원화 환산 ₩113,629");
  });
});
