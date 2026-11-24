import { describe, expect, it } from "vitest";
import {
  buildMarketJudgement,
  buildPriceGuide,
  isConfirmedSameForPrice,
  isPresumedSameForPrice,
  marketPriceHeadline,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-DOMESTIC-PRICE-AXIS-01 — **국내 확정 SAME 가격의 «분모» 를 잠근다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO §3 — 「후보 row 수를 독립 판매자 수로 표시하지 않는다」 ·
 *    「독립 판매자 근거가 **2곳 이상일 때만** 가격 형성 범위를 표시한다. 1곳뿐이면
 *     범위가 형성된 것처럼 표현하지 말고 **단일 관측 가격** 으로 구분한다」.
 *
 * 🟢 운영 실측(DB 2026-11-24 · 국내) — 후보 41행 → **확정 SAME 1** → §5.2 통과 **1** →
 *    원상품 1개 · 고유 URL 1 · **독립 판매자 1곳** · KRW 88,000
 *    ⟹ 🔴 **「가격 범위」는 현재 데이터로 성립하지 않는다**(2곳+ = 0) · 단일 관측 1.
 * 🔴 그래서 이 계약은 **숫자를 만들지 않는 쪽** 을 잠근다.
 */
const row = (o: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    domain: "shop-a.kr",
    discoveredUrl: "https://shop-a.kr/p/1",
    priceAmount: 88_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    priceTier: "EXACT",
    matchTruth: "STRONG_IDENTIFIER",
    market: "KR",
    ...o,
  }) as GeminiTransientRow;

const guide = (rows: GeminiTransientRow[]) =>
  buildPriceGuide(buildMarketJudgement(rows, isConfirmedSameForPrice), "KR");

