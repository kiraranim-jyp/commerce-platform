// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { seedSeoContent } from "@commerce/content";
import { buildNaverProductPayload, resolveKcStatus, validateNaverPayload } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { registrationFieldAnchor, KC_CERT_NUMBER_ANCHOR } from "../readiness-state";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 FINAL(CPO FAIL 4건, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   ① 채널 탭 옵션 영역 «자체» 제거 — read-only 로 남기는 것도 금지
 *   ② 상세설명 최초 생성부터 자동 — 버튼을 눌러야만 채워지는 구조 제거
 *   ③ 태그 최초 생성부터 SEO 자동 — 원본 태그 + SEO · 중복 제거
 *   ④ 「판매 가능 상품으로 확인」 → 두 축 자동 「대상 아님」 · KC 이동 목적지 교정
 */

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => readFileSync(join(__dirname, "../../../../../../..", rel), "utf8");

function f<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

function makeProduct(over: Record<string, unknown> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/products/x",
    title: f("Bobo Choses Striped T-Shirt"),
    titleKo: f("보보쇼즈 스트라이프 티셔츠"),
    brand: f("Bobo Choses"),
    price: f({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: f("B226AC157"),
    description: f("Multicolor t-shirt. 100% Cotton."),
    descriptionKo: f(""),
    material: f("코튼 100%"),
    color: f("멀티컬러"),
    recommendedAge: f("3-4Y"),
    manufacturer: f("Bobo Choses"),
    careInstructions: f(""),
    options: f(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["2-3Y", "4-5Y"] }],
    variants: [
      { id: "v1", optionValues: { 사이즈: "2-3Y" }, stockQuantity: 3 },
      { id: "v2", optionValues: { 사이즈: "4-5Y" } },
    ],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/a.jpg",
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
    importer: f("따조"),
    itemName: f("유아동 티셔츠"),
    modelName: f("BC-1"),
    weight: f("120g"),
    certificationType: f(""),
    childCertification: f(null),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...over,
  } as unknown as CanonicalProduct;
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
  const product = makeProduct();
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

/**
 * 🔴 `naverValidation` 을 «손으로 지어내지 않는다». 처음에 fields 세 칸만 적은
 * 객체를 넘겼더니 `Cannot read properties of undefined (reading 'filter')` 로
 * 터졌다 — 그 모양이 운영 모양이 아니었다. 운영 함수가 낸 결과를 그대로 쓴다.
 * ([[measure-with-the-production-function]])
 */
const KC_ARGS = {
  leafCategoryId: "50000167", releaseAddressBookNo: "1", refundAddressBookNo: "1",
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY", sellerDeliveryFee: null,
  returnDeliveryFee: 3000, exchangeDeliveryFee: 6000, originAreaCode: "0200037",
  originAreaRequiresContent: false, deliveryCompany: "CJGLS", warrantyPolicy: "1년",
  afterServiceDirector: "따져", afterServiceTelephoneNumber: "02-000-0000",
  childCertificationInfoId: 1041, categoryRequiresChildCertification: true,
} as const;

function kcValidationOf(product: CanonicalProduct) {
  const listing = PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
  const base = validateNaverPayload(
    buildNaverProductPayload({ product, listing, ...KC_ARGS } as never),
    { product, ...KC_ARGS, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false } as never,
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

describe("① 🔴 채널 탭에 옵션 영역이 «없다»", () => {
  it.each(["smartstore", "coupang"] as const)("%s — 옵션 값·개수·안내가 전부 사라졌다", async (platform) => {
    await mountChannel(platform);
    const region = container.querySelector("#section-options");
    expect(region, "그 섹션 자체가 사라지면 재고 칸도 같이 사라진다").not.toBeNull();
    /* 🔴 접힘 «요약» 은 버튼 안에 있고 그것은 ③ 블록이 따로 센다. 여기서는
       본문만 본다 — 섞으면 「요약에 옵션이 남았다」와 「본문에 옵션이 남았다」를
       구별할 수 없다. */
    const body = region!.querySelector(":scope > div");
    const t = flat(body ?? region);
    /* 🔴 양성 대조 — 영역을 «실제로» 읽고 있음을 먼저 확인한다. 이것이 없으면
       아래 not.toContain 들이 「영역을 못 찾아서 통과」하는 공허한 단언이 된다
       (음성 대조 W1 이 그 모양으로 통과했다 — 변이가 다른 섹션에 꽂혔다). */
    expect(t, "옵션 영역을 읽지 못했다 — 아래 단언이 공허해진다").toContain("재고");
    for (const gone of ["2-3Y", "4-5Y", "사이즈", "단품", "상품정보 → 옵션"]) {
      expect(t, `「${gone}」가 아직 채널 탭에 있다`).not.toContain(gone);
    }
  });

  /* ══ 🔴 음성 대조 W2 가 «통과했다» — 그래서 이 단언을 고쳤다 ═══════════════
     전에는 「영역 안에 '재고' 글자가 있는가」만 봤다. 그런데 그 영역에는 재고
     FieldRow 의 라벨이 늘 있으므로, 섹션 «제목» 을 「옵션」으로 되돌려도 통과했다.
     제목을 직접 센다. */
  it.each(["smartstore", "coupang"] as const)("%s — 섹션 «제목» 이 「재고」다", async (platform) => {
    await mountChannel(platform);
    /* CollapsibleSection 구조: 섹션 > button > span > span(제목+배지). 제목만
       본다 — 버튼 전체를 보면 요약 문구(「옵션 재고 합계 3개」)가 섞여, 제목이
       「재고」로 바뀌었는데도 '옵션' 이 걸린다(1차에 실제로 그렇게 실패했다). */
    const title = flat(container.querySelector("#section-options > button > span > span"));
    expect(title, `제목이 「${title}」다`).toContain("재고");
    expect(title, "제목이 아직 「옵션」이다").not.toContain("옵션");
  });

  it("🔴 접힘 요약도 옵션을 말하지 않는다 — 본문만 지우면 제거가 절반이다", () => {
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    expect(pv, "옵션 요약이 남아 있다").not.toContain("자동 추출 — 옵션그룹");
    expect(pv).toContain("const stockSummary");
  });

  it("🔴 롯데ON 탭에서도 옵션 섹션이 사라졌다", () => {
    const lp = strip(read("apps/admin/src/app/pipeline/commerce/LotteOnRegistrationPanel.tsx"));
    expect(lp, "롯데ON 옵션 섹션이 남아 있다").not.toContain("<LotteOnOptionDetail");
    expect(lp).not.toContain('rows={rowsOf("옵션", "재고")}');
  });

  it("🔴 등록 payload 는 영향이 «없다» — 빌더가 화면이 아니라 product 를 읽는다", () => {
    for (const [ch, needle] of [
      ["naver", "product.variants.map"],
      ["coupang", "optionGroups: product.optionGroups"],
      ["lotteon", "product.variants.map"],
    ] as const) {
      expect(strip(read(`packages/listing/src/${ch}/build-payload.ts`)), `${ch} 빌더가 바뀌었다`).toContain(needle);
    }
  });
});

describe("② 🔴 상세설명이 «생성 시점» 에 채워진다", () => {
  it("비어 있던 상세설명이 채워진다", () => {
    const r = seedSeoContent(makeProduct());
    expect(r.filled).toContain("descriptionKo");
    expect(r.product.descriptionKo.value.trim().length).toBeGreaterThan(0);
  });

  it("🔴 상품 정보가 실제로 들어간다 — 일반 문구를 지어내지 않는다", () => {
    const text = seedSeoContent(makeProduct()).product.descriptionKo.value;
    expect(text).toContain("Bobo Choses");
    expect(text).toContain("코튼 100%");
    /* 옵션 값까지 들어간다(축 이름만 적던 결함은 P5.6 Phase 5 에서 고쳤다). */
    expect(text).toContain("2-3Y");
  });

  it("🔴 셀러 수정값을 덮지 «않는다»", () => {
    const edited = makeProduct({ descriptionKo: f("셀러가 쓴 글", "USER_EDITED") });
    const r = seedSeoContent(edited);
    expect(r.skipped).toContain("descriptionKo");
    expect(r.product.descriptionKo.value).toBe("셀러가 쓴 글");
  });

  it("🔴 두 번 돌려도 바뀌지 않는다(멱등)", () => {
    const once = seedSeoContent(makeProduct()).product;
    const twice = seedSeoContent(once).product;
    expect(twice.descriptionKo.value).toBe(once.descriptionKo.value);
  });

  it("🔴 재료가 하나도 없으면 «만들지 않는다»", () => {
    const bare = makeProduct({
      brand: f(""), material: f(""), color: f(""), description: f(""), descriptionKo: f(""),
      optionGroups: [], options: f([]), title: f(""),
    });
    const r = seedSeoContent(bare);
    expect(r.filled).not.toContain("descriptionKo");
  });

  it("🔴 입력 객체를 바꾸지 않는다 — 순수 함수다", () => {
    const p = makeProduct();
    seedSeoContent(p);
    expect(p.descriptionKo.value).toBe("");
  });

  it("🔴 생성 지점에 «실제로» 꽂혔다 — 선언만 하지 않았다", () => {
    const cp = strip(read("apps/admin/src/app/api/pipeline/canonical-product.ts"));
    expect(cp).toContain("seedSeoContent(");
    expect(cp).toContain("buildCanonicalProductRaw(");
  });

  it("🔴 새 생성기를 만들지 않았다 — 버튼이 부르던 그 함수다", () => {
    const seed = strip(read("packages/content/src/seed-seo-content.ts"));
    expect(seed).toContain("mockProductContentProvider.generateDescription(product)");
    expect(seed).toContain("mockProductContentProvider.generateKeywords(product)");
  });
});

describe("③ 🔴 태그가 «생성 시점» 에 채워진다", () => {
  it("비어 있던 태그가 SEO 태그로 채워진다", () => {
    const r = seedSeoContent(makeProduct());
    expect(r.filled).toContain("keywords");
    expect(r.product.keywords.value.length).toBeGreaterThan(0);
    expect(r.product.keywords.value).toContain("Bobo Choses");
  });

  it("🔴 원본 태그가 있으면 «기존 + SEO» 이고 기존이 앞이다", () => {
    const r = seedSeoContent(makeProduct({ keywords: f(["수입티셔츠", "아동"]) }));
    const v = r.product.keywords.value;
    expect(v.slice(0, 2)).toEqual(["수입티셔츠", "아동"]);
    expect(v.length).toBeGreaterThan(2);
  });

  it("🔴 중복이 늘지 않는다 — 두 번 돌려도 같다(멱등)", () => {
    const once = seedSeoContent(makeProduct()).product;
    const twice = seedSeoContent(once).product;
    expect(twice.keywords.value).toEqual(once.keywords.value);
  });

  it("🔴 원본에 이미 있는 태그를 두 번 넣지 않는다", () => {
    const r = seedSeoContent(makeProduct({ keywords: f(["Bobo Choses"]) }));
    const v = r.product.keywords.value;
    expect(v.filter((t) => t === "Bobo Choses")).toHaveLength(1);
  });

  it("🔴 셀러가 고친 태그를 덮지 않는다", () => {
    const r = seedSeoContent(makeProduct({ keywords: f(["내가 정한 태그"], "USER_EDITED") }));
    expect(r.skipped).toContain("keywords");
    expect(r.product.keywords.value).toEqual(["내가 정한 태그"]);
  });

  it("🔴 상품과 무관한 일반 키워드를 만들지 않는다", () => {
    const v = seedSeoContent(makeProduct()).product.keywords.value;
    for (const junk of ["인기", "추천", "best", "세일", "무료배송"]) {
      expect(v, `무관한 키워드(${junk})가 생겼다`).not.toContain(junk);
    }
  });

  it("🔴 그 값이 네이버 sellerTags 까지 간다 — 같은 필드를 읽는다", () => {
    const naver = strip(read("packages/listing/src/naver/build-payload.ts"));
    expect(naver).toContain("dedupeSellerTagTexts(product.keywords.value)");
    expect(naver).toContain("seoInfo: { sellerTags: tags }");
  });
});

describe("④ 🔴 판매 가능 확인 → 두 축이 「대상 아님」이 된다", () => {
  it("두 축이 미선택이면 둘 다 EXCLUDED 로 설정한다", async () => {
    const patches: Record<string, unknown>[] = [];
    await mountChannel("smartstore", {
      naverValidation: kcValidationOf(makeProduct()),
      onUpdateKcDeclaration: (p: Record<string, unknown>) => patches.push(p),
      onUpdateChildCertification: () => {},
    });
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("판매 가능 상품으로 확인"),
    );
    expect(btn, "확인 버튼이 화면에 없다").toBeTruthy();
    await act(async () => btn!.click());
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ child: "EXCLUDED", kc: "EXCLUDED" });
  });

  it("🔴 이미 고른 축은 «덮지 않는다»", async () => {
    const patches: Record<string, unknown>[] = [];
    await mountChannel("smartstore", {
      product: makeProduct({ smartStoreKcDeclaration: { child: "TARGET" } }),
      naverValidation: kcValidationOf(makeProduct({ smartStoreKcDeclaration: { child: "TARGET" } })),
      onUpdateKcDeclaration: (p: Record<string, unknown>) => patches.push(p),
      onUpdateChildCertification: () => {},
    });
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("판매 가능 상품으로 확인"),
    );
    await act(async () => btn!.click());
    expect(patches[0]).not.toHaveProperty("child");
    expect(patches[0]).toMatchObject({ kc: "EXCLUDED" });
  });

  it("🔴 인증번호·모델명을 «만들지 않는다» — 허위 생성 금지", () => {
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    const at = pv.indexOf("onConfirmSellable={");
    const body = pv.slice(at, at + 900);
    for (const bad of ["onUpdateChildCertification", "certificationNumber", "modelName"]) {
      expect(body, `확인 버튼이 ${bad} 를 건드린다`).not.toContain(bad);
    }
  });

  it("🔴 면제 사유가 남지 않는다 — 반쪽 신고를 만들지 않는다", () => {
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    expect(pv).toContain("patch.exemptionReason = undefined");
  });
});

