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

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **UNIFIED-UX-1 ⑦ 에서 이 파일의 «주제가 뒤집혔다». 의도된 변경이다.**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 전 주제: 「후보 **선택** → 기존 저장 배선」. 이 파일이 지키던 것은 셋이다 —
 *    ⒜ SAME·PRESUMED 후보를 **고를 수 있다** ⒝ 그 선택이 **기존 POST** 를 쓴다(복제 0)
 *    ⒞ `SIMILAR` 은 **고를 수 없다**.
 * 🔴🔴 CPO 결정(⒝ · 2026-11-09) — **선택 UI 를 제거** 한다. CEO 가 원한 것은 셀러가
 *    후보를 하나씩 고르는 화면이 아니라 **시스템 판단과 근거** 를 보여주는 화면이다.
 * 🟢 그래서 ⒜⒝를 **「그 자리에 「우리 판단」이 선다」 + 「저장 경로는 보존됐다」** 로 옮긴다.
 *    ⒞ 는 **그대로** 다(SIMILAR 은 행 자체가 서지 않는다 — 한 글자도 안 바꿨다).
 * 🔴🔴 **그 대가를 파일이 직접 적는다** — 화면에서 POST 를 **유발할 수 없다** ⟹
 *    **GT 신규 누적 중단**(CPO 인정). 「계속 누적된다」로 읽히지 않게 못박는다.
 */
describe("CORE-E2E-CLOSE-04 — 선택 UI 제거 · 저장 «경로» 보존", () => {
  /** 🟢 S-1 — SAME 후보 자리에 **「우리 판단」** 이 선다(선택 UI 는 0). */
  it("S-1 SAME 후보에 「우리 판단」이 서고 선택 UI 는 없다", () => {
    const host = mount(ROWS);
    const same = host.querySelector('[data-group="LIKELY"] [data-testid="mi-candidate-row"]');
    expect(same).not.toBeNull();
    expect(same!.querySelector('[data-testid="mi-candidate-judgement"]')).not.toBeNull();
    expect(same!.querySelector('[data-testid="mi-candidate-select"]')).toBeNull();
    expect(same!.querySelector('[data-testid="mi-select-same"]')).toBeNull();
  });

  /** 🟢 S-2 — 보류 후보도 **같은 구조** 다(승격 아님 · 선택 UI 0). */
  it("S-2 PRESUMED_SAME 후보도 「우리 판단」이 서고 선택 UI 는 없다", () => {
    const host = mount(ROWS);
    const presumed = host.querySelector('[data-testid="mi-candidate-row"]');
    expect(presumed).not.toBeNull();
    expect(presumed!.querySelector('[data-testid="mi-candidate-judgement"]')).not.toBeNull();
    expect(presumed!.querySelector('[data-testid="mi-candidate-select"]')).toBeNull();
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

  /**
   * 🔵🔵🔵 **S-4·5·6·7 을 «하나» 로 합쳐 방향을 뒤집었다**(UNIFIED-UX-1 ⑦).
   *
   * 🔴 넷 다 **버튼 클릭** 으로 저장 경로를 증명하던 테스트다. 선택 UI 가 제거돼
   *    그 클릭 자체가 **존재하지 않는다** ⟹ 같은 모양으로는 증명할 수 없다.
   * 🟢 그래서 **지키던 뜻 둘** 을 그대로 옮긴다 —
   *    ⒜ 화면이 **새 저장을 유발하지 못한다**(= 선택 UI 가 정말 사라졌다)
   *    ⒝ 그럼에도 **저장 경로·데이터는 보존** 된다(CPO 「기존 API·DB 보존」).
   * 🔴 **약화가 아니다** — 전에는 「POST 가 1회 난다」였고 지금은 「**0회** 난다」를
   *    같은 강도로 단언한다. POST 가 되살아나면 FAIL 한다.
   */
  it("S-4·5·6·7 🔴 화면은 새 판정을 저장하지 못한다 · 저장 «경로» 는 보존된다", async () => {
    const host = mount(ROWS);
    /** ⒜ 클릭할 버튼이 하나도 없다(네 상태 전부). */
    for (const v of ["same", "similar", "different", "undecided"]) {
      expect(host.querySelector(`[data-testid="mi-select-${v}"]`)).toBeNull();
    }
    expect(host.querySelector('[data-testid="mi-candidate-select"]')).toBeNull();
    expect(host.querySelector('[data-testid="mi-candidate-note"]')).toBeNull();
    calls = [];
    await act(async () => {
      await Promise.resolve();
    });
    /** 🔴🔴 그래서 **POST 가 0회** 다 ⟹ GT 신규 누적 중단(CPO 인정). */
    expect(
      calls.filter((c) => c.init?.method === "POST"),
      "🔴 화면이 새 판정을 저장하면 ⑦ 이 안 된 것이다",
    ).toHaveLength(0);
    /** 🟢 ⒝ 저장 구현은 **그대로 살아 있다**(아래 D-1 이 「한 곳뿐」까지 본다). */
    expect(HOOK).toContain('method: "POST"');
    expect(HOOK).toContain("candidate-reviews");
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
