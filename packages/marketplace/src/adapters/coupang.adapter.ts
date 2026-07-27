import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { convertToKrw } from "@commerce/pricing";
import { categoryFieldRule } from "../category-field";
import { effectiveDescription, effectiveTitle } from "../content-field";
import { imageFormatFieldRule } from "../image-field";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, PlatformAdapter } from "../types";

/** 쿠팡 실제 등록 한도 — 대표 1장 + 추가 최대 9장(총 10장). product.images에는
 * 커머스별 제한을 저장하지 않는다 — 사용자가 몇 장을 선택했든 이 어댑터가 등록
 * 시점에 쿠팡 한도만큼만 잘라서 쓴다. 다른 커머스(스마트스토어/11번가)를 추가해도
 * 이미지 선택 상태나 product.images 구조를 다시 손댈 필요가 없다. */
const MAX_ADDITIONAL_IMAGES = 9;

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
    const representativeImageEntry = product.images.find((img) => img.isRepresentative);
    const representativeImage = representativeImageEntry
      ? getSelectedImageUrl(representativeImageEntry)
      : undefined;
    const additionalImages = product.images
      .filter((img) => !img.isRepresentative && img.useInProductGallery)
      .map((img) => getSelectedImageUrl(img))
      .slice(0, MAX_ADDITIONAL_IMAGES);
    const estimated = convertToKrw(product.price.value.amount, product.price.value.currency);
    // priceOverrideKrw가 있으면(사용자가 판매가를 직접 입력함) 환율 추정값 대신
    // 그 값을 쓴다 — 더 이상 "추정"이 아니라 사용자가 확정한 값이므로 isEstimate도 false.
    const amountKrw = product.priceOverrideKrw?.value ?? estimated.amountKrw;
    const isEstimate = product.priceOverrideKrw ? false : estimated.isEstimate;
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
      {
        field: "representativeImage",
        label: "대표이미지",
        check: () => Boolean(representativeImage),
        onFail: "ERROR",
        message: "대표 이미지가 지정되지 않았습니다.",
      },
      imageFormatFieldRule(product),
      categoryFieldRule(categorySelection),
      {
        field: "price",
        label: "판매가격",
        check: () => amountKrw > 0,
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
