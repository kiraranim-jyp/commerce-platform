// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, FieldSource, LotteOnChannelInfo, ProvenanceField } from "@commerce/shared";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  validateLotteOnPayload,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
} from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";

/**
 * REWORK-6 ②(CEO 판정, 2026-09-14) — **추천 실패가 등록 불가가 되어서는 안 된다.**
 *
 * ── 신고된 상태 ───────────────────────────────────────────────────────────
 * 롯데ON 카테고리 추천이 REJECT를 내면 화면에 남는 안내는 "상품정보를 채우고
 * 다시 추천"뿐이었다. 그런데 scatNo/dcatLst 직접 입력은 REWORK-5 ③에서
 * **폐기**됐으므로, 추천이 후보를 내지 못하는 상품(원문에 연령·상품유형 신호가
 * 없는 상품)에서는 셀러가 더 나아갈 방법이 하나도 없었다 — 막다른 길이다.
 *
 * ── 이 파일이 고정하는 것 ─────────────────────────────────────────────────
 *  1. 추천이 REJECT면 **"롯데ON 카테고리 선택"** 경로가 그 자리에 열린다.
 *  2. 🔴 그 경로는 **번호 입력이 아니다** — 열린 화면에 `<input>`이 하나도 없고,
 *     셀러가 하는 일은 목록을 눌러 내려가는 것뿐이다(폐기된 UX를 되살리지 않는다).
 *  3. 고르면 추천에서 고른 것과 **같은 경로**를 탄다 — 표준·전시·고시 품목·
 *     과세가 한 번에 채워지고, 627ac53이 고친 재검증이 그대로 돌아 우측 요약의
 *     부족 항목에서 카테고리가 사라진다.
 *
 * 정적 렌더로 판정하지 않는다 — 목록 자체가 fetch 이후에만 존재한다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/**
 * 🔴 **추천이 실패하는 상품**이다. 연령대/성별/상품유형 신호가 될 만한 말이
 * 원문에 없다 — 이 테스트의 전제(REJECT)가 억지 조건이 아니라 실제로 생기는
 * 상황이라는 것을 상품 자체가 보여야 한다.
 */
function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/unknown",
    title: field("Studio Object No.4"),
    brand: field("Atelier"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AO-0004"),
    description: field("Studio object."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field(""),
    manufacturer: field("아틀리에"),
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
    titleKo: field("스튜디오 오브젝트 4호"),
    descriptionKo: field("스튜디오 오브젝트입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(30, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    childCertification: field(
      { name: "한국기계전기전자시험연구원", companyName: "아틀리에", certificationNumber: "CB123456789" },
      "USER_EDITED",
    ),
    itemName: field("스튜디오 오브젝트"),
    modelName: field("AO-0004"),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000, "USER_EDITED"),
    ...overrides,
  } as unknown as CanonicalProduct;
}

/**
 * 추천 라우트의 **실패 응답** — 후보 0건 · REJECT. ok:true라는 점이 중요하다
 * (조회 자체는 성공했고, 점수를 매길 후보가 없었을 뿐이다). 이것이 셀러가
 * "상품정보를 채우고 다시 추천"만 보던 바로 그 상태다.
 */
const REJECT_RESPONSE = {
  ok: true,
  decision: "REJECT" as const,
  candidates: [],
  signalEvidence: [],
  scannedLeafCount: 1204,
  unrecognizedCount: 0,
  truncated: false,
};

/**
 * 조회 라우트(/api/lotteon/categories)가 돌려주는 **205 응답 원문 모양** 그대로다
 * — 필드명은 lotteon-category.ts 주석이 옮겨 둔 롯데ON 가이드 원문(std_cat_id ·
 * upr_std_cat_id · leaf_yn · disp_list · pd_Itms_list · tdf_cd · chl_cfm)이다.
 * 손으로 지어낸 축약형을 쓰면 파서가 실제 응답을 읽는지 검사할 수 없다.
 */
