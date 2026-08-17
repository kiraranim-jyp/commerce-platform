import { NextResponse } from "next/server";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import {
  buildNaverProductPayload,
  validateNaverPayload,
  resolveNaverOriginArea,
  type NaverProductRegistrationPayload,
  type RegistrationStepLog,
  type ListingResult,
} from "@commerce/listing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getNaverCredentials } from "../../naver/_lib/env";
import { issueNaverAccessToken, callNaverApi, uploadNaverProductImages } from "../../naver/_lib/client";
import { fetchNaverReturnDeliveryCompanies, resolvePrimaryReturnCompany } from "../../naver/_lib/delivery";
import { fetchNaverOriginAreas } from "../../naver/_lib/origin";
import { getDefaultSellerProfile } from "../../coupang/_lib/seller-profile";
import { findBrandProfileByName } from "../../coupang/_lib/brand-profile";
import { getDefaultDescriptionTemplate } from "../../coupang/_lib/description-template";
import { markSnapshotRegistered } from "../../snapshots/_lib/snapshot";

/**
 * N-3.25(STEP 3) — SmartStore 실제 등록. HMAC 대신 OAuth 토큰이지만 원칙은
 * Coupang register route와 동일하다: 시크릿/토큰 발급은 여기서만 일어나고,
 * smartstoreExecutor(클라이언트, "use client" 트리)는 이 라우트를 fetch()로
 * 호출만 한다. 클라이언트는 category 확정 여부까지만 판단해서 categoryId를
 * 넘기고, 그 외 서버가 필요로 하는 모든 값(주소록/반품택배사/원산지/판매자
 * 프로필)은 /api/naver/resolve와 완전히 같은 방식으로 이 라우트가 직접
 * 조회한다 — 클라이언트가 들고 있는 오래된 캐시값을 신뢰하지 않는다(Coupang
 * register route가 출고지/브랜드/카테고리 메타를 매번 새로 조회하는 것과
 * 같은 이유).
 *
 * "여러 상품 일괄 등록" 방지: 이 라우트는 상품 1개만 받는다(배열 인터페이스
 * 자체를 만들지 않음) — Coupang register route와 동일 원칙.
 */
const CREATE_PRODUCT_PATH = "/v2/products";

interface NaverCertificationInfo {
  id: number;
  kindTypes?: string[];
}

interface NaverCategoryDetail {
  exceptionalCategories?: string[];
  certificationInfos?: NaverCertificationInfo[];
}

interface NaverAddressBookEntry {
  addressBookNo: number;
  addressType?: string;
}

