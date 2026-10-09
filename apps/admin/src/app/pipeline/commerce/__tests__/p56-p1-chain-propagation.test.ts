/**
 * ══════════════════════════════════════════════════════════════════════════
 *  P5.6 **P1 ⑨~⑫** — `canonical → 3채널 payload` 전파를 «실측값으로» 굳힌다
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 상상한 계약이 아니다. CPO 가 준 실제 두 상품을
 *    (tennis-warehouse / smallable) 라이브로 긁어 3채널 빌더까지 흘린 뒤
 *    «나온 값» 을 그대로 적은 것이다. 라이브 하니스는 지우고 결론만 남긴다.
 *
 * 실측이 잡은 결함 셋 — 이 가드가 지키는 것:
 *
 *   D2  상품명이 «두 벌» 이었다.
 *       화면(titleKo) "Louis Louise 여아 코튼 바지"
 *       payload       "Louis Louise 베이비 Holly Hearts Ribbed Velvet Baby Pants | Pale Pink"
 *       → 빌더가 N-3.77 로 다시 조립하고 상품정보의 한국어 상품명은 버렸다.
 *
 *   D3  `naverShoppingSearchInfo.modelName` 이 `undefined` 였다.
 *       빌더가 `USER_EDITED` «하나만» 받아, 원상품명(ORIGINAL)이 버려졌다.
 *
 *   D4  상품 재고가 옵션과 어긋났다 — 옵션 10×4 인데 상품 레벨은 **999**.
 *       `payloadStockQuantity` 가 판매자 기본 재고를 몰랐다.
 *
 * 🔴 음성 대조 — 보호를 되돌리면 이 파일이 실패해야 한다.
 */
import { describe, expect, it } from "vitest";
import {
  backfillCanonicalProduct,
  payloadStockQuantity,
  type CanonicalProduct,
  type FieldSource,
} from "@commerce/shared";
import { seedSeoContent } from "@commerce/content";
import { buildNaverProductPayload, mergeProductDetailBlocks } from "@commerce/listing";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";

const f = (value: string, source: FieldSource = "ORIGINAL") => ({ value, source, confidence: 0.9 });

/** 🔴 LOUIS 실측 — Smallable 은 옵션별 재고를 «공개하지 않는다». 그 상태 그대로 만든다. */
function louis(): CanonicalProduct {
  return backfillCanonicalProduct({
    id: "louis",
    sourceUrl: "https://www.smallable.com/en/product/holly-hearts-ribbed-velvet-baby-pants-pale-pink-louis-louise-441173",
    title: f("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink"),
    brand: f("Louis Louise"),
    description: f("Ribbed velvet baby pants for girls."),
    material: f("100% Cotton"),
    color: f("Pink"),
    countryOfOrigin: f("India"),
    price: { value: { amount: 59, currency: "EUR" }, source: "ORIGINAL", confidence: 0.9 },
    optionGroups: [{ name: "Size", values: ["6 months", "12 months", "18 months", "24 months"] }],
    variants: ["6 months", "12 months", "18 months", "24 months"].map((v, i) => ({
      id: `v${i}`,
      optionValues: { Size: v },
      /* 🔴 재고 «모름» — null/undefined 를 0 이나 999 로 바꾸지 않는다. */
      stockQuantity: undefined,
    })),
    stockQuantity: { value: 999, source: "DEFAULT", confidence: 0 },
    /* 🔴 `backfillCanonicalProduct` 가 모든 칸을 채워 주지 않는다 — 실측에서
       `recommendedAge.value` 로 터졌다. 비어 있는 상태를 «명시» 한다
       (fixture 를 깨끗하게 만들면 실제 상품의 공란을 놓친다). */
    recommendedAge: f("", "DEFAULT"),
    sku: f("", "DEFAULT"),
    itemName: f("", "DEFAULT"),
    modelName: f("", "DEFAULT"),
    weight: f("", "DEFAULT"),
    certificationType: f("", "DEFAULT"),
    manufacturer: f("", "DEFAULT"),
    importer: f("", "DEFAULT"),
    careInstructions: f("", "DEFAULT"),
    titleKo: f("", "DEFAULT"),
    descriptionKo: f("", "DEFAULT"),
    keywords: { value: [], source: "DEFAULT", confidence: 0 },
  } as never as CanonicalProduct);
}

