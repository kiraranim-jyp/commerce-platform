/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UI-CONSISTENCY-01 P0-A — **금액 «형식» 의 owner 는 하나다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **고친 결함을 먼저 적는다**(CONTROL 실측 · 두 시장에 구조적으로 동일한 입력):
 * ```
 * 🇰🇷 국내 가격대      「KRW 88000 ─ 95000」  ← mi-same-candidates `domesticBandText`
 * 🇰🇷 국내 참고가격     「KRW 88,000」         ← overseas-reference.ts:237
 * ⟹ **같은 화면 · 같은 통화 · 같은 성격의 금액** 인데 형식이 둘이었다.
 * ```
 * 🔴 해외가 멀쩡해 «보였던» 이유는 규칙이 달라서가 아니라 **금액이 작아서** 다
 *    (`GBP 37` 은 구분자가 들어갈 자리가 없다) ⟹ 같은 결함이 두 함수에 있었다.
 *
 * 🔴🔴 **개별 금액을 글자로 단언하는 것으로 끝내지 않는다.** 그렇게만 잠그면 다음에
 *    새 금액 슬롯이 생길 때 **그 슬롯만** 구분자 없이 들어온다(이 트랙에서 실제로
 *    그렇게 벌어졌다 — `domesticBandText` 는 `overseas-reference` 보다 뒤에 생겼다).
 * 🟢 그래서 **일반 성질** 로 문다 — 「시장 블록의 글자에 **구분자 없는 4자리 이상 숫자**가
 *    하나도 없다」. 🔴 `88,000` 은 쉼표가 자릿수를 끊으므로 `\d{4,}` 에 **걸리지 않는다**
 *    ⟹ 이 탐지기가 곧 「구분자가 있다」의 증명이다.
 *
 * 🔴 **집계·분모·판정·환산·threshold 변경 0** — 숫자 자체는 한 글자도 바뀌지 않았다.
 * 🔴 `₩` 를 쓰지 않는다 — 이 영역 전체에 그 기호를 금지하는 계약이 **6건** 있다
 *    (`wu-141-r3` C-1-b · `wu-144` F · `wu-145` B-3 · `wu-146` 1-b · `wu-148` B-2 ·
 *     `wu-139` B-5) ⟹ ISO 코드 형식(`KRW 88,000`)을 유지한다.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  buildMarketJudgement,
  buildPriceGuide,
  domesticBandText,
  domesticPriceBand,
  marketPriceHeadline,
} from "../mi-same-candidates";
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

/** 🔴 row 모양을 지어내지 않는다 — `core-2ao-r1-screen-dump` 의 빌더를 그대로 쓴다. */
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
    market: "KR",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

const kr = (amount: number, i: number): GeminiTransientRow =>
  row({ domain: `k${i}.kr`, discoveredUrl: `https://k${i}.kr/p`, soldOut: false, priceAmount: amount, priceCurrency: "KRW" });

/** 🔴 해외도 **큰 금액** 으로 잰다 — `GBP 37` 로는 구분자 결함이 보이지 않는다. */
const os = (amount: number, currency: string, i: number): GeminiTransientRow =>
  row({ market: "OVERSEAS", domain: `o${i}.example`, discoveredUrl: `https://o${i}.example/p`, soldOut: false, priceAmount: amount, priceCurrency: currency });

const ref = (currency: string, lowest: number, highest: number, count: number): OverseasPriceSummary =>
  ({
    count,
    byCurrency: { [currency]: { lowestAmount: lowest, highestAmount: highest, count } },
    byMarket: { KR: count },
    byPriceTier: { COMPARISON: count },
  }) as unknown as OverseasPriceSummary;

function mount(props: Record<string, unknown>): void {
  act(() => root.render(createElement(MarketPriceComparison, props as never)));
}

const blockText = (suffix: "domestic" | "overseas"): string =>
  (container.querySelector(`[data-testid="market-block-${suffix}"]`)?.textContent ?? "").replace(/\s+/g, " ").trim();

/** 🔴 구분자가 없는 4자리 이상 숫자 — 있으면 그것이 결함이다. */
const UNSEPARATED = /\d{4,}/g;

/**
 * 🔴🔴 **`PriceGuide` 모양을 손으로 만들지 않는다.** 1차 작성에서 `{rows, market}` 로
 *    지어냈고 `byCurrency` 가 없어 `undefined.length` 로 터졌다(이 트랙의 「칸 이름을
 *    추측했다」 함정). 🟢 운영 빌더 둘을 그대로 거친다 — `wu-148` 하니스와 **같은 식** 이다.
 */
const guide = (rows: GeminiTransientRow[], m: "KR" | "OVERSEAS") =>
  buildPriceGuide(buildMarketJudgement(rows), m);

