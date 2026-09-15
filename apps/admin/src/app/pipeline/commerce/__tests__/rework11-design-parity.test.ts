// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import {
  BLANK_LOTTEON_CHANNEL_CONFIG,
  buildLotteOnPayload,
  buildLotteOnSalePeriod,
  resolveManufacturer,
  type LotteOnSellerSettingsInput,
} from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { MissingFieldsBulkPanel } from "../MissingFieldsBulkPanel";
import { PlatformPreview } from "../PlatformPreview";
import { FIELD_INPUT_CLASS } from "../registration-fields";
import {
  parseLotteOnStandardCategory,
  recommendLotteOnStandardCategories,
} from "../lotteon-category";
import { expandAllSections } from "./mount-registration-tab";

/**
 * REWORK-11 ①(CEO 판정, 2026-09-15) — **"섹션 순서가 같다"는 통합이 아니다.**
 *
 * CEO 원문: "🔴 섹션 제목 목록이 아니라 «디자인이 같은가»를 증명하라 — 같은
 * 컴포넌트를 쓰는가 · 카드/입력/버튼/배지 클래스가 같은가 · 롯데ON 전용
 * 컴포넌트가 몇 개 남았는가(고유 필드 제외 0이어야 한다)."
 *
 * 그래서 이 파일은 제목을 한 글자도 비교하지 않는다. 세 탭을 실제로 마운트해서
 * **DOM의 className 집합**을 비교한다 — 컴포넌트가 진짜 같으면 클래스가 같고,
 * 한쪽이 자기 것을 갖고 있으면 클래스가 갈린다. 그게 "디자인이 같은가"를 렌더
 * 결과에서 셀 수 있는 유일한 방법이다.
 *
 * ── ② 제조사 ─────────────────────────────────────────────────────────────
 * "화면 + 저장 데이터 + 최종 payload 세 군데가 같은 값을 보는가"를 **네 화면**
 * (상품정보 · SmartStore · Coupang · LotteON)에서 확인한다.
 */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

/** 🔴 원문에 제조사가 없는 상품 — 폴백이 실제로 도는 조건이다. */
function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
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
    manufacturer: { value: "", source: "REQUIRED", confidence: 0 } as never,
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
    ...overrides,
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

const BRAND_MANUFACTURER = "Bobo Choses S.L.";

/** 세 탭이 받는 **같은 객체**. 화면이 판정하지 않는다는 전제 그대로다. */
function resolution(input: Parameters<typeof resolveManufacturer>[0], loading = false) {
  return { ...resolveManufacturer(input), loading };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, profiles: [] }) })),
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

type Resolution = ReturnType<typeof resolution>;

function lotteOnElement(manufacturerResolution: Resolution): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: sellerSettings(),
    onEditCommonInfo: () => {},
    manufacturerResolution,
  } as never);
}

function platformElement(platform: PlatformId, manufacturerResolution: Resolution): ReactElement {
  const product = makeProduct();
  return createElement(PlatformPreview, {
    product,
    listing: PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform),
    categoryCandidates: [],
    listingStatus: "DRAFT" as const,
    listingResult: null,
    onUpdateField: () => {},
    onSelectCategory: () => {},
    onOpenListingModal: () => {},
    onRetryListing: () => {},
    developerMode: false,
    manufacturerResolution,
  } as never);
}

function tabs(manufacturerResolution: Resolution) {
  return [
    { label: "SMARTSTORE", element: () => platformElement("smartstore", manufacturerResolution) },
    { label: "COUPANG", element: () => platformElement("coupang", manufacturerResolution) },
    { label: "LOTTEON", element: () => lotteOnElement(manufacturerResolution) },
  ];
}

async function mount(element: ReactElement, expand = true): Promise<HTMLElement> {
  await act(async () => {
    root.render(element);
  });
  if (expand) {
    await act(async () => {
      expandAllSections(container);
    });
  }
  return container;
}

