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
import { ChannelRegistrationSummary } from "../ChannelRegistrationFrame";
import { buildSummaryChecks } from "../summary-checklist";
import type { ReadinessItem } from "../readiness";

/**
 * REWORK-7 ①·②·⑤(CEO 지시, 2026-09-15) — **우측은 요약이다.**
 *
 * ── 고치기 전의 사실(BEFORE 렌더 덤프, jsdom 마운트) ───────────────────────
 * 쿠팡 탭 우측 기둥:
 *
 *   그 외 확인 항목 6개 ✓ 상품명 ✓ 브랜드 ✓ 대표이미지 ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명
 *   등록 가능성 86%
 *   상품 정보 ✗ 카테고리 ✓ 상품명 ✓ 브랜드 ✓ 대표이미지 ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명
 *   선택 입력 △ 옵션
 *
 * 같은 필드 목록이 한 기둥 안에서 두 번 서 있었고, 그 목록은 좌측 상세가 이미
 * 섹션마다 보여주는 것이었다. 롯데ON은 또 자기만 「등록 상태」 칸을 하나 더
 * 갖고 있어서 세 탭이 같은 화면이 아니었다.
 *
 * ── 이 파일이 증명하는 것 ─────────────────────────────────────────────────
 *   ① 우측 요약이 CEO가 그린 네 칸으로, 세 탭 모두 같은 순서로 선다
 *   ② 🔴 우측 요약에 상세 필드 이름이 **0건**이다
 *   ③ [등록 시작]은 화면에 하나뿐이고 우측에 있다
 *   ④ 누르면 세 채널이 **같은 최종 확인 모달**로 간다 — 등록 API는 호출되지 않는다
 *
 * 🔴 정적 렌더로 판정하지 않는다(fetch 전 null 사례가 이미 있었다). 전부
 * jsdom 마운트 + 실제 클릭이다.
 */

/* ── 고정물 ────────────────────────────────────────────────────────────────── */

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
    sku: field("AAA1804916"),
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
/** 이 테스트가 부른 모든 URL. "등록 API 0건"을 이걸로 센다. */
let calledUrls: string[] = [];

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  calledUrls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      calledUrls.push(url);
      if (url.includes("/api/lotteon/payload-preview")) {
        /* 🔴 여기서 검증기를 흉내 내는 것은 **의도한 것**이다. 이 파일이 보는
           것은 "게이트가 열린 뒤 [등록 시작]이 어디로 가는가"이지 검증 규칙이
           아니다(그건 lotteon-picked-category.test.ts가 진짜 함수로 본다).
           그래서 "전부 READY"라는 최소 응답만 돌려준다. */
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              identityError: null,
              payload: { pdNm: "테리 버뮤다 반바지" },
              validation: {
                ok: true,
                readyCount: 2,
                missingCount: 0,
                blockedCount: 0,
                fields: [
                  { field: "pdNm", label: "상품명", status: "READY" },
                  { field: "salePrc", label: "판매가", status: "READY" },
                  // 서버가 이름을 올린 채널 필드 — 🔴 필수 배지의 근거가 된다.
                  { field: "owhpNo", label: "출고지번호", status: "READY" },
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

async function mount(element: ReactElement): Promise<HTMLElement> {
  await act(async () => {
    root.render(element);
  });
  return container;
}

function lotteOnElement(): ReactElement {
  return createElement(LotteOnRegistrationPanel, {
    product: makeProduct(),
    commonPrice: { priceKrw: 128000, resolved: true },
    commonCategorySources: [{ path: ["Home", "Kids", "Shorts"], origin: "원본 상품 페이지 분류" }],
    sellerSettings: makeSellerSettings(),
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
  if (!frame) throw new Error("공용 등록 프레임이 없다");
  const [left, right] = Array.from(frame.children) as HTMLElement[];
  return { left, right };
}

/** 요약 카드 안의 **블록 머리말**만 순서대로 — 이것이 우측의 목차다. */
function summaryHeadings(right: HTMLElement): string[] {
  const card = right.querySelector('[data-summary="channel-registration"]');
  if (!card) throw new Error("공용 등록 요약 카드가 없다");
  return Array.from(card.querySelectorAll("p.uppercase")).map((el) => {
    const text = clean(el.textContent ?? "");
    // "남은 항목 3개"처럼 개수가 붙는 머리말은 개수를 벗겨 자리 이름만 남긴다.
    return text.replace(/\s*\d+개$/, "");
  });
}

/* ── ① 네 칸 · 같은 순서 ───────────────────────────────────────────────────── */

describe("REWORK-7 ① — 우측 요약은 CEO가 그린 네 칸이다", () => {
  it("세 탭 모두 요약 카드 하나만 세운다 — 채널마다 칸이 더 붙지 않는다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      expect(
        right.querySelectorAll('[data-summary="channel-registration"]').length,
        `${tab.label}: 요약 카드가 하나가 아니다`,
      ).toBe(1);
      // 카드 바깥에 우측 기둥이 뭔가를 더 세우고 있지 않다.
      expect(right.children.length, `${tab.label}: 우측에 요약 카드 밖의 칸이 있다`).toBe(1);
    }
  });

  it("🔴 세 탭의 요약 목차가 같다 — 등록 준비 상태 → (남은 항목) → 필수 확인", async () => {
    const seen: Record<string, string[]> = {};
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      seen[tab.label] = summaryHeadings(right);
    }
    for (const [label, headings] of Object.entries(seen)) {
      expect(headings[0], `${label}: 첫 칸이 등록 준비 상태가 아니다`).toBe("등록 준비 상태");
      expect(headings, `${label}: 필수 확인 칸이 없다`).toContain("필수 확인");
      // 등록을 막는 것이 있으면 「남은 항목」이 「필수 확인」보다 먼저 온다.
      if (headings.includes("남은 항목")) {
        expect(headings.indexOf("남은 항목")).toBeLessThan(headings.indexOf("필수 확인"));
      }
      // 이 셋 말고 다른 머리말이 우측에 서지 않는다.
      expect(new Set(headings)).toEqual(new Set(headings.filter((h) => ["등록 준비 상태", "남은 항목", "필수 확인"].includes(h))));
    }
  });

  it("판정 문구는 네 가지뿐이다 — 세 탭이 같은 어휘를 쓴다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const text = clean(right.textContent ?? "");
      expect(
        ["등록 가능", "등록 전 확인 필요", "등록 불가", "판매 전 확인 필요"].some((s) => text.includes(s)),
        `${tab.label}: 판정 문구가 없다`,
      ).toBe(true);
    }
  });
});

