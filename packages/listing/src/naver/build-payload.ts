import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type {
  NaverImageRef,
  NaverProductRegistrationPayload,
} from "./types";

/**
 * Sprint N-2.6 — CartPilot canonical product → Naver v2 payload 변환.
 *
 * 기존 build-payload.ts(smartstore DRY_RUN용, packages/listing/src/smartstore/)와
 * 완전히 별개다 — 그 파일은 자체 주석에 "실제 네이버 API 요청 바디를 그대로
 * 흉내내지 않는다"고 명시돼 있어서 실제 스키마 변환에는 재사용할 수 없었다
 * (N-2.1 조사 결과). 이 파일이 실제 스키마를 대상으로 하는 첫 구현이다.
 *
 * 여기서 다루지 않는 것(N-2.6 work order 17번 minimal fixture 범위):
 * - 옵션이 있는 상품(optionCombinations 스키마 미확인, validate-payload.ts가 BLOCKED 처리)
 * - 원산지(originAreaInfo 하위 구조 미확인)
 * - 택배사 코드(deliveryCompany enum 미확인)
 */

export interface NaverPayloadInput {
  product: CanonicalProduct;
  listing: ListingModel;
  /** N-2.4 확인 — 리프 카테고리 ID(예: "50000535"). */
  leafCategoryId: string;
  /** N-2.5 확인 — 판매자 주소록(addressbooks-for-page)의 addressType=RELEASE
   * 항목 addressBookNo. outboundLocationId로 쓴다는 매핑은 가정이다(주석 참고). */
  releaseAddressBookNo: number | null;
  /** N-2.5 확인 — addressType=REFUND_OR_EXCHANGE 항목 addressBookNo.
   * shippingAddressId/returnAddressId로 쓴다는 매핑은 가정이다. */
  refundAddressBookNo: number | null;
  /** N-2.4 확인 — 카테고리 detail의 certificationInfos 중 kindTypes에
   * CHILD_CERTIFICATION이 포함된 항목의 id. 실제 인증서 정보(번호/업체명/일자)는
   * 판매자가 실제로 취득한 인증이 있어야만 채울 수 있어 여기서는 다루지 않는다
   * (validate-payload.ts가 인증 필요 카테고리인데 이 값이 없으면 BLOCKED 처리). */
  childCertificationInfoId: number | null;
}

function toImageRef(url: string): NaverImageRef {
  return { url };
}

/**
 * DRY_RUN 전용 — 실제 POST를 호출하지 않는다. 확인 안 된 필드(deliveryCompany,
 * originAreaInfo, optionCombinations 등)는 채우지 않고 undefined로 남긴다 —
 * validate-payload.ts가 이걸 근거로 BLOCKED 사유를 만든다.
 */
export function buildNaverProductPayload(input: NaverPayloadInput): NaverProductRegistrationPayload {
  const { product, listing, leafCategoryId, releaseAddressBookNo, refundAddressBookNo, childCertificationInfoId } =
    input;

  const representativeUrl = listing.representativeImage;
  const optionalUrls = listing.additionalImages;

  return {
    originProduct: {
      statusType: "SALE",
      saleType: "NEW",
      leafCategoryId,
      name: listing.title,
      images: {
        representativeImage: representativeUrl ? toImageRef(representativeUrl) : { url: "" },
        optionalImages: optionalUrls.length > 0 ? optionalUrls.map(toImageRef) : undefined,
      },
      detailContent: listing.description,
      salePrice: listing.priceKrw,
      stockQuantity: product.stockQuantity.value || 1,
      deliveryInfo: {
        outboundLocationId: releaseAddressBookNo ?? undefined,
        // deliveryCompany: 미확인 — 채우지 않는다.
        deliveryFee: {
          deliveryFeeType: "FREE",
          baseFee: 0,
        },
        claimDeliveryInfo: {
          shippingAddressId: releaseAddressBookNo ?? undefined,
          returnAddressId: refundAddressBookNo ?? undefined,
        },
      },
      detailAttribute: {
        productInfoProvidedNotice:
          childCertificationInfoId !== null
            ? {
                productInfoProvidedNoticeType: "KIDS",
                material: product.material.value || undefined,
                color: product.color.value || undefined,
                manufacturer: product.manufacturer.value || undefined,
                caution: product.careInstructions.value || undefined,
                recommendedAge: product.recommendedAge.value || undefined,
              }
            : undefined,
        // originAreaInfo: 미확인 하위 구조라 채우지 않는다.
        // optionInfo: 이번 fixture는 옵션 없는 상품만 대상(스키마 미확인).
      },
      productCertificationInfos:
        childCertificationInfoId !== null ? [{ certificationInfoId: childCertificationInfoId }] : undefined,
    },
    smartstoreChannelProduct: {
      channelProductName: listing.title,
      channelProductDisplayStatusType: "WAIT",
    },
  };
}
