import { NextResponse } from "next/server";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { buildComplianceReport, buildCoupangPayload, resolveVerifiedCategoryCode } from "@commerce/listing";
import { getCoupangCredentials, getVendorUserId } from "../_lib/env";
import { getDefaultDescriptionTemplate } from "../_lib/description-template";
import { getDefaultSellerProfile } from "../_lib/seller-profile";
import { fetchShippingPlaces, inferSourceCountry, selectOutboundShippingPlace } from "../_lib/shipping-place";
import { fetchCategoryMeta } from "../_lib/category-meta";
import { resolveBrand } from "../_lib/brand";

/**
 * Sprint A-3(작업6 — Payload Preview) — CPO 요구사항: "등록 버튼을 누르는 순간
 * 생성하지 않는다. 항상 생성되어 있어야 한다." register/route.ts와 완전히 같은
 * 조립 로직(sellerConfig/카테고리 메타/브랜드 조회 → buildCoupangPayload →
 * buildComplianceReport)을 그대로 재사용한다 — 실제 등록 시점과 다른 계산을
 * 새로 만들면 "미리보기는 100%였는데 실제 등록은 다르다"는 CP001과 같은 신뢰
 * 문제가 재발한다. 이 라우트가 register/route.ts와 다른 점은 딱 하나 —
 * callCoupangApi(실제 등록 제출)와 registration_attempts 기록을 하지 않는다는
 * 것뿐이다(읽기 전용, 부작용 없음).
 */
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
    return NextResponse.json({ payload: null, reason: "NOT_CONFIGURED" });
  }

  const vendorUserId = await getVendorUserId();
  const sellerProfile = await getDefaultSellerProfile();
  if (!sellerProfile) {
    return NextResponse.json({ payload: null, reason: "NO_SELLER_PROFILE" });
  }

  const descriptionTemplate = await getDefaultDescriptionTemplate();

  let outboundShippingPlaceCode = sellerProfile.outboundShippingPlaceCode;
  const shippingPlaces = await fetchShippingPlaces(credentials);
  const sourceCountry = inferSourceCountry(product.sourceUrl);
  const selectedPlace = selectOutboundShippingPlace(sourceCountry, shippingPlaces.options);
  if (selectedPlace?.code != null) {
    outboundShippingPlaceCode = selectedPlace.code;
  }

  const categoryCode = resolveVerifiedCategoryCode(listing.category);
  const categoryMeta = categoryCode != null ? await fetchCategoryMeta(credentials, categoryCode) : null;
  const resolvedBrand = listing.brand ? await resolveBrand(credentials, listing.brand) : null;

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
      deliveryCharge: sellerProfile.deliveryCharge,
      returnDeliveryCharge: sellerProfile.returnDeliveryCharge,
      outboundLeadTimeDays: sellerProfile.outboundLeadTimeDays,
      manufacturer: sellerProfile.manufacturer,
      asContactNumber: sellerProfile.asContactNumber,
      qualityGuarantee: sellerProfile.qualityGuarantee,
    },
    descriptionTemplate: descriptionTemplate ?? undefined,
    categoryMeta,
    resolvedBrand,
  });

  const attributeResults = payload.complianceFieldResults.filter((r) => r.kind === "ATTRIBUTE");
  const noticeResults = payload.complianceFieldResults.filter((r) => r.kind === "NOTICE");
  const complianceReport = buildComplianceReport(attributeResults, noticeResults);

  return NextResponse.json({ payload, complianceReport });
}
