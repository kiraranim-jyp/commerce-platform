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
    /* 🔴 owner 는 `sellerAction.status` 다 — 키는 Production 실측으로 확인했다. */
    sellerAction: {
      status: "REVIEW",
      icon: "🟡",
      title: "판매가격을 조정하세요",
      signals: [],
      reasons: ["국내 동일상품 시장가가 착지원가보다 낮습니다."],
    },
    brandMarketProfile: {
      market: "KR",
      sampleCount: 7,
      minPriceKrw: 90000,
      p25PriceKrw: 100000,
      medianPriceKrw: 110000,
      p75PriceKrw: 120000,
      maxPriceKrw: 130000,
      confidence: "MEDIUM",
    },
  } as unknown as PriceHistoryResponse;
}

describe("S5-WIRE 판단 근거 — CommerceWorkspace 마운트 DOM", () => {
  it("🟢🟢 서버가 낸 4항목이 **실제 셀러 화면**에 그려진다(패널→state→결론 배선)", async () => {
    stubFetch(withBasis());
    await mount();

    /** 🔵 UIRD-1 — 영역 이름이 `judgment-basis`(통합 접힘) 로 바뀌었다. 내용 계약은 그대로다. */
    const region = container.querySelector('[data-testid="judgment-basis"]');
    expect(region, "🔴 판단 근거 영역이 셀러 화면에 서지 않았다").not.toBeNull();
    expect(container.querySelectorAll('[data-testid="confidence-basis-item"]').length).toBe(4);
    /** 🔴🔴 UIRD-1 강화 — 네 그룹이 **그 접힘 «안»** 에 있어야 한다(밖으로 새면 1차가 다시 길어진다). */
    for (const id of [
      "confidence-basis-items",
      "seller-action-reason-items",
      "selling-guidance-items",
      "brand-market-profile",
    ]) {
      const el = container.querySelector(`[data-testid="${id}"]`);
      expect(el, `🔴 ${id} 가 화면에 없다`).not.toBeNull();
      expect(region!.contains(el!), `🔴 ${id} 가 통합 접힘 «밖» 에 있다`).toBe(true);
    }
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

    const region = container.querySelector('[data-testid="judgment-basis"]');
    expect(region?.tagName.toLowerCase()).toBe("details");
    expect(region?.hasAttribute("open"), "🔴 열어 두면 2026-09-19 사고 기전으로 되돌아간다").toBe(false);
  });

  /**
   * 🔵🔵🔵 UIRD-1 — **설명성 접힘은 「하나」 다.**
   *
   * 🔴 전에는 `▸ 이 추천이 나온 이유` · `▸ 판단 설명` · `▸ 판단 근거` **셋** 이 1차에
   *    나란히 섰다. 셀러가 「어느 것을 펼쳐야 이유가 나오나」를 고르는 일부터 해야 했다.
   * 🔴 이 단언이 **셋으로 되돌아가는 것을 막는다** — 되돌리면 숫자가 1 → 3 이 되어 FAIL 한다.
   * 🟢 가격 축의 접힘(`▸ MI 상세 분석` 등)은 **다른 축** 이라 세지 않는다 — 설명성 세 축의
   *    옛 testid 가 `details` 로 다시 나타나는지만 본다.
   */
  it("🔵🔵 UIRD-1 — 설명성 접힘이 **하나뿐** 이다(셋으로 되돌아가면 FAIL)", async () => {
    stubFetch(withBasis());
    await mount();

    expect(container.querySelectorAll('[data-testid="judgment-basis"]').length).toBe(1);
    for (const old of ["confidence-basis", "selling-guidance", "seller-action-reasons"]) {
      expect(
        container.querySelector(`details[data-testid="${old}"]`),
        `🔴 옛 접힘 ${old} 가 되살아났다 — 설명성 접힘은 하나여야 한다`,
      ).toBeNull();
    }
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

    /** 🔵 UIRD-1 — 설명 문장은 이제 **통합 접힘 안의 한 그룹** 이다(항목 수 계약은 그대로). */
    const fold = container.querySelector('[data-testid="judgment-basis"]');
    expect(fold?.tagName.toLowerCase()).toBe("details");
    expect(fold?.hasAttribute("open")).toBe(false);
    expect(container.querySelectorAll('[data-testid="selling-guidance-item"]').length).toBe(2);
    const group = container.querySelector('[data-testid="selling-guidance-items"]');
    expect(fold!.contains(group!), "🔴 설명 문장이 접힘 밖으로 나왔다").toBe(true);
  });

  it("🟢🟢 S5-WIRE-3 — `sellerAction.reasons` 와 브랜드 시장 참고가 화면에 선다", async () => {
    stubFetch(withBasis());
    await mount();

    const text = wholeText(container);
    expect(text).toContain("국내 동일상품 시장가가 착지원가보다 낮습니다.");
    expect(text).toContain("브랜드 시장 참고");
    expect(text).toContain("표본 7건");
  });

  it("🔴🔴 S5-WIRE-3 — 결론을 **중복 출력하지 않는다**(CPO 금지)", async () => {
    stubFetch(withBasis());
    await mount();

    // 🔴 `sellerAction.title` 은 결론 축이고 그것은 이미 화면에 있다 ⟹
    //    이 배선이 같은 말을 한 번 더 적으면 안 된다.
    const text = wholeText(container);
    expect((text.match(/판매가격을 조정하세요/g) ?? []).length).toBeLessThanOrEqual(1);
    // 🔴 이유는 **접힌 채** 로 선다(UIRD-1 이후 통합 접힘이 그 owner 다).
    const fold = container.querySelector('[data-testid="judgment-basis"]');
    expect(fold?.hasAttribute("open")).toBe(false);
    const group = container.querySelector('[data-testid="seller-action-reason-items"]');
    expect(fold!.contains(group!), "🔴 이유가 접힘 밖으로 나왔다").toBe(true);
  });

  it("🟢 서버가 주지 않으면 영역을 **만들지 않는다**(빈 근거를 짓지 않는다)", async () => {
    stubFetch(productionData());
    await mount();

    /**
     * 🔵 UIRD-1 — 「빈 근거를 짓지 않는다」의 **정확한 뜻**.
     *
     * 🔴🔴 내가 처음에 `judgment-basis` 자체를 null 로 단언했고 **그것이 과했다** —
     *    이 fixture 는 `confidenceBasis.items: []`(빈 배열)이지만 `sellingGuidance` 는
     *    **비어 있지 않다**. 즉 설명이 **있는** 상태라 접힘이 서는 것이 맞다.
     *    (옛 코드도 그 상태에서 `▸ 판단 설명` 접힘을 세웠고, 옛 단언이 그것을 **안 봤을** 뿐이다)
     * 🟢 그래서 원래 의도를 **그 축에서** 잠근다 — 「`items` 가 비면 그 **그룹** 을 만들지 않는다」.
     */
    expect(container.querySelector('[data-testid="confidence-basis-items"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="confidence-basis-item"]').length).toBe(0);
    /** 🔴 그리고 그 상태에서도 **요약 숫자(「n/m 확인됨」)를 지어내지 않는다.** */
    expect(wholeText(container)).not.toContain("1/4 확인됨");
  });

  /**
   * 🔴🔴🔴 UIRD-1 — **세 축이 «전부» 비면 접힘 자체를 만들지 않는다.**
   *
   * 🔴🔴 이 케이스가 **없어서 내 가드가 뚫렸다** — 음성 대조에서 게이트를
   *    `Boolean(true || …)` 로 바꿨는데 **10/10 이 그대로 통과** 했다. 기존 fixture 둘은
   *    `sellingGuidance` 가 비어 있지 않아 **어느 쪽이든 접힘이 서기 때문** 이었다.
   * 🟢 그래서 세 축을 **모두 비운** fixture 를 만든다 ⟹ 이제 게이트를 무력화하면
   *    「빈 판단 근거」 접힘이 서고 **FAIL 한다**.
   * 🔴 `brandMarketProfile` 은 게이트가 아니므로 이 케이스에서 **그 줄은 제자리에** 서야 한다
   *    (정보를 삭제하지 않는다는 CPO 조건).
   */
  it("🔴🔴 UIRD-1 — 설명 세 축이 전부 비면 접힘을 **만들지 않는다**(게이트 무력화 시 FAIL)", async () => {
    stubFetch({
      ...productionData(),
      sellingGuidance: [],
      confidenceBasis: { confirmedCount: 0, totalCount: 0, items: [] },
      sellerAction: { status: "PRICE_KEEP", icon: "🟡", title: "조건부 판매", signals: [], reasons: [] },
      brandMarketProfile: {
        market: "KR",
        sampleCount: 7,
        minPriceKrw: 90000,
        p25PriceKrw: 100000,
        medianPriceKrw: 110000,
        p75PriceKrw: 120000,
        maxPriceKrw: 130000,
        confidence: "MEDIUM",
      },
    } as unknown as PriceHistoryResponse);
    await mount();

    expect(
      container.querySelector('[data-testid="judgment-basis"]'),
      "🔴 설명이 하나도 없는데 「판단 근거」 접힘을 세웠다 — 셀러가 펼쳐 보고 빈손으로 돌아온다",
    ).toBeNull();
    /** 🟢 그런데 브랜드 참고 줄은 **살아 있어야** 한다(삭제 금지). */
    const brand = container.querySelector('[data-testid="brand-market-profile"]');
    expect(brand, "🔴 접힘이 없을 때 브랜드 참고 줄이 사라졌다").not.toBeNull();
    expect(wholeText(container)).toContain("표본 7건");
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
    expect(mpc).toContain('data-testid="judgment-basis"');
    /** 🔵🔵 UIRD-1 — 통합 게이트가 **살아 있어야** 한다(술어를 지우면 영역이 조건 없이 선다). */
    expect(mpc).toContain("const hasJudgmentBasis = Boolean(");
    expect(mpc).toContain("{hasJudgmentBasis ? (");

    // 🔵 S5-WIRE-2 — 같은 세 자리를 두 필드에 대해서도 잠근다.
    for (const field of ["sellingSummary", "sellingGuidance"] as const) {
      expect(panel, `패널 payload 에 ${field} 가 없다`).toContain(`${field}: data?.${field} ?? null`);
      expect(panel, `deps 에 ${field} 가 없다`).toContain(`data?.${field},`);
      expect(ws, `Workspace 가 ${field} 를 안 내린다`).toContain(
        `${field}={marketComparison?.${field} ?? null}`,
      );
    }
    expect(mpc).toContain('data-testid="selling-summary"');
    /**
     * 🔵 UIRD-1 — 설명 그룹의 **항목 testid** 로 잠근다(옛 `selling-guidance` 접힘은 사라졌다).
     * 🔴 네 그룹이 **전부** 소스에 있어야 한다 — 하나를 지우면 근거가 조용히 사라진다.
     */
    for (const id of [
      "confidence-basis-items",
      "seller-action-reason-items",
      "selling-guidance-items",
      "brand-market-profile",
    ]) {
      expect(mpc, `🔴 ${id} 가 운영 소스에서 사라졌다`).toContain(`data-testid="${id}"`);
    }
  });
});
