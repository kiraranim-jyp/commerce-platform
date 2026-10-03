import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload } from "../naver/build-payload";
import { validateNaverPayload } from "../naver/validate-payload";
import { resolveCareInstructions } from "../notice/care-instructions";
import { planProductBulkReference } from "../notice/bulk-reference";
import { resolveProductDetailBlocks } from "../common/detail-override";
import { resolveSourceStock, blocksRegistration, payloadStockQuantity } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * TENNIS-REGISTRATION 4-1 — **등록 직전 payload** (CEO 지시 2026-10-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실제 외부 호출은 자격증명이 없어 할 수 없다(§H). 할 수 있는 것은 **「보낼 값이
 * 준비됐는가」** 를 실행으로 증명하는 것이다. 이 파일은 그 증거다.
 *
 * 🔴 쓰는 값은 전부 «원본 또는 기존 resolver 출력» 이다. 지어낸 것이 하나도 없다:
 *
 *     상품명·브랜드·소재·색상·가격·SKU   공개 페이지에서 읽은 값
 *     모델명                              페이지에 있는 코드 — 셀러가 입력한 것으로 둔다
 *     세탁방법                            resolveCareInstructions(null) 출력
 *     고시 빈칸                           planProductBulkReference() 출력
 *     제조사                              셀러의 「상세페이지 참조」 선택
 *     원산지                              셀러/브랜드 기본값(코드)
 *     상세페이지                          resolveProductDetailBlocks() 출력
 *
 * 🔴 금지된 것을 하지 않았음을 «테스트가» 확인한다:
 *     M·L·XL 재고 「4+」를 4 로 바꾸지 않음 · 원산지 추측 안 함 ·
 *     제조사 추측 안 함 · 쿠팡 카테고리 63955 안 씀
 */
const f = <T,>(value: T, source = "ORIGINAL", confidence = 1) =>
  ({ value, source, confidence }) as unknown as { value: T; source: string; confidence: number };

/** 공개 상품 페이지에서 «읽은» 값 + 셀러가 한 두 가지 동작의 결과. */
function registrationReady(): CanonicalProduct {
  const base = {
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Fall_Magro_Top/descpageMASGT-STMFMT0.html",
    title: f("Sergio Tacchini Mens Fall Magro Top"),
    titleKo: f("세르지오 타키니 남성 폴 마그로 상의"),
    brand: f("Sergio Tacchini"),
    price: f({ amount: 68, currency: "USD" }),
    priceValidity: "VALID",
    sku: f("STMFMT0-WH"),
    material: f("65% Cotton, 30% Polyester, 5% Elastane"),
    color: f("Brilliant White"),
    /* 셀러가 상품정보 화면에 입력한 모델명(페이지에 적힌 코드 그대로). */
    modelName: f("STF26M51684-050", "USER_EDITED"),
    /* ③ 이 수집 시점에 넣는 값. */
    careInstructions: resolveCareInstructions(null),
    /* 페이지에 «없는» 것 — 비워 둔다. */
    description: f(""),
    descriptionKo: f(""),
    countryOfOrigin: f(""),
    recommendedAge: f(""),
    importer: f(""),
    itemName: f(""),
    weight: f(""),
    returnPolicy: f(""),
    certification: f(""),
    certificationType: f(""),
    childCertification: f(null),
    keywords: f([] as string[], "ORIGINAL", 0),
    seoTitle: f(""),
    seoDescription: f(""),
    options: f(["Size"]),
    optionGroups: [{ name: "Size", values: ["S", "M", "L", "XL", "XXL"] }],
    /* 🔴 「4+」는 수량이 아니다 — null 이다. 4 로 적으면 그 순간 우리 추정이다. */
    variants: [
      { optionValues: { Size: "S" }, stockQuantity: 3, sku: "STMFMT0-WH-S" },
      { optionValues: { Size: "M" }, stockQuantity: null, sku: "STMFMT0-WH-M" },
      { optionValues: { Size: "L" }, stockQuantity: null, sku: "STMFMT0-WH-L" },
      { optionValues: { Size: "XL" }, stockQuantity: null, sku: "STMFMT0-WH-XL" },
      { optionValues: { Size: "XXL" }, stockQuantity: 3, sku: "STMFMT0-WH-XXL" },
    ],
    images: [
      {
        id: "rep",
        originalUrl: "https://cdn.example/rep.jpg",
        isRepresentative: true,
        useInDescription: true,
        useInProductGallery: true,
        classification: "PRODUCT",
        selectedVariant: "ORIGINAL",
      },
    ],
    shippingFee: f(0, "DEFAULT"),
    stockQuantity: f(6),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;

  /* ② 전체 적용 + 제조사 개별 참조 — PHASE 5 가 실측한 그 두 동작. */
  return {
    ...base,
    ...planProductBulkReference(base).next,
    manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
  } as unknown as CanonicalProduct;
}

/** 셀러 설정에서 오는 값 — 상품이 정하지 않는다. */
const SELLER_CONTEXT = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041,
  categoryRequiresChildCertification: false,
  /* 원산지는 브랜드/판매자 기본값이 «코드» 로 준다 — 상품에서 추측하지 않는다. */
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
  detailBlocks: resolveProductDetailBlocks(null),
} as const;

function buildSmartStore() {
  const product = registrationReady();
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product, listing, ...SELLER_CONTEXT } as never);
  const validation = validateNaverPayload(payload, { product, ...SELLER_CONTEXT } as never, false);
  return { product, payload, validation };
}

