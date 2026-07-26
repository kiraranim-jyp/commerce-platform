import type { CanonicalProduct } from "@commerce/shared";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { convertToKrw } from "@commerce/pricing";
import { categoryFieldRule } from "../category-field";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, PlatformAdapter } from "../types";

export const elevenstAdapter: PlatformAdapter = {
  platform: "elevenst",
  label: "11번가",
  toListingModel(
    product: CanonicalProduct,
    categorySelection: CategorySelection = UNRESOLVED_CATEGORY,
  ): ListingModel {
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
        field: "representativeImage",
        label: "대표이미지",
        check: () => Boolean(representativeImage),
        onFail: "ERROR",
        message: "대표 이미지가 지정되지 않았습니다.",
      },
      {
        field: "title",
        label: "상품명",
        check: () => product.title.value.trim().length > 0,
        onFail: "ERROR",
        message: "상품명이 비어 있습니다.",
      },
      {
        field: "price",
        label: "판매가격",
        check: () => product.price.value.amount > 0,
        onFail: "ERROR",
        message: "판매가격을 확인할 수 없습니다.",
      },
      categoryFieldRule(categorySelection),
      {
        field: "options",
        label: "옵션",
        check: () => product.options.value.length > 0,
        onFail: "WARNING",
        message: "옵션 정보가 없습니다.",
      },
      {
        field: "description",
        label: "상세설명",
        check: () => product.description.value.trim().length > 0,
        onFail: "WARNING",
        message: "상세설명이 비어 있습니다.",
      },
      {
        field: "shipping",
        label: "배송정보",
        check: () => true,
        onFail: "WARNING",
      },
    ];
    const validations = runValidation(rules);

    return {
      platform: "elevenst",
      platformLabel: "11번가",
      representativeImage,
      additionalImages,
      title: product.title.value,
      brand: product.brand.value || undefined,
      priceKrw: amountKrw,
      priceIsEstimate: isEstimate,
      options: product.options.value,
      shippingInfo: "해외배송",
      description: product.description.value,
      category: categorySelection,
      validations,
      registrableScore: scoreValidations(validations),
    };
  },
};
