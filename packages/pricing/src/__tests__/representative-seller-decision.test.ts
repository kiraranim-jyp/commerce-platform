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

    it("P-25 Sprint 8(CPO 지시, 2026-09-02) — MARKET_OPPORTUNITY는 더 이상 🟢 판매 추천으로 합쳐지지 않는다(국내 시장 데이터 자체가 없는데 자동 🟢 확정 금지)", () => {
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
      // 내부 판정(🟣 시장 진입 기회)은 그대로 유지된다 — 재계산 없음.
      expect(verdict.icon).toBe("🟣");
      const facing = toSellerFacingVerdict(verdict);
      expect(facing.code).toBe("CONDITIONAL");
      expect(facing.icon).toBe("🟡");
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
    // P-23(CPO 지시, 2026-09-02)에서 code 자체도 READY→REVIEW_MATCH로
    // 낮췄다 — 자세한 code/icon 회귀는 아래 "P-23" describe에서 고정한다.
    // 여기서는 P-22가 고정한 "동일상품 단정 금지" 문구만 재확인한다.
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
    expect(result.description).not.toContain("동일상품을 확인");
  });
});

/**
 * P-23(CPO 지시, 2026-09-02) — P-22는 문구(description/reasons)만 basis별로
 * 갈랐지만 코드/아이콘(🟢 READY)은 그대로 두었다. CPO 지적: COMPARISON 기준
 * 으로도 마진만 맞으면 여전히 🟢 "판매 추천"으로 보인다 — "동일상품 검증
 * 완료"와 "시장 참고가만 있음"의 신뢰도 차이를 화면이 구분하지 않는다.
 * basis!==EXACT면 READY로 확정하지 않고 REVIEW_MATCH(🟡)로 낮추고,
 * 3단계 압축에서도 RECOMMENDED가 아닌 CONDITIONAL로 분류되는지 고정한다.
 */
describe("P-23: basis!==EXACT면 READY가 아니라 REVIEW_MATCH(🟡)로 낮춘다", () => {
  const base: RepresentativeVerdictInput = {
    unifiedDecision: null,
    sellability: { level: "GREEN", estimatedMarginPercent: 18.5, reason: "..." },
    domesticMatched: true,
    domesticSellerCount: 1,
    domesticBasis: "EXACT",
  };

  it("basis=EXACT + 마진 정상 → 그대로 READY(🟢)", () => {
    const result = deriveRepresentativeSellerVerdict({ ...base, domesticBasis: "EXACT" });
    expect(result.code).toBe("READY");
    expect(result.icon).toBe("🟢");
  });

  it("basis=COMPARISON(Bobo Choses) + 마진 정상 → READY 아니라 REVIEW_MATCH(🟡)", () => {
    const result = deriveRepresentativeSellerVerdict({ ...base, domesticBasis: "COMPARISON" });
    expect(result.code).toBe("REVIEW_MATCH");
    expect(result.icon).toBe("🟡");
    expect(result.description).toContain("비교상품(참고용)");
    expect(result.description).not.toContain("동일상품을 확인");
  });

  it("basis=NONE(도메스틱 매칭 자체 없음) + 마진 정상 → REVIEW_MATCH, '비교상품'이라는 존재하지 않는 데이터를 언급하지 않는다", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      domesticMatched: false,
      domesticSellerCount: 0,
      domesticBasis: "NONE",
    });
    expect(result.code).toBe("REVIEW_MATCH");
    expect(result.icon).toBe("🟡");
    expect(result.description).not.toContain("비교상품");
    expect(result.description).not.toContain("동일상품을 확인");
  });

  it("Priority 1(unifiedDecision 경로) basis=COMPARISON → 마진 healthy(MAINTAIN)여도 REVIEW_MATCH로 낮춘다", () => {
    const result = deriveRepresentativeSellerVerdict({
      unifiedDecision: { verdict: "MAINTAIN", dataCompleteness: "COMPLETE", marginPercent: { value: 18.5, status: "estimated" }, missingComponents: [] },
      sellability: { level: "GREEN", estimatedMarginPercent: 18.5, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "COMPARISON",
    });
    expect(result.code).toBe("REVIEW_MATCH");
    expect(result.icon).toBe("🟡");
  });

  it("toSellerFacingVerdict: REVIEW_MATCH는 RECOMMENDED가 아니라 CONDITIONAL(🟡 조건부 판매)로 압축된다", () => {
    const verdict = deriveRepresentativeSellerVerdict({ ...base, domesticBasis: "COMPARISON" });
    const facing = toSellerFacingVerdict(verdict);
    expect(facing.code).toBe("CONDITIONAL");
    expect(facing.icon).toBe("🟡");
    expect(facing.title).toBe("조건부 판매");
  });

  it("toSellerFacingVerdict: basis=EXACT는 여전히 RECOMMENDED(🟢 판매 추천)로 유지된다(회귀 확인)", () => {
    const verdict = deriveRepresentativeSellerVerdict({ ...base, domesticBasis: "EXACT" });
    const facing = toSellerFacingVerdict(verdict);
    expect(facing.code).toBe("RECOMMENDED");
    expect(facing.icon).toBe("🟢");
  });
});

