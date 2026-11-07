/** @vitest-environment jsdom */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GlobalMarketCardView } from "../DomesticPriceIntelligencePanel";
import { buildGlobalMarketCard, type MarketObservationInput } from "../global-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 통화 기준 문구 — **마운트 DOM 으로만 완료 선언한다**(헌장 §5)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **Render PASS ≠ 소스 PASS.** 순수 축(`global-market-currency-note.test.ts`)은
 *    문자열이 **만들어지는가** 를 보고, 이 파일은 그것이 **화면에 서는가 · 어디에
 *    서는가** 를 본다. 둘 중 하나만 있으면 배선이 끊겨도 통과한다(WU-110 교훈).
 * 🔴 `.test.ts` 다 — vitest `include` 가 `*.test.tsx` 를 **수집하지 않는다**(실측).
 *    그래서 JSX 없이 `createElement` 로 마운트한다(기존 마운트 DOM 계약과 같은 방식).
 * 🔴 **「Production UI PASS」로 쓰지 않는다** — 실제 따져 화면은 CTO 가 볼 수 없다.
 *    `GlobalMarketCardView` 는 `GlobalMarketHint` 의 **팝오버 안** 에 서고, 그 한 홉은
 *    같은 파일 안의 단일 호출부다.
 */

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const obs = (marketCode: string, currency: string, priceAmount: number | null): MarketObservationInput => ({
  marketCode,
  currency,
  priceAmount,
  priceKrw: 70000,
});

/** 🟢 운영 DB 실측 모양(2026-11-07) — 손으로 꾸미지 않는다. */
const SINGLE_CURRENCY = [obs("fr", "EUR", 49), obs("kr", "EUR", 49), obs("us", "EUR", 53), obs("jp", "EUR", 54)];
const MULTI_CURRENCY = [obs("en-jp", "JPY", 10078), obs("en-us", "USD", 63), obs("en-de", "EUR", 54)];

function mount(observations: MarketObservationInput[]) {
  const card = buildGlobalMarketCard({ observations });
  act(() => root.render(createElement(GlobalMarketCardView, { card })));
  return card;
}

const noteEl = () => container.querySelector('[data-testid="global-market-currency-note"]');

describe("D. 마운트 DOM — 문구가 실제로 서는가", () => {
  it("D-1 🔴 단일 통화 + 지역 2개 이상이면 문구가 **보인다**", () => {
    mount(SINGLE_CURRENCY);
    const el = noteEl();
    expect(el).not.toBeNull();
    // 🔴 `textContent` 로 본다 — title/aria 속성에 숨어 있으면 셀러는 읽지 못한다.
    expect(el!.textContent).toContain("가격 기준 통화 EUR");
    expect(el!.textContent).toContain("배송국가를 지정해 조회한 가격입니다(현지통화 가격이 아닙니다)");
  });

  it("D-2 🔴🔴 통화가 여러 종이면 문구가 **서지 않는다** — 거짓을 말하지 않는다", () => {
    mount(MULTI_CURRENCY);
    expect(noteEl()).toBeNull();
    // 🟢 그래도 줄은 전부 선다(문구가 없다고 데이터가 사라지지 않는다).
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("D-3 🔴 문구가 **줄 목록보다 앞** 에 선다 — 금액을 먼저 읽고 나중에 설명하면 늦다", () => {
    mount(SINGLE_CURRENCY);
    const note = noteEl()!;
    const list = container.querySelector("ul")!;
    // 🟢 DOM 순서로 단언한다(CSS 가 아니라 읽는 순서다).
    expect(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("D-4 🟢 줄의 금액이 한 글자도 바뀌지 않는다 — 문구는 «더한» 것이다", () => {
    mount(SINGLE_CURRENCY);
    const amounts = [...container.querySelectorAll("li")].map(
      (li) => li.querySelector("span.font-semibold")?.textContent ?? "",
    );
    expect(amounts).toEqual(["€49.00", "€49.00", "€53.00", "€54.00"]);
  });

  it("D-5 🔴 관측이 없으면 문구도 줄도 없다 — 빈 카드에 설명만 세우지 않는다", () => {
    mount([]);
    expect(noteEl()).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("D-6 🔴 문구에 배송 가능·환산 어휘가 **DOM 에서도** 0 이다", () => {
    mount(SINGLE_CURRENCY);
    const text = noteEl()!.textContent ?? "";
    for (const banned of ["배송 가능", "배송가능", "배송국가별", "환율", "환산", "₩", "≈"]) {
      expect(text).not.toContain(banned);
    }
  });
});
