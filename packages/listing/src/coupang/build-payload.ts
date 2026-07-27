import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";

/**
 * 쿠팡 Open API "상품 생성"(POST .../v1/marketplace/seller-products) 요청 바디를
 * developers.coupang.com 공식 문서(Product Creation, 2026-07 확인)로 검증한 필드
 * 구조 그대로 따른다. 이전 버전(v1/v2)은 문서 확인 전 CartPilot 데이터만 보고
 * 만든 best-effort였다 — 최상위 필드가 items[] 밖에 있던 것, deliveryChargeType에
 * CHARGE_RECEIVED/CONDITIONAL_FREE가 빠졌던 것, 반품지/발송지/배송사 같은 판매자
 * 계정 설정 필드가 아예 없었던 것 등이 이번에 고쳐졌다.
 *
 * CartPilot이 값을 만들어낼 수 없는 필드(반품지 코드, 발송지 코드, 배송사 코드,
 * 담당자 연락처 등 — 전부 쿠팡 Wing에 판매자가 미리 등록해둔 값이다)는 여기서
 * 추측하지 않는다. sellerConfig로 주입받고, 없으면 빈 값으로 채워서 실제 등록
 * 직전 검증 단계(register 라우트)가 VALIDATION_ERROR로 명확히 막게 한다.
 */
export interface CoupangSellerConfig {
  vendorId: string;
  /** 쿠팡 Wing 로그인 아이디(계정ID) — access/secret key와는 다른 값이다. */
  vendorUserId: string;
  /** 택배사 코드 — 쿠팡이 정의한 courier code(예: CJGLS). */
  deliveryCompanyCode: string;
  /** Wing에 등록된 반품지 코드. 없으면 "NO_RETURN_CENTERCODE". */
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  /** Wing에 등록된 출고지(발송지) 코드. */
  outboundShippingPlaceCode: number | null;
}

export const BLANK_COUPANG_SELLER_CONFIG: CoupangSellerConfig = {
  vendorId: "",
  vendorUserId: "",
  deliveryCompanyCode: "",
  returnCenterCode: "",
  returnChargeName: "",
  companyContactNumber: "",
  returnZipCode: "",
  returnAddress: "",
  returnAddressDetail: "",
  outboundShippingPlaceCode: null,
};

export interface CoupangItemImage {
  imageOrder: number;
  imageType: "REPRESENTATION" | "DETAIL";
  vendorPath: string;
}

export interface CoupangContentDetail {
  content: string;
  detailType: "TEXT" | "IMAGE";
}

export interface CoupangItemContent {
  contentsType:
    | "TEXT"
    | "IMAGE"
    | "IMAGE_NO_SPACE"
    | "IMAGE_TEXT"
    | "TEXT_IMAGE"
    | "IMAGE_IMAGE"
    | "TEXT_TEXT"
    | "TITLE"
    | "HTML";
  contentDetails: CoupangContentDetail[];
}

export interface CoupangItemNotice {
  noticeCategoryName?: string;
  noticeCategoryDetailName?: string;
  content?: string;
}

export interface CoupangItemAttribute {
  attributeTypeName: string;
  attributeValueName: string;
}

export interface CoupangItem {
  itemName: string;
  originalPrice: number;
  salePrice: number;
  maximumBuyCount: number;
  maximumBuyForPerson: number;
  maximumBuyForPersonPeriod: number;
  outboundShippingTimeDay: number;
  unitCount: number;
  adultOnly: "ADULT_ONLY" | "EVERYONE";
  taxType: "TAX" | "FREE";
  parallelImported: "PARALLEL_IMPORTED" | "NOT_PARALLEL_IMPORTED";
  overseasPurchased: "OVERSEAS_PURCHASED" | "NOT_OVERSEAS_PURCHASED";
  pccNeeded: boolean;
  images: CoupangItemImage[];
  /** 카테고리별 필수 구매옵션(색상/사이즈 등) — 쿠팡 카테고리 메타정보 조회 API를
   * 아직 연동하지 않아 항상 빈 배열이다. 카테고리가 필수 attributes를 요구하면
   * 실제 쿠팡 API가 COUPANG_API_ERROR로 등록을 거부한다 — 추측값을 채워 넣는
   * 것보다 정직하게 실패시키고 사용자에게 원인을 그대로 보여주는 쪽을 택했다. */
  attributes: CoupangItemAttribute[];
  /** 카테고리별 고시정보(원산지, 품질보증기준 등) — attributes와 같은 이유로 빈
   * 배열이다. */
  notices: CoupangItemNotice[];
  contents: CoupangItemContent[];
  searchTags: string[];
}

