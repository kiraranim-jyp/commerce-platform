import { NextResponse } from "next/server";
import { buildNaverCategoryPath, resolveNaverOriginArea } from "@commerce/listing";
import { getNaverCredentials } from "../_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../_lib/client";
import { fetchNaverAllCategories } from "../_lib/category";
import { fetchNaverReturnDeliveryCompanies, resolvePrimaryReturnCompany } from "../_lib/delivery";
import { fetchNaverOriginAreas } from "../_lib/origin";
import { getDefaultSellerProfile } from "../../coupang/_lib/seller-profile";
import { findBrandProfileByName } from "../../coupang/_lib/brand-profile";

/**
 * Sprint N-2.8 — NaverPayloadPreview에 필요한 실제 read-only 데이터를 한 번에
 * 모아준다(카테고리 상세 + 주소록). 카테고리 매칭 Resolver는 N-2.9로 분리됐다
 * (CPO 지시 — 학습데이터 없이 만들면 오분류 위험) — 그래서 categoryId는 이
 * 라우트의 입력값이지 이 라우트가 만들어내는 값이 아니다(Preview에서 QA가
 * 실제 Naver 카테고리 ID를 알고 있을 때만 수동으로 입력한다).
 *
 * Sprint N-3.3 — delivery 섹션 추가. 반품 택배사는 공식 OpenAPI 스펙에서
 * 발견한 실제 존재하는 API(GET /v2/product-delivery-info/
 * return-delivery-companies — N-2.5가 찾던 "택배사 코드 조회 API"가 사실은
 * 이 경로였다)로 조회한다. 출고 택배사(deliveryInfo.deliveryCompany) 조회
 * API는 스펙에 없다(N-2.5/N-3.3/N-3.6 재확인 — bundle-delivery-groups,
 * hope-delivery-groups 스키마까지 전수 확인했지만 택배사 필드 자체가 없다).
 *
 * Sprint N-3.6(개정 Part A) — Coupang의 deliveryCompanyCode(공식 조회 API가
 * 없어 판매자가 직접 입력)와 같은 패턴으로 SellerProfile.
 * naverDeliveryCompanyCode를 추가했다. API 조회가 불가능하다는 결론은 그대로
 * 지만, 판매자가 Settings에서 입력한 값이 있으면 그 값을 courier.value로
 * 내려준다 — BLOCKED(해결 불가)가 아니라 MISSING(입력하면 해결됨)이 정확한
 * 상태다.
 *
 * 반품/교환 배송비(returnDeliveryFee/exchangeDeliveryFee)는 Naver 전용 설정이
 * 따로 없어 Coupang용으로 이미 만들어 둔 SellerProfile.returnDeliveryCharge/
 * exchangeDeliveryCharge(판매자의 실제 반품/교환 배송비 정책 — 플랫폼과
 * 무관한 판매자 자신의 비용 정책)를 그대로 재사용한다. 새 DB 컬럼을 만들지
 * 않는다(CPO 원칙 — 이미 있는 판매자 데이터를 다시 입력받지 않는다).
 *
 * Sprint N-3.4 — origin 섹션 추가. GET /v1/product-origin-areas(공식 GitHub
 * 공지 discussion #3632로 발견)로 조회한 535개 실제 코드 목록을
 * resolveNaverOriginArea(원산지 텍스트 매칭)에 넘긴다. 원산지 텍스트 자체는
 * Coupang의 A-12-3에서 이미 검증된 것과 동일한 우선순위(상품추출 >
 * 브랜드기본값 > Seller기본값)로 이 라우트가 결정한다 — countryOfOrigin/brand
 * 쿼리 파라미터로 호출부(상품 데이터)가 상품추출 값과 브랜드명을 넘겨준다.
 * "브랜드 국가 = 원산지"라는 자동 추론은 하지 않는다 — brandProfile.
 * countryOfOrigin은 판매자가 그 브랜드에 대해 실제로 알고 입력해 둔 값이지
 * CartPilot이 브랜드 본사 국가를 조회해서 채운 값이 아니다(N-3.4 Part 7).
 */

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");
  const extractedCountryOfOrigin = searchParams.get("countryOfOrigin");
  const brandName = searchParams.get("brand");

  const credentials = getNaverCredentials();
  if (!credentials) {
    return NextResponse.json(
      { status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." },
      { status: 200 },
    );
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return NextResponse.json(
      { status: "AUTH_FAILED", message: tokenResult.message, debug: { step: tokenResult.step } },
      { status: 200 },
    );
  }
  const accessToken = tokenResult.accessToken;

  let category: {
    categoryId: string;
    exceptionalCategories: string[];
    requiresChildCertification: boolean;
    childCertificationInfoId: number | null;
    hierarchy: ReturnType<typeof buildNaverCategoryPath> | null;
  } | null = null;

  if (categoryId) {
    const detailResult = await callNaverApi(accessToken, { method: "GET", path: `/v1/categories/${categoryId}` });
    if (detailResult.ok && detailResult.status === 200) {
      const detail = detailResult.body as NaverCategoryDetail;
      const exceptionalCategories = detail.exceptionalCategories ?? [];
      const requiresChildCertification = exceptionalCategories.includes("CHILD_CERTIFICATION");
      const childCert = (detail.certificationInfos ?? []).find((c) => c.kindTypes?.includes("CHILD_CERTIFICATION"));
      // N-3.1 — 후보 클릭이 아니라 categoryId를 직접 입력했을 때도 hierarchy를
      // 보여준다(사용자가 어떤 카테고리에 등록하려는지 항상 알 수 있어야 한다).
      const allCategories = await fetchNaverAllCategories(accessToken);
      category = {
        categoryId,
        exceptionalCategories,
        requiresChildCertification,
        childCertificationInfoId: childCert?.id ?? null,
        hierarchy: allCategories ? buildNaverCategoryPath(categoryId, allCategories) : null,
      };
    }
  }

  let releaseAddressBookNo: number | null = null;
  let refundAddressBookNo: number | null = null;
  const addressResult = await callNaverApi(accessToken, { method: "GET", path: "/v1/seller/addressbooks-for-page?page=1" });
  if (addressResult.ok && addressResult.status === 200) {
    const body = addressResult.body as { addressBooks?: NaverAddressBookEntry[] };
    const addressBooks = body.addressBooks ?? [];
    releaseAddressBookNo = addressBooks.find((a) => a.addressType === "RELEASE")?.addressBookNo ?? null;
    refundAddressBookNo = addressBooks.find((a) => a.addressType === "REFUND_OR_EXCHANGE")?.addressBookNo ?? null;
  }

  const [returnCompanies, sellerProfile, originAreas, brandProfile] = await Promise.all([
    fetchNaverReturnDeliveryCompanies(accessToken),
    getDefaultSellerProfile(),
    fetchNaverOriginAreas(accessToken),
    brandName ? findBrandProfileByName(brandName) : Promise.resolve(null),
  ]);
  const primaryReturnCompany = returnCompanies ? resolvePrimaryReturnCompany(returnCompanies) : null;

  // A-12-3과 동일한 우선순위: 상품 원본에서 실제로 추출된 값 > 브랜드별 판매자
  // 설정값 > 판매자 전역 기본값. 브랜드 국가 추정은 하지 않는다.
  const resolvedCountryText =
    extractedCountryOfOrigin || brandProfile?.countryOfOrigin || sellerProfile?.defaultCountryOfOrigin || null;
  const originMatch = originAreas
    ? resolveNaverOriginArea(resolvedCountryText, originAreas)
    : { status: "NO_INPUT" as const, code: null, matchedDisplayName: null, requiresImporter: false };

  return NextResponse.json({
    status: "OK",
    category,
    address: { releaseAddressBookNo, refundAddressBookNo },
    // N-2.5/N-3.3/N-3.6 확인 — 출고 택배사 전용 조회 API는 공식 스펙에 없다(추측
    // 코드 금지). N-3.6부터는 Settings에 판매자가 직접 입력한 값이 있으면
    // 그 값을 함께 내려준다(Coupang deliveryCompanyCode와 같은 수동 입력 패턴).
    courier: sellerProfile?.naverDeliveryCompanyCode
      ? { available: true, value: sellerProfile.naverDeliveryCompanyCode, source: "SELLER_PROFILE" as const }
      : {
          available: false,
          value: null,
          source: null,
          reason: "출고 택배사 코드 조회 API를 찾지 못했습니다(N-2.5/N-3.3/N-3.6 확인) — Settings에서 직접 입력하면 해결됩니다.",
        },
    delivery: {
      returnCompanies: returnCompanies ?? [],
      returnCompaniesFetchFailed: returnCompanies === null,
      primaryReturnCompany,
      returnDeliveryFee: sellerProfile?.returnDeliveryCharge ?? null,
      exchangeDeliveryFee: sellerProfile?.exchangeDeliveryCharge ?? null,
    },
    origin: {
      areaListFetchFailed: originAreas === null,
      resolvedCountryText,
      match: originMatch,
    },
    // N-3.13 Part E-12 — 공식 OpenAPI 스펙(ExternalApiWearInfoProvidedNoticeVo/
    // ExternalApiKidsInfoProvidedNoticeVo.product) required 배열 확인 결과
    // warrantyPolicy(품질 보증 기준)/afterServiceDirector(A/S 책임자와 전화번호)가
    // 두 타입 모두 필수다. Naver 전용 입력 필드가 없어 Coupang용으로 이미 있는
    // SellerProfile.qualityGuarantee/asContactNumber(판매자 정보 탭)를 그대로
    // 재사용한다 — returnDeliveryFee/exchangeDeliveryFee와 같은 패턴.
    notice: {
      warrantyPolicy: sellerProfile?.qualityGuarantee || null,
      afterServiceDirector: sellerProfile?.asContactNumber || null,
    },
  });
}
