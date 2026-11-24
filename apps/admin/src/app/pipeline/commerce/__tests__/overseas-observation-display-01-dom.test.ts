/** @vitest-environment jsdom */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { OVERSEAS_LOWEST_LABEL } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-OSOD-01 — **마운트한 DOM 으로만 「보인다」를 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 순수 함수 단언은 「값이 오면 그린다」까지다 — **「그 값이 화면에 선다」는 별개 축** 이다
 *    (헌장 §5 · 메모 `render-pass-is-not-source-pass`). WU-136 에서 소스 계약이 통과한
 *    상태로 **JSX 가 깨져 있었고** 마운트 DOM 축이 그것을 잡았다.
 *
 * 🔴 **시각을 주입하지 않는다** — `MarketPriceComparison` 은 `observedAtIso` 를 받지 않고
 *    운영에서 현재 시각을 쓴다. 🟢 그래서 **충분히 과거인 수집 시점**(2026-10-21 · 실측
 *    해외 최초 수집일)을 써서 **어느 시점에 돌려도 14일 초과** 가 되게 한다.
 */
const row = (o: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "junioredition.com",
    discoveredUrl: "https://junioredition.com/products/a",
    title: "Taxi Saurus Tag Denim Pants by Bobo Choses",
    market: "OVERSEAS",
    matchTruth: "STRONG_IDENTIFIER",
    crossSellerVerdict: "SAME",
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    priceTier: "EXACT",
    priceKrwDerived: 65_000,
    collectedAt: "2026-10-21T00:00:00.000Z",
    source: "REVIEWED_SAME",
    ...o,
  }) as unknown as GeminiTransientRow;

function mount(rows: GeminiTransientRow[]): { doc: Document; text: string; cleanup: () => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows,
        snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2",
      }),
    );
  });
  return {
    doc: document,
    text: host.textContent ?? "",
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/** 🟢 실측 모양 — junioredition 편중(3/4) · GBP 극단값 · 다른 판매처 1곳 · 낡은 수집. */
const ROWS = [
  row({}),
  row({ discoveredUrl: "https://junioredition.com/products/b", priceAmount: 40 }),
  row({ discoveredUrl: "https://junioredition.com/products/x", priceAmount: 15_200 }),
  row({ domain: "nickis.com", discoveredUrl: "https://nickis.com/p/1", priceAmount: 50 }),
];

describe("MI-OSOD-01 DOM — 해외 관측 품질이 화면에 선다", () => {
  it("R-1 🔵🔵 **「수집 최저 관측가」가 화면에 있고 「확인가」는 없다**", () => {
    const m = mount(ROWS);
    try {
      expect(m.text, "🔴🔴 관측가 명칭이 화면에 없다").toContain(OVERSEAS_LOWEST_LABEL);
      expect(m.text).toContain("수집 최저 관측가");
      /** 🔴 **구매 가능성을 주장하는 옛 라벨** 이 되돌아오면 FAIL. */
      expect(m.text, "🔴🔴 「최저 확인가」가 화면에 돌아왔다").not.toContain("최저 확인가");
      expect(m.text).not.toContain("구매 가능 최저가");
      expect(m.text).not.toContain("추천 소싱가");
    } finally {
      m.cleanup();
    }
  });

  it("R-2 🔴🔴 **품질 블록이 실제로 렌더된다** — 편중·관측 폭·낡은 수집·구매 미확인", () => {
    const m = mount(ROWS);
    try {
      const block = m.doc.querySelector('[data-testid="observation-quality-overseas"]');
      expect(block, "🔴🔴 품질 블록이 DOM 에 없다 — 경고가 통째로 사라졌다").not.toBeNull();
      const t = block?.textContent ?? "";
      expect(t, "🔴 편중을 숨겼다").toContain("junioredition.com");
      expect(t, "🔴 구매 가능 미확인을 숨겼다").toContain("구매 가능 여부는 확인되지 않았습니다");
      /**
       * 🔴 **천단위 구분자가 붙은 형태** 로 단언한다 — 금액 형식 owner(`amountText`)를
       *    쓰기 때문이다. 🟢 내 1차 단언은 `15200`(날 숫자)이었고 기존 계약
       *    `mi-uic-01`(「한 화면에 형식이 둘이 아니다」)이 **2 FAIL** 로 그 결함을 잡았다.
       */
      expect(t, "🔴🔴 극단값(15,200)이 화면에서 사라졌다").toContain("15,200");
      expect(t, "🔴 낡은 수집을 숨겼다").toContain("14일이 지난 관측");
      expect(t).toContain("독립 판매처");
    } finally {
      m.cleanup();
    }
  });

  it("R-3 🟢 **최저 관측가 숫자는 극단값이 아니다**(기존 상한 규칙 보존)", () => {
    const m = mount(ROWS);
    try {
      expect(m.text, "🔴🔴 극단값이 최저 관측가로 올라갔다").toContain("GBP 37");
      /** 🔴 그 숫자가 「최저 관측가」 자리에 **15,200** 으로 서면 FAIL 이다. */
      expect(m.text).not.toContain("수집 최저 관측가 GBP 15,200");
    } finally {
      m.cleanup();
    }
  });

  it("R-4 🔴 **국내 블록에 해외 통화 경고가 섞이지 않는다**", () => {
    const m = mount([
      ...ROWS,
      row({
        market: "KR",
        domain: "shop.kr",
        discoveredUrl: "https://shop.kr/p/1",
        priceAmount: 88_000,
        priceCurrency: "KRW",
      }),
    ]);
    try {
      const kr = m.doc.querySelector('[data-testid="observation-quality-domestic"]');
      /** 🟢 국내 블록이 서더라도 **GBP 폭** 이 그 안에 있으면 FAIL 이다. */
      if (kr != null) expect(kr.textContent ?? "", "🔴🔴 해외 통화 폭이 국내 블록에 섞였다").not.toContain("GBP");
    } finally {
      m.cleanup();
    }
  });
});
