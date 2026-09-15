// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backfillCanonicalProduct,
  type CanonicalProduct,
  type FieldSource,
  type LotteOnChannelInfo,
  type ProvenanceField,
} from "@commerce/shared";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  validateLotteOnPayload,
  type LotteOnChannelConfig,
  type LotteOnPayloadInput,
} from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import {
  fromLotteOnChannelInfo,
  setLotteOnStandardCategoryNo,
  summarizeLotteOnManagedValues,
} from "../lotteon-channel-form";
import type { LotteOnStandardCategory } from "../lotteon-category";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * LOTTEON-CATEGORY-PERSIST(CEO 지시, 2026-09-14) — **고른 카테고리가 탭을
 * 벗어났다 돌아와도 남아 있는가**를 실제 마운트/클릭/언마운트/재마운트로 본다.
 *
 * ── 왜 서버 렌더로는 부족한가 ─────────────────────────────────────────────
 * three-layer-realign.test.ts는 `renderToStaticMarkup`으로 "저장된 값이 폼에
 * 돌아온다"를 고정했다. 그런데 **카테고리를 고르는 행위 자체가 클릭**이고,
 * 고른 결과의 일부(카테고리가 알려준 안전인증 유형 · 고시 품목 후보)는
 * 클릭 이후에만 존재하는 상태였다. 정적 렌더에는 그 상태가 아예 없으므로
 * "사라진다"도 "남는다"도 증명되지 않는다 — 그래서 여기서만 증명할 수 있다.
 *
 * ── 이 파일이 고정하는 명제 ───────────────────────────────────────────────
 *  1. 카테고리를 고르면 **등록·필수조건에 필요한 것**이 전부 상품 수준
 *     (CanonicalProduct.lotteOnChannelInfo)으로 올라간다.
 *  2. 탭을 벗어났다 돌아오는 것 = 언마운트 후 **그 저장값으로 재마운트**다.
 *     돌아온 화면이 선택 직후 화면과 같은 말을 한다.
 *  3. readiness(등록 가능성)와 87 payload가 복귀 전후로 동일하다.
 *  4. 🔴 저장한 것은 **최소 필드뿐**이다 — 후보 목록·점수·트리 메타는 없다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/**
 * 유아동(고시 품목코드 23) 상품이다. 이 저장소의 주력 카테고리이고, 카테고리가
 * 요구하는 **안전인증 유형**이 실제로 등록을 막느냐 마느냐를 가르는 유일한
 * 시나리오라 여기서 그것을 쓴다. childCertification은 셀러가 상품정보에 직접
 * 입력해 둔 실제 인증 정보다(우리가 만들지 않는다).
 */
function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kids-shorts",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
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
        originalUrl: "https://example.com/images/kids-shorts.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 아동 반바지입니다."),
    keywords: field(["아동", "반바지", "테리", "여름", "유아", "키즈"]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(30, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    childCertification: field(
      { name: "한국기계전기전자시험연구원", companyName: "보보쇼즈", certificationNumber: "CB123456789" },
      "USER_EDITED",
    ),
    itemName: field("아동용 반바지"),
    modelName: field("B226AC043"),
    weight: field(""),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000, "USER_EDITED"),
    ...overrides,
  } as unknown as CanonicalProduct;
}

/**
 * 추천이 돌려주는 표준카테고리 한 건 — 205 응답이 **한 번에 들고 오는** 것들이
 * 전부 들어 있다(전시카테고리 · 고시 품목코드 · 과세구분 · 요구 안전인증 유형).
 * 이 네 가지가 셀러에게 다시 묻지 않는 값이고, 그래서 사라지면 안 되는 값이다.
 */
const RECOMMENDED_CATEGORY: LotteOnStandardCategory = {
  id: "BC63080300",
  name: "유아동 반바지",
  parentId: "BC630803",
  depth: 4,
  leaf: true,
  usable: true,
  displayCategories: [
    { mallCode: "LTON", displayCategoryId: "FC11130203" },
    { mallCode: "LTON", displayCategoryId: "FC11130204" },
  ],
  noticeItemCodes: ["23"],
  taxTypeCode: "01",
  ageLimitCode: "0",
  safetyTypeCodes: ["CHL_CFM"],
};

