import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MARKET_JUDGEMENT_TITLE,
  MARKET_TABLE_HEADERS,
  MARKET_VERDICT_TEXT,
  SALE_STATE_TEXT,
  buildMarketJudgement,
  onSaleCountNote,
  priceRangeScope,
  priceRangeText,
  saleState,
} from "../mi-same-candidates";
import { shopifyVariantAvailability } from "@commerce/crawler/src/comparison-search/product-url-facts";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-136 — **판매여부가 1순위다. 모르는 것을 판매중으로 세지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 계약이 생긴 이유는 **실측이 설계를 뒤집었기 때문** 이다:
 * ```
 * Shopify 공개 `/products/{handle}.json` · 호스트 9 (2026-10-20)
 *   inventory_management  9/9 "shopify"
 *   inventory_quantity    **2곳만** (thefrontshop · junioredition)
 * ⟹ 운영 `isVariantAvailable` 의 `inventory_quantity ?? 0` 을 후보에 쓰면
 *    **7곳이 「품절」로 떨어진다** — 「모른다」를 「0」으로 만드는 그 행위다.
 * ```
 * 🔴 그래서 축이 **세 개** 다(ON_SALE / SOLD_OUT / **UNKNOWN**). 둘로 접으면
 *    셀러가 보는 「판매중 N곳」이 거짓이 된다.
 *
 * 🔴 **판정하지 않는다** — threshold 0 · 새 MI 축 0 · 집계 완화 0.
 * 네트워크 **0**.
 */

function row(over: Partial<GeminiTransientRow> = {}): GeminiTransientRow {
  return {
    discoveredUrl: over.discoveredUrl ?? "https://a.example/p/1",
    domain: "a.example",
    title: "t",
    market: "OVERSEAS",
    matchTruth: "EXACT_IDENTIFIER",
    priceStatus: "VERIFIED_CURRENT",
    priceAmount: 100,
    priceCurrency: "USD",
    soldOut: null,
    ...over,
  } as GeminiTransientRow;
}

/* ───────────────── A. 판매여부 세 상태 (생산자 술어) ───────────────── */