/**
 * P-24 Sprint 5-7(CPO 지시, 2026-09-02) — 실측(PèPè) 잔여 모순: basis=EXACT +
 * sellability GREEN이라 READY(🟢)까지는 P-23까지의 로직으로도 나오지만, 실제
 * "추천 판매가"(computePriceRecommendation, 착지원가+최소마진 기준)는
 * ₩269,333으로 국내 최저가 ₩258,000보다 비쌌다 — 마진 최소기준을 지키는
 * 순간 가격 경쟁력을 잃는데도 헤드라인은 "판매 추천"이라고 말했다.
 * recommendedPrice와 domesticLowestPriceKrw를 비교해서 이 경우만 🟡로
 * 낮추는지 고정한다.
 */
describe("P-24: 추천 판매가가 국내 최저가보다 비싸면 READY(🟢)를 REVIEW_PRICE(🟡)로 낮춘다", () => {
  const base: RepresentativeVerdictInput = {
    unifiedDecision: null,
    sellability: { level: "GREEN", estimatedMarginPercent: 10.7, reason: "..." },
    domesticMatched: true,
    domesticSellerCount: 1,
    domesticBasis: "EXACT",
  };

  it("실측 재현 — 추천가 ₩269,333 > 국내 최저가 ₩258,000 → READY가 아니라 REVIEW_PRICE(🟡), 이유에 두 가격이 모두 나온다", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 269333 },
      domesticLowestPriceKrw: 258000,
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
    expect(result.reasons.some((r) => r.includes("258,000") && r.includes("269,333"))).toBe(true);
  });

  it("추천가가 국내 최저가 이하(정상 CASE A) → 여전히 READY(🟢), 다운그레이드 안 됨", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 255420 },
      domesticLowestPriceKrw: 258000,
    });
    expect(result.code).toBe("READY");
    expect(result.icon).toBe("🟢");
  });

  it("recommendation/domesticLowestPriceKrw 둘 다 없으면(P-24 이전 호출부) 기존 동작 그대로 READY", () => {
    const result = deriveRepresentativeSellerVerdict({ ...base });
    expect(result.code).toBe("READY");
    expect(result.icon).toBe("🟢");
  });

  it("MARKET_OPPORTUNITY(🟣, 국내 매칭 자체 없음)도 같은 가드를 통과한다 — 원래 domesticLowestPriceKrw가 없어 다운그레이드되지 않음", () => {
    const result = deriveRepresentativeSellerVerdict({
      unifiedDecision: null,
      sellability: { level: "YELLOW", estimatedMarginPercent: null, reason: "..." },
      domesticMatched: false,
      domesticSellerCount: 0,
      domesticBasis: "NONE",
      recommendation: { recommendedPrice: 999999 },
      domesticLowestPriceKrw: null,
    });
    expect(result.code).toBe("MARKET_OPPORTUNITY");
  });

  it("Priority 1(unifiedDecision 경로, 판매가 확정) READY도 같은 가드가 적용된다", () => {
    const result = deriveRepresentativeSellerVerdict({
      unifiedDecision: { verdict: "MAINTAIN", dataCompleteness: "COMPLETE", marginPercent: { value: 15, status: "estimated" }, missingComponents: [] },
      sellability: { level: "RED", estimatedMarginPercent: -1, reason: "..." },
      domesticMatched: true,
      domesticSellerCount: 1,
      domesticBasis: "EXACT",
      recommendation: { recommendedPrice: 269333 },
      domesticLowestPriceKrw: 258000,
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
  });
});

