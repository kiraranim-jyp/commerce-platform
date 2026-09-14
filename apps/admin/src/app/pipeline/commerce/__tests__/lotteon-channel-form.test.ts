import { describe, expect, it } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import type { CategorySelection } from "@commerce/category";
import { buildLotteOnPayload, BLANK_LOTTEON_CHANNEL_CONFIG } from "@commerce/listing";
import {
  EMPTY_LOTTEON_CHANNEL_FORM,
  LOTTEON_CHILD_PRODUCT_ITEM_CODE,
  describeLotteOnCategoryItem,
  parseDisplayCategoryNos,
  parseNoticeArticles,
  parseSafetyCertifications,
  requiresSafetyCertification,
  resolveCommonCategorySources,
  summarizeCommonProduct,
  toLotteOnChannelPayload,
  type LotteOnChannelForm,
} from "../lotteon-channel-form";
import { readSourceAt, stripComments } from "./source-text";

/** 롯데ON 패널의 **실제 코드**(주석 제외). 이 저장소의 주석은 "예전엔 이랬다"를
 * 길게 쓰므로, 금지어가 주석에 나오는 것은 정상이고 막아야 하는 것은 렌더와
 * 호출뿐이다 — price-single-surface.test.ts와 같은 규칙. */
function panelCode(): string {
  return stripComments(readSourceAt(new URL("../LotteOnRegistrationPanel.tsx", import.meta.url)));
}

/**
 * LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14).
 *
 * 이 스위트가 지키는 사실은 네 가지다.
 *
 *  ① **롯데ON 탭은 상품을 다시 만들지 않는다.** 채널 폼에 상품명/가격/옵션/
 *     재고/이미지를 담을 자리가 없고, 화면에도 그 입력칸이 없다.
 *  ② **공통 category를 덮어쓰지 않는다.** 공통 분류는 문자열로만 읽어오고,
 *     롯데ON이 고른 번호가 되돌아 흘러갈 타입이 존재하지 않는다.
 *  ③ **유아동(품목코드 23)은 안전인증 없이 통과하지 못한다.**
 *  ④ **화면 요약과 실제 payload가 갈라지지 않는다** — 같은 함수를 쓴다.
 */

function field<T>(value: T, source: "USER_EDITED" | "DEFAULT" = "USER_EDITED") {
  return { value, source, confidence: 1 } as CanonicalProduct[keyof CanonicalProduct] & {
    value: T;
  };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 반바지입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(999, "DEFAULT"),
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
  } as CanonicalProduct;
}

function makeForm(overrides: Partial<LotteOnChannelForm> = {}): LotteOnChannelForm {
  return { ...EMPTY_LOTTEON_CHANNEL_FORM, ...overrides };
}

describe("① 롯데ON 탭은 공통 상품정보를 재입력받지 않는다", () => {
  it("채널 폼에는 상품명/가격/옵션/재고/이미지를 담을 자리가 없다", () => {
    // 폼 전체를 문자열로 펴서 확인한다 — 필드가 어느 섹션에 숨어도 잡힌다.
    const keys = JSON.stringify(EMPTY_LOTTEON_CHANNEL_FORM).toLowerCase();
    for (const forbidden of ["productname", "spdnm", "price", "slprc", "stock", "stkqty", "image", "option"]) {
      expect(keys, `채널 폼에 공통 항목(${forbidden})이 들어왔다`).not.toContain(forbidden);
    }
  });

  it("서버로 보내는 채널 입력에도 공통 항목이 하나도 없다", () => {
    const payload = toLotteOnChannelPayload(makeForm());
    for (const key of Object.keys(payload)) {
      expect(["spdNm", "slPrc", "stkQty", "itmLst", "epnLst"]).not.toContain(key);
    }
    // 실제로 나가는 것은 전부 "상품 데이터에서 파생할 수 없는 외부 코드"다.
    expect(Object.keys(payload).sort()).toEqual(
      [
        "brandNo",
        "courierCode",
        "deliveryCostPolicyNo",
        "deliveryRegionGroupCode",
        "displayCategoryNos",
        "externalProductNo",
        "importProxyCode",
        "noticeArticles",
        "noticeItemCode",
        "originCode",
        "outboundPlaceNo",
        "returnCourierCode",
        "returnPlaceNo",
        "safetyCertifications",
        "standardCategoryNo",
        "taxTypeCode",
        "weekdayCloseTime",
      ].sort(),
    );
  });

  it("화면에도 공통 정보를 고치는 입력칸이 없다 — 읽기 전용 요약과 '상품정보에서 수정'뿐이다", () => {
    const source = panelCode();
    // 공통 정보를 바꾸는 콜백을 아예 받지 않는다(prop 자체가 없다).
    expect(source).not.toContain("onUpdateProduct");
    expect(source).not.toContain("onUpdateField");
    expect(source).not.toContain("onUpdateVariant");
    expect(source).not.toContain("updateSalePriceKrw");
    // 고치러 가는 통로는 상품정보 탭 하나다.
    expect(source).toContain("onEditCommonInfo");
    expect(source).toContain("상품정보에서 수정");
  });

  it("가격을 이 패널이 다시 계산하지 않는다 — 화면이 계산한 값을 받기만 한다", () => {
    const source = panelCode();
    expect(source).not.toContain("resolveListingPrice");
    expect(source).toContain("commonPrice");
  });
});

