// @vitest-environment jsdom
import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, resolveManufacturer, validateNaverPayload } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { SourceDataView, CATALOG_MODEL_NAME_LABEL } from "../SourceDataView";
import { MissingFieldsBulkPanel } from "../MissingFieldsBulkPanel";
import { computeNaverPayloadReadiness } from "../readiness";

/**
 * DELTA-A / DELTA-B(CEO 지시, 2026-09-15)
 *
 * ── DELTA-A ───────────────────────────────────────────────────────────────
 * 제조사 폴백에 「브랜드 프로필」이 서 있는가. 코드 감사 결과 ②는 이미 배선돼
 * 있었다(resolve-context.ts:183 brandProfile?.manufacturer → build-payload.ts의
 * resolvedManufacturer). 빠져 있던 것은 **화면**이다:
 *   ⓐ 브랜드 프로필이 채운 값이 화면에 한 글자도 보이지 않았다.
 *   ⓑ 없을 때의 안내가 "Settings의 판매자 정보 탭"만 지목했다 — 브랜드 단위로
 *     등록하면 그 브랜드 상품 전체에 적용된다는 사실이 어디에도 없었다.
 * 그래서 이 파일은 **폴백 자체**(payload 도달 · 우선순위)와 **화면**을 둘 다
 * 실제로 돌려 확인한다.
 *
 * ── DELTA-B ───────────────────────────────────────────────────────────────
 * CEO 판정: "무슨 모델을 말하는 거지?" — 71e394d는 칸을 만들었지만 이름을
 * 그대로 뒀다. 한 칸이 두 자리로 나가는데(① 고시정보 모델명 / ② 네이버 쇼핑
 * 카탈로그 모델명) 화면에는 "모델명" 하나뿐이었다.
 *
 * 🔴 정적 렌더로 판정하지 않는다 — jsdom 마운트 + 실제 클릭·타이핑으로,
 * 라디오를 눌러 상태를 바꾸고 payload가 어디로 갔는지까지 따라간다.
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
    // "Product code" 표기가 없다 — resolveModelNameFromDescription()이 실패하는
    // 실제 조건이고, 그때만 이 필드가 셀러 입력에 의존한다.
    description: field("Terry bermuda shorts for kids."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field(""),
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
    keywords: field([]),
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
    modelName: field("", "REQUIRED"),
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

/** resolvedManufacturer는 register 라우트가 resolveNaverContext()에서 그대로
 *  넘기는 값이다(브랜드 프로필 → 판매자 프로필 폴백의 결과). */
function payloadOf(product: CanonicalProduct, resolvedManufacturer?: string | null) {
  return buildNaverProductPayload({
    product,
    listing: listingOf(product),
    ...PAYLOAD_ARGS,
    resolvedManufacturer,
  } as never);
}

function validationOf(product: CanonicalProduct) {
  return validateNaverPayload(
    payloadOf(product),
    { product, ...PAYLOAD_ARGS, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false } as never,
    true,
  );
}

function missingLabels(product: CanonicalProduct): string[] {
  return computeNaverPayloadReadiness(validationOf(product))
    .required.filter((i) => !i.passed)
    .map((i) => i.label);
}

function noticeManufacturer(product: CanonicalProduct, resolvedManufacturer?: string | null) {
  const notice = payloadOf(product, resolvedManufacturer).originProduct.detailAttribute
    ?.productInfoProvidedNotice as { kids?: { manufacturer?: string } } | undefined;
  return notice?.kids?.manufacturer;
}

function catalogModelName(product: CanonicalProduct): string | undefined {
  return payloadOf(product).originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName;
}

let container: HTMLDivElement;
let root: Root;
let product: CanonicalProduct;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
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

/* ══ DELTA-A ════════════════════════════════════════════════════════════════ */

function PlatformHarness({
  initial,
  naverResolved,
  manufacturerResolution,
}: {
  initial: CanonicalProduct;
  naverResolved?: unknown;
  manufacturerResolution?: ReturnType<typeof manufacturerFixture>;
}) {
  const [current, setCurrent] = useState(initial);
  useEffect(() => {
    product = current;
  }, [current]);
  return createElement(PlatformPreview, {
    manufacturerResolution: manufacturerResolution ?? manufacturerFixture(),
    product: current,
    listing: listingOf(current),
    categoryCandidates: [],
    listingStatus: "DRAFT" as const,
    listingResult: null,
    onFixTextField: (key: string, value: string) =>
      setCurrent((prev) => ({ ...prev, [key]: { value, source: "USER_EDITED", confidence: 1 } })),
    onSetFieldReference: (key: string, referenced: boolean) =>
      setCurrent((prev) => ({
        ...prev,
        [key]: referenced
          ? { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }
          : { value: "", source: "REQUIRED", confidence: 0 },
      })),
    onSelectCategory: () => {},
    onOpenListingModal: () => {},
    onRetryListing: () => {},
    developerMode: false,
    naverResolved,
  } as never);
}

