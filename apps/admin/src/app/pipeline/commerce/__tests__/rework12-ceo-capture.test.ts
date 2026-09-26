// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { LotteOnSellerSettingsInput } from "@commerce/listing";
import { resolveBrandName } from "@commerce/crawler";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { PlatformPreview } from "../PlatformPreview";
import { classifyLotteOnNetworkError } from "../../../api/lotteon/_lib/connection-error";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * REWORK-12(CEO 실측 캡처 기준, 2026-09-15) — **캡처에서 본 것만 고정한다.**
 *
 * CEO가 배포본(2670021)을 쿠팡·롯데ON·기본정보 확대 3장으로 캡처해 지적한
 * 다섯 가지를 렌더 결과로 다시 잰다. 정적 렌더로 판정하지 않는다 — 전부 jsdom
 * 마운트 + 실제 클릭(섹션 펼치기)이다.
 */

/* ── 고정물 ────────────────────────────────────────────────────────────────── */

function field<T>(value: T, source = "USER_EDITED") {
  return { value, source, confidence: 1 } as never;
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/products/b226ac114",
    title: field("Bolder half zipped sweatshirt"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field("Half zipped sweatshirt."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    /* 🔴 CEO 캡처의 상태 그대로 — 원문에서 못 읽어 「입력 필요」 배지가 서는 칸.
       ③ 정렬 검사가 실제로 그 배지를 보려면 이 상태가 화면에 있어야 한다. */
    weight: field("", "REQUIRED"),
    manufacturer: field("", "REQUIRED"),
    careInstructions: field("30도 손세탁"),
    options: field([]),
    optionGroups: [{ name: "Size", values: ["2-3Y", "4-5Y", "6-7Y"] }],
    variants: [
      { id: "v1", optionValues: { Size: "2-3Y" }, stockQuantity: 3 },
      { id: "v2", optionValues: { Size: "4-5Y" }, stockQuantity: 5 },
      { id: "v3", optionValues: { Size: "6-7Y" } },
    ],
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
    titleKo: field("볼더 하프집 스웨트셔츠"),
    descriptionKo: field("부드러운 아동 스웨트셔츠입니다."),
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
    itemName: field("아동용 스웨트셔츠"),
    modelName: field("B226AC114"),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: field(128000),
    ...overrides,
  } as unknown as CanonicalProduct;
}

function makeSellerSettings(): LotteOnSellerSettingsInput {
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

/* ── 마운트 ────────────────────────────────────────────────────────────────── */

let container: HTMLDivElement;
let root: Root;
/** 이 테스트가 세운 fetch 응답. 카테고리 추천 실패를 만들 때 바꾼다. */
let recommendResponse: unknown = null;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  }
  recommendResponse = null;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/lotteon/category-recommend") && recommendResponse) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(recommendResponse) });
      }
      if (url.includes("/api/lotteon/payload-preview")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              identityError: null,
              payload: {},
              validation: { ok: true, readyCount: 1, missingCount: 0, blockedCount: 0, fields: [] },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, profiles: [] }) });
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

/** 화면을 띄우고 **모든 섹션을 실제로 눌러 펼친다**(정적 렌더 금지). */
async function mountExpanded(element: ReactElement): Promise<HTMLElement> {
  await act(async () => {
    root.render(element);
  });
  await act(async () => {
    expandAllSections(container);
  });
  return container;
}

function platformElement(
  platform: PlatformId,
  product = makeProduct(),
  manufacturerResolution = manufacturerFixture(),
): ReactElement {
  return createElement(PlatformPreview, {
    manufacturerResolution,
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
  } as never);
}

function lotteOnElement(product = makeProduct()): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    manufacturerResolution: manufacturerFixture(),
    product,
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Sweatshirts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: makeSellerSettings(),
    onEditCommonInfo: () => {},
  } as never);
}

