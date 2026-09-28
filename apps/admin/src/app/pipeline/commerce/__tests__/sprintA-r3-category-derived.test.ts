// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer, type LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import {
  EMPTY_LOTTEON_CHANNEL_FORM,
  applyLotteOnRecommendedCategory,
  toLotteOnChannelPayload,
} from "../lotteon-channel-form";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * R3 — **카테고리에서 «파생된» 값이 stale 로 남지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 Verification-only 스프린트의 실측이 이것을 잡았다(2026-09-28) —
 *
 *     추천 A 고름                  →  과세 02 · 고시품목 23
 *     번호를 직접 B 로 바꿈         →  selected = null   (버린다 — 옳다)
 *                                     과세 = "02"        🔴 남는다
 *                                     payload 도 "02"    🔴 A 의 값이 나간다
 *
 * `selected`(출처)는 버리는데 그 «파생값» 은 남는 비대칭이었다. 출처가 사라진
 * 값이 등록에 실리면 잘못된 과세·고시로 올라간다.
 *
 * ── CPO 결정 B(2026-09-28) ────────────────────────────────────────────────
 * 번호를 손으로 넣는 길을 «유지하면서» 파생값을 관리하지 않는다. 그 길 자체를
 * 두지 않는다 — REWORK-5 가 이미 폐기한 방향과 같다.
 *
 * 🔴 그리고 무조건 지우지 않는다. provenance 를 본다 —
 *     과세      화면이 읽기 전용이고 선택기도 없다 → 셀러 입력 «경로가 없다»
 *               출처는 205 하나 → 새 카테고리 값으로 덮고, 없으면 빈 값
 *     고시 품목  셀러가 89 목록에서 «직접 고를 수 있다»(CommonCodePicker)
 *               → 직전 카테고리가 준 값이면 버리고, 셀러가 고른 값이면 남긴다
 *               provenance 축을 새로 만들지 않고 `selected.noticeItemCodes` 로 가른다
 */

function cat(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name: `유아동 > ${id}`,
    displayCategories: [{ displayCategoryId: `FC-${id}`, mallCode: "LTON" }],
    noticeItemCodes: ["23"],
    safetyTypeCodes: [],
    taxTypeCode: "02",
    ...over,
  } as never;
}

describe("R3-1 — 추천 A → A 의 과세·고시", () => {
  it("고른 카테고리의 값이 들어온다", () => {
    const form = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    expect(form.codes.taxTypeCode).toBe("02");
    expect(form.notice.itemCode).toBe("23");
    expect(form.category.standardCategoryNo).toBe("A");
  });
});

describe("R3-2 — 추천 A → 다른 추천 B → 🔴 B 의 값", () => {
  it("B 가 값을 주면 B 로 바뀐다", () => {
    const a = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    const b = applyLotteOnRecommendedCategory(a, cat("B", { taxTypeCode: "01", noticeItemCodes: ["01"] }));
    expect(b.codes.taxTypeCode).toBe("01");
    expect(b.notice.itemCode).toBe("01");
  });

  /* 🔴 여기가 실측으로 잡힌 자리다 — B 가 값을 «주지 않으면» A 의 값이 남았다. */
  it("🔴 B 가 과세를 주지 않으면 A 의 과세가 «남지 않는다»", () => {
    const a = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    expect(a.codes.taxTypeCode).toBe("02");
    const b = applyLotteOnRecommendedCategory(a, cat("B", { taxTypeCode: null }));
    expect(b.codes.taxTypeCode).toBe("");
  });

  it("🔴 B 가 고시 품목을 주지 않으면 A 의 고시 품목이 «남지 않는다»", () => {
    const a = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    expect(a.notice.itemCode).toBe("23");
    const b = applyLotteOnRecommendedCategory(a, cat("B", { noticeItemCodes: [] }));
    expect(b.notice.itemCode).toBe("");
  });

  /* 🔴 provenance — 셀러가 «직접 고른» 고시 품목은 지우지 않는다(CPO 명시). */
  it("🔴 셀러가 직접 고른 고시 품목은 카테고리를 바꿔도 남는다", () => {
    const a = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    /* 셀러가 목록에서 다른 품목을 골랐다 — A 가 알려준 것이 아니다. */
    const sellerPicked = { ...a, notice: { ...a.notice, itemCode: "18" } };
    const b = applyLotteOnRecommendedCategory(sellerPicked, cat("B", { noticeItemCodes: [] }));
    expect(b.notice.itemCode).toBe("18");
  });
});

