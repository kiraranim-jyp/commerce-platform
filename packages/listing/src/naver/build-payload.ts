import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import type {
  NaverImageRef,
  NaverOptionCombination,
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
 * N-2.8에서 optionCombinations/originAreaInfo 필드명이 GitHub #241 원문
 * 코드 예제로 추가 확인되어 값을 채우기 시작했다 — 다만 필드 "의미"(price가
 * 절대가/추가금액인지, originAreaCode enum 값)는 여전히 미확인이라
 * validate-payload.ts가 항상 BLOCKED로 남긴다(추측 값을 신뢰해서 등록에
 * 쓰지 말라는 신호). 택배사 코드(deliveryCompany enum)는 조회 API 자체가
 * 없어서(N-2.5) 여전히 채우지 않는다.
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
  /** N-2.7 추가 — 카테고리 detail의 exceptionalCategories에 CHILD_CERTIFICATION이
   * 있는지(호출부 판단, 이 함수는 카테고리 API를 다시 호출하지 않는다). 상품정보
   * 제공고시는 인증서 실제 보유 여부(childCertificationInfoId)와 무관하게 항상
   * 필요한 별개의 고시 의무라서, 이 값만으로 KIDS/WEAR 타입을 정하고 고시 필드는
   * 항상 채운다 — N-2.6에서는 이 둘을 하나로 묶어서 인증 카탈로그 id가 없으면
   * 고시 섹션 전체가 사라졌는데(Preview에서 항상 보여야 하는 섹션이 사라지는
   * 버그), 실제로는 "고시 의무"와 "인증서 보유"가 서로 다른 개념이라 분리한다. */
  categoryRequiresChildCertification: boolean;
}

/** N-2.8 — 옵션 조합(optionCombinations) 필드명은 GitHub #241 원문 코드
 * 예제로 확인됐다(id/optionName1-4/stockQuantity/price/sellerManagerCode/
 * usable). 다만 price 필드의 의미(절대 판매가인지 salePrice 대비 추가금액인지)와
 * id 필드를 CartPilot이 미리 채워도 되는지는 실제 등록 성공 전까지 확인된 적이
 * 없다 — 여기서는 "price = variant.price가 있으면 salePrice와의 차액(추가금액),
 * 없으면 0"으로 가정한다(대부분의 국내 마켓플레이스가 조합형 옵션에 추가금액
 * 방식을 쓰는 관행을 따른 것 — 확정된 사실이 아니라 관행 기반 가정임을
 * validate-payload.ts가 항상 BLOCKED로 상기시킨다). optionName1..4는
 * product.optionGroups 순서대로 variant.optionValues 값을 채운다. */
function buildOptionCombinations(product: CanonicalProduct, salePrice: number): NaverOptionCombination[] {
  const groupNames = product.optionGroups.map((g) => g.name);
  return product.variants.map((variant) => {
    const values = groupNames.map((name) => variant.optionValues[name] ?? "");
    const priceDelta = variant.price ? variant.price.amount - salePrice : 0;
    const combo: NaverOptionCombination = {
      id: variant.sku || variant.id,
      stockQuantity: variant.stockQuantity ?? product.stockQuantity.value ?? 0,
      price: priceDelta,
      usable: true,
    };
    if (values[0]) combo.optionName1 = values[0];
    if (values[1]) combo.optionName2 = values[1];
    if (values[2]) combo.optionName3 = values[2];
    if (values[3]) combo.optionName4 = values[3];
    return combo;
  });
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
  const {
    product,
    listing,
    leafCategoryId,
    releaseAddressBookNo,
    refundAddressBookNo,
    childCertificationInfoId,
    categoryRequiresChildCertification,
  } = input;

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
        // 고시 의무는 인증서 보유 여부와 무관하게 항상 존재한다 — 카테고리가
        // CHILD_CERTIFICATION 대상이면 KIDS, 아니면 일반 의류(WEAR) 타입을 쓴다.
        productInfoProvidedNotice: categoryRequiresChildCertification
          ? {
              productInfoProvidedNoticeType: "KIDS",
              material: product.material.value || undefined,
              color: product.color.value || undefined,
              manufacturer: product.manufacturer.value || undefined,
              caution: product.careInstructions.value || undefined,
              recommendedAge: product.recommendedAge.value || undefined,
            }
          : {
              productInfoProvidedNoticeType: "WEAR",
              material: product.material.value || undefined,
              color: product.color.value || undefined,
              manufacturer: product.manufacturer.value || undefined,
              caution: product.careInstructions.value || undefined,
            },
        // originAreaInfo.originAreaCode: 네이버 자체 원산지 코드 enum이
        // 미확인이라 채우지 않는다. content만 CartPilot이 이미 아는 원산지
        // 텍스트로 채운다(validate-payload.ts가 originAreaCode 누락을 BLOCKED로 표시).
        originAreaInfo:
          product.countryOfOrigin.value
            ? { content: product.countryOfOrigin.value }
            : undefined,
        optionInfo:
          product.optionGroups.length > 0
            ? {
                useStockManagement: true,
                optionCombinationGroupNames: product.optionGroups.map((g) => g.name),
                optionCombinations: buildOptionCombinations(product, listing.priceKrw),
              }
            : undefined,
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
