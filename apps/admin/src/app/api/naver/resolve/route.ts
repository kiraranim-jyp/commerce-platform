import { NextResponse } from "next/server";
import { buildNaverCategoryPath } from "@commerce/listing";
import { getNaverCredentials } from "../_lib/env";
import { callNaverApi, issueNaverAccessToken } from "../_lib/client";
import { fetchNaverAllCategories } from "../_lib/category";
import { fetchNaverReturnDeliveryCompanies, resolvePrimaryReturnCompany } from "../_lib/delivery";
import { getDefaultSellerProfile } from "../../coupang/_lib/seller-profile";

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
 * API는 스펙에 없으므로 여전히 courier.available=false로 고정한다(N-2.5
 * 결론 유지, 추측 금지).
 *
 * 반품/교환 배송비(returnDeliveryFee/exchangeDeliveryFee)는 Naver 전용 설정이
 * 따로 없어 Coupang용으로 이미 만들어 둔 SellerProfile.returnDeliveryCharge/
 * exchangeDeliveryCharge(판매자의 실제 반품/교환 배송비 정책 — 플랫폼과
 * 무관한 판매자 자신의 비용 정책)를 그대로 재사용한다. 새 DB 컬럼을 만들지
 * 않는다(CPO 원칙 — 이미 있는 판매자 데이터를 다시 입력받지 않는다).
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

  const [returnCompanies, sellerProfile] = await Promise.all([
    fetchNaverReturnDeliveryCompanies(accessToken),
    getDefaultSellerProfile(),
  ]);
  const primaryReturnCompany = returnCompanies ? resolvePrimaryReturnCompany(returnCompanies) : null;

  return NextResponse.json({
    status: "OK",
    category,
    address: { releaseAddressBookNo, refundAddressBookNo },
    // N-2.5/N-3.3 확인 — 출고 택배사 전용 조회 API는 공식 스펙에 없다(추측 코드 금지).
    courier: { available: false, reason: "출고 택배사 코드 조회 API를 찾지 못했습니다(N-2.5/N-3.3 확인)." },
    delivery: {
      returnCompanies: returnCompanies ?? [],
      returnCompaniesFetchFailed: returnCompanies === null,
      primaryReturnCompany,
      returnDeliveryFee: sellerProfile?.returnDeliveryCharge ?? null,
      exchangeDeliveryFee: sellerProfile?.exchangeDeliveryCharge ?? null,
    },
  });
}
