import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_FIELD_LAYER,
  type CanonicalProduct,
  type CanonicalProductKey,
  type FieldSource,
  type ProvenanceField,
} from "@commerce/shared";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
} from "../build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NEXT-04d Phase B-1(CPO 승인, 2026-09-23) — **Master / Binding 경계를 롯데ON에**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Phase A 는 타입 파일 하나에 「이 칸은 무슨 층인가」를 적었다. 이 파일은
 * 그것이 **실제 등록 경로에서 지켜지는지** 를 묻는다.
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────────
 * ① 🔴 회귀: 채널 값(CommerceBinding)을 통째로 지워도 payload 가 **같다**.
 *    빌더가 그 값들을 읽지 않는다는 증명이고, 동시에 「이번 변경으로 등록
 *    결과가 달라지지 않았다」는 증명이다.
 * ② 빌더가 읽는 칸이 전부 MASTER/CONTENT/SOURCE/SELLING 이다 — 분류표를
 *    실제 소스에서 역으로 확인한다.
 * ③ 타입 경계가 코드에 남아 있다(`LotteOnProductInput`).
 *
 * 🔴 저장 구조는 바뀌지 않았다. 호출부는 지금도 `CanonicalProduct` 를 그대로
 * 넘기고, 구조적 타이핑이 그것을 받는다 — migration 도 snapshot rewrite 도 없다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 🔴 채널 값이 «전부 채워진» 상품. 이 값들이 payload 에 새어 나오면 ①이 깨진다. */
function makeProductWithBinding(): CanonicalProduct {
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
    keywords: field(["키워드1", "키워드2", "키워드3"]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(30, "DEFAULT"),
    certification: field(""),
    importer: field("따져코리아"),
    childCertification: field(null),
    itemName: field(""),
    modelName: field("MODEL-1"),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(143500, "USER_EDITED"),

    /* ── 🔴 여기부터가 COMMERCE_BINDING. 롯데ON 빌더는 이것을 «읽을 수 없다». ── */
    channelPriceOverrides: { coupang: field(999999, "USER_EDITED") },
    categoryFieldOverrides: { 제조자: "쿠팡화면에서입력한값" },
    lotteOnChannelInfo: {
      category: { standardCategoryNo: "XX99999999", displayCategoryNos: ["XX111"], selected: null },
      notice: { itemCode: "99", articlesText: "상품에 저장된 고시 원문" },
      certification: { safetyText: "상품에 저장된 인증 원문", importProxyCode: "IMP-999" },
      delivery: {
        outboundPlaceNo: "999",
        returnPlaceNo: "999",
        deliveryCostPolicyNo: "999",
        deliveryRegionGroupCode: "GN999",
        courierCode: "XX",
        returnCourierCode: "XX",
        weekdayCloseTime: "2359",
      },
      codes: { originCode: "XX", taxTypeCode: "XX", brandNo: "999", externalProductNo: "EXT-999" },
    },
    categoryResolverKpi: { manualOverride: true, evidence: ["쿠팡 카테고리 근거"] },
    categoryRecommendationCache: { sourceUrlKey: "https://example.com/products/test-item", status: "READY" },
    /* ── LEGACY(읽는 코드 0곳) ── */
    customsDutyKrw: field(11111, "USER_EDITED"),
    customsVatKrw: field(22222, "USER_EDITED"),
  } as CanonicalProduct;
}