const RECOMMEND_RESPONSE = {
  ok: true,
  decision: "RECOMMEND" as const,
  candidates: [
    {
      category: RECOMMENDED_CATEGORY,
      path: ["패션의류", "유아동", "유아동 하의", "유아동 반바지"],
      score: 82,
      reason: "연령대(유아동) 일치 · 상품유형(반바지) 일치",
      conflict: false,
    },
  ],
  signalEvidence: ["사용연령 4-5세", "상품유형 반바지"],
  scannedLeafCount: 1204,
  unrecognizedCount: 0,
  truncated: false,
};

/**
 * 셀러가 배송/원산지까지 이미 채워 둔 상태에서 시작한다. 카테고리 하나만 남은
 * 상품이어야 "카테고리를 고르면 등록 가능성이 어떻게 바뀌는가"가 보인다.
 */
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
 *
 * /api/lotteon/payload-preview 를 **진짜 검증 함수로** 답하게 한다. 화면이
 * 말하는 등록 가능성이 서버 판정 그대로라는 것이 이 화면의 계약이라,
 * validation을 손으로 지어내면 그 계약을 검사할 수 없게 된다.
 *
 * 아래 매핑은 라우트의 buildLotteOnContext()가 하는 것과 같다 — 다른 점은
 * 거래처(207)와 상세페이지 HTML을 네트워크/DB 없이 고정값으로 둔 것뿐이다.
 */
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

