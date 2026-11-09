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
    /**
     * 🔵 CANDIDATE-UX-REFINE-04 A — SAME 행의 자리가 **접힘 안** 으로 하나가 됐다.
     * 🔴 단언의 뜻(「후보·가격·선택이 전부 선다」)은 그대로이고 좌표만 옮긴다.
     */
    expect(host.querySelectorAll('[data-group="LIKELY"] [data-testid="mi-candidate-row"]').length).toBe(1);
    /** 🔴 D1 — 중복 surface 가 되살아나면 FAIL 한다. */
    expect(host.querySelectorAll('[data-testid="mi-same-row"]').length).toBe(0);
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
    /**
     * 🔵 CANDIDATE-UX-REFINE-04 A — **3 → 2.** 전에는 SAME 후보가 `mi-same-row` 에
     *    **한 번 더** 서서 선택 UI 도 하나 더 있었다(= 중복). 그 surface 를 없앴으므로
     *    선택 UI 는 **후보 행 수와 같아야 한다**.
     * 🟢 그래서 상수 2 가 아니라 **행 수에서 파생** 시킨다 — 둘이 갈라지면 FAIL 한다.
     */
    /**
     * 🔵🔵 **UNIFIED-UX-1 ⑦ 에서 대상이 바뀌었다 — 뜻은 그대로다.**
     *    지키던 것은 「후보 행과 1:1 이고 중복 surface 가 없다」였고, 선택 UI 가
     *    제거되면서 그 1:1 의 대상이 **「우리 판단」 영역** 이 됐다(CPO 승인 ⒝).
     * 🔴 그리고 선택 UI 가 **0** 임을 새로 단언한다(되살아나면 FAIL).
     */
    expect(host.querySelectorAll('[data-testid="mi-candidate-judgement"]').length).toBe(
      host.querySelectorAll('[data-testid="mi-candidate-row"]').length,
    );
    expect(host.querySelectorAll('[data-testid="mi-candidate-select"]')).toHaveLength(0);
    /**
     * ════════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 UI/UX FINAL SPRINT R2 STEP 4 — **이 단언이 «뒤집혔다». 의도된 변경이다**
     * ════════════════════════════════════════════════════════════════════════
     *
     * 🔴 전에는 「후보가 있어도 버튼은 **그대로 같이** 선다」였다(CORE-E2E-CLOSE-05 §4).
     * 🔴 CPO 결정 ②(2026-11-01)가 그것을 **제품 UX 결함** 으로 판정했다 —
     *    「사용자가 **왜 다시 분석해야 하는지** 알 수 없다」. ⟹ **결과가 있으면 CTA 0.**
     * 🟢 그래서 **단언을 약화하지 않고 «방향을 바꿔» 강화** 한다 — 아래 두 줄이
     *    「결과 있음 ⟹ CTA 없음」을 **양방향으로** 문다(R2-A-1 과 같은 뜻).
     * 🔴🔴 **그러나 보호는 남긴다** — 결과가 **없을** 때 버튼이 사라지면 CORE-E2E-CLOSE-05
     *    가 고친 그 사고(「셀러가 할 수 있는 일이 0」)로 되돌아간다. 그 축은
     *    `r2-final-price-and-cta` 의 **R2-A-2** 가 지킨다(이 파일에서 잃지 않았다).
     */
    expect(host.querySelector('[data-testid="market-recheck-button"]')).toBeNull();
    expect(host.querySelector('[data-testid="market-recheck"]')).toBeNull();
    expect(host.querySelector('[data-testid="market-recheck-note"]')).toBeNull();
    /** 🟢 그런데 **후보와 가격은 그대로 선다** — 버튼만 사라진 것이지 화면이 준 것이 아니다. */
    expect(host.querySelectorAll('[data-testid="mi-candidate-row"]').length).toBe(2);
  });

  /**
   * 🔵🔵🔵 **UNIFIED-UX-1 ⑦ 에서 이 계약이 «뒤집혔다». 의도된 변경이고 이유를 적는다.**
   *
   * 🔴 전 계약: 「선택 버튼을 누르면 기존 `candidate-reviews` POST 가 **1회** 나간다」.
   *    그 계약이 지키던 것은 **「저장 경로를 복제하지 않았다」** 였다.
   * 🔴🔴 CPO 결정(⒝ · 2026-11-09) — **선택 UI 를 제거** 한다(셀러에게 고르라고 하지
   *    않는다). ⟹ 그 **클릭 경로가 더는 존재하지 않는다.**
   * 🟢 그래서 단언을 **「경로가 보존됐다」** 로 옮긴다 — 저장 **API·훅·DB 는 그대로** 이고
   *    (CPO 「기존 API·DB 보존」) 끊긴 것은 **새 입력** 하나다.
   * 🔴🔴 **그 대가를 계약이 직접 적는다** — 화면이 POST 를 **유발할 수 없다** ⟹
   *    **GT 신규 누적 중단**(CPO 인정). 「계속 누적된다」로 읽히지 않게 못박는다.
   */
  it("R-7 🔴 선택 UI 는 없고 저장 «경로» 는 보존된다(GT 신규 누적 중단)", async () => {
    const host = mount({ rows: [PRESUMED], snapshotId: "s1", onRecheck: () => {} });
    /** 🔴 클릭할 버튼이 **없다**. */
    expect(host.querySelector('[data-testid="mi-select-same"]')).toBeNull();
    calls = [];
    await act(async () => {
      await Promise.resolve();
    });
    /** 🔴🔴 그래서 화면이 POST 를 **유발하지 못한다** = 새 사람 판정 입력 0. */
    expect(
      calls.filter(
        (c) => c.init?.method === "POST" && String(c.url).includes("candidate-reviews"),
      ),
      "🔴 화면에서 새 판정이 저장되면 ⑦ 이 안 된 것이다",
    ).toHaveLength(0);
    /**
     * 🟢 그러나 **경로 자체는 살아 있다** — 훅과 엔드포인트가 그대로다(복제 0 · 삭제 0).
     *    🔴 이 줄이 깨지면 「데이터·API 보존」(CPO 조건)이 무너진 것이다.
     */
    expect(MPC_CODE).toContain("useCandidateReview(snapshotId)");
    expect(MPC_CODE).toContain("reviewApi");
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
