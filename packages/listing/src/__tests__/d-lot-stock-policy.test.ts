import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  type LotteOnChannelConfig,
} from "../lotteon/build-payload";
import { validateLotteOnPayload } from "../lotteon/validate-payload";
import { buildNaverProductPayload } from "../naver/build-payload";
import { validateNaverPayload } from "../naver/validate-payload";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ③ D-LOT-STOCK — 재고 정책 3-state (CPO 확정 2026-10-11)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   원본 실측 있음              → 그 값을 쓴다
 *   원본 모름 + 셀러 기본재고   → 셀러 기본재고를 쓴다
 *   원본 모름 + 셀러 입력 없음  → 🔴 등록 BLOCK (0 도 999 도 만들지 않는다)
 *   원본이 «실제» 0             → 0 (실측이므로 그대로)
 *   임의 999 / 임의 0           → 🔴 금지
 *
 * 🔴 **UNKNOWN ≠ ZERO.** 이 한 줄이 이 파일의 전부다.
 *
 * ── 왜 이 파일이 생겼는가 (실측) ──────────────────────────────────────────────
 *
 * Smallable 430632(사이즈 6개, 원본이 재고를 «한 칸도» 주지 않는다)로 운영 경로를
 * 관통했더니 두 채널이 같은 사실에 다르게 반응했다:
 *
 *   Naver     조합을 빼낸다 → optionCombinations [] → 「단품 999」처럼 통과
 *             (D-OPT 로 막았다 — `fc3e115d`)
 *   LotteON   stkQty 0 을 싣는다 → 검증기는 ready("재고(원본 미확인)")
 *             → **사이즈 6개가 전부 품절로 등록**된다
 *
 * 빌더 주석은 「검증기가 그 사실을 셀러에게 말한다」고 적어 두었지만, 검증기는
 * «말만 하고 막지 않았다». 그 어긋남을 여기서 양쪽 다 잠근다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

const SIZES = ["2/3 years", "4/5 years", "6/7 years"] as const;

/** 실제 Smallable 상품의 모양 — 사이즈는 있고 재고는 «없다». */
function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://www.smallable.com/en/product/x-430632",
    title: field("All About Monsters Washed T-shirt Organic cotton | Blue"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804532"),
    description: field("100% Organic Cotton. Made in Spain."),
    material: field("100% Organic Cotton"),
    color: field("Blue"),
    recommendedAge: field("", "REQUIRED"),
    manufacturer: field("테스트제조사"),
    careInstructions: field("", "REQUIRED"),
    options: field([]),
    optionGroups: [{ name: "사이즈", values: [...SIZES] }],
    /* 🔴 재고 칸이 «없다» — 원본이 주지 않는다. 0 을 넣으면 다른 시나리오가 된다. */
    variants: SIZES.map((sz, i) => ({ id: `v${i}`, optionValues: { 사이즈: sz } })),
    images: [
      {
        id: "img-1",
        originalUrl: "https://staticv3.smallable.com/x.webp",
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
    countryOfOrigin: field("Spain"),
    returnPolicy: field("", "REQUIRED"),
    shippingFee: field(0, "DEFAULT"),
    /* 🔴 파이프라인 기본값 999 — 「재고 999개」가 아니라 «모른다» 다. */
    stockQuantity: field(999, "DEFAULT"),
    certification: field("", "DEFAULT"),
    importer: field("", "REQUIRED"),
    childCertification: field(null, "REQUIRED"),
    itemName: field("", "REQUIRED"),
    modelName: field("MODEL-1"),
    weight: field("", "REQUIRED"),
    certificationType: field("", "REQUIRED"),
    priceOverrideKrw: field(112290, "USER_EDITED"),
    ...overrides,
  };
}

function completeChannel(): LotteOnChannelConfig {
  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    ...buildLotteOnSalePeriod(new Date("2026-10-11T00:00:00Z")),
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: "BC63080300",
    displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
    originCode: "KR",
    taxTypeCode: "01",
    noticeItemCode: "01",
    noticeArticles: [
      { pdArtlCd: "0010", pdArtlCnts: "100% Organic Cotton" },
      { pdArtlCd: "0020", pdArtlCnts: "Blue" },
      { pdArtlCd: "0030", pdArtlCnts: SIZES.join(", ") },
      { pdArtlCd: "0070", pdArtlCnts: "테스트제조사" },
      { pdArtlCd: "0060", pdArtlCnts: "Spain" },
      { pdArtlCd: "0050", pdArtlCnts: "케어라벨 참조" },
      { pdArtlCd: "0040", pdArtlCnts: "상세페이지 참조" },
      { pdArtlCd: "0080", pdArtlCnts: "소비자분쟁해결기준에 따름" },
      { pdArtlCd: "0090", pdArtlCnts: "따져 고객센터 / 02-000-0000" },
    ],
    outboundPlaceNo: "115",
    returnPlaceNo: "115",
    deliveryCostPolicyNo: "335",
    deliveryRegionGroupCode: "GN101",
  };
}