/** 화면이 서버로 보낸 채널 입력 전부 — 마지막 것이 "지금 화면의 등록 조건"이다. */
let sentChannels: ChannelFormInput[] = [];
/** 화면이 서버로부터 받은 payload 전부. 87 일치를 보기 위한 것. */
let previewPayloads: unknown[] = [];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sentChannels = [];
  previewPayloads = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown, init?: { body?: string }) => {
      const url = String(input);
      if (url.includes("/api/lotteon/category-recommend")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(RECOMMEND_RESPONSE) });
      }
      if (url.includes("/api/lotteon/payload-preview")) {
        const body = JSON.parse(init?.body ?? "{}") as { product: CanonicalProduct; channel: ChannelFormInput };
        sentChannels.push(body.channel);
        const response = previewFor(body.product, body.channel);
        previewPayloads.push(response.payload);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
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

/**
 * 탭 = 이 컴포넌트의 마운트다. CommerceWorkspace가
 * `{tab === LOTTEON_TAB && <LotteOnRegistrationPanel …/>}`로 조건 렌더하므로
 * 탭을 벗어나는 것은 언마운트, 돌아오는 것은 **저장값으로의 재마운트**다.
 * 여기서 그 왕복을 그대로 만든다 — saved가 상품(CanonicalProduct)의 자리다.
 */
let saved: LotteOnChannelInfo | undefined;
let readiness: { percent: number; allRequiredPassed: boolean; missingCount: number } | null = null;

async function enterTab(product: CanonicalProduct): Promise<void> {
  readiness = null;
  await act(async () => {
    root.render(
      createElement(LotteOnRegistrationPanel, {
        product,
        commonPrice: { priceKrw: 128000, resolved: true },
        commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
        channelInfo: saved,
        onChannelInfoChange: (info) => {
          saved = info;
        },
        onEditCommonInfo: () => {},
        manufacturerResolution: manufacturerFixture(),
        onReadinessChange: (percent, allRequiredPassed, missingCount) => {
          readiness = { percent, allRequiredPassed, missingCount };
        },
      }),
    );
  });
  /* REWORK-11 ①(2026-09-15) — 롯데ON 탭도 첫 화면에는 ① 기본 상품정보만 펼치고
     시작한다(스마트스토어·쿠팡과 같은 정책). 셀러가 하듯 나머지를 펼치고 본다. */
  await act(async () => {
    expandAllSections(container);
  });
}

/** 탭을 벗어난다(언마운트). 저장값은 상품에 남는다 — 그것이 이 커밋의 주제다. */
async function leaveTab(): Promise<void> {
  await act(async () => {
    root.render(null);
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * REWORK-10 C(CEO 지시, 2026-09-15) — 후보를 고르는 동작이 스마트스토어·쿠팡과
 * 같아졌다: 줄 전체가 버튼이던 것에서 **카드 안의 [선택] 버튼**으로 바뀌었다
 * (CategoryCandidateCard — 세 채널 공용). 그래서 "표준카테고리번호가 적힌 줄을
 * 누른다"가 아니라 "그 번호를 가진 카드의 [선택]을 누른다"로 찾는다.
 */
async function pickCandidate(categoryId: string): Promise<void> {
  const card = Array.from(container.querySelectorAll("li[data-category-candidate]")).find((li) =>
    (li.textContent ?? "").includes(categoryId),
  );
  if (!card) throw new Error(`후보 카드에 "${categoryId}"가 없다`);
  const button = Array.from(card.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").trim() === "선택",
  );
  if (!button) throw new Error(`"${categoryId}" 카드에 [선택] 버튼이 없다`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
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

/**
 * 셀러가 하는 일 그대로 — 나온 후보를 누른다. **그것이 전부다.**
 *
 * REWORK-10 C(CEO 지시, 2026-09-15) — 여기 있던 `click("카테고리 추천")`이
 * 사라졌다. 추천이 탭 진입과 동시에 자동으로 돌기 때문이다(스마트스토어가
 * /api/naver/category-search를 자동으로 돌리는 것과 같은 동작). 셋 중 롯데ON만
 * "먼저 버튼을 눌러야 시작되는" 화면이던 것이 이번에 사라진 차이다.
 */
async function recommendAndPickOnly(): Promise<void> {
  await pickCandidate(RECOMMENDED_CATEGORY.id);
}

/**
 * 기존 테스트들이 쓰던 형태 — 선택 뒤에 확인을 한 번 더 누른다. 자동 확인이
 * 생긴 뒤에도 이 경로는 그대로 유효해야 한다(같은 결과에 도달한다).
 */
async function recommendAndPick(): Promise<void> {
  await recommendAndPickOnly();
  await click("등록 정보 확인");
}

/* ─────────────────────────────────────────────────────────────────────── */

/**
 * REWORK-5 ③(CEO 실측 판정: FAIL) — **"다시 조회 → 번호 찾아서 입력 → 우측
 * 요약에서도 안 없어짐"** 세 가지를 하나씩 뒤집는다.
 */
describe("REWORK-5 ③ — 번호를 찾아 적는 길이 없어졌다", () => {
  it("표준·전시 카테고리번호 입력칸이 화면에 없다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    expect(text()).not.toContain("표준카테고리번호 (scatNo)");
    expect(text()).not.toContain("전시카테고리번호 (dcatLst)");
  });

  it("[직접 찾기] 조회 버튼이 화면에 없다 — 조회해서 번호를 옮겨 적는 길이 사라졌다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    expect(text()).not.toContain("표준카테고리 직접 찾기");
    expect(text()).not.toContain("전시카테고리 직접 찾기");
  });

  it("남은 길은 [카테고리 추천] 하나다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    expect(text()).toContain("카테고리 추천");
    expect(text()).toContain("아직 고른 카테고리가 없습니다");
  });
});

describe("REWORK-5 ③ — 선택 즉시 자동 반영(확인을 다시 누르지 않는다)", () => {
  /**
   * 🔴 이 저장소가 신고받은 바로 그 증상이다.
   *
   * BEFORE: 후보를 고르면 commitForm()이 stale=true를 세우는데 우측 요약이 읽는
   * 부족정보는 **직전 검증 응답**에서 나왔다. 그래서 카테고리를 골라도 요약에는
   * "카테고리 없음"이 그대로 남고 등록 가능성은 0%로 떨어졌다 — 셀러가
   * [등록 정보 확인]을 한 번 더 눌러야만 사라졌다.
   */
  it("🔴 고르기만 하면 우측 요약의 부족 항목에서 카테고리가 사라진다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());

    // 고르기 전 — 카테고리가 부족 항목에 서 있다.
    expect(text()).toContain("표준카테고리");
    const before = readiness!.missingCount;

    // 셀러의 한 동작: 추천 → 선택. [등록 정보 확인]은 누르지 않는다.
    await recommendAndPickOnly();

    expect(
      readiness!.missingCount,
      "고른 뒤에도 부족 항목 수가 그대로다 — 요약이 갱신되지 않았다",
    ).toBeLessThan(before);
    // 서버가 scatNo를 READY로 판정했다 = 부족 목록에서 빠졌다.
    const sent = sentChannels[sentChannels.length - 1];
    expect(sent.standardCategoryNo).toBe("BC63080300");
  });

  it("🔴 고른 직후 화면이 stale 경고를 띄우지 않는다 — 결과가 지금 입력에 대한 것이다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPickOnly();
    expect(text()).not.toContain("입력이 바뀌었습니다");
  });

  it("선택 한 번이 표준·전시·고시 품목·과세를 함께 반영한다 — 확인을 누르지 않아도", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPickOnly();

    const sent = sentChannels[sentChannels.length - 1];
    expect(sent.standardCategoryNo).toBe("BC63080300");
    expect(sent.displayCategoryNos).toEqual(["FC11130203", "FC11130204"]);
    expect(sent.noticeItemCode).toBe("23");
    expect(sent.taxTypeCode).toBe("01");
  });

  /** 고른 결과를 셀러가 눈으로 확인할 자리(입력칸 대신 들어선 읽기 전용 요약). */
  it("고른 결과가 읽기 전용 요약으로 화면에 선다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPickOnly();

    const after = text();
    expect(after).toContain("선택한 카테고리가 채운 값");
    expect(after).toContain("BC63080300");
    expect(after).toContain("FC11130203");
    expect(after).toContain("23");
  });
});

