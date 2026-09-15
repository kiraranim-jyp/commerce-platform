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
import {
  FIELD_GRID_CLASS,
  FIELD_GRID_NARROW_CLASS,
  SECTION_NOTE_CLASS,
  SECTION_STACK_CLASS,
} from "../registration-sections";
import { expandAllSections } from "./mount-registration-tab";

/**
 * REWORK-13B(CEO 실측 판정, 2026-09-15: **FAIL** — "롯데ON만 UI가 아직 다르다")
 *
 * ── 왜 또 만드나 ─────────────────────────────────────────────────────────
 * CEO 원문: "🔴 이전의 class / DOM parity 테스트를 PASS 근거로 쓰지 마라. 그
 * 테스트들이 통과하는데도 화면이 달랐다. **그 테스트가 재는 것이 잘못 골라진
 * 것이다.**"
 *
 * 맞는 지적이다. rework11-design-parity는 **카드 · 머리 버튼 · 입력칸**의
 * className을 셌고 그 셋은 진짜로 같았다. 그런데 화면은 달랐다 — 다른 것은
 * 그 셋이 아니라 **그 셋 사이를 채우는 값**이었기 때문이다. 세 탭을 jsdom에
 * 올려 모든 섹션을 실제로 클릭해 펼치고 골격을 뽑아보니(수정 전):
 *
 *   ┌ 재는 것 ─────────────┬ 쿠팡 ─────────────┬ 롯데ON ────────────────┐
 *   │ 카드 사이 간격        │ space-y-3         │ space-y-4  (카드 11개) │
 *   │ 머리에 summary가 선 곳│ ①②③ 세 곳         │ 11/11 (정책 설명 2~3줄)│
 *   │ 본문 첫 요소          │ 파란 안내 문단     │ 우측정렬 버튼 행 6곳    │
 *   │ 필드 격자 클래스 종류  │ 2종 (3열 · 2열)   │ 3종 (3열 · 2열 · 1열)  │
 *   │ 공통 밖 섹션의 번호    │ —                 │ 없음("그 밖의 …")      │
 *   └──────────────────────┴───────────────────┴────────────────────────┘
 *
 * 다섯 곳이다. 이 파일이 재는 것은 **그 다섯 곳**이고, 전부 "쿠팡이 그리는 값과
 * 글자 그대로 같은가"로 묻는다. 클래스가 같은지를 다시 세지 않는다(그건 이미
 * rework11이 한다) — 같은 클래스를 **몇 곳에 어떤 간격으로** 쓰는가를 센다.
 *
 * 🔴 기준은 언제나 쿠팡이다. 롯데ON이 쿠팡 쪽으로 온다 — 반대가 아니다.
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

function resolution() {
  return { ...resolveManufacturer({ brandProfileManufacturer: "Bobo Choses S.L." }), loading: false };
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

function lotteOnElement(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: sellerSettings(),
    onEditCommonInfo: () => {},
    manufacturerResolution: resolution(),
  } as never);
}

function platformElement(platform: PlatformId): ReactElement {
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
    manufacturerResolution: resolution(),
  } as never);
}

const TABS = [
  { label: "SMARTSTORE", element: () => platformElement("smartstore") },
  { label: "COUPANG", element: () => platformElement("coupang") },
  { label: "LOTTEON", element: () => lotteOnElement() },
];

async function mount(element: ReactElement, expand = true): Promise<HTMLElement> {
  await act(async () => {
    root.render(element);
  });
  if (expand) await act(async () => void expandAllSections(container));
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

/** 좌측 상세의 **최상위** 섹션 카드들(중첩 아코디언은 세지 않는다). */
function topSections(left: HTMLElement): HTMLElement[] {
  return Array.from(left.querySelectorAll<HTMLElement>("section[id]")).filter(
    (section) => !section.parentElement?.closest("section[id]"),
  );
}

function sectionHead(section: HTMLElement): HTMLElement {
  return section.querySelector<HTMLElement>(":scope > button")!;
}

/** 머리 제목의 동그라미 번호(①~⑫). 없으면 빈 문자열. */
function sectionMark(section: HTMLElement): string {
  return (clean(sectionHead(section).textContent ?? "").match(/^[①-⑮]/) ?? [""])[0];
}

/** 펼쳐진 섹션의 본문(CollapsibleSection이 그리는 `div.space-y-3.border-t…`). */
function sectionBody(section: HTMLElement): HTMLElement | null {
  return section.querySelector<HTMLElement>(":scope > div");
}

/* ── ① 카드 사이 간격 ────────────────────────────────────────────────────── */

