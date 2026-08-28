import type { CanonicalProduct } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import { UNRESOLVED_CATEGORY, type CategorySelection } from "@commerce/category";
import { resolveListingPrice } from "@commerce/pricing";
import { categoryFieldRule } from "../category-field";
import { effectiveDescription, effectiveTitle } from "../content-field";
import { imageFormatFieldRule } from "../image-field";
import { runValidation, scoreValidations, type FieldRule } from "../validation";
import type { ListingModel, ListingPricingContext, PlatformAdapter } from "../types";

/** 11번가 실제 등록 한도 — 대표 1장 + 추가 최대 20장. product.images에는 커머스별
 * 제한을 저장하지 않는다 — 이 어댑터가 등록 시점에만 적용한다. */
const MAX_ADDITIONAL_IMAGES = 20;

export const elevenstAdapter: PlatformAdapter = {
  platform: "elevenst",
  label: "11번가",
  toListingModel(
    product: CanonicalProduct,
    categorySelection: CategorySelection = UNRESOLVED_CATEGORY,
    pricingContext?: ListingPricingContext,
  ): ListingModel {
    const representativeImageEntry = product.images.find((img) => img.isRepresentative);
    const representativeImage = representativeImageEntry
      ? getSelectedImageUrl(representativeImageEntry)
      : undefined;
    const additionalImages = product.images
      .filter((img) => !img.isRepresentative && img.useInProductGallery)
      .map((img) => getSelectedImageUrl(img))
      .slice(0, MAX_ADDITIONAL_IMAGES);
    // P-4-H1-2-2 — coupang/smartstore 어댑터와 동일한 resolveListingPrice().
    const resolution = resolveListingPrice(
      {
        priceOverrideKrw: product.priceOverrideKrw?.value,
        originalAmount: product.price.value.amount,
        originalCurrency: product.price.value.currency,
        priceBreakdown: product.priceBreakdown,
        priceValidity: product.priceValidity,
      },
      pricingContext?.liveRates,
      pricingContext?.roundingUnit,
    );
    const amountKrw = resolution.priceKrw ?? 0;
    const isEstimate = resolution.isEstimate;
    const title = effectiveTitle(product);
    const description = effectiveDescription(product);

    const rules: FieldRule[] = [
      {
        field: "representativeImage",
        label: "대표이미지",
        check: () => Boolean(representativeImage),
        onFail: "ERROR",
        message: "대표 이미지가 지정되지 않았습니다.",
      },
      imageFormatFieldRule(product),
      {
        field: "title",
        label: "상품명",
        check: () => title.trim().length > 0,
        onFail: "ERROR",
        message: "상품명이 비어 있습니다.",
      },
      {
        field: "price",
        label: "판매가격",
        // P-4-H1-2-2 STEP 5 — override 없음 자체는 막지 않는다, UNRESOLVED만 막는다.
        check: () => resolution.source !== "UNRESOLVED" && amountKrw > 0,
        onFail: "ERROR",
        message: resolution.reason ?? "판매가격을 확인할 수 없습니다.",
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
        check: () => description.trim().length > 0,
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
      title,
      brand: product.brand.value || undefined,
      priceKrw: amountKrw,
      priceIsEstimate: isEstimate,
      priceSource: resolution.source,
      options: product.options.value,
      shippingInfo: "해외배송",
      description,
      category: categorySelection,
      validations,
      registrableScore: scoreValidations(validations),
    };
  },
};
