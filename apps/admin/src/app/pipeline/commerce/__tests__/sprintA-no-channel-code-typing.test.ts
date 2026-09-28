// @vitest-environment jsdom
import { createElement, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import {
  buildLotteOnPayload,
  validateLotteOnPayload,
  BLANK_LOTTEON_CHANNEL_CONFIG,
  resolveManufacturer,
  type LotteOnSellerSettingsInput,
} from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * Sprint A ①②④ — **셀러가 채널 코드를 «적는» 자리를 없앤다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 이것이 P0 인가
 *
 * 첫 LIVE 등록(2026-09-22)이 이렇게 깨졌다 — 화면이 `note="공통코드 OPLC_CD"`
 * 라는 «힌트» 를 달아 두고 셀러에게 번호를 적게 했고, 셀러는 그 힌트를 답으로
 * 읽어 `oplcCd="OPLC_CD"` 를 보냈다. `returnCode 9999`.
 *
 * F-7 이 원산지·택배사는 막았는데 셋이 남아 있었다 —
 *
 *     브랜드 `brdNo`     도움말: 「속성모듈(204) 조회 결과」 🔴 204 를 «부르지 않는다»
 *     업체상품코드 `epdNo` 도움말: 「우리 쪽 식별자」        🔴 우리가 가진 값이다
 *     과세 `tdfDvsCd`    도움말: 「01 과세 · 02 면세 …」    🔴 답이 적혀 있다
 *
 * brdNo·epdNo 는 검증기가 «필수로 보지 않는다»(검사 0줄) → 묻는 데서 얻는 것이
 * 없다. 과세는 «무조건» 실리므로 숨길 수 없고 올바른 값이 필요하다.
 *
 * 🔴 이 파일은 Render · Data · Payload 세 단을 «따로» 본다. 한 단만 보면
 * 이 스프린트에서 세 번 틀린 그 자리로 되돌아간다.
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

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/settings/lotteon-seller")) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, values: {} }) });
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
              couriers: [],
              deliveryRegionGroups: [],
            }),
        });
      }
      /* 🔴 89 공통코드 — 실응답 모양 그대로다(원산지 239건 중 둘, 고시 품목 둘). */
      if (url.includes("group=OPLC_CD")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              ok: true,
              items: [
                { code: "ES", name: "스페인(에스파냐)" },
                { code: "KR", name: "한국" },
              ],
            }),
        });
      }
      if (url.includes("group=PD_ITMS_CD")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ ok: true, items: [{ code: "23", name: "[23]어린이제품" }] }),
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
  stubFetch();
});

afterEach(async () => {
  await unmountTab();
  vi.unstubAllGlobals();
});

const text = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");
/** 라벨이 붙은 «편집 가능한» 입력칸을 센다. */
const editableInputs = (el: HTMLElement) =>
  Array.from(el.querySelectorAll("input")).filter((i) => !i.readOnly && i.type !== "checkbox");

/* ════════════ 1단 — RENDER ════════════════════════════════════════════════ */

describe("RENDER ① 브랜드 — 이름은 보이고 번호는 «묻지 않는다»", () => {
  it("브랜드명은 화면에 있다", async () => {
    const el = await mountExpanded(panel());
    expect(text(el)).toContain("Bobo Choses");
  });

  it("🔴 「브랜드 선택」 입력칸이 «없다»", async () => {
    const el = await mountExpanded(panel());
    expect(text(el)).not.toContain("브랜드 선택");
    /* 도움말이 「속성모듈(204) 조회 결과」였다 — 부르지도 않는 API 를 근거로 댔다. */
    expect(text(el)).not.toContain("속성모듈");
  });
});

describe("RENDER ④ 업체 상품코드 — SKU 는 보이고 번호는 «묻지 않는다»", () => {
  it("SKU 는 화면에 있다", async () => {
    const el = await mountExpanded(panel());
    expect(text(el)).toContain("B226AC043");
  });

  it("🔴 「업체 상품코드」 입력칸이 «없다»", async () => {
    const el = await mountExpanded(panel());
    expect(text(el)).not.toContain("업체 상품코드");
  });
});

describe("RENDER ② 과세 — 자유 입력이 아니라 «채널이 준 값» 이다", () => {
  /*
   * 🔴 처음에 4개 버튼 선택기를 붙였다가 되돌렸다. rework14 필드 패리티 가드가
   * 그것을 «쿠팡에 없는 부품» 으로 잡았고 판정이 맞다 — CPO 가 요청한 것은
   * 「방어적 읽기 · 두 경로 일관 · 조용한 01 금지」였고 새 UI 부품이 아니었다.
   * 값의 주인은 채널(205)이고 고시 품목과 같은 성격이다.
   */
  it("칸은 있고 «읽기 전용» 이다 — 코드를 적는 입력칸이 아니다", async () => {
    const el = await mountExpanded(panel());
    expect(text(el)).toContain("과세 유형");
    const typed = editableInputs(el).map((i) => i.getAttribute("aria-label") ?? "");
    expect(typed.join(" ")).not.toContain("과세");
  });

  it("🔴 도움말에 «답» 을 적어 두지 않는다", async () => {
    const el = await mountExpanded(panel());
    /* 예전 note: "01 과세 · 02 면세 · 03 영세 · 04 해당없음. …" — 셀러가 그대로 옮겨 적었다. */
    expect(text(el)).not.toContain("01 과세");
    expect(text(el)).not.toContain("02 면세");
  });

  /* 🔴 「번호를 직접 넣으면 채워지지 않는다」는 사실을 화면이 말해야 한다.
     예전 도움말은 「표준카테고리를 고르면 채워집니다」라고만 해서 «틀렸다». */
  it("직접 입력 경로에서는 채워지지 않는다는 사실을 말한다", async () => {
    const el = await mountExpanded(panel());
    expect(text(el)).toContain("번호를 직접 넣은 경우에는 채워지지 않습니다");
  });
});

