// @vitest-environment jsdom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { LotteOnSellerSettingsInput } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { FIELD_INPUT_CLASS } from "../registration-fields";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * REWORK-14(CEO 실측 판정, 2026-09-15: **FAIL 3회차** — "롯데ON ⑤배송이 아직
 * 쿠팡과 다르다")
 *
 * ── 앞의 두 번이 무엇을 쟀고 왜 못 잡았나 ────────────────────────────────
 *   REWORK-12   카드 · 머리 버튼 · 입력칸의 className을 쟀다 → 전부 같았다
 *   REWORK-13B  카드 간격 · 머리 줄 수 · 격자 종류를 쟀다   → 전부 같아졌다
 *   공통점      **«그릇»만 쟀다.** 그 그릇 **안에 무엇이 들어가는가**는
 *               한 번도 세지 않았다.
 *
 * 실제로 쿠팡과 롯데ON은 같은 `FieldRow`를 쓰면서도 그 안을 이렇게 채우고
 * 있었다(수정 전 jsdom 실측, 좌측 상세 전수):
 *
 *   ┌ 재는 것 ────────────────┬ 쿠팡/스마트스토어 ──────┬ 롯데ON ────────────┐
 *   │ 필수 표시               │ 라벨 뒤 빨간 `*` 3건    │ 0건                │
 *   │ 「🔴 필수」 배지        │ 0건                     │ 2건                │
 *   │ 「○ 선택 — 없어도…」    │ 0건                     │ 13건               │
 *   │ 배지 알약(ProvenanceBadge)│ 13건                  │ 0건                │
 *   │ 라벨에 API 코드 병기     │ 0건                     │ 14건               │
 *   │ 도움말 줄 안의 입력 컨트롤│ 0건                     │ select/버튼칩       │
 *   └─────────────────────────┴─────────────────────────┴────────────────────┘
 *
 * 이 파일이 재는 것은 **한 칸이 그려지는 마크업 전체**다 — 라벨 · 배지 ·
 * 입력칸 · 도움말 각각의 태그 · 클래스 · 중첩 · 순서. 클래스 이름 하나가
 * 같은지를 다시 세지 않는다.
 *
 * 🔴 기준은 언제나 쿠팡 · 스마트스토어다. 롯데ON이 그쪽으로 온다.
 */

/* ── 고정물 ────────────────────────────────────────────────────────────────── */

function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(overrides: Record<string, unknown> = {}): CanonicalProduct {
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

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/lotteon/payload-preview")) {
        /* 🔴 검증기를 흉내 내는 것이 목적이 아니다. CEO가 캡처한 화면은
           **검증이 이미 한 번 돈 뒤**의 화면이다(배지가 서 있다). 그 순간을
           만들지 않으면 이 파일이 봐야 할 것이 화면에 나타나지 않는다.
           필수 두 건 · 나머지 전부 선택 — 캡처와 같은 구성이다. */
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              identityError: null,
              payload: { pdNm: "테리 버뮤다 반바지" },
              validation: {
                ok: false,
                readyCount: 1,
                missingCount: 2,
                blockedCount: 0,
                fields: [
                  { field: "pdNm", label: "상품명", status: "READY" },
                  { field: "owhpNo", label: "출고지번호", status: "MISSING", reason: "값이 없습니다" },
                  { field: "dvCstPolNo", label: "배송비정책번호", status: "MISSING" },
                ],
              },
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

function lotteOnElement(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    manufacturerResolution: manufacturerFixture(),
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: makeSellerSettings(),
    onEditCommonInfo: () => {},
  } as never);
}

/**
 * `unresolved`면 제조사가 풀리지 않은 화면이다 — 쿠팡에서 **「입력 필요」 알약과
 * ⓘ가 배지 자리에 실제로 서는** 유일한 경우라, 그 모양을 «쿠팡이 쓰는 형식»의
 * 증거로 삼으려면 이 변형이 필요하다.
 */
