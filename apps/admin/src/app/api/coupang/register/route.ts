import { NextResponse } from "next/server";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, ErrorCode } from "@commerce/shared";
import { buildCoupangPayload, type CoupangPayload } from "@commerce/listing";
import type { ListingResult, RegistrationStepLog } from "@commerce/listing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCoupangCredentials, getVendorUserId } from "../_lib/env";
import { getDefaultDescriptionTemplate } from "../_lib/description-template";
import { getDefaultSellerProfile } from "../_lib/seller-profile";
import { callCoupangApi, type CoupangApiResponse } from "../_lib/client";
import { withRetry } from "../_lib/retry";
import { fetchShippingPlaces, inferSourceCountry, selectOutboundShippingPlace } from "../_lib/shipping-place";

/** 성공/실패 모든 시도를 기록한다 — 관리자 대시보드의 "오늘 등록 N건, 성공/실패"
 * 카운트가 여기서 나온다(support_inquiries는 사용자가 직접 문의를 제출한 것만
 * 있어서 전체 시도 수를 대표하지 못한다). Supabase가 없거나 insert가 실패해도
 * 응답 자체를 막으면 안 되므로 fire-and-forget으로 처리하고 실패는 로그만 남긴다. */
function logRegistrationAttempt(result: ListingResult): void {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  void supabase
    .from("registration_attempts")
    .insert({
      platform: result.platform,
      status: result.status,
      error_code: result.error?.code ?? null,
      trace_id: result.traceId ?? null,
      duration_ms: result.durationMs ?? null,
    })
    .then(({ error }) => {
      if (error) console.warn("[register] registration_attempts 기록 실패:", error.message);
    });
}

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

/** missingSellerConfigFields()가 여러 항목을 한 번에 찾아도, 사용자에게는 가장
 * 먼저 고쳐야 할 하나의 ErrorCode만 보여준다 — 우선순위: 카테고리 > 배송(택배사/
 * 출고지) > 반품지 > 대표이미지 > 그 외(Wing 계정 ID 등). */
function classifyMissingSellerConfig(missing: string[]): ErrorCode {
  if (missing.includes("쿠팡 카테고리 코드")) return "CP001";
  if (missing.includes("택배사") || missing.includes("출고지")) return "CP002";
  if (missing.some((m) => m.startsWith("반품지"))) return "CP003";
  if (missing.includes("대표 이미지")) return "CP006";
  return "CP005";
}

/** 429/5xx는 일시적일 가능성이 높아 자동 재시도 대상이다 — 400대(카테고리/필수값
 * 오류 등 4xx 중 401/403 제외)는 데이터 문제라 재시도해도 똑같이 실패하므로 여기 안 걸린다. */