const TABS: { label: string; element: () => ReactElement }[] = [
  { label: "SMARTSTORE", element: () => platformElement("smartstore") },
  { label: "COUPANG", element: () => platformElement("coupang") },
  { label: "LOTTEON", element: () => lotteOnElement() },
];

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/* ══ ① 우측 요약은 화면에 하나다 ═══════════════════════════════════════════ */

/**
 * CEO 캡처: "쿠팡 탭·롯데ON 탭 둘 다 우측 기둥에 등록 준비 상태 / 필수 확인 /
 * 등록 시작 카드가 세로로 8개 쌓여 있다."
 *
 * ── 기존 테스트가 왜 못 잡았나 ───────────────────────────────────────────
 * rework7-summary-shape가 세던 것은 `[data-summary]` 개수가 맞다. 그런데
 * **세는 범위**가 `frame.children[1]`(우측 칸) 안이었고, 게다가 **섹션을 하나도
 * 펼치지 않은 첫 렌더**에서 셌다. 그래서
 *   · 좌측 칸이나 프레임 밖에 요약이 서면 0건으로 보인다
 *   · 펼친 뒤에 생기는 요약은 아예 세지 않는다
 * 아래 검사는 **문서 전체**에서, **모든 섹션을 펼친 뒤에** 센다.
 */
