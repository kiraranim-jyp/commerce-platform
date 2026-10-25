/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices } from "../../../api/price-history/_lib/candidate-market";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { DOMESTIC_REFERENCE_TITLE, OVERSEAS_REFERENCE_TITLE } from "../overseas-reference";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2T — **조사에서 찾은 국내 가격이 «형성대» 로 화면까지 간다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 **조사·수집·MI 는 새로 만들지 않았다**(§17). 실측(B226AC009 · 라이브)으로 확인된 것:
 * ```
 * ② 목록 탐색 → 상세 URL 2건      ③ 후보 accepted 2 · usable 2 · miEligible 2
 * ④ donokids     COMPARISON · KRW 88,000 · VERIFIED_CURRENT · market KR
 *    miniboutique COMPARISON · KRW 88,000 · VERIFIED_CURRENT · market KR
 * ⑦ comparison **2곳** avg=88,000      ⑧ 후보 2건 · **고유 URL 2건** ⟹ 🟢 중복 0
 * ```
 * 🔴🔴 **그런데 「마지막 1미터」가 끊겨 있었다** — `highestAmount` 는 CORE-2R-5 가
 *    **이미 집계** 하는데 `buildOverseasReference` 가 그 칸을 **한 번도 읽지 않았다** ⟹
 *    금액이 **서로 달라도** 화면은 최저가 한 줄만 보여줬다(= 「단일 참고가격」).
 *
 * 🔴 그리고 둘째 결함은 **구조** 였다 — 집계 레코드에 **URL 도 도메인도 없어서**
 *    「판매처 N곳」이 **수집 레코드 수** 였고 중복을 **막을 방법이 없었다**(§5).
 *
 * ── 🔴 이 파일이 «하지 않는» 것 ─────────────────────────────────────────────────
 * ```
 * ❌ 원가 · 마진 · 추천 판매가 · 수익성   ❌ SAME/threshold/MI 판정   ❌ 검색/AI
 * ❌ 해외 가격 로직 · 환율                ❌ 가격 영속화 정책
 * ```
 */

const COMMERCE = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const AREA = strip(readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8"));
const VIEW = strip(readFileSync(join(COMMERCE, "overseas-reference.ts"), "utf8"));
const INTEL = strip(
  readFileSync(join(COMMERCE, "..", "..", "api", "price-history", "_lib", "market-intelligence.ts"), "utf8"),
);

/** 🟢 실측 그대로 — 둘 다 `PRESUMED_SAME` 이라 **SAME 축은 0** 이다(그래서 참고 축이 선다). */
const ROWS: GeminiTransientRow[] = [
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

/** 🔴 §12 — **임의 가격을 삽입하지 않는다.** 아래 둘은 실측값(88,000 ×2 · 도메인 2개)이다. */
const KR_SAME_PRICE: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON", sellerKey: "donokids.com" },
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON", sellerKey: "miniboutique.co.kr" },
]);
/** 🟡 §13-D5 — 금액이 **서로 다를 때** 의 모양. 🔴 실측이 아니라 **형상 검증용** 이다. */
const KR_BAND: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "KR", currency: "KRW", amount: 86000, priceTier: "COMPARISON", sellerKey: "biskuit.kr" },
  { market: "KR", currency: "KRW", amount: 83600, priceTier: "COMPARISON", sellerKey: "donokids.com" },
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON", sellerKey: "miniboutique.co.kr" },
]);
/** 🟢 해외 — 실측(GBP 37 · USD 58). 🔴 `sellerKey` 를 **넘기지 않는다**(§9 불변). */
const OS_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "OVERSEAS", currency: "GBP", amount: 37, priceTier: "EXACT" },
  { market: "OVERSEAS", currency: "USD", amount: 58, priceTier: "COMPARISON" },
]);

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

/* ═══════════════ A. 🇰🇷 형성대가 화면까지 간다 ═══════════════ */

