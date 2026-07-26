import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * 실제 쿠팡 Open API(Wing) 요청 바디를 그대로 흉내내지 않는다 — 실제 스키마는
 * API 연동을 시작할 때 공식 문서를 보고 맞춰야 한다. 지금은 "CartPilot이 갖고
 * 있는 데이터가 쿠팡 등록에 필요한 형태로 전부 모였는가"를 DRY_RUN으로 보여주기
 * 위한 내부 표현이다 — 필드 이름(vendorItemName/salePrice/displayCategoryCode/
 * images/contents/delivery/options)은 실제 쿠팡 등록 API에서 흔히 쓰이는 이름에
 * 최대한 맞췄다.
 */
export interface CoupangPayload {
  vendorItemName: string;
  brandName?: string;
  displayCategoryCode: string | null;
  displayCategoryPath: string[] | null;
  images: {
    representativeImageUrl?: string;
    additionalImageUrls: string[];
  };
  salePrice: number;
  priceIsEstimate: boolean;
  stockQuantity: number;
  contents: string[];
  delivery: {
    deliveryMethod: string;
    shippingFee: number;
    countryOfOrigin: string;
  };
  returnPolicy: string;
  options: string[];
}

export function buildCoupangPayload(
  product: CanonicalProduct,
  listing: ListingModel,
): CoupangPayload {
  return {
    vendorItemName: listing.title,
    brandName: listing.brand,
    displayCategoryCode: listing.category.candidate?.id ?? null,
    displayCategoryPath: listing.category.candidate?.path ?? null,
    images: {
      representativeImageUrl: listing.representativeImage,
      additionalImageUrls: listing.additionalImages,
    },
    salePrice: listing.priceKrw,
    priceIsEstimate: listing.priceIsEstimate,
    stockQuantity: product.stockQuantity.value,
    contents: listing.description ? [listing.description] : [],
    delivery: {
      deliveryMethod: listing.shippingInfo,
      shippingFee: product.shippingFee.value,
      countryOfOrigin: product.countryOfOrigin.value,
    },
    returnPolicy: product.returnPolicy.value,
    options: listing.options,
  };
}
