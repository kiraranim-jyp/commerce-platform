/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MSRUX-1 — **Production 화면 최종 검증**(CEO 캡처 기준 · 세 항목)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 캡처에 「동일상품 추정 1곳」·「동일상품 가능성 높음 5곳」이 보였다.
 *    🟢 그 둘은 **후보 군 머리말**(`CANDIDATE_GROUP_LABEL`)이고 **확정 건수와 다른 owner** 다.
 *    🔴🔴 그래서 이 파일은 **그 둘을 확정 건수로 승격하지 않는다** — 반대로
 *       **「추정 1곳인데 확정은 0건」이 동시에 성립** 함을 못 박는다(혼용 금지).
 *
 * 🔴 이 파일이 **하지 않는** 것 — 8축·GT·CASE·집계/분모·가격 자격·A/B 정책·
 *    후보 분류/순서·API·payload **변경 0**. 보는 것은 **렌더와 배선** 뿐이다.
 */
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { SAME_CONFIRMED_COUNT_LABEL, CANDIDATE_GROUP_LABEL } from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/** 🇰🇷 CEO 캡처 그대로 — 「동일상품 추정」 1곳(= `displayTier SAME` 이 **아니다**). */
const KR: GeminiTransientRow[] = [
  {
    domain: "biskuit.kr",
    discoveredUrl: "https://biskuit.kr/product/x",
    title: "[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009",
    priceAmount: 88_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    soldOut: null,
    matchTruth: "TEXT_CONFIRMED",
    crossSellerVerdict: "PRESUMED_SAME",
  } as GeminiTransientRow,
];

/** 🌎 CEO 캡처 그대로 — 확정 5 + 추정 4 = 9곳. */
const OS: GeminiTransientRow[] = (
  [
    ["scoutandcokids.com", 37, "GBP", "SAME"],
    ["tinyapple.net", 41, "USD", "SAME"],
    ["kids21.com", 49, "SGD", "SAME"],
    ["thefrontshop.com", 40.6, "USD", "SAME"],
    ["global.trenbe.com", 77, "USD", "SAME"],
    ["junioredition.com", 23.1, "GBP", "PRESUMED_SAME"],
    ["villagekids.co.uk", 21.2, "GBP", "PRESUMED_SAME"],
    ["cissywears.com", 33, "GBP", "PRESUMED_SAME"],
    ["kolkid.ca", 23.5, "GBP", "PRESUMED_SAME"],
  ] as const
).map(
  ([domain, amount, currency, verdict], i) =>
    ({
      domain,
      discoveredUrl: `https://${domain}/p/${i}`,
      title: "Bobo Choses Hug Hairy Monster T-shirt",
      priceAmount: amount,
      priceCurrency: currency,
      priceStatus: "VERIFIED_CURRENT",
      market: "OVERSEAS",
      soldOut: false,
      matchTruth: verdict === "SAME" ? "EXACT_IDENTIFIER" : "TEXT_CONFIRMED",
      crossSellerVerdict: verdict,
    }) as GeminiTransientRow,
);

const KR_REF = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88_000, highestAmount: 88_000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
  unverifiedCount: 0,
  observedDifferenceCount: 0,
} as OverseasPriceSummary;

function mount(props: Record<string, unknown>): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    createRoot(host).render(createElement(MarketPriceComparison, props as never));
  });
  return host;
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
const countText = (el: HTMLElement, s: string) => q(el, `market-same-count-${s}`)?.textContent ?? "";

