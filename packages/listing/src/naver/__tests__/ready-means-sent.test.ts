import { describe, expect, it } from "vitest";
import type { CanonicalProduct, CanonicalProductImage, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";
import { resolveCareInstructions } from "../../notice/care-instructions";
import { planProductBulkReference } from "../../notice/bulk-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-4 사전 — 🔴 **「READY 는 «보냈다» 를 뜻해야 한다」**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지난번 실제 등록이 `originProduct.detailAttribute.originAreaInfo.content` 때문에
 * **400** 으로 떨어졌는데 사전 검증은 0 blocker 였다. 원인은 단일 버그가 아니라
 * **유형** 이다:
 *
 *   validator 가 「호출부가 넘긴 플래그」로 판정하고,
 *   payload 는 「다른 출처」에서 값을 가져온다
 *   → 둘이 어긋나는 순간 READY 인데 보낼 값이 없다
 *
 * P2-1 A 는 원산지 한 자리를 고쳤다. 이 파일은 **그 유형이 다른 필드에도 있는지**
 * 를 구조로 재서 다음 400 을 선행 차단한다. 자격증명이 없어도 할 수 있는 일이고,
 * 실제 등록 전에 해 두는 것이 맞다.
 *
 * 🔴 재는 방식: 셀러 설정을 «전부 채운» 상태로 payload 를 만들고 검증한다.
 * 검증이 READY 라고 말한 필드는 payload 에 **실제 값이 있어야 한다.** 비어 있으면
 * 그것이 다음 400 후보다.
 */
const f = <T,>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> =>
  ({ value, source, confidence: 1 }) as ProvenanceField<T>;

const image = (over: Partial<CanonicalProductImage> & { id: string; originalUrl: string }): CanonicalProductImage =>
  ({
    selectedVariant: "ORIGINAL",
    isRepresentative: false,
    useInProductGallery: true,
    useInDescription: true,
    classification: "PRODUCT",
    ...over,
  }) as CanonicalProductImage;

/** 실측된 Magro Long Sleeve. */
function magro(): CanonicalProduct {
  const base = {
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Magro_Long_Sleeve/descpageMASGT-STMMLS.html",
    title: f("Sergio Tacchini Men's Magro Long Sleeve"),
    brand: f("Sergio Tacchini"),
    price: f({ amount: 120, currency: "USD" }),
    priceValidity: "VALID",
    sku: f("STMMLSWH1"),
    modelName: f("STMMLS", "USER_EDITED"),
    material: f("96% Polyester, 4% Elastane"),
    color: f("Brilliant White"),
    description: f("Content: 96% Polyester, 4% Elastane\nColors: Brilliant White"),
    descriptionKo: f("경량 테니스 긴팔 상의."),
    careInstructions: resolveCareInstructions(null),
    countryOfOrigin: f("Vietnam"),
    titleKo: f("세르지오 타키니 남성 마그로 긴팔"),
    keywords: f([]), seoTitle: f(""), seoDescription: f(""),
    manufacturer: f(""), recommendedAge: f(""), returnPolicy: f(""),
    weight: f(""), certification: f(""), certificationType: f(""),
    importer: f(""), itemName: f(""), childCertification: f(null),
    options: f(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["S", "M", "L", "XL", "XXL"] }],
    variants: [
      { id: "STMMLSWH1", optionValues: { 사이즈: "S" }, stockQuantity: 1, sku: "STMMLSWH1" },
      { id: "STMMLSWH2", optionValues: { 사이즈: "M" }, stockQuantity: 4, sku: "STMMLSWH2" },
      { id: "STMMLSWH3", optionValues: { 사이즈: "L" }, stockQuantity: 2, sku: "STMMLSWH3" },
      { id: "STMMLSWH4", optionValues: { 사이즈: "XL" }, stockQuantity: 3, sku: "STMMLSWH4" },
      { id: "STMMLSWH5", optionValues: { 사이즈: "XXL" }, stockQuantity: 1, sku: "STMMLSWH5" },
    ],
    images: [
      image({ id: "r", originalUrl: "https://img.example/1.jpg", isRepresentative: true }),
      image({ id: "a", originalUrl: "https://img.example/2.jpg" }),
    ],
    shippingFee: f(0, "DEFAULT"),
    stockQuantity: f(11),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
  return {
    ...base,
    ...planProductBulkReference(base).next,
    manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
  } as unknown as CanonicalProduct;
}

/** 🔴 셀러 설정을 «전부» 채운다 — 그래서 남는 공백은 전부 배선 결함이다. */
const FULL_SELLER = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041,
  categoryRequiresChildCertification: false,
  returnCompaniesFetchFailed: false,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  originAreaContent: "Vietnam",
  originAreaRequiresImporter: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
} as const;

function build() {
  const product = magro();
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product, listing, ...FULL_SELLER } as never);
  const validation = validateNaverPayload(payload, { product, ...FULL_SELLER } as never, false);
  return { payload, validation };
}

/** payload 를 점 경로로 읽는다. */
function at(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur == null) return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

const nonEmpty = (v: unknown): boolean => {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return true;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return Boolean(v);
};

