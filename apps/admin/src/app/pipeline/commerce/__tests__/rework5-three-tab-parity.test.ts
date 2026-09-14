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
import { REGISTRATION_SECTION_KEYS, sectionTitle } from "../registration-sections";

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
function rawSectionTitles(scope: HTMLElement): string[] {
  return Array.from(scope.querySelectorAll("span.text-sm.font-medium.text-text-primary")).map((el) =>
    clean(el.textContent ?? ""),
  );
}

/**
 * 제목에서 **자리 이름**만 남긴다. 셋을 벗겨낸다:
 *   · 앞의 번호(①~⑩)          — 롯데ON에만 붙어 있다
 *   · 괄호 안의 채널 전용 설명  — "(롯데ON 전용 · 2중 구조)" 등
 *   · 뒤에 붙는 상태 배지        — "🟢 준비됨" 등(쿠팡에만 붙는다)
 * 그리고 같은 자리를 가리키는 다른 표기를 canonical 이름으로 모은다.
 *
 * 🔴 이 정규화가 필요하다는 사실 자체가 남아 있는 간극이다 — 아래 "표기 차이"
 * 테스트가 그 간극을 숨기지 않고 그대로 기록한다.
 */
const TITLE_SYNONYMS: Record<string, string> = {
  "기본정보": "기본 상품정보",
  "배송 정책 · 반품/교환": "배송정책 · 반품/교환",
  "KC (어린이제품 등 인증정보)": "KC / 인증",
  "등록 정보": "등록정보",
};

function canonicalSectionName(title: string): string {
  let t = title.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "");
  t = t.split(/[🟢🟠🟡🔴⚪]/)[0];
  // 괄호 설명은 벗기되, "KC (어린이제품 등 인증정보)"처럼 동의어 표에 통째로
  // 들어 있는 것은 먼저 찾아본다.
  const whole = clean(t);
  if (TITLE_SYNONYMS[whole]) return TITLE_SYNONYMS[whole];
  t = clean(whole.replace(/\s*\([^)]*\)\s*$/, ""));
  return TITLE_SYNONYMS[t] ?? t;
}

/* ── ⑥ 세 탭 나란히 비교 ─────────────────────────────────────────────────── */

describe("REWORK-5 ⑥ — 세 탭을 나란히 놓은 렌더 비교", () => {
  it("세 탭 모두 같은 등록 프레임(좌측 상세 · 우측 요약)으로 선다", async () => {
    for (const tab of TABS) {
      const { left, right } = columnsOf(await mount(tab.element()));
      expect(left.innerHTML.length, `${tab.label}: 좌측 등록 상세가 비었다`).toBeGreaterThan(0);
      expect(right.innerHTML.length, `${tab.label}: 우측 등록 요약이 비었다`).toBeGreaterThan(0);
    }
  });

  /**
   * 🔴 이번 지시서가 인정하는 유일한 완료 기준 — **DOM/실제 렌더가 같은
   * 구조인가.** 세 탭의 좌측 목차를 뽑아 같은 10개 자리가 같은 순서로 서는지
   * 본다(번호 표기 · 채널 전용 꼬리표 · 상태 배지는 벗겨낸 뒤).
   */
  it("🔴 세 탭의 섹션 목차가 같은 10개 자리 · 같은 순서다", async () => {
    const expected = REGISTRATION_SECTION_KEYS.map((key) =>
      canonicalSectionName(sectionTitle(key)),
    );
    for (const tab of TABS) {
      const { left } = columnsOf(await mount(tab.element()));
      const names = rawSectionTitles(left).map(canonicalSectionName);
      const skeleton = names.filter((n) => expected.includes(n));
      expect(skeleton, `${tab.label}: 목차가 공용 10섹션과 다르다`).toEqual(expected);
    }
  });

  /**
   * 🔴 남아 있는 간극을 **숨기지 않고 기록한다.**
   *
   * 세 탭의 자리와 순서는 같지만 **표기는 아직 다르다** — 롯데ON만 ①~⑩ 번호를
   * 달고 있고, 같은 자리의 이름도 "기본정보" vs "① 기본 상품정보"처럼 다르다.
   * 이 테스트는 그 차이를 고정해서 보고서가 사실대로 쓰이게 한다.
   *
   * 지시서가 "SS/쿠팡 10칸 read-only 전환"을 CEO 판단 대기로 묶어 두었으므로
   * 스마트스토어·쿠팡의 제목을 이번에 임의로 바꾸지 않았다. 바꿔야 할지는
   * CEO가 정할 일이고, 그때까지 이 차이가 조용히 사라지지 않게 못을 박는다.
   */
  it("📋 남은 간극 — 자리는 같지만 제목 표기는 아직 채널마다 다르다", async () => {
    const raw: Record<string, string[]> = {};
    for (const tab of TABS) {
      const { left } = columnsOf(await mount(tab.element()));
      raw[tab.label] = rawSectionTitles(left);
    }
    // 롯데ON에만 번호가 붙어 있다.
    expect(raw.LOTTEON.some((t) => /^①/.test(t))).toBe(true);
    expect(raw.SMARTSTORE.some((t) => /^①/.test(t))).toBe(false);
    expect(raw.COUPANG.some((t) => /^①/.test(t))).toBe(false);
    // 같은 자리인데 이름이 다르다 — 정규화 전에는 세 탭이 같지 않다.
    expect(raw.SMARTSTORE[0]).toBe("기본정보");
    expect(raw.LOTTEON[0]).toBe("① 기본 상품정보");
  });

  it("세 탭 모두 우측 요약에 등록 가능성이 선다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      expect(clean(right.textContent ?? ""), `${tab.label}: 우측 요약에 등록 가능성이 없다`).toContain(
        "등록 가능성",
      );
    }
  });

  it("세 탭 모두 우측 요약이 등록 판정 배너로 시작한다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const text = clean(right.textContent ?? "");
      expect(
        ["등록 준비 완료", "등록 전 확인이 필요합니다", "현재 등록할 수 없습니다", "판매 전 확인이 필요한 상품입니다"].some(
          (s) => text.includes(s),
        ),
        `${tab.label}: 우측 요약에 등록 판정 배너가 없다`,
      ).toBe(true);
    }
  });

  it("세 탭 어디에도 판매 판단(MI) 어휘가 없다 — 커머스 탭의 질문은 등록 하나다", async () => {
    for (const tab of TABS) {
      const text = clean((await mount(tab.element())).textContent ?? "");
      for (const word of ["예상 마진", "시장 수요", "국내 경쟁력", "MI Radar", "판매 판단"]) {
        expect(text, `${tab.label}: MI 어휘가 새어 들어왔다 — ${word}`).not.toContain(word);
      }
    }
  });
});

