import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * 디버그/점검용 — 브랜드명으로 쿠팡에 실제 등록된 brandId를 찾는다. 실제 등록
 * 시도로 확인된 사실: brand를 문자열로만 보내면 "브랜드 ID가 필요합니다"로
 * 거부된다(Wing에 등록되지 않은 브랜드명은 문자열만으로 통과 안 됨) — 요청/응답
 * 스키마가 공식 문서 상세페이지 없이 확인이 안 돼, 실제 계정으로 호출해서
 * 스키마 자체를 규명하는 용도.
 */
const BRAND_SEARCH_PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/brands/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "q가 필요합니다." }, { status: 400 });
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
      method: "POST",
      path: BRAND_SEARCH_PATH,
      body: { brandName: q },
    });
    return NextResponse.json({ status: response.status, body: response.body });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.", status: "NETWORK_ERROR" },
      { status: 200 },
    );
  }
}
