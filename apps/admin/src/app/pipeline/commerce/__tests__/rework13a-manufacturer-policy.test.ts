// @vitest-environment jsdom
import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { extractFromJsonLd, extractManufacturer } from "@commerce/crawler";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  MANUFACTURER_SOURCE_LABEL,
  buildLotteOnPayload,
  buildNaverProductPayload,
  manufacturerInputFromProduct,
  resolveManufacturer,
  validateNaverPayload,
  type ManufacturerSource,
} from "@commerce/listing";
import { ManufacturerField } from "../ManufacturerResolutionNote";
import { normalizeBrandKey } from "../use-manufacturer-resolution";
import { computeNaverPayloadReadiness } from "../readiness";

/**
 * REWORK-13A(CEO 지시, 2026-09-15) — **제조사 정책 재작업.**
 *
 * CEO 가 요구한 증거는 두 가지다.
 *
 *  A. 다섯 단계가 **실제로 차례로 내려간다** — 값을 넣었다 뺐다 하며
 *     ①원본 명시 → ②원본 상품정보 → ③브랜드 프로필 → ④판매자 기본값 →
 *     ⑤직접 입력이 화면과 payload **양쪽에서 같은 값**으로 움직이는가.
 *  B. **제조사가 비어도 등록 준비가 막히지 않는다.**
 *
 * 🔴 정적 렌더로 판정하지 않는다 — jsdom 마운트 + 실제 타이핑(focus→input→blur)
 * 으로 상태를 바꾸고, 같은 상태에서 만든 payload 를 끝까지 따라간다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL") {
  return { value, source, confidence: 1 } as never;
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field("Terry bermuda shorts for kids."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    /** 🔴 원문에서 제조사를 못 읽은 상품 — 폴백이 실제로 도는 조건이다. */
    manufacturer: field("", "REQUIRED"),
    careInstructions: field("30도 손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
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
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 반바지입니다."),
    keywords: field(["키워드1", "키워드2", "키워드3", "키워드4", "키워드5", "키워드6"]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field("따져코리아"),
    childCertification: field(
      {
        name: "한국기계전기전자시험연구원",
        companyName: "보보쇼즈",
        certificationNumber: "CB123456789",
        certificationDate: "2026-01-02",
      },
      "USER_EDITED",
    ),
    itemName: field("아동용 반바지"),
    modelName: field("B226AC043", "USER_EDITED"),
    weight: field("120g"),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
    ...overrides,
  } as unknown as CanonicalProduct;
}

const PAYLOAD_ARGS = {
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
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
  childCertificationInfoId: 1041,
  categoryRequiresChildCertification: true,
} as const;

function listingOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

/**
 * ③/④는 상품이 아니라 셀러 설정에서 온다. 서버(resolve-context.ts)가 두
 * 단계를 이미 합쳐서 하나로 내려주므로(notice.manufacturer) payload 호출부도
 * 그 모양 그대로 받는다 — 여기서 새 경로를 만들지 않는다.
 */
function naverResolvedOf(brandProfile?: string | null, sellerProfile?: string | null) {
  return (brandProfile ?? "").trim() || (sellerProfile ?? "").trim() || null;
}

function naverPayloadOf(
  product: CanonicalProduct,
  brandProfile?: string | null,
  sellerProfile?: string | null,
) {
  return buildNaverProductPayload({
    product,
    listing: listingOf(product),
    ...PAYLOAD_ARGS,
    resolvedManufacturer: naverResolvedOf(brandProfile, sellerProfile),
  } as never);
}

/** payload 의 제조사 자리(스마트스토어 고시정보 KIDS). */
function naverManufacturer(
  product: CanonicalProduct,
  brandProfile?: string | null,
  sellerProfile?: string | null,
): string | undefined {
  const notice = naverPayloadOf(product, brandProfile, sellerProfile).originProduct.detailAttribute
    ?.productInfoProvidedNotice as { kids?: { manufacturer?: string } } | undefined;
  return notice?.kids?.manufacturer;
}