describe("MI-UIC-01 A — 금액 형식(순수 함수 축)", () => {
  it("🟢 A-1 국내 **가격대** 는 양 끝 모두 천단위 구분자를 쓴다", () => {
    /** 🔴 `domesticPriceBand` 를 거쳐 운영과 같은 입력을 만든다(손으로 band 를 만들지 않는다). */
    mount({ rows: [kr(88000, 1), kr(95000, 2)] });
    const t = blockText("domestic");
    expect(t, `🔴 국내 가격대에 구분자가 없다: ${t}`).toContain("KRW 88,000 ─ 95,000");
    expect(t.match(UNSEPARATED), `🔴 구분자 없는 큰 숫자가 남았다: ${t}`).toBeNull();
  });

  it("🟢 A-2 국내 **1건**(SINGLE)도 같은 형식이다", () => {
    mount({ rows: [kr(88000, 1)] });
    const t = blockText("domestic");
    expect(t).toContain("KRW 88,000");
    /** 🟢 1건을 「가격대」로 부르지 않는 성질은 **그대로** 다(wu-148 A-2). */
    expect(t).toContain("가격대 확정 불가");
    expect(t.match(UNSEPARATED), `🔴 구분자 없는 큰 숫자가 남았다: ${t}`).toBeNull();
  });

  it("🟢 A-3 **해외** 도 같은 형식이다 — 큰 금액으로 확인한다", () => {
    mount({ rows: [os(26400, "JPY", 1)] });
    const t = blockText("overseas");
    expect(t, `🔴 해외 금액에 구분자가 없다: ${t}`).toContain("JPY 26,400");
    expect(t.match(UNSEPARATED), `🔴 구분자 없는 큰 숫자가 남았다: ${t}`).toBeNull();
  });

  it("🔴 A-4 해외 **통화가 섞여도** 각 통화가 같은 형식이다(환산 0 은 그대로)", () => {
    mount({ rows: [os(26400, "JPY", 1), os(1580, "HKD", 2)] });
    const t = blockText("overseas");
    expect(t).toContain("JPY 26,400");
    expect(t).toContain("HKD 1,580");
    /** 🔴 환산 금지 — 두 통화를 하나로 합친 숫자를 만들지 않는다(wu-148 그대로). */
    expect(t, "🔴 환산 축이 열렸다").not.toMatch(/[₩€$£¥]/);
    expect(t.match(UNSEPARATED), `🔴 구분자 없는 큰 숫자가 남았다: ${t}`).toBeNull();
  });
});

describe("MI-UIC-01 B — 한 화면에 형식이 둘이 아니다(마운트 DOM)", () => {
  /**
   * 🔴🔴 **이것이 CEO 가 본 비대칭의 실제 축이다.** 국내는 상태에 따라 금액 owner 가
   *    둘로 갈린다 — `sameCount === 0` 이면 **참고가격**(`overseas-reference`),
   *    `> 0` 이면 **가격대**(`domesticBandText`). 🔴 두 owner 가 다른 형식을 쓰면
   *    **같은 상품의 같은 칸** 이 조회 결과에 따라 모양을 바꾼다.
   */
  it("🔴🔴 B-1 국내 **참고가격 경로**(SAME 0)도 같은 형식이다", () => {
    mount({ rows: [], domesticReference: ref("KRW", 88000, 88000, 1) });
    const t = blockText("domestic");
    expect(t).toContain("KRW 88,000");
    expect(t.match(UNSEPARATED), `🔴 참고가격 경로에 구분자 없는 숫자가 있다: ${t}`).toBeNull();
  });

  it("🔴🔴 B-2 두 경로가 **같은 글자** 로 금액을 적는다 — 상태가 바뀌어도 형식은 안 바뀐다", () => {
    mount({ rows: [], domesticReference: ref("KRW", 88000, 88000, 1) });
    const viaReference = blockText("domestic");
    act(() => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mount({ rows: [kr(88000, 1)] });
    const viaBand = blockText("domestic");
    /** 🟢 두 경로 모두 `KRW 88,000` 을 쓴다(제목·부가 문장은 축이 달라 다를 수 있다). */
    for (const [name, t] of [["참고가격 경로", viaReference], ["가격대 경로", viaBand]] as const) {
      expect(t, `🔴 ${name} 의 금액 형식이 다르다: ${t}`).toContain("KRW 88,000");
    }
  });

  it("🟢 B-3 두 시장 블록 **어디에도** 구분자 없는 큰 숫자가 없다", () => {
    mount({ rows: [kr(88000, 1), kr(95000, 2), os(26400, "JPY", 3)] });
    for (const s of ["domestic", "overseas"] as const) {
      const t = blockText(s);
      expect(t.match(UNSEPARATED), `🔴 ${s} 에 구분자 없는 큰 숫자: ${t}`).toBeNull();
    }
  });
});

describe("MI-UIC-01 C — owner 가 하나다(복제 금지)", () => {
  /**
   * 🔴 형식을 **호출부에서** 다시 만들면 다음 슬롯이 또 어긋난다. 🟢 그래서
   *    순수 함수 산출과 화면 글자가 **같은 문자열** 인지 확인한다(사본 탐지).
   */
  it("🔴 C-1 화면 금액은 `marketPriceHeadline` 산출 **그대로** 다", () => {
    mount({ rows: [kr(88000, 1), kr(95000, 2)] });
    const band = domesticBandText(domesticPriceBand(guide([kr(88000, 1), kr(95000, 2)], "KR")));
    /** 🟢 순수 함수가 못 만들면(입력 모양이 다르면) 이 단언을 건너뛰지 않고 **드러낸다**. */
    expect(band, "🔴 순수 함수가 가격대를 만들지 못했다 — 입력 모양이 운영과 다르다").not.toBeNull();
    expect(blockText("domestic")).toContain(band!);
    expect(band).toBe("KRW 88,000 ─ 95,000");
  });

  it("🔴 C-2 `marketPriceHeadline` 이 **시장별 해석** 을 계속 소유한다(WU-148 불변)", () => {
    const krGuide = guide([kr(88000, 1), kr(95000, 2)], "KR");
    const osGuide = guide([os(26400, "JPY", 1)], "OVERSEAS");
    /** 🔴 국내는 **가격대**, 해외는 **최저 확인가** — 이 분기를 호출부로 옮기지 않는다. */
    expect(marketPriceHeadline(krGuide)).toBe("KRW 88,000 ─ 95,000");
    expect(marketPriceHeadline(osGuide)).toBe("최저 확인가 JPY 26,400");
  });
});