const STANDARD_CATEGORY_ITEMS = [
  {
    std_cat_id: "BC63",
    std_cat_nm: "패션의류",
    upr_std_cat_id: "0",
    depth_no: "1",
    leaf_yn: "N",
    use_yn: "Y",
  },
  {
    std_cat_id: "BC6308",
    std_cat_nm: "유아동",
    upr_std_cat_id: "BC63",
    depth_no: "2",
    leaf_yn: "N",
    use_yn: "Y",
  },
  {
    std_cat_id: "BC630803",
    std_cat_nm: "유아동 하의",
    upr_std_cat_id: "BC6308",
    depth_no: "3",
    leaf_yn: "N",
    use_yn: "Y",
  },
  {
    std_cat_id: "BC63080300",
    std_cat_nm: "유아동 반바지",
    upr_std_cat_id: "BC630803",
    depth_no: "4",
    leaf_yn: "Y",
    use_yn: "Y",
    disp_list: [
      { mall_dvs_cd: "LTON", std_cat_id: "BC63080300", disp_cat_id: "FC11130203" },
      { mall_dvs_cd: "LTON", std_cat_id: "BC63080300", disp_cat_id: "FC11130204" },
    ],
    pd_Itms_list: [{ std_cat_id: "BC63080300", pd_Itms_cd: "23" }],
    tdf_cd: "01",
    age_limit_cd: "0",
    chl_cfm: "Y",
  },
  {
    std_cat_id: "BC63080399",
    std_cat_nm: "유아동 하의 기타(사용중지)",
    upr_std_cat_id: "BC630803",
    depth_no: "4",
    leaf_yn: "Y",
    use_yn: "N",
  },
];

const PREFILLED: LotteOnChannelInfo = {
  category: { standardCategoryNo: "", displayCategoryNos: [] },
  notice: { itemCode: "", articlesText: "0020:네이비\n0060:스페인" },
  certification: { safetyText: "", importProxyCode: "" },
  delivery: {
    outboundPlaceNo: "115",
    returnPlaceNo: "115",
    deliveryCostPolicyNo: "335",
    deliveryRegionGroupCode: "GN101",
    courierCode: "0001",
    returnCourierCode: "0001",
    weekdayCloseTime: "1400",
  },
  codes: { originCode: "ES", taxTypeCode: "01", brandNo: "", externalProductNo: "EPD-1" },
};

/* ── 서버 대역 ──────────────────────────────────────────────────────────────
 * payload-preview는 **진짜 검증 함수로** 답한다(lotteon-picked-category.test.ts와
 * 같은 이유) — 화면이 말하는 등록 가능성이 서버 판정 그대로라는 것이 이 화면의
 * 계약이라, validation을 손으로 지어내면 그 계약을 검사할 수 없다. */