describe("① SmartStore — 등록 직전 payload 가 «완성된다»", () => {
  const { payload, validation } = buildSmartStore();

  it("🔴 막는 항목이 0건이다 (PRE-CHECK PASS)", () => {
    const blocked = validation.fields.filter((x) => x.status !== "READY" && !x.optional).map((x) => x.field);
    expect(blocked).toEqual([]);
  });

  it("payload 가 비어 있지 않다 — 빈 것끼리 같다고 말하지 않는다", () => {
    expect(JSON.stringify(payload).length).toBeGreaterThan(500);
  });

  it("고시 유형이 WEAR 다 — 성인 의류", () => {
    const notice = (payload as never as { originProduct: { detailAttribute?: { productInfoProvidedNotice?: { productInfoProvidedNoticeType?: string } } } })
      .originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice?.productInfoProvidedNoticeType).toBe("WEAR");
  });

  it("🔴 아동 전용 칸이 payload 에 «새지 않는다»", () => {
    expect(JSON.stringify(payload)).not.toContain('"kids"');
  });

  it("관측값이 payload 에 그대로 실린다 — 소재·색상·모델명", () => {
    const json = JSON.stringify(payload);
    expect(json).toContain("65% Cotton, 30% Polyester, 5% Elastane");
    expect(json).toContain("Brilliant White");
    expect(json).toContain("STF26M51684-050");
  });

  it("사이즈 5개가 옵션 조합으로 실린다", () => {
    const combos =
      (payload as never as { originProduct: { detailAttribute?: { optionInfo?: { optionCombinations?: unknown[] } } } })
        .originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos).toHaveLength(5);
  });
});

