/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-UX-SELLER-01 — **셀러가 5초 안에 세 질문에 답한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확정(2026-10-26) — 1차 영역의 **순서가 정책** 이다:
 * ```
 * ① 판매판단   팔아도 되는가?
 * ② 권장 판매가격 A + [이 가격으로 설정]   얼마에 팔면 되는가?
 * ③ 가격 판단 근거 🇰🇷 국내 참고가격 · 🌎 해외 최저 소싱가   왜 그 가격인가?
 * ④ ⓘ 가격 계산 기준 보기
 * ```
 *
 * 🔴🔴 **이 WU 는 «표시 순서 + 기존 CTA 연결» 뿐이다** — 계산 0 · MI 0 · SAME 0 ·
 *    국내가격 수집 0 · API 0 · DB 0 · 새 state 0 · 새 verdict owner 0.
 *
 * 🔴 **owner 를 다시 만들지 않는다**:
 * ```
 * 판매판단  resolveSellVerdict(CW:727) → sellVerdict → FINAL_VERDICT_COPY(Panel:873)
 * A        recommendedPriceKrw(CW:1996)  ← resolveListingPrice 한 번
 * CTA      updateSalePriceKrw(CW:1452)   ← PriceEditor:158 과 **같은 함수**
 * ⓘ        handleOpenPriceCalculation(CW:862) → PRICE_CALCULATION_ANCHOR_ID(CW:3727)
 * ```
 *
 * 🔴 「Production UI PASS」로 쓰지 않는다 — 실제 따져 화면은 CTO 가 볼 수 없다.
 *    이것은 **마운트 DOM + 소스 배선** 축이고 최종 확인은 **CEO 1회** 다(§18).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { FINAL_VERDICT_COPY, type SellerFinalVerdict } from "../DomesticPriceIntelligencePanel";
import { MARKET_RESULT_HEADING } from "../mi-same-candidates";
import {
  APPLY_RECOMMENDED_PRICE_LABEL,
  PRICE_CALCULATION_LINK_TEXT,
  RECOMMENDED_PRICE_LABEL,
  SELL_VERDICT_HEADING,
} from "../recommended-price-copy";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

const COMMERCE = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
/** 🔴 **주석을 벗긴다** — 이 저장소에서 여덟 번 걸린 함정이다(헌장 §5). */
const AREA = strip(readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8"));
const WORKSPACE = strip(readFileSync(join(COMMERCE, "..", "CommerceWorkspace.tsx"), "utf8"));

/** 🔴 실측 표본(snapshot `32f7b651` · PèPè) — **다시 재지 않는다**. */
const A_KRW = 295796;
const B_KRW = 258000;
const B_MARGIN = 0.6;

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

/** 🔴 row 모양을 지어내지 않는다 — 기존 계약(`core-next-step4`)이 쓰는 빌더 그대로다. */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "Lulu T Bar Shoes",
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
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD" }),
];

const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { lowestAmount: B_KRW, highestAmount: B_KRW, count: 1 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
} as unknown as OverseasPriceSummary;

type Props = Record<string, unknown>;

/** 🟢 운영 배선과 같은 모양 — CW 가 넘기는 셋을 기본으로 둔다. */
function mount(props: Props = {}): void {
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows: ROWS,
        domesticReference: KR_REF,
        recommendedPriceKrw: A_KRW,
        marketPriceKrw: B_KRW,
        marketPriceMarginPercent: B_MARGIN,
        sellVerdictCopy: FINAL_VERDICT_COPY.CONDITIONAL,
        onOpenPriceCalculation: () => {},
        onApplyRecommendedPrice: () => {},
        ...props,
      } as never),
    );
  });
}

const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);
const whole = (): string => (container.textContent ?? "").replace(/\s+/g, " ").trim();

/** 🔴 닫힌 `details` 를 지운다 = **셀러가 «펼치지 않고» 보는 것**(접힘은 1차가 아니다). */
function firstScreen(): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * 🟢 **문서 순서** 로 본다 — 텍스트 `indexOf` 는 같은 글자가 두 번 나오면 틀린 자리를
 *    집는다(이 트랙에서 실제로 났다). `querySelectorAll` 은 문서 순서를 보장한다.
 */
function docOrder(ids: readonly string[]): number[] {
  const all = [...container.querySelectorAll("[data-testid]")] as HTMLElement[];
  return ids.map((id) => all.findIndex((e) => e.dataset.testid === id));
}

