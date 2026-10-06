import { describe, expect, it } from "vitest";
import type { CanonicalProduct, CanonicalProductImage, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload, resolveSizeFromOptions } from "../naver/build-payload";
import { validateNaverPayload } from "../naver/validate-payload";
import { NAVER_ORIGIN_MANUAL_CODE, resolveNaverOriginArea } from "../naver/origin-match";
import { resolveCommonOrigin } from "../common/origin";
import { resolveCareInstructions } from "../notice/care-instructions";
import { planProductBulkReference } from "../notice/bulk-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-3 E — **성인의류 수집 → readiness → SmartStore payload** (CPO 확정 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 아래 값은 전부 **실제 페이지(STMMLS)에서 측정된 그대로** 다. 지어낸 것이 없다:
 *
 *   상품명/브랜드/가격/SKU   microdata
 *   소재 96% Polyester, 4% Elastane · 색상 Brilliant White   공통 추출기 출력
 *   상세설명 671자            microdata itemprop="description"
 *   사이즈 S·M·L·XL·XXL       schema.org Offer 5행
 *   재고   1·4·2·3·1          같은 Offer 행의 실제 수량
 *   원산지                    🔴 원문에 «없다»
 *
 * 🔴 「4+」와는 다른 경로다 — 여기 수량은 Offer 가 숫자로 적어 둔 값이다.
 *    그 구분을 테스트가 지킨다(아래 ④).
 *
 * ── 🔴 이 파일의 «한계» (A-1 조사, 2026-10-06) ─────────────────────────────
 * 아래 `MEASURED_VARIANTS` 는 **손으로 적은 값** 이다. 이름이 「chain」이지만
 * 체인의 «첫 칸»(실제 HTML → 행 추출)을 건너뛴다. 그 칸은
 * `packages/crawler/.../real-html-offer-extraction.test.ts` 와
 * `naver/__tests__/real-offer-chain.test.ts` 가 맡는다.
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

/** 실측된 사이즈·재고·SKU 5행. */
const MEASURED_VARIANTS = [
  { optionValues: { 사이즈: "S" }, stockQuantity: 1, sku: "STMMLSWH1" },
  { optionValues: { 사이즈: "M" }, stockQuantity: 4, sku: "STMMLSWH2" },
  { optionValues: { 사이즈: "L" }, stockQuantity: 2, sku: "STMMLSWH3" },
  { optionValues: { 사이즈: "XL" }, stockQuantity: 3, sku: "STMMLSWH4" },
  { optionValues: { 사이즈: "XXL" }, stockQuantity: 1, sku: "STMMLSWH5" },
];

const MEASURED_DESCRIPTION =
  "Overview\nKey Features\nMoisture Wicking\n\nThis Sergio Tacchini Men's Magro Long Sleeve has sporty style for " +
  "chilly court days.\n\nContent: 96% Polyester, 4% Elastane\nCrewneck\nColors: Brilliant White\n";

function magro(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
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
    description: f(MEASURED_DESCRIPTION),
    careInstructions: resolveCareInstructions(null),
    /* 🔴 원문에 없다. 비운다 — resolver 사다리가 답할 자리다. */
    countryOfOrigin: f(""),
    titleKo: f(""), descriptionKo: f(""), keywords: f([]),
    seoTitle: f(""), seoDescription: f(""),
    manufacturer: f(""), recommendedAge: f(""), returnPolicy: f(""),
    weight: f(""), certification: f(""), certificationType: f(""),
    importer: f(""), itemName: f(""), childCertification: f(null),
    options: f(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["S", "M", "L", "XL", "XXL"] }],
    variants: MEASURED_VARIANTS,
    images: [
      image({ id: "r", originalUrl: "https://img.example/1.jpg", isRepresentative: true }),
      image({ id: "a", originalUrl: "https://img.example/2.jpg" }),
      image({ id: "b", originalUrl: "https://img.example/3.jpg" }),
      image({ id: "c", originalUrl: "https://img.example/4.jpg" }),
      image({ id: "d", originalUrl: "https://img.example/5.jpg" }),
    ],
    shippingFee: f(0, "DEFAULT"),
    stockQuantity: f(11),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...overrides,
  } as unknown as CanonicalProduct;
  return {
    ...base,
    ...planProductBulkReference(base).next,
    manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
  } as unknown as CanonicalProduct;
}

const AREAS = [
  { code: "00", name: "국산" },
  { code: "0200037", name: "수입산>아시아>베트남" },
  { code: NAVER_ORIGIN_MANUAL_CODE, name: "기타(직접입력)" },
] as never[];

const SELLER = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: 1, refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null, returnDeliveryFee: 3000, exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041,
  /* 🔴 성인의류 — KC 비적용. 이 플래그 하나가 KIDS/WEAR 를 가른다. */
  categoryRequiresChildCertification: false,
  returnCompaniesFetchFailed: false,
  deliveryCompany: "CJGLS", warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터", afterServiceTelephoneNumber: "02-000-0000",
} as const;

