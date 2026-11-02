/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 PRICE & CANDIDATE UX FINAL FIX — **가격과 후보를 «별도 acceptance 축» 으로**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「그래야 다시 『DOM 은 있는데 실제로는 못 쓴다』는 식의 PASS 가 나오지 않는다」.
 *    그래서 이 파일은 **두 축** 만 본다 — ⒜ **가격의 의미가 갈리는가** ⒝ **후보를 쓸 수 있는가**.
 *
 * 🔴 입력은 **운영 `candidate_reviews` 실덤프** 다(fixture 조작 0).
 * 🔴 **「Production UI PASS」로 쓰지 않는다** — 실제 화면은 CTO 가 볼 수 없다(마운트 DOM 축).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  CANDIDATE_LIST_OPEN_HINT,
  SUMMARY_PRICE_KRW_UNAVAILABLE,
} from "../mi-same-candidates";
import { EDIT_FINAL_PRICE_LINK_TEXT } from "../recommended-price-copy";
/** 🔴 기대값을 **운영이 쓰는 그 함수** 로 만든다(환율표 복제 0). */
import { convertToKrwStrict } from "@commerce/pricing";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import { toSavedCandidateRows } from "../../../api/price-history/_lib/saved-candidate-rows";
import { candidateReviewRowFromDb } from "../../../api/price-history/_lib/candidate-review";

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
const bothMarkets = (): GeminiTransientRow[] => {
  const d = dump();
  return [...restored(d.legacy.rows), ...restored(d.sellerUrl)];
};
/** 🟢 카드 축 표본 — 판정과 무관하게 외화 카드가 서면 된다. */
const overseasCards = (cur: string): GeminiTransientRow[] =>
  bothMarkets().filter((r) => r.market === "OVERSEAS" && r.priceCurrency === cur);

/**
 * 🔴🔴 **그리고 운영 덤프만으로는 1차 가격 가이드를 세울 수 없었다 — 적는다.**
 *
 * 그 파일의 해외 행은 `PRESUMED_SAME · COMPARISON` 이 대부분이고 `EXACT` 한 건도
 * `buildMarketJudgement` 의 SAME 축에 들어가지 않는다 ⟹ `price-guide-overseas` 가
 * **서지 않는다**(그 자리는 「동일상품 확인 0곳」이다).
 * 🟢 그래서 **이 축에서만** 리포의 기존 빌더를 쓴다 — `core-2ao-r1`/`core-2e` 가 같은
 *    블록을 재려고 쓰는 **그 모양 그대로** 다(손으로 지어낸 모양이 아니다).
 * 🔴 다른 축(카드·후보·편집 진입점)은 **운영 덤프 그대로** 쓴다.
 */
const sameRow = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "Hug Hairy Monster T-Shirt",
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

const SNAP = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";

function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(MarketPriceComparison, { snapshotId: SNAP, ...props }));
  });
  return {
    host,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}
const q = (h: HTMLElement, id: string) => h.querySelector(`[data-testid="${id}"]`);
const text = (el: Element | null): string => (el?.textContent ?? "").replace(/\s+/g, " ");

/* ═════════════ 축 ⒜ — 소싱 가격의 «의미» 가 갈린다 ═════════════ */

