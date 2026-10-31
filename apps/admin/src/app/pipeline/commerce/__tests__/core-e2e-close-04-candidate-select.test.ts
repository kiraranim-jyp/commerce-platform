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
 * 🔵🔵🔵 CORE-E2E-CLOSE-04 — **셀러가 후보를 «고를» 수 있다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 종료 질문: 「셀러가 화면에서 마음에 드는 동일상품 가능 후보를 선택하고,
 *    **기존 저장 흐름** 으로 넘길 수 있는가?」
 *
 * 🔴🔴 그 저장 로직은 WU-152 이후 `MiPanelView` 안에 갇혀 있었다(패널이 `HIDDEN` →
 *    `return null` ⟹ 선택 UI 가 화면에서 사라졌다). 🟢 그래서 **복제하지 않고 옮겼다**
 *    → `candidate-review.ts` 의 `useCandidateReview` 하나(CPO §3·§4).
 *
 * 🔴 새 저장 API **0** · POST 중복 구현 **0** · `CommerceWorkspace` 저장 state **0** ·
 *    `presentation="HIDDEN"` **무변경** · 가격 집계 **무변경** · Identity **무변경**.
 */

const SNAPSHOT = "snap-1";

const KR_SAME: GeminiTransientRow = {
  domain: "miniboutique.co.kr",
  title: "메인스토리 버블 스웨트셔츠 AW26MS185",
  discoveredUrl: "https://miniboutique.co.kr/product/detail.html?product_no=1",
  crossSellerVerdict: "SAME",
  priceAmount: 117000,
  priceCurrency: "KRW",
  priceStatus: "VERIFIED_CURRENT",
  market: "KR",
  soldOut: false,
  source: "WEB_SEARCH",
};

const KR_PRESUMED: GeminiTransientRow = {
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
};

/** 🔴 `SIMILAR` — 두 선택기 어디에도 들지 못한다 ⟹ 선택 UI 가 서지 않아야 한다. */
const OS_SIMILAR: GeminiTransientRow = {
  domain: "other.example",
  title: "Similar looking tee",
  discoveredUrl: "https://other.example/p/3",
  crossSellerVerdict: "SIMILAR",
  priceAmount: 19,
  priceCurrency: "GBP",
  priceStatus: "VERIFIED_CURRENT",
  market: "OVERSEAS",
  soldOut: false,
  source: "OVERSEAS_AUTO",
};

const ROWS = [KR_SAME, KR_PRESUMED, OS_SIMILAR];

type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];

function mount(
  rows: GeminiTransientRow[],
  props: { snapshotId?: string | null } = { snapshotId: SNAPSHOT },
): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(createElement(MarketPriceComparison, { rows, ...props }));
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
const HOOK = readFileSync(join(__dirname, "..", "use-candidate-review.ts"), "utf8");
const WS = readFileSync(join(__dirname, "..", "..", "CommerceWorkspace.tsx"), "utf8");

