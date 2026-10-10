import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { buildNaverProductPayload, hasRealProductOptions } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ③ P0.3 D-OPT — 「옵션 그룹은 선언됐는데 조합이 0개」는 등록될 수 없다
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **실제 상품으로 발견했다**(2026-10-11). Smallable 430632
 * (All About Monsters Washed T-shirt, Bobo Choses) — 사이즈 6개가 추출되지만
 * 원본이 옵션별 재고를 주지 않는다.
 *
 *     hasRealProductOptions  true      ← variants 가 6건이라 통과
 *     optionGroupName1       "사이즈"   ← 그룹은 선언됨
 *     optionCombinations     []        ← 재고 규칙이 전부 빼냈다
 *     stockQuantity          999       ← READY 로 통과했다
 *
 * 즉 **6사이즈 상품이 「단품 999」처럼 등록 시도된다.**
 *
 * 🔴 왜 기존 가드가 못 잡았는가: `hasRealProductOptions` 는 이 상황을 막으려고
 *    만든 것인데 `variants.length === 0` «만» 본다. P5.6 에서 「재고를 모르는
 *    조합은 0 으로 메우지 않고 빼낸다」 규칙이 들어오면서 **조합이 0이 되는 두
 *    번째 경로** 가 생겼고, 그 경로는 가드보다 뒤에 있다. 가드가 자기보다 나중에
 *    생긴 경로를 모른 것이다.
 *
 * 🔴 고치는 방향: 재고를 숫자로 «메우지 않는다». 막고, 셀러가 풀 수 있는 길
 *    (「기본 재고 수량」)을 reason 에 적는다. 0 으로 메우면 팔 수 있는 옵션이
 *    품절로 등록되고, 999 로 메우면 모르는 것을 안다고 주장한다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 실제 Smallable 430632 의 추출 결과를 그대로 옮긴 fixture (값을 다듬지 않았다). */
function makeRealSmallableProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl:
      "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632",
    title: field("All About Monsters Washed T-shirt Organic cotton | Blue"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804532"),
    description: field(
      "  SIZE AND FIT    Loose fit    COMPOSITION    100% Organic Cotton    Find out more    Wash Cold-30°  Made in Spain  ",
    ),
    /* 🔴 운영 승격 결과 그대로 — description/title 에서 뽑힌 값이다. */
    material: field("100% Organic Cotton"),
    color: field("Blue"),
    countryOfOrigin: field("Spain"),
    careInstructions: field("케어라벨 참조", "DEFAULT"),
    recommendedAge: field("", "REQUIRED"),
    manufacturer: field("", "REQUIRED"),
    options: field([]),
    /* 🔴 사이즈 6개 — 그런데 variants 에 stockQuantity 가 «없다»(원본이 안 준다). */
    optionGroups: [
      { name: "사이즈", values: ["2/3 years", "4/5 years", "6/7 years", "8/9 years", "10/11 years", "12/13 years"] },
    ],
    variants: [
      { id: "2/3 years", optionValues: { 사이즈: "2/3 years" } },
      { id: "4/5 years", optionValues: { 사이즈: "4/5 years" } },
      { id: "6/7 years", optionValues: { 사이즈: "6/7 years" } },
      { id: "8/9 years", optionValues: { 사이즈: "8/9 years" } },
      { id: "10/11 years", optionValues: { 사이즈: "10/11 years" } },
      { id: "12/13 years", optionValues: { 사이즈: "12/13 years" } },
    ],
    images: [
      {
        id: "img-1",
        originalUrl:
          "https://staticv3.smallable.com/nsml/gs_11748877-720x986q80/all-about-monsters-washed-t-shirt-organic-cotton.webp",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    returnPolicy: field("", "REQUIRED"),
    shippingFee: field(0, "DEFAULT"),
    /* 🔴 운영 파이프라인이 넣는 그 값 — canonical-product.ts:420. */
    stockQuantity: field(999, "DEFAULT"),
    certification: field("", "DEFAULT"),
    importer: field("", "REQUIRED"),
    childCertification: field(null, "REQUIRED"),
    itemName: field("", "REQUIRED"),
    modelName: field("All About Monsters Washed T-shirt Organic cotton | Blue"),
    weight: field("", "REQUIRED"),
    certificationType: field("", "REQUIRED"),
    ...overrides,
  };
}

function makeListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 112290,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    priceOrigin: "PRODUCT_OVERRIDE",
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

function payloadFor(product: CanonicalProduct) {
  return buildNaverProductPayload({
    product,
    listing: makeListing(product),
    leafCategoryId: "50000535",
    releaseAddressBookNo: 900000001,
    refundAddressBookNo: 900000002,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    sellerDeliveryFee: null,
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    originAreaCode: "00",
    originAreaRequiresContent: false,
    categoryRequiresChildCertification: true,
    childCertificationInfoId: 1041,
  });
}

function validateFor(product: CanonicalProduct) {
  return validateNaverPayload(payloadFor(product), {
    product,
    releaseAddressBookNo: 900000001,
    refundAddressBookNo: 900000002,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    returnCompaniesFetchFailed: false,
    originAreaCode: "00",
    originAreaRequiresImporter: false,
    childCertificationInfoId: 1041,
    /* 아동 카테고리 — 세 번째 인자다(옵션이 아니다). */
  }, true);
}

const COMBOS_FIELD = "detailAttribute.optionInfo.optionCombinations";

describe("③ D-OPT — 옵션 그룹만 선언되고 조합이 0개인 payload", () => {
  it("🔴 재현 — 실제 상품에서 조합이 0건이 된다(가드가 아니라 사실 확인)", () => {
    const product = makeRealSmallableProduct();
    const payload = payloadFor(product);

    /* 기존 가드는 통과한다 — variants 가 6건이기 때문이다. */
    expect(hasRealProductOptions(product)).toBe(true);
    expect(payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames).toEqual({
      optionGroupName1: "사이즈",
    });
    /* 🔴 그런데 조합은 비어 있다 — 재고를 모르는 조합을 «빼냈기» 때문이다.
       0 으로 메우지 않는 그 규칙 자체는 옳다(P5.6). */
    expect(payload.originProduct.detailAttribute?.optionInfo?.optionCombinations).toEqual([]);
  });

  it("그 상태는 «등록 가능» 으로 판정되지 않는다 — 옵션별 재고가 MISSING 이다", () => {
    const result = validateFor(makeRealSmallableProduct());
    const combos = result.fields.find((f) => f.field === COMBOS_FIELD);

    expect(combos).toBeDefined();
    expect(combos?.status).toBe("MISSING");
    /* 🔴 셀러가 «풀 수 있는 길» 이 reason 에 있어야 한다. 「안 된다」만 적으면
       셀러는 같은 화면을 계속 들여다본다. */
    expect(combos?.reason).toContain("기본 재고 수량");
    /* 🔴 그리고 0/999 로 메우라고 안내하지 «않는다». */
    expect(combos?.reason).toContain("임의로 메우지 않습니다");
    expect(result.ok).toBe(false);
  });

  it("셀러가 기본 재고를 넣으면 조합이 복구되고 그 MISSING 이 사라진다", () => {
    /* 🔴 대조군 — 이것이 없으면 「언제나 MISSING」인 가드와 구별되지 않는다. */
    const product = makeRealSmallableProduct({ sellerDefaultStock: 5 } as Partial<CanonicalProduct>);
    const payload = payloadFor(product);

    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos).toHaveLength(6);
    for (const combo of combos) {
      expect(combo.stockQuantity).toBe(5);
    }

    const result = validateFor(product);
    expect(result.fields.find((f) => f.field === COMBOS_FIELD)).toBeUndefined();
  });

  it("🔴 999 는 판매자 기본값으로도 조합을 복구하지 못한다 — 그 숫자는 「모른다」다", () => {
    const product = makeRealSmallableProduct({ sellerDefaultStock: 999 } as Partial<CanonicalProduct>);
    const payload = payloadFor(product);

    expect(payload.originProduct.detailAttribute?.optionInfo?.optionCombinations).toEqual([]);
    expect(validateFor(product).fields.find((f) => f.field === COMBOS_FIELD)?.status).toBe("MISSING");
  });

  it("옵션이 애초에 없는 상품은 이 MISSING 을 받지 않는다 — 단품 등록을 막지 않는다", () => {
    /* 🔴 대조군 2 — 가드가 옵션 없는 상품까지 막으면 돌고 있는 등록이 깨진다. */
    const product = makeRealSmallableProduct({ optionGroups: [], variants: [] });
    expect(hasRealProductOptions(product)).toBe(false);
    expect(validateFor(product).fields.find((f) => f.field === COMBOS_FIELD)).toBeUndefined();
  });
});
