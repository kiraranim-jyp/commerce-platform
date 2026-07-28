import { NextResponse } from "next/server";
import { getCoupangCredentials } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * 판매자가 쿠팡 Wing에 이미 등록해둔 반품지 목록을 조회한다 — 설정 페이지에서
 * 드롭다운으로 보여준다. 응답 스키마 관련 주의사항은 shipping-places/route.ts와
 * 동일(문서 확인 제약으로 방어적 파싱 + 원본 동봉).
 */
function returnCentersPath(vendorId: string): string {
  return `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(vendorId)}/returnShippingCenters`;
}

interface RawReturnCenter {
  [key: string]: unknown;
}

export interface ReturnCenterOption {
  code: string | null;
  name: string;
  zipCode: string | null;
  address: string | null;
  addressDetail: string | null;
  contactNumber: string | null;
  raw: RawReturnCenter;
}

function extractList(body: unknown): RawReturnCenter[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const candidate = obj.content ?? obj.data ?? obj.result ?? obj.returnShippingCenterList;
  if (Array.isArray(candidate)) return candidate as RawReturnCenter[];
  return [];
}

function firstPlaceAddress(item: RawReturnCenter): Record<string, unknown> | null {
  const addresses = item.placeAddresses ?? item.addresses;
  if (Array.isArray(addresses) && addresses.length > 0) return addresses[0] as Record<string, unknown>;
  return null;
}

function toOption(item: RawReturnCenter): ReturnCenterOption {
  const address = firstPlaceAddress(item) ?? item;
  const code =
    (item.returnCenterCode as string | number | undefined)?.toString() ??
    (item.centerCode as string | number | undefined)?.toString() ??
    null;
  const name =
    (item.shippingPlaceName as string | undefined) ??
    (item.returnCenterName as string | undefined) ??
    (item.name as string | undefined) ??
    (code != null ? `반품지 #${code}` : "이름 없음");
  return {
    code,
    name,
    zipCode: (address.returnZipCode as string | undefined) ?? (address.zipCode as string | undefined) ?? null,
    address: (address.returnAddress as string | undefined) ?? (address.address as string | undefined) ?? null,
    addressDetail:
      (address.returnAddressDetail as string | undefined) ?? (address.addressDetail as string | undefined) ?? null,
    contactNumber:
      (item.companyContactNumber as string | undefined) ?? (item.contactNumber as string | undefined) ?? null,
    raw: item,
  };
}

export async function GET() {
  const credentials = await getCoupangCredentials();
  if (!credentials) {
    return NextResponse.json({ error: "쿠팡 인증 정보가 설정되어 있지 않습니다.", options: [] }, { status: 200 });
  }

  try {
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: returnCentersPath(credentials.vendorId),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `쿠팡이 반품지 조회를 거부했습니다 (HTTP ${response.status}).`, options: [], raw: response.body },
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
