/**
 * @vitest-environment jsdom
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 S5-WIRE — **「왜 보류인지」가 실제 셀러 화면에 선다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 **컴포넌트 단독 마운트를 쓰지 않는 이유**가 이번 WU 의 교훈이다.
 *    `confidenceBasis` 를 읽던 화면은 `MiPanelView` 하위 트리였는데 그 트리는
 *    **운영에서 한 번도 마운트되지 않는다**(`DomesticPriceIntelligencePanel:3275`).
 *    거기에 구현했다면 typecheck·계약·회귀·배포를 **전부 통과하고도** 셀러
 *    화면에는 아무것도 나타나지 않았을 것이다.
 *    ⟹ 그래서 **`CommerceWorkspace` 가 조립하는 그 트리**(seller-surface 하니스)로만
 *       완료를 선언한다. 패널 → `onMarketComparisonChange` → state →
 *       `MarketPriceComparison` 의 **실제 배선**이 돌아야 통과한다.
 *
 * 🔴 새 계산 0 · 새 판정 0 · 서버 응답 변경 0 — 서버가 이미 내는 값을 읽기만 한다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";

import { productionData } from "./product-tab-composition";
import { SNAPSHOT_ID, sellerSurfaceElement, wholeText } from "./seller-surface-composition";

let container: HTMLDivElement;
let root: Root;

/** 운영이 실제로 내는 모양 — 확인 2 / 전체 4 에 **사유가 붙은** 항목들. */
const BASIS = {
  confirmedCount: 2,
  totalCount: 4,
  items: [
    { label: "국내 동일상품 확인", confirmed: false, note: "유사상품만 확인돼 동일상품으로 확정하지 못했습니다" },
    { label: "국내 판매처 수 확인", confirmed: false, note: "동일상품이 확정되지 않아 판매처 수를 근거로 쓰지 않았습니다" },
    { label: "국내 동일상품 가격 미확인", confirmed: true, note: null },
    { label: "해외 원가·착지원가 계산", confirmed: true, note: null },
  ],
};

function stubFetch(data: PriceHistoryResponse | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data ?? { ok: false }) });
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
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
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

