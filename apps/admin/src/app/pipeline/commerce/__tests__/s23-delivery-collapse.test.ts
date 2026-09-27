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
  ])("%s — 설정값이 있으면 picker 를 그리지 않는다", (_label, field) => {
    expect(PANEL).toContain(`{!(!form.delivery.${field}.trim() && sellerFixed?.${field}) && (`);
  });
});

describe("② 🔴 설정이 «비어 있으면» 고르는 길이 열린다", () => {
  /* 조건이 「폼이 비었고 && 설정에 값이 있다」일 때만 숨긴다. 설정이 비면
     그 조건이 거짓이라 picker 가 그대로 선다 — 등록할 방법을 잃지 않는다. */
  it("조건이 «설정값 존재» 를 함께 본다", () => {
    for (const field of ["outboundPlaceNo", "returnPlaceNo", "deliveryCostPolicyNo"]) {
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
