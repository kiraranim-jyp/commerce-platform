/**
 * LOTTEON COMMERCE SPRINT 2 — 🔴 최우선 안전 요건(CEO/CPO 지시, 2026-09-14).
 *
 * 롯데ON 판매관리 쓰기 API는 **되돌릴 수 없는 실제 고객 주문**을 건드린다.
 * 특히 `210 연동완료통보`(SellerIfCompleteInform)는 호출되는 즉시 주문을
 * "상품준비중"(회수건은 "회수진행")으로 자동 전이시킨다 — 취소 버튼이 없다.
 *
 * 조사 문서(docs/lotteon-commerce-sprint-2-survey.md §5-2, §6-3)가 확인한 대로
 * 209 주문조회 문서는 "데이터 수신 후 연동완료 통보를 필히 수행"이라고 권한다.
 * 그 권고를 따르는 코드가 **실수로라도 209 조회 뒤에 자동으로 붙는 것**이 이
 * 스프린트에서 가장 위험한 사고 시나리오다. 그래서 "구현하지 않는다"로 끝내지
 * 않고, HTTP 클라이언트 자체가 이 경로들을 **거부하도록** 막는다.
 *
 * 이 파일에는 네트워크/Next.js 의존이 하나도 없다 — 순수 함수만 둔다. 그래야
 * 테스트(`__tests__/forbidden-endpoints.test.ts`)가 실제 fetch를 흉내낼 필요
 * 없이 "금지 경로를 넣으면 예외가 난다"를 그대로 고정할 수 있다.
 *
 * 이 목록에서 경로를 빼는 것은 코드 정리가 아니다 — CEO 승인이 필요한
 * 스코프 변경이다(Phase 4 STOP).
 */

export interface ForbiddenLotteOnEndpoint {
  /** 롯데ON API 문서의 apiNo — 조사 문서 §5-2 표와 대조할 수 있게 남긴다. */
  apiNo: number;
  path: string;
  label: string;
  /** 왜 금지인가 — 예외 메시지에 그대로 실린다. */
  reason: string;
}

/**
 * 호출 시도 자체가 예외가 되는 경로. 전부 "실제 고객 주문의 상태를 되돌릴 수
 * 없게 바꾸는" 판매관리 쓰기 API다(조사 §5-3 쓰기 목록 중 주문/배송/클레임 축).
 *
 * 여기 없는 쓰기 API(87 상품등록 등 상품 축)는 이번 스프린트에서 허용된
 * 쓰기다 — 상품은 등록 후 `판매중지`로 되돌릴 수 있고, 기존 쿠팡/스마트스토어와
 * 동일한 검증 관행이 성립한다(조사 §6-3).
 */
