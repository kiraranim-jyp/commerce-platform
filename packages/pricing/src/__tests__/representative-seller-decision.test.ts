import { describe, expect, it } from "vitest";
import {
  deriveRepresentativeSellerVerdict,
  toSellerFacingVerdict,
  type RepresentativeVerdictInput,
} from "../representative-seller-decision";

/**
 * P-8(2026-08-30) STEP 8이 요구한 UX-01~06을 그대로 옮긴다. unifiedDecision/
 * sellability는 이미 검증된 기존 엔진 결과를 흉내낸 입력일 뿐, 이 테스트는
 * "그 결과를 대표 판단 1개로 어떻게 압축하는가"만 검증한다.
 *
 * P-9-B(2026-08-30) — "국내 동일상품 없음"(YELLOW)과 "비용 정보 없음"(UNKNOWN)을
 * 더 이상 같은 NEEDS_INFO로 뭉뚱그리지 않는다. YELLOW → MARKET_OPPORTUNITY로
 * 갈라지면서 UX-02/UX-06의 기대값이 바뀌었다 — 이 변경은 P-9-B의 명시적 지시다.
 */
describe("P-8/P-9-B: deriveRepresentativeSellerVerdict", () => {
  const base: RepresentativeVerdictInput = {
    unifiedDecision: null,
    sellability: { level: "UNKNOWN", estimatedMarginPercent: null, reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다." },
    domesticMatched: false,
    domesticSellerCount: 0,
    domesticBasis: "NONE",
  };

  it("UX-01) 국내 검증 가격 존재 + 정상 수익성(sellability GREEN) → 🟢 READY, 이유 2개 이상", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "GREEN", estimatedMarginPercent: 10.1, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "EXACT",
    });
    expect(result.code).toBe("READY");
    expect(result.icon).toBe("🟢");
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    expect(result.reasons.some((r) => r.includes("국내 동일상품"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("10.1"))).toBe(true);
  });

  it("UX-02/UX-C3) 국내 가격 없음 + 비용 정상(sellability YELLOW) → 🟣 MARKET_OPPORTUNITY(P-9-B), '판단 불가'로 끝나지 않음", () => {
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
    expect(result.code).toBe("MARKET_OPPORTUNITY");
    expect(result.icon).toBe("🟣");
    // "독점 상품입니다"처럼 단정하지 않는다 — "확인하지 못했다"는 사실만 말한다.
    expect(result.title).not.toContain("독점");
    expect(result.reasons.some((r) => r.includes("확인하지 못했습니다"))).toBe(true);
  });

  it("UX-03/UX-C4) 비용 정보 부족(sellability UNKNOWN, 원가 미확인) → 🟠 NEEDS_INFO — 참고 계산값이 있어도 대표 판단을 덮어쓰지 않음", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "UNKNOWN", estimatedMarginPercent: null, reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다." },
    });
    expect(result.code).toBe("NEEDS_INFO");
    expect(result.icon).toBe("🟠");
  });

  it("UX-04/UX-C1) 가격 재검토 필요(sellability RED, margin 0 이상~기준 미만) → 🟡 REVIEW_PRICE", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "RED", estimatedMarginPercent: 4.2, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "EXACT",
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
  });

  it("UX-05/UX-C2) 수익성 부족(sellability RED, margin 음수) → 🔴 HOLD", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      sellability: { level: "RED", estimatedMarginPercent: -5.3, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "EXACT",
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
        domesticBasis: "EXACT",
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
        domesticBasis: "EXACT",
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
        domesticBasis: "EXACT",
      });
      expect(result.code).toBe("REVIEW_PRICE");
    });

    it("판매가 확정 + MARGIN_RISK → 🔴 HOLD", () => {
      const result = deriveRepresentativeSellerVerdict({
        unifiedDecision: { verdict: "MARGIN_RISK", dataCompleteness: "COMPLETE", marginPercent: { value: -10, status: "estimated" }, missingComponents: [] },
        sellability: { level: "GREEN", estimatedMarginPercent: 30, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      expect(result.code).toBe("HOLD");
    });
  });

  /**
   * P-9 STEP 7(대표님 지시, 2026-08-30) — Case C(국내가격 있음+마진 부족) 실제
   * 프로덕션 사례를 못 찾아서, 합성 fixture로 "대표 판단 로직의 깨지지 않는
   * 계약"을 고정한다. UX-C1/C2는 위 UX-04/UX-05와 동일 로직 경로를 다른
   * 각도(정확히 CPO가 지정한 margin 5%/-5%)로 한 번 더 고정한다.
   */
  describe("P-9 STEP 7: 합성 fixture UX-C1~C4", () => {
    it("UX-C1) 국내 동일상품 있음 + 예상 마진 5%(목표 10% 미만) → 🟡 가격 전략 재검토", () => {
      const result = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "RED", estimatedMarginPercent: 5, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      expect(result.code).toBe("REVIEW_PRICE");
      expect(result.title).toBe("가격 전략 재검토 추천");
    });

    it("UX-C2) 국내 동일상품 있음 + 예상 마진 -5% → 🔴 판매 조건 재검토", () => {
      const result = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "RED", estimatedMarginPercent: -5, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      expect(result.code).toBe("HOLD");
      expect(result.title).toBe("판매 조건 재검토 필요");
    });

    it("UX-C3) 국내 동일상품 없음 + 비용 계산 가능 → 🟣 시장 진입 기회", () => {
      const result = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "YELLOW", estimatedMarginPercent: null, reason: "..." },
        domesticMatched: false,
        domesticSellerCount: 0,
      });
      expect(result.code).toBe("MARKET_OPPORTUNITY");
      expect(result.title).toBe("시장 진입 기회");
    });

    it("UX-C4) 국내 동일상품 없음 + 비용 정보 부족 → 🟠 추가 정보 필요", () => {
      const result = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "UNKNOWN", estimatedMarginPercent: null, reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다." },
        domesticMatched: false,
        domesticSellerCount: 0,
      });
      expect(result.code).toBe("NEEDS_INFO");
      expect(result.title).toBe("추가 정보가 필요합니다");
    });
  });

  /**
   * P-19-B Sprint 8/10(CPO 지시, 2026-09-02) — "판매자에게 보여주는 최종 결론은
   * 무조건 3단계"의 매핑 계약을 고정한다. T8/T9/T10에 해당한다.
   */
  describe("P-19-B Sprint 8: toSellerFacingVerdict — 5단계 → 3단계 압축", () => {
    it("T8) READY → 🟢 판매 추천", () => {
      const verdict = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "GREEN", estimatedMarginPercent: 24, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.code).toBe("RECOMMENDED");
      expect(facing.icon).toBe("🟢");
      expect(facing.title).toBe("판매 추천");
    });

    it("MARKET_OPPORTUNITY도 READY와 동일하게 🟢 판매 추천으로 합쳐진다", () => {
      const verdict = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: {
          level: "YELLOW",
          estimatedMarginPercent: null,
          reason: "국내 동일상품을 자동으로 찾지 못했습니다 — 가격 기준을 확정할 수 없어 등록 전 직접 확인이 필요합니다.",
        },
        domesticMatched: false,
        domesticSellerCount: 0,
      });
      expect(verdict.code).toBe("MARKET_OPPORTUNITY");
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.code).toBe("RECOMMENDED");
      expect(facing.icon).toBe("🟢");
    });

    it("T9) REVIEW_PRICE → 🟡 조건부 판매", () => {
      const verdict = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "RED", estimatedMarginPercent: 4.2, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.code).toBe("CONDITIONAL");
      expect(facing.icon).toBe("🟡");
      expect(facing.title).toBe("조건부 판매");
    });

    it("NEEDS_INFO도 REVIEW_PRICE와 동일하게 🟡 조건부 판매로 합쳐진다", () => {
      const verdict = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "UNKNOWN", estimatedMarginPercent: null, reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다." },
      });
      expect(verdict.code).toBe("NEEDS_INFO");
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.code).toBe("CONDITIONAL");
      expect(facing.icon).toBe("🟡");
    });

    it("T10) HOLD → 🔴 판매 비추천", () => {
      const verdict = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "RED", estimatedMarginPercent: -5.3, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.code).toBe("NOT_RECOMMENDED");
      expect(facing.icon).toBe("🔴");
      expect(facing.title).toBe("판매 비추천");
    });

    it("reasons는 재계산 없이 representativeVerdict.reasons를 그대로 옮긴다", () => {
      const verdict = deriveRepresentativeSellerVerdict({
        ...base,
        sellability: { level: "GREEN", estimatedMarginPercent: 24, reason: "..." },
        domesticMatched: true,
        domesticSellerCount: 1,
        domesticBasis: "EXACT",
      });
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.reasons).toEqual(verdict.reasons);
    });
  });
});

