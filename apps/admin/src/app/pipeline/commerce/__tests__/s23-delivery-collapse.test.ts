import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⑤ 배송 접기 — **설정이 채운 칸은 «다시 고르게» 하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 렌더 실측(2026-09-28)에서 나온 마지막 격차다.
 *
 *     Coupang ⑤배송   [배송비 · 반품/교환 안내]          2칸
 *     LotteON ⑤배송   [출고지 · 반품지 · 배송비 정책 ·
 *                      배송 가능 지역 · 택배사 ·
 *                      반품 택배사 · 평일 발송마감시간]   🔴 7칸
 *
 * S-8/9 로 판매자 설정이 «자동 적용» 되므로 셀러가 상품마다 다시 고를 일이
 * 없다. 그런데 고르는 컨트롤이 그대로 서 있으면 「또 골라야 하나」로 읽힌다 —
 * CEO 가 「롯데ON 만 다른 화면」이라고 본 실체가 이것이다.
 *
 * 🔴 칸을 «지우지 않았다». 설정이 비어 있으면 고르는 길이 그대로 열린다 —
 * 지워 버리면 설정을 아직 안 한 셀러가 등록할 방법을 잃는다.
 */

const PANEL = readFileSync(join(__dirname, "..", "LotteOnRegistrationPanel.tsx"), "utf8").replace(/\r\n/g, "\n");

describe("① 설정이 채운 칸은 고르는 컨트롤을 «숨긴다»", () => {
  it.each([
    ["출고지", "outboundPlaceNo"],
    ["반품지", "returnPlaceNo"],
    ["배송비 정책", "deliveryCostPolicyNo"],
    ["배송 가능 지역", "deliveryRegionGroupCode"],
  ])("%s — 설정값이 있으면 picker 를 그리지 않는다", (_label, field) => {
    expect(PANEL).toContain(`{!(!form.delivery.${field}.trim() && sellerFixed?.${field}) && (`);
  });
});

describe("② 🔴 설정이 «비어 있으면» 고르는 길이 열린다", () => {
  /* 조건이 「폼이 비었고 && 설정에 값이 있다」일 때만 숨긴다. 설정이 비면
     그 조건이 거짓이라 picker 가 그대로 선다 — 등록할 방법을 잃지 않는다. */
  it("조건이 «설정값 존재» 를 함께 본다", () => {
    for (const field of ["outboundPlaceNo", "returnPlaceNo", "deliveryCostPolicyNo", "deliveryRegionGroupCode"]) {
      expect(PANEL, field).toContain(`sellerFixed?.${field}) && (`);
    }
  });

  it("DeliveryOptionPicker 자체는 남아 있다", () => {
    expect(PANEL).toContain("<DeliveryOptionPicker");
  });
});

describe("③ 설정 적용 사실은 «그 자리에서» 말한다", () => {
  /* picker 를 숨긴 자리에 아무 말도 없으면 셀러는 값이 어디서 왔는지 모른다.
     SellerSettingApplied 가 「설정에서 왔다」를 그 줄에 적는다. */
  it("SellerSettingApplied 는 그대로 그린다", () => {
    expect(PANEL).toContain("<SellerSettingApplied");
  });
});

describe("④ 택배사 둘도 같은 규칙이다", () => {
  /* 이 둘은 belowInput 에 fragment 없이 컨트롤 하나만 있어서 삼항으로 접었다 —
     모양은 달라도 «판단» 은 같다: 폼이 비었고 설정에 값이 있으면 숨긴다. */
  it.each(["courierCode", "returnCourierCode"])("%s — 설정값이 있으면 숨긴다", (field) => {
    expect(PANEL).toContain(`!form.delivery.${field}.trim() && sellerFixed?.${field} ? null : (`);
  });

  /* 🔴 067 로 설정에 택배사 두 칸이 생겼다. 화면 타입이 그것을 모르면
     「설정이 채웠는가」를 판단할 수 없다 — 실제로 typecheck 가 먼저 막았다. */
  it("화면이 설정의 택배사 두 칸을 읽는다", () => {
    for (const key of ["courierCode", "courierLabel", "returnCourierCode", "returnCourierLabel"]) {
      expect(PANEL, key).toContain(`${key}: string | null;`);
    }
  });
});

describe("⑤ 🔴 ⑤배송의 «고르는 컨트롤» 여섯이 모두 조건부다", () => {
  it("평일 발송마감만 조건 없이 남는다 — 폼 기본값이라 셀러가 보는 편이 맞다", () => {
    const collapsed = [
      "outboundPlaceNo",
      "returnPlaceNo",
      "deliveryCostPolicyNo",
      "deliveryRegionGroupCode",
      "courierCode",
      "returnCourierCode",
    ];
    for (const field of collapsed) {
      expect(PANEL, field).toContain(`sellerFixed?.${field}`);
    }
    /* 발송마감은 설정에서 오지 않는다(폼 기본값 1400) — 접을 대상이 아니다. */
    expect(PANEL).not.toContain("sellerFixed?.weekdayCloseTime");
  });
});
