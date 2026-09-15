import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  DOMESTIC_ANALYSIS_MARKET_COUNTRY,
  computePriceBreakdown,
  computePriceRecommendation,
  computePriceTrend,
  computeRadar,
  computeUnifiedPriceDecision,
  groupMarketObservations,
  summarizeDomesticMarketSplit,
  sellerDecisionStateFromUnifiedDecision,
  type PriceObservationRecord,
  type PriceObservationSource,
} from "@commerce/pricing";

/**
 * GOLF-01.6 축 B STEP 1(CEO 지시, 2026-09-16) — **해외 관측을 price_observations에
 * 저장하면 기존 아동의류 MI 숫자가 움직이는가.**
 *
 * 이 파일은 기능이 아니라 **답 하나**를 고정한다. 답은 "저장한다/안 한다"가 아니라
 * **어느 `source` 값으로 저장하느냐에 달려 있다**. 그래서 세 가지 저장 방식을
 * 나란히 계산해서, 안전한 것 하나와 안전하지 않은 둘을 같은 화면에 남긴다.
 *
 * ── 읽는 쪽이 전부 source로 걸러진다는 사실이 이 답의 근거다 ───────────────
 * price_observations를 읽는 경로는 저장소 전체에 네 곳뿐이고, 네 곳 모두
 * `source`를 명시한다:
 *   market-intelligence.ts    getPriceHistory(id, "SELLER_ORIGIN" | "NAVER_SHOPPING" | "DOMESTIC_SHOP")
 *   compute-readiness.ts      같은 셋
 *   brand-market.ts           .eq("source", "SELLER_ORIGIN")
 *   price-observations.ts     hasObservationToday / getObservedMarketKeysToday — 둘 다 .eq("source", …)
 * 세 값 중 어느 것도 아닌 새 값은 **어떤 읽기에도 걸리지 않는다**. 그것이
 * 아래 ①이 한 원도 움직이지 않는 이유이고, 동시에 "저장만으로는 MI에 아무것도
 * 이어지지 않는다"는 뜻이기도 하다(읽는 쪽을 따로 만들지 않는 한).
 *
 * ── 기준 숫자 ────────────────────────────────────────────────────────────
 * Bobo Choses B226AC043 "Mystery BC half zipped sweatshirt" €75.00.
 * category-cost-policy.test.ts의 KIDS_BEFORE와 **같은 값**을 여기서도 쓴다 —
 * 그 파일은 원가 엔진 쪽에서, 이 파일은 관측 저장 쪽에서 같은 숫자를 지킨다.
 */

/* ───────────────────── 읽는 쪽을 그대로 흉내 낸다 ───────────────────── */

/** getPriceHistory(snapshotId, source, limit=60)와 **같은 규칙**.
 *  where source = ? · order by checked_at desc · limit 60. */
const HISTORY_LIMIT = 60;
function readHistory(rows: PriceObservationRecord[], source: string, limit = HISTORY_LIMIT) {
  return rows
    .filter((r) => r.source === source)
    .sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1))
    .slice(0, limit);
}

/**
 * `source`를 union이 아니라 `string`으로 받는다. 이것이 Q3의 답을 그대로 보여주는
 * 자리다 — **새 소스 값을 막는 것은 DB가 아니라 TypeScript다**. 실제 스키마는
 * `source text not null`이고 CHECK 제약도 트리거도 없다(2026-09-16 프로덕션 확인).
 * 즉 값을 늘리는 데 마이그레이션이 필요 없고, 늘리려면 PRICE_OBSERVATION_SOURCES
 * 배열 한 줄만 고치면 된다.
 */
let seq = 0;
function obs(
  partial: Omit<Partial<PriceObservationRecord>, "source"> & { source: string; priceKrw: number },
): PriceObservationRecord {
  seq += 1;
  return {
    id: `obs-${seq}`,
    snapshotId: "snap-bobo-b226ac043",
    sourceLabel: null,
    sourceProductUrl: null,
    sourceRefId: null,
    currency: "KRW",
    priceAmount: null,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: null,
    marketCode: null,
    marketCountry: null,
    checkedAt: "2026-09-15T00:00:00.000Z",
    ...partial,
  } as PriceObservationRecord;
}