async function renderPlatform(
  initial: CanonicalProduct,
  naverResolved?: unknown,
  manufacturerResolution?: ReturnType<typeof manufacturerFixture>,
): Promise<void> {
  await act(async () => {
    root.render(createElement(PlatformHarness, { initial, naverResolved, manufacturerResolution }));
  });
}

/**
 * REWORK-10 A(2026-09-15) — 화면이 받는 값을 **공통 resolver로** 만든다.
 * 예전 이 테스트는 resolvedWith(...)(= /api/naver/resolve 응답 모양)를 넘겼다.
 * 그 경로는 스마트스토어 탭에서만 채워지는 prop이었고, 그것이 쿠팡 탭에 ⚠ 가
 * 남던 원인이었다. 이제 세 채널이 같은 함수의 결과를 받는다.
 */
function resolution(input: {
  productManufacturer?: string;
  brandProfileManufacturer?: string | null;
  sellerProfileManufacturer?: string | null;
}) {
  /* REWORK-12 ④ — `brand`는 조회에 쓴 브랜드 이름이다(판정에 들어가지 않는다).
     화면이 "브랜드 X로 찾아봤는데 없었다"라고 말하는 데만 쓴다. */
  return { ...resolveManufacturer(input), loading: false, brand: "Bobo Choses" };
}

describe("DELTA-A ① — 폴백 ②(브랜드 프로필)가 실제로 존재하고 payload까지 간다", () => {
  /**
   * 🔴 STOP 조건 확인: 브랜드 프로필에 제조사 필드가 없으면 여기서 멈춰야 했다.
   * 실재한다 — coupang_brand_profiles.manufacturer(014_coupang_brand_profiles.sql)
   * → BrandProfile.manufacturer(brand-profile.ts:14) → Settings 「브랜드 프로필」의
   * "제조자" 입력칸. 그 값이 resolveNaverContext()의 notice.manufacturer가 되고,
   * register 라우트가 resolvedManufacturer로 넘긴다.
   */
  it("🔴 브랜드 프로필의 제조사가 실제 상품 payload의 제조자 자리에 도달한다", () => {
    const p = makeProduct();
    expect(p.manufacturer.value, "이 상품은 원문에서 제조사를 못 읽었다").toBe("");
    // ② 브랜드 프로필 값만 있는 상태.
    expect(noticeManufacturer(p, "Bobo Choses S.L.")).toBe("Bobo Choses S.L.");
  });

  it("① 상품 원문이 있으면 항상 그것이 이긴다 — 브랜드 프로필이 원문을 덮지 않는다", () => {
    const p = makeProduct({ manufacturer: field("원문제조사") });
    expect(noticeManufacturer(p, "Bobo Choses S.L.")).toBe("원문제조사");
  });

  it("④ 셋 다 없으면 값을 지어내지 않는다 — 빈 칸으로 남긴다", () => {
    // 실행 결과: undefined(필드 자체를 만들지 않는다). "미확인" 같은 문구를
    // 대신 채우지 않는다는 것이 이 줄이 고정하는 것이다.
    expect(noticeManufacturer(makeProduct(), null) ?? "").toBe("");
  });
});

