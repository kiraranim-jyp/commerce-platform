import { describe, expect, it } from "vitest";
import { computeSellerAction, type SellerActionInput } from "../seller-action";

function baseInput(overrides: Partial<SellerActionInput> = {}): SellerActionInput {
  return {
    priceLevel: "UNKNOWN",
    currentSellingPriceKrw: null,
    domestic: {
      lowestPriceKrw: null,
      averagePriceKrw: null,
      sellerCount: 0,
      priceGapVsLowestPercent: null,
      priceGapVsAveragePercent: null,
      trend: null,
      soldOutCount: 0,
    },
    origin: { change: null },
    ...overrides,
  };
}

describe("computeSellerAction — N-4.18-H-2 STEP H-2-1(상태) + H-2-8(8개 케이스)", () => {
  it("1) 국내 가격 경쟁력 양호 → PRICE_KEEP(🟢), 이유에 최저가/판매가 포함", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        currentSellingPriceKrw: 100000,
        domestic: {
          lowestPriceKrw: 110000,
          averagePriceKrw: 115000,
          sellerCount: 3,
          priceGapVsLowestPercent: -9.1,
          priceGapVsAveragePercent: -13,
          trend: null,
          soldOutCount: 0,
        },
      }),
    );
    expect(result.status).toBe("PRICE_KEEP");
    expect(result.title).toBe("현재 가격 유지 권장");
    expect(result.reasons).toContain("국내 동일상품 3곳 확인");
    expect(result.reasons).toContain("국내 최저가 ₩110,000");
    expect(result.reasons).toContain("내 판매가 ₩100,000");
  });

  it("2) 국내 최저가보다 높은 상품 → priceLevel 그대로 재사용(YELLOW→PRICE_REVIEW, RED→PRICE_ADJUST), 새 threshold 발명 안 함", () => {
    const yellow = computeSellerAction(
      baseInput({
        priceLevel: "YELLOW",
        currentSellingPriceKrw: 129000,
        domestic: {
          lowestPriceKrw: 109000,
          averagePriceKrw: 114000,
          sellerCount: 3,
          priceGapVsLowestPercent: 18.3,
          priceGapVsAveragePercent: 13.2,
          trend: null,
          soldOutCount: 0,
        },
      }),
    );
    expect(yellow.status).toBe("PRICE_REVIEW");
    expect(yellow.reasons).toContain("최저가 대비 +18.3%");

    const red = computeSellerAction(baseInput({ priceLevel: "RED" }));
    expect(red.status).toBe("PRICE_ADJUST");
  });

  it("3) 비교 데이터 없음 → INSUFFICIENT_DATA(⚪), '경쟁력 없음'으로 해석하지 않는다", () => {
    const result = computeSellerAction(baseInput({ priceLevel: "UNKNOWN" }));
    expect(result.status).toBe("INSUFFICIENT_DATA");
    expect(result.title).toBe("비교 데이터가 부족합니다");
    expect(result.title).not.toContain("경쟁력");
    expect(result.signals).toHaveLength(0);
  });

  it("4) 국내 경쟁가격 하락 → 🔴 domestic 신호, 실제 전/후 가격을 포함", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "YELLOW",
        domestic: {
          lowestPriceKrw: 109000,
          averagePriceKrw: 112000,
          sellerCount: 2,
          priceGapVsLowestPercent: 10,
          priceGapVsAveragePercent: 5,
          trend: { current: 109000, previous: 119000, change: -10000, changeRate: -8.4, trend: "DOWN" },
          soldOutCount: 0,
        },
      }),
    );
    const signal = result.signals.find((s) => s.title === "국내 경쟁가격 하락");
    expect(signal).toBeDefined();
    expect(signal!.detail).toContain("₩119,000");
    expect(signal!.detail).toContain("₩109,000");
    expect(result.reasons).toContain("최근 가격 하락 확인");
  });

  it("5) 국내 경쟁상품 품절 → 🟢 domestic 신호, 품절 개수 표시(품절 상품은 여전히 가격 계산 제외 — summarizeFrom이 이미 보장)", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        domestic: {
          lowestPriceKrw: 120000,
          averagePriceKrw: 120000,
          sellerCount: 1,
          priceGapVsLowestPercent: -5,
          priceGapVsAveragePercent: -5,
          trend: null,
          soldOutCount: 1,
        },
      }),
    );
    const signal = result.signals.find((s) => s.title === "경쟁상품 품절");
    expect(signal).toBeDefined();
    expect(signal!.detail).toContain("1곳");
  });

  it("6) 해외 원가 상승 → ⚠️ origin 신호(환율 재계산 없이 변화율만)", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        origin: {
          change: {
            oldPriceKrw: 79000,
            newPriceKrw: 82000,
            changeAmountKrw: 3000,
            changeRatePercent: 3.8,
            oldCheckedAt: "2026-08-20T00:00:00.000Z",
            newCheckedAt: "2026-08-24T00:00:00.000Z",
          },
        },
      }),
    );
    const signal = result.signals.find((s) => s.title === "해외 원가 상승");
    expect(signal).toBeDefined();
    expect(signal!.detail).toContain("3.8%");
  });

  it("7) 해외 원가 하락 → 🟢 origin 신호", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        origin: {
          change: {
            oldPriceKrw: 82000,
            newPriceKrw: 79000,
            changeAmountKrw: -3000,
            changeRatePercent: -3.7,
            oldCheckedAt: "2026-08-20T00:00:00.000Z",
            newCheckedAt: "2026-08-24T00:00:00.000Z",
          },
        },
      }),
    );
    const signal = result.signals.find((s) => s.title === "해외 원가 하락");
    expect(signal).toBeDefined();
    expect(signal!.detail).toContain("3.7%");
  });

  it("8) 국내+해외 동시 변동 — Case B(원가↑ + 국내↓) → 🔴 가격 전략 재검토", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "YELLOW",
        domestic: {
          lowestPriceKrw: 109000,
          averagePriceKrw: 112000,
          sellerCount: 2,
          priceGapVsLowestPercent: 10,
          priceGapVsAveragePercent: 5,
          trend: { current: 109000, previous: 119000, change: -10000, changeRate: -8.4, trend: "DOWN" },
          soldOutCount: 0,
        },
        origin: {
          change: {
            oldPriceKrw: 79000,
            newPriceKrw: 82000,
            changeAmountKrw: 3000,
            changeRatePercent: 3.8,
            oldCheckedAt: "2026-08-20T00:00:00.000Z",
            newCheckedAt: "2026-08-24T00:00:00.000Z",
          },
        },
      }),
    );
    const combined = result.signals.find((s) => s.title === "가격 전략 재검토");
    expect(combined).toBeDefined();
  });

  it("8-B) Case A(원가↓ + 국내 안정 + GREEN) → 🟢 가격 유지 권장(결합신호)", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        domestic: {
          lowestPriceKrw: 109000,
          averagePriceKrw: 112000,
          sellerCount: 2,
          priceGapVsLowestPercent: -5,
          priceGapVsAveragePercent: -5,
          trend: { current: 109000, previous: 109000, change: 0, changeRate: 0, trend: "UNCHANGED" },
          soldOutCount: 0,
        },
        origin: {
          change: {
            oldPriceKrw: 82000,
            newPriceKrw: 79000,
            changeAmountKrw: -3000,
            changeRatePercent: -3.7,
            oldCheckedAt: "2026-08-20T00:00:00.000Z",
            newCheckedAt: "2026-08-24T00:00:00.000Z",
          },
        },
      }),
    );
    const combined = result.signals.find((s) => s.title === "가격 유지 권장");
    expect(combined).toBeDefined();
  });

  it("8-C) Case C(원가↑ + 국내↑) → ⚠️ 시장 가격 변동(단순 인상 권유 아님)", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        domestic: {
          lowestPriceKrw: 119000,
          averagePriceKrw: 122000,
          sellerCount: 2,
          priceGapVsLowestPercent: -5,
          priceGapVsAveragePercent: -5,
          trend: { current: 119000, previous: 109000, change: 10000, changeRate: 9.2, trend: "UP" },
          soldOutCount: 0,
        },
        origin: {
          change: {
            oldPriceKrw: 79000,
            newPriceKrw: 82000,
            changeAmountKrw: 3000,
            changeRatePercent: 3.8,
            oldCheckedAt: "2026-08-20T00:00:00.000Z",
            newCheckedAt: "2026-08-24T00:00:00.000Z",
          },
        },
      }),
    );
    const combined = result.signals.find((s) => s.title === "시장 가격 변동");
    expect(combined).toBeDefined();
    expect(combined!.detail).not.toContain("올리");
  });

  it("변화가 없으면(UNCHANGED) 국내/해외 변화 신호를 지어내지 않는다", () => {
    const result = computeSellerAction(
      baseInput({
        priceLevel: "GREEN",
        domestic: {
          lowestPriceKrw: 100000,
          averagePriceKrw: 100000,
          sellerCount: 1,
          priceGapVsLowestPercent: 0,
          priceGapVsAveragePercent: 0,
          trend: { current: 100000, previous: 100000, change: 0, changeRate: 0, trend: "UNCHANGED" },
          soldOutCount: 0,
        },
        origin: {
          change: {
            oldPriceKrw: 80000,
            newPriceKrw: 80000,
            changeAmountKrw: 0,
            changeRatePercent: 0,
            oldCheckedAt: "2026-08-20T00:00:00.000Z",
            newCheckedAt: "2026-08-24T00:00:00.000Z",
          },
        },
      }),
    );
    expect(result.signals.find((s) => s.title.includes("경쟁가격"))).toBeUndefined();
    expect(result.signals.find((s) => s.title.includes("원가"))).toBeUndefined();
  });
});
