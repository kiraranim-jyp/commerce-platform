import { describe, expect, it } from "vitest";
import { computeMarketAlert, isValidChange, type MarketAlertInput } from "../market-alert";
import type { SellerActionResult } from "../seller-action";

function sellerAction(overrides: Partial<SellerActionResult> = {}): SellerActionResult {
  return {
    status: "INSUFFICIENT_DATA",
    icon: "⚪",
    title: "비교 데이터가 부족합니다",
    signals: [],
    reasons: [],
    opportunity: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<MarketAlertInput> = {}): MarketAlertInput {
  return {
    sellerAction: sellerAction(),
    domesticChange: null,
    originChange: null,
    ...overrides,
  };
}

describe("computeMarketAlert — N-4.18-K STEP K-8(대표님 지시, 2026-08-26: 10개 케이스)", () => {
  it("1) 국내 가격 상승 → PRICE_KEEP 상태에서는 알림을 만들지 않는다(가격 상승은 위험 신호가 아님)", () => {
    const result = computeMarketAlert(
      baseInput({
        sellerAction: sellerAction({ status: "PRICE_KEEP", title: "현재 가격 유지 권장" }),
        domesticChange: { amountKrw: 10000, ratePercent: 8 },
      }),
    );
    expect(result).toBeNull();
  });

  it("2) 국내 가격 하락 + PRICE_REVIEW + 유효한 변화 → 🟡 REVIEW", () => {
    const result = computeMarketAlert(
      baseInput({
        sellerAction: sellerAction({
          status: "PRICE_REVIEW",
          title: "가격 조정 검토",
          reasons: ["국내 최저가 ₩199,000", "최저가 대비 +12%"],
        }),
        domesticChange: { amountKrw: -20000, ratePercent: -9 },
      }),
    );
    expect(result?.severity).toBe("REVIEW");
    expect(result?.category).toBe("PRICE_GAP");
  });

  it("3) 내 가격이 최저가보다 높음(PRICE_ADJUST) → 🔴 ACTION_REQUIRED", () => {
    const result = computeMarketAlert(
      baseInput({
        sellerAction: sellerAction({
          status: "PRICE_ADJUST",
          title: "가격 조정이 필요할 수 있습니다",
          reasons: ["최저가 대비 +20.5%"],
        }),
      }),
    );
    expect(result?.severity).toBe("ACTION_REQUIRED");
    expect(result?.category).toBe("PRICE_GAP");
    expect(result?.detail).toContain("20.5%");
  });

  it("4) 내 가격이 평균보다 낮음(PRICE_KEEP) → 알림 없음(정상 상태)", () => {
    const result = computeMarketAlert(
      baseInput({ sellerAction: sellerAction({ status: "PRICE_KEEP", title: "현재 가격 유지 권장" }) }),
    );
    expect(result).toBeNull();
  });

  it("5) 해외 원가 상승(유효 변화) 단독 → 🔵 INFO", () => {
    const result = computeMarketAlert(
      baseInput({ originChange: { amountKrw: 6000, ratePercent: 4.2 } }),
    );
    expect(result?.severity).toBe("INFO");
    expect(result?.category).toBe("ORIGIN_TREND");
    expect(result?.detail).toContain("상승");
  });

  it("6) 해외 원가 하락(유효 변화) 단독 → 🔵 INFO", () => {
    const result = computeMarketAlert(
      baseInput({ originChange: { amountKrw: -8000, ratePercent: -5.1 } }),
    );
    expect(result?.severity).toBe("INFO");
    expect(result?.detail).toContain("하락");
  });

  it("7) 경쟁상품 품절(opportunity 존재) → 🔴 ACTION_REQUIRED(판매 기회)", () => {
    const result = computeMarketAlert(
      baseInput({
        sellerAction: sellerAction({
          status: "PRICE_REVIEW",
          opportunity: { icon: "💡", title: "판매 기회", detail: "경쟁 판매처 3곳이 품절되었습니다." },
        }),
      }),
    );
    expect(result?.severity).toBe("ACTION_REQUIRED");
    expect(result?.category).toBe("OPPORTUNITY");
    expect(result?.title).toBe("판매 기회");
  });

  it("8) 변화 없음 → 알림 생성 안 됨(필수 검증)", () => {
    const result = computeMarketAlert(baseInput());
    expect(result).toBeNull();
  });

  it("L-6 회귀) PRICE_REVIEW는 domesticChange가 없어도(7일 추세 미형성) REVIEW를 낸다 — " +
    "실제 production 5개 상품 재현: 7일 추세는 관측이 2건 이상 쌓여야 생기는데, K-1 실측대로 " +
    "아직 반복 관측 자체가 드물어 이 게이트가 있으면 PRICE_REVIEW 알림이 사실상 전혀 안 만들어짐", () => {
    const result = computeMarketAlert(
      baseInput({
        sellerAction: sellerAction({ status: "PRICE_REVIEW", title: "가격 조정 검토" }),
        domesticChange: null,
      }),
    );
    expect(result?.severity).toBe("REVIEW");
  });

  it("9) 데이터 부족(INSUFFICIENT_DATA) → 알림 생성 안 됨(판단 보류, 경쟁력 없음으로 해석 안 함)", () => {
    const result = computeMarketAlert(baseInput({ sellerAction: sellerAction() }));
    expect(result).toBeNull();
    expect(result).not.toBe(undefined);
  });

  it("isValidChange: 변화율 3% 이상이면 유효(금액 무관)", () => {
    expect(isValidChange({ amountKrw: 100, ratePercent: 3 })).toBe(true);
    expect(isValidChange({ amountKrw: 100, ratePercent: 2.9 })).toBe(false);
  });

  it("isValidChange: 변화금액 5,000원 이상이면 유효(비율 무관)", () => {
    expect(isValidChange({ amountKrw: 5000, ratePercent: 0.5 })).toBe(true);
    expect(isValidChange({ amountKrw: 4999, ratePercent: 0.5 })).toBe(false);
  });

  it("isValidChange: 데이터 자체가 없으면 항상 false(지어내지 않는다)", () => {
    expect(isValidChange(null)).toBe(false);
    expect(isValidChange({ amountKrw: null, ratePercent: null })).toBe(false);
  });

  it("우선순위: PRICE_ADJUST + opportunity가 동시에 있어도 PRICE_ADJUST(가격갭)를 우선한다", () => {
    const result = computeMarketAlert(
      baseInput({
        sellerAction: sellerAction({
          status: "PRICE_ADJUST",
          title: "가격 조정이 필요할 수 있습니다",
          opportunity: { icon: "💡", title: "판매 기회", detail: "..." },
        }),
      }),
    );
    // PRICE_ADJUST 분기가 opportunity보다 먼저 체크되므로 PRICE_GAP이 나온다 —
    // 실제로는 seller-action.ts의 opportunity 계산 자체가 PRICE_ADJUST와
    // 동시에 나오지 않도록 설계돼 있지만(soldOutCount>0 && status!=="PRICE_ADJUST"),
    // 이 함수 레벨에서도 방어적으로 우선순위를 명시한다.
    expect(result?.category).toBe("PRICE_GAP");
  });
});
