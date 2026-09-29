// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { editSupportedScope, editUnavailableNote } from "../edit-adapters";
import { LOTTEON_COMMERCE_ID } from "../commerce-registry";

/**
 * REWORK-5 ④·⑥(CEO 지시, 2026-09-14) — **세 탭을 나란히 놓고 본다.**
 *
 * 지시서가 인정하는 완료 증명은 두 가지뿐이다:
 *   ⑥ 세 탭을 나란히 놓은 렌더 비교 — "같은 등록 화면으로 보이는가"
 *   ④ 롯데ON의 공통 상품정보 · 셀러 설정이 **렌더로 값이 채워지는가**
 *
 * ── 왜 이 파일이 따로 필요한가 ────────────────────────────────────────────
 * "컴포넌트를 재사용했다"는 완료 기준이 아니다(지시서 명시). 그래서 여기서는
 * 세 탭을 **실제로 세 번 그려서** 좌/우 기둥과 섹션 목차를 뽑아 비교하고,
 * 롯데ON 탭에는 진짜 값이 들어간 셀러 설정을 넣어 그 값이 화면 글자로
 * 나오는지를 본다. 판정 문장이 아니라 렌더 결과만 읽는다.
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
    manufacturer: field("보보쇼즈"),
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

/** 값이 **전부 들어 있는** 셀러 설정. ④의 "렌더로 값이 채워지는가"의 입력이다. */
function makeSellerSettings(
  overrides: Partial<LotteOnSellerSettingsInput> = {},
): LotteOnSellerSettingsInput {
  return {
    outboundLeadTimeDays: 2,
    deliveryCompanyCode: "CJGLS",
    naverDeliveryCompanyCode: "CJ대한통운",
    outboundShippingPlaceCode: 7788,
    returnCenterCode: "RC-1004",
    topCommonImageEnabled: true,
    bottomCommonImageEnabled: false,
    ...overrides,
  };
}

/* ── 마운트 ────────────────────────────────────────────────────────────────
 *
 * 🔴 정적 렌더(renderToStaticMarkup)로는 이 비교를 할 수 없다는 것을 실측으로
 * 확인했다. 스마트스토어·쿠팡의 「배송 정책 · 반품/교환」 섹션은
 * (Naver)SellerProfileSummaryCard 안에 있고, 그 컴포넌트는 판매자 프로필을
 * **fetch로 읽어온 뒤에야** 무언가를 그린다(`if (profile === undefined) return
 * null`). 정적 렌더에서는 effect가 돌지 않으므로 그 섹션이 통째로 빠져서
 * 세 탭이 9 / 9 / 10으로 보인다 — 화면 사실이 아니라 렌더 방식의 사각지대다.
 * 그래서 실제로 마운트해서 effect까지 돌린 뒤에 목차를 읽는다.
 */

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

/** 실제로 마운트하고 effect까지 돌린 뒤의 DOM을 돌려준다. */
async function mount(element: ReactElement): Promise<HTMLElement> {
  await act(async () => {
    root.render(element);
  });
  return container;
}

function lotteOnElement(
  sellerSettings: LotteOnSellerSettingsInput | null = makeSellerSettings(),
): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    manufacturerResolution: manufacturerFixture(),
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings,
    onEditCommonInfo: () => {},
  } as never);
}

