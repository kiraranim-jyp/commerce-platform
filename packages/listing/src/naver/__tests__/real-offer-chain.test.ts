import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, hasRealProductOptions, resolveSizeFromOptions } from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-1 — **추출 결과가 SmartStore `optionInfo` 까지 간다.** (CPO 승인 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 역할을 가른다 (CPO 지시) ────────────────────────────────────────────
 *   option-name-contract.test.ts       옵션 «개수별» 매핑 규칙 (손으로 만든 모양)
 *   crawler real-html-offer-extraction 실제 HTML → optionGroups  (실측 입력)
 *   🔴 이 파일                          그 «실측 결과 모양» → optionInfo
 *
 * ── 🔴 아래 입력은 지어낸 값이 아니다 ─────────────────────────────────────
 * `packages/crawler/src/__tests__/real-html-offer-extraction.test.ts` 가 실제
 * 저장된 186KB HTML 을 추출기에 통과시켜 **단정한 바로 그 값** 이다
 * (사이즈 5 · variants 5 · SKU `STMMLSWH1..5` · 재고 1/4/2/3/1).
 *
 * 🔴 그래서 추출 결과가 바뀌면 **그 파일이 먼저 깨진다** — 이 파일이 조용히
 * 낡은 모양을 검증하고 있을 수 없다. 패키지 경계(listing 은 crawler 에 의존하지
 * 않는다) 때문에 값을 직접 import 할 수 없어서, 그 보증을 이 주석과 두 파일의
 * 단정으로 묶어 둔다.
 *
 * ── 이 파일이 막는 것 ─────────────────────────────────────────────────────
 * P2-3 이 통과했는데도 셀러 화면에 사이즈가 없었다. 그때 끊어질 수 «있었던»
 * 자리가 여기였고(변환은 되는데 payload 에 안 실리는 경우), 그 자리를 실측
 * 모양으로 한 번도 재지 않았다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

/** 🔴 crawler 실측 테스트가 단정한 그 값. */
const EXTRACTED_OPTION_GROUPS = [{ name: "사이즈", values: ["S", "M", "L", "XL", "XXL"] }];
const EXTRACTED_VARIANTS = [
  { id: "STMMLSWH1", sku: "STMMLSWH1", optionValues: { 사이즈: "S" }, stockQuantity: 1 },
  { id: "STMMLSWH2", sku: "STMMLSWH2", optionValues: { 사이즈: "M" }, stockQuantity: 4 },
  { id: "STMMLSWH3", sku: "STMMLSWH3", optionValues: { 사이즈: "L" }, stockQuantity: 2 },
  { id: "STMMLSWH4", sku: "STMMLSWH4", optionValues: { 사이즈: "XL" }, stockQuantity: 3 },
  { id: "STMMLSWH5", sku: "STMMLSWH5", optionValues: { 사이즈: "XXL" }, stockQuantity: 1 },
];

function makeProduct(over: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://www.tennis-warehouse.com/x/descpageMASGT-STMMLS.html?color=WH",
    title: field("Sergio Tacchini Men's Magro Long Sleeve"),
    brand: field("Sergio Tacchini"),
    price: field({ amount: 120, currency: "USD" }),
    priceValidity: "VALID",
    sku: field("STMMLSWH1"),
    description: field("Magro Long Sleeve"),
    material: field("폴리에스터 100%"),
    color: field("White"),
    recommendedAge: field(""),
    manufacturer: field("Sergio Tacchini"),
    careInstructions: field("찬물 세탁"),
    options: field([]),
    optionGroups: EXTRACTED_OPTION_GROUPS,
    variants: EXTRACTED_VARIANTS,
    images: [
      {
        id: "img-1",
        originalUrl: "https://img.tennis-warehouse.com/x.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("세르지오 타키니 마그로 긴팔"),
    descriptionKo: field("긴팔 테니스 상의"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("베트남"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(11),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field("긴팔 티셔츠"),
    modelName: field("STF26M51683-050"),
    weight: field(""),
    ...over,
  } as unknown as CanonicalProduct;
}

function payloadFor(product: CanonicalProduct) {
  const listing = {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0]!.originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 200_000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    priceOrigin: "PRODUCT_OVERRIDE",
    options: product.optionGroups.map((g) => g.name),
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  } as unknown as ListingModel;
  return buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: "50000535",
    releaseAddressBookNo: 900000001,
    refundAddressBookNo: 900000002,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    sellerDeliveryFee: null,
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    childCertificationInfoId: null,
    categoryRequiresChildCertification: false,
    originAreaCode: "00",
    originAreaRequiresContent: false,
  } as never);
}

const optionInfoOf = (payload: ReturnType<typeof payloadFor>) =>
  (payload.originProduct.detailAttribute as { optionInfo?: Record<string, unknown> }).optionInfo;

describe("실측 추출 결과 → SmartStore optionInfo", () => {
  const product = makeProduct();

  it("🔴 실측 variants 5개가 «실제 옵션» 으로 인정된다", () => {
    expect(hasRealProductOptions(product as never)).toBe(true);
  });

  it("🔴 optionInfo 가 생략되지 «않는다»", () => {
    const optionInfo = optionInfoOf(payloadFor(product));
    expect(optionInfo).toBeDefined();
  });

  it("축 이름과 다섯 조합이 그대로 실린다", () => {
    const optionInfo = optionInfoOf(payloadFor(product))!;
    expect((optionInfo.optionCombinationGroupNames as { optionGroupName1: string }).optionGroupName1).toBe("사이즈");
    const combos = optionInfo.optionCombinations as { optionName1: string }[];
    expect(combos.map((c) => c.optionName1)).toEqual(["S", "M", "L", "XL", "XXL"]);
  });

  it("🔴 재고가 Offer 별 «실측값» 으로 실린다 — 같은 값으로 뭉개지 않는다", () => {
    const combos = optionInfoOf(payloadFor(product))!.optionCombinations as { stockQuantity: number }[];
    expect(combos.map((c) => c.stockQuantity)).toEqual([1, 4, 2, 3, 1]);
  });

  it("SKU 가 판매자 관리코드로 이어진다", () => {
    const combos = optionInfoOf(payloadFor(product))!.optionCombinations as { sellerManagerCode: string }[];
    expect(combos.map((c) => c.sellerManagerCode)).toEqual([
      "STMMLSWH1",
      "STMMLSWH2",
      "STMMLSWH3",
      "STMMLSWH4",
      "STMMLSWH5",
    ]);
  });

  it("🔴 치수 고시가 같은 「사이즈」 축을 찾는다 — 축 이름이 계약이다", () => {
    expect(resolveSizeFromOptions(product as never)).toBe("S, M, L, XL, XXL");
  });
});

describe("🔴 네 경우 회귀 — 실측 모양을 기준으로", () => {
  it("size-only — 위 전체가 그 경우다(조합 5개 · 축 1개)", () => {
    const optionInfo = optionInfoOf(payloadFor(makeProduct()))!;
    expect(Object.keys(optionInfo.optionCombinationGroupNames as object)).toEqual(["optionGroupName1"]);
  });

  it("color + size — 축 둘이 순서대로 실린다", () => {
    const product = makeProduct({
      optionGroups: [
        { name: "색상", values: ["White", "Navy"] },
        { name: "사이즈", values: ["S", "M"] },
      ],
      variants: [
        { id: "a", sku: "A", optionValues: { 색상: "White", 사이즈: "S" }, stockQuantity: 1 },
        { id: "b", sku: "B", optionValues: { 색상: "Navy", 사이즈: "M" }, stockQuantity: 2 },
      ],
    } as unknown as Partial<CanonicalProduct>);
    const optionInfo = optionInfoOf(payloadFor(product))!;
    const names = optionInfo.optionCombinationGroupNames as Record<string, string>;
    expect(names.optionGroupName1).toBe("색상");
    expect(names.optionGroupName2).toBe("사이즈");
    const combos = optionInfo.optionCombinations as { optionName1: string; optionName2: string }[];
    expect(combos[0]).toMatchObject({ optionName1: "White", optionName2: "S" });
  });

  it("🔴 옵션 순서가 뒤바뀌어도 «그 순서대로» 실린다 — 우리가 재정렬하지 않는다", () => {
    const product = makeProduct({
      optionGroups: [
        { name: "사이즈", values: ["S", "M"] },
        { name: "색상", values: ["White", "Navy"] },
      ],
      variants: [
        { id: "a", sku: "A", optionValues: { 사이즈: "S", 색상: "White" }, stockQuantity: 1 },
        { id: "b", sku: "B", optionValues: { 사이즈: "M", 색상: "Navy" }, stockQuantity: 2 },
      ],
    } as unknown as Partial<CanonicalProduct>);
    const names = optionInfoOf(payloadFor(product))!.optionCombinationGroupNames as Record<string, string>;
    expect(names.optionGroupName1).toBe("사이즈");
    expect(names.optionGroupName2).toBe("색상");
  });

  it("🔴 옵션이 «정말» 없는 상품은 optionInfo 가 생략된 채로 남는다", () => {
    const product = makeProduct({ optionGroups: [], variants: [] } as unknown as Partial<CanonicalProduct>);
    expect(hasRealProductOptions(product as never)).toBe(false);
    expect(optionInfoOf(payloadFor(product))).toBeUndefined();
  });

  it("🔴 그룹은 선언됐는데 variants 가 0이면 «옵션 없음» 이다 — 빈 조합을 보내지 않는다", () => {
    /* 원본 파싱이 절반만 성공한 경우. 빈 optionInfo 를 보내느니 생략한다(N-3.82). */
    const product = makeProduct({ variants: [] } as unknown as Partial<CanonicalProduct>);
    expect(hasRealProductOptions(product as never)).toBe(false);
    expect(optionInfoOf(payloadFor(product))).toBeUndefined();
  });
});