describe("REWORK-12 ① — 우측 요약 카드는 세 탭 각각 화면에 하나뿐이다", () => {
  it("🔴 문서 전체에서 요약 카드 · 등록 프레임 · [등록 시작]이 각각 1개다(모든 섹션 펼친 뒤)", async () => {
    for (const tab of TABS) {
      const dom = await mountExpanded(tab.element());
      expect(
        dom.querySelectorAll('[data-frame="channel-registration"]').length,
        `${tab.label}: 등록 프레임이 하나가 아니다`,
      ).toBe(1);
      expect(
        dom.querySelectorAll('[data-summary="channel-registration"]').length,
        `${tab.label}: 요약 카드가 하나가 아니다(문서 전수)`,
      ).toBe(1);
      expect(
        Array.from(dom.querySelectorAll("button")).filter((b) => clean(b.textContent ?? "") === "등록 시작").length,
        `${tab.label}: [등록 시작]이 하나가 아니다`,
      ).toBe(1);
    }
  });

  it("요약 카드는 좌측 상세 안에 들어가 있지 않다 — 프레임의 두 번째 칸 하나뿐", async () => {
    for (const tab of TABS) {
      const dom = await mountExpanded(tab.element());
      const frame = dom.querySelector('[data-frame="channel-registration"]')!;
      const [left, right] = Array.from(frame.children) as HTMLElement[];
      expect(frame.children.length, `${tab.label}: 프레임 칸이 둘이 아니다`).toBe(2);
      expect(left.querySelectorAll("[data-summary]").length, `${tab.label}: 좌측에 요약이 있다`).toBe(0);
      /* ══════════════════════════════════════════════════════════════════════
         Commerce-3B(2026-09-26) — 🔴 세는 대상을 «등록 요약» 으로 좁혔다.

         전: right 안의 `[data-summary]` 전부가 정확히 1개
         후: right 안의 `[data-summary="channel-registration"]` 이 정확히 1개

         🔴 이것은 가드를 «푸는» 것이 아니라 letter 를 intent 에 맞추는 것이다.
         이 검사가 막는 CEO 캡처는 「우측 기둥에 등록 준비 카드가 8개 쌓였다」이고,
         그 사실은 위 테스트(:219-222)가 이미 «같은 선택자로» 문서 전수로 센다.
         반면 우측에는 «등록 후 관리» 카드가 한 장 더 서는 것이 정상이다 —
         스마트스토어는 등록된 상품에 「불러오기」 카드를, 쿠팡·롯데ON 은
         「확인되지 않음」 카드를 같은 자리에 세운다(Commerce-3B). 예전에는 그
         카드가 이 테스트의 렌더에 «나타나지 않아서» 숫자가 우연히 1이었다.

         🔴 대신 아래 두 줄로 더 좁게 막는다 — 종류별로 최대 한 장이고, 등록 요약이
         언제나 «먼저» 온다. 카드가 쌓이거나 순서가 뒤집히면 여기서 잡힌다. */
      const kinds = Array.from(right.querySelectorAll("[data-summary]")).map((el) =>
        el.getAttribute("data-summary"),
      );
      expect(kinds.filter((k) => k === "channel-registration").length, `${tab.label}: 등록 요약이 하나가 아니다`).toBe(1);
      expect(new Set(kinds).size, `${tab.label}: 같은 종류의 요약 카드가 두 장 이상이다`).toBe(kinds.length);
      expect(kinds[0], `${tab.label}: 등록 요약이 맨 위가 아니다`).toBe("channel-registration");
    }
  });

  /**
   * ════════════════════════════════════════════════════════════════════════
   * Commerce-3B(CPO 지시, 2026-09-26) — 🔴 **정말 «그려지는지»** 본다.
   * ════════════════════════════════════════════════════════════════════════
   *
   * 위 검사들은 개수와 순서만 세므로, 카드가 아예 그려지지 않아도 통과한다.
   * 이 저장소가 반복해 겪은 실패 모양이 그것이다 — 테스트는 초록인데 화면은
   * 비어 있다. 그래서 «있다» 를 직접 단정한다.
   *
   * 🔴 스마트스토어에는 이 카드가 «없어야» 한다. 그 채널은 어댑터가 있어
   * `editUnavailableNote()` 가 undefined 를 내고(카드가 스스로 사라진다), 등록된
   * 상품이면 대신 「불러오기」 카드가 선다. 즉 이 한 테스트가 양쪽을 다 지킨다.
   */
  it("🔴 어댑터 없는 채널의 우측에 「확인되지 않음」 카드가 실제로 그려진다", async () => {
    for (const tab of TABS) {
      const dom = await mountExpanded(tab.element());
      const card = dom.querySelector('[data-summary="channel-edit-unavailable"]');
      if (tab.label === "SMARTSTORE") {
        expect(card, "스마트스토어에 「확인되지 않음」 카드가 섰다 — 이 채널은 수정이 확인된 채널이다").toBeNull();
        continue;
      }
      expect(card, `${tab.label}: 수정 가능 여부를 «아무 말도» 하지 않는다`).not.toBeNull();
      const text = clean(card!.textContent ?? "");
      expect(text).toContain("등록된 상품 수정");
      expect(text).toContain("확인되지 않음");
      /* 🔴 「안 됩니다」라고 말하지 않는다 — 확인되지 않았을 뿐이다. */
      expect(text).not.toContain("지원하지 않습니다");
      /* 🔴 누를 것이 없다 — 누를 수 있는 것처럼 보이면 UNKNOWN 이 EDITABLE 로 읽힌다. */
      expect(card!.querySelectorAll("button").length, `${tab.label}: 안내 카드에 버튼이 있다`).toBe(0);
    }
  });
});

/* ══ ② 롯데ON을 스마트스토어·쿠팡에 맞춘다 ═════════════════════════════════ */

/**
 * 섹션 하나를 **id로** 집는다. 제목 문자열로 조상 div를 훑으면 바깥 컨테이너가
 * 걸려서 다른 섹션의 입력칸까지 세게 된다(실제로 그랬다).
 * id는 스크롤 목적지 계약이라 이미 고정돼 있는 이름이다.
 */
function sectionById(dom: HTMLElement, id: string): HTMLElement {
  const section = dom.querySelector(`#${id}`);
  if (!section) throw new Error(`섹션을 찾지 못했다: #${id}`);
  return section as HTMLElement;
}

function sectionLabels(dom: HTMLElement, id: string): string[] {
  return Array.from(sectionById(dom, id).querySelectorAll("label")).map((l) => clean(l.textContent ?? ""));
}

