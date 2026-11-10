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
/**
 * 🔵 CLOSE-3 §4 — 기대값을 **운영이 쓰는 그 함수** 로 만든다(상수 복제 0 · 환율표 0).
 * 🔴 그래서 「환율표를 바꿔도 테스트가 따라온다」가 아니라 「**같은 함수를 쓰는가**」를 문다.
 */
import { convertToKrwStrict } from "@commerce/pricing";
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
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 — **fixture 가 «서버» 를 모사한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **임의 환율을 쓰지 않는다.** 1차에 `* 1500` 을 썼다가 이 파일의 하드코딩
 *    기대값과 어긋났다(`45,300,000 ↔ 52,548,000`) — 그 기대값은 **운영이 쓰는 환율표**
 *    에서 나온 숫자다. ⟹ fixture 도 **같은 변환기** 를 불러 그 숫자를 재현한다.
 * 🟢 **테스트에서 부르는 것은 허용된다** — 금지된 것은 **운영 UI** 가 환산하는 것이고
 *    (계약 ②), 여기서 이 함수는 「서버가 이미 환산해 보냈다」를 **모사** 하는 역할이다.
 */
const fixtureDerivedKrw = (amount: number | null | undefined, currency: string | null | undefined) =>
  amount != null && currency && currency !== "KRW"
    ? (convertToKrwStrict(amount, currency)?.amountKrw ?? null)
    : null;
/**
 * 🔴🔴 **운영 GET 경로를 그대로 모사한다.** `toSavedCandidateRows` 는 저장분을 행으로
 *    되돌리기만 하고, 운영은 그 뒤 `market-intelligence.ts` 의 `attachDerivedKrw` 가
 *    **모든 행에** `priceKrwDerived` 를 세운다(POST·GET 동일 계약).
 * 🔴 그 단계를 빼면 fixture 가 **운영에 없는 상태**(칸 없는 행)를 그려 계약이 거짓말한다.
 * 🟢 규칙은 운영과 같다 — 외화 + 금액 있음 ⟹ 숫자 · 그 외 ⟹ `null`.
 */
