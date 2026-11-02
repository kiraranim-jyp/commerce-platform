/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 3 P3 — **1차 화면을 «정확한 기준» 으로 센다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **기존 `firstScreen()` 이 1차 노출을 과소 측정한다.** 그 함수는 닫힌
 *    `<details>` 를 **통째로 제거** 하는데, 실제 브라우저는 닫혀 있어도
 *    **`<summary>` 를 보여준다**. ⟹ 「🌎 해외 칸이 빈칸이다」는 **하니스 산물** 이고
 *    제품 결함이 아니다(실제로는 「해외 소싱 후보 4곳 · 후보 보기」가 보인다).
 *
 * 🟢 그래서 이 하니스는 **닫힌 details 의 «자식만» 지우고 `<summary>` 는 남긴다.**
 * 🔴 메모 `fold-depth-must-be-counted-not-assumed` 가 경고한 그 자리다 —
 *    「DOM 에 있다 ≠ 보인다」와 **「접혔다 ≠ 안 보인다」** 를 둘 다 틀리지 않는다.
 *
 * 🔴 판정·집계·가격을 만들지 않는다 — 운영 컴포넌트를 마운트해 **글자를 읽기만** 한다.
 * 🔴 「Production UI PASS」로 쓰지 않는다(마운트 DOM 축 · 최종 확인은 CEO 1회).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

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

/** 🔴 `core-2ao-r1` 의 빌더를 그대로 베낀다 — row 모양을 지어내지 않는다. */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "Hug Hairy Monster T-Shirt",
    imageUrl: null,
    soldOut: null,
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

