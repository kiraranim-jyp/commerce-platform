import { NextResponse } from "next/server";
import { getNaverCredentials, getNaverSellerIdForDisplay } from "../_lib/env";
import { callNaverApi, getFixieOutboundIp, issueNaverAccessToken } from "../_lib/client";
import { classifyHttpStatus, classifyNetworkError, missingFieldError } from "@/lib/connection-error";

/**
 * "네이버 커머스 API 연결 상태" 확인용 — Sprint N-1.0 범위는 "인증되고 API를
 * 1건 이상 호출할 수 있는가"까지다(상품 등록/조회 API 자체 연동은 다음
 * Sprint). 판매자 정보 조회 API(GET /v1/seller/account)는 읽기 전용이라
 * 부작용이 없다 — Coupang auth-test가 카테고리 메타조회를 쓰는 것과 같은 이유.
 *
 * status 값은 기존 Coupang과 같은 이름(NOT_CONFIGURED/AUTH_FAILED/CONNECTED)을
 * 재사용하되, 실패 세부 사유는 debug.step으로 구분한다(work order 7번: 환경변수
 * 누락/인증 실패/토큰 발급 실패/API 권한 부족/IP whitelist 문제/endpoint 문제/
 * timeout·network error). 공용 PlatformConnectionStatus 타입을 넓히지 않은 건
 * 이번 Sprint 범위를 "인증 확인"으로 최소화하기 위함이다.
 */
const SELLER_ACCOUNT_PATH = "/v1/seller/account";

export async function POST() {
  const credentials = await getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({
      status: "NOT_CONFIGURED",
      message: "네이버 인증 정보가 설정되어 있지 않습니다 — SMARTSTORE_CLIENT_ID/SMARTSTORE_CLIENT_SECRET 확인 필요.",
      debug: { step: "ENV_MISSING" },
      ...missingFieldError("Client ID / Client Secret"),
    });
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    const httpStatus = "httpStatus" in tokenResult ? tokenResult.httpStatus : undefined;
    return NextResponse.json({
      status: "AUTH_FAILED",
      message: tokenResult.message,
      ...(classifyHttpStatus(httpStatus, "네이버") ?? classifyNetworkError(new Error(tokenResult.message))),
      // client_secret/access token 값 자체는 절대 포함하지 않는다 — 실패
      // 단계(step)와 HTTP 상태, 네이버 응답 원문(시크릿 아님)만 진단용으로 내려준다.
      debug: {
        step: tokenResult.step,
        httpStatus,
        naverResponse: "body" in tokenResult ? tokenResult.body : undefined,
        fixieConfigured: Boolean(process.env.FIXIE_URL),
      },
    });
  }

  const apiResult = await callNaverApi(tokenResult.accessToken, { method: "GET", path: SELLER_ACCOUNT_PATH });
  if (!apiResult.ok) {
    return NextResponse.json({
      status: "AUTH_FAILED",
      message: apiResult.message,
      ...classifyNetworkError(new Error(apiResult.message)),
      debug: { step: apiResult.step, fixieConfigured: Boolean(process.env.FIXIE_URL) },
    });
  }

  if (apiResult.status === 401 || apiResult.status === 403) {
    return NextResponse.json({
      status: "AUTH_FAILED",
      message: "네이버가 API 호출을 거부했습니다 — 토큰은 발급됐지만 이 API에 대한 권한이 없거나 IP가 허용목록에 없을 수 있습니다.",
      ...(classifyHttpStatus(apiResult.status, "네이버") ?? classifyNetworkError(new Error("permission or IP"))),
      debug: {
        step: "API_PERMISSION_OR_IP",
        httpStatus: apiResult.status,
        naverResponse: apiResult.body,
        fixieConfigured: Boolean(process.env.FIXIE_URL),
      },
    });
  }

  const outboundIp = await getFixieOutboundIp();
  return NextResponse.json({
    status: "CONNECTED",
    message: "네이버 커머스 API 인증 및 호출에 성공했습니다.",
    debug: {
      httpStatus: apiResult.status,
      expiresIn: tokenResult.expiresIn,
      fixieConfigured: Boolean(process.env.FIXIE_URL),
      fixieOutboundIp: outboundIp,
      // seller ID는 이번 Sprint에서 API 요청에 쓰지 않았다 — 참고용으로만 표시.
      sellerIdEnvPresent: Boolean(await getNaverSellerIdForDisplay()),
    },
  });
}