describe("1 — 고른 카테고리가 실제로 무엇을 먹이는가", () => {
  it("고르면 표준·전시·고시 품목·과세가 한 번에 채워지고, 그 값으로 서버 검증이 돈다", async () => {
    saved = { ...PREFILLED };
    const product = makeProduct();
    await enterTab(product);

    // 고르기 전 — 등록 가능성을 숫자로 말하지 않는다(§17).
    expect(text()).toContain("등록 가능성 판단 제한");

    await recommendAndPick();

    const sent = sentChannels[sentChannels.length - 1];
    expect(sent.standardCategoryNo).toBe("BC63080300");
    expect(sent.displayCategoryNos).toEqual(["FC11130203", "FC11130204"]);
    expect(sent.noticeItemCode).toBe("23");
    expect(sent.taxTypeCode).toBe("01");
  });

  it("카테고리가 요구하는 안전인증 유형은 87 payload의 sftyAthnTypCd가 된다 — 힌트가 아니다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();

    // 이 버튼은 상품정보의 실제 인증번호에 **카테고리가 알려준 유형코드**를 붙여
    // 넣는다. 유형코드를 모르면 이 줄 자체가 만들어지지 않는다(우리가 정할 수
    // 없는 값이라 buildLotteOnSafetyLineFromCommon이 null을 돌려준다).
    expect(text()).toContain("CHL_CFM:CB123456789");
    await click("상품정보의 인증정보 가져오기");
    await click("등록 정보 확인");

    const sent = sentChannels[sentChannels.length - 1];
    expect(sent.safetyCertifications).toEqual([
      { sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789", sftyAthnOrgnNm: "한국기계전기전자시험연구원" },
    ]);
  });

  it("유아동(23)은 안전인증이 들어가야 등록 가능성이 100%가 된다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    // 카테고리만 고른 상태: 고시 품목 23이 붙었으므로 안전인증이 비어 있는 동안
    // 등록은 막혀 있다.
    expect(readiness!.allRequiredPassed).toBe(false);

    await click("상품정보의 인증정보 가져오기");
    await click("등록 정보 확인");
    expect(readiness!.allRequiredPassed).toBe(true);
    expect(readiness!.percent).toBe(100);
  });
});