/* ── ② 🔴 상세 필드 나열 0건 ───────────────────────────────────────────────── */

describe("REWORK-7 ① — 🔴 우측 요약에 상세 필드가 나열되지 않는다", () => {
  /**
   * CEO가 지목한 그 목록이다 — BEFORE 덤프에서 우측에 **두 번** 서 있었다.
   * 「상품정보」처럼 자리 이름과 겹치는 말은 넣지 않는다(자리 이름은 허용된다).
   */
  const DETAIL_FIELD_LABELS = ["상품명", "브랜드", "대표이미지", "이미지 형식", "배송정보"];

  it("🔴 필드 이름이 요약 목록에 한 건도 없다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const listRows = Array.from(right.querySelectorAll("li")).map((li) => clean(li.textContent ?? ""));
      for (const row of listRows) {
        for (const label of DETAIL_FIELD_LABELS) {
          expect(row, `${tab.label}: 요약이 상세 필드를 나열한다 — ${label}`).not.toContain(label);
        }
      }
    }
  });

  it("요약의 체크 목록은 **자리 이름**뿐이다 — 알려진 열 개 중에서만 나온다", async () => {
    const ALLOWED = [
      "카테고리",
      "상품정보",
      "판매가격",
      "옵션",
      "상세설명",
      "배송",
      "고시정보",
      "인증",
      "판매자 설정",
      "채널 필수정보",
    ];
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const rows = Array.from(right.querySelectorAll("li"))
        .map((li) => clean(li.textContent ?? "").replace(/^[✓✗]\s*/, ""))
        .filter(Boolean);
      for (const row of rows) {
        expect(ALLOWED, `${tab.label}: 요약에 자리 이름이 아닌 줄이 있다 — ${row}`).toContain(row);
      }
    }
  });

  it("퍼센트 · 진행 막대 · 자동입력 KPI가 요약에서 사라졌다", async () => {
    for (const tab of TABS) {
      const { right } = columnsOf(await mount(tab.element()));
      const text = clean(right.textContent ?? "");
      /* 큰 퍼센트 숫자 자체가 사라졌는지를 본다 — "N%"만으로 이루어진 칸이
         하나도 없어야 한다(문장 속 "등록 가능성 100%를 통과해야" 같은 설명과
         구분하기 위해 요소 단위로 센다). */
      const percentNodes = Array.from(right.querySelectorAll("p,span,div")).filter((el) =>
        /^\d+%$/.test(clean(el.textContent ?? "")),
      );
      expect(percentNodes.map((el) => el.textContent), `${tab.label}: 우측에 퍼센트 칸이 남아 있다`).toEqual([]);
      expect(text, `${tab.label}: 우측에 자동입력 KPI가 남아 있다`).not.toContain("자동 입력");
      expect(text, `${tab.label}: 우측에 선택 입력 목록이 남아 있다`).not.toContain("선택 입력");
    }
  });
});

/* ── ③④ 등록 시작은 하나 · 같은 모달로 간다 ─────────────────────────────────── */