async function mount(): Promise<void> {
  await act(async () => {
    root.render(sellerSurfaceElement());
  });
  /* 🔴 한 번으로는 부족하다 — 패널은 GET 응답 → 파생 계산 → 보고 effect 로
     사이클을 여러 번 돈다(이 하니스가 이미 적어 둔 함정). */
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** 운영 `buildSellingSummary` 가 CASE C 에서 내는 모양(실측 47건의 그 자리). */
const SUMMARY = {
  tone: "STOP" as const,
  headline: "현재 시장 가격에서는 수익성 부족",
  numbers: "착지원가 ₩120,000 · 예상 손실 -₩18,000",
  action: "등록 전 매입가 절감이나 다른 공급처를 먼저 확인하세요.",
};
const GUIDANCE = [
  "현재 소싱 가격으로는 국내 시장에서 경쟁력을 확보하기 어렵습니다.",
  "다른 공급처나 세일 시점을 확인해보세요.",
];

function withBasis(): PriceHistoryResponse {
  return {
    ...productionData(),
    confidenceBasis: BASIS,
    sellingSummary: SUMMARY,
    sellingGuidance: GUIDANCE,
  } as unknown as PriceHistoryResponse;
}

describe("S5-WIRE 판단 근거 — CommerceWorkspace 마운트 DOM", () => {
  it("🟢🟢 서버가 낸 4항목이 **실제 셀러 화면**에 그려진다(패널→state→결론 배선)", async () => {
    stubFetch(withBasis());
    await mount();

    const region = container.querySelector('[data-testid="confidence-basis"]');
    expect(region, "🔴 판단 근거 영역이 셀러 화면에 서지 않았다").not.toBeNull();
    expect(container.querySelectorAll('[data-testid="confidence-basis-item"]').length).toBe(4);
  });

  it("🔴🔴 «확인 못 한 이유» 가 실제로 보인다 — 결론만 적지 않는다", async () => {
    stubFetch(withBasis());
    await mount();

    const text = wholeText(container);
    // 🔴 이 문장이 S5 의 목적이다 — 「유사상품만」과 「찾지 못했다」를 가르는 말.
    expect(text).toContain("유사상품만 확인돼 동일상품으로 확정하지 못했습니다");
    expect(text).toContain("동일상품이 확정되지 않아 판매처 수를 근거로 쓰지 않았습니다");
    expect(text).toContain("2/4 확인됨");
  });

  it("🔴 기본 **접힘** 이다 — `open` 을 붙이지 않는다(1차 화면은 판단이지 근거가 아니다)", async () => {
    stubFetch(withBasis());
    await mount();

    const region = container.querySelector('[data-testid="confidence-basis"]');
    expect(region?.tagName.toLowerCase()).toBe("details");
    expect(region?.hasAttribute("open"), "🔴 열어 두면 2026-09-19 사고 기전으로 되돌아간다").toBe(false);
  });

  it("🟢🟢 S5-WIRE-2 — **CASE 별 결론·숫자·행동**이 실제 화면에 선다", async () => {
    stubFetch(withBasis());
    await mount();

    const text = wholeText(container);
    // 🔴 CASE C(실측 47건)의 그 문장 — 결론만이 아니라 **왜·얼마·다음 행동**.
    expect(text).toContain("현재 시장 가격에서는 수익성 부족");
    expect(text).toContain("예상 손실");
    expect(text).toContain("등록 전 매입가 절감이나 다른 공급처를 먼저 확인하세요.");
  });

  it("🟢 S5-WIRE-2 — 설명 문장은 **접힘** 안에 있다(1차 화면은 판단이다)", async () => {
    stubFetch(withBasis());
    await mount();

    const fold = container.querySelector('[data-testid="selling-guidance"]');
    expect(fold?.tagName.toLowerCase()).toBe("details");
    expect(fold?.hasAttribute("open")).toBe(false);
    expect(container.querySelectorAll('[data-testid="selling-guidance-item"]').length).toBe(2);
  });

  it("🟢 서버가 주지 않으면 영역을 **만들지 않는다**(빈 근거를 짓지 않는다)", async () => {
    stubFetch(productionData());
    await mount();

    expect(container.querySelector('[data-testid="confidence-basis"]')).toBeNull();
  });

  /**
   * 🔴🔴 **이 하니스는 `CommerceWorkspace` 의 조립을 «복제» 한다.**
   *    그래서 하니스만 맞으면 **운영 배선이 끊겨도 위 네 테스트가 통과한다**
   *    (이 저장소가 실제로 밟은 함정 — prop 제거 변이가 통과했다).
   * 🟢 그래서 운영 파일의 배선을 **소스 앵커로 따로** 잠근다. 셋 다 있어야 한다:
   *    ① 패널이 payload 에 싣는다  ② Workspace 가 prop 으로 내린다
   *    ③ 결론 컴포넌트가 그 prop 을 받는다
   */
  it("🔴🔴 **운영 배선**이 세 파일에 실제로 있다(하니스 복제가 가려 주지 못하게)", () => {
    const read = (p: string) =>
      readFileSync(join(process.cwd(), "src", "app", "pipeline", p), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

    const panel = read("commerce/DomesticPriceIntelligencePanel.tsx");
    const ws = read("CommerceWorkspace.tsx");
    const mpc = read("commerce/MarketPriceComparison.tsx");

    // ① 패널 → payload (🔴 죽은 MiPanelView 가 아니라 라이브 memo 의 `data`)
    expect(panel).toContain("confidenceBasis: data?.confidenceBasis ?? null");
    // 🔴 deps 에 없으면 응답이 와도 영원히 갱신되지 않는다(이 파일이 다섯 번 밟은 함정)
    expect(panel).toContain("data?.confidenceBasis,");
    // ② Workspace → prop
    expect(ws).toContain("confidenceBasis={marketComparison?.confidenceBasis ?? null}");
    // ③ 결론 컴포넌트가 받아서 그린다
    expect(mpc).toContain("confidenceBasis,");
    expect(mpc).toContain('data-testid="confidence-basis"');

    // 🔵 S5-WIRE-2 — 같은 세 자리를 두 필드에 대해서도 잠근다.
    for (const field of ["sellingSummary", "sellingGuidance"] as const) {
      expect(panel, `패널 payload 에 ${field} 가 없다`).toContain(`${field}: data?.${field} ?? null`);
      expect(panel, `deps 에 ${field} 가 없다`).toContain(`data?.${field},`);
      expect(ws, `Workspace 가 ${field} 를 안 내린다`).toContain(
        `${field}={marketComparison?.${field} ?? null}`,
      );
    }
    expect(mpc).toContain('data-testid="selling-summary"');
    expect(mpc).toContain('data-testid="selling-guidance"');
  });
});
