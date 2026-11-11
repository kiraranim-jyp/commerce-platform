/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-RESULT-UX-REFINE-1 B — **두 가격 블록이 «같은 카드» 로 선다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 캡처의 비대칭은 **컴포넌트가 달라서가 아니라 «분기» 가 달랐기 때문** 이다:
 * ```
 * sameCount === 0 → <OverseasReferencePrice>   카드 셸(테두리·배경·p-3)
 * sameCount  > 0 → price-guide                 🔴 맨 div(테두리·배경 없음)
 * ```
 * 그래서 🇰🇷(SAME 0)는 **카드**, 🌎(SAME 3)는 **맨 줄** 로 떠서 같은 성격의 정보가
 * 다른 무게로 읽혔다.
 *
 * 🔴 이 파일이 **하지 않는** 것 — 집계·분모·가격 자격·CASE·A/B·8축·testid·문구 변경 **0**.
 *    바뀌는 것은 **셸(테두리/배경/여백)과 제목 위계** 뿐이다.
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/** 🟢 국내 — SAME 0(참고가격 카드 분기). 실측 모양 그대로(donokids · PRESUMED_SAME). */
const KR_ROWS: GeminiTransientRow[] = [
  {
    domain: "donokids.com",
    discoveredUrl: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785",
    title: "[보보쇼즈] Hug Hairy Monster T-shirt #226AC009",
    priceAmount: 88000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    soldOut: null,
    matchTruth: "TEXT_CONFIRMED",
    crossSellerVerdict: "PRESUMED_SAME",
  },
];

/** 🟢 해외 — SAME 3(price-guide 분기). 🔴 `displayTier SAME` 이 되는 조건 그대로. */
const OS_ROWS: GeminiTransientRow[] = ["scoutandcokids.com", "tinyapple.net", "thefrontshop.com"].map(
  (domain, i) => ({
    domain,
    discoveredUrl: `https://${domain}/products/hug-hairy-monster-${i}`,
    title: "Bobo Choses Hug Hairy Monster T-shirt",
    priceAmount: 37 + i,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    soldOut: false,
    matchTruth: "EXACT_IDENTIFIER",
    crossSellerVerdict: "SAME",
  }),
);

const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88_000, highestAmount: 88_000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
  unverifiedCount: 0,
  observedDifferenceCount: 0,
} as OverseasPriceSummary;

function mount(props: Parameters<typeof MarketPriceComparison>[0]): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    createRoot(host).render(createElement(MarketPriceComparison, props));
  });
  return host;
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
/** 🔴 **셸은 클래스로 본다** — 「보인다」를 글자로만 재면 테두리 차이를 못 잡는다. */
const SHELL = ["rounded-md", "border", "bg-muted/20", "p-3"];

describe("MSRUX-1B — 🇰🇷/🌎 가격 블록 카드 셸 통일", () => {
  it("B-1 🔴🔴 SAME 분기(price-guide)도 참고가격 카드와 **같은 셸** 을 쓴다", () => {
    const el = mount({ rows: OS_ROWS, overseasReference: null });
    const guide = q(el, "price-guide-overseas");
    expect(guide, "🔴 SAME 분기가 렌더되지 않았다 — 표본이 분기를 안 탔다").toBeTruthy();
    for (const cls of SHELL) {
      expect(guide!.className, `🔴 카드 셸이 없다: ${cls}`).toContain(cls);
    }
  });

  it("B-2 🟢 참고가격 카드(SAME 0 분기)의 셸과 **같은 값** 이다 — 사본이 갈라지지 않는다", () => {
    const krEl = mount({ rows: KR_ROWS, domesticReference: KR_REF });
    const card = q(krEl, "domestic-reference");
    expect(card, "🔴 참고가격 카드가 없다").toBeTruthy();
    const osEl = mount({ rows: OS_ROWS, overseasReference: null });
    const guide = q(osEl, "price-guide-overseas")!;
    for (const cls of SHELL) {
      expect(card!.className, `🔴 기준 카드에 ${cls} 가 없다`).toContain(cls);
      expect(guide.className, `🔴 두 블록의 셸이 갈렸다: ${cls}`).toContain(cls);
    }
  });

  it("B-3 🔴 제목 위계가 같다 — 한쪽만 작은 글씨가 아니다", () => {
    const osEl = mount({ rows: OS_ROWS, overseasReference: null });
    const title = q(osEl, "price-guide-overseas")!.querySelector("p")!;
    expect(title.className, "🔴 제목이 본문보다 작은 보조 글씨로 남아 있다").not.toContain("text-[11px]");
    expect(title.className, "🔴 제목 강조가 사라졌다").toContain("font-medium");
  });

  it("B-4 🟢 **숫자·문구·testid 는 그대로** — 셸만 바꿨다(집계 변경 0)", () => {
    const osEl = mount({ rows: OS_ROWS, overseasReference: null });
    const text = osEl.textContent ?? "";
    /** 🔴 금액과 건수가 그대로 선다. */
    expect(q(osEl, "price-guide-headline")?.textContent ?? "", "🔴 금액 줄이 사라졌다").toContain("GBP");
    expect(text, "🔴 동일상품 건수 줄이 사라졌다").toContain("동일상품 확정 3건");
    /** 🔴 국내 쪽도 그대로다(한쪽만 고치지 않았다). */
    const krEl = mount({ rows: KR_ROWS, domesticReference: KR_REF });
    expect(q(krEl, "domestic-lowest")?.textContent ?? "").toContain("88,000");
    expect(krEl.textContent ?? "").toContain("반영 판매처 1곳");
  });
});