describe("④ 🔴 KC [입력하기]가 «KC 칸» 으로 간다 — 기본정보가 아니다", () => {
  it("KC 항목이 인증번호 앵커를 돌려준다", () => {
    const anchor = registrationFieldAnchor({
      label: "KC (어린이제품 등 인증정보)",
      sourceItems: [],
    } as never);
    expect(anchor).toBe(KC_CERT_NUMBER_ANCHOR);
  });

  it("🔴🔴 sourceItems 에 모델명이 섞여 있어도 «KC» 로 간다 — CEO 가 본 결함", () => {
    const anchor = registrationFieldAnchor({
      label: "KC (어린이제품 등 인증정보)",
      sourceItems: [{ label: "모델명(고시 + 카탈로그)" }, { label: "인증번호" }],
    } as never);
    expect(anchor, "모델명 앵커로 가면 기본정보로 튄다").toBe(KC_CERT_NUMBER_ANCHOR);
  });

  it("모델명 항목은 여전히 모델명 칸으로 간다 — 섞지 않았다", () => {
    const anchor = registrationFieldAnchor({
      label: "모델명(고시 + 카탈로그)",
      sourceItems: [],
    } as never);
    expect(anchor).toBe("field-catalogModelName");
  });

  it("폴백을 없애지 않았다 — 항목 이름에 앵커가 없으면 sourceItems 를 본다", () => {
    const anchor = registrationFieldAnchor({
      label: "알 수 없는 항목",
      sourceItems: [{ label: "원산지 직접입력" }],
    } as never);
    expect(anchor).toBe("field-countryOfOrigin");
  });

  it("그 앵커가 실제 DOM 에 «있다»", async () => {
    await mountChannel("smartstore", {
      naverValidation: kcValidationOf(makeProduct()),
      onUpdateKcDeclaration: () => {},
      onUpdateChildCertification: () => {},
    });
    const el = container.querySelector(`#${KC_CERT_NUMBER_ANCHOR}`);
    expect(el, "앵커가 DOM 에 없으면 이동이 섹션 맨 위로 떨어진다").not.toBeNull();
    expect(flat(el)).toContain("인증번호");
  });

  it("🔴 상수가 «한 곳» 에 있다 — 문자열을 두 벌로 적지 않았다", () => {
    const rs = strip(read("apps/admin/src/app/pipeline/commerce/readiness-state.ts"));
    expect(rs).toContain('export const KC_CERT_NUMBER_ANCHOR = "field-kcCertificationNumber"');
    const pv = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));
    expect(pv, "PlatformPreview 가 자기 상수를 다시 적었다").not.toContain(
      'KC_CERT_NUMBER_ANCHOR = "field-kcCertificationNumber"',
    );
  });
});
