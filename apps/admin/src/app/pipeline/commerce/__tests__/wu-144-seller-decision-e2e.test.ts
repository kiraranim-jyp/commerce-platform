// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-144 — **셀러가 이 화면만 보고 「얼마에 팔까」를 판단할 수 있는가** (CPO STEP 6)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **MI 코어를 건드리지 않는다**(CPO STEP 1 동결) — 이 파일은 **읽기만** 한다.
 *    threshold · MODEL_CODE · AUDIENCE_LINE · NO_TITLE_OVERLAP · BRAND_* ·
 *    GARMENT_FORM · price_alerts **전부 불변**.
 *
 * ── 🟢 입력은 «지어낸 것이 아니다» ────────────────────────────────────────
 * 아래 두 묶음은 WU-142/143 의 **라이브 실측 산출** 을 그대로 옮긴 것이다
 * (`WU_142_PROBE=1` · 운영 함수 · 실제 HTTP):
 * ```
 * S1 B226AC010  🌎 동일상품 3 · 판매중 0 · 가격확인 3 → CAD 64 · GBP 37 · USD 58
 *               🇰🇷 0  (beaumonde 는 brand 미확인으로 PRESUMED_SAME · WU-143 HOLD)
 * S2 B226AC009  🌎 동일상품 3 · 판매중 1 · 가격확인 2 · 확인필요 1 → USD 58
 *               🇰🇷 0  (biskuit 는 BRAND_MISMATCH + NO_TITLE_OVERLAP · 축 4 < 5)
 * ```
 * 🔴 **「🇰🇷 0」을 고치지 않았다** — WU-143 이 네 레버를 전부 재고 **전부 되돌렸다**
 *    (C1 은 false SAME 13건 · C3/C4 는 precision·알림 계약 충돌).
 *    CPO: 「SAME 이 0 이어도 실패로 처리하지 않는다. **SAME 이 존재하는데 화면에서
 *    사라지면** 실패다.」
 *
 * ── 🔴 이 파일이 답하는 네 질문 (CPO STEP 8 의 A/B/C/D) ────────────────────
 * ```
 * A  SAME → 가격 → 판매중 이 정상인가
 * B  가격 없음 → 링크가 정상인가
 * C  국내/해외가 한 화면에서 명확한가
 * D  셀러가 후보를 직접 조사할 필요가 «없는가»
 * ```
 */

/** 🟢 실측 모양. 🔴 `priceTier`/`matchTruth` 를 지어내지 않는다(운영이 낸 조합 그대로). */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "t",
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
    priceStatus: null,
    market: "OVERSEAS",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

/** 🟢 S1 B226AC010 — 해외 SAME 3곳 · **판매중 0**(전부 확인불가) · 가격 3통화. */
const S1: GeminiTransientRow[] = [
  row({
    domain: "kolkid.ca",
    discoveredUrl: "https://kolkid.ca/p/1",
    priceAmount: 64,
    priceCurrency: "CAD",
    priceStatus: "VERIFIED_CURRENT",
  }),
  row({
    domain: "cissywears.com",
    discoveredUrl: "https://cissywears.com/p/2",
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
  }),
  row({
    domain: "www.tinyapple.net",
    discoveredUrl: "https://www.tinyapple.net/p/3",
    priceAmount: 58,
    priceCurrency: "USD",
    priceStatus: "VERIFIED_CURRENT",
  }),
];