const ROWS: GeminiTransientRow[] = [
  row({ domain: "junioredition.com", discoveredUrl: "https://junioredition.com/p/1", soldOut: false, priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "scoutandcokids.com", discoveredUrl: "https://scoutandcokids.com/p/2", soldOut: false, priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD" }),
  row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/4", priceAmount: 58, priceCurrency: "USD" }),
];

const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { lowestAmount: 88000, highestAmount: 88000, count: 1 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
} as unknown as OverseasPriceSummary;

function mount(extra: Record<string, unknown> = {}): void {
  act(() => {
    root.render(
      createElement(MarketPriceComparison, { rows: ROWS, domesticReference: KR_REF, ...extra } as never),
    );
  });
}

/**
 * 🟢 **셀러가 «펼치지 않고» 실제로 보는 글자.**
 * 🔴 닫힌 `<details>` 의 **자식만** 지우고 `<summary>` 는 **남긴다**(브라우저 동작).
 */
function visibleFirstScreen(): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) {
    if (d.hasAttribute("open")) continue;
    for (const child of [...d.childNodes]) {
      if ((child as HTMLElement).tagName?.toLowerCase() !== "summary") child.remove();
    }
  }
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("SPRINT 3 P3 — 1차 화면 실측(요약은 보인다)", () => {
  it("🔎 1차 화면 글자를 찍는다", () => {
    mount();
    // eslint-disable-next-line no-console
    console.log("\n═══ P3 1차 화면(접힘 요약 포함) ═══\n" + visibleFirstScreen() + "\n══════════════════════\n");
    expect(visibleFirstScreen().length).toBeGreaterThan(0);
  });

  /**
   * 🔴🔴 **② 「동일상품 후보/판매처가 어디인가」에 1차가 답하는가.**
   *    기존 하니스로는 이 축을 **측정조차 할 수 없었다**(요약을 지웠으므로).
   */
  it("P3-② 🟢 후보 수와 행동이 «펼치지 않고» 보인다", () => {
    mount();
    const first = visibleFirstScreen();
    expect(first, "🔴 후보 수가 1차에 없다").toContain("해외 소싱 후보 4곳");
    expect(first, "🔴 후보를 볼 행동이 1차에 없다").toContain("후보 보기");
  });

  /** 🔴 UXR-S — 국내·해외가 **같은 구조** 다(한쪽만 빈칸이 아니다). */
  it("P3-S 🟢 국내·해외 두 칸이 모두 1차에서 «상태» 를 말한다", () => {
    mount();
    const first = visibleFirstScreen();
    expect(first).toContain("🇰🇷 국내");
    expect(first).toContain("🌎 해외");
    /** 🇰🇷 는 후보 0 이라 빈 상태 문장, 🌎 는 후보 4곳 요약 — 둘 다 **말이 있다**. */
    expect(first).toContain("국내 소싱 후보가 없습니다");
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 UXR — **P3 최종 계약 다섯**(공식 실행본 §21·§24 의 재정의된 뜻)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **이 WU 는 UI 를 «빼지» 않았다 — 측정이 그 이유를 말한다.**
   * ```
   * 내가 1차에 지목한 둘이 **전부 기존 결정** 이었다:
   *   ⒜ 「국내 가격과 해외 소싱가를 기준으로 …」 → CPO 가 **한 줄로 줄여 고정** 한 문장이고
   *      계약 둘이 「설명문 == 1줄」로 잠가 뒀다(core-ux-seller-01 · core-next-step4)
   *   ⒝ 「현재 확인된 정보만으로는 …」 → **WU-130 ②** 가 「조회하지 않았다」로 읽히는 것을
   *      막기 위해 일부러 넣었다 ⟹ 지우면 더 나쁜 오독이 되돌아온다
   * ⟹ 🟢 그러므로 P3 의 산출물은 **그 상태를 계약으로 잠그는 것** 이다(구현 0).
   * ```
   * 🔴 앞으로 누가 1차에 정보를 **더하면** 아래 다섯이 FAIL 한다 — 그것이 이 계약의 목적이다.
   */
  it("UXR-F 🔴 First-screen judgment — 1차가 다섯 질문 중 ②③④ 에 답한다", () => {
    mount({ recommendedPriceKrw: 120_000 });
    const first = visibleFirstScreen();
    /** ② 어디인가 */
    expect(first, "🔴 ② 후보/판매처가 1차에 없다").toContain("해외 소싱 후보 4곳");
    /** ③ 얼마인가 — 국내·해외 둘 다 */
    expect(first, "🔴 ③ 국내 소싱가가 1차에 없다").toContain("KRW 88,000");
    expect(first, "🔴 ③ 해외 소싱가가 1차에 없다").toContain("GBP 37");
    /** ④ 선택 행동 */
    expect(first, "🔴 ④ 판매처를 볼 행동이 1차에 없다").toContain("후보 보기");
  });

  it("UXR-P 🔴 Price meaning — 소싱가 / 권장 판매가 / 최종 확정이 «갈려» 보인다", () => {
    mount({ recommendedPriceKrw: 120_000 });
    const first = visibleFirstScreen();
    /** 🔴 소싱가와 판매가가 **다른 말** 로 적힌다. */
    expect(first, "🔴 해외 «소싱가» 라는 말이 없다").toContain("해외 최저 소싱가");
    expect(first, "🔴 «권장 판매가격» 이라는 말이 없다").toContain("권장 판매가격");
    /** 🔴 같은 금액이 1차에 두 번 뜨지 않는다(소싱가 ↔ 판매가 혼동 방지). */
    for (const amount of ["88,000", "GBP 37", "USD 58"]) {
      expect(
        first.split(amount).length - 1,
        `🔴 같은 금액이 1차에 두 번 이상 떴다: ${amount}`,
      ).toBe(1);
    }
    /** 🔴 「시장 평균/적정가」로 말하지 않는다 — 그 어휘는 계산을 함의한다. */
    for (const banned of ["시장 평균", "적정 판매가", "예상 수익", "마진율"]) {
      expect(first, `🔴 계산을 함의하는 어휘가 1차에 떴다: ${banned}`).not.toContain(banned);
    }
  });

  it("UXR-S 🔴 Seller selection — 국내·해외가 «같은 구조» 로 후보를 말한다", () => {
    mount();
    const first = visibleFirstScreen();
    expect(first).toContain("🇰🇷 국내");
    expect(first).toContain("🌎 해외");
    /** 🔴 한쪽만 말하고 한쪽은 침묵하지 않는다 — 후보 0 이면 **왜 없는지** 를 적는다. */
    expect(first, "🔴 국내 칸이 1차에서 침묵한다").toContain("국내 소싱 후보가 없습니다");
    expect(first, "🔴 해외 칸이 1차에서 침묵한다").toMatch(/해외 소싱 후보 \d+곳/);
  });

  it("UXR-C 🔴 Final price confirmation — ⑤ 수정·확정이 «그 자리에서» 끝난다", () => {
    const applied: number[] = [];
    const opened: number[] = [];
    /**
     * 🔴 prop 이름을 **운영 컴포넌트에서 읽어** 쓴다 — 1차에 `onConfirmRecommendedPrice`
     *    라고 지어냈다가 FAIL 했다(이 트랙의 「칸 이름 추측」 함정 · 그 FAIL 이 맞았다).
     * 🟢 실제 owner 는 `onApplyRecommendedPrice`(적용) + `onOpenPriceEditor`(수정)다.
     */
    mount({
      recommendedPriceKrw: 120_000,
      onApplyRecommendedPrice: () => applied.push(1),
      onOpenPriceEditor: () => opened.push(1),
    });
    const first = visibleFirstScreen();
    /** 🔴 ⑤ 는 **둘** 이다 — 확정(적용)과 수정이 1차에서 같이 가능해야 한다. */
    const apply = container.querySelector('[data-testid="market-apply-recommended-price"]') as HTMLButtonElement;
    const edit = container.querySelector('[data-testid="market-edit-price-link"]') as HTMLButtonElement;
    expect(apply, "🔴 ⑤ 확정(적용) 진입이 1차에 없다").toBeTruthy();
    expect(edit, "🔴 ⑤ 수정 진입이 1차에 없다").toBeTruthy();
    /** 🟢 실제로 눌리는가 — 「버튼 모양만」이 아니다. */
    act(() => apply.click());
    act(() => edit.click());
    expect(applied.length, "🔴 확정이 핸들러를 부르지 않는다").toBe(1);
    expect(opened.length, "🔴 수정이 핸들러를 부르지 않는다").toBe(1);
    /** 🔴 새 가격 owner 를 만들지 않는다 — 금액은 **받은 값 그대로** 다. */
    expect(first).toContain("120,000");
    /** 🔴 1차의 `₩` 금액 줄은 **권장가 하나** 다(소싱가와 혼동 금지). */
    expect(first.split("₩").length - 1, "🔴 1차에 ₩ 금액이 둘 이상 떴다").toBe(1);
  });

  /** 🔴 UXR-D — 후보 카드는 **접힌 채** 다(WU-091 ① · `open` 금지). */
  it("UXR-D 🔴 Detail hierarchy — `mi-candidate-list` 에 `open` 이 없다 · fold depth ≤ 1", () => {
    mount();
    const list = container.querySelector('[data-testid="mi-candidate-list"]') as HTMLElement;
    expect(list, "🔴 후보 목록이 아예 없다").toBeTruthy();
    expect(list.tagName.toLowerCase()).toBe("details");
    expect(list.hasAttribute("open"), "🔴 후보가 자동으로 펼쳐져 「유력」으로 읽힌다").toBe(false);
    /** 🔴 그 안에 **또 다른 접힘** 이 없어야 한다(depth ≤ 1). */
    const nested = list.querySelectorAll("details");
    for (const n of [...nested]) {
      expect(
        n.closest("details") === list,
        "🔴 후보 목록 안에 두 번째 접힘이 있다(depth > 1)",
      ).toBe(true);
    }
  });
});