/* ───────────────────── 오늘의 아동의류 상품 하나 ───────────────────── */

/** 해외 원가 근거. run-price-check가 한 번의 확인에 두 행을 남긴다
 *  (ORIGIN_FX = 원본 시장가, KR_MARKET = 판매처의 한국 표시가). */
function originRows(): PriceObservationRecord[] {
  return [
    obs({ source: "SELLER_ORIGIN", sourceLabel: "ORIGIN_FX", priceKrw: 111000, priceAmount: 75, currency: "EUR" }),
    obs({ source: "SELLER_ORIGIN", sourceLabel: "KR_MARKET", priceKrw: 162000 }),
    obs({
      source: "SELLER_ORIGIN",
      sourceLabel: "ORIGIN_FX",
      priceKrw: 111000,
      priceAmount: 75,
      currency: "EUR",
      checkedAt: "2026-08-10T00:00:00.000Z",
    }),
  ];
}

/** 국내 편집샵 동일상품 2곳 — 최저 198,000 · 평균 214,000(= KIDS_DOMESTIC). */
function domesticShopRows(): PriceObservationRecord[] {
  return [
    obs({
      source: "DOMESTIC_SHOP",
      sourceRefId: "shop-a",
      sourceLabel: "국내샵 A",
      sourceProductUrl: "https://shop-a.co.kr/p/1",
      priceKrw: 198000,
      priceAmount: 198000,
    }),
    obs({
      source: "DOMESTIC_SHOP",
      sourceRefId: "shop-b",
      sourceLabel: "국내샵 B",
      sourceProductUrl: "https://shop-b.co.kr/p/1",
      priceKrw: 230000,
      priceAmount: 230000,
    }),
  ];
}

/** 해외 비교 검색이 실제로 돌려주는 후보(🟢 동일상품으로 확정된 두 곳).
 *  지금은 화면까지만 가고 저장되지 않는다 — 이 작업이 저장하려던 그 행이다. */
function overseasRows(source: string): PriceObservationRecord[] {
  return [
    obs({
      source,
      sourceLabel: "Smallable",
      sourceProductUrl: "https://www.smallable.com/en/p/430701",
      currency: "EUR",
      priceAmount: 82,
      priceKrw: 121360,
      exchangeRate: 1480,
      marketCode: "en-fr",
      marketCountry: "FR",
    }),
    obs({
      source,
      sourceLabel: "Kids Around",
      sourceProductUrl: "https://www.kidsaround.com/p/9912",
      currency: "EUR",
      priceAmount: 95,
      priceKrw: 140600,
      exchangeRate: 1480,
      marketCode: "en-it",
      marketCountry: "IT",
    }),
  ];
}

/* ───────────────── MI가 price_observations에서 뽑아내는 것 전부 ───────────────── */

/** market-intelligence.ts가 관측에서 만들어 내는 값들을, 그 파일과 **같은
 *  순서·같은 함수**로 다시 만든다. 새 계산은 하나도 없다. */
function miInputsFrom(rows: PriceObservationRecord[]) {
  const originRecords = readHistory(rows, "SELLER_ORIGIN");
  const domesticShopHistory = readHistory(rows, "DOMESTIC_SHOP");
  const naverHistory = readHistory(rows, "NAVER_SHOPPING");

  // selectCostBasisOriginObservations와 같은 규칙(ORIGIN_FX가 있으면 KR_MARKET을 뺀다).
  const candidates = originRecords.filter((r) => r.sourceLabel !== "MARKET_PROBE");
  const originHistory = candidates.some((r) => r.sourceLabel === "ORIGIN_FX")
    ? candidates.filter((r) => r.sourceLabel !== "KR_MARKET")
    : candidates;

  // priceTierFromLink 결과(domestic_product_links). 두 국내샵 모두 EXACT.
  const tierBySourceId = new Map<string, string>([
    ["shop-a", "EXACT"],
    ["shop-b", "EXACT"],
  ]);
  const exactShopRecords: PriceObservationRecord[] = [];
  const comparisonShopRecords: PriceObservationRecord[] = [];
  for (const record of domesticShopHistory) {
    const tier = record.sourceRefId ? tierBySourceId.get(record.sourceRefId) : undefined;
    if (tier === "EXACT") exactShopRecords.push(record);
    else if (tier === "COMPARISON") comparisonShopRecords.push(record);
  }
  const split = summarizeDomesticMarketSplit(
    exactShopRecords,
    [...comparisonShopRecords, ...naverHistory],
    { analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY },
  );
  const latestOrigin = originHistory[0] ?? null;

  return {
    costPriceKrw: latestOrigin?.priceKrw ?? null,
    costBasis: latestOrigin?.sourceLabel ?? null,
    domesticLowestPriceKrw: split.resolved.lowestPriceKrw,
    domesticAveragePriceKrw: split.resolved.averagePriceKrw,
    domesticSellerCount: split.resolved.sellerCount,
    domesticBasis: split.basis,
    originTrend30d: computePriceTrend(originHistory, 30, new Date("2026-09-15T12:00:00.000Z")),
    // market-intelligence.ts는 **거르지 않은** originRecords를 넘긴다.
    sellerGlobalMarkets: groupMarketObservations(originRecords),
  };
}

