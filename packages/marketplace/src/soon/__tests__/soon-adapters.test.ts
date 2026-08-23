import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { elevenstSoonAdapter } from "../elevenst-soon.adapter";
import { esmSoonAdapter } from "../esm-soon.adapter";
import type { NextGenMarketplaceAdapter } from "../types";
import type { SoonMarketplacePayload } from "../payload";

/**
 * N-4.02 Part R(대표님 지시) — 실제 API 호출 없이 payload 생성/검증/에러
 * 처리 계약만 확인한다. 두 어댑터(11번가/ESM)를 같은 테스트 스위트로
 * 돌린다 — PART N의 "공통 계약을 공유한다"는 목적 자체를 검증하는 것이라
 * 어댑터별로 중복 작성하지 않는다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test",
    title: field("Test Product"),
    brand: field("TestBrand"),
    price: field({ amount: 50, currency: "USD" }),
    priceValidity: "VALID",
    sku: field("SKU-1"),
    description: field("A test product."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
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
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field(""),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(1),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    ...overrides,
  };
}

const adapters: NextGenMarketplaceAdapter<SoonMarketplacePayload>[] = [elevenstSoonAdapter, esmSoonAdapter];

describe.each(adapters.map((a) => [a.label, a] as const))("%s SOON adapter — contract", (_label, adapter) => {
  it("status는 항상 SOON이다", () => {
    expect(adapter.status).toBe("SOON");
  });

  it("resolveConnectionStatus — 공식 API 스펙 미확보 상태라 credential 유무와 무관하게 NOT_AVAILABLE", () => {
    expect(adapter.resolveConnectionStatus(false)).toBe("NOT_AVAILABLE");
    expect(adapter.resolveConnectionStatus(true)).toBe("NOT_AVAILABLE");
  });

  it("resolveCategory/resolveOptions/resolveAttributes/resolveDelivery — 전부 NOT_AVAILABLE(공식 스펙 미확보를 정직하게 표시)", () => {
    const product = makeProduct();
    expect(adapter.resolveCategory(product).status).toBe("NOT_AVAILABLE");
    expect(adapter.resolveOptions(product).status).toBe("NOT_AVAILABLE");
    expect(adapter.resolveAttributes(product, adapter.resolveCategory(product)).status).toBe("NOT_AVAILABLE");
    expect(adapter.resolveDelivery(product).status).toBe("NOT_AVAILABLE");
  });

  it("buildPayload — 정상 상품이면 payload를 만들고 BLOCKED 이슈가 없다", () => {
    const result = adapter.buildPayload(makeProduct());
    expect(result.payload).not.toBeNull();
    expect(result.payload?.productName).toBe("Test Product");
    expect(result.payload?.brand).toBe("TestBrand");
    expect(result.issues.filter((i) => i.severity === "BLOCKED")).toEqual([]);
  });

  it("buildPayload — 상품명이 비어 있으면 BLOCKED, payload는 null(옵션/가격 payload 케이스)", () => {
    const result = adapter.buildPayload(makeProduct({ title: field("") }));
    expect(result.payload).toBeNull();
    expect(result.issues.some((i) => i.field === "productName" && i.severity === "BLOCKED")).toBe(true);
  });

  it("buildPayload — 가격이 0이면 BLOCKED(price payload 케이스)", () => {
    const result = adapter.buildPayload(makeProduct({ price: field({ amount: 0, currency: "USD" }) }));
    expect(result.payload).toBeNull();
    expect(result.issues.some((i) => i.field === "priceKrw" && i.severity === "BLOCKED")).toBe(true);
  });

  it("buildPayload — 대표 이미지가 없으면 MISSING(경고)이지만 BLOCKED는 아니다(shipping/이미지는 필수 아님)", () => {
    const result = adapter.buildPayload(makeProduct({ images: [] }));
    expect(result.payload).not.toBeNull();
    expect(result.issues.some((i) => i.field === "representativeImageUrl" && i.severity === "MISSING")).toBe(true);
  });

  it("validate — buildPayload가 만든 정상 payload는 ok:true", () => {
    const { payload } = adapter.buildPayload(makeProduct());
    expect(adapter.validate(payload!).ok).toBe(true);
  });

  it("register — 항상 NOT_IMPLEMENTED, 실제 네트워크 호출 없이 즉시 반환(error handling 케이스: 호출 자체가 안전)", async () => {
    const { payload } = adapter.buildPayload(makeProduct());
    const result = await adapter.register(payload!);
    expect(result.status).toBe("NOT_IMPLEMENTED");
    expect(result.message).toContain("SOON");
  });
});

describe("11번가/ESM 어댑터가 서로 다른 id/label을 갖는다(레지스트리 충돌 방지)", () => {
  it("id/label이 다르다", () => {
    expect(elevenstSoonAdapter.id).not.toBe(esmSoonAdapter.id);
    expect(elevenstSoonAdapter.label).not.toBe(esmSoonAdapter.label);
  });
});