describe("A. shopifyVariantAvailability — 「모른다」를 품절로 만들지 않는다", () => {
  it("A-1 재고추적을 안 하면 판매중이다", () => {
    expect(shopifyVariantAvailability({ variants: [{ inventory_management: null }] })).toBe(true);
  });

  it("A-2 backorder 허용(continue)이면 판매중이다", () => {
    expect(
      shopifyVariantAvailability({
        variants: [{ inventory_management: "shopify", inventory_policy: "continue", inventory_quantity: 0 }],
      }),
    ).toBe(true);
  });

  it("A-3 실재고가 하나라도 남아 있으면 판매중이다", () => {
    expect(
      shopifyVariantAvailability({
        variants: [
          { inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
          { inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 2 },
        ],
      }),
    ).toBe(true);
  });

  it("A-4 모든 variant 가 재고를 «주고» 전부 0 이면 품절이다", () => {
    expect(
      shopifyVariantAvailability({
        variants: [
          { inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
          { inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
        ],
      }),
    ).toBe(false);
  });

  it("🔴🔴 A-5 재고 칸이 «없으면» null 이다 — 실측 7/9 가 이 모양이다", () => {
    expect(
      shopifyVariantAvailability({
        variants: [{ inventory_management: "shopify" }, { inventory_management: "shopify" }],
      }),
    ).toBeNull();
  });

  it("🔴 A-6 일부만 재고를 줘도(그게 0 이면) 나머지를 0 으로 가정하지 않는다", () => {
    expect(
      shopifyVariantAvailability({
        variants: [
          { inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
          { inventory_management: "shopify" },
        ],
      }),
    ).toBeNull();
  });

  it("A-7 variants 가 없으면 null 이다 — 판매중을 지어내지 않는다", () => {
    expect(shopifyVariantAvailability({})).toBeNull();
    expect(shopifyVariantAvailability({ variants: [] })).toBeNull();
  });

  it("🔴 A-8 생산자가 그 값을 후보의 `soldOut` 으로 «배선» 한다 (배선이 없으면 전건 null)", () => {
    const src = readFileSync(
      join(process.cwd(), "../../packages/crawler/src/comparison-search/product-url-facts.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(src).toMatch(/soldOut:[\s\S]{0,120}shopifyVariantAvailability\(body\)/);
  });
});

describe("B. saleState — 셋을 둘로 접지 않는다", () => {
  it("B-1 false → 판매중 · true → 품절 · null → 확인불가", () => {
    expect(saleState(row({ soldOut: false }))).toBe("ON_SALE");
    expect(saleState(row({ soldOut: true }))).toBe("SOLD_OUT");
    expect(saleState(row({ soldOut: null }))).toBe("UNKNOWN");
  });

  it("🔴 B-2 세 상태의 «말» 이 서로 다르다 — 확인불가를 「판매중」으로 적지 않는다", () => {
    const texts = new Set(Object.values(SALE_STATE_TEXT));
    expect(texts.size).toBe(3);
    expect(SALE_STATE_TEXT.UNKNOWN).not.toContain("판매중");
    expect(SALE_STATE_TEXT.SOLD_OUT).not.toContain("판매중");
  });
});

/* ───────────────── C. 판매여부를 가격보다 «먼저» 센다 ───────────────── */

describe("C. buildMarketJudgement", () => {
  it("🔴🔴 C-1 판매여부 미확인은 「판매중」에 들어가지 않는다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/p/1", soldOut: false }),
      row({ discoveredUrl: "https://b.example/p/2", soldOut: null }),
      row({ discoveredUrl: "https://c.example/p/3", soldOut: true }),
    ]);
    expect(j.onSaleCount).toBe(1);
    expect(j.unknownCount).toBe(1);
    expect(j.soldOutCount).toBe(1);
    /** 🔴 세 숫자를 **한 줄에 같이** 적는다 — 분모를 숨기면 「판매중 1곳」이 거짓이 된다. */
    const note = onSaleCountNote(j);
    expect(note).toContain("판매중 확인 1곳");
    expect(note).toContain("확인불가 1곳");
    expect(note).toContain("품절 1곳");
  });

  it("🔴 C-2 SAME 이 아닌 후보는 아예 들어오지 않는다 (SIMILAR·보류·충돌)", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://s.example/1", matchTruth: undefined, crossSellerVerdict: "SIMILAR" }),
      row({ discoveredUrl: "https://p.example/2", matchTruth: undefined, crossSellerVerdict: "PRESUMED_SAME" }),
      row({ discoveredUrl: "https://x.example/3", matchTruth: undefined, crossSellerVerdict: "CONFLICT" }),
    ] as GeminiTransientRow[]);
    expect(j.sellers).toHaveLength(0);
    expect(j.verdict).toBe("NO_SAME");
  });

  it("C-3 같은 URL 은 접는다 — 판매처가 두 곳으로 읽히지 않는다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/p/1", soldOut: false }),
      row({ discoveredUrl: "https://a.example/p/1", soldOut: false }),
    ]);
    expect(j.sellers).toHaveLength(1);
    expect(j.onSaleCount).toBe(1);
  });

  it("C-4 정렬이 판매중 → 확인불가 → 품절 이다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://c.example/3", soldOut: true }),
      row({ discoveredUrl: "https://b.example/2", soldOut: null }),
      row({ discoveredUrl: "https://a.example/1", soldOut: false }),
    ]);
    expect(j.sellers.map((s) => s.sale)).toEqual(["ON_SALE", "UNKNOWN", "SOLD_OUT"]);
  });

  it("🔴 C-5 시장 UNKNOWN 을 국내로 세지 않는다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://u.example/1", domain: "u.example", market: undefined, soldOut: false }),
      row({ discoveredUrl: "https://k.example/2", domain: "k.example", market: "KR", soldOut: false }),
    ] as GeminiTransientRow[]);
    expect(j.domesticOnSale).toBe(1);
    expect(j.overseasOnSale).toBe(0);
    expect(j.sellers.find((s) => s.row.domain === "u.example")?.market).toBe("UNKNOWN");
  });

  it("🔴 C-6 품절은 가격 축에서 빠진다 — 팔 수 없는 가격은 시장가가 아니다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: true, priceAmount: 10 }),
      row({ discoveredUrl: "https://b.example/2", soldOut: false, priceAmount: 50 }),
    ]);
    expect(j.byCurrency).toHaveLength(1);
    expect(j.byCurrency[0].lowest).toBe(50);
    expect(j.pricedSellers).toHaveLength(1);
  });

  it("🔴🔴 C-7 확인불가는 가격 축에 «남는다» — 빼면 그 통화 축이 사라져 시장가를 못 본다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: null, priceAmount: 53 }),
      row({ discoveredUrl: "https://b.example/2", soldOut: null, priceAmount: 58 }),
    ]);
    expect(j.byCurrency).toEqual([{ currency: "USD", lowest: 53, highest: 58, n: 2, onSale: 0 }]);
    /** 🔴 그러나 「2곳에서 판매중」으로 읽히지 않게 **범위 문장이 직접 말한다**. */
    expect(priceRangeScope(j.byCurrency[0])).toContain("판매중 확인 0곳");
    expect(priceRangeText(j.byCurrency[0])).toBe("USD 53 ~ 58");
  });

  it("🔴 C-8 가격이 미검증이면 숫자를 만들지 않는다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: false, priceStatus: "UNVERIFIED_SEARCH" }),
    ]);
    expect(j.sellers[0].price).toBeNull();
    expect(j.byCurrency).toHaveLength(0);
    expect(j.verdict).toBe("ON_SALE_NO_PRICE");
  });

  it("🔴 C-9 통화를 환산하지 않는다 — 통화별로만 나뉜다", () => {
    const j = buildMarketJudgement([
      row({ discoveredUrl: "https://a.example/1", soldOut: false, priceAmount: 40, priceCurrency: "EUR" }),
      row({ discoveredUrl: "https://b.example/2", soldOut: false, priceAmount: 58, priceCurrency: "USD" }),
    ]);
    expect(j.byCurrency.map((c) => c.currency)).toEqual(["EUR", "USD"]);
  });
});

