import { describe, expect, it } from "vitest";
import { computePriceDifference, deriveSellerDecisionState, pickBestAcceptableCandidate } from "../seller-decision";

/** P-5(CPO 지시, 2026-08-29) — SD-01~06. PT-01~07(price-truth-fixtures.test.ts)/
 * ST-01~06(comparison-result-status.test.ts)와 마찬가지로, P-4-DECISION-0에서
 * 실측 확인된 실제 데이터를 그대로 재사용한다(합성 데이터 최소화). */

describe("SD-01 — Booty Ghosts Long Sleeve(DT-01, 원본 VERIFIED + 자기 자신 very_high 매칭) → READY_TO_LIST", () => {
  it("실측: sourceVerification VERIFIED_CURRENT(£37) + 자기 자신 very_high/VERIFIED_CURRENT 후보 → 🟢", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "VERIFIED_CURRENT",
      searchState: "RESULTS_FOUND",
      candidates: [
        { matchLevel: "very_high", priceStatus: "VERIFIED_CURRENT" },
        { matchLevel: "medium", priceStatus: "VERIFIED_CURRENT" }, // T-Shirt(£35, PT-02) 후보도 같이 들어옴
      ],
    });
    expect(result.state).toBe("READY_TO_LIST");
  });
});

describe("SD-02 — 유사상품(medium)만 있고 가격은 검증된 경우 → REVIEW_PRICE", () => {
  it("동일상품인지 확실하지 않지만 가격은 확인됨 — '가격 재검토' 대상", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "VERIFIED_CURRENT",
      searchState: "RESULTS_FOUND",
      candidates: [{ matchLevel: "medium", priceStatus: "VERIFIED_CURRENT" }],
    });
    expect(result.state).toBe("REVIEW_PRICE");
  });
});

describe("SD-03 — Misha & Puff Mink(76% 매칭, UNVERIFIED_SEARCH) → NEEDS_RECHECK(REVIEW_PRICE 아님)", () => {
  it("실측: medium 매칭 + 가격 미검증 후보만 있으면, matchLevel과 무관하게 재확인 필요로 판단한다", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "VERIFIED_CURRENT",
      searchState: "RESULTS_FOUND",
      candidates: [{ matchLevel: "medium", priceStatus: "UNVERIFIED_SEARCH" }],
    });
    expect(result.state).toBe("NEEDS_RECHECK");
  });

  it("Hug Hairy Monster(100% 매칭, 검증 시도했으나 실패) 재현 — very_high여도 PRICE_UNAVAILABLE이면 NEEDS_RECHECK", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "NOT_APPLICABLE",
      searchState: "RESULTS_FOUND",
      candidates: [{ matchLevel: "very_high", priceStatus: "PRICE_UNAVAILABLE" }],
    });
    expect(result.state).toBe("NEEDS_RECHECK");
  });
});

describe("SD-04 — Stamp Bloom(검색 결과 0건, 당시 실측) → NEEDS_RECHECK", () => {
  it("원본가는 VERIFIED_CURRENT여도 비교할 후보가 하나도 없으면(NO_RESULTS) 재확인 필요로 본다", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "VERIFIED_CURRENT",
      searchState: "NO_RESULTS",
      candidates: [],
    });
    expect(result.state).toBe("NEEDS_RECHECK");
  });
});

describe("SD-05 — 원본 가격 확인 실패 + 대체할 강한 후보도 없음 → HOLD", () => {
  it("원본도 모르고 비교 후보도 못 믿으면 가장 보수적인 상태(보류)로 판단한다", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "PRICE_UNAVAILABLE",
      searchState: "RESULTS_FOUND",
      candidates: [{ matchLevel: "medium", priceStatus: "VERIFIED_CURRENT" }],
    });
    expect(result.state).toBe("HOLD");
  });

  it("원본 가격 확인 실패여도, 동일상품+가격검증된 강한 후보가 있으면 HOLD로 떨어뜨리지 않는다", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "PRICE_UNAVAILABLE",
      searchState: "RESULTS_FOUND",
      candidates: [{ matchLevel: "very_high", priceStatus: "VERIFIED_CURRENT" }],
    });
    expect(result.state).toBe("READY_TO_LIST");
  });
});

describe("SD-06 — 검색 시스템 자체 오류(ERROR) → HOLD (다른 어떤 조건보다 우선)", () => {
  it("후보나 원본검증 상태와 무관하게 검색 자체가 죽었으면 판단을 보류한다", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "VERIFIED_CURRENT",
      searchState: "ERROR",
      candidates: [{ matchLevel: "very_high", priceStatus: "VERIFIED_CURRENT" }],
    });
    expect(result.state).toBe("HOLD");
  });
});