/** 롯데ON 은 ③과 ④를 따로 받는다 — 두 단계가 payload 에서도 갈리는지 본다. */
function lotteOnManufacturer(
  product: CanonicalProduct,
  brandProfile?: string | null,
  sellerProfile?: string | null,
): string | undefined {
  const payload = buildLotteOnPayload({
    product,
    channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG, trGrpCd: "1", trNo: "2", taxTypeCode: "TDF" },
    detailHtml: "<p>상세</p>",
    brandProfileManufacturer: brandProfile ?? null,
    sellerProfileManufacturer: sellerProfile ?? null,
  } as never);
  return (payload.spdLst[0] as { mfcrNm?: string }).mfcrNm;
}

function naverValidationOf(
  product: CanonicalProduct,
  brandProfile?: string | null,
  sellerProfile?: string | null,
) {
  return validateNaverPayload(
    naverPayloadOf(product, brandProfile, sellerProfile),
    { product, ...PAYLOAD_ARGS, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false } as never,
    true,
  );
}

function naverMissingLabels(
  product: CanonicalProduct,
  brandProfile?: string | null,
  sellerProfile?: string | null,
): string[] {
  return computeNaverPayloadReadiness(naverValidationOf(product, brandProfile, sellerProfile))
    .required.filter((i) => !i.passed)
    .map((i) => i.label);
}

/* ══ 화면 — 세 탭이 쓰는 그 컴포넌트를 실제로 마운트한다 ═════════════════════ */

let container: HTMLDivElement;
let root: Root;
let product: CanonicalProduct;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 실제 타이핑 — EditableText는 blur(focusout) 시점에만 onCommit한다. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    input.focus();
  });
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.blur();
  });
}

function manufacturerInput(): HTMLInputElement {
  const input = Array.from(container.querySelectorAll("input")).find(
    (i) => (i.getAttribute("placeholder") ?? "") === "제조사 미확인",
  );
  if (!input) throw new Error("제조사 입력칸이 화면에 없다");
  return input as HTMLInputElement;
}

/**
 * 세 탭이 쓰는 그 컴포넌트 하나를 실제 상태와 함께 마운트한다. 셀러가 칸에
 * 값을 치면 `product.manufacturer`가 USER_EDITED 로 바뀌는 것까지 실제 배선과
 * 같다(PlatformPreview 의 `fix?.("manufacturer", v)` 와 같은 동작).
 */
function ManufacturerHarness({
  initial,
  brandProfile,
  sellerProfile,
}: {
  initial: CanonicalProduct;
  brandProfile?: string | null;
  sellerProfile?: string | null;
}) {
  const [current, setCurrent] = useState(initial);
  useEffect(() => {
    product = current;
  }, [current]);
  const resolution = {
    ...resolveManufacturer({
      ...manufacturerInputFromProduct(current),
      brandProfileManufacturer: brandProfile ?? null,
      sellerProfileManufacturer: sellerProfile ?? null,
    }),
    loading: false,
    brand: current.brand.value,
  };
  return createElement(ManufacturerField, {
    field: current.manufacturer,
    resolution,
    onCommit: (v: string) =>
      setCurrent((prev) => ({
        ...prev,
        manufacturer: { value: v, source: "USER_EDITED", confidence: 1 },
      })),
  } as never);
}

async function renderField(
  initial: CanonicalProduct,
  brandProfile?: string | null,
  sellerProfile?: string | null,
): Promise<void> {
  await act(async () => {
    root.render(createElement(ManufacturerHarness, { initial, brandProfile, sellerProfile }));
  });
}

/** 화면 칸에 실제로 보이는 글자(입력칸의 value). */
function shownValue(): string {
  return manufacturerInput().value;
}

/* ══ A. 다섯 단계가 차례로 내려간다 ═══════════════════════════════════════ */

const SOURCE_URL_VALUE = "원본명시제조사";
const PRODUCT_INFO_VALUE = "상품정보제조사";
const BRAND_VALUE = "Bobo Choses S.L.";
const SELLER_VALUE = "따져코리아";
const MANUAL_VALUE = "셀러가직접입력한제조사";

