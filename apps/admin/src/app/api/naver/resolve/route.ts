import { NextResponse } from "next/server";
import { resolveNaverContext } from "../_lib/resolve-context";

/**
 * Sprint N-2.8 — NaverPayloadPreview에 필요한 실제 read-only 데이터를 한 번에
 * 모아준다(카테고리 상세 + 주소록). 카테고리 매칭 Resolver는 N-2.9로 분리됐다
 * (CPO 지시 — 학습데이터 없이 만들면 오분류 위험) — 그래서 categoryId는 이
 * 라우트의 입력값이지 이 라우트가 만들어내는 값이 아니다(Preview에서 QA가
 * 실제 Naver 카테고리 ID를 알고 있을 때만 수동으로 입력한다).
 *
 * N-3.56(STEP1) — 실제 조회+계산 로직은 ../_lib/resolve-context.ts로 옮겼다.
 * 이 라우트는 그 함수의 얇은 HTTP wrapper일 뿐이다 — 대시보드(다중 상품
 * 배치 조회)가 자기 서버에 HTTP self-call을 하지 않고 같은 함수를 직접
 * 호출할 수 있게 하기 위함("판정 로직을 두 곳에 만들지 않는다" 원칙 유지).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const extractedCountryOfOrigin = searchParams.get("countryOfOrigin");
  const brandName = searchParams.get("brand");

  const result = await resolveNaverContext({
    categoryId,
    countryOfOrigin: extractedCountryOfOrigin,
    brand: brandName,
  });

  return NextResponse.json(result);
}
