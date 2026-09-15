import type { ConnectionErrorInfo } from "@/lib/connection-error";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 1 — 롯데ON 전용 실패 분류.
 *
 * 공용 @/lib/connection-error 의 classifyHttpStatus를 그대로 쓰지 않는 이유는
 * **403의 의미가 다르기 때문**이다. 쿠팡/네이버에서 403은 "API 사용 권한"이지만,
 * 롯데ON 문서(조사 §5-1)는 403을 **"IP 미등록"** 으로 명시한다. 같은 문구를
 * 보여주면 셀러가 판매자센터에서 엉뚱한 메뉴를 찾게 된다.
 *
 * 반환 타입(ConnectionErrorInfo)과 errorType 6종은 공용 규약을 그대로 쓴다 —
 * 화면(ConnectionErrorNotice)이 채널마다 다르게 보이면 안 되기 때문이다.
 */
const LOTTEON_STATUS_MESSAGE: Record<number, ConnectionErrorInfo> = {
  401: {
    errorType: "AUTHENTICATION_ERROR",
    userMessage: "API 인증키가 올바르지 않거나 만료되었습니다.",
    nextAction:
      "롯데ON 판매자센터 > 판매자정보 > OpenAPI관리에서 인증키를 확인해 주세요. 인증키 유효기간은 발급일로부터 1년입니다.",
  },
  403: {
    errorType: "PERMISSION_ERROR",
    userMessage: "서버 IP가 롯데ON에 등록되어 있지 않습니다.",
    nextAction:
      "롯데ON 판매자센터 > 판매자정보 > OpenAPI관리 > 정보설정에서 서버 IP를 등록해 주세요. 등록할 IP는 아래 debug의 proxyOutboundIp 값입니다(Vercel IP가 아닙니다).",
  },
  404: {
    errorType: "UNKNOWN_ERROR",
    userMessage: "롯데ON이 요청을 인식하지 못했습니다(비정상 Request).",
    nextAction: "호출 경로가 변경되었을 수 있습니다. 잠시 후 다시 시도하고, 반복되면 담당자에게 알려주세요.",
  },
  429: {
    errorType: "PROVIDER_SERVER_ERROR",
    userMessage: "롯데ON API 접속량 제한을 초과했습니다.",
    nextAction: "잠시 후 다시 시도해 주세요. 반복되면 롯데ON 스토어센터 1:1 문의로 한도 증설을 요청해야 합니다.",
  },
};

export function classifyLotteOnHttpStatus(httpStatus: number): ConnectionErrorInfo | null {
  const known = LOTTEON_STATUS_MESSAGE[httpStatus];
  if (known) return known;
  if (httpStatus >= 500) {
    return {
      errorType: "PROVIDER_SERVER_ERROR",
      userMessage: "롯데ON 서비스에서 일시적인 오류가 발생했습니다.",
      nextAction: "잠시 후 다시 연결 테스트를 시도해 주세요.",
    };
  }
  return null;
}

/**
 * REWORK-12 ②(CEO 실측 캡처, 2026-09-15) — **네트워크 실패의 한국어 사유.**
 *
 * 캡처에서 롯데ON 탭의 ② 카테고리 자리에 이 문장 하나만 서 있었다:
 *
 *     The operation was aborted due to timeout
 *
 * 그건 `AbortSignal.timeout()`이 던진 DOMException의 `error.message`다. client.ts
 * 가 그 값을 그대로 `message`에 담고(L153), request.ts 가 그대로 화면에 내려보내고
 * (NETWORK_ERROR 분기), 패널이 그대로 그렸다. 셀러에게 영문 예외 문자열을 보여주는
 * 것은 "사유를 말한 것"이 아니다 — 무엇이 실패했는지도, 다음에 뭘 하면 되는지도
 * 없다.
 *
 * 🔴 실패를 숨기지 않는다. 원문 예외는 `providerMessage`로 응답에 그대로 남는다
 * (디버깅 경로를 없애면 담당자가 원인을 못 찾는다). 화면에 서는 글자만 바뀐다.
 *
 * 분류는 지어내지 않는다 — Node/undici가 실제로 쓰는 문자열만 본다. 모르는
 * 문자열은 "연결하지 못했습니다"로 두고 원문을 nextAction에 붙인다.
 */
export function classifyLotteOnNetworkError(message: string | null): ConnectionErrorInfo {
  const raw = (message ?? "").trim();
  const lower = raw.toLowerCase();

  // AbortSignal.timeout() → DOMException(TimeoutError): "The operation was aborted due to timeout"
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return {
      // 🔴 errorType 6종(공용 규약)을 늘리지 않는다 — 타임아웃도 네트워크 실패다.
      errorType: "NETWORK_ERROR",
      userMessage: "롯데ON 응답이 제한 시간 안에 오지 않았습니다.",
      nextAction: "잠시 후 [다시 확인]을 눌러 주세요. 계속 반복되면 롯데ON 점검 여부를 확인해야 합니다.",
    };
  }
  // undici: ENOTFOUND / EAI_AGAIN(DNS) · ECONNREFUSED · ECONNRESET · socket hang up
  if (
    lower.includes("enotfound") ||
    lower.includes("eai_again") ||
    lower.includes("econnrefused") ||
    lower.includes("econnreset") ||
    lower.includes("socket hang up") ||
    lower.includes("fetch failed")
  ) {
    return {
      errorType: "NETWORK_ERROR",
      userMessage: "롯데ON 서버에 연결하지 못했습니다.",
      nextAction: "네트워크 또는 롯데ON 점검 중일 수 있습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
  return {
    errorType: "NETWORK_ERROR",
    userMessage: "롯데ON 요청이 실패했습니다.",
    nextAction: raw ? `잠시 후 다시 시도해 주세요. (원인: ${raw})` : "잠시 후 다시 시도해 주세요.",
  };
}

/**
 * 🔴 HTTP 200인데 실패인 경우(조사 §5-1 — "정상처리, 체크에서 에러값은
 * 리턴코드로 출력"). returnCode가 "0000"이 아니거나, 아예 파싱되지 않았을 때
 * 쓴다. returnCode 통합 코드표를 확보하지 못했으므로(조사 §11-3) 코드별 해석을
 * 지어내지 않고 롯데ON이 준 message를 그대로 보여준다.
 */
export function classifyLotteOnReturnCode(returnCode: string | null, message: string | null): ConnectionErrorInfo {
  if (returnCode == null) {
    return {
      errorType: "UNKNOWN_ERROR",
      userMessage: "롯데ON 응답을 해석하지 못했습니다(returnCode 없음).",
      nextAction: "응답 형식이 문서와 다릅니다. debug의 응답 원문을 담당자에게 전달해 주세요.",
    };
  }
  return {
    errorType: "PROVIDER_SERVER_ERROR",
    userMessage: `롯데ON이 요청을 거부했습니다(returnCode ${returnCode}).`,
    nextAction: message ? `롯데ON 응답: ${message}` : "잠시 후 다시 시도해 주세요.",
  };
}
