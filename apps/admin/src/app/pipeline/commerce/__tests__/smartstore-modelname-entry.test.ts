// @vitest-environment jsdom
import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { computeNaverPayloadReadiness } from "../readiness";
import { buildPriorityItems, describePriorityItem } from "../readiness-state";

/**
 * REWORK-5 ②(CEO 지시, 2026-09-14) — **셀러가 모델명을 어디에 넣는지 알 수
 * 있는가, 그리고 넣으면 실제로 들어가는가.**
 *
 * ── 신고된 상태 ───────────────────────────────────────────────────────────
 * 부족정보가 `naverShoppingSearchInfo.modelName 이 없습니다`로 끝났다. 필드
 * 경로를 날것으로 읽어 주는 문장이라 셀러는 어디에 무엇을 넣어야 하는지 알 수
 * 없다. 실제로 함수를 돌려 확인한 BEFORE는 이랬다(추측이 아니라 실행 결과):
 *
 *   label     "naverShoppingSearchInfo.modelName"
 *   sectionId  undefined
 *   where     "이 화면의 아래 필수항목 목록에서 해당 항목을 찾아 채웁니다."
 *   action     null          ← 🔴 [이동] 버튼이 아예 그려지지 않았다
 *
 * ── 이 파일이 고정하는 것 ─────────────────────────────────────────────────
 *  1. 카드 4요소(무엇 · 왜 · 어디서 · [이동])가 전부 선다.
 *  2. 🔴 그 [이동]이 가리키는 자리에 **정말 입력이 되는가** — 서버 렌더로는
 *     증명할 수 없다. 「기본정보」를 실제로 펼치고, "직접 입력으로 전환"을
 *     누르고, 입력칸에 타이핑하고 blur까지 해서 확인한다.
 *  3. 그렇게 넣은 값이 **payload의 그 필드**에 실제로 도착한다. 화면만 바뀌고
 *     payload가 그대로면 안내는 여전히 거짓말이다.
 *  4. 🔴 "상세페이지 참조"로는 이 필드가 채워지지 않는다는 사실 — 입력칸 바로
 *     옆에 그 버튼이 붙어 있어서 셀러가 그것을 누를 수 있다. 누르면 차단이
 *     풀리지 않는데, 그 사실이 안내에 적혀 있어야 안내가 거짓말이 아니게 된다.
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
    sku: field("B226AC043"),
    // 🔴 원문에 "Product code" 표기가 없다 — 자동추출이 실패하는 실제 조건이다.
    description: field("Terry bermuda shorts for kids."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
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
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
    ...overrides,
  } as unknown as CanonicalProduct;
}

/* ── 1. 카드 4요소 ───────────────────────────────────────────────────────── */

/** validateNaverPayload가 이 필드를 막을 때 내놓는 모양 그대로. */
function blockedModelNameValidation() {
  return {
    ok: false,
    fields: [
      {
        field: "naverShoppingSearchInfo.modelName",
        status: "BLOCKED",
        reason:
          "네이버 쇼핑 카탈로그 검색·연결에 필요한 값입니다. 현재 상태: 상품 원문에서 모델명(Product code 표기)을 찾지 못했습니다 — 「기본정보」의 \"모델명\"에 직접 입력해야 합니다(이 필드는 \"상세페이지 참조\"로 대체할 수 없습니다).",
        code: "KC_CERTIFICATION_REQUIRED",
      },
    ],
  } as never;
}

describe("REWORK-5 ② — 부족정보 카드가 네 가지를 다 말한다", () => {
  const summary = computeNaverPayloadReadiness(blockedModelNameValidation());
  const guidance = describePriorityItem(buildPriorityItems(summary, true, "section-price")[0]);

  it("① 무엇 — 필드 경로가 아니라 셀러가 읽는 이름이다", () => {
    expect(summary.required[0].label).toBe("네이버 쇼핑 카탈로그 모델명");
    expect(guidance.what).toContain("네이버 쇼핑 카탈로그 모델명");
    // 신고된 그 문자열이 화면에 남아 있으면 안 된다.
    expect(guidance.what).not.toContain("naverShoppingSearchInfo");
  });

  it("② 왜 필요한가 — 네이버 쇼핑 카탈로그에 필요한 값이라고 말한다", () => {
    expect(guidance.why).toContain("네이버 쇼핑 카탈로그");
  });

  it("③ 현재 상태 — 원문에서 찾지 못했다고 말한다", () => {
    expect(guidance.why).toContain("상품 원문에서 모델명");
  });

  it("④ 입력 위치 — 「기본정보」를 지목한다", () => {
    expect(guidance.where).toBe("이 화면의 「기본정보」에서 입력합니다.");
  });

  it("🔴 [이동] 버튼이 실제로 만들어진다 — BEFORE에는 action이 null이었다", () => {
    expect(guidance.action).toEqual({
      kind: "SECTION",
      sectionId: "section-basic",
      label: "「기본정보」에서 입력하기 →",
    });
  });

  it("🔴 상세페이지 참조로는 대체할 수 없다는 사실이 안내에 적혀 있다", () => {
    expect(guidance.why).toContain("상세페이지 참조");
  });
});