/** MI 인풋 → 셀러가 실제로 보는 다섯 숫자. 엔진은 한 줄도 건드리지 않는다. */
function miNumbersFrom(inputs: ReturnType<typeof miInputsFrom>) {
  const breakdown = computePriceBreakdown(
    { originalAmount: inputs.costPriceKrw!, originalCurrency: "KRW", ...DEFAULT_PRICE_BREAKDOWN_INPUT },
    undefined,
    DEFAULT_PRICE_ROUNDING_UNIT,
  );
  const unified = computeUnifiedPriceDecision({
    sourceProductPriceKrw: { value: breakdown.costKrw, status: "estimated" },
    exchangeRate: { value: breakdown.exchangeRate, status: "estimated" },
    internationalShippingKrw: { value: breakdown.shippingKrw, status: "estimated", source: "seller_default" },
    customerChargedShippingKrw: { value: null, status: "unknown" },
    platformFeeRate: { value: breakdown.feePercent, status: "estimated", source: "default" },
    currentSellingPriceKrw: { value: breakdown.suggestedPriceKrw, status: "actual" },
    domesticCompetitivePrice: {
      lowest: inputs.domesticLowestPriceKrw,
      average: inputs.domesticAveragePriceKrw,
    },
    categoryProfileId: "KIDS_FASHION",
  });
  const recommendation = computePriceRecommendation({
    totalCostKrw: breakdown.landedCostKrw,
    domesticLowestPriceKrw: inputs.domesticLowestPriceKrw,
    domesticAveragePriceKrw: inputs.domesticAveragePriceKrw,
    domesticBasis: inputs.domesticBasis,
    minimumMarginPercent: 10,
    targetMarginPercent: DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent,
  });
  const radar = computeRadar({
    marketCase: recommendation.marketCase,
    landedCostKrw: breakdown.landedCostKrw,
    recommendedPriceKrw: recommendation.recommendedPrice,
    domesticLowestPriceKrw: inputs.domesticLowestPriceKrw,
    domesticAveragePriceKrw: inputs.domesticAveragePriceKrw,
    domesticBasis: inputs.domesticBasis,
    searchInterest: "medium",
    bestMatchTruth: "EXACT_IDENTIFIER",
  });
  return {
    landedCostKrw: unified.landedCostKrw.value,
    suggestedPriceKrw: breakdown.suggestedPriceKrw,
    estimatedProfitKrw: unified.estimatedProfitKrw.value,
    marginPercent: unified.marginPercent.value,
    verdict: unified.verdict,
    sellerStateCode: sellerDecisionStateFromUnifiedDecision(unified).code,
    marketCase: recommendation.marketCase,
    recommendedPrice: recommendation.recommendedPrice,
    radar: radar.axes.map((a) => [a.key, a.state]),
  };
}

const BASELINE_ROWS = () => [...originRows(), ...domesticShopRows()];

/** CEO가 못 박은 값 — 저장 이전의 오늘. */
const CEO_NUMBERS = {
  landedCostKrw: 123000,
  suggestedPriceKrw: 175710,
  estimatedProfitKrw: 35139,
  marginPercent: 20,
  verdict: "MAINTAIN",
} as const;

/* ════════════════════════════ ① 기준선 ════════════════════════════ */

