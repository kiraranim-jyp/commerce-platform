import { describe, expect, it } from "vitest";
import { computePriceAlertSignal } from "../price-alert-signal";

describe("computePriceAlertSignal", () => {
  it("가격이 임계치 이상 하락하면 PRICE_DROP", () => {
    expect(
      computePriceAlertSignal({ priceChangeRatePercent: -12, marginChangePercentPoints: null }),
    ).toBe("PRICE_DROP");
  });

  it("가격이 임계치 이상 상승하면 PRICE_RISE", () => {
    expect(
      computePriceAlertSignal({ priceChangeRatePercent: 15, marginChangePercentPoints: null }),
    ).toBe("PRICE_RISE");
  });

  it("마진이 임계치 이상 악화되면 MARGIN_DROP(가격 신호보다 우선)", () => {
    expect(
      computePriceAlertSignal({ priceChangeRatePercent: 15, marginChangePercentPoints: -8 }),
    ).toBe("MARGIN_DROP");
  });

  it("마진이 임계치 이상 개선되면 MARGIN_RECOVERED", () => {
    expect(
      computePriceAlertSignal({ priceChangeRatePercent: null, marginChangePercentPoints: 7 }),
    ).toBe("MARGIN_RECOVERED");
  });

  it("변화가 임계치 미만이면 NO_CHANGE", () => {
    expect(
      computePriceAlertSignal({ priceChangeRatePercent: 2, marginChangePercentPoints: 1 }),
    ).toBe("NO_CHANGE");
  });

  it("데이터가 전혀 없으면(둘 다 null) NO_CHANGE — 없는 변화를 지어내지 않는다", () => {
    expect(
      computePriceAlertSignal({ priceChangeRatePercent: null, marginChangePercentPoints: null }),
    ).toBe("NO_CHANGE");
  });

  it("커스텀 threshold를 존중한다", () => {
    expect(
      computePriceAlertSignal({
        priceChangeRatePercent: -6,
        marginChangePercentPoints: null,
        priceThresholdPercent: 5,
      }),
    ).toBe("PRICE_DROP");
  });
});