describe("REWORK-13B ① — 카드 사이 간격이 세 탭에서 같다", () => {
  it("🔴 섹션 카드를 쌓는 기둥이 세 탭 모두 SECTION_STACK_CLASS다", async () => {
    /* BEFORE: 롯데ON만 `space-y-4`였다. 카드 열한 개면 마지막 카드가 쿠팡보다
       44px 아래에 선다 — 같은 상품으로 탭을 옮기면 바로 보이는 차이다. */
    for (const tab of TABS) {
      const left = leftColumn(await mount(tab.element()));
      const stacks = new Set(topSections(left).map((section) => section.parentElement?.className ?? ""));
      expect(stacks.size, `${tab.label}: 카드가 여러 기둥에 흩어져 있다`).toBe(1);
      expect([...stacks][0], `${tab.label}: 카드 기둥의 간격이 쿠팡과 다르다`).toBe(SECTION_STACK_CLASS);
    }
  });
});

/* ── ② 머리의 한 줄 상태 ─────────────────────────────────────────────────── */

describe("REWORK-13B ② — 섹션 머리가 쿠팡과 같은 줄 수로 선다", () => {
  /** 머리에 summary 한 줄이 선 섹션의 번호 목록. */
  async function summaryMarks(element: ReactElement): Promise<string[]> {
    const left = leftColumn(await mount(element));
    return topSections(left)
      .filter((section) => sectionHead(section).children.length > 1)
      .map(sectionMark);
  }

  it("🔴 머리에 한 줄 상태가 서는 섹션이 쿠팡과 롯데ON에서 같다", async () => {
    /* BEFORE: 쿠팡 ①②③ 세 곳 / 롯데ON 11곳 전부. 롯데ON은 그 자리에 **정책
       설명**(두세 줄)을 넣고 있어서 머리 높이부터 달랐다. AFTER: 설명은 본문의
       안내 문단으로 내려가고, 이 자리에는 쿠팡과 같은 성격의 한 줄만 남는다. */
    const coupang = await summaryMarks(platformElement("coupang"));
    const lotteOn = await summaryMarks(lotteOnElement());
    expect(coupang).toEqual(["①", "②", "③"]);
    expect(lotteOn, "머리에 한 줄이 서는 자리가 쿠팡과 다르다").toEqual(coupang);
  });

  it("🔴 롯데ON 머리에 두 줄짜리 정책 설명이 하나도 없다", async () => {
    const left = leftColumn(await mount(lotteOnElement(), false));
    const long = topSections(left)
      .map((section) => clean(sectionHead(section).textContent ?? ""))
      .filter((text) => text.length > 60);
    expect(long, `머리가 긴 섹션 — ${long.join(" / ")}`).toEqual([]);
  });
});

/* ── ③ 본문 첫 요소 ──────────────────────────────────────────────────────── */

describe("REWORK-13B ③ — 본문 첫 줄이 쿠팡과 같은 안내 문단이다", () => {
  it("🔴 롯데ON에 «우측정렬 버튼 행»이 0건이다", async () => {
    /* BEFORE: `div.mb-3 flex flex-wrap items-center justify-end gap-2`가 여섯
       섹션의 본문 첫 줄에 서 있었다(상품정보에서 수정 · 다시 확인 · 설정하러
       가기). 쿠팡·스마트스토어에는 그런 행이 한 곳도 없다.
       AFTER: 버튼은 사라지지 않고 안내 문단 **안**으로 들어갔다. */
    const left = leftColumn(await mount(lotteOnElement()));
    const rows = Array.from(left.querySelectorAll("div")).filter((el) =>
      el.className.includes("justify-end") && el.className.includes("mb-3"),
    );
    expect(rows.map((el) => el.className)).toEqual([]);
  });

  it("🔴 롯데ON 본문의 안내 문단은 쿠팡이 쓰는 그 클래스 하나뿐이다", async () => {
    const left = leftColumn(await mount(lotteOnElement()));
    const bodies = topSections(left).map(sectionBody).filter((body): body is HTMLElement => body != null);
    expect(bodies.length, "펼쳐진 섹션이 없다").toBeGreaterThan(5);
    for (const body of bodies) {
      const first = body.children[0];
      expect(first, "본문이 비었다").toBeTruthy();
      expect(
        first.tagName.toLowerCase() === "p" && first.className === SECTION_NOTE_CLASS,
        `본문 첫 요소가 공용 안내 문단이 아니다 — ${first.tagName.toLowerCase()}.${first.className}`,
      ).toBe(true);
    }
  });

  it("🔴 그 클래스는 쿠팡이 이미 쓰던 값이다 — 롯데ON용으로 새로 만든 것이 아니다", async () => {
    const left = leftColumn(await mount(platformElement("coupang")));
    const notes = Array.from(left.querySelectorAll("p")).filter((p) => p.className === SECTION_NOTE_CLASS);
    expect(notes.length, "쿠팡에 이 안내 문단이 없다").toBeGreaterThan(0);
  });
});