describe("RENDER 🔴 값을 «숨기지» 않는다", () => {
  it("저장된 값이 없으면 안내 줄도 서지 않는다", async () => {
    const el = await mountExpanded(panel());
    expect(el.querySelector('[data-lotteon-saved-channel-codes="true"]')).toBeNull();
  });
});

describe("RENDER 🔴 셀러가 채널 코드를 적는 «자유 입력칸» 이 ⑪에 없다", () => {
  it("읽기 전용이 아닌 입력칸에 채널 코드용이 남아 있지 않다", async () => {
    const el = await mountExpanded(panel());
    const labels = editableInputs(el).map((i) => i.getAttribute("aria-label") ?? i.getAttribute("placeholder") ?? "");
    for (const forbidden of ["브랜드", "업체 상품코드", "과세"]) {
      expect(labels.join(" "), forbidden).not.toContain(forbidden);
    }
  });
});

/* ════════════ 2단 — DATA (폼/컨텍스트 기본값) ═════════════════════════════ */

describe("DATA 🔴 과세 기본값이 «비어 있다» — 01 이 아니다", () => {
  it("BLANK 채널 설정의 과세가 빈 문자열이다", () => {
    expect(BLANK_LOTTEON_CHANNEL_CONFIG.taxTypeCode).toBe("");
  });
});

/* ════════════ 3단 — PAYLOAD ══════════════════════════════════════════════ */

/** 🔴 `detailHtml` 이 필수 입력이다 — 처음에 빼먹어 8건이 한꺼번에 깨졌다. */
function inputWith(overrides: Record<string, unknown>) {
  return { product: makeProduct(), channel: channelWith(overrides), detailHtml: "<p>상세</p>" } as never;
}

function channelWith(overrides: Record<string, unknown>) {
  return {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: "BC63080300",
    displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
    originCode: "ES",
    noticeItemCode: "23",
    noticeArticles: [{ pdArtlCd: "0020", pdArtlCnts: "네이비" }],
    outboundPlaceNo: "PLO3837441",
    returnPlaceNo: "PLO3837441",
    deliveryCostPolicyNo: "4279402",
    deliveryRegionGroupCode: "GN101",
    courierCode: "0004",
    returnCourierCode: "0004",
    saleStartDttm: "20260101000000",
    saleEndDttm: "20301231235959",
    ...overrides,
  } as never;
}

describe("PAYLOAD ①④ 비워도 «등록 계약상 안전하다»", () => {
  it("🔴 brdNo · epdNo 키가 payload 에 «나가지 않는다» (조건부)", () => {
    const payload = buildLotteOnPayload(inputWith({ taxTypeCode: "01", brandNo: null, externalProductNo: null }));
    const body = JSON.stringify(payload);
    expect(body).not.toContain('"brdNo"');
    expect(body).not.toContain('"epdNo"');
  });

  it("🔴 그런데 단품코드 eitmNo 는 sku 로 «그대로 간다» — 식별자를 잃지 않는다", () => {
    const payload = buildLotteOnPayload(inputWith({ taxTypeCode: "01" }));
    expect(JSON.stringify(payload)).toContain("B226AC043");
  });

  it("검증기가 brdNo · epdNo 를 요구하지 «않는다» — 비워도 통과한다", () => {
    const result = validateLotteOnPayload(inputWith({ taxTypeCode: "01", brandNo: null, externalProductNo: null }));
    const fields = result.fields.map((f) => f.field);
    expect(fields).not.toContain("brdNo");
    expect(fields).not.toContain("epdNo");
  });
});

describe("PAYLOAD ② 과세 — 🔴 «모른다» 를 01 로 바꾸지 않는다", () => {
  it("비어 있으면 검증기가 막는다", () => {
    const result = validateLotteOnPayload(inputWith({ taxTypeCode: "" }));
    const tax = result.fields.find((f) => f.field === "tdfDvsCd");
    expect(tax?.status).toBe("MISSING");
    expect(result.ok).toBe(false);
  });

  it("우리가 모르는 값이면 BLOCKED 다 — 조용히 통과시키지 않는다", () => {
    const result = validateLotteOnPayload(inputWith({ taxTypeCode: "99" }));
    const tax = result.fields.find((f) => f.field === "tdfDvsCd");
    expect(tax?.status).toBe("BLOCKED");
    expect(tax?.code).toBe("TAX_TYPE_UNKNOWN");
  });

  it.each([["01"], ["02"], ["03"], ["04"]])("문서에 있는 %s 는 통과한다", (code) => {
    const result = validateLotteOnPayload(inputWith({ taxTypeCode: code }));
    expect(result.fields.find((f) => f.field === "tdfDvsCd")?.status).toBe("READY");
  });

  it("고른 값이 payload 로 그대로 간다", () => {
    /* 🔴 tdfDvsCd 는 top-level 이 아니라 spdLst[0] 안이다 — 처음에 틀렸다. */
    const payload = buildLotteOnPayload(inputWith({ taxTypeCode: "02" }));
    expect(payload.spdLst[0].tdfDvsCd).toBe("02");
  });
});
