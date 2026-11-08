import { describe, expect, it } from "vitest";
import { computePriceRecommendation } from "../price-recommendation";
import {
  deriveRepresentativeSellerVerdict,
  MARGIN_SHORTFALL_DESCRIPTION,
  toSellerFacingVerdict,
  type RepresentativeVerdictInput,
} from "../representative-seller-decision";
import { buildSellerDecision } from "../seller-decision";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-SELLER-POLICY-A — **목표마진을 달성할 수 없으면 판매 비추천이다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **CEO 승인 정책 변경**(2026-11-08). 이것은 문자열 교체가 아니라 **제품 정책** 이다 —
 *    「TTAEJYO 가 어떤 상품을 팔 가치가 있다고 판단할 것인가」가 바뀐다.
 * ```
 * 시장가 ≥ 목표마진 달성가        → 유지            (marketCase A)
 * 손실은 없지만 목표마진 미달      → **판매 비추천**  (marketCase B) ← 🔵 바뀐 자리
 * 시장가에서 손실                 → 판매 비추천 유지 (marketCase C)
 * ```
 * 🔴 **공식은 한 줄도 바꾸지 않았다** — `targetPrice` · `landedCost` · `netProfitAt`.
 *    바뀐 것은 **CASE B 를 어느 판정으로 연결하는가** 하나다.
 *
 * 🔴🔴 이 파일은 **CEO 가 실제 화면에서 본 사례** 를 운영 함수로 재현한다:
 *    국내 최저가 **₩88,000** · 추천 판매가격(원가 역산) **₩102,000** → 「조건부 판매」였다.
 */

/** 🔴 CEO 사례의 입력을 **공식에서 역산하지 않고** 그대로 세운다(지어낸 값 0). */
const FEE_PERCENT = 10;
const TARGET_MARGIN_PERCENT = 20;
/**
 * 🟢 착지원가 — 이 값이면 88,000 에 팔아도 **손실은 없고**(netProfit > 0) 목표마진에는 못 미친다.
 * 🔴🔴 **1차에 70,000 으로 잡았다가 CASE A 가 나왔다** — `targetPrice = 70,000 / 0.8 = 87,500`
 *    이고 `88,000 >= 87,500` 이라 A 로 떨어졌다. 🟢 B 가 성립하는 구간을 **공식에서** 잡는다:
 * ```
 * targetPrice > 88,000        ⟹ cost > 88,000 × 0.8 = **70,400**
 * netProfit(88,000) > 0       ⟹ cost < 88,000 − 8,800(수수료 10%) = **79,200**
 * ```
 * 🔴 화면의 추천 판매가격 ₩102,000 은 **`resolveListingPrice`(A)** 산출이고 여기 `targetPrice`
 *    와 **다른 공식** 이다 — 그래서 그 값을 fixture 로 역산하지 않는다(지어내지 않는다).
 */
const LANDED_COST = 75_000;
const DOMESTIC_LOWEST = 88_000;

const base: RepresentativeVerdictInput = {
  unifiedDecision: null,
  sellability: { level: "GREEN", estimatedMarginPercent: 24, reason: "..." },
  domesticMatched: true,
  domesticSellerCount: 2,
  domesticBasis: "EXACT",
  marketCase: null,
  recommendation: null,
  domesticLowestPriceKrw: null,
  landedCostKrw: null,
} as RepresentativeVerdictInput;

/**
 * 🔴🔴 **칸 이름을 타입에서 읽었다.** 1차에 `landedCostKrw`/`feePercent` 로 추측했다가
 *    **전건 `marketCase: "D"`** 가 나왔다(이 트랙이 반복해서 밟은 그 함정).
 *    🟢 실제 칸은 `totalCostKrw` · `platformFeePercent` 이고, 🔴 `domesticBasis` 가
 *    **`"EXACT"` 가 아니면 CASE A/B/C 에 아예 들어가지 않는다**(P-26 · 그래서 D 였다).
 */
const recommend = (marketPriceKrw: number | null) =>
  computePriceRecommendation({
    totalCostKrw: LANDED_COST,
    domesticLowestPriceKrw: marketPriceKrw,
    domesticAveragePriceKrw: marketPriceKrw,
    domesticBasis: marketPriceKrw == null ? "NONE" : "EXACT",
    minimumMarginPercent: 5,
    targetMarginPercent: TARGET_MARGIN_PERCENT,
    expectedFeePercent: FEE_PERCENT,
  });

const verdictFor = (marketPriceKrw: number | null) => {
  const rec = recommend(marketPriceKrw);
  const representative = deriveRepresentativeSellerVerdict({
    ...base,
    marketCase: rec.marketCase,
    recommendation: { recommendedPrice: rec.recommendedPrice, estimatedMarginPercent: rec.estimatedMarginPercent },
    domesticLowestPriceKrw: marketPriceKrw,
    landedCostKrw: LANDED_COST,
  });
  const facing = toSellerFacingVerdict(representative);
  const final = buildSellerDecision({
    priceVerdict: facing.code,
    marketCase: rec.marketCase,
    estimatedMarginPercent: rec.estimatedMarginPercent,
    signals: [],
  });
  return { rec, representative, facing, final };
};

