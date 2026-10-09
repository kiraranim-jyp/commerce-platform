import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { variantStockWithSellerDefault, variantsWithUnknownStock } from "@commerce/shared";
import {
  extractSeasonCode,
  generateSeoKeywords,
  seedSeoContent,
  seoKeywordAxes,
  suggestKoreanProductName,
  suggestModelName,
} from "@commerce/content";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "@commerce/listing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P0(CPO 추가 작업지시, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   1 재고 UNKNOWN → 판매자 기본 재고        4 한국어 SEO 상품명
 *   2 SEO 태그 품질                          5 해외 원상품명 기반 모델명
 *   7 원산지 직접 입력 UX                    8 USER_EDITED 원산지 보호
 *
 * ── 🔴 fixture 는 «실측» 이다 ─────────────────────────────────────────────
 * CPO 가 준 두 URL 을 운영 함수(`universalExtract` → `buildCanonicalProduct`)로
 * 실제 수집해 나온 값을 그대로 쓴다. 손으로 다듬은 깨끗한 값으로 재면
 * 「브랜드 한글명·시즌이 없다」는 사실을 놓친다.
 *
 *   TACCHINI      title "Sergio Tacchini Men's Racchetto Polo"
 *                 brand "Sergio Tacchini" · 소재 "100% Polyester"
 *                 색상 "Brilliant White"  · adult/men · 옵션 M·L·XL·XXL
 *   LOUIS LOUISE  title "Holly Hearts Ribbed Velvet Baby Pants | Pale Pink"
 *                 brand "Louis Louise"   · 소재 "100% Cotton"
 *                 색상 "Pink" · baby/girl · 원산지 "India"
 *                 breadcrumb Home > Fashion Baby > Girl > Trousers…
 *                 🔴 재고를 «한 칸도» 주지 않는다
 */

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => readFileSync(join(__dirname, "../../../../../../..", rel), "utf8");
const f = <T,>(v: T, s: FieldSource = "ORIGINAL"): ProvenanceField<T> => ({ value: v, source: s, confidence: 0.9 });

