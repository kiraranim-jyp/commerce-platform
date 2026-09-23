import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS, applyChannelPriceOverride } from "@commerce/marketplace";
import {
  CANONICAL_FIELD_LAYER,
  type CanonicalProduct,
  type CanonicalProductKey,
  type FieldSource,
  type ProvenanceField,
} from "@commerce/shared";
import { buildNaverProductPayload } from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NEXT-04d Phase B-3(CPO 승인, 2026-09-23) — 스마트스토어의 Master / Binding 경계
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 세 채널이 서로 달랐던 지점 ─────────────────────────────────────────────
 *   B-1 롯데ON      채널값이 이미 LotteOnChannelConfig 한 통로 → 타입만 좁혔다
 *   B-2 쿠팡        빌더가 product.categoryFieldOverrides 를 직접 읽었다 →
 *                   통로(binding)를 새로 만들었다
 *   B-3 스마트스토어 채널값이 애초에 상품 밖에 있다(/api/naver/resolve ·
 *                   ListingModel) → **새 통로가 필요 없다**
 *
 * ── 🔴 이번 목표는 「전부 끊는다」가 아니다 ────────────────────────────────
 * 가격은 «의도적으로» 채널값을 읽는다. `resolveChannelListingPrice()` 가 세
 * 채널(smartstore·coupang·elevenst)이 공유하는 가격 seam 이고, 이번 작업으로
 * 그 구조를 바꾸면 스마트스토어 작업이 아니라 3채널 공통 refactor 가 된다
 * (CPO 확정 ㉮). 그래서 ④는 «막는» 검사가 아니라 «도착하는지» 를 확인하는
 * 양성 검사다 — 어떤 채널 정보가 어디를 통해 들어오는지가 분명해지는 것이
 * 이번 단계의 목적이다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

const PRODUCT_FINAL_KRW = 143500;
/** 🔴 상품 쪽에 심는 가짜 채널값. payload 에 보이면 실패다. */
const FAKE_FROM_PRODUCT = "상품에심은가짜채널값";

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field("테스트제조사"),
    careInstructions: field("손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/test.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("테스트 상품"),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(30, "DEFAULT"),
    certification: field(""),
    importer: field("따져코리아"),
    childCertification: field(null),
    itemName: field("아동용 반바지"),
    modelName: field("MODEL-1"),
    weight: field("120g"),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(PRODUCT_FINAL_KRW, "USER_EDITED"),

    /* ── 🔴 COMMERCE_BINDING — 스마트스토어 payload 가 «읽을 수 없어야» 하는 칸 ── */
    /* 🔴 다른 채널의 가격. 스마트스토어 payload 는 이 값을 쓰면 안 된다
       (④에서 «자기 채널» 값은 반대로 도착해야 한다는 것을 따로 검사한다). */
    channelPriceOverrides: { coupang: field(999999, "USER_EDITED") },
    categoryFieldOverrides: { 제조자: FAKE_FROM_PRODUCT },
    categoryResolverKpi: { manualOverride: true, evidence: [FAKE_FROM_PRODUCT] },
    categoryRecommendationCache: { sourceUrlKey: FAKE_FROM_PRODUCT, status: "READY" },
    lotteOnChannelInfo: {
      category: { standardCategoryNo: FAKE_FROM_PRODUCT, displayCategoryNos: [FAKE_FROM_PRODUCT], selected: null },
      notice: { itemCode: FAKE_FROM_PRODUCT, articlesText: FAKE_FROM_PRODUCT },
      certification: { safetyText: FAKE_FROM_PRODUCT, importProxyCode: FAKE_FROM_PRODUCT },
      delivery: {
        outboundPlaceNo: FAKE_FROM_PRODUCT,
        returnPlaceNo: FAKE_FROM_PRODUCT,
        deliveryCostPolicyNo: FAKE_FROM_PRODUCT,
        deliveryRegionGroupCode: FAKE_FROM_PRODUCT,
        courierCode: FAKE_FROM_PRODUCT,
        returnCourierCode: FAKE_FROM_PRODUCT,
        weekdayCloseTime: FAKE_FROM_PRODUCT,
      },
      codes: {
        originCode: FAKE_FROM_PRODUCT,
        taxTypeCode: FAKE_FROM_PRODUCT,
        brandNo: FAKE_FROM_PRODUCT,
        externalProductNo: FAKE_FROM_PRODUCT,
      },
    },
    /* ── LEGACY ── */
    customsDutyKrw: field(11111, "USER_EDITED"),
    customsVatKrw: field(22222, "USER_EDITED"),
    ...overrides,
  } as CanonicalProduct;
}

