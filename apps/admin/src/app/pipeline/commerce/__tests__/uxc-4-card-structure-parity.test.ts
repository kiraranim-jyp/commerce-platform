/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UX-CONSOLIDATION ④ — **후보 카드 «내부» 구조가 국내·해외 같다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 명시: 「외곽선만 같게 만드는 것으로는 안 된다 — **카드 내부의 정보
 *    순서와 구조까지** 같아야 한다」. 🟢 그래서 이 파일은 셸이 아니라
 *    **testid 시퀀스(= 정보 위계와 순서)를 통째로 비교** 한다.
 *
 * 🔴 데이터 의미와 통화는 **다르게 유지** 한다(지시서) — 그래서 「원화 환산」은
 *    🌎 에만 선다(🇰🇷 는 이미 KRW 라 환산이 거짓이 된다). 그 **한 칸의 차이**를
 *    이 파일이 **명시적으로** 잠근다(모르는 채 벌어지는 것과 다르다).
 *
 * 🔴 이 파일이 **하지 않는** 것 — 후보 수·등급·필터·정렬·판정 **변경 0**.
 */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { CANDIDATE_PRICE_UNKNOWN } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/** 🟢 **같은 모양** 의 두 후보 — 시장과 통화만 다르다(그래야 구조 차이만 드러난다). */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "shop.example",
    discoveredUrl: "https://shop.example/p/1",
    title: "Bobo Choses Hug Hairy Monster T-shirt",
    imageUrl: "https://img.example/a.jpg",
    soldOut: false,
    matchTruth: "EXACT_IDENTIFIER",
    crossSellerVerdict: "SAME",
    priceStatus: "VERIFIED_CURRENT",
    confidence: 0.9,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    ...over,
  }) as GeminiTransientRow;

const KR = row({
  domain: "biskuit.kr",
  discoveredUrl: "https://biskuit.kr/p/1",
  market: "KR",
  priceAmount: 88_000,
  priceCurrency: "KRW",
});
const OS = row({
  domain: "scoutandcokids.com",
  discoveredUrl: "https://scoutandcokids.com/p/1",
  market: "OVERSEAS",
  priceAmount: 37,
  priceCurrency: "GBP",
});

/** 🟢 CEO 캡처 그대로 — 국내 후보는 있는데 **가격이 없다**(추정 등급). */
const KR_NO_PRICE = row({
  domain: "beaumonde.co.kr",
  discoveredUrl: "https://beaumonde.co.kr/p/1",
  market: "KR",
  priceAmount: null,
  priceCurrency: null,
  priceStatus: null,
  matchTruth: "TEXT_CONFIRMED",
  crossSellerVerdict: "PRESUMED_SAME",
});

const KR_REF = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88_000, highestAmount: 88_000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
  unverifiedCount: 0,
  observedDifferenceCount: 0,
} as unknown;

function mount(rows: GeminiTransientRow[], domesticReference: unknown = null): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    createRoot(host).render(createElement(MarketPriceComparison, { rows, domesticReference } as never));
  });
  return host;
}

/** 🔴 **구조를 문자열로 뽑는다** — testid 의 «순서» 가 곧 정보 위계다. */
const shapeOf = (card: Element) =>
  [...card.querySelectorAll("[data-testid]")].map((n) => n.getAttribute("data-testid"));

const cardIn = (host: HTMLElement, col: "domestic" | "overseas") => {
  const column = host.querySelector(`[data-testid="mi-same-${col}"]`);
  expect(column, `🔴 ${col} 열이 서지 않았다 — 표본이 분기를 안 탔다`).toBeTruthy();
  const card = column!.querySelector('[data-testid="mi-candidate-row"]');
  expect(card, `🔴 ${col} 후보 카드가 없다`).toBeTruthy();
  return card!;
};

