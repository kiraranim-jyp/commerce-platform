/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { selectMiSameCandidates, selectPresumedCandidates } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-03 — **결론 영역이 후보와 가격을 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CEO 육안 **FAIL** 이 이 파일의 이유다 — 「국내/해외 가격 비교 후보가
 *    사용자 화면에 노출되지 않는다」. 원인은 Identity 도 가격정책도 아니었다:
 * ```
 * WU-152  CommerceWorkspace:3849  presentation="HIDDEN"  → 패널이 return null
 *         ⟹ 그 «안» 의 출처별 후보 구역(모든 행을 그리던 곳)이 함께 사라졌다
 * 결론영역 selectMiSameCandidates = SAME + 판매중 + 가격확인  (가격 집계 축)
 *         ⟹ PRESUMED_SAME 후보와 그 가격이 **화면 어디에도 없다**
 * ```
 * 🔴 `selectMiSameCandidates` 주석이 「사라지는 것은 아니다 — MI 패널의 출처별
 *    후보 구역이 «모든 행» 을 그린다」고 약속하는데 **그 전제가 깨져 있었다.**
 *
 * 🟢 그래서 CPO §2 대로 **패널을 되살리지 않고** 결론 영역에 구역 하나를 세웠다.
 * 🔴 `selectMiSameCandidates` **변경 0** · `presentation="HIDDEN"` **변경 0** ·
 *    판정 **0** · 가격 집계 **0** · Search **0** · 공급 **0**.
 *
 * 🟢 입력은 **실측 후보** 다(DIF-02 · 새 Search 0).
 */

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

/** 🟢 국내 보류 후보 — 가격이 **있다**. 전까지 이 행이 화면에 없었다. */
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

/** 🟢 해외 보류 후보 — 가격이 **없다**(화면이 「가격 미확인」이라 적어야 한다). */
const OS_PRESUMED_NO_PRICE: GeminiTransientRow = {
  domain: "trenbe.com",
  title: "Bobo Choses Hug Hairy Monster T-Shirt",
  discoveredUrl: "https://global.trenbe.com/products/3",
  crossSellerVerdict: "PRESUMED_SAME",
  market: "OVERSEAS",
  source: "OVERSEAS_AUTO",
};

const OS_PRESUMED_PRICED: GeminiTransientRow = {
  domain: "cissywears.com",
  title: "Bobo Choses Baby Hug Hairy Monster T-Shirt",
  discoveredUrl: "https://cissywears.com/products/4",
  crossSellerVerdict: "PRESUMED_SAME",
  priceAmount: 33,
  priceCurrency: "GBP",
  priceStatus: "VERIFIED_CURRENT",
  market: "OVERSEAS",
  source: "OVERSEAS_AUTO",
};

const ROWS = [KR_SAME, KR_PRESUMED, OS_PRESUMED_NO_PRICE, OS_PRESUMED_PRICED];

function mount(rows: GeminiTransientRow[]): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(
      /**
       * 🔴 `rows` **하나만** 넘긴다 — 이 컴포넌트에 `judgement` prop 은 **없다**
       *    (🟢 typecheck 가 내 1차 하니스의 그 추측을 잡았다. `as never` 로 가리지
       *     않았다 — 이 트랙에서 그 행위가 거짓 결론을 낸 적이 있다).
       */
      createElement(MarketPriceComparison, { rows }),
    );
  });
  return host;
}

const SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8");
const SEL = readFileSync(join(__dirname, "..", "mi-same-candidates.ts"), "utf8");

