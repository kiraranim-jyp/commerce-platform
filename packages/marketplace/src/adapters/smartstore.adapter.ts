import type { CanonicalProduct } from "@commerce/shared";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { convertToKrw } from "@commerce/pricing";
import { categoryFieldRule } from "../category-field";
import { effectiveDescription, effectiveTitle } from "../content-field";
import { imageFormatFieldRule } from "../image-field";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, PlatformAdapter } from "../types";

/**
 * 스마트스토어는 옵션이 없는 단일 상품 등록도 흔해서 옵션 미입력을 WARNING에
 * 그친다(ERROR로 막지 않는다).
 */
export const smartstoreAdapter: PlatformAdapter = {
  platform: "smartstore",
  label: "스마트스토어",
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
    const title = effectiveTitle(product);
    const description = effectiveDescription(product);

    const rules: FieldRule[] = [
      {
        field: "title",
        label: "상품명",
        check: () => title.trim().length > 0,
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
      imageFormatFieldRule(product),
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
        message: "옵션 정보가 없습니다 — 단일 상품으로 등록됩니다.",
      },
      {
        field: "description",
        label: "상세설명",
        check: () => description.trim().length > 0,
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
      title,
      brand: product.brand.value || undefined,
      priceKrw: amountKrw,
      priceIsEstimate: isEstimate,
      options: product.options.value,
      shippingInfo: "해외배송",
      description,
      category: categorySelection,
      validations,
      registrableScore: scoreValidations(validations),
    };
  },
};
