// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { resolveManufacturer, type LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STEP3-FIX — **설정값이 «화면에» 닿는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO Production FAIL(2026-09-28). 설정에 여섯 값이 다 저장돼 있는데
 * 상품 화면의 택배사·배송 가능 지역이 «빈 칸» 이었다 — 셀러는 「입력 필요」로 읽는다.
 *
 * 원인은 실측으로 나왔다. `displayValue` 가 «폼 값만» 봤다 —
 *
 *     displayValue={sellerFacingName(form.delivery.X, …)}
 *
 * 그런데 payload 는 `fixed(form, settings)` 사다리로 설정값을 쓴다(build-context).
 * 그래서 «payload 로는 가는데 화면에는 없는» 상태였다.
 *
 * 그리고 출고지·반품지·배송비정책이 «차 있어 보였던» 이유는 후보가 1건이라
 * autopick 이 폼을 채웠기 때문이고, 설정에서 와서가 아니었다(S-24 에서 가른 차이).
 * 🔴 여섯 칸 중 셋에는 `displayValue` 가 «아예 없었다».
 *
 * 이 파일은 «설정만 있고 폼은 빈» 상태를 만들어 여섯 칸을 전수로 본다.
 */

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
    deliveryCompanyCode: "EPOST",
    naverDeliveryCompanyCode: "우체국택배",
    outboundShippingPlaceCode: 7788,
    returnCenterCode: "RC-1004",
    topCommonImageEnabled: true,
    bottomCommonImageEnabled: false,
  };
}

/** 🔴 실응답 그대로다 — 장소 이름에 채널이 발급한 번호가 «박혀 있다». */
const SAVED = {
  outboundPlaceNo: "PLO3837441",
  outboundPlaceLabel: "PLO3837441_출고지__Am Holzweg 28-34|Hessen",
  returnPlaceNo: "PLO3837441",
  returnPlaceLabel: "PLO3837441_회수지_12921_경기 하남시",
  deliveryCostPolicyNo: "4279402",
  deliveryCostPolicyLabel: "4279402 / 업체배송_배송비 유료 19800원",
  deliveryRegionGroupCode: "GN000",
  deliveryRegionGroupLabel: "전국",
  courierCode: "0004",
  courierLabel: "우체국택배",
  returnCourierCode: "0004",
  returnCourierLabel: "우체국택배",
  weekdayCloseTime: null,
  saturdayCloseTime: null,
};

/**
 * 🔴 후보를 «둘씩» 둔다 — 1건이면 autopick 이 폼을 채워서 「설정에서 온 값」이
 * 아니라 「목록에서 자동으로 고른 값」을 보게 된다. 이 파일이 재려는 것은 앞쪽이다.
 */
function stub(listsOk = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/settings/lotteon-seller")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, values: SAVED }) });
      }
      if (url.includes("/api/lotteon/delivery-settings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve(
              listsOk
                ? {
                    ok: true,
                    outboundPlaces: [
                      { no: "PLO3837441", name: SAVED.outboundPlaceLabel },
                      { no: "PLO9", name: "서울 물류센터" },
                    ],
                    returnPlaces: [
                      { no: "PLO3837441", name: SAVED.returnPlaceLabel },
                      { no: "PLO9_R", name: "서울 회수지" },
                    ],
                    costPolicies: [
                      { no: "4279402", name: SAVED.deliveryCostPolicyLabel },
                      { no: "4279403", name: "4279403 / 업체배송_추가배송비 유료" },
                    ],
                    couriers: [
                      { code: "0001", name: "롯데택배" },
                      { code: "0004", name: "우체국택배" },
                    ],
                    deliveryRegionGroups: [
                      { code: "GN000", name: "전국" },
                      { code: "GN101", name: "전국(일부지역 제외)" },
                    ],
                  }
                : { ok: false, message: "롯데ON 배송 정보를 불러오지 못했습니다." },
            ),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, profiles: [] }) });
    }),
  );
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

const ROWS = ["출고지", "반품지", "배송비 정책", "배송 가능 지역", "택배사", "반품 택배사"] as const;

/** 🔴 각 요소에서 «가장 가까운 라벨» 로 올라간다. 라벨에서 내려가면 스코프가
 *  그리드 전체가 되어 여섯 행이 같은 값을 뱉는다(실측 중 한 번 당했다). */
function nearestLabel(node: Element): string {
  let scope: Element | null = node;
  while (scope) {
    const lab = scope.querySelector("label");
    if (lab) return (lab.textContent ?? "").replace(/\s+/g, " ").replace(/[*ⓘ]/g, "").trim();
    scope = scope.parentElement;
  }
  return "";
}

/** 라벨 → 그 칸이 «보여주는 글자». */
function shownByRow(el: HTMLElement): Map<string, string> {
  const map = new Map<string, string>();
  for (const input of Array.from(el.querySelectorAll("input"))) {
    const label = nearestLabel(input);
    const key = ROWS.find((r) => r === label || r === (label.split(" ")[0] ?? ""));
    if (key && !map.has(key)) map.set(key, input.value);
  }
  return map;
}

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
});
afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

