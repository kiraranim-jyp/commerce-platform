// @vitest-environment jsdom
import { act, createElement, useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import { StageBody } from "../StageBody";
import { SourceDataView } from "../SourceDataView";
import { MissingFieldsBulkPanel } from "../MissingFieldsBulkPanel";
import { computeNaverPayloadReadiness } from "../readiness";
import { resolveStageFocus } from "../stage-focus";
import { MARKET_SIGNAL_NOT_STARTED, resolveWorkflow } from "../workflow";

/**
 * REWORK-8 ①(CEO 지시, 2026-09-15) — **모델명을 상품정보에서 입력할 수 있는가.**
 *
 * ── CEO 실측 신고 ─────────────────────────────────────────────────────────
 *   상품명        정상
 *   상품코드(SKU)  AAA1804916
 *   모델명         비어 있음
 *   화면           "네이버 쇼핑 카탈로그 모델명이 없습니다"
 *   그런데         실제 입력할 "모델명" 필드가 화면에 없다
 *
 * ── 판정(유지) ───────────────────────────────────────────────────────────
 * REWORK-7 ③의 **B** — SKU와 카탈로그 모델명은 별개다. 그 결론은 바꾸지 않는다
 * (rework6-modelname-chain.test.ts가 payload로 세 갈래를 이미 못 박아 뒀다).
 * 이번에 바뀌는 것은 결론이 아니라 **입력 자리**다.
 *
 * ── 실측한 근본 원인 ──────────────────────────────────────────────────────
 * 고치기 전 상품정보 화면(StageBody)에서 모델명에 도달하는 길은 하나뿐이었다:
 * 「필수 정보」 패널의 체크박스. 그 체크박스가 하는 일은 «상세페이지 참조»로
 * 바꾸는 것이고, 그것은 고시정보 모델명만 채우고
 * naverShoppingSearchInfo.modelName은 끝내 비운다. 즉 **상품정보에서 셀러가 할
 * 수 있는 유일한 동작이 막다른 길을 만드는 동작**이었다.
 * 직접 입력칸은 채널 탭(PlatformPreview)에만 있었다.
 *
 * ── 이 파일이 고정하는 것 ─────────────────────────────────────────────────
 * CEO가 지정한 **전체 사슬 9단계**를 상품정보 화면에서 실제 마운트·클릭·타이핑
 * 으로 끝까지 밟는다. 정적 렌더로 판정하지 않는다.
 *   ① 부족 항목 발견 → ② 왜 필요한지 → ③ 어디서 입력 → ④ 이동 →
 *   ⑤ 실제 값 입력 → ⑥ 저장 → ⑦ readiness 재계산 → ⑧ 부족 항목 제거 →
 *   ⑨ 실제 Naver payload 도달
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL") {
  return { value, source, confidence: 1 } as never;
}

/**
 * 🔴 모델명 **하나만** 남긴 상품이다(rework6과 같은 이유). 그리고 CEO가 실제로
 * 본 값을 그대로 쓴다 — SKU는 AAA1804916이고, 그 값이 있어도 카탈로그 모델명은
 * 채워지지 않는다는 것이 이 신고의 핵심이다.
 *
 * description에 "Product code" 표기가 없다 — resolveModelNameFromDescription()이
 * 실패하는 실제 조건이고, 그때만 이 필드가 셀러 입력에 의존한다.
 */
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
    manufacturer: field("보보쇼즈"),
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
    /* 🔴 출발점 — 원본에서 못 읽은 상태(REQUIRED). 「필수 정보」 패널이 세는
       바로 그 상태이고, 셀러가 그 패널에서 체크하면 DETAIL_PAGE_REFERENCE가
       된다(그 경로도 아래에서 따로 밟는다). */
    modelName: field("", "REQUIRED"),
    weight: field("120g"),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
    ...overrides,
  } as unknown as CanonicalProduct;
}