/**
 * P-22(CPO 지시, 2026-09-02) — 실제 Bobo Choses 프로덕션 데이터(COMPARISON만
 * 존재, EXACT 없음)에서 발견된 P1 버그: domesticMatched만 보고 "동일상품"이라고
 * 말해서, 실제로는 비교상품(참고용) 가격인데도 화면 문구가 동일상품 가격을
 * 확인한 것처럼 나왔다. domesticBasis(EXACT/COMPARISON/NONE)를 반영해 문구가
 * 갈라지는지 고정한다.
 */
describe("P-22: domesticBasis에 따라 '동일상품'/'비교상품' 문구가 갈라진다", () => {
  const base: RepresentativeVerdictInput = {
    unifiedDecision: null,
    sellability: { level: "GREEN", estimatedMarginPercent: 18.5, reason: "..." },
    domesticMatched: true,
    domesticSellerCount: 1,
    domesticBasis: "EXACT",
  };

  it("basis=EXACT → 대표 판단 문구가 '동일상품'을 그대로 말한다", () => {
    const result = deriveRepresentativeSellerVerdict({ ...base, domesticBasis: "EXACT" });
    expect(result.code).toBe("READY");
    expect(result.description).toContain("동일상품");
    expect(result.reasons.some((r) => r.includes("동일상품") && !r.includes("비교상품"))).toBe(true);
  });

  it("basis=COMPARISON(Bobo Choses 실측 재현) → '동일상품'이라고 단정하지 않고 '비교상품(참고용)'으로 명시한다", () => {
    const result = deriveRepresentativeSellerVerdict({ ...base, domesticBasis: "COMPARISON" });
    expect(result.code).toBe("READY");
    expect(result.description).not.toContain("동일상품을 확인");
    expect(result.reasons.some((r) => r.includes("비교상품"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("동일상품") && !r.includes("확인되지 않음"))).toBe(false);
  });

  it("Priority 1(unifiedDecision 경로)도 basis=COMPARISON이면 '동일상품 확정' 문구를 쓰지 않는다", () => {
    const result = deriveRepresentativeSellerVerdict({
      unifiedDecision: { verdict: "MAINTAIN", dataCompleteness: "COMPLETE", marginPercent: { value: 18.5, status: "estimated" }, missingComponents: [] },
      sellability: { level: "GREEN", estimatedMarginPercent: 18.5, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "COMPARISON",
    });
    expect(result.code).toBe("READY");
    expect(result.description).not.toContain("동일상품을 확인");
  });
});
