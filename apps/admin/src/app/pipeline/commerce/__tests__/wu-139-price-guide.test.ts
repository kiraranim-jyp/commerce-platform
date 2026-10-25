// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  PRICE_GUIDE_EMPTY,
  PRICE_GUIDE_RANGE_NOTE,
  PRICE_GUIDE_SINGLE_NOTE,
  PRICE_LINK_TEXT,
  buildMarketJudgement,
  buildPriceGuide,
  priceGuideCountNote,
  priceGuideHeadline,
  /** 🔴 WU-148 — 🇰🇷 국내는 **가격대** 다. 1건이면 가격대가 아니라고 **글자로** 말한다. */
  PRICE_BAND_UNDETERMINED,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-139 — **가격을 못 가져온 후보를 «버리지 않는다»** (CPO 전략 수정)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「목적은 『모든 가격 수집』이 아니라 **『셀러가 판매가를 결정할 근거』** 다.
 *    가격을 못 가져오는 판매처는 **버리지 않고 링크를 준다.** 확인된 가격 1~2개만
 *    있어도 기준가를 안내한다. 🔴 단 **1건을 시장 평균가처럼 표현하면 안 된다.**」
 *
 * 🔴🔴 **MI 는 한 글자도 완화하지 않았다** — threshold 0 · 8축 0 · 판정 0.
 *    바뀐 것은 **가격 축의 부분 성공 허용** 뿐이다.
 * 🔴 네트워크 0 · DB 0.
 */

const row = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow =>
  ({
    source: "REVIEWED_SAME",
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
    priceAmount: 88000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    basis: "KR_TLD",
    ...over,
  }) as GeminiTransientRow;

/* ─────────────── A. 가격 미확인 후보를 «버리지 않는다» ─────────────── */

describe("A. buildPriceGuide — 가격 없는 SAME 도 센다", () => {
  it("🔴🔴 A-1 가격 미확인 후보가 «동일상품 확인» 에는 남고 «가격 확인» 에는 안 든다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://biskuit.kr/p", domain: "biskuit.kr", soldOut: false }),
      row({
        discoveredUrl: "https://beaumonde.co.kr/p",
        domain: "beaumonde.co.kr",
        priceAmount: null,
        priceCurrency: null,
        priceStatus: null,
      }),
    ]);
    const g = buildPriceGuide(j, "KR");
    expect(g.sameCount).toBe(2);
    expect(g.pricedCount).toBe(1);
    /** 🔴 **버려지지 않았다** — 링크를 줄 대상으로 센다. */
    expect(g.unpricedCount).toBe(1);
    const note = priceGuideCountNote(g);
    expect(note).toContain("동일상품 확인 2곳");
    expect(note).toContain("가격 확인 1곳");
    expect(note).toContain("가격 확인 필요 1곳");
  });

  it("🔴 A-2 시장이 다른 후보는 그 시장 가이드에 들어가지 않는다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://k.example/1", domain: "k.example", market: "KR" }),
      row({
        discoveredUrl: "https://o.example/2",
        domain: "o.example",
        market: "OVERSEAS",
        priceAmount: 58,
        priceCurrency: "USD",
      }),
    ]);
    expect(buildPriceGuide(j, "KR").sameCount).toBe(1);
    expect(buildPriceGuide(j, "OVERSEAS").sameCount).toBe(1);
    expect(buildPriceGuide(j, "KR").byCurrency.map((c) => c.currency)).toEqual(["KRW"]);
  });

  it("🔴 A-3 품절은 기준가에 들어가지 않는다 — 팔 수 없는 가격은 기준가가 아니다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: true, priceAmount: 10000 }),
      row({ discoveredUrl: "https://b.example/2", domain: "b.example", soldOut: false, priceAmount: 88000 }),
    ]);
    const g = buildPriceGuide(j, "KR");
    expect(g.pricedCount).toBe(1);
    expect(g.byCurrency[0].lowest).toBe(88000);
  });
});

/* ─────────────── B. 🔴 1건을 «시장 평균가» 로 적지 않는다 ─────────────── */

