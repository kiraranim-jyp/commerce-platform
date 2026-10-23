// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildMarketJudgement,
  buildPriceGuide,
  DOMESTIC_BAND_LABEL,
  domesticBandText,
  domesticPriceBand,
  marketPriceHeadline,
  marketPriceHeadlineLabel,
  overseasHasSingleCurrency,
  overseasLowestText,
  OVERSEAS_LOWEST_LABEL,
  PRICE_BAND_UNDETERMINED,
} from "../mi-same-candidates";
import { MarketPriceComparison } from "../MarketPriceComparison";
import { convertToKrw, convertToKrwStrict } from "@commerce/pricing";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2E — **가격 «목적» 계약**(국내=시장가격대 / 해외=통화별 최저 소싱가)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO §11 이 변이 **다섯** 을 지정했다 — 이 파일이 그 다섯을 **전부** 문다:
 * ```
 * M1  DIFFERENT 후보 가격을 국내 가격대에 포함        → FAIL
 * M2  해외 GBP/USD 를 섞어 하나의 최저가 계산          → FAIL
 * M3  국내 가격 1개를 「가격대」로 표시                 → FAIL
 * M4  해외 가격을 「시장가격대」로 표시                 → FAIL
 * M5  KRW 환산값으로 GBP/USD 최저가를 선택             → FAIL
 * ```
 * 🔴 화면 축은 **마운트한 DOM** 이다(소스 PASS ≠ Render PASS).
 * 🔴 MI/SAME/threshold/모델코드/브랜드 **변경 0** · 네트워크 **0**.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const MODULE = strip(readFileSync(path.join(HERE, "..", "mi-same-candidates.ts"), "utf8"));
const VIEW = strip(readFileSync(path.join(HERE, "..", "MarketPriceComparison.tsx"), "utf8"));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** 🟢 운영 행 모양 그대로. 🔴 `matchTruth` 가 tier owner 의 입력이다(하니스 교훈). */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow => ({
  domain: "s.example",
  discoveredUrl: `https://s.example/${Math.random().toString(36).slice(2)}`,
  matchTruth: "EXACT_IDENTIFIER",
  market: "OVERSEAS",
  soldOut: false,
  priceStatus: "VERIFIED_CURRENT",
  ...over,
});
const guideOf = (rows: GeminiTransientRow[], market: "KR" | "OVERSEAS") =>
  buildPriceGuide(buildMarketJudgement(rows), market);
const mount = (rows: GeminiTransientRow[]) => {
  act(() => {
    root.render(createElement(MarketPriceComparison, { rows } as never));
  });
};
const txt = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";

