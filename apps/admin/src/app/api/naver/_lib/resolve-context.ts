import { buildNaverCategoryPath, resolveNaverOriginArea } from "@commerce/listing";
import { getNaverCredentials } from "./env";
import { callNaverApi, issueNaverAccessToken } from "./client";
import { fetchNaverAllCategories } from "./category";
import { fetchNaverReturnDeliveryCompanies, resolvePrimaryReturnCompany } from "./delivery";
import { fetchNaverOriginAreas } from "./origin";
import { getDefaultSellerProfile } from "../../coupang/_lib/seller-profile";
import { findBrandProfileByName } from "../../coupang/_lib/brand-profile";
import { getDefaultDescriptionTemplate } from "../../coupang/_lib/description-template";
import type { NaverResolveResponse } from "../../../pipeline/commerce/NaverPayloadPreview";

/**
 * N-3.56 STEP1/2(CPO 지시: "새로운 readiness 판정 로직을 만들지 않는다") —
 * /api/naver/resolve/route.ts가 하던 실제 조회+계산을 그대로 함수로 옮긴 것.
 * 대시보드가 여러 스냅샷의 SmartStore 준비도를 계산할 때 자기 자신에게
 * HTTP로 fetch(self-call)하지 않고 이 함수를 직접 호출하게 하기 위함 —
 * 로직은 한 곳(이 파일)에만 있고, route.ts는 이 함수의 얇은 wrapper다.
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

export type NaverResolveResult =
  | { status: "NOT_CONFIGURED"; message: string }
  | { status: "AUTH_FAILED"; message: string; debug: { step: string } }
  | (Omit<NaverResolveResponse, "status"> & { status: "OK" });

export async function resolveNaverContext(params: {
  categoryId: string | null;
  countryOfOrigin: string | null;
  brand: string | null;
}): Promise<NaverResolveResult> {
  const { categoryId, countryOfOrigin: extractedCountryOfOrigin, brand: brandName } = params;

  const credentials = await getNaverCredentials();
  if (!credentials) {
    return { status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." };
  }

  const tokenResult = await issueNaverAccessToken(credentials);
  if (!tokenResult.ok) {
    return { status: "AUTH_FAILED", message: tokenResult.message, debug: { step: tokenResult.step } };
  }
  const accessToken = tokenResult.accessToken;

  let category: NaverResolveResponse["category"] = null;

  if (categoryId) {
    const detailResult = await callNaverApi(accessToken, { method: "GET", path: `/v1/categories/${categoryId}` });
    if (detailResult.ok && detailResult.status === 200) {
      const detail = detailResult.body as NaverCategoryDetail;
      const exceptionalCategories = detail.exceptionalCategories ?? [];
      const requiresChildCertification = exceptionalCategories.includes("CHILD_CERTIFICATION");
      const childCert = (detail.certificationInfos ?? []).find((c) => c.kindTypes?.includes("CHILD_CERTIFICATION"));
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

  const [returnCompanies, sellerProfile, originAreas, brandProfile, descriptionTemplate] = await Promise.all([
    fetchNaverReturnDeliveryCompanies(accessToken),
    getDefaultSellerProfile(),
    fetchNaverOriginAreas(accessToken),
    brandName ? findBrandProfileByName(brandName) : Promise.resolve(null),
    getDefaultDescriptionTemplate(),
  ]);
  const primaryReturnCompany = returnCompanies ? resolvePrimaryReturnCompany(returnCompanies) : null;

  const resolvedCountryText =
    extractedCountryOfOrigin || brandProfile?.countryOfOrigin || sellerProfile?.defaultCountryOfOrigin || null;
  const originMatch = originAreas
    ? resolveNaverOriginArea(resolvedCountryText, originAreas)
    : { status: "NO_INPUT" as const, code: null, matchedDisplayName: null, requiresImporter: false };

  return {
    status: "OK",
    category,
    address: { releaseAddressBookNo, refundAddressBookNo },
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
    notice: {
      warrantyPolicy: sellerProfile?.qualityGuarantee || null,
      afterServiceDirector: sellerProfile?.asContactNumber || null,
      companyContactNumber: sellerProfile?.companyContactNumber || null,
    },
    detailPage: {
      descriptionTemplate: descriptionTemplate ?? null,
      commonImages: {
        topCommonImageUrl: sellerProfile?.topCommonImageUrl ?? null,
        topCommonImageEnabled: sellerProfile?.topCommonImageEnabled ?? false,
        bottomCommonImageUrl: sellerProfile?.bottomCommonImageUrl ?? null,
        bottomCommonImageEnabled: sellerProfile?.bottomCommonImageEnabled ?? false,
      },
      brandIntro: brandProfile?.brandIntro ?? null,
    },
  };
}
