/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-RESULT-UX-REFINE-1 D(CPO 옵션 ⒝) — **판단은 남기고 설명을 지운다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 「＋ 상세정보 보기」 접힘 **안** 에 설명 UI 가 아니라 **판단 결과** 가 들어 있었다
 *    (`market-judgement` · `seller-decision` · `market-split` · `market-verdict`) ⟹
 *    접힘을 통째로 지우면 **판매 판단이 화면에서 사라진다**. 그래서 CPO 가 ⒝ 를 골랐다.
 *
 * 🔴🔴 **제거 단언만 쓰지 않는다 — 보존 단언을 «같이» 둔다.**
 *    「없다」만 적으면 다음 사람이 엔진까지 지운다(메모 그 함정).
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/** 🟢 판매중·가격 확인된 해외 SAME 3건 — 판단 블록이 **실제로 값을 갖는** 입력이다. */
const ROWS: GeminiTransientRow[] = ["scoutandcokids.com", "tinyapple.net", "thefrontshop.com"].map(
  (domain, i) => ({
    domain,
    discoveredUrl: `https://${domain}/products/hug-hairy-monster-${i}`,
    title: "Bobo Choses Hug Hairy Monster T-shirt",
    priceAmount: 37 + i,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    soldOut: false,
    matchTruth: "EXACT_IDENTIFIER",
    crossSellerVerdict: "SAME",
  }),
);

const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88_000, highestAmount: 88_000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
  unverifiedCount: 0,
  observedDifferenceCount: 0,
} as OverseasPriceSummary;

function mount(): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    createRoot(host).render(
      createElement(MarketPriceComparison, {
        rows: ROWS,
        domesticReference: KR_REF,
      } as never),
    );
  });
  return host;
}
const has = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) != null;

/** 🟢 CPO 가 **유지** 로 지정한 다섯. */
const KEEP = ["market-judgement", "seller-decision", "seller-decision-line", "market-split", "market-verdict"];
/** 🔴 CPO 가 **제거** 로 지정한 것(접힘 · 표 · 근거 · 설명). */
const REMOVE = [
  "price-detail-fold",
  "price-basis",
  "price-basis-line",
  "mi-detail-fold",
  "market-evidence-fold",
  "market-detail-blocks",
  "market-seller-table",
  "market-seller-row",
  "market-seller-price",
  "market-seller-sale",
  "market-seller-price-link",
  "market-price-range",
  "market-price-basis-a-note",
  "market-price-basis-b-note",
  "market-price-basis-line",
  "market-cost-hold",
  "market-cost-hold-line",
  "market-sale-counts",
  "market-unresolved",
  "mi-same-pending",
  "mi-same-pending-reasons",
];

describe("MSRUX-1D — 판단 보존 · 설명 제거", () => {
  it("D-1 🟢🟢 **보존** — 판매 판단 다섯이 셀러 화면에 그대로 선다", () => {
    const el = mount();
    for (const id of KEEP) {
      expect(has(el, id), `🔴 판단 블록이 사라졌다: ${id}`).toBe(true);
    }
  });

  it("D-2 🔴 **제거** — 접힘·표·근거·설명이 셀러 화면에 없다", () => {
    const el = mount();
    for (const id of REMOVE) {
      expect(has(el, id), `🔴 제거 대상이 화면에 남아 있다: ${id}`).toBe(false);
    }
  });

  it("D-3 🔴 **펼치기 UI 가 0 개** 다 — 접힘 자체가 사라졌다", () => {
    const el = mount();
    const folds = el.querySelectorAll("details");
    /**
     * 🔴 후보 목록(「후보 보기」)은 **이 WU 의 제거 대상이 아니다** — CPO 가 지정한 것은
     *    「상세정보 보기」·「가격 판단 기준」·「MI 상세 분석」 셋이다.
     * 🟢 그래서 **그 셋의 라벨이 없다** 를 단언한다(접힘 개수 0 이 아니라).
     */
    const text = el.textContent ?? "";
    for (const label of ["상세정보 보기", "가격 판단 기준", "MI 상세 분석"]) {
      expect(text, `🔴 제거 대상 접힘 라벨이 남아 있다: ${label}`).not.toContain(label);
    }
    for (const d of [...folds]) {
      expect(
        d.getAttribute("data-testid") ?? "",
        "🔴 제거 대상 접힘이 남아 있다",
      ).not.toMatch(/price-detail-fold|price-basis|mi-detail-fold|market-evidence-fold/);
    }
  });

  it("D-4 🔴🔴 **내부 계산은 살아 있다** — 판단 블록이 «값» 을 그린다(빈 껍데기가 아니다)", () => {
    const el = mount();
    const judge = el.querySelector('[data-testid="market-judgement"]')!;
    /** 🟢 결론 줄이 실제 문장을 들고 있다. */
    expect((judge.textContent ?? "").length, "🔴 판단 영역이 비었다").toBeGreaterThan(10);
    /** 🟢 `market-split` 은 집계값(국내/해외 판매중 수)을 그린다 — 계산이 돌았다는 증거. */
    const split = el.querySelector('[data-testid="market-split"]')?.textContent ?? "";
    expect(split, "🔴 판매중 분할이 숫자를 잃었다").toMatch(/\d+곳/);
    /** 🟢 가격 블록(B 에서 통일한 그 카드)은 **그대로** 다 — D 가 가격 축을 건드리지 않았다. */
    expect(has(el, "price-guide-overseas") || has(el, "overseas-reference"), "🔴 해외 가격 블록이 사라졌다").toBe(true);
    expect(el.textContent ?? "").toContain("반영 판매처 1곳");
  });
});
