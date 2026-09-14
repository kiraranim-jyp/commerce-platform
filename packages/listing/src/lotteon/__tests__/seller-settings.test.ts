import { describe, expect, it } from "vitest";
import {
  LOTTEON_ONLY_DELIVERY_VALUES,
  LOTTEON_SHIP_BUDGET_DAYS_MAX,
  describeLotteOnSellerSettings,
  resolveLotteOnShipBudgetDays,
  type LotteOnSellerSettingsInput,
} from "../seller-settings";

/**
 * REWORK — 커머스 탭 구조 통일(CEO 지시, 2026-09-14).
 *
 * 셀러 설정 ↔ 롯데ON 판정은 **화면과 payload가 같은 함수를 봐야** 한다. 그
 * 함수의 경계(자동 반영 / 코드체계 다름 / 개념 없음)를 여기서 고정한다.
 */

function settings(overrides: Partial<LotteOnSellerSettingsInput> = {}): LotteOnSellerSettingsInput {
  return {
    outboundLeadTimeDays: 2,
    deliveryCompanyCode: "CJGLS",
    naverDeliveryCompanyCode: "CJ대한통운",
    outboundShippingPlaceCode: 7788,
    returnCenterCode: "RC-1004",
    topCommonImageEnabled: true,
    bottomCommonImageEnabled: false,
    ...overrides,
  };
}

describe("발송예정일수 — 셀러 설정의 '출고 소요일'이 단일 출처다", () => {
  it("값이 있으면 그대로 쓴다", () => {
    const resolved = resolveLotteOnShipBudgetDays(settings({ outboundLeadTimeDays: 1 }));
    expect(resolved).toMatchObject({ days: 1, source: "SELLER_SETTINGS" });
  });

  it("상한을 넘으면 자르고, 잘랐다는 사실을 숨기지 않는다", () => {
    const resolved = resolveLotteOnShipBudgetDays(settings({ outboundLeadTimeDays: 9 }));
    expect(resolved.days).toBe(LOTTEON_SHIP_BUDGET_DAYS_MAX);
    expect(resolved.source).toBe("SELLER_SETTINGS_CAPPED");
    // 셀러가 지킬 수 없는 발송 약속을 모르는 채로 하게 두지 않는다.
    expect(resolved.note).toContain("9일");
    expect(resolved.note).toContain(String(LOTTEON_SHIP_BUDGET_DAYS_MAX));
  });

  it("값이 없거나 이상하면 기존 기본값으로만 간다 — 지어내지 않는다", () => {
    for (const value of [null, 0, -1, Number.NaN]) {
      const resolved = resolveLotteOnShipBudgetDays(settings({ outboundLeadTimeDays: value }));
      expect(resolved.days).toBe(3);
      expect(resolved.source).toBe("FALLBACK");
    }
    expect(resolveLotteOnShipBudgetDays(null).source).toBe("FALLBACK");
  });

  it("소수점은 내림한다(일수는 정수다)", () => {
    expect(resolveLotteOnShipBudgetDays(settings({ outboundLeadTimeDays: 2.7 })).days).toBe(2);
  });
});

describe("셀러 설정 판정표", () => {
  it("개념이 있으나 코드체계가 다른 셋 — 값을 옮겨 적지 않는다", () => {
    const rows = describeLotteOnSellerSettings(settings());
    for (const label of ["출고지", "반품지", "택배사"]) {
      const row = rows.find((r) => r.label === label)!;
      expect(row.usage, label).toBe("CHANNEL_CODE_DIFFERS");
      // 셀러 설정에 실제로 값이 있다는 것은 보여준다(없다고 거짓말하지 않는다).
      expect(row.settingValue, label).not.toBeNull();
    }
  });

  it("셀러 설정에 개념 자체가 없는 값은 전부 settingValue가 null이다", () => {
    const rows = describeLotteOnSellerSettings(settings());
    const noConcept = rows.filter((r) => r.usage === "NO_SETTING_CONCEPT");
    expect(noConcept.map((r) => r.label)).toEqual(LOTTEON_ONLY_DELIVERY_VALUES.map((r) => r.label));
    expect(noConcept.every((r) => r.settingValue === null)).toBe(true);
    // 셀러 설정이 채워져 있어도 이 판정은 바뀌지 않는다 — 자리가 없는 것이다.
    expect(describeLotteOnSellerSettings(null).filter((r) => r.usage === "NO_SETTING_CONCEPT")).toHaveLength(
      LOTTEON_ONLY_DELIVERY_VALUES.length,
    );
  });

  it("모든 줄이 왜 그런지(note)와 롯데ON 대응 필드를 함께 갖는다", () => {
    for (const row of describeLotteOnSellerSettings(settings())) {
      expect(row.note.length, row.label).toBeGreaterThan(0);
      expect(row.lotteOnField, row.label).toBeTruthy();
    }
  });

  it("셀러 설정을 못 읽었으면 값 칸을 지어내지 않는다", () => {
    expect(describeLotteOnSellerSettings(null).every((r) => r.settingValue === null)).toBe(true);
  });
});