function leftColumn(dom: HTMLElement): HTMLElement {
  const frame = dom.querySelector('[data-frame="channel-registration"]');
  if (!frame) throw new Error("공용 등록 프레임이 없다");
  return frame.children[0] as HTMLElement;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function classSet(scope: HTMLElement, selector: string): string[] {
  return Array.from(new Set(Array.from(scope.querySelectorAll(selector)).map((el) => el.className))).sort();
}

/* ── ① 디자인 통합 — 클래스 전수 비교 ─────────────────────────────────────── */

describe("REWORK-11 ① — 세 탭이 같은 컴포넌트로 그려진다(클래스 전수)", () => {
  it("🔴 섹션 카드의 className이 세 탭에서 글자 그대로 같다", async () => {
    const dumps: Record<string, string[]> = {};
    for (const tab of tabs(resolution({ brandProfileManufacturer: BRAND_MANUFACTURER }))) {
      dumps[tab.label] = classSet(leftColumn(await mount(tab.element())), "section[id]");
    }
    // 세 탭 모두 CollapsibleSection 하나만 쓴다 → 카드 클래스가 정확히 한 종류다.
    expect(dumps.SMARTSTORE).toHaveLength(1);
    expect(dumps.COUPANG).toEqual(dumps.SMARTSTORE);
    expect(dumps.LOTTEON, "롯데ON 섹션 카드가 다른 클래스를 쓴다").toEqual(dumps.SMARTSTORE);
  });

  it("🔴 섹션 머리 버튼(접기/펼치기)의 className이 세 탭에서 같다", async () => {
    const dumps: Record<string, string[]> = {};
    for (const tab of tabs(resolution({}))) {
      dumps[tab.label] = classSet(leftColumn(await mount(tab.element())), "section[id] > button");
    }
    expect(dumps.SMARTSTORE).toHaveLength(1);
    expect(dumps.COUPANG).toEqual(dumps.SMARTSTORE);
    expect(dumps.LOTTEON, "롯데ON 섹션 머리가 다른 버튼이다").toEqual(dumps.SMARTSTORE);
  });

  it("🔴 텍스트 입력칸의 className이 세 탭에서 같다 — 공용 FIELD_INPUT_CLASS 하나뿐", async () => {
    for (const tab of tabs(resolution({}))) {
      const left = leftColumn(await mount(tab.element()));
      const inputs = Array.from(left.querySelectorAll('input[type="text"], textarea'));
      expect(inputs.length, `${tab.label}: 입력칸이 하나도 없다`).toBeGreaterThan(0);
      for (const input of inputs) {
        expect(
          input.className.startsWith(FIELD_INPUT_CLASS),
          `${tab.label}: 공용 입력 클래스가 아니다 — ${input.className}`,
        ).toBe(true);
      }
    }
  });

  it("🔴 롯데ON 전용 입력 클래스가 0건이다 — 예전 TextField가 쓰던 모양", async () => {
    /* BEFORE(4c1a4cd): 롯데ON만 `rounded-md border border-border px-3 py-1.5`
       (반경·여백이 다르다). AFTER: 그 클래스를 쓰는 입력칸이 없다. */
    const left = leftColumn(await mount(lotteOnElement(resolution({}))));
    const legacy = Array.from(left.querySelectorAll("input, textarea")).filter((el) =>
      el.className.includes("px-3 py-1.5"),
    );
    expect(legacy.map((el) => el.className)).toEqual([]);
  });

  it("🔴 필수/선택 배지가 공용 StatusBadge다 — 전용 span(bg-error-soft 배지)이 0건", async () => {
    const left = leftColumn(await mount(lotteOnElement(resolution({}))));
    const legacyBadges = Array.from(left.querySelectorAll("span")).filter(
      (el) => el.className.includes("bg-error-soft") && clean(el.textContent ?? "").includes("필수"),
    );
    expect(legacyBadges.map((el) => el.className)).toEqual([]);
  });

  it("🔴 접힘/펼침 동작이 같다 — 세 탭 모두 ① 하나만 열고 시작한다", async () => {
    for (const tab of tabs(resolution({}))) {
      // 펼치지 않은 첫 화면 그대로 본다.
      const left = leftColumn(await mount(tab.element(), false));
      const heads = Array.from(left.querySelectorAll("section[id] > button"));
      const open = heads.filter((b) => (b.textContent ?? "").includes("접기 ▲"));
      expect(heads.length, `${tab.label}: 접을 수 있는 섹션이 없다`).toBeGreaterThan(5);
      expect(open.length, `${tab.label}: 처음부터 열린 섹션이 하나가 아니다`).toBe(1);
      expect(clean(open[0].textContent ?? "").startsWith("① "), `${tab.label}: 열린 것이 ①이 아니다`).toBe(true);
    }
  });

  it("🔴 좌측 상세에 남은 롯데ON 고유 블록은 «채널 고유 값»뿐이다", async () => {
    const left = leftColumn(await mount(lotteOnElement(resolution({}))));
    const titles = Array.from(left.querySelectorAll("section[id] > button"))
      .map((b) => clean(b.textContent ?? "").split(/[🟢🟠🟡🔴○]/)[0])
      .map((t) => t.replace(/(접기 ▲|펼치기 ▼).*$/, "").trim());
    const extra = titles.filter((t) => !/^[①②③④⑤⑥⑦⑧⑨⑩]/.test(t));
    /* REWORK-13B — 공통 ①~⑩ **뒤에** 붙는 고유 섹션은 ⑪부터 번호를 받는다. */
    expect(extra, `골격 밖 섹션 — ${extra.join(" / ")}`).toEqual(["⑪ 롯데ON 고유 코드"]);
  });
});

/* ── ④ 카테고리 추천 — 후보가 실제로 화면에 서는가 ────────────────────────── */

describe("REWORK-11 ④ — 롯데ON 카테고리 추천 후보가 화면에 선다", () => {
  /**
   * 🔴 실호출은 여기서 할 수 없다(인증키·IP allowlist). 대신 **205 응답 원문
   * 모양 그대로**의 행을 파서에 넣어 추천까지 돌리고, 그 결과를 화면이 실제로
   * 카드로 그리는지까지 본다 — 라우트가 하는 일과 같은 순서다
   * (parseLotteOnStandardCategory → recommendLotteOnStandardCategories).
   */
  const RAW_205 = [
    { std_cat_id: "BC630803", std_cat_nm: "유아동 하의", upr_std_cat_id: "BC6308", depth_no: "3", leaf_yn: "N", use_yn: "Y" },
    {
      std_cat_id: "BC63080300",
      std_cat_nm: "유아동 반바지",
      upr_std_cat_id: "BC630803",
      depth_no: "4",
      leaf_yn: "Y",
      use_yn: "Y",
      disp_list: [{ mall_dvs_cd: "LTON", disp_cat_id: "FC11130203" }],
      pd_Itms_list: [{ pd_Itms_cd: "23" }],
      tdf_cd: "01",
      chl_cfm: "Y",
    },
    {
      std_cat_id: "BC99990000",
      std_cat_nm: "자동차 타이어",
      upr_std_cat_id: "BC9999",
      depth_no: "4",
      leaf_yn: "Y",
      use_yn: "Y",
    },
  ];

  it("🔴 205 응답 모양 그대로 넣으면 후보가 나온다 — 0건이 아니다", () => {
    const categories = RAW_205.map((raw) => parseLotteOnStandardCategory(raw)).filter(
      (category): category is NonNullable<typeof category> => category != null,
    );
    expect(categories, "205 원문을 파서가 못 읽었다").toHaveLength(RAW_205.length);

    const result = recommendLotteOnStandardCategories(makeProduct(), categories);
    expect(result.candidates.length, "후보가 0건이다").toBeGreaterThan(0);
    expect(result.decision).not.toBe("REJECT");
    // 유아동 반바지가 자동차 타이어보다 앞에 온다 — 점수는 공통 함수가 낸 값이다.
    expect(result.candidates[0].category.name).toBe("유아동 반바지");
    // 고른 한 번이 함께 들고 오는 값들(다시 묻지 않는 이유).
    expect(result.candidates[0].category.displayCategories).toHaveLength(1);
    expect(result.candidates[0].category.noticeItemCodes).toEqual(["23"]);
    expect(result.candidates[0].category.safetyTypeCodes).toEqual(["CHL_CFM"]);
  });

  it("🔴 후보가 0건이면 «왜»를 화면이 갈라서 적는다 — 한 문장으로 뭉개지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const url = String(input);
        if (url.includes("category-recommend")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ok: true,
                decision: "REJECT",
                candidates: [],
                signalEvidence: [],
                scannedLeafCount: 0,
                unrecognizedCount: 0,
                truncated: false,
                totalCategoryCount: 0,
                pagesFetched: 1,
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, profiles: [] }) });
      }),
    );
    const left = leftColumn(await mount(lotteOnElement(resolution({}))));
    expect(clean(left.textContent ?? "")).toContain(
      "롯데ON이 표준카테고리를 0건 돌려줬습니다(읽은 페이지 1)",
    );
  });
});

