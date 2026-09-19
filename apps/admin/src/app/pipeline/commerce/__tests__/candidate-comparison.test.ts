import { describe, expect, it } from "vitest";
import { selectVisualCheckCandidates, type CandidateWithShop } from "../CandidateComparison";

/**
 * P0-A.29-C(CEO 지시, 2026-09-19) — 육안 확인 «노출 필터».
 *
 * 🔴 이것은 동일상품 «판정» 이 아니다. 자동 가격비교는 여전히 priceTierFromLink 가
 *    정하고, 여기서 남긴다고 가격에 들어가지 않는다. 이 파일이 재는 것은
 *    「사람에게 무엇을 보여줄 것인가」뿐이다.
 */

const row = (over: Partial<CandidateWithShop["candidate"]> & { shopName?: string }): CandidateWithShop => ({
  shopName: over.shopName ?? "포레포레",
  candidate: {
    title: over.title ?? "테스트 상품",
    url: over.url ?? "https://example.com/p",
    price: over.price ?? { amount: 10000, currency: "KRW" },
    // 🔴 ?? 를 쓰면 «일부러 넘긴 null» 이 기본값으로 덮인다 — 그러면 「이미지 없음」
    //    케이스를 영원히 못 잰다. 키가 있는지로 가른다.
    imageUrl: "imageUrl" in over ? (over.imageUrl ?? null) : "https://example.com/i.jpg",
    matchTruth: over.matchTruth,
    crossSellerVerdict: over.crossSellerVerdict,
    matchReasons: over.matchReasons,
    confidence: over.confidence,
    visionScore: over.visionScore,
  },
});

describe("🔴 제외 — 반증이 있는 후보는 눈앞에 두지 않는다", () => {
  for (const truth of ["CONFLICT", "INSUFFICIENT_EVIDENCE"] as const) {
    it(`matchTruth=${truth} 는 노출하지 않는다`, () => {
      expect(selectVisualCheckCandidates([row({ matchTruth: truth })])).toHaveLength(0);
    });
  }

  it("crossSellerVerdict=CONFLICT 도 노출하지 않는다", () => {
    expect(selectVisualCheckCandidates([row({ crossSellerVerdict: "CONFLICT" })])).toHaveLength(0);
  });

  it("🔴 반증이 하나라도 있으면 다른 근거가 강해도 빠진다", () => {
    // 품번이 맞아도 교차판매처가 반증하면 사람에게 「유력」이라고 내밀지 않는다.
    const out = selectVisualCheckCandidates([row({ matchTruth: "EXACT_IDENTIFIER", crossSellerVerdict: "CONFLICT" })]);
    expect(out).toHaveLength(0);
  });
});

describe("우선순위 — 강한 근거가 위로", () => {
  it("EXACT/STRONG/SAME 이 PRESUMED_SAME 보다 앞선다", () => {
    const out = selectVisualCheckCandidates([
      row({ title: "약함", crossSellerVerdict: "PRESUMED_SAME" }),
      row({ title: "강함", matchTruth: "EXACT_IDENTIFIER" }),
    ]);
    expect(out.map((r) => r.candidate.title)).toEqual(["강함", "약함"]);
  });

  it("같은 등급이면 confidence 가 높은 쪽이 앞선다", () => {
    const out = selectVisualCheckCandidates([
      row({ title: "낮음", crossSellerVerdict: "PRESUMED_SAME", confidence: 0.6 }),
      row({ title: "높음", crossSellerVerdict: "PRESUMED_SAME", confidence: 0.9 }),
    ]);
    expect(out.map((r) => r.candidate.title)).toEqual(["높음", "낮음"]);
  });

  it("근거가 약해도(등급 없음) «제외되지는» 않는다 — 판정이 아니라 노출이다", () => {
    expect(selectVisualCheckCandidates([row({})])).toHaveLength(1);
  });
});

describe("🔴 빈 상태 — 만들어내지 않는다", () => {
  it("후보 0건이면 0건", () => {
    expect(selectVisualCheckCandidates([])).toHaveLength(0);
  });

  it("이미지가 없어도 후보 자체는 남는다 — 이미지 칸만 빈다", () => {
    const out = selectVisualCheckCandidates([row({ imageUrl: null, matchTruth: "EXACT_IDENTIFIER" })]);
    expect(out).toHaveLength(1);
    expect(out[0].candidate.imageUrl).toBeNull();
  });
});

describe("🔴 Vision 점수를 지어내지 않는다", () => {
  it("visionScore 가 없으면 undefined 그대로 — 0 으로 바뀌지 않는다", () => {
    const out = selectVisualCheckCandidates([row({ matchTruth: "EXACT_IDENTIFIER" })]);
    expect(out[0].candidate.visionScore).toBeUndefined();
  });

  it("0 점이 실제로 관측됐으면 0 이 유지된다 — «없음» 과 구분된다", () => {
    const out = selectVisualCheckCandidates([row({ matchTruth: "EXACT_IDENTIFIER", visionScore: 0 })]);
    expect(out[0].candidate.visionScore).toBe(0);
  });
});
