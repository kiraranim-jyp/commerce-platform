import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { fetchShippingPlaces } from "../_lib/shipping-place";

/**
 * 판매자가 쿠팡 Wing에 이미 등록해둔 출고지(발송지) 목록을 조회한다 — 설정
 * 페이지에서 이 결과를 드롭다운으로 보여줘서, 출고지 코드를 직접 알아내지
 * 않아도 되게 한다. 실제 조회/파싱 로직은 register 라우트도 함께 쓰는
 * `_lib/shipping-place.ts`에 있다.
 */
export async function GET() {
  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", options: [] }, { status: 200 });
  }

  const result = await fetchShippingPlaces(credentials);
  return NextResponse.json(result);
}