describe("REWORK-7 ⑤ — [등록 시작]은 하나뿐이고 최종 확인 모달로 간다", () => {
  function buttonsOf(scope: HTMLElement): string[] {
    return Array.from(scope.querySelectorAll("button")).map((b) => clean(b.textContent ?? ""));
  }

  it("🔴 [등록 시작]이 화면에 하나뿐이다 — 좌측 상세에는 없다", async () => {
    for (const tab of TABS) {
      const dom = await mount(tab.element());
      const { left, right } = columnsOf(dom);
      expect(buttonsOf(left).filter((t) => t === "등록 시작"), `${tab.label}: 좌측에 등록 시작이 있다`).toEqual([]);
      expect(buttonsOf(right).filter((t) => t === "등록 시작"), `${tab.label}: 우측 등록 시작이 하나가 아니다`).toHaveLength(1);
    }
  });

  it("좌측 상세 하단에 등록 판정이 한 번 더 서지 않는다", async () => {
    for (const tab of TABS) {
      const { left } = columnsOf(await mount(tab.element()));
      const text = clean(left.textContent ?? "");
      // 롯데ON ⑩이 들고 있던 "등록 정보 확인 — 준비 N · 누락 N · 차단 N"이 그것이었다.
      expect(text, `${tab.label}: 좌측이 등록 판정을 다시 말한다`).not.toMatch(/준비 \d+ · 누락 \d+ · 차단 \d+/);
    }
  });

  /**
   * 🔴 실제 클릭이다. 롯데ON은 예전에 브라우저 기본 확인창으로 곧장 등록으로
   * 갔다 — 세 채널 중 혼자만 다른 길이었다. 이제 같은 모달을 연다.
   *
   * 🛑 등록 API는 부르지 않는다(모달까지만 연다) — 실제 등록은 STOP 상태다.
   */
  it("🔴 롯데ON [등록 시작] 클릭 → 판매 전 최종 확인 모달이 열린다 (등록 API 0건)", async () => {
    const dom = await mount(lotteOnElement());
    // 검증이 끝나 게이트가 열렸다.
    const register = Array.from(dom.querySelectorAll("button")).find(
      (b) => clean(b.textContent ?? "") === "등록 시작",
    );
    expect(register, "등록 시작 버튼이 없다").toBeTruthy();
    expect(register!.hasAttribute("disabled"), "검증을 통과했는데 버튼이 잠겨 있다").toBe(false);

    await act(async () => {
      register!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = clean(document.body.textContent ?? "");
    expect(text, "최종 확인 모달이 열리지 않았다").toContain("판매 전 최종 확인");
    expect(text).toContain("롯데ON에 상품을 등록합니다");
    expect(text).toContain("등록되는 정보");
    expect(text).toContain("등록 후 커머스 판매자센터에서 실제 등록 결과를 확인해주세요");

    // 🛑 모달을 연 것뿐 — 등록 API는 한 번도 부르지 않았다.
    expect(calledUrls.filter((u) => u.includes("/api/lotteon/register"))).toEqual([]);
  });

  it("모달의 체크 3개를 다 켜기 전에는 [등록 시작]이 잠겨 있다", async () => {
    const dom = await mount(lotteOnElement());
    const register = Array.from(dom.querySelectorAll("button")).find(
      (b) => clean(b.textContent ?? "") === "등록 시작",
    )!;
    await act(async () => {
      register.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const checkboxes = Array.from(document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(checkboxes).toHaveLength(3);
    const confirm = () =>
      Array.from(document.body.querySelectorAll("button")).find(
        (b) => clean(b.textContent ?? "") === "등록 시작" && b.closest(".fixed") != null,
      )!;
    expect(confirm().hasAttribute("disabled"), "확인 전인데 모달의 등록 버튼이 열려 있다").toBe(true);
    expect(calledUrls.filter((u) => u.includes("/api/lotteon/register"))).toEqual([]);
  });
});

/* ── ④ 롯데ON 고유 필드의 필수/선택 구분 ──────────────────────────────────── */

describe("REWORK-7 ④ — 롯데ON 고유 필드가 🔴 필수 · ⚪ 선택으로 갈린다", () => {
  /** label 텍스트를 들고 있는 <label> 요소를 찾는다. */
  function labelFor(dom: HTMLElement, text: string): HTMLElement {
    const found = Array.from(dom.querySelectorAll("label")).find((el) =>
      clean(el.textContent ?? "").startsWith(text),
    );
    if (!found) throw new Error(`입력칸을 찾지 못했다: ${text}`);
    return found as HTMLElement;
  }

  it("서버 검증이 이름을 올린 필드는 🔴 필수다", async () => {
    const dom = await mount(lotteOnElement());
    expect(clean(labelFor(dom, "출고지번호").textContent ?? "")).toContain("🔴 필수");
  });

  it("검증이 아예 보지 않는 값은 ⚪ 선택 — 없어도 등록 가능하다고 적는다", async () => {
    const dom = await mount(lotteOnElement());
    for (const field of ["브랜드번호", "업체상품번호", "과세유형코드"]) {
      const text = clean(labelFor(dom, field).textContent ?? "");
      expect(text, `${field}: 선택 표시가 없다`).toContain("⚪ 선택 — 없어도 등록 가능");
    }
  });

  it("🔴 판정을 화면이 만들지 않는다 — 검증 전에는 필수도 선택도 적지 않는다", async () => {
    /* 서버가 답하기 전에는 아무 배지도 붙지 않아야 한다. payload-preview가
       영영 돌아오지 않는 상황을 만들어 그 순간을 붙잡는다. */
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const url = String(input);
        calledUrls.push(url);
        if (url.includes("/api/lotteon/payload-preview")) return new Promise(() => {});
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, profiles: [] }) });
      }),
    );
    const dom = await mount(lotteOnElement());
    const text = clean(dom.textContent ?? "");
    expect(text, "검증 전인데 필수라고 단정했다").not.toContain("🔴 필수");
    expect(text, "검증 전인데 선택이라고 단정했다").not.toContain("⚪ 선택");
  });
});

