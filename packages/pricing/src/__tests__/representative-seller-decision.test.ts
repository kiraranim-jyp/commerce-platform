import { describe, expect, it } from "vitest";
import { deriveRepresentativeSellerVerdict, type RepresentativeVerdictInput } from "../representative-seller-decision";

/**
 * P-8(대표님 지시, 2026-08-30) — STEP 8이 요구한 UX-01~06을 그대로 옮긴다.
 * unifiedDecision/sellability는 이미 검증된 기존 엔진 결과를 흉내낸 입력일 뿐,
 * 이 테스트는 "그 결과를 대표 판단 1개로 어떻게 압축하는가"만 검증한다.
 */
describe("P-8 STEP 8: deriveRepresentativeSellerVerdict", () => {
  const base: RepresentativeVerdictInput = {
    unifiedDecision: null,
    sellability: { level: "UNKNOWN", estimatedMarginPercent: null, reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다." },
    domesticMatched: false,
    domesticSellerCount: 0,
  };

  it("UX-01) 국내 검증 가격 존재 + 정상 수익성(sellability GREEN) → 🟢 READY, 이유 2개 이상", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "GREEN", estimatedMarginPercent: 10.1, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
    });
    expect(result.code).toBe("READY");
    expect(result.icon).toBe("🟢");
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    expect(result.reasons.some((r) => r.includes("국내 동일상품"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("10.1"))).toBe(true);
  });

  it("UX-02) 국내 가격 없음(sellability YELLOW) → 🟠 NEEDS_INFO", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: {
        level: "YELLOW",
        estimatedMarginPercent: null,
        reason: "국내 동일상품을 자동으로 찾지 못했습니다 — 가격 기준을 확정할 수 없어 등록 전 직접 확인이 필요합니다.",
      },
      domesticMatched: false,
      domesticSellerCount: 0,
    });
    expect(result.code).toBe("NEEDS_INFO");
    expect(result.icon).toBe("🟠");
  });

  it("UX-03) 비용 정보 부족(sellability UNKNOWN, 원가 미확인) → 🟠 NEEDS_INFO — 참고 계산값이 있어도 대표 판단을 덮어쓰지 않음", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "UNKNOWN", estimatedMarginPercent: null, reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다." },
    });
    expect(result.code).toBe("NEEDS_INFO");
    expect(result.icon).toBe("🟠");
  });

  it("UX-04) 가격 재검토 필요(sellability RED, margin 0 이상~기준 미만) → 🟡 REVIEW_PRICE", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "RED", estimatedMarginPercent: 4.2, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
  });

  it("UX-05) 수익성 부족(sellability RED, margin 음수) → 🔴 HOLD", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "RED", estimatedMarginPercent: -5.3, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
    });
    expect(result.code).toBe("HOLD");
    expect(result.icon).toBe("🔴");
  });

  it("UX-06) 유사상품만 존재(domesticMatched=false, verified=false 후보만 있음) → 대표 판단이 🟢가 되면 안 됨", () => {
    // 국내 매칭 자체가 verified=false뿐이면 summarizeDomesticMarket이
    // sellerCount=0으로 집계한다(run-domestic-price-check.ts STEP 2 — verified
    // 링크만 price_observations에 저장) — 그래서 sellability는 YELLOW다.
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: {
        level: "YELLOW",
        estimatedMarginPercent: null,
        reason: "국내 동일상품을 자동으로 찾지 못했습니다 — 가격 기준을 확정할 수 없어 등록 전 직접 확인이 필요합니다.",
      },
      domesticMatched: false,
      domesticSellerCount: 0,
    });
    expect(result.code).not.toBe("READY");
    expect(result.icon).not.toBe("🟢");
  });

  describe("Priority 1(unifiedDecision.verdict 존재) — sellability보다 우선한다", () => {
    it("판매가 확정 + MAINTAIN + COMPLETE → 🟢 READY, sellability가 RED여도 무시하지 않고 unifiedDecision을 따른다", () => {
      const result = deriveRepresentativeSellerVerdict({
        unifiedDecision: { verdict: "MAINTAIN", dataCompleteness: "COMPLETE", marginPercent: { value: 15, status: "estimated" }, missingComponents: [] },
        sellability: { level: "RED", estimatedMarginPercent: -1, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
      });
      expect(result.code).toBe("READY");
    });

    it("판매가 확정 + MAINTAIN + INCOMPLETE → 🟠 NEEDS_INFO, 누락 비용 항목이 reasons에 포함됨", () => {
      const result = deriveRepresentativeSellerVerdict({
        unifiedDecision: {
          verdict: "MAINTAIN",
          dataCompleteness: "INCOMPLETE",
          marginPercent: { value: 30, status: "incomplete" },
          missingComponents: ["국내 배송원가", "관세"],
        },
        sellability: { level: "GREEN", estimatedMarginPercent: 30, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
      });
      expect(result.code).toBe("NEEDS_INFO");
      expect(result.reasons.some((r) => r.includes("국내 배송원가"))).toBe(true);
    });

    it("판매가 확정 + CONSIDER_LOWER → 🟡 REVIEW_PRICE", () => {
      const result = deriveRepresentativeSellerVerdict({
        unifiedDecision: { verdict: "CONSIDER_LOWER", dataCompleteness: "COMPLETE", marginPercent: { value: 5, status: "estimated" }, missingComponents: [] },
        sellability: { level: "GREEN", estimatedMarginPercent: 30, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
      });
      expect(result.code).toBe("REVIEW_PRICE");
    });

    it("판매가 확정 + MARGIN_RISK → 🔴 HOLD", () => {
      const result = deriveRepresentativeSellerVerdict({
        unifiedDecision: { verdict: "MARGIN_RISK", dataCompleteness: "COMPLETE", marginPercent: { value: -10, status: "estimated" }, missingComponents: [] },
        sellability: { level: "GREEN", estimatedMarginPercent: 30, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
      });
      expect(result.code).toBe("HOLD");
    });
  });
});