describe("🔴 설정만 있고 폼은 빈 상태 — 여섯 칸이 «전부» 이름을 보여준다", () => {
  it.each([
    ["출고지", "PLO3837441_출고지__Am Holzweg 28-34|Hessen"],
    ["반품지", "PLO3837441_회수지_12921_경기 하남시"],
    ["배송비 정책", "4279402 / 업체배송_배송비 유료 19800원"],
    ["배송 가능 지역", "전국"],
    ["택배사", "우체국택배"],
    ["반품 택배사", "우체국택배"],
  ])("%s — 빈 칸이 아니다", async (label, expected) => {
    stub();
    const shown = shownByRow(await mountExpanded(panel()));
    expect(shown.get(label), `${label} 행을 찾지 못했다`).toBeDefined();
    expect(shown.get(label)).toBe(expected);
  });

  it("🔴 여섯 칸 중 «빈 칸이 하나도 없다»", async () => {
    stub();
    const shown = shownByRow(await mountExpanded(panel()));
    const empty = ROWS.filter((r) => !(shown.get(r) ?? "").trim());
    expect(empty, `빈 칸: ${empty.join(", ")}`).toHaveLength(0);
  });
});

describe("🔴 목록 조회가 실패해도 «저장된 이름» 으로 보인다", () => {
  it("설정값이 있으면 빈 칸이 되지 않는다", async () => {
    stub(false);
    const shown = shownByRow(await mountExpanded(panel()));
    expect(shown.get("택배사")).toBe("우체국택배");
    expect(shown.get("배송 가능 지역")).toBe("전국");
  });
});

/**
 * 🔴 여기가 «사다리 자체» 를 재는 자리다.
 *
 * 위의 검사들은 저장 라벨(`courierLabel` …)만 있어도 통과한다 —
 * `sellerFacingName` 이 `liveName || savedLabel` 을 먼저 보기 때문이다.
 * 그래서 사다리(`formValue || settingValue`)를 빼도 통과했다(음성 대조로 확인).
 *
 * 라벨 «없이 코드만» 저장된 행은 다르다. 그 이름은 오직
 * 「설정에 저장된 코드」 → 「조회한 목록」 으로만 나온다 — 사다리가 없으면 빈 칸이다.
 * 라벨 컬럼이 생기기 전에 저장된 행이 실제로 이 모양이다.
 */
describe("🔴 라벨 없이 코드만 저장된 행 — 목록에서 이름을 찾아 보여준다", () => {
  function stubCodeOnly() {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const url = String(input);
        if (url.includes("/api/settings/lotteon-seller")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                ok: true,
                values: {
                  courierCode: "0004",
                  returnCourierCode: "0004",
                  deliveryRegionGroupCode: "GN000",
                  deliveryCostPolicyNo: "4279402",
                  courierLabel: null,
                  returnCourierLabel: null,
                  deliveryRegionGroupLabel: null,
                  deliveryCostPolicyLabel: null,
                },
              }),
          });
        }
        if (url.includes("/api/lotteon/delivery-settings")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                ok: true,
                outboundPlaces: [
                  { no: "PLO3837441", name: SAVED.outboundPlaceLabel },
                  { no: "PLO9", name: "서울 물류센터" },
                ],
                returnPlaces: [
                  { no: "PLO3837441", name: SAVED.returnPlaceLabel },
                  { no: "PLO9_R", name: "서울 회수지" },
                ],
                costPolicies: [
                  { no: "4279402", name: SAVED.deliveryCostPolicyLabel },
                  { no: "4279403", name: "4279403 / 업체배송_추가배송비 유료" },
                ],
                couriers: [
                  { code: "0001", name: "롯데택배" },
                  { code: "0004", name: "우체국택배" },
                ],
                deliveryRegionGroups: [
                  { code: "GN000", name: "전국" },
                  { code: "GN101", name: "전국(일부지역 제외)" },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, profiles: [] }) });
      }),
    );
  }

  it.each([
    ["택배사", "우체국택배"],
    ["반품 택배사", "우체국택배"],
    ["배송 가능 지역", "전국"],
    ["배송비 정책", "4279402 / 업체배송_배송비 유료 19800원"],
  ])("%s — 라벨이 없어도 빈 칸이 아니다", async (label, expected) => {
    stubCodeOnly();
    const shown = shownByRow(await mountExpanded(panel()));
    expect(shown.get(label)).toBe(expected);
  });

  it("🔴 목록에도 없는 코드면 코드를 보여주지 «않고» 「확인 필요」라고 말한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const url = String(input);
        if (url.includes("/api/settings/lotteon-seller")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ ok: true, values: { courierCode: "0099", courierLabel: null } }),
          });
        }
        if (url.includes("/api/lotteon/delivery-settings")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                ok: true,
                outboundPlaces: [],
                returnPlaces: [],
                costPolicies: [],
                couriers: [
                  { code: "0001", name: "롯데택배" },
                  { code: "0004", name: "우체국택배" },
                ],
                deliveryRegionGroups: [],
              }),
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, profiles: [] }) });
      }),
    );
    const el = await mountExpanded(panel());
    expect(shownByRow(el).get("택배사")).toBe("택배사 확인 필요");
    expect((el.textContent ?? "").replace(/\s+/g, " ")).not.toContain("0099");
  });
});

describe("🔴 설정도 폼도 없으면 «값을 만들지 않는다»", () => {
  it("여섯 칸이 비고 코드를 지어내지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, values: {} }) })),
    );
    const el = await mountExpanded(panel());
    const shown = shownByRow(el);
    for (const row of ["택배사", "반품 택배사", "배송 가능 지역"] as const) {
      expect(shown.get(row) ?? "", row).toBe("");
    }
    /* 🔴 그리고 코드가 글자로 새어 나오지 않는다. */
    const body = (el.textContent ?? "").replace(/\s+/g, " ");
    for (const code of ["0004", "GN000", "4279402", "DV_CO_CD"]) {
      expect(body, code).not.toContain(code);
    }
  });
});
