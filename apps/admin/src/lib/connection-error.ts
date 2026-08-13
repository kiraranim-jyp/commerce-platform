/**
 * N-3.14(CPO 지시: "커머스 계정 관리 통합") — 쿠팡/네이버/향후 커머스의 연결
 * 확인 실패를 공통 타입으로 분류한다. 각 커머스의 원본 오류(HTTP status,
 * network exception 등)는 형식이 다 다르지만, 사용자에게는 항상 같은 6종
 * 카테고리로 보여준다 — "쿠팡은 이렇게 보이고 네이버는 저렇게 보인다"는
 * 불일치를 막는다. 원본 에러(디버그 정보)는 이 파일이 만들지 않는다 — 기존
 * auth-test 라우트들의 debug 필드를 그대로 서버 로그/응답에 남기고, 여기서는
 * "사용자에게 보여줄 문구"만 만든다.
 */
export type ConnectionErrorType =
  | "AUTHENTICATION_ERROR"
  | "PERMISSION_ERROR"
  | "MISSING_REQUIRED_FIELD"
  | "NETWORK_ERROR"
  | "PROVIDER_SERVER_ERROR"
  | "UNKNOWN_ERROR";

export interface ConnectionErrorInfo {
  errorType: ConnectionErrorType;
  userMessage: string;
  nextAction: string;
}

/** HTTP status 기반 분류 — 401(인증)/403(권한)/5xx(서버)만 명확히 구분한다.
 * 해당 없으면 null을 돌려주고 호출자가 다른 분류(네트워크/알 수 없음)로 넘어간다. */
export function classifyHttpStatus(httpStatus: number | undefined, providerLabel: string): ConnectionErrorInfo | null {
  if (httpStatus === undefined) return null;
  if (httpStatus === 401) {
    return {
      errorType: "AUTHENTICATION_ERROR",
      userMessage: "API 인증 정보가 올바르지 않습니다.",
      nextAction: "입력한 Access Key/Secret Key(또는 Client ID/Secret) 값을 다시 확인해 주세요.",
    };
  }
  if (httpStatus === 403) {
    return {
      errorType: "PERMISSION_ERROR",
      userMessage: "API 사용 권한이 없습니다.",
      nextAction: `${providerLabel} 판매자센터에서 API 사용 권한이 활성화되어 있는지 확인해 주세요.`,
    };
  }
  if (httpStatus >= 500) {
    return {
      errorType: "PROVIDER_SERVER_ERROR",
      userMessage: `${providerLabel} 서비스에서 일시적인 오류가 발생했습니다.`,
      nextAction: "잠시 후 다시 연결 확인을 시도해 주세요.",
    };
  }
  return null;
}

/** fetch 실패(네트워크 예외) 분류 — ECONNREFUSED/ETIMEDOUT/network 관련
 * 메시지는 NETWORK_ERROR로, 그 외 예상 못 한 예외는 UNKNOWN_ERROR로 처리한다. */
export function classifyNetworkError(error: unknown): ConnectionErrorInfo {
  const rawMessage = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|network|fetch failed/i.test(rawMessage)) {
    return {
      errorType: "NETWORK_ERROR",
      userMessage: "커머스 서버에 연결할 수 없습니다.",
      nextAction: "커머스 서비스의 일시적인 장애일 수 있습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    errorType: "UNKNOWN_ERROR",
    userMessage: "연결 확인 중 문제가 발생했습니다.",
    nextAction: "잠시 후 다시 시도해 주세요.",
  };
}

/** 필수 입력값 누락 — fieldLabel에 구체적인 필드명을 넣어 "무엇이 없는지"까지
 * 안내한다(CPO 지시: "누락된 정보: Vendor ID"처럼 구체적으로). */
export function missingFieldError(fieldLabel: string): ConnectionErrorInfo {
  return {
    errorType: "MISSING_REQUIRED_FIELD",
    userMessage: "필수 연결 정보가 입력되지 않았습니다.",
    nextAction: `누락된 정보: ${fieldLabel}. 입력한 후 다시 연결 확인을 눌러주세요.`,
  };
}
