import { describe, expect, it } from "vitest";
import { computeBrandMarketProfile } from "../brand-market-profile";

describe("computeBrandMarketProfile", () => {
  it("실측 Bobo Choses 분포(28개, 2026-08-31 조사)에 가까운 표본 — HIGH confidence", () => {
    // 실제 조사에서 min=64516, max=177900, avg=138372이었다(정확한 28개 원본값은
    // 실측 조사에 없었으므로 범위/개수만 재현한 합성 표본).
    const prices = Array.from({ length: 28 }, (_, i) => 64516 + i * ((177900 - 64516) / 27));
    const profile = computeBrandMarketProfile(prices)!;
    expect(profile.sampleCount).toBe(28);
    expect(profile.confidence).toBe("HIGH");
    expect(profile.minPriceKrw).toBe(64516);
    expect(profile.maxPriceKrw).toBe(177900);
    expect(profile.medianPriceKrw).toBeGreaterThan(profile.minPriceKrw);
    expect(profile.medianPriceKrw).toBeLessThan(profile.maxPriceKrw);
  });

  it("표본 1~2개는 INSUFFICIENT — 가격 추천에 쓰면 안 된다는 신호", () => {
    expect(computeBrandMarketProfile([100000])!.confidence).toBe("INSUFFICIENT");
    expect(computeBrandMarketProfile([100000, 120000])!.confidence).toBe("INSUFFICIENT");
  });

  it("표본 3~4개는 LOW, 5~9개는 MEDIUM, 10개 이상은 HIGH", () => {
    expect(computeBrandMarketProfile([1, 2, 3])!.confidence).toBe("LOW");
    expect(computeBrandMarketProfile([1, 2, 3, 4])!.confidence).toBe("LOW");
    expect(computeBrandMarketProfile([1, 2, 3, 4, 5])!.confidence).toBe("MEDIUM");
    expect(computeBrandMarketProfile(Array(9).fill(1))!.confidence).toBe("MEDIUM");
    expect(computeBrandMarketProfile(Array(10).fill(1))!.confidence).toBe("HIGH");
  });

  it("표본이 없으면 null(프로파일 자체를 만들지 않는다)", () => {
    expect(computeBrandMarketProfile([])).toBeNull();
  });

  it("market은 항상 KR(향후 JP/US 확장 대비 필드, 지금은 고정값)", () => {
    expect(computeBrandMarketProfile([100000, 200000, 300000])!.market).toBe("KR");
  });
});