type ChannelFormInput = {
  standardCategoryNo?: string;
  displayCategoryNos?: string[];
  originCode?: string;
  taxTypeCode?: string;
  noticeItemCode?: string;
  noticeArticles?: { pdArtlCd: string; pdArtlCnts: string }[];
  safetyCertifications?: { sftyAthnTypCd: string; sftyAthnNo: string; sftyAthnOrgnNm?: string }[];
  importProxyCode?: string;
  brandNo?: string;
  outboundPlaceNo?: string;
  returnPlaceNo?: string;
  deliveryCostPolicyNo?: string;
  deliveryRegionGroupCode?: string;
  courierCode?: string;
  returnCourierCode?: string;
  weekdayCloseTime?: string;
  externalProductNo?: string;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function previewFor(product: CanonicalProduct, form: ChannelFormInput) {
  const channel: LotteOnChannelConfig = {
    ...BLANK_LOTTEON_CHANNEL_CONFIG,
    ...buildLotteOnSalePeriod(new Date("2026-09-14T00:00:00Z")),
    trGrpCd: "SR",
    trNo: "LO10000",
    standardCategoryNo: trimOrNull(form.standardCategoryNo),
    displayCategories: (form.displayCategoryNos ?? [])
      .map((no) => no.trim())
      .filter(Boolean)
      .map((lfDcatNo) => ({ mallCd: "LTON", lfDcatNo })),
    originCode: trimOrNull(form.originCode),
    taxTypeCode: trimOrNull(form.taxTypeCode) ?? "01",
    noticeItemCode: trimOrNull(form.noticeItemCode),
    noticeArticles: form.noticeArticles ?? [],
    safetyCertifications: form.safetyCertifications ?? [],
    importProxyCode: trimOrNull(form.importProxyCode),
    brandNo: trimOrNull(form.brandNo),
    outboundPlaceNo: trimOrNull(form.outboundPlaceNo),
    returnPlaceNo: trimOrNull(form.returnPlaceNo),
    deliveryCostPolicyNo: trimOrNull(form.deliveryCostPolicyNo),
    deliveryRegionGroupCode: trimOrNull(form.deliveryRegionGroupCode),
    courierCode: trimOrNull(form.courierCode),
    returnCourierCode: trimOrNull(form.returnCourierCode),
    weekdayCloseTime: trimOrNull(form.weekdayCloseTime) ?? "1400",
    externalProductNo: trimOrNull(form.externalProductNo),
  };
  const input: LotteOnPayloadInput = { product, channel, detailHtml: "<p>상세</p>" };
  return {
    ok: true,
    identityError: null,
    payload: buildLotteOnPayload(input),
    validation: validateLotteOnPayload(input),
  };
}

let sentChannels: ChannelFormInput[] = [];
/** 조회 라우트를 몇 번 불렀는지 · 어떤 질의로 불렀는지. */
let categoryQueries: string[] = [];

let container: HTMLDivElement;
let root: Root;
let saved: LotteOnChannelInfo | undefined;
let readiness: { percent: number; allRequiredPassed: boolean; missingCount: number } | null = null;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sentChannels = [];
  categoryQueries = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown, init?: { body?: string }) => {
      const url = String(input);
      if (url.includes("/api/lotteon/category-recommend")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(REJECT_RESPONSE) });
      }
      if (url.includes("/api/lotteon/categories")) {
        categoryQueries.push(url);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              readOnly: true,
              job: "cheetahStandardCategory",
              items: STANDARD_CATEGORY_ITEMS,
              count: STANDARD_CATEGORY_ITEMS.length,
            }),
        });
      }
      if (url.includes("/api/lotteon/payload-preview")) {
        const body = JSON.parse(init?.body ?? "{}") as { product: CanonicalProduct; channel: ChannelFormInput };
        sentChannels.push(body.channel);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(previewFor(body.product, body.channel)) });
      }
      return Promise.reject(new Error(`stub에 없는 요청: ${url}`));
    }),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function enterTab(product: CanonicalProduct): Promise<void> {
  readiness = null;
  await act(async () => {
    root.render(
      createElement(LotteOnRegistrationPanel, {
        product,
        commonPrice: { priceKrw: 128000, resolved: true },
        commonCategorySources: [],
        channelInfo: saved,
        onChannelInfoChange: (info) => {
          saved = info;
        },
        onEditCommonInfo: () => {},
        onReadinessChange: (percent, allRequiredPassed, missingCount) => {
          readiness = { percent, allRequiredPassed, missingCount };
        },
      }),
    );
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function click(label: string): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  );
  if (!button) throw new Error(`"${label}" 버튼이 화면에 없다`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 지금 화면에 서 있는 "카테고리 선택" 목록 화면. */
function picker(): HTMLElement {
  const heading = Array.from(container.querySelectorAll("p")).find(
    (p) => (p.textContent ?? "").trim() === "롯데ON 카테고리 선택",
  );
  const box = heading?.closest("div")?.parentElement?.parentElement;
  if (!box) throw new Error("카테고리 선택 목록이 화면에 없다");
  return box as HTMLElement;
}

/** 목록에서 그 이름의 줄을 누른다 — 셀러가 하는 일 그대로다. */
async function pickRow(name: string): Promise<void> {
  const row = Array.from(picker().querySelectorAll("li button")).find((b) =>
    (b.textContent ?? "").includes(name),
  );
  if (!row) throw new Error(`목록에 "${name}" 줄이 없다`);
  await act(async () => {
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 추천을 눌러 REJECT를 받는다 — 이 파일 모든 시나리오의 출발점이다. */
async function recommendAndFail(): Promise<void> {
  await click("카테고리 추천");
}

/* ── 1. 막다른 길이 아니다 ──────────────────────────────────────────────── */

describe("REWORK-6 ② — 추천 REJECT가 막다른 길이 아니다", () => {
  it("🔴 추천 실패 화면에 CEO가 지정한 세 줄이 선다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();

    const after = text();
    expect(after).toContain("카테고리를 자동 추천하지 못했습니다.");
    expect(after).toContain("롯데ON 카테고리를 직접 선택해주세요");
    expect(
      Array.from(container.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim()),
    ).toContain("롯데ON 카테고리 선택");
  });

  it("추천을 눌러보기 전에는 그 길을 먼저 내밀지 않는다 — 원칙은 시스템 추천 → 셀러 선택이다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    expect(text()).not.toContain("카테고리를 자동 추천하지 못했습니다.");
  });
});

/* ── 2. 번호 입력이 아니다 ──────────────────────────────────────────────── */

describe("REWORK-6 ② — 폐기된 번호 입력 UX를 되살리지 않는다", () => {
  it("🔴 카테고리 선택 화면에 입력칸이 하나도 없다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();
    await click("롯데ON 카테고리 선택");

    expect(picker().querySelectorAll("input").length, "번호를 적는 칸이 되살아났다").toBe(0);
    expect(picker().querySelectorAll("textarea").length).toBe(0);
    // 폐기된 그 라벨들도 돌아오지 않았다.
    expect(text()).not.toContain("표준카테고리번호 (scatNo)");
    expect(text()).not.toContain("전시카테고리번호 (dcatLst)");
  });

  it("기존 조회 라우트를 그대로 쓴다 — 새 조회 경로를 만들지 않았다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();
    await click("롯데ON 카테고리 선택");

    expect(categoryQueries.length).toBeGreaterThan(0);
    expect(categoryQueries[0]).toContain("/api/lotteon/categories");
    expect(categoryQueries[0]).toContain("job=cheetahStandardCategory");
  });

  it("셀러가 하는 일은 목록을 눌러 내려가는 것뿐이다 — 최상위부터 리프까지", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();
    await click("롯데ON 카테고리 선택");

    // 최상위에는 "패션의류"만 있고, 아직 고를 수 있는 줄이 아니다.
    expect(picker().textContent).toContain("패션의류");
    expect(picker().textContent).toContain("하위 열기");

    await pickRow("패션의류");
    expect(picker().textContent).toContain("유아동");
    await pickRow("유아동");
    expect(picker().textContent).toContain("유아동 하의");
    await pickRow("유아동 하의");

    // 리프에 도착하면 그때만 "선택"이 뜬다(87의 scatNo는 리프여야 한다).
    expect(picker().textContent).toContain("유아동 반바지");
    expect(picker().textContent).toContain("이 카테고리 선택");
    // 사용중지(use_yn=N) 카테고리는 아예 보여주지 않는다.
    expect(picker().textContent).not.toContain("사용중지");
  });
});

/* ── 3. 고르면 추천과 같은 경로를 탄다 ──────────────────────────────────── */

describe("REWORK-6 ② — 직접 고른 카테고리가 재검증 경로를 그대로 탄다", () => {
  async function pickThroughTree(): Promise<void> {
    await click("롯데ON 카테고리 선택");
    await pickRow("패션의류");
    await pickRow("유아동");
    await pickRow("유아동 하의");
    await pickRow("유아동 반바지");
  }

  it("🔴 고르기만 하면 우측 요약의 부족 항목에서 카테고리가 사라진다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();

    expect(text()).toContain("표준카테고리");
    const before = readiness!.missingCount;

    await pickThroughTree();

    expect(
      readiness!.missingCount,
      "직접 고른 카테고리는 요약에 반영되지 않았다 — 추천으로 고른 것과 갈라졌다",
    ).toBeLessThan(before);
    expect(sentChannels[sentChannels.length - 1].standardCategoryNo).toBe("BC63080300");
  });

  it("선택 한 번이 표준·전시·고시 품목·과세를 함께 반영한다 — 셀러에게 다시 묻지 않는다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();
    await pickThroughTree();

    const sent = sentChannels[sentChannels.length - 1];
    expect(sent.standardCategoryNo).toBe("BC63080300");
    expect(sent.displayCategoryNos).toEqual(["FC11130203", "FC11130204"]);
    expect(sent.noticeItemCode).toBe("23");
    expect(sent.taxTypeCode).toBe("01");
  });

  it("카테고리가 요구하는 안전인증 유형(chl_cfm → CHL_CFM)도 함께 따라온다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();
    await pickThroughTree();

    expect(text()).toContain("CHL_CFM");
    expect(saved!.category.selected).toEqual({
      name: "유아동 반바지",
      noticeItemCodes: ["23"],
      safetyTypeCodes: ["CHL_CFM"],
    });
  });

  it("고른 뒤 목록이 닫히고 읽기 전용 요약이 그 자리에 선다 — stale 경고 없이", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndFail();
    await pickThroughTree();

    const after = text();
    expect(after).toContain("선택한 카테고리가 채운 값");
    expect(after).toContain("BC63080300");
    expect(after).toContain("FC11130203");
    expect(after, "선택 직후인데 결과가 옛 입력에 대한 것이라고 말한다").not.toContain(
      "입력이 바뀌었습니다",
    );
    // 목록은 닫힌다 — 고르고 나서도 계속 열려 있으면 "아직 안 골랐나" 싶어진다.
    expect(after).not.toContain("이 카테고리 선택");
  });
});