/** 🟢 S2 B226AC009 — 해외 SAME 3곳 · **판매중 1** · 가격확인 2 · **가격 확인 필요 1**. */
const S2: GeminiTransientRow[] = [
  row({
    domain: "www.thefrontshop.com",
    discoveredUrl: "https://www.thefrontshop.com/p/1",
    soldOut: false,
    priceAmount: 58,
    priceCurrency: "USD",
    priceStatus: "VERIFIED_CURRENT",
  }),
  row({
    domain: "www.tinyapple.net",
    discoveredUrl: "https://www.tinyapple.net/p/2",
    priceAmount: 58,
    priceCurrency: "USD",
    priceStatus: "VERIFIED_CURRENT",
  }),
  /** 🔴 **가격을 못 가져온 SAME** — 버리지 않고 링크를 준다(WU-139 · CPO STEP 3). */
  row({
    domain: "global.trenbe.com",
    discoveredUrl: "https://global.trenbe.com/p/3",
    priceAmount: null,
    priceCurrency: null,
    priceStatus: null,
  }),
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** 🔴 셀러가 **읽는 글자** 만 본다 — 태그·속성·툴팁은 화면 높이를 차지하지 않는다. */
const render = (rows: GeminiTransientRow[]): string => {
  act(() => root.render(createElement(MarketPriceComparison, { rows })));
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
};

describe("WU-144 — 2상품 Seller Decision (CPO A/B/C/D)", () => {
  it("A 🟢 S2 — 동일상품 → 판매중 → 가격이 한 흐름으로 선다", () => {
    const t = render(S2);
    /** 🟢 셋이 **같은 줄의 묶음** 으로 나온다(`priceGuideCountNote`). */
    expect(t).toContain("동일상품 확인 3곳");
    expect(t).toContain("판매중 확인 1곳");
    expect(t).toContain("가격 확인 2곳");
    /** 🟢 그리고 **숫자가 실제로** 있다 — 「판단할 기준」이 화면에 있다. */
    expect(t).toContain("58");
    expect(t).toContain("USD");
  });

  it("B 🟢 가격을 못 가져온 SAME 이 **사라지지 않는다** — 확인 필요로 선다", () => {
    const t = render(S2);
    /** 🔴 CPO STEP 3 — 「가격 없는 후보 삭제」 금지. */
    expect(t).toContain("가격 확인 필요 1곳");
    /** 🟢 그리고 그 후보로 갈 길이 **링크로** 있다(WU-139 가 글자 → href 로 바꿨다). */
    expect(container.querySelector('a[href="https://global.trenbe.com/p/3"]')).not.toBeNull();
  });

  it("C 🟢 국내/해외가 **한 영역 안에서** 갈라진다 — 영역이 둘이 아니다", () => {
    const t = render(S2);
    expect(t).toContain("🇰🇷");
    expect(t).toContain("🌎");
    /** 🔴 가격 비교 영역은 화면에 **하나** 다(WU-132 계약 · R3 가 재확인). */
    expect(container.querySelectorAll('[data-testid="market-price-comparison"]').length).toBe(1);
  });

  it("D 🔴 **후보 리스트가 1차 화면에 펼쳐져 있지 않다**", () => {
    render(S2);
    /** 🔴 펼치면 후보가 「유력」으로 읽힌다(2026-09-19 사고 기전 · R2/R3 계약). */
    expect(container.querySelector("details[open]")).toBeNull();
    /** 🟢 접힘은 **있다** — 필요할 때 근거를 볼 수 있다(삭제가 아니라 계층이다). */
    expect(container.querySelectorAll("details").length).toBeGreaterThan(0);
  });

  /* ─────────── CPO STEP 3 — 가격 «표현» 이 셀러용인지 ─────────── */

  it("E 🔴 가격 1개를 「평균」·「가격대」로 부르지 않는다 — 평균은 **부정문으로만**", () => {
    /**
     * 🔴🔴 **WU-139 가 적어 둔 함정에 내가 걸렸다** — 1차에 `not.toContain("평균가")` 를
     *    썼더니 **필수 부정문** 이 FAIL 했다:
     *    `PRICE_GUIDE_SINGLE_NOTE = "확인 가능한 가격 1건 기준입니다 — 시장 평균가가 아닙니다."`
     * 🟢 그 문장은 **지켜야 하는 것** 이다(1건을 평균으로 읽지 않게 막는다).
     *    ⟹ 🔴 가드를 느슨하게 하지 않고 **「평균은 부정문으로만」** 으로 바꾼다
     *       (WU-139 가 같은 이유로 자기 가드를 강화한 그 모양 그대로).
     */
    const t = render(S2);
    /** 🟢 S2 는 USD 58 하나(두 곳이지만 **같은 금액**) ⟹ 범위가 아니다(WU-139 계약 B-2). */
    expect(t).toContain("시장 평균가가 아닙니다");
    expect(t).not.toContain("58 ~ 58");
    /** 🔴 「평균」이 **긍정으로** 쓰인 자리가 하나도 없다. */
    for (const m of t.match(/[^.。]*평균[^.。]*/g) ?? []) {
      expect(m, `평균이 긍정문에 쓰였다: ${m}`).toMatch(/아닙니다|아니다/);
    }
  });

  it("F 🟢 S1 — 판매중이 0 이어도 **가격 기준은 통화별로** 선다", () => {
    const t = render(S1);
    expect(t).toContain("동일상품 확인 3곳");
    expect(t).toContain("판매중 확인 0곳");
    /** 🔴 세 통화를 **더하지 않는다**(환산 0 · `overseas-reference` 계약). */
    for (const cur of ["CAD", "GBP", "USD"]) expect(t).toContain(cur);
    expect(t).not.toContain("₩");
    expect(t).not.toContain("약 ");
  });

  /* ─────────── CPO STEP 4 — 국내 0 의 «말» ─────────── */

  it("G 🔴🔴 국내 SAME 0 을 「국내에 상품이 없다」로 **단정하지 않는다**", () => {
    /**
     * 🔴 CPO STEP 4: 「『국내 상품이 없다』라고 단정하면 안 된다. 정확한 표현은
     *    **『현재 MI 가 동일상품으로 확정하지 못한 상태』** 다.」
     * 🟢 그 어휘는 이미 owner 가 갖고 있다(`MI_SAME_EMPTY` · `marketEmptyNote` ·
     *    WU-091 「부재와 미발견은 다르다」 계약).
     */
    const t = render(S2);
    expect(t).not.toContain("국내에 동일상품이 없");
    expect(t).not.toContain("국내 상품이 없");
    /** 🟢 대신 **확정하지 못했다** 는 말이 있다. */
    expect(t).toMatch(/확정|확인하지 못|아직 없습니다/);
  });

  it("H 🟢 조회가 돌지 않았으면 영역이 **서지 않는다** — 「후보 0」과 다른 사실이다", () => {
    expect(render(null as unknown as GeminiTransientRow[])).toBe("");
    /** 🟢 돌았는데 0 이면 영역은 **선다**(WU-130 ② 구분). */
    expect(render([])).not.toBe("");
  });
});
