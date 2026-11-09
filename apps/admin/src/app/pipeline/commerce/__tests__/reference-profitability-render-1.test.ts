/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  sellerSurfaceElement,
  firstScreenText,
  wholeText,
  /**
   * 🔴 **id 를 내가 만들지 않는다** — 조립 owner 가 그 값을 쥐고 있다. 다르면 GET stub 의
   *    URL 과 어긋나 패널이 `FAILED` 로 살고 **영역이 안 선다**(1차에 실제로 그렇게 틀렸고,
   *    그때 화면은 「시장 조사를 마치지 못했습니다」를 말했다 — 제품 결함처럼 보였다).
   */
  SNAPSHOT_ID,
} from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 ⑥ — **실제 셀러 화면에 그 영역이 선다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 파일이 따로 있나** — CPO 완료 기준 ⑥ 은 「**실제 셀러 화면** 렌더 검증」이다.
 *    이 트랙에서 **다섯 번** 「소스 앵커 PASS」를 UI PASS 로 보고했다가 CEO 화면이
 *    그대로였다(`SELLER-SURFACE-RENDER-HARNESS-1` 이 생긴 이유). 🟢 그래서 이 파일은
 *    `sellerSurfaceElement`(운영 조립)을 **마운트** 하고 **DOM 에서** 읽는다.
 *
 * 🔴 **값을 prop 으로 밀어넣지 않는다** — 서버 응답에 칸을 넣고 ⒜ 패널 생산 ⒝ deps
 *    ⒞ Workspace 전달 ⒟ 영역 prop **네 자리를 전부 통과해야** DOM 에 뜬다(이 파일이
 *    「배선이 끊기면 조용히 사라진다」를 잡는 유일한 축이다).
 *
 * 🔴 기준 상태는 **CEO 가 본 그 상태** 다 — 공용 fixture 가 이미 `marketCase: "D"` ·
 *    `recommendedPrice: null` 이다(= 「국내 EXACT 근거가 없다」). 그 상태에서
 *    **참고 축이 수익성을 말하는지** 를 본다.
 */

const AREA_SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

let container: HTMLDivElement;
let root: Root;

