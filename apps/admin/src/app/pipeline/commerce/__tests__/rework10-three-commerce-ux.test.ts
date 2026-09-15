// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { resolveManufacturer, type LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { PlatformPreview } from "../PlatformPreview";
import { sectionHeadings } from "../registration-sections";

/**
 * REWORK-10(CEO 지시, 2026-09-15) — **3-Commerce UX 완전 통합.**
 *
 *   채널별 데이터는 달라도 등록 UX 는 동일하다.
 *   공통 데이터는 한 번 관리하고 자동 반영한다.
 *   채널 고유 데이터만 해당 채널에서 관리한다.
 *
 * ── 이 파일이 인정하는 증거 ───────────────────────────────────────────────
 * CEO 명시: "컴포넌트 존재" · "함수 재사용" · "테스트 PASS"는 완료 기준이
 * **아니다.** 그래서 이 파일은 세 탭을 실제로 마운트해서(effect까지 돌려서)
 * DOM을 읽고, 좌측 섹션 목록 · 조작 대상 · 제조사 문장을 **글자로** 비교한다.
 *
 * 🔴 정적 렌더(renderToStaticMarkup)로는 할 수 없다 — ⑥ 배송정책 섹션은
 * (Naver)SellerProfileSummaryCard가 fetch 뒤에야 그리고, 롯데ON 카테고리 추천도
 * 마운트 시 fetch로 돈다(rework5-three-tab-parity.test.ts가 같은 이유로 마운트한다).
 */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
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
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    /** 🔴 원문에 제조사가 없는 상품 — 폴백이 실제로 도는 조건이다. */
    manufacturer: field(""),
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

