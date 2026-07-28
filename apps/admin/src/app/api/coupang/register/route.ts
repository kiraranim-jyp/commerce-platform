import { NextResponse } from "next/server";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { buildCoupangPayload, type CoupangPayload } from "@commerce/listing";
import type { ListingResult } from "@commerce/listing";
import { getCoupangCredentials, getCoupangSellerConfig } from "../_lib/env";
import { callCoupangApi } from "../_lib/client";

/**
 * 실제 쿠팡 상품 등록 — HMAC 서명 + API 호출이 전부 여기, 서버에서만 일어난다.
 * coupangExecutor(클라이언트, "use client" 트리에서 실행됨)는 이 라우트를
 * fetch()로 호출만 하고 응답을 그대로 ListingResult로 반환한다 — 시크릿은
 * 브라우저 번들에 존재조차 하지 않는다.
 *
 * "여러 상품 일괄 등록" 방지: 이 라우트는 상품 1개(product/listing 페어 1개)만
 * 받는다 — 배열을 받는 인터페이스 자체를 만들지 않았다.
 */
const CREATE_PRODUCT_PATH = "/v2/providers/seller_api/apis/api/v1/marketplace/seller-products";

interface CreateProductResponse {
  code?: string;
  message?: string;
  data?: {
    code?: string;
    message?: string;
    data?: number;
    details?: string;
    errorItems?: unknown[];
  };
}

function missingSellerConfigFields(payload: CoupangPayload): string[] {
  const missing: string[] = [];
  if (payload.displayCategoryCode == null) missing.push("쿠팡 카테고리 코드");
  if (!payload.deliveryCompanyCode) missing.push("택배사");
  if (!payload.returnCenterCode) missing.push("반품지");
  if (!payload.returnChargeName) missing.push("반품지명");
  if (!payload.companyContactNumber) missing.push("반품지 연락처");
  if (!payload.returnZipCode) missing.push("반품지 우편번호");
  if (!payload.returnAddress) missing.push("반품지 주소");
  if (payload.outboundShippingPlaceCode == null) missing.push("출고지");
  if (!payload.vendorUserId) missing.push("Wing 계정 ID");
  if (payload.items[0]?.images.length === 0) missing.push("대표 이미지");
  return missing;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    product?: CanonicalProduct;
    listing?: ListingModel;
  } | null;

  if (!body?.product || !body?.listing) {
    return NextResponse.json({ error: "product와 listing이 필요합니다." }, { status: 400 });
  }
  const { product, listing } = body;

  const credentials = await getCoupangCredentials();
  if (!credentials) {
    const result: ListingResult = {
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: false,
      error: {
        step: "AUTHENTICATION",
        message: "쿠팡 인증 정보가 설정되어 있지 않습니다.",
        retryable: false,
        resolution: "설정 페이지에서 Access Key/Secret Key/Vendor ID를 입력해주세요.",
      },
    };
    return NextResponse.json(result);
  }

  const sellerConfig = await getCoupangSellerConfig(credentials.vendorId);
  const payload = buildCoupangPayload(product, listing, { sellerConfig });

  const missing = missingSellerConfigFields(payload);
  if (missing.length > 0) {
    const result: ListingResult = {
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "VALIDATION",
        message: `실제 등록에 필요한 값이 없습니다: ${missing.join(", ")}`,
        retryable: true,
        resolution: "설정 페이지에서 쿠팡 배송 설정을 채운 뒤 다시 시도해주세요.",
      },
    };
    return NextResponse.json(result);
  }

  try {
    const response = await callCoupangApi(credentials, {
      method: "POST",
      path: CREATE_PRODUCT_PATH,
      body: payload,
    });

    if (response.status === 401 || response.status === 403) {
      const result: ListingResult = {
        status: "FAILED",
        platform: "coupang",
        mode: "LIVE",
        retryable: false,
        payload,
        error: {
          step: "AUTHENTICATION",
          message: "쿠팡이 인증 정보를 거부했습니다.",
          retryable: false,
          resolution: "access key/secret key를 다시 확인해주세요.",
        },
      };
      return NextResponse.json(result);
    }

    const parsed = response.body as CreateProductResponse;
    const succeeded = response.ok && parsed?.data?.code === "SUCCESS";

    if (succeeded) {
      const result: ListingResult = {
        status: "SUBMITTED",
        platform: "coupang",
        mode: "LIVE",
        retryable: false,
        payload,
        externalProductId: parsed.data?.data != null ? String(parsed.data.data) : undefined,
        submittedAt: new Date().toISOString(),
      };
      return NextResponse.json(result);
    }

    const message = parsed?.data?.message || parsed?.message || "쿠팡이 등록 요청을 거부했습니다.";
    const details = parsed?.data?.details;
    const result: ListingResult = {
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "COUPANG_API",
        message: details ? `${message} (${details})` : message,
        retryable: true,
        resolution: "표시된 원인을 확인하고 데이터를 고친 뒤 다시 시도해주세요.",
      },
    };
    return NextResponse.json(result);
  } catch (error) {
    const result: ListingResult = {
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "NETWORK",
        message: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
        retryable: true,
      },
    };
    return NextResponse.json(result);
  }
}
