import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
} from "../lotteon/build-payload";
import { validateLotteOnPayload } from "../lotteon/validate-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Commerce-6 C-2D — **값이 없는데 READY 로 지나가지 않는다 (재고)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * C-2D 감사에서 나온 실제 누락이다. 기본 필수정보 16개를 세 채널의 payload ·
 * validator · readiness 에 대조해 보니 «재고» 에서 셋 다 새고 있었다.
 *
 *   스마트스토어  검증기는 «있었다» — `originProduct.stockQuantity > 0`.
 *                 그런데 빌더가 `product.stockQuantity.value || 1` 로 0 을 1 로
 *                 바꿔서 넘겼다. 🔴 그래서 그 검사는 «절대 실패할 수 없었다».
 *                 재고 0 인 상품이 「재고 READY」로 서고 재고 1 로 등록됐다.
 *   쿠팡          규칙이 아예 없었다. payload 는 재고를 그대로 실어 보낸다.
 *   롯데ON        검사가 아예 없었다. 옵션 «개수» 만 봤다.
 *
 * 🔴 이 결함에 기존 테스트가 «한 건도» 없었다 — 세 채널 전부. 그래서 고친 뒤에
 *    아무 테스트도 깨지지 않았다. 깨질 것이 없었다는 뜻이다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 1 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field("테스트제조사"),
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
    titleKo: field("테스트 상품"),
    descriptionKo: field(""),
    keywords: field(["1", "2", "3", "4", "5", "6"]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(30, "ORIGINAL"),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field("MODEL-1"),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(143500, "USER_EDITED"),
    ...overrides,
  };
}

/** 재고 말고는 전부 통과하는 상태 — 재고 하나만 움직여서 본다. */
function completeChannel(): LotteOnChannelConfig {
  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    ...buildLotteOnSalePeriod(new Date("2026-09-14T00:00:00Z")),
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: "BC63080300",
    displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
    originCode: "KR",
    noticeItemCode: "01",
    noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "블루" }],
    outboundPlaceNo: "115",
    returnPlaceNo: "115",
    deliveryCostPolicyNo: "335",
    deliveryRegionGroupCode: "GN101",
  };
}

function lotteOnStockField(product: CanonicalProduct) {
  const result = validateLotteOnPayload({ product, channel: completeChannel(), detailHtml: "<p>상세</p>" });
  return result.fields.find((f) => f.field === "itmStkQty");
}

describe("① 롯데ON — 재고 0 은 더 이상 READY 가 아니다", () => {
  it("재고가 있으면 READY", () => {
    expect(lotteOnStockField(makeProduct())?.status).toBe("READY");
  });

  it("🔴 재고 0 이면 BLOCKED — 등록이 열리지 않는다", () => {
    const result = validateLotteOnPayload({
      product: makeProduct({ stockQuantity: field(0, "ORIGINAL") }),
      channel: completeChannel(),
      detailHtml: "<p>상세</p>",
    });
    expect(result.fields.find((f) => f.field === "itmStkQty")?.status).toBe("BLOCKED");
    expect(result.ok).toBe(false);
  });

  /* 🔴 선택사항을 억지로 막지 않는다(CPO §7 후단). 옵션 상품은 조합에 재고가
     있으면 파는 것이다 — 상품 레벨 재고가 0 이라고 막으면 정상 상품이 막힌다. */
  it("상품 재고가 0 이어도 옵션 하나에 재고가 있으면 막지 않는다", () => {
    const product = makeProduct({
      stockQuantity: field(0, "ORIGINAL"),
      variants: [
        { id: "v1", optionValues: { 색상: "블루" }, stockQuantity: 0 },
        { id: "v2", optionValues: { 색상: "레드" }, stockQuantity: 5 },
      ] as CanonicalProduct["variants"],
    });
    expect(lotteOnStockField(product)?.status).toBe("READY");
  });

  it("옵션이 전부 품절이면 막는다", () => {
    const product = makeProduct({
      stockQuantity: field(0, "ORIGINAL"),
      variants: [{ id: "v1", optionValues: { 색상: "블루" }, stockQuantity: 0 }] as CanonicalProduct["variants"],
    });
    expect(lotteOnStockField(product)?.status).toBe("BLOCKED");
  });
});