describe("DELTA-A ② — 화면이 «어디까지 찾아봤는지»를 말한다", () => {
  it("🔴 브랜드 프로필이 채운 값이 화면에 보인다 — BEFORE에는 한 글자도 없었다", async () => {
    await renderPlatform(
      makeProduct(),
      undefined,
      resolution({ brandProfileManufacturer: "Bobo Choses S.L." }),
    );
    const screen = text();
    expect(screen, "어느 단계가 채웠는지 말하지 않는다").toContain("브랜드 프로필");
    expect(screen, "자동 적용된 값 자체가 화면에 없다").toContain("Bobo Choses S.L.");
    // 값이 있는데 "없습니다" 경고가 뜨면 셀러를 속이는 것이다.
    expect(screen).not.toContain("제조사 정보가 없습니다");
  });

  it("판매자 기본정보가 채웠으면 그렇게 말한다 — 브랜드 프로필이라고 하지 않는다", async () => {
    await renderPlatform(
      makeProduct(),
      undefined,
      resolution({ sellerProfileManufacturer: "따져코리아" }),
    );
    const screen = text();
    expect(screen).toContain("판매자 기본정보의 제조사");
    expect(screen).toContain("따져코리아");
  });

  /**
   * REWORK-12 ④·⑤(CEO 판정, 2026-09-15) — 같은 세 가지를 계속 요구하되,
   * **어디에 적히는가**가 바뀌었다.
   *
   *   BEFORE  128자짜리 문장 전체가 ⓘ(title + sr-only) 안에만 있었다.
   *           화면에 보이는 글자는 "제조사 미확인"과 "입력 필요"뿐이었다.
   *   AFTER   ⓘ에는 **무엇인지**(어디까지 찾아봤는지) 한 줄,
   *           화면에는 **다음 행동**(어느 브랜드 · 어디에 등록) 한 줄.
   *
   * 아래 단언은 여전히 `textContent` 전수라 ⓘ의 sr-only도 함께 읽는다 —
   * 즉 "정보가 사라지지 않았다"는 성질은 그대로 지킨다.
   */
  it("🔴 셋 다 없을 때만 직접 입력을 안내하고, 확인한 세 단계를 전부 적는다", async () => {
    await renderPlatform(makeProduct(), undefined, resolution({}));
    const screen = text();
    // ⓘ — 어디까지 찾아봤는가(세 단계를 전부 적는다).
    expect(screen).toContain("상품 원문 · 브랜드 프로필 · 판매자 기본정보 어디에도 제조사가 없습니다");
    // 화면 한 줄 — 어느 브랜드로 찾았고, 다음에 무엇을 하면 되는가.
    expect(screen).toContain("브랜드 「Bobo Choses」에 등록된 제조사가 없습니다");
    expect(screen).toContain("브랜드 프로필에 등록하세요");
  });

  /** REWORK-12 ④ — 브랜드 자체가 오염/부재면 «브랜드 프로필에 등록하세요»가
   *  실행 불가능한 안내가 된다. 그때는 다른 말을 한다. */
  it("브랜드가 비어 있으면 브랜드 프로필을 조회하지 못했다고 말한다", async () => {
    await renderPlatform(makeProduct(), undefined, { ...resolution({}), brand: "" });
    expect(text()).toContain("브랜드가 확인되지 않아 브랜드 프로필을 조회하지 못했습니다");
  });

  it("셀러가 직접 입력하면 그 값이 제조사 폴백을 이긴다 — 실제 타이핑", async () => {
    await renderPlatform(
      makeProduct(),
      undefined,
      resolution({ brandProfileManufacturer: "Bobo Choses S.L." }),
    );
    const input = Array.from(container.querySelectorAll("input")).find(
      (i) => (i.getAttribute("placeholder") ?? "") === "제조사 미확인",
    );
    expect(input, "제조사 입력칸이 화면에 없다").toBeTruthy();
    await type(input as HTMLInputElement, "직접입력제조사");
    expect(product.manufacturer.value).toBe("직접입력제조사");
    expect(noticeManufacturer(product, "Bobo Choses S.L.")).toBe("직접입력제조사");
  });
});

/* ══ DELTA-B ════════════════════════════════════════════════════════════════ */

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

/** 상품정보 화면의 두 노드 — CommerceWorkspace가 넘기는 것과 같은 배선. */
function SourceHarness({ initial }: { initial: CanonicalProduct }) {
  const [current, setCurrent] = useState(initial);
  useEffect(() => {
    product = current;
  }, [current]);
  return createElement("div", null, [
    createElement(SourceDataView, {
      key: "source",
      product: current,
      onUpdateField: (key: string, value: string) =>
        setCurrent((prev) => ({ ...prev, [key]: { value, source: "USER_EDITED", confidence: 1 } })),
      onUpdatePrice: () => {},
      onUpdateOptions: () => {},
      onSetModelNameReference: (referenced: boolean) =>
        setCurrent((prev) => ({
          ...prev,
          modelName: referenced
            ? { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }
            : { value: "", source: "REQUIRED", confidence: 0 },
        })),
      exchangeRates: null,
    } as never),
    createElement(MissingFieldsBulkPanel, {
      key: "required",
      product: current,
      onBulkApply: (keys: string[]) =>
        setCurrent((prev) => {
          const next = { ...prev } as Record<string, unknown>;
          for (const key of keys) next[key] = { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 };
          return next as unknown as CanonicalProduct;
        }),
    } as never),
  ]);
}

