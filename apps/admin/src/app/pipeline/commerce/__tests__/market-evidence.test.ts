import { describe, expect, it } from "vitest";
import {
  buildDomesticMarketEvidence,
  buildOverseasMarketEvidence,
  tierCountsText,
  type OverseasMarketCandidateInput,
} from "../market-evidence";
import { buildMarketContext, PRICE_SECTION_TITLE } from "../price-hierarchy";

/**
 * MI-MARKET-EVIDENCE-1(CEO 지시 + CPO 추가 지시, 2026-09-12).
 *
 * 이 파일이 고정하는 규칙은 둘이다:
 *   ① **개수는 등급 없이 나가지 않는다.** "동일상품 3곳"만 적으면 셀러는 세
 *      곳이 전부 확정된 동일상품이라고 읽는다 — Smallable/Bobo 오매칭이 정확히
 *      그 상태였다.
 *   ② **등급이 섞이면 하나로 접지 않는다.** 🟢 1 + 🟡 2를 "🟢 동일상품 기준"으로
 *      적는 순간 추정 두 곳이 확정으로 포장되고, 그게 이 작업이 고치려는 신뢰
 *      문제 그 자체다.
 *
 * 매칭 판정은 손대지 않는다. 여기서 세는 등급은 deriveMatchTruth/
 * product-identity가 이미 낸 값이고, 이 파일은 그 결과를 세기만 한다.
 */

function domesticContext(averageKrw: number | null, sellerCount: number) {
  return buildMarketContext({
    domesticBasis: averageKrw == null ? "NONE" : "EXACT",
    domesticAveragePriceKrw: averageKrw,
    domesticLowestPriceKrw: averageKrw,
    domesticSellerCount: sellerCount,
    domesticUnresolved: false,
  });
}