export const FORBIDDEN_LOTTEON_ENDPOINTS: readonly ForbiddenLotteOnEndpoint[] = [
  {
    apiNo: 210,
    path: "/v1/openapi/delivery/v1/SellerIfCompleteInform",
    label: "연동완료통보",
    reason:
      "호출 즉시 주문이 상품준비중(회수건은 회수진행)으로 자동 전이되고 되돌릴 수 없다. 이번 스프린트는 주문을 조회만 한다 — 실제 주문 처리는 롯데ON 판매자센터에서 한다.",
  },
  {
    apiNo: 137,
    path: "/v1/openapi/delivery/v1/SellerDeliveryProgressStateInform",
    label: "배송상태 통보 / 송장번호 등록",
    reason: "실제 고객 주문의 배송상태를 바꾼다(Phase 4 STOP — 테스트 주문을 만들 수단이 없다).",
  },
  {
    apiNo: 298,
    path: "/v1/openapi/delivery/v2/SellerDeliveryProgressStateInform",
    label: "배송상태 통보 V2",
    reason: "실제 고객 주문의 배송상태를 바꾼다(Phase 4 STOP).",
  },
  {
    apiNo: 138,
    path: "/v1/openapi/delivery/v1/SellerDeliveryAppointmentInform",
    label: "발송약정일 통보",
    reason: "실제 고객 주문의 발송 약정을 바꾼다(Phase 4 STOP).",
  },
  {
    apiNo: 139,
    path: "/v1/openapi/delivery/v1/SellerInvoiceNoModifyInform",
    label: "송장 수정",
    reason: "실제 고객 주문의 송장 정보를 바꾼다(Phase 4 STOP).",
  },
  {
    apiNo: 141,
    path: "/v1/openapi/delivery/v1/SellerRetrievalExceptionInform",
    label: "회수예외 통보",
    reason: "실제 회수건의 상태를 바꾼다(Phase 4 STOP).",
  },
  {
    apiNo: 60,
    path: "/v1/openapi/claim/v1/cancellationOpenApi/cnclRequestApproval",
    label: "취소요청 승인",
    reason: "실제 고객 취소를 승인하고 환불이 뒤따른다 — 되돌릴 수 없다(Phase 4 STOP).",
  },
  {
    apiNo: 59,
    path: "/v1/openapi/claim/v1/cancellationOpenApi/cnclRequestHold",
    label: "취소요청 거부",
    reason: "실제 고객 취소 요청을 거부한다 — 고객 클레임으로 직결된다(Phase 4 STOP).",
  },
  {
    apiNo: 225,
    path: "/v1/openapi/claim/v1/cancellationOpenApi/slrDirectCnclProc",
    label: "판매자 직접취소",
    reason: "판매자가 실제 고객 주문을 직접 취소한다 — 되돌릴 수 없다(Phase 4 STOP).",
  },
  {
    apiNo: 64,
    path: "/v1/openapi/claim/v1/cancellationOpenApi/purCfrmCncl",
    label: "구매확정 후 취소 처리",
    reason: "구매확정된 실제 주문을 취소한다(Phase 4 STOP).",
  },
  {
    apiNo: 52,
    path: "/v1/openapi/claim/v1/returningOpenApi/returnRequestApproval",
    label: "반품 승인",
    reason: "실제 반품을 승인하고 환불이 뒤따른다(Phase 4 STOP).",
  },
  {
    apiNo: 53,
    path: "/v1/openapi/claim/v1/returningOpenApi/returnRequestHold",
    label: "반품 거부",
    reason: "실제 고객 반품 요청을 거부한다(Phase 4 STOP).",
  },
  {
    apiNo: 71,
    path: "/v1/openapi/claim/v1/exchangeOpenApi/exchangeRequestApproval",
    label: "교환 승인",
    reason: "실제 교환을 승인한다(Phase 4 STOP).",
  },
  {
    apiNo: 72,
    path: "/v1/openapi/claim/v1/exchangeOpenApi/exchangeRequestHold",
    label: "교환 거부",
    reason: "실제 고객 교환 요청을 거부한다(Phase 4 STOP).",
  },
  {
    apiNo: 66,
    path: "/v1/openapi/claim/v1/nonReceiptDeclareOpenApi/noReceiveCancelReq",
    label: "미수령신고 철회요청",
    reason: "실제 미수령 신고건의 상태를 바꾼다(Phase 4 STOP).",
  },
] as const;

/** 금지 엔드포인트 호출 시도. 잡아서 무시하지 말고 그대로 터뜨려야 한다. */
export class ForbiddenLotteOnEndpointError extends Error {
  readonly endpoint: ForbiddenLotteOnEndpoint;

  constructor(endpoint: ForbiddenLotteOnEndpoint) {
    super(
      `롯데ON 금지 엔드포인트 호출이 차단되었습니다 — apiNo ${endpoint.apiNo} ${endpoint.label} (${endpoint.path}). ${endpoint.reason}`,
    );
    this.name = "ForbiddenLotteOnEndpointError";
    this.endpoint = endpoint;
  }
}

/** 쿼리스트링/호스트/대소문자/중복 슬래시 차이로 guard를 빠져나가지 못하게 한다. */
function normalizePath(pathOrUrl: string): string {
  let value = pathOrUrl.trim();
  const queryIndex = value.search(/[?#]/);
  if (queryIndex >= 0) value = value.slice(0, queryIndex);
  // 절대 URL로 넘어와도 경로만 본다(호스트를 바꿔치기해도 막힌다).
  const schemeMatch = /^https?:\/\/[^/]+(\/.*)?$/i.exec(value);
  if (schemeMatch) value = schemeMatch[1] ?? "/";
  value = value.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  if (!value.startsWith("/")) value = `/${value}`;
  return value.toLowerCase();
}

/** 이 경로가 금지 목록에 있으면 해당 항목을, 아니면 null을 돌려준다(순수 함수). */
export function findForbiddenLotteOnEndpoint(pathOrUrl: string): ForbiddenLotteOnEndpoint | null {
  const normalized = normalizePath(pathOrUrl);
  return (
    FORBIDDEN_LOTTEON_ENDPOINTS.find((entry) => {
      const target = normalizePath(entry.path);
      // 정확히 일치하거나, 경로 세그먼트 경계에서 끝나는 경우까지 막는다
      // (예: 프록시 접두사가 앞에 붙은 형태).
      return normalized === target || normalized.endsWith(target);
    }) ?? null
  );
}

/**
 * 롯데ON HTTP 클라이언트가 요청을 보내기 **전에** 반드시 통과해야 하는 관문.
 * 금지 경로면 네트워크 호출 없이 throw 한다.
 */
export function assertLotteOnEndpointAllowed(pathOrUrl: string): void {
  const forbidden = findForbiddenLotteOnEndpoint(pathOrUrl);
  if (forbidden) throw new ForbiddenLotteOnEndpointError(forbidden);
}