/* ══════════════════ UX-01 — 1차 순서가 정책이다 ══════════════════ */

describe("UX-01 — ① 판매판단 → ② 권장가 → CTA → ③ 근거 → ④ ⓘ", () => {
  it("UX-01-a 🟢🟢 다섯이 **이 순서로** 선다", () => {
    mount();
    const ids = [
      "market-sell-verdict",
      "market-recommended-price",
      "market-apply-recommended-price",
      "market-blocks",
      "market-price-calculation-link",
    ] as const;
    const at = docOrder(ids);
    at.forEach((i, n) => expect(i, `🔴 ${ids[n]} 가 렌더되지 않았다`).toBeGreaterThanOrEqual(0));
    for (let n = 1; n < at.length; n += 1) {
      expect(at[n], `🔴 순서가 틀렸다: ${ids[n - 1]} → ${ids[n]}`).toBeGreaterThan(at[n - 1]!);
    }
  });

  it("UX-01-b 🔴 **판매판단이 근거보다 먼저** 다(셀러의 첫 질문이 「팔아도 되나」다)", () => {
    mount();
    const [verdict, blocks] = docOrder(["market-sell-verdict", "market-blocks"]);
    expect(verdict).toBeGreaterThanOrEqual(0);
    expect(blocks, "🔴 근거가 판단보다 먼저 왔다").toBeGreaterThan(verdict!);
  });

  it("UX-01-c 🔴 **ⓘ 는 근거 «뒤»** 다 — 근거를 읽기 전에 계산식으로 빠지지 않는다", () => {
    mount();
    const [blocks, info] = docOrder(["market-blocks", "market-price-calculation-link"]);
    expect(info, "🔴 ⓘ 가 근거보다 먼저 왔다").toBeGreaterThan(blocks!);
  });

  it("UX-01-d 🟢 다섯 전부 **1차** 다(접힘을 열지 않아도 보인다)", () => {
    mount();
    const first = firstScreen();
    for (const s of [
      SELL_VERDICT_HEADING,
      RECOMMENDED_PRICE_LABEL,
      APPLY_RECOMMENDED_PRICE_LABEL,
      PRICE_CALCULATION_LINK_TEXT,
    ]) {
      expect(first, `🔴 1차에서 사라졌다: ${s}`).toContain(s);
    }
  });
});

/* ══════════════════ UX-02 — verdict owner 는 하나다 ══════════════════ */

describe("UX-02 — 판매판단 owner 하나(좌우가 갈릴 경로가 없다)", () => {
  it("UX-02-a 🟢🟢 세 verdict **전부** `FINAL_VERDICT_COPY` 글자를 그대로 쓴다", () => {
    for (const v of ["RECOMMENDED", "CONDITIONAL", "NOT_RECOMMENDED"] as SellerFinalVerdict[]) {
      act(() => root.unmount());
      container.remove();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      mount({ sellVerdictCopy: FINAL_VERDICT_COPY[v] });
      const txt = (q("market-sell-verdict-title")?.textContent ?? "").replace(/\s+/g, " ").trim();
      expect(txt, `🔴 ${v} 문구가 맵과 다르다`).toBe(
        `${FINAL_VERDICT_COPY[v].icon} ${FINAL_VERDICT_COPY[v].title}`,
      );
    }
  });

  it("UX-02-b 🔴🔴 Workspace 가 **좌우에 같은 식** 을 넘긴다", () => {
    const expr = "sellVerdict ? FINAL_VERDICT_COPY[sellVerdict] : null";
    /** 🔴 왼쪽(이번 WU) · 오른쪽(ActionCenter) **둘 다** 그 식이어야 한다. */
    expect(WORKSPACE, "🔴 왼쪽 배선이 사라졌다").toContain(`sellVerdictCopy={${expr}}`);
    expect(WORKSPACE, "🔴 오른쪽 Action Center 배선이 사라졌다").toContain(`verdict={${expr}}`);
  });

  it("UX-02-c 🔴🔴 이 영역은 **판정하지 않는다**(verdict 계산 어휘 0)", () => {
    for (const bad of ["resolveSellVerdict", "FINAL_VERDICT_COPY", "finalVerdict"]) {
      expect(AREA, `🔴 영역이 판정 owner 를 끌어왔다: ${bad}`).not.toContain(bad);
    }
  });

  it("UX-02-d 🔴🔴 결론 «문장» 블록 제목(`💡 판매 판단`)은 **여전히 1차에 없다**", () => {
    mount();
    /**
     * 🔴 `MARKET_RESULT_HEADING` 과 `SELL_VERDICT_HEADING` 은 **다른 것** 이다 —
     *    전자는 결론 문장 블록(상세), 후자는 한 줄 verdict(1차).
     * 🟢 이 단언이 둘을 섞는 것을 막는다(core-2v:232 · wu-146:222 와 같은 방향).
     */
    expect(firstScreen(), "🔴 결론 문장 블록이 1차로 되돌아왔다").not.toContain(MARKET_RESULT_HEADING);
    expect(whole(), "🔴 결론 문장 블록이 사라졌다(상세에 있어야 한다)").toContain(MARKET_RESULT_HEADING);
  });

  it("UX-02-e 🔴 verdict 가 없으면 **줄을 만들지 않는다**", () => {
    mount({ sellVerdictCopy: null });
    expect(q("market-sell-verdict"), "🔴 판정 없이 판단 줄을 지어냈다").toBeNull();
    expect(firstScreen()).not.toContain(SELL_VERDICT_HEADING);
  });
});

