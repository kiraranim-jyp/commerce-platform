import { NextResponse } from "next/server";
import { getNaverCredentials } from "../../naver/_lib/env";
import { issueNaverAccessToken, callNaverApi } from "../../naver/_lib/client";

/**
 * N-3.51 STEP8(2026-08-17) 조사 전용 진단 라우트 — 8차 실등록 성공
 * (originProductNo=13664004406) 후 POST 응답만 믿지 않고 실제 SmartStore
 * 서버에 상품이 존재하는지 GET으로 재검증하기 위한 것(work order 원칙:
 * "실제 등록 결과까지 검증한다"). 로컬 스크립트로는 프로덕션 Naver
 * client_id/secret이 Vercel에서 Sensitive 타입이라 `vercel env pull`로
 * 읽을 수 없다(이전에 DEBUG_NAVER_PROBE_TOKEN에서도 겪은 문제) — 그래서
 * 이미 검증된 debug/naver-image-upload-raw와 동일한 게이팅 패턴으로
 * 서버 쪽에서 실제 자격증명을 그대로 재사용한다. read-only GET이라
 * 판매자 스토어에 부작용이 없다.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_NAVER_PROBE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const originProductNo = searchParams.get("originProductNo");
  if (!originProductNo) {
    return NextResponse.json({ error: "originProductNo query param required" }, { status: 400 });
  }

  const credentials = await getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });
  }
  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ error: "AUTH_FAILED", detail: tokenResult }, { status: 200 });
  }

  const result = await callNaverApi(tokenResult.accessToken, {
    method: "GET",
    path: `/v2/products/origin-products/${originProductNo}`,
  });
  return NextResponse.json({ result });
}
