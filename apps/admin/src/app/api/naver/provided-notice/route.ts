import { NextResponse } from "next/server";
import { getNaverCredentials } from "../_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../_lib/client";

/**
 * N-3.35 — N-3.33/34에서 확인된 문제(캔들 카테고리에 WEAR 고시정보 스키마가
 * 잘못 적용됨, 공식 문서 접근은 apicenter.commerce.naver.com 차단으로 계속
 * 불가)를 풀기 위한 read-only 조사 전용 라우트. GET /v1/products-for-provided-notice
 * (Naver 공식 GitHub Discussion #3490에서 존재가 확인된 실제 엔드포인트 —
 * "productInfoProvidedNoticeType은 총 36개 enum"이라는 원문 인용)를 그대로
 * 호출해서 raw JSON을 돌려준다 — 이 파일은 추측/가공을 전혀 하지 않는다
 * (CPO 지시: "그 route는 Naver의 공식 read-only 응답을 관찰하기 위한 도구일
 * 뿐 Commerce 등록 경로와 절대 연결하지 않는다"). CanonicalProduct/
 * build-payload.ts/validate-payload.ts/Editor UI는 이 라우트의 결과를 아직
 * 전혀 참조하지 않는다 — 이번 스프린트 범위 밖(N-3.36+).
 */
export async function GET() {
  const credentials = await getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." });
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ status: "AUTH_FAILED", message: tokenResult.message, debug: { step: tokenResult.step } });
  }

  const result = await callNaverApi(tokenResult.accessToken, {
    method: "GET",
    path: "/v1/products-for-provided-notice",
  });

  if (!result.ok) {
    return NextResponse.json({ status: "API_CALL_FAILED", detail: result });
  }

  return NextResponse.json({ status: "OK", raw: result.body });
}