/* ── ② 제조사 — 네 화면 · 저장 · payload ──────────────────────────────────── */

describe("REWORK-11 ② — 제조사는 네 화면과 payload가 같은 값을 본다", () => {
  const resolved = resolution({ brandProfileManufacturer: BRAND_MANUFACTURER });

  it("🔴 세 커머스 탭의 제조사 «칸»에 그 값이 실제로 보인다 — placeholder가 아니다", async () => {
    for (const tab of tabs(resolved)) {
      const left = leftColumn(await mount(tab.element()));
      const label = Array.from(left.querySelectorAll("label")).find(
        (el) => clean(el.textContent ?? "") === "제조사",
      );
      expect(label, `${tab.label}: 제조사 라벨이 없다`).toBeTruthy();
      const row = label!.closest("div")!.parentElement!;
      const input = row.querySelector("input");
      const readOnly = row.querySelector('[data-readonly-field="true"]');
      const shown = input ? input.value : clean(readOnly?.textContent ?? "");
      expect(shown, `${tab.label}: 칸에 보이는 값이 resolver 결과와 다르다`).toBe(BRAND_MANUFACTURER);
      expect(shown, `${tab.label}: «제조사 미확인»이 그대로 보인다`).not.toBe("제조사 미확인");
    }
  });

  it("🔴 안내는 한 줄이다 — «자동 적용됩니다» 문장 하나", async () => {
    const left = leftColumn(await mount(platformElement("coupang", resolved)));
    const notes = Array.from(left.querySelectorAll("p")).filter((p) =>
      (p.textContent ?? "").includes("의 제조사"),
    );
    expect(notes).toHaveLength(1);
    expect(clean(notes[0].textContent ?? "")).toBe(
      `🔵 브랜드 프로필의 제조사 ${BRAND_MANUFACTURER}가 자동 적용됩니다`,
    );
  });

  it("🔴 네 번째 화면(상품정보)이 그 제조사를 «불러오지 못한 항목»으로 세우지 않는다", async () => {
    const product = makeProduct();
    await act(async () => {
      root.render(
        createElement(MissingFieldsBulkPanel, {
          product,
          onBulkApply: () => {},
          manufacturerResolution: resolved,
        } as never),
      );
    });
    const labels = Array.from(container.querySelectorAll("label")).map((el) => clean(el.textContent ?? ""));
    expect(labels, "브랜드 프로필이 채운 제조사를 아직 «못 불러왔다»고 말한다").not.toContain("제조사");

    // 🔴 반대쪽도 참이어야 한다 — 정말 없으면 그대로 목록에 선다.
    await act(async () => {
      root.render(
        createElement(MissingFieldsBulkPanel, {
          product,
          onBulkApply: () => {},
          manufacturerResolution: resolution({}),
        } as never),
      );
    });
    expect(
      Array.from(container.querySelectorAll("label")).map((el) => clean(el.textContent ?? "")),
    ).toContain("제조사");
  });

  it("🔴 화면이 보여준 값이 쿠팡 · 롯데ON payload에 그대로 도착한다", async () => {
    const product = makeProduct();

    /* 🔴 쿠팡 등록 경로는 이번 작업에서 한 줄도 바뀌지 않았다(diff 0). 그래서
       여기서 쿠팡 payload를 다시 조립하지 않는다 — 쿠팡의 제조사 자리는
       카테고리 고시(notices)라 카테고리 메타가 있어야 채워지고, 그 조립을 이
       파일에서 흉내 내면 실제와 다른 경로를 검사하게 된다. 쿠팡 사슬과 이
       resolver가 **글자 그대로 같은 답**을 낸다는 것은 이미
       packages/listing/src/__tests__/manufacturer-resolver.test.ts가 쿠팡
       build-payload를 직접 읽어 고정하고 있다. 이 파일이 맡는 것은 **화면이
       그 resolver의 답을 그대로 보여주는가**다(위 두 검사). */

    const lotteOn = buildLotteOnPayload({
      product,
      channel: {
        ...BLANK_LOTTEON_CHANNEL_CONFIG,
        ...buildLotteOnSalePeriod(new Date("2026-09-15T00:00:00Z")),
        trGrpCd: "SR",
        trNo: "LO10000",
        standardCategoryNo: "BC63080300",
        displayCategories: [{ mallCd: "LTON", lfDcatNo: "FC11130203" }],
        originCode: "ES",
        taxTypeCode: "01",
        noticeItemCode: "23",
      },
      detailHtml: "<p>상세</p>",
      brandProfileManufacturer: BRAND_MANUFACTURER,
    } as never) as { spdLst: { mfcrNm?: string }[] };
    expect(lotteOn.spdLst[0].mfcrNm, "롯데ON payload의 mfcrNm이 화면 값과 다르다").toBe(BRAND_MANUFACTURER);

    // 세 군데가 같은 함수 하나를 본다 — 화면이 쓰는 그 resolver다.
    expect(resolved.value).toBe(BRAND_MANUFACTURER);
  });
});