/* ── ④ 필드 격자 ─────────────────────────────────────────────────────────── */

describe("REWORK-13B ④ — 입력 격자가 쿠팡과 같은 두 종류뿐이다", () => {
  /** 섹션 본문에서 입력 행(FieldRow)을 직접 담고 있는 격자의 클래스 집합. */
  function gridClasses(left: HTMLElement): string[] {
    const grids = new Set<string>();
    for (const row of Array.from(left.querySelectorAll("label"))) {
      const cell = row.closest("div")?.parentElement;
      const grid = cell?.parentElement;
      if (grid && grid.className.startsWith("grid")) grids.add(grid.className);
    }
    return [...grids].sort();
  }

  it("🔴 롯데ON의 격자 클래스가 쿠팡의 두 값 안에 전부 들어 있다", async () => {
    /* BEFORE: 롯데ON은 `grid gap-3 sm:grid-cols-2`(⑤⑪)와 `grid gap-3`(⑦⑧)이라는
       **제 값 두 개**를 더 갖고 있었다 — 같은 성격의 입력 줄이 섹션마다 다른
       폭·다른 여백으로 서 있었다. */
    const allowed = [FIELD_GRID_CLASS, FIELD_GRID_NARROW_CLASS].sort();
    for (const tab of TABS) {
      const left = leftColumn(await mount(tab.element()));
      const used = gridClasses(left);
      const foreign = used.filter((cls) => !allowed.includes(cls));
      expect(foreign, `${tab.label}: 공용이 아닌 격자 — ${foreign.join(" / ")}`).toEqual([]);
    }
  });
});

/* ── ⑤ 공통 ①~⑩ 뒤의 롯데ON 고유 영역 ──────────────────────────────────── */

describe("REWORK-13B ⑤ — 고유 영역은 ⑩ 뒤에, ⑪부터 번호를 받는다", () => {
  it("🔴 롯데ON 섹션 번호가 ①~⑩ 다음 ⑪로 이어진다 — 번호 없는 섹션이 없다", async () => {
    const left = leftColumn(await mount(lotteOnElement(), false));
    const marks = topSections(left).map(sectionMark);
    expect(marks).toEqual(["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪"]);
  });

  it("🔴 ⑪ 이후는 «롯데ON이라서 만든 다른 카드»가 아니다 — 같은 카드·같은 머리다", async () => {
    const left = leftColumn(await mount(lotteOnElement(), false));
    const sections = topSections(left);
    const common = sections.slice(0, 10);
    const channelOwn = sections.slice(10);
    expect(channelOwn.length, "고유 섹션이 없다").toBeGreaterThan(0);
    const cardClass = new Set(common.map((s) => s.className));
    const headClass = new Set(common.map((s) => sectionHead(s).className));
    expect(cardClass.size).toBe(1);
    for (const section of channelOwn) {
      expect(section.className, "고유 섹션이 다른 카드다").toBe([...cardClass][0]);
      expect(sectionHead(section).className, "고유 섹션이 다른 머리다").toBe([...headClass][0]);
    }
  });
});

/* ── ⑥ 첫 렌더 펼침 상태 ─────────────────────────────────────────────────── */

describe("REWORK-13B ⑥ — 첫 화면의 펼침 상태 표", () => {
  it("🔴 세 탭 모두 ① 하나만 펼치고 나머지는 전부 접혀 있다", async () => {
    for (const tab of TABS) {
      const left = leftColumn(await mount(tab.element(), false));
      const sections = topSections(left);
      const open = sections.filter((s) => (sectionHead(s).textContent ?? "").includes("접기 ▲"));
      const shut = sections.filter((s) => (sectionHead(s).textContent ?? "").includes("펼치기 ▼"));
      expect(sections.length, `${tab.label}: 섹션이 없다`).toBeGreaterThan(5);
      expect(open.length + shut.length, `${tab.label}: 여닫을 수 없는 섹션이 있다`).toBe(sections.length);
      expect(open.map(sectionMark), `${tab.label}: 처음 열려 있는 섹션이 ① 하나가 아니다`).toEqual(["①"]);
    }
  });
});