async function renderSource(initial: CanonicalProduct): Promise<void> {
  await act(async () => {
    root.render(createElement(SourceHarness, { initial }));
  });
}

function rowOf(label: string): HTMLTableRowElement {
  const cell = Array.from(container.querySelectorAll("td")).find(
    (td) => (td.textContent ?? "").trim() === label,
  );
  if (!cell) throw new Error(`「Source Data」에 '${label}' 줄이 없다`);
  return cell.closest("tr") as HTMLTableRowElement;
}

function modelRadios(): HTMLInputElement[] {
  return Array.from(rowOf(CATALOG_MODEL_NAME_LABEL).querySelectorAll('input[type="radio"]'));
}

async function clickLabelContaining(scope: HTMLElement, needle: string): Promise<void> {
  const label = Array.from(scope.querySelectorAll("label")).find((l) =>
    (l.textContent ?? "").includes(needle),
  );
  const radio = label?.querySelector('input[type="radio"]') as HTMLInputElement | undefined;
  if (!radio) throw new Error(`"${needle}" 선택지가 없다`);
  await act(async () => {
    radio.click();
  });
}

describe("DELTA-B ① — 이름이 «어느 모델명인가»를 말한다(라벨 전수)", () => {
  it("🔴 「Source Data」 줄 전수 — SKU 다음 칸의 이름이 「네이버 쇼핑 카탈로그 모델명」이다", async () => {
    await renderSource(makeProduct());
    const labels = Array.from(container.querySelectorAll("tbody tr")).map((tr) =>
      (tr.querySelector("td")?.textContent ?? "").trim(),
    );
    /* BEFORE(71e394d): … "SKU", "모델명", "옵션" …   ← 무슨 모델명인지 안 적혀 있다
       AFTER          : … "SKU", "네이버 쇼핑 카탈로그 모델명", "옵션" … */
    expect(labels).toEqual([
      "상품명",
      "브랜드",
      "가격",
      "SKU",
      "네이버 쇼핑 카탈로그 모델명",
      "옵션",
      "소재",
      "상세설명",
      "이미지",
    ]);
    expect(labels, "이름 없는 '모델명' 줄이 아직 남아 있다").not.toContain("모델명");
  });

  it("바로 아래 한 줄이 이 칸이 무엇인지 말한다 — SmartStore 카탈로그 식별용", async () => {
    await renderSource(makeProduct());
    const row = rowOf(CATALOG_MODEL_NAME_LABEL).textContent ?? "";
    /* REWORK-12 ⑤(CEO 판정, 2026-09-15: "툴팁 내용이 길어서") — 같은 사실을
       77자 → 40자로 줄인 문장이다. "무엇인지"는 그대로 있고, SKU와 다르다는
       구분도 그대로 있다. */
    expect(row).toContain("네이버 쇼핑 카탈로그가 상품을 식별하는 모델명입니다. 위 SKU와는 다른 값입니다.");
  });

  it("🔴 SKU와 완전히 분리된다 — 두 줄이 각자 자기 도착지를 달고 있다", async () => {
    await renderSource(makeProduct());
    expect(rowOf("SKU").textContent ?? "").toContain("└─ 판매자 상품관리번호");
    expect(rowOf(CATALOG_MODEL_NAME_LABEL).textContent ?? "").toContain("└─ 네이버 카탈로그 식별용 모델명");
    // 그리고 payload에서도 서로 다른 자리로 나간다(회귀 금지).
    expect(payloadOf(makeProduct()).originProduct.sellerManagementCode).toBe("AAA1804916");
    expect(catalogModelName(makeProduct()), "🔴 SKU가 카탈로그 모델명으로 새어 들어갔다").toBeUndefined();
  });
});