describe("R3-3 — 카테고리 미선택이면 둘 다 없다", () => {
  it("빈 폼은 과세·고시 품목이 «비어 있다»", () => {
    expect(EMPTY_LOTTEON_CHANNEL_FORM.codes.taxTypeCode).toBe("");
    expect(EMPTY_LOTTEON_CHANNEL_FORM.notice.itemCode).toBe("");
  });
});

describe("R3-5 — payload 에도 A 의 값이 남지 않는다", () => {
  it("A → B(값 없음) → payload 가 빈 값이다", () => {
    const a = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    const b = applyLotteOnRecommendedCategory(a, cat("B", { taxTypeCode: null, noticeItemCodes: [] }));
    const payload = toLotteOnChannelPayload(b);
    expect(payload.taxTypeCode).toBe("");
    expect(payload.noticeItemCode).toBe("");
    /* 🔴 그리고 카테고리 번호는 B 다 — 값만 비고 카테고리는 바뀌었다. */
    expect(payload.standardCategoryNo).toBe("B");
  });

  it("A → B(값 있음) → payload 가 B 의 값이다", () => {
    const a = applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A"));
    const b = applyLotteOnRecommendedCategory(a, cat("B", { taxTypeCode: "04", noticeItemCodes: ["21"] }));
    const payload = toLotteOnChannelPayload(b);
    expect(payload.taxTypeCode).toBe("04");
    expect(payload.noticeItemCode).toBe("21");
  });
});

describe("R3-6 — 🔴 01 fallback 이 «어디에도» 없다", () => {
  it("카테고리가 과세를 주지 않는 모든 경로에서 01 이 생기지 않는다", () => {
    const paths = [
      applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A", { taxTypeCode: null })),
      applyLotteOnRecommendedCategory(
        applyLotteOnRecommendedCategory(EMPTY_LOTTEON_CHANNEL_FORM, cat("A")),
        cat("B", { taxTypeCode: null }),
      ),
    ];
    for (const form of paths) {
      expect(form.codes.taxTypeCode).toBe("");
      expect(toLotteOnChannelPayload(form).taxTypeCode).toBe("");
    }
  });
});

/* ════════════ R3-4 — 🔴 «그려진 구조» 로 확인한다 ═══════════════════════════
   CPO: 「단순 텍스트 검색이 아니라 실제 Render 구조로 확인합니다」 */

function field<T>(v: T) {
  return { value: v, source: "USER_EDITED", confidence: 1 } as never;
}
function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/p",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("d"),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field("Bobo Choses S.L."),
    careInstructions: field("30도 손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [
      {
        id: "i1",
        originalUrl: "https://example.com/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("설명"),
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
    itemName: field("아동용 반바지"),
    modelName: field("B226AC043"),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
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
function panel(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본" }],
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

describe("R3-4 — 🔴 카테고리 번호를 «적는» 길이 화면 구조에 없다", () => {
  it("표준/전시 카테고리 번호를 받는 편집 가능한 컨트롤이 0개다", async () => {
    const el = await mountExpanded(panel());
    /* 구조로 본다 — 라벨 문자열이 아니라 «편집 가능한 컨트롤» 을 센다. */
    const editable = [
      ...Array.from(el.querySelectorAll("input")).filter((i) => !i.readOnly && i.type !== "checkbox"),
      ...Array.from(el.querySelectorAll("textarea")).filter((t) => !t.readOnly),
    ];
    const labelled = editable.map((node) => {
      let scope: Element | null = node;
      while (scope) {
        const label = scope.querySelector("label");
        if (label) return (label.textContent ?? "").replace(/\s+/g, " ").trim();
        scope = scope.parentElement;
      }
      return "";
    });
    for (const forbidden of ["표준카테고리", "전시카테고리"]) {
      expect(labelled.join(" | "), `${forbidden} 을 적는 칸이 있다`).not.toContain(forbidden);
    }
  });

  it("카테고리를 정하는 길은 «추천 → 후보 → 선택» 하나뿐이다", async () => {
    const el = await mountExpanded(panel());
    const buttons = Array.from(el.querySelectorAll("button")).map((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    expect(buttons.some((t) => t.includes("카테고리 추천"))).toBe(true);
    /* 예전에 있던 「직접 찾기」 류 조회 버튼이 없다. */
    for (const forbidden of ["직접 찾기", "번호로 찾기"]) {
      expect(buttons.join(" | "), forbidden).not.toContain(forbidden);
    }
  });
});
