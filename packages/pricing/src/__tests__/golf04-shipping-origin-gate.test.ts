import { describe, expect, it } from "vitest";
import { computeGolfLandedCost } from "../golf-landed-cost";
import { EMS_RATE_TABLE_ORIGIN_COUNTRY } from "../parcel-weight";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * GOLF-04 STEP 1 — **일본 EMS 요금이 일본이 아닌 출발국에 붙는 것을 막는다**
 * (CEO 지시, 2026-09-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * computeGolfLandedCost 는 policy.weightBasedShipping 만 보고
 * estimateEmsJapanToKorea(...) 를 불렀다. 그 함수 이름이 말하는 그대로 **일본
 * 우편 EMS 일본→한국 요금표** 하나뿐인데, 호출부는 출발국을 보지 않았다.
 *
 * GolfLandedCostInput 에는 originCountry 가 **이미 있었다**(GOLF-01-TAX 때
 * 구매자 부담 참고정보용으로 들어온 필드다). 다만 그 값은
 * resolveBuyerImportCharge 로만 흘렀고 배송비 갈래는 읽지 않았다. 그래서
 * Vice(US) · Titleist(NZ) · Mizuno(DE) 가격을 넣어도 «일본 EMS» 요금이 조용히
 * 붙었다 — 화면에는 🟢 확정처럼 보이는 숫자가 나온다.
 *
 * ── 이 파일이 고정하는 규칙 ─────────────────────────────────────────────
 *   출발국 JP        → 일본 EMS 요금표로 계산한다(지금까지와 같은 숫자)
 *   출발국 US/DE/NZ  → 🔴 계산하지 않는다. shippingStatus="unknown"
 *   출발국 미상       → 🔴 계산하지 않는다. 어느 나라 요금표를 쓸지 정할 수 없다
 *   셀러 실비 입력    → 출발국과 무관하게 언제나 우선한다(배대지 경로가 여기로 들어온다)
 *
 * 🔴 모르는 배송비를 0 이나 «일본 값» 으로 메우지 않는다. null 이 그대로
 *    computeUnifiedPriceDecision 에서 dataCompleteness="INCOMPLETE" →
 *    🟠 "비용 확인 필요" 로 흐른다. 이 저장소가 환율·관세에서 지키는 규칙과 같다.
 *
 * ── 지어낸 값이 없다는 것 ───────────────────────────────────────────────
 * 아래에 새 배송 요금표는 하나도 없다. 미국·독일·뉴질랜드 요금을 «모른다» 고
 * 말하는 것이 이 파일의 전부다. 상품가는 GOLF-02/03 에서 이미 조사한 상품의
 * 표시가격이고, 환율은 넘기지 않아 저장소의 FIXED_RATES_TO_KRW 폴백을 쓴다
 * (isEstimate=true 로 나간다) — 검증 대상이 배송비 갈래뿐이라 상품가의 정확도는
 * 이 파일의 주장에 들어가지 않는다.
 */

/** 골프공 1개 최대 중량 45.93g(R&A/USGA) × 12. GOLF-02 와 같은 값이다. */
const DOZEN_BALL_MIN_WEIGHT_KG = 0.55116;

/** Frankfurter(ECB) 2026-09-15 — GOLF-02/03 과 같은 소스·같은 값. */
const RATES_2026_09_15 = { JPY: 1568.32 / 178.86 } as const;

/**
 * GOLF-02/03 에서 이미 조사한 «일본이 아닌» 출발국 상품. 새로 찾은 상품이 아니다.
 * 상품가는 각 판매처가 실제로 표시한 값이고, 여기서 검증하는 것은 그 값이 아니라
 * «그 상품에 일본 EMS 요금이 붙는가» 하나다.
 */
const NON_JAPAN_SOURCES = [
  { label: "Vice Pro 1더즌 — 미국 공식몰", amount: 41.99, currency: "USD", originCountry: "US" },
  { label: "Vice Pro 1더즌 — 독일 공식몰", amount: 45.99, currency: "EUR", originCountry: "DE" },
  { label: "Titleist PRO V1 — 뉴질랜드", amount: 41.99, currency: "USD", originCountry: "NZ" },
  { label: "Mizuno Pro X — 영국", amount: 45.0, currency: "GBP", originCountry: "GB" },
] as const;

describe("GOLF-04 STEP 1 — 일본 EMS 요금은 출발국이 일본일 때만 붙는다", () => {
  it("우리가 가진 중량기반 요금표는 일본발 하나뿐이다", () => {
    // 이 상수가 "JP" 가 아니게 되는 날은 새 요금표를 실제로 확인한 날이어야 한다.
    expect(EMS_RATE_TABLE_ORIGIN_COUNTRY).toBe("JP");
  });

  it("🔴 출발국이 일본이 아니면 국제배송비를 계산하지 않는다 — 일본 EMS 를 대신 쓰지 않는다", () => {
    for (const s of NON_JAPAN_SOURCES) {
      const cost = computeGolfLandedCost({
        sourcePriceAmount: s.amount,
        sourcePriceCurrency: s.currency,
        actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
        originCountry: s.originCountry,
      });

      expect(cost.internationalShippingKrw, s.label).toBeNull();
      expect(cost.shippingStatus, s.label).toBe("unknown");
      expect(cost.emsEstimate, s.label).toBeNull();
      // 배송비가 없으면 과세가격(CIF)도 만들 수 없다 — 세금 쪽으로도 새지 않는다.
      expect(cost.customsValueKrw, s.label).toBeNull();
      // 원가 조각도 unknown 이어야 한다. 값이 null 인데 status 가 estimated 면
      // 화면은 "추정치가 있다" 고 읽는다.
      expect(cost.components.internationalShippingKrw.status, s.label).toBe("unknown");
      expect(cost.components.internationalShippingKrw.value, s.label).toBeNull();
      // 왜 비었는지 셀러가 읽을 수 있어야 한다. 그리고 그 문장이 일본을 말하면 안 된다.
      const shippingNote = cost.notes.find((n) => n.includes("국제배송비"));
      expect(shippingNote, s.label).toBeDefined();
      expect(shippingNote, s.label).toContain(s.originCountry);
      expect(shippingNote, s.label).not.toContain("EMS");
    }
  });

  it("🔴 출발국을 모르면 계산하지 않는다 — 기본값이 «일본» 이 되어서는 안 된다", () => {
    const unknownOrigin = computeGolfLandedCost({
      sourcePriceAmount: 4950,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      // originCountry 를 넘기지 않는다. 통화가 JPY 라고 출발국이 일본인 것은 아니다.
    });
    expect(unknownOrigin.internationalShippingKrw).toBeNull();
    expect(unknownOrigin.shippingStatus).toBe("unknown");

    // 🔴 핵심 회귀 방지: «출발국 미상» 의 결과가 «출발국 JP» 의 결과와 같아지면
    //    그건 우리가 모르는 것을 일본으로 가정했다는 뜻이다.
    const japanOrigin = computeGolfLandedCost({
      sourcePriceAmount: 4950,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: "JP",
    });
    expect(japanOrigin.internationalShippingKrw).not.toBeNull();
    expect(unknownOrigin.internationalShippingKrw).not.toBe(japanOrigin.internationalShippingKrw);
  });

  it("출발국 JP 는 일본 EMS 요금표로 계산한다 — 출발국 문은 일본 경로를 막지 않는다", () => {
    // 🔴 SHIPPING-POLICY-01 ①(2026-09-16) — 이 줄의 기댓값이 ¥3,400 → ¥1,600 으로
    //    바뀌었다. 출발국 문(GOLF-04)이 아니라 **요금표**가 바뀌었기 때문이다:
    //    0.551kg 은 일본우편 공개 요금표(第1地帯)의 600g 구간 ¥1,600 이고,
    //    ¥3,400 은 2kg 구간이다. 우리 표에 600g 칸이 없어서 2kg 요금을 씌우고 있었다.
    //    역방향 증명(수정 전 코드): AssertionError: expected 1600 to be 3400
    const cost = computeGolfLandedCost({
      sourcePriceAmount: 4950,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: "JP",
    });
    expect(cost.shippingStatus).toBe("estimated");
    expect(cost.emsEstimate?.jpy).toBe(1600);
    expect(cost.emsEstimate?.bracketUptoKg).toBe(0.6);
    expect(cost.internationalShippingKrw).toBe(Math.round(1600 * RATES_2026_09_15.JPY));

    // 소문자·공백도 같은 나라다(buyer-import-charge 가 origin 을 다루는 방식과 동일).
    const lower = computeGolfLandedCost({
      sourcePriceAmount: 4950,
      sourcePriceCurrency: "JPY",
      liveRates: RATES_2026_09_15,
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: " jp ",
    });
    expect(lower.internationalShippingKrw).toBe(cost.internationalShippingKrw);
  });

  it("셀러가 아는 실비는 출발국과 무관하게 우선한다 — 배대지 경로가 이 문으로 들어온다", () => {
    // STEP 4 의 «배대지 조달원가» 는 새 엔진이 아니라 이 필드로 들어온다:
    //   (현지 판매처→배대지) + (배대지→한국) 을 셀러가 합산해 넣으면 actual 이다.
    const forwarded = computeGolfLandedCost({
      sourcePriceAmount: 41.99,
      sourcePriceCurrency: "USD",
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: "US",
      knownInternationalShippingKrw: 23000,
    });
    expect(forwarded.internationalShippingKrw).toBe(23000);
    expect(forwarded.shippingStatus).toBe("actual");
    expect(forwarded.emsEstimate).toBeNull();
    expect(forwarded.components.internationalShippingKrw.status).toBe("actual");
    // 실비가 들어왔으니 과세가격은 만들어진다 — «모름» 이 풀린 것이다.
    expect(forwarded.customsValueKrw).not.toBeNull();
  });

  it("🔴 기존 Kids 경로는 이 문을 지나가지도 않는다 — 출발국 문은 중량기반 카테고리에만 달렸다", () => {
    // 아동의류는 weightBasedShipping=false 라, 애초에 EMS 갈래로 들어오지 않는다.
    // (실제 Kids 원가는 computePriceBreakdown + DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw
    //  = ₩12,000 로 계산되고, computeGolfLandedCost 를 부르지 않는다.)
    // 여기서 확인하는 것은 «이번 변경이 그 카테고리의 동작을 바꾸지 않았다» 는 것이다:
    // 출발국을 몰라도 새 «출발국 확인 필요» 문구가 붙지 않아야 한다.
    const kids = computeGolfLandedCost({
      sourcePriceAmount: 75,
      sourcePriceCurrency: "EUR",
      categoryProfileId: "KIDS_FASHION",
      actualWeightKg: 0.3,
    });
    expect(kids.policy.id).toBe("KIDS_FASHION");
    expect(kids.policy.weightBasedShipping).toBe(false);
    expect(kids.notes.some((n) => n.includes("출발국"))).toBe(false);
    // 중량기반이 아니므로 EMS 추정 자체가 없다 — 변경 전후가 같다.
    expect(kids.emsEstimate).toBeNull();
    expect(kids.shippingStatus).toBe("unknown");
  });

  it("🔴 관부가세는 여전히 판매자 원가 components 에 없다 (b5becbd · GOLF-01-TAX 구조 유지)", () => {
    const cost = computeGolfLandedCost({
      sourcePriceAmount: 41.99,
      sourcePriceCurrency: "USD",
      actualWeightKg: DOZEN_BALL_MIN_WEIGHT_KG,
      originCountry: "US",
      knownInternationalShippingKrw: 23000,
    });
    expect(Object.keys(cost.components).sort()).toEqual(["internationalShippingKrw", "sourceProductPriceKrw"]);
  });
});