describe("🔴 검증이 READY 라고 말한 필드는 payload 에 «실제 값» 이 있다", () => {
  const { payload, validation } = build();

  it("설정을 전부 채우면 막는 항목이 0건이다 — 대조군", () => {
    expect(validation.fields.filter((x) => x.status !== "READY" && !x.optional).map((x) => x.field)).toEqual([]);
  });

  /**
   * 🔴 검증 필드 → 실제 payload 경로. 이 표가 이 테스트의 전부다.
   * 같은 유형의 결함이 생기면 여기서 빈 값으로 드러난다.
   */
  const SENT_PATH: Record<string, string> = {
    "originProduct.leafCategoryId": "originProduct.leafCategoryId",
    "originProduct.name": "originProduct.name",
    "originProduct.detailContent": "originProduct.detailContent",
    "originProduct.salePrice": "originProduct.salePrice",
    "originProduct.stockQuantity": "originProduct.stockQuantity",
    "originProduct.images.representativeImage": "originProduct.images.representativeImage.url",
    "deliveryInfo.deliveryCompany": "originProduct.deliveryInfo.deliveryCompany",
    /* 🔴 `claimDeliveryInfo` 는 최상위가 «아니다» — `deliveryInfo` 안에 있다
       (types.ts 의 NaverDeliveryInfo). 처음에 최상위로 적었다가 이 테스트가
       「4건 누락」이라고 말했고, 확인해 보니 제품이 아니라 이 표가 틀렸다.
       🔴 가드가 무언가를 잡으면 «제품 결함이라고 단정하기 전에» 경로부터 본다. */
    "claimDeliveryInfo.shippingAddressId": "originProduct.deliveryInfo.claimDeliveryInfo.shippingAddressId",
    "claimDeliveryInfo.returnAddressId": "originProduct.deliveryInfo.claimDeliveryInfo.returnAddressId",
    "claimDeliveryInfo.returnDeliveryFee": "originProduct.deliveryInfo.claimDeliveryInfo.returnDeliveryFee",
    "claimDeliveryInfo.exchangeDeliveryFee": "originProduct.deliveryInfo.claimDeliveryInfo.exchangeDeliveryFee",
    "detailAttribute.originAreaInfo.originAreaCode":
      "originProduct.detailAttribute.originAreaInfo.originAreaCode",
    "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber":
      "originProduct.detailAttribute.afterServiceInfo.afterServiceTelephoneNumber",
    "productInfoProvidedNotice(WEAR).material":
      "originProduct.detailAttribute.productInfoProvidedNotice.wear.material",
    "productInfoProvidedNotice(WEAR).color":
      "originProduct.detailAttribute.productInfoProvidedNotice.wear.color",
    "productInfoProvidedNotice(WEAR).manufacturer":
      "originProduct.detailAttribute.productInfoProvidedNotice.wear.manufacturer",
    "productInfoProvidedNotice(WEAR).caution":
      "originProduct.detailAttribute.productInfoProvidedNotice.wear.caution",
    "productInfoProvidedNotice(WEAR).warrantyPolicy":
      "originProduct.detailAttribute.productInfoProvidedNotice.wear.warrantyPolicy",
    "productInfoProvidedNotice(WEAR).afterServiceDirector":
      "originProduct.detailAttribute.productInfoProvidedNotice.wear.afterServiceDirector",
  };

  it("🔴 표에 있는 READY 필드가 전부 payload 에 실려 있다", () => {
    const readyFields = new Set(validation.fields.filter((x) => x.status === "READY").map((x) => x.field));
    const empty: { field: string; path: string; value: unknown }[] = [];
    for (const [field, path] of Object.entries(SENT_PATH)) {
      if (!readyFields.has(field)) continue;
      const value = at(payload, path);
      if (!nonEmpty(value)) empty.push({ field, path, value });
    }
    expect(empty, JSON.stringify(empty, null, 1)).toEqual([]);
  });

  it("🔴 가드가 공허하지 않다 — 표의 필드가 실제로 검증 대상이다", () => {
    const readyFields = new Set(validation.fields.filter((x) => x.status === "READY").map((x) => x.field));
    const covered = Object.keys(SENT_PATH).filter((fieldName) => readyFields.has(fieldName));
    /* 전부 맞지 않아도 된다(카테고리/조건에 따라 서지 않는 필드가 있다) —
       다만 «대부분» 이 실제로 검증되고 있어야 이 테스트가 의미가 있다. */
    expect(covered.length).toBeGreaterThanOrEqual(12);
  });

  it("🔴 옵션 조합의 재고가 payload 에 실측값대로 실린다", () => {
    const combos = at(payload, "originProduct.detailAttribute.optionInfo.optionCombinations") as
      | { stockQuantity?: number }[]
      | undefined;
    expect(combos).toHaveLength(5);
    expect(combos!.map((c) => c.stockQuantity)).toEqual([1, 4, 2, 3, 1]);
  });

  it("🔴 보낼 수 없는 이미지가 payload 에 없다", () => {
    const json = JSON.stringify(payload);
    expect(json).not.toContain("data:image");
    expect(json).not.toContain("blob:");
  });
});
