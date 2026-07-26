import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * 이번 Mission은 실제 네이버 커머스 API 요청 바디를 그대로 흉내내지 않는다 —
 * 실제 스키마는 API 연동을 시작할 때 공식 문서를 보고 맞춰야 한다. 지금은
 * "CartPilot이 갖고 있는 데이터가 등록에 필요한 형태로 전부 모였는가"를
 * DRY_RUN으로 보여주기 위한 내부 표현이다.
 *
 * PM의 Payload Inspector 요구사항(상품정보/이미지/가격재고/배송/교환반품 그룹)에
 * 맞춰 구조를 미리 그룹으로 나눠둔다 — UI가 이 모양을 그대로 순회하면서 섹션을
 * 그리면 되고, "이 필드가 어느 그룹인지"를 화면 쪽에서 다시 판단할 필요가 없다.
 */
export interface SmartStorePayload {
  product: {
    name: string;
    brandName?: string;
    detailContent: string;
    leafCategoryId: string | null;
    leafCategoryPath: string[] | null;
    options: string[];
  };
  images: {
    representativeImageUrl?: string;
    optionalImageUrls: string[];
  };
  priceAndStock: {
    salePrice: number;
    priceIsEstimate: boolean;
    stockQuantity: number;
    saleStatus: "SALE";
  };
  shipping: {
    shippingFee: number;
    countryOfOrigin: string;
  };
  returnExchange: {
    returnPolicy: string;
    certification: string;
  };
}

export function buildSmartStorePayload(
  product: CanonicalProduct,
  listing: ListingModel,
): SmartStorePayload {
  return {
    product: {
      name: listing.title,
      brandName: listing.brand,
      detailContent: listing.description,
      leafCategoryId: listing.category.candidate?.id ?? null,
      leafCategoryPath: listing.category.candidate?.path ?? null,
      options: listing.options,
    },
    images: {
      representativeImageUrl: listing.representativeImage,
      optionalImageUrls: listing.additionalImages,
    },
    priceAndStock: {
      salePrice: listing.priceKrw,
      priceIsEstimate: listing.priceIsEstimate,
      stockQuantity: product.stockQuantity.value,
      saleStatus: "SALE",
    },
    shipping: {
      shippingFee: product.shippingFee.value,
      countryOfOrigin: product.countryOfOrigin.value,
    },
    returnExchange: {
      returnPolicy: product.returnPolicy.value,
      certification: product.certification.value,
    },
  };
}