describe("CORE-2E A — 🇰🇷 국내는 «시장 가격대» 다(§3)", () => {
  const kr = (amount: number, i: number) =>
    row({ market: "KR", priceCurrency: "KRW", priceAmount: amount, discoveredUrl: `https://k.example/${i}` });

  it("A-1 🟢 2건↑ 이고 금액이 다르면 **min ─ max** 가 된다(§3-2)", () => {
    const g = guideOf([kr(88000, 1), kr(90000, 2), kr(95000, 3)], "KR");
    const band = domesticPriceBand(g);
    expect(band.kind).toBe("BAND");
    expect(band.lowest).toBe(88000);
    expect(band.highest).toBe(95000);
    expect(domesticBandText(band)).toBe("KRW 88000 ─ 95000");
    expect(marketPriceHeadlineLabel(g)).toBe(DOMESTIC_BAND_LABEL);
  });

  /** 🔴🔴 **M3 를 무는 자리** — 1건은 가격대가 아니다(§3-3). */
  it("A-2 🔴🔴 M3 — 1건은 **가격대가 아니다**", () => {
    const g = guideOf([kr(88000, 1)], "KR");
    const band = domesticPriceBand(g);
    expect(band.kind).toBe("SINGLE");
    expect(domesticBandText(band)).toContain(PRICE_BAND_UNDETERMINED);
    expect(marketPriceHeadlineLabel(g), "🔴 1건에 「가격대」 라벨을 붙이면 안 된다").toBeNull();
    expect(marketPriceHeadline(g)).not.toContain("─");
  });

  it("A-3 🔴 같은 금액 둘도 가격대가 아니다", () => {
    const band = domesticPriceBand(guideOf([kr(88000, 1), kr(88000, 2)], "KR"));
    expect(band.kind).toBe("SINGLE");
  });

  /** 🔴🔴 **M1 을 무는 자리** — DIFFERENT/보류는 SAME 집계에 들어가지 않는다. */
  it("A-4 🔴🔴 M1 — DIFFERENT·보류 후보의 가격은 **국내 가격대에 안 들어간다**", () => {
    const rows = [
      kr(88000, 1),
      /** 🔴 보류(PRESUMED_SAME) · 🔴 다름(CONFLICT) — 둘 다 SAME 이 아니다. */
      row({ market: "KR", priceCurrency: "KRW", priceAmount: 10000, matchTruth: "SIMILAR", discoveredUrl: "https://k.example/x" }),
      row({ market: "KR", priceCurrency: "KRW", priceAmount: 999000, matchTruth: "CONFLICT", discoveredUrl: "https://k.example/y" }),
    ];
    const g = guideOf(rows, "KR");
    expect(g.sameCount, "🔴 SAME 만 세야 한다").toBe(1);
    expect(g.byCurrency).toHaveLength(1);
    expect(g.byCurrency[0].lowest).toBe(88000);
    expect(g.byCurrency[0].highest, "🔴 999000 이 들어오면 가격대가 오염된다").toBe(88000);
  });

  it("A-5 🔴 §3-4 — 0건은 「국내 판매처 0곳」과 **다른 말** 이다", () => {
    const g = guideOf([], "KR");
    expect(g.sameCount).toBe(0);
    expect(marketPriceHeadline(g), "🔴 가격이 없으면 숫자를 만들지 않는다").toBeNull();
  });

  /** 🔴 통화가 섞이면 가격대를 **만들지 않는다**(환산 금지의 귀결). */
  it("A-6 🔴 국내 통화가 섞이면 가격대를 만들지 않는다", () => {
    const g = guideOf(
      [kr(88000, 1), row({ market: "KR", priceCurrency: "USD", priceAmount: 60, discoveredUrl: "https://k.example/z" })],
      "KR",
    );
    expect(domesticPriceBand(g).kind).toBe("NONE");
    expect(marketPriceHeadline(g)).toBeNull();
  });
});