describe("DELTA-B ② — «상세페이지 참조»가 무엇을 가져오는지 고르기 전에 말한다", () => {
  it("🔴 두 선택지가 라디오로 서 있다 — 직접 입력 / 상세페이지에서 찾기", async () => {
    await renderSource(makeProduct());
    const row = rowOf(CATALOG_MODEL_NAME_LABEL);
    expect(modelRadios().length, "선택지가 두 개가 아니다").toBe(2);
    const t = row.textContent ?? "";
    expect(t).toContain("직접 입력");
    expect(t).toContain("상세페이지에서 찾기");
    // 🔴 고르기 **전에** 무엇을 가져오는지 적혀 있다.
    expect(t).toContain("상세페이지의 고시정보 모델명을 사용합니다.");
  });

  it("아직 아무것도 안 골랐으면 «직접 입력»이 선택돼 있다 — 기본이 막다른 길이 아니다", async () => {
    await renderSource(makeProduct());
    const [direct, reference] = modelRadios();
    expect(direct.checked).toBe(true);
    expect(reference.checked).toBe(false);
  });

  it("🔴 «상세페이지에서 찾기»를 실제로 누르면 무엇이 비는지 그 자리에서 말한다", async () => {
    await renderSource(makeProduct());
    await clickLabelContaining(rowOf(CATALOG_MODEL_NAME_LABEL), "상세페이지에서 찾기");

    expect(product.modelName.source).toBe("DETAIL_PAGE_REFERENCE");
    const row = rowOf(CATALOG_MODEL_NAME_LABEL).textContent ?? "";
    /* REWORK-12 ⑤ — 108자 → 41자. 두 사실(참조가 채우는 것 · 이 칸은 직접
       입력해야 한다는 것)은 그대로다. */
    expect(row).toContain("“상세페이지 참조”는 고시정보 모델명만 채웁니다");
    expect(row).toContain("직접 입력해야 합니다");
    // 화면이 말한 그대로 payload가 비어 있다(거짓말이 아니다).
    expect(catalogModelName(product)).toBeUndefined();
    expect(missingLabels(product)).toContain(CATALOG_MODEL_NAME_LABEL);
  });

  it("🔴 «직접 입력»으로 돌아와 값을 치면 payload의 카탈로그 자리에 도달한다", async () => {
    await renderSource(makeProduct({ modelName: field("", "DETAIL_PAGE_REFERENCE") } as never));
    await clickLabelContaining(rowOf(CATALOG_MODEL_NAME_LABEL), "직접 입력");
    expect(product.modelName.source).toBe("REQUIRED");

    const input = rowOf(CATALOG_MODEL_NAME_LABEL).querySelector(
      "input[data-draft-field]",
    ) as HTMLInputElement;
    await type(input, "B226AC043");

    expect(product.modelName.source).toBe("USER_EDITED");
    expect(catalogModelName(product)).toBe("B226AC043");
    expect(missingLabels(product)).not.toContain(CATALOG_MODEL_NAME_LABEL);
    // 🔴 SKU는 자기 자리로 따로 나간다 — 서로 덮어쓰지 않는다.
    expect(payloadOf(product).originProduct.sellerManagementCode).toBe("AAA1804916");
    expect(product.sku.value).toBe("AAA1804916");
  });
});

describe("DELTA-B ③ — 부족 항목 목록에서 두 모델명이 서로 다른 이름으로 선다", () => {
  it("🔴 고시정보 쪽과 카탈로그 쪽이 같은 이름으로 두 번 뜨지 않는다", () => {
    const labels = missingLabels(makeProduct());
    expect(labels).toContain(CATALOG_MODEL_NAME_LABEL);
    expect(labels).toContain("고시정보 모델명");
    expect(labels, "이름 없는 '모델명'이 아직 목록에 있다").not.toContain("모델명");
  });

  it("🔴 등록 게이트 문장이 «별도 값»을 첫 문장에서 말한다 — 뒤에서 설명하지 않는다", () => {
    const blocked = validationOf(makeProduct()).fields.find(
      (f) => f.field === "naverShoppingSearchInfo.modelName",
    );
    const reason = String(blocked?.reason ?? "");
    expect(reason.startsWith("네이버 쇼핑 카탈로그 모델명이 필요합니다")).toBe(true);
    expect(reason).toContain("상세페이지 고시정보의 모델명과는 별도 값입니다");
  });

  it("일괄 참조 패널의 항목 이름도 「고시정보 모델명」이다 — 여기서 채워지는 자리 그대로", async () => {
    await renderSource(makeProduct());
    const panel = text();
    expect(panel).toContain("고시정보 모델명");
    expect(panel).toContain("모델명은 두 가지입니다");
    expect(panel).toContain(CATALOG_MODEL_NAME_LABEL);
  });
});
import { manufacturerFixture } from "./manufacturer-fixture";