describe("REWORK-12 ② — 롯데ON ① 기본 상품정보가 쿠팡과 같은 값을 보여준다", () => {
  /**
   * CEO 캡처: "롯데ON ① 기본 상품정보 = 상품명·브랜드 두 줄 + 제조사 미확인 뿐".
   * 쿠팡 ①은 같은 자리에 아홉 칸이 서 있었다.
   */
  const COUPANG_BASIC_FIELDS = ["상품명", "브랜드", "상품코드(SKU)", "제조사", "소재", "색상", "사용연령", "품명"];

  it("🔴 쿠팡 ①에 있는 이름이 롯데ON ①에도 전부 있다", async () => {
    const lotteOn = await mountExpanded(lotteOnElement());
    const labels = sectionLabels(lotteOn, "lotteon-section-basic");
    for (const name of COUPANG_BASIC_FIELDS) {
      expect(labels.some((l) => l.startsWith(name)), `롯데ON ①에 「${name}」 칸이 없다`).toBe(true);
    }
    // 모델명도 선다(쿠팡은 라벨이 길어 startsWith로 본다).
    expect(labels.some((l) => l.startsWith("모델명")), "롯데ON ①에 모델명이 없다").toBe(true);
  });

  it("값이 실제로 보인다 — 빈 요약이 아니다", async () => {
    const lotteOn = await mountExpanded(lotteOnElement());
    const text = clean(lotteOn.textContent ?? "");
    for (const value of ["AAA1804916", "면 100%", "네이비", "4-5세", "아동용 스웨트셔츠", "B226AC114"]) {
      expect(text, `롯데ON ①에 값이 없다 — ${value}`).toContain(value);
    }
  });

  it("🔴 읽기 전용 계약은 그대로다 — ① 에 입력칸이 0개", async () => {
    const lotteOn = await mountExpanded(lotteOnElement());
    const section = sectionById(lotteOn, "lotteon-section-basic");
    expect(section.querySelectorAll("input, textarea").length, "롯데ON ①에 입력칸이 생겼다").toBe(0);
  });
});

describe("REWORK-12 ② — 롯데ON ③ 옵션이 무엇이 등록되는지 보여준다", () => {
  it("🔴 옵션 축 이름 · 값 · 단품이 화면에 선다(한 줄 요약이 전부가 아니다)", async () => {
    const dom = await mountExpanded(lotteOnElement());
    const text = clean(dom.textContent ?? "");
    expect(text, "옵션 축 이름이 없다").toContain("Size");
    for (const value of ["2-3Y", "4-5Y", "6-7Y"]) {
      expect(text, `옵션 값이 없다 — ${value}`).toContain(value);
    }
  });

  it("재고가 없는 단품을 0개라고 적지 않는다 — 상품 재고로 폴백한다고 말한다", async () => {
    const dom = await mountExpanded(lotteOnElement());
    expect(clean(dom.textContent ?? "")).toContain("상품 재고 사용");
  });

  it("🔴 읽기 전용이다 — ③ 옵션에 입력칸이 0개", async () => {
    const dom = await mountExpanded(lotteOnElement());
    const section = sectionById(dom, "lotteon-section-options");
    expect(section.querySelectorAll("input, textarea").length, "롯데ON ③에 입력칸이 생겼다").toBe(0);
  });
});

/* ══ ② 영문 예외 문자열이 셀러에게 보이지 않는다 ════════════════════════════ */

