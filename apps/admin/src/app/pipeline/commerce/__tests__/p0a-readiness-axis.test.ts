// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer, type LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-a — **「입력 필요」가 «두 종류» 였다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 실화면: 「설정이 모두 준비되어 있습니다」인데 등록 버튼이 잠겨 있었다.
 * 전수 감사로 원인이 나왔다 —
 *
 *   placeholder  「입력 필요 — 상품정보에서 채워주세요」
 *                화면이 붙인다 · 🔴 등록을 «막지 않는다»
 *   알약         「입력 필요」
 *                서버 검증이 붙인다(commerce-registry:152) · «막는다»
 *
 * 같은 글자인데 결과가 달랐다. 그리고 ① 기본정보의 행들은 막는지가 서로 다른데
 * 문구가 «하나» 였다.
 *
 *   막는다      상품명 · 대표이미지 · 상세 · 가격 · 재고      (missing: true)
 *   안 막는다   사용연령 · 품명 · 모델명 · SKU · 소재 · 색상  (missing: false)
 *
 * 🔴 이 파일은 «그려진 DOM» 으로 그 둘이 섞이지 않는지 본다.
 * placeholder 를 필수값 미충족 상태로 «승격하지 않는다»(CPO 명시).
 */

function field<T>(value: T, source = "USER_EDITED") {
  return { value, source, confidence: 1 } as never;
}

/** 🔴 실제 상품과 같은 상태를 만든다 — 막는 값은 있고, 안 막는 값 셋이 비어 있다. */
function makeProduct(over: Record<string, unknown> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field("면 100%"),
    color: field("네이비"),
    /* 🔴 CEO 화면에서 「입력 필요」로 보였던 셋 — 실제로는 비어 있는 것이다. */
    recommendedAge: field("", "REQUIRED"),
    itemName: field("", "REQUIRED"),
    modelName: field("", "REQUIRED"),
    manufacturer: field("Bobo Choses S.L."),
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
    descriptionKo: field("부드러운 테리 소재 아동 반바지입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(30),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
    ...over,
  } as unknown as CanonicalProduct;
}

function sellerSettings(): LotteOnSellerSettingsInput {
  return {
    outboundLeadTimeDays: 2,
    deliveryCompanyCode: "CJGLS",
    naverDeliveryCompanyCode: "CJ대한통운",
    outboundShippingPlaceCode: 7788,
    returnCenterCode: "RC-1004",
    topCommonImageEnabled: true,
    bottomCommonImageEnabled: false,
  };
}

function panel(product = makeProduct()): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product,
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: sellerSettings(),
    onEditCommonInfo: () => {},
    manufacturerResolution: {
      ...resolveManufacturer({ brandProfileManufacturer: "Bobo Choses S.L." }),
      loading: false,
    },
  } as never);
}

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, profiles: [] }) })),
  );
});
afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");
/**
 * 그 라벨 행이 «값 대신 보여주는 글자» 를 읽는다.
 *
 * 🔴 `ReadOnlyFieldRow` 는 input 을 «만들지 않는다» — placeholder 는 attribute 가
 * 아니라 `div[data-readonly-field]` 의 «본문» 이다. 처음에 input 의 placeholder 를
 * 찾아 5건이 한꺼번에 깨졌다. 모양을 추측하지 말고 컴포넌트를 읽어야 했다.
 */
function shownFor(el: HTMLElement, label: string): string | null {
  for (const cell of Array.from(el.querySelectorAll('[data-readonly-field="true"]'))) {
    let scope: Element | null = cell;
    while (scope) {
      const found = scope.querySelector("label");
      if (found) {
        /* 🔴 `includes` 로 비교하면 「품명」이 「상품명」에 걸린다 — 처음에 그렇게
           써서 2건이 엉뚱하게 깨졌다. 라벨은 «정확히» 같아야 한다.
           라벨에는 필수 별표(*)와 ⓘ 안의 API 필드명이 붙을 수 있으므로 그것만
           걷어내고 비교한다. */
        const clean = (found.textContent ?? "")
          .replace(/\s+/g, " ")
          .replace(/[*ⓘ]/g, "")
          .trim();
        const head = clean.split(" ")[0] ?? "";
        if (clean === label || head === label) {
          return (cell.textContent ?? "").replace(/\s+/g, " ").trim();
        }
        break;
      }
      scope = scope.parentElement;
    }
  }
  return null;
}

describe("🔴 ① 등록을 «막지 않는» 빈 칸은 「입력 필요」라고 하지 않는다", () => {
  it.each([["사용연령"], ["품명"], ["모델명"]])("%s — 사실만 말한다", async (label) => {
    const el = await mountExpanded(panel());
    const shown = shownFor(el, label);
    expect(shown, `${label} 행을 찾지 못했다`).not.toBeNull();
    expect(shown).toBe("상품정보에 아직 없습니다 — 있으면 함께 등록됩니다");
    expect(shown).not.toContain("입력 필요");
  });
});

describe("🔴 ② 등록을 «막는» 빈 칸은 「입력 필요」라고 한다", () => {
  it("상품명이 비면 「입력 필요」다", async () => {
    /* titleKo·title 둘 다 비우면 resolveLotteOnProductName 이 빈 값을 낸다. */
    const el = await mountExpanded(
      panel(makeProduct({ title: field("", "REQUIRED"), titleKo: field("", "REQUIRED") })),
    );
    const shown = shownFor(el, "상품명");
    expect(shown).toBe("입력 필요 — 상품정보에서 채워주세요");
  });
});

describe("🔴 ③ 안내문이 두 축을 «갈라» 말한다", () => {
  it("막는 것과 안 막는 것을 구분해서 설명한다", async () => {
    const el = await mountExpanded(
      panel(makeProduct({ title: field("", "REQUIRED"), titleKo: field("", "REQUIRED") })),
    );
    const body = text(el);
    expect(body).toContain("「입력 필요」로 표시된 항목은 등록을 막습니다");
    expect(body).toContain("그 밖의 빈 칸은 등록을 막지 않습니다");
  });
});

describe("🔴 ④ 두 종류가 «한 화면에» 섞여 있어도 구분된다", () => {
  it("막는 것 하나 · 안 막는 것 셋이 같은 표에 있을 때 문구가 다르다", async () => {
    const el = await mountExpanded(
      panel(makeProduct({ title: field("", "REQUIRED"), titleKo: field("", "REQUIRED") })),
    );
    expect(shownFor(el, "상품명")).toBe("입력 필요 — 상품정보에서 채워주세요");
    for (const label of ["사용연령", "품명", "모델명"]) {
      expect(shownFor(el, label), label).toBe("상품정보에 아직 없습니다 — 있으면 함께 등록됩니다");
    }
  });
});