const NAVER_ARGS = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: "1",
  refundAddressBookNo: "1",
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "1년",
  afterServiceDirector: "따져",
  afterServiceTelephoneNumber: "02-000-0000",
} as const;

function naverOf(product: CanonicalProduct) {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  return buildNaverProductPayload({ product, listing, ...NAVER_ARGS } as never) as never as {
    originProduct: {
      name: string;
      stockQuantity: number;
      detailAttribute?: {
        seoInfo?: { sellerTags?: { text: string }[] };
        naverShoppingSearchInfo?: { modelName?: string };
        optionInfo?: { optionCombinations?: { stockQuantity: number; optionName1?: string }[] };
      };
    };
  };
}

/* ══ D2 — 상품명은 «하나» 다 ═════════════════════════════════════════════ */
describe("D2 — 상품정보의 한국어 상품명이 그대로 payload 로 간다(두 벌 금지)", () => {
  const seeded = seedSeoContent(louis()).product;

  it("🔴 실측값 — titleKo 가 'Louis Louise 여아 코튼 바지' 로 채워진다", () => {
    expect(seeded.titleKo.value).toBe("Louis Louise 여아 코튼 바지");
  });

  it("🔴 payload 의 originProduct.name 이 titleKo 와 «글자 그대로» 같다", () => {
    expect(naverOf(seeded).originProduct.name).toBe(seeded.titleKo.value);
  });

  it("🔴 셀러가 상품명을 고치면 그 값이 간다 — 빌더가 다시 조립하지 않는다", () => {
    const edited = { ...seeded, titleKo: f("루이루이즈 아기 벨벳 바지", "USER_EDITED") };
    expect(naverOf(edited as CanonicalProduct).originProduct.name).toBe("루이루이즈 아기 벨벳 바지");
  });

  it("titleKo 가 비면 기존 N-3.77 생성기로 폴백한다(회귀 방지)", () => {
    const blank = { ...seeded, titleKo: { value: "", source: "DEFAULT" as FieldSource, confidence: 0 } };
    const name = naverOf(blank as CanonicalProduct).originProduct.name;
    expect(name.length).toBeGreaterThan(0);
    expect(name).toContain("Louis Louise");
  });

  it("🔴 100자 상한은 titleKo 경로에도 걸린다 — 한쪽만 자르면 그 경로에서만 거절된다", () => {
    const long = { ...seeded, titleKo: f(`${"가나다라마바사아자차카타파하 ".repeat(12)}끝`, "USER_EDITED") };
    expect(naverOf(long as CanonicalProduct).originProduct.name.length).toBeLessThanOrEqual(100);
  });
});

/* ══ D3 — 모델명이 payload 까지 «간다» ══════════════════════════════════ */
describe("D3 — 원상품명 모델명이 payload 에 닿는다(만들고 넘기지 않는 함정)", () => {
  const seeded = seedSeoContent(louis()).product;

  it("🔴 실측값 — 모델명이 원상품명 그대로 채워진다(지어내지 않는다)", () => {
    expect(seeded.modelName.value).toBe("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink");
    expect(seeded.modelName.source).toBe("ORIGINAL");
  });

  it("🔴 payload 의 naverShoppingSearchInfo.modelName 이 «undefined 가 아니다»", () => {
    const model = naverOf(seeded).originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName;
    expect(model).toBe("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink");
  });

  it("🔴 AI 가 만든 모델명은 «가지 않는다» — 임의 생성 금지의 실제 경계", () => {
    const ai = { ...seeded, modelName: f("LL-BABY-PANTS-001", "AI_GENERATED") };
    const model = naverOf(ai as CanonicalProduct).originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName;
    expect(model).toBeUndefined();
  });

  it("🔴 셀러 수정값을 덮지 않는다", () => {
    const edited = { ...louis(), modelName: f("STMRP-WH", "USER_EDITED") };
    const out = seedSeoContent(edited as CanonicalProduct);
    expect(out.product.modelName.value).toBe("STMRP-WH");
    expect(out.skipped).toContain("modelName");
  });
});

