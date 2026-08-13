import { NextResponse } from "next/server";
import type { PlatformConnectionStatus } from "@commerce/listing";
import { callCoupangApi } from "../../../../coupang/_lib/client";
import { callNaverApi, issueNaverAccessToken } from "../../../../naver/_lib/client";
import { getCommerceAccountRaw } from "../../_lib/commerce-account";
import { classifyHttpStatus, classifyNetworkError, missingFieldError } from "@/lib/connection-error";

/** N-3.13 R2 Part 12 — /api/coupang/auth-test, /api/naver/auth-test와 판단
 * 로직(어떤 HTTP status를 CONNECTED/AUTH_FAILED로 볼지)은 완전히 동일하게
 * 유지한다 — 다른 건 자격증명 출처뿐이다(싱글톤/env 대신 이 저장된 계정).
 * 두 라우트를 복붙 수정한 게 아니라 같은 판단 기준을 의도적으로 반복한다 —
 * 자격증명 소스가 여러 곳(싱글톤 vs 다중 계정)이라 공통 함수로 뽑으면 오히려
 * "어느 쪽 판단 기준이 최신인지" 헷갈리는 위험이 더 크다고 판단했다. */
const COUPANG_AUTH_TEST_PATH =
  "/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/78877";
const NAVER_SELLER_ACCOUNT_PATH = "/v1/seller/account";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getCommerceAccountRaw(id);
  if (!account) {
    return NextResponse.json({ status: "NOT_CONFIGURED" as PlatformConnectionStatus, message: "계정을 찾을 수 없습니다." });
  }

  if (account.platform === "coupang") {
    if (!account.access_key || !account.secret_key || !account.vendor_id) {
      const missing = [
        !account.access_key && "Access Key",
        !account.secret_key && "Secret Key",
        !account.vendor_id && "Vendor ID",
      ]
        .filter(Boolean)
        .join(", ");
      return NextResponse.json({
        status: "NOT_CONFIGURED" as PlatformConnectionStatus,
        message: "Access Key/Secret Key/Vendor ID가 모두 입력되어야 합니다.",
        ...missingFieldError(missing),
      });
    }
    try {
      const response = await callCoupangApi(
        { accessKey: account.access_key, secretKey: account.secret_key, vendorId: account.vendor_id },
        { method: "GET", path: COUPANG_AUTH_TEST_PATH },
      );
      const classified = classifyHttpStatus(response.status, "쿠팡");
      if (classified) {
        return NextResponse.json({
          status: "AUTH_FAILED" as PlatformConnectionStatus,
          message: "쿠팡이 인증 정보를 거부했습니다 — access key/secret key를 다시 확인해주세요.",
          ...classified,
          debug: { httpStatus: response.status, coupangResponse: response.body },
        });
      }
      return NextResponse.json({
        status: "CONNECTED" as PlatformConnectionStatus,
        message: "쿠팡 API 인증에 성공했습니다.",
        debug: { httpStatus: response.status },
      });
    } catch (error) {
      console.error("[commerce-accounts/test] 쿠팡 연결 확인 중 예외:", error);
      return NextResponse.json({
        status: "AUTH_FAILED" as PlatformConnectionStatus,
        message: error instanceof Error ? `쿠팡 서버에 연결할 수 없습니다: ${error.message}` : "쿠팡 서버에 연결할 수 없습니다.",
        ...classifyNetworkError(error),
      });
    }
  }

  // platform === "naver"
  if (!account.client_id || !account.client_secret) {
    const missing = [!account.client_id && "Client ID", !account.client_secret && "Client Secret"]
      .filter(Boolean)
      .join(", ");
    return NextResponse.json({
      status: "NOT_CONFIGURED" as PlatformConnectionStatus,
      message: "Client ID/Client Secret이 모두 입력되어야 합니다.",
      ...missingFieldError(missing),
    });
  }
  const tokenResult = await issueNaverAccessToken({ clientId: account.client_id, clientSecret: account.client_secret });
  if (!tokenResult.ok) {
    const httpStatus = "httpStatus" in tokenResult ? tokenResult.httpStatus : undefined;
    return NextResponse.json({
      status: "AUTH_FAILED" as PlatformConnectionStatus,
      message: tokenResult.message,
      ...(classifyHttpStatus(httpStatus, "네이버") ?? classifyNetworkError(new Error(tokenResult.message))),
      debug: { step: tokenResult.step },
    });
  }
  const apiResult = await callNaverApi(tokenResult.accessToken, { method: "GET", path: NAVER_SELLER_ACCOUNT_PATH });
  if (!apiResult.ok) {
    return NextResponse.json({
      status: "AUTH_FAILED" as PlatformConnectionStatus,
      message: apiResult.message,
      ...classifyNetworkError(new Error(apiResult.message)),
    });
  }
  if (apiResult.status === 401 || apiResult.status === 403) {
    return NextResponse.json({
      status: "AUTH_FAILED" as PlatformConnectionStatus,
      message: "네이버가 API 호출을 거부했습니다 — 토큰은 발급됐지만 권한이 없거나 IP가 허용목록에 없을 수 있습니다.",
      ...(classifyHttpStatus(apiResult.status, "네이버") ?? classifyNetworkError(new Error("permission or IP"))),
      debug: { httpStatus: apiResult.status, naverResponse: apiResult.body },
    });
  }
  return NextResponse.json({
    status: "CONNECTED" as PlatformConnectionStatus,
    message: "네이버 커머스 API 인증 및 호출에 성공했습니다.",
    debug: { httpStatus: apiResult.status },
  });
}
