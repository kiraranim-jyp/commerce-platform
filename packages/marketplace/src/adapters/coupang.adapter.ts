import type { CanonicalProduct } from "@commerce/shared";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { convertToKrw } from "@commerce/pricing";
import { categoryFieldRule } from "../category-field";
import { effectiveDescription, effectiveTitle } from "../content-field";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, PlatformAdapter } from "../types";

/**
 * 쿠팡은 브랜드 미기재 상품에 대한 규제가 스마트스토어보다 엄격해서(상표권 이슈로
 * 반려되는 경우가 실제로 흔하다) 브랜드 누락을 ERROR로 잡는다 — 스마트스토어
 * 어댑터와 같은 필드라도 플랫폼마다 요구 강도가 다르다는 걸 보여주는 대표 사례.
 */
export const coupangAdapter: PlatformAdapter = {
  platform: "coupang",
  label: "쿠팡",
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
        field: "brand",
        label: "브랜드",
        check: () => product.brand.value.trim().length > 0,
        onFail: "ERROR",
        message: "쿠팡은 브랜드 미기재 시 등록이 반려될 수 있습니다.",
      },
      categoryFieldRule(categorySelection),
      {
        field: "price",
        label: "판매가격",
        check: () => product.price.value.amount > 0,
        onFail: "ERROR",
        message: "판매가격을 확인할 수 없습니다.",
      },
      {
        field: "options",
        label: "옵션",
        check: () => product.options.value.length > 0,
        onFail: "WARNING",
        message: "옵션 정보가 없습니다.",
      },
      {
        field: "shipping",
        label: "배송정보",
        check: () => true,
        onFail: "WARNING",
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
      platform: "coupang",
      platformLabel: "쿠팡",
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
