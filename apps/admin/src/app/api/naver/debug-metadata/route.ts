import { NextResponse } from "next/server";
import { getNaverCredentials } from "../_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../_lib/client";

/**
 * Sprint N-2.5 — 임시 read-only 조사 라우트. 배송/반품 주소록, 택배사 코드
 * 참조 API를 확인한다. 조사가 끝나면 이 파일은 삭제한다(work order 지시).
 *
 * 기존 issueNaverAccessToken/callNaverApi를 그대로 재사용 — 인증 로직은
 * 절대 수정하지 않는다. GET만 사용, 상품 등록/수정/삭제는 호출하지 않는다.
 */
const STEP_PATHS: Record<string, () => string> = {
  addressbooks: () => "/v1/seller/addressbooks-for-page?page=1",
  // 아래는 택배사 코드 조회 후보 endpoint들 — 실제로 어떤 게 맞는지 확실하지
  // 않아서(v1 endpoint는 2022-12-21 지원 종료 공지 확인됨) 여러 후보를
  // 순서대로 시도해서 실제 200/404로 판별한다. 코드에 확정 반영하지 않는다.
  "delivery-companies-v1": () => "/v1/product-delivery-info/delivery-companies",
  "delivery-companies-v2": () => "/v2/product-delivery-info/delivery-companies",
  "deliveries-companies": () => "/v1/deliveries/companies",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") ?? "addressbooks";

  const pathBuilder = STEP_PATHS[step];
  if (!pathBuilder) {
    return NextResponse.json(
      { error: `알 수 없는 step: ${step}. 사용 가능: ${Object.keys(STEP_PATHS).join(", ")}` },
      { status: 400 },
    );
  }
  const path = pathBuilder();

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

  return NextResponse.json({ step, path, httpStatus: apiResult.status, body: apiResult.body });
}