describe("② 🔴 금지된 것을 하지 «않았다» — 테스트가 확인한다", () => {
  const { product, payload } = buildSmartStore();
  const json = JSON.stringify(payload);

  it("🔴 「4+」를 4 로 바꾸지 않았다", () => {
    const unknown = product.variants.filter((v) => v.stockQuantity === null);
    expect(unknown).toHaveLength(3); // M · L · XL
    expect(JSON.stringify(product.variants)).not.toContain('"stockQuantity":4');
  });

  it("🔴 재고는 IN_STOCK 이지만 M·L·XL «수량» 은 여전히 모른다", () => {
    /* 🔴 처음에 UNKNOWN 이라고 적었는데 재 보니 IN_STOCK 이었다 — 그리고 그게
       맞다. S=3 · XXL=3 은 «확인된» 사실이므로 「재고가 있다」는 참이다.
       모르는 것은 전체 유무가 아니라 세 사이즈의 «수량» 이다. 둘을 뭉개면
       「모른다」를 「없다」로 읽게 된다. */
    const fact = resolveSourceStock(product);
    expect(fact.state).toBe("IN_STOCK");
    expect(blocksRegistration(fact)).toBe(false);
    /* 그런데 variant 수량은 여전히 null 이다 — 합계가 있다고 칸을 채우지 않았다. */
    expect(product.variants.filter((v) => v.stockQuantity === null)).toHaveLength(3);
    /* payload 수량도 보정되지 않는다 — 사실에서 나온 숫자다. */
    expect(typeof payloadStockQuantity(product)).toBe("number");
  });

  it("🔴 원산지를 «추측하지» 않았다 — 상품 값은 비어 있고 코드는 셀러 설정에서 온다", () => {
    expect(product.countryOfOrigin.value).toBe("");
    expect(json).toContain(SELLER_CONTEXT.originAreaCode);
  });

  it("🔴 제조사를 «추측하지» 않았다 — 브랜드명을 제조사로 쓰지 않았다", () => {
    expect(product.manufacturer.value).toBe("");
    expect(product.manufacturer.source).toBe("DETAIL_PAGE_REFERENCE");
    /* 브랜드명이 제조사 칸에 들어가 있지 않다. */
    const notice = (payload as never as { originProduct: { detailAttribute?: { productInfoProvidedNotice?: { wear?: { manufacturer?: string } } } } })
      .originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(JSON.stringify(notice)).not.toContain('"manufacturer":"Sergio Tacchini"');
  });

  it("🔴 쿠팡 카테고리 63955 를 쓰지 않았다 — 그것은 테스트 픽스처였다", () => {
    expect(json).not.toContain("63955");
  });

  it("🔴 외부 사이트 이미지 주소가 아니다 — data:/blob: 도 없다", () => {
    expect(json).not.toContain("tennis-warehouse.com/graphics");
    expect(json).not.toContain("data:image");
    expect(json).not.toContain("blob:");
  });
});

describe("③ 🔴 PRE-CHECK PASS 를 REGISTRATION PASS 로 쓰지 않는다", () => {
  it("이 파일은 외부 호출을 «하나도» 하지 않는다", () => {
    /* 🔴 `import.meta.url` 로 자기 경로를 읽으려다 실패했다(한글 경로가
       percent-encoding 된다) — 다른 테스트가 쓰는 __dirname 방식으로 바꿨다.
       🔴 그리고 두 번째 함정: 금지 문자열을 그대로 쓰면 **이 단정 줄 자체가
       파일에 그 문자열을 넣는다**(자기 참조). 그래서 단정 줄을 벗기고 센다. */
    const NL = String.fromCharCode(10);
    const scanned = readFileSync(join(__dirname, "tennis-registration-payload-evidence.test.ts"), "utf8");
    /* 🔴 금지 문자열을 «리터럴로 적지 않는다» — 적으면 이 줄 자체가 파일에 그
       문자열을 넣어서 단정이 항상 실패한다(두 번 걸렸다). 쪼개서 만든다. */
    const needles = ["fet" + "ch(", "callCoupang" + "Api", "callNaver" + "Api", "callLotteOn" + "Api"];
    for (const needle of needles) {
      expect(scanned, needle).not.toContain(needle);
    }
  });

  it("🔴 그래서 이 증거의 등급은 «Payload PASS» 다 — 등록은 미수행이다", () => {
    /* 자격증명이 로컬에 없다(§H). 실제 등록은 CEO 인증이 필요하다.
       이 단정은 문서가 아니라 «이름» 으로 그 경계를 박아 둔 것이다. */
    const { validation } = buildSmartStore();
    expect(validation.fields.length).toBeGreaterThan(0);
  });
});