describe("일부 판매처만 확인됨(PARTIAL_FAILURE/RATE_LIMITED) → NEEDS_RECHECK", () => {
  it("RATE_LIMITED", () => {
    expect(
      deriveSellerDecisionState({ sourceVerificationStatus: "NOT_APPLICABLE", searchState: "RATE_LIMITED", candidates: [] })
        .state,
    ).toBe("NEEDS_RECHECK");
  });
  it("PARTIAL_FAILURE", () => {
    expect(
      deriveSellerDecisionState({ sourceVerificationStatus: "NOT_APPLICABLE", searchState: "PARTIAL_FAILURE", candidates: [] })
        .state,
    ).toBe("NEEDS_RECHECK");
  });
});

describe("matchLevel='low'인 후보는 판단 근거로 쓰지 않는다(N-4.21 70% 경계 원칙과 동일)", () => {
  it("low만 있으면 있으나 마나 — NO_RESULTS와 동일하게 취급된다", () => {
    const result = deriveSellerDecisionState({
      sourceVerificationStatus: "VERIFIED_CURRENT",
      searchState: "NO_RESULTS",
      candidates: [{ matchLevel: "low", priceStatus: "VERIFIED_CURRENT" }],
    });
    expect(result.state).toBe("NEEDS_RECHECK");
  });
});

describe("pickBestAcceptableCandidate — 여러 후보 중 가장 낙관적인 결과를 내는 후보를 고른다", () => {
  it("Booty Ghosts 사례: very_high/VERIFIED 후보가 medium/VERIFIED 후보보다 우선한다", () => {
    const candidates = [
      { matchLevel: "medium" as const, priceStatus: "VERIFIED_CURRENT" as const },
      { matchLevel: "very_high" as const, priceStatus: "VERIFIED_CURRENT" as const },
    ];
    expect(pickBestAcceptableCandidate(candidates)).toBe(candidates[1]);
  });

  it("판단 가능한 후보가 하나도 없으면(전부 low 또는 matchLevel 없음) null", () => {
    expect(pickBestAcceptableCandidate([{ matchLevel: "low" as const }, {}])).toBeNull();
  });
});

describe("computePriceDifference — 원본/비교 대상 둘 다 VERIFIED_CURRENT일 때만 계산", () => {
  const krwRates = { GBP: 1851.8518518518517 };

  it("PT-01(£37, 원본) vs PT-02(£35, 비교 후보) 실측 — 약 -4.9% 차이", () => {
    const result = computePriceDifference(
      { status: "VERIFIED_CURRENT", price: { amount: 37, currency: "GBP" } },
      { status: "VERIFIED_CURRENT", price: { amount: 35, currency: "GBP" } },
      krwRates,
    );
    expect(result.status).toBe("COMPUTED");
    expect(result.originalKrw).toBe(68519);
    expect(result.comparisonKrw).toBe(64815);
    expect(result.diffKrw).toBe(-3704);
    expect(result.diffPercent).toBeCloseTo(-5.4, 1);
  });

  it("원본이 UNVERIFIED_SEARCH면(검증 안 됨) 비교 대상이 확실해도 계산하지 않는다", () => {
    const result = computePriceDifference(
      { status: "UNVERIFIED_SEARCH", price: { amount: 37, currency: "GBP" } },
      { status: "VERIFIED_CURRENT", price: { amount: 35, currency: "GBP" } },
      krwRates,
    );
    expect(result.status).toBe("NOT_COMPUTABLE");
  });

  it("비교 대상이 PRICE_UNAVAILABLE이면 원본이 확실해도 계산하지 않는다(Hug Hairy Monster 재현)", () => {
    const result = computePriceDifference(
      { status: "VERIFIED_CURRENT", price: { amount: 62, currency: "GBP" } },
      { status: "PRICE_UNAVAILABLE", price: { amount: 37, currency: "GBP" } },
      krwRates,
    );
    expect(result.status).toBe("NOT_COMPUTABLE");
  });

  it("환율 정보가 없으면(krwRates=null) 둘 다 검증되어도 계산하지 않는다 — 추측 금지", () => {
    const result = computePriceDifference(
      { status: "VERIFIED_CURRENT", price: { amount: 37, currency: "GBP" } },
      { status: "VERIFIED_CURRENT", price: { amount: 35, currency: "GBP" } },
      null,
    );
    expect(result.status).toBe("NOT_COMPUTABLE");
  });
});
