import type { ListingModel } from "@commerce/marketplace";

/**
 * 이번 Mission은 실제 네이버 커머스 API 요청 바디를 그대로 흉내내지 않는다 —
 * 실제 스키마는 API 연동을 시작할 때 공식 문서를 보고 맞춰야 한다. 지금은
 * "CartPilot이 갖고 있는 데이터가 등록에 필요한 형태로 전부 모였는가"를
 * DRY_RUN으로 보여주기 위한 내부 표현이다.
 */
export interface SmartStorePayload {
  name: string;
  salePrice: number;
  priceIsEstimate: boolean;
  representativeImageUrl?: string;
  optionalImageUrls: string[];
  detailContent: string;
  leafCategoryId: string | null;
  leafCategoryPath: string[] | null;
  brandName?: string;
  options: string[];
  saleStatus: "SALE";
}

export function buildSmartStorePayload(listing: ListingModel): SmartStorePayload {
  return {
    name: listing.title,
    salePrice: listing.priceKrw,
    priceIsEstimate: listing.priceIsEstimate,
    representativeImageUrl: listing.representativeImage,
    optionalImageUrls: listing.additionalImages,
    detailContent: listing.description,
    leafCategoryId: listing.category.candidate?.id ?? null,
    leafCategoryPath: listing.category.candidate?.path ?? null,
    brandName: listing.brand,
    options: listing.options,
    saleStatus: "SALE",
  };
}
