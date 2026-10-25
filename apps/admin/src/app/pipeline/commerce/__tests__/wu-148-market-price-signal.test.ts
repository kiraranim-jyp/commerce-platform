// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  DOMESTIC_BAND_LABEL,
  OVERSEAS_LOWEST_LABEL,
  OVERSEAS_LOWEST_PER_CURRENCY_NOTE,
  PRICE_BAND_UNDETERMINED,
  /** 🔴 WU-149 — 가격 판단 상한(통화별 3). */
  SAME_PRICE_CAP,
  buildMarketJudgement,
  buildPriceGuide,
  domesticBandText,
  domesticPriceBand,
  marketDecisionLines,
  marketPriceHeadline,
  /** 🟢 CORE-2AO-R1 — 「그 숫자가 무엇인지」는 **별 줄** 이다(C-1 이 둘을 합쳐 본다). */
  marketPriceHeadlineLabel,
  overseasLowestText,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-148 — **Market Price Signal** (CPO 2026-10-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🎯 **North Star** — 「후보를 많이 찾는 시스템이 아니라, 신뢰할 수 있는 동일상품
 *    2~3개의 가격으로 **시장가격을 만들어주는** 시스템」.
 *
 * 🔴🔴 **이 WU 가 가른 것은 «검색» 이 아니라 «가격 해석» 이다**(CPO 문장):
 * ```
 * 🇰🇷 국내   «시장 가격대»   — 89,000 ~ 95,000  ⟹ 「대략 9만원대에 형성돼 있다」
 * 🌎 해외   «최저 확인가»   — 어디에서 얼마에 가장 싸게 팔리는가
 * ```
 * 🔴 **MI frozen** — threshold · 8축 · SAME 기준 **조회 0**. Discovery · Registry ·
 *    어댑터 **변경 0**. 이 파일의 단언 중 그것을 요구하는 것이 **하나도 없다**.
 *
 * ── 🔴 CPO 가 글자로 금지한 것 ──────────────────────────────────────────────
 * ```
 * ❌ 1개를 「가격대」라고 부르기            (STEP 4 — 「1개를 가격대라고 부르지 않습니다」)
 * ❌ 통화를 환산해 하나의 숫자로 만들기      (STEP 5 — 「환산하지 않습니다」)
 * ❌ 추천 판매가 / 적정가 / 권장가 계산      (「현재 데이터로 말할 수 있는 것은 시장 가격대」)
 * ```
 */

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

const kr = (amount: number, i: number): GeminiTransientRow =>
  row({
    market: "KR",
    domain: `k${i}.kr`,
    discoveredUrl: `https://k${i}.kr/p/${i}`,
    priceAmount: amount,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
  });

/** 🟢 CPO STEP 9 의 예시 그대로 — 국내 3곳이 **가격대** 를 만든다. */
const KR_BAND = [kr(89000, 1), kr(92000, 2), kr(95000, 3)];
/** 🟢 국내 1곳 — 🔴 **가격대가 아니다.** */
const KR_ONE = [kr(89000, 1)];
/** 🟢 S1 실측(WU-144) — 🌎 **세 통화** ⟹ 최저를 하나로 고를 수 없다. */
const OS_MULTI = [
  row({ domain: "kolkid.ca", discoveredUrl: "https://kolkid.ca/p/1", priceAmount: 64, priceCurrency: "CAD", priceStatus: "VERIFIED_CURRENT" }),
  row({ domain: "cissywears.com", discoveredUrl: "https://cissywears.com/p/2", priceAmount: 37, priceCurrency: "GBP", priceStatus: "VERIFIED_CURRENT" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
];
/** 🟢 S2 실측 — 🌎 **단일 통화** ⟹ 「최저 확인가 USD 58」을 단정할 수 있다. */
const OS_SINGLE = [
  row({ domain: "a.com", discoveredUrl: "https://a.com/p/1", priceAmount: 58, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
  row({ domain: "b.com", discoveredUrl: "https://b.com/p/2", priceAmount: 64, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
];

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const mount = (rows: GeminiTransientRow[]): void => {
  act(() => root.render(createElement(MarketPriceComparison, { rows })));
};
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const flat = (): string => (container.textContent ?? "").replace(/\s+/g, " ").trim();
const guide = (rows: GeminiTransientRow[], m: "KR" | "OVERSEAS") =>
  buildPriceGuide(buildMarketJudgement(rows), m);

/* ═══════════ A. 🇰🇷 국내 = 시장 가격대 ═══════════ */

describe("A. 🇰🇷 국내는 «시장 가격대» 다", () => {
  it("🟢🟢 A-1 3곳이면 **가격대** 를 만든다 — 최저가 하나로 줄이지 않는다", () => {
    const b = domesticPriceBand(guide(KR_BAND, "KR"));
    expect(b.kind).toBe("BAND");
    expect(b.lowest).toBe(89000);
    expect(b.highest).toBe(95000);
    expect(domesticBandText(b)).toContain("89000");
    expect(domesticBandText(b)).toContain("95000");
    /** 🔴 1곳 문구가 **섞이지 않는다**. */
    expect(domesticBandText(b)).not.toContain(PRICE_BAND_UNDETERMINED);
  });

  it("🔴🔴 A-2 **1개를 「가격대」라고 부르지 않는다**(CPO STEP 4 명시)", () => {
    const b = domesticPriceBand(guide(KR_ONE, "KR"));
    expect(b.kind).toBe("SINGLE");
    const t = domesticBandText(b)!;
    expect(t).toContain("89000");
    expect(t).toContain(PRICE_BAND_UNDETERMINED);
    /** 🔴 범위 기호(`─`)를 쓰지 않는다 — 그것이 「가격대」의 표식이다. */
    expect(t).not.toContain("─");
  });

  it("🔴🔴 A-3 통화가 섞이면 **가격대를 만들지 않는다** — 환산 금지의 귀결", () => {
    const mixed = [kr(89000, 1), row({ market: "KR", domain: "x.kr", discoveredUrl: "https://x.kr/p", priceAmount: 70, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" })];
    const b = domesticPriceBand(guide(mixed, "KR"));
    expect(b.kind).toBe("NONE");
    expect(domesticBandText(b)).toBeNull();
  });

  it("🟢 A-4 화면 — 가격대일 때만 **「국내 시장 가격대」** 라벨이 선다", () => {
    mount(KR_BAND);
    expect(q("price-guide-headline")!.textContent).toContain("89000");
    expect(q("price-guide-headline-label")?.textContent).toBe(DOMESTIC_BAND_LABEL);
    mount(KR_ONE);
    /** 🔴 1건이면 그 라벨을 **만들지 않는다** — 헤드라인이 이미 「확정 불가」를 말한다. */
    expect(q("price-guide-headline-label")).toBeNull();
    expect(q("price-guide-headline")!.textContent).toContain(PRICE_BAND_UNDETERMINED);
  });
});

/* ═══════════ B. 🌎 해외 = 최저 확인가 ═══════════ */

describe("B. 🌎 해외는 «최저 확인가» 다", () => {
  it("🟢🟢 B-1 단일 통화면 **최저 확인가를 단정** 한다", () => {
    const g = guide(OS_SINGLE, "OVERSEAS");
    expect(overseasLowestText(g)).toBe("USD 58");
    expect(marketPriceHeadline(g)).toBe(`${OVERSEAS_LOWEST_LABEL} USD 58`);
    /** 🔴 **최고가를 최저가로 적지 않는다**(64 가 아니다). */
    expect(marketPriceHeadline(g)).not.toContain("64");
  });

  it("🔴🔴🔴 B-2 통화가 섞이면 **하나의 최저가를 고르지 않는다** — 환산이 필요하다", () => {
    const g = guide(OS_MULTI, "OVERSEAS");
    const t = overseasLowestText(g)!;
    /** 🟢 셋을 **나란히** 적는다. */
    for (const n of ["CAD 64", "GBP 37", "USD 58"]) expect(t).toContain(n);
    /**
     * 🔴🔴 **「GBP 37 이 최저」로 적으면 거짓이다** — 세 통화는 비교할 수 없다
     *    (비교에 환산이 필요하고 환산은 `overseas-reference` 계약이 금지한다).
     * 🟢 그래서 화면이 **그 사실을 문장으로** 말한다.
     */
    mount(OS_MULTI);
    expect(q("price-guide-headline-label")?.textContent).toBe(OVERSEAS_LOWEST_PER_CURRENCY_NOTE);
    expect(flat()).not.toContain("₩");
    expect(flat()).not.toContain("약 ");
  });

  it("🟢 B-3 국내 해석을 해외에 쓰지 않는다(그 반대도) — owner 가 시장으로 분기한다", () => {
    expect(marketPriceHeadline(guide(KR_BAND, "KR"))).not.toContain(OVERSEAS_LOWEST_LABEL);
    expect(marketPriceHeadline(guide(OS_SINGLE, "OVERSEAS"))).not.toContain(DOMESTIC_BAND_LABEL);
  });
});

/* ═══════════ C. 💡 결론이 시장별로 다른 말을 한다 ═══════════ */

describe("C. 💡 판매 판단 — 시장별 해석", () => {
  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2AO-R1 — **시장별 해석의 자리가 「결론」에서 「헤드라인」으로 옮겨졌다**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CEO Production 캡처에서 같은 금액이 **🇰🇷/🌎 블록과 결론 두 군데** 떴다 ⟹
   *    CPO 2026-10-26: 「`판매 판단` 안의 숫자 제거 — 상단 가격 블록이 이미 보여준다」.
   * 🟢 **WU-148 이 만든 성질은 하나도 잃지 않았다** — 시장별 해석(🇰🇷 가격대 /
   *    🌎 최저 확인가)은 `marketPriceHeadline` 이 **그대로** 말하고, 결론은 그 해석의
   *    **단서**(1건이라 가격대가 아니다 · 통화가 섞여 합치지 않는다)만 말한다.
   * 🔴 그래서 단언을 **두 자리로 갈라** 둔다 — 금액은 헤드라인, 단서는 결론.
   */
  it("🟢🟢 C-1 국내는 **가격대로**, 해외는 **최저 확인가로** 말한다(헤드라인 owner)", () => {
    /**
     * 🔴 블록이 **두 줄** 을 그린다 — `marketPriceHeadline`(금액) + `marketPriceHeadlineLabel`
     *    (그 숫자가 무엇인지). 라벨이 헤드라인 **안** 에 있다고 가정하면 틀린다
     *    (실측: 🇰🇷 BAND 헤드라인은 `KRW 89000 ─ 95000` 뿐이고 라벨이 따로 선다).
     *    🟢 셀러가 보는 것은 **두 줄 합쳐서** 이므로 합쳐서 단언한다.
     */
    const blockText = (rows: typeof KR_BAND, m: "KR" | "OVERSEAS") =>
      `${marketPriceHeadline(guide(rows, m)) ?? ""} ${marketPriceHeadlineLabel(guide(rows, m)) ?? ""}`;
    expect(blockText(KR_BAND, "KR")).toContain(DOMESTIC_BAND_LABEL);
    expect(blockText(KR_BAND, "KR")).toContain("89000");
    expect(blockText(OS_SINGLE, "OVERSEAS")).toContain(OVERSEAS_LOWEST_LABEL);
    expect(blockText(OS_SINGLE, "OVERSEAS")).toContain("USD 58");
    /** 🔴 그리고 결론은 그 금액을 **다시 적지 않는다**(중복 금지). */
    const lines = marketDecisionLines(buildMarketJudgement([...KR_BAND, ...OS_SINGLE])).lines.join(" ");
    expect(lines, `🔴 결론이 금액을 또 적었다: ${lines}`).not.toMatch(
      /(?:KRW|USD|GBP|EUR|CAD|JPY|₩)\s?[\d.,]|\d,\d{3}|\d{5}/,
    );
  });

  it("🔴 C-2 국내 1건이면 결론도 **가격대를 말하지 않는다**", () => {
    const lines = marketDecisionLines(buildMarketJudgement(KR_ONE)).lines.join(" ");
    /** 🟢 **1건이라는 사실은 결론이 계속 말한다** — 그것이 WU-148 STEP 4 의 요지다. */
    expect(lines).toContain("1건");
    expect(lines).not.toContain(DOMESTIC_BAND_LABEL);
    /** 🟢 금액은 **사라지지 않았다** — 헤드라인이 들고 있다. */
    expect(marketPriceHeadline(guide(KR_ONE, "KR")) ?? "").toContain("89000");
  });

  it("🔴🔴 C-3 **추천 판매가를 만들지 않는다**(원가·수수료·마진 0 · §00-B)", () => {
    for (const rows of [KR_BAND, KR_ONE, OS_MULTI, OS_SINGLE, [...KR_BAND, ...OS_MULTI]]) {
      mount(rows);
      for (const bad of ["추천 판매가", "권장 판매가", "적정 판매가", "로 설정하세요", "예상 마진"]) {
        expect(flat(), `추천가 어휘가 나왔다: ${bad}`).not.toContain(bad);
      }
      /** 🔴 「평균」은 **부정문으로만**(WU-139/144/146 과 같은 규칙 · 세 번 밟은 함정). */
      for (const m of flat().match(/[^.。]*평균[^.。]*/g) ?? []) {
        expect(m, `평균이 긍정문에 쓰였다: ${m}`).toMatch(/아닙니다|아니다/);
      }
    }
  });

  it("🟢 C-4 결론 owner 는 **하나** 다 — 시장이 둘이어도 영역은 하나다", () => {
    mount([...KR_BAND, ...OS_MULTI]);
    expect(container.querySelectorAll('[data-testid="seller-decision"]').length).toBe(1);
    expect(container.querySelectorAll('[data-testid="market-price-comparison"]').length).toBe(1);
  });
});

/* ═══════════ D. 🔴🔴 WU-149 — 가격 판단은 «통화별 3개» 까지 ═══════════ */

describe("D. 가격 계산 상한 3 (WU-149 STEP 3/4)", () => {
  /** 🟢 국내 **5곳** — 🔴 상한이 **실제로 발화하는** 분모다(3 이하면 측정이 안 된다). */
  const KR_FIVE = [kr(89000, 1), kr(92000, 2), kr(95000, 3), kr(98000, 4), kr(105000, 5)];

  it("🟢🟢 D-1 상한이 **발화한다** — 가격대가 하위 3곳 기준이 된다", () => {
    const g = guide(KR_FIVE, "KR");
    expect(SAME_PRICE_CAP).toBe(3);
    const b = domesticPriceBand(g);
    expect(b.n).toBe(SAME_PRICE_CAP);
    /** 🟢 **최저가는 보존된다**(89000) · 🔴 상한 밖(98000·105000)은 가격대에 **안 들어간다**. */
    expect(b.lowest).toBe(89000);
    expect(b.highest).toBe(95000);
    expect(domesticBandText(b)).not.toContain("105000");
  });

  it("🔴🔴 D-2 **건수는 자르지 않는다** — 관측된 사실을 숨기지 않는다(CPO STEP 10)", () => {
    const g = guide(KR_FIVE, "KR");
    /** 🔴 「동일상품 확인 5곳 · 가격 확인 5곳」은 **그대로** 다 — 상한은 «가격 계산» 전용이다. */
    expect(g.sameCount).toBe(5);
    expect(g.pricedCount).toBe(5);
    mount(KR_FIVE);
    expect(q("price-guide-counts")!.textContent).toContain("동일상품 확인 5곳");
    expect(q("price-guide-counts")!.textContent).toContain("가격 확인 5곳");
  });

  it("🔴🔴🔴 D-3 상한은 **통화별** 이다 — 전역으로 자르면 통화 축이 사라진다", () => {
    /**
     * 🔴 USD 4곳 + GBP 1곳. **전역** 오름차순 3개로 자르면 GBP 37 이 1위가 되고
     *    USD 가 두 개만 남거나 **통화 하나가 통째로 떨어질 수 있다**(환산 없는 숫자 비교).
     * 🟢 통화별 상한이면 **두 통화의 최저가가 둘 다 살아남는다.**
     */
    const mixed = [
      row({ domain: "u1.com", discoveredUrl: "https://u1.com/p", priceAmount: 58, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
      row({ domain: "u2.com", discoveredUrl: "https://u2.com/p", priceAmount: 61, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
      row({ domain: "u3.com", discoveredUrl: "https://u3.com/p", priceAmount: 64, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
      row({ domain: "u4.com", discoveredUrl: "https://u4.com/p", priceAmount: 70, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
      row({ domain: "g1.com", discoveredUrl: "https://g1.com/p", priceAmount: 37, priceCurrency: "GBP", priceStatus: "VERIFIED_CURRENT" }),
    ];
    const g = guide(mixed, "OVERSEAS");
    const usd = g.byCurrency.find((c) => c.currency === "USD")!;
    const gbp = g.byCurrency.find((c) => c.currency === "GBP")!;
    /** 🟢 두 통화가 **둘 다 살아 있다** — 통화 축이 사라지지 않는다. */
    expect(g.byCurrency).toHaveLength(2);
    /** 🟢 각 통화의 **최저가가 보존된다**(USD 58 · GBP 37). */
    expect(usd.lowest).toBe(58);
    expect(gbp.lowest).toBe(37);
    /** 🔴 USD 는 상한 3 으로 잘린다 — 70 은 가격 신호에 **안 들어간다**. */
    expect(usd.n).toBe(3);
    expect(usd.highest).toBe(64);
    expect(overseasLowestText(g)).not.toContain("70");
  });

  it("🟢 D-4 상한 이하면 **동작이 전과 같다** — 기존 계약이 그대로 유효한 이유", () => {
    const g = guide(KR_BAND, "KR");
    expect(g.byCurrency[0].n).toBe(3);
    expect(domesticPriceBand(g).highest).toBe(95000);
  });
});
