// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { resolveSourceStock, variantStockForPayload, variantsWithUnknownStock } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { seedSeoContent } from "@commerce/content";
import { buildNaverProductPayload, resolveKcStatus, validateNaverPayload } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 재오픈 3건(CPO, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   ① 재고 — 옵션 제거는 PASS, 재고가 FAIL. variant별 재고를 정상 연결
 *   ③ 태그 — 상품정보에서 원본을 못 가져오고 payload 에도 안 감
 *   ④ KC — 상태 변경은 PASS, «클릭 즉시 등록 팝업» 이 FAIL
 */

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => readFileSync(join(__dirname, "../../../../../../..", rel), "utf8");
const f = <T,>(v: T, s: FieldSource = "ORIGINAL"): ProvenanceField<T> => ({ value: v, source: s, confidence: 0.9 });

/** 옵션 3개 중 하나가 재고를 «모르는» 실측 모양(Smallable 류). */
function makeProduct(over: Record<string, unknown> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://x/p",
    title: f("T"),
    titleKo: f("티셔츠"),
    brand: f("Bobo Choses"),
    price: f({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: f("S"),
    description: f("Multicolor t-shirt. 100% Cotton."),
    descriptionKo: f(""),
    material: f("코튼 100%"),
    color: f("블루"),
    recommendedAge: f(""),
    manufacturer: f("Bobo Choses"),
    careInstructions: f(""),
    options: f(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["2Y", "3Y", "4Y"] }],
    variants: [
      { id: "v1", optionValues: { 사이즈: "2Y" }, stockQuantity: 3 },
      { id: "v2", optionValues: { 사이즈: "3Y" }, stockQuantity: 0 },
      { id: "v3", optionValues: { 사이즈: "4Y" } },
    ],
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
    countryOfOrigin: f("스페인"),
    returnPolicy: f(""),
    shippingFee: f(0),
    stockQuantity: f(999, "DEFAULT"),
    certification: f(""),
    importer: f("i"),
    itemName: f("n"),
    modelName: f("M"),
    weight: f("1g"),
    certificationType: f(""),
    childCertification: f(null),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...over,
  } as unknown as CanonicalProduct;
}

const ARGS = {
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
} as const;

interface NaverShape {
  originProduct: {
    stockQuantity: number;
    detailAttribute?: {
      optionInfo?: { optionCombinations?: { stockQuantity: number; optionName1?: string }[] };
      seoInfo?: { sellerTags?: { text: string }[] };
    };
  };
}

const naverOf = (p: CanonicalProduct): NaverShape =>
  buildNaverProductPayload({
    product: p,
    listing: PLATFORM_ADAPTERS.smartstore.toListingModel(p, UNRESOLVED_CATEGORY, undefined, "smartstore"),
    ...ARGS,
  } as never) as unknown as NaverShape;

function kcValidationOf(product: CanonicalProduct) {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const base = validateNaverPayload(
    buildNaverProductPayload({ product, listing, ...ARGS } as never),
    { product, ...ARGS, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false } as never,
    true,
  );
  return {
    ...base,
    kcStatus: resolveKcStatus({
      categoryVerified: true,
      categoryRequiresChildCertification: true,
      childCertification: product.childCertification,
    }),
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mountChannel(platform: "smartstore" | "coupang", extra: Record<string, unknown> = {}) {
  const product = (extra.product as CanonicalProduct) ?? makeProduct();
  await act(async () => {
    root.render(
      createElement(PlatformPreview, {
        manufacturerResolution: manufacturerFixture(),
        product,
        listing: PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform),
        categoryCandidates: [],
        listingStatus: "DRAFT" as const,
        listingResult: null,
        productOptionGroups: product.optionGroups,
        onFixTextField: () => {},
        onSetFieldReference: () => {},
        onSelectCategory: () => {},
        onOpenListingModal: () => {},
        onRetryListing: () => {},
        developerMode: false,
        ...extra,
      } as never),
    );
  });
  await act(async () => {
    expandAllSections(container);
  });
}

const flat = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

describe("① 🔴 재고 — 999 를 날조하지 않고 variant별로 연결한다", () => {
  it("🔴🔴 모르는 옵션에 999 가 «들어가지 않는다» — 운영 빌더 실측으로 잡은 결함", () => {
    const combos = naverOf(makeProduct()).originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    for (const c of combos) {
      expect(c.stockQuantity, `옵션 ${c.optionName1} 에 ${c.stockQuantity} 가 들어갔다`).not.toBe(999);
    }
  });

  it("🔴 모르는 옵션은 payload 에서 «빠진다» — 0 으로 메우지 않는다", () => {
    const combos = naverOf(makeProduct()).originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.map((c) => c.optionName1)).toEqual(["2Y", "3Y"]);
    expect(combos.map((c) => c.stockQuantity)).toEqual([3, 0]);
  });

  it("🔴 상품 재고와 옵션 합이 어긋나지 않는다 — 전에는 3 vs 1002 였다", () => {
    const pl = naverOf(makeProduct());
    const combos = pl.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    const sum = combos.reduce((a, c) => a + c.stockQuantity, 0);
    expect(sum).toBe(pl.originProduct.stockQuantity);
  });

  it("🔴 폴백이 «순환» 이 아니다 — 옵션 합계를 다시 옵션에 넣지 않는다", () => {
    /* 1차 수정은 resolvedPayloadStock 으로 내려가 모름 칸에 «합계 3» 을 넣었고
       payload 합이 6 으로 늘었다. 상품 레벨 «실측» 만 봐야 한다. */
    expect(variantStockForPayload(makeProduct(), { stockQuantity: undefined })).toBeNull();
    const withProductStock = makeProduct({ stockQuantity: f(12, "ORIGINAL") });
    expect(variantStockForPayload(withProductStock, { stockQuantity: undefined })).toBe(12);
  });

  it("🔴 999(DEFAULT 표시값)는 실측이 아니다", () => {
    expect(variantStockForPayload(makeProduct({ stockQuantity: f(999, "ORIGINAL") }), {})).toBeNull();
  });

  it("단일 상품은 기존 기본 재고를 그대로 쓴다", () => {
    const single = makeProduct({
      optionGroups: [],
      variants: [],
      options: f([]),
      stockQuantity: f(12, "ORIGINAL"),
    });
    expect(resolveSourceStock(single).quantity).toBe(12);
    expect(naverOf(single).originProduct.stockQuantity).toBe(12);
  });

  it("🔴 세 채널이 «같은 함수» 를 본다 — 한쪽만 고치면 또 갈라진다", () => {
    for (const ch of ["naver", "coupang", "lotteon"]) {
      expect(
        strip(read(`packages/listing/src/${ch}/build-payload.ts`)),
        `${ch} 가 자기 폴백을 쓴다`,
      /* 🔴 P5.6 P0-1 — 판매자 기본 재고를 포함하는 함수로 올렸다.
         `variantStockWithSellerDefault` 가 `variantStockForPayload` 를 먼저 보고,
         null 일 때만 판매자가 적은 기본값으로 내려간다 — 실측을 덮지 않는다. */
      ).toContain("variantStockWithSellerDefault(product, variant)");
    }
  });

  /* ══ 🔴 음성 대조 X5 가 «통과했다» — 그래서 이 단언을 고쳤다 ═══════════════
     「목록을 `hidden` 으로 숨긴다」로 변이했더니 통과했다. jsdom 에서 CSS 는
     적용되지 않으므로 숨긴 요소의 글자도 textContent 에 그대로 남는다 —
     텍스트만 보는 단언은 「보인다」를 증명하지 못한다.
     🔴 그래서 구조를 센다: 옵션 수만큼 줄이 있고, 각 줄이 조합명과 재고를 짝으로
        갖는지. 숨기거나 지우면 줄 수가 달라져 FAIL 한다. */
  it("🔴 화면이 variant별 재고를 적는다 — 합계 한 줄이 전부가 아니다", async () => {
    await mountChannel("smartstore");
    const region = container.querySelector("#section-options");
    const rows = Array.from(region?.querySelectorAll("ul:not(.hidden) > li") ?? []).map((li) => flat(li));
    expect(rows.length, `옵션별 재고 줄이 ${rows.length}개 — 단품 3개여야 한다`).toBe(3);
    expect(rows[0]).toContain("2Y");
    expect(rows[0]).toContain("3개");
    expect(rows[1]).toContain("3Y");
    expect(rows[2], "모르는 옵션을 숨겼다").toContain("재고 모름");
  });

  it("🔴 빠지는 사실을 숨기지 않는다", async () => {
    await mountChannel("smartstore");
    expect(flat(container.querySelector("#section-options"))).toContain("등록에서 제외됩니다");
  });

  /* ══ 🔴 CPO 가 지정한 테스트 대상(Smallable)에서 ①이 헛돌 뻔했다 ═════════

     앞선 수정은 `fact.from === "VARIANTS"`(옵션 중 하나라도 실측)일 때만 옵션별
     재고를 그렸다. 그런데 Smallable 은 재고를 «한 칸도» 주지 않는다
     (smallable-size-options.ts:90). 실측:

       resolveSourceStock → from "NONE" · UNKNOWN
       옵션별 재고 줄      → 0개
       화면               「원본 재고 미확인 — 직접 입력」 한 줄

     시나리오의 「2Y → 3 / 4Y → 재고 모름」이 아예 나오지 않는 상태였다.
     기준을 「옵션이 있는가」로 바꿨다. */
  it("🔴🔴 전부 재고 모름(Smallable)에서도 옵션별 줄을 그린다", async () => {
    const allUnknown = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "2Y" } },
        { id: "v2", optionValues: { 사이즈: "3Y" } },
        { id: "v3", optionValues: { 사이즈: "4Y" } },
      ],
    });
    expect(resolveSourceStock(allUnknown).from).toBe("NONE");
    expect(variantsWithUnknownStock(allUnknown)).toEqual(["2Y", "3Y", "4Y"]);
    await mountChannel("smartstore", { product: allUnknown });
    const region = container.querySelector("#section-options");
    const rows = Array.from(region?.querySelectorAll("ul > li") ?? []).map((li) => flat(li));
    expect(rows.length, `옵션별 줄이 ${rows.length}개 — 3개여야 한다`).toBe(3);
    for (const r of rows) expect(r).toContain("재고 모름");
  });

  it("🔴 전부 모를 때 「합계 0개」라고 적지 않는다 — 모름과 품절은 다른 사실이다", async () => {
    const allUnknown = makeProduct({
      variants: [{ id: "v1", optionValues: { 사이즈: "2Y" } }, { id: "v2", optionValues: { 사이즈: "3Y" } }],
    });
    await mountChannel("smartstore", { product: allUnknown });
    const t = flat(container.querySelector("#section-options"));
    expect(t).not.toContain("합계 0개");
    expect(t).toContain("원본이 옵션별 재고를 공개하지 않습니다");
  });

  it("🔴 접힘 요약이 본문과 같은 말을 한다 — 접은 셀러만 틀린 안내를 받지 않게", async () => {
    const allUnknown = makeProduct({
      variants: [{ id: "v1", optionValues: { 사이즈: "2Y" } }, { id: "v2", optionValues: { 사이즈: "3Y" } }],
    });
    await mountChannel("smartstore", { product: allUnknown });
    const summary = flat(container.querySelector("#section-options > button"));
    expect(summary).toContain("재고 모름");
    expect(summary, "요약이 아직 「직접 입력」이라고 말한다").not.toContain("직접 입력");
  });

  it("대조군 — 전부 실측이면 그 안내를 띄우지 않는다", async () => {
    const all = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "2Y" }, stockQuantity: 3 },
        { id: "v2", optionValues: { 사이즈: "3Y" }, stockQuantity: 5 },
      ],
    });
    expect(variantsWithUnknownStock(all)).toEqual([]);
    await mountChannel("smartstore", { product: all });
    expect(flat(container.querySelector("#section-options"))).not.toContain("등록에서 제외됩니다");
  });
});