/** 전 채널 공통 resolver의 결과 — 세 탭에 **같은 객체**를 내려보낸다. */
function resolution(input: Parameters<typeof resolveManufacturer>[0], loading = false) {
  /* REWORK-12 ④ — 조회에 쓴 브랜드 이름. 화면이 «어느 브랜드로 찾았는지»를
     말하는 데만 쓴다(판정에 들어가지 않는다). */
  return { ...resolveManufacturer(input), loading, brand: "Bobo Choses" };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

async function mount(element: ReactElement): Promise<HTMLElement> {
  await act(async () => {
    root.render(element);
  });
  return container;
}

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

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function columnsOf(dom: HTMLElement): { left: HTMLElement; right: HTMLElement } {
  const frame = dom.querySelector('[data-frame="channel-registration"]');
  if (!frame) throw new Error("공용 등록 프레임이 없다 — 세로형 화면이다");
  const [left, right] = Array.from(frame.children) as HTMLElement[];
  return { left, right };
}

/**
 * 좌측 기둥에 선 **블록 제목**을 문서 순서대로.
 *
 * 세 종류를 전부 읽는다 — 그러지 않으면 "아코디언이 아닌 카드"로 서 있는
 * 채널 전용 블록(롯데ON이 갖고 있던 「이 탭에서 정하는 것」 · 「등록을 막고 있는
 * 필수 조건」 · 「⚠ N개 정보가 부족합니다」 · 「등록 상태」)이 검사에서 통째로
 * 새어 나간다. commerce-tab-alignment.test.ts가 쓰는 것과 같은 선택자다.
 */
function sectionTitlesOf(scope: HTMLElement): string[] {
  const nodes = Array.from(
    scope.querySelectorAll(
      [
        "span.text-sm.font-medium.text-text-primary", // CollapsibleSection 머리
        "p.text-sm.font-semibold.text-text-primary", // 접히지 않는 카드
        "h3.text-sm.font-semibold.text-text-primary",
        "p.uppercase.tracking-wide.text-text-tertiary", // 그룹 이름표
      ].join(","),
    ),
  );
  return nodes.map((el) => clean(el.textContent ?? "").split(/[🟢🟠🟡🔴⚪]/)[0].trim());
}

/* ── ① BEFORE / AFTER — 좌측 섹션 목록 ──────────────────────────────────── */

describe("REWORK-10 ① — 세 탭의 좌측 섹션 목록·순서가 글자 그대로 같다", () => {
  it("🔴 세 탭의 목차 배열이 서로 같다 — 정규화 없이", async () => {
    const skeleton = sectionHeadings();
    const dumps: Record<string, string[]> = {};
    for (const tab of tabs(resolution({ brandProfileManufacturer: "Bobo Choses S.L." }))) {
      const { left } = columnsOf(await mount(tab.element()));
      dumps[tab.label] = sectionTitlesOf(left).filter((t) => skeleton.includes(t));
    }
    expect(dumps.SMARTSTORE).toEqual(skeleton);
    expect(dumps.COUPANG).toEqual(skeleton);
    expect(dumps.LOTTEON).toEqual(skeleton);
  });

  it("🔴 좌측에 한 채널만 갖는 블록이 없다 — 골격 밖 제목은 채널 고유 항목뿐이다", async () => {
    const skeleton = sectionHeadings();
    /** 골격 뒤에 붙는 것만 허용된다(CEO 표의 "+ 채널 고유 항목"). */
    /* REWORK-13B — 고유 영역의 섹션 제목은 이제 ⑪부터 번호가 붙는다
       (registration-sections.ts `channelSectionTitle`). */
    const ALLOWED_EXTRA = ["⑪ 롯데ON 고유 코드", "롯데ON 고유 영역"];
    for (const tab of tabs(resolution({ brandProfileManufacturer: "Bobo Choses S.L." }))) {
      const { left } = columnsOf(await mount(tab.element()));
      const extra = sectionTitlesOf(left).filter(
        (t) => !skeleton.includes(t) && !ALLOWED_EXTRA.includes(t),
      );
      expect(extra, `${tab.label}: 골격에 없는 좌측 블록 — ${extra.join(" / ")}`).toEqual([]);
    }
  });

  it("🔴 세 탭 모두 ① 번호 체계를 쓴다 — 한 채널만의 표기가 아니다", async () => {
    for (const tab of tabs(resolution({}))) {
      const { left } = columnsOf(await mount(tab.element()));
      const titles = sectionTitlesOf(left);
      expect(titles.some((t) => /^①/.test(t)), `${tab.label}: ① 번호가 없다`).toBe(true);
      expect(titles.some((t) => /^⑩/.test(t)), `${tab.label}: ⑩ 번호가 없다`).toBe(true);
    }
  });
});

/* ── ② A. 제조사 — 세 채널 같은 resolver 결과 ───────────────────────────── */

describe("REWORK-10 A — 제조사는 세 탭에서 같은 문장을 낸다", () => {
  it("🔴 브랜드 프로필이 채웠으면 세 탭 모두 그 값과 출처를 말한다 (쿠팡 ⚠ 가 사라졌다)", async () => {
    for (const tab of tabs(resolution({ brandProfileManufacturer: "Bobo Choses S.L." }))) {
      const text = clean((await mount(tab.element())).textContent ?? "");
      expect(text, `${tab.label}: 출처를 말하지 않는다`).toContain("브랜드 프로필");
      expect(text, `${tab.label}: 자동 적용된 값이 화면에 없다`).toContain("Bobo Choses S.L.");
      expect(text, `${tab.label}: 값이 있는데 ⚠ 가 남아 있다`).not.toContain("제조사 정보가 없습니다");
    }
  });

  it("판매자 기본정보가 채운 경우도 세 탭이 같은 말을 한다", async () => {
    for (const tab of tabs(resolution({ sellerProfileManufacturer: "따져코리아" }))) {
      const text = clean((await mount(tab.element())).textContent ?? "");
      expect(text, tab.label).toContain("판매자 기본정보의 제조사");
      expect(text, tab.label).toContain("따져코리아");
      expect(text, tab.label).not.toContain("제조사 정보가 없습니다");
    }
  });

  it("🔴 셋 다 없을 때만 ⚠ 가 뜨고, 세 탭이 같은 문장을 쓴다", async () => {
    for (const tab of tabs(resolution({}))) {
      const text = clean((await mount(tab.element())).textContent ?? "");
      /* REWORK-12 ④·⑤(CEO 판정, 2026-09-15) — 같은 두 가지를 계속 요구한다:
         «어디까지 찾아봤는가»와 «다음에 무엇을 하는가». 바뀐 것은 서는 자리다 —
         전자는 ⓘ(여전히 textContent에 있다), 후자는 **화면에 보이는 한 줄**. */
      expect(text, tab.label).toContain("상품 원문 · 브랜드 프로필 · 판매자 기본정보 어디에도 제조사가 없습니다");
      expect(text, tab.label).toContain("브랜드 「Bobo Choses」에 등록된 제조사가 없습니다");
      expect(text, tab.label).toContain("브랜드 프로필에 등록하세요");
    }
  });

  it("🔴 조회가 끝나기 전에는 세 탭 어디에도 «없습니다»가 뜨지 않는다", async () => {
    for (const tab of tabs(resolution({}, true))) {
      const text = clean((await mount(tab.element())).textContent ?? "");
      expect(text, `${tab.label}: 확인 중인데 없다고 단정한다`).not.toContain("제조사 정보가 없습니다");
      expect(text, tab.label).toContain("제조사 출처를 확인하고 있습니다");
    }
  });
});

/* ── ③ B. SmartStore 전용 대기 UI ───────────────────────────────────────── */

describe("REWORK-10 B — SmartStore 전용 대기 UI가 세 탭 어디에도 없다", () => {
  it("🔴 「등록 대상 정보를 확인하고 있습니다」가 0건이다", async () => {
    for (const tab of tabs(resolution({}))) {
      const text = clean((await mount(tab.element())).textContent ?? "");
      expect(text, tab.label).not.toContain("등록 대상 정보를 확인하고 있습니다");
      expect(text, tab.label).not.toContain("대상정보를 확인중입니다");
    }
  });
});

/* ── ④ C. 조작 방식 ──────────────────────────────────────────────────────── */

describe("REWORK-10 C — 세 탭이 같은 조작 대상을 내민다", () => {
  it("🔴 등록 행동은 세 탭 모두 우측 요약의 [등록 시작] 하나다", async () => {
    for (const tab of tabs(resolution({}))) {
      const { left, right } = columnsOf(await mount(tab.element()));
      const registerButtons = (label: HTMLElement) =>
        Array.from(label.querySelectorAll("button")).filter((b) => (b.textContent ?? "").trim() === "등록 시작");
      expect(registerButtons(right).length, `${tab.label}: 우측에 [등록 시작]이 하나가 아니다`).toBe(1);
      expect(registerButtons(left).length, `${tab.label}: 좌측에 등록 행동이 남아 있다`).toBe(0);
    }
  });

  it("🔴 세 탭 모두 ⑩ 등록정보까지 같은 자리에 선다 — 채널 고유 항목은 그 뒤에만", async () => {
    const skeleton = sectionHeadings();
    for (const tab of tabs(resolution({}))) {
      const { left } = columnsOf(await mount(tab.element()));
      const titles = sectionTitlesOf(left);
      const lastSkeleton = titles.lastIndexOf(skeleton[skeleton.length - 1]);
      const extraBefore = titles.slice(0, lastSkeleton).filter((t) => !skeleton.includes(t));
      expect(extraBefore, `${tab.label}: 골격 중간에 채널 블록이 끼어 있다`).toEqual([]);
    }
  });
});