describe("🇰🇷 국내 시장 요약", () => {
  it("등급이 하나면 '기준'이라고 말할 수 있다", () => {
    const evidence = buildDomesticMarketEvidence({
      context: domesticContext(116600, 3),
      basis: "EXACT",
      exactSellerCount: 3,
      comparisonSellerCount: 0,
    });
    expect(evidence.title).toBe(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(evidence.figure).toBe("₩116,600");
    expect(evidence.scopeLabel).toBe("비교 판매처 3곳");
    expect(tierCountsText(evidence.tiers)).toBe("🟢 동일상품 기준");
    expect(evidence.mixedNote).toBeNull();
  });

  /** CPO 추가 지시의 본체 — 섞인 등급을 강한 쪽 하나로 부르지 않는다. */
  it("등급이 섞이면 분포를 그대로 보여주고, 대표 가격의 근거를 밝힌다", () => {
    const evidence = buildDomesticMarketEvidence({
      context: domesticContext(116600, 3),
      basis: "EXACT",
      exactSellerCount: 1,
      comparisonSellerCount: 2,
    });
    const tiers = tierCountsText(evidence.tiers);
    expect(tiers).toBe("🟢 동일상품 1 · ⚪ 비교상품 2");
    expect(tiers).not.toContain("기준");
    // 서버는 동일상품 버킷 하나로만 대표 가격을 낸다(summarizeDomesticMarketSplit).
    // 그 사실을 말하지 않으면 ₩116,600이 세 곳의 값으로 읽힌다.
    expect(evidence.mixedNote).toContain("🟢 동일상품");
    expect(evidence.mixedNote).toContain("등급이 섞여 있습니다");
  });

  it("대표 가격이 비교상품 버킷에서 나왔으면 그렇게 말한다", () => {
    const evidence = buildDomesticMarketEvidence({
      context: domesticContext(121000, 2),
      basis: "COMPARISON",
      exactSellerCount: 1,
      comparisonSellerCount: 2,
    });
    expect(evidence.mixedNote).toContain("⚪ 비교상품");
  });

  it("근거가 0건이면 숫자도 개수도 등급도 없다", () => {
    const evidence = buildDomesticMarketEvidence({
      context: domesticContext(null, 0),
      basis: "NONE",
      exactSellerCount: 0,
      comparisonSellerCount: 0,
    });
    expect(evidence.figure).toBeNull();
    expect(evidence.figureEmpty?.chip).toBe("⚪ 검색 데이터 없음");
    expect(evidence.scopeLabel).toBeNull();
    expect(evidence.tiers).toEqual([]);
    expect(tierCountsText(evidence.tiers)).toBeNull();
    expect(evidence.hasEvidence).toBe(false);
  });
});

describe("🌎 해외 시장 요약", () => {
  function candidate(
    shopId: string,
    country: string | null,
    tier: OverseasMarketCandidateInput["tier"],
    amount: number | null,
    currency = "EUR",
  ): OverseasMarketCandidateInput {
    return { shopId, shopCountry: country, tier, price: amount == null ? null : { amount, currency } };
  }

  it("가격대는 관측된 양끝 두 개다 — 평균을 만들지 않는다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [
        candidate("a", "FR", "SAME", 45),
        candidate("b", "GB", "SAME", 52),
        candidate("c", "DE", "SAME", 49),
      ],
    });
    expect(evidence.figure).toBe("€45.00 ~ €52.00");
    // 그 사이의 어떤 숫자도 화면에 없다(€48.67 같은 값은 어느 판매처에도 없다).
    expect(evidence.figure).not.toContain("48");
    expect(evidence.scopeLabel).toBe("판매처 3곳 · 3개 국가");
    expect(tierCountsText(evidence.tiers)).toBe("🟢 동일상품 기준");
  });

  it("한 곳뿐이면 범위가 아니라 그 값 하나다", () => {
    const evidence = buildOverseasMarketEvidence({ candidates: [candidate("a", "FR", "SAME", 45)] });
    expect(evidence.figure).toBe("€45.00");
  });

  it("통화가 섞이면 환율로 접지 않고 가격대를 만들지 않는다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [candidate("a", "FR", "SAME", 45), candidate("b", "GB", "SAME", 40, "GBP")],
    });
    expect(evidence.figure).toBeNull();
    expect(evidence.figureEmpty?.reason).toContain("관측 통화가 여러 개라");
    // 근거 자체는 사라지지 않는다 — 판매처 수와 등급은 그대로 남는다.
    expect(evidence.scopeLabel).toBe("판매처 2곳 · 2개 국가");
    expect(tierCountsText(evidence.tiers)).toBe("🟢 동일상품 기준");
  });

  it("가격이 현재가로 확인되지 않으면 개수만 남고 숫자는 없다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [candidate("a", "FR", "SAME", null), candidate("b", "GB", "SAME", null)],
    });
    expect(evidence.figure).toBeNull();
    expect(evidence.figureEmpty?.reason).toContain("현재가로 확인하지 못했습니다");
    expect(evidence.scopeLabel).toBe("판매처 2곳 · 2개 국가");
  });

  it("등급이 섞이면 강한 등급 하나를 주장하지 않는다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [
        candidate("a", "FR", "SAME", 45),
        candidate("b", "GB", "PRESUMED_SAME", 52),
        candidate("c", "DE", "PRESUMED_SAME", 49),
      ],
    });
    expect(tierCountsText(evidence.tiers)).toBe("🟢 동일상품 1 · 🟡 동일상품 추정 2");
    expect(evidence.mixedNote).toContain("확정된 동일상품만으로 이루어진 가격대가 아닙니다");
  });

  it("신고 국가가 없는 판매처를 한 나라로 세지 않는다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [candidate("a", null, "SAME", 45), candidate("b", null, "SAME", 52)],
    });
    expect(evidence.scopeLabel).toBe("판매처 2곳");
  });

  it("결과가 하나도 없으면 숫자도 개수도 등급도 없다", () => {
    const evidence = buildOverseasMarketEvidence({ candidates: [] });
    expect(evidence.title).toBe(PRICE_SECTION_TITLE.OVERSEAS_MARKET);
    expect(evidence.figure).toBeNull();
    expect(evidence.figureEmpty?.chip).toBe("⚪ 검색 데이터 없음");
    expect(evidence.scopeLabel).toBeNull();
    expect(evidence.hasEvidence).toBe(false);
  });
});

/**
 * 두 요약은 서로의 결과를 입력으로 받을 수 없다 — 하나의 숫자로 접히는 경로
 * 자체가 없다는 것이 이 작업의 규칙 ①이다(국내와 해외는 다른 질문에 답한다).
 */
describe("국내와 해외는 하나의 숫자로 합쳐지지 않는다", () => {
  it("두 요약의 제목과 드릴다운 이름이 서로 다르다", () => {
    const domestic = buildDomesticMarketEvidence({
      context: domesticContext(116600, 3),
      basis: "EXACT",
      exactSellerCount: 3,
      comparisonSellerCount: 0,
    });
    const overseas = buildOverseasMarketEvidence({ candidates: [] });
    expect(domestic.title).not.toBe(overseas.title);
    expect(domestic.drillDownLabel).not.toBe(overseas.drillDownLabel);
    expect(domestic.hint).not.toBe(overseas.hint);
  });
});
