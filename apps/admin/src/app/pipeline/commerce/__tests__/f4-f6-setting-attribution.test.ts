// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer, type LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * F4 · F6 — **「설정값 적용됨」은 «설정에서 온 값» 에만 붙는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 2차 검증에서 🟡 Evidence Gap 으로 남았던 둘이다. 재현해 보니 화면은
 * 이미 맞게 동작했다 — 문제는 **그것을 지키는 계약이 없었다** 는 것이다.
 * 우연히 맞는 것과 앞으로도 맞는 것은 다르다.
 *
 *   F4  설정 없음 + 후보 1건 → autopick 이 폼을 채운다
 *       🔴 그래도 「설정값 적용됨」이라고 하면 «거짓말» 이다.
 *          셀러는 설정에서 고른 적이 없는데 고른 것처럼 읽는다.
 *
 *   F6  6칸 중 «일부만» 설정 → 설정된 것만 적용됨, 나머지는 고르는 길이 열린다
 *       경계값 0/6 · 3/6 · 6/6 을 직접 센다.
 */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(): CanonicalProduct {
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
    recommendedAge: field("4-5세"),
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

/**
 * 후보 개수를 바꿀 수 있게 둔다.
 * 🔴 1건이면 autopick 이 폼을 채운다 — F4 가 재려는 상태가 바로 그것이다.
 */
function lists(candidates: 1 | 2) {
  const two = candidates === 2;
  return {
    ok: true,
    outboundPlaces: [
      { no: "PLO3837441", name: "Hessen 물류센터" },
      ...(two ? [{ no: "PLO9", name: "서울 물류센터" }] : []),
    ],
    returnPlaces: [{ no: "PLO_R", name: "반품주소지" }, ...(two ? [{ no: "PLO9_R", name: "서울 회수지" }] : [])],
    costPolicies: [{ no: "4279402", name: "업체배송 19800원" }, ...(two ? [{ no: "4279403", name: "무료배송" }] : [])],
    couriers: [{ code: "EP", name: "우체국택배" }, ...(two ? [{ code: "CJ", name: "CJ대한통운" }] : [])],
    deliveryRegionGroups: [
      { code: "GN101", name: "전국" },
      ...(two ? [{ code: "GN102", name: "전국(제주 제외)" }] : []),
    ],
  };
}

const ALL_SIX = {
  outboundPlaceNo: "PLO3837441",
  outboundPlaceLabel: "Hessen 물류센터",
  returnPlaceNo: "PLO_R",
  returnPlaceLabel: "반품주소지",
  deliveryCostPolicyNo: "4279402",
  deliveryCostPolicyLabel: "업체배송 19800원",
  deliveryRegionGroupCode: "GN101",
  deliveryRegionGroupLabel: "전국",
  courierCode: "EP",
  courierLabel: "우체국택배",
  returnCourierCode: "EP",
  returnCourierLabel: "우체국택배",
};

/** 출고지 · 배송비 정책 · 택배사 셋만 연결해 둔 상태. */
const ONLY_THREE = {
  ...ALL_SIX,
  returnPlaceNo: null,
  returnPlaceLabel: null,
  deliveryRegionGroupCode: null,
  deliveryRegionGroupLabel: null,
  returnCourierCode: null,
  returnCourierLabel: null,
};

function stubFetch(values: Record<string, unknown>, candidates: 1 | 2 = 2) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/settings/lotteon-seller")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, values }) });
      }
      if (url.includes("/api/lotteon/delivery-settings")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(lists(candidates)) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, profiles: [] }) });
    }),
  );
}

function panel(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
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
});

afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");
const appliedRows = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('[data-seller-setting-applied="true"]')).map((n) => text(n as HTMLElement));

describe("🔴 F4 — autopick 이 채운 값을 «설정값» 이라고 하지 않는다", () => {
  it("설정 없음 + 후보 1건 → 「설정값 적용됨」 0줄", async () => {
    stubFetch({}, 1);
    const el = await mountExpanded(panel());
    expect(appliedRows(el)).toHaveLength(0);
    /* 줄 개수만 세면 다른 모양으로 새어 나갈 수 있어 글자로도 확인한다. */
    expect(text(el)).not.toContain("설정값 적용됨");
  });

  it("🔴 그래도 화면은 «비어 있지 않다» — autopick 값은 고른 상태로 보인다", async () => {
    stubFetch({}, 1);
    const el = await mountExpanded(panel());
    /* 「적용됨이라 말하지 않는다」가 「아무것도 안 보인다」가 되면 안 된다 —
       그건 S-24 에서 고친 «빈 칸» 으로 되돌아가는 것이다. */
    expect(text(el)).toContain("Hessen 물류센터");
  });

  it("설정 있음 + mapping 성공 → 그때는 「설정값 적용됨」이 선다", async () => {
    stubFetch(ALL_SIX, 2);
    const el = await mountExpanded(panel());
    expect(appliedRows(el).length).toBeGreaterThanOrEqual(6);
  });
});

describe("🔴 F6 — 부분 설정 경계값 0/6 · 3/6 · 6/6", () => {
  it("0/6 — 적용됨 0, 여섯 칸 모두 고를 수 있다", async () => {
    stubFetch({}, 2);
    const el = await mountExpanded(panel());
    expect(appliedRows(el)).toHaveLength(0);
    const pickable = el.querySelectorAll("button[data-channel-code]");
    expect(pickable.length).toBeGreaterThan(0);
  });

  it("3/6 — 적용됨 «정확히 3», 나머지 셋은 고르는 길이 열려 있다", async () => {
    stubFetch(ONLY_THREE, 2);
    const el = await mountExpanded(panel());
    const rows = appliedRows(el);
    expect(rows).toHaveLength(3);
    for (const name of ["Hessen 물류센터", "업체배송 19800원", "우체국택배"]) {
      expect(rows.some((r) => r.includes(name)), name).toBe(true);
    }
    /* 미설정 칸(반품지)의 후보 버튼이 살아 있어야 등록할 방법이 남는다. */
    const codes = Array.from(el.querySelectorAll("button[data-channel-code]")).map((b) =>
      b.getAttribute("data-channel-code"),
    );
    expect(codes).toContain("PLO_R");
  });

  it("6/6 — 적용됨 여섯", async () => {
    stubFetch(ALL_SIX, 2);
    const el = await mountExpanded(panel());
    expect(appliedRows(el).length).toBeGreaterThanOrEqual(6);
  });

  it("🔴 어느 상태에서도 내부 코드가 화면에 «없다»", async () => {
    for (const values of [{}, ONLY_THREE, ALL_SIX]) {
      stubFetch(values, 2);
      const el = await mountExpanded(panel());
      const body = text(el);
      expect(body).toContain("Hessen 물류센터"); // 그려진 상태에서 본다
      for (const code of ["PLO3837441", "4279402", "GN101", "DV_CO_CD", "OPLC_CD"]) {
        expect(body, code).not.toContain(code);
      }
      vi.unstubAllGlobals();
    }
  });
});
