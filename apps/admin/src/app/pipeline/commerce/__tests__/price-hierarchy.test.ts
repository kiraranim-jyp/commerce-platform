import { describe, expect, it } from "vitest";
import {
  buildMarketContext,
  buildOriginalPriceHeadline,
  buildPriceChain,
  PRICE_LINE_LABEL,
  PRICE_MEANING_LABEL,
  PRICE_SECTION_TITLE,
  type MarketContextInput,
  type OriginalPriceHeadlineInput,
  type PriceChainInput,
} from "../price-hierarchy";

/**
 * UX 2.3(CEO 지시, 2026-09-11) — 고정하려는 실제 화면.
 *
 * 프로덕션 화면에 £55 · ₩99,928 · 국내 비교가격 · 한국 시장 가격 · 판매가격이
 * 전부 같은 모양의 숫자로 떠 있었다. 그중 "한국 시장 가격"이라는 한 라벨이 두
 * 사실(원본 판매자의 한국 표시가 / 국내 편집샵 비교가)을 겸했고, 국내 비교상품이
 * 0건이면 화면 전체가 "판단 불가"처럼 읽혔다.
 *
 * 이 테스트가 못박는 것은 두 가지다:
 *   ① 여덟 가지 의미가 한 라벨로 합쳐지지 않는다.
 *   ② 국내 데이터가 비어도 수익성 사슬은 전부 살아 있고, 저하되는 것은
 *      가격 경쟁력 하나뿐이다(시장 비교 불가 ≠ 수익성 계산 불가).
 */
const CHAIN: PriceChainInput = {
  originPrice: { amount: 55, currency: "GBP" },
  observedOriginPrice: null,
  originPriceBasis: "저장된 가격 기준",
  costBasisIsKrMarket: false,
  sourcePriceKrw: 99928,
  exchangeRate: 1816.87,
  exchangeRateIsEstimate: false,
  internationalShippingKrw: 12000,
  landedCostKrw: 111928,
  sellerPlannedPriceKrw: 150000,
  expectedProfitKrw: 23072,
  platformFeeKrw: 15000,
  costIncomplete: false,
  marginPercent: 15.4,
  marginBasis: "PLANNED",
};

const MARKET: MarketContextInput = {
  domesticBasis: "EXACT",
  domesticAveragePriceKrw: 116600,
  domesticLowestPriceKrw: 109000,
  domesticSellerCount: 3,
  domesticUnresolved: false,
};