/** 등록 라우트와 같은 순서(resolve-context → register/route). */
function chain(product: CanonicalProduct, origin: { brandDefault?: string; sellerDefault?: string } = {}) {
  const common = resolveCommonOrigin({
    product: { value: product.countryOfOrigin.value },
    brandDefault: origin.brandDefault,
    sellerDefault: origin.sellerDefault,
  } as never);
  const match = resolveNaverOriginArea(common.value, AREAS);
  const ctx = {
    ...SELLER,
    originAreaCode: match.code,
    originAreaRequiresContent: match.status === "OTHER_MANUAL",
    originAreaContent: common.value,
    originAreaRequiresImporter: match.requiresImporter,
  };
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product, listing, ...ctx } as never);
  const validation = validateNaverPayload(payload, { product, ...ctx } as never, false);
  const p = payload as never as {
    originProduct: {
      stockQuantity?: number;
      detailAttribute?: {
        originAreaInfo?: { originAreaCode?: string; content?: string };
        optionInfo?: { optionCombinations?: { stockQuantity?: number }[] };
        productInfoProvidedNotice?: { productInfoProvidedNoticeType?: string; wear?: Record<string, string> };
      };
    };
  };
  return {
    resolvedOrigin: common.value,
    payload,
    sentCode: p.originProduct.detailAttribute?.originAreaInfo?.originAreaCode,
    sentContent: p.originProduct.detailAttribute?.originAreaInfo?.content,
    combos: p.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [],
    noticeType: p.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
    blocked: validation.fields.filter((x) => x.status !== "READY" && !x.optional).map((x) => x.field),
  };
}

describe("① 🔴 원산지가 어디에도 없으면 — 「원산지 직접입력」으로 막는다 (CPO ⑦)", () => {
  const r = chain(magro());
  it("코드가 만들어지지 않고 기존 항목이 막는다", () => {
    expect(r.resolvedOrigin).toBeNull();
    expect(r.sentCode).toBeUndefined();
    expect(r.blocked).toContain("detailAttribute.originAreaInfo.originAreaCode");
  });
  it("🔴 국가를 지어내지 않았다", () => {
    expect(JSON.stringify(r.payload)).not.toContain("Vietnam");
    expect(JSON.stringify(r.payload)).not.toContain("China");
  });
});

describe("② 🔴 브랜드 기본값이 있으면 — payload 까지 «연결된다» (CPO ⑥)", () => {
  it("목록에 있는 국가면 코드로 간다", () => {
    const r = chain(magro(), { brandDefault: "Vietnam" });
    expect(r.resolvedOrigin).toBe("Vietnam");
    expect(r.sentCode).toBe("0200037");
    expect(r.blocked).not.toContain("detailAttribute.originAreaInfo.originAreaCode");
  });

  it("🔴 목록에 없는 말이어도 content 로 실린다 — 버려지지 않는다", () => {
    const r = chain(magro(), { brandDefault: "Made in EU" });
    expect(r.sentCode).toBe(NAVER_ORIGIN_MANUAL_CODE);
    expect(r.sentContent).toBe("Made in EU");
    expect(r.blocked).not.toContain("detailAttribute.originAreaInfo.content");
  });

  it("🔴 브랜드가 판매자보다 «먼저» 다 — 기존 사다리 순서 그대로", () => {
    const r = chain(magro(), { brandDefault: "Italy", sellerDefault: "Vietnam" });
    expect(r.resolvedOrigin).toBe("Italy");
  });

  it("브랜드가 없으면 판매자 기본값이 답한다", () => {
    const r = chain(magro(), { sellerDefault: "Vietnam" });
    expect(r.resolvedOrigin).toBe("Vietnam");
    expect(r.sentCode).toBe("0200037");
  });
});

describe("③ 🔴 사이즈 5개가 payload 까지 간다", () => {
  const r = chain(magro(), { brandDefault: "Vietnam" });
  it("옵션 조합이 5건이다", () => {
    expect(r.combos).toHaveLength(5);
  });
  it("🔴 재고가 실측값 그대로 실린다 — 1·4·2·3·1", () => {
    expect(r.combos.map((c) => c.stockQuantity)).toEqual([1, 4, 2, 3, 1]);
  });
  it("치수 고시가 사이즈 그룹에서 채워진다 — 축 이름이 계약이다", () => {
    expect(resolveSizeFromOptions(magro() as never)).toBe("S, M, L, XL, XXL");
  });
  it("빈 옵션값 가드가 서지 않는다", () => {
    expect(r.blocked).not.toContain("detailAttribute.optionInfo.optionCombinations[].optionName");
  });
});

describe("④ 🔴 「4+」 경로와 섞이지 않는다", () => {
  it("수량을 «모르는» 옵션은 여전히 null 로 남고 4 가 되지 않는다", () => {
    const unknown = magro({
      variants: [
        { optionValues: { 사이즈: "S" }, stockQuantity: 1, sku: "a" },
        { optionValues: { 사이즈: "M" }, stockQuantity: null, sku: "b" },
      ],
    } as never);
    expect(JSON.stringify(unknown.variants)).not.toContain('"stockQuantity":4');
  });
});

describe("⑤ 🔴 성인의류 — KC 가 적용되지 않는다 (CPO D·KC)", () => {
  const r = chain(magro(), { brandDefault: "Vietnam" });
  it("고시 유형이 WEAR 다", () => {
    expect(r.noticeType).toBe("WEAR");
  });
  it("🔴 아동 전용 칸이 payload 에 새지 않는다", () => {
    expect(JSON.stringify(r.payload)).not.toContain('"kids"');
  });
  it("🔴 KC 사유로 막히지 않는다", () => {
    for (const field of r.blocked) {
      expect(field).not.toContain("productCertificationInfos");
      expect(field).not.toContain("certificationTargetExcludeContent");
    }
  });
});

describe("⑥ 🔴 최종 — 원산지만 채우면 막는 항목이 0건이다", () => {
  it("브랜드 기본 원산지가 있는 상태에서 차단 0", () => {
    const r = chain(magro(), { brandDefault: "Vietnam" });
    expect(r.blocked).toEqual([]);
  });
});