describe("③ 🔴 태그 — 저장된 상품도 채운다", () => {
  it("🔴🔴 복원 지점이 seed 를 «통과» 한다 — 생성만 지나던 것이 CEO 가 본 결함", () => {
    const page = strip(read("apps/admin/src/app/pipeline/page.tsx"));
    expect(page).toContain("seedSeoContent(backfillCanonicalProduct(ws.canonicalProduct)).product");
    expect(page).toContain("seedSeoContent(event.canonicalProduct).product");
  });

  it("저장된 스냅샷 모양(keywords 빈 배열 · ORIGINAL)에서 채워진다", () => {
    const restored = seedSeoContent(makeProduct()).product;
    expect(restored.keywords.value.length).toBeGreaterThan(0);
    expect(restored.keywords.value).toContain("Bobo Choses");
  });

  it("🔴 멱등 — 같은 스냅샷을 여러 번 열어도 태그가 늘지 않는다", () => {
    const once = seedSeoContent(makeProduct()).product;
    const twice = seedSeoContent(once).product;
    const thrice = seedSeoContent(twice).product;
    expect(thrice.keywords.value).toEqual(once.keywords.value);
  });

  it("🔴 셀러가 고친 태그는 복원에서도 덮지 않는다", () => {
    const edited = makeProduct({ keywords: f(["내 태그"], "USER_EDITED") });
    expect(seedSeoContent(edited).product.keywords.value).toEqual(["내 태그"]);
  });

  it("그 값이 네이버 sellerTags payload 까지 간다", () => {
    const seeded = seedSeoContent(makeProduct()).product;
    const tags = naverOf(seeded).originProduct.detailAttribute?.seoInfo?.sellerTags ?? [];
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.map((t) => t.text)).toContain("Bobo Choses");
  });

  it("🔴 세 채널이 같은 중복제거를 쓴다 — 롯데ON 까지", () => {
    for (const ch of ["naver", "coupang", "lotteon"]) {
      expect(
        strip(read(`packages/listing/src/${ch}/build-payload.ts`)),
        `${ch} 가 자기 trim 을 한다`,
      ).toContain("dedupeSellerTagTexts(product.keywords.value)");
    }
  });

  it("🔴 롯데ON 상한 5개는 «유지» 하고, 중복을 «먼저» 걷는다", () => {
    const src = strip(read("packages/listing/src/lotteon/build-payload.ts"));
    expect(src).toContain("dedupeSellerTagTexts(product.keywords.value).slice(0, 5)");
  });
});

