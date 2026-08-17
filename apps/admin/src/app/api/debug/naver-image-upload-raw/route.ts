import { NextResponse } from "next/server";
import { getNaverCredentials } from "../../naver/_lib/env";
import { issueNaverAccessToken, uploadNaverProductImages } from "../../naver/_lib/client";

/**
 * N-3.49(2026-08-17) 조사 전용 진단 라우트 — 상품 이미지 다건 등록 API
 * (POST /v1/product-images/upload)의 실제 응답 JSON 구조를 눈으로 직접
 * 확인하기 위한 것. 공식 문서에서 정확한 응답 키 이름을 확정하지 못해
 * (커뮤니티 설명상 "images" 목록만 확인됨), raw를 그대로 보여준다(CPO
 * 원칙: 추측하지 말고 실측). 상품 등록이 아니라 이미지 업로드만 하므로
 * 판매자 스토어에 부작용이 없다(안전한 조사). debug/naver-category-raw와
 * 동일한 게이팅 패턴 재사용.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_NAVER_PROBE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { urls?: string[] } | null;
  const urls = body?.urls;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: "urls(string[]) required" }, { status: 400 });
  }

  const credentials = await getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });
  }
  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ error: "AUTH_FAILED", detail: tokenResult }, { status: 200 });
  }

  const result = await uploadNaverProductImages(tokenResult.accessToken, urls);
  return NextResponse.json({ result });
}