describe("CORE-2E B — 🌎 해외는 «통화별 최저 소싱가» 다(§4)", () => {
  const os = (cur: string, amount: number, i: number) =>
    row({ priceCurrency: cur, priceAmount: amount, discoveredUrl: `https://o.example/${cur}${i}` });

  it("B-1 🟢 동일 통화면 **최저가** 를 고른다(§4-2)", () => {
    const g = guideOf([os("GBP", 37, 1), os("GBP", 45, 2), os("GBP", 52, 3)], "OVERSEAS");
    expect(g.byCurrency).toHaveLength(1);
    expect(g.byCurrency[0].lowest).toBe(37);
    expect(overseasLowestText(g)).toBe("GBP 37");
    expect(marketPriceHeadline(g)).toBe(`${OVERSEAS_LOWEST_LABEL} GBP 37`);
  });

  /** 🔴🔴 **M2 를 무는 자리** — 통화를 섞어 하나의 최저가를 만들지 않는다. */
  it("B-2 🔴🔴 M2 — 통화가 여러 개면 **하나로 합치지 않는다**(§4-3)", () => {
    const g = guideOf([os("GBP", 37, 1), os("GBP", 45, 2), os("USD", 58, 3), os("USD", 71, 4)], "OVERSEAS");
    expect(g.byCurrency.map((c) => `${c.currency} ${c.lowest}`).sort()).toEqual(["GBP 37", "USD 58"]);
    expect(overseasHasSingleCurrency(g)).toBe(false);
    const head = marketPriceHeadline(g) ?? "";
    /** 🔴 두 통화가 **각각** 서야 한다 — 하나만 남으면 합친 것이다. */
    expect(head).toContain("GBP 37");
    expect(head).toContain("USD 58");
    expect(marketPriceHeadlineLabel(g), "🔴 통화가 섞였다는 사실을 말해야 한다").toContain("통화별");
  });

  /** 🔴🔴 **M4 를 무는 자리** — 해외에 「가격대」 어휘를 쓰지 않는다(§8). */
  it("B-4 🔴🔴 M4 — 해외는 **「가격대」가 아니다**", () => {
    const g = guideOf([os("USD", 58, 1), os("USD", 80, 2)], "OVERSEAS");
    const head = marketPriceHeadline(g) ?? "";
    expect(head).toContain(OVERSEAS_LOWEST_LABEL);
    expect(head, "🔴 해외에 범위를 적으면 시장가격대로 읽힌다").not.toContain("─");
    expect(marketPriceHeadlineLabel(g) ?? "").not.toContain(DOMESTIC_BAND_LABEL);
    /** 🔴 어휘 owner 에 「해외 시장 가격대」가 **없다**. */
    expect(MODULE).not.toContain("해외 시장 가격대");
  });

  it("B-5 🔴 §4-1 — 해외 최저가는 **최저 1건** 만 말한다(범위 아님)", () => {
    const g = guideOf([os("USD", 58, 1), os("USD", 80, 2)], "OVERSEAS");
    expect(overseasLowestText(g)).toBe("USD 58");
  });
});