export interface CoupangPayload {
  displayCategoryCode: number | null;
  /** 공식 스키마 필드가 아니다 — Payload Inspector가 카테고리 경로를 사람이 읽을
   * 수 있게 보여주기 위한 CartPilot 전용 참고 필드. */
  displayCategoryPath: string[] | null;
  sellerProductName: string;
  vendorId: string;
  saleStartedAt: string;
  saleEndedAt: string;
  brand?: string;
  generalProductName?: string;
  deliveryMethod: "SEQUENCIAL";
  deliveryCompanyCode: string;
  deliveryChargeType: "FREE" | "NOT_FREE" | "CHARGE_RECEIVED" | "CONDITIONAL_FREE";
  deliveryCharge: number;
  freeShipOverAmount: number;
  deliveryChargeOnReturn: number;
  remoteAreaDeliverable: "Y" | "N";
  unionDeliveryType: "UNION_DELIVERY" | "NOT_UNION_DELIVERY";
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  returnCharge: number;
  outboundShippingPlaceCode: number | null;
  vendorUserId: string;
  /** true면 등록과 동시에 쿠팡 승인을 자동 요청한다. CartPilot은 항상 false로
   * 보낸다 — "실제 상품 1개만, 사람이 Wing에서 최종 확인 후 승인 요청"이라는
   * 이번 Mission의 안전 원칙과 맞춘다. */
  requested: boolean;
  items: CoupangItem[];
  /** 공식 필드가 아니다 — 환율 추정가인지 CartPilot UI가 표시하기 위한 참고 필드. */
  priceIsEstimate: boolean;
}

function formatCoupangDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function buildCoupangPayload(
  product: CanonicalProduct,
  listing: ListingModel,
  options: { sellerConfig?: CoupangSellerConfig } = {},
): CoupangPayload {
  const sellerConfig = options.sellerConfig ?? BLANK_COUPANG_SELLER_CONFIG;

  // listing.category.candidate.id는 대부분 CartPilot 내부 카테고리 id다 — 실제
  // 쿠팡 숫자 코드로 쓸 수 있는 건 /api/coupang/category-recommend가 만든
  // candidate(isVerifiedPlatformCode: true)를 사용자가 SELECTED/CONFIRMED로
  // 확정했을 때뿐이다. 그 외에는 추측하지 않고 null로 둔다.
  const isCategoryConfirmed =
    listing.category.state === "SELECTED" || listing.category.state === "CONFIRMED";
  const verifiedCandidate =
    isCategoryConfirmed && listing.category.candidate?.isVerifiedPlatformCode
      ? listing.category.candidate
      : null;
  const displayCategoryCode = verifiedCandidate ? Number(verifiedCandidate.id) : null;

  const descriptionImageUrls = product.images
    .filter((img) => img.useInDescription)
    .map((img) => getSelectedImageUrl(img));

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

  const deliveryCharge = product.shippingFee.value;
  const deliveryChargeType: CoupangPayload["deliveryChargeType"] = deliveryCharge > 0 ? "NOT_FREE" : "FREE";

  return {
    displayCategoryCode,
    displayCategoryPath: listing.category.candidate?.path ?? null,
    sellerProductName: listing.title,
    vendorId: sellerConfig.vendorId,
    saleStartedAt: formatCoupangDateTime(now),
    saleEndedAt: formatCoupangDateTime(twoYearsLater),
    brand: listing.brand,
    generalProductName: listing.title,
    deliveryMethod: "SEQUENCIAL",
    deliveryCompanyCode: sellerConfig.deliveryCompanyCode,
    deliveryChargeType,
    deliveryCharge,
    freeShipOverAmount: 0,
    deliveryChargeOnReturn: deliveryCharge,
    remoteAreaDeliverable: "N",
    unionDeliveryType: "NOT_UNION_DELIVERY",
    returnCenterCode: sellerConfig.returnCenterCode,
    returnChargeName: sellerConfig.returnChargeName,
    companyContactNumber: sellerConfig.companyContactNumber,
    returnZipCode: sellerConfig.returnZipCode,
    returnAddress: sellerConfig.returnAddress,
    returnAddressDetail: sellerConfig.returnAddressDetail,
    returnCharge: deliveryCharge,
    outboundShippingPlaceCode: sellerConfig.outboundShippingPlaceCode,
    vendorUserId: sellerConfig.vendorUserId,
    requested: false,
    priceIsEstimate: listing.priceIsEstimate,
    items: [
      {
        itemName: listing.title,
        originalPrice: listing.priceKrw,
        salePrice: listing.priceKrw,
        maximumBuyCount: product.stockQuantity.value,
        maximumBuyForPerson: 0,
        maximumBuyForPersonPeriod: 0,
        // 해외 URL을 소싱해서 등록하는 CartPilot 특성상 국내 사입 대비 배송이 오래
        // 걸린다고 보수적으로 가정한다 — 실제 배송 정책이 정해지면 조정한다.
        outboundShippingTimeDay: 7,
        unitCount: 1,
        adultOnly: "EVERYONE",
        taxType: "TAX",
        parallelImported: "NOT_PARALLEL_IMPORTED",
        overseasPurchased: "NOT_OVERSEAS_PURCHASED",
        pccNeeded: false,
        images,
        attributes: [],
        notices: [],
        contents: [
          ...(listing.description
            ? [
                {
                  contentsType: "TEXT" as const,
                  contentDetails: [{ content: listing.description, detailType: "TEXT" as const }],
                },
              ]
            : []),
          ...descriptionImageUrls.map((url) => ({
            contentsType: "IMAGE" as const,
            contentDetails: [{ content: url, detailType: "IMAGE" as const }],
          })),
        ],
        searchTags: listing.options,
      },
    ],
  };
}
