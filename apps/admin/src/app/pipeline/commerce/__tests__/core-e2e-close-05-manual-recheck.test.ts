/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-05 — **재진입에서 셀러가 직접 다시 조회한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CEO Production FAIL 의 사슬(마운트 DOM 으로 재현했다):
 * ```
 * 기존 분석 결과 재진입
 *   → page.tsx:529 POST /check 는 `isFirstInsert` 블록 «안» 에만 있다 ⟹ 안 돈다
 *   → GET 은 transient 를 싣지 않는다 ⟹ rows = null
 *   → checkRan=false ⟹ MarketPriceComparison 이 **return null**
 *   → 📊 영역이 통째로 사라진다 · 복구 버튼은 `HIDDEN` 패널 안이라 **없다**
 * ```
 * 🟢 CPO 결정 ⒝ — **수동** 「🔄 다시 분석」. 자동 `/check` 는 **금지**(비용 정책).
 * 🔴 `/check` 새 구현 0 · 새 API 0 · Identity 0 · 가격 정책 0 · 선별기 0 ·
 *    `presentation="HIDDEN"` 0 · 저장 로직 복제 0.
 */

const PRESUMED: GeminiTransientRow = {
  domain: "biskuit.kr",
  title: "보보쇼즈 허그 헤어리 몬스터 티셔츠",
  discoveredUrl: "https://biskuit.kr/product/detail.html?product_no=2",
  crossSellerVerdict: "PRESUMED_SAME",
  priceAmount: 88000,
  priceCurrency: "KRW",
  priceStatus: "VERIFIED_CURRENT",
  market: "KR",
  soldOut: false,
  source: "WEB_SEARCH",
} as GeminiTransientRow;

const SAME: GeminiTransientRow = {
  ...PRESUMED,
  domain: "miniboutique.co.kr",
  discoveredUrl: "https://miniboutique.co.kr/p/1",
  crossSellerVerdict: "SAME",
  priceAmount: 117000,
} as GeminiTransientRow;

/** 🔴 `SIMILAR` — 두 선별기 어디에도 들지 못한다(CPO §6-9). */
const SIMILAR: GeminiTransientRow = {
  ...PRESUMED,
  domain: "other.example",
  discoveredUrl: "https://other.example/p/3",
  crossSellerVerdict: "SIMILAR",
  priceAmount: 19,
  priceCurrency: "GBP",
  market: "OVERSEAS",
} as GeminiTransientRow;

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];

function mount(props: Record<string, unknown>): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(createElement(MarketPriceComparison, props as never));
  });
  return host;
}

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, reviews: [] }),
    } as unknown as Response);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const MPC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
