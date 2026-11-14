import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateCoupangPricing, validateNaverPayload } from "@commerce/listing";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔴 S2-① 채널 차단 계약 — **CPO 2차 검토가 지적한 공백을 닫는다**
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 직전 커밋(4061720e)은 핵심 함수(`computeVariantFinalPriceKrw`)만 음성대조로
 * 잠갔다. 🔴 그래서 **채널별 「등록 차단」을 지워도 조용히 통과**했다. 이 파일이
 * 그 셋을 각각 잠근다:
 *
 *   Coupang  RATE_UNAVAILABLE ⟹ `PRICE_UNRESOLVED` ⟹ 등록 route 가 API 호출 «전» FAILED
 *   Naver    환율 미확인 옵션이 **빠진 채 등록되지 않는다**(상품 전체 BLOCKED)
 *   LotteON  기존 `slPrc == null → PRICE_UNRESOLVED → BLOCKED` 경로가 유지된다
 *
 * 🔴 **Naver 가 이번에 처분이 바뀐 자리다.** 직전 커밋은 그 옵션을 payload 에서
 * 빼는 것으로 끝냈는데, 그것은 재고 null 과 **의미가 다르다** —
 *   재고 null    그 옵션을 **실제로 못 판다**        ⟹ 빼는 것이 사실에 맞는다
 *   환율 미확인  **팔 수 있는데 가격만 모른다**      ⟹ 빠지면 상품 구성이 조용히 달라진다
 * 채널 정책상 「일부 옵션 제외」를 승인받는 경로가 이 저장소에 **없으므로**
 * 상품 전체를 막는 것이 맞는 처분이다.
 */

/** CAD 는 FIXED_RATES_TO_KRW(KRW·EUR·USD·GBP·SEK·JPY)에 **없다** = 환율 미확인. */
const UNKNOWN_RATE_CURRENCY = "CAD";
/** EUR 는 고정표에 **있다** = 같은 경로가 정상 계산되는 대조군. */
const KNOWN_RATE_CURRENCY = "EUR";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 주석을 벗긴 소스 — 🔴 주석 안의 글자가 계약을 통과시키는 함정을 막는다. */
function strippedSource(relativeFromRepoRoot: string): string {
  const repoRoot = join(__dirname, "..", "..", "..", "..", "..", "..");
  const raw = readFileSync(join(repoRoot, relativeFromRepoRoot), "utf8");
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

/** 옵션 1개짜리 상품 — 옵션 가격만 통화를 갈아끼워 두 상태를 만든다. */
function makeOptionProduct(variantCurrency: string): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kids-tshirt",
    title: field("아동용 반팔 티셔츠"),
    brand: field("TestBrand"),
    // 🔴 기본가도 같은 통화다 — 통화 불일치(CURRENCY_MISMATCH)가 아니라
    //    «환율 미확인»(RATE_UNAVAILABLE)만 발화시키기 위해서다.
    price: field({ amount: 100, currency: variantCurrency }),
    priceValidity: "VALID",
    sku: field("KIDS-TSHIRT-1"),
    description: field("아동용 반팔 티셔츠입니다."),
    material: field("면 100%"),
    color: field("화이트"),
    recommendedAge: field("3세"),
    manufacturer: field("Test Manufacturer"),
    careInstructions: field("찬물 세탁"),
    options: field([]),
    optionGroups: [{ name: "사이즈", values: ["S"] }],
    variants: [
      {
        id: "v1",
        optionValues: { 사이즈: "S" },
        // 기본가 100 대비 +84 — 환율을 알면 84*rate, 모르면 «계산 불가».
        price: { amount: 184, currency: variantCurrency },
        stockQuantity: 5,
        sku: "V1",
      },
    ],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/tshirt.jpg",
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
    countryOfOrigin: field("대한민국"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(5),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
  } as CanonicalProduct;
}

function makeListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 150000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    priceOrigin: "PRODUCT_OVERRIDE",
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  } as ListingModel;
}

function naverVerdictFor(variantCurrency: string) {
  const product = makeOptionProduct(variantCurrency);
  const listing = makeListing(product);
  const input = {
    product,
    listing,
    leafCategoryId: "50000535",
    releaseAddressBookNo: 900000001,
    refundAddressBookNo: 900000002,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    sellerDeliveryFee: null,
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    childCertificationInfoId: 1041,
    categoryRequiresChildCertification: true,
    originAreaCode: "00",
    originAreaRequiresContent: false,
  };
  const payload = buildNaverProductPayload(input as never);
  const verdict = validateNaverPayload(payload as never, input as never, false);
  return { payload, verdict };
}

const OPTION_PRICE_FIELD = "detailAttribute.optionInfo.optionCombinations[].price";

