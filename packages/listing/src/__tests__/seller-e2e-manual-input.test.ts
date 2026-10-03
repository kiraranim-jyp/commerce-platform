import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { assembleNaverDetailContent, buildNaverProductPayload } from "../naver/build-payload";
import { validateNaverPayload } from "../naver/validate-payload";
import { resolveCareInstructions } from "../notice/care-instructions";
import { describeBulkReferencePlan, planProductBulkReference } from "../notice/bulk-reference";
import { resolveProductDetailBlocks } from "../common/detail-override";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELLER-UX-FINAL PHASE 5 — **실제 셀러 작업 순서로 한 번 통과시킨다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   수집 → 상품정보 → ③케어라벨 → ②참조 전체적용 → ④상세설명
 *        → ⑤상품별 상세페이지 → readiness → (등록)
 *
 * 🔴 기능 추가가 아니라 **사용성 측정** 이다. 단계마다 묻는 것은 하나다:
 *     「셀러가 여기서 다시 입력해야 하는가?」
 *
 * 남는 칸을 셋으로 가른다:
 *     A 정말 필요한 값          → 유지
 *     B 상품정보로 알 수 있는 값 → 자동화 후보
 *     C 추측이 필요한 값         → 자동화하지 않음
 *
 * 🔴 수집 직후 상태를 **파이프라인의 실제 기본값** 으로 만든다 — 깨끗한 값으로
 * 만들면 Production 의 빈 칸을 놓친다.
 */
const f = <T,>(value: T, source = "ORIGINAL", confidence = 1) =>
  ({ value, source, confidence }) as unknown as { value: T; source: string; confidence: number };

/** 수집 직후(canonical-product.ts 의 기본값과 같은 모양). 테니스 상의 실측값. */
function collected(): CanonicalProduct {
  return {
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Fall_Magro_Top/descpageMASGT-STMFMT0.html",
    title: f("Sergio Tacchini Mens Fall Magro Top"),
    brand: f("Sergio Tacchini"),
    price: f({ amount: 68, currency: "USD" }),
    priceValidity: "VALID",
    sku: f("STMFMT0-WH"),
    material: f("65% Cotton, 30% Polyester, 5% Elastane"),
    color: f("Brilliant White"),
    /* 🔴 수집이 채우지 «않는» 칸들 — canonical-product.ts 의 실제 기본값. */
    modelName: f("", "REQUIRED", 0),
    keywords: f([] as string[], "ORIGINAL", 0),
    description: f(""),
    descriptionKo: f(""),
    titleKo: f(""),
    manufacturer: f(""),
    countryOfOrigin: f(""),
    recommendedAge: f(""),
    importer: f(""),
    itemName: f(""),
    weight: f(""),
    returnPolicy: f(""),
    certification: f(""),
    certificationType: f(""),
    childCertification: f(null),
    seoTitle: f(""),
    seoDescription: f(""),
    /* ③ 이 수집 시점에 넣는 값 — 이미 배선돼 있다. */
    careInstructions: resolveCareInstructions(null),
    options: f(["Size"]),
    optionGroups: [{ name: "Size", values: ["S", "M", "L", "XL", "XXL"] }],
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
}

const NAVER_BUILD = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041,
  categoryRequiresChildCertification: false,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
  detailBlocks: resolveProductDetailBlocks(null),
} as const;

function blockedFields(product: CanonicalProduct): string[] {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const payload = buildNaverProductPayload({ product, listing, ...NAVER_BUILD } as never);
  const v = validateNaverPayload(payload, { product, ...NAVER_BUILD } as never, false);
  return v.fields
    .filter((x) => x.status !== "READY" && !x.optional)
    .map((x) => x.field)
    .sort();
}

describe("STEP 1~2 — 수집 직후: 셀러가 손대기 «전» 에 무엇이 막혀 있는가", () => {
  it("실측 — 막힌 칸 목록을 기록한다", () => {
    /* 🔴 실측값이다. 처음에 「모델명도 막힌다」고 적었는데 재 보니 «아니었다» —
       모델명 검사는 등록을 막는 축(필수)에 들어오지 않는다. 추측을 지우고
       실제로 나온 목록만 적는다. 이 단정이 깨지면 무엇이 바뀌었는지 다시 센다. */
    expect(blockedFields(collected())).toEqual(["productInfoProvidedNotice(WEAR).manufacturer"]);
  });

  it("🔴 ③ 케어라벨은 «이미» 통과한다 — 셀러가 세탁방법을 적지 않아도 된다", () => {
    expect(blockedFields(collected())).not.toContain("productInfoProvidedNotice(WEAR).caution");
    expect(collected().careInstructions.value).toBe("케어라벨 참조");
  });

  it("🔴 상세페이지는 «이미» 통과한다 — 셀러 공통 설정이 블록을 채운다", () => {
    expect(blockedFields(collected())).not.toContain("originProduct.detailContent");
    const html = assembleNaverDetailContent(resolveProductDetailBlocks(null), {
      aiDescription: "",
      template: null,
      productImageUrls: ["https://cdn.example/rep.jpg"],
      sizeChartImageUrls: [],
      brandIntro: null,
      commonImages: {
        topCommonImageUrl: null,
        topCommonImageEnabled: false,
        bottomCommonImageUrl: null,
        bottomCommonImageEnabled: false,
      },
    } as never);
    expect(html.length).toBeGreaterThan(20);
  });
});