/* ── 자리 단위로 접는 규칙 ─────────────────────────────────────────────────── */

describe("REWORK-7 ① — 필수 확인은 자리 단위다(판정이 아니라 접기)", () => {
  function item(label: string, sectionId: string | undefined, passed: boolean): ReadinessItem {
    return { label, passed, required: true, sectionId };
  }

  it("한 자리에 미통과가 하나라도 있으면 그 자리는 ✗다", () => {
    expect(
      buildSummaryChecks([
        item("상품명", "section-basic", true),
        item("브랜드", "section-basic", true),
        item("대표이미지", "section-images", false),
      ]),
    ).toEqual([{ label: "상품정보", passed: false }]);
  });

  it("롯데ON의 lotteon- 접두사 자리도 같은 이름으로 모인다", () => {
    expect(buildSummaryChecks([item("표준카테고리", "lotteon-section-category", true)])).toEqual([
      { label: "카테고리", passed: true },
    ]);
  });

  it("요구되지 않은 자리는 아예 나오지 않는다 — 통과한 적 없는 것을 ✓로 그리지 않는다", () => {
    const checks = buildSummaryChecks([item("카테고리", "section-category", true)]);
    expect(checks.map((c) => c.label)).toEqual(["카테고리"]);
  });

  it("갈 곳이 /settings인 항목은 「판매자 설정」으로 모인다", () => {
    expect(
      buildSummaryChecks([{ label: "출고지", passed: false, required: true, externalHref: "/settings" }]),
    ).toEqual([{ label: "판매자 설정", passed: false }]);
  });
});

/* ── 이름과 이동 경로는 「남은 항목」이 말한다 ─────────────────────────────── */

describe("REWORK-7 ① — 접힌 이름은 남은 항목 1위가 됐을 때 이동 경로와 함께 선다", () => {
  /**
   * 요약이 이름을 나열하지 않는다고 해서 이름이 사라지는 것은 아니다.
   * 「판매자 설정」으로 접힌 항목이 남은 항목 1위가 되면, 그 항목이 자기 이름과
   * [이동]을 달고 펼쳐진다(REWORK-4 §2의 "한 번에 하나" 규칙 그대로).
   */
  it("셀러 설정 항목이 1위면 이름과 /settings 이동 경로가 함께 선다", async () => {
    const dom = await mount(
      createElement(ChannelRegistrationSummary, {
        state: "NEEDS_REVIEW" as const,
        priorityItems: [
          {
            key: "settings-출고지",
            label: "출고지",
            detail: "Settings에서 해결 — 출고지가 등록돼 있지 않습니다",
            externalHref: "/settings",
            sourceItems: [],
          },
        ],
        required: [{ label: "출고지", passed: false, required: true, externalHref: "/settings" }],
        allRequiredPassed: false,
        status: "DRAFT" as const,
        onRegister: () => {},
      } as never),
    );
    const text = clean(dom.textContent ?? "");
    expect(text).toContain("남은 항목 1개");
    expect(text, "1위가 됐는데도 이름이 없다").toContain("출고지");
    const links = Array.from(dom.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links, "갈 곳 없는 안내가 됐다").toContain("/settings");
    // 그래도 체크 목록은 자리 이름 하나뿐이다.
    const rows = Array.from(dom.querySelectorAll("li")).map((li) => clean(li.textContent ?? ""));
    expect(rows).toEqual(["✗ 판매자 설정".replace(" ", "")]);
  });
});