/** 배송/주소/원산지 — 이 테스트의 관심사가 아니라 전부 채워 둔다. */
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
  // 어린이인증 대상 카테고리 — naverShoppingSearchInfo.modelName이 NotEmpty로
  // 요구되는 바로 그 조건이다.
  categoryRequiresChildCertification: true,
} as const;

function listingOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

function payloadOf(product: CanonicalProduct) {
  return buildNaverProductPayload({ product, listing: listingOf(product), ...PAYLOAD_ARGS } as never);
}

/** 🔴 서버 판정을 흉내 내지 않는다 — 실제 화면이 부르는 **같은 함수**를 부른다. */
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

function catalogModelName(product: CanonicalProduct): string | undefined {
  return payloadOf(product).originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName;
}

const CATALOG_MODEL_NAME = "네이버 쇼핑 카탈로그 모델명";

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

/**
 * 상품정보 화면 그대로 — CommerceWorkspace가 StageBody에 넘기는 것과 **같은**
 * 두 노드를 실제로 넣는다(source: SourceDataView, required: MissingFieldsBulkPanel).
 * 상태 전이(updateField/bulkSetFieldReference)도 CommerceWorkspace의 구현을
 * 그대로 옮긴 것이다 — 손으로 지어낸 setter를 쓰면 "저장된다"를 검사할 수 없다.
 */
function Harness({ initial }: { initial: CanonicalProduct }) {
  const [current, setCurrent] = useState(initial);
  // 렌더 중 바깥 변수를 건드리지 않는다(rework6 하네스와 같은 방식).
  useEffect(() => {
    product = current;
  }, [current]);

  const workflow = useMemo(
    () =>
      resolveWorkflow({
        collection: { running: false, percent: 100, productReady: true, imageCount: 6, failedImageCount: 0 },
        market: MARKET_SIGNAL_NOT_STARTED,
        prepare: {
          productInfoOk: true,
          productInfoMissing: null,
          optionGroupCount: 0,
          imageCount: 6,
          detailReady: true,
          priceResolved: true,
          priceKrw: 128000,
          requiredFieldBlockingCount: 0,
        },
        register: { channels: [] },
      }),
    [],
  );

  return createElement(StageBody, {
    focus: resolveStageFocus({ stage: workflow.currentStepKey, surface: "PRODUCT", marketDetailOpen: false }),
    workflow,
    channels: [],
    onGoToChannel: () => {},
    marketEvidence: createElement("div", null, "시장 근거"),
    archive: createElement("div", null, "기록"),
    surfaces: {
      source: createElement(SourceDataView, {
        product: current,
        onUpdateField: (key: string, value: string) =>
          setCurrent((prev) => ({ ...prev, [key]: { value, source: "USER_EDITED", confidence: 1 } })),
        onUpdatePrice: () => {},
        onUpdateOptions: () => {},
        /* DELTA-B(2026-09-15) — CommerceWorkspace.setFieldReference("modelName", …)
           그대로다. 이것을 넘기지 않으면 화면과 다른 모양(라디오 없는 입력칸만)을
           검사하게 된다. */
        onSetModelNameReference: (referenced: boolean) =>
          setCurrent((prev) => ({
            ...prev,
            modelName: referenced
              ? { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }
              : { value: "", source: "REQUIRED", confidence: 0 },
          })),
        exchangeRates: null,
      } as never),
      images: createElement("div", null, "IMAGES"),
      price: createElement("div", null, "PRICE"),
      required: createElement(MissingFieldsBulkPanel, {
        product: current,
        onBulkApply: (keys: string[]) =>
          setCurrent((prev) => {
            const next = { ...prev } as Record<string, unknown>;
            for (const key of keys) next[key] = { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 };
            return next as unknown as CanonicalProduct;
          }),
      } as never),
    },
  } as never);
}

