import type { CanonicalProduct } from "@commerce/shared";
import { convertToKrw } from "@commerce/pricing";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, PlatformAdapter } from "../types";

/**
 * 스마트스토어는 옵션이 없는 단일 상품 등록도 흔해서 옵션 미입력을 WARNING에
 * 그친다(ERROR로 막지 않는다). 카테고리는 이번 Mission 범위에 카테고리 매핑이
 * 없어서 항상 WARNING — 다음 Mission(카테고리 매핑)에서 실제로 채워진다.
 */
export const smartstoreAdapter: PlatformAdapter = {
  platform: "smartstore",
  label: "스마트스토어",
  toListingModel(product: CanonicalProduct): ListingModel {
    const representativeImage = product.images.find((img) => img.isRepresentative)?.url;
    const additionalImages = product.images
      .filter((img) => img.url !== representativeImage)
      .map((img) => img.url);
    const { amountKrw, isEstimate } = convertToKrw(
      product.price.value.amount,
      product.price.value.currency,
    );

    const rules: FieldRule[] = [
      {
        field: "title",
        label: "상품명",
        check: () => product.title.value.trim().length > 0,
        onFail: "ERROR",
        message: "상품명이 비어 있습니다.",
      },
      {
        field: "representativeImage",
        label: "대표이미지",
        check: () => Boolean(representativeImage),
        onFail: "ERROR",
        message: "대표 이미지가 지정되지 않았습니다.",
      },
      {
        field: "price",
        label: "판매가격",
        check: () => product.price.value.amount > 0,
        onFail: "ERROR",
        message: "판매가격을 확인할 수 없습니다.",
      },
      {
        field: "category",
        label: "카테고리",
        check: () => false,
        onFail: "WARNING",
        message: "카테고리 매핑은 다음 Mission에서 지원됩니다.",
      },
      {
        field: "options",
        label: "옵션",
        check: () => product.options.value.length > 0,
        onFail: "WARNING",
        message: "옵션 정보가 없습니다 — 단일 상품으로 등록됩니다.",
      },
      {
        field: "description",
        label: "상세설명",
        check: () => product.description.value.trim().length > 0,
        onFail: "WARNING",
        message: "상세설명이 비어 있습니다.",
      },
    ];
    const validations = runValidation(rules);

    return {
      platform: "smartstore",
      platformLabel: "스마트스토어",
      representativeImage,
      additionalImages,
      title: product.title.value,
      brand: product.brand.value || undefined,
      priceKrw: amountKrw,
      priceIsEstimate: isEstimate,
      options: product.options.value,
      shippingInfo: "해외배송",
      description: product.description.value,
      validations,
      registrableScore: scoreValidations(validations),
    };
  },
};