describe("CORE-2E C — 🔴🔴 M5 · §4-4 환산은 «판단에 쓰이지 않는다»", () => {
  const os = (cur: string, amount: number, i: number) =>
    row({ priceCurrency: cur, priceAmount: amount, discoveredUrl: `https://o.example/${cur}${i}` });

  /**
   * 🔴🔴🔴 **M5 를 무는 자리 — 가장 중요하다.**
   *
   * 🟢 환산을 **쓰지 않는다** 는 것을 «구조» 로 단언한다 — 집계·판단 함수가
   *    환율을 **인자로 받지 않으면** 환산으로 최저가를 고르는 일이 **불가능** 하다.
   * 🔴 값 단언만 두면 다음 사람이 함수 안에서 환율을 끌어와도 통과한다.
   */
  it("C-1 🔴🔴 M5 — 가격 판단 함수가 **환율을 인자로 받지 않는다**(구조적 불가)", () => {
    for (const fn of [
      "overseasLowestText",
      "marketPriceHeadline",
      "marketPriceHeadlineLabel",
      "domesticPriceBand",
      "buildPriceGuide",
      "buildMarketJudgement",
    ]) {
      const sig = new RegExp(`function ${fn}\\(([^)]*)\\)`);
      const m = MODULE.match(sig);
      expect(m, `🔴 ${fn} 선언을 찾지 못했다`).not.toBeNull();
      expect(m![1], `🔴 ${fn} 이 환율을 받는다 — 환산으로 최저가를 고를 수 있게 된다`).not.toMatch(
        /liveRates|rate|krw|KRW/,
      );
    }
    /** 🔴🔴 그리고 그 파일이 **환율 owner 를 import 하지 않는다**. */
    expect(MODULE, "🔴 환율을 들여오면 M5 의 문이 열린다").not.toContain("convertToKrw");
  });

  it("C-2 🔴 통화별 최저는 **환산과 무관하게** 고정된다", () => {
    const g = guideOf([os("GBP", 37, 1), os("USD", 58, 2)], "OVERSEAS");
    expect(g.byCurrency.find((c) => c.currency === "GBP")?.lowest).toBe(37);
    expect(g.byCurrency.find((c) => c.currency === "USD")?.lowest).toBe(58);
    /** 🔴 줄 수 == 통화 수 — 합치지 않았다. */
    expect(g.byCurrency).toHaveLength(2);
  });

  /**
   * 🔴🔴🔴 **§4-4 를 구현했다가 되돌린 이유를 «계약으로» 남긴다.**
   *
   * 실측 — `CAD 64` → **「약 ₩64」**. `convertToKrw` 는 모르는 통화를 **그대로 KRW 로
   * 취급** 한다(`pricing/currency.ts:24`) ⟹ 고정표에 CAD 가 없어 **거짓 숫자** 가 떴다.
   * 🔴 그래서 「허용」만으로 넣지 않았다. 🟢 이 테스트가 **그 사실을 고정** 한다 —
   *    `convertToKrw` 가 모르는 통화에서 안전해지면 **이 단언이 FAIL 하고**
   *    그때 §4-4 를 다시 판단한다(CPO 판정 사안).
   */
  it("C-3 🔴🔴 CONTROL — `convertToKrw` 는 모르는 통화를 **그대로 KRW 로 취급** 한다", () => {
    const cad = convertToKrw(64, "CAD");
    expect(cad.isEstimate, "🔴 estimate 가 아니면 고정표에 들어온 것이다").toBe(true);
    expect(
      cad.amountKrw,
      "🟢 이 단언이 FAIL 하면 CAD 가 환율표에 들어왔다는 뜻이고 §4-4 를 다시 판단할 수 있다",
    ).toBe(64);
    /** 🟢 반대로 **아는 통화** 는 정상 환산된다 — 함수가 고장난 것이 아니다. */
    expect(convertToKrw(58, "USD").amountKrw).toBeGreaterThan(1000);
    /** 🔴 안전한 대안은 strict 쪽이다 — 모르는 통화에 **null** 을 준다. */
    expect(convertToKrwStrict(64, "CAD")).toBeNull();
  });

  it("C-4 🔴 그래서 해외 블록에 환산 줄이 **없다**(되돌림이 유지된다)", () => {
    expect(VIEW).not.toContain("price-guide-krw");
    expect(VIEW, "🔴 뷰가 환율을 들고 있으면 안 된다").not.toContain("convertToKrw");
  });
});