describe("PX-A 소싱 가격 — 원 통화 + 원화 환산이 **같이** 선다(§3·§4)", () => {
  it("PX-A-1 🟢🟢 해외 1차 소싱가에 원 통화와 **약 ₩ 환산** 이 둘 다 있다", () => {
    const rows = [sameRow({ priceCurrency: "USD", priceAmount: 58, discoveredUrl: "https://o.example/1" })];
    const m = mount({ rows });
    try {
      const head = text(q(m.host, "price-guide-headline"));
      expect(head, "🔴 원 통화가 사라졌다").toContain("USD");
      const krw = q(m.host, "market-summary-price-krw");
      expect(krw, "🔴 1차 해외 소싱가에 원화 환산이 없다").not.toBeNull();
      /** 🔴 **같은 함수로** 기대값을 만든다 — 환율표를 복제하지 않는다. */
      const lowest = Math.min(...rows.map((r) => Number(r.priceAmount)));
      const expected = convertToKrwStrict(lowest, "USD");
      expect(expected, "🔴 표본 통화가 환산 불가다(이 케이스를 못 잰다)").not.toBeNull();
      expect(text(krw)).toContain(String(expected!.amountKrw.toLocaleString("ko-KR")));
    } finally {
      m.cleanup();
    }
  });

  it("PX-A-2 🔴 **국내에는 환산을 그리지 않는다**(같은 숫자를 두 번 적지 않는다)", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const kr = q(m.host, "price-guide-domestic");
      if (kr) {
        expect(
          kr.querySelector('[data-testid="market-summary-price-krw"]'),
          "🔴 원화 블록에 원화 환산이 또 생겼다",
        ).toBeNull();
      }
    } finally {
      m.cleanup();
    }
  });

  it("PX-A-3 🔴🔴 **통화가 섞이면 환산을 만들지 않는다**(최저가를 하나로 못 고른다)", () => {
    const rows = bothMarkets().filter((r) => r.market === "OVERSEAS");
    const currencies = new Set(rows.map((r) => r.priceCurrency).filter(Boolean));
    expect(currencies.size, "🔴 혼합 통화 표본이 없다(분모 0)").toBeGreaterThan(1);
    const m = mount({ rows });
    try {
      expect(
        q(m.host, "market-summary-price-krw"),
        "🔴 통화가 섞였는데 하나의 환산 숫자를 만들었다",
      ).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  it("PX-A-4 🔴🔴 **모르는 통화는 숫자를 만들지 않는다** — 「원화 환산 불가」를 적는다", () => {
    /**
     * 🔴 CORE-2E §4-4 가 되돌린 이유가 **정확히 이것** 이다(`CAD 64 → 약 ₩64`).
     * 🟢 `convertToKrwStrict` 는 모르는 통화에 `null` 을 준다 ⟹ 구조적으로 불가능하다.
     */
    const fake = sameRow({ priceCurrency: "ZZZ", priceAmount: 58, discoveredUrl: "https://o.example/1" });
    expect(convertToKrwStrict(Number(fake.priceAmount), "ZZZ"), "🔴 표본 통화가 환산된다").toBeNull();
    const m = mount({ rows: [fake] });
    try {
      expect(q(m.host, "market-summary-price-krw"), "🔴 거짓 환산 숫자가 생겼다").toBeNull();
      const note = q(m.host, "market-summary-price-krw-unavailable");
      expect(note, "🔴 환산 불가를 조용히 빼 버렸다").not.toBeNull();
      expect(text(note)).toContain(SUMMARY_PRICE_KRW_UNAVAILABLE);
    } finally {
      m.cleanup();
    }
  });
});

/* ═════════════ 축 ⒜-2 — 소싱 가격 ↔ 최종 판매가격 분리 ═════════════ */

describe("PX-B 최종 판매가격 — **편집 owner 는 하나 · 진입점은 1차에도 있다**(§3·§10)", () => {
  it("PX-B-1 🟢 1차에 **[가격 수정]** 이 선다(추천 판매가 옆)", () => {
    const m = mount({
      rows: bothMarkets(),
      recommendedPriceKrw: 295796,
      onApplyRecommendedPrice: () => {},
      onOpenPriceEditor: () => {},
    });
    try {
      const link = q(m.host, "market-edit-price-link");
      expect(link, "🔴 1차에 가격 수정 진입점이 없다").not.toBeNull();
      expect(text(link)).toContain(EDIT_FINAL_PRICE_LINK_TEXT);
    } finally {
      m.cleanup();
    }
  });

  it("PX-B-2 🔴 핸들러가 **없으면** 그리지 않는다(갈 곳 없는 버튼 금지)", () => {
    const m = mount({
      rows: bothMarkets(),
      recommendedPriceKrw: 295796,
      onApplyRecommendedPrice: () => {},
    });
    try {
      expect(q(m.host, "market-edit-price-link")).toBeNull();
    } finally {
      m.cleanup();
    }
  });

  it("PX-B-3 🔴🔴 **같은 핸들러** 다 — 1차와 상세가 서로 다른 편집기를 부르지 않는다", () => {
    const spy = vi.fn();
    const m = mount({
      rows: bothMarkets(),
      recommendedPriceKrw: 295796,
      onApplyRecommendedPrice: () => {},
      onOpenPriceEditor: spy,
    });
    try {
      (q(m.host, "market-edit-price-link") as HTMLButtonElement).click();
      expect(spy).toHaveBeenCalledTimes(1);
      (q(m.host, "market-edit-final-price") as HTMLButtonElement).click();
      expect(spy, "🔴 상세의 수정 링크가 다른 함수를 부른다").toHaveBeenCalledTimes(2);
    } finally {
      m.cleanup();
    }
  });

  it("PX-B-4 🔴 시장 블록의 `market-edit-final-price` 개수는 **2 그대로** 다(계약 R2 유지)", () => {
    const m = mount({ rows: bothMarkets(), finalPriceKrw: 85000, onOpenPriceEditor: () => {} });
    try {
      expect(m.host.querySelectorAll('[data-testid="market-edit-final-price"]').length).toBe(2);
      /** 🔴 1차의 것은 **다른 testid** 다 — 두 축을 섞으면 개수 계약이 거짓이 된다. */
      expect(m.host.querySelectorAll('[data-testid="market-edit-price-link"]').length).toBe(0);
    } finally {
      m.cleanup();
    }
  });

  it("PX-B-5 🔴 1차 `₩` 는 **권장가 줄 + 환산 줄** 뿐이다 — CTA 가 금액을 품지 않는다", () => {
    const m = mount({
      rows: [sameRow({ priceCurrency: "USD", priceAmount: 58, discoveredUrl: "https://o.example/1" })],
      recommendedPriceKrw: 295796,
      onApplyRecommendedPrice: () => {},
      onOpenPriceEditor: () => {},
    });
    try {
      /**
       * 🔴🔴 **내 1차 단언이 또 틀렸다. 적는다.** 처음엔 `price-detail-fold` 와 환산 줄만
       *    걷어내고 `₩ 1개` 를 셌는데 **3** 이 나왔다 — 후보 **카드의 환산 줄** 이 같이
       *    잡혔기 때문이다. 🟢 카드는 `mi-candidate-list`(닫힌 접힘) 안이라 셀러가
       *    **펼치기 전에는 보지 않는다** ⟹ 「1차 ₩ 개수」의 분모가 아니다.
       */
      const clone = m.host.cloneNode(true) as HTMLElement;
      for (const n of [
        ...clone.querySelectorAll(
          '[data-testid="price-detail-fold"],[data-testid="mi-candidate-row"],[data-testid="market-summary-price-krw"]',
        ),
      ])
        n.remove();
      const first = (clone.textContent ?? "").replace(/\s+/g, " ");
      expect((first.match(/₩/g) ?? []).length, "🔴 1차에 ₩ 가 둘 이상이다").toBe(1);
      expect(text(q(m.host, "market-edit-price-link")), "🔴 수정 링크에 금액이 들어갔다").not.toMatch(
        /[₩0-9]/,
      );
    } finally {
      m.cleanup();
    }
  });
});

/* ═════════════ 축 ⒝ — 후보를 «쓸 수 있는가» ═════════════ */

describe("PX-C 후보 — 「있다」가 아니라 **「볼 수 있다」** 를 말한다(§5)", () => {
  it("PX-C-1 🟢 요약 줄에 **건수 + 행동** 이 같이 있다", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      const lists = [...m.host.querySelectorAll('[data-testid="mi-candidate-list"] > summary')];
      expect(lists.length, "🔴 후보 요약이 없다(분모 0)").toBeGreaterThan(0);
      for (const s of lists) {
        const t = text(s);
        expect(t, "🔴 건수가 사라졌다").toMatch(/\d+곳/);
        expect(t, "🔴 행동(후보 보기)이 없다").toContain(CANDIDATE_LIST_OPEN_HINT);
      }
    } finally {
      m.cleanup();
    }
  });

  it("PX-C-2 🔴 행동 어휘를 붙여도 **`open` 은 붙지 않는다**(WU-091 ①)", () => {
    const m = mount({ rows: bothMarkets() });
    try {
      for (const d of m.host.querySelectorAll('[data-testid="mi-candidate-list"]')) {
        expect(d.hasAttribute("open"), "🔴 후보 목록이 펼쳐졌다").toBe(false);
      }
    } finally {
      m.cleanup();
    }
  });

  it("PX-C-3 🔴🔴 후보 카드가 **쓸 수 있는 상태** 다 — 가격·판매처·확정이 전부 있다", () => {
    const m = mount({ rows: bothMarkets(), onConfirmPriceKrw: () => {} });
    try {
      const cards = [...m.host.querySelectorAll('[data-testid="mi-candidate-row"]')];
      expect(cards.length, "🔴 후보 카드가 없다(분모 0)").toBeGreaterThan(0);
      for (const c of cards) {
        expect(c.querySelector('[data-testid="mi-candidate-group"]'), "🔴 판정 라벨 없음").not.toBeNull();
        expect(c.querySelector('[data-testid="mi-candidate-price"]'), "🔴 가격 줄 없음").not.toBeNull();
        expect(c.querySelector('[data-testid="mi-candidate-seller"]'), "🔴 판매처 없음").not.toBeNull();
        /** 🔴 확정은 **금액이 있고 환산 가능한** 후보에만 — 없으면 **이유** 가 있어야 한다. */
        const confirm = c.querySelector('[data-testid="mi-candidate-confirm-price"]');
        const why = c.querySelector('[data-testid="mi-candidate-confirm-unavailable"]');
        const priced = (text(c.querySelector('[data-testid="mi-candidate-price"]')) ?? "").match(/\d/);
        if (priced) {
          expect(confirm ?? why, "🔴 가격이 있는데 확정도 이유도 없다").not.toBeNull();
        }
      }
    } finally {
      m.cleanup();
    }
  });

  it("PX-C-4 🔴 외화 카드는 **원 통화 + 환산** 을 같이 그린다(§4)", () => {
    const rows = overseasCards("GBP");
    expect(rows.length, "🔴 외화 카드 표본이 없다(분모 0)").toBeGreaterThan(0);
    const m = mount({ rows });
    try {
      const card = m.host.querySelector('[data-testid="mi-candidate-row"]')!;
      expect(text(card.querySelector('[data-testid="mi-candidate-price"]'))).toContain("GBP");
      const krw =
        card.querySelector('[data-testid="mi-candidate-price-krw"]') ??
        card.querySelector('[data-testid="mi-candidate-price-krw-unavailable"]');
      expect(krw, "🔴 외화 카드에 환산도 환산불가도 없다").not.toBeNull();
    } finally {
      m.cleanup();
    }
  });
});
