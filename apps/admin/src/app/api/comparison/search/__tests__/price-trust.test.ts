import { describe, expect, it } from "vitest";
import {
  selectCandidatesForDetailConfirmation,
  withConfidence,
  type ComparisonCandidate,
  type ComparisonQuery,
} from "@commerce/crawler";

/**
 * P-4-DATA-4(CPO 지시, 2026-08-29) 회귀 테스트 — 이번 CEO 실사용 테스트에서 실측
 * 확인된 3건의 실제 사고를 그대로 fixture로 고정한다. 셋 다 "검색 인덱스 가격이
 * 검증 없이 화면에 노출될 뻔했다"는 같은 근본원인을 가진 별개 경로(medium 등급
 * 제외 vs 상세검증 조용한 실패)에서 발생했다 — 이 테스트들이 통과하지 않으면
 * 같은 사고가 재발할 수 있다는 뜻이다.
 */

function candidate(overrides: Partial<ComparisonCandidate>): ComparisonCandidate {
  return {
    title: "",
    url: "https://example.com/products/x",
    price: null,
    imageUrl: null,
    confidence: 0,
    priceStatus: "UNVERIFIED_SEARCH",
    verificationAttempted: false,
    ...overrides,
  };
}

describe("P-4-DATA-4 STEP 2 — selectCandidatesForDetailConfirmation medium 등급 포함", () => {
  it("Booty Ghosts 실제 사례: very_high 1건 + medium 1건 → 상한(2) 내에서 둘 다 검증 대상", () => {
    const candidates = [
      candidate({ title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses", matchLevel: "very_high", confidence: 1 }),
      candidate({ title: "Booty Ghosts T-Shirt by Bobo Choses", matchLevel: "medium", confidence: 0.75 }),
    ];
    const indexes = selectCandidatesForDetailConfirmation(candidates);
    expect(indexes).toEqual([0, 1]);
  });

  it("Misha & Puff Mink 실제 사례: very_high 1건 + medium 3건 → 상한(2) 내에서 very_high 우선, medium 상위 1건만", () => {
    const candidates = [
      candidate({ title: "...Antique Rose by Misha & Puff", matchLevel: "very_high", confidence: 1 }),
      candidate({ title: "Ruffle Cardigan...", matchLevel: "medium", confidence: 0.76 }),
      candidate({ title: "...in Mink by Misha & Puff", matchLevel: "medium", confidence: 0.76 }),
      candidate({ title: "Baby Zig Zag Cardigan...", matchLevel: "medium", confidence: 0.72 }),
    ];
    const indexes = selectCandidatesForDetailConfirmation(candidates);
    expect(indexes).toHaveLength(2);
    expect(indexes[0]).toBe(0); // very_high가 항상 최우선
  });

  it("low 등급은 여전히 검증 대상에서 제외된다(전수조사 F3 방지 목적이 아니라 비용 통제 목적)", () => {
    const candidates = [candidate({ matchLevel: "low", confidence: 0.5 })];
    expect(selectCandidatesForDetailConfirmation(candidates)).toEqual([]);
  });

  it("very_high가 2건 이상이면 medium은 상한 초과로 제외된다(무제한 호출 증가 금지 원칙 유지)", () => {
    const candidates = [
      candidate({ matchLevel: "very_high", confidence: 1 }),
      candidate({ matchLevel: "very_high", confidence: 0.98 }),
      candidate({ matchLevel: "medium", confidence: 0.8 }),
    ];
    const indexes = selectCandidatesForDetailConfirmation(candidates);
    expect(indexes).toEqual([0, 1]);
  });
});

describe("P-4-DATA-4 STEP 1 — withConfidence의 priceStatus 기본값 분리(원칙 2: 매칭신뢰도≠가격신뢰도)", () => {
  const query: ComparisonQuery = { title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses", brand: "Bobo Choses" };

  it("priceSource가 아직 없는 후보(shopify-suggest 원본)는 confidence가 100%여도 UNVERIFIED_SEARCH로 시작한다", () => {
    const candidates = [
      candidate({ title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses", price: { amount: 37, currency: "GBP" } }),
    ];
    const [scored] = withConfidence(query, candidates);
    expect(scored.matchLevel).toBe("very_high");
    expect(scored.priceStatus).toBe("UNVERIFIED_SEARCH");
    expect(scored.verificationAttempted).toBe(false);
  });

  it("priceSource='detail'이 이미 설정된 후보(bobochoses.com 국내 검색처럼 검색 자체가 상세조회인 경우)만 VERIFIED_CURRENT로 시작한다", () => {
    const candidates = [
      candidate({
        title: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses",
        price: { amount: 37, currency: "GBP" },
        priceSource: "detail",
      }),
    ];
    const [scored] = withConfidence(query, candidates);
    expect(scored.priceStatus).toBe("VERIFIED_CURRENT");
    expect(scored.verificationAttempted).toBe(true);
  });
});