describe("CORE-2E D — 마운트 DOM(화면이 실제로 그 말을 하는가)", () => {
  /** 🟢 해외 블록이 **최저 확인가** 를 말하고 **환산은 없다**(§4-4 되돌림 유지). */
  it("D-1 🟢 해외 블록은 **최저 확인가** 를 말한다 · 🔴 환산은 **없다**", () => {
    mount([
      row({ priceCurrency: "USD", priceAmount: 58, discoveredUrl: "https://o.example/1" }),
      row({ priceCurrency: "USD", priceAmount: 80, discoveredUrl: "https://o.example/2" }),
    ]);
    const block = txt("price-guide-overseas");
    expect(block).toContain(OVERSEAS_LOWEST_LABEL);
    expect(block, "🔴 해외 최저는 58 이다(80 이 아니다)").toContain("USD 58");
    /** 🔴 환산을 넣으면 `CAD 64 → ₩64` 같은 거짓 숫자가 생긴다(C-3 가 그 사실을 고정). */
    expect(block, "🔴 환산값이 생겼다 — C-3 를 다시 읽고 CPO 판정을 받는다").not.toContain("₩");
    expect(container.querySelector('[data-testid="price-guide-krw"]')).toBeNull();
  });

  /** 🔴🔴 **`market-price-range` 는 건드리지 않았다** — 그 구역의 「약」 금지 유지. */
  it("D-2 🔴🔴 `market-price-range` 에는 여전히 환산이 **없다**(wu-136 R-10 유지)", () => {
    mount([
      row({ market: "KR", priceCurrency: "KRW", priceAmount: 88000, discoveredUrl: "https://k.example/1" }),
      row({ priceCurrency: "USD", priceAmount: 58, discoveredUrl: "https://o.example/1" }),
    ]);
    const range = txt("market-price-range");
    expect(range).toContain("KRW");
    expect(range).toContain("USD");
    expect(range, "🔴 그 구역에 환산을 넣으면 통화를 합친 것으로 읽힌다").not.toContain("약");
    expect(range).not.toContain("₩");
  });

  it("D-3 🔴 국내 블록에는 환산 줄이 **없다**", () => {
    mount([row({ market: "KR", priceCurrency: "KRW", priceAmount: 88000, discoveredUrl: "https://k.example/1" })]);
    expect(container.querySelector('[data-testid="price-guide-domestic"]')).not.toBeNull();
    const domestic = container.querySelector('[data-testid="price-guide-domestic"]')!;
    expect(domestic.querySelector('[data-testid="price-guide-krw"]')).toBeNull();
  });

  /**
   * 🔴🔴 **배선 앵커 — 뷰가 가격 «해석» 을 직접 하지 않는다.**
   *    owner 는 `marketPriceHeadline` 하나이고(WU-148), 뷰는 분기하지 않는다.
   */
  it("D-4 🔴 뷰는 **owner 함수** 를 쓰고 환율을 들고 있지 않다", () => {
    expect(VIEW).toContain("marketPriceHeadline(g)");
    expect(VIEW).toContain("marketPriceHeadlineLabel(g)");
    /** 🔴 뷰가 시장별로 직접 분기하면 owner 가 둘이 된다. */
    expect(VIEW, "🔴 뷰에서 시장을 보고 가격 문장을 만들면 안 된다").not.toMatch(
      /market === "KR"[\s\S]{0,80}(최저|가격대)/,
    );
    /** 🔴 환율을 뷰에 들여오면 §4-4 의 거짓 숫자 경로가 열린다. */
    expect(VIEW).not.toContain("convertToKrw");
  });
});

describe("CORE-2E E — §7-H 가격 없는 SAME 이 판단을 망가뜨리지 않는다", () => {
  it("E-1 🟢 SAME 인데 가격이 없으면 **판매처 수에는 남고 가격 축에는 안 들어간다**", () => {
    const g = guideOf(
      [
        row({ priceCurrency: "USD", priceAmount: 58, discoveredUrl: "https://o.example/1" }),
        /** 🔴 가격 미확인 — 버리지 않는다. */
        row({ priceStatus: "UNVERIFIED_SEARCH", priceAmount: 999, priceCurrency: "USD", discoveredUrl: "https://o.example/2" }),
        row({ priceAmount: null, priceCurrency: null, discoveredUrl: "https://o.example/3" }),
      ],
      "OVERSEAS",
    );
    expect(g.sameCount, "🔴 동일상품 수는 가격 유무와 무관하다").toBe(3);
    expect(g.pricedCount).toBe(1);
    expect(g.unpricedCount).toBe(2);
    /** 🔴 999 가 최저가로 들어오면 안 된다. */
    expect(g.byCurrency).toHaveLength(1);
    expect(g.byCurrency[0].lowest).toBe(58);
  });

  it("E-2 🔴 품절은 가격 축에서 빠진다(팔 수 없는 가격은 기준가가 아니다)", () => {
    const g = guideOf(
      [
        row({ priceCurrency: "USD", priceAmount: 58, discoveredUrl: "https://o.example/1" }),
        row({ soldOut: true, priceCurrency: "USD", priceAmount: 10, discoveredUrl: "https://o.example/2" }),
      ],
      "OVERSEAS",
    );
    expect(g.byCurrency[0].lowest, "🔴 품절 10 이 최저가가 되면 안 된다").toBe(58);
  });
});