describe("② 공통 카테고리는 읽기만 한다 — 덮어쓰지 않는다", () => {
  const order = ["smartstore", "coupang"] as PlatformId[];
  const labelOf = (id: PlatformId) => (id === "coupang" ? "쿠팡" : "스마트스토어");

  it("원본 상품 분류가 먼저 오고, 채널 확정값은 참고용으로 뒤에 온다", () => {
    const product = makeProduct({ breadcrumbPath: ["Home", "Kids", "Shorts"] });
    const mappings: Partial<Record<PlatformId, CategorySelection>> = {
      coupang: {
        state: "SELECTED",
        provenance: "USER_SELECTED",
        candidate: {
          id: "1001",
          name: "반바지",
          path: ["유아동패션", "반바지"],
          platform: "coupang",
          confidence: 1,
          reason: [],
          source: "rule",
        },
      },
    };
    const sources = resolveCommonCategorySources(product, mappings, { order, labelOf });
    expect(sources[0].origin).toBe("원본 상품 페이지 분류");
    expect(sources[0].path).toEqual(["Home", "Kids", "Shorts"]);
    expect(sources[1].origin).toContain("쿠팡");
    expect(sources[1].origin).toContain("참고용");
  });

  it("확정되지 않은 추천 카테고리는 '공통 분류'로 올리지 않는다", () => {
    const mappings: Partial<Record<PlatformId, CategorySelection>> = {
      coupang: {
        state: "RECOMMENDED",
        provenance: "RECOMMENDED",
        candidate: {
          id: "1001",
          name: "반바지",
          path: ["유아동패션", "반바지"],
          platform: "coupang",
          confidence: 1,
          reason: [],
          source: "rule",
        },
      },
    };
    expect(resolveCommonCategorySources(makeProduct(), mappings, { order, labelOf })).toEqual([]);
  });

  it("반환값에 CategorySelection이 없다 — 롯데ON 번호가 공통 카테고리로 돌아갈 타입이 없다", () => {
    const sources = resolveCommonCategorySources(makeProduct({ jsonLdCategory: "Kids > Shorts" }), {}, {
      order,
      labelOf,
    });
    expect(sources).toHaveLength(1);
    expect(Object.keys(sources[0]).sort()).toEqual(["origin", "path"]);
  });

  it("표준/전시 카테고리는 서로 다른 필드다 — 2중 구조가 한 값으로 뭉개지지 않는다", () => {
    const form = makeForm({ category: { standardCategoryNo: "100", displayCategoryNos: ["200", "300"] } });
    const payload = toLotteOnChannelPayload(form);
    expect(payload.standardCategoryNo).toBe("100");
    expect(payload.displayCategoryNos).toEqual(["200", "300"]);
  });

  it("전시카테고리 입력은 쉼표/공백 어느 쪽으로 적어도 같고, 중복은 한 번만 센다", () => {
    expect(parseDisplayCategoryNos("200, 300  200\n400")).toEqual(["200", "300", "400"]);
  });
});