describe("A. 국내 가격 형성대 — 화면", () => {
  it("A-1 🟢🟢 금액이 다르면 **최저 ~ 최고** 가 첫 화면에 선다", () => {
    const first = firstScreen(mount({ rows: ROWS, domesticReference: KR_BAND }));
    expect(first).toContain(DOMESTIC_REFERENCE_TITLE);
    expect(first, "🔴 형성대가 아니라 최저가 한 줄만 뜬다 — 「마지막 1미터」가 끊겼다").toContain(
      "KRW 83,600 ~ 88,000",
    );
    expect(first).toContain("확인 3곳");
  });

  /** 🔴 §4 — **1건·같은 금액을 억지 범위로 만들지 않는다**(실측 D4 가 바로 이 모양이다). */
  it("A-2 🔴 D4 — 다른 판매처 **같은 금액** 이면 범위를 만들지 않고 「확인 2곳」", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_SAME_PRICE });
    const kr = text(el, "domestic-reference");
    expect(kr).toContain("KRW 88,000");
    expect(kr, "🔴 88,000 ~ 88,000 같은 거짓 폭을 만들었다").not.toContain("~");
    expect(kr).toContain("확인 2곳");
  });

  /** 🔴 §11 — 금액은 **한 번만** 대표로 표시한다. */
  it("A-3 🔴 같은 금액이 화면에 **반복되지 않는다**", () => {
    const html = mount({ rows: ROWS, domesticReference: KR_BAND, overseasReference: OS_REF }).innerHTML;
    expect((html.match(/83,600/g) ?? []).length).toBe(1);
    expect((html.match(/KRW 83,600 ~ 88,000/g) ?? []).length).toBe(1);
    expect((html.match(/GBP 37/g) ?? []).length).toBe(1);
  });

  /** 🔴 §9 — 국내와 해외를 **하나의 가격대로 합치지 않는다**. */
  it("A-4 🔴 국내 형성대와 해외 가격이 **섞이지 않는다**", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_BAND, overseasReference: OS_REF });
    const whole = el.textContent ?? "";
    for (const bad of ["83,600 ~ 58", "GBP 83,600", "KRW 37", "37 ~ 88,000"]) {
      expect(whole, `🔴 통화를 섞었다: ${bad}`).not.toContain(bad);
    }
    /**
     * 🟢 해외 축의 말은 **그대로** 다 — 「판매처 N곳」(§9).
     *
     * 🔴🔴 **1차 단언이 뚫렸고 그것을 적는다.** 처음엔 `toContain("판매처")` 였는데,
     *    그 글자가 **note 문장**(「해외 **판매처**에서 확인한 가격입니다」)에 **이미 있어서**
     *    라벨을 「확인」으로 바꾸는 변이(T5)가 **통과** 했다 — 단언 좌표가 틀렸다(함정 ③).
     * 🟢 그래서 **분모 줄 자체**(라벨 + 곳)를 단언하고, 국내 어휘가 그 구역에 들어오면
     *    FAIL 하도록 **양방향** 으로 잠근다.
     */
    const os = text(el, "overseas-reference");
    expect(os, "🔴 해외 분모가 「판매처 N곳」이 아니다 — §9 위반").toContain("판매처 1곳");
    expect(os, "🔴 국내 어휘가 해외 구역에 들어왔다").not.toContain("확인 1곳");
    expect(os).toContain(OVERSEAS_REFERENCE_TITLE);
    /** 🔴 반대로 국내 구역에는 해외의 말이 **없어야** 한다. */
    expect(text(el, "domestic-reference")).not.toContain("판매처 3곳");
    /** 🔴 환산 흔적 0. */
    expect(whole).not.toMatch(/[₩€$£¥]/);
    expect(whole).not.toContain("약 ");
  });

  /** 🔴 §10 — 「동일상품 확정 수」와 「국내 가격 확인 수」를 **합치지 않는다**. */
  it("A-5 🔴 동일상품 0곳이어도 형성대가 **독립적으로** 선다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_BAND });
    expect(text(el, "market-empty-domestic")).toContain("동일상품 확인 0곳");
    expect(text(el, "domestic-reference")).toContain("KRW 83,600 ~ 88,000");
  });
});

/* ═══════════════ B. 배선 — 끊기면 숫자가 조용히 틀린다 ═══════════════ */

describe("B. 🔴 배선 앵커", () => {
  /**
   * 🔴🔴 **행동 축만으로는 배선을 못 본다**(이 세션에서 실제로 뚫렸다 · WU-110 함정).
   *    그래서 **소스 앵커를 같이** 둔다.
   */
  it("B-1 🔴 국내 레코드가 **판매처 키를 실어 보낸다**", () => {
    expect(INTEL, "🔴 sellerKey 가 빠지면 「판매처 N곳」이 레코드 수가 된다").toContain(
      "sellerKey: e.domain",
    );
    /** 🔴 **해외 축에는 넘기지 않는다**(§9) — 넘기면 그 축의 숫자가 바뀐다. */
    const at = INTEL.indexOf("overseasEvidence.push({");
    expect(at).toBeGreaterThan(0);
    expect(INTEL.slice(at, at + 400), "🔴 해외 축에 판매처 키가 들어갔다 — §9 위반").not.toContain(
      "sellerKey",
    );
  });

  it("B-2 🔴 화면이 **최고가 칸을 읽는다**", () => {
    expect(VIEW, "🔴 highestAmount 를 읽지 않으면 형성대가 구조적으로 불가능하다").toContain(
      "v.highestAmount",
    );
    /**
     * 🔴 **집계가 판매처 단위로 접은 뒤의 수** 를 읽는다. 🟢 칸을 따로 두지 않았다 —
     *    1차 구현의 `sellerCount` 는 `count` 와 **항상 같아서** 지웠다(owner 둘 금지).
     */
    expect(VIEW).toContain("${countLabel} ${v.count}곳");
  });

  it("B-3 🔴 국내만 「확인」 라벨을 넘긴다(해외는 기본값)", () => {
    expect(AREA).toContain("sellerCountLabel: DOMESTIC_SELLER_COUNT_LABEL");
    const at = AREA.indexOf('testId="mi-same-overseas"');
    expect(at).toBeGreaterThan(0);
    expect(AREA.slice(at, at + 1200)).not.toContain("sellerCountLabel");
  });

  /** 🔴 §2 — 이 트랙에서 **열지 않은 축** 을 소스로 잠근다. */
  it("B-4 🔴 원가·마진·추천가·환율 어휘가 표시 경로에 **없다**", () => {
    for (const banned of [
      "costPrice",
      "margin",
      "추천 판매가",
      "권장 판매가",
      "적정 판매가",
      "convertToKrw",
      "exchangeRate",
    ]) {
      expect(VIEW, `🔴 ${banned} 가 참고가격 모듈에 들어왔다`).not.toContain(banned);
    }
  });
});