const restored = (raw: Record<string, unknown>[]): GeminiTransientRow[] =>
  (toSavedCandidateRows(raw.map((r) => candidateReviewRowFromDb(r))) as GeminiTransientRow[]).map(
    (r) => ({
      ...r,
      priceKrwDerived: fixtureDerivedKrw(r.priceAmount, r.priceCurrency),
    }),
  );

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

  it("R2-C-2 🔵🔵 외화 후보도 **환산 KRW 로 확정한다**(CPO 가 전제를 철회했다)", () => {
    /**
     * 🔵🔵🔵 **CPO 지시 방향 전환이다 — 분모 변경이 아니다.**
     *
     * 🔴 이 단언의 1차 전제(「외화는 확정하지 않는다 · 환산이 금지축이다」)는
     *    CLOSE-3 에서 **CPO 가 명시적으로 철회** 했다. 그래서 「버튼 0 · 안내문 1」을
     *    **「버튼 1 · 환산값 전달」로 뒤집는다**(`not.toContain` 뒤집기는 이 자리와
     *    R2-D-1/D-3 뿐이고, 전부 CPO 지시 범위다).
     * 🔴🔴 **그래도 SOURCE 는 불변이다** — 넘어가는 값은 `row.priceAmount`(GBP 37)가
     *    **아니라** 환산된 KRW 다. 그 둘이 같으면(= 환산을 건너뛰었으면) FAIL 한다.
     */
    const rows = fxRows();
    expect(rows.length).toBeGreaterThan(0);
    const confirm = vi.fn();
    const m = mount({ rows, onConfirmPriceKrw: confirm });
    try {
      const btns = [...m.host.querySelectorAll('[data-testid="mi-candidate-confirm-price"]')];
      /** 🔵 외화 후보에도 CTA 가 **선다**. */
      expect(btns.length).toBeGreaterThan(0);
      expect(btns[0].textContent).toBe(CONFIRM_CANDIDATE_PRICE_LABEL);
      (btns[0] as HTMLButtonElement).click();
      expect(confirm).toHaveBeenCalledTimes(1);

      /** 🔴 넘어간 값은 **화면이 이미 보여준 그 환산값** 이다(같은 함수 · 같은 숫자). */
      const first = rows[0];
      const expected = convertToKrwStrict(first.priceAmount as number, first.priceCurrency as string);
      expect(expected, "🔴 분모 — 이 통화의 환율을 모르면 이 축은 측정불가다").not.toBeNull();
      expect(confirm.mock.calls[0][0]).toBe(expected!.amountKrw);
      /** 🔴🔴 **SOURCE ≠ SELLING** — 원본 외화 금액을 그대로 넘기면 FAIL 한다. */
      expect(confirm.mock.calls[0][0]).not.toBe(first.priceAmount);

      /** 🔴 철회된 문구는 **화면에 없다** — 상수는 남아 있어도 소비처가 0 이다. */
      expect(m.host.textContent ?? "").not.toContain(CONFIRM_PRICE_FOREIGN_NOTE);
    } finally {
      m.cleanup();
    }
  });

  it("R2-C-2b 🔵 외화 카드는 **원본 + 환산을 둘 다** 적고, KRW 카드는 환산 줄이 **없다**", () => {
    /**
     * 🔵 CLOSE-3 §2 — **방향 전환에 딸린 새 계약** 이다.
     * 🔴 원본을 **덮어쓰지 않았다**는 것과 **중복 환산이 없다**는 것을 한 자리에서 문다.
     */
    const fx = fxRows();
    expect(fx.length).toBeGreaterThan(0);
    const a = mount({ rows: fx });
    try {
      const card = a.host.querySelector('[data-testid="mi-candidate-row"]');
      expect(card).not.toBeNull();
      /** 🟢 원본 — 통화 코드가 **그대로** 남아 있다(SOURCE 불변). */
      const original = card!.querySelector('[data-testid="mi-candidate-price"]')?.textContent ?? "";
      expect(original).toContain(fx[0].priceCurrency as string);
      /** 🔵 환산 — **별도 줄** 에 「약 ₩…」이 선다. */
      const krwLine = card!.querySelector('[data-testid="mi-candidate-price-krw"]');
      expect(krwLine, "🔴 외화 카드에 환산 줄이 없다").not.toBeNull();
      expect(krwLine!.textContent ?? "").toContain("약 ₩");
    } finally {
      a.cleanup();
    }

    const krw = krwRows();
    expect(krw.length).toBeGreaterThan(0);
    const b = mount({ rows: krw });
    try {
      /** 🔴 `₩88,000` 아래 `약 ₩88,000` 은 **같은 숫자를 두 번** 적는 것이다. */
      expect(b.host.querySelectorAll('[data-testid="mi-candidate-price-krw"]').length).toBe(0);
      expect(
        b.host.querySelectorAll('[data-testid="mi-candidate-price-krw-unavailable"]').length,
      ).toBe(0);
    } finally {
      b.cleanup();
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

  it("R2-D-1 이 파일에 **저장/네트워크** 어휘가 0 이고 환산은 «기존 owner» 만 쓴다", () => {
    /**
     * 🔵 CLOSE-3 §0 — **CPO 지시 방향 전환.** `convertToKrw` 금지를 **철회** 했다
     *    (환산이 후보 카드 안에서 authorized 됐다). 🔴 나머지 셋은 **그대로 금지** 다 —
     *    저장 owner(`priceOverrideKrw` · `updateSalePriceKrw`)와 환율 소유
     *    (`exchangeRate`)를 이 영역이 가지면 두 번째 가격 owner 가 생긴다.
     */
    for (const forbidden of ["priceOverrideKrw", "updateSalePriceKrw", "exchangeRate"]) {
      expect(code).not.toContain(forbidden);
    }
    /**
     * 🔴🔴 그 대신 **어떤 환산인지** 를 못다 — 허용된 것은 「환율을 모르면 `null`」인
     *    `convertToKrwStrict` **하나** 이고, 환율표를 직접 들거나 숫자에 곱하는 것은
     *    **여전히 금지** 다(그 길이 `CAD 64 → 약 ₩64` 를 만든 자리다).
     */
    /**
     * ════════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 — **계약 ② 재지정**(CPO 승인)
     * ════════════════════════════════════════════════════════════════════════
     *
     * 🔴 **느슨해진 것이 아니라 «환산 owner 가 옮겨졌다».** 전 버전은 이 영역이
     *    `convertToKrwStrict` 를 **직접 호출할 것** 을 요구했다. 그런데 그 구조에서
     *    UI 는 환율을 **넘기지 못해** 내장 고정표로 환산했고, 서버는 라이브 환율로
     *    환산했다 ⟹ **같은 후보가 경로에 따라 다른 원화 숫자** 를 가질 수 있었고
     *    그중 하나가 **실제 판매가 확정**(`priceOverrideKrw`) 경로였다.
     * 🟢 그래서 환산 owner 는 **서버 하나** 가 됐고 이 영역은 서버가 행에 실어 보낸
     *    `priceKrwDerived` 를 **읽기만** 한다.
     * 🔴🔴 **보호해야 할 불변식은 그대로 유지한다** — 아래 셋이 그것이다:
     *    ⒜ UI 에 환산 **호출이 없다** ⒝ 환율표를 직접 들지 않는다
     *    ⒞ 숫자에 손으로 곱하지 않는다. ⟹ 환산을 UI 로 되돌리면 **FAIL** 한다.
     */
    expect(code, "🔴 UI 가 다시 환산한다 — 환산 owner 는 서버 하나다").not.toContain(
      "convertToKrwStrict(",
    );
    expect(code, "🔴 서버 파생값을 읽지 않는다").toContain("priceKrwDerived");
    expect(code, "🔴 이 영역이 환율표를 직접 들었다").not.toContain("FIXED_RATES_TO_KRW");
    expect(code, "🔴 환율을 손으로 곱했다").not.toMatch(/priceAmount\s*\*\s*\d/);
  });

  it("R2-D-2 🔴 최종가를 **계산하지 않는다** — prop 을 그대로 쓴다", () => {
    /** 🔴 `finalPriceKrw` 에 산술이 붙으면 그 자리가 두 번째 가격 owner 가 된다. */
    expect(code).not.toMatch(/finalPriceKrw\s*[*+/-]/);
    expect(code).not.toMatch(/finalPriceKrw\s*\?\?\s*recommendedPriceKrw/);
  });

  it("R2-D-3 🔵 확정 handler 는 **KRW 는 그대로 · 외화는 환산값** 을 넘긴다(보정 0)", () => {
    /**
     * 🔵🔵 **CPO 지시 방향 전환.** 1차 단언은 「후보 금액을 **그대로**」였고 그것은
     *    「외화는 확정하지 않는다」는 철회된 전제 위에 서 있었다.
     * 🔴 그래서 축을 **둘로 가른다** — KRW 는 분기해서 그대로, 외화는 환산값.
     *    그리고 🔴 **그 뒤에 산수를 붙이지 않는다**(보정·마진·수수료 0).
     */
    expect(code, "🔴 KRW 분기가 없다 — 원화 후보를 환산에 태우면 중복 환산이다").toContain(
      'row.priceCurrency === "KRW"',
    );
    /**
     * 🔵🔵 **계약 ② 재지정**(CPO 승인) — 「환산 실패는 `null`」이라는 **의미는 유지** 하고
     *    그 구현 모양만 바꾼다. 전엔 `convertToKrwStrict(...)?.amountKrw ?? null` 이라는
     *    **UI 환산 문법** 을 요구했는데, 환산 owner 가 서버로 옮겨졌으므로 이제는
     *    **서버 파생값을 `?? null` 로 받는 것** 이 같은 보호다.
     * 🔴 `?? null` 이 빠지면 `undefined` 가 흘러 숫자를 지어낼 자리가 다시 열린다.
     */
    expect(code, "🔴 환산 실패를 `null` 로 받지 않는다 — 숫자를 지어낼 자리가 열린다").toContain(
      "derivedKrwOf(row)",
    );
    /**
     * 🔴 그 헬퍼가 **`?? null` 을 실제로 한다** — 이름만 같고 `undefined` 를 흘리면
     *    숫자를 지어낼 자리가 다시 열린다(이름 검사로 PASS 를 만들지 않는다).
     */
    expect(code, "🔴 헬퍼가 undefined 를 null 로 닫지 않는다").toContain(
      "row.priceKrwDerived ?? null",
    );
    expect(code, "🔴 handler 에 넘기는 값이 그 변수가 아니다").toContain("onConfirmPriceKrw(krw)");
    expect(code, "🔴 환산값에 산수를 붙였다(두 번째 가격 owner)").not.toMatch(
      /amountKrw\s*[*+/-]\s*\d/,
    );
  });
});
