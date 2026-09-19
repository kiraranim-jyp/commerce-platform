import { describe, expect, it } from "vitest";
import { selectVisualCheckCandidates, type CandidateWithShop } from "../CandidateComparison";
import { domesticMatchDisplay, overseasMatchDisplay } from "../match-display";

/**
 * P0-A.29-D Golden UX(CEO 지시, 2026-09-19) — 사장님이 실제로 테스트한 상품을
 * 그대로 고정한다.
 *
 *   원상품   junioredition.com  Lulu T Bar Shoes in Tobacco by Pèpè
 *   국내     rulii 5건 · foretforet 3건  →  동일상품 «0건»
 *   해외     동일상품 1 · 동일 모델 색상 다름 1 · 나머지 전부 다른 상품
 *
 * 사고 당시 화면은 국내에 「동일상품 유력 후보 5건」을 가격까지 달아 띄웠다.
 * 판정기는 「동일상품 없음」이라고 말하고 있었는데도.
 *
 * 🔴 이 파일은 «판정» 을 재지 않는다. 등급은 기존 domesticMatchDisplay /
 *    overseasMatchDisplay 가 매기고, 여기서는 그 등급 중 무엇이 «육안 확인
 *    카드에» 오르는지만 잰다.
 */

const row = (tier: CandidateWithShop["tier"], over: Partial<CandidateWithShop["candidate"]> = {}): CandidateWithShop => ({
  shopName: "테스트샵",
  tier,
  candidate: {
    title: over.title ?? "테스트 상품",
    url: over.url ?? "https://example.com/p",
    price: over.price ?? { amount: 10000, currency: "KRW" },
    imageUrl: "imageUrl" in over ? (over.imageUrl ?? null) : "https://example.com/i.jpg",
    priceStatus: over.priceStatus,
    matchReasons: over.matchReasons,
    visionScore: over.visionScore,
  },
});

describe("🔴 국내 — 동일상품이 0건이면 카드도 0건이다", () => {
  /** 사고 재현: rulii 5 + foretforet 3 이 전부 동일상품이 «아니었다». */
  const 사장님_국내_8건 = [
    ...Array.from({ length: 5 }, () => domesticMatchDisplay("SIMILAR").tier),
    ...Array.from({ length: 3 }, () => domesticMatchDisplay("INSUFFICIENT_EVIDENCE").tier),
  ].map((tier) => row(tier));

  it("SIMILAR 5건 + INSUFFICIENT_EVIDENCE 3건 → 카드 0건", () => {
    expect(selectVisualCheckCandidates(사장님_국내_8건)).toHaveLength(0);
  });

  it("🔴 따라서 가격이 달린 후보도 0건이다 — 이게 사고의 본질이었다", () => {
    const shown = selectVisualCheckCandidates(사장님_국내_8건);
    expect(shown.filter((r) => r.candidate.price)).toHaveLength(0);
  });

  it("TEXT_CONFIRMED(🟡 동일상품 추정)도 육안 확인 카드에는 오르지 않는다", () => {
    expect(selectVisualCheckCandidates([row(domesticMatchDisplay("TEXT_CONFIRMED").tier)])).toHaveLength(0);
  });

  it("CONFLICT 는 당연히 오르지 않는다", () => {
    expect(selectVisualCheckCandidates([row(domesticMatchDisplay("CONFLICT").tier)])).toHaveLength(0);
  });

  for (const truth of ["EXACT_IDENTIFIER", "STRONG_IDENTIFIER"] as const) {
    it(`${truth} → 🟢 동일상품으로 카드에 오른다`, () => {
      const out = selectVisualCheckCandidates([row(domesticMatchDisplay(truth).tier)]);
      expect(out).toHaveLength(1);
      expect(out[0].tier).toBe("SAME");
    });
  }
});

describe("해외 — 두 종류«만» 오른다", () => {
  const 사장님_해외 = [
    row(overseasMatchDisplay("SIMILAR").tier, { title: "다른 상품 A" }),
    row(overseasMatchDisplay("SAME_MODEL_VARIANT").tier, { title: "색상만 다름" }),
    row(overseasMatchDisplay("VERY_SIMILAR").tier, { title: "다른 상품 B" }),
    row(overseasMatchDisplay("EXACT_PRODUCT").tier, { title: "동일상품" }),
    row(overseasMatchDisplay("CONFLICT").tier, { title: "다른 상품 C" }),
    row(overseasMatchDisplay("INSUFFICIENT_EVIDENCE").tier, { title: "다른 상품 D" }),
  ];

  it("🟢 동일상품 1건 + 🔵 동일 모델·옵션 다름 1건 = 2건만 남는다", () => {
    const out = selectVisualCheckCandidates(사장님_해외);
    expect(out.map((r) => r.candidate.title)).toEqual(["동일상품", "색상만 다름"]);
  });

  it("🔴 동일상품이 «항상» 위에 온다 — 입력 순서에 기대지 않는다", () => {
    const out = selectVisualCheckCandidates([...사장님_해외].reverse());
    expect(out.map((r) => r.tier)).toEqual(["SAME", "SAME_MODEL_OPTION_DIFF"]);
  });

  it("CONFIRMED_PRODUCT 도 🟢 동일상품이다", () => {
    expect(overseasMatchDisplay("CONFIRMED_PRODUCT").tier).toBe("SAME");
  });
});

describe("🔴 가격 — 검증되지 않은 숫자를 실제 가격처럼 보여주지 않는다", () => {
  it("SAME_MODEL_VARIANT 의 상세 검증 실패는 가격이 «표시 불가» 상태로 남는다", () => {
    const out = selectVisualCheckCandidates([
      row("SAME_MODEL_OPTION_DIFF", { priceStatus: "PRICE_UNAVAILABLE", price: { amount: 99000, currency: "GBP" } }),
    ]);
    // 숫자 자체는 데이터에 남아 있다(지우지 않는다) — 화면이 그리지 않을 뿐이다.
    expect(out[0].candidate.price).toEqual({ amount: 99000, currency: "GBP" });
    expect(out[0].candidate.priceStatus).toBe("PRICE_UNAVAILABLE");
  });

  it("검색 단계 미검증 가격도 UNVERIFIED_SEARCH 로 그대로 온다", () => {
    const out = selectVisualCheckCandidates([row("SAME", { priceStatus: "UNVERIFIED_SEARCH" })]);
    expect(out[0].candidate.priceStatus).toBe("UNVERIFIED_SEARCH");
  });
});

describe("🔴 없는 것을 만들어내지 않는다", () => {
  it("후보 0건이면 0건", () => {
    expect(selectVisualCheckCandidates([])).toHaveLength(0);
  });

  it("이미지가 없어도 후보 자체는 남는다 — 이미지 칸만 빈다", () => {
    const out = selectVisualCheckCandidates([row("SAME", { imageUrl: null })]);
    expect(out).toHaveLength(1);
    expect(out[0].candidate.imageUrl).toBeNull();
  });

  it("visionScore 가 없으면 undefined 그대로 — 0 으로 바뀌지 않는다", () => {
    expect(selectVisualCheckCandidates([row("SAME")])[0].candidate.visionScore).toBeUndefined();
  });

  it("0 점이 실제로 관측됐으면 0 이 유지된다 — «없음» 과 구분된다", () => {
    expect(selectVisualCheckCandidates([row("SAME", { visionScore: 0 })])[0].candidate.visionScore).toBe(0);
  });
});
