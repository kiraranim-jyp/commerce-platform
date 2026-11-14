/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UXC-추천가 — **근거가 없으면 「확정 판매가격」으로 읽히게 두지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 캡처(2026-11-14) — 한 화면에 「권장 판매가격 ₩101,000」 · 「원가 정보 필요」 ·
 *    「가격 확인 필요」가 같이 있었다 ⟹ 셀러는 그 숫자를 **팔아도 되는 가격** 으로 읽는다.
 *
 * 🔴🔴 그런데 **숫자 자체는 틀리지 않았다**(운영 DB 실측 — EUR 45 · 배송 12,000 ·
 *    수수료 10% · 마진 12% · 반올림 1,000 → A `resolveListingPrice` 라이브 계산).
 *    🟢 그래서 **숨기지 않는다.** 보여주되 **무엇이 확인 안 됐는지** 를 같은 자리에서 말한다.
 *
 * 🔴 이 파일이 **하지 않는** 것 — A/B 계산 0 · MI 판단 0 · 가격 계산 기준 0 ·
 *    가격 수정 기능 0 · 새 판정 0. 보는 것은 **표시 조건과 문구** 뿐이다.
 */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { RECOMMENDED_PRICE_UNVERIFIED_NOTE, RECOMMENDED_PRICE_LABEL } from "../recommended-price-copy";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

const ROW = {
  domain: "sc.com",
  discoveredUrl: "https://sc.com/1",
  title: "T",
  imageUrl: null,
  soldOut: false,
  matchTruth: "EXACT_IDENTIFIER",
  crossSellerVerdict: "SAME",
  priceStatus: "VERIFIED_CURRENT",
  confidence: 0.9,
  matchReasons: [],
  crossSellerBlockers: [],
  crossSellerConflicts: [],
  market: "OVERSEAS",
  priceAmount: 37,
  priceCurrency: "GBP",
} as unknown as GeminiTransientRow;

function mount(extra: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    createRoot(host).render(
      createElement(MarketPriceComparison, {
        rows: [ROW],
        recommendedPriceKrw: 101_000,
        ...extra,
      } as never),
    );
  });
  return host;
}
const q = (h: HTMLElement, id: string) => h.querySelector(`[data-testid="${id}"]`);

describe("UXC-추천가 신뢰성", () => {
  it("H-1 🔴🔴 수익성을 말할 수 없으면 **같은 자리에서 그 사실을 말한다**", () => {
    const h = mount({ referenceProfitability: null });
    /** 🟢 숫자는 **그대로 보인다** — 숨기지 않는다(그 값은 A 의 올바른 계산이다). */
    expect(q(h, "market-recommended-price-amount")?.textContent ?? "", "🔴 추천가가 사라졌다").toContain(
      "101,000",
    );
    expect(q(h, "market-recommended-price-unverified"), "🔴 근거 없음을 말하지 않는다").not.toBeNull();
    expect(q(h, "market-recommended-price-unverified")?.textContent).toBe(
      RECOMMENDED_PRICE_UNVERIFIED_NOTE,
    );
  });

  it("H-2 🔴 그 문장은 **같은 블록 안** 에 선다 — 멀리 떨어뜨리지 않는다", () => {
    const h = mount({ referenceProfitability: null });
    const block = q(h, "market-next-step")!;
    expect(block.contains(q(h, "market-recommended-price")!), "🔴 추천가가 그 블록 밖이다").toBe(true);
    expect(
      block.contains(q(h, "market-recommended-price-unverified")!),
      "🔴 경고가 추천가와 다른 영역에 있다 — 셀러가 둘을 잇지 못한다",
    ).toBe(true);
  });

  it("H-3 🟢 수익성을 **말할 수 있으면** 그 줄을 만들지 않는다(잔소리 금지)", () => {
    const h = mount({ referenceProfitability: { marginPercent: 23 } });
    expect(q(h, "market-recommended-price-amount")?.textContent ?? "").toContain("101,000");
    expect(
      q(h, "market-recommended-price-unverified"),
      "🔴 근거가 있는데도 「확인되지 않았다」고 적었다",
    ).toBeNull();
  });

  it("H-4 🔴 **새 판정을 만들지 않았다** — 이미 계산된 값을 읽기만 한다", () => {
    /** 🔴 문구에 금액·마진·수익 «숫자» 가 들어가면 그 자리가 새 계산 owner 가 된다. */
    expect(RECOMMENDED_PRICE_UNVERIFIED_NOTE, "🔴 경고 문장이 숫자를 만든다").not.toMatch(/\d/);
    /** 🔴 B(시장 기반 추천) 어휘를 A 의 자리로 끌어오지 않는다. */
    for (const banned of ["시장 평균", "적정가", "권장 원가", "차액"]) {
      expect(RECOMMENDED_PRICE_UNVERIFIED_NOTE, `🔴 금지 어휘: ${banned}`).not.toContain(banned);
    }
  });

  it("H-5 🟢 추천가 **라벨과 금액 owner 는 그대로** 다(표시 조건만 바꿨다)", () => {
    const h = mount({ referenceProfitability: null });
    expect(q(h, "market-recommended-price")?.textContent ?? "").toContain(RECOMMENDED_PRICE_LABEL);
    /** 🔴 추천가 자체를 없애는 방향으로 「해결」하지 않았다. */
    expect(q(h, "market-recommended-price"), "🔴 추천가 블록이 사라졌다").not.toBeNull();
  });
});