describe("UXC-④ 후보 카드 내부 구조 통일", () => {
  it("D-1 🔴🔴 두 시장 카드의 **정보 순서가 같다**(통화 칸 하나만 다르다)", () => {
    const host = mount([KR, OS]);
    const kr = shapeOf(cardIn(host, "domestic"));
    const os = shapeOf(cardIn(host, "overseas"));
    /**
     * 🔴 🌎 에만 있는 칸은 **원화 환산** 하나다 — 그것이 데이터 의미의 차이이고
     *    지시서가 유지하라고 한 것이다. 🟢 그 하나를 걷어내면 **완전히 같아야** 한다.
     */
    const osCore = os.filter((t) => !String(t).startsWith("mi-candidate-price-krw"));
    expect(osCore, "🔴 카드 내부 정보 순서가 국내·해외에서 갈렸다").toEqual(kr);
  });

  it("D-2 🟢 **같은 컴포넌트가 그린다** — 칸마다 두 벌이 아니다", () => {
    const host = mount([KR, OS]);
    for (const id of [
      "mi-candidate-image",
      "mi-candidate-group",
      "mi-candidate-price",
      "mi-candidate-title",
      "mi-candidate-seller",
    ]) {
      const kr = cardIn(host, "domestic").querySelector(`[data-testid="${id}"]`);
      const os = cardIn(host, "overseas").querySelector(`[data-testid="${id}"]`);
      expect(kr, `🔴 국내 카드에 ${id} 가 없다`).toBeTruthy();
      expect(os, `🔴 해외 카드에 ${id} 가 없다`).toBeTruthy();
      /** 🔴 **클래스까지 같다** — 한쪽만 작은 글씨/다른 여백이면 위계가 갈린다. */
      expect((os as HTMLElement).className, `🔴 ${id} 의 위계가 갈렸다`).toBe(
        (kr as HTMLElement).className,
      );
    }
  });

  it("D-3 🔴 카드 **셸(외곽선·여백)** 도 같다", () => {
    const host = mount([KR, OS]);
    expect((cardIn(host, "overseas") as HTMLElement).className, "🔴 카드 셸이 갈렸다").toBe(
      (cardIn(host, "domestic") as HTMLElement).className,
    );
  });

  it("D-4 🔴 **통화 차이는 «유지» 한다** — 🇰🇷 에 거짓 환산을 붙이지 않는다", () => {
    const host = mount([KR, OS]);
    expect(
      cardIn(host, "domestic").querySelector('[data-testid="mi-candidate-price-krw"]'),
      "🔴 이미 KRW 인 국내 가격에 원화 환산을 또 붙였다(거짓 숫자)",
    ).toBeNull();
    expect(
      cardIn(host, "overseas").querySelector(
        '[data-testid="mi-candidate-price-krw"], [data-testid="mi-candidate-price-krw-unavailable"]',
      ),
      "🔴 해외 카드에서 원화 환산 칸이 사라졌다",
    ).not.toBeNull();
  });

  it("D-6 🔴🔴 가격이 **없는 시장에도 금액 슬롯이 선다**(한쪽만 비지 않는다)", () => {
    /** 🟢 🇰🇷 는 가격 없음 · 🌎 는 가격 있음 — CEO 캡처의 그 상태다. */
    const host = mount([KR_NO_PRICE, OS]);
    const slot = (m: string) =>
      host.querySelector(`[data-testid="market-block-${m}"]`)!.querySelector(
        `[data-testid="price-guide-headline"], [data-testid="market-price-unconfirmed-${m}"]`,
      ) as HTMLElement | null;
    const kr = slot("domestic");
    const os = slot("overseas");
    expect(kr, "🔴 가격 없는 시장의 금액 줄이 통째로 사라졌다").not.toBeNull();
    expect(os, "🔴 가격 있는 시장의 금액 줄이 사라졌다").not.toBeNull();
    /** 🔴 **위계까지 같다** — 한쪽만 작은 보조 글씨면 템플릿이 갈린 것이다. */
    expect(kr!.className, "🔴 금액 슬롯의 위계가 갈렸다").toBe(os!.className.replace("text-text-primary", "text-text-tertiary"));
    /** 🔴 **금액을 지어내지 않는다** — 그 자리는 사실 한 문장이다. */
    expect(kr!.textContent ?? "").toBe(CANDIDATE_PRICE_UNKNOWN);
    expect(kr!.textContent ?? "", "🔴 없는 금액을 적었다").not.toMatch(/\d/);
  });

  /**
   * 🔴🔴 **1차 D-7 은 그 분기를 타지 않았다** — `[KR, OS]` 는 둘 다 SAME 이라
   *    `sameCount > 0` 쪽으로 가는데, 새 줄은 `sameCount === 0` 분기 «안» 에 있다.
   *    그래서 「가격이 있어도 그린다」 변이가 **통과했다**(내 계약의 구멍).
   * 🟢 그래서 **같은 분기 안에서** 가격이 있는 경우를 만든다 — 확정 0건인데
   *    참고가격은 있는 🇰🇷(= CEO 캡처의 또 다른 상태). 그때는 금액이 이미 서므로
   *    「확인 필요」를 **또** 적으면 안 된다.
   */
  it("D-7 🟢 **같은 분기 안에서** 금액이 이미 있으면 그 줄을 만들지 않는다(중복 금지)", () => {
    const host = mount([KR_NO_PRICE, OS], KR_REF);
    /** 🟢 전제 확인 — 확정 0건 분기이고 금액(참고가격)이 서 있다. */
    expect(
      host.querySelector('[data-testid="market-same-count-domestic"]')?.textContent ?? "",
    ).toContain("0건");
    expect(host.querySelector('[data-testid="domestic-lowest"]'), "🔴 참고가격이 안 섰다").not.toBeNull();
    expect(
      host.querySelector('[data-testid="market-price-unconfirmed-domestic"]'),
      "🔴 금액이 있는데 「가격 확인 필요」를 같이 적었다 — 한 자리에 두 문장",
    ).toBeNull();
  });

  it("D-5 🟢 후보 수·등급·정렬에 **부작용 0** — 양쪽 1건씩 그대로다", () => {
    const host = mount([KR, OS]);
    expect(
      host.querySelectorAll('[data-testid="mi-same-domestic"] [data-testid="mi-candidate-row"]').length,
    ).toBe(1);
    expect(
      host.querySelectorAll('[data-testid="mi-same-overseas"] [data-testid="mi-candidate-row"]').length,
    ).toBe(1);
    expect(cardIn(host, "domestic").getAttribute("data-group")).toBe(
      cardIn(host, "overseas").getAttribute("data-group"),
    );
  });
});