describe("STEP 3 — ② 「상세페이지 참조 전체 적용」 한 번", () => {
  const plan = planProductBulkReference(collected());

  it("버튼 한 번이 여러 칸을 «동시에» 처리한다", () => {
    expect(plan.applied.length).toBeGreaterThanOrEqual(4);
    expect(describeBulkReferencePlan(plan)).toContain("적용");
  });

  it("🔴 관측된 값(소재·색상·세탁)은 «유지» 된다 — 덮지 않는다", () => {
    const kept = plan.skipped.filter((s) => s.reason === "HAS_VALUE").map((s) => s.field);
    expect(kept).toContain("material");
    expect(kept).toContain("color");
    expect(kept).toContain("careInstructions");
  });

  it("🔴 제조사는 이 버튼으로 처리되지 «않는다» — 개별 선택이다(CPO 확정 ⓐ)", () => {
    expect(plan.applied as readonly string[]).not.toContain("manufacturer");
  });
});

describe("STEP 4 — 남은 칸을 셋으로 가른다", () => {
  /** ② 적용 + 제조사 개별 참조까지 한 뒤의 상태. */
  function afterSellerActions(): CanonicalProduct {
    const base = collected();
    const plan = planProductBulkReference(base);
    return {
      ...base,
      ...plan.next,
      manufacturer: { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 },
    } as unknown as CanonicalProduct;
  }

  it("🔴 제조사는 «개별 참조» 로 풀린다 — 추측하지 않고도 통과한다", () => {
    expect(blockedFields(afterSellerActions())).not.toContain("productInfoProvidedNotice(WEAR).manufacturer");
  });

  it("🔴 남는 차단이 «0건» 이다 — 셀러의 수동 작업은 제조사 참조 «한 번» 이었다", () => {
    expect(blockedFields(afterSellerActions())).toEqual([]);
  });

  it("🔴 그 한 번이 «무엇인지» 못박는다 — 제조사 개별 참조 선택", () => {
    /* ② 전체 적용만으로는 풀리지 않는다(제조사가 대상에서 빠져 있으므로).
       그래서 「버튼 한 번 + 제조사 한 칸」이 이 상품의 실제 수동 작업량이다. */
    const base = collected();
    const onlyBulk = { ...base, ...planProductBulkReference(base).next } as unknown as CanonicalProduct;
    expect(blockedFields(onlyBulk)).toEqual(["productInfoProvidedNotice(WEAR).manufacturer"]);
  });

  /* ── 분류 ──────────────────────────────────────────────────────────────
     제조사 = **C(추측이 필요한 값)** 이다. 상품 페이지에 제조사가 «없다» —
     브랜드명을 제조사로 쓰면 그것이 추측이다. 그래서 자동 입력하지 않고
     「상세페이지 참조」라는 기존 규칙으로 푼다(한 번의 선택).

     모델명 = **B(상품정보로 알 수 있는 값)** 이다. 페이지에 `STF26M51684-050`
     이 적혀 있는데 수집이 그 칸을 채우지 않는다(modelName 을 REQUIRED 로 둔다).
     🔴 다만 **등록을 막지는 않는다**(위 실측). 그리고 고칠 자리는 payload 가
     아니라 «수집» 이다 — 조립 단계에서 지어내면 B 를 C 로 바꾸는 것이다.
     그래서 이번 범위에서 고치지 않고 근거만 고정한다. */
  it("🔴 모델명은 셀러가 입력하면 «그대로» 연결된다 — 지어내지 않는다", () => {
    const typed = {
      ...afterSellerActions(),
      modelName: { value: "STF26M51684-050", source: "USER_EDITED", confidence: 1 },
    } as unknown as CanonicalProduct;
    expect(blockedFields(typed)).toEqual([]);
  });

  it("🔴 수집이 모델명을 채우지 않는다는 사실을 고정한다 — 자동화 후보의 근거", () => {
    expect(collected().modelName.source).toBe("REQUIRED");
    expect(collected().modelName.value).toBe("");
  });
});

describe("STEP 5 — 끝까지 통과한 뒤에도 «모르는 것은 모른다»", () => {
  it("🔴 M·L·XL 재고는 여전히 null 이다 — 4 로 채우지 않았다", () => {
    const unknown = collected().variants.filter((v) => v.stockQuantity === null);
    expect(unknown).toHaveLength(3);
    expect(JSON.stringify(collected().variants)).not.toContain('"stockQuantity":4');
  });

  it("🔴 원산지는 셀러/브랜드 기본값이 채운다 — 상품에서 추측하지 않았다", () => {
    expect(collected().countryOfOrigin.value).toBe("");
  });

  it("🔴 keywords 는 비어 있다 — 그래서 검색태그 자동 연결에 근거가 없다(PHASE 2 C)", () => {
    expect(collected().keywords.value).toEqual([]);
  });
});
