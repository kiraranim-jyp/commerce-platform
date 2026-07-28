import { NextResponse } from "next/server";
import type { PlatformConnectionStatus } from "@commerce/listing";
import { getCoupangCredentials } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * "쿠팡 연결 상태" 배지용 — 실제 상품을 등록/조회하지 않고 서명이 통과하는지만
 * 확인한다. 카테고리 메타정보 조회(GET, 읽기 전용, 부작용 없음)에 문서 예시
 * 카테고리 코드를 그대로 사용한다 — 이 코드가 실제 존재하는지는 중요하지 않다,
 * 쿠팡이 401/403(서명 거부)을 주는지 아니면 그 외(200/400/404 등, 서명은
 * 통과했고 그 다음 단계에서 응답한 것)를 주는지만 구분하면 된다.
 */
const AUTH_TEST_PATH =
  "/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/78877";

export async function POST() {
  const credentials = await getCoupangCredentials();
  if (!credentials) {
    const status: PlatformConnectionStatus = "NOT_CONFIGURED";
    return NextResponse.json({
      status,
      message: "쿠팡 인증 정보가 설정되어 있지 않습니다 — 설정 페이지에서 Access Key/Secret Key/Vendor ID를 입력해주세요.",
    });
  }

  try {
    const response = await callCoupangApi(credentials, { method: "GET", path: AUTH_TEST_PATH });
    if (response.status === 401 || response.status === 403) {
      const status: PlatformConnectionStatus = "AUTH_FAILED";
      return NextResponse.json({
        status,
        message: "쿠팡이 인증 정보를 거부했습니다 — access key/secret key를 다시 확인해주세요.",
        // 시크릿 값 자체는 절대 내려보내지 않는다 — 길이/공백 여부 같은 "복붙 실수
        // 있었는지" 힌트와, 쿠팡 응답 원문(서명 오류 vs 키 미등록 vs 승인 대기 등
        // 구체적 사유)만 진단용으로 함께 내려준다.
        debug: {
          httpStatus: response.status,
          coupangResponse: response.body,
          accessKeyLength: credentials.accessKey.length,
          accessKeyHasWhitespace: /\s/.test(credentials.accessKey),
          secretKeyLength: credentials.secretKey.length,
          secretKeyHasWhitespace: /\s/.test(credentials.secretKey),
          vendorId: credentials.vendorId,
        },
      });
    }
    const status: PlatformConnectionStatus = "CONNECTED";
    return NextResponse.json({
      status,
      message: "쿠팡 API 인증에 성공했습니다.",
      debug: { httpStatus: response.status },
    });
  } catch (error) {
    const status: PlatformConnectionStatus = "AUTH_FAILED";
    return NextResponse.json({
      status,
      message: error instanceof Error ? `쿠팡 서버에 연결할 수 없습니다: ${error.message}` : "쿠팡 서버에 연결할 수 없습니다.",
    });
  }
}