const lotteOnItems = (product: CanonicalProduct) =>
  buildLotteOnPayload({ product, channel: completeChannel(), detailHtml: "<p>상세</p>" }).spdLst[0]
    .itmLst;

const lotteOnStockField = (product: CanonicalProduct) =>
  validateLotteOnPayload({ product, channel: completeChannel(), detailHtml: "<p>상세</p>" }).fields.find(
    (f) => f.field === "itmStkQty",
  );

function naverListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 112290,
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

const naverCombos = (product: CanonicalProduct) =>
  buildNaverProductPayload({
    product,
    listing: naverListing(product),
    leafCategoryId: "50000535",
    releaseAddressBookNo: 900000001,
    refundAddressBookNo: 900000002,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    sellerDeliveryFee: null,
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    originAreaCode: "00",
    originAreaRequiresContent: false,
    categoryRequiresChildCertification: true,
    childCertificationInfoId: 1041,
  }).originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];

describe("③ D-LOT-STOCK — ① 원본 모름 + 셀러 입력 없음 → 등록을 막는다", () => {
  it("🔴 LotteON 이 stkQty 를 «만들지 않는다» — 0 도 999 도 없다", () => {
    const items = lotteOnItems(makeProduct());
    expect(items).toHaveLength(3);
    for (const item of items) {
      /* 🔴 핵심 — 「없음」이어야 한다. 0 이면 품절 주장이고 999 면 날조다. */
      expect(item.stkQty).toBeUndefined();
    }
  });

  it("🔴 LotteON 검증기가 READY 로 통과시키지 않는다 — MISSING 이다", () => {
    const stock = lotteOnStockField(makeProduct());
    expect(stock?.status).toBe("MISSING");
    /* 🔴 셀러가 «풀 수 있는 길» 이 reason 에 있어야 한다. */
    expect(stock?.reason).toContain("기본 재고 수량");
    expect(stock?.reason).toContain("임의로 채우지 않습니다");
  });

  it("🔴 Naver 도 같은 정책이다 — 조합이 0건이 되고 등록이 막힌다", () => {
    /* 두 채널이 같은 사실에 다르게 반응하면 셀러는 결과를 예측할 수 없다. */
    expect(naverCombos(makeProduct())).toEqual([]);
    const result = validateNaverPayload(
      buildNaverProductPayload({
        product: makeProduct(),
        listing: naverListing(makeProduct()),
        leafCategoryId: "50000535",
        releaseAddressBookNo: 900000001,
        refundAddressBookNo: 900000002,
        primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
        sellerDeliveryFee: null,
        returnDeliveryFee: 3000,
        exchangeDeliveryFee: 5000,
        originAreaCode: "00",
        originAreaRequiresContent: false,
        categoryRequiresChildCertification: true,
        childCertificationInfoId: 1041,
      }),
      {
        product: makeProduct(),
        releaseAddressBookNo: 900000001,
        refundAddressBookNo: 900000002,
        primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
        returnDeliveryFee: 3000,
        exchangeDeliveryFee: 5000,
        returnCompaniesFetchFailed: false,
        originAreaCode: "00",
        originAreaRequiresImporter: false,
        childCertificationInfoId: 1041,
      },
      true,
    );
    expect(
      result.fields.find((f) => f.field === "detailAttribute.optionInfo.optionCombinations")?.status,
    ).toBe("MISSING");
  });
});

