import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OBSERVATION_STALE_DAYS,
  OVERSEAS_LOWEST_LABEL,
  PURCHASABILITY_UNKNOWN_NOTE,
  buildMarketJudgement,
  buildObservationQuality,
  buildPriceGuide,
  isConfirmedSameForPrice,
  marketPriceHeadline,
  observationQualityNotes,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-OVERSEAS-SOURCING-OBSERVATION-DISPLAY-01 — **관측을 «관측» 이라 부른다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 실측(DB 2026-11-24 · §5.2 통과 해외 **90행** · UNKNOWN 15 제외):
 * ```
 * 독립 판매처 **9** · junioredition.com **67행(74%)** · 고유 URL 20 · 원상품 84
 * GBP 67(판매처 1) 25.9 ~ **15,200** · EUR 18(4) · USD 14(2) · TWD 4(1) · JPY 2(1)
 * sold_out **90/90 「모름」** · 14일 초과 88/105 · 환율 12통화(🔴 **TWD 없음**)
 * ```
 * 🔴 그래서 이 계약은 **네 가지가 화면에서 사라지지 않는 것** 을 잠근다 —
 *    편중 · 관측 폭 · 낡은 수집 · 구매 가능 미확인.
 * 🔴 그리고 **금지 어휘**(「구매 가능 최저가」·「추천 소싱가」)가 돌아오면 FAIL 한다.
 */
const row = (o: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "junioredition.com",
    discoveredUrl: "https://junioredition.com/products/a",
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    priceTier: "EXACT",
    matchTruth: "STRONG_IDENTIFIER",
    market: "OVERSEAS",
    priceKrwDerived: 65_000,
    ...o,
  }) as GeminiTransientRow;

const NOW = "2026-11-24T00:00:00.000Z";
const q = (rows: GeminiTransientRow[], now = NOW) =>
  buildObservationQuality(buildMarketJudgement(rows, isConfirmedSameForPrice), "OVERSEAS", now);