/* ── 2. 그 자리에서 정말 입력이 되는가(마운트 · 클릭 · 타이핑) ─────────────── */

let container: HTMLDivElement;
let root: Root;

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

/**
 * 화면의 상태 = 상품이다. CommerceWorkspace의 updateField/setFieldReference와
 * **같은 동작**을 여기서 그대로 재현한다(그 두 함수가 하는 일은 각각
 * `{value, source:"USER_EDITED"}` 와 `{value:"", source:REQUIRED|
 * DETAIL_PAGE_REFERENCE}`로 필드를 통째로 갈아끼우는 것뿐이다).
 */
let product: CanonicalProduct;

/**
 * 상품 상태를 **React가 들고 있게** 한다 — CommerceWorkspace가 하는 것과 같다
 * (그 화면도 `useState<CanonicalProduct>` 하나가 상품을 들고, updateField/
 * setFieldReference가 그것을 갈아끼운다). 바깥에서 root.render()를 다시 부르는
 * 방식으로 흉내 내면 act() 안에서 act()가 겹쳐 커밋이 유실된다(실제로 그
 * 방식에서는 타이핑한 값이 빈 채로 남았다 — EditableText 자체는 정상이라는 것을
 * 따로 확인한 뒤 이 구조로 바꿨다).
 */
function Harness({ initial }: { initial: CanonicalProduct }) {
  const [current, setCurrent] = useState(initial);
  /* 테스트가 "지금 상품이 무엇인가"를 읽는 창구. 렌더 중에 바깥 변수를 고치면
     렌더가 순수하지 않으므로(그리고 lint가 정확히 그것을 막는다) effect에서
     옮긴다 — act()가 effect까지 flush하므로 각 동작 직후 값은 최신이다. */
  useEffect(() => {
    product = current;
  }, [current]);
  return createElement(PlatformPreview, {
    manufacturerResolution: manufacturerFixture(),
    product: current,
    listing: PLATFORM_ADAPTERS.smartstore.toListingModel(
      current,
      UNRESOLVED_CATEGORY,
      undefined,
      "smartstore",
    ),
    categoryCandidates: [],
    listingStatus: "DRAFT" as const,
    listingResult: null,
    // CommerceWorkspace.updateField와 같은 동작.
    onFixTextField: (key: string, value: string) =>
      setCurrent((prev) => ({ ...prev, [key]: { value, source: "USER_EDITED", confidence: 1 } })),
    // CommerceWorkspace.setFieldReference와 같은 동작.
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
  } as never);
}

async function render(initial: CanonicalProduct): Promise<void> {
  await act(async () => {
    root.render(createElement(Harness, { initial }));
  });
}

/** 실제 어댑터가 만드는 ListingModel 그대로 — 손으로 지어낸 모양을 쓰면
 *  화면이 읽는 필드가 하나만 달라도 이 테스트가 실제 화면과 갈라진다. */
function makeListing() {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(
    product,
    UNRESOLVED_CATEGORY,
    undefined,
    "smartstore",
  );
}

/**
 * 셀러가 하는 일 그대로 — 그 글자가 보이는 버튼을 누른다.
 *
 * 🔴 반드시 **모델명 줄 안에서** 찾는다. 「기본정보」에는 참조 가능한 필드가
 * 여러 개라 "상세페이지 참조로 등록" 버튼이 6개 있다(실제 덤프로 확인) —
 * 화면 전체에서 첫 번째를 누르면 소재/색상 같은 엉뚱한 줄을 건드리고도
 * 테스트는 초록으로 지나간다.
 */
