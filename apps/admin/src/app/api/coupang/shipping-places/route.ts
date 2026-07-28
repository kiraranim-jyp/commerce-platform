import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * 판매자가 쿠팡 Wing에 이미 등록해둔 출고지(발송지) 목록을 조회한다 — 설정
 * 페이지에서 이 결과를 드롭다운으로 보여줘서, 출고지 코드를 직접 알아내지
 * 않아도 되게 한다.
 *
 * 응답 스키마는 developers.coupang.com 문서를 이번 세션에서 직접 fetch로
 * 확인하지 못했다(문서 사이트가 봇 차단으로 일부 페이지에서 403을 반환) —
 * 그래서 응답을 후보 필드명 여러 개로 방어적으로 파싱하고, 원본도 함께
 * 내려줘서 실제 계정으로 처음 테스트할 때 스키마가 다르면 바로 드러나게 한다.
 */
const SHIPPING_PLACE_PATH = "/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound";

interface RawShippingPlace {
  [key: string]: unknown;
}

export interface ShippingPlaceOption {
  code: number | null;
  name: string;
  raw: RawShippingPlace;
}

function extractList(body: unknown): RawShippingPlace[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const candidate = obj.content ?? obj.data ?? obj.result ?? obj.shippingPlaces;
  if (Array.isArray(candidate)) return candidate as RawShippingPlace[];
  return [];
}

function toOption(item: RawShippingPlace): ShippingPlaceOption {
  const code =
    (item.outboundShippingPlaceCode as number | undefined) ??
    (item.shippingPlaceCode as number | undefined) ??
    (item.code as number | undefined) ??
    null;
  const name =
    (item.shippingPlaceName as string | undefined) ??
    (item.name as string | undefined) ??
    (code != null ? `출고지 #${code}` : "이름 없음");
  return { code, name, raw: item };
}

export async function GET() {
  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", options: [] }, { status: 200 });
  }

  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: SHIPPING_PLACE_PATH,
      query: `vendorId=${encodeURIComponent(credentials.vendorId)}`,
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `쿠팡이 출고지 조회를 거부했습니다 (HTTP ${response.status}).`, options: [], raw: response.body },
        { status: 200 },
      );
    }
    const options = extractList(response.body).map(toOption);
    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
        options: [],
      },
      { status: 200 },
    );
  }
}