describe("여덟 가지 가격은 한 라벨로 합쳐지지 않는다", () => {
  it("의미마다 라벨이 하나씩이고 서로 겹치지 않는다", () => {
    const labels = Object.values(PRICE_MEANING_LABEL);
    expect(labels).toHaveLength(8);
    expect(new Set(labels).size).toBe(8);
  });

  it("착지원가에 더해지는 비용은 여덟 가격 중 어느 이름도 쓰지 않는다", () => {
    // "국제배송비"가 아홉 번째 가격으로 섞이면 그 순간 이 파일의 약속이 깨진다.
    expect(Object.values(PRICE_MEANING_LABEL)).not.toContain(PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING);
  });

  it("사슬의 한 줄은 의미를 하나씩만 갖는다", () => {
    const rows = buildPriceChain(CHAIN);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of rows) expect(row.label).toBe(PRICE_LINE_LABEL[row.key]);
  });

  it("원본 통화 가격과 원화 환산은 서로 다른 줄이고 한 숫자로 뭉개지지 않는다", () => {
    const rows = buildPriceChain(CHAIN);
    const origin = rows.find((r) => r.key === "SOURCE_ORIGINAL_PRICE")!;
    const converted = rows.find((r) => r.key === "SOURCE_PRICE_KRW")!;
    // 원본 줄은 원본 통화 그대로 — 원화 기호도 "≈"도 붙지 않는다.
    expect(origin.value).toContain("55");
    expect(origin.value).not.toContain("₩");
    expect(origin.value).not.toContain("≈");
    // 환산 줄은 자기 라벨과 환율 근거를 갖는다.
    expect(converted.value).toBe("₩99,928");
    expect(converted.basis).toContain("1 GBP = ₩1,817");
  });

  it("원본 통화가 원화면 환산 줄을 만들지 않는다 — 같은 숫자에 라벨을 두 번 붙이지 않는다", () => {
    const rows = buildPriceChain({
      ...CHAIN,
      originPrice: { amount: 162000, currency: "KRW" },
      sourcePriceKrw: 162000,
    });
    expect(rows.some((r) => r.key === "SOURCE_PRICE_KRW")).toBe(false);
    expect(rows.some((r) => r.key === "SOURCE_ORIGINAL_PRICE")).toBe(true);
  });

  it("원본 판매자의 한국 표시가는 '원본 판매가격'이라고 부르지 않는다", () => {
    // 실측 근거(PèPè): £200×환율=₩377,400인데 실제 한국 로케일 표시가는
    // ₩234,800이었다. 둘을 같은 라벨로 부르면 차액 ₩142,600이 화면에서 사라진다.
    const rows = buildPriceChain({ ...CHAIN, costBasisIsKrMarket: true, sourcePriceKrw: 234800 });
    const head = rows[0]!;
    expect(head.key).toBe("KR_MARKET_PRICE");
    expect(head.label).toBe(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
    expect(head.basis).toContain("환율 환산이 아닙니다");
    expect(rows.some((r) => r.key === "SOURCE_ORIGINAL_PRICE")).toBe(false);
  });

  it("원본 판매자 한국 표시가와 국내 비교상품은 절대 같은 라벨을 쓰지 않는다", () => {
    // 이 둘이 같은 이름("한국 시장 가격")을 쓰던 것이 이번 지시의 출발점이다.
    // 하나는 내가 살 값이고 하나는 남이 파는 값이다.
    expect(PRICE_MEANING_LABEL.KR_MARKET_PRICE).not.toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
    const context = buildMarketContext(MARKET);
    expect(context.comparable.label).toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("예상 마진은 어느 판매가 기준인지 항상 밝힌다", () => {
    const planned = buildPriceChain(CHAIN).find((r) => r.key === "EXPECTED_MARGIN")!;
    expect(planned.basis).toBe("내 판매가 기준");
    const recommended = buildPriceChain({ ...CHAIN, marginBasis: "RECOMMENDED" }).find(
      (r) => r.key === "EXPECTED_MARGIN",
    )!;
    expect(recommended.basis).toBe("추천 판매가 기준");
  });

  it("④ 수익성 요약은 착지원가 → 내 판매가격 → 예상 수익 → 예상 마진 넷이다", () => {
    // UX 2.4(CEO 지시, 2026-09-11) — 환산가와 국제배송비는 착지원가 안에 이미
    // 합쳐져 있어서 접어도 사실이 사라지지 않는다. 착지원가·내 판매가·수익은
    // 접는 순간 셀러가 답을 못 얻는다.
    //
    // MI/PRICE-1(CEO 지시, 2026-09-12) — 원본 판매가격이 요약에서 내려갔다.
    // 지워진 것이 아니라 **이미 두 곳이 답하고 있어서**다: 바로 위 ① 원본 상품
    // 가격이 원본 통화로, ④의 상세 계산이 편집 가능한 첫 줄로. 같은 값이 한
    // 카드에서 세 번 나오는 것이 이번 지시가 없애라고 한 화면이다.
    const rows = buildPriceChain(CHAIN);
    expect(rows.filter((r) => r.tier === "SUMMARY").map((r) => r.key)).toEqual([
      "LANDED_COST",
      "SELLER_PLANNED_PRICE",
      "EXPECTED_PROFIT",
      "EXPECTED_MARGIN",
    ]);
    expect(rows.filter((r) => r.tier === "DETAIL").map((r) => r.key)).toEqual([
      "SOURCE_ORIGINAL_PRICE",
      "SOURCE_PRICE_KRW",
      "INTERNATIONAL_SHIPPING",
    ]);
  });

  it("원가 기준이 한국 표시가인 상품만 그 줄을 요약에 남긴다", () => {
    // ①이 그때는 스냅샷의 원본 통화 가격을 세우기 때문에, 실제로 착지원가에
    // 들어간 한국 표시가를 화면 어디서도 대신 말해주지 않는다. 이 한 줄을
    // 내리면 "무엇을 더해서 착지원가가 됐는지"가 요약에서 사라진다.
    const rows = buildPriceChain({ ...CHAIN, costBasisIsKrMarket: true });
    const head = rows[0];
    expect(head.key).toBe("KR_MARKET_PRICE");
    expect(head.tier).toBe("SUMMARY");
    // 반대로 일반 상품의 출발점은 ①이 이미 답하므로 요약에 남지 않는다.
    expect(buildPriceChain(CHAIN)[0]).toMatchObject({ key: "SOURCE_ORIGINAL_PRICE", tier: "DETAIL" });
  });

  it("접힘은 순서를 다시 정하지 않는다 — 계산 순서가 곧 화면 순서다", () => {
    const rows = buildPriceChain(CHAIN);
    const summaryOnly = rows.filter((r) => r.tier === "SUMMARY");
    // 접힌 목록은 전체 배열의 부분수열이다(자리를 바꾸지 않는다).
    let cursor = -1;
    for (const row of summaryOnly) {
      const at = rows.indexOf(row);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("예상 수익이 착지원가만 뺀 값이 아니라는 사실을 숨기지 않는다", () => {
    const profit = buildPriceChain(CHAIN).find((r) => r.key === "EXPECTED_PROFIT")!;
    expect(profit.basis).toContain("플랫폼 수수료");
    expect(profit.basis).toContain("₩15,000");
  });
});

describe("판매가를 정하지 않아도 원가 사슬은 끊기지 않는다", () => {
  const noPlan = buildPriceChain({
    ...CHAIN,
    sellerPlannedPriceKrw: null,
    expectedProfitKrw: null,
    platformFeeKrw: null,
    marginPercent: 22.4,
    marginBasis: "RECOMMENDED",
  });

  it("추천가가 '내 판매가격' 자리를 대신 채우지 않는다", () => {
    // 채우면 셀러는 이미 그 가격으로 팔기로 되어 있다고 읽는다.
    const plan = noPlan.find((r) => r.key === "SELLER_PLANNED_PRICE")!;
    expect(plan.value).toBeNull();
    expect(plan.empty?.chip).toBe("⚪ 확인 불가");
  });

  it("원본가격·환산·국제배송·착지원가는 그대로 값을 갖는다", () => {
    for (const key of ["SOURCE_ORIGINAL_PRICE", "SOURCE_PRICE_KRW", "INTERNATIONAL_SHIPPING", "LANDED_COST"]) {
      expect(noPlan.find((r) => r.key === key)?.value).not.toBeNull();
    }
  });
});

describe("국내 검색 결과가 없어도 수익성 계산은 그대로다", () => {
  const empty = buildMarketContext({
    domesticBasis: "NONE",
    domesticAveragePriceKrw: null,
    domesticLowestPriceKrw: null,
    domesticSellerCount: 0,
    domesticUnresolved: false,
  });

  it("국내 비교상품은 '검색 데이터 없음'이다 — 판단 실패가 아니다", () => {
    expect(empty.competitiveness).toBe("NO_DATA");
    expect(empty.comparable.value).toBeNull();
    expect(empty.comparable.empty?.kind).toBe("NO_SEARCH_DATA");
    expect(empty.comparable.empty?.chip).toBe("⚪ 검색 데이터 없음");
  });

  it("무너지는 것은 가격 경쟁력 하나뿐이라고 화면이 직접 말한다", () => {
    expect(empty.competitivenessNote).toContain("시장 경쟁가격은 확인할 수 없습니다");
    expect(empty.competitivenessNote).toContain("원가·수익 계산은 그대로");
  });

  it("같은 입력으로 만든 사슬은 여섯 줄 전부 계산된 채로 남는다", () => {
    // buildMarketContext와 buildPriceChain은 서로의 입력을 받지 않는다 —
    // 국내가 비었다고 마진이 사라지는 코드가 들어올 자리 자체가 없다.
    const rows = buildPriceChain(CHAIN);
    for (const row of rows) {
      expect(row.value, `${row.label}이(가) 비었다`).not.toBeNull();
    }
  });
});

describe("한국 경쟁시장 블록은 다른 시장의 가격을 들고 있을 수 없다", () => {
  /**
   * UX 2.4(CEO 지시, 2026-09-11) — UX 2.3에서는 이 블록 안에 "🌎 해외 시장 참고
   * N개"가 접혀 있었다. 그 목록의 출처가 실제로는 국내 편집샵 관측이어서,
   * 국내 비교상품 판매처가 "해외 시장"이라는 제목 아래 서 있었다. 이제는
   * 그런 목록이 들어올 **자리 자체**가 없다 — 타입으로 막는다.
   */
  it("이 블록이 내놓는 가격은 국내 비교상품 하나뿐이다", () => {
    const context = buildMarketContext(MARKET);
    const carriers = Object.entries(context).filter(([, v]) => v != null && typeof v === "object" && "value" in v);
    expect(carriers.map(([k]) => k)).toEqual(["comparable"]);
    expect(context.comparable.key).toBe("DOMESTIC_COMPARABLE_PRICE");
  });

  it("비교 판매처 수는 가격이 아니라 근거의 두께로만 나온다", () => {
    // CEO 지시문의 C 그룹: "국내 비교상품 ₩116,600 · 비교 판매처 N곳".
    const context = buildMarketContext(MARKET);
    expect(context.sellerCount.count).toBe(3);
    expect(context.sellerCount.label).toBe("비교 판매처 3곳");
    // 개수는 원화 기호를 달고 나오지 않는다 — 숫자 모양이 같으면 가격으로 읽힌다.
    expect(context.sellerCount.label).not.toContain("₩");
  });

  it("시장을 확정하지 못하면 아무 시장 가격이나 국내 비교상품이라고 부르지 않는다", () => {
    const context = buildMarketContext({ ...MARKET, domesticUnresolved: true });
    expect(context.competitiveness).toBe("UNRESOLVED");
    expect(context.comparable.value).toBeNull();
    expect(context.comparable.empty?.kind).toBe("UNVERIFIABLE");
    expect(context.competitivenessNote).toContain("원가·수익 계산은 그대로");
  });

  it("동일상품이 아닌 참고가뿐이면 그 사실을 밝히되 원가 계산은 건드리지 않는다", () => {
    const context = buildMarketContext({ ...MARKET, domesticBasis: "COMPARISON" });
    expect(context.competitiveness).toBe("REFERENCE_ONLY");
    expect(context.comparable.basis).toContain("비교상품 참고가 기준");
    expect(context.competitivenessNote).toContain("원가·수익 계산은 그대로");
  });
});

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — 판단은 원본에서 시작한다.
 *
 * 고정하려는 실제 화면: 프로덕션은 "원본 판매자 한국 표시가 ₩104,600"으로
 * 열리고 있었다. 셀러는 URL 하나를 붙여넣고 "이 상품이 원래 얼마지?"를 물었는데
 * 첫 줄이 원화였다 — 답이 아니라 환산이다.
 *
 * 원인은 라벨이 아니라 입력이었다: 최근 실측 관측이 있으면 서버가 cost의
 * originalAmount/originalCurrency를 그 관측의 원화값으로 접어서 넘긴다.
 */
describe("① 원본 상품 가격은 언제나 원본 통화가 먼저다", () => {
  /** 실측 관측이 있는 흔한 상태: cost는 이미 원화로 접혀 있다(costSource=LATEST_PRICE). */
  const OBSERVED: PriceChainInput = {
    ...CHAIN,
    // 서버가 넘기는 값 그대로 — 원본 통화가 남아 있지 않다.
    originPrice: { amount: 99928, currency: "KRW" },
    observedOriginPrice: { amount: 55, currency: "GBP", exchangeRate: 1816.87 },
    sourcePriceKrw: 99928,
    // 원가가 이미 원화라 서버의 환율은 1이다 — 이 값을 그대로 쓰면 "1 GBP = ₩1"이 된다.
    exchangeRate: 1,
    originPriceBasis: "최신 확인가 기준 · 2시간 전",
  };

  it("원화로 접힌 원가에서도 사슬의 첫 줄은 £55다 — ₩99,928이 아니다", () => {
    const head = buildPriceChain(OBSERVED)[0]!;
    expect(head.key).toBe("SOURCE_ORIGINAL_PRICE");
    expect(head.value).toContain("55");
    expect(head.value).not.toContain("₩");
  });

  it("그 원화는 사라지지 않고 '원화 환산' 줄로 내려간다", () => {
    const rows = buildPriceChain(OBSERVED);
    const converted = rows.find((r) => r.key === "SOURCE_PRICE_KRW")!;
    expect(converted.value).toBe("₩99,928");
    // 환율은 그 금액이 온 관측 행에서 같이 온 것을 쓴다(서버가 방금 조회한 1이 아니라).
    expect(converted.basis).toContain("1 GBP = ₩1,817");
    expect(converted.basis).not.toContain("= ₩1 ");
  });

  it("①은 사슬과 같은 입력을 받아 같은 값을 말한다 — 사본이 아니다", () => {
    const chain = buildPriceChain(OBSERVED);
    const headline = buildOriginalPriceHeadline({ ...HEADLINE_FROM(OBSERVED), snapshotOriginPrice: null });
    expect(headline.title).toBe(PRICE_SECTION_TITLE.ORIGINAL);
    expect(headline.price.value).toBe(chain.find((r) => r.key === "SOURCE_ORIGINAL_PRICE")!.value);
    expect(headline.converted?.value).toBe(chain.find((r) => r.key === "SOURCE_PRICE_KRW")!.value);
  });

  it("원본 통화 가격이 있으면 원화만 적힌 값을 '원본 판매가격'이라고 부르지 않는다", () => {
    const headline = buildOriginalPriceHeadline({ ...HEADLINE_FROM(OBSERVED), snapshotOriginPrice: null });
    expect(headline.price.label).toBe(PRICE_MEANING_LABEL.SOURCE_ORIGINAL_PRICE);
    expect(headline.price.value).not.toContain("₩");
  });

  it("원가가 한국 표시가 기준이면 ①은 스냅샷의 원본 통화 가격으로 답한다", () => {
    // 이 경우 응답 어디에도 원본 통화 가격이 없다 — 스냅샷이 유일한 근거다.
    const krMarket: PriceChainInput = {
      ...CHAIN,
      costBasisIsKrMarket: true,
      originPrice: { amount: 104600, currency: "KRW" },
      observedOriginPrice: null,
      sourcePriceKrw: 104600,
    };
    const headline = buildOriginalPriceHeadline({
      ...HEADLINE_FROM(krMarket),
      snapshotOriginPrice: { amount: 55, currency: "GBP" },
    });
    expect(headline.price.value).toContain("55");
    expect(headline.price.value).not.toContain("₩");
    // 환율을 곱해 만든 원화는 없다 — 응답에 대응하는 값이 없으면 만들지 않는다.
    expect(headline.converted).toBeNull();
    // 한국 표시가는 지워진 것이 아니라 자리를 옮겼다는 사실을 화면이 직접 말한다.
    expect(headline.note).toContain(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
  });

  it("한국 표시가는 ①에서 내려와도 ④ 사슬의 출발점으로 그대로 남는다", () => {
    // 지우는 것이 아니라 옮기는 것이다 — 그 값은 내가 실제로 치르는 돈이다.
    const rows = buildPriceChain({
      ...CHAIN,
      costBasisIsKrMarket: true,
      observedOriginPrice: null,
      sourcePriceKrw: 104600,
    });
    const head = rows[0]!;
    expect(head.key).toBe("KR_MARKET_PRICE");
    expect(head.label).toBe(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
    expect(head.value).toBe("₩104,600");
  });

  it("원본이 원화로만 확인되면 없는 외화 가격을 지어내지 않는다", () => {
    const headline = buildOriginalPriceHeadline({
      ...HEADLINE_FROM({
        ...CHAIN,
        costBasisIsKrMarket: true,
        observedOriginPrice: null,
        sourcePriceKrw: 104600,
      }),
      snapshotOriginPrice: null,
    });
    expect(headline.price.key).toBe("KR_MARKET_PRICE");
    expect(headline.price.value).toBe("₩104,600");
    expect(headline.converted).toBeNull();
  });

  it("읽는 순서는 ① 원본 → ② 글로벌 → ③ 한국 경쟁 → ④ 수익성 → ⑤ 근거다", () => {
    // 순서가 제목 안에 적혀 있어야 누가 블록을 옮겼을 때 번호가 먼저 어긋난다.
    expect(Object.values(PRICE_SECTION_TITLE)).toEqual([
      "① 원본 상품 가격",
      "② 🌎 판매자 글로벌 시장 가격",
      "③ 📊 한국 시장 경쟁가격",
      "④ 💰 수익성",
      "⑤ 🔎 판단 근거",
    ]);
    // US/DE/FR는 **같은 판매자**의 시장이다 — 남의 해외 가격 비교가 아니다.
    expect(PRICE_SECTION_TITLE.SELLER_GLOBAL_MARKET).not.toContain("해외 가격 비교");
  });
});

/** 사슬과 ①이 같은 입력을 받는다는 것을 테스트에서도 한 곳에서만 쓴다. */
function HEADLINE_FROM(chain: PriceChainInput): Omit<OriginalPriceHeadlineInput, "snapshotOriginPrice"> {
  return {
    observedOriginPrice: chain.observedOriginPrice,
    originPrice: chain.originPrice,
    sourcePriceKrw: chain.sourcePriceKrw,
    exchangeRate: chain.exchangeRate,
    exchangeRateIsEstimate: chain.exchangeRateIsEstimate,
    originPriceBasis: chain.originPriceBasis,
    costBasisIsKrMarket: chain.costBasisIsKrMarket,
  };
}
