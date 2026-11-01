/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  FINAL_PRICE_LABEL,
  FINAL_PRICE_NONE_TEXT,
  FINAL_PRICE_SELECTED_BADGE,
  CONFIRM_CANDIDATE_PRICE_LABEL,
  CONFIRM_PRICE_FOREIGN_NOTE,
} from "../recommended-price-copy";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import { toSavedCandidateRows } from "../../../api/price-history/_lib/saved-candidate-rows";
import { candidateReviewRowFromDb } from "../../../api/price-history/_lib/candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UI/UX FINAL SPRINT **R2** — 계약 (STEP 4 CTA · STEP 7 최종 선택 가격)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 입력은 **운영 `candidate_reviews` 실덤프** 다(fixture 조작 0 · 지시서 §16).
 * 🔴 **최종가 owner 는 `priceOverrideKrw` 하나** 이고 이 영역은 **표시 + 확정** 만 한다
 *    (CPO 결정 ⒝). 아래 계약이 그 경계를 양방향으로 잠근다.
 */

const FIX = join(
  __dirname,
  "..",
  "..",
  "..",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
  "ux04-b3-reviews.json",
);
interface Dump {
  legacy: { rows: Record<string, unknown>[] };
  sellerUrl: Record<string, unknown>[];
}
const dump = (): Dump => JSON.parse(readFileSync(FIX, "utf8")) as Dump;
const restored = (raw: Record<string, unknown>[]): GeminiTransientRow[] =>
  toSavedCandidateRows(raw.map((r) => candidateReviewRowFromDb(r))) as GeminiTransientRow[];

const SNAP = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";

function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(MarketPriceComparison, { snapshotId: SNAP, ...props }));
  });
  return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } };
}

/** 🔴 KRW 후보 — 운영 `sellerUrl` 행 중 `miniboutique.co.kr` KRW 88,000 이 실재한다. */
const krwRows = () => restored(dump().sellerUrl).filter((r) => r.priceCurrency === "KRW");
/** 🔴 외화 후보 — 운영 `legacy` 행은 GBP/CAD/EUR 다. */
const fxRows = () => restored(dump().legacy.rows).filter((r) => r.priceCurrency && r.priceCurrency !== "KRW");

/* ═══════════ STEP 4 — 정상 화면에서 「다시 분석」 CTA 가 0 ═══════════ */

describe("R2-A 🔴🔴 STEP 4 — 결과가 있으면 「다시 분석」 CTA 를 그리지 않는다", () => {
  it("R2-A-1 결과가 있을 때(`rows` 존재) CTA 가 **0** 이다 — 계약 C", () => {
    const rows = restored(dump().legacy.rows);
    expect(rows.length).toBeGreaterThan(0);
    const m = mount({ rows, onRecheck: () => {} });
    try {
      expect(m.host.querySelectorAll('[data-testid="market-recheck"]').length).toBe(0);
      expect(m.host.querySelectorAll('[data-testid="market-recheck-button"]').length).toBe(0);
      /** 🟢 그런데 영역과 후보는 **그대로 선다**(버튼만 사라진 것이지 화면이 준 것이 아니다). */
      expect(m.host.querySelector('[data-testid="market-price-comparison"]')).not.toBeNull();
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-row"]').length).toBeGreaterThan(0);
    } finally {
      m.cleanup();
    }
  });

  it("R2-A-2 🔴 결과가 **없을** 때는 CTA 를 **유지** 한다 — 막다른 화면을 만들지 않는다", () => {
    /**
     * 🔴 지우면 CORE-E2E-CLOSE-05 가 고친 그 사고(「셀러가 할 수 있는 일이 0」)로 되돌아간다.
     * 🟢 지시서 §5 가 「다른 목적을 갖는 기능까지 임의 삭제하지 않는다」로 이 경우를 허용한다.
     */
    const m = mount({ rows: null, onRecheck: () => {} });
    try {
      expect(m.host.querySelector('[data-testid="market-recheck-button"]')).not.toBeNull();
      expect(m.host.querySelector('[data-testid="market-recheck-note"]')).not.toBeNull();
    } finally {
      m.cleanup();
    }
  });

  it("R2-A-3 🔴 자동 재조회를 넣지 않았다 — 렌더만으로 `onRecheck` 가 **불리지 않는다**", () => {
    const spy = vi.fn();
    const m = mount({ rows: null, onRecheck: spy });
    try {
      expect(spy).not.toHaveBeenCalled();
    } finally {
      m.cleanup();
    }
    const m2 = mount({ rows: restored(dump().legacy.rows), onRecheck: spy });
    try {
      expect(spy).not.toHaveBeenCalled();
    } finally {
      m2.cleanup();
    }
  });
});

