import { describe, expect, it } from "vitest";
import type { CanonicalProduct, CanonicalProductImage, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";
import { NAVER_ORIGIN_MANUAL_CODE, resolveNaverOriginArea } from "../origin-match";
import { resolveCommonOrigin } from "../../common/origin";
import { resolveCareInstructions } from "../../notice/care-instructions";
import { planProductBulkReference } from "../../notice/bulk-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-1 A — **「사전 readiness 가 실제 채널 API 보다 «먼저» 말한다」** (CPO 지시 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 사고: 실제 스마트스토어 등록이 `originProduct.detailAttribute.originAreaInfo
 * .content` 직접입력을 요구하며 **400** 으로 떨어졌는데, 우리 사전 검증은 **0 blocker**
 * 였다. 「등록 가능」이라고 말한 화면이 틀렸다 — 이 저장소에서 가장 비싼 종류의 거짓말이다.
 *
 * 원인은 둘이고 서로 «독립» 이다:
 *
 *   결함 ①  원산지 텍스트가 네이버 535개 목록에 없으면 코드가 `04`(기타/직접입력)로
 *           떨어진다. 그 코드는 content 가 스펙상 «필수» 인데, 검증은
 *           `originAreaCode !== null` 하나만 봤다 — `"04"` 도 null 이 아니라 READY.
 *   결함 ②  content 를 `product.countryOfOrigin.value` «하나만» 읽었다. 그런데 코드를
 *           만든 텍스트는 상품 → 브랜드 → 판매자 사다리의 결과다(resolve-context.ts).
 *           브랜드/판매자 기본값에서 왔으면 **우리가 값을 아는데도** 비어 나갔다.
 *
 * 🔴 고치는 방향에서 «국가를 추측하지 않는다». 값이 있으면 그 값을 싣고, 없으면 막는다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}
function image(over: Partial<CanonicalProductImage> & { id: string; originalUrl: string }): CanonicalProductImage {
  return {
    selectedVariant: "ORIGINAL",
    isRepresentative: false,
    useInProductGallery: true,
    useInDescription: true,
    classification: "PRODUCT",
    ...over,
  } as CanonicalProductImage;
}

/** 네이버 원산지 목록의 «모양» — 실측 535개 중 이 판정에 필요한 형태만 둔다. */
const AREAS = [
  { code: "00", name: "국산" },
  { code: "0200037", name: "수입산>아시아>베트남" },
  { code: NAVER_ORIGIN_MANUAL_CODE, name: "기타(직접입력)" },
] as never[];

/** 지정 상품(Sergio Tacchini) — 🔴 원본 페이지에 원산지가 «없다»(CEO 확인). */
function product(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  const base = {
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Trattino_Polo/descpageMASGT-STMFTP.html",
    title: field("Sergio Tacchini Men's Trattino Polo"),
    brand: field("Sergio Tacchini"),
    price: field({ amount: 68, currency: "USD" }),
    priceValidity: "VALID",
    sku: field("STMFTP-BL"),
    modelName: field("STF26M51684-050"),
    material: field("65% Cotton, 30% Polyester, 5% Elastane"),
    color: field("Blue"),
    careInstructions: resolveCareInstructions(null),
    description: field(""), manufacturer: field(""), countryOfOrigin: field(""),
    recommendedAge: field(""), returnPolicy: field(""), weight: field(""),
    certification: field(""), certificationType: field(""), importer: field(""),
    itemName: field(""), childCertification: field(null),
    titleKo: field(""), descriptionKo: field(""), keywords: field([]),
    seoTitle: field(""), seoDescription: field(""),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["S", "M", "L"] }],
    variants: [
      { optionValues: { Size: "S" }, stockQuantity: 3, sku: "STMFTP-BL-S" },
      { optionValues: { Size: "M" }, stockQuantity: null, sku: "STMFTP-BL-M" },
      { optionValues: { Size: "L" }, stockQuantity: 3, sku: "STMFTP-BL-L" },
    ],
    images: [image({ id: "rep", originalUrl: "https://cdn.example/rep.jpg", isRepresentative: true })],
    shippingFee: field(0, "DEFAULT"), stockQuantity: field(6),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...overrides,
  } as unknown as CanonicalProduct;
  /* 빈 고시칸은 기존 규칙(전체 적용 + 제조사 개별 참조)으로 닫는다 — 원산지 축만 재기 위해서다. */
  return {
    ...base,
    ...planProductBulkReference(base).next,
    manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
  } as unknown as CanonicalProduct;
}

const SELLER = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: 1, refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null, returnDeliveryFee: 3000, exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041, categoryRequiresChildCertification: false,
  returnCompaniesFetchFailed: false,
  deliveryCompany: "CJGLS", warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터", afterServiceTelephoneNumber: "02-000-0000",
} as const;

/**
 * 등록 라우트와 «같은 순서» 로 조립한다(resolve-context.ts:157-179 → register/route.ts:566-569).
 *
 * 🔴 `wireContent: false` 는 「호출부가 배선을 빼먹은」 상태를 모사한다. 그 경우에도
 * 막혀야 한다 — 그것이 플래그를 새로 받지 않고 payload 를 보고 판정한 이유다.
 */
function registerLike(
  p: CanonicalProduct,
  opts: { brandDefault?: string; sellerDefault?: string; wireContent?: boolean } = {},
) {
  const commonOrigin = resolveCommonOrigin({
    product: { value: p.countryOfOrigin.value },
    brandDefault: opts.brandDefault,
    sellerDefault: opts.sellerDefault,
  } as never);
  const match = resolveNaverOriginArea(commonOrigin.value, AREAS);
  const ctx = {
    ...SELLER,
    originAreaCode: match.code,
    originAreaRequiresContent: match.status === "OTHER_MANUAL",
    originAreaContent: opts.wireContent === false ? undefined : commonOrigin.value,
    originAreaRequiresImporter: match.requiresImporter,
  };
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(p, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product: p, listing, ...ctx } as never);
  const validation = validateNaverPayload(payload, { product: p, ...ctx } as never, false);
  const sent = (payload as never as {
    originProduct: { detailAttribute?: { originAreaInfo?: { originAreaCode?: string; content?: string } } };
  }).originProduct.detailAttribute?.originAreaInfo;
  return {
    resolvedText: commonOrigin.value,
    status: match.status,
    sentCode: sent?.originAreaCode,
    sentContent: sent?.content,
    blocked: validation.fields.filter((f) => f.status !== "READY" && !f.optional).map((f) => f.field),
  };
}

const CONTENT_FIELD = "detailAttribute.originAreaInfo.content";
const CODE_FIELD = "detailAttribute.originAreaInfo.originAreaCode";

describe("① origin 있고 «매칭되면» — 코드로 가고 content 를 보내지 않는다", () => {
  it("상품 원문에 국가가 있으면 그 코드로 등록된다", () => {
    const r = registerLike(product({ countryOfOrigin: field("Vietnam") } as never));
    expect(r.status).toBe("MATCHED");
    expect(r.sentCode).toBe("0200037");
    /* 🔴 매칭됐으면 content 는 보내지 않는다 — 코드가 이미 원산지를 말한다. */
    expect(r.sentContent).toBeUndefined();
    expect(r.blocked).not.toContain(CONTENT_FIELD);
  });
});

describe("② 🔴 origin 없음 → readiness 가 막는다 (API 호출 전)", () => {
  it("상품·브랜드·판매자 어디에도 없으면 기존 항목이 막는다", () => {
    const r = registerLike(product());
    expect(r.status).toBe("NO_INPUT");
    expect(r.sentCode).toBeUndefined();
    expect(r.blocked).toContain(CODE_FIELD);
  });

  it("🔴 공백뿐인 값을 원산지로 «인정하지 않는다»", () => {
    const r = registerLike(product(), { sellerDefault: "   " });
    expect(r.blocked.length).toBeGreaterThan(0);
    expect(r.blocked.some((f) => f === CODE_FIELD || f === CONTENT_FIELD)).toBe(true);
  });
});

describe("③ 🔴 API 400 예상조건 — 「04 + content 없음」을 등록 «전에» 막는다", () => {
  it("호출부가 content 배선을 빼먹어도 막힌다 — payload 를 보고 판정한다", () => {
    /* 이것이 핵심 계약이다. route.ts:556 의 P0-KC-12 주석이 「호출부 하나가
       빼먹어서 400 이 났다」는 같은 사고를 이미 기록하고 있다 — 그 재발을 구조로 막는다. */
    const r = registerLike(product(), { sellerDefault: "Imported", wireContent: false });
    expect(r.sentCode).toBe(NAVER_ORIGIN_MANUAL_CODE);
    expect(r.sentContent).toBeUndefined();
    expect(r.blocked).toContain(CONTENT_FIELD);
  });

  it("🔴 막을 때 국가를 «지어내지» 않는다 — 셀러가 채울 일로 남긴다", () => {
    const r = registerLike(product(), { sellerDefault: "Imported", wireContent: false });
    /* payload 에 임의 국가명이 끼어들지 않았다. */
    expect(r.sentContent).toBeUndefined();
    expect(r.resolvedText).toBe("Imported");
  });
});

describe("④ 🔴 결함 ② — 사다리가 찾은 값은 «버려지지 않는다»", () => {
  it("판매자 기본 원산지가 목록에 없는 말이어도 content 로 실린다", () => {
    const r = registerLike(product(), { sellerDefault: "Imported" });
    expect(r.sentCode).toBe(NAVER_ORIGIN_MANUAL_CODE);
    expect(r.sentContent).toBe("Imported");
    expect(r.blocked).not.toContain(CONTENT_FIELD);
  });

  it("브랜드 기본 원산지도 같다 — 상품 원문이 비어 있어도 버리지 않는다", () => {
    const r = registerLike(product(), { brandDefault: "Made in EU" });
    expect(r.resolvedText).toBe("Made in EU");
    expect(r.sentCode).toBe(NAVER_ORIGIN_MANUAL_CODE);
    expect(r.sentContent).toBe("Made in EU");
    expect(r.blocked).not.toContain(CONTENT_FIELD);
  });

  it("🔴 상품 원문이 있으면 그것이 이긴다 — 사다리 순서를 바꾸지 않았다", () => {
    const r = registerLike(product({ countryOfOrigin: field("Imported from Italy") } as never), {
      sellerDefault: "Imported",
    });
    expect(r.sentContent).toBe("Imported from Italy");
  });
});

describe("⑤ 🔴 「04 ⇒ content 필수」를 문자열로 두 번 적지 않는다", () => {
  it("코드 상수가 매칭 결과와 같다", () => {
    expect(resolveNaverOriginArea("완전히 없는 나라 이름", AREAS).code).toBe(NAVER_ORIGIN_MANUAL_CODE);
  });
});