describe("B. basis — SINGLE 과 RANGE 를 가른다", () => {
  it("🔴🔴 B-1 가격이 하나면 SINGLE 이고 **문장이 다르다**", () => {
    const g = buildPriceGuide(buildMarketJudgement([row({ soldOut: false })]), "KR");
    expect(g.basis).toBe("SINGLE");
    expect(priceGuideHeadline(g)).toBe("KRW 88000");
    /** 🔴 「가격대」·「평균」이라는 말이 **없어야** 한다. */
    expect(PRICE_GUIDE_SINGLE_NOTE).toContain("1건 기준");
    expect(PRICE_GUIDE_SINGLE_NOTE).toContain("시장 평균가가 아닙니다");
    expect(PRICE_GUIDE_SINGLE_NOTE).not.toMatch(/가격대|평균가입니다/);
  });

  it("🔴 B-2 같은 금액이 둘이어도 «가격대» 가 아니다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: false, priceAmount: 88000 }),
      row({ discoveredUrl: "https://b.example/2", domain: "b.example", soldOut: false, priceAmount: 88000 }),
    ]);
    const g = buildPriceGuide(j, "KR");
    expect(g.basis).toBe("SINGLE");
    expect(priceGuideHeadline(g)).toBe("KRW 88000");
  });

  it("🟢 B-3 금액이 실제로 다르면 RANGE 이고 범위를 적는다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: false, priceAmount: 85000 }),
      row({ discoveredUrl: "https://b.example/2", domain: "b.example", soldOut: false, priceAmount: 88000 }),
    ]);
    const g = buildPriceGuide(j, "KR");
    expect(g.basis).toBe("RANGE");
    expect(priceGuideHeadline(g)).toBe("KRW 85000 ~ 88000");
    expect(PRICE_GUIDE_RANGE_NOTE).toContain("전체 시장 가격대가 아닙니다");
  });

  it("🔴 B-4 가격이 없으면 기준가를 «만들지 않는다»", () => {
    const j = buildMarketJudgement([
      row({ priceAmount: null, priceCurrency: null, priceStatus: null }),
    ]);
    const g = buildPriceGuide(j, "KR");
    expect(g.basis).toBe("NONE");
    expect(priceGuideHeadline(g)).toBeNull();
  });

  it("🔴🔴 B-5 **추천 판매가를 계산하지 않는다** — 그 수식은 원가·수수료 축이다", () => {
    const src = readFileSync(join(__dirname, "../mi-same-candidates.ts"), "utf8").replace(
      /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
      "",
    );
    /** 🔴 계산 어휘가 이 선별기에 들어오면 FAIL. */
    for (const forbidden of ["margin", "recommendedPrice", "권장", "추천가"]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴 CORE-2AO — **「수수료」·「마진」은 «제외 문장에서만» 쓸 수 있다**
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 1차에 이 가드를 **리터럴 금지** 로 썼더니 CPO 가 요구한 필수 문구
     *    (「배송비·관부가세·**수수료**·목표**마진**은 **별도로 반영해야** 최종 판매가격이
     *    됩니다」)가 FAIL 했다. 🔴 이것이 바로 위 「평균」과 **같은 자리** 다 — 그 축을
     *    **계산하지 않는다** 고 말하려면 그 낱말을 **입에 올려야** 한다.
     * 🟢 느슨하게 하지 않고 **강화** 한다 — 그 낱말이 나오면 같은 문장에
     *    **「별도로 반영」/「아닙니다」/「반영되지 않습니다」** 가 반드시 있어야 한다.
     *    「수수료 ₩X」·「마진 20%」 같은 **계산 서술** 이 들어오면 FAIL 한다.
     */
    for (const m of src.matchAll(/(?:수수료|마진)[^\n]{0,40}/g)) {
      expect(m[0], `「수수료/마진」이 제외 문장이 아니다: ${m[0]}`).toMatch(
        /별도로 반영|아닙니다|아니다|반영되지 않습니다/,
      );
    }
    /** 🔴 그리고 **금액·퍼센트가 붙은** 수수료/마진 서술은 어떤 문장에서도 금지한다. */
    expect(src, "🔴 수수료/마진에 금액·비율이 붙었다 — 계산을 시작한 것이다").not.toMatch(
      /(?:수수료|마진)[^\n]{0,12}(?:₩|\d+\s*%|\d{3,})/,
    );
    /**
     * 🔴🔴 **「평균」은 «부정문으로만» 쓸 수 있다.** 1차에 이 가드를 「평균 금지」로
     *    썼더니 **내가 쓴 필수 문구**(「시장 평균가가 **아닙니다**」)가 FAIL 했다.
     * 🟢 가드를 느슨하게 하지 않고 **강화** 했다 — 「평균」이 나오면 그 문장이
     *    **반드시 부정** 이어야 한다. 「평균가 ₩X」 같은 긍정 서술이 들어오면 FAIL.
     */
    for (const m of src.matchAll(/평균[^\n]{0,24}/g)) {
      expect(m[0], `「평균」이 부정문이 아니다: ${m[0]}`).toMatch(/아닙니다|아니다/);
    }
    /** 🔴 환산도 없다. */
    expect(src).not.toMatch(/krwEquivalent|convertToKrw|exchangeRate/);
  });
});