describe("GOLF-01.6 축B Q2 ①: 저장 이전의 아동의류 숫자", () => {
  it("착지원가 123,000 · 권장가 175,710 · 이익 35,139 · 마진 20.0% · MAINTAIN", () => {
    const numbers = miNumbersFrom(miInputsFrom(BASELINE_ROWS()));
    expect(numbers.landedCostKrw).toBe(CEO_NUMBERS.landedCostKrw);
    expect(numbers.suggestedPriceKrw).toBe(CEO_NUMBERS.suggestedPriceKrw);
    expect(numbers.estimatedProfitKrw).toBe(CEO_NUMBERS.estimatedProfitKrw);
    expect(numbers.marginPercent).toBe(CEO_NUMBERS.marginPercent);
    expect(numbers.verdict).toBe(CEO_NUMBERS.verdict);
  });

  it("국내 시장가는 최저 198,000 · 평균 214,000 · 판매처 2곳이다", () => {
    const inputs = miInputsFrom(BASELINE_ROWS());
    expect(inputs.domesticLowestPriceKrw).toBe(198000);
    expect(inputs.domesticAveragePriceKrw).toBe(214000);
    expect(inputs.domesticSellerCount).toBe(2);
    expect(inputs.domesticBasis).toBe("EXACT");
  });
});

/* ══════════ ② 새 source 값으로 저장하면 — 한 원도 움직이지 않는다 ══════════ */

describe("GOLF-01.6 축B Q2 ②: 새 source 값(OVERSEAS_SHOP)으로 저장할 때", () => {
  const WITH_OVERSEAS = () => [...BASELINE_ROWS(), ...overseasRows("OVERSEAS_SHOP")];

  it("🔴 다섯 숫자가 전부 동일하다 — 읽는 쪽 네 곳이 모두 source로 걸러진다", () => {
    const before = miNumbersFrom(miInputsFrom(BASELINE_ROWS()));
    const after = miNumbersFrom(miInputsFrom(WITH_OVERSEAS()));
    expect(after).toEqual(before);
  });

  it("🔴 MI가 관측에서 뽑아내는 값이 필드 하나까지 동일하다(원가 · 국내시세 · 추세 · 글로벌시장)", () => {
    expect(miInputsFrom(WITH_OVERSEAS())).toEqual(miInputsFrom(BASELINE_ROWS()));
  });

  it("60건 제한도 소스별로 걸리므로 기존 행이 밀려나지 않는다", () => {
    const base = BASELINE_ROWS();
    const many = [
      ...base,
      ...Array.from({ length: 80 }, (_, i) =>
        obs({
          source: "OVERSEAS_SHOP",
          priceKrw: 100000 + i,
          checkedAt: `2026-09-${String(10 + (i % 5)).padStart(2, "0")}T00:00:00.000Z`,
        }),
      ),
    ];
    expect(readHistory(many, "SELLER_ORIGIN").map((r) => r.id)).toEqual(
      readHistory(base, "SELLER_ORIGIN").map((r) => r.id),
    );
    expect(readHistory(many, "DOMESTIC_SHOP")).toHaveLength(2);
  });

  it("그러나 MI가 그 행을 읽는 경로도 없다 — 저장만으로는 아무것도 이어지지 않는다", () => {
    const rows = WITH_OVERSEAS();
    for (const source of ["SELLER_ORIGIN", "NAVER_SHOPPING", "DOMESTIC_SHOP"] as PriceObservationSource[]) {
      expect(readHistory(rows, source).every((r) => r.sourceLabel !== "Smallable")).toBe(true);
    }
  });
});

/* ══════════ ③ SELLER_ORIGIN에 얹으면 — 움직인다 ══════════ */

