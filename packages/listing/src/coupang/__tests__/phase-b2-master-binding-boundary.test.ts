import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { ListingModel } from "@commerce/marketplace";
import {
  CANONICAL_FIELD_LAYER,
  type CanonicalProduct,
  type CanonicalProductKey,
  type FieldSource,
  type ProvenanceField,
} from "@commerce/shared";
import {
  buildCoupangPayload,
  toCoupangBinding,
  type CoupangCategoryMeta,
  type CoupangCommerceBinding,
} from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NEXT-04d Phase B-2(CPO 승인, 2026-09-23) — 쿠팡에 Master / Binding 경계를
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 롯데ON(B-1)과 무엇이 달랐나 ────────────────────────────────────────────
 * 롯데ON 은 채널 전용 값이 이미 `LotteOnChannelConfig` 한 통로로 모여 있어서
 * 타입만 좁히면 됐다. 쿠팡은 아니었다 — 빌더가 `product.categoryFieldOverrides`
 * 를 **상품 객체에서 직접** 읽고 있었다. 그래서 이번에는 통로를 하나 만든다.
 *
 * 🔴 의미는 바꾸지 않았다(CPO 지시). 값은 여전히 같은 자리에 저장되고, 뜻도
 * 그대로다. 바뀐 것은 「어디를 통해 빌더에 도착하는가」뿐이다.
 *
 * ── 이 파일이 지키는 것(CPO 가 지정한 핵심 검증) ──────────────────────────
 * 상품에 «가짜» 채널값을 심고, binding 으로 «다른» 값을 넘긴다.
 * payload 에는 binding 값만 들어가야 한다 — 상품에 심은 값이 하나라도 새어
 * 나오면 경계가 서 있지 않은 것이다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 🔴 상품 쪽에 심는 «가짜» 채널값. payload 에 이 문자열이 보이면 실패다. */
const FAKE_FROM_PRODUCT = "상품에심은가짜값";
/** binding 으로 넘기는 «진짜» 값. payload 에는 이것만 있어야 한다. */
const REAL_FROM_BINDING = "바인딩으로넘긴값";

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
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
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),

    /* ── 🔴 COMMERCE_BINDING — 빌더가 «읽을 수 없어야» 하는 칸들 ── */
    categoryFieldOverrides: { 제조자: FAKE_FROM_PRODUCT, 색상: FAKE_FROM_PRODUCT },
    categoryResolverKpi: { manualOverride: true, evidence: [FAKE_FROM_PRODUCT] },
    categoryRecommendationCache: { sourceUrlKey: FAKE_FROM_PRODUCT, status: "READY" },
    channelPriceOverrides: { smartstore: field(777777, "USER_EDITED") },
    /* ── LEGACY ── */
    customsDutyKrw: field(11111, "USER_EDITED"),
    customsVatKrw: field(22222, "USER_EDITED"),
    ...overrides,
  } as CanonicalProduct;
}

function makeListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "coupang",
    platformLabel: "쿠팡",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 10000,
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

/** 카테고리가 「제조자」를 필수로 묻는 상태 — override 가 실제로 쓰이는 조건이다.
 *  (categoryMeta 가 없으면 구매옵션 자체가 만들어지지 않아 override 가 쓰일 자리도 없다.) */
const META: CoupangCategoryMeta = {
  attributes: [
    {
      attributeTypeName: "제조자",
      dataType: "STRING",
      inputType: "INPUT",
      inputValues: [],
      basicUnit: "없음",
      required: "MANDATORY",
    },
  ],
  noticeCategories: [],
};

describe("① 🔴 상품에 심은 채널값 ≠ Binding 값 — payload 에는 Binding 만", () => {
  const product = makeProduct();
  const binding: CoupangCommerceBinding = {
    categoryFieldOverrides: { 제조자: REAL_FROM_BINDING, 색상: REAL_FROM_BINDING },
  };

  it("전제 확인 — 두 값이 실제로 다르다", () => {
    expect(product.categoryFieldOverrides?.제조자).toBe(FAKE_FROM_PRODUCT);
    expect(binding.categoryFieldOverrides?.제조자).toBe(REAL_FROM_BINDING);
    expect(FAKE_FROM_PRODUCT).not.toBe(REAL_FROM_BINDING);
  });

  it("🔴 payload 전수 검색 — 상품에 심은 값이 한 번도 나오지 않는다", () => {
    const json = JSON.stringify(buildCoupangPayload(product, makeListing(product), { binding, categoryMeta: META }));
    expect(json, "상품 객체를 타고 채널값이 payload 로 새어 나왔다").not.toContain(FAKE_FROM_PRODUCT);
  });

  it("🔴 그 자리에는 binding 값이 «실제로» 서 있다 — 통로가 죽어 있지 않다", () => {
    /* 이 검사가 없으면 「상품 값이 안 나온다」는 통로가 통째로 죽어 있어도
       통과한다. 값이 도착하는 것까지 확인해야 회귀 보호가 된다. */
    const payload = buildCoupangPayload(product, makeListing(product), { binding, categoryMeta: META });
    const attributes = payload.items[0].attributes ?? [];
    expect(attributes.find((a) => a.attributeTypeName === "제조자")?.attributeValueName).toBe(REAL_FROM_BINDING);
  });

  it("빈 바인딩을 주면 override 없이 만들어진다 — 상품 값으로 «대신» 채우지 않는다", () => {
    const json = JSON.stringify(
      buildCoupangPayload(product, makeListing(product), { binding: {}, categoryMeta: META }),
    );
    expect(json).not.toContain(FAKE_FROM_PRODUCT);
    expect(json).not.toContain(REAL_FROM_BINDING);
  });

  it("🔴 회귀 — 채널값을 통째로 지운 상품과 payload 가 같다", () => {
    /* 빌더가 그 칸들을 읽지 않는다는 증명이자, 이번 변경으로 등록 결과가
       달라지지 않았다는 증명이다(B-1 과 같은 방식). */
    const bindingKeys = (Object.keys(CANONICAL_FIELD_LAYER) as CanonicalProductKey[]).filter(
      (key) => CANONICAL_FIELD_LAYER[key] === "COMMERCE_BINDING" || CANONICAL_FIELD_LAYER[key] === "LEGACY",
    );
    const stripped = { ...product } as Record<string, unknown>;
    for (const key of bindingKeys) delete stripped[key];
    for (const key of bindingKeys) expect(key in stripped).toBe(false);

    const a = buildCoupangPayload(product, makeListing(product), { binding, categoryMeta: META });
    const b = buildCoupangPayload(stripped as CanonicalProduct, makeListing(product), { binding, categoryMeta: META });
    expect(b).toEqual(a);
  });
});

