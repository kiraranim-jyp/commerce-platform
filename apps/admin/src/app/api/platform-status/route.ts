import { NextResponse } from "next/server";
import { FIELD_CAPABILITY_MATRIX, soonMarketplace } from "@commerce/marketplace";

/**
 * N-4.08-6/7(대표님 지시: "11번가/ESM SOON 연결 준비 + Capability Matrix 실제 UI 반영") —
 * FIELD_CAPABILITY_MATRIX(코드에서 실제 검증된 12개 필드×4마켓 지원수준)와 SOON
 * 어댑터의 resolveConnectionStatus를 그대로 노출한다. 절대 금지: 이 라우트는
 * 11번가/ESM에 실제 API 호출을 하지 않는다 — hasCredentials는 credential env var
 * 존재 여부만 확인하고, 두 어댑터의 API_SPEC_CONFIRMED가 이미 false로 하드코딩돼
 * 있어(공식 스펙 미확보) 결과는 항상 NOT_AVAILABLE로 정직하게 나온다.
 */
export async function GET() {
  const elevenstHasCredentials = Boolean(process.env.ELEVENST_API_KEY && process.env.ELEVENST_API_SECRET);
  const esmHasCredentials = Boolean(process.env.ESM_API_KEY && process.env.ESM_API_SECRET);

  return NextResponse.json({
    ok: true,
    capabilityMatrix: FIELD_CAPABILITY_MATRIX,
    soon: [
      {
        id: soonMarketplace.elevenstSoonAdapter.id,
        label: soonMarketplace.elevenstSoonAdapter.label,
        status: soonMarketplace.elevenstSoonAdapter.resolveConnectionStatus(elevenstHasCredentials),
      },
      {
        id: soonMarketplace.esmSoonAdapter.id,
        label: soonMarketplace.esmSoonAdapter.label,
        status: soonMarketplace.esmSoonAdapter.resolveConnectionStatus(esmHasCredentials),
      },
    ],
  });
}
