import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 3b 실검증(CEO 지시, 2026-09-20) — **「입력 삭제 → UNKNOWN」을
 * 화면에서 실제로 확인한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 정적 판정을 하지 않나 ────────────────────────────────────────────────
 * 이 저장소의 관례를 그대로 따른다(market-research-sources.test.ts 주석):
 * 「확인했다」가 사실과 달랐던 적이 반복됐고 전부 테스트 통과로 닫은 것이다.
 * 그래서 여기서는 **실제로 jsdom 에 가격 계산 상세를 마운트하고, 실제로 입력칸의
 * 값을 지우고, 실제로 DOM 에 남은 글자**로만 판정한다.
 *
 * 재는 것은 셋이다.
 *   ① 지우기 «전» 에는 착지원가 숫자가 그려진다
 *   ② 지우면 근거 문구가 「확인되지 않았습니다」로 바뀐다
 *   ③ 지우면 착지원가·권장가 숫자가 화면에서 «사라진다»
 *      🔴 라벨만 바뀌고 숫자가 남으면 이번 작업은 실패다.
 */

let dom: JSDOM;
let container: HTMLDivElement;

const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

/** 실측 회귀 기준선과 같은 상품(Bobo Choses €75). */
function product(shippingKrw: number | null): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/en-int/products/b226ac043",
    title: field("Mystery BC Ribbed T-Shirt"),
    brand: field("Bobo Choses"),
    price: { value: { amount: 75, currency: "EUR" }, source: "ORIGINAL", confidence: 0.9 },
    priceValidity: "VALID",
    priceBreakdown: { shippingKrw, feePercent: 10, marginPercent: 20 },
    images: [],
    optionGroups: [],
    breadcrumbPath: [],
  } as unknown as CanonicalProduct;
}

beforeEach(() => {
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/pipeline",
  });
  const w = dom.window as unknown as Window & typeof globalThis;
  Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true, writable: true });
  Object.assign(globalThis, {
    window: w,
    document: w.document,
    HTMLElement: w.HTMLElement,
    Element: w.Element,
    Node: w.Node,
    Event: w.Event,
    getComputedStyle: w.getComputedStyle.bind(w),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number,
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  container = w.document.getElementById("root") as HTMLDivElement;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mount(shippingKrw: number | null) {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { PriceCalculationDetail } = await import("../PriceCalculationDetail");

  /** 실제 컴포넌트가 커밋한 값을 그대로 받아 둔다(상위가 저장하는 자리). */
  const committed: Array<{ shippingKrw: number | null }> = [];
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(PriceCalculationDetail, {
        product: product(shippingKrw),
        onUpdatePriceBreakdown: (b: { shippingKrw: number | null; feePercent: number; marginPercent: number }) =>
          committed.push({ shippingKrw: b.shippingKrw }),
        exchangeRates: { rates: { EUR: 1480 }, fetchedAt: "2026-09-20T00:00:00.000Z", source: "frankfurter" as const },
        exchangeRatesLoading: false,
        onRefreshExchangeRates: () => {},
        priceRoundingUnit: 10,
      }),
    );
  });
  return { root, act, committed, React };
}

/** 국제배송비 입력칸 — placeholder 로 찾는다(그 칸만 「미확인」을 가진다). */
function shippingInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>('input[placeholder="미확인"]');
  if (!el) throw new Error("국제배송비 입력칸을 찾지 못했다");
  return el;
}

const text = () => container.textContent ?? "";

describe("P0-C STEP 3b 실검증 — 화면에서 입력을 지운다", () => {
  it("① 지우기 «전» — 착지원가 숫자가 실제로 그려져 있다", async () => {
    const { root, act } = await mount(12000);
    // €75 × 1480 = ₩111,000 + ₩12,000 = ₩123,000 (회귀 기준선)
    expect(text()).toContain("₩123,000");
    expect(shippingInput().value).toBe("12000");
    await act(async () => root.unmount());
  });

  it("🔴 ② 입력칸을 지우면 근거가 «확인되지 않았습니다» 로 바뀐다", async () => {
    const { root, act } = await mount(12000);
    const input = shippingInput();

    await act(async () => {
      // 실제 사용자가 값을 모두 지운 것과 같은 이벤트를 보낸다.
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });

    expect(text()).toContain("해외물류비가 확인되지 않았습니다");
    // 🔴 예전 문구가 남아 있으면 안 된다 — 그것이 ₩0 14건을 만든 문장이다.
    expect(text()).not.toContain("판매자가 입력한 해외물류비");
    await act(async () => root.unmount());
  });

  it("🔴 ③ 지우면 착지원가·권장가 «숫자가 사라진다» — 라벨만 바뀌면 실패다", async () => {
    const { root, act } = await mount(12000);
    expect(text()).toContain("₩123,000");

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(shippingInput(), "");
      shippingInput().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });

    // 🔴 배송비를 0 으로 친 원가(₩111,000)도, 예전 착지원가(₩123,000)도 없어야 한다.
    expect(text()).not.toContain("₩123,000");
    expect(text()).not.toContain("₩111,000");
    await act(async () => root.unmount());
  });

  it("🔴 ④ «0 을 친» 경우는 반대다 — 숫자가 그대로 나온다", async () => {
    const { root, act } = await mount(0);
    // 배송비 0 은 「무료라고 확인했다」는 유효한 값이다 → 착지원가 = 상품가.
    expect(text()).toContain("₩111,000");
    expect(text()).not.toContain("해외물류비가 확인되지 않았습니다");
    expect(shippingInput().value).toBe("0");
    await act(async () => root.unmount());
  });

  it("🔴 ⑤ 지운 값이 상위로 «null 로» 커밋된다 — 0 으로 바뀌지 않는다", async () => {
    const { root, act, committed } = await mount(12000);

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
      const input = shippingInput();
      setter.call(input, "");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });

    // 🔴 값을 지운 순간 화면이 «착지원가를 계산할 수 없습니다» 블록으로 바뀌고,
    //    입력칸도 그 안의 새 엘리먼트로 교체된다. 그래서 다시 찾아서 커밋한다
    //    (예전 참조는 이미 DOM 에서 떨어져 나갔다 — 실측으로 확인).
    await act(async () => {
      // React 의 onBlur 는 «focusout» 위임으로 붙는다. "blur" 는 버블링하지 않아
      // React 핸들러에 닿지 않는다.
      shippingInput().dispatchEvent(new dom.window.Event("focusout", { bubbles: true }));
    });

    expect(committed.length).toBeGreaterThan(0);
    expect(committed.at(-1)!.shippingKrw).toBeNull();
    expect(committed.at(-1)!.shippingKrw).not.toBe(0);
    await act(async () => root.unmount());
  });
});