/* ── ④ 공통 상품정보 · 셀러 설정이 렌더로 채워지는가 ──────────────────────── */

describe("REWORK-5 ④ — 롯데ON 탭에 공통 상품정보 값이 실제로 채워진다", () => {
  async function lotteOnText(
    settings: LotteOnSellerSettingsInput | null = makeSellerSettings(),
  ): Promise<string> {
    return clean((await mount(lotteOnElement(settings))).textContent ?? "");
  }

  /** 값 하나하나를 **화면 글자로** 확인한다 — "연결돼 있다"가 아니라 "보인다". */
  it.each([
    ["상품명", "테리 버뮤다 반바지"],
    ["판매가격", "128,000원"],
    ["재고", "30개"],
    ["브랜드", "Bobo Choses"],
  ])("%s — 상품정보의 값이 그대로 보인다", async (_label, value) => {
    expect(await lotteOnText()).toContain(value);
  });

  it("옵션 · 이미지 · 상세설명도 상품정보에서 온 요약으로 선다", async () => {
    const text = await lotteOnText();
    expect(text).toContain("옵션 없음 — 단품 1건으로 등록");
    expect(text).toContain("대표 1장");
    expect(text).toContain("판매자 공통 안내 포함");
  });

  it("🔴 공통값을 롯데ON 탭에서 다시 입력시키지 않는다 — 고치려면 상품정보로 보낸다", async () => {
    const text = await lotteOnText();
    expect(text).toContain("상품정보에서 수정");
    expect(text).toContain("다시 입력하지 않습니다");
  });

  it("셀러 설정의 출고 소요일이 화면에 그 숫자로 나온다", async () => {
    const text = await lotteOnText();
    expect(text).toContain("출고 소요일");
    expect(text, "셀러 설정 값이 화면에 오지 않았다").toContain("2일");
  });

  it("셀러 설정에 저장된 출고지 · 반품지 · 택배사 번호가 값으로 보인다", async () => {
    const text = await lotteOnText();
    for (const saved of ["7788", "RC-1004", "CJGLS", "CJ대한통운"]) {
      expect(text, `셀러 설정 값이 화면에 오지 않았다: ${saved}`).toContain(saved);
    }
  });

  /**
   * 🔴 지시서의 핵심 요구 — **재사용 가능한 것과 롯데ON 고유값을 화면에서
   * 구분해 보여주고, 고유값에는 판매자센터 안내를 붙인다.**
   *
   * 직전 조사에서 확인된 사실(쿠팡 Wing 발급 코드라 값 재사용 불가)이 화면에도
   * 그대로 서 있어야 한다 — 값이 보인다고 해서 "그대로 쓴다"는 뜻이 되면 셀러는
   * 등록 실패의 이유를 영영 알 수 없다.
   */
  it("🔴 자동 반영되는 값과 코드체계가 달라 못 쓰는 값이 다른 말로 적힌다", async () => {
    const text = await lotteOnText();
    expect(text).toContain("자동 반영됨");
    expect(text).toContain("셀러 설정에 있지만 롯데ON 코드체계가 다름");
    expect(text).toContain("셀러 설정에 없는 개념 — 롯데ON 고유값");
  });

  it("🔴 고유값에는 '롯데ON 판매자센터에서 따로 발급된다'는 안내가 붙는다", async () => {
    const text = await lotteOnText();
    expect(text).toContain("롯데ON 판매자센터가 따로 발급합니다");
    expect(text).toContain("롯데ON 판매자센터에서 따로 생깁니다");
    expect(text).toContain("판매자센터에 등록된");
  });

  /** 설정이 아예 없을 때 — 지시서가 요구한 "⚠ 설정 필요 + [설정으로 이동]". */
  it("셀러 설정이 없으면 '설정에서 먼저 등록' + [설정하러 가기]가 선다", async () => {
    const text = await lotteOnText(null);
    expect(text).toContain("셀러 설정에서 먼저 등록해주세요");
    expect(text).toContain("설정하러 가기");
  });
});
