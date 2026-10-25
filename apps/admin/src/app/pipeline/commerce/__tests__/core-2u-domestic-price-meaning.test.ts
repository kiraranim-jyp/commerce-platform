/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices } from "../../../api/price-history/_lib/candidate-market";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  DOMESTIC_REFERENCE_TITLE,
  DOMESTIC_SAME_NOT_CONFIRMED,
  OVERSEAS_REFERENCE_TITLE,
} from "../overseas-reference";
import {
  DOMESTIC_BAND_LABEL,
  PRICE_BASIS_REFERENCE_LINE,
  PRICE_GUIDE_TITLE,
  SAME_CONFIRMED_COUNT_LABEL,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2U-A — **가격은 살아 있고, SAME 은 거짓말하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO Production 화면이 「**국내 가격 형성대  유사상품 1**」로 떴고 CPO 가 반려했다.
 *    그 숫자의 근거는 `TEXT_CONFIRMED → COMPARISON`(= 유사상품)이고,
 *    **유사상품 가격을 「형성대」라 부르면 셀러 의사결정 기준이 틀린다**.
 *
 * ── 🔴 왜 국내에서 SAME 이 안 나오는가 (코드로 확정 · 고치지 않는다) ─────────────
 * ```
 * 국내 후보 → crossSellerVerdict PRESUMED_SAME → match-truth.ts:233 crossSellerReserved
 *          → :237 식별자 경로 **차단** → matchTruth **TEXT_CONFIRMED**
 *          ├ domestic-product-link.ts:88  → **COMPARISON**      (참고 축 통과)
 *          └ match-display.ts:268         → **PRESUMED_SAME**   (SAME 축 탈락)
 * 🔴 그 완화는 WU-066 실측 precision **91.7% → 55.6%** 로 **영구 폐기** 다(8축 FREEZE).
 * ```
 * 🟢 **CPO 결정 A** — 가격을 **없애지 않고** 이름을 정직하게 가른다:
 * ```
 * SAME 가격 있음  → 「💰 … 동일상품 확인 가격」(+ 금액이 다르면 **가격대**)
 * SAME 가격 없음  → **「국내 참고가격」** + 「동일상품으로 확정된 국내 판매처는 없습니다」
 * ```
 * 🔴 **새 MI 알고리즘이 아니다**(§8) — 기존 판정 결과를 **seller-facing 으로 해석하는
 *    계층** 에서만 처리한다. SAME/threshold/8축/crossSellerReserved **변경 0**.
 */

const COMMERCE = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const AREA = strip(readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8"));
const CAND = strip(
  readFileSync(join(COMMERCE, "..", "..", "api", "price-history", "_lib", "candidate-market.ts"), "utf8"),
);

/* ───────────────────────── fixture ───────────────────────── */

const base: GeminiTransientRow = {
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
};
/** 🟢 실측 그대로 — 국내 후보는 `PRESUMED_SAME`(= SAME 축 탈락 · 참고 축 통과). */
const SIMILAR_ROWS: GeminiTransientRow[] = [base];
/** 🟢 SAME 축에 서는 모양 — `EXACT_IDENTIFIER` 라야 `transientDisplayTier === "SAME"` 이다. */
const sameRow = (o: Partial<GeminiTransientRow>): GeminiTransientRow => ({
  ...base,
  matchTruth: "EXACT_IDENTIFIER",
  crossSellerVerdict: "SAME",
  soldOut: false,
  ...o,
});

const ref = (recs: { amount: number; seller: string; tier?: string }[]): OverseasPriceSummary =>
  summarizeCandidateOverseasPrices(
    recs.map((r) => ({
      market: "KR",
      currency: "KRW",
      amount: r.amount,
      priceTier: r.tier ?? "COMPARISON",
      sellerKey: r.seller,
    })),
  );

function mount(props: Parameters<typeof MarketPriceComparison>[0]): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(createElement(MarketPriceComparison, props));
  });
  return host;
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
const text = (el: HTMLElement, id: string) => q(el, id)?.textContent ?? "";
const firstScreen = (el: HTMLElement): string => {
  const c = el.cloneNode(true) as HTMLElement;
  for (const d of [...c.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (c.textContent ?? "").replace(/\s+/g, " ").trim();
};

/* ═══════════════ §8 Case A~F — seller-facing 가격의 단일 기준 ═══════════════ */

describe("§8 Case A~F — 기존 판정 결과를 하나의 seller-facing 의미로", () => {
  /** Case 유사상품만 → **국내 참고가격**(형성대 아님) · 실측 B226AC009 가 이 모양이다. */
  it("C-SIM 🟢🟢 유사상품만 있으면 **「국내 참고가격」** 이고 「형성대」가 아니다", () => {
    const el = mount({ rows: SIMILAR_ROWS, domesticReference: ref([{ amount: 88000, seller: "donokids.com" }]) });
    const kr = text(el, "domestic-reference");
    expect(kr).toContain(DOMESTIC_REFERENCE_TITLE);
    expect(kr).toContain("KRW 88,000");
    expect(kr).toContain("확인 1곳");
    /** 🔴🔴 **CPO 가 반려한 그 모양** — 유사상품 기준을 「형성대」로 부르지 않는다. */
    expect(kr, "🔴 유사상품 기준인데 「형성대」로 적었다").not.toContain("형성대");
    expect(kr, "🔴 「가격대」로도 적지 않는다").not.toContain(DOMESTIC_BAND_LABEL);
    /** 🔴 §5 — 내부 등급 어휘가 셀러 결론 옆에 **없다**. */
    expect(kr, "🔴 내부 등급 분포가 노출됐다").not.toContain("유사상품");
  });

  /** 🔴🔴 §1·§4 — **가격과 「확정 여부」가 나란히 서고 서로 모순되지 않는다.** */
  it("C-SIM-b 🔴🔴 가격 바로 아래에서 **「동일상품 확정 없음」** 을 말한다", () => {
    const el = mount({ rows: SIMILAR_ROWS, domesticReference: ref([{ amount: 88000, seller: "donokids.com" }]) });
    expect(text(el, "reference-status")).toBe(DOMESTIC_SAME_NOT_CONFIRMED);
    /** 🔴 **금액 뒤가 아니라 금액 «바로» 뒤** 여야 한다 — note/scope 뒤로 밀면 안 읽힌다. */
    const html = (q(el, "domestic-reference") as HTMLElement).innerHTML;
    expect(html.indexOf('data-testid="domestic-lowest"')).toBeLessThan(
      html.indexOf('data-testid="reference-status"'),
    );
  });

  /** Case SAME + 가격 → **동일상품 확인 가격**(참고가격 블록이 서지 않는다). */
  it("C-SAME 🟢 SAME + 가격이면 **동일상품 확인 가격** 이고 참고 블록이 서지 않는다", () => {
    const el = mount({
      rows: [sameRow({})],
      domesticReference: ref([{ amount: 88000, seller: "donokids.com" }]),
    });
    expect(q(el, "price-guide-domestic")).not.toBeNull();
    expect(text(el, "price-guide-domestic")).toContain(PRICE_GUIDE_TITLE.KR);
    /** 🔴 같은 금액이 두 자리에 뜨지 않는다(참고 블록은 그때 꺼진다). */
    expect(q(el, "domestic-reference")).toBeNull();
  });

  /** Case SAME + 서로 다른 가격 → **가격대**(그때만 「가격대」를 쓴다). */
  it("C-BAND 🟢 SAME 이 서로 다른 가격이면 **가격대** 를 쓴다", () => {
    const el = mount({
      rows: [
        sameRow({}),
        sameRow({
          domain: "miniboutique.co.kr",
          discoveredUrl: "https://miniboutique.co.kr/product/x/1/",
          priceAmount: 83600,
        }),
      ],
    });
    const kr = text(el, "price-guide-domestic");
    expect(kr).toContain("KRW 83600 ─ 88000");
    expect(kr).toContain(DOMESTIC_BAND_LABEL);
  });

  /** Case DIFFERENT + 가격 → 어느 가격 축에도 들어가지 않는다. */
  it("C-DIFF 🔴 `EXCLUDED`(동일상품 아님) 가격은 집계에 들어가지 않는다", () => {
    const s = summarizeCandidateOverseasPrices([
      { market: "KR", currency: "KRW", amount: 88000, priceTier: "EXCLUDED", sellerKey: "x.kr" },
    ]);
    expect(s.byCurrency).toEqual({});
    const el = mount({ rows: SIMILAR_ROWS, domesticReference: s });
    expect(q(el, "domestic-reference"), "🔴 동일상품 아님 가격이 화면에 섰다").toBeNull();
  });

  /** Case SAME + 가격 없음 → 판매처는 있으나 가격 없음. */
  it("C-NOPRICE 🔴 SAME 인데 가격이 없으면 **금액을 지어내지 않는다**", () => {
    const el = mount({ rows: [sameRow({ priceAmount: null, priceStatus: "UNVERIFIED_SEARCH" })] });
    expect(q(el, "price-guide-domestic")).not.toBeNull();
    expect(text(el, "price-guide-empty")).toContain("확인된 가격이 아직 없습니다");
    expect(text(el, "price-guide-domestic")).not.toMatch(/KRW\s*\d/);
  });

  /** Case 후보 없음 → 가격 없음(빈 틀을 만들지 않는다). */
  it("C-NONE 🔴 후보가 없으면 가격 블록이 **서지 않는다**", () => {
    const el = mount({ rows: [] });
    expect(q(el, "domestic-reference")).toBeNull();
    expect(q(el, "price-guide-domestic")).toBeNull();
    expect(text(el, "market-empty-domestic")).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 0곳`);
  });

  /** Case 중복 판매처 → 1곳. 🟢 집계기가 **판매처당 최저 확인가 하나** 로 접는다. */
  it("C-DUP 🔴 같은 판매처가 두 번 와도 **확인 1곳** 이고 범위가 안 생긴다", () => {
    const el = mount({
      rows: SIMILAR_ROWS,
      domesticReference: ref([
        { amount: 88000, seller: "donokids.com" },
        { amount: 92000, seller: "DONOKIDS.COM" },
      ]),
    });
    const kr = text(el, "domestic-reference");
    expect(kr).toContain("확인 1곳");
    expect(kr).toContain("KRW 88,000");
    expect(kr, "🔴 중복이 형성대를 넓혔다").not.toContain("~");
  });
});

/* ═══════════════ §3·§6·§7 — 숫자는 하나 · 반복 없음 ═══════════════ */

describe("§3·§6·§7 — seller-facing 은 하나의 가격 판단", () => {
  const el = () =>
    mount({
      rows: SIMILAR_ROWS,
      domesticReference: ref([{ amount: 88000, seller: "donokids.com" }]),
      overseasReference: summarizeCandidateOverseasPrices([
        { market: "OVERSEAS", currency: "GBP", amount: 37, priceTier: "EXACT" },
        { market: "OVERSEAS", currency: "USD", amount: 58, priceTier: "COMPARISON" },
      ]),
    });

  it("U-1 🔴 국내 금액이 첫 화면에 **한 번만** 뜬다", () => {
    const html = el().innerHTML;
    expect((html.match(/KRW 88,000/g) ?? []).length).toBe(1);
  });

  /**
   * 🔴🔴 §7 의 실패 예시를 **직접** 막는다 —
   *    「국내 가격 1곳 / 동일상품 가격 0곳 / 유사상품 참고가격 1곳」이 동시에 보이면 실패다.
   */
  it("U-2 🔴🔴 **🇰🇷 블록 안에** 경쟁하는 건수 문장이 없다", () => {
    const host = el();
    /**
     * 🔴🔴 **1차 단언이 틀렸고 그것을 적는다.** 처음엔 **첫 화면 전체** 에서
     *    `"판매처 1곳"` 을 금지했는데, 그 말은 **🌎 해외 축의 기존 어휘** 라서
     *    §9(해외 불변)와 **정면으로 충돌** 했다 — 즉 **내 단언이 틀렸고 코드가 맞았다**.
     * 🟢 그래서 **🇰🇷 블록으로 범위를 좁힌다** — §7 이 금지한 것은 「셀러가 **한 시장에서**
     *    여러 숫자를 해석해야 하는 구조」다.
     */
    const kr = text(host, "market-block-domestic");
    for (const bad of ["유사상품 참고가격", "판매처 1곳", "후보 1곳", "보류·충돌"]) {
      expect(kr, `🔴 🇰🇷 블록에 경쟁 숫자/내부 상태가 있다: ${bad}`).not.toContain(bad);
    }
    /** 🟢 남아야 하는 것 — 가격 하나 · 분모 하나 · 확정 여부 하나. */
    expect(kr).toContain("KRW 88,000");
    expect(kr).toContain("확인 1곳");
    expect(kr).toContain(DOMESTIC_SAME_NOT_CONFIRMED);
    /** 🔴 1차 전체에서는 **MI 내부 상태** 만 금지한다(§5). */
    expect(firstScreen(host)).not.toContain("보류·충돌");
  });

  /** 🔴 §5 — MI 내부 상태는 `▸ MI 상세 분석` 안에 **있고** 1차에는 **없다**. */
  it("U-3 🔴 MI 보류 줄이 **2차로 격리** 됐다(삭제 아님)", () => {
    const host = el();
    const fold = q(host, "mi-detail-fold") as HTMLElement;
    expect(fold.querySelector('[data-testid="mi-same-pending"]')).not.toBeNull();
    expect(firstScreen(host), "🔴 MI 내부 상태가 1차에 남았다").not.toContain("판정이 보류·충돌된");
  });

  /** 🔴 §2 — 내부 어휘「유사상품까지 포함한 참고 축」이 **화면에서 사라졌다**. */
  it("U-4 🔴 「유사상품까지 포함한 참고 축」이 **없다**", () => {
    expect(el().textContent ?? "").not.toContain("유사상품까지 포함한 참고 축");
  });

  /** 🔴 §2 — 가격 판단 기준이 그 가격의 **성질** 을 말한다. */
  it("U-5 🟢 가격 판단 기준이 「확정 가격만을 의미하지 않는다」를 말한다", () => {
    expect(text(el(), "price-basis")).toContain(PRICE_BASIS_REFERENCE_LINE);
  });

  /** 🔴 §7 — 셀러에게 판단을 떠넘기는 문구 **0**. */
  it("U-6 🔴 「사진으로/눈으로 확인」류가 **없다**", () => {
    const whole = el().textContent ?? "";
    for (const bad of ["사진으로 확인", "눈으로 확인", "직접 판단해", "다시 분석"]) {
      expect(whole, `🔴 셀러에게 판단을 떠넘긴다: ${bad}`).not.toContain(bad);
    }
  });

  /**
   * 🔴🔴🔴 **CORE-2V §5 가 이 단언을 뒤집었다 — 이유를 적는다.**
   *
   * 🔴 CORE-2U 는 해외 `tierNote`(「동일상품 1 · **유사상품 1**」)를 **그대로 두고**
   *    「제목이 『해외 **동일상품** 참고가격』인데 유사상품이 섞여 있다」를 **CPO 판정으로
   *    올렸다**(§9 해외 변경 금지를 보수적으로 지킨 것이다).
   * 🟢 CORE-2V §5 가 그 판정을 내려 줬다 — `유사상품 1` 을 **핵심 가격 영역에서 제거**
   *    하라고 명시했고 **시장을 가르지 않았다** ⟹ 해외에도 적용한다.
   * 🔴🔴 **그래도 §9 는 지킨다** — 바뀐 것은 **등급 분포 라벨 하나** 이고
   *    **가격 숫자·통화·분모·제목은 전부 그대로** 다. 그것을 이 단언이 **양방향** 으로 문다.
   */
  it("U-7 🔴 해외 — 등급 분포만 꺼지고 **가격·통화·분모·제목은 불변** 이다", () => {
    const os = text(el(), "overseas-reference");
    /** 🟢 불변 — 제목 · 분모 어휘 · 통화별 금액. */
    expect(os).toContain(OVERSEAS_REFERENCE_TITLE);
    expect(os).toContain("판매처 1곳");
    expect(os).toContain("GBP 37");
    expect(os).toContain("USD 58");
    /** 🔴 꺼진 것 — 내부 등급 분포(§5 금지 목록의 「유사상품 1」). */
    expect(os, "🔴 내부 등급 분포가 핵심 가격 영역에 남았다").not.toMatch(/동일상품 \d|유사상품 \d/);
  });
});

/* ═══════════════ §9 — 열지 않은 축 ═══════════════ */

describe("§9 🔴 한 줄도 열지 않았다", () => {
  it("S-1 🔴 표시 계층에 SAME/threshold/환율/계산 어휘가 없다", () => {
    /**
     * 🔴🔴 **1차 단언이 틀렸고 그것을 적는다.** `costPrice` 를 금지했는데 이 영역은
     *    `costPriceKrw` **prop** 을 받는다 — 그것은 CORE-2S §5-⑤ 가 **CPO 승인으로**
     *    넣은 것이고 **「원가가 비었다」는 사실 하나만 말한다**(계산 0).
     *    ⟹ **내 금지 목록이 틀렸고 코드가 맞았다.**
     * 🟢 그래서 금지하는 것을 **「계산」** 으로 좁힌다 — 원가를 **읽는 것** 은 허용이고
     *    원가로 **무엇을 계산하는 것** 이 §9 금지다.
     */
    for (const banned of [
      "SAME_MIN_AXES",
      "threshold",
      "crossSellerReserved",
      "convertToKrw",
      "exchangeRate",
      "computeSellability",
      "computePriceRecommendation",
      "estimatedMargin",
      "추천 판매가",
      "권장 판매가",
      "적정 판매가",
    ]) {
      expect(AREA, `🔴 ${banned} 가 표시 영역에 들어왔다`).not.toContain(banned);
    }
    /** 🟢 원가는 **읽기만** 한다 — 그 사실을 양방향으로 적는다. */
    expect(AREA, "🔴 원가 prop 배선이 사라졌다(CORE-2S §5-⑤)").toContain("costPriceKrw");
    expect(AREA, "🔴 원가로 산수를 시작했다").not.toMatch(/costPriceKrw\s*[-*/+]/);
  });

  /** 🔴 집계기는 **tier 를 해석만** 한다 — 승격·완화를 만들지 않는다. */
  it("S-2 🔴 집계기가 tier 를 **승격하지 않는다**", () => {
    expect(CAND).toContain('r.priceTier === "EXCLUDED"');
    for (const banned of ["PRESUMED_SAME", "EXACT_IDENTIFIER", "matchTruth"]) {
      expect(CAND, `🔴 집계기가 판정 어휘를 다룬다: ${banned}`).not.toContain(banned);
    }
  });
});