/* ─────────────── C. 마운트 DOM — 셀러가 실제로 보는 것 ─────────────── */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const mount = async (props: Record<string, unknown>) => {
  await act(async () => {
    root.render(createElement(MarketPriceComparison, props as never));
  });
};
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

describe("C. 화면 (마운트 DOM)", () => {
  it("🔴🔴 C-1 가격 미확인 칸이 «링크» 다 — 글자가 아니다", async () => {
    await mount({
      rows: [
        row({
          discoveredUrl: "https://beaumonde.co.kr/goods/x",
          domain: "beaumonde.co.kr",
          priceAmount: null,
          priceCurrency: null,
          priceStatus: null,
        }),
      ],
    });
    const link = q("market-seller-price-link") as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.tagName).toBe("A");
    expect(link?.getAttribute("href")).toBe("https://beaumonde.co.kr/goods/x");
    expect(link?.textContent).toBe(PRICE_LINK_TEXT);
  });

  it("🔴🔴 C-2 가격 1건이면 기준가와 «1건 기준» 문장이 같이 선다", async () => {
    await mount({ rows: [row({ soldOut: false })] });
    expect(q("price-guide-domestic")).toBeTruthy();
    /**
     * 🔴🔴 **WU-148 에서 갱신·강화됨** — CPO STEP 4: 「**1개를 가격대라고 부르지
     *    않는다**」. 🇰🇷 국내 해석이 「시장 가격대」이므로 1건일 때 금액 **뒤에**
     *    「가격대 확정 불가」가 붙는다 ⟹ 🟢 「금액이 있다」 **그리고** 「가격대가 아니다」
     *    를 **둘 다** 단언한다(`toBe` 하나보다 세다 · 약화가 아니다).
     */
    expect(q("price-guide-headline")?.textContent).toContain("KRW 88000");
    expect(q("price-guide-headline")?.textContent).toContain(PRICE_BAND_UNDETERMINED);
    expect(q("price-guide-note")?.textContent).toBe(PRICE_GUIDE_SINGLE_NOTE);
    expect(q("price-guide-counts")?.textContent).toContain("가격 확인 1곳");
  });

  it("🟢 C-3 국내·해외 가이드가 «따로» 선다", async () => {
    await mount({
      rows: [
        row({ discoveredUrl: "https://k.example/1", domain: "k.example", soldOut: false }),
        row({
          discoveredUrl: "https://o.example/2",
          domain: "o.example",
          market: "OVERSEAS",
          soldOut: false,
          priceAmount: 58,
          priceCurrency: "USD",
        }),
      ],
    });
    expect(q("price-guide-domestic")?.textContent).toContain("KRW 88000");
    expect(q("price-guide-overseas")?.textContent).toContain("USD 58");
    /** 🔴 환산이 없다 — 한쪽 통화가 다른 쪽 블록에 나타나지 않는다. */
    expect(q("price-guide-domestic")?.textContent).not.toContain("USD");
    expect(q("price-guide-overseas")?.textContent).not.toContain("KRW");
  });

  it("🔴 C-4 그 시장에 동일상품이 없으면 가이드 블록을 «만들지 않는다»(빈 틀 금지)", async () => {
    await mount({ rows: [row({ soldOut: false })] });
    expect(q("price-guide-domestic")).toBeTruthy();
    expect(q("price-guide-overseas")).toBeNull();
  });

  it("🔴 C-5 동일상품은 있는데 가격이 하나도 없으면 «그 사실» 을 적는다", async () => {
    await mount({
      rows: [row({ priceAmount: null, priceCurrency: null, priceStatus: null })],
    });
    expect(q("price-guide-empty")?.textContent).toBe(PRICE_GUIDE_EMPTY);
    expect(q("price-guide-headline")).toBeNull();
    /** 🔴 「동일상품이 없다」로 적지 않는다. */
    expect(q("price-guide-domestic")?.textContent).toContain("동일상품 확인 1곳");
  });
});