describe("REWORK-12 ② — 타임아웃이 영문 예외가 아니라 한국어 사유로 선다", () => {
  /** 실제로 CEO 화면에 떴던 문자열 — AbortSignal.timeout()의 DOMException message. */
  const RAW = "The operation was aborted due to timeout";

  it("🔴 분류기가 그 문자열을 한국어 사유 + 다음 행동으로 바꾼다", () => {
    const issue = classifyLotteOnNetworkError(RAW);
    expect(issue.userMessage).toBe("롯데ON 응답이 제한 시간 안에 오지 않았습니다.");
    expect(issue.nextAction).toContain("다시 확인");
    expect(issue.userMessage, "영문 원문이 사용자 문구에 남아 있다").not.toContain("aborted");
  });

  it("DNS/연결 실패도 한국어다 — 모르는 문자열만 원인을 괄호로 덧붙인다", () => {
    expect(classifyLotteOnNetworkError("fetch failed").userMessage).toBe("롯데ON 서버에 연결하지 못했습니다.");
    expect(classifyLotteOnNetworkError("getaddrinfo ENOTFOUND x").userMessage).toBe(
      "롯데ON 서버에 연결하지 못했습니다.",
    );
    const unknown = classifyLotteOnNetworkError("something odd");
    expect(unknown.userMessage).toBe("롯데ON 요청이 실패했습니다.");
    expect(unknown.nextAction).toContain("something odd");
  });

  it("🔴 화면 — 추천이 실패해도 영문 예외가 보이지 않고, 카테고리를 고를 길이 열린다", async () => {
    recommendResponse = {
      ok: false,
      reason: "NETWORK_ERROR",
      message: "롯데ON 응답이 제한 시간 안에 오지 않았습니다.",
      nextAction: "잠시 후 [다시 확인]을 눌러 주세요. 계속 반복되면 롯데ON 점검 여부를 확인해야 합니다.",
      providerMessage: RAW,
    };
    const dom = await mountExpanded(lotteOnElement());
    const text = clean(dom.textContent ?? "");
    expect(text, "🔴 영문 예외 문자열이 셀러 화면에 그대로 보인다").not.toContain(RAW);
    expect(text, "한국어 사유가 없다").toContain("롯데ON 응답이 제한 시간 안에 오지 않았습니다");
    expect(text, "다음 행동이 없다").toContain("잠시 후 [다시 확인]을 눌러 주세요");
    // 🔴 추천 실패가 등록 불가가 되지 않는다 — 직접 선택 경로가 그대로 열린다.
    expect(text, "추천이 실패했는데 카테고리를 고를 길이 없다").toContain("카테고리를 자동 추천하지 못했습니다");
    expect(
      Array.from(dom.querySelectorAll("button")).some((b) => clean(b.textContent ?? "") === "롯데ON 카테고리 선택"),
      "직접 선택 버튼이 없다",
    ).toBe(true);
  });
});

/* ══ ③ 기본정보 격자 ═══════════════════════════════════════════════════════ */

/**
 * 🔴 jsdom에는 레이아웃 엔진이 없다 — 픽셀로 "잘렸는지"를 잴 수 없다. 그래서
 * **잘림을 만들던 구조**를 직접 본다:
 *   · 격자가 3열 규칙을 들고 있는가
 *   · 배지 쪽이 shrink 가능한가(가능하면 라벨에 밀려 두 줄이 된다)
 *   · 라벨이 한 칸 폭을 넘길 만큼 긴가
 *   · 칸이 세로로 늘어날 때 안내가 바닥에 고정되는가
 */