/**
 * 🔴🔴 **주석을 벗긴다.** 이 저장소가 여덟 번 걸린 함정이고 이번에 아홉 번째로 걸렸다 —
 *    「`candidate-reviews` POST 중복 구현 금지」를 **설명하는 내 주석** 때문에
 *    「중복 구현이 있다」는 거짓 FAIL 이 났다(D-1·D-2).
 * 🔴 금지 검사는 **코드** 에만 돌린다.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}
const MPC_CODE = code(MPC);
const PANEL_CODE = code(PANEL);
const WS_CODE = code(WS);

describe("CORE-E2E-CLOSE-04 — 후보 선택 → 기존 저장 배선", () => {
  /** 🟢 S-1 — **SAME 후보를 고를 수 있다**(CPO §8-1). */
  it("S-1 SAME 후보에 선택 UI 가 선다", () => {
    const host = mount(ROWS);
    const same = host.querySelector('[data-testid="mi-same-row"]');
    expect(same).not.toBeNull();
    expect(same!.querySelector('[data-testid="mi-candidate-select"]')).not.toBeNull();
    expect(same!.querySelector('[data-testid="mi-select-same"]')).not.toBeNull();
  });

  /** 🟢 S-2 — **보류 후보도 고를 수 있다**(CPO §8-2 · §6 승격 아님). */
  it("S-2 PRESUMED_SAME 후보에 선택 UI 가 선다", () => {
    const host = mount(ROWS);
    const presumed = host.querySelector('[data-testid="mi-candidate-row"]');
    expect(presumed).not.toBeNull();
    expect(presumed!.querySelector('[data-testid="mi-candidate-select"]')).not.toBeNull();
  });

  /** 🔴 S-3 — **`SIMILAR` 은 고를 수 없다**(CPO §8-3). 행 자체가 서지 않는다. */
  it("S-3 SIMILAR 후보는 행도 선택 UI 도 없다", () => {
    const host = mount(ROWS);
    const text = host.textContent ?? "";
    /**
     * 🔴🔴 **내 1차 수정이 틀렸고 원래 단언이 맞았다.**
     *    CPO §4-B 는 「Evidence 가 충분한 SIMILAR」을 보이게 하라는 것이고,
     *    이 fixture 의 SIMILAR 은 `matchTruth` 도 `matchReasons` 도 **없다**
     *    ⟹ `hasIdentityEvidence` 가 false 라 **정확히 제외** 된다(CPO §4-C).
     * 🟢 Evidence 가 있는 SIMILAR 이 보이는 것은 `CAND-04` 가 단언한다.
     */
    expect(text).not.toContain("other.example");
    expect(text).not.toContain("Similar looking tee");
    /** 🔴 그 금액도 가격 축에 없다(WU-141-R3 가 지키는 그 성질). */
    expect(text).not.toContain("19");
    /**
     * 🔴🔴 **총 개수로 세지 않는다 — 이 테스트의 축은 「SIMILAR 이 없다」 다.**
     *    CANDIDATE-EVIDENCE-VISIBILITY-01 이후 `SAME` 행은 **가격 행** 과
     *    **후보 리스트** 양쪽에 서므로 선택 UI 총 개수가 3 이다(SAME×2 + PRESUMED×1).
     * 🟡 그 중복은 **CPO 판정 사안으로 보고** 했다(가격 행에서 선택을 뺄 것인가).
     * 🟢 여기서 지키는 성질은 **후보 리스트에 SIMILAR 이 오지 않는다** 이므로
     *    그 축으로 직접 단언한다 — 총 개수에 흔들리지 않는다.
     */
    const rows = Array.from(host.querySelectorAll('[data-testid="mi-candidate-row"]'));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.textContent ?? "").not.toContain("other.example");
  });

  /** 🟢🟢 S-4 + S-5 — 클릭이 **기존 `candidate-reviews` POST** 를 부른다(§8-4·5). */
  it("S-4·5 선택하면 기존 저장 경로로 POST 한다", async () => {
    const host = mount(ROWS);
    /**
     * 🔴 **첫 행을 집지 않는다** — 리스트가 하나가 되어 맨 위가 SAME 행이다.
     *    보류 후보의 저장을 재는 테스트이므로 **그 판매처 행** 을 지목한다.
     */
    const row = Array.from(
      host.querySelectorAll('[data-testid="mi-candidate-row"]'),
    ).find((n) => (n.textContent ?? "").includes("biskuit.kr"));
    expect(row, "🔴 보류 후보 행이 리스트에 없다").toBeTruthy();
    const btn = row!.querySelector(
      '[data-testid="mi-select-same"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    calls = [];
    await act(async () => {
      btn!.click();
    });
    const posts = calls.filter((c) => c.init?.method === "POST");
    expect(posts).toHaveLength(1);
    /** 🔴 **기존** 주소다 — 새 API 를 만들지 않았다. */
    expect(posts[0]!.url).toBe(`/api/price-history/${SNAPSHOT}/candidate-reviews`);
    const body = JSON.parse(String(posts[0]!.init!.body)) as Record<string, unknown>;
    expect(body).toEqual({ candidateUrl: KR_PRESUMED.discoveredUrl, humanVerdict: "SAME" });
  });

  /** 🟢 S-6 — **「저장됐다」를 말한다**(§8-6 · WU-131 §8 「눌렀다」와 다른 사실). */
  it("S-6 저장 상태가 화면에 선다", async () => {
    const host = mount(ROWS);
    const btn = host.querySelector(
      '[data-testid="mi-same-row"] [data-testid="mi-select-same"]',
    ) as HTMLButtonElement;
    await act(async () => {
      btn.click();
    });
    const save = host.querySelector('[data-testid="mi-select-save"]')?.textContent ?? "";
    expect(save).toContain("저장");
    /** 🟢 그리고 고른 것이 **눌린 상태** 로 남는다(재진입 시 보이는 그 성질). */
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  /**
   * 🔴 S-7 — 식별자가 없으면 **저장했다고 말하지 않는다**(기존 규약).
   *    🟢 그래도 선택 자체는 막지 않는다 — 화면 state 로 남는다.
   */
  it("S-7 snapshotId 가 없으면 POST 하지 않고 「저장됨」도 말하지 않는다", async () => {
    const host = mount(ROWS, { snapshotId: null });
    const btn = host.querySelector(
      '[data-testid="mi-same-row"] [data-testid="mi-select-same"]',
    ) as HTMLButtonElement;
    calls = [];
    await act(async () => {
      btn.click();
    });
    expect(calls.filter((c) => c.init?.method === "POST")).toHaveLength(0);
    expect(host.querySelector('[data-testid="mi-select-save"]')).toBeNull();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  /** 🔴🔴 D-1 — **저장 구현은 하나** 다(§4 「POST 중복 구현 ❌」). */
  it("D-1 candidate-reviews POST 구현이 한 곳뿐이다", () => {
    expect(HOOK).toContain('method: "POST"');
    /** 🔴 패널에는 **구현이 없다** — 주석만 남았다(이동의 증거). */
    const panelPost = PANEL_CODE.split("/candidate-reviews`")
      .slice(1)
      .filter((s) => s.includes('method: "POST"'));
    expect(panelPost).toHaveLength(0);
    /** 🔴 결론 영역도 **자기 POST 를 쓰지 않는다** — 훅을 쓴다. */
    expect(MPC_CODE).not.toContain("candidate-reviews");
    expect(MPC_CODE).toContain("useCandidateReview(snapshotId)");
  });

  /** 🔴🔴 D-2 — `CommerceWorkspace` 에 **저장 state 를 만들지 않았다**(§4). */
  it("D-2 워크스페이스는 식별자만 내려보낸다", () => {
    expect(WS_CODE).toContain("snapshotId={snapshotId}");
    for (const forbidden of ["candidate-reviews", "reviewSaveState", "setDomesticReview"]) {
      expect(WS_CODE).not.toContain(forbidden);
    }
  });

  /** 🔴🔴 D-3 — **WU-152 불변**(§8-7). 패널을 되살리지 않았다. */
  it("D-3 presentation=\"HIDDEN\" 이 그대로다", () => {
    expect(WS_CODE).toContain('presentation="HIDDEN"');
    /** 🔴 패널의 훅은 **꺼져 있다** — 같은 화면에 활성 owner 가 둘이 되지 않는다. */
    expect(PANEL_CODE).toContain('enabled: presentation !== "HIDDEN"');
  });

  /** 🔴🔴 D-4 — **가격 집계 불변**(§8-8). 선택이 집계에 들어가지 않는다. */
  it("D-4 선택은 가격 집계에 들어가지 않는다", () => {
    const i = MPC_CODE.indexOf("function CandidateSelect");
    expect(i).toBeGreaterThan(0);
    const block = MPC_CODE.slice(i, MPC_CODE.indexOf("function MarketColumn", i));
    for (const forbidden of ["priceTier", "reference", "byCurrency", "priceKrw", "selectMiSame"]) {
      expect(block).not.toContain(forbidden);
    }
    /** 🔴 그리고 선별기 둘은 **한 글자도 안 바뀌었다**(CLOSE-03 계약이 축을 잠근다). */
    expect(MPC_CODE).toContain('selectMiSameCandidates(rows, "KR")');
    expect(MPC_CODE).toContain('selectPresumedCandidates(rows, "KR")');
  });

  /** 🔴 D-5 — **내부 토큰 노출 0**(선택 UI 를 더해도 그대로다). */
  it("D-5 선택 UI 가 내부 토큰을 노출하지 않는다", () => {
    const text = mount(ROWS).textContent ?? "";
    for (const token of [
      "PRESUMED_SAME",
      "matchTruth",
      "TEXT_CONFIRMED",
      "priceTier",
      "COMPARISON",
      "candidate_reviews",
      "WEB_SEARCH",
      "threshold",
    ]) {
      expect(text).not.toContain(token);
    }
  });

  /** 🔴 D-6 — 어휘 owner 는 **하나** 다(새 문구를 만들지 않았다). */
  it("D-6 선택 버튼 문구를 새로 만들지 않았다", () => {
    expect(MPC_CODE).toContain("HUMAN_REVIEW_BUTTON[v]");
    expect(MPC_CODE).toContain("SAVE_STATE_TEXT[save]");
    /** 🔴 DB check constraint 와 같은 어휘를 쓴다. */
    expect(MPC_CODE).toContain("HUMAN_REVIEW_VALUES.map");
  });
});