/** 위 단계를 하나씩 빼 내려가는 다섯 계단. 화면·payload 가 같은 값을 봐야 한다. */
const LADDER: Array<{
  step: string;
  product: () => CanonicalProduct;
  brandProfile: string | null;
  sellerProfile: string | null;
  expected: string;
  expectedSource: ManufacturerSource;
}> = [
  {
    step: "① 원본 URL 의 명시적 제조사",
    product: () =>
      makeProduct({
        manufacturer: field(SOURCE_URL_VALUE),
        manufacturerOrigin: "SOURCE_URL",
      } as never),
    brandProfile: BRAND_VALUE,
    sellerProfile: SELLER_VALUE,
    expected: SOURCE_URL_VALUE,
    expectedSource: "SOURCE_URL",
  },
  {
    step: "② 원본 상품정보에서 확인된 제조사",
    product: () =>
      makeProduct({
        manufacturer: field(PRODUCT_INFO_VALUE),
        manufacturerOrigin: "PRODUCT_INFO",
      } as never),
    brandProfile: BRAND_VALUE,
    sellerProfile: SELLER_VALUE,
    expected: PRODUCT_INFO_VALUE,
    expectedSource: "PRODUCT_INFO",
  },
  {
    step: "③ 설정 > 브랜드 관리의 제조사",
    product: () => makeProduct(),
    brandProfile: BRAND_VALUE,
    sellerProfile: SELLER_VALUE,
    expected: BRAND_VALUE,
    expectedSource: "BRAND_DEFAULT",
  },
  {
    step: "④ 판매자 기본 제조사",
    product: () => makeProduct(),
    brandProfile: null,
    sellerProfile: SELLER_VALUE,
    expected: SELLER_VALUE,
    expectedSource: "SELLER_DEFAULT",
  },
];

describe("REWORK-13A A — 다섯 단계가 화면과 payload에서 똑같이 내려간다", () => {
  it.each(LADDER)("$step — 판정 · 화면 · 스마트스토어 payload · 롯데ON payload 가 한 값이다", async (row) => {
    const p = row.product();

    // 1) 판정
    const resolution = resolveManufacturer({
      ...manufacturerInputFromProduct(p),
      brandProfileManufacturer: row.brandProfile,
      sellerProfileManufacturer: row.sellerProfile,
    });
    expect(resolution.source, row.step).toBe(row.expectedSource);
    expect(resolution.value).toBe(row.expected);

    // 2) 화면 — 실제 마운트. 칸에 그 값이 보인다("제조사 미확인" 이 아니다).
    await renderField(p, row.brandProfile, row.sellerProfile);
    expect(shownValue(), `${row.step}: 칸이 payload 와 다른 값을 보여준다`).toBe(row.expected);

    // 3) 스마트스토어 payload
    expect(naverManufacturer(p, row.brandProfile, row.sellerProfile)).toBe(row.expected);

    // 4) 롯데ON payload — ③과 ④를 따로 받는 채널에서도 같은 답이 나온다.
    expect(lotteOnManufacturer(p, row.brandProfile, row.sellerProfile)).toBe(row.expected);
  });

  it("⑤ 네 단계가 전부 비면 화면이 «어디까지 찾아봤는지»와 다음 행동을 말한다", async () => {
    await renderField(makeProduct(), null, null);
    const screen = text();
    expect(screen).toContain("상품 원문 · 브랜드 프로필 · 판매자 기본정보 어디에도 제조사가 없습니다");
    expect(screen).toContain("브랜드 「Bobo Choses」에 등록된 제조사가 없습니다");
    expect(screen).toContain("설정 > 브랜드 관리의 브랜드 프로필에 등록하세요");
    /* 🔴 REWORK-13A — ⚠ 만 보여 주면 셀러는 «등록이 차단됐다»로 읽는다.
       화면이 «막히지 않는다»를 직접 말하는지 확인한다. */
    expect(screen).toContain("제조사가 비어 있어도 상품 분석과 등록 준비는 계속됩니다");
    // 🔴 값을 지어내지 않는다 — 칸은 비어 있다.
    expect(shownValue()).toBe("");
    expect(naverManufacturer(makeProduct(), null, null) ?? "").toBe("");
    expect(lotteOnManufacturer(makeProduct(), null, null)).toBeUndefined();
  });

  it("🔴 ⑤ 직접 입력은 실제 타이핑으로 들어가고, 네 단계를 전부 이긴다", async () => {
    // 위 네 단계 중 가장 강한 ①까지 값이 있는 상태에서 셀러가 고친다.
    await renderField(
      makeProduct({ manufacturer: field(SOURCE_URL_VALUE), manufacturerOrigin: "SOURCE_URL" } as never),
      BRAND_VALUE,
      SELLER_VALUE,
    );
    expect(shownValue()).toBe(SOURCE_URL_VALUE);

    await type(manufacturerInput(), MANUAL_VALUE);

    // 상태(= 저장되는 값)
    expect(product.manufacturer.value).toBe(MANUAL_VALUE);
    expect(product.manufacturer.source).toBe("USER_EDITED");
    // 판정
    expect(
      resolveManufacturer({
        ...manufacturerInputFromProduct(product),
        brandProfileManufacturer: BRAND_VALUE,
        sellerProfileManufacturer: SELLER_VALUE,
      }).source,
    ).toBe("MANUAL");
    // 화면
    expect(shownValue()).toBe(MANUAL_VALUE);
    // payload 두 채널
    expect(naverManufacturer(product, BRAND_VALUE, SELLER_VALUE)).toBe(MANUAL_VALUE);
    expect(lotteOnManufacturer(product, BRAND_VALUE, SELLER_VALUE)).toBe(MANUAL_VALUE);
  });

  it("③이 채웠을 때 화면이 어느 단계가 채웠는지 이름으로 말한다", async () => {
    await renderField(makeProduct(), BRAND_VALUE, SELLER_VALUE);
    expect(text()).toContain(`${MANUFACTURER_SOURCE_LABEL.BRAND_DEFAULT}의 제조사 ${BRAND_VALUE}가 자동 적용됩니다`);
  });

  it("④가 채웠으면 ③이라고 말하지 않는다", async () => {
    await renderField(makeProduct(), null, SELLER_VALUE);
    const screen = text();
    expect(screen).toContain(`${MANUFACTURER_SOURCE_LABEL.SELLER_DEFAULT}의 제조사 ${SELLER_VALUE}`);
    expect(screen).not.toContain(MANUFACTURER_SOURCE_LABEL.BRAND_DEFAULT);
  });
});