const PANEL = readFileSync(join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"), "utf8");
const WS = readFileSync(join(__dirname, "..", "..", "CommerceWorkspace.tsx"), "utf8");
const PAGE = readFileSync(join(__dirname, "..", "..", "page.tsx"), "utf8");
/** 🔴 금지 검사는 **코드** 에만(주석이 금지를 설명한다 — 아홉 번 걸린 함정). */
const code = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const MPC_CODE = code(MPC);
const WS_CODE = code(WS);
const PANEL_CODE = code(PANEL);

describe("CORE-E2E-CLOSE-05 — 수동 재분석", () => {
  /** 🔴🔴 R-1 — **재진입에서 영역이 사라지지 않는다**(CPO §4 · CEO FAIL 의 직접 반증). */
  it("R-1 rows=null 이어도 재조회 수단이 있으면 영역이 선다", () => {
    const host = mount({ rows: null, snapshotId: "s1", onRecheck: () => {} });
    expect(host.querySelector('[data-testid="market-price-comparison"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="market-recheck-button"]')).not.toBeNull();
    const note = host.querySelector('[data-testid="market-recheck-note"]')?.textContent ?? "";
    /** 🔴 「후보가 없다」로 적지 않는다 — 미조회와 부재는 다른 사실이다. */
    expect(note).toContain("아직 없습니다");
    expect(note).not.toContain("후보가 없습니다");
  });

  /** 🔴 R-2 — 재조회 수단이 **없으면** 전과 같다(기존 계약 보존). */
  it("R-2 onRecheck 가 없으면 rows=null 에서 영역이 서지 않는다", () => {
    const host = mount({ rows: null, snapshotId: "s1" });
    expect(host.querySelector('[data-testid="market-price-comparison"]')).toBeNull();
  });

  /** 🔴🔴 R-3 — **자동 `/check` 가 0 회** 다(CPO §5 「자동이면 FAIL」). */
  it("R-3 렌더만으로 /check 가 호출되지 않는다", () => {
    mount({ rows: null, snapshotId: "s1", onRecheck: () => {} });
    expect(calls.filter((c) => c.url.includes("/price-history/check"))).toHaveLength(0);
    mount({ rows: [SAME, PRESUMED], snapshotId: "s1", onRecheck: () => {} });
    expect(calls.filter((c) => c.url.includes("/price-history/check"))).toHaveLength(0);
  });

  /** 🟢 R-4 — 클릭하면 **넘겨받은 트리거가 1회** 발화한다. */
  it("R-4 버튼 클릭 → 재조회 1회", () => {
    let n = 0;
    const host = mount({ rows: null, snapshotId: "s1", onRecheck: () => n++ });
    const btn = host.querySelector('[data-testid="market-recheck-button"]') as HTMLButtonElement;
    act(() => btn.click());
    expect(n).toBe(1);
  });

  /** 🔴 R-5 — **중복 클릭을 막는다**(진행 중 disabled). */
  it("R-5 진행 중에는 버튼이 잠긴다", () => {
    let n = 0;
    const host = mount({ rows: null, snapshotId: "s1", onRecheck: () => n++, rechecking: true });
    const btn = host.querySelector('[data-testid="market-recheck-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    act(() => btn.click());
    expect(n).toBe(0);
    expect(host.querySelector('[data-testid="market-recheck-note"]')?.textContent ?? "").toContain(
      "분석하고 있습니다",
    );
  });

  /** 🟢🟢 R-6 — 성공 후(= rows 공급) **후보·가격·선택이 전부 선다**(CPO §5 흐름). */
  it("R-6 rows 가 오면 후보·가격·선택이 선다", () => {
    const host = mount({ rows: [SAME, PRESUMED, SIMILAR], snapshotId: "s1", onRecheck: () => {} });
    expect(host.querySelectorAll('[data-testid="mi-same-row"]').length).toBe(1);
    /**
     * 🔴🔴 **둘이다 — 그리고 그것이 올바르다.** 이 fixture 의 `SIMILAR` 은
     *    `matchTruth` 도 `matchReasons` 도 **없다** ⟹ `hasIdentityEvidence` 가 false 라
     *    「Evidence 가 사실상 없는 후보」로 **제외** 된다(CPO §4-C).
     * 🟢 그래서 SAME + PRESUMED **둘** 이 선다. 🔴 「SIMILAR 은 언제나 제외」가 아니다 —
     *    Evidence 가 있는 SIMILAR 은 `close-04 S-3` 에서 **보이는 것** 으로 단언한다.
     */
    expect(host.querySelectorAll('[data-testid="mi-candidate-row"]').length).toBe(2);
    const text = host.textContent ?? "";
    expect(text).toContain("117,000");
    expect(text).toContain("88,000");
    /** 🔴 SIMILAR 는 행도 선택도 없다. */
    /** 🔴 Evidence 없는 SIMILAR 은 **제외** 된다(위 주석) — 그래서 보이지 않는다. */
    expect(text).not.toContain("other.example");
    expect(host.querySelectorAll('[data-testid="mi-candidate-select"]').length).toBe(3);
    /** 🟢 그리고 버튼은 **그대로 같이** 선다(§4 「이미 후보가 있으면 정상 표시」). */
    expect(host.querySelector('[data-testid="market-recheck-button"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="market-recheck-note"]')).toBeNull();
  });

  /** 🟢 R-7 — 선택이 **기존** `candidate-reviews` POST 를 쓴다(복제 0). */
  it("R-7 선택 → 기존 저장 경로", async () => {
    const host = mount({ rows: [PRESUMED], snapshotId: "s1", onRecheck: () => {} });
    const btn = host.querySelector(
      '[data-testid="mi-candidate-row"] [data-testid="mi-select-same"]',
    ) as HTMLButtonElement;
    calls = [];
    await act(async () => {
      btn.click();
    });
    const posts = calls.filter((c) => c.init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.url).toBe("/api/price-history/s1/candidate-reviews");
  });

  /** 🔴🔴 D-1 — **`/check` 구현을 복제하지 않았다**(CPO §3 금지). */
  it("D-1 결론 영역·워크스페이스에 /check 호출이 없다", () => {
    expect(MPC_CODE).not.toContain("price-history/check");
    expect(WS_CODE).not.toContain("price-history/check");
    /** 🟢 owner 는 패널의 기존 하나다. */
    expect(PANEL_CODE.split('fetch("/api/price-history/check"').length - 1).toBe(1);
    /** 🔴 그리고 결론 영역은 **넘겨받은 함수** 만 부른다. */
    expect(MPC_CODE).toContain("onRecheck?.()");
  });

  /** 🔴🔴 D-2 — **자동 호출을 늘리지 않았다**(page.tsx 의 호출 수 불변). */
  it("D-2 page.tsx 의 /check 호출 자리가 둘 그대로다", () => {
    expect(code(PAGE).split('fetch("/api/price-history/check"').length - 1).toBe(2);
    /** 🔴 그 둘은 **첫 저장** 경로다 — 재진입에서 돌지 않는다(그것이 이 WU 의 전제다). */
    expect(PAGE).toContain("isFirstInsert");
  });

  /** 🔴🔴 D-3 — **무한 루프를 막는 ref 패턴**(참조 고정). */
  it("D-3 재조회 트리거가 참조 고정이다", () => {
    expect(PANEL_CODE).toContain("const recheckNowRef = useRef");
    expect(PANEL_CODE).toContain("const stableRecheck = useCallback(");
    /** 🔴 함수 선언을 memo deps 에 직접 넣으면 매 렌더 publish → setState → 루프. */
    expect(PANEL_CODE).toContain("onRecheck: stableRecheck,");
    expect(PANEL_CODE).not.toContain("onRecheck: recheckNow,");
  });

  /** 🔴 D-4 — WU-152 · 선별기 · 가격 집계 **무변경**. */
  it("D-4 보호선이 그대로다", () => {
    expect(WS_CODE).toContain('presentation="HIDDEN"');
    expect(MPC_CODE).toContain('selectMiSameCandidates(rows, "KR")');
    expect(MPC_CODE).toContain('selectPresumedCandidates(rows, "KR")');
    /** 🔴 재조회 구역이 가격 집계 어휘를 쓰지 않는다. */
    const i = MPC_CODE.indexOf('data-testid="market-recheck"');
    expect(i).toBeGreaterThan(0);
    const block = MPC_CODE.slice(i, i + 900);
    for (const f of ["priceTier", "byCurrency", "priceKrw", "reference"]) {
      expect(block).not.toContain(f);
    }
  });

  /** 🔴 D-5 — 내부 토큰 노출 0. */
  it("D-5 재조회 UI 가 내부 토큰을 노출하지 않는다", () => {
    const text = mount({ rows: null, snapshotId: "s1", onRecheck: () => {} }).textContent ?? "";
    for (const t of ["PRESUMED_SAME", "matchTruth", "priceTier", "WEB_SEARCH", "check", "Evidence"]) {
      expect(text).not.toContain(t);
    }
  });
});
