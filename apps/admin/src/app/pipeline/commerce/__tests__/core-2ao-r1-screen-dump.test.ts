/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AO-R1 — **CEO 가 볼 화면을 «마운트 DOM» 으로 찍는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 WU 는 **스크린샷을 추측해서 틀렸다** — CORE-2AO 가 `OVERSEAS_REFERENCE_TITLE`
 *    을 고치고 「해외 제목이 바뀌었다」고 보고했는데, 실제 화면의 주인은
 *    `PRICE_GUIDE_TITLE.OVERSEAS` 였다(같은 슬롯의 **다른 상태**). CEO 캡처가 그것을
 *    잡았다. 🔴 그래서 이번에는 **배포 전에 화면 글자를 직접 찍어** 확인한다.
 *
 * 🔴 **여기서 판정·집계·가격을 만들지 않는다** — 운영 컴포넌트를 B226AC009 모양의
 *    입력으로 마운트하고 **텍스트를 읽기만** 한다(네트워크 0 · DB 0).
 * 🔴 「Production UI PASS」로 쓰지 않는다 — 실제 따져 화면은 CTO 가 볼 수 없다(§12).
 *    이것은 **마운트 DOM 축** 이고 최종 확인은 CEO 1회다.
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

/**
 * 🔴 B226AC009 실측 모양 — 해외 SAME 4(GBP 37 ×2 · USD 58 ×2) · 국내 SAME 0 + 참고가격.
 * 🔴🔴 **row 모양을 손으로 지어내지 않는다** — 1차에 그렇게 했다가 「후보 1곳」으로
 *    뭉쳐 **거짓 FAIL** 이 났다(`matchTruth`/`crossSellerVerdict` 누락 + 같은 URL).
 *    🟢 운영 계약(`wu-146`)이 쓰는 빌더를 **그대로** 베꼈다(이 트랙의 반복 함정).
 */
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

/** 🇰🇷 국내는 SAME 0 이고 **참고가격만** 있다(그 금액 owner 가 🇰🇷 블록 하나여야 한다). */
const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { lowestAmount: 88000, highestAmount: 88000, count: 1 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
} as unknown as OverseasPriceSummary;

function mount(): void {
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows: ROWS,
        domesticReference: KR_REF,
      } as never),
    );
  });
}

/** 🔴 닫힌 `details` 를 지운다 = **셀러가 «펼치지 않고» 보는 것**(접힘은 1차가 아니다). */
function firstScreen(): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("CORE-2AO-R1 — 배포 전 화면 실측(마운트 DOM)", () => {
  it("🟢🟢 CEO 가 FAIL 로 지목한 셋이 전부 사라졌다", () => {
    mount();
    const first = firstScreen();
    // eslint-disable-next-line no-console
    console.log("\n═══ 1차 화면(접힘 제외) ═══\n" + first + "\n═══════════════════════════\n");

    /** ① 🔴 해외 제목에서 「동일상품」 주장이 사라졌다. */
    expect(first, "🔴 해외 제목에 「동일상품」이 남아 있다").not.toContain("해외 동일상품");
    expect(first, "🔴 「해외 최저 소싱가」가 뜨지 않는다").toContain("해외 최저 소싱가");

    /** ② 🔴🔴 같은 금액이 두 군데 뜨지 않는다 — CEO 가 정한 FAIL 조건 그대로. */
    for (const amount of ["88,000", "GBP 37", "USD 58"]) {
      expect(
        first.split(amount).length - 1,
        `🔴 같은 금액이 1차 화면에 두 번 이상 떴다: ${amount}`,
      ).toBe(1);
    }
    /**
     * 🔴🔴 **문장도 두 번 뜨지 않는다.** 1차 구현에서 「통화가 여러 개라 …」가
     *    🌎 블록(`headlineLabel`)과 「💡 판매 판단」에 **두 번** 떴고 이 단언이 잡았다.
     *    🟢 금액만 보던 ②로는 못 잡는다 — 그래서 **문장 축을 따로** 둔다.
     */
    for (const sentence of [
      "통화가 여러 개라 하나의 최저가로 합치지 않습니다",
      "국내 참고가격이 확인됐습니다",
    ]) {
      expect(
        first.split(sentence).length - 1,
        `🔴 같은 문장이 1차 화면에 두 번 이상 떴다: ${sentence}`,
      ).toBeLessThanOrEqual(1);
    }

    /** ③ 🔴 근거 설명이 접혀 결론이 바로 읽힌다. */
    const basis = container.querySelector('[data-testid="price-basis"]') as HTMLElement;
    expect(basis.tagName.toLowerCase()).toBe("details");
    expect(basis.hasAttribute("open")).toBe(false);
  });

  it("🟢 그러면서 **잃은 것이 없다** — 금액·결론·근거가 전부 살아 있다", () => {
    mount();
    const first = firstScreen();
    /** 🟢 금액은 블록에 **그대로** 있다(결론에서 뺀 것이 「사라졌다」가 되면 안 된다). */
    expect(first).toContain("KRW 88,000");
    expect(first).toContain("GBP 37");
    expect(first).toContain("USD 58");
    /** 🟢 결론은 「국내 가격 없음」으로 뒤집히지 않았다. */
    expect(first).toContain("국내 참고가격이 확인됐습니다");
    /** 🟢 근거 설명은 **접혔을 뿐** 이고 DOM 에 전부 남아 있다. */
    const all = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(all).toContain("판매처 상세 페이지에서 확인한");
    /** 🔴 추천 판매가·환산은 **여전히 0** 이다(이 WU 가 연 축이 아니다). */
    for (const bad of ["추천 판매가", "권장 판매가", "적정 판매가", "약 ₩"]) {
      expect(all, `🔴 금지 축이 열렸다: ${bad}`).not.toContain(bad);
    }
  });
});