/* ══ B. 제조사가 비어도 등록 준비가 막히지 않는다 ═════════════════════════ */

describe("REWORK-13A B — 제조사가 비어도 등록 준비가 막히지 않는다", () => {
  it("🔴 롯데ON — 제조사가 없어도 payload 가 만들어진다(필드만 빠진다, 던지지 않는다)", () => {
    const p = makeProduct();
    expect(() => lotteOnManufacturer(p, null, null)).not.toThrow();
    expect(lotteOnManufacturer(p, null, null)).toBeUndefined();
  });

  it("🔴 쿠팡 — 제조사는 등록 준비 필수 항목이 아니다(어댑터 검증 전수)", () => {
    const p = makeProduct();
    const labels = PLATFORM_ADAPTERS.coupang
      .toListingModel(p, UNRESOLVED_CATEGORY, undefined, "coupang")
      .validations.filter((v) => v.status !== "PASS")
      .map((v) => v.label);
    expect(labels, "쿠팡이 제조사로 등록 준비를 막고 있다").not.toContain("제조사");
    expect(labels).not.toContain("제조자");
  });

  it("🔴 상품 분석/등록 준비 자체를 막는 전역 blocker 가 아니다 — payload 조립이 끝까지 간다", () => {
    const p = makeProduct();
    expect(() => naverPayloadOf(p, null, null)).not.toThrow();
    // 이미지·가격·상품명 같은 «진짜» 준비 항목은 그대로 채워진다.
    const payload = naverPayloadOf(p, null, null);
    expect(payload.originProduct.name).toBeTruthy();
    expect(payload.originProduct.images.representativeImage.url).toBeTruthy();
  });

  it("🔴 브랜드 프로필이 채워 주면 스마트스토어도 더 이상 «제조자»를 막지 않는다", () => {
    const p = makeProduct();
    /* BEFORE(REWORK-13A 이전): validator 가 input.product.manufacturer 만 봐서
       브랜드 프로필이 payload 를 채워도 「제조자」가 필수 미충족으로 남았다. */
    expect(naverMissingLabels(p, null, null), "빈 상태에서는 스마트스토어가 실제로 요구한다").toContain("제조자");
    expect(naverMissingLabels(p, BRAND_VALUE, null), "payload 에 값이 있는데 화면이 없다고 말한다").not.toContain("제조자");
    expect(naverMissingLabels(p, null, SELLER_VALUE)).not.toContain("제조자");
  });

  it("스마트스토어가 막을 때는 해결 경로를 문장으로 준다 — 값을 지어내지 않는다", () => {
    const reason = String(
      naverValidationOf(makeProduct(), null, null).fields.find((f) =>
        f.field.endsWith("productInfoProvidedNotice(KIDS).manufacturer".split(".").pop() as string),
      )?.reason ?? "",
    );
    expect(reason).toContain("제조사 정보가 필요합니다");
    expect(reason).toContain("브랜드 관리");
    expect(reason).toContain("직접 입력");
  });
});