function isRetryableCoupangResponse(response: CoupangApiResponse): boolean {
  return response.status === 429 || response.status >= 500;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();
  const steps: RegistrationStepLog[] = [];
  const logStep = (step: string, status: RegistrationStepLog["status"], message: string) => {
    steps.push({ step, status, message, timestamp: new Date().toISOString() });
  };
  const withMeta = (result: ListingResult): ListingResult => ({
    ...result,
    traceId,
    durationMs: Date.now() - startedAt,
    steps,
  });

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
    logStep("인증 확인", "failed", "쿠팡 인증 정보가 설정되어 있지 않습니다.");
    const result: ListingResult = withMeta({
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: false,
      error: {
        step: "AUTHENTICATION",
        code: "API001",
        message: "쿠팡 인증 정보가 설정되어 있지 않습니다.",
        retryable: false,
        resolution: "설정 페이지에서 Access Key/Secret Key/Vendor ID를 입력해주세요.",
      },
    });
    logRegistrationAttempt(result);
    return NextResponse.json(result);
  }
  logStep("인증 확인", "success", "쿠팡 인증 정보 확인 완료");

  const vendorUserId = await getVendorUserId();
  const sellerProfile = await getDefaultSellerProfile();
  if (!sellerProfile) {
    logStep("배송 프로필 확인", "failed", "등록된 배송 프로필이 없습니다.");
    const result: ListingResult = withMeta({
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      error: {
        step: "VALIDATION",
        code: "CP002",
        message: "배송 프로필이 아직 없습니다.",
        retryable: true,
        resolution: "설정 페이지에서 배송 프로필을 먼저 만들어주세요(최초 1회).",
      },
    });
    logRegistrationAttempt(result);
    return NextResponse.json(result);
  }
  logStep("배송 프로필 확인", "success", `프로필 "${sellerProfile.name}" 사용`);

  const descriptionTemplate = await getDefaultDescriptionTemplate();
  logStep(
    "설명 템플릿",
    descriptionTemplate ? "success" : "skipped",
    descriptionTemplate ? `템플릿 "${descriptionTemplate.name}" 병합` : "템플릿 없음 — AI 생성분만 사용",
  );

  // 출고지는 SellerProfile의 고정값 하나로 정확할 수 없다 — CartPilot 계정은
  // 해외구매대행(AGENT_BUY)만 등록하고, 실제 계정에 등록된 출고지가 전부 해외
  // 주소이며 나라마다 다르다(Wing 정책 문서로 확인: AGENT_BUY는 출고지가 반드시
  // 해외 주소여야 함). 그래서 등록 시점에 매번 최신 목록을 조회해서 상품의
  // 소싱 국가(sourceUrl 기반)에 맞는 출고지를 자동으로 고른다 — 조회/선택이
  // 실패하면 프로필에 저장된 값으로 폴백한다.
  let outboundShippingPlaceCode = sellerProfile.outboundShippingPlaceCode;
  const shippingPlaces = await fetchShippingPlaces(credentials);
  const sourceCountry = inferSourceCountry(product.sourceUrl);
  const selectedPlace = selectOutboundShippingPlace(sourceCountry, shippingPlaces.options);
  if (selectedPlace?.code != null) {
    outboundShippingPlaceCode = selectedPlace.code;
    logStep(
      "출고지 자동 선택",
      "success",
      `${selectedPlace.name}(${selectedPlace.code})${sourceCountry ? ` — 소싱 국가 ${sourceCountry} 매칭` : " — 최신 사용가능 출고지로 폴백"}`,
    );
  } else if (outboundShippingPlaceCode != null) {
    logStep("출고지 자동 선택", "skipped", "실시간 조회 실패 — 프로필 저장값으로 폴백");
  } else {
    logStep("출고지 자동 선택", "failed", shippingPlaces.error ?? "등록된 출고지가 없습니다.");
  }

  const payload = buildCoupangPayload(product, listing, {
    sellerConfig: {
      vendorId: credentials.vendorId,
      vendorUserId,
      deliveryCompanyCode: sellerProfile.deliveryCompanyCode,
      returnCenterCode: sellerProfile.returnCenterCode,
      returnChargeName: sellerProfile.returnChargeName,
      companyContactNumber: sellerProfile.companyContactNumber,
      returnZipCode: sellerProfile.returnZipCode,
      returnAddress: sellerProfile.returnAddress,
      returnAddressDetail: sellerProfile.returnAddressDetail,
      outboundShippingPlaceCode,
    },
    descriptionTemplate: descriptionTemplate ?? undefined,
  });

  const missing = missingSellerConfigFields(payload);
  if (missing.length > 0) {
    logStep("설정 확인", "failed", `필요한 값이 없습니다: ${missing.join(", ")}`);
    const result: ListingResult = withMeta({
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "VALIDATION",
        code: classifyMissingSellerConfig(missing),
        message: `실제 등록에 필요한 값이 없습니다: ${missing.join(", ")}`,
        retryable: true,
        resolution: "설정 페이지에서 쿠팡 배송 설정을 채운 뒤 다시 시도해주세요.",
      },
    });
    logRegistrationAttempt(result);
    return NextResponse.json(result);
  }
  logStep("설정 확인", "success", "카테고리/배송/반품 설정 확인 완료");

  try {
    const { value: response, attempts } = await withRetry(
      () => callCoupangApi(credentials, { method: "POST", path: CREATE_PRODUCT_PATH, body: payload }),
      isRetryableCoupangResponse,
    );
    if (attempts > 1) {
      logStep("API 호출", "success", `${attempts}번째 시도에서 응답을 받았습니다.`);
    }

    if (response.status === 401 || response.status === 403) {
      logStep("API 호출", "failed", "쿠팡이 인증 정보를 거부했습니다.");
      const result: ListingResult = withMeta({
        status: "FAILED",
        platform: "coupang",
        mode: "LIVE",
        retryable: false,
        payload,
        error: {
          step: "AUTHENTICATION",
          code: "API002",
          message: "쿠팡이 인증 정보를 거부했습니다.",
          retryable: false,
          resolution: "access key/secret key를 다시 확인해주세요.",
        },
      });
      logRegistrationAttempt(result);
      return NextResponse.json(result);
    }

    const parsed = response.body as CreateProductResponse;
    const succeeded = response.ok && parsed?.data?.code === "SUCCESS";

    if (succeeded) {
      logStep("API 호출", "success", "쿠팡이 등록 요청을 수락했습니다.");
      logStep("완료", "success", "등록 완료");
      const result: ListingResult = withMeta({
        status: "SUBMITTED",
        platform: "coupang",
        mode: "LIVE",
        retryable: false,
        payload,
        externalProductId: parsed.data?.data != null ? String(parsed.data.data) : undefined,
        submittedAt: new Date().toISOString(),
      });
      logRegistrationAttempt(result);
      return NextResponse.json(result);
    }

    const message = parsed?.data?.message || parsed?.message || "쿠팡이 등록 요청을 거부했습니다.";
    const details = parsed?.data?.details;
    logStep("API 호출", "failed", details ? `${message} (${details})` : message);
    const result: ListingResult = withMeta({
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "COUPANG_API",
        code: isRetryableCoupangResponse(response) ? "API004" : "API005",
        message: details ? `${message} (${details})` : message,
        retryable: true,
        resolution: "표시된 원인을 확인하고 데이터를 고친 뒤 다시 시도해주세요.",
      },
    });
    logRegistrationAttempt(result);
    return NextResponse.json(result);
  } catch (error) {
    logStep(
      "API 호출",
      "failed",
      error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
    );
    const result: ListingResult = withMeta({
      status: "FAILED",
      platform: "coupang",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "NETWORK",
        code: "API003",
        message: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다.",
        retryable: true,
      },
    });
    logRegistrationAttempt(result);
    return NextResponse.json(result);
  }
}
