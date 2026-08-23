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
  /** N-3.67(2026-08-20, CPO 지시로 확인) — 실제 카테고리 인증 카탈로그를
   * 캐시해서 대조한 결과, 어린이제품 인증 3종의 nonEssential 값이 서로
   * 다르다: id=1042([어린이제품]공급자적합성확인)만 nonEssential:true, id=1041/1040
   * ([어린이제품]안전확인/안전인증)은 nonEssential:false다. 기존 코드는
   * kindTypes만 보고 배열 순서상 첫 매치(1042)를 골라서 실제로는 "선택적/
   * 보조적" 인증 유형을 필수 인증 유형처럼 사용하고 있었다 — Naver가
   * "인증 종류를 선택해야 한다"고 거부한 원인일 가능성이 높다. */
  nonEssential?: boolean;
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
  /** Sprint B-7(CPO 지시: "Preview와 실제 Register가 서로 다른 값을 계산하지
   * 않도록 동일 resolver를 사용") — register/route.ts는 이미지 업로드 등
   * 다른 API 호출을 위해 토큰을 자체 발급받아 갖고 있다. 여기서 또 발급받으면
   * 불필요한 Naver API 호출이 늘어나므로, 이미 발급된 토큰이 있으면 그대로
   * 재사용한다(없으면 기존처럼 이 함수가 직접 발급한다 — /api/naver/resolve
   * route처럼 토큰이 아직 없는 호출부는 그대로 동작). */
  accessToken?: string;
}): Promise<NaverResolveResult> {
  const { categoryId, countryOfOrigin: extractedCountryOfOrigin, brand: brandName, accessToken: providedAccessToken } = params;

  let accessToken: string;
  if (providedAccessToken) {
    accessToken = providedAccessToken;
  } else {
    const credentials = await getNaverCredentials();
    if (!credentials) {
      return { status: "NOT_CONFIGURED", message: "네이버 인증 정보가 설정되어 있지 않습니다." };
    }
    const tokenResult = await issueNaverAccessToken(credentials);
    if (!tokenResult.ok) {
      return { status: "AUTH_FAILED", message: tokenResult.message, debug: { step: tokenResult.step } };
    }
    accessToken = tokenResult.accessToken;
  }

  let category: NaverResolveResponse["category"] = null;

  if (categoryId) {
    const detailResult = await callNaverApi(accessToken, { method: "GET", path: `/v1/categories/${categoryId}` });
    if (detailResult.ok && detailResult.status === 200) {
      const detail = detailResult.body as NaverCategoryDetail;
      const exceptionalCategories = detail.exceptionalCategories ?? [];
      const requiresChildCertification = exceptionalCategories.includes("CHILD_CERTIFICATION");
      // N-3.67 — nonEssential:false(필수) 항목을 nonEssential:true(선택/보조)
      // 항목보다 우선한다. 실측(Bobo Choses)에서 nonEssential:true인 1042만
      // 골랐을 때 완전한 payload(certificationKindType 포함)를 보내도 Naver가
      // "인증 종류를 선택해야 한다"고 거부했다 — 배열 순서만으로 고르던 기존
      // 로직의 구조적 결함으로 보고 수정한다(임의 선택이 아니라 실제
      // nonEssential 메타데이터 기반 우선순위).
      const childCertCandidates = (detail.certificationInfos ?? []).filter((c) => c.kindTypes?.includes("CHILD_CERTIFICATION"));
      const childCert =
        childCertCandidates.find((c) => c.nonEssential === false) ?? childCertCandidates[0];
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
      // N-3.69(CPO 지시, "Seller 공통 설정 통합" STEP1) — 실제 발견된 갭:
      // Coupang은 이미 sellerConfig.deliveryCharge를 읽고 있었는데 Naver
      // payload는 이 값을 아예 읽지 않고 항상 FREE/0으로 고정돼 있었다.
      deliveryFee: sellerProfile?.deliveryCharge ?? null,
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
      // N-3.83(CPO 지시, "SmartStore 기본정보 완성" 감사에서 발견) — Coupang은
      // register/route.ts:413-417에서 이미 brandProfile.manufacturer/
      // sellerProfile.manufacturer(Sprint A-12 3단계 우선순위)를 넘기고 있었는데,
      // 여기(Naver resolve)는 brandProfile을 countryOfOrigin/brandIntro에만
      // 쓰고 manufacturer는 아예 읽지 않았다 — 크롤러가 제조사를 못 찾은
      // 상품(흔한 경우)은 항상 빈칸이었던 원인. brandProfile은 이미 위에서
      // brand 파라미터로 조회해 둔 값을 그대로 재사용한다(추가 DB 조회 없음).
      manufacturer: brandProfile?.manufacturer || sellerProfile?.manufacturer || null,
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