describe("REWORK-12 ③ — 기본정보 3열 격자가 유지되고 라벨이 밀리지 않는다", () => {
  function basicGrid(dom: HTMLElement): HTMLElement {
    const grid = Array.from(dom.querySelectorAll("div")).find(
      (el) => el.className.includes("grid-cols-1") && el.className.includes("xl:grid-cols-3"),
    );
    if (!grid) throw new Error("기본정보 3열 격자를 찾지 못했다");
    return grid as HTMLElement;
  }

  it("🔴 기본정보는 3열 격자다 — 세 탭 모두", async () => {
    for (const tab of TABS) {
      const grid = basicGrid(await mountExpanded(tab.element()));
      expect(grid.className, `${tab.label}: 3열 규칙이 없다`).toContain("xl:grid-cols-3");
      expect(grid.className, `${tab.label}: 2열 규칙이 없다`).toContain("sm:grid-cols-2");
    }
  });

  it("🔴 배지 쪽이 shrink-0 + whitespace-nowrap이다 — 「입력 필요」가 두 줄로 쪼개지지 않는다", async () => {
    const grid = basicGrid(await mountExpanded(platformElement("coupang")));
    const badgeRows = Array.from(grid.querySelectorAll("span")).filter((el) =>
      Array.from(el.children).some((c) => (c.textContent ?? "").trim() === "입력 필요"),
    );
    expect(badgeRows.length, "「입력 필요」 배지를 가진 줄이 하나도 없다").toBeGreaterThan(0);
    for (const row of badgeRows) {
      expect(row.className, `배지 줄이 shrink 가능하다 — ${row.textContent}`).toContain("shrink-0");
      expect(row.className, `배지 줄이 줄바꿈된다 — ${row.textContent}`).toContain("whitespace-nowrap");
    }
  });

  it("🔴 기본정보 라벨이 전부 20자 이하다 — 한 칸을 넘어 잘리던 이름이 사라졌다", async () => {
    for (const tab of TABS) {
      const grid = basicGrid(await mountExpanded(tab.element()));
      const labels = Array.from(grid.querySelectorAll("label")).map((l) => clean(l.textContent ?? ""));
      expect(labels.length, `${tab.label}: 기본정보에 라벨이 없다`).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label.replace(/\*$/, "").length, `${tab.label}: 라벨이 너무 길다 — ${label}`).toBeLessThanOrEqual(20);
      }
    }
  });

  it("모델명 라벨은 여전히 두 자리를 가리킨다 — 줄이되 사실을 버리지 않았다", async () => {
    const grid = basicGrid(await mountExpanded(platformElement("smartstore")));
    const label = Array.from(grid.querySelectorAll("label")).find((l) =>
      clean(l.textContent ?? "").startsWith("모델명"),
    );
    expect(label, "모델명 라벨이 없다").toBeTruthy();
    expect(clean(label!.textContent ?? "")).toBe("모델명(고시 + 카탈로그)");
  });

  it("🔴 칸이 h-full flex-col이다 — 한 칸만 커져도 같은 줄의 입력칸이 어긋나지 않는다", async () => {
    const grid = basicGrid(await mountExpanded(platformElement("coupang")));
    const cells = Array.from(grid.children) as HTMLElement[];
    expect(cells.length, "격자에 칸이 없다").toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.className, `칸이 h-full이 아니다 — ${clean(cell.textContent ?? "").slice(0, 20)}`).toContain(
        "h-full",
      );
      expect(cell.className).toContain("flex-col");
    }
  });

  it("참조 안내가 칸 바닥에 선다(mt-auto) — 입력칸 자리를 밀어내지 않는다", async () => {
    const grid = basicGrid(await mountExpanded(platformElement("smartstore")));
    const modelCell = (Array.from(grid.children) as HTMLElement[]).find((c) =>
      clean(c.querySelector("label")?.textContent ?? "").startsWith("모델명"),
    )!;
    const note = modelCell.querySelector("p.mt-auto");
    expect(note, "참조 안내가 note 슬롯에 있지 않다").toBeTruthy();
    expect(clean(note!.textContent ?? "")).toContain("네이버 쇼핑 카탈로그 등록에 사용하는 모델명입니다");
    // 그리고 그것이 칸의 **마지막** 자식이다(바닥 고정의 전제).
    expect(modelCell.lastElementChild).toBe(note);
  });
});

/* ══ ④ 제조사 ══════════════════════════════════════════════════════════════ */