function listingFor(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

/** 등록에 필요한 채널 컨텍스트 — 전부 상품 «밖» 에서 온다(/api/naver/resolve). */
const CHANNEL_CONTEXT = {
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
} as const;

function payloadOf(product: CanonicalProduct) {
  return buildNaverProductPayload({ product, listing: listingFor(product), ...CHANNEL_CONTEXT });
}

const BINDING_KEYS = (Object.keys(CANONICAL_FIELD_LAYER) as CanonicalProductKey[]).filter(
  (key) => CANONICAL_FIELD_LAYER[key] === "COMMERCE_BINDING" || CANONICAL_FIELD_LAYER[key] === "LEGACY",
);

describe("① 🔴 회귀 — 채널값을 지워도 payload 가 같다", () => {
  it("COMMERCE_BINDING · LEGACY 칸을 전부 지운 상품과 payload 가 한 글자도 다르지 않다", () => {
    const product = makeProduct();
    const stripped = { ...product } as Record<string, unknown>;
    for (const key of BINDING_KEYS) delete stripped[key];

    expect(BINDING_KEYS.length).toBeGreaterThan(0);
    expect(Object.keys(product)).toEqual(expect.arrayContaining(BINDING_KEYS));
    for (const key of BINDING_KEYS) expect(key in stripped).toBe(false);

    expect(payloadOf(stripped as CanonicalProduct)).toEqual(payloadOf(product));
  });
});

describe("② 🔴 상품에 심은 가짜 채널값이 payload 에 새지 않는다", () => {
  it("payload 전수 검색 — 등장 0회", () => {
    const json = JSON.stringify(payloadOf(makeProduct()));
    expect(json, "상품 객체를 타고 채널값이 스마트스토어 payload 로 새어 나왔다").not.toContain(FAKE_FROM_PRODUCT);
  });

  it("🔴 롯데ON 관리정보가 통째로 들어 있어도 마찬가지다", () => {
    // 같은 상품 하나가 세 채널에 등록된다. 다른 채널의 관리정보는 이 payload 와
    // 아무 상관이 없어야 한다.
    const json = JSON.stringify(payloadOf(makeProduct()));
    for (const leaked of ["standardCategoryNo", "outboundPlaceNo", "externalProductNo"]) {
      expect(json).not.toContain(leaked);
    }
  });

  it("그래도 상품의 «진짜» 값은 그대로 실린다 — 빈 payload 로 통과하지 않는다", () => {
    const payload = payloadOf(makeProduct());
    expect(payload.originProduct.name).toBeTruthy();
    expect(payload.originProduct.salePrice).toBe(PRODUCT_FINAL_KRW);
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만 남긴다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const SOURCES: [string, string][] = [
  ["naver/build-payload.ts", readFileSync(new URL("../build-payload.ts", import.meta.url), "utf8")],
  ["naver/validate-payload.ts", readFileSync(new URL("../validate-payload.ts", import.meta.url), "utf8")],
  ["smartstore/build-payload.ts", readFileSync(new URL("../../smartstore/build-payload.ts", import.meta.url), "utf8")],
  [
    "executors/smartstore.executor.ts",
    readFileSync(new URL("../../executors/smartstore.executor.ts", import.meta.url), "utf8"),
  ],
];

describe("③ 소스 역검사 — COMMERCE_BINDING · LEGACY 직접 참조 0", () => {
  it.each(SOURCES)("%s", (_label, source) => {
    const keys = [
      ...new Set(
        (codeOnly(source).match(/product\.([a-zA-Z][a-zA-Z0-9]*)/g) ?? []).map((m) => m.slice("product.".length)),
      ),
    ].filter((key) => key in CANONICAL_FIELD_LAYER);
    const forbidden = keys.filter((key) => {
      const layer = CANONICAL_FIELD_LAYER[key as CanonicalProductKey];
      return layer === "COMMERCE_BINDING" || layer === "LEGACY";
    });
    expect(forbidden, `채널/legacy 칸을 상품에서 직접 읽는다: ${forbidden.join(", ")}`).toEqual([]);
  });

  it("빌더가 실제로 여러 칸을 읽는다 — 0이면 위 검사가 무의미하다", () => {
    const keys = (codeOnly(SOURCES[0][1]).match(/product\.([a-zA-Z][a-zA-Z0-9]*)/g) ?? []).map((m) =>
      m.slice("product.".length),
    );
    expect(new Set(keys).size).toBeGreaterThan(10);
  });

  it("🔴 타입 경계가 코드에 남아 있다", () => {
    const code = codeOnly(SOURCES[0][1]);
    expect(code).toContain("export type SmartStoreProductInput = MasterProduct & SellingConditions");
    expect(code).toContain("product: SmartStoreProductInput;");
    expect(code).not.toContain("product: CanonicalProduct");
  });
});

describe("④ 🔴 가격은 «의도된» 채널 seam 을 통해 들어온다 — 양성 검사", () => {
  /* 여기만 반대 방향이다. 채널 가격은 끊는 것이 아니라 «도착해야» 한다.
     끊어 버리면 셀러가 스마트스토어에만 지정한 가격이 조용히 사라진다. */
  it("스마트스토어에만 지정한 가격이 originProduct.salePrice 까지 도착한다", () => {
    const product = applyChannelPriceOverride(makeProduct(), "smartstore", 139000);
    const listing = listingFor(product);
    expect(listing.priceKrw, "어댑터가 채널 가격을 읽지 않았다").toBe(139000);
    expect(payloadOf(product).originProduct.salePrice).toBe(139000);
  });

  it("다른 채널에만 지정한 가격은 스마트스토어 payload 를 건드리지 않는다", () => {
    const product = applyChannelPriceOverride(makeProduct(), "coupang", 145000);
    expect(payloadOf(product).originProduct.salePrice).toBe(PRODUCT_FINAL_KRW);
  });

  it("🔴 그 seam 은 «한 곳» 뿐이다 — channelPriceOverrides 를 읽는 파일이 하나다", () => {
    /* 이 검사가 이번 단계의 핵심이다. 「모든 채널값을 끊었다」가 아니라
       「채널값이 어디를 통해 들어오는지 한 곳으로 안다」가 목표다.
       여기가 깨지면 두 번째 가격 경로가 생긴 것이다. */
    const seam = readFileSync(new URL("../../../../marketplace/src/channel-price.ts", import.meta.url), "utf8");
    expect(codeOnly(seam)).toContain("product.channelPriceOverrides?.[platform]?.value");
    for (const [label, source] of SOURCES) {
      expect(codeOnly(source), `${label} 이 채널 가격을 따로 읽는다`).not.toContain("channelPriceOverrides");
    }
  });
});
