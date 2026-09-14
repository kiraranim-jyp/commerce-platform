import { describe, expect, it } from "vitest";
import {
  assertLotteOnEndpointAllowed,
  findForbiddenLotteOnEndpoint,
  ForbiddenLotteOnEndpointError,
  FORBIDDEN_LOTTEON_ENDPOINTS,
} from "../_lib/forbidden-endpoints";
import { callLotteOnApi, callLotteOnPickApi, LOTTEON_READ_PATHS, LOTTEON_WRITE_PATHS } from "../_lib/client";

/**
 * LOTTEON COMMERCE SPRINT 2 — 🔴 최우선 안전 요건을 **테스트로 고정**한다
 * (CEO/CPO 지시, 2026-09-14).
 *
 * 이 스위트가 지키는 사실은 하나다: **`210 연동완료통보`를 비롯한 판매관리 쓰기
 * 경로는 호출 시도 자체가 예외가 된다.** 누군가 "209 조회 뒤에 210을 붙이면
 * 문서 권고를 따르는 것"이라고 생각해 코드를 추가하는 순간, 네트워크에 나가기
 * 전에 여기서 막히고 이 테스트가 그 의도를 설명한다.
 *
 * 테스트가 실제 fetch를 하지 않는 것이 핵심이다 — guard가 호출 **전에** 터지기
 * 때문에 mock 없이도 검증된다. 만약 이 테스트가 네트워크를 타기 시작하면
 * guard가 뒤로 밀렸다는 뜻이다.
 */
const API_NO_210 = 210;

describe("롯데ON 금지 엔드포인트 guard", () => {
  it("210 연동완료통보는 목록에 있고, 이유가 '주문 상태 자동 전이'를 말한다", () => {
    const entry = FORBIDDEN_LOTTEON_ENDPOINTS.find((e) => e.apiNo === API_NO_210);
    expect(entry).toBeDefined();
    expect(entry?.path).toBe("/v1/openapi/delivery/v1/SellerIfCompleteInform");
    expect(entry?.reason).toContain("상품준비중");
  });

  it("210 경로를 넣으면 throw 한다", () => {
    expect(() => assertLotteOnEndpointAllowed("/v1/openapi/delivery/v1/SellerIfCompleteInform")).toThrow(
      ForbiddenLotteOnEndpointError,
    );
  });

  it("쿼리스트링 · 대소문자 · 중복 슬래시 · 절대 URL로도 우회할 수 없다", () => {
    const variants = [
      "/v1/openapi/delivery/v1/SellerIfCompleteInform?odNo=12345",
      "/v1/openapi/delivery/v1/sellerifcompleteinform",
      "//v1//openapi//delivery//v1//SellerIfCompleteInform",
      "/v1/openapi/delivery/v1/SellerIfCompleteInform/",
      "https://openapi.lotteon.com/v1/openapi/delivery/v1/SellerIfCompleteInform",
      "https://stg-openapi.lotteon.com/v1/openapi/delivery/v1/SellerIfCompleteInform?x=1",
    ];
    for (const variant of variants) {
      expect(() => assertLotteOnEndpointAllowed(variant), variant).toThrow(ForbiddenLotteOnEndpointError);
    }
  });

  it("판매관리 쓰기 API(배송상태 통보 · 취소/반품/교환 승인·거부 · 판매자 직접취소)가 전부 막힌다", () => {
    const mustBeBlocked = [
      "/v1/openapi/delivery/v1/SellerDeliveryProgressStateInform",
      "/v1/openapi/delivery/v2/SellerDeliveryProgressStateInform",
      "/v1/openapi/delivery/v1/SellerInvoiceNoModifyInform",
      "/v1/openapi/delivery/v1/SellerDeliveryAppointmentInform",
      "/v1/openapi/delivery/v1/SellerRetrievalExceptionInform",
      "/v1/openapi/claim/v1/cancellationOpenApi/cnclRequestApproval",
      "/v1/openapi/claim/v1/cancellationOpenApi/cnclRequestHold",
      "/v1/openapi/claim/v1/cancellationOpenApi/slrDirectCnclProc",
      "/v1/openapi/claim/v1/cancellationOpenApi/purCfrmCncl",
      "/v1/openapi/claim/v1/returningOpenApi/returnRequestApproval",
      "/v1/openapi/claim/v1/returningOpenApi/returnRequestHold",
      "/v1/openapi/claim/v1/exchangeOpenApi/exchangeRequestApproval",
      "/v1/openapi/claim/v1/exchangeOpenApi/exchangeRequestHold",
      "/v1/openapi/claim/v1/nonReceiptDeclareOpenApi/noReceiveCancelReq",
    ];
    for (const path of mustBeBlocked) {
      expect(findForbiddenLotteOnEndpoint(path), path).not.toBeNull();
    }
  });

  it("허용된 읽기 경로는 막지 않는다 — 조회까지 막히면 Phase 2가 통째로 죽는다", () => {
    for (const path of Object.values(LOTTEON_READ_PATHS)) {
      expect(findForbiddenLotteOnEndpoint(path), path).toBeNull();
    }
  });

  it("209 주문조회와 210 연동완료통보는 서로 다른 경로다 — 조회가 통보를 끌고 가지 않는다", () => {
    expect(findForbiddenLotteOnEndpoint(LOTTEON_READ_PATHS.ordersSearch)).toBeNull();
    expect(findForbiddenLotteOnEndpoint("/v1/openapi/delivery/v1/SellerIfCompleteInform")).not.toBeNull();
  });

  it("이번 스프린트에서 허용된 유일한 쓰기(87 상품등록)는 막지 않는다", () => {
    expect(findForbiddenLotteOnEndpoint(LOTTEON_WRITE_PATHS.productRegistration)).toBeNull();
  });

  it("클라이언트가 금지 경로로 호출되면 네트워크에 나가기 전에 reject 된다", async () => {
    await expect(
      callLotteOnApi("dummy-key-not-used", {
        method: "POST",
        path: "/v1/openapi/delivery/v1/SellerIfCompleteInform",
        body: { odNo: "1" },
      }),
    ).rejects.toBeInstanceOf(ForbiddenLotteOnEndpointError);
  });

  it("호스트를 onpick으로 바꿔도 guard는 그대로 적용된다", async () => {
    await expect(
      callLotteOnPickApi("dummy-key-not-used", {
        method: "POST",
        path: "/v1/openapi/delivery/v1/SellerIfCompleteInform",
      }),
    ).rejects.toBeInstanceOf(ForbiddenLotteOnEndpointError);
  });

  it("금지 목록의 모든 경로가 클라이언트에서 reject 된다(목록이 늘어나도 자동으로 검증)", async () => {
    for (const entry of FORBIDDEN_LOTTEON_ENDPOINTS) {
      await expect(
        callLotteOnApi("dummy-key-not-used", { method: "POST", path: entry.path }),
        `apiNo ${entry.apiNo}`,
      ).rejects.toBeInstanceOf(ForbiddenLotteOnEndpointError);
    }
  });
});