describe("MSRUX-1 UI-1 — 동일상품 «확정» 건수만 확정 건수로 뜬다", () => {
  it("E-1 🔴🔴 추정/가능성 높음을 **확정으로 승격하지 않는다** — 국내 추정 1곳 ↔ 확정 0건", () => {
    const el = mount({ rows: [...KR, ...OS], domesticReference: KR_REF });
    /** 🟢 국내 후보는 **1곳** 있고(추정) 그 금액도 선다 — 「없다」가 아니다. */
    expect(q(el, "domestic-lowest")?.textContent ?? "", "🔴 국내 금액이 사라졌다").toContain("88,000");
    /** 🔴 그런데 **확정은 0건** 이다 — 추정을 확정으로 세면 이 단언이 깨진다. */
    expect(countText(el, "domestic")).toBe(`${SAME_CONFIRMED_COUNT_LABEL} 0건`);
    /** 🟢 해외는 확정 5건 — 후보 9곳(추정 4 포함)을 **건수로 쓰지 않는다**. */
    expect(countText(el, "overseas")).toBe(`${SAME_CONFIRMED_COUNT_LABEL} 5건`);
    expect(countText(el, "overseas"), "🔴 후보 수(9)를 확정 건수로 썼다").not.toContain("9건");
  });

  it("E-2 🟢 후보 군 머리말은 **다른 owner** 다 — 두 어휘가 같은 줄을 쓰지 않는다", () => {
    const el = mount({ rows: [...KR, ...OS], domesticReference: KR_REF });
    const counts = [countText(el, "domestic"), countText(el, "overseas")].join(" ");
    /** 🔴 확정 건수 줄에 「추정」·「가능성 높음」이 섞이면 셀러가 둘을 한 축으로 읽는다. */
    for (const label of [CANDIDATE_GROUP_LABEL.LIKELY, CANDIDATE_GROUP_LABEL.PRESUMED]) {
      expect(counts, `🔴 확정 건수 줄에 후보 등급 어휘가 섞였다: ${label}`).not.toContain(
        label.replace(/^\S+\s/, ""),
      );
    }
  });

  it("E-3 🔴 **분기 셋 전부** 건수 줄이 선다(0건 / 가격 있음 / 가격 없음)", () => {
    /** ⒜ 참고가격조차 없는 국내 — CEO 캡처의 그 모양이다. */
    const a = mount({ rows: [...KR, ...OS], domesticReference: null });
    expect(countText(a, "domestic"), "🔴 참고가격이 없으면 건수도 사라졌다").toBe(
      `${SAME_CONFIRMED_COUNT_LABEL} 0건`,
    );
    /** ⒝ 가격이 있는 확정 분기. */
    const b = mount({ rows: OS });
    expect(countText(b, "overseas")).toBe(`${SAME_CONFIRMED_COUNT_LABEL} 5건`);
    /** ⒞ 확정은 있는데 **가격이 하나도 없는** 분기. */
    const c = mount({
      rows: OS.map((r) => ({ ...r, priceAmount: null, priceCurrency: null, priceStatus: null })),
    });
    expect(q(c, "price-guide-empty"), "🔴 가격 부재 문장이 사라졌다").toBeTruthy();
    expect(countText(c, "overseas"), "🔴 가격이 없으면 건수도 사라졌다").toBe(
      `${SAME_CONFIRMED_COUNT_LABEL} 5건`,
    );
  });
});