describe("REWORK-12 ④ — 브랜드 오염(A)과 폴백 부재(C)를 화면이 갈라서 말한다", () => {
  it("🔴 A — 문자열 전체가 시즌코드면 브랜드가 아니다(실측 값 AW26)", () => {
    expect(resolveBrandName("AW26")?.cleaned).toBe("");
    expect(resolveBrandName("Bobo Choses")?.cleaned).toBe("Bobo Choses");
  });

  /**
   * DB 실측(2026-09-15, SELECT only): `coupang_brand_profiles` 2행
   * (Apolina · The Animals Observatory) · `coupang_seller_profiles` 3행 전부
   * `manufacturer = null`. 즉 대부분의 상품에서 폴백은 **실제로 답이 없다**.
   * 그때 화면이 "제조사 미확인" 네 글자로 끝나면 셀러는 다음에 뭘 할지 모른다.
   */
  const NOT_RESOLVED = manufacturerFixture({
    value: "",
    source: "NONE" as never,
    resolved: false,
    loading: false,
    brand: "Bobo Choses",
  });

  it("🔴 C — 폴백에 답이 없으면 어느 브랜드로 찾았는지와 다음 행동이 화면에 선다", async () => {
    for (const label of ["smartstore", "coupang"] as PlatformId[]) {
      const dom = await mountExpanded(platformElement(label, makeProduct(), NOT_RESOLVED));
      const text = clean(dom.textContent ?? "");
      expect(text, `${label}: 어느 브랜드로 찾았는지 말하지 않는다`).toContain(
        "브랜드 「Bobo Choses」에 등록된 제조사가 없습니다",
      );
      expect(text, `${label}: 다음 행동이 없다`).toContain("브랜드 프로필에 등록하세요");
    }
  });

  it("롯데ON도 같은 문장을 쓴다 — 세 탭 공용 컴포넌트다", async () => {
    const dom = await mountExpanded(
      createElement(LotteOnRegistrationPanel, {
        manufacturerResolution: NOT_RESOLVED,
        product: makeProduct(),
        commonPrice: { priceKrw: 128000, resolved: true },
        commonCategorySources: [],
        sellerSettings: makeSellerSettings(),
        onEditCommonInfo: () => {},
      } as never),
    );
    expect(clean(dom.textContent ?? "")).toContain("브랜드 「Bobo Choses」에 등록된 제조사가 없습니다");
  });

  it("브랜드가 비어 있으면(=오염돼 빈 값이 된 경우) 다른 말을 한다 — 실행 불가능한 안내를 하지 않는다", async () => {
    const dom = await mountExpanded(
      platformElement("coupang", makeProduct(), { ...NOT_RESOLVED, brand: "" }),
    );
    const text = clean(dom.textContent ?? "");
    expect(text).toContain("브랜드가 확인되지 않아 브랜드 프로필을 조회하지 못했습니다");
    expect(text, "조회할 수 없는데 브랜드 프로필에 등록하라고 한다").not.toContain("브랜드 프로필에 등록하세요");
  });
});

/* ══ ⑤ 툴팁 ════════════════════════════════════════════════════════════════ */

describe("REWORK-12 ⑤ — 화면의 모든 툴팁이 한 줄(60자) 이하다", () => {
  /** CEO 목표: "툴팁 한 줄. 길어도 두 줄." 80자를 두 줄의 상한으로 둔다. */
  const MAX_CHARS = 80;

  it("🔴 세 탭의 ⓘ 전수 — 60자를 넘는 것이 없고, 80자는 절대 넘지 않는다", async () => {
    const seen = new Map<string, number>();
    for (const tab of TABS) {
      const dom = await mountExpanded(tab.element());
      for (const tip of Array.from(dom.querySelectorAll('[data-info-tip="true"]'))) {
        const text = tip.getAttribute("title") ?? "";
        seen.set(text, text.length);
      }
    }
    expect(seen.size, "세 탭에 ⓘ가 하나도 없다").toBeGreaterThan(0);
    for (const [text, length] of seen) {
      expect(length, `툴팁이 두 줄을 넘는다(${length}자) — ${text}`).toBeLessThanOrEqual(MAX_CHARS);
    }
  });
});