function platformElement(platform: PlatformId): ReactElement {
  const product = makeProduct();
  return createElement(PlatformPreview, {
    manufacturerResolution: manufacturerFixture(),
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

const TABS: { label: string; element: () => ReactElement }[] = [
  { label: "SMARTSTORE", element: () => platformElement("smartstore") },
  { label: "COUPANG", element: () => platformElement("coupang") },
  { label: "LOTTEON", element: () => lotteOnElement() },
];

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function columnsOf(dom: HTMLElement): { left: HTMLElement; right: HTMLElement } {
  const frame = dom.querySelector('[data-frame="channel-registration"]');
  if (!frame) throw new Error("공용 등록 프레임(data-frame=channel-registration)이 없다 — 세로형 화면이다");
  const [left, right] = Array.from(frame.children) as HTMLElement[];
  return { left, right };
}

/** 아코디언 섹션 제목만 순서대로 — 세 탭의 "목차"다. */

/**
 * REWORK-10 C-2(CEO 지시, 2026-09-15) — **정규화가 더 이상 필요 없다.**
 *
 * 직전까지 이 자리에는 동의어 표(TITLE_SYNONYMS)와 번호/괄호 제거 로직이 있었다.
 * "기본정보" vs "① 기본 상품정보", "KC (어린이제품 등 인증정보)" vs "⑧ KC / 인증"
 * 처럼 **같은 자리를 채널마다 다른 이름으로 부르고 있었기** 때문이다. 그 정규화가
 * 필요하다는 사실 자체가 남아 있던 간극이었고, 이번에 세 채널이 전부
 * registration-sections.ts의 sectionTitle() 하나를 쓰게 되면서 사라졌다.
 *
 * 남는 일은 **상태 배지만 떼는 것**뿐이다(쿠팡 제목 뒤에 "🟢 준비됨" 등이 붙는다).
 */
/* ── ⑥ 세 탭 나란히 비교 ─────────────────────────────────────────────────── */


/**
 * ════════════════════════════════════════════════════════════════════════════
 * UI-UNIFY-01 C(CPO 결정, 2026-09-30) — **같은 상품·같은 상태로 나란히 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 기존 REWORK 가드는 섹션 목차·className·배지를 이미 잠그고 있다. 그런데 그 가드를
 * 다 통과하고도 CEO 가 화면에서 차이를 느꼈다. 이유는 둘이었다 —
 *
 *   ① 「등록 후 관리」 자리가 채널마다 비었다 찼다 했다(A 에서 고쳤다)
 *   ② 남은 차이를 «상태 차이» 와 «구조 차이» 로 가르는 자리가 없었다
 *
 * 🔴 ②가 이 파일이다. 조사 중 실제로 두 번 «상태 차이를 구조 결함으로 오인» 했다
 * (검증 전 롯데ON · readiness 미계산 스마트스토어). 그 오인을 테스트가 막는다.
 *
 * 🔴 설명되는 채널 차이는 «허용 목록» 으로 명시한다. 목록에 없는 구조 차이는
 * 실패다 — 「달라도 되는 것」을 코드가 적어 두지 않으면 다음 사람이 또 판단한다.
 */

/** 실제 채널 정책에서 오는 «허용된» 차이. 여기 없는 차이는 실패다. */
const ALLOWED_DIFFERENCES = {
  /* 롯데ON 검증은 매 호출이 207 Identity 를 부른다. 자동으로 돌리면 화면이
     느려지고 외부 부하가 생긴다 — CPO 가 「현행 유지」로 결정했다(B). */
  lotteOnManualVerifyButton: "등록 정보 확인",
} as const;

describe("UI-UNIFY-01 C ① 세 탭이 같은 «자리» 를 갖는다 — 검증 전 상태", () => {
  it("세 탭 모두 공용 등록 프레임(좌측 상세 · 우측 요약)으로 선다", async () => {
    for (const tab of TABS) {
      const { left, right } = columnsOf(await mount(tab.element()));
      expect(left, `${tab.label}: 좌측 기둥이 없다`).toBeTruthy();
      expect(right, `${tab.label}: 우측 기둥이 없다`).toBeTruthy();
    }
  });

  it("🔴 세 탭 우측 요약이 같은 머리글로 시작한다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      expect(clean(right.textContent ?? ""), `${tab.label}`).toContain("등록 준비 상태");
    }
  });

  it("🔴 세 탭 모두 [등록 시작]이 우측 요약의 마지막 행동이다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const labels = Array.from(right.querySelectorAll("button")).map((b) => clean(b.textContent ?? ""));
      expect(labels, `${tab.label}`).toContain("등록 시작");
    }
  });

  it("🔴 우측 요약의 «추가 버튼» 은 허용 목록에 있는 것뿐이다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const extra = Array.from(right.querySelectorAll("button"))
        .map((b) => clean(b.textContent ?? ""))
        .filter((label) => label !== "등록 시작")
        /* 「…에서 입력하기 →」는 남은 항목 카드의 이동 액션이다 — 세 탭 공용
           컴포넌트(describePriorityItem)가 내고, 항목이 있을 때만 선다. */
        .filter((label) => !label.includes("에서 입력하기"))
        .filter((label) => label !== ALLOWED_DIFFERENCES.lotteOnManualVerifyButton);
      expect(extra, `${tab.label}: 설명되지 않은 버튼이 우측 요약에 있다`).toEqual([]);
    }
  });
});

