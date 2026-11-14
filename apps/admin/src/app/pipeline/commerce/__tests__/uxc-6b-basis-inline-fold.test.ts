/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UXC-⑥ UX — **가격 계산 기준이 «편집 영역 안에서» 펼쳐진다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 지시(2026-11-14) — 판매가를 고치다가 「가격 계산 기준 보기 →」를 누르면
 *    **위쪽 가격 분석 카드로 이동** 해서 편집 위치에서 이탈했다. **그러면 FAIL 이다.**
 *
 * 🔴 이 파일이 **하지 않는** 것 — 새 계산식 0 · A `resolveListingPrice` 변경 0 ·
 *    B `computePriceRecommendation` 혼입 0 · 상세 내용 요약 대체 0.
 */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PriceEditor } from "../PriceEditor";

const PRODUCT = {
  price: { value: { amount: 40, currency: "EUR" } },
  priceValidity: "VALID",
  priceBreakdown: { shippingKrw: 5_000, feePercent: 10, marginPercent: 30 },
  priceOverrideKrw: { value: 89_000 },
} as never;

const DETAIL = createElement("div", { "data-testid": "zz-detail" }, "원가 · 환율 · 마진 상세");

function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(PriceEditor, {
        product: PRODUCT,
        recommendedPriceKrw: 99_000,
        onUpdateSalePriceKrw: () => {},
        ...props,
      } as never),
    );
  });
  return host;
}
const q = (h: HTMLElement, id: string) => h.querySelector(`[data-testid="${id}"]`);
const click = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

describe("UXC-⑥ UX — 제자리 펼침", () => {
  it("F-1 🔴🔴 누르면 **그 자리에서** 상세가 펼쳐진다(기본은 접힘)", () => {
    const h = mount({ priceCalculationDetail: DETAIL });
    expect(q(h, "price-editor-basis-detail"), "🔴 기본 화면부터 펼쳐져 있다").toBeNull();
    const btn = q(h, "price-editor-basis-toggle")!;
    expect(btn.textContent).toContain("가격 계산 기준 보기");
    click(btn);
    expect(q(h, "price-editor-basis-detail"), "🔴 눌러도 펼쳐지지 않는다").not.toBeNull();
    expect(q(h, "zz-detail")?.textContent, "🔴 상세 내용이 비었다").toContain("원가");
  });

  it("F-2 🔴🔴 **위로 이동하지 않는다** — 스크롤·탭 전환을 부르지 않는다", () => {
    const scroll = vi.fn();
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const h = mount({ priceCalculationDetail: DETAIL });
      click(q(h, "price-editor-basis-toggle")!);
      expect(scroll, "🔴 눌렀더니 화면이 다른 곳으로 이동했다(CEO FAIL 조건)").not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = orig;
    }
  });

  it("F-3 🔴 상세가 있으면 **「위로 점프」 핸들러를 부르지 않는다**", () => {
    const jump = vi.fn();
    const h = mount({ priceCalculationDetail: DETAIL, onOpenPriceCalculation: jump });
    click(q(h, "price-editor-basis-toggle")!);
    expect(jump, "🔴 제자리 펼침 대신 점프가 이겼다").not.toHaveBeenCalled();
  });

  it("F-4 🟢 **닫아도 편집 상태가 남는다** — 입력값·확정 금액 보존", () => {
    const h = mount({ priceCalculationDetail: DETAIL });
    /**
     * 🔴 금액은 `textContent` 가 아니라 **입력칸 value** 다(1차 단언이 틀렸다).
     * 🟢 입력칸을 보는 쪽이 **더 정확하다** — 「편집 상태가 남는가」가 이 테스트의 질문이다.
     */
    const inputs = () => [...h.querySelectorAll("input")].map((i) => (i as HTMLInputElement).value);
    expect(inputs().join("|"), "🔴 확정 금액 입력칸이 처음부터 없다").toContain("89000");
    const before = inputs();
    click(q(h, "price-editor-basis-toggle")!);
    click(q(h, "price-editor-basis-toggle")!);
    expect(q(h, "price-editor-basis-detail"), "🔴 닫히지 않는다").toBeNull();
    expect(inputs(), "🔴 닫았더니 입력값이 날아갔다").toEqual(before);
  });

  it("F-5 🟢 상세 노드를 **안 넘기면 기존 동작 그대로** 다(폴백 보존)", () => {
    const jump = vi.fn();
    const h = mount({ onOpenPriceCalculation: jump });
    click(q(h, "price-editor-basis-toggle")!);
    expect(jump, "🔴 폴백 경로가 끊겼다").toHaveBeenCalledTimes(1);
    expect(q(h, "price-editor-basis-detail"), "🔴 노드도 없는데 영역을 만들었다").toBeNull();
  });

  it("F-6 🔴 둘 다 없으면 **죽은 버튼을 만들지 않는다**", () => {
    const h = mount({});
    expect(q(h, "price-editor-basis-toggle")).toBeNull();
  });
});