/* ═══════════ STEP 7 — 최종 선택 가격: 표시 · 확정 · 수정 ═══════════ */

describe("R2-B 🔵 STEP 7 — 최종 선택 가격이 **두 시장에 같은 구조로** 선다", () => {
  it("R2-B-1 확정값이 있으면 금액 + 「✓ 선택됨」이 **국내·해외 둘 다** 선다(계약 D-10)", () => {
    const m = mount({ rows: restored(dump().legacy.rows), finalPriceKrw: 85000 });
    try {
      const blocks = [...m.host.querySelectorAll('[data-testid="market-final-price"]')];
      /** 🔴 **둘** 이어야 한다 — 국내 칸 · 해외 칸(같은 컴포넌트가 두 번 마운트된다). */
      expect(blocks.length).toBe(2);
      for (const b of blocks) {
        expect(b.textContent).toContain(FINAL_PRICE_LABEL);
        expect(b.textContent).toContain(FINAL_PRICE_SELECTED_BADGE);
        expect(b.querySelector('[data-testid="market-final-price-amount"]')?.textContent).toContain("85,000");
      }
    } finally {
      m.cleanup();
    }
  });

  it("R2-B-2 🔴 확정값이 없으면 **숫자를 만들지 않는다** — 「0원」·「-」 금지", () => {
    const m = mount({ rows: restored(dump().legacy.rows), finalPriceKrw: null, onOpenPriceEditor: () => {} });
    try {
      const none = [...m.host.querySelectorAll('[data-testid="market-final-price-none"]')];
      expect(none.length).toBe(2);
      expect(none[0].textContent).toBe(FINAL_PRICE_NONE_TEXT);
      expect(m.host.querySelectorAll('[data-testid="market-final-price-amount"]').length).toBe(0);
      /** 🔴 「0」이 최종가 자리에 서지 않는다. */
      for (const b of m.host.querySelectorAll('[data-testid="market-final-price"]')) {
        expect(b.textContent).not.toMatch(/₩\s*0\b|(^|[^\d])0원/);
      }
    } finally {
      m.cleanup();
    }
  });

  it("R2-B-3 🔴 **편집기를 만들지 않았다** — 이 영역에 입력칸이 0 이다(CPO 결정 ⒝)", () => {
    const m = mount({ rows: restored(dump().legacy.rows), finalPriceKrw: 85000, onOpenPriceEditor: () => {} });
    try {
      for (const b of m.host.querySelectorAll('[data-testid="market-final-price"]')) {
        expect(b.querySelectorAll("input").length).toBe(0);
        expect(b.querySelectorAll("textarea").length).toBe(0);
      }
      /** 🟢 수정은 **기존 편집기로 보낸다** — 링크 하나뿐이다. */
      expect(m.host.querySelectorAll('[data-testid="market-edit-final-price"]').length).toBe(2);
    } finally {
      m.cleanup();
    }
  });

  it("R2-B-4 🔴 갈 곳이 없으면 「가격 수정」을 그리지 않는다", () => {
    const m = mount({ rows: restored(dump().legacy.rows), finalPriceKrw: 85000 });
    try {
      expect(m.host.querySelectorAll('[data-testid="market-edit-final-price"]').length).toBe(0);
    } finally {
      m.cleanup();
    }
  });

  it("R2-B-5 「가격 수정」을 누르면 **전달받은 handler** 가 불린다(이 영역이 고치지 않는다)", () => {
    const open = vi.fn();
    const m = mount({ rows: restored(dump().legacy.rows), finalPriceKrw: 85000, onOpenPriceEditor: open });
    try {
      (m.host.querySelector('[data-testid="market-edit-final-price"]') as HTMLButtonElement).click();
      expect(open).toHaveBeenCalledTimes(1);
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════ STEP 7 — 후보 가격에서 확정 (KRW 만) ═══════════ */

describe("R2-C 🔵 「이 가격으로 확정」 — 🔴 **원화 후보에서만** 그린다(환산 금지)", () => {
  it("R2-C-1 KRW 후보에는 CTA 가 서고, 누르면 **그 후보의 금액** 이 그대로 넘어간다", () => {
    const rows = krwRows();
    /** 🔴 분모 — 운영에 KRW 후보가 실재한다(없으면 이 축은 측정불가다). */
    expect(rows.length).toBeGreaterThan(0);
    const confirm = vi.fn();
    const m = mount({ rows, onConfirmPriceKrw: confirm });
    try {
      const btns = [...m.host.querySelectorAll('[data-testid="mi-candidate-confirm-price"]')];
      expect(btns.length).toBeGreaterThan(0);
      expect(btns[0].textContent).toBe(CONFIRM_CANDIDATE_PRICE_LABEL);
      (btns[0] as HTMLButtonElement).click();
      expect(confirm).toHaveBeenCalledTimes(1);
      /** 🔴 **환산하지 않는다** — 후보가 들고 있던 숫자 그대로여야 한다. */
      expect(confirm.mock.calls[0][0]).toBe(rows[0].priceAmount);
    } finally {
      m.cleanup();
    }
  });

  it("R2-C-2 🔴🔴 외화 후보에는 CTA 를 그리지 않고 **이유를 적는다**(조용히 빼지 않는다)", () => {
    const rows = fxRows();
    expect(rows.length).toBeGreaterThan(0);
    const confirm = vi.fn();
    const m = mount({ rows, onConfirmPriceKrw: confirm });
    try {
      /** 🔴 환산이 금지축이라 외화는 확정할 수 없다 — 버튼 0. */
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-confirm-price"]').length).toBe(0);
      /** 🟢 그런데 **왜 없는지** 가 화면에 있다. */
      const notes = [...m.host.querySelectorAll('[data-testid="mi-candidate-confirm-unavailable"]')];
      expect(notes.length).toBeGreaterThan(0);
      expect(notes[0].textContent).toBe(CONFIRM_PRICE_FOREIGN_NOTE);
    } finally {
      m.cleanup();
    }
  });

  it("R2-C-3 🔴 handler 가 없으면 **버튼도 안내문도** 그리지 않는다(갈 곳 없는 버튼 금지)", () => {
    const m = mount({ rows: krwRows() });
    try {
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-confirm-price"]').length).toBe(0);
      expect(m.host.querySelectorAll('[data-testid="mi-candidate-confirm-unavailable"]').length).toBe(0);
    } finally {
      m.cleanup();
    }
  });

  it("R2-C-4 🔴🔴 확정이 **candidate 원본 가격을 바꾸지 않는다**(§12 · M1·M2)", () => {
    const rows = krwRows();
    const before = rows.map((r) => ({ a: r.priceAmount, c: r.priceCurrency, u: r.discoveredUrl }));
    const m = mount({ rows, onConfirmPriceKrw: () => {} });
    try {
      (m.host.querySelector('[data-testid="mi-candidate-confirm-price"]') as HTMLButtonElement).click();
      /** 🔴 입력 배열이 **그대로** 다 — 이 영역은 후보 데이터를 수정하지 않는다. */
      expect(rows.map((r) => ({ a: r.priceAmount, c: r.priceCurrency, u: r.discoveredUrl }))).toEqual(before);
      /** 🔴 그리고 화면의 후보 가격 글자도 그대로다. */
      expect(m.host.querySelector('[data-testid="mi-candidate-price"]')?.textContent).toContain("KRW");
    } finally {
      m.cleanup();
    }
  });
});

/* ═══════════ 소스 축 — owner 를 둘로 만들지 않았다 ═══════════ */

describe("R2-D 🔴 owner 경계 — 이 영역이 최종가를 **만들거나 저장하지 않는다**", () => {
  const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("R2-D-1 이 파일에 **저장/네트워크/환산** 어휘가 0 이다", () => {
    for (const forbidden of ["priceOverrideKrw", "updateSalePriceKrw", "exchangeRate", "convertToKrw"]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("R2-D-2 🔴 최종가를 **계산하지 않는다** — prop 을 그대로 쓴다", () => {
    /** 🔴 `finalPriceKrw` 에 산술이 붙으면 그 자리가 두 번째 가격 owner 가 된다. */
    expect(code).not.toMatch(/finalPriceKrw\s*[*+/-]/);
    expect(code).not.toMatch(/finalPriceKrw\s*\?\?\s*recommendedPriceKrw/);
  });

  it("R2-D-3 🟢 확정 handler 는 **후보 금액을 그대로** 넘긴다(환산·보정 0)", () => {
    expect(code).toContain("onConfirmPriceKrw(row.priceAmount as number)");
  });
});
