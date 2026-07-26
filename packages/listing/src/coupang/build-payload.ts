import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * 쿠팡 Open API(Wing) "상품 등록"(createSellerProduct) 요청 바디의 실제 최상위
 * 구조(sellerProductName/displayCategoryCode/items[] 등)와 items 안에 이미지/
 * 상세설명이 중첩되는 형태를 최대한 그대로 따른다 — 다만 다음은 공식 API 문서로
 * 검증된 값이 아니라 CartPilot이 지금 갖고 있는 데이터로 채운 자리표시자다:
 *
 * - displayCategoryCode: 실제로는 정수형 쿠팡 카테고리 코드가 필요하다(쿠팡
 *   카테고리 추천/조회 API 연동 후에야 채울 수 있다). 지금은 CartPilot 내부
 *   카테고리 후보 id를 그대로 넣어뒀다 — LIVE 연동 전 반드시 교체해야 한다.
 * - vendorId / saleStartedAt / saleEndedAt / returnCenterCode: 판매자 인증
 *   정보와 쿠팡에 등록된 반품지 코드가 있어야 채울 수 있다 — 지금은 인증 정보가
 *   없으므로(LIVE 연동 전) 비워두거나 합리적인 기본값만 넣는다.
 *
 * CartPilot은 아직 옵션(색상/사이즈 등 SKU 단위 변형)을 값 목록까지 추출하지
 * 않으므로(packages/crawler의 product-data-extractor.ts 참고) items는 항상
 * 1개짜리 배열이다 — 실제 다변량 상품은 향후 옵션 값 추출이 붙어야 여러
 * item으로 쪼갤 수 있다.
 */
export interface CoupangItemImage {
  imageOrder: number;
  imageType: "REPRESENTATION" | "DETAIL";
  vendorPath: string;
}

export interface CoupangItemContent {
  contentsType: "TEXT";
  contentDetails: { content: string; detailType: "TEXT" }[];
}

export interface CoupangItem {
  itemName: string;
  originalPrice: number;
  salePrice: number;
  /** 쿠팡 API 필드명은 maximumBuyCount(구매 가능 수량)이지만, 실질적으로 재고
   * 수량과 같은 값을 쓴다 — 재고 관리 API가 별도로 있으나 이번 범위 밖이다. */
  maximumBuyCount: number;
  images: CoupangItemImage[];
  contents: CoupangItemContent[];
  /** 옵션(색상/사이즈) 명칭 — 값 목록은 없고 종류만 있다(CanonicalProduct.options와 동일 한계). */
  searchTags: string[];
}

export interface CoupangPayload {
  sellerProductName: string;
  displayCategoryCode: string | null;
  /** 공식 스키마에는 없는 CartPilot 전용 참고 필드 — Payload Inspector UI가
   * 카테고리 경로를 사람이 읽을 수 있게 보여주기 위해 남겨둔다. */
  displayCategoryPath: string[] | null;
  brand?: string;
  vendorId: string;
  saleStartedAt: string;
  saleEndedAt: string;
  deliveryMethod: "SEQUENCIAL";
  deliveryChargeType: "FREE" | "NOT_FREE";
  deliveryCharge: number;
  returnCharge: number;
  returnCenterCode: string;
  /** 공식 필드는 아니지만 국내 등록 시 원산지/반품 고시정보 표기가 필수라 CartPilot이
   * 별도로 관리한다(실제 연동 시 notices[]의 "원산지"/"교환·반품 안내" 고시정보 항목으로
   * 매핑해야 한다). */
  countryOfOrigin: string;
  returnPolicy: string;
  priceIsEstimate: boolean;
  items: CoupangItem[];
}

export function buildCoupangPayload(
  product: CanonicalProduct,
  listing: ListingModel,
): CoupangPayload {
  const images: CoupangItemImage[] = [];
  if (listing.representativeImage) {
    images.push({ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: listing.representativeImage });
  }
  listing.additionalImages.forEach((url, index) => {
    images.push({ imageOrder: index + 1, imageType: "DETAIL", vendorPath: url });
  });

  const now = new Date();
  const twoYearsLater = new Date(now);
  twoYearsLater.setFullYear(now.getFullYear() + 2);

  return {
    sellerProductName: listing.title,
    displayCategoryCode: listing.category.candidate?.id ?? null,
    displayCategoryPath: listing.category.candidate?.path ?? null,
    brand: listing.brand,
    vendorId: "",
    saleStartedAt: now.toISOString(),
    saleEndedAt: twoYearsLater.toISOString(),
    deliveryMethod: "SEQUENCIAL",
    deliveryChargeType: product.shippingFee.value > 0 ? "NOT_FREE" : "FREE",
    deliveryCharge: product.shippingFee.value,
    returnCharge: 0,
    returnCenterCode: "",
    countryOfOrigin: product.countryOfOrigin.value,
    returnPolicy: product.returnPolicy.value,
    priceIsEstimate: listing.priceIsEstimate,
    items: [
      {
        itemName: listing.title,
        originalPrice: listing.priceKrw,
        salePrice: listing.priceKrw,
        maximumBuyCount: product.stockQuantity.value,
        images,
        contents: listing.description
          ? [{ contentsType: "TEXT", contentDetails: [{ content: listing.description, detailType: "TEXT" }] }]
          : [],
        searchTags: listing.options,
      },
    ],
  };
}