/**
 * P-25 Sprint 4/6/7(CPO 지시, 2026-09-02) — CASE A/B/C 3단계를 그대로 고정한다.
 * P-24는 recommendedPrice와 domesticLowestPriceKrw만 비교해 CASE A/B를
 * 구분했지만, "시장가로 팔면 원가도 못 건지는" CASE C(landedCostKrw > 시장
 * 최저가)는 아직 구분하지 않았다 — 여전히 🟡였다. landedCostKrw(순수 착지원가,
 * 마진 0%)를 추가로 비교해 이 경우만 🔴로 낮춘다.
 */
describe("P-25 Sprint 4/6/7: CASE A/B/C — landedCostKrw까지 반영한 3단계 판정", () => {
  const base: RepresentativeVerdictInput = {
    unifiedDecision: null,
    sellability: { level: "GREEN", estimatedMarginPercent: 10.7, reason: "..." },
    domesticMatched: true,
    domesticSellerCount: 1,
    domesticBasis: "EXACT",
  };

  it("CASE A — 국내 최저가 ≥ 추천가 → 🟢 READY(회귀 확인, landedCostKrw를 줘도 영향 없음)", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 255420 },
      domesticLowestPriceKrw: 258000,
      landedCostKrw: 242400,
    });
    expect(result.code).toBe("READY");
    expect(result.icon).toBe("🟢");
  });

  it("CASE B — 국내 최저가 < 추천가지만 착지원가보다는 높음(시장가에 팔아도 손해는 아님) → 🟡 REVIEW_PRICE(실측 PèPè 재확인)", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 269333 },
      domesticLowestPriceKrw: 258000,
      landedCostKrw: 242400,
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
  });

  it("CASE C — 국내 최저가 < 착지원가(0% 마진도 못 건짐) → 🔴 HOLD, 이유에 손해라는 사실이 명시된다", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 269333 },
      domesticLowestPriceKrw: 200000,
      landedCostKrw: 242400,
    });
    expect(result.code).toBe("HOLD");
    expect(result.icon).toBe("🔴");
    expect(result.reasons.some((r) => r.includes("200,000") && r.includes("242,400") && r.includes("손해"))).toBe(true);
  });

  it("CASE C 경계값 — 국내 최저가 == 착지원가(정확히 0% 마진, 손해는 아님) → CASE B와 동일하게 🟡", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 269333 },
      domesticLowestPriceKrw: 242400,
      landedCostKrw: 242400,
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
  });

  it("landedCostKrw가 없으면(구 호출부) CASE C 판정 없이 기존 CASE B 로직만 적용된다", () => {
    const result = deriveRepresentativeSellerVerdict({
      ...base,
      recommendation: { recommendedPrice: 269333 },
      domesticLowestPriceKrw: 50000, // CASE C 조건(landedCostKrw보다 낮음)이지만 landedCostKrw 자체가 없음
    });
    expect(result.code).toBe("REVIEW_PRICE");
    expect(result.icon).toBe("🟡");
  });
});