/* ══ D4 — 상품 재고와 옵션 합계가 어긋나지 않는다 ═══════════════════════ */
describe("D4 — 판매자 기본 재고가 상품 레벨에도 반영된다(999 재등장 금지)", () => {
  const base = seedSeoContent(louis()).product;

  it("🔴 실측 결함 — 기본값이 없으면 상품 레벨은 999(모름) 이고 옵션은 «등록되지 않는다»", () => {
    const nv = naverOf(base);
    expect(nv.originProduct.stockQuantity).toBe(999);
    expect(nv.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? []).toHaveLength(0);
  });

  it("🔴 기본 재고 10 을 적으면 옵션 4개 × 10 이고 상품 레벨은 40 이다 — 999 가 아니다", () => {
    const withDefault = { ...base, sellerDefaultStock: 10 } as CanonicalProduct;
    const nv = naverOf(withDefault);
    const combos = nv.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.map((c) => c.stockQuantity)).toEqual([10, 10, 10, 10]);
    expect(nv.originProduct.stockQuantity).toBe(40);
    /* 🔴 핵심 — 상품 레벨과 옵션 합계가 «같다». 전에는 999 vs 40 이었다. */
    expect(nv.originProduct.stockQuantity).toBe(combos.reduce((a, c) => a + c.stockQuantity, 0));
  });

  it("🔴 기본값에 999 를 적어도 «실제 수량으로 쓰지 않는다»", () => {
    const sneaky = { ...base, sellerDefaultStock: 999 } as CanonicalProduct;
    expect(payloadStockQuantity(sneaky)).toBe(999);
    expect(naverOf(sneaky).originProduct.detailAttribute?.optionInfo?.optionCombinations ?? []).toHaveLength(0);
  });

  it("🔴 기본값 0 — 품절은 «판매자가 적은 값» 이므로 그대로 쓴다(모름과 다르다)", () => {
    const zero = { ...base, sellerDefaultStock: 0 } as CanonicalProduct;
    const combos = naverOf(zero).originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.map((c) => c.stockQuantity)).toEqual([0, 0, 0, 0]);
    expect(naverOf(zero).originProduct.stockQuantity).toBe(0);
  });
});

/* ══ SEO 태그 — canonical → 3채널 ═══════════════════════════════════════ */
describe("SEO 태그가 3채널 payload 까지 끊기지 않는다", () => {
  const seeded = seedSeoContent(louis()).product;

  it("🔴 실측값 — 생성 태그가 상품 근거로만 조립된다", () => {
    expect(seeded.keywords.value).toEqual([
      "Louis Louise",
      "베이비 바지",
      "유아 바지",
      "여아 바지",
      "Louis Louise 베이비 바지",
      "Louis Louise 여아 바지",
      "코튼 바지",
      "베이비 코튼 바지",
    ]);
  });

  it("🔴 SmartStore sellerTags 에 그 값이 그대로 실린다", () => {
    const tags = naverOf(seeded).originProduct.detailAttribute?.seoInfo?.sellerTags?.map((t) => t.text);
    expect(tags).toEqual(seeded.keywords.value);
  });

  it("🔴 태그가 없으면 seoInfo 를 «만들지 않는다» — 빈 배열 전송은 삭제다", () => {
    const none = { ...seeded, keywords: { value: [], source: "DEFAULT" as FieldSource, confidence: 0 } };
    expect(naverOf(none as CanonicalProduct).originProduct.detailAttribute?.seoInfo).toBeUndefined();
  });
});