async function clickInModelNameRow(label: string): Promise<void> {
  const button = Array.from(modelNameRow().querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").trim().includes(label),
  );
  if (!button) throw new Error(`모델명 줄에 "${label}" 버튼이 없다`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/**
 * **지금 화면 상태 그대로** SmartStore payload를 만든다. 등록 경로가 실제로
 * 쓰는 buildNaverProductPayload()를 그대로 부른다 — 이 필드가 payload에
 * 도착하는지는 그 함수만이 대답할 수 있다(배송/원산지 인자는 이 테스트의
 * 관심사가 아니라 자리만 채운다).
 */
function payloadNow() {
  return buildNaverProductPayload({
    product,
    listing: makeListing(),
    leafCategoryId: "50000167",
    releaseAddressBookNo: "1",
    refundAddressBookNo: "1",
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    sellerDeliveryFee: null,
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 6000,
    originAreaCode: "0200037",
    originAreaRequiresContent: false,
  } as never);
}

/** 「기본정보」 아코디언 안의 모델명 줄을 찾는다(라벨 → 그 줄 전체).
 *
 * DELTA-B(CEO 판정, 2026-09-15) — 라벨이 "모델명"에서
 * "모델명(고시정보 + 네이버 쇼핑 카탈로그)"로 바뀌었다. 접두 일치로 찾되 그런
 * 라벨이 화면에 하나뿐이라는 것을 함께 확인한다(엉뚱한 줄을 잡으면 초록으로
 * 지나가 버린다). */
function modelNameRow(): HTMLElement {
  const candidates = Array.from(container.querySelectorAll("label")).filter((l) =>
    (l.textContent ?? "").trim().startsWith("모델명"),
  );
  if (candidates.length > 1) throw new Error(`"모델명"으로 시작하는 라벨이 ${candidates.length}개다`);
  const label = candidates[0];
  if (!label) throw new Error("「기본정보」에 '모델명' 라벨이 없다");
  const row = label.closest("div")?.parentElement;
  if (!row) throw new Error("'모델명' 줄을 찾지 못했다");
  return row as HTMLElement;
}

/** 실제 타이핑 — React의 controlled input에 값을 넣고 blur까지 한다. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    input.focus();
  });
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // EditableText는 blur 시점에만 onCommit한다(타이핑마다 상위를 갱신하지 않는다).
  // React의 onBlur는 네이티브 "blur"가 아니라 **focusout**으로 위임된다("blur"는
  // 버블링하지 않아 루트에서 잡히지 않는다) — 실제로 blur를 쏘면 onCommit이
  // 불리지 않고 값이 빈 채로 남는 것을 확인했다.
  await act(async () => {
    input.blur();
  });
}

/**
 * 「기본정보」는 이 화면에서 **기본으로 펼쳐져 있다**(아코디언 머리가
 * "기본정보접기 ▲"로 렌더된다 — 실제 덤프로 확인했다). 무조건 누르면 오히려
 * 접혀서 입력칸이 사라진다. 그래서 "접혀 있을 때만" 펼친다 — 셀러가 화면에서
 * 하는 판단과 같다.
 */
async function openBasicSection(): Promise<void> {
  const head = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").startsWith(sectionTitle("BASIC")),
  );
  if (!head) throw new Error("「기본정보」 섹션 머리가 화면에 없다");
  if ((head.textContent ?? "").includes("펼치기")) {
    await act(async () => {
      head.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }
}

describe("REWORK-5 ② — 「기본정보」에서 정말 입력이 되는가(실제 클릭 · 타이핑)", () => {
  it("🔴 상세페이지 참조 상태에서 [직접 입력으로 전환]을 누르면 입력칸이 나오고, 친 값이 상품에 들어간다", async () => {
    // 셀러가 이미 "상세페이지 참조"를 눌러 둔 상태에서 시작한다 — 이 화면에서
    // 실제로 가장 헷갈리는 출발점이고, CEO가 지목한 바로 그 버튼이다.
    await render(makeProduct({ modelName: field("", "DETAIL_PAGE_REFERENCE") }));
    await openBasicSection();

    // 참조 상태에서는 입력칸이 없다 — 그래서 "전환"이 필요하다.
    expect(modelNameRow().querySelector("input")).toBeNull();
    expect(modelNameRow().textContent).toContain("상세페이지 참조로 등록됩니다");

    await clickInModelNameRow("직접 입력으로 전환");

    const input = modelNameRow().querySelector("input");
    expect(input, "전환했는데 입력칸이 나타나지 않았다").not.toBeNull();

    await type(input as HTMLInputElement, "B226AC043 AW26");

    expect(product.modelName.value).toBe("B226AC043 AW26");
    expect(product.modelName.source, "USER_EDITED가 아니면 payload가 이 값을 쓰지 않는다").toBe(
      "USER_EDITED",
    );
  });

  it("🔴 그렇게 넣은 값이 payload의 naverShoppingSearchInfo.modelName에 실제로 도착한다", async () => {
    await render(makeProduct({ modelName: field("", "DETAIL_PAGE_REFERENCE") }));
    await openBasicSection();
    await clickInModelNameRow("직접 입력으로 전환");
    await type(modelNameRow().querySelector("input") as HTMLInputElement, "B226AC043 AW26");

    const payload = payloadNow();
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName).toBe(
      "B226AC043 AW26",
    );
  });

  /**
   * 🔴 이것이 "안내가 거짓말이 되는" 경로다. 입력칸 바로 아래에 「상세페이지
   * 참조로 등록」 버튼이 붙어 있어서 셀러가 그것을 누를 수 있는데, 누르면
   * payload의 카탈로그 모델명은 **끝내 비어 있다**(build-payload.ts가
   * USER_EDITED일 때만 이 값을 쓴다 — 카탈로그 매칭용 필드에 "상세페이지
   * 참조"라는 문구를 넣을 수 없기 때문이다). 그래서 위 안내 문구가 그 사실을
   * 명시한다.
   */
  it("🔴 [상세페이지 참조로 등록]을 누르면 카탈로그 모델명은 비어 있다 — 안내가 그 사실을 적어야 하는 이유", async () => {
    await render(makeProduct());
    await openBasicSection();
    await clickInModelNameRow("상세페이지 참조로 등록");

    expect(product.modelName.source).toBe("DETAIL_PAGE_REFERENCE");

    const payload = payloadNow();
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName).toBeUndefined();
  });
});
import { manufacturerFixture } from "./manufacturer-fixture";
import { sectionTitle } from "../registration-sections";
