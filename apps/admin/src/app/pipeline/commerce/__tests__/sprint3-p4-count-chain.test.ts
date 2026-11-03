/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-DECISION-UX §19 — **후보 수가 어디서 줄어드는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-11-03): 「**이것을 확인하지 않고 UI 를 고치지 않는다.**
 *   `DB → API → props → DOM` 각 단계의 숫자를 비교한다.」
 *
 * 🔴 이 세션에서 **DB 구간은 측정할 수 없다**(운영 DB 접속이 도구 안전검사에 막혀 있다).
 *    🔴 그래서 그 구간을 **추정으로 채우지 않는다** — 여기서 닫는 것은
 *    **`props → selector → DOM`** 세 칸이고, 그것이 「UI 가 잘라내는가」의 답이다.
 *
 * 🟢 입력은 **CEO 가 말한 모양** 이다 — 「테스트 때는 가격이 많았다」:
 *    🇰🇷 3(가격 2 + 미확인 1) · 🌎 5(가격 4 + 미확인 1) = **후보 8**
 * 🔴 판정·가격을 만들지 않는다 — 운영 선택기(`selectCandidateList`)와
 *    운영 컴포넌트가 낸 결과를 **세기만** 한다.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { selectCandidateList } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "Booty Ghosts T-Shirt",
    imageUrl: null,
    soldOut: false,
    discoveredUrl: "https://a.example/p/1",
    matchTruth: "EXACT_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    confidence: 1,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: null,
    priceCurrency: null,
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