describe("MI-DOMESTIC-PRICE-AXIS-01", () => {
  it("A-1 🔴🔴 **같은 판매처의 URL 둘은 「판매자 2곳」이 아니다** — 범위가 생기지 않는다", () => {
    const g = guide([
      row({ discoveredUrl: "https://shop-a.kr/p/1", priceAmount: 88_000 }),
      row({ discoveredUrl: "https://shop-a.kr/p/2", priceAmount: 120_000 }),
    ]);
    /** 🔴 후보는 둘이다 — 그 사실은 숨기지 않는다. */
    expect(g.pricedCount, "🔴 후보 수를 줄였다 — 관측을 숨기면 안 된다").toBe(2);
    /** 🟢 그러나 **독립 판매자는 1곳** 이다. */
    expect(g.independentSellerCount, "🔴🔴 같은 판매처를 2곳으로 셌다").toBe(1);
    /** 🔴🔴 **그래서 「가격대」가 아니다** — 금액이 달라도 단일 관측이다. */
    expect(g.basis, "🔴🔴 한 판매처의 두 리스팅을 시장 가격대로 표시했다").toBe("SINGLE");
  });

  it("A-2 🟢 **독립 판매자 2곳이고 금액이 다르면** 가격 범위다", () => {
    const g = guide([
      row({ domain: "shop-a.kr", discoveredUrl: "https://shop-a.kr/p/1", priceAmount: 88_000 }),
      row({ domain: "shop-b.kr", discoveredUrl: "https://shop-b.kr/p/9", priceAmount: 120_000 }),
    ]);
    expect(g.independentSellerCount).toBe(2);
    expect(g.basis).toBe("RANGE");
    expect(marketPriceHeadline(g)).toContain("KRW");
  });

  it("A-3 🔴 **같은 금액 둘은 가격대가 아니다**(기존 규칙 유지)", () => {
    const g = guide([
      row({ domain: "shop-a.kr", discoveredUrl: "https://shop-a.kr/p/1", priceAmount: 88_000 }),
      row({ domain: "shop-b.kr", discoveredUrl: "https://shop-b.kr/p/9", priceAmount: 88_000 }),
    ]);
    expect(g.independentSellerCount).toBe(2);
    expect(g.basis, "🔴 같은 금액을 범위로 만들었다").toBe("SINGLE");
  });

  it("A-4 🔴 **근거가 없으면 숫자를 만들지 않는다**", () => {
    const g = guide([]);
    expect(g.basis).toBe("NONE");
    expect(g.independentSellerCount).toBe(0);
    expect(g.byCurrency).toEqual([]);
    expect(marketPriceHeadline(g), "🔴🔴 근거 0 인데 금액 문장을 만들었다").toBeNull();
  });

  it("B-1 🔴🔴 **확정되지 않은 상품은 확정 가격축에 섞이지 않는다**", () => {
    /** PRESUMED_SAME · CEO DIFFERENT · 자격 미통과를 **한 번에** 넣는다. */
    const rows = [
      row({ domain: "ok.kr", discoveredUrl: "https://ok.kr/p/1", priceAmount: 88_000 }),
      row({
        domain: "presumed.kr",
        discoveredUrl: "https://presumed.kr/p/2",
        matchTruth: "TEXT_CONFIRMED",
        priceTier: "COMPARISON",
        priceAmount: 50_000,
      }),
      row({
        domain: "ceodiff.kr",
        discoveredUrl: "https://ceodiff.kr/p/3",
        ceoConfirmedDifferent: true,
        priceAmount: 40_000,
      }),
      row({
        domain: "unverified.kr",
        discoveredUrl: "https://unverified.kr/p/4",
        priceStatus: "UNVERIFIED_SEARCH",
        priceAmount: 30_000,
      }),
    ];
    const g = guide(rows);
    /** 🟢 확정축에는 **첫 건만** 든다. */
    expect(g.independentSellerCount, "🔴🔴 확정 아닌 후보가 확정 가격축에 들어왔다").toBe(1);
    expect(g.basis).toBe("SINGLE");
    const lowest = g.byCurrency[0]?.lowest ?? null;
    expect(lowest, "🔴🔴 확정 아닌 후보의 금액이 최저가가 됐다").toBe(88_000);
    /** 🔴 PRESUMED 는 **추정 축** 에서만 보인다(확정축과 배타). */
    expect(rows.filter(isPresumedSameForPrice)).toHaveLength(1);
    /** 🔴 CEO DIFFERENT 는 **어느 축에도** 없다. */
    expect(rows.filter((r) => r.ceoConfirmedDifferent === true).some(isConfirmedSameForPrice)).toBe(
      false,
    );
    expect(rows.filter((r) => r.ceoConfirmedDifferent === true).some(isPresumedSameForPrice)).toBe(
      false,
    );
  });

  it("B-2 🔵 **CEO 확정 SAME 은 시스템 PRESUMED 여도 확정축에 든다**(1순위 유지)", () => {
    const g = guide([
      row({
        domain: "ceo.kr",
        discoveredUrl: "https://ceo.kr/p/1",
        matchTruth: "TEXT_CONFIRMED",
        priceTier: "COMPARISON",
        ceoConfirmedSame: true,
        priceAmount: 99_000,
      }),
    ]);
    expect(g.independentSellerCount).toBe(1);
    expect(g.byCurrency[0]?.lowest).toBe(99_000);
  });

  it("C-1 🔴 **KRW 가 아니면 국내 축에 들어가지 않는다**(환산 0)", () => {
    const g = guide([
      row({ domain: "jp.kr", discoveredUrl: "https://jp.kr/p/1", priceCurrency: "JPY", priceAmount: 8_690 }),
    ]);
    /** 🟢 그 후보는 국내 시장 축에 **있지만** 통화가 다르면 KRW 금액을 만들지 않는다. */
    const krw = g.byCurrency.find((c) => c.currency === "KRW");
    expect(krw, "🔴🔴 JPY 를 KRW 로 바꿔 넣었다").toBeUndefined();
  });

  it("D-1 🔴 **B(시장 참고가)를 A(`recommendedPrice`)에 대입하지 않는다**", () => {
    const g = guide([row({ priceAmount: 88_000 })]);
    /** 🟢 이 타입에는 추천가 칸이 **없다** — 개념이 섞일 자리가 구조적으로 없다. */
    expect(Object.keys(g), "🔴🔴 가격 가이드에 추천가 칸이 생겼다").not.toContain("recommendedPrice");
    expect(Object.keys(g)).not.toContain("recommendedPriceKrw");
  });
});
