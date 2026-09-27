// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer, type LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * S-24 — **⑤배송 접기를 «그려진 DOM» 으로 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `s23-delivery-collapse` 는 소스에서 조건 문자열을 센다. 그런데 이 스프린트에서
 * 틀린 두 번이 정확히 그 자리다 —
 *
 *   ① 조건은 있었는데 `sellerFixed` 가 언제나 null 이라 «한 번도 발동 안 함»
 *   ② 067 컬럼을 화면 타입이 몰라 판단 자체가 불가능
 *
 * 둘 다 소스 검사로는 PASS 였다. 그래서 여기서는 설정값을 실제로 돌려주는
 * 서버를 흉내 내고 패널을 마운트해서 **셀러가 보는 화면** 을 읽는다.
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

/** 「롯데ON 연결」에서 셀러가 여섯을 골라 둔 상태 — 저장소가 돌려주는 모양 그대로. */
const CONNECTED = {
  outboundPlaceNo: "PLO3837441",
  outboundPlaceLabel: "Hessen 물류센터",
  returnPlaceNo: "PLO3837441_R",
  returnPlaceLabel: "반품주소지",
  deliveryCostPolicyNo: "4279402",
  deliveryCostPolicyLabel: "업체배송 19800원",
  deliveryRegionGroupCode: "GN101",
  deliveryRegionGroupLabel: "전국",
  courierCode: "EP",
  courierLabel: "우체국택배",
  returnCourierCode: "EP",
  returnCourierLabel: "우체국택배",
  weekdayCloseTime: null,
  saturdayCloseTime: null,
};

function stubFetch(sellerValues: Record<string, unknown> | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/settings/lotteon-seller")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(sellerValues ? { ok: true, values: sellerValues } : { ok: true, values: {} }),
        });
      }
      if (url.includes("/api/lotteon/delivery-settings")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              /* 🔴 후보를 «둘씩» 둔다. 하나뿐이면 autopick 이 폼을 채워 버려서
                 「설정에서 온 값」이 아니라 「목록에서 자동으로 고른 값」을 보게 된다 —
                 이 파일이 재려는 것은 그 길이 아니다. */
              outboundPlaces: [
                { no: "PLO3837441", name: "Hessen 물류센터" },
                { no: "PLO9", name: "서울 물류센터" },
              ],
              returnPlaces: [
                { no: "PLO3837441_R", name: "반품주소지" },
                { no: "PLO9_R", name: "서울 회수지" },
              ],
              costPolicies: [
                { no: "4279402", name: "업체배송 19800원" },
                { no: "4279403", name: "무료배송" },
              ],
              couriers: [
                { code: "EP", name: "우체국택배" },
                { code: "CJ", name: "CJ대한통운" },
              ],
              deliveryRegionGroups: [
                { code: "GN101", name: "전국" },
                { code: "GN102", name: "전국(제주 제외)" },
              ],
            }),
        });
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
    manufacturerResolution: { ...resolveManufacturer({ brandProfileManufacturer: "Bobo Choses S.L." }), loading: false },
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

describe("① 연결해 둔 값이 «등록 화면에» 온다", () => {
  it("여섯 칸이 전부 「설정값 적용됨」으로 선다", async () => {
    stubFetch(CONNECTED);
    const el = await mountExpanded(panel());
    const applied = Array.from(el.querySelectorAll('[data-seller-setting-applied="true"]'));
    /* 🔴 ⑤배송에서 설정이 채우는 칸은 여섯이다. 넷만 서면 택배사 두 칸은
       컨트롤만 사라지고 «빈 자리» 가 된다 — 숨기는 것과 말하는 것은 다른 일이다. */
    expect(applied.length).toBeGreaterThanOrEqual(6);
  });

  it("사람이 읽는 «이름» 으로 보인다", async () => {
    stubFetch(CONNECTED);
    const el = await mountExpanded(panel());
    const body = text(el);
    for (const name of ["Hessen 물류센터", "반품주소지", "업체배송 19800원", "전국", "우체국택배"]) {
      expect(body, name).toContain(name);
    }
  });

  /* 🔴 S-24 에서 실제로 걸린 것. 택배사 두 칸은 컨트롤만 사라지고 «아무 말도»
     남지 않아 빈 칸이었다 — 숨기는 것과 어디서 왔는지 말하는 것은 다른 일이다. */
  it("택배사 두 칸이 «빈 자리» 로 남지 않는다", async () => {
    stubFetch(CONNECTED);
    const el = await mountExpanded(panel());
    const applied = Array.from(el.querySelectorAll('[data-seller-setting-applied="true"]')).map(
      (n) => (n.textContent ?? "").replace(/\s+/g, " "),
    );
    expect(applied.filter((t) => t.includes("우체국택배"))).toHaveLength(2);
  });

  it("🔴 롯데ON 번호가 화면 글자로 나오지 않는다", async () => {
    stubFetch(CONNECTED);
    const el = await mountExpanded(panel());
    const body = text(el);
    expect(body).toContain("Hessen 물류센터"); // 그려진 상태에서 본다(공허하지 않게)
    for (const code of ["PLO3837441", "4279402", "GN101", "DV_CO_CD", "OPLC_CD"]) {
      expect(body, code).not.toContain(code);
    }
  });
});

describe("② 🔴 설정이 «비어 있으면» 고르는 길이 그대로 열린다", () => {
  /* 지워 버리면 아직 연결하지 않은 셀러가 등록할 방법을 잃는다. */
  it("적용됨 줄이 하나도 서지 않는다", async () => {
    stubFetch(null);
    const el = await mountExpanded(panel());
    expect(el.querySelectorAll('[data-seller-setting-applied="true"]')).toHaveLength(0);
  });

  it("고르는 컨트롤이 화면에 남아 있다", async () => {
    stubFetch(null);
    const el = await mountExpanded(panel());
    const body = text(el);
    expect(body).toContain("출고지");
    expect(body).toContain("택배사");
    /* 「목록에서 고르기」 류의 컨트롤이 실제로 있다 — 없으면 막다른 화면이다. */
    const buttons = Array.from(el.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(buttons.some((t) => t.includes("고르기") || t.includes("선택"))).toBe(true);
  });
});