/* ══════════════════ UX-03 — CTA 는 기존 handler 다 ══════════════════ */

describe("UX-03 — [이 가격으로 설정] = updateSalePriceKrw(A)", () => {
  it("UX-03-a 🟢🟢 누르면 핸들러가 **한 번** 돈다", () => {
    const spy = vi.fn();
    mount({ onApplyRecommendedPrice: spy });
    const btn = q("market-apply-recommended-price") as HTMLButtonElement;
    expect(btn, "🔴 CTA 가 없다").not.toBeNull();
    act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(spy, "🔴 CTA 가 핸들러를 부르지 않았다").toHaveBeenCalledTimes(1);
  });

  it("UX-03-b 🔴 핸들러가 없으면 **버튼이 렌더되지 않는다**(갈 곳 없는 버튼 금지)", () => {
    mount({ onApplyRecommendedPrice: undefined });
    expect(q("market-apply-recommended-price")).toBeNull();
  });

  it("UX-03-c 🔴 A 가 없으면 CTA 도 **없다**(₩0 을 판매가로 만들 길이 없다)", () => {
    mount({ recommendedPriceKrw: null });
    expect(q("market-recommended-price")).toBeNull();
    expect(q("market-apply-recommended-price")).toBeNull();
  });

  it("UX-03-d 🔴🔴 Workspace 가 **기존 함수** 를 그대로 묶는다(새 handler 0)", () => {
    /**
     * 🔴 공백에 취약한 **여러 줄 문자열** 로 단언하지 않는다(포매터가 줄을 바꾸면
     *    계약이 「배선이 사라졌다」는 거짓 FAIL 을 낸다) — 공백을 눌러서 본다.
     */
    const flat = WORKSPACE.replace(/\s+/g, " ");
    expect(flat, "🔴 CTA 배선이 사라졌다").toContain("onApplyRecommendedPrice={");
    expect(flat, "🔴 CTA 가 기존 함수를 부르지 않는다").toContain(
      "() => updateSalePriceKrw(recommendedPriceKrw)",
    );
    /** 🔴 A 가 없으면 **넘기지 않는다** — 그 가드가 사라지면 ₩0 을 설정할 길이 생긴다. */
    expect(flat, "🔴 A 가 null 일 때의 가드가 사라졌다").toContain(
      "recommendedPriceKrw != null ? () => updateSalePriceKrw(recommendedPriceKrw) : undefined",
    );
    /** 🔴 `updateSalePriceKrw` 의 **정의가 하나** 여야 한다(사본을 만들면 둘이 된다). */
    expect(WORKSPACE.match(/function updateSalePriceKrw\(/g) ?? []).toHaveLength(1);
  });

  it("UX-03-e 🔴 이 영역은 가격을 **쓰지 않는다**(적용 로직 사본 0)", () => {
    for (const bad of ["updateSalePriceKrw", "priceOverrideKrw", "resolveListingPrice"]) {
      expect(AREA, `🔴 영역이 가격 쓰기 경로를 끌어왔다: ${bad}`).not.toContain(bad);
    }
  });
});

/* ══════════════════ UX-04 — A / B 분리 ══════════════════ */

describe("UX-04 — B 는 A 자리로 올라오지 않는다", () => {
  it("UX-04-a 🔴🔴 B 만 주면 **권장가 칸도 CTA 도 없다**", () => {
    mount({ recommendedPriceKrw: null, marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN });
    expect(q("market-recommended-price"), "🔴 B 로 권장가 칸을 채웠다").toBeNull();
    expect(q("market-apply-recommended-price"), "🔴 B 를 설정하는 CTA 가 생겼다").toBeNull();
  });

  it("UX-04-b 🔴 권장가 금액은 **A** 다(B 가 아니다)", () => {
    mount();
    const amt = q("market-recommended-price-amount")?.textContent ?? "";
    expect(amt, "🔴 권장가가 B 로 바뀌었다").toContain("295,796");
    expect(amt).not.toContain("258,000");
  });

  it("UX-04-c 🔴🔴 1차에 `₩` 는 **A 줄 하나뿐** 이다(CTA 가 금액을 품지 않는다)", () => {
    mount();
    expect((firstScreen().match(/₩/g) ?? []).length, "🔴 1차에 ₩ 가 둘 이상이다").toBe(1);
    expect(APPLY_RECOMMENDED_PRICE_LABEL, "🔴 CTA 문구에 금액이 들어갔다").not.toMatch(/[₩0-9]/);
  });
});

/* ══════════════════ UX-05 — ⓘ 는 A 전용 ══════════════════ */

describe("UX-05 — ⓘ 가격 계산 기준은 A 전용", () => {
  it("UX-05-a 🟢 누르면 **기존 핸들러** 가 한 번 돈다", () => {
    const spy = vi.fn();
    mount({ onOpenPriceCalculation: spy });
    const btn = q("market-price-calculation-link") as HTMLButtonElement;
    act(() => btn.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("UX-05-b 🔴 A 가 없으면 ⓘ 도 **없다**(B 설명으로 살아남지 않는다)", () => {
    mount({ recommendedPriceKrw: null });
    expect(q("market-price-calculation-link")).toBeNull();
  });

  it("UX-05-c 🔴🔴 Workspace 의 ⓘ 는 `PriceEditor` 와 **같은 핸들러** 다", () => {
    expect(WORKSPACE).toContain("onOpenPriceCalculation={handleOpenPriceCalculation}");
    /** 🔴 핸들러 **정의가 하나** 여야 한다 — 도착지가 둘이면 셀러가 두 설명을 비교한다. */
    expect(WORKSPACE.match(/function handleOpenPriceCalculation\(/g) ?? []).toHaveLength(1);
  });
});

/* ══════════════════ UX-06 — 기존 1차 계약 유지 ══════════════════ */

describe("UX-06 — 1차가 다시 길어지지 않는다(기존 계약 유지)", () => {
  it("UX-06-a 🔴 설명문 줄 수는 **1** 이다(①②를 더해도 늘지 않는다)", () => {
    mount();
    expect(container.querySelectorAll('[data-testid="market-next-step-line"]').length).toBe(1);
  });

  it("UX-06-b 🔴 1차 글자 비중이 **25% 를 넘지 않는다**", () => {
    mount();
    const ratio = firstScreen().length / Math.max(1, whole().length);
    expect(ratio, `🔴 1차가 다시 길어졌다: ${(ratio * 100).toFixed(1)}%`).toBeLessThan(0.25);
  });

  it("UX-06-c 🔴 계산 어휘가 **이 영역에 0** 이다", () => {
    mount();
    for (const bad of ["추천 판매가", "적정 판매가", "마진율", "예상 이익"]) {
      expect(whole(), `🔴 계산 어휘가 들어왔다: ${bad}`).not.toContain(bad);
    }
  });

  it("UX-06-d 🔴 새 prop 은 **둘** 이고 **state 는 0** 이다(범위가 넘치지 않았다)", () => {
    /** 🔴 prop 이 더 늘거나 state 가 생기면 그것은 「UX 조립」을 넘은 것이다(STOP 조건). */
    expect(AREA).toContain("sellVerdictCopy?:");
    expect(AREA).toContain("onApplyRecommendedPrice?:");
    for (const bad of ["useState", "useReducer", "useEffect"]) {
      expect(AREA, `🔴 이 영역에 상태가 생겼다: ${bad}`).not.toContain(bad);
    }
  });
});
