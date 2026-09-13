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

  /**
   * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — 이 케이스가 바뀐 자리다.
   *
   * 예전에는 세 후보의 가격이 전부 가격대에 들어가 "€45.00 ~ €52.00"이 나왔고,
   * 그 양끝 중 하나(€52)는 **동일상품으로 확정되지 않은 후보**의 값이었다.
   * 등급 분포는 옆에 정직하게 적혀 있었지만 셀러가 읽는 큰 숫자는 이미 섞인
   * 뒤였다 — "유사상품 가격이 글로벌 시장 가격에 들어간다"가 실제로 일어나던
   * 경로다. 이제 🟢만 숫자가 되고, 🟡은 등급 분포와 아래 목록에 그대로 남는다.
   */
  it("등급이 섞이면 가격대는 🟢 동일상품만으로 만든다 — 🟡/⚪ 가격은 숫자에 들어가지 않는다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [
        candidate("a", "FR", "SAME", 45),
        candidate("b", "GB", "PRESUMED_SAME", 52),
        candidate("c", "DE", "PRESUMED_SAME", 49),
      ],
    });
    // 분포는 접지 않는다(🟢 1 · 🟡 2) — 섞였다는 사실 자체는 그대로 보인다.
    expect(tierCountsText(evidence.tiers)).toBe("🟢 동일상품 1 · 🟡 동일상품 추정 2");
    // 숫자는 🟢 한 건뿐이라 범위가 아니라 그 값 하나다. 🟡의 €52/€49는 어디에도 없다.
    expect(evidence.figure).toBe("€45.00");
    expect(evidence.figure).not.toContain("52");
    expect(evidence.figure).not.toContain("49");
    expect(evidence.figureBasis).toContain("🟢 동일상품으로 확정된 해외 판매처 1곳");
    // 그리고 그 사실을 요약이 직접 말한다("전부는 아니다"가 아니라 "이것만으로").
    expect(evidence.mixedNote).toContain("🟢 동일상품");
    expect(evidence.mixedNote).toContain("등급이 섞여 있습니다");
  });

  it("동일상품이 하나도 없으면 가격대를 만들지 않는다 — 유사상품 가격을 대표값으로 올리지 않는다", () => {
    const evidence = buildOverseasMarketEvidence({
      candidates: [candidate("a", "FR", "SIMILAR", 45), candidate("b", "GB", "PRESUMED_SAME", 52)],
    });
    expect(evidence.figure).toBeNull();
    expect(evidence.figureEmpty?.reason).toContain("동일상품으로 확정된 해외 판매처 가격이 없습니다");
    // 근거 자체는 사라지지 않는다 — 등급과 판매처 수는 그대로 남아 참고가 된다.
    expect(evidence.scopeLabel).toBe("판매처 2곳 · 2개 국가");
    expect(tierCountsText(evidence.tiers)).toBe("🟡 동일상품 추정 1 · ⚪ 비교상품 1");
    // 가격대가 없으면 "위 가격은 …"이라고 말할 대상도 없다.
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
