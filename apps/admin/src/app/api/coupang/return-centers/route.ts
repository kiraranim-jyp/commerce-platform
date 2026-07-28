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

/** 실제 계정으로 확인된 응답 모양: {code, message, data: {content: [...], pagination}}
 * — data 자체가 배열이 아니라 그 안에 content가 있다. 예전 코드는 obj.data가
 * "배열이 아닌 객체"인 경우를 대비하지 못해서, 반품지가 실제로 등록돼 있어도
 * 항상 빈 배열을 반환하는 버그가 있었다(raw 응답으로 실측 확인). data.content를
 * 최우선으로 보고, 혹시 스키마가 또 바뀌어도 넘어갈 수 있게 나머지 후보도 유지한다. */
function extractList(body: unknown): RawReturnCenter[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).content)) {
    return (data as Record<string, unknown>).content as RawReturnCenter[];
  }
  const candidate = obj.content ?? data ?? obj.result ?? obj.returnShippingCenterList;
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
    // shipping-places/route.ts와 동일한 이유로, 목록이 비어 있으면 raw도 같이
    // 내려줘서 "실제로 반품지가 없는 것"과 "필드명이 안 맞아 파싱이 실패한 것"을
    // 구분할 수 있게 한다.
    return NextResponse.json(options.length > 0 ? { options } : { options, raw: response.body });
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