describe("GOLF-01.6 축B Q2 ③: 기존 SELLER_ORIGIN에 얹을 때 무엇이 깨지는가", () => {
  it("🔴 «판매자 글로벌 시장» 카드에 남의 판매처가 이 판매자의 시장으로 들어온다", () => {
    const before = miInputsFrom(BASELINE_ROWS()).sellerGlobalMarkets;
    const after = miInputsFrom([...BASELINE_ROWS(), ...overseasRows("SELLER_ORIGIN")]).sellerGlobalMarkets;
    // groupMarketObservations는 거르지 않은 originRecords를 그대로 받는다.
    expect(before).toHaveLength(0);
    expect(after.map((m) => m.marketCode)).toEqual(["en-fr", "en-it"]);
  });

  it("🔴 60건 창이 해외 행으로 채워져 과거 원가 관측이 밀려난다 — 추세가 조용히 바뀐다", () => {
    const old = Array.from({ length: 58 }, (_, i) =>
      obs({
        source: "SELLER_ORIGIN",
        sourceLabel: "ORIGIN_FX",
        priceKrw: 111000,
        checkedAt: `2026-0${i < 30 ? 8 : 7}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );
    const base = [...BASELINE_ROWS(), ...old];
    const withOverseas = [...base, ...overseasRows("SELLER_ORIGIN")];
    const keptBefore = readHistory(base, "SELLER_ORIGIN").map((r) => r.id);
    const keptAfter = readHistory(withOverseas, "SELLER_ORIGIN").map((r) => r.id);
    expect(keptBefore).toHaveLength(60);
    expect(keptAfter).toHaveLength(60);
    // 같은 60칸인데 안에 든 행이 다르다 — 해외 행 2개가 가장 오래된 원가 2건을 밀어냈다.
    expect(keptAfter).not.toEqual(keptBefore);
    expect(keptBefore.filter((id) => !keptAfter.includes(id))).toHaveLength(2);
  });
});

/* ══════════ ④ DOMESTIC_SHOP에 얹으면 — 사슬 끝까지 움직인다 ══════════ */

describe("GOLF-01.6 축B Q2 ④: 국내 버킷에 얹을 때(가장 위험한 경로)", () => {
  /**
   * 해외 행이 market_code를 들고 오느냐 아니냐로 **깨지는 방식이 갈린다**.
   * 둘 다 안전하지 않지만, 둘이 서로 다른 고장이라 각각 고정해 둔다.
   */

  it("🔴 market_code가 없으면 국내 최저가가 198,000 → 121,360으로 «조용히» 내려간다", () => {
    const overseas = overseasRows("DOMESTIC_SHOP").map((r) => ({
      ...r,
      sourceRefId: "shop-a",
      marketCode: null,
      marketCountry: null,
    }));
    const before = miInputsFrom(BASELINE_ROWS());
    const after = miInputsFrom([...BASELINE_ROWS(), ...overseas]);
    expect(before.domesticLowestPriceKrw).toBe(198000);
    expect(after.domesticLowestPriceKrw).toBe(121360);
    expect(after.domesticSellerCount).toBe(4);

    const n0 = miNumbersFrom(before);
    const n1 = miNumbersFrom(after);
    expect(n1.recommendedPrice).not.toBe(n0.recommendedPrice);
    expect(n1.radar).not.toEqual(n0.radar);
  });

  /**
   * GLOBAL-MARKET ②의 시장 게이트가 **부분적으로** 막아준다. 다만 막은 결과가
   * "예전 값 유지"가 아니라 **국내 시세 자체가 사라지는 것**이다 — 관측 시장이
   * ""·en-fr·en-it 셋이 되면 그중 KR인 것이 하나도 없어 판단 대상 시장을 못 고른다
   * (resolvePriceMarketKey → null → basis UNRESOLVED → 최저/평균이 null).
   */
  it("🔴 market_code가 있으면 국내 시세가 통째로 «판단 불가»가 된다 — 198,000이 null이 된다", () => {
    const overseas = overseasRows("DOMESTIC_SHOP").map((r) => ({ ...r, sourceRefId: "shop-a" }));
    const before = miInputsFrom(BASELINE_ROWS());
    const after = miInputsFrom([...BASELINE_ROWS(), ...overseas]);
    expect(before.domesticLowestPriceKrw).toBe(198000);
    expect(after.domesticLowestPriceKrw).toBeNull();
    expect(after.domesticAveragePriceKrw).toBeNull();

    const n0 = miNumbersFrom(before);
    const n1 = miNumbersFrom(after);
    expect(n1.recommendedPrice).not.toBe(n0.recommendedPrice);
    expect(n1.marketCase).not.toBe(n0.marketCase);
    expect(n1.radar).not.toEqual(n0.radar);
  });
});