describe("② 🔴 스마트스토어 — 빌더가 재고를 «지어내지» 않는다", () => {
  const NAVER = readFileSync(join(__dirname, "..", "naver", "build-payload.ts"), "utf8").replace(/\r\n/g, "\n");

  /* `|| 1` 이 돌아오면 검증기가 다시 무효가 된다. 그 한 글자가 전부였다. */
  it("`product.stockQuantity.value || 1` 이 되살아나지 않았다", () => {
    expect(NAVER).not.toMatch(/stockQuantity:\s*product\.stockQuantity\.value\s*\|\|/);
  });

  /* C-2E — 해석이 shared/source-stock 한 곳으로 옮겨졌다. 채널 빌더는 자기
     규칙을 만들지 않고 그 함수를 부르기만 한다(C-2D 에서 내가 채널마다 쓴
     `stockQuantity.value > 0` 이 전부 무효였던 이유가 그것이다). */
  it("해석을 채널이 «다시» 하지 않는다 — 공용 함수를 부른다", () => {
    expect(NAVER).toContain("stockQuantity: payloadStockQuantity(product)");
    expect(NAVER).not.toMatch(/stockQuantity\.value\s*>\s*0/);
  });

  it("검증기는 그대로 0 이하를 막는다 — 이제 «도달» 한다", () => {
    const VALIDATOR = readFileSync(join(__dirname, "..", "naver", "validate-payload.ts"), "utf8");
    expect(VALIDATOR).toContain("originProduct.stockQuantity > 0");
  });
});

describe("③ 쿠팡 — 재고 규칙이 «생겼다»", () => {
  const ADAPTER = readFileSync(
    join(__dirname, "..", "..", "..", "marketplace", "src", "adapters", "coupang.adapter.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("stock 규칙이 ERROR 로 있다 — WARNING 이면 등록을 막지 못한다", () => {
    const at = ADAPTER.indexOf('field: "stock"');
    expect(at, "쿠팡 어댑터에 재고 규칙이 없다").toBeGreaterThan(-1);
    expect(ADAPTER.slice(at, at + 400)).toContain('onFail: "ERROR"');
  });

  /* 🔴 화면과 등록이 같은 해석을 써야 한다 — 둘 다 공용 함수를 본다. */
  it("옵션 재고를 함께 본다 — 공용 해석(resolveSourceStock)을 쓴다", () => {
    expect(ADAPTER).toContain("const stockFact = resolveSourceStock(product)");
    const at = ADAPTER.indexOf('field: "stock"');
    expect(ADAPTER.slice(at, at + 600)).toContain("blocksRegistration(stockFact)");
  });
});

describe("④ 선택 항목은 여전히 등록을 막지 않는다", () => {
  /* 옵션 없는 단품은 정상이다. 쿠팡 어댑터에서 옵션은 WARNING 으로 남아 있어야
     하고, 재고 규칙이 생겼다고 옵션까지 덩달아 막으면 안 된다. */
  it("쿠팡 옵션 규칙은 WARNING 그대로다", () => {
    const ADAPTER = readFileSync(
      join(__dirname, "..", "..", "..", "marketplace", "src", "adapters", "coupang.adapter.ts"),
      "utf8",
    );
    const at = ADAPTER.indexOf('field: "options"');
    expect(ADAPTER.slice(at, at + 300)).toContain('onFail: "WARNING"');
  });

  it("롯데ON — 옵션 없는 단품은 재고만 있으면 통과한다", () => {
    const result = validateLotteOnPayload({
      product: makeProduct(),
      channel: completeChannel(),
      detailHtml: "<p>상세</p>",
    });
    expect(result.fields.find((f) => f.field === "itmLst")?.status).toBe("READY");
    expect(result.fields.find((f) => f.field === "itmStkQty")?.status).toBe("READY");
  });
});