/* ══ ⑨ 상세페이지 블록 ═════════════════════════════════════════════════ */
describe("⑨ 상세페이지 블록 — 개별 Text/Image 추가가 살아남는다", () => {
  /* 🔴 셀러 기본값에 공통 안내 블록이 하나 있는 상태 — 상품별 override 가
     그것을 «수정» 하고, 새 블록을 «추가» 하는 두 동작을 한 번에 잰다.
     🔴 1차에 `AI_DESCRIPTION` 에 heading patch 를 걸고 실패라고 봤는데, 그 블록은
        제목을 갖지 않는다(applyPatch 는 CUSTOM_TEXT/CUSTOM_IMAGE 만 제목을 덮는다).
        내 단정이 틀린 것이지 결함이 아니었다. */
  const sellerDefault = [
    { kind: "AI_DESCRIPTION" },
    { kind: "CUSTOM_TEXT", heading: "배송 안내", content: "해외 배송은 7~14일 걸립니다.", enabled: true },
    { kind: "PRODUCT_IMAGES" },
  ] as never;
  const override = {
    added: [
      { kind: "CUSTOM_TEXT", heading: "사이즈 정보", content: "실측 사이즈는 상세 표를 참고하세요." },
      { kind: "CUSTOM_IMAGE", heading: "소재 안내", url: "https://cdn.example.com/fabric.jpg", caption: "원단 확대" },
    ],
    /* 🔴 반복 kind 의 순서 식별자는 «0 부터» 다 — 셀러 기본 블록이 `#0`,
       상품 override 가 «추가» 한 블록이 `#1` 이다(실측: `#1` 로 적었더니 추가
       블록에 patch 가 붙었다). 번호를 틀리면 조용히 «다른 블록» 을 고친다. */
    patches: { "CUSTOM_TEXT#0": { heading: "배송 안내(수정)", content: "통관 포함 10~15일." } },
  } as never;

  it("🔴 실측값 — 기본 블록 뒤에 Text/Image 추가 2개가 «붙는다»", () => {
    const merged = mergeProductDetailBlocks(sellerDefault, override) as { kind: string; heading?: string; content?: string }[];
    expect(merged.map((b) => b.kind)).toEqual([
      "AI_DESCRIPTION",
      "CUSTOM_TEXT",
      "PRODUCT_IMAGES",
      "CUSTOM_TEXT",
      "CUSTOM_IMAGE",
    ]);
    expect(merged[3]!.heading).toBe("사이즈 정보");
    expect(merged[4]!.heading).toBe("소재 안내");
  });

  it("🔴 기존 블록 «수정» 도 같은 override 로 반영된다", () => {
    const merged = mergeProductDetailBlocks(sellerDefault, override) as { heading?: string; content?: string }[];
    expect(merged[1]!.heading).toBe("배송 안내(수정)");
    expect(merged[1]!.content).toBe("통관 포함 10~15일.");
  });

  it("🔴 추가 블록은 셀러 기본값을 «바꾸지 않는다» — 원본 배열이 그대로다", () => {
    mergeProductDetailBlocks(sellerDefault, override);
    expect((sellerDefault as never as { heading?: string }[])[1]!.heading).toBe("배송 안내");
    expect(sellerDefault as never as unknown[]).toHaveLength(3);
  });

  it("🔴 저장 왕복(JSON) 후에도 값이 유지된다", () => {
    const reloaded = JSON.parse(JSON.stringify(override)) as never;
    expect(mergeProductDetailBlocks(sellerDefault, reloaded)).toEqual(
      mergeProductDetailBlocks(sellerDefault, override),
    );
  });

  it("무편집이면 셀러 기본값 «그 객체» 가 그대로 나온다", () => {
    expect(mergeProductDetailBlocks(sellerDefault, null)).toBe(sellerDefault);
  });
});