describe("UI-UNIFY-01 C ② 「등록 후 관리」 자리가 세 탭에서 «비지 않는다»", () => {
  it("🔴 세 탭 모두 「등록 후 관리」 카드를 세운다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const card = right.querySelector('[data-summary="channel-edit-scope"], [data-summary="channel-edit-unavailable"]');
      expect(card, `${tab.label}: 등록 후 관리 카드가 없다 — 이 자리가 비면 셀러는 수정 가능 여부를 «듣지 못한다»`).toBeTruthy();
      expect(clean(card!.textContent ?? "")).toContain("등록된 상품 수정");
    }
  });

  it("🔴 한 자리에 두 카드가 서지 않는다 — 두 카드는 서로 배타다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const both = right.querySelectorAll('[data-summary="channel-edit-scope"], [data-summary="channel-edit-unavailable"]');
      expect(both.length, `${tab.label}`).toBe(1);
    }
  });
});

describe("UI-UNIFY-01 C ③ 🔴 지원 범위를 «부풀리지» 않는다", () => {
  it("쿠팡은 확인된 축(상품명)만 말한다 — 「전 항목」이라고 하지 않는다", () => {
    const scope = editSupportedScope("coupang");
    expect(scope, "쿠팡 어댑터가 있는데 지원 범위를 말하지 않는다").toBeDefined();
    expect(scope!.status).toContain("상품명");
    expect(scope!.status).not.toContain("전 항목");
    /* 나머지 축은 「불가」가 아니라 「확인되지 않았다」로 말한다. */
    expect(scope!.note).toContain("확인되지 않았습니다");
  });

  it("스마트스토어는 막힌 축이 없을 때만 「전 항목」이라고 말한다", () => {
    const scope = editSupportedScope("smartstore");
    expect(scope).toBeDefined();
    expect(scope!.status === "전 항목 수정 가능" || scope!.status.includes("수정 가능")).toBe(true);
  });

  it("🔴 롯데ON 은 UNKNOWN 이다 — 지원 범위를 말하지 않고, 기존 카드가 «확인되지 않음» 을 말한다", () => {
    expect(editSupportedScope(LOTTEON_COMMERCE_ID), "롯데ON UPDATE 가 열렸다").toBeUndefined();
    expect(editUnavailableNote(LOTTEON_COMMERCE_ID)).toContain("확인되지 않았습니다");
  });
});

describe("UI-UNIFY-01 C ④ 🔴 «상태 차이» 를 구조 결함으로 읽지 않는다", () => {
  /* 조사 중 두 번 오인했다: 검증 전 롯데ON 에 「남은 항목」이 없는 것과,
     readiness 미계산 스마트스토어에 이동 버튼이 없는 것. 둘 다 정상이다. */
  it("검증 «전» 에는 남은 항목 카드가 없어도 된다 — 없음이 결함이 아니다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const text = clean(right.textContent ?? "");
      /* 「남은 항목」이 있든 없든, 우측 요약은 «무엇을 해야 하는지» 는 반드시 말한다. */
      const saysSomething =
        text.includes("남은 항목") || text.includes("등록 정보 확인") || text.includes("확인");
      expect(saysSomething, `${tab.label}: 검증 전 화면이 아무 말도 하지 않는다`).toBe(true);
    }
  });
});
