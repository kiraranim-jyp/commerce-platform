/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UX-CONSOLIDATION ⑥ — **「가격 계산 기준 보기」가 «실제로» 연다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 명시: 「기존 진입점과 도착지가 **존재한다는 사실만으로** 기능 완료 처리
 *    하지 않는다」. 🟢 그래서 이 파일은 사슬을 **네 토막으로 끊어서** 각각 문다:
 * ```
 * ① 진입점이 있다                market-price-calculation-link  (마운트 DOM)
 * ② 클릭이 핸들러를 부른다        onOpenPriceCalculation          (마운트 DOM)
 * ③ 핸들러가 요청 + 스크롤을 한다  handleOpenPriceCalculation      (소스 앵커)
 * ④ 요청이 오면 상세가 «실제 데이터로» 선다  PriceCalculationDetail (마운트 DOM)
 * ```
 * 🔴 ③ 이 소스 앵커인 이유 — 그 핸들러는 `CommerceWorkspace` 의 **클로저** 라
 *    따로 마운트할 수 없다. 🟢 대신 **세 동작을 글자로** 문다(끊기면 FAIL).
 *
 * 🔴 이 파일이 **하지 않는** 것 — 새 계산식 0 · A `resolveListingPrice` 변경 0 ·
 *    B `computePriceRecommendation` 혼입 0 · 적용 안 된 비용 노출 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { PriceCalculationDetail } from "../PriceCalculationDetail";
import { PRICE_CALCULATION_LINK_TEXT } from "../recommended-price-copy";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

const WS = readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8")
  .split(String.fromCharCode(13))
  .join("");

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

function host(): HTMLDivElement {
  const h = document.createElement("div");
  document.body.appendChild(h);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  return h;
}

describe("UXC-⑥ ① ② 진입점과 클릭", () => {
  it("E-1 🟢 「ⓘ 가격 계산 기준 보기」가 **실제로 렌더된다**", () => {
    const h = host();
    act(() => {
      createRoot(h).render(
        createElement(MarketPriceComparison, {
          rows: [ROW],
          recommendedPriceKrw: 99_000,
          onOpenPriceCalculation: () => {},
        } as never),
      );
    });
    const link = h.querySelector('[data-testid="market-price-calculation-link"]');
    expect(link, "🔴 상세 계산 진입점이 사라졌다").not.toBeNull();
    expect(link!.textContent).toBe(PRICE_CALCULATION_LINK_TEXT);
  });

  it("E-2 🔴 **클릭이 핸들러를 부른다** — 표시만 보고 PASS 하지 않는다", () => {
    const calls: number[] = [];
    const h = host();
    act(() => {
      createRoot(h).render(
        createElement(MarketPriceComparison, {
          rows: [ROW],
          recommendedPriceKrw: 99_000,
          onOpenPriceCalculation: () => calls.push(1),
        } as never),
      );
    });
    act(() => {
      h.querySelector('[data-testid="market-price-calculation-link"]')!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(calls.length, "🔴 눌러도 아무 일도 일어나지 않는다").toBe(1);
  });

  it("E-3 🔴 갈 곳이 없으면 **죽은 링크를 만들지 않는다**", () => {
    const h = host();
    act(() => {
      createRoot(h).render(
        createElement(MarketPriceComparison, { rows: [ROW], recommendedPriceKrw: 99_000 } as never),
      );
    });
    expect(h.querySelector('[data-testid="market-price-calculation-link"]')).toBeNull();
  });
});

describe("UXC-⑥ ③ 핸들러가 «세 동작» 을 한다 (소스 앵커)", () => {
  it("E-4 🔴🔴 요청 카운터 · 접힘 · 앵커 스크롤이 **하나도 빠지지 않는다**", () => {
    const i = WS.indexOf("function handleOpenPriceCalculation");
    expect(i, "🔴 핸들러가 사라졌다").toBeGreaterThan(0);
    const fn = WS.slice(i, WS.indexOf("\n  }\n", i) + 4);
    expect(fn, "🔴 탭 전환이 빠졌다").toContain('setTab("source")');
    expect(fn, "🔴 상세 요청이 빠졌다 — 영역이 열리지 않는다").toContain("setPriceDetailRequest");
    expect(fn, "🔴 도착지로 가는 스크롤이 빠졌다").toContain("PRICE_CALCULATION_ANCHOR_ID");
  });

  it("E-5 🔴 요청이 **없으면 그리지 않는다 · 있으면 그린다**(토글 = 접고 펼침)", () => {
    expect(WS, "🔴 상세가 요청과 무관하게 떠 있다(기본 화면이 무거워진다)").toContain(
      "{priceDetailRequest > 0 && (",
    );
    expect(WS, "🔴 도착지 앵커가 사라졌다").toContain("id={PRICE_CALCULATION_ANCHOR_ID}");
    expect(WS, "🔴 상세 노드가 그 자리에 없다").toContain("{priceCalculationDetail}");
  });

  it("E-6 🟢 상세는 **실제 데이터** 에 연결돼 있다 — 지어낸 값이 아니다", () => {
    const i = WS.indexOf("const priceCalculationDetail = (");
    const node = WS.slice(i, i + 420);
    for (const prop of ["product={product}", "exchangeRates={exchangeRates}", "priceRoundingUnit={priceRoundingUnit}"]) {
      expect(node, `🔴 상세가 실제 값과 끊겼다: ${prop}`).toContain(prop);
    }
    /** 🔴 **B 를 A 의 계산 기준에 섞지 않는다**(정책 경계). */
    expect(node, "🔴 시장가격 분석(B)을 가격 계산 기준에 섞었다").not.toContain(
      "computePriceRecommendation",
    );
  });
});

describe("UXC-⑥ ④ 상세가 «실제 값» 으로 선다 (마운트 DOM)", () => {
  it("E-7 🔴🔴 열면 **내용이 차 있다** — 빈 영역이 아니다", () => {
    const h = host();
    const product = {
      price: { value: { amount: 40, currency: "EUR" } },
      priceValidity: "VALID",
      priceBreakdown: { shippingKrw: 5_000, feePercent: 10, marginPercent: 30 },
      priceOverrideKrw: { value: 89_000 },
    } as never;
    act(() => {
      createRoot(h).render(
        createElement(PriceCalculationDetail, {
          product,
          onUpdatePriceBreakdown: () => {},
          exchangeRates: { rates: { EUR: 1480 }, fetchedAt: "2026-11-14T00:00:00.000Z", source: "frankfurter" },
          exchangeRatesLoading: false,
          onRefreshExchangeRates: () => {},
          priceRoundingUnit: 1_000,
        } as never),
      );
    });
    const text = h.textContent ?? "";
    expect(text.length, "🔴 상세를 열었는데 **비어 있다**").toBeGreaterThan(80);
    /** 🔴 적용된 요소가 **실제로 보인다** — 원가(통화)·환율·마진/수수료 축. */
    expect(text, "🔴 원가 통화가 사라졌다").toContain("EUR");
    expect(text, "🔴 환율 축이 사라졌다").toMatch(/환율|1,480|1480/);
    expect(text, "🔴 마진/수수료 축이 사라졌다").toMatch(/마진|수수료/);
    /** 🔴 **적용되지 않은 비용을 적용된 것처럼 적지 않는다**(관부가세는 §MI-COST-POLICY 에서 제거됐다). */
    expect(text, "🔴 제거된 비용 축이 되살아났다").not.toContain("관부가세");
  });
});