describe("② Binding 을 «꺼내는» 곳은 한 군데다", () => {
  it("toCoupangBinding 은 저장된 값을 그대로 옮긴다 — 해석하지 않는다", () => {
    const product = makeProduct();
    expect(toCoupangBinding(product)).toEqual({ categoryFieldOverrides: product.categoryFieldOverrides });
  });

  it("🔴 실제 경로가 그것과 같은 결과를 낸다 — 통로만 바뀌고 값은 그대로다", () => {
    /* 「예전 동작」과 「지금 동작」이 같은지를 값으로 확인한다: 상품에 있던
       override 를 toCoupangBinding 으로 꺼내 넘기면, 예전에 빌더가 상품에서
       직접 읽던 것과 같은 payload 가 나와야 한다. */
    const product = makeProduct();
    const payload = buildCoupangPayload(product, makeListing(product), {
      binding: toCoupangBinding(product),
      categoryMeta: META,
    });
    const attributes = payload.items[0].attributes ?? [];
    // 같은 값이 통로를 «통해» 도착했다 — 예전에 상품에서 직접 읽던 그 값이다.
    expect(attributes.find((a) => a.attributeTypeName === "제조자")?.attributeValueName).toBe(FAKE_FROM_PRODUCT);
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만. 이 전환의 주석에는 옛 필드 이름이 설명으로
 *  남아 있고, 그건 지워야 할 것이 아니라 남겨야 할 것이다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const BUILD_SOURCE = readFileSync(new URL("../build-payload.ts", import.meta.url), "utf8");

describe("③ 소스 역검사 — 빌더가 읽는 칸이 전부 Master 쪽이다", () => {
  const readKeys = [
    ...new Set(
      (codeOnly(BUILD_SOURCE).match(/product\.([a-zA-Z][a-zA-Z0-9]*)/g) ?? []).map((m) => m.slice("product.".length)),
    ),
  ].filter((key) => key in CANONICAL_FIELD_LAYER);

  it("실제로 몇 칸을 읽는지부터 센다 — 0이면 검사가 무의미하다", () => {
    expect(readKeys.length).toBeGreaterThan(5);
  });

  it("🔴 COMMERCE_BINDING 직접 참조 = 0", () => {
    const forbidden = readKeys.filter((key) => CANONICAL_FIELD_LAYER[key as CanonicalProductKey] === "COMMERCE_BINDING");
    expect(forbidden, `쿠팡 빌더가 채널 칸을 상품에서 직접 읽는다: ${forbidden.join(", ")}`).toEqual([]);
  });

  it("🔴 LEGACY 직접 참조 = 0", () => {
    const forbidden = readKeys.filter((key) => CANONICAL_FIELD_LAYER[key as CanonicalProductKey] === "LEGACY");
    expect(forbidden).toEqual([]);
  });

  it("`product.categoryFieldOverrides` 가 코드에서 사라졌다", () => {
    expect(codeOnly(BUILD_SOURCE)).not.toContain("product.categoryFieldOverrides");
    expect(codeOnly(BUILD_SOURCE)).toContain("userOverrides: binding.categoryFieldOverrides");
  });
});

describe("④ 타입 경계가 코드에 남아 있다", () => {
  const code = codeOnly(BUILD_SOURCE);

  it("🔴 빌더 입력이 CanonicalProduct 가 아니다", () => {
    expect(code).toContain("export type CoupangProductInput = MasterProduct & SellingConditions");
    expect(code).toContain("product: CoupangProductInput");
    expect(code).not.toContain("product: CanonicalProduct,");
    expect(code).not.toContain("product: CanonicalProduct;");
  });

  it("🔴 binding 은 «필수» 인자다 — 빠뜨리면 컴파일이 멈춘다", () => {
    /* optional 로 두면 호출부가 빠뜨렸을 때 셀러가 화면에서 채운 값이 조용히
       사라진다. 「안 보낸다」가 아니라 「보내지 않으면 안 된다」여야 한다. */
    expect(code).toContain("binding: CoupangCommerceBinding;");
    expect(code).not.toContain("binding?: CoupangCommerceBinding");
  });

  it("바인딩 타입이 Phase A 분류표의 타입을 그대로 쓴다", () => {
    // 저장 타입이 바뀌면 여기가 따라 깨져야 한다 — 두 곳에 같은 모양을 적지 않는다.
    expect(code).toContain('CommerceBinding["categoryFieldOverrides"]');
  });
});