/* ───────────────── D. 네 결론을 «다른 문장» 으로 (CPO §G) ───────────────── */

describe("D. MarketVerdict — 「없다」로 뭉치지 않는다", () => {
  it("D-1 네 상태가 각각 다른 verdict 다", () => {
    expect(buildMarketJudgement([]).verdict).toBe("NO_SAME");
    expect(buildMarketJudgement([row({ soldOut: true })]).verdict).toBe("SAME_BUT_NONE_ON_SALE");
    expect(
      buildMarketJudgement([row({ soldOut: false, priceStatus: "UNVERIFIED_SEARCH" })]).verdict,
    ).toBe("ON_SALE_NO_PRICE");
    expect(buildMarketJudgement([row({ soldOut: false })]).verdict).toBe("ON_SALE");
  });

  it("🔴🔴 D-2 확인불가만 있으면 「판매중」이라 말하지 않는다", () => {
    const j = buildMarketJudgement([row({ soldOut: null })]);
    expect(j.verdict).toBe("SAME_BUT_NONE_ON_SALE");
    expect(MARKET_VERDICT_TEXT[j.verdict]).not.toBe(MARKET_VERDICT_TEXT.ON_SALE);
  });

  it("🔴 D-3 네 문장이 서로 다르다", () => {
    expect(new Set(Object.values(MARKET_VERDICT_TEXT)).size).toBe(4);
  });
});

/* ───────────────── E. 영역은 «하나» 이고 내부 토큰을 노출하지 않는다 ───────────────── */