describe("MI-OSOD-01 — 해외 관측 가격 표시", () => {
  it("A-1 🔵🔵 **명칭이 「해외 수집 최저 관측가」다** — 「확인가」로 되돌아가면 FAIL", () => {
    expect(OVERSEAS_LOWEST_LABEL).toBe("해외 수집 최저 관측가");
    const head = marketPriceHeadline(buildPriceGuide(buildMarketJudgement([row({})], isConfirmedSameForPrice), "OVERSEAS"));
    expect(head).toContain("해외 수집 최저 관측가");
    /** 🔴 **구매 가능성을 주장하는 말** 이 그 자리에 돌아오면 FAIL 한다. */
    expect(head).not.toContain("확인가");
    expect(head).not.toContain("구매 가능");
    expect(head).not.toContain("추천 소싱가");
  });

  it("A-2 🔴🔴 **판매처 편중을 숨기지 않는다**(실측 67/90 = 74%)", () => {
    /** junioredition 3행 + 다른 한 곳 1행 ⟹ 75% 편중. */
    const rows = [
      row({ discoveredUrl: "https://junioredition.com/products/a" }),
      row({ discoveredUrl: "https://junioredition.com/products/b", priceAmount: 40 }),
      row({ discoveredUrl: "https://junioredition.com/products/c", priceAmount: 42 }),
      row({ domain: "nickis.com", discoveredUrl: "https://nickis.com/p/1", priceAmount: 50 }),
    ];
    const notes = observationQualityNotes(q(rows));
    expect(notes.join("\n"), "🔴🔴 편중을 적지 않았다 — 한 판매처의 가격이 시장가처럼 보인다").toContain(
      "junioredition.com",
    );
    expect(notes.join("\n")).toContain("75%");
  });

  it("A-3 🔴 **판매처가 하나면 「편중」이 아니라 「표본 하나」라고 적는다**", () => {
    const notes = observationQualityNotes(q([row({}), row({ discoveredUrl: "https://junioredition.com/products/b", priceAmount: 40 })]));
    expect(notes.join("\n")).toContain("한 판매처의 관측만");
    expect(notes.join("\n"), "🔴 1곳인데 편중 문장을 적었다").not.toContain("몰려 있습니다");
  });

  it("A-4 🔴🔴 **구매 가능 여부 미확인을 반드시 적는다**(실측 90/90 모름)", () => {
    /** `soldOut` 을 주지 않으면 판매상태는 **모름** 이다 — 판매중으로 세지 않는다. */
    const quality = q([row({})]);
    expect(quality.purchasabilityUnknownCount).toBe(1);
    expect(observationQualityNotes(quality).join("\n")).toContain(PURCHASABILITY_UNKNOWN_NOTE);
  });

  it("A-5 🔴 **환율 근거가 없는 통화를 원화로 적지 않는다**(실측 TWD)", () => {
    const quality = q([
      row({ priceCurrency: "TWD", priceAmount: 1_980, priceKrwDerived: null, discoveredUrl: "https://tw.example.com/p/1", domain: "tw.example.com" }),
    ]);
    expect(quality.fxMissingCurrencies).toEqual(["TWD"]);
    expect(observationQualityNotes(quality).join("\n")).toContain("TWD");
    expect(observationQualityNotes(quality).join("\n")).toContain("환율 근거가 없어");
  });

  it("A-6 🔴🔴 **같은 통화의 관측 폭을 사실로 적는다 — «제외하지 않는다»**(실측 GBP 25.9 ~ 15,200)", () => {
    const rows = [
      row({ priceAmount: 25.9, discoveredUrl: "https://junioredition.com/products/a" }),
      row({ priceAmount: 15_200, discoveredUrl: "https://junioredition.com/products/x" }),
    ];
    const quality = q(rows);
    expect(quality.spreads).toHaveLength(1);
    expect(quality.spreads[0]?.lowest).toBe(25.9);
    expect(quality.spreads[0]?.highest, "🔴🔴 극단값이 화면에서 사라졌다").toBe(15_200);
    /** 🔴🔴 **「비정상」이라고 판정하지 않는다** — 임의 기준을 만들지 않았다. */
    const text = observationQualityNotes(quality).join("\n");
    expect(text).toContain("관측 폭");
    expect(text, "🔴 임의 기준으로 「비정상」이라 단정했다").not.toContain("비정상");
    /** 🟢 그리고 **최저 관측가는 그 극단값이 아니다**(기존 상한 규칙이 최저를 보존한다). */
    const g = buildPriceGuide(buildMarketJudgement(rows, isConfirmedSameForPrice), "OVERSEAS");
    expect(g.byCurrency[0]?.lowest, "🔴🔴 극단값이 최저 관측가가 됐다").toBe(25.9);
  });

  it("A-7 🔴 **낡은 수집과 「시점 모름」을 가른다**", () => {
    const quality = q([
      row({ collectedAt: "2026-10-21T00:00:00.000Z", discoveredUrl: "https://junioredition.com/products/a" }),
      row({ collectedAt: "2026-11-23T00:00:00.000Z", discoveredUrl: "https://junioredition.com/products/b", priceAmount: 40 }),
      row({ discoveredUrl: "https://junioredition.com/products/c", priceAmount: 41 }),
    ]);
    expect(quality.staleCount, `🔴 ${OBSERVATION_STALE_DAYS}일 초과를 세지 않았다`).toBe(1);
    expect(quality.collectedAtUnknownCount, "🔴 시점 모름을 낡은 것으로 뭉갰다").toBe(1);
    expect(quality.lastCollectedAt).toBe("2026-11-23T00:00:00.000Z");
    const text = observationQualityNotes(quality).join("\n");
    expect(text).toContain(`${OBSERVATION_STALE_DAYS}일이 지난 관측 1건`);
    expect(text).toContain("수집 시점을 확인할 수 없는 관측 1건");
  });

  it("A-8 🔴 **기준 시각이 없으면 낡았다고 «주장하지 않는다»**", () => {
    const quality = q([row({ collectedAt: "2020-01-01T00:00:00.000Z" })], "");
    expect(quality.staleCount, "🔴🔴 기준 시각 없이 낡음을 단정했다").toBe(0);
  });

  it("A-9 🔴 **근거가 0 이면 줄을 만들지 않는다**", () => {
    expect(observationQualityNotes(q([]))).toEqual([]);
  });

  it("B-1 🔴🔴 **국내 축이 해외 관측 폭에 섞이지 않는다**", () => {
    const quality = q([
      row({}),
      row({ market: "KR", priceCurrency: "KRW", priceAmount: 88_000, domain: "shop.kr", discoveredUrl: "https://shop.kr/p/1" }),
    ]);
    expect(quality.spreads.map((s) => s.currency), "🔴🔴 KRW 가 해외 폭에 들어왔다").not.toContain("KRW");
    expect(quality.observationCount, "🔴 해외 분모에 국내 행을 셌다").toBe(1);
  });

  it("B-2 🔴 **품절은 관측 분모에서 빠진다**(기존 가격 축과 같은 조건)", () => {
    const quality = q([row({}), row({ soldOut: true, discoveredUrl: "https://junioredition.com/products/z", priceAmount: 20 })]);
    expect(quality.observationCount).toBe(1);
    const g = buildPriceGuide(buildMarketJudgement([row({}), row({ soldOut: true, discoveredUrl: "https://junioredition.com/products/z", priceAmount: 20 })], isConfirmedSameForPrice), "OVERSEAS");
    expect(quality.observationCount, "🔴🔴 품질 분모와 가격 분모가 갈렸다").toBe(g.pricedCount);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵 C — **기존 계약 보호**(CPO §4) · 🔴 주석을 벗기고 본다
   * ══════════════════════════════════════════════════════════════════════════
   */
  describe("C — 변경 금지 축", () => {
    const strip = (p: string) =>
      readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");
    const REC = strip(
      join(__dirname, "..", "..", "..", "..", "..", "..", "..", "packages", "pricing", "src", "price-recommendation.ts"),
    );
    const MI = strip(join(__dirname, "..", "mi-same-candidates.ts"));

    it("C-1 🔴🔴 **추천가 공식을 건드리지 않았다**", () => {
      /** 🟢 CASE A/B/C/D 와 그 경계가 **그대로** 있다. */
      expect(REC).toContain("input.domesticBasis !== \"EXACT\"");
      expect(REC).toContain("const marketPrice = input.domesticLowestPriceKrw");
      expect(REC).toContain("Math.max(targetPrice, Math.round(marketPrice * 0.99))");
      /** 🔴 **평균을 쓰지 않는다** — 그 입력이 계산에 들어오면 FAIL 한다. */
      expect(REC, "🔴🔴 평균 가격이 추천가 계산에 들어왔다").not.toContain(
        "domesticAveragePriceKrw *",
      );
    });

    it("C-2 🔴 **이 표시 영역이 추천가·환산을 만들지 않는다**", () => {
      const q2 = MI.slice(MI.indexOf("export function buildObservationQuality"));
      const body = q2.slice(0, q2.indexOf("\nfunction observedSpreads"));
      for (const banned of ["recommendedPrice", "exchangeRate", "convertToKrw", "* rate", "suggestedPrice"])
        expect(body, `🔴🔴 관측 표시가 ${banned} 를 만든다`).not.toContain(banned);
      /** 🟢 환산값은 **읽기만** 한다(owner 는 `attachDerivedKrw`). */
      expect(body).toContain("priceKrwDerived");
    });

    it("C-3 🔴 **§5.2 가격 자격과 PRESUMED 경계가 그대로다**", () => {
      expect(MI).toContain("export function passesPriceEligibility");
      expect(MI).toContain("export function isPresumedSameForPrice");
      /** 🔴 PRESUMED 가 확정축으로 승격되면 FAIL. */
      const conf = MI.slice(MI.indexOf("export function isConfirmedSameForPrice"));
      expect(conf.slice(0, 400), "🔴🔴 PRESUMED_SAME 이 확정 동일상품 가격축에 들어왔다").not.toContain(
        "PRESUMED_SAME\") return true",
      );
    });

    it("C-4 🔴 **금지 어휘가 이 파일에 생기지 않았다**", () => {
      for (const banned of ["구매 가능 최저가", "추천 소싱가"])
        expect(MI, `🔴🔴 ${banned} 라는 말을 만들었다`).not.toContain(banned);
    });
  });
});