describe("POLICY-A §1 — CEO 사례: 목표마진 미달 → 판매 비추천", () => {
  it("①-a 🔴🔴 국내 최저가가 목표마진 달성가보다 낮으면 **marketCase B** 다(공식 불변 확인)", () => {
    const { rec } = verdictFor(DOMESTIC_LOWEST);
    expect(rec.marketCase).toBe("B");
    /** 🟢 손실이 **아니다** — 그것이 C 와 B 를 가르는 기준이고 그 공식은 그대로다. */
    expect(rec.targetPrice).toBeGreaterThan(DOMESTIC_LOWEST);
    expect(rec.netProfitKrw ?? 0).toBeGreaterThan(0);
  });

  it("①-b 🔵🔵 **판매 비추천** 으로 판정된다(전에는 「조건부 판매」였다)", () => {
    const { representative, facing, final } = verdictFor(DOMESTIC_LOWEST);
    expect(representative.code).toBe("HOLD");
    expect(facing.code).toBe("NOT_RECOMMENDED");
    expect(final.finalVerdict).toBe("NOT_RECOMMENDED");
  });

  it("①-c 🔴 「조건부」 어휘가 최종 셀러 문구에 **없다**(되살아남 방지)", () => {
    const { representative, facing } = verdictFor(DOMESTIC_LOWEST);
    expect(representative.code).not.toBe("REVIEW_PRICE");
    expect(facing.title).not.toContain("조건부");
  });

  it("①-d 🔴🔴 **손실이라고 말하지 않는다** — B 는 손실이 아니다(C 가 손실이다)", () => {
    const { representative } = verdictFor(DOMESTIC_LOWEST);
    expect(representative.description).toBe(MARGIN_SHORTFALL_DESCRIPTION);
    expect(`${representative.description} ${representative.reasons.join(" ")}`).not.toMatch(/손해|마이너스/);
    /** 🟢 그 대신 **목표마진** 을 말한다. */
    expect(representative.reasons.some((r) => r.includes("목표마진"))).toBe(true);
  });

  it("①-e 🔴 추천 판매가격을 **시장 최저가로 낮춰 말하지 않는다**(CEO 명시 금지)", () => {
    const { representative } = verdictFor(DOMESTIC_LOWEST);
    /**
     * 🔴 `recommendation.recommendedPrice`(B)는 내부 근거로 남지만, 화면의 추천 판매가격
     *    owner 는 `recommendedPriceKrw`(원가 역산 A)이고 이 경로가 그것을 **건드리지 않는다**.
     * 🟢 여기서는 판정 문구가 **「이 가격에 팔아라」로 읽히지 않는지** 만 센다.
     */
    expect(representative.description).not.toMatch(/권장|추천 판매가/);
  });
});

describe("POLICY-A §2 — 바뀌지 않아야 하는 것", () => {
  it("②-a 🟢 시장가가 목표마진 달성가 **이상** 이면 판정이 유지된다(marketCase A)", () => {
    const high = 150_000;
    const { rec, representative, facing } = verdictFor(high);
    expect(rec.marketCase).toBe("A");
    expect(representative.code).toBe("READY");
    expect(facing.code).toBe("RECOMMENDED");
  });

  it("②-b 🟢 시장가에서 **손실** 이면 판매 비추천이 유지된다(marketCase C)", () => {
    const low = 60_000;
    const { rec, representative, facing } = verdictFor(low);
    expect(rec.marketCase).toBe("C");
    expect(representative.code).toBe("HOLD");
    expect(facing.code).toBe("NOT_RECOMMENDED");
    /** 🔴 C 는 **손해라고 말해야** 한다 — B 와 어휘가 갈린다. */
    expect(representative.reasons.some((r) => r.includes("손해"))).toBe(true);
    expect(representative.description).not.toBe(MARGIN_SHORTFALL_DESCRIPTION);
  });

  it("②-c 🟢 국내 시장가가 **없으면**(해외 후보만) 기존 정책 그대로다(marketCase D)", () => {
    const { rec, representative } = verdictFor(null);
    expect(rec.marketCase).toBe("D");
    /** 🔴 D 는 가드가 **통과만** 시킨다 — POLICY-A 가 건드리지 않는다. */
    expect(representative.code).not.toBe("HOLD");
  });

  it("②-d 🔴 공식을 바꾸지 않았다 — targetPrice·netProfit 산출이 그대로다", () => {
    const { rec } = verdictFor(DOMESTIC_LOWEST);
    /** 🟢 목표마진 달성가 = 착지원가 ÷ (1 − 수수료% − 목표마진%) 계열 — 값이 살아 있다. */
    expect(rec.targetPrice).toBeGreaterThan(LANDED_COST);
    expect(rec.minimumPrice).toBeGreaterThan(0);
  });
});