function completeChannel(): LotteOnChannelConfig {
  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    /* 🔴 고정 시각. 빌더는 시계를 읽지 않는다(판매기간은 channel 이 들고 온다) —
       그래서 두 번 만든 payload 를 그대로 비교할 수 있다. */
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

const BINDING_KEYS = (Object.keys(CANONICAL_FIELD_LAYER) as CanonicalProductKey[]).filter(
  (key) => CANONICAL_FIELD_LAYER[key] === "COMMERCE_BINDING" || CANONICAL_FIELD_LAYER[key] === "LEGACY",
);

describe("① 🔴 회귀 — 채널 값을 지워도 payload 가 같다", () => {
  it("COMMERCE_BINDING · LEGACY 칸을 전부 지운 상품과 payload 가 한 글자도 다르지 않다", () => {
    const withBinding = makeProductWithBinding();
    const stripped = { ...withBinding };
    for (const key of BINDING_KEYS) delete (stripped as Record<string, unknown>)[key];

    // 실제로 지워졌는지부터 확인한다 — 빈 검사가 통과하는 것을 막는다.
    expect(BINDING_KEYS.length).toBeGreaterThan(0);
    expect(Object.keys(withBinding)).toEqual(expect.arrayContaining(BINDING_KEYS));
    for (const key of BINDING_KEYS) expect(key in stripped).toBe(false);

    const channel = completeChannel();
    const a = buildLotteOnPayload({ product: withBinding, channel, detailHtml: "<p>상세</p>" });
    const b = buildLotteOnPayload({ product: stripped, channel, detailHtml: "<p>상세</p>" });

    expect(b).toEqual(a);
  });

  it("🔴 상품에 저장된 롯데ON 값이 payload 로 새지 않는다 — 채널 입력이 이긴다", () => {
    /* lotteOnChannelInfo 에는 일부러 다른 번호를 넣어 뒀다(표준카테고리
       XX99999999 · 출고지 999). payload 에는 channel 로 들어온 값만 있어야 한다. */
    const payload = buildLotteOnPayload({
      product: makeProductWithBinding(),
      channel: completeChannel(),
      detailHtml: "<p>상세</p>",
    });
    const json = JSON.stringify(payload);
    for (const leaked of ["XX99999999", "XX111", "IMP-999", "EXT-999", "상품에 저장된 고시 원문"]) {
      expect(json, `상품에 저장된 롯데ON 값이 payload 에 새어 나왔다: ${leaked}`).not.toContain(leaked);
    }
    expect(payload.spdLst[0].scatNo).toBe("BC63080300");
  });

  it("🔴 다른 채널의 가격 override 가 롯데ON 가격을 건드리지 않는다", () => {
    // channelPriceOverrides.coupang = 999,999. 롯데ON 은 그 칸을 볼 수 없다.
    const payload = buildLotteOnPayload({
      product: makeProductWithBinding(),
      channel: completeChannel(),
      detailHtml: "<p>상세</p>",
    });
    expect(payload.spdLst[0].itmLst[0].slPrc).toBe(143500);
  });
});

/** 주석을 걷어낸 «실행되는 코드» 만 남긴다. 이 파일의 설명문에는 필드 이름이
 *  일부러 적혀 있어서, 주석까지 세면 검사가 거짓으로 실패한다. */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const BUILD_SOURCE = readFileSync(new URL("../build-payload.ts", import.meta.url), "utf8");
const VALIDATE_SOURCE = readFileSync(new URL("../validate-payload.ts", import.meta.url), "utf8");

describe("② 빌더가 읽는 칸은 전부 Master 쪽이다", () => {
  const readKeys = [...new Set((codeOnly(BUILD_SOURCE).match(/product\.([a-zA-Z][a-zA-Z0-9]*)/g) ?? []).map((m) => m.slice("product.".length)))];

  it("실제로 몇 칸을 읽는지부터 센다 — 0이면 이 검사가 무의미하다", () => {
    expect(readKeys.length).toBeGreaterThan(10);
  });

  it("🔴 읽는 칸 중 COMMERCE_BINDING · LEGACY 가 하나도 없다", () => {
    const forbidden = readKeys.filter((key) => {
      const layer = CANONICAL_FIELD_LAYER[key as CanonicalProductKey];
      return layer === "COMMERCE_BINDING" || layer === "LEGACY";
    });
    expect(forbidden, `롯데ON 빌더가 채널/legacy 칸을 읽는다: ${forbidden.join(", ")}`).toEqual([]);
  });

  it("읽는 칸이 전부 분류표에 있다 — 이름을 잘못 읽고 있지 않다", () => {
    const unknown = readKeys.filter((key) => !(key in CANONICAL_FIELD_LAYER));
    expect(unknown, `CanonicalProduct 에 없는 이름을 읽는다: ${unknown.join(", ")}`).toEqual([]);
  });

  it("validate-payload 도 같은 경계를 지킨다", () => {
    const keys = [...new Set((codeOnly(VALIDATE_SOURCE).match(/product\.([a-zA-Z][a-zA-Z0-9]*)/g) ?? []).map((m) => m.slice("product.".length)))];
    const forbidden = keys.filter((key) => {
      const layer = CANONICAL_FIELD_LAYER[key as CanonicalProductKey];
      return layer === "COMMERCE_BINDING" || layer === "LEGACY";
    });
    expect(forbidden).toEqual([]);
  });
});

describe("③ 타입 경계가 코드에 남아 있다", () => {
  it("🔴 빌더 입력이 CanonicalProduct 가 «아니다»", () => {
    const code = codeOnly(BUILD_SOURCE);
    expect(code).toContain("export type LotteOnProductInput = MasterProduct & SellingConditions");
    expect(code).toContain("product: LotteOnProductInput");
    // CanonicalProduct 를 다시 받으면 채널 칸이 타입에 돌아온다.
    expect(code).not.toContain("product: CanonicalProduct");
  });

  it("🔴 CommerceBinding 을 입력으로 «받지 않는다» — 넣을 수 없어야 한다", () => {
    const code = codeOnly(BUILD_SOURCE);
    expect(code).not.toContain("CommerceBinding");
    expect(code).not.toContain("lotteOnChannelInfo");
  });

  it("채널 값은 LotteOnChannelConfig 한 통로로만 들어온다", () => {
    const code = codeOnly(BUILD_SOURCE);
    expect(code).toContain("channel: LotteOnChannelConfig");
  });
});
