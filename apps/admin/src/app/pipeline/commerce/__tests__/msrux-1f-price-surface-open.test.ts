/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MSRUX-1 UI-2b — **「가격 수정 →」이 판매가 편집 영역을 «실제로» 연다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 앞선 계약(`msrux-1e`)은 **CTA 쪽** 만 봤다 — 클릭이 핸들러를 부르는 것까지다.
 *    이 파일은 **받는 쪽**(`StageBody`)을 **실제로 마운트해서** 본다:
 * ```
 * ② 접힘 상태   openPriceSurfaceRequest 가 바뀌면 판매가 영역이 «펼쳐진다»
 * ③ 앵커 DOM    펼친 뒤 `PRICE_SURFACE_ANCHOR_ID` 가 **실제로 마운트된다**
 *               (스크롤의 대상이 없으면 「열린다」가 거짓이 된다)
 * 🔴 그리고 **단계와 무관하게** 그렇다 — 셀러가 ② 시장 판단에 있어도 열려야 한다
 * ```
 * 🔴 이 파일이 **하지 않는** 것 — 가격 계산·A/B·집계·판정·등록 **변경 0**.
 *
 * ── 🔴 jsdom 이 못 보는 것(그래서 별도로 쟀다) ──────────────────────────────
 * 실제 스크롤은 레이아웃이 필요해 jsdom 으로 증명할 수 없다. 🟢 그 축은
 * **실제 브라우저**에서 앱 셸(`html`·`body` 가 `overflow:hidden` · 안쪽
 * `main.overflow-y-auto`) 그대로 재현해 측정했다 — `scrollTop 314 → 2337` ·
 * 앵커가 뷰포트 상단 **16px**(= `scroll-mt-4`) · **재클릭에서도 이동**.
 */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { StageBody, PRICE_SURFACE_ANCHOR_ID } from "../StageBody";
import type { StageFocus } from "../stage-focus";
import type { Workflow } from "../workflow";

/**
 * 🔴 `StageBody` 가 **실제로 읽는 칸만** 채운다(소스 전수 확인: `focus.main` ·
 *    `focus.images` · `workflow.current`). 🟢 지어낸 칸 0 — 없는 칸을 채우면
 *    하니스가 운영과 다른 모양이 된다(이 리포가 반복해 밟은 함정).
 */
const focusAt = (main: StageFocus["main"]) =>
  ({ main, images: "REFERENCE" }) as unknown as StageFocus;
const WORKFLOW = { current: { subSteps: [] } } as unknown as Workflow;

/** 🟢 운영과 **같은 모양** — 앵커는 `CommerceWorkspace` 가 `price` 노드에 붙인다. */
const PRICE_NODE = createElement(
  "div",
  { id: PRICE_SURFACE_ANCHOR_ID, className: "scroll-mt-4" },
  createElement("div", { "data-testid": "zz-price-editor" }, "판매가 편집기"),
);

function mount(openPriceSurfaceRequest: number, main: StageFocus["main"] = "MARKET") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(host);
  const render = (n: number) =>
    act(() => {
      root.render(
        createElement(StageBody, {
          focus: focusAt(main),
          workflow: WORKFLOW,
          surfaces: { source: null, images: null, price: PRICE_NODE, required: null },
          archive: null,
          channels: [],
          onGoToChannel: () => {},
          openPriceSurfaceRequest: n,
        } as never),
      );
    });
  render(openPriceSurfaceRequest);
  return { host, render };
}

const anchor = (host: HTMLElement) => host.querySelector(`#${PRICE_SURFACE_ANCHOR_ID}`);

describe("MSRUX-1 UI-2b — 판매가 편집 영역 펼침 (실제 StageBody 마운트)", () => {
  it("H-1 🔴🔴 요청 «전» 에는 편집기가 마운트되지 않는다(= 스크롤 대상이 없다)", () => {
    const { host } = mount(0);
    /** 🟢 접힘 자체는 선다 — 「없다」가 아니라 「접혀 있다」. */
    expect(host.textContent ?? "", "🔴 판매가격 영역 자체가 사라졌다").toContain("판매가격 확정");
    expect(anchor(host), "🔴 접힌 채로 앵커가 이미 떠 있다").toBeNull();
  });

  it("H-2 🟢🟢 요청이 오면 **펼쳐지고 앵커가 마운트된다**", () => {
    const { host, render } = mount(0);
    render(1); // = setPriceSurfaceRequest((n) => n + 1)
    expect(anchor(host), "🔴 펼쳤는데 앵커가 없다 — 스크롤할 대상이 없다").not.toBeNull();
    expect(host.querySelector('[data-testid="zz-price-editor"]'), "🔴 편집기가 안 떴다").not.toBeNull();
  });

  it("H-3 🔴 **단계와 무관하게** 열린다 — ② 시장 판단에서도 ③ 등록 준비에서도", () => {
    for (const main of ["MARKET", "PREPARE", "REGISTER"] as const) {
      const { host, render } = mount(0, main);
      render(1);
      expect(anchor(host), `🔴 ${main} 단계에서 편집기가 열리지 않는다`).not.toBeNull();
    }
  });

  it("H-4 🔴 앵커는 **하나뿐** 이다 — 두 벌이면 스크롤이 조용히 엉뚱한 곳으로 간다", () => {
    const { host, render } = mount(0, "PREPARE");
    render(1);
    expect(host.querySelectorAll(`#${PRICE_SURFACE_ANCHOR_ID}`).length).toBe(1);
    expect(host.querySelectorAll('[data-testid="zz-price-editor"]').length, "🔴 편집기가 두 벌이다").toBe(1);
  });

  it("H-5 🟢 **이미 펼쳐진 뒤 다시 요청해도** 편집기가 그대로 있다(재클릭)", () => {
    const { host, render } = mount(0);
    render(1);
    render(2);
    expect(anchor(host), "🔴 재요청이 영역을 닫아 버렸다").not.toBeNull();
    expect(host.querySelectorAll(`#${PRICE_SURFACE_ANCHOR_ID}`).length, "🔴 재요청이 앵커를 복제했다").toBe(1);
  });
});
