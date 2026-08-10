import { NextResponse } from "next/server";
import { getNaverCredentials } from "../_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../_lib/client";

/**
 * Sprint N-2.4 — 임시 read-only 조사 라우트. 상품등록 v2 payload 설계에 필요한
 * 실제 메타데이터(카테고리/속성/고시/표준옵션)를 공식 문서에서 확인된 GET
 * endpoint로 직접 조회한다. 조사가 끝나면 이 파일은 삭제한다(work order 지시).
 *
 * 기존 issueNaverAccessToken/callNaverApi를 그대로 재사용 — 인증 로직은
 * 절대 수정하지 않는다. 상품 등록/수정/삭제(POST/PUT/DELETE)는 이 라우트에서
 * 호출하지 않는다 — GET만 사용한다.
 */
const STEP_PATHS: Record<string, (categoryId: string | null) => string | null> = {
  "0": () => "/v1/categories",
  "1": () => "/v1/categories?last=true",
  "2": (id) => (id ? `/v1/categories/${id}` : null),
  "3": (id) => (id ? `/v1/products-for-provided-notice?categoryId=${id}` : null),
  "4": (id) => (id ? `/v1/product-attributes/attributes?categoryId=${id}` : null),
  "5": (id) => (id ? `/v1/product-attributes/attribute-values?categoryId=${id}` : null),
  "6": (id) => (id ? `/v1/options/standard-options?categoryId=${id}` : null),
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "1";
  const categoryId = searchParams.get("categoryId");
  const keyword = searchParams.get("keyword");

  const pathBuilder = STEP_PATHS[step];
  if (!pathBuilder) {
    return NextResponse.json(
      { error: `step은 1~6 중 하나여야 합니다. 받은 값: ${step}` },
      { status: 400 },
    );
  }
  const path = pathBuilder(categoryId);
  if (!path) {
    return NextResponse.json({ error: `step=${step}에는 categoryId 쿼리 파라미터가 필요합니다.` }, { status: 400 });
  }

  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 500 });
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json({ error: "TOKEN_FAILED", step: tokenResult.step }, { status: 502 });
  }

  const apiResult = await callNaverApi(tokenResult.accessToken, { method: "GET", path });
  if (!apiResult.ok) {
    return NextResponse.json({ error: "API_CALL_FAILED", step: apiResult.step }, { status: 502 });
  }

  // step=1(전체 리프 카테고리)은 수천 건이라 keyword로 좁혀서 응답 크기를 줄인다.
  let body = apiResult.body;
  if (step === "1" && keyword && Array.isArray(body)) {
    body = body.filter((c: unknown) => {
      const name = c as { wholeCategoryName?: string; name?: string };
      return (
        name.wholeCategoryName?.includes(keyword) || name.name?.includes(keyword)
      );
    });
  }

  return NextResponse.json({ step, path, httpStatus: apiResult.status, body });
}