describe("E. 영역 경계", () => {
  const src = readFileSync(join(__dirname, "../MarketPriceComparison.tsx"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );

  it("🔴 E-1 제목이 판매 판단이고 셀러의 말이다", () => {
    expect(MARKET_JUDGEMENT_TITLE).toContain("시장 판매 판단");
    expect(src).toContain("MARKET_JUDGEMENT_TITLE");
  });

  it("🔴🔴 E-2 내부 판정/가격 토큰이 이 영역의 코드에 «문자열로» 없다", () => {
    for (const token of [
      "VERIFIED_CURRENT",
      "UNVERIFIED_SEARCH",
      "PRESUMED_SAME",
      "EXACT_IDENTIFIER",
      "BRAND_UNCONFIRMED",
      "COLOR_VARIANT",
      "crossSellerBlockers",
    ]) {
      expect(src).not.toContain(token);
    }
  });

  it("🔴 E-3 가격 집계 어휘(summarize)를 이 영역에서 쓰지 않는다", () => {
    expect(src).not.toMatch(/summarize/i);
  });

  it("🔴 E-4 환산하지 않는다 — 원화 환산 기호/함수가 없다", () => {
    expect(src).not.toMatch(/krwEquivalent|convertToKrw|환산/);
  });

  it("🔴🔴 E-5 판매처 표의 네 칸이 고정이다", () => {
    expect([...MARKET_TABLE_HEADERS]).toEqual(["시장", "판매처", "판매상태", "현재가격"]);
    expect(src).toContain("MARKET_TABLE_HEADERS");
  });

  it("🔴🔴 E-5b 국내/해외 분해가 «판매중 확인» 범위로 한정된다 (CPO §3)", () => {
    /**
     * 🔴 우리가 셀 수 있는 것은 「발견된 SAME 후보 중 판매중으로 확인된 곳」 이고
     *    **시장 전체 판매처가 아니다**(판매여부 신호가 Shopify 경로에만 있다 · 실측 2/9).
     * 🔴 그래서 그 줄은 **반드시 수식어를 들고** 있어야 한다.
     */
    expect(src).toContain("ON_SALE_SPLIT_PREFIX");
    const at = src.indexOf('data-testid="market-split"');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 260)).toContain("ON_SALE_SPLIT_PREFIX");
    /** 🔴 그 줄이 세는 것은 **ON_SALE 뿐** 이다 — 총 판매처 수를 넣으면 FAIL. */
    expect(src.slice(at, at + 260)).toContain("domesticOnSale");
    expect(src.slice(at, at + 260)).not.toContain("sellers.length");
  });

  it("🔴🔴 E-6 판매여부·판매처 표가 가격 범위 «앞» 에 선다 (셀러의 1순위)", () => {
    const counts = src.indexOf("market-sale-counts");
    const range = src.indexOf("market-price-range");
    expect(counts).toBeGreaterThan(-1);
    expect(range).toBeGreaterThan(counts);
  });

  it("🔴🔴 E-7 기술/참고 블록은 «접혀» 있고 `open` 이 아니다", () => {
    expect(src).toContain('data-testid="mi-detail-fold"');
    expect(src).toMatch(/<details data-testid="mi-detail-fold"(?![^>]*\bopen\b)/);
  });

  it("🟢 E-8 기존 블록이 «삭제되지 않았다» — 두 참고가격과 SAME 행이 그대로 있다", () => {
    for (const kept of [
      "OverseasReferencePrice",
      "DOMESTIC_REFERENCE_TITLE",
      'data-testid="mi-same-row"',
      'data-testid="mi-same-excluded"',
      'data-testid="mi-same-empty"',
      'data-testid="mi-same-pending"',
    ]) {
      expect(src).toContain(kept);
    }
  });
});

/* ───────────────── F. 후보 구역은 «접힘» 이고 삭제가 아니다 (CPO §D) ───────────────── */

describe("F. 후보 구역 접힘", () => {
  const candSrc = readFileSync(join(__dirname, "../GeminiTransientCandidates.tsx"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );
  const panelSrc = readFileSync(join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8").replace(
    /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
    "",
  );

  it("🔴 F-1 접힘에 `open` 을 붙이지 않는다 (2026-09-19 사고 계약)", () => {
    expect(candSrc).toMatch(/<details data-testid="candidate-fold"(?![^>]*\bopen\b)/);
  });

  it("🔴🔴 F-2 네 후보 구역이 전부 접혀 있다", () => {
    for (const tid of [
      "domestic-review-transient",
      "overseas-auto-transient",
      "reviewed-same-transient",
      "url-candidate-transient",
    ]) {
      const at = panelSrc.indexOf(tid);
      expect(at, tid).toBeGreaterThan(-1);
      /** 🔴 같은 JSX 요소 안에서 `collapsed` 가 뒤따라야 한다. */
      expect(panelSrc.slice(at, at + 400), tid).toMatch(/\bcollapsed\b/);
    }
    expect(panelSrc).toMatch(/evidence=\{webRest\}\s+collapsed/);
  });

  it("🟢 F-3 행·버튼·저장 경로가 그대로다 (접기만 했다)", () => {
    for (const kept of [
      'data-testid="gt-verdict"',
      'data-testid="gt-review-result"',
      "HUMAN_REVIEW_BUTTON",
      "IMAGE_MISSING_TEXT",
    ]) {
      expect(candSrc).toContain(kept);
    }
  });
});
