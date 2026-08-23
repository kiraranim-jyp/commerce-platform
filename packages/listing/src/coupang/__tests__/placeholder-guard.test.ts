import { describe, expect, it } from "vitest";
import { findPlaceholderFields } from "../build-payload";

/**
 * N-4.08 후속(CPO 지시, 2026-08-21) — 실제 고객 상세페이지에 "[배송안내]
 * 메세지 1" 같은 개발용 placeholder 문구가 그대로 노출된 사고의 재발 방지
 * 회귀 테스트. 이 사고의 근본 원인은 코드 버그가 아니라 데이터 상태(placeholder
 * 템플릿이 isDefault=true로 지정됨)였다 — 그래서 여기서 고정하는 계약은
 * "이런 내용이 있으면 항상 감지된다"이지, 등록을 막는 계약이 아니다.
 */
describe("findPlaceholderFields()", () => {
  it("고객 사고를 일으킨 실제 placeholder 5종을 모두 감지한다", () => {
    const fields = findPlaceholderFields({
      shippingInfo: "[배송안내] 메세지 1",
      exchangeInfo: "[교환안내] 메세지 1",
      returnInfo: "[반품안내] 메세지 1",
      agentBuyInfo: "[구매대행 안내] 메세지 1",
      asInfo: "[A/S 안내] 메세지 1",
    });
    expect(fields).toEqual(["배송안내", "교환안내", "반품안내", "구매대행 안내", "A/S 안내"]);
  });

  it("정상 내용만 있는 템플릿은 빈 배열을 반환한다", () => {
    const fields = findPlaceholderFields({
      shippingInfo: "상세페이지 참조",
      exchangeInfo: "상세페이지 참조",
      returnInfo: "상세페이지 참조",
      agentBuyInfo: "상세페이지 참조",
      asInfo: "해외구매대행으로 A/S 불가",
    });
    expect(fields).toEqual([]);
  });

  it("일부 필드만 placeholder면 해당 필드만 반환한다", () => {
    const fields = findPlaceholderFields({
      shippingInfo: "3-5 영업일 내 출고됩니다.",
      exchangeInfo: "[교환안내] 메세지 1",
      returnInfo: "구매 후 7일 이내 반품 가능합니다.",
      agentBuyInfo: "",
      asInfo: "",
    });
    expect(fields).toEqual(["교환안내"]);
  });

  it("빈 문자열/undefined는 placeholder로 오탐하지 않는다", () => {
    const fields = findPlaceholderFields({
      shippingInfo: "",
      exchangeInfo: undefined,
      returnInfo: "",
      agentBuyInfo: undefined,
      asInfo: "",
    });
    expect(fields).toEqual([]);
  });

  it("텍스트 1, 메시지 2 등 유사 변형도 감지한다", () => {
    expect(findPlaceholderFields({ shippingInfo: "텍스트 1" }).length).toBe(1);
    expect(findPlaceholderFields({ shippingInfo: "메시지 2" }).length).toBe(1);
    expect(findPlaceholderFields({ shippingInfo: "정상 배송 안내문입니다." }).length).toBe(0);
  });
});