function platformElement(platform: PlatformId, unresolved = false): ReactElement {
  const product = makeProduct(
    unresolved ? { manufacturer: { value: "", source: "REQUIRED", confidence: 0 } } : {},
  );
  return createElement(PlatformPreview, {
    manufacturerResolution: unresolved
      ? manufacturerFixture({ value: "", source: "NONE", resolved: false })
      : manufacturerFixture(),
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

async function remount(): Promise<void> {
  await act(async () => root.unmount());
  container.remove();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
}

async function mount(element: ReactElement): Promise<HTMLElement> {
  await remount();
  await act(async () => {
    root.render(element);
  });
  await act(async () => void expandAllSections(container));
  return container;
}

function leftColumn(dom: HTMLElement): HTMLElement {
  const frame = dom.querySelector('[data-frame="channel-registration"]');
  if (!frame) throw new Error("공용 등록 프레임이 없다");
  return frame.children[0] as HTMLElement;
}

/* ── 한 칸을 «마크업»으로 읽는 도구 ────────────────────────────────────────── */

/** FieldRow 한 칸. 세 탭이 같은 컴포넌트를 쓰므로 뿌리 클래스가 같다. */
const CELL_SELECTOR = "div.flex.h-full.min-w-0.flex-col";

function cells(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(CELL_SELECTOR));
}

/** 라벨 줄(라벨 + 배지가 마주 보는 줄). */
function headRow(cell: HTMLElement): HTMLElement {
  return cell.children[0] as HTMLElement;
}

/** 배지가 서는 자리. 없으면 null — 쿠팡은 말할 것이 없으면 자리를 아예 만들지 않는다. */
function badgeSlot(cell: HTMLElement): HTMLElement | null {
  return (headRow(cell).children[1] as HTMLElement | undefined) ?? null;
}

/** 입력칸 아래 회색 도움말 한 줄. */
function noteLine(cell: HTMLElement): HTMLElement | null {
  const last = cell.children[cell.children.length - 1] as HTMLElement | undefined;
  return last && last.tagName.toLowerCase() === "p" ? last : null;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** 이 칸의 라벨 글자(배지·ⓘ를 뺀 사람이 읽는 이름). */
function labelText(cell: HTMLElement): string {
  return clean(headRow(cell).querySelector("label")?.textContent ?? "");
}

/* ── 기준을 만든다: 쿠팡 · 스마트스토어가 실제로 그리는 모양 전부 ──────────── */

const REFERENCE: { label: string; element: () => ReactElement }[] = [
  { label: "SMARTSTORE", element: () => platformElement("smartstore") },
  { label: "SMARTSTORE(제조사 미확인)", element: () => platformElement("smartstore", true) },
  { label: "COUPANG", element: () => platformElement("coupang") },
  { label: "COUPANG(제조사 미확인)", element: () => platformElement("coupang", true) },
];

async function referenceShapes(pick: (cell: HTMLElement) => string | null): Promise<Set<string>> {
  const shapes = new Set<string>();
  for (const tab of REFERENCE) {
    const left = leftColumn(await mount(tab.element()));
    for (const cell of cells(left)) {
      const shape = pick(cell);
      if (shape != null) shapes.add(shape);
    }
  }
  return shapes;
}

async function lotteOnShapes(pick: (cell: HTMLElement) => string | null): Promise<Map<string, string[]>> {
  const left = leftColumn(await mount(lotteOnElement()));
  const found = new Map<string, string[]>();
  for (const cell of cells(left)) {
    const shape = pick(cell);
    if (shape == null) continue;
    const owners = found.get(shape) ?? [];
    owners.push(labelText(cell) || "(이름 없음)");
    found.set(shape, owners);
  }
  return found;
}

/* ── ① 배지 ──────────────────────────────────────────────────────────────── */

describe("REWORK-14 ① — 칸 안에 쿠팡에 없는 «부품»이 하나도 없다", () => {
  /**
   * 칸 안에 실제로 그려진 **모든 요소**를 `태그.클래스` 한 줄로 납작하게 편다.
   *
   * 🔴 «조합»이 아니라 «부품»을 센다. 「별표 + ⓘ + 알약」이 한 줄에 같이 서는
   * 칸은 쿠팡에 없을 수 있지만, 그건 그 칸이 «말할 것이 셋»이라는 뜻이지
   * 「롯데ON이라서 다른 모양」이 아니다. 진짜 물어야 할 것은 **그 셋 각각이
   * 쿠팡이 쓰는 그 물건인가**이고, 앞선 두 번(REWORK-12 · 13B)이 놓친 것도
   * 정확히 이 층위다 — 그때는 카드 · 머리 · 격자만 봤고 칸 «안»은 안 봤다.
   */
  function parts(cell: HTMLElement): string[] {
    return Array.from(cell.querySelectorAll("*"))
      /* 🔴 읽기 전용 값 칸(`[data-readonly-field]`)은 세지 않는다 — 여기 하나만
         **구조적으로** 쿠팡에 짝이 없다. 롯데ON 탭은 공통값(상품명 · 브랜드 …)을
         입력받지 않는다는 CEO 규칙(three-layer-realign 증명 1) 때문에 같은 자리에
         입력칸 대신 값 칸이 서기 때문이다. 짝이 없는 것을 «모양이 다르다»로 세면
         그 규칙을 되돌리는 일이 된다. 대신 바로 아래 검사가 «그 값 칸이 쿠팡
         입력칸과 같은 틀 위에 서 있는가»를 따로 묻는다. */
      .filter((el) => !el.closest("[data-readonly-field]"))
      .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}`);
  }

  it("🔴 읽기 전용 값 칸은 쿠팡 입력칸과 «같은 틀» 위에 선다", async () => {
    const left = leftColumn(await mount(lotteOnElement()));
    const boxes = Array.from(left.querySelectorAll<HTMLElement>("[data-readonly-field]"));
    expect(boxes.length, "롯데ON에 읽기 전용 값 칸이 없다").toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.className.startsWith(FIELD_INPUT_CLASS), `값 칸이 다른 틀이다 — ${box.className}`).toBe(true);
    }
  });

  it("🔴 롯데ON 좌측 상세의 필드 부품이 전부 쿠팡·스마트스토어에 이미 있는 것이다", async () => {
    /* BEFORE(수정 전 실측) — 쿠팡에 없던 부품 다섯:
         span.text-xs font-medium text-error         「🔴 필수」    2건
         span.text-xs font-medium text-text-tertiary 「○ 선택 …」   13건
         span.text-[11px] text-text-tertiary         읽기 행 출처   13건
         textarea.… font-mono                        코드 목록 칸   2건
         select.mt-0.5 w-full … text-xs              공통코드 고르기(조회 성공 시) */
    const reference = new Set<string>();
    for (const tab of REFERENCE) {
      const left = leftColumn(await mount(tab.element()));
      for (const cell of cells(left)) for (const part of parts(cell)) reference.add(part);
    }
    const left = leftColumn(await mount(lotteOnElement()));
    const foreign = new Map<string, string[]>();
    for (const cell of cells(left)) {
      for (const part of parts(cell)) {
        if (reference.has(part)) continue;
        foreign.set(part, [...(foreign.get(part) ?? []), labelText(cell)]);
      }
    }
    expect(
      [...foreign].map(([part, owners]) => `${part}   ← ${[...new Set(owners)].join(", ")}`).join("\n"),
      "쿠팡에 없는 부품",
    ).toBe("");
  });

  it("🔴 배지가 서는 «자리»(감싸는 span)도 쿠팡이 쓰는 두 값뿐이다", async () => {
    const reference = await referenceShapes((cell) => {
      const slot = badgeSlot(cell);
      return slot ? `span.${slot.className}` : null;
    });
    const mine = await lotteOnShapes((cell) => {
      const slot = badgeSlot(cell);
      return slot ? `span.${slot.className}` : null;
    });
    const foreign = [...mine.keys()].filter((shape) => !reference.has(shape));
    expect(foreign, "쿠팡에 없는 배지 자리").toEqual([]);
  });

  it("🔴 배지 자리를 «빈 채로» 만들어 두지 않는다 — 말할 것이 없으면 자리도 없다", async () => {
    /* BEFORE: requirement가 아직 undefined인 동안에도 롯데ON은
       `<span class="flex shrink-0 items-center whitespace-nowrap"></span>`를
       빈 채로 그렸다(RequirementBadge가 null을 돌려줘도 element 자체는 truthy). */
    for (const tab of [...REFERENCE, { label: "LOTTEON", element: lotteOnElement }]) {
      const left = leftColumn(await mount(tab.element()));
      const empties = cells(left).filter((cell) => {
        const slot = badgeSlot(cell);
        return slot != null && slot.children.length === 0 && clean(slot.textContent ?? "") === "";
      });
      expect(empties.map(labelText), `${tab.label}: 빈 배지 자리`).toEqual([]);
    }
  });
});

/* ── ② 필수 / 선택 표시 ──────────────────────────────────────────────────── */

describe("REWORK-14 ② — 필수·선택을 말하는 방법이 세 탭에서 하나다", () => {
  const ALL = [...REFERENCE, { label: "LOTTEON", element: lotteOnElement }];

  it("🔴 필수는 «라벨 뒤 빨간 별표» 하나로만 말한다 — 세 탭 전부", async () => {
    /* 쿠팡·스마트스토어가 처음부터 쓰던 형식이다(FieldRow의 `required`).
       롯데ON은 별표를 한 번도 쓰지 않고 「🔴 필수」 배지를 따로 만들었다. */
    for (const tab of ALL) {
      const left = leftColumn(await mount(tab.element()));
      const starred = cells(left).filter((cell) => headRow(cell).querySelector("label > span.text-error"));
      expect(starred.length, `${tab.label}: 필수 표시(별표)가 한 건도 없다`).toBeGreaterThan(0);
    }
  });

  it("🔴 「🔴 필수」·「○ 선택 — 없어도 등록 가능」이라는 글자가 세 탭 어디에도 없다", async () => {
    for (const tab of ALL) {
      const left = leftColumn(await mount(tab.element()));
      const text = clean(left.textContent ?? "");
      expect(text.includes("🔴 필수"), `${tab.label}: 「🔴 필수」 배지가 남아 있다`).toBe(false);
      expect(
        text.includes("선택 — 없어도 등록 가능"),
        `${tab.label}: 「선택 — 없어도 등록 가능」이 남아 있다`,
      ).toBe(false);
    }
  });

  it("🔴 «선택 필드»에는 아무 표시도 붙이지 않는다 — 쿠팡이 그러하듯", async () => {
    /* 쿠팡의 선택 필드(재고 · 배송비 · 반품/교환 안내)는 배지도 별표도 없다.
       「선택」이라고 적는 칸이 한 곳도 없다는 것이 쿠팡의 «선택» 표기법이다. */
    for (const tab of ALL) {
      const left = leftColumn(await mount(tab.element()));
      const labelled = cells(left).filter((cell) => {
        const slot = badgeSlot(cell);
        return slot != null && clean(slot.textContent ?? "").startsWith("선택");
      });
      expect(labelled.map(labelText), `${tab.label}: 「선택」이라고 적은 칸`).toEqual([]);
    }
  });
});

/* ── ③ 라벨 조판 ─────────────────────────────────────────────────────────── */

describe("REWORK-14 ③ — 라벨은 사람이 읽는 이름이다", () => {
  it("🔴 라벨 글자에 API 필드명을 괄호로 달지 않는다 — 세 탭 전부", async () => {
    /* BEFORE: 롯데ON 14칸이 「출고지번호 (owhpNo)」였다. 쿠팡·스마트스토어는
       0건이다. 코드를 버리지는 않는다 — 쿠팡이 이미 쓰는 ⓘ(InfoTip) 안으로
       들어가 title·sr-only에 그대로 남는다. */
    /* 🔴 「상품코드(SKU)」는 걸리지 않는다 — 그건 셀러가 아는 약어이고
       쿠팡·스마트스토어가 **이미** 쓰던 라벨이다. 여기서 잡으려는 것은
       lowerCamelCase로 된 **API 필드명**(owhpNo · dvCstPolNo …)이다. */
    const CODE_IN_LABEL = /\([a-z][A-Za-z0-9_]{2,}\)\s*\*?$/;
    for (const tab of [...REFERENCE, { label: "LOTTEON", element: lotteOnElement }]) {
      const left = leftColumn(await mount(tab.element()));
      const offenders = cells(left).map(labelText).filter((text) => CODE_IN_LABEL.test(text));
      expect(offenders, `${tab.label}: 라벨에 API 코드가 박혀 있다`).toEqual([]);
    }
  });

  /* ══ Commerce-6 C-2B(CPO 결정, 2026-09-26) — 이 줄이 «뒤집혔다» ══

     원래 이 테스트는 반대를 요구했다: 「코드가 사라진 것이 아니다 — 문서
     (title · sr-only)에는 그대로 있다」. REWORK-14 가 라벨 병기를 ⓘ 안으로
     옮기면서 «코드를 버리지 않는다» 고 정했고 그 결정을 여기서 지켰다.

     🔴 CPO 가 그 결정을 뒤집었다: 「REWORK-14 의 기존 의도가 있었다는 사실보다
     현재 제품 원칙을 우선한다 — F-7 에서 내부 LotteON field name 을 seller 에게
     노출하지 않기로 했으므로 title · sr-only · InfoTip 에도 같은 원칙을
     적용한다.」 눈에 덜 띌 뿐 셀러에게 가는 자리였고 스크린리더는 그대로 읽는다.

     🔴 테스트를 «지우지» 않고 뒤집는다. 지우면 다음 사람이 ⓘ 를 되살려도 아무도
     막지 않는다. 코드 자체는 검증기 · lotteOnField · 로그에 그대로 있다. */
  it("🔴 내부 API 필드명이 문서(title · sr-only)에도 남지 않는다", async () => {
    const left = leftColumn(await mount(lotteOnElement()));
    const text = clean(left.textContent ?? "");
    for (const code of ["owhpNo", "dvCstPolNo", "hdcCd", "pdItmsCd", "brdNo"]) {
      expect(text.includes(code), `${code}가 아직 셀러에게 보인다`).toBe(false);
    }
  });
});

/* ── ④ 도움말 한 줄 ──────────────────────────────────────────────────────── */

describe("REWORK-14 ④ — 도움말 줄은 «글»이지 «입력칸»이 아니다", () => {
  it("🔴 회색 도움말 줄 안에 input · select · textarea가 없다 — 세 탭 전부", async () => {
    /* BEFORE: 롯데ON은 공통코드 고르기(`select.w-full`)와 출고지 고르기(버튼 칩
       여러 개)를 도움말 줄 **안**에 넣었다. 쿠팡은 같은 성격의 보조 컨트롤
       (「상세페이지 참조로 등록」)을 **입력칸 아래 children**에 둔다. */
    for (const tab of [...REFERENCE, { label: "LOTTEON", element: lotteOnElement }]) {
      const left = leftColumn(await mount(tab.element()));
      const offenders = cells(left)
        .filter((cell) => noteLine(cell)?.querySelector("input, select, textarea, button"))
        .map(labelText);
      expect(offenders, `${tab.label}: 도움말 줄에 입력 컨트롤이 있다`).toEqual([]);
    }
  });

  it("🔴 도움말 줄의 태그·클래스가 쿠팡이 쓰는 그것 하나뿐이다", async () => {
    const reference = await referenceShapes((cell) => {
      const note = noteLine(cell);
      return note ? `${note.tagName.toLowerCase()}.${note.className}` : null;
    });
    expect(reference.size, "쿠팡·스마트스토어에 도움말 줄이 한 건도 없다").toBeGreaterThan(0);
    const mine = await lotteOnShapes((cell) => {
      const note = noteLine(cell);
      return note ? `${note.tagName.toLowerCase()}.${note.className}` : null;
    });
    const foreign = [...mine.keys()].filter((shape) => !reference.has(shape));
    expect(foreign, "쿠팡에 없는 도움말 줄 모양").toEqual([]);
  });
});

/* ── ⑤ 입력칸 ────────────────────────────────────────────────────────────── */

describe("REWORK-14 ⑤ — 입력칸이 쿠팡과 같은 옷을 입는다", () => {
  /**
   * 칸 본문에 선 **모든** 입력 컨트롤의 클래스.
   *
   * 🔴 태그(input/textarea/select)까지 같기를 요구하지 않는다 — 여러 줄짜리
   * 코드 목록은 textarea가, 목록에서 고르는 값은 select가 맞고, 그건 «값의
   * 성격»이지 «채널의 모양»이 아니다. 요구하는 것은 **입은 옷**이 같을 것,
   * 즉 클래스가 쿠팡이 쓰는 그 값일 것 하나다.
   */
  const controlShapes = (cell: HTMLElement): string[] =>
    Array.from((cell.children[1] as HTMLElement | undefined)?.querySelectorAll("input, textarea, select") ?? []).map(
      (control) => control.getAttribute("class") ?? "",
    );

  it("🔴 롯데ON 입력칸 클래스가 전부 쿠팡·스마트스토어에 이미 있는 값이다", async () => {
    const reference = new Set<string>();
    for (const tab of REFERENCE) {
      const left = leftColumn(await mount(tab.element()));
      for (const cell of cells(left)) for (const shape of controlShapes(cell)) reference.add(shape);
    }
    const left = leftColumn(await mount(lotteOnElement()));
    const foreign: string[] = [];
    for (const cell of cells(left)) {
      for (const shape of controlShapes(cell)) {
        if (!reference.has(shape)) foreign.push(`${labelText(cell)} → ${shape}`);
      }
    }
    expect([...new Set(foreign)], "쿠팡에 없는 입력칸 모양").toEqual([]);
  });
});

/* ── ⑥ ⑤배송 한 칸 통째 대조 ────────────────────────────────────────────── */

describe("REWORK-14 ⑥ — ⑤배송 한 칸의 «칸 구성»이 쿠팡과 같다", () => {
  /** 칸의 직계 자식 구성 — 「라벨줄 / 본문 / 도움말」이 어떤 순서로 몇 개인가. */
  function frame(cell: HTMLElement): string {
    return Array.from(cell.children)
      .map((child) => `${child.tagName.toLowerCase()}.${child.getAttribute("class") ?? ""}`)
      .join(" | ");
  }

  function shippingSection(left: HTMLElement): HTMLElement {
    const section = Array.from(left.querySelectorAll<HTMLElement>("section[id]")).find((el) =>
      (el.textContent ?? "").startsWith("⑤"),
    );
    if (!section) throw new Error("⑤ 배송 섹션이 없다");
    return section;
  }

  it("🔴 롯데ON ⑤배송 일곱 칸의 구성이 전부 쿠팡 어딘가에 이미 있는 구성이다", async () => {
    const reference = await referenceShapes(frame);
    const left = leftColumn(await mount(lotteOnElement()));
    const ship = cells(shippingSection(left));
    expect(ship.length, "롯데ON ⑤배송에 입력 칸이 없다").toBeGreaterThan(0);
    const foreign = ship
      .filter((cell) => !reference.has(frame(cell)))
      .map((cell) => `${labelText(cell)} → ${frame(cell)}`);
    expect(foreign, "쿠팡에 없는 칸 구성").toEqual([]);
  });

  /**
   * 라벨 덩어리의 **문법**. 세 탭이 이것 하나만 쓴다.
   *
   * 🔴 «조합»으로 묻지 않는다. 「별표 + ⓘ」가 한 줄에 같이 선 칸은 쿠팡에
   * 없지만(쿠팡은 둘 중 하나씩만 쓴다), 그건 그 칸이 말할 것이 둘이라는 뜻이지
   * 다른 모양이라는 뜻이 아니다. 물어야 할 것은 «감싸개 · 라벨 · 별표 · ⓘ가
   * 각각 쿠팡이 쓰는 그 태그 · 그 클래스 · 그 순서 · 그 중첩인가»다.
   */
  function grammarViolations(cell: HTMLElement): string[] {
    const bad: string[] = [];
    const block = headRow(cell).children[0] as HTMLElement;
    if (`span.${block.className}` !== "span.flex min-w-0 flex-1 items-start") bad.push(`감싸개 ${block.className}`);
    const kids = Array.from(block.children);
    const labelEl = kids[0];
    if (!labelEl || labelEl.tagName.toLowerCase() !== "label") bad.push("첫 자식이 label이 아니다");
    else if (labelEl.className !== "min-w-0 break-words text-xs leading-snug text-text-secondary")
      bad.push(`라벨 ${labelEl.className}`);
    for (const star of Array.from(labelEl?.children ?? [])) {
      if (`${star.tagName.toLowerCase()}.${star.className}` !== "span.ml-0.5 text-error")
        bad.push(`라벨 안 ${star.tagName.toLowerCase()}.${star.className}`);
    }
    const tip = kids[1];
    if (tip && `span.${tip.className}` !== "span.inline-flex items-center align-middle")
      bad.push(`라벨 뒤 ${tip.tagName.toLowerCase()}.${tip.className}`);
    if (kids.length > 2) bad.push(`라벨 덩어리에 자식이 ${kids.length}개다`);
    return bad;
  }

  it("🔴 세 탭의 라벨 덩어리가 같은 문법 하나로만 그려진다", async () => {
    for (const tab of [...REFERENCE, { label: "LOTTEON", element: lotteOnElement }]) {
      const left = leftColumn(await mount(tab.element()));
      const bad = cells(left)
        .map((cell) => ({ name: labelText(cell), bad: grammarViolations(cell) }))
        .filter((row) => row.bad.length > 0)
        .map((row) => `${row.name}: ${row.bad.join(" / ")}`);
      expect(bad, `${tab.label}: 라벨 덩어리가 문법을 벗어난다`).toEqual([]);
    }
  });

  it("🔴 그 문법의 «별표»와 «ⓘ»는 쿠팡이 이미 쓰던 것이다 — 롯데ON용 신품이 아니다", async () => {
    let stars = 0;
    let tips = 0;
    for (const tab of REFERENCE) {
      const left = leftColumn(await mount(tab.element()));
      for (const cell of cells(left)) {
        const block = headRow(cell).children[0] as HTMLElement;
        if (block.querySelector("label > span.ml-0\\.5.text-error")) stars += 1;
        if (block.querySelector(":scope > span.inline-flex")) tips += 1;
      }
    }
    expect(stars, "쿠팡·스마트스토어에 별표가 없다").toBeGreaterThan(0);
    expect(tips, "쿠팡·스마트스토어에 ⓘ가 없다").toBeGreaterThan(0);
  });
});