describe("MSRUX-1 UI-2 — 판매가 확정 CTA 가 **실제로 동작한다**", () => {
  it("F-1 🟢 시장마다 **하나씩** · 버튼이고 · 클릭이 핸들러를 부른다", () => {
    const calls: unknown[] = [];
    const el = mount({
      rows: [...KR, ...OS],
      domesticReference: KR_REF,
      finalPriceKrw: 101_000,
      onOpenPriceEditor: () => calls.push(1),
    });
    const btns = [...el.querySelectorAll('[data-testid="market-edit-final-price"]')];
    /**
     * 🔵🔵 UX-CONSOLIDATION ⑤ 에서 **2 → 1 로 바뀌었다**(약화가 아니라 **강화**).
     * 🔴 판매가는 **상품 단위 값** 이라 시장마다 그리면 같은 금액·같은 CTA 가 두 벌
     *    뜬다(CEO 캡처). ⟹ 「시장마다 하나」가 아니라 **「화면에 하나뿐」** 이 맞다.
     */
    expect(btns.length, "🔴 확정 CTA 가 사라졌거나 다시 두 벌이 됐다").toBe(1);
    expect(btns[0]!.tagName, "🔴 클릭 가능한 버튼이 아니다").toBe("BUTTON");
    /** 🔴 금액 줄도 하나뿐이다 — 같은 숫자를 두 번 말하지 않는다. */
    expect(el.querySelectorAll('[data-testid="market-final-price"]').length).toBe(1);
    act(() => {
      btns[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(calls.length, "🔴 클릭해도 아무 일도 일어나지 않는다").toBe(1);
    /** 🟢 현재 판매가가 **그 자리에** 보인다(편집기로 가기 전에도 사실이 보인다). */
    expect(q(el, "market-final-price-amount")?.textContent ?? "").toContain("101,000");
  });

  it("F-2 🔴🔴 **배선 앵커** — 워크스페이스가 「탭만 바꾸는」 핸들러를 넘기지 않는다", () => {
    /**
     * 🔴 마운트 DOM 은 **운영 배선을 보지 못한다**(이 리포가 반복해서 밟은 함정) —
     *    위 F-1 은 하니스가 넘긴 핸들러를 확인할 뿐이다. 🟢 그래서 소스로 문다.
     * 🔴 `() => setTab("source")` 였을 때 이 블록은 **이미 그 탭** 이라 클릭이 무효였다.
     */
    const SRC = readFileSync(
      join(__dirname, "../../CommerceWorkspace.tsx"),
      "utf8",
    ).split(String.fromCharCode(13)).join("");
    expect(SRC, "🔴 CTA 배선이 사라졌다").toContain("onOpenPriceEditor={handleRequestPriceReview}");
    expect(SRC, "🔴 탭만 바꾸는 핸들러로 되돌아갔다 — 이미 그 탭이면 무효다").not.toContain(
      'onOpenPriceEditor={() => setTab("source")}',
    );
    /** 🔴 그 핸들러가 **셋을 다 한다** — 하나라도 빠지면 「열린다」가 거짓이 된다. */
    const body = SRC.slice(SRC.indexOf("function handleRequestPriceReview"));
    const fn = body.slice(0, body.indexOf("\n  }\n") + 4);
    expect(fn, "🔴 탭 전환이 빠졌다").toContain('setTab("source")');
    expect(fn, "🔴 접힘 펼침이 빠졌다").toContain("setPriceSurfaceRequest");
    expect(fn, "🔴 편집기로 가는 스크롤이 빠졌다").toContain("PRICE_SURFACE_ANCHOR_ID");
    /** 🟢 **저장 경로는 그대로** — 확정은 `PriceEditor` 와 같은 함수다(A 정책 유지). */
    expect(SRC, "🔴 확정 저장 경로가 갈렸다").toContain("onConfirmPriceKrw={updateSalePriceKrw}");
  });
});

describe("MSRUX-1 UI-3 — 🇰🇷/🌎 블록 셸이 같다", () => {
  it("G-1 🟢 두 블록의 **바깥 셸 클래스가 동일** 하다(한쪽만 카드가 아니다)", () => {
    const el = mount({ rows: [...KR, ...OS], domesticReference: KR_REF });
    const kr = q(el, "market-block-domestic") as HTMLElement | null;
    const os = q(el, "market-block-overseas") as HTMLElement | null;
    expect(kr && os, "🔴 한쪽 블록이 서지 않는다").toBeTruthy();
    expect(kr!.className, "🔴 두 시장 블록의 셸이 갈렸다").toBe(os!.className);
  });

  it("G-2 🟢 안쪽 가격 카드도 **같은 셸** 이다 — 둘 다 가격이 있을 때", () => {
    const el = mount({ rows: [...KR, ...OS], domesticReference: KR_REF });
    const card = q(el, "domestic-reference") as HTMLElement;
    const guide = q(el, "price-guide-overseas") as HTMLElement;
    expect(card && guide, "🔴 한쪽 가격 카드가 없다 — 표본이 분기를 안 탔다").toBeTruthy();
    for (const cls of ["rounded-md", "border", "bg-muted/20", "p-3"]) {
      expect(card.className, `🔴 국내 카드에 ${cls} 가 없다`).toContain(cls);
      expect(guide.className, `🔴 해외 카드에 ${cls} 가 없다`).toContain(cls);
    }
  });

  it("G-3 🔴 가격이 **없는** 시장에는 빈 카드를 만들지 않는다(빈 틀 금지 · 기존 계약)", () => {
    const el = mount({ rows: [...KR, ...OS], domesticReference: null });
    expect(q(el, "domestic-reference"), "🔴 빈 가격 카드를 만들었다").toBeNull();
    /** 🟢 그래도 **그 시장 칸은 선다** — 「조회조차 안 됐다」로 읽히지 않는다. */
    expect(q(el, "market-block-domestic"), "🔴 국내 칸이 통째로 사라졌다").toBeTruthy();
    expect(countText(el, "domestic")).toContain(SAME_CONFIRMED_COUNT_LABEL);
  });

  it("G-4 🔴 가격 **차액** UI 를 만들지 않는다(판단 유도 금지)", () => {
    const el = mount({ rows: [...KR, ...OS], domesticReference: KR_REF });
    const text = q(el, "market-blocks")?.textContent ?? "";
    for (const token of ["차액", "차이", "더 싸", "더 비싸", "절감", "마진율"]) {
      expect(text, `🔴 가격 차이를 근거로 판단을 유도한다: ${token}`).not.toContain(token);
    }
  });
});
