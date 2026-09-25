import { NextResponse } from "next/server";
import type { ListingModel } from "@commerce/marketplace";
import { isVerifiedCategorySelected } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveProductSignals } from "@commerce/category";
import {
  buildNaverProductPayload,
  validateNaverPayload,
  resolveNaverOriginArea,
  resolveNaverProductAttributes,
  getNaverCategoryAttributeMeta,
  COMPLIANCE_POLICY_VERSION,
  compareRegisteredProduct,
  type NaverProductRegistrationPayload,
  type RegistrationStepLog,
  type ListingResult,
} from "@commerce/listing";
import { buildChannelPriceAuditRecord } from "@/lib/channel-price-audit";
import { requireRegistrationAccess } from "@/lib/auth/require-registration-access";
import { blocksCreate, resolveLifecycle } from "@/app/pipeline/commerce/channel-lifecycle";
import {
  findChannelProductBySnapshot,
  findProductIdBySnapshot,
  linkChannelProduct,
  replaceChannelProductLink,
  touchChannelProduct,
} from "@/app/api/_lib/channel-product";
import { fetchRegisteredProduct, updateRegisteredProduct } from "../_lib/update-product";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordAuditLog } from "@/lib/audit-log";
import { getNaverCredentials } from "../../naver/_lib/env";
import { issueNaverAccessToken, callNaverApi, uploadNaverProductImages } from "../../naver/_lib/client";
import { resolveNaverContext } from "../../naver/_lib/resolve-context";
import { markSnapshotRegistered } from "../../snapshots/_lib/snapshot";
import { getLatestSellerComplianceConfirmation } from "../_lib/seller-compliance";

/**
 * N-3.25(STEP 3) — SmartStore 실제 등록. HMAC 대신 OAuth 토큰이지만 원칙은
 * Coupang register route와 동일하다: 시크릿/토큰 발급은 여기서만 일어나고,
 * smartstoreExecutor(클라이언트, "use client" 트리)는 이 라우트를 fetch()로
 * 호출만 한다. 클라이언트는 category 확정 여부까지만 판단해서 categoryId를
 * 넘기고, 그 외 서버가 필요로 하는 모든 값(주소록/반품택배사/원산지/판매자
 * 프로필)은 resolveNaverContext()(Sprint B-7부터 /api/naver/resolve와
 * 물리적으로 같은 함수)를 그대로 호출해서 얻는다 — 클라이언트가 들고 있는
 * 오래된 캐시값을 신뢰하지 않는다(Coupang register route가 출고지/브랜드/
 * 카테고리 메타를 매번 새로 조회하는 것과 같은 이유).
 *
 * "여러 상품 일괄 등록" 방지: 이 라우트는 상품 1개만 받는다(배열 인터페이스
 * 자체를 만들지 않음) — Coupang register route와 동일 원칙.
 */
const CREATE_PRODUCT_PATH = "/v2/products";

/** N-3.70 STEP8 — Naver 에러 응답 필드명이 공식 문서로 확인된 적이 없어
 * 여러 후보를 순서대로 시도한다(추측 파싱, 실측되면 좁힌다). invalidInputs
 * 배열은 필드별 사유를 합쳐서 보여준다. */
function extractNaverErrorReason(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const invalidInputs = obj.invalidInputs;
  if (Array.isArray(invalidInputs) && invalidInputs.length > 0) {
    const parts = invalidInputs
      .map((item) => {
        if (item == null || typeof item !== "object") return String(item);
        const i = item as Record<string, unknown>;
        const name = i.name ?? i.field ?? "";
        const msg = i.message ?? i.reason ?? JSON.stringify(i);
        return name ? `${name}: ${msg}` : String(msg);
      })
      .join(" / ");
    return parts;
  }
  const direct = obj.message ?? obj.errorMessage ?? obj.error;
  if (typeof direct === "string" && direct.trim()) return direct;
  if (direct != null && typeof direct === "object") return JSON.stringify(direct).slice(0, 500);
  // 알려진 필드가 하나도 없으면 원문을 그대로 잘라 보여준다.
  const raw = JSON.stringify(obj);
  return raw && raw !== "{}" ? raw.slice(0, 500) : null;
}


/**
 * P0-CHANNEL-03 F-5 — snapshot 이 속한 Product 를 찾아 ChannelProduct 를 잇는다.
 *
 * 🔴 snapshot 이 아니라 «Product» 에 잇는다. 그래야 재분석으로 새 snapshot 이
 * 생겨도 연결이 끊어지지 않는다 — 그 끊김이 SmartStore 외부번호 6개를 만들었다.
 *
 * 🔴 조용히 실패한다. 등록은 이미 성공했고, 상품은 네이버에 나가 있다.
 * DB 기록 실패로 그 사실을 뒤집지 않는다.
 */
async function linkSmartStoreChannelProduct(
  snapshotId: string | null | undefined,
  externalProductId: string | undefined,
): Promise<string | null> {
  if (!snapshotId || !externalProductId) return null;
  /* 🔴 조회를 여기서 «다시 짜지» 않는다 — 공통 저장소를 쓴다. 세 채널이 각자
     같은 조회를 복제하면 한 채널만 빠뜨리는 일이 생긴다. */
  const productId = await findProductIdBySnapshot(snapshotId);
  /* 기존 381건은 product_id 가 NULL 이다 — 예전과 똑같이 attempt 만 남는다. */
  if (!productId) return null;
  const linked = await linkChannelProduct({
    productId,
    channel: "smartstore",
    externalProductId,
  });
  return linked?.id ?? null;
}