describe("③ D-LOT-STOCK — ② 셀러 기본재고가 있으면 «그 값» 으로 등록된다", () => {
  const withSellerDefault = () =>
    makeProduct({ sellerDefaultStock: 7 } as Partial<CanonicalProduct>);

  it("LotteON 이 옵션마다 셀러 기본값을 싣는다", () => {
    expect(lotteOnItems(withSellerDefault()).map((i) => i.stkQty)).toEqual([7, 7, 7]);
  });

  it("LotteON 검증기가 막지 않는다 — 라벨이 출처를 말한다", () => {
    const stock = lotteOnStockField(withSellerDefault());
    expect(stock?.status).toBe("READY");
    expect(stock?.label).toContain("판매자 기본값");
  });

  it("Naver 도 같은 값으로 조합이 복구된다", () => {
    const combos = naverCombos(withSellerDefault());
    expect(combos).toHaveLength(3);
    expect(combos.map((c) => c.stockQuantity)).toEqual([7, 7, 7]);
  });

  it("🔴 999 는 셀러 기본값으로도 받지 않는다 — 그 숫자는 「모른다」다", () => {
    const product = makeProduct({ sellerDefaultStock: 999 } as Partial<CanonicalProduct>);
    expect(lotteOnItems(product).every((i) => i.stkQty === undefined)).toBe(true);
    expect(lotteOnStockField(product)?.status).toBe("MISSING");
    expect(naverCombos(product)).toEqual([]);
  });
});

describe("③ D-LOT-STOCK — ③ 원본 실측은 그대로 쓴다 (KNOWN / KNOWN_ZERO)", () => {
  it("옵션별 실측 재고가 그대로 실린다 — 합계로 뭉개지 않는다", () => {
    const product = makeProduct({
      variants: SIZES.map((sz, i) => ({
        id: `v${i}`,
        optionValues: { 사이즈: sz },
        stockQuantity: [4, 0, 2][i],
      })),
    });
    expect(lotteOnItems(product).map((i) => i.stkQty)).toEqual([4, 0, 2]);
    /* 🔴 하나가 0 이어도 나머지가 팔리므로 막지 않는다. */
    expect(lotteOnStockField(product)?.status).toBe("READY");
  });

  it("🔴 원본이 «실제» 전부 품절(0)이면 0 을 그대로 싣고 등록은 막는다", () => {
    const soldOut = makeProduct({
      variants: SIZES.map((sz, i) => ({ id: `v${i}`, optionValues: { 사이즈: sz }, stockQuantity: 0 })),
    });
    /* 0 은 «실측» 이므로 payload 에 그대로 간다 — 생략하지 않는다.
       「모름(생략)」과 「품절(0)」을 구별하는 것이 이 정책의 핵심이다. */
    expect(lotteOnItems(soldOut).map((i) => i.stkQty)).toEqual([0, 0, 0]);
    const stock = lotteOnStockField(soldOut);
    /* 🔴 그리고 BLOCKED 다 — MISSING 이 아니다. 셀러가 여기서 고칠 값이 아니라
       원본의 사실이다(그 구분이 화면 문구를 가른다). */
    expect(stock?.status).toBe("BLOCKED");
  });

  it("옵션이 없는 단품도 셀러 기본값을 본다 — 그 사다리가 옵션 상품에만 걸려 있었다", () => {
    const bare = makeProduct({ optionGroups: [], variants: [] });
    expect(lotteOnItems(bare)[0].stkQty).toBeUndefined();
    const withDefault = makeProduct({
      optionGroups: [],
      variants: [],
      sellerDefaultStock: 5,
    } as Partial<CanonicalProduct>);
    expect(lotteOnItems(withDefault)[0].stkQty).toBe(5);
  });
});