/** 🇰🇷 3 — 가격 2 + **가격 미확인 1**(🔴 지워지면 안 되는 후보) */
const KR_ROWS: GeminiTransientRow[] = [
  row({ market: "KR", domain: "donokids.com", discoveredUrl: "https://donokids.com/p/1", priceAmount: 88_000, priceCurrency: "KRW", priceTier: "COMPARISON", matchTruth: "TEXT_CONFIRMED", crossSellerVerdict: "PRESUMED_SAME" }),
  row({ market: "KR", domain: "biskuit.kr", discoveredUrl: "https://biskuit.kr/p/2", priceAmount: 92_000, priceCurrency: "KRW" }),
  row({ market: "KR", domain: "beaumonde.co.kr", discoveredUrl: "https://beaumonde.co.kr/p/3", priceAmount: null, priceCurrency: null, priceStatus: null }),
];
/** 🌎 5 — 가격 4 + **가격 미확인 1** */
const OS_ROWS: GeminiTransientRow[] = [
  row({ domain: "junioredition.com", discoveredUrl: "https://junioredition.com/p/1", priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "scoutandcokids.com", discoveredUrl: "https://scoutandcokids.com/p/2", priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD", priceTier: "COMPARISON", matchTruth: "TEXT_CONFIRMED", crossSellerVerdict: "PRESUMED_SAME" }),
  row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/4", priceAmount: 58, priceCurrency: "USD" }),
  row({ domain: "cissywears.com", discoveredUrl: "https://cissywears.com/p/5", priceAmount: null, priceCurrency: null, priceStatus: null }),
];
const ROWS = [...KR_ROWS, ...OS_ROWS];

function mount(extra: Record<string, unknown> = {}): void {
  act(() => {
    root.render(createElement(MarketPriceComparison, { rows: ROWS, ...extra } as never));
  });
}

const domRows = (): number => container.querySelectorAll('[data-testid="mi-candidate-row"]').length;

describe("SELLER-DECISION §19 — props → selector → DOM 후보 수", () => {
  it("🔎 세 칸의 숫자를 나란히 찍는다", () => {
    mount({ recommendedPriceKrw: 92_000 });
    const kr = selectCandidateList(ROWS, "KR");
    const os = selectCandidateList(ROWS, "OVERSEAS");
    /* eslint-disable no-console */
    console.log(
      "\n═══ §19 count chain ═══\n" +
        `props   총 ${ROWS.length}  (🇰🇷 ${KR_ROWS.length} · 🌎 ${OS_ROWS.length})\n` +
        `selector 🇰🇷 ${kr.length} · 🌎 ${os.length}  (합 ${kr.length + os.length})\n` +
        `DOM      mi-candidate-row ${domRows()}\n` +
        "═══════════════════════\n",
    );
    expect(domRows()).toBeGreaterThan(0);
  });

  /**
   * 🔴🔴 **UXR-SELLER-02 — 후보 수가 «임의로» 줄지 않는다.**
   *    CEO: 「테스트 때는 가격이 많았는데 지금은 1개씩만 나온다」
   *    ⟹ UI 가 잘라내는지 **여기서** 가른다(DB 구간은 측정불가로 남긴다).
   */
  it("UXR-SELLER-02 🔴 props 8 → selector 8 → DOM 8 (UI 가 잘라내지 않는다)", () => {
    mount({ recommendedPriceKrw: 92_000 });
    const kr = selectCandidateList(ROWS, "KR");
    const os = selectCandidateList(ROWS, "OVERSEAS");
    expect(kr.length, "🔴 국내 후보가 선택기에서 줄었다").toBe(KR_ROWS.length);
    expect(os.length, "🔴 해외 후보가 선택기에서 줄었다").toBe(OS_ROWS.length);
    expect(domRows(), "🔴 DOM 이 후보를 잘라냈다").toBe(ROWS.length);
  });

  /**
   * 🔴🔴 **UXR-SELLER-03 — 「가격 없음」과 「후보 없음」은 다른 상태다.**
   *    🔴 가격이 없다고 **후보를 지우지 않는다**(지시서 §7 금지).
   */
  it("UXR-SELLER-03 🔴 가격 미확인 후보가 «삭제되지 않는다»", () => {
    mount({ recommendedPriceKrw: 92_000 });
    const all = (container.textContent ?? "").replace(/\s+/g, " ");
    /** 🔴 가격이 없는 두 후보(국내 1 · 해외 1)가 화면에 **남아 있다**. */
    expect(all, "🔴 가격 미확인 국내 후보가 사라졌다").toContain("beaumonde.co.kr");
    expect(all, "🔴 가격 미확인 해외 후보가 사라졌다").toContain("cissywears.com");
    /** 🔴 그러면서 **가격이 있는 척하지 않는다** — 숫자를 만들어내지 않는다. */
    expect(all).not.toContain("beaumonde.co.kr ₩");
  });

  /** 🔴 UXR-SELLER-05 — 선택 행동이 후보마다 있다(최저가 하나로 대체하지 않는다). */
  it("UXR-SELLER-05 🔴 후보마다 «선택» 이 있다", () => {
    mount({ recommendedPriceKrw: 92_000 });
    const selects = container.querySelectorAll('[data-testid="mi-candidate-select"]');
    expect(selects.length, "🔴 후보 선택 UI 가 하나도 없다").toBeGreaterThan(0);
  });

  /**
   * 🔴 UXR-SELLER-04 — 추천 판매가 ≠ 소싱가(어휘가 갈린다).
   *
   * 🔴🔴 **내 1차 단언이 틀렸고 그 FAIL 이 맞았다.** 전체 텍스트에서 「시장 평균」을
   *    금지했는데, 그 글자는 **상세의 «필수 부정문»**(「시장 평균가가 **아닙니다**」)에
   *    있다 — 이 저장소가 **세 번** 밟은 함정(WU-139·WU-144·WU-146)이고 규칙은
   *    **「평균은 부정문으로만」** 이다. 🟢 그래서 범위를 **1차 화면** 으로 좁힌다.
   */
  it("UXR-SELLER-04 🔴 추천 판매가와 소싱가가 «1차에서» 다른 말로 적힌다", () => {
    mount({ recommendedPriceKrw: 92_000 });
    const clone = container.cloneNode(true) as HTMLElement;
    for (const d of [...clone.querySelectorAll("details")]) {
      if (d.hasAttribute("open")) continue;
      for (const child of [...d.childNodes]) {
        if ((child as HTMLElement).tagName?.toLowerCase() !== "summary") child.remove();
      }
    }
    const first = (clone.textContent ?? "").replace(/\s+/g, " ");
    expect(first).toContain("권장 판매가격");
    expect(first, "🔴 1차에 「소싱」이라는 말이 없다").toContain("소싱");
    /** 🔴 1차에서는 계산을 함의하는 어휘를 쓰지 않는다(부정문도 1차에 두지 않는다). */
    for (const banned of ["시장 평균", "적정 판매가", "예상 수익", "마진율"]) {
      expect(first, `🔴 계산을 함의하는 어휘가 1차에 떴다: ${banned}`).not.toContain(banned);
    }
  });
});