describe("③ 유아동(품목코드 23)은 안전인증 없이 통과하지 못한다", () => {
  it("품목코드 23이면 안전인증이 필수로 표시된다", () => {
    const form = makeForm({ notice: { itemCode: LOTTEON_CHILD_PRODUCT_ITEM_CODE, articlesText: "" } });
    expect(requiresSafetyCertification(form)).toBe(true);
  });

  it("다른 품목코드에서는 필수가 아니다", () => {
    expect(requiresSafetyCertification(makeForm({ notice: { itemCode: "01", articlesText: "" } }))).toBe(false);
    expect(requiresSafetyCertification(makeForm())).toBe(false);
  });

  it("안전인증 번호를 자동으로 만들지 않는다 — 입력한 줄만 배열이 된다", () => {
    expect(parseSafetyCertifications("")).toEqual([]);
    expect(parseSafetyCertifications("CHL_CFM:CB123456789:한국기계전기전자시험연구원")).toEqual([
      { sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789", sftyAthnOrgnNm: "한국기계전기전자시험연구원" },
    ]);
    // 인증번호가 없는 줄은 버린다(유형코드만으로 인증을 만들지 않는다).
    expect(parseSafetyCertifications("CHL_CFM")).toEqual([]);
  });

  it("고시 항목코드도 만들어내지 않는다 — `코드:내용` 형태만 받는다", () => {
    expect(parseNoticeArticles("0020:색상\n제조국")).toEqual([{ pdArtlCd: "0020", pdArtlCnts: "색상" }]);
  });
});

describe("④ 화면 요약과 실제 payload가 같은 값을 말한다", () => {
  it("요약의 상품명은 build-payload가 만드는 spdNm과 정확히 같다", () => {
    const product = makeProduct();
    const summary = summarizeCommonProduct(product, { priceKrw: 120000, resolved: true });
    const payload = buildLotteOnPayload({
      product,
      channel: { ...BLANK_LOTTEON_CHANNEL_CONFIG },
      detailHtml: "<p>x</p>",
    });
    const nameRow = summary.rows.find((row) => row.label === "상품명");
    expect(nameRow?.value).toBe(payload.spdLst[0].spdNm);
  });

  it("가격이 확정되지 않았으면 '입력 필요'로 표시하고 0원을 보여주지 않는다", () => {
    const summary = summarizeCommonProduct(makeProduct(), { priceKrw: null, resolved: false });
    const priceRow = summary.rows.find((row) => row.label === "판매가격");
    expect(priceRow?.value).toBeNull();
    expect(priceRow?.missing).toBe(true);
    expect(summary.hasMissing).toBe(true);
  });

  it("옵션이 없는 것은 결함이 아니다 — 단품 1건으로 등록된다고 말한다", () => {
    const summary = summarizeCommonProduct(makeProduct(), { priceKrw: 120000, resolved: true });
    const optionRow = summary.rows.find((row) => row.label === "옵션");
    expect(optionRow?.missing).toBe(false);
    expect(optionRow?.value).toContain("단품 1건");
  });

  it("요약의 모든 줄이 '어디서 온 값인지'를 함께 말한다", () => {
    const summary = summarizeCommonProduct(makeProduct(), { priceKrw: 120000, resolved: true });
    for (const row of summary.rows) {
      expect(row.origin, row.label).toContain("상품정보");
    }
  });
});

describe("카테고리 조회 결과 표시 — 모르면 모른다고 한다", () => {
  it("번호+이름을 알아보면 선택지로 만든다", () => {
    expect(describeLotteOnCategoryItem({ scatNo: "100123", scatNm: "유아동 반바지" })).toEqual({
      code: "100123",
      name: "유아동 반바지",
    });
  });

  it("알아보지 못하면 지어내지 않고 null을 돌려준다(화면이 원문을 그대로 보여준다)", () => {
    expect(describeLotteOnCategoryItem({ foo: 1, bar: 2 })).toBeNull();
    expect(describeLotteOnCategoryItem(null)).toBeNull();
    expect(describeLotteOnCategoryItem("문자열")).toBeNull();
  });
});