describe("S2-① Naver — 환율 미확인 옵션이 «빠진 채 등록» 되지 않는다", () => {
  it("🔴 환율을 모르는 옵션이 있으면 상품 «전체» 가 BLOCKED 된다(그 옵션만 빼고 통과하지 않는다)", () => {
    const { payload, verdict } = naverVerdictFor(UNKNOWN_RATE_CURRENCY);

    // ⒜ 빌더는 그 조합을 payload 에서 빼낸다(= 조용히 빠질 수 있는 상태가 실재한다).
    const combos =
      (payload as never as { originProduct?: { detailAttribute?: { optionInfo?: { optionCombinations?: unknown[] } } } })
        .originProduct?.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos).toHaveLength(0);

    // ⒝ 🔴 그러므로 검증기가 **막아야** 한다 — 이것이 이 계약의 핵심이다.
    const blockedFields = (verdict as never as { fields: { field: string; status: string }[] }).fields.filter(
      (f) => f.status === "BLOCKED",
    );
    expect(blockedFields.map((f) => f.field)).toContain(OPTION_PRICE_FIELD);
  });

  it("🟢 대조군 — 환율을 아는 통화(EUR)면 같은 경로가 막히지 않고 옵션도 남는다", () => {
    const { payload, verdict } = naverVerdictFor(KNOWN_RATE_CURRENCY);

    const combos =
      (payload as never as { originProduct?: { detailAttribute?: { optionInfo?: { optionCombinations?: unknown[] } } } })
        .originProduct?.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos).toHaveLength(1);

    const blockedOptionPrice = (verdict as never as { fields: { field: string; status: string }[] }).fields.filter(
      (f) => f.status === "BLOCKED" && f.field === OPTION_PRICE_FIELD,
    );
    expect(blockedOptionPrice).toHaveLength(0);
  });

  it("🔴 빌더와 검증기는 **같은 환율표**를 본다 — 한쪽만 받으면 판정이 갈린다", () => {
    const build = strippedSource("packages/listing/src/naver/build-payload.ts");
    const validate = strippedSource("packages/listing/src/naver/validate-payload.ts");
    // 빌더: 옵션 조합 생성에 liveRates 를 넘긴다.
    expect(build).toContain("buildOptionCombinations(product, listing.priceKrw, input.liveRates)");
    // 검증기: 같은 칸을 읽어 같은 기준으로 다시 센다.
    expect(validate).toContain("input.liveRates");
  });
});

describe("S2-① Coupang — RATE_UNAVAILABLE 이면 등록 전에 PRICE_UNRESOLVED 로 막힌다", () => {
  const payloadWith = (reason?: string) =>
    ({
      items: [{ itemName: "S", originalPrice: 150000, salePrice: 150000, priceUnresolvedReason: reason }],
      returnCharge: 0,
    }) as never;

  it("🔴 옵션가를 계산하지 못한 단품이 있으면 PRICE_UNRESOLVED 가 발생한다", () => {
    const issues = validateCoupangPricing(payloadWith("RATE_UNAVAILABLE"), { priceValidity: "VALID" } as never);
    expect(issues.some((i) => i.code === "PRICE_UNRESOLVED")).toBe(true);
  });

  it("🟢 대조군 — 그 표시가 없으면 PRICE_UNRESOLVED 가 발생하지 않는다(무차별 차단이 아니다)", () => {
    const issues = validateCoupangPricing(payloadWith(undefined), { priceValidity: "VALID" } as never);
    expect(issues.some((i) => i.code === "PRICE_UNRESOLVED")).toBe(false);
  });

  it("🔴 등록 route 가 그 판정을 보고 **외부 API 호출 전에** FAILED 로 끊는다", () => {
    const route = strippedSource("apps/admin/src/app/api/coupang/register/route.ts");
    expect(route).toContain("validateCoupangPricing(payload, product)");
    expect(route).toContain("pricingIssues.length > 0");
    // 🔴 게이트가 실제 쿠팡 호출보다 «앞» 에 있어야 한다.
    const gateAt = route.indexOf("const pricingIssues = validateCoupangPricing");
    const failedAt = route.indexOf('status: "FAILED"', gateAt);
    expect(gateAt).toBeGreaterThan(-1);
    expect(failedAt).toBeGreaterThan(gateAt);
  });
});

describe("S2-① LotteON — 기존 null → PRICE_UNRESOLVED → BLOCKED 경로가 유지된다", () => {
  it("🔴 옵션 최종가가 null 이면 slPrc 가 null 로 남는다(0 으로 메우지 않는다)", () => {
    const build = strippedSource("packages/listing/src/lotteon/build-payload.ts");
    expect(build).toContain("slPrc: finalKrw");
    // 🔴 null 을 숫자로 바꿔치우는 폴백이 끼어들면 안 된다.
    expect(build).not.toContain("slPrc: finalKrw ?? 0");
  });

  it("🔴 null 인 slPrc 는 BLOCKED 로 막힌다 — 「0 이하」와 「모른다」를 가른다", () => {
    const adapter = strippedSource("packages/listing/src/lotteon/adapter.ts");
    expect(adapter).toContain("item.slPrc == null");
    expect(adapter).toContain("BLOCKED");
  });

  it("🔴 검증기가 PRICE_UNRESOLVED 코드를 유지한다", () => {
    const validate = strippedSource("packages/listing/src/lotteon/validate-payload.ts");
    expect(validate).toContain("PRICE_UNRESOLVED");
  });
});