describe("CORE-E2E-CLOSE-03 — 동일 가능성 후보 구역", () => {
  /** 🔴 A-1 — **선택기가 보류만 고른다.** SAME 이 들어오면 같은 행이 두 번 선다. */
  it("A-1 선택기는 PRESUMED 만 고르고 SAME 은 버린다", () => {
    const kr = selectPresumedCandidates(ROWS, "KR");
    expect(kr.map((r) => r.domain)).toEqual(["biskuit.kr"]);
    const os = selectPresumedCandidates(ROWS, "OVERSEAS");
    expect(os.map((r) => r.domain).sort()).toEqual(["cissywears.com", "trenbe.com"]);
    /** 🔴 가격 집계 축과 **행이 겹치지 않는다.** */
    const sameKr = selectMiSameCandidates(ROWS, "KR");
    const presumedUrls = new Set(kr.concat(os).map((r) => r.discoveredUrl));
    for (const r of sameKr.priced) expect(presumedUrls.has(r.discoveredUrl)).toBe(false);
  });

  /** 🔴 A-2 — 시장이 섞이지 않는다. */
  it("A-2 시장이 섞이지 않는다", () => {
    for (const r of selectPresumedCandidates(ROWS, "KR")) expect(r.market).toBe("KR");
    for (const r of selectPresumedCandidates(ROWS, "OVERSEAS")) expect(r.market).toBe("OVERSEAS");
  });

  /** 🔴 A-3 — 같은 URL 이 두 번 서지 않는다. */
  it("A-3 중복 URL 은 한 번만", () => {
    const out = selectPresumedCandidates([KR_PRESUMED, { ...KR_PRESUMED }], "KR");
    expect(out).toHaveLength(1);
  });

  /** 🟢🟢 B-1 — **마운트 DOM: 보류 후보가 화면에 선다**(CEO FAIL 의 직접 반증). */
  it("B-1 보류 후보가 결론 영역에 실제로 렌더된다", () => {
    const host = mount(ROWS);
    const rows = host.querySelectorAll('[data-testid="mi-presumed-row"]');
    expect(rows.length).toBe(3);
    const text = host.textContent ?? "";
    expect(text).toContain("biskuit.kr");
    expect(text).toContain("cissywears.com");
    expect(text).toContain("trenbe.com");
  });

  /** 🟢🟢 B-2 — **가격과 통화가 같이 선다**(CEO 질문 ②). */
  it("B-2 가격·통화가 보이고 없으면 「가격 미확인」이다", () => {
    const host = mount(ROWS);
    const prices = Array.from(
      host.querySelectorAll('[data-testid="mi-presumed-price"]'),
      (n) => n.textContent ?? "",
    );
    expect(prices.some((p) => p.includes("88,000") && p.includes("KRW"))).toBe(true);
    expect(prices.some((p) => p.includes("33") && p.includes("GBP"))).toBe(true);
    /** 🔴 가격 없는 후보를 **버리지 않는다** — 「0원」으로도 적지 않는다. */
    expect(prices.some((p) => p.includes("가격 미확인"))).toBe(true);
    expect(prices.join(" ")).not.toContain("0원");
  });

  /** 🔴 B-3 — **실제 판매처 URL** 이다(검색 URL·내부 경로가 아니다). */
  it("B-3 행마다 실제 상품 URL 링크가 있다", () => {
    const host = mount(ROWS);
    const hrefs = Array.from(
      host.querySelectorAll('[data-testid="mi-presumed-row"] a'),
      (a) => (a as HTMLAnchorElement).getAttribute("href") ?? "",
    );
    expect(hrefs).toHaveLength(3);
    for (const h of hrefs) expect(h.startsWith("https://")).toBe(true);
    expect(hrefs).toContain(KR_PRESUMED.discoveredUrl);
  });

  /** 🔴 B-4 — **기본 접힘.** 펼친 채로 두면 「유력 후보」로 읽힌다(WU-091 ①). */
  it("B-4 구역은 접혀 있다", () => {
    const host = mount(ROWS);
    const d = host.querySelector('[data-testid="mi-presumed-area"]') as HTMLDetailsElement | null;
    expect(d).not.toBeNull();
    expect(d!.tagName.toLowerCase()).toBe("details");
    expect(d!.hasAttribute("open")).toBe(false);
  });

  /** 🔴 B-5 — **가격 집계에 안 쓰인다는 사실** 을 화면이 말한다(WU-091 ④). */
  it("B-5 범위 문장이 선다", () => {
    const host = mount(ROWS);
    const scope = host.querySelector('[data-testid="mi-presumed-scope"]')?.textContent ?? "";
    expect(scope).toContain("가격 집계");
    expect(scope.length).toBeGreaterThan(10);
  });

  /** 🔴 B-6 — 보류가 없으면 **구역이 서지 않는다**(빈 구역 금지). */
  it("B-6 보류 0 이면 구역이 없다", () => {
    const host = mount([KR_SAME]);
    expect(host.querySelector('[data-testid="mi-presumed-area"]')).toBeNull();
  });

  /** 🔴🔴 C-1 — **내부 토큰 노출 금지.** 셀러 화면에 판정 어휘를 글자로 쓰지 않는다. */
  it("C-1 내부 토큰이 화면에 없다", () => {
    const text = mount(ROWS).textContent ?? "";
    for (const token of [
      "PRESUMED_SAME",
      "matchTruth",
      "TEXT_CONFIRMED",
      "priceTier",
      "COMPARISON",
      "EXCLUDED",
      "WEB_SEARCH",
      "OVERSEAS_AUTO",
      "blocker",
      "threshold",
      "Evidence",
      "candidate_reviews",
    ]) {
      expect(text).not.toContain(token);
    }
  });

  /** 🔴🔴 D-1 — **가격 집계 선별기를 바꾸지 않았다**(CPO §3 · 바이트 앵커). */
  it("D-1 selectMiSameCandidates 의 세 축이 그대로다", () => {
    const i = SEL.indexOf("export function selectMiSameCandidates");
    expect(i).toBeGreaterThan(0);
    const body = SEL.slice(i, i + 2600);
    expect(body).toContain('transientDisplayTier(row) !== "SAME"');
    expect(body).toContain("isNotSoldOut(row)");
    expect(body).toContain("isPriceConfirmed(row)");
    /** 🔴 그 함수가 보류를 받아들이면 **가격 정책이 바뀐다** — 금지. */
    expect(body).not.toContain('=== "PRESUMED_SAME"');
  });

  /** 🔴 D-2 — 새 구역이 **가격 집계 입력을 만들지 않는다**(표시 전용). */
  it("D-2 새 구역은 집계 어휘를 쓰지 않는다", () => {
    const i = SRC.indexOf('data-testid="mi-presumed-area"');
    expect(i).toBeGreaterThan(0);
    const block = SRC.slice(i, SRC.indexOf("selection.sameButExcluded", i));
    for (const forbidden of ["reference", "byCurrency", "priceKrw", "priceTier", "lowest"]) {
      expect(block).not.toContain(forbidden);
    }
  });

  /** 🔴 D-3 — `presentation="HIDDEN"` 은 **그대로** 다(계약 셋 유지 · CPO §2). */
  it("D-3 워크스페이스의 HIDDEN 을 건드리지 않았다", () => {
    const ws = readFileSync(join(__dirname, "..", "..", "CommerceWorkspace.tsx"), "utf8");
    expect(ws).toContain('presentation="HIDDEN"');
  });

  /** 🔴 D-4 — 선택기 **둘** 이 같은 `rows` 를 본다(공급 배선 추가 0). */
  it("D-4 공급은 기존 rows 하나다", () => {
    expect(SRC).toContain('selectPresumedCandidates(rows, "KR")');
    expect(SRC).toContain('selectPresumedCandidates(rows, "OVERSEAS")');
    /** 🔴 새 fetch 를 만들지 않았다. */
    const i = SRC.indexOf("selectPresumedCandidates");
    expect(SRC.slice(i - 400, i + 400)).not.toContain("fetch(");
  });
});