describe("④ 🔴 판매 가능 확인이 «등록 팝업을 띄우지 않는다»", () => {
  it("🔴🔴 클릭해도 onOpenListingModal 이 불리지 않는다", async () => {
    let opened = 0;
    const patches: Record<string, unknown>[] = [];
    await mountChannel("smartstore", {
      naverValidation: kcValidationOf(makeProduct()),
      onUpdateKcDeclaration: (p: Record<string, unknown>) => patches.push(p),
      onUpdateChildCertification: () => {},
      onOpenListingModal: () => {
        opened += 1;
      },
    });
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("판매 가능 상품으로 확인"),
    );
    expect(btn, "확인 버튼이 없다").toBeTruthy();
    await act(async () => btn!.click());
    expect(patches[0], "상태 변경은 그대로여야 한다").toMatchObject({ child: "EXCLUDED", kc: "EXCLUDED" });
    expect(opened, "클릭 즉시 등록 팝업이 떴다").toBe(0);
  });

  it("🔴 [판매 전 최종 확인]은 «그대로» 모달을 연다 — 다른 의도다", () => {
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    expect(pv).toContain("onFinalConfirm={onOpenListingModal}");
  });

  it("🔴 등록 버튼 배선은 건드리지 않았다", () => {
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    expect(pv).toContain("onRegister={onOpenListingModal}");
  });

  it("🔴 인증번호·모델명을 만들지 않는다 — 허위 생성 금지는 그대로", () => {
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    const at = pv.indexOf("onConfirmSellable={");
    const body = pv.slice(at, at + 900);
    for (const bad of ["onUpdateChildCertification", "certificationNumber", "modelName"]) {
      expect(body, `확인 버튼이 ${bad} 를 건드린다`).not.toContain(bad);
    }
  });
});