describe("2 — 탭 이탈 → 복귀", () => {
  it("복귀한 화면이 선택 직후 화면과 같은 말을 한다(카테고리 이름 · 고시 품목 · 요구 안전인증)", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    const before = text();
    expect(before).toContain("유아동 반바지");
    expect(before).toContain("선택한 표준카테고리가 요구하는 안전인증 유형");
    expect(before).toContain("CHL_CFM");

    await leaveTab();
    await enterTab(makeProduct());

    const after = text();
    expect(after, "복귀 후 선택한 카테고리 이름이 사라졌다").toContain("유아동 반바지");
    expect(after, "복귀 후 카테고리가 알려준 고시 품목코드가 사라졌다").toContain("고시 품목코드: 23");
    expect(after, "복귀 후 카테고리가 요구하는 안전인증 유형이 사라졌다").toContain("CHL_CFM");
  });

  it("복귀 후에도 상품정보의 인증정보를 그대로 가져올 수 있다 — 유형코드가 남아 있다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    await leaveTab();
    await enterTab(makeProduct());

    expect(text(), "복귀 후 '가져오기' 경로가 사라졌다 — 유형코드를 만들 방법이 없다").toContain(
      "CHL_CFM:CB123456789",
    );
    await click("상품정보의 인증정보 가져오기");
    await click("등록 정보 확인");
    expect(sentChannels[sentChannels.length - 1].safetyCertifications).toEqual([
      { sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789", sftyAthnOrgnNm: "한국기계전기전자시험연구원" },
    ]);
  });

  /**
   * 탭 왕복보다 한 단계 더 먼 왕복 — 새로고침/워크스페이스 복원이다.
   *
   * page.tsx는 `canonicalProduct: product`로 **상품 전체**를 sessionStorage와
   * product_snapshots.workspace jsonb에 넣고, 복원할 때 backfillCanonicalProduct()가
   * `...raw`로 그대로 되돌린다(필드 화이트리스트가 없다). 그래서 새 API도 새
   * 테이블도 마이그레이션도 필요 없지만, **그 말이 참인지**는 실제로 JSON을
   * 왕복시켜 봐야 안다 — 여기서 그 왕복을 그대로 만든다.
   */
  it("새로고침(JSON 왕복 → backfill)도 견딘다 — 마이그레이션 없이 남는다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    await leaveTab();

    const stored = JSON.parse(
      JSON.stringify(backfillCanonicalProduct(makeProduct({ lotteOnChannelInfo: saved }))),
    ) as CanonicalProduct;
    expect(stored.lotteOnChannelInfo).toEqual(saved);

    saved = stored.lotteOnChannelInfo;
    await enterTab(stored);
    const after = text();
    expect(after).toContain("유아동 반바지");
    expect(after).toContain("CHL_CFM:CB123456789");
  });

  it("readiness가 복귀 전후로 같다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    await click("상품정보의 인증정보 가져오기");
    await click("등록 정보 확인");
    const before = { ...readiness! };

    await leaveTab();
    await enterTab(makeProduct());
    // 복귀하면 저장된 값으로 자동 확인이 한 번 돈다 — 그 결과가 떠난 때와 같다.
    expect(readiness).toEqual(before);
    expect(before.allRequiredPassed).toBe(true);
  });

  it("87 payload가 복귀 전후로 같다 — 같은 카테고리로 등록된다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    await click("상품정보의 인증정보 가져오기");
    await click("등록 정보 확인");
    const before = previewPayloads[previewPayloads.length - 1] as {
      spdLst: {
        scatNo: string;
        dcatLst: unknown[];
        pdItmsInfo: { pdItmsCd: string };
        sftyAthnLst: unknown[];
      }[];
    };

    await leaveTab();
    await enterTab(makeProduct());
    const after = previewPayloads[previewPayloads.length - 1] as typeof before;

    expect(after.spdLst[0].scatNo).toBe("BC63080300");
    expect(after.spdLst[0].dcatLst).toEqual(before.spdLst[0].dcatLst);
    expect(after.spdLst[0].dcatLst).toEqual([
      { mallCd: "LTON", lfDcatNo: "FC11130203" },
      { mallCd: "LTON", lfDcatNo: "FC11130204" },
    ]);
    expect(after.spdLst[0].pdItmsInfo.pdItmsCd).toBe("23");
    expect(after.spdLst[0].sftyAthnLst).toEqual(before.spdLst[0].sftyAthnLst);
    expect(after.spdLst[0].sftyAthnLst).toEqual([
      { sftyAthnTypCd: "CHL_CFM", sftyAthnNo: "CB123456789", sftyAthnOrgnNm: "한국기계전기전자시험연구원" },
    ]);
  });
});