async function logRegistrationAttempt(
  result: ListingResult,
  apiResponseBody?: unknown,
  snapshotId?: string | null,
  jobKey?: string | null,
  /* P0-CHANNEL-03 — 이 시도가 «무엇» 이었는가. resolveLifecycle() 이 정한 값을
     그대로 받는다. 🔴 여기서 추론하지 않는다 — 「external_product_id 가 있으면
     UPDATE」 같은 추론을 하면 판단이 두 벌이 된다. */
  lifecycle?: { operation: "CREATE" | "UPDATE" | "RECREATE"; channelProductId: string | null } | null,
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
    // Sprint B-1 — Coupang register route와 동일한 이유(고객 문의 시 조인 없이
    // 바로 검색).
    job_key: jobKey ?? null,
    // PHASE 3.2 — 채널 · 최종 등록가격 · 가격 출처 · 등록 시점. 쿠팡 route와
    // 완전히 같은 구조를 같은 함수(buildChannelPriceAuditRecord)로 만든다 —
    // 채널마다 감사 기록 모양이 달라지면 나중에 두 번 읽어야 한다.
    channel_price_record: result.channelPriceRecord ?? null,
    /* 🔴 모르면 «비운다». 기존 97건이 NULL 인 것과 같은 상태가 될 뿐이고,
       없는 것을 'CREATE' 로 채우면 확인하지 않은 것을 확인했다고 적는 셈이다
       (그중 일부는 실제로 같은 상품의 중복 등록이었다). */
    operation: lifecycle?.operation ?? null,
    channel_product_id: lifecycle?.channelProductId ?? null,
  };
  // Coupang register route와 같은 이유(마이그레이션 016/025/048 미실행 환경 대비) —
  // 해당 컬럼이 없으면 그 필드만 제외하고 재시도한다. channel_price_record가
  // 맨 앞인 이유도 쿠팡 route와 같다(가장 새 컬럼 = 가장 먼저 포기).
  /* 가장 새 컬럼이 가장 먼저 포기된다 — 마이그레이션 063 미적용 환경에서도
     등록 «이력 기록» 자체가 실패하지 않게. */
  const optionalColumns = [
    "channel_product_id",
    "operation",
    "channel_price_record",
    "snapshot_id",
    "job_key",
  ];
  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { error } = await supabase.from("registration_attempts").insert(row);
    if (!error) return;
    console.warn(`[smartstore/register] registration_attempts 기록 실패(시도 ${attempt + 1}):`, error.message);
    const nextColumn = optionalColumns[attempt];
    if (!nextColumn || !(nextColumn in row)) break;
    delete row[nextColumn];
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
    jobKey?: string;
    /**
     * P0-CHANNEL-03 F-7 — RECREATE 를 «실행해도 되는가» 에 대한 셀러 동의.
     *
     * 🔴 이 값이 lifecycle 을 «정하지» 않는다. 무엇을 할지는 서버가
     * resolveLifecycle() 로 정하고, 이 필드는 그 결과가 RECREATE 일 때
     * 「그래도 진행할까요」에 대한 대답일 뿐이다. 클라이언트가 보낸 값을
     * 신뢰하지 않는다는 이 라우트의 원칙과 충돌하지 않는 이유가 그것이다.
     *
     * 🔴 없으면 실행하지 «않는다». RECREATE 는 마켓에 새 상품을 만들고 옛
     * 상품은 그대로 남는다 — 그것을 어떻게 할지는 셀러의 사업 판단이지
     * 우리가 대신 정할 일이 아니다. 묻지 않고 만들면 그것이 바로 이번에
     * 고치려는 «중복» 이다.
     */
    confirmRecreate?: boolean;
  } | null;

  if (!body?.product || !body?.listing) {
    return NextResponse.json({ error: "product와 listing이 필요합니다." }, { status: 400 });
  }
  const { product, listing } = body;
  const snapshotId = body.snapshotId ?? null;
  const jobKey = body.jobKey ?? null;
  /* 🔴 `=== true` 로 받는다. 문자열 "false" 나 0 이 동의로 읽히면 안 된다 —
     동의의 기본값은 «안 함» 이어야 한다(아래 F-7 블록 참고). */
  const confirmRecreate = body.confirmRecreate === true;

  // P0-C PRE-REGISTER SECURITY GATE(CEO 승인, 2026-09-17) — 쿠팡/롯데ON register와
  // **같은 함수**를 같은 자리(자격증명 조회 직전)에 둔다. 네이버 계정은
  // commerce_accounts platform='naver'의 **첫 행**이고 판매자 프로필도 전역이라,
  // 다른 워크스페이스 셀러가 등록하면 대표 계정 스토어에 상품이 생긴다.
  const access = await requireRegistrationAccess(snapshotId);
  if (!access.ok) return access.response;

  // PHASE 3.2 — 실제로 이 채널에 나간 최종 등록가격과 그 근거. 새로 계산하지
  // 않고 클라이언트가 어댑터로 만든 listing 값을 그대로 기록한다(payload의
  // originProduct.salePrice도 같은 listing.priceKrw에서 나온다).
  const channelPriceRecord = buildChannelPriceAuditRecord(listing);

  const withMeta = (result: ListingResult): ListingResult => ({
    ...result,
    traceId,
    durationMs: Date.now() - startedAt,
    steps,
    payload,
    channelPriceRecord,
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
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
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
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }
  logStep("인증 확인", "success", "네이버 커머스 API 토큰 발급 완료");
  const accessToken = tokenResult.accessToken;

  // categoryId 확정 여부 — Coupang register route의 resolveVerifiedCategoryCode와
  // 같은 의미(isVerifiedPlatformCode까지 확인, state만 보고 판단하지 않는다).
  // N-3.65 — 위 주석과 달리 실제로는 state(SELECTED/CONFIRMED) 체크가 빠져있었다
  // (isVerifiedPlatformCode만 확인). AI가 추천만 하고 사용자가 아직 확인하지
  // 않은 카테고리(state: RECOMMENDED)도 여기를 통과해 실제 등록 API까지
  // 도달했다 — isVerifiedCategorySelected()로 통일해 이 파일의 원래 의도(주석)와
  // 실제 코드를 일치시킨다.
  const candidate = listing.category.candidate;
  const leafCategoryId =
    isVerifiedCategorySelected(listing.category) && candidate?.platform === "smartstore" ? candidate.id : null;
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
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }
  logStep("카테고리 확인", "success", `leafCategoryId=${leafCategoryId}`);

  // N-4.00 A-2(대표님 지시) — 카테고리 상품속성(성별/타켓연령/연령/주요소재)을
  // 이 라우트가 실제로 계산해서 payload에 실어 보낸다. getNaverCategoryAttributeMeta가
  // 실측하지 않은 카테고리(null)면 그냥 건너뛴다 — 속성 매핑이 없다고 등록
  // 자체를 막지 않는다(하드코딩 추정 금지 원칙, attribute-resolver.ts와 동일).
  const categoryAttributeMeta = getNaverCategoryAttributeMeta(leafCategoryId);
  const attributeResolution = categoryAttributeMeta
    ? resolveNaverProductAttributes(product, resolveProductSignals(product), categoryAttributeMeta)
    : null;
  if (attributeResolution) {
    logStep(
      "상품속성 매핑",
      "success",
      `${attributeResolution.attributes.length}개 속성 자동매핑(${attributeResolution.results.map((r) => `${r.attributeName}:${r.status}`).join(", ")})`,
    );
  } else {
    logStep("상품속성 매핑", "success", `이 카테고리(${leafCategoryId})는 아직 속성 메타데이터가 없어 건너뜁니다.`);
  }

  // Sprint B-7(CPO 지시: "Preview와 실제 Register가 서로 다른 값을 계산하지
  // 않도록 동일 resolver를 사용") — 이전에는 이 라우트가 /api/naver/resolve
  // GET route와 "같은 로직"을 복붙해서 따로 유지했다(주석으로 "같아야 한다"고만
  // 적어뒀을 뿐, 실제로 같은 함수를 호출하진 않았다). 물리적으로 같은 함수를
  // 공유하지 않으면 한쪽만 고치고 다른 쪽을 놓치는 드리프트 위험이 있다(오늘
  // registration-report.ts에서 실제로 같은 종류의 버그가 있었다). 이미 발급된
  // accessToken을 그대로 넘겨 불필요한 재발급 API 호출은 만들지 않는다.
  const context = await resolveNaverContext({
    categoryId: leafCategoryId,
    countryOfOrigin: product.countryOfOrigin.value || null,
    brand: product.brand.value || null,
    accessToken,
  });
  /* 🔴 PIVOT-03 R6-FS — 아래 일반 분기보다 «앞» 에 둔다. 저쪽은 step 을
     AUTHENTICATION 으로, retryable 을 false 로 박아 두는데 이건 인증 문제도
     아니고 다시 시도하면 될 일이다. 같은 자리에 흘려보내면 셀러가 네이버
     계정을 의심하게 된다 — 원인이 우리 쪽인데. */
  if (context.status === "SELLER_SETTINGS_UNAVAILABLE") {
    logStep("판매자 정보 확인", "failed", context.message);
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: true,
      error: { step: "VALIDATION", message: context.message, retryable: true },
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }
  if (context.status !== "OK") {
    logStep("컨텍스트 조회", "failed", context.message);
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: false,
      error: { step: "AUTHENTICATION", message: context.message, retryable: false },
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }
  const categoryRequiresChildCertification = context.category?.requiresChildCertification ?? false;
  const childCertificationInfoId = context.category?.childCertificationInfoId ?? null;

  // N-3.52(CPO 지시 STEP14) — "API 등록 가능"과 "판매 가능"을 분리한다.
  // 판매자가 "판매 전 최종 확인" 화면에서 남긴 가장 최근 확인 기록을 여기서
  // 다시 조회한다(클라이언트가 보내는 값을 신뢰하지 않는다 — 이 라우트의
  // 다른 모든 조회와 같은 원칙). validateNaverPayload가 이 기록의
  // policyVersion/categoryCode가 지금과 일치할 때만 KC 게이트를 통과시킨다.
  const sellerComplianceConfirmationRow = await getLatestSellerComplianceConfirmation(snapshotId);
  const sellerConfirmationValid =
    sellerComplianceConfirmationRow?.confirmed === true &&
    sellerComplianceConfirmationRow.policyVersion === COMPLIANCE_POLICY_VERSION &&
    sellerComplianceConfirmationRow.categoryCode === leafCategoryId;
  logStep(
    "판매 전 확인",
    sellerConfirmationValid ? "success" : "failed",
    sellerConfirmationValid
      ? `판매자가 확인함(kcStatus=${sellerComplianceConfirmationRow!.kcStatus}, policyVersion=${sellerComplianceConfirmationRow!.policyVersion})`
      : "판매자가 아직 이 상품/카테고리에 대해 '판매 전 최종 확인'을 하지 않았습니다.",
  );
  // N-3.52(CPO 지시 STEP1/14) — DATA_READY + PLATFORM_READY만으로는 등록을
  // 허용하지 않는다. SELLER_CONFIRMED(판매자가 "판매 전 최종 확인" 화면에서
  // 실제로 확인 버튼을 눌렀는지)를 모든 카테고리(KIDS 여부와 무관하게)에
  // 대해 서버에서 다시 검증한다 — 클라이언트가 보낸 상태를 신뢰하지 않는다
  // (이 라우트의 다른 모든 조회와 같은 원칙).
  if (!sellerConfirmationValid) {
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: true,
      error: {
        step: "VALIDATION",
        message: "판매자가 '판매 전 최종 확인'을 아직 하지 않았습니다.",
        retryable: true,
        resolution: "등록 화면에서 '판매 전 최종 확인'을 먼저 진행해주세요.",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }

  const { releaseAddressBookNo, refundAddressBookNo } = context.address;
  logStep(
    "주소록 조회",
    releaseAddressBookNo != null && refundAddressBookNo != null ? "success" : "failed",
    `출고지=${releaseAddressBookNo ?? "없음"}, 반품지=${refundAddressBookNo ?? "없음"}`,
  );

  // buildNaverProductPayload/validateNaverPayload가 같은 근원 데이터를 보게
  // 한다 — NaverPayloadPreview.tsx가 클라이언트에서 하는 것과 동일한 원칙
  // (Resolver → Payload 단방향, 두 곳에서 따로 계산하지 않는다). 이 값들은
  // 전부 resolveNaverContext()가 이미 계산해준 것을 그대로 옮긴다.
  const payloadInputCommon = {
    releaseAddressBookNo,
    refundAddressBookNo,
    primaryReturnDeliveryCompanyPriorityType: context.delivery.primaryReturnCompany?.priorityType ?? null,
    sellerDeliveryFee: context.delivery.deliveryFee,
    returnDeliveryFee: context.delivery.returnDeliveryFee,
    exchangeDeliveryFee: context.delivery.exchangeDeliveryFee,
    childCertificationInfoId,
    originAreaCode: context.origin.match.code,
    deliveryCompany: context.courier.value,
    warrantyPolicy: context.notice.warrantyPolicy,
    afterServiceDirector: context.notice.afterServiceDirector,
    // N-3.51 STEP2 — afterServiceInfo.afterServiceTelephoneNumber 전용 실제
    // 전화번호 소스. afterServiceDirector("해외 구매대행으로 A/S 불가" 같은
    // 자유 텍스트)와 달리 companyContactNumber는 이미 실제 전화번호 형식으로
    // 채워져 있는 필드다(예: "+821046458306").
    afterServiceTelephoneNumber: context.notice.companyContactNumber,
  };

  // N-3.49(2026-08-17, 실제 등록 4차 시도로 발견) — 상품 등록 API는 외부 URL
  // (지금까지 여기 쓰던 Supabase Storage 공개 URL)을 대표/추가 이미지에
  // 직접 받지 않는다("올바른 이미지 파일이 아닙니다"로 거부됨, 실제 확인됨).
  // 반드시 "상품 이미지 다건 등록" API로 먼저 업로드하고 그 응답 url을
  // 써야 한다(WebSearch로 확인한 commerce-api-naver 공식 커뮤니티 설명 +
  // 진단 라우트로 실제 응답 구조 {images:[{url}]} 확인 완료).
  // N-3.50 STEP5(조사+범위 결정, CPO 지시로 "저장 구조 없으면 이번엔 범위만
  // 결정") — source URL → 업로드된 Naver URL 매핑을 영구 저장할 인프라가
  // 현재 없다(image_assets 테이블은 파이프라인 자체 처리 이미지용이라 스키마가
  // 안 맞음). 이번 등록 요청 "안에서"는 각 이미지가 정확히 1번씩만 업로드되므로
  // (재시도 루프 없음) 요청 내 중복은 이미 없다. 남은 위험은 사용자가 실패한
  // 등록을 수동으로 다시 시도할 때 이미지가 다시 업로드되는 것(낭비지만 상품
  // 데이터 손상 위험은 없음 — 새 호스팅 URL이 또 생길 뿐). 영구 매핑 테이블은
  // 이번 스프린트 범위 밖으로 남기고, 다음 스프린트에서 실제 재시도 빈도를
  // 관찰한 뒤 필요성을 재판단한다.
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
      await logRegistrationAttempt(result, uploadResult.raw, snapshotId, jobKey);
      return NextResponse.json(result);
    }
    logStep("이미지 업로드", "success", `${uploadResult.urls.length}개 이미지를 네이버에 업로드했습니다.`);
    [uploadedRepresentativeUrl, ...uploadedAdditionalUrls] = uploadResult.urls;
  }

  payload = buildNaverProductPayload({
    product,
    /* P0-KC-12 — 빌더에도 선언을 넘긴다. validator 호출부만 고치고
       여기를 빼서, 실제 payload 에 certificationTargetExcludeContent 와
       kids.certificationType 이 «둘 다 없는» 채로 나갔다(실측 400). */
    smartStoreKcDeclaration: product.smartStoreKcDeclaration,
    listing: { ...listing, representativeImage: uploadedRepresentativeUrl, additionalImages: uploadedAdditionalUrls },
    leafCategoryId,
    ...payloadInputCommon,
    categoryRequiresChildCertification,
    originAreaRequiresContent: context.origin.match.status === "OTHER_MANUAL",
    descriptionTemplate: context.detailPage.descriptionTemplate,
    // N-3.86 STEP3(대표님 지시) — 클라이언트가 보낸 detailBlocks는 더 이상
    // 읽지 않는다. resolveNaverContext()가 이미 resolveDetailBlocks()로
    // 계산해서 내려준 값(context.detailPage.detailBlocks)만 쓴다.
    detailBlocks: context.detailPage.detailBlocks,
    commonImages: context.detailPage.commonImages,
    brandIntro: context.detailPage.brandIntro,
    resolvedManufacturer: context.notice.manufacturer,
    resolvedAttributes: attributeResolution?.attributes,
  });

  // STEP 5(Readiness Gate) — Payload validation을 API 호출 전 마지막 방어선으로
  // 한 번 더 확인한다. Editor의 Readiness가 화면에서 이미 막아주는 게 정상
  // 경로지만, 오래된 클라이언트 상태로 요청이 오는 경우까지 대비한다(Coupang
  // register route의 Compliance FAIL 차단과 같은 이유).
  const validation = validateNaverPayload(
    payload,
    {
      product,
      /* P0-KC-11 — 판매자 «선언» 을 서버 검증에도 넘긴다. 화면이 보낸 것을
         믿는 게 아니라, 이 라우트가 DB 에서 읽은 product 의 값을 쓴다
         (이 라우트의 다른 모든 조회와 같은 원칙). */
      smartStoreKcDeclaration: product.smartStoreKcDeclaration,
      ...payloadInputCommon,
      returnCompaniesFetchFailed: context.delivery.returnCompaniesFetchFailed,
      originAreaRequiresImporter: context.origin.match.requiresImporter,
    },
    categoryRequiresChildCertification,
    {
      // N-3.52(CPO 지시) — 카테고리 확인 자체는 이 라우트가 이미
      // leafCategoryId를 실제로 확정한 뒤에만 여기까지 도달하므로 항상 true다
      // (카테고리 미확정이면 위에서 이미 CATEGORY 단계에서 FAILED 반환).
      categoryVerified: true,
      sellerComplianceConfirmation: sellerComplianceConfirmationRow
        ? {
            confirmed: sellerComplianceConfirmationRow.confirmed,
            kcStatus: sellerComplianceConfirmationRow.kcStatus,
            policyVersion: sellerComplianceConfirmationRow.policyVersion,
            categoryCode: sellerComplianceConfirmationRow.categoryCode,
          }
        : null,
    },
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
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     P0-CHANNEL-03 F-7 — 「만들 것인가 · 고칠 것인가 · 다시 만들 것인가」.

     지금까지 이 라우트에는 «만들기» 하나뿐이었다. 그래서 상품을 고치면 갈 곳이
     없었고, 재분석으로 새 snapshot 이 생기면 «또» 만들었다 — 그것이 SmartStore
     외부번호 6개의 뿌리다. 이 블록이 그 갈림길을 만든다.

     🔴 판단을 여기서 «하지 않는다». resolveLifecycle() 이 한다. 이 자리가 하는
     일은 판단에 필요한 사실(지금 나가 있는 것)을 읽어다 주고, 정해진 것을
     실행하는 것뿐이다. 라우트가 직접 판단하면 「화면은 UPDATE 라는데 실제로는
     새 상품이 생기는」 상태가 된다.

     🔴 연결이 없으면 예전과 «완전히 같은» CREATE 경로로 내려간다. 기존 381
     snapshot 은 product_id 가 NULL 이라 여기서 항상 null 이 나온다 — 그 상품들의
     등록 동작은 이 스프린트로 한 톨도 바뀌지 않는다.
  ══════════════════════════════════════════════════════════════════════════ */
  const existing = await findChannelProductBySnapshot(snapshotId, "smartstore");

  /* 🔴 실행할 operation 을 «변수로 들고 간다». 아래 성공 분기에서 `existing` 을
     다시 보고 추론하면 판단이 두 벌이 된다(F-5 가 못 박은 것). */
  let plannedOperation: "CREATE" | "RECREATE" = "CREATE";

  if (existing) {
    logStep("현재 연결 확인", "success", `이미 등록돼 있습니다(originProductNo=${existing.externalProductId}).`);

    /* ① 지금 나가 있는 것을 읽는다. 🔴 읽지 못하면 «정하지 않는다» — 무엇이
       바뀌었는지 모르는 채로 UPDATE 를 보내면 전체 교체라 무엇이 지워질지
       모르고, CREATE 로 내려보내면 중복이 하나 더 생긴다. 막고 말한다. */
    const current = await fetchRegisteredProduct(accessToken, existing.externalProductId);
    if (!current.ok) {
      logStep("현재 내용 조회", "failed", current.message);
      const result = withMeta({
        status: "FAILED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: true,
        payload,
        externalProductId: existing.externalProductId,
        error: {
          step: "VALIDATION",
          message: `지금 등록돼 있는 내용을 읽지 못해 수정할지 새로 등록할지 정할 수 없습니다: ${current.message}`,
          retryable: true,
          resolution:
            "잠시 후 다시 시도해주세요. 계속 실패하면 스마트스토어에서 해당 상품이 아직 있는지 확인해주세요.",
        },
      });
      await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
      return NextResponse.json(result);
    }

    /* ② 무엇이 달라졌는가 — 「우리가 보낸 것」이 아니라 「나가 있는 것」 기준. */
    const comparison = compareRegisteredProduct(current.snapshot, payload);
    logStep(
      "변경 확인",
      "success",
      `카테고리=${comparison.category} · 변경 ${comparison.changedFields.length}건` +
        (comparison.changedFields.length > 0 ? `(${comparison.changedFields.join(", ")})` : "") +
        ` · 비교 못 한 축 ${comparison.notCompared.length}개`,
    );

    /* ③ 판단 — 한 곳에서. */
    const decision = resolveLifecycle("smartstore", true, {
      fields: comparison.changedFields,
      category: comparison.category === "CHANGED",
      /* 🔴 UNKNOWN 을 `category: false` 로 접지 않는다. 모르는 것과 안 바뀐
         것은 다르고, 그 차이가 UPDATE 와 RECREATE 를 가른다. */
      categoryUnknown: comparison.category === "UNKNOWN",
      /* 🔴 지금은 «항상 false» 다 — 이미지처럼 구조적으로 못 보는 축이 있어서
         notCompared 가 빌 수 없다. 그래서 NOOP 은 이 라우트에서 아직 나오지
         않는다. 그 사실을 숨기지 않고 그대로 넘긴다. */
      comparedEverything: comparison.notCompared.length === 0,
    });
    logStep("작업 판단", "success", `${decision.operation} — ${decision.reason}`);

    if (decision.operation === "UPDATE") {
      /* 🔴 ①에서 읽은 스냅샷을 그대로 넘긴다. 다시 읽으면 그 사이에 값이 바뀔
         수 있고, 그러면 «판단한 상태» 와 «preflight 가 검사한 상태» 가 달라진다.
         같은 것을 보고 정하고 보낸다. */
      const updated = await updateRegisteredProduct(
        accessToken,
        existing.externalProductId,
        payload,
        current.snapshot,
      );

      if (!updated.ok) {
        const lost = updated.risks?.map((r) => r.label).join(", ");
        const message = lost ? `${updated.message} (${lost})` : updated.message;
        logStep("상품 수정", "failed", message);
        const result = withMeta({
          status: "FAILED",
          platform: "smartstore",
          mode: "LIVE",
          retryable: true,
          payload,
          externalProductId: existing.externalProductId,
          error: {
            /* PREFLIGHT 는 «보내지 않았다» 는 뜻이라 데이터 문제(VALIDATION)고,
               SUBMIT/FETCH/VERIFY 는 네이버와 주고받다 생긴 일이다. */
            step: updated.step === "PREFLIGHT" ? "VALIDATION" : "NETWORK",
            message,
            retryable: true,
            resolution:
              updated.step === "PREFLIGHT"
                ? "수정하면 사라지는 항목이 있어 전송하지 않았습니다 — 표시된 항목을 채운 뒤 다시 시도해주세요."
                : updated.step === "VERIFY"
                  ? "🔴 네이버가 다른 상품번호를 돌려줬습니다 — 재시도 전에 스마트스토어에서 상품이 새로 생기지 않았는지 먼저 확인해주세요."
                  : "잠시 후 다시 시도해주세요.",
          },
        });
        /* 🔴 operation 을 적지 않는다. UPDATE «하려다 못 한» 것이고, 그중
           PREFLIGHT 실패는 네이버에 아무것도 보내지 않았다. 이력에 'UPDATE' 로
           적으면 수정을 시도해 실패한 것과 애초에 보내지도 않은 것이 같아진다. */
        await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
        return NextResponse.json(result);
      }

      logStep("상품 수정", "success", `수정했습니다(originProductNo=${updated.originProductNo}).`);
      const result = withMeta({
        status: "SUBMITTED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: false,
        payload,
        submittedAt: new Date().toISOString(),
        /* 🔴 «같은» 외부번호다. 이것이 UPDATE 가 성공했다는 증거이고,
           update-product.ts 가 응답 번호를 대조해 이미 확인했다. */
        externalProductId: updated.originProductNo,
      });
      await touchChannelProduct(existing.id);
      await logRegistrationAttempt(result, undefined, snapshotId, jobKey, {
        operation: "UPDATE",
        channelProductId: existing.id,
      });
      if (snapshotId) await markSnapshotRegistered(snapshotId);
      await recordAuditLog({
        eventType: "MARKETPLACE_REGISTERED",
        snapshotId,
        marketplace: "smartstore",
        afterValue: { originProductNo: updated.originProductNo, operation: "UPDATE" },
        reason: `기등록 상품을 수정했습니다 — ${decision.reason}`,
      });
      return NextResponse.json(result);
    }

    if (decision.operation === "RECREATE") {
      /* 🔴 묻지 않고 만들지 않는다. RECREATE 는 마켓에 «새 상품» 을 만들고 옛
         상품은 그대로 남는다 — 옛 것을 내릴지 둘지는 셀러의 사업 판단이다.
         동의 없이 진행하면 그것이 바로 이번에 고치려는 중복이다. */
      if (!confirmRecreate) {
        logStep("재등록 동의", "failed", "셀러 동의가 없어 진행하지 않았습니다.");
        const result = withMeta({
          status: "FAILED",
          platform: "smartstore",
          mode: "LIVE",
          retryable: true,
          payload,
          externalProductId: existing.externalProductId,
          error: {
            step: "VALIDATION",
            message: `${decision.reason} 진행하면 기존 상품(${existing.externalProductId})은 스마트스토어에 그대로 남고 새 상품이 하나 더 생깁니다 — 확인 후 다시 요청해주세요.`,
            retryable: true,
            resolution: "새로 등록하기로 결정하셨다면 '새 상품으로 다시 등록'을 선택해 다시 시도해주세요.",
          },
        });
        await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
        return NextResponse.json(result);
      }
      logStep("재등록 동의", "success", "셀러가 새 상품으로 다시 등록하기를 선택했습니다.");
      plannedOperation = "RECREATE";
      /* 아래 CREATE 와 «같은» 호출로 내려간다 — payload 도 호출도 동일하고,
         다른 것은 성공 뒤 연결을 «새로 만들지, 갈아끼울지» 뿐이다. */
    }

    /* NOOP · BLOCKED — 네이버에 아무것도 보내지 않는다.
       🔴 ListingStatus 에는 「하지 않았다」가 없다. 여기서 새 상태를 만들지
       않는 이유: registration_attempts 97행과 화면이 전부 기존 6개 상태를
       전제로 읽고 있어, 상태를 늘리면 과거 행의 의미까지 소급해 흔든다.
       대신 «이유를 그대로» 싣는다 — 셀러가 읽는 것은 상태가 아니라 문장이다.
       🔴 operation 도 비운다. CREATE/UPDATE/RECREATE 중 아무것도 하지 않았다. */
    if (decision.operation === "NOOP" || decision.operation === "BLOCKED") {
      logStep("작업 없음", "failed", decision.reason);
      const result = withMeta({
        status: "FAILED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: decision.operation === "BLOCKED",
        payload,
        externalProductId: existing.externalProductId,
        error: {
          step: "VALIDATION",
          message: decision.reason,
          retryable: decision.operation === "BLOCKED",
        },
      });
      await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
      return NextResponse.json(result);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     🔴 마지막 빗장 — 중복 CREATE 를 «구조적으로» 막는다.

     여기서부터 아래는 「네이버에 새 상품을 만든다」 이다. 연결이 이미 있는데
     RECREATE 동의도 없이 이 줄에 도달했다면, 그것이 정확히 SmartStore 외부번호
     6개를 만든 경로다.

     지금은 도달할 수 없다 — resolveLifecycle() 은 hasChannelProduct=true 에서
     CREATE 를 내지 않고, 위 분기가 UPDATE/RECREATE/NOOP/BLOCKED 를 모두 잡는다.
     🔴 그래도 둔다. 「도달할 수 없다」에 기대면 capability 표가 한 칸 바뀌거나
     분기가 하나 늘어나는 날 조용히 중복이 생긴다. 막는 쪽이 싸다.
  ══════════════════════════════════════════════════════════════════════════ */
  if (blocksCreate(Boolean(existing)) && plannedOperation !== "RECREATE") {
    logStep("중복 등록 차단", "failed", "이미 이 커머스에 나가 있는 상품입니다.");
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: false,
      payload,
      externalProductId: existing?.externalProductId,
      error: {
        step: "VALIDATION",
        message: `이미 스마트스토어에 등록된 상품입니다(${existing?.externalProductId}) — 새로 만들지 않았습니다.`,
        retryable: false,
        resolution: "수정하려면 등록 화면에서 다시 시도하고, 새 상품으로 만들려면 '새 상품으로 다시 등록'을 선택해주세요.",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
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
        // N-3.50 STEP7 — 타임아웃/연결오류는 네이버가 실제로 요청을 받았는지
        // 알 수 없다(AbortSignal.timeout()이 응답 대기 중 끊길 수도 있다).
        // FAILED로 단정하지 않고 UNKNOWN으로 남겨 "확인 먼저, 재시도는 나중"을
        // 강제한다.
        status: "UNKNOWN",
        platform: "smartstore",
        mode: "LIVE",
        retryable: true,
        payload,
        error: {
          step: "NETWORK",
          message,
          retryable: true,
          // N-3.50 STEP6(CPO 지시) — 타임아웃/네트워크 오류는 가장 위험한
          // 케이스다: 네이버 서버에 실제로는 상품이 생성됐는데 응답만 유실됐을
          // 수 있다. "무조건 재시도"하면 중복 상품이 생길 위험이 있어, 재시도
          // 전에 먼저 등록 이력/Wing에서 실제 생성 여부를 확인하라고 안내한다.
          resolution:
            "네이버 서버 응답을 받지 못했습니다 — 재시도 전에 Wing 또는 등록 이력에서 상품이 실제로 생성됐는지 먼저 확인해주세요(생성됐다면 재시도 시 중복 등록됩니다).",
        },
      });
      await logRegistrationAttempt(result, "body" in response ? response.body : undefined, snapshotId, jobKey);
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
      await logRegistrationAttempt(result, response.body, snapshotId, jobKey);
      return NextResponse.json(result);
    }

    // N-3.70(Sprint N-3.70 STEP7) — 필드명은 더 이상 미확인이 아니다: N-3.49/
    // N-3.51/N-3.68에서 이미 3건의 실제 등록(originProductNo=13664004406,
    // 13667626779, 13667627489)으로 response.originProductNo가 최상위에 오는
    // 것을 확인했고(golden-success-01.json/golden-success-02-kids.json에
    // 그대로 기록돼 있다), GET /v2/products/origin-products/{originProductNo}로
    // 실제 존재까지 검증했다. 그런데도 이 라우트는 그 값을
    // result.externalProductId로 옮기지 않아서, logRegistrationAttempt가 이미
    // 읽으려 하는 result.externalProductId(아래)와 registration_attempts.
    // external_product_id 컬럼이 성공 케이스에서도 항상 null이었다 — "등록
    // 완료"라고만 나오고 실제 Naver 상품번호를 어디서도 보여줄 수 없었던
    // 원인. 응답 형태가 예상과 다르면(둘 다 없으면) 억지로 지어내지 않고
    // undefined로 남긴다.
    if (response.status >= 200 && response.status < 300) {
      const responseBody = response.body as { originProductNo?: number | string } | null;
      const originProductNo = responseBody?.originProductNo;
      logStep(
        "API 호출",
        "success",
        `네이버가 등록 요청을 수락했습니다(HTTP ${response.status}${originProductNo != null ? `, originProductNo=${originProductNo}` : ""}).`,
      );
      const result = withMeta({
        status: "SUBMITTED",
        platform: "smartstore",
        mode: "LIVE",
        retryable: false,
        payload,
        submittedAt: new Date().toISOString(),
        externalProductId: originProductNo != null ? String(originProductNo) : undefined,
      });
      /* ══════════════════════════════════════════════════════════════════
         P0-CHANNEL-03 F-5 — 등록이 «성공했을 때만» 현재 연결을 만든다.

         🔴 실패한 시도로 ChannelProduct 를 만들면 다음 CREATE 가 막혀 셀러가
         영영 등록하지 못한다. 그래서 이 자리(SUBMITTED 경로)에만 있다.

         🔴 product_id 가 없으면 연결하지 않는다 — 기존 381 snapshot 은
         product_id 가 NULL 이다(backfill 금지). 그 경우 예전과 똑같이
         attempt 만 남는다. 정체성이 없다고 등록을 막지 않는다.

         🔴 실패해도 등록 결과를 뒤집지 않는다. 상품은 이미 네이버에 나갔다 —
         DB 기록이 안 됐다고 「실패」라고 말하면 그것이 거짓이다. */
      /* 🔴 RECREATE 는 «새 연결을 만들지 않고» 현재 연결을 갈아끼운다. 새로
         만들면 같은 상품 × 같은 채널로 ChannelProduct 가 둘이 되고, 그러면
         「지금 어느 외부 상품과 연결돼 있는가」에 답이 두 개가 된다 — 이
         구조를 만든 이유 자체가 없어진다.

         🔴 옛 외부번호는 지우지 않는다. 이 시도가 operation='RECREATE' 행으로
         registration_attempts 에 남고, 직전 행들이 옛 번호를 들고 있다 —
         그것이 이력이다(previous_* 칸을 두지 않기로 한 CPO 확정). */
      let channelProductId: string | null = null;
      if (plannedOperation === "RECREATE" && existing) {
        /* 🔴 새 번호를 «못 읽었으면» 갈아끼우지 않는다. String(undefined) 가
           "undefined" 라서, 그대로 쓰면 external_product_id 에 그 문자열이
           들어가 현재 연결이 «존재하지 않는 상품» 을 가리키게 된다. 그러면
           다음 등록은 있지도 않은 상품을 수정하려 든다.
           못 읽었으면 옛 연결을 그대로 두고 지나간다 — 응답 원문은 attempt 에
           남아 있으니 사람이 확인할 수 있다. */
        if (result.externalProductId) {
          const replaced = await replaceChannelProductLink(existing.id, result.externalProductId);
          channelProductId = replaced ? existing.id : null;
        } else {
          console.warn("[smartstore/register] RECREATE 성공했으나 originProductNo 를 읽지 못해 연결을 갈아끼우지 않았습니다.");
        }
      } else {
        channelProductId = await linkSmartStoreChannelProduct(snapshotId, result.externalProductId);
      }
      await logRegistrationAttempt(result, response.body, snapshotId, jobKey, {
        /* 🔴 여기서 추론하지 않는다 — 위에서 resolveLifecycle() 이 정하고
           동의까지 받은 값을 그대로 적는다. */
        operation: plannedOperation,
        channelProductId,
      });
      if (snapshotId) await markSnapshotRegistered(snapshotId);
      await recordAuditLog({
        eventType: "MARKETPLACE_REGISTERED",
        snapshotId,
        marketplace: "smartstore",
        /* 🔴 RECREATE 면 «무엇을 대체했는지» 를 같이 남긴다. 이 한 줄이 없으면
           감사 기록만 보고는 새 상품이 생긴 것인지 원래 하나뿐이었는지
           구분할 수 없다 — 지금 Production 의 중복 9건이 정확히 그 상태다. */
        afterValue: {
          originProductNo,
          status: response.status,
          operation: plannedOperation,
          ...(plannedOperation === "RECREATE" && existing
            ? { replacedExternalProductId: existing.externalProductId }
            : {}),
        },
        reason:
          plannedOperation === "RECREATE" && existing
            ? `새 상품으로 다시 등록했습니다(HTTP ${response.status}). 기존 상품 ${existing.externalProductId} 은 스마트스토어에 그대로 남아 있습니다.`
            : `네이버가 등록 요청을 수락했습니다(HTTP ${response.status}).`,
      });
      return NextResponse.json(result);
    }

    // N-3.50 STEP6(CPO 지시) — "명확한 validation error(4xx) → 수정 후
    // 재시도" vs "5xx → idempotency/중복 여부 확인 후 제한적 재시도"를 각각
    // 다른 안내 문구로 구분한다. 4xx는 payload 자체가 잘못됐다는 뜻이라
    // "고치지 않고 재시도"는 항상 같은 결과를 반복할 뿐이다(retryable:false).
    // 5xx는 네이버 서버 문제일 수 있어 재시도 여지가 있지만, 타임아웃과
    // 마찬가지로 실제로 생성됐을 가능성을 먼저 배제해야 한다.
    //
    // N-3.70 STEP8(CPO 지시: "Naver가 등록을 거부했습니다. 필드: ... 사유:
    // ...를 구조화해서 표시") — 지금까지는 HTTP status만 보여주고 실제
    // response.body(Naver가 돌려준 진짜 거부 사유)는 registration_attempts.
    // response 컬럼에만 저장되고 클라이언트에는 전달되지 않았다. 실제 필드명은
    // 공식 문서로 확인된 적 없어 여러 후보(message/errorMessage/invalidInputs)를
    // 순서대로 시도하고, 전부 없으면 원문 JSON을 그대로 잘라 보여준다(추측으로
    // 필드를 지어내지 않는다 — 실측되면 이 파싱을 좁힌다).
    const naverReason = extractNaverErrorReason(response.body);
    logStep(
      "API 호출",
      "failed",
      `네이버가 등록 요청을 거부했습니다(HTTP ${response.status}).${naverReason ? ` 사유: ${naverReason}` : ""}`,
    );
    const result = withMeta({
      status: "FAILED",
      platform: "smartstore",
      mode: "LIVE",
      retryable: response.status >= 500,
      payload,
      error: {
        step: "NETWORK",
        message: naverReason
          ? `네이버가 등록 요청을 거부했습니다(HTTP ${response.status}). 사유: ${naverReason}`
          : `네이버가 등록 요청을 거부했습니다(HTTP ${response.status}).`,
        retryable: response.status >= 500,
        resolution:
          response.status >= 500
            ? "네이버 서버 오류입니다 — 재시도 전에 Wing 또는 등록 이력에서 상품이 실제로 생성되지 않았는지 먼저 확인해주세요."
            : "표시된 원인을 확인하고 데이터를 고친 뒤 다시 시도해주세요(수정 없이 재시도하면 같은 오류가 반복됩니다).",
      },
    });
    await logRegistrationAttempt(result, response.body, snapshotId, jobKey);
    await recordAuditLog({
      eventType: "MARKETPLACE_FAILED",
      snapshotId,
      marketplace: "smartstore",
      reason: result.error?.message ?? `네이버가 등록 요청을 거부했습니다(HTTP ${response.status}).`,
    });
    return NextResponse.json(result);
  } catch (error) {
    logStep("API 호출", "failed", error instanceof Error ? error.message : "네이버 서버에 연결할 수 없습니다.");
    const result = withMeta({
      // N-3.50 STEP7 — 위와 같은 이유(요청이 실제로 도달했는지 확인 불가)로
      // FAILED가 아니라 UNKNOWN.
      status: "UNKNOWN",
      platform: "smartstore",
      mode: "LIVE",
      retryable: true,
      payload,
      error: {
        step: "NETWORK",
        message: error instanceof Error ? error.message : "네이버 서버에 연결할 수 없습니다.",
        retryable: true,
        resolution:
          "네이버 서버에 연결하지 못했습니다 — 재시도 전에 Wing 또는 등록 이력에서 상품이 실제로 생성됐는지 먼저 확인해주세요(생성됐다면 재시도 시 중복 등록됩니다).",
      },
    });
    await logRegistrationAttempt(result, undefined, snapshotId, jobKey);
    return NextResponse.json(result);
  }
}