function base(over: Record<string, unknown>): CanonicalProduct {
  return {
    sourceUrl: "https://x/p",
    titleKo: f(""),
    priceValidity: "VALID",
    price: f({ amount: 45, currency: "EUR" }),
    descriptionKo: f(""),
    /* 🔴 base 에 material 이 없어서 일부 케이스가 undefined 로 터졌다 — 실제
       CanonicalProduct 는 이 칸을 «항상» 갖는다(REQUIRED 라도 객체가 있다). */
    material: f(""),
    description: f(""),
    color: f(""),
    recommendedAge: f(""),
    careInstructions: f(""),
    options: f([]),
    optionGroups: [],
    variants: [],
    images: [
      {
        id: "i",
        originalUrl: "https://x/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    keywords: f([]),
    seoTitle: f(""),
    seoDescription: f(""),
    countryOfOrigin: f(""),
    returnPolicy: f(""),
    shippingFee: f(0),
    stockQuantity: f(999, "DEFAULT"),
    certification: f(""),
    importer: f(""),
    itemName: f(""),
    modelName: f(""),
    weight: f(""),
    certificationType: f(""),
    childCertification: f(null),
    manufacturer: f(""),
    sku: f(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...over,
  } as unknown as CanonicalProduct;
}

/** 🔴 실측값 그대로 — tennis-warehouse. */
const TACCHINI = () =>
  base({
    title: f("Sergio Tacchini Men's Racchetto Polo"),
    brand: f("Sergio Tacchini"),
    sku: f("STMRPWH2"),
    material: f("100% Polyester"),
    color: f("Brilliant White"),
    description: f(
      "Overview Key Features Moisture Wicking The Sergio Tacchini Men's Racchetto Polo serves up court style that transitions easily to the clubhouse. This lightweight pique polo has a contrast three-button placket with rib-knit collar.",
    ),
    optionGroups: [{ name: "사이즈", values: ["M", "L", "XL", "XXL"] }],
    variants: [
      { id: "m", optionValues: { 사이즈: "M" } },
      { id: "l", optionValues: { 사이즈: "L" } },
    ],
  });

/** 🔴 실측값 그대로 — smallable. 재고는 한 칸도 없다. */
const LOUIS = () =>
  base({
    title: f("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink"),
    brand: f("Louis Louise"),
    sku: f("AAA1847110"),
    material: f("100% Cotton"),
    color: f("Pink"),
    countryOfOrigin: f("India"),
    description: f(
      "Description Material: Corduroy. Baby pants in powder pink corduroy. They feature two heart-shaped patches on the knees printed with floral motifs. Their soft, slightly flared cut includes an elastic waistband for easy dressing.",
    ),
    breadcrumbPath: ["Home", "Fashion  Baby", "Girl", "Trousers, Jeans, Leggings, Jogging Bottoms"],
    optionGroups: [{ name: "사이즈", values: ["6 months", "12 months", "18 months", "24 months"] }],
    variants: [
      { id: "a", optionValues: { 사이즈: "6 months" } },
      { id: "b", optionValues: { 사이즈: "12 months" } },
    ],
  });

describe("② 🔴 SEO 태그 — 속성 나열에서 검색 의도형으로", () => {
  it("🔴 성별·연령 축을 «쓴다» — 그것이 비어 있던 것이 결함이었다", () => {
    const ax = seoKeywordAxes(LOUIS());
    expect(ax.ageLabels).toContain("베이비");
    expect(ax.genderLabels).toContain("여아");
    expect(ax.koreanType).toBe("바지");
    expect(ax.materialKo).toBe("코튼");
  });

  it("LOUIS LOUISE — 의도형 조합이 나온다", () => {
    const tags = generateSeoKeywords(LOUIS());
    for (const want of ["Louis Louise", "여아 바지", "베이비 바지", "코튼 바지", "Louis Louise 여아 바지"]) {
      expect(tags, `「${want}」가 없다`).toContain(want);
    }
  });

  it("🔴 속성 나열이 사라졌다 — 영문 타입·원문 소재를 태그로 내지 않는다", () => {
    const tags = generateSeoKeywords(LOUIS());
    for (const junk of ["pants", "100% Cotton", "바지"]) {
      expect(tags, `속성 나열(${junk})이 남아 있다`).not.toContain(junk);
    }
  });

  it("TACCHINI — polo 를 셔츠로 읽는다(제목에 있는 말이다)", () => {
    const tags = generateSeoKeywords(TACCHINI());
    expect(tags).toContain("남성 셔츠");
    expect(tags).toContain("Sergio Tacchini 남성 셔츠");
  });

  it("🔴 브랜드 한글명을 «만들지 않는다» — 두 상품 모두 데이터에 없다", () => {
    for (const p of [TACCHINI(), LOUIS()]) {
      const tags = generateSeoKeywords(p);
      for (const t of tags) {
        /* 한글 브랜드명을 지어냈다면 브랜드 축에 한글이 섞인다. */
        expect(t.includes("루이스") || t.includes("세르지오"), `임의 번역(${t})이 생겼다`).toBe(false);
      }
    }
  });

  it("🔴 시즌을 «만들지 않는다» — 두 상품 모두 원문에 없다", () => {
    expect(extractSeasonCode(TACCHINI())).toBeUndefined();
    expect(extractSeasonCode(LOUIS())).toBeUndefined();
    for (const t of [...generateSeoKeywords(TACCHINI()), ...generateSeoKeywords(LOUIS())]) {
      expect(/\d{2}\s?(SS|AW|FW)|(SS|AW|FW)\s?\d{2}/i.test(t), `시즌(${t})을 지어냈다`).toBe(false);
    }
  });

  it("🟢 원문에 시즌이 «있으면» 쓴다 — 없을 때만 비운다", () => {
    const withSeason = base({
      title: f("Bobo Choses AW26 Knit"),
      brand: f("Bobo Choses"),
      material: f("100% Cotton"),
      description: f("Product code B226AC010 AW26 Made in Portugal."),
    });
    expect(extractSeasonCode(withSeason)).toBe("AW26");
    expect(generateSeoKeywords(withSeason)).toContain("Bobo Choses AW26");
  });

  it("🔴 상품군을 모르면 «홀로 선» 약한 태그를 내지 않는다", () => {
    const unknownType = base({ title: f("Mystery Item"), brand: f("Acme"), material: f("100% Cotton") });
    expect(seoKeywordAxes(unknownType).koreanType).toBeUndefined();
    expect(generateSeoKeywords(unknownType)).toEqual(["Acme"]);
  });

  it("🔴 동점이면 상품군을 비운다 — dressing→Dress · hat→Hat 오탐 방어", () => {
    const tied = base({
      title: f("Item"),
      brand: f("Acme"),
      material: f(""),
      description: f("easy dressing. that hat."),
    });
    expect(seoKeywordAxes(tied).koreanType).toBeUndefined();
  });

  it("🔴 성별이 unknown 이면 성별 축을 비운다 — 남아를 여아로 적지 않는다", () => {
    const ax = seoKeywordAxes(base({ title: f("Cotton Pants"), brand: f("Acme"), material: f("100% Cotton") }));
    expect(ax.genderLabels).toEqual([]);
  });

  it("🔴 「검색량이 높다」고 주장하지 않는다 — 코드에 그 말이 없다", () => {
    /* 🔴 «주석을 벗기고» 본다 — 이 저장소가 여덟 번 걸린 함정이고, 실제로
       1차에 내 주석(「검색량이 높은 키워드라고 말하지 않는다」)이 걸렸다. */
    const src = strip(read("packages/content/src/seo-keywords.ts"));
    for (const bad of ["검색량", "인기 검색어", "trending", "searchVolume"]) {
      expect(src, `「${bad}」를 코드가 주장한다`).not.toContain(bad);
    }
  });
});

describe("④⑤ 🔴 상품명(한국 검색용) · 모델명(해외 원문)", () => {
  it("상품명은 확인된 축만 조합한다", () => {
    /* ══ 🔴 P5.6 후속 P0-2(CPO 확정, 2026-10-10) — **규칙이 바뀌었다.** ══════

       전 규칙: 속성만으로 다시 조립    → "Louis Louise 여아 코튼 바지"
       새 규칙: 브랜드 + 원상품 핵심어 + 한국어 보정어

       CEO 실화면 판정: 속성 조합은 SEO 로는 맞아도 «상품 식별력이 없다».
       「여아 코튼 바지」는 수천 개 상품의 이름이 될 수 있다.
       🔴 소재·색상은 «보조» 검색정보이고 모델 식별자를 대체하지 않는다 —
          그래서 소재를 상품명에서 빼고 태그로만 남긴다. */
    expect(suggestKoreanProductName(LOUIS())).toBe("Louis Louise Holly Hearts Ribbed Velvet Baby Pants 여아 바지");
    expect(suggestKoreanProductName(TACCHINI())).toBe("Sergio Tacchini Racchetto Polo 남성 셔츠");
  });

  it("🔴 연령과 성별을 «둘 다» 넣지 않는다 — 「베이비 여아」는 사람이 치는 말이 아니다", () => {
    const name = suggestKoreanProductName(LOUIS()) ?? "";
    expect(name).toContain("여아");
    expect(name).not.toContain("베이비");
  });

  it("🔴 상품군을 모르면 원상품명을 그대로 — 억지 한국어 제목을 만들지 않는다", () => {
    const unknownType = base({ title: f("Mystery Item"), brand: f("Acme"), material: f("") });
    /* 🔴 상품군을 모르면 «한국어 보정어를 붙이지 않는다» — 틀린 상품군을 붙이면
       검색이 아니라 오분류다. 다만 브랜드는 원문 근거이므로 앞에 남는다
       (P0-2 새 규칙의 첫 토막이고, 지어낸 값이 아니다). */
    expect(suggestKoreanProductName(unknownType)).toBe("Acme Mystery Item");

    /* 🔴 음성 대조 — 속성(소재)이 상품명에 «들어가지 않는다». 전 규칙의 흔적이
       남아 있으면 이 단정이 깨진다. */
    expect(suggestKoreanProductName(LOUIS())).not.toContain("코튼");
    /* 🔴 그리고 원상품의 핵심 식별어는 «반드시» 남는다. */
    expect(suggestKoreanProductName(LOUIS())).toContain("Holly Hearts");
  });

  it("🔴 모델명은 «원상품명» 이다 — SKU 가 아니다", () => {
    expect(suggestModelName(LOUIS())).toBe("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink");
    expect(suggestModelName(TACCHINI())).toBe("Sergio Tacchini Men's Racchetto Polo");
    /* 실측 SKU 는 STMRPWH2 · AAA1847110 — 둘 다 모델명이 아니다. */
    expect(suggestModelName(LOUIS())).not.toBe("AAA1847110");
    expect(suggestModelName(TACCHINI())).not.toBe("STMRPWH2");
  });

  it("🔴 원문이 없으면 «비워 둔다» — 임의 생성 금지", () => {
    expect(suggestModelName(base({ title: f(""), brand: f("Acme"), material: f("") }))).toBeUndefined();
  });

  it("🔴 모델명 생성기가 sku·url 을 «보지 않는다»", () => {
    const src = strip(read("packages/content/src/seo-keywords.ts"));
    const at = src.indexOf("export function suggestModelName");
    const body = src.slice(at, at + 300);
    for (const bad of ["sku", "sourceUrl", "id"]) {
      expect(body, `모델명이 ${bad} 를 본다`).not.toContain(bad);
    }
  });

  it("상품명이 생성 시점에 채워지고 셀러 수정값은 덮지 않는다", () => {
    expect(seedSeoContent(LOUIS()).product.titleKo.value).toBe("Louis Louise Holly Hearts Ribbed Velvet Baby Pants 여아 바지");
    const edited = { ...LOUIS(), titleKo: f("내가 정한 이름", "USER_EDITED") } as CanonicalProduct;
    expect(seedSeoContent(edited).product.titleKo.value).toBe("내가 정한 이름");
  });
});

describe("① 🔴 재고 — 판매자 기본값은 실측을 덮지 않는다", () => {
  it("실측이 있으면 기본값을 «무시» 한다", () => {
    const p = { ...LOUIS(), sellerDefaultStock: 10 } as CanonicalProduct;
    expect(variantStockWithSellerDefault(p, { stockQuantity: 3 })).toBe(3);
  });

  it("모르는 옵션에만 적용된다", () => {
    const p = { ...LOUIS(), sellerDefaultStock: 10 } as CanonicalProduct;
    expect(variantStockWithSellerDefault(p, { stockQuantity: undefined })).toBe(10);
  });

  it("🔴 기본값이 없으면 null 이다 — 0 으로 메우지 않는다", () => {
    expect(variantStockWithSellerDefault(LOUIS(), { stockQuantity: undefined })).toBeNull();
  });

  it("🔴 999 는 판매자 기본값으로도 허용하지 않는다", () => {
    const p = { ...LOUIS(), sellerDefaultStock: 999 } as CanonicalProduct;
    expect(variantStockWithSellerDefault(p, {})).toBeNull();
  });

  it("음수·NaN 을 쓰지 않는다", () => {
    for (const bad of [-1, Number.NaN]) {
      const p = { ...LOUIS(), sellerDefaultStock: bad } as CanonicalProduct;
      expect(variantStockWithSellerDefault(p, {})).toBeNull();
    }
  });

  it("🔴 기본값을 적으면 「재고 모름」이 사라진다 — 화면과 payload 가 같은 말을 한다", () => {
    expect(variantsWithUnknownStock(LOUIS()).length).toBe(2);
    const p = { ...LOUIS(), sellerDefaultStock: 10 } as CanonicalProduct;
    expect(variantsWithUnknownStock(p)).toEqual([]);
  });

  it("🔴 그 값이 실제 payload 에 실린다 — Smallable 이 등록 가능해진다", () => {
    const p = { ...LOUIS(), sellerDefaultStock: 10 } as CanonicalProduct;
    const payload = buildNaverProductPayload({
      product: p,
      listing: PLATFORM_ADAPTERS.smartstore.toListingModel(p, UNRESOLVED_CATEGORY, undefined, "smartstore"),
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
      afterServiceDirector: "a",
      afterServiceTelephoneNumber: "02-0-0",
      childCertificationInfoId: 1041,
      categoryRequiresChildCertification: true,
    } as never) as unknown as {
      originProduct: { detailAttribute?: { optionInfo?: { optionCombinations?: { stockQuantity: number }[] } } };
    };
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.length, "기본값을 적었는데도 옵션이 빠졌다").toBe(2);
    for (const c of combos) expect(c.stockQuantity).toBe(10);
  });

  it("🔴 세 채널이 같은 함수를 본다", () => {
    for (const ch of ["naver", "coupang", "lotteon"]) {
      expect(strip(read(`packages/listing/src/${ch}/build-payload.ts`))).toContain(
        "variantStockWithSellerDefault(product, variant)",
      );
    }
  });

  it("🔴 저장 자리가 stockQuantity 와 «따로» 다", () => {
    const types = strip(read("packages/shared/src/product-types.ts"));
    expect(types).toContain("sellerDefaultStock?: number;");
    const master = strip(read("packages/shared/src/master-product.ts"));
    expect(master).toContain('sellerDefaultStock: "MASTER_VARIANTS"');
  });

  it("🔴 화면 입력칸이 «상품정보» 에 있다 — 커머스 탭이 아니다", () => {
    const sv = strip(read("apps/admin/src/app/pipeline/commerce/SourceDataView.tsx"));
    expect(sv).toContain("onUpdateSellerDefaultStock");
    /* 🔴 P5.6 후속 P0-1(CEO 실화면 FAIL, 2026-10-10) — 라벨이 「기본 재고 수량」
       으로 «띄어쓰기와 함께» 제목으로 승격됐다. 전에는 「재고를 모르는 옵션 N개 —
       기본 재고수량」 한 줄이어서 경고문으로 읽혔고, CEO 는 입력칸을 찾지 못했다. */
    expect(sv).toContain("기본 재고 수량");
    /* 🔴 그리고 «조건부가 아니다» — 재고를 모르는 옵션이 생기기 전에도 보인다.
       전에는 `variantsWithUnknownStock(product).length > 0` 에 가려져 있었다. */
    expect(sv).not.toContain("onUpdateSellerDefaultStock && variantsWithUnknownStock(product).length > 0");
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    expect(pv, "커머스 탭에 재고 기본값 입력칸이 생겼다").not.toContain("onUpdateSellerDefaultStock");
  });

  it("🔴 빈 값은 «지운다» — 0 으로 바꾸지 않는다", () => {
    const ws = strip(read("apps/admin/src/app/pipeline/CommerceWorkspace.tsx"));
    expect(ws).toContain("onUpdateSellerDefaultStock");
    const sv = strip(read("apps/admin/src/app/pipeline/commerce/SourceDataView.tsx"));
    expect(sv).toContain('v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : n');
  });
});

describe("⑦⑧ 🔴 원산지 — 직접 입력이 막다른 길이 아니다", () => {
  const PV = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));

  it("공식몰 확인 옆에 직접 입력 안내가 있다", () => {
    expect(PV).toContain("공식몰에서 확인되지 않으면 위 칸에 직접 적어 주세요");
  });

  it("🔴 판매자 입력값이면 자동 수집이 덮지 않는다고 «말한다»", () => {
    expect(PV).toContain('product.countryOfOrigin.source === "USER_EDITED"');
    expect(PV).toContain("자동 수집이 덮지 않습니다");
  });

  it("🔴 복원 시딩이 원산지를 «건드리지 않는다»", () => {
    const seed = strip(read("packages/content/src/seed-seo-content.ts"));
    expect(seed, "시딩이 원산지를 덮는다").not.toContain("countryOfOrigin");
  });

  it("🔴 브랜드 국가를 제조국으로 올리지 않는다 — 기존 경계 유지", () => {
    const shared = strip(read("packages/shared/src/product-types.ts"));
    expect(shared).not.toContain("manufacturingCountry");
    for (const f2 of ["origin.ts", "manufacturer.ts", "logistics.ts"]) {
      expect(strip(read(`packages/listing/src/common/${f2}`))).not.toContain("MANUFACTURING_COUNTRY");
    }
  });

  it("🔴 사이트별 크롤러를 더하지 않았다 — 공식몰 fetch 는 여전히 한 곳 1회", () => {
    const os = strip(read("packages/crawler/src/official-site-origin.ts"));
    expect((os.match(/fetchHtmlDirect\(/g) ?? []).length).toBe(1);
    expect(os, "테니스 사이트 전용 분기가 생겼다").not.toContain("tennis");
  });
});