async function render(initial: CanonicalProduct): Promise<void> {
  await act(async () => {
    root.render(createElement(Harness, { initial }));
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 접힘 머리(버튼)를 실제로 누른다 — "이동"이 이 화면에서 갖는 형태다. */
async function clickSection(title: string): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(title),
  );
  if (!button) throw new Error(`"${title}" 접힘이 화면에 없다`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 「Source Data」 표의 모델명 줄(라벨 셀 → 그 행 전체).
 *
 * DELTA-B(CEO 판정, 2026-09-15) — 이 줄의 이름이 "모델명"에서
 * 「네이버 쇼핑 카탈로그 모델명」으로 바뀌었다. 칸만 만들고 이름을 그대로 두면
 * 고시정보 모델명과 섞여 읽힌다는 판정이다. */
function modelNameRow(): HTMLTableRowElement {
  const cell = Array.from(container.querySelectorAll("td")).find(
    (td) => (td.textContent ?? "").trim() === CATALOG_MODEL_NAME,
  );
  if (!cell) throw new Error(`「Source Data」에 '${CATALOG_MODEL_NAME}' 줄이 없다`);
  return cell.closest("tr") as HTMLTableRowElement;
}

/** DELTA-B — 이 줄에는 이제 라디오(직접 입력 / 상세페이지에서 찾기)도 있다.
 *  타이핑할 칸은 EditableText가 그리는 것 하나뿐이다(data-draft-field). */
function modelNameInput(): HTMLInputElement {
  const input = modelNameRow().querySelector("input[data-draft-field]");
  if (!input) throw new Error(`'${CATALOG_MODEL_NAME}' 줄에 입력칸이 없다`);
  return input as HTMLInputElement;
}

/** 실제 타이핑 — EditableText는 blur 시점에만 onCommit한다. */
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

/* ── 0. 근본 원인 — 참조로는 이 자리를 못 채운다(판정 유지) ─────────────────── */

describe("REWORK-8 ① — 근본 원인은 문구가 아니라 자리다", () => {
  it("🔴 SKU가 있어도 카탈로그 모델명은 비어 있다 — SKU를 복사하지 않는다(B 판정 유지)", () => {
    const p = makeProduct();
    expect(p.sku.value).toBe("AAA1804916");
    expect(payloadOf(p).originProduct.sellerManagementCode).toBe("AAA1804916");
    expect(catalogModelName(p), "🔴 판매처 재고번호가 카탈로그 모델명으로 새어 들어갔다").toBeUndefined();
    expect(missingLabels(p)).toContain(CATALOG_MODEL_NAME);
  });

  it("🔴 「필수 정보」 패널의 체크박스만으로는 끝까지 못 간다 — 참조는 절반만 대체한다", async () => {
    await render(makeProduct());
    await clickSection("필수 정보");

    // 실제로 체크하고 적용한다(클릭 2회).
    const rows = Array.from(container.querySelectorAll("label")).filter((l) =>
      (l.textContent ?? "").includes("모델명"),
    );
    const checkbox = rows[0]?.querySelector("input[type=checkbox]") as HTMLInputElement | undefined;
    expect(checkbox, "「필수 정보」에 모델명 체크박스가 없다").toBeTruthy();
    await act(async () => {
      checkbox!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const apply = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("상세페이지 참조로 일괄 등록"),
    );
    expect(apply, "일괄 적용 버튼이 없다").toBeTruthy();
    await act(async () => {
      apply!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // 참조가 되긴 했다 — 그런데 카탈로그 모델명은 여전히 비어 있고 부족 항목도 그대로다.
    expect(product.modelName.source).toBe("DETAIL_PAGE_REFERENCE");
    expect(catalogModelName(product)).toBeUndefined();
    expect(missingLabels(product), "참조로 처리했는데 부족 항목이 사라졌다면 셀러를 속이는 것이다").toContain(
      CATALOG_MODEL_NAME,
    );
  });

  it("그 막다른 길을 그 자리에서 말한다 — 체크박스 옆에 «절반만 대체»라고 적혀 있다", async () => {
    await render(makeProduct());
    await clickSection("필수 정보");
    const panel = text();
    /* DELTA-B(2026-09-15) — 문구가 «절반만 대체»에서 «두 가지입니다»로 바뀌었다.
       "절반"은 한 값이 반만 들어간다고 읽히지만 실제로는 **서로 다른 두 필드**다.
       패널의 체크 항목 이름도 「고시정보 모델명」으로 바뀌어, 이 패널이 손대는
       자리가 어디인지가 항목 이름 자체에 있다. */
    expect(panel).toContain("고시정보 모델명");
    expect(panel).toContain("모델명은 두 가지입니다");
    expect(panel).toContain(CATALOG_MODEL_NAME);
    expect(panel, "어디로 가야 하는지 말하지 않는다").toContain("Source Data");
  });
});

/* ── 1. CEO 지정 전체 사슬 9단계 — 상품정보 화면에서 ────────────────────────── */

describe("REWORK-8 ① — 전체 사슬 9단계(상품정보에서 끝까지)", () => {
  it("🔴 9단계를 한 번에 끝까지 밟는다", async () => {
    await render(makeProduct());

    /* ① 부족 항목 발견 — 화면이 읽는 것과 같은 목록에 이 필드가 서 있다. */
    expect(missingLabels(product), "부족 항목에 카탈로그 모델명이 없다").toContain(CATALOG_MODEL_NAME);

    /* ② 왜 필요한가 — 서버 판정이 이유를 들고 있다(화면이 그대로 읽는 문장). */
    const blocked = validationOf(product).fields.find(
      (f) => f.field === "naverShoppingSearchInfo.modelName",
    );
    expect(blocked, "서버 판정이 이 필드를 들고 있지 않다").toBeTruthy();
    expect(String(blocked?.reason ?? "")).toContain("네이버 쇼핑 카탈로그 검색");

    /* ③ 어디서 입력 — 상품정보 화면에 「Source Data」 자리가 있다(펼치기 전). */
    expect(text()).toContain("Source Data");

    /* ④ 이동 — 접힘 머리를 실제로 누른다. 펼치기 전에는 입력칸이 없다. */
    expect(
      Array.from(container.querySelectorAll("td")).some((td) => (td.textContent ?? "").trim() === "모델명"),
      "펼치기 전인데 모델명 줄이 이미 그려져 있다 — 이 테스트의 ④가 무의미해진다",
    ).toBe(false);
    await clickSection("Source Data");

    /* ⑤ 실제 값 입력 — 입력칸이 정말 있고, 거기에 타이핑한다. */
    const input = modelNameInput();
    /* DELTA-B(2026-09-15) — 이름은 placeholder가 아니라 **줄 라벨**이 진다
       (「네이버 쇼핑 카탈로그 모델명」). placeholder는 예시값만 든다. */
    expect(modelNameRow().textContent ?? "").toContain(CATALOG_MODEL_NAME);
    expect(input.getAttribute("placeholder") ?? "").toContain("B226AC043");
    await type(input, "B226AC043");

    /* ⑥ 저장 — 상품 모델에 USER_EDITED로 남는다. */
    expect(product.modelName.value).toBe("B226AC043");
    expect(product.modelName.source).toBe("USER_EDITED");
    // SKU는 건드리지 않았다(둘이 서로를 덮어쓰지 않는다).
    expect(product.sku.value).toBe("AAA1804916");

    /* ⑦ readiness 재계산 — 서버 판정이 더 이상 이 필드를 들고 있지 않다. */
    const recomputed = validationOf(product);
    expect(
      recomputed.fields.filter((f) => f.field === "naverShoppingSearchInfo.modelName"),
      "값을 넣었는데 서버 판정이 여전히 이 필드를 들고 있다",
    ).toEqual([]);
    expect(recomputed.blockedCount).toBeLessThan(validationOf(makeProduct()).blockedCount);

    /* ⑧ 부족 항목 제거 — 화면이 읽는 목록에서 사라진다. */
    expect(missingLabels(product), "값을 넣었는데 부족 항목에 그대로 남아 있다").not.toContain(
      CATALOG_MODEL_NAME,
    );

    /* ⑨ 실제 Naver payload 도달 — 화면이 아니라 payload가 대답한다. */
    expect(catalogModelName(product)).toBe("B226AC043");
    // 그리고 SKU는 자기 자리로 따로 나간다(두 칸이 각자 채워진다).
    expect(payloadOf(product).originProduct.sellerManagementCode).toBe("AAA1804916");
  });

  /**
   * 🔴 참조를 이미 눌러 둔 셀러(= CEO가 본 그 상태)도 같은 자리에서 빠져나올 수
   * 있어야 한다. 채널 탭은 참조 상태에서 입력칸을 숨기므로(ReferenceEligibleFieldRow),
   * 상품정보의 이 칸이 **항상 열려 있다**는 것이 이번 자리의 값어치다.
   */
  it("참조 상태에서도 상품정보의 모델명 칸은 그대로 열려 있다 — 여기서 바로 벗어난다", async () => {
    await render(makeProduct({ modelName: field("", "DETAIL_PAGE_REFERENCE") } as never));
    await clickSection("Source Data");

    const row = modelNameRow().textContent ?? "";
    expect(row, "참조 상태라고 말하지 않는다").toContain("상세페이지 참조");
    expect(row).toContain(CATALOG_MODEL_NAME);

    await type(modelNameInput(), "B226AC043");
    expect(product.modelName.source).toBe("USER_EDITED");
    expect(catalogModelName(product)).toBe("B226AC043");
    expect(missingLabels(product)).not.toContain(CATALOG_MODEL_NAME);
  });

  /**
   * 변경 전/후 차이를 코드로 못 박는다.
   *   BEFORE(1768910): 상품명 · 브랜드 · 가격 · SKU · 옵션 · 소재 · 상세설명 (모델명 0건)
   *   AFTER          : SKU 바로 다음에 모델명이 한 줄 들어온다
   * 순서까지 고정하는 이유: 모델명이 SKU 옆에 서야 "둘은 다른 값"이 화면에서
   * 읽힌다. 멀리 떨어뜨리면 셀러는 다시 SKU를 모델명으로 읽는다.
   */
  it("🔴 「Source Data」 줄 전수 — SKU 다음 자리에 모델명이 새로 섰다(BEFORE 0건)", async () => {
    await render(makeProduct());
    await clickSection("Source Data");
    const labels = Array.from(container.querySelectorAll("tbody tr")).map((tr) =>
      (tr.querySelector("td")?.textContent ?? "").trim(),
    );
    /* DELTA-B(CEO 판정, 2026-09-15) — 자리는 그대로 SKU 다음이고, **이름이**
       「네이버 쇼핑 카탈로그 모델명」으로 바뀌었다. */
    expect(labels).toEqual([
      "상품명",
      "브랜드",
      "가격",
      "SKU",
      CATALOG_MODEL_NAME,
      "옵션",
      "소재",
      "상세설명",
      "이미지",
    ]);
  });

  it("SKU 칸과 모델명 칸이 서로 다른 줄로 나란히 선다 — 같은 값이 아니라고 화면이 말한다", async () => {
    await render(makeProduct());
    await clickSection("Source Data");
    const row = modelNameRow().textContent ?? "";
    expect(row).toContain("네이버 카탈로그 식별용 모델명");
    expect(row).toContain("네이버 쇼핑 카탈로그");
    // SKU 줄은 그대로 살아 있다.
    expect(
      Array.from(container.querySelectorAll("td")).some((td) => (td.textContent ?? "").trim() === "SKU"),
      "SKU 줄이 사라졌다",
    ).toBe(true);
  });
});
