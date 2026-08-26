import { describe, expect, it } from "vitest";
import { computeSellability } from "../sellability";

describe("computeSellability — N-4.18-Q3(대표님 지시, 2026-08-26)", () => {
  it("원가를 모르면 UNKNOWN — 원가 확인 필요", () => {
    const result = computeSellability({
      costPriceKrw: null,
      domestic: { matched: false, averagePriceKrw: null },
    });
    expect(result.level).toBe("UNKNOWN");
    expect(result.estimatedMarginPercent).toBeNull();
  });

  it("PèPè 실측 사례(2026-08-26, 대표님 보고) — 실제 구매가 ₩234,800은 알지만 국내 동일상품 검색 실패 → YELLOW, 있지도 않은 국내가를 지어내지 않는다", () => {
    const result = computeSellability({
      costPriceKrw: 234800,
      domestic: { matched: false, averagePriceKrw: null },
    });
    expect(result.level).toBe("YELLOW");
    expect(result.reason).toContain("찾지 못했습니다");
    expect(result.estimatedMarginPercent).toBeNull();
  });

  it("Bobo Choses 실측 사례(N-4.18-Q, 2026-08-26) — 국내 동일상품 발견 + 원가 대비 마진 충분 → GREEN", () => {
    // 실측: 원가 ₩177,600(Shopify KR market), 국내 판매가 ₩202,000(Bobo Choses Korea 공식몰)
    const result = computeSellability({
      costPriceKrw: 177600,
      domestic: { matched: true, averagePriceKrw: 202000 },
    });
    expect(result.level).toBe("GREEN");
    expect(result.estimatedMarginPercent).toBeGreaterThan(10);
  });

  it("국내 판매가보다 원가가 더 비싸면 RED — 마진을 남길 수 없음", () => {
    const result = computeSellability({
      costPriceKrw: 300000,
      domestic: { matched: true, averagePriceKrw: 250000 },
    });
    expect(result.level).toBe("RED");
    expect(result.reason).toContain("마진을 남길 수 없습니다");
    expect(result.estimatedMarginPercent).toBeLessThan(0);
  });

  it("마진율이 최소 기준(10%) 미만이면 RED", () => {
    const result = computeSellability({
      costPriceKrw: 95000,
      domestic: { matched: true, averagePriceKrw: 100000 }, // 5% 마진
    });
    expect(result.level).toBe("RED");
    expect(result.estimatedMarginPercent).toBe(5);
  });

  it("동일상품은 찾았지만 가격을 확인 못했으면(averagePriceKrw null) YELLOW", () => {
    const result = computeSellability({
      costPriceKrw: 100000,
      domestic: { matched: true, averagePriceKrw: null },
    });
    expect(result.level).toBe("YELLOW");
  });
});