function stubFetch(data: PriceHistoryResponse): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      }
      if (url.startsWith("/api/domestic-price-sources/links")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, links: [] }) });
      }
      if (url.includes("/alerts")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, alerts: [] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

/** 🔴 **다섯 번 flush** — 패널은 GET → 파생 → 보고로 사이클을 여러 번 돈다(하니스 규약). */
async function mount(data: PriceHistoryResponse): Promise<void> {
  stubFetch(data);
  await act(async () => {
    root.render(sellerSurfaceElement({ marketDone: true }));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/**
 * 🟢 **서버가 낸 모양 그대로** 를 응답에 얹는다 — 숫자는 `computeReferenceProfitability`
 *    가 실제로 내는 값이다(참고가격 88,000 · 원가 67,290 → **23.5%** · 계약 B-2 가 그
 *    수를 운영 함수로 단언한다).
 * 🔴 손으로 만든 **모양** 이 유니온 밖으로 나가면 typecheck 가 막는다(타입에서 읽는다).
 */
function withReferenceProfitability(
  base: PriceHistoryResponse,
  over: Partial<NonNullable<PriceHistoryResponse["referenceProfitability"]>> = {},
): PriceHistoryResponse {
  return {
    ...base,
    referenceProfitability: {
      basis: "REFERENCE_PRICE",
      marginPercent: 23.5,
      meetsTargetMargin: false,
      targetMarginPercent: 30,
      sellerCount: 1,
      excludedCount: 0,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
      referencePriceKrw: 88_000,
      ...over,
    },
  };
}

describe("E. 🔵 실제 셀러 화면 — 참고가격 기준 예상 수익성 영역", () => {
  it("E-1 🟢🟢 **배선 네 자리를 통과해 DOM 에 뜬다**", async () => {
    await mount(withReferenceProfitability(productionData()));
    const area = container.querySelector('[data-testid="reference-profitability"]');
    expect(
      area,
      "🔴 null 이면 배선 네 자리(생산·deps·Workspace·prop) 중 하나가 끊긴 것이다",
    ).not.toBeNull();
    expect(area?.textContent ?? "").toContain("예상 마진 24%");
  });

  it("E-2 🔴 **전제를 같이 말한다** — 확정 판단으로 읽히지 않게(CPO 경계 ③)", async () => {
    await mount(withReferenceProfitability(productionData()));
    const text = container.querySelector('[data-testid="reference-profitability"]')?.textContent ?? "";
    /** 🔴 글자를 **직접** 단언한다 — 상수에서 읽으면 동어반복이다(메모 그 함정). */
    expect(text).toContain("동일상품으로 확정된 가격이 아닙니다");
    expect(text).toContain("판매 여부 판단에 반영되지 않습니다");
  });

  it("E-3 🟢 **분모를 같이 말한다** — 근거 수(제외가 있으면 그것도)", async () => {
    await mount(withReferenceProfitability(productionData()));
    const text = container.querySelector('[data-testid="reference-profitability-basis-count"]')?.textContent ?? "";
    expect(text).toContain("근거 1곳");
    /** 🔴 제외가 0 이면 그 절을 **만들지 않는다**(없는 제외를 적지 않는다). */
    expect(text).not.toContain("제외");

    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await mount(
      withReferenceProfitability(productionData(), {
        excludedCount: 3,
        excludedUnverified: 2,
        excludedObservedDifference: 1,
      }),
    );
    const text2 = container.querySelector('[data-testid="reference-profitability-basis-count"]')?.textContent ?? "";
    expect(text2).toContain("제외");
    expect(text2).toContain("가격 미확인 2곳");
    expect(text2).toContain("관측 차이 1곳");
  });

  it("E-4 🔴 비율이 없으면 **영역을 그리지 않는다** — 「0%」를 만들지 않는다", async () => {
    await mount(withReferenceProfitability(productionData(), { marginPercent: null }));
    expect(
      container.querySelector('[data-testid="reference-profitability"]'),
      "🔴 측정불가 상태에서 영역이 서면 셀러가 수익성을 안다고 믿는다",
    ).toBeNull();
  });

  it("E-5 🔴 응답에 칸이 **없으면**(구버전) 전과 똑같다 — 영역 0", async () => {
    await mount(productionData());
    expect(container.querySelector('[data-testid="reference-profitability"]')).toBeNull();
  });

  it("E-6 🔴🔴 **판정 어휘가 그 영역에 없다**(CPO 경계 ①의 화면 축)", async () => {
    await mount(withReferenceProfitability(productionData()));
    const text = container.querySelector('[data-testid="reference-profitability"]')?.textContent ?? "";
    for (const banned of ["추천", "비추천", "낮추", "경쟁력", "적정가", "권장"]) {
      expect(text, `🔴 '${banned}' 가 이 영역에 들어가면 참고 축이 «권고» 를 하기 시작한다`).not.toContain(
        banned,
      );
    }
  });

  it("E-7 🔴 기존 판정 영역과 **다른 상자** 다 — 섞이지 않는다", async () => {
    await mount(withReferenceProfitability(productionData()));
    const area = container.querySelector('[data-testid="reference-profitability"]');
    expect(area).not.toBeNull();
    /** 🔴 판정 영역(요약·Action Center)이 이 상자 **안에 없다**. */
    expect(area?.querySelector('[data-testid="seller-decision"]')).toBeNull();
    expect(area?.querySelector('[data-testid="action-center-next-step"]')).toBeNull();
    /** 🔴 A/B 가격 칸도 이 상자 안에 없다 — **분모가 다르다**(같은 줄 금지). */
    expect(area?.querySelector('[data-testid="market-recommended-price"]')).toBeNull();
    expect(area?.querySelector('[data-testid="market-price-basis"]')).toBeNull();
  });

  it("E-8 🟢 **1차 화면** 에 선다 — 접힘 안에 숨지 않는다", async () => {
    await mount(withReferenceProfitability(productionData()));
    /**
     * 🔴 `firstScreenText()` 는 **닫힌 `details` 를 제거** 한 텍스트다. 그 안에 들어가면
     *    CEO 가 「수익성을 모른다」고 느낀 상태가 **그대로 남는다**(이 WU 의 목적 불충족).
     */
    expect(firstScreenText(container)).toContain("참고가격 기준 예상 수익성");
  });

  it("E-9 🔴 **B 금액 비노출 동결** 을 깨지 않는다", async () => {
    await mount(withReferenceProfitability(productionData()));
    const text = wholeText(container);
    /**
     * 🔴 참고가격 금액(₩88,000)을 **이 영역이** 적지 않는다 — 금액 owner 는 🇰🇷/🌎
     *    블록 하나이고, 이 영역은 **비율** 만 말한다(owner 둘 금지).
     */
    const area = container.querySelector('[data-testid="reference-profitability"]')?.textContent ?? "";
    expect(area).not.toContain("88,000");
    expect(area).not.toContain("₩");
    /** 🟢 화면 전체는 전과 같다 — 이 WU 가 금액 표시 정책을 건드리지 않았다. */
    expect(text).toContain("참고가격 기준 예상 수익성");
  });

  it("E-10 🔴 어휘를 **영역 파일이 만들지 않는다** — copy owner 하나", () => {
    /** 🔴 리터럴이 컴포넌트에 박히면 계약이 한 자리에서 금지 어휘를 물 수 없다. */
    expect(AREA_SRC).not.toContain("동일상품으로 확정된 가격이 아닙니다");
    expect(AREA_SRC).toContain("REFERENCE_PROFITABILITY_BASIS_NOTE");
    expect(AREA_SRC).toContain("referenceProfitabilityBasisCount");
  });
});
