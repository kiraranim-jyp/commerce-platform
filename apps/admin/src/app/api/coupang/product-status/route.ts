import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * 디버그/점검용 — 방금 등록한 sellerProductId의 실제 상태(검수중/승인대기/판매중
 * 등)를 확인한다. STEP 3(등록 완료 확인: 등록번호→상품페이지→노출→상태)의
 * "상태" 단계.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json(
      { error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", status: "NOT_CONFIGURED" },
      { status: 200 },
    );
  }

  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${id}`,
    });
    return NextResponse.json({ status: response.status, body: response.body });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.", status: "NETWORK_ERROR" },
      { status: 200 },
    );
  }
}