/* ══ ① 원본 URL 의 명시적 제조사를 크롤러가 실제로 읽는다 ═════════════════ */

function jsonLdHtml(productNode: Record<string, unknown>): string {
  return `<html><head><script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Terry Bermuda Shorts",
    ...productNode,
  })}</script></head><body></body></html>`;
}

describe("REWORK-13A ① — 원본이 제조사라고 적어 둔 값을 크롤러가 읽는다", () => {
  it("schema.org Product.manufacturer 가 문자열일 때", () => {
    expect(extractFromJsonLd(jsonLdHtml({ manufacturer: "Bobo Choses S.L." }))?.manufacturer).toBe(
      "Bobo Choses S.L.",
    );
  });

  it("Organization 노드일 때는 그 name 을 읽는다", () => {
    expect(
      extractFromJsonLd(
        jsonLdHtml({ manufacturer: { "@type": "Organization", name: "Apolina Ltd." } }),
      )?.manufacturer,
    ).toBe("Apolina Ltd.");
  });

  it("additionalProperty 에 「제조사」로 적어 둔 값도 읽는다", () => {
    expect(
      extractFromJsonLd(
        jsonLdHtml({ additionalProperty: [{ name: "제조사", value: "보보쇼즈 코리아" }] }),
      )?.manufacturer,
    ).toBe("보보쇼즈 코리아");
  });

  it("🔴 브랜드는 제조사가 되지 않는다 — brand 만 있으면 manufacturer 는 비어 있다", () => {
    const data = extractFromJsonLd(jsonLdHtml({ brand: { name: "Bobo Choses" } }));
    expect(data?.brand).toBe("Bobo Choses");
    expect(data?.manufacturer, "🔴 브랜드명이 제조사로 새어 들어갔다").toBeUndefined();
  });

  it("🔴 「제조국」처럼 다른 뜻인 칸을 제조사로 끌어오지 않는다", () => {
    expect(
      extractFromJsonLd(jsonLdHtml({ additionalProperty: [{ name: "제조국", value: "스페인" }] }))
        ?.manufacturer,
    ).toBeUndefined();
  });

  it("② 는 여전히 설명문 문구에서만 온다 — 없으면 지어내지 않는다", () => {
    /* 마침표는 문장 끝 구분자라 값에 포함하지 않는다(description-facts.ts 규칙 그대로). */
    expect(extractManufacturer("Manufactured by Apolina Ltd.")).toBe("Apolina Ltd");
    expect(extractManufacturer("A lovely pair of shorts.")).toBeUndefined();
  });
});

/* ══ ③ 브랜드 조회의 이름 비교 규칙 ═══════════════════════════════════════ */

describe("REWORK-13A ③ — 브랜드 이름을 같은 규칙으로 읽는다(화면 · 서버 동일)", () => {
  it("대소문자 · 앞뒤 공백 · 연속 공백 · 전각 표기가 같은 이름으로 모인다", () => {
    const key = normalizeBrandKey("Bobo Choses");
    expect(normalizeBrandKey("  bobo choses ")).toBe(key);
    expect(normalizeBrandKey("BOBO   CHOSES")).toBe(key);
    expect(normalizeBrandKey("Ｂｏｂｏ Ｃｈｏｓｅｓ")).toBe(key);
  });

  it("🔴 다른 브랜드는 여전히 다른 이름이다 — 부분 일치로 붙지 않는다", () => {
    expect(normalizeBrandKey("Play")).not.toBe(normalizeBrandKey("Play Up"));
  });

  it("브랜드가 비어 있으면 조회 키가 없다 — 아무 프로필에나 붙지 않는다", () => {
    expect(normalizeBrandKey("   ")).toBe("");
  });
});
