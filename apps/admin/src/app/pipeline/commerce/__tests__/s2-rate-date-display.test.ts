import { readFileSync } from "node:fs";
import { join } from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 S2-③ — **환율 기준일 표시 · 「가져온 시각」과 「고시 기준일」을 가른다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 정책(2026-11-14): 우리가 내는 원화 금액은 **실제 결제 확정 금액이 아니라
 * 소싱·판매 판단을 위한 참고용 추정 가격**이다. 그래서 「어느 날짜 환율로
 * 환산했는가」를 투명하게 밝히되, 환율이 오래됐다는 이유로 분석을 막지 않는다.
 *
 * 🔴 이 파일이 잠그는 것은 **세 가지를 섞지 않는 것** 이다:
 *   fetchedAt   우리가 데이터를 «가져온» 시각
 *   rateDate    환율이 «기준으로 삼는» 날짜(ECB 고시일)  ← 화면이 쓰는 값
 *   fallback    비상 고정표 — **기준일이 없다**(지어내면 상수가 「오늘 고시」로 보인다)
 *
 * 🔴 이 파일이 **하지 않는** 것 — 만료 차단 0 · 휴일 달력 0 · 영업일 계산 0 ·
 *    출처/고시기관 설명 0(CPO 범위 제한).
 */

let dom: JSDOM;
let container: HTMLDivElement;

const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

function product(): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/en-int/products/b226ac043",
    title: field("Mystery BC Ribbed T-Shirt"),
    brand: field("Bobo Choses"),
    price: { value: { amount: 75, currency: "EUR" }, source: "ORIGINAL", confidence: 0.9 },
    priceValidity: "VALID",
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 20 },
    images: [],
    optionGroups: [],
    breadcrumbPath: [],
  } as unknown as CanonicalProduct;
}

/** 주석을 벗긴 소스 — 주석 글자가 계약을 통과시키는 함정을 막는다. */
function strippedLib(): string {
  const raw = readFileSync(join(__dirname, "..", "..", "..", "..", "lib", "exchange-rates.ts"), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
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

async function mountWith(exchangeRates: {
  rates: Record<string, number>;
  fetchedAt: string;
  rateDate: string | null;
  source: "frankfurter" | "last_known" | "fallback";
} | null) {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { PriceCalculationDetail } = await import("../PriceCalculationDetail");

  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(PriceCalculationDetail, {
        product: product(),
        onUpdatePriceBreakdown: () => {},
        exchangeRates,
        exchangeRatesLoading: false,
        onRefreshExchangeRates: () => {},
        priceRoundingUnit: 10,
      }),
    );
  });
  return { root, text: container.textContent ?? "" };
}

describe("S2-③ 환율 기준일 — 화면은 «고시 기준일» 을 보여준다", () => {
  it("🟢 기준일이 있으면 화면에 그 날짜가 그려진다(마운트 DOM)", async () => {
    const { text } = await mountWith({
      rates: { EUR: 1480 },
      fetchedAt: "2026-11-14T23:40:00.000Z",
      rateDate: "2026-11-13",
      source: "frankfurter",
    });
    expect(text).toContain("환율 기준일");
    expect(text).toContain("2026-11-13");
  });

  it("🔴🔴 «가져온 시각» 을 기준일로 표시하지 않는다 — 두 값이 갈린다", async () => {
    const { text } = await mountWith({
      rates: { EUR: 1480 },
      // 🔴 가져온 날짜(11-14)와 고시 기준일(11-13)이 **다르다**.
      fetchedAt: "2026-11-14T23:40:00.000Z",
      rateDate: "2026-11-13",
      source: "frankfurter",
    });
    expect(text).toContain("2026-11-13");
    // 🔴 fetchedAt 의 날짜가 화면에 기준일처럼 나오면 안 된다.
    expect(text).not.toContain("2026-11-14");
  });

  it("🟢 DB last_known 도 **원래 고시 기준일** 을 그대로 보여준다(다시 읽은 날이 아니다)", async () => {
    const { text } = await mountWith({
      rates: { EUR: 1480 },
      fetchedAt: "2026-11-14T23:40:00.000Z",
      rateDate: "2026-11-07", // 일주일 전 고시 — 그대로 보인다.
      source: "last_known",
    });
    expect(text).toContain("2026-11-07");
    expect(text).not.toContain("2026-11-14");
  });

  it("🔴 fallback(비상 고정표)은 **가짜 기준일을 만들지 않는다**", async () => {
    const { text } = await mountWith({
      rates: { EUR: 1480 },
      fetchedAt: "2026-11-14T23:40:00.000Z",
      rateDate: null,
      source: "fallback",
    });
    expect(text).toContain("환율 기준일");
    expect(text).toContain("확인 불가");
    // 🔴 어떤 날짜도 기준일 자리에 나오면 안 된다.
    expect(text).not.toContain("2026-11-14");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("🟢 환율 자체가 아직 없으면 기준일 줄을 만들지 않는다(빈 날짜를 그리지 않는다)", async () => {
    const { text } = await mountWith(null);
    expect(text).not.toContain("환율 기준일");
  });
});

describe("S2-③ 환율 스냅샷 — 세 출처가 기준일을 서로 다르게 다룬다", () => {
  it("🔴 frankfurter 는 **ECB 고시일(data.date)** 을 rateDate 로 쓴다", () => {
    const lib = strippedLib();
    expect(lib).toContain("const rateDate = data.date");
    expect(lib).toContain("rateDate, source: \"frankfurter\"");
  });

  it("🔴 last_known 은 DB 에 보존된 **원래 기준일** 을 쓰고 now() 로 덮지 않는다", () => {
    const lib = strippedLib();
    expect(lib).toContain("rateDate: newest.slice(0, 10)");
    expect(lib).toContain('source: "last_known"');
  });

  it("🔴 fallback 은 rateDate 가 **null** 이다 — 오늘 날짜를 붙이지 않는다", () => {
    const lib = strippedLib();
    expect(lib).toContain("rateDate: null");
    expect(lib).toContain('source: "fallback"');
  });

  it("🔴 fetchedAt 과 rateDate 가 **서로 다른 칸** 으로 선언돼 있다", () => {
    const lib = strippedLib();
    expect(lib).toContain("fetchedAt: string;");
    expect(lib).toContain("rateDate: string | null;");
  });

  it("🟢 만료 차단·휴일 달력을 만들지 않았다(CPO 범위 제한)", () => {
    const lib = strippedLib();
    for (const banned of ["영업일", "businessDay", "holiday", "공휴일", "EXPIRED", "만료"]) {
      expect(lib).not.toContain(banned);
    }
  });
});
