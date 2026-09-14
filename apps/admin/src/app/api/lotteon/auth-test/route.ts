import { NextResponse } from "next/server";
import { classifyNetworkError, missingFieldError } from "@/lib/connection-error";
import { getOutboundProxyDiagnostics } from "@/lib/outbound-proxy";
import { getLotteOnCredentials } from "../_lib/env";
import { callLotteOnApi, getLotteOnOutboundIp, LOTTEON_READ_PATHS } from "../_lib/client";
import { classifyLotteOnHttpStatus, classifyLotteOnReturnCode } from "../_lib/connection-error";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 1 — 롯데ON 연결 테스트.
 *
 * `207 Identity`(GET /v1/openapi/common/v1/identity) **단 하나**만 쓴다 —
 * 파라미터 0개 · 부작용 0(조사 §5-2, §6-3). 쿠팡 auth-test가 카테고리 메타를,
 * 네이버 auth-test가 판매자 정보를 쓰는 것과 같은 자리다.
 *
 * status 값은 기존 두 채널과 같은 3값 규약(NOT_CONFIGURED / AUTH_FAILED /
 * CONNECTED)을 그대로 쓴다 — 설정 화면이 채널마다 다른 상태를 알 필요가 없다.
 *
 * 🔴 인증키는 응답 어디에도 싣지 않는다. debug에는 실패 단계 · HTTP 상태 ·
 * returnCode · 프록시 IP만 들어간다(전부 시크릿 아님).
 */
export async function POST() {
  const credentials = await getLotteOnCredentials();
  if (!credentials) {
    return NextResponse.json({
      status: "NOT_CONFIGURED",
      message: "롯데ON 인증키가 설정되어 있지 않습니다 — 설정 화면에서 인증키를 입력해 주세요.",
      debug: { step: "CREDENTIALS_MISSING" },
      ...missingFieldError("API 인증키"),
    });
  }

  const result = await callLotteOnApi(credentials.apiKey, {
    method: "GET",
    path: LOTTEON_READ_PATHS.identity,
  });

  const proxy = getOutboundProxyDiagnostics();

  if (!result.ok) {
    return NextResponse.json({
      status: "AUTH_FAILED",
      message: result.message,
      proxyProvider: proxy.provider,
      ...classifyNetworkError(new Error(result.message)),
      debug: {
        step: result.step,
        proxyProvider: proxy.provider,
        causeChain: result.causeChain,
      },
    });
  }

  // HTTP 레벨 실패 — 401 인증키 / 403 IP 미등록 / 404 / 429 / 5xx.
  const httpIssue = classifyLotteOnHttpStatus(result.httpStatus);
  if (httpIssue) {
    // 403(IP 미등록)일 때 셀러가 등록해야 할 값을 바로 알려준다 — 이 값이
    // 없으면 "어떤 IP를 등록하라는 거냐"로 한 라운드가 더 돈다.
    const proxyOutboundIp = result.httpStatus === 403 ? await getLotteOnOutboundIp() : null;
    return NextResponse.json({
      status: "AUTH_FAILED",
      message: httpIssue.userMessage,
      proxyProvider: proxy.provider,
      ...httpIssue,
      debug: {
        step: result.httpStatus === 403 ? "IP_NOT_ALLOWLISTED" : "HTTP_ERROR",
        httpStatus: result.httpStatus,
        returnCode: result.returnCode,
        lotteOnMessage: result.message,
        proxyProvider: proxy.provider,
        proxyOutboundIp,
      },
    });
  }

  // 🔴 HTTP 200이어도 실패일 수 있다(조사 §5-1) — returnCode가 유일한 성공 판정이다.
  if (!result.returnOk) {
    return NextResponse.json({
      status: "AUTH_FAILED",
      message: `롯데ON이 요청을 거부했습니다(returnCode ${result.returnCode ?? "없음"}).`,
      proxyProvider: proxy.provider,
      ...classifyLotteOnReturnCode(result.returnCode, result.message),
      debug: {
        step: "RETURN_CODE_NOT_OK",
        httpStatus: result.httpStatus,
        returnCode: result.returnCode,
        lotteOnMessage: result.message,
        proxyProvider: proxy.provider,
      },
    });
  }

  const proxyOutboundIp = await getLotteOnOutboundIp();
  return NextResponse.json({
    status: "CONNECTED",
    message: "롯데ON Open API 인증 및 호출에 성공했습니다.",
    proxyProvider: proxy.provider,
    debug: {
      step: "OK",
      httpStatus: result.httpStatus,
      returnCode: result.returnCode,
      dataCount: result.dataCount,
      proxyOutboundIp,
      // 207 Identity는 거래처 정보를 돌려준다(조사 §5-2) — 상품등록(87) payload의
      // trGrpCd/trNo가 여기서 나온다. 값 자체는 시크릿이 아니라 그대로 보여준다.
      identity: result.data,
    },
  });
}