describe("3 — 저장한 것은 최소 필드뿐이다", () => {
  it("트리 메타 · 후보 목록 · 점수는 저장하지 않는다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();

    const serialized = JSON.stringify(saved);
    // 추천 결과에만 있고 등록/판정에는 쓰이지 않는 것들.
    for (const [what, needle] of [
      ["점수", "82"],
      ["추천 이유", "연령대(유아동) 일치"],
      ["신호 근거", "상품유형 반바지"],
      ["트리 경로", "패션의류"],
      ["상위 카테고리", "BC630803\""],
      ["depth", "\"depth\""],
      ["leaf", "\"leaf\""],
      ["나이제한코드", "ageLimitCode"],
    ] as const) {
      expect(serialized, `저장 스냅샷에 ${what}이(가) 들어갔다`).not.toContain(needle);
    }
  });

  it("저장한 카테고리 필드는 등록·판정에 쓰이는 것뿐이다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();

    expect(Object.keys(saved!.category).sort()).toEqual(
      ["displayCategoryNos", "selected", "standardCategoryNo"].sort(),
    );
    expect(saved!.category.selected).toEqual({
      name: "유아동 반바지",
      noticeItemCodes: ["23"],
      safetyTypeCodes: ["CHL_CFM"],
    });
  });

  /**
   * REWORK-5 ③(CEO 지시, 2026-09-14) — **이 테스트가 화면에서 함수로 내려왔다.**
   *
   * 원래는 "셀러가 표준카테고리번호 칸을 직접 고친다"를 실제 입력칸에 타이핑해서
   * 검사했다. 그 입력칸이 **없어졌다** — 번호를 찾아 손으로 적는 UX 자체가
   * 폐기됐기 때문이다(CEO 실측 판정 FAIL: "다시 조회 → 번호 찾아서 입력").
   *
   * 🔴 그래도 이 명제를 지우지 않는다. 판단은 여전히
   * setLotteOnStandardCategoryNo() 한 곳에 살아 있고, 그 함수가 "번호가 바뀌면
   * 직전 카테고리가 알려준 것(요구 안전인증 유형 · 고시 품목)을 버린다"를
   * 지켜야 한다는 사실은 화면 모양과 무관하게 참이어야 한다. 나중에 어떤
   * 경로로든 번호가 다시 바뀔 수 있게 되면, 그때 틀린 유형코드로 인증이
   * 등록되는 것을 막는 것이 이 규칙이다.
   */
  it("🔴 번호가 바뀌면 직전 카테고리가 알려준 것은 버려진다(함수 수준 — 입력칸은 폐기됨)", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();
    expect(saved!.category.selected?.safetyTypeCodes).toEqual(["CHL_CFM"]);

    // 화면에서 그 칸이 정말 사라졌는지부터 확인한다 — 이 테스트가 함수로
    // 내려온 이유 자체가 렌더 사실이어야 한다.
    expect(
      Array.from(container.querySelectorAll("input")).some((el) => el.value === "BC63080300"),
      "폐기했어야 할 표준카테고리번호 입력칸이 아직 화면에 있다",
    ).toBe(false);

    const picked = fromLotteOnChannelInfo(saved!);
    const changed = setLotteOnStandardCategoryNo(picked, "BC99999999");
    expect(changed.category.standardCategoryNo).toBe("BC99999999");
    expect(changed.category.selected ?? null).toBeNull();
  });

  it("🔴 상품 정보 화면으로 나가는 경로가 함수 수준에서 없다", async () => {
    saved = { ...PREFILLED };
    await enterTab(makeProduct());
    await recommendAndPick();

    // summarizeLotteOnManagedValues()는 category 키를 읽지 않는다 — 저장 타입에
    // 있어도 상품 정보 화면이 그 값을 보여줄 함수가 존재하지 않는다.
    const { rows } = summarizeLotteOnManagedValues(saved!);
    const values = rows.map((row) => `${row.label}=${row.value ?? ""}`).join("|");
    expect(values).not.toContain("BC63080300");
    expect(values).not.toContain("FC11130203");
    expect(values).not.toContain("유아동 반바지");
    expect(rows.some((row) => row.label.includes("카테고리"))).toBe(false);
  });
});