async function logRegistrationAttempt(
  result: ListingResult,
  apiResponseBody?: unknown,
  snapshotId?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const row: Record<string, unknown> = {
    platform: result.platform,
    status: result.status,
    error_code: result.error?.code ?? null,
    trace_id: result.traceId ?? null,
    duration_ms: result.durationMs ?? null,
    external_product_id: result.externalProductId ?? null,
    payload: result.payload ?? null,
    response: apiResponseBody ?? null,
    snapshot_id: snapshotId ?? null,
  };
  // Coupang register route와 같은 이유(마이그레이션 016 미실행 환경 대비) —
  // snapshot_id 컬럼이 없으면 그 필드만 제외하고 재시도한다.
  const { error } = await supabase.from("registration_attempts").insert(row);
  if (error && "snapshot_id" in row) {
    delete row.snapshot_id;
    const retry = await supabase.from("registration_attempts").insert(row);
    if (retry.error) console.warn("[smartstore/register] registration_attempts 기록 실패:", retry.error.message);
  } else if (error) {
    console.warn("[smartstore/register] registration_attempts 기록 실패:", error.message);
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();
  const steps: RegistrationStepLog[] = [];
  const logStep = (step: string, status: RegistrationStepLog["status"], message: string) => {
    steps.push({ step, status, message, timestamp: new Date().toISOString() });
  };
  // payload는 인증/카테고리 확인을 통과한 뒤에만 만들어진다 — Coupang register
  // route와 동일하게, payload 이전에 return하는 실패 분기에서도 withMeta가
  // 항상 안전하게 undefined를 실을 수 있어야 한다.
  // eslint-disable-next-line prefer-const
  let payload: NaverProductRegistrationPayload | undefined;

  const body = (await request.json().catch(() => null)) as {
    product?: CanonicalProduct;
    listing?: ListingModel;
    categoryId?: string;
    snapshotId?: string;
  } | null;

  if (!body?.product || !body?.listing) {
    return NextResponse.json({ error: "product와 listing이 필요합니다." }, { status: 400 });
  }
  const { product, listing } = body;
  const snapshotId = body.snapshotId ?? null;

  const withMeta = (result: ListingResult): ListingResult => ({
    ...result,
    traceId,
    durationMs: Date.now() - startedAt,
    steps,
    payload,
  });

  const credentials = await getNaverCredentials();
  if (!credentials) {
    logStep("인증 확인", "failed", "네이버 인증 정보가 설정되어 있지 않습니다.");
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: false,
      error: {
        step: "AUTHENTICATION",
        message: "네이버 인증 정보가 설정되어 있지 않습니다.",
        retryable: false,
        resolution: "SMARTSTORE_CLIENT_ID/SMARTSTORE_CLIENT_SECRET 환경변수를 확인해주세요.",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId);
    return NextResponse.json(result);
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    logStep("인증 확인", "failed", tokenResult.message);
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: false,
      error: {
        step: "AUTHENTICATION",
        message: tokenResult.message,
        retryable: false,
        resolution: "네이버 커머스 API 인증 정보를 다시 확인해주세요.",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId);
    return NextResponse.json(result);
  }
  logStep("인증 확인", "success", "네이버 커머스 API 토큰 발급 완료");
  const accessToken = tokenResult.accessToken;

  // categoryId 확정 여부 — Coupang register route의 resolveVerifiedCategoryCode와
  // 같은 의미(isVerifiedPlatformCode까지 확인, state만 보고 판단하지 않는다).
  const candidate = listing.category.candidate;
  const leafCategoryId =
    candidate?.isVerifiedPlatformCode && candidate.platform === "smartstore" ? candidate.id : null;
  if (!leafCategoryId) {
    logStep("카테고리 확인", "failed", "확정된 네이버 카테고리가 없습니다.");
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: true,
      error: {
        step: "CATEGORY",
        message: "확정된 네이버 카테고리가 없습니다.",
        retryable: true,
        resolution: "등록 화면에서 카테고리를 먼저 확정해주세요.",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId);
    return NextResponse.json(result);
  }
  logStep("카테고리 확인", "success", `leafCategoryId=${leafCategoryId}`);

  // 이하 /api/naver/resolve GET route와 완전히 같은 조회 로직 — 결과 shape를
  // 두 곳에서 따로 만들지 않기 위해 같은 헬퍼 함수(fetchNaverReturnDeliveryCompanies
  // 등)를 그대로 재사용한다. resolve route는 UI 미리보기용, 이 라우트는 실제
  // 등록 직전 최신값 재조회용 — 목적은 다르지만 "무엇을 조회하는가"는 같아야
  // Payload Preview에서 본 값과 실제 등록 결과가 어긋나지 않는다.
  const detailResult = await callNaverApi(accessToken, { method: "GET", path: `/v1/categories/${leafCategoryId}` });
  const categoryDetail =
    detailResult.ok && detailResult.status === 200 ? (detailResult.body as NaverCategoryDetail) : null;
  const exceptionalCategories = categoryDetail?.exceptionalCategories ?? [];
  const categoryRequiresChildCertification = exceptionalCategories.includes("CHILD_CERTIFICATION");
  const childCert = (categoryDetail?.certificationInfos ?? []).find((c) =>
    c.kindTypes?.includes("CHILD_CERTIFICATION"),
  );
  const childCertificationInfoId = childCert?.id ?? null;

  let releaseAddressBookNo: number | null = null;
  let refundAddressBookNo: number | null = null;
  const addressResult = await callNaverApi(accessToken, {
    method: "GET",
    path: "/v1/seller/addressbooks-for-page?page=1",
  });
  if (addressResult.ok && addressResult.status === 200) {
    const addressBody = addressResult.body as { addressBooks?: NaverAddressBookEntry[] };
    const addressBooks = addressBody.addressBooks ?? [];
    releaseAddressBookNo = addressBooks.find((a) => a.addressType === "RELEASE")?.addressBookNo ?? null;
    refundAddressBookNo = addressBooks.find((a) => a.addressType === "REFUND_OR_EXCHANGE")?.addressBookNo ?? null;
  }
  logStep(
    "주소록 조회",
    releaseAddressBookNo != null && refundAddressBookNo != null ? "success" : "failed",
    `출고지=${releaseAddressBookNo ?? "없음"}, 반품지=${refundAddressBookNo ?? "없음"}`,
  );

  const [returnCompanies, sellerProfile, originAreas, brandProfile, descriptionTemplate] = await Promise.all([
    fetchNaverReturnDeliveryCompanies(accessToken),
    getDefaultSellerProfile(),
    fetchNaverOriginAreas(accessToken),
    product.brand.value ? findBrandProfileByName(product.brand.value) : Promise.resolve(null),
    getDefaultDescriptionTemplate(),
  ]);
  const primaryReturnCompany = returnCompanies ? resolvePrimaryReturnCompany(returnCompanies) : null;

  const resolvedCountryText =
    product.countryOfOrigin.value || brandProfile?.countryOfOrigin || sellerProfile?.defaultCountryOfOrigin || null;
  const originMatch = originAreas
    ? resolveNaverOriginArea(resolvedCountryText, originAreas)
    : { status: "NO_INPUT" as const, code: null, matchedDisplayName: null, requiresImporter: false };

  // buildNaverProductPayload/validateNaverPayload가 같은 근원 데이터를 보게
  // 한다 — NaverPayloadPreview.tsx가 클라이언트에서 하는 것과 동일한 원칙
  // (Resolver → Payload 단방향, 두 곳에서 따로 계산하지 않는다).
  const payloadInputCommon = {
    releaseAddressBookNo,
    refundAddressBookNo,
    primaryReturnDeliveryCompanyPriorityType: primaryReturnCompany?.priorityType ?? null,
    returnDeliveryFee: sellerProfile?.returnDeliveryCharge ?? null,
    exchangeDeliveryFee: sellerProfile?.exchangeDeliveryCharge ?? null,
    childCertificationInfoId,
    originAreaCode: originMatch.code,
    deliveryCompany: sellerProfile?.naverDeliveryCompanyCode ?? null,
    warrantyPolicy: sellerProfile?.qualityGuarantee || null,
    afterServiceDirector: sellerProfile?.asContactNumber || null,
  };

  // N-3.49(2026-08-17, 실제 등록 4차 시도로 발견) — 상품 등록 API는 외부 URL
  // (지금까지 여기 쓰던 Supabase Storage 공개 URL)을 대표/추가 이미지에
  // 직접 받지 않는다("올바른 이미지 파일이 아닙니다"로 거부됨, 실제 확인됨).
  // 반드시 "상품 이미지 다건 등록" API로 먼저 업로드하고 그 응답 url을
  // 써야 한다(WebSearch로 확인한 commerce-api-naver 공식 커뮤니티 설명 +
  // 진단 라우트로 실제 응답 구조 {images:[{url}]} 확인 완료).
  const sourceImageUrls = [listing.representativeImage, ...listing.additionalImages].filter(
    (u): u is string => Boolean(u),
  );
  let uploadedRepresentativeUrl = listing.representativeImage;
  let uploadedAdditionalUrls = listing.additionalImages;
  if (sourceImageUrls.length > 0) {
    const uploadResult = await uploadNaverProductImages(accessToken, sourceImageUrls);
    if (!uploadResult.ok) {
      logStep("이미지 업로드", "failed", uploadResult.message);
      const result = withMeta({
        status: "FAILED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: true,
        error: {
          step: "IMAGE",
          message: `네이버 이미지 업로드에 실패했습니다: ${uploadResult.message}`,
          retryable: true,
          resolution: "이미지 URL이 실제로 접근 가능한지 확인 후 다시 시도해주세요.",
        },
      });
      await logRegistrationAttempt(result, uploadResult.raw, snapshotId);
      return NextResponse.json(result);
    }
    logStep("이미지 업로드", "success", `${uploadResult.urls.length}개 이미지를 네이버에 업로드했습니다.`);
    [uploadedRepresentativeUrl, ...uploadedAdditionalUrls] = uploadResult.urls;
  }

  payload = buildNaverProductPayload({
    product,
    listing: { ...listing, representativeImage: uploadedRepresentativeUrl, additionalImages: uploadedAdditionalUrls },
    leafCategoryId,
    ...payloadInputCommon,
    categoryRequiresChildCertification,
    originAreaRequiresContent: originMatch.status === "OTHER_MANUAL",
    descriptionTemplate: descriptionTemplate ?? null,
    commonImages: sellerProfile
      ? {
          topCommonImageUrl: sellerProfile.topCommonImageUrl,
          topCommonImageEnabled: sellerProfile.topCommonImageEnabled,
          bottomCommonImageUrl: sellerProfile.bottomCommonImageUrl,
          bottomCommonImageEnabled: sellerProfile.bottomCommonImageEnabled,
        }
      : undefined,
    brandIntro: brandProfile?.brandIntro ?? null,
  });

  // STEP 5(Readiness Gate) — Payload validation을 API 호출 전 마지막 방어선으로
  // 한 번 더 확인한다. Editor의 Readiness가 화면에서 이미 막아주는 게 정상
  // 경로지만, 오래된 클라이언트 상태로 요청이 오는 경우까지 대비한다(Coupang
  // register route의 Compliance FAIL 차단과 같은 이유).
  const validation = validateNaverPayload(
    payload,
    {
      product,
      ...payloadInputCommon,
      returnCompaniesFetchFailed: returnCompanies === null,
      originAreaRequiresImporter: originMatch.requiresImporter,
    },
    categoryRequiresChildCertification,
  );
  logStep(
    "Payload 검증",
    validation.ok ? "success" : "failed",
    `READY ${validation.readyCount} / MISSING ${validation.missingCount} / BLOCKED ${validation.blockedCount}` +
      (validation.ok ? "" : ` — ${validation.issues.map((i) => i.reason).join(" / ")}`),
  );
  if (!validation.ok) {
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "VALIDATION",
        message: `등록에 필요한 값이 부족합니다: ${validation.issues.map((i) => i.reason).join(" ")}`,
        retryable: true,
        resolution: "등록 화면 또는 설정 페이지에서 부족한 항목을 채운 뒤 다시 시도해주세요.",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId);
    return NextResponse.json(result);
  }

  try {
    const response = await callNaverApi(accessToken, {
      method: "POST",
      path: CREATE_PRODUCT_PATH,
      body: payload,
    });

    if (!response.ok) {
      // response.ok === false는 NaverApiError(네트워크 예외) 케이스뿐이다 —
      // status가 있는 응답은 항상 ok: true(callNaverApi가 fetch 자체가 던진
      // 예외만 여기로 분류한다, HTTP 4xx/5xx는 ok:true+status로 내려온다).
      const message = response.message;
      logStep("API 호출", "failed", message);
      const result = withMeta({
        status: "FAILED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: true,
        payload,
        error: {
          step: "NETWORK",
          message,
          retryable: true,
        },
      });
      await logRegistrationAttempt(result, "body" in response ? response.body : undefined, snapshotId);
      return NextResponse.json(result);
    }

    if (response.status === 401 || response.status === 403) {
      logStep("API 호출", "failed", "네이버가 인증 정보를 거부했습니다.");
      const result = withMeta({
        status: "FAILED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: false,
        payload,
        error: {
          step: "AUTHENTICATION",
          message: "네이버가 인증 정보를 거부했습니다.",
          retryable: false,
          resolution: "Client ID/Client Secret을 다시 확인해주세요.",
        },
      });
      await logRegistrationAttempt(result, response.body, snapshotId);
      return NextResponse.json(result);
    }

    // 성공 판정은 HTTP 2xx만 본다 — 실제 응답 body 필드명(예: originProductNo)은
    // 공식 스펙 문서로 확인된 적이 없고(N-3.25 STEP 10이 최초 실제 호출) 추측해서
    // 파싱하지 않는다(CPO 반복 지시: 추측 구현 금지). 응답 원문은 그대로
    // registration_attempts.response에 남겨서, STEP 10 실제 등록 성공 시 필드명을
    // 실측으로 확인한 뒤 이 부분만 후속 스프린트에서 좁혀 넣는다.
    if (response.status >= 200 && response.status < 300) {
      logStep("API 호출", "success", `네이버가 등록 요청을 수락했습니다(HTTP ${response.status}).`);
      const result = withMeta({
        status: "SUBMITTED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: false,
        payload,
        submittedAt: new Date().toISOString(),
      });
      await logRegistrationAttempt(result, response.body, snapshotId);
      if (snapshotId) await markSnapshotRegistered(snapshotId);
      return NextResponse.json(result);
    }

    logStep("API 호출", "failed", `네이버가 등록 요청을 거부했습니다(HTTP ${response.status}).`);
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: response.status >= 500,
      payload,
      error: {
        step: "NETWORK",
        message: `네이버가 등록 요청을 거부했습니다(HTTP ${response.status}).`,
        retryable: response.status >= 500,
        resolution: "표시된 원인을 확인하고 데이터를 고친 뒤 다시 시도해주세요.",
      },
    });
    await logRegistrationAttempt(result, response.body, snapshotId);
    return NextResponse.json(result);
  } catch (error) {
    logStep("API 호출", "failed", error instanceof Error ? error.message : "네이버 서버에 연결할 수 없습니다.");
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "NETWORK",
        message: error instanceof Error ? error.message : "네이버 서버에 연결할 수 없습니다.",
        retryable: true,
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId);
    return NextResponse.json(result);
  }
}
