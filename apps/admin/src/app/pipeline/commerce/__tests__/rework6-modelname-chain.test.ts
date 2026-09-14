// @vitest-environment jsdom
import { act, createElement, useEffect, useMemo, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { computeNaverPayloadReadiness } from "../readiness";

/**
 * REWORK-6 ①(CEO 판정, 2026-09-14) — **화면과 payload가 같은 말을 하는가.**
 *
 * ── 신고된 상태 ───────────────────────────────────────────────────────────
 *   직접 입력        → USER_EDITED → payload 반영                 PASS
 *   상세페이지 참조   → 화면은 "참조로 등록됩니다"라고 하는데
 *                     naverShoppingSearchInfo.modelName은 끝내 빈다  🔴 FAIL
 * CEO 판정: "화면에는 참조로 등록됐다고 나오는데 payload에서는 빈 값이면
 * 사용자를 속이는 UI다."
 *
 * ── 조사 결과(A/B 판정) ───────────────────────────────────────────────────
 * 모델명 입력칸 하나가 두 곳으로 나간다:
 *   productInfoProvidedNotice(KIDS).modelName   참조 대체 **허용**
 *   naverShoppingSearchInfo.modelName           카탈로그 검색·연결용
 *
 * 네이버가 카탈로그 모델명에 "상품 상세페이지 참조" 문자열을 허용한다는 근거는
 * **찾지 못했다.** 공식 커머스 API GitHub Discussion #2136("어린이인증 대상
 * 카테고리 상품은 카탈로그 입력이 필수입니다") · #979 · #1878 어디에도 그
 * 문구를 허용한다는 언급이 없고, 이 저장소의 기존 주석
 * (validate-payload.ts N-3.71 STEP8)도 같은 결론을 이미 적어 두었다 —
 * "이 값은 '상세페이지 참조'로 대체할 수 있다는 근거가 없어 … BLOCK한다".
 * → **B로 처리한다(안전한 쪽).** 참조 문자열을 카탈로그로 흘려보내지 않는다
 * (네이버에 거짓 데이터를 보내는 일이다). 대신 참조를 고른 **그 자리에서**
 * 쓸 수 없다고 말하고 직접 입력을 요구한다.
 *
 * ── 이 파일이 고정하는 것 ─────────────────────────────────────────────────
 * CEO가 지정한 **전체 사슬 7단계**를 실제 마운트·클릭·타이핑으로 끝까지 밟는다.
 *   ① 부족 항목 발견 → ② 왜 필요한지 → ③ 어디에서 입력 → ④ 해당 위치 이동
 *   → ⑤ 실제 값 변경 → ⑥ readiness 재계산 → ⑦ 부족 항목에서 제거
 * 정적 렌더로 판정하지 않는다 — 이 화면에는 fetch 이후에만 존재하는 상태가
 * 있어서 정적 렌더는 "있다"도 "없다"도 증명하지 못한 전례가 있다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL") {
  return { value, source, confidence: 1 } as never;
}

/**
 * 🔴 모델명 **하나만** 남기려고 만든 상품이다. 나머지(KC 인증정보 · 고시 ·
 * 원산지 · 배송)는 전부 채워져 있어서, 우선순위 카드의 1번이 반드시 이
 * 필드가 된다 — "먼저 해결할 항목 1개"가 다른 것이면 셀러는 모델명 카드를
 * 영영 보지 못하고, 그러면 사슬의 ①~④를 검사할 수 없다.
 *
 * description에 "Product code" 표기가 없다는 것이 핵심이다 —
 * resolveModelNameFromDescription()이 실패하는 실제 조건이고, 그때만 이
 * 필드가 셀러의 입력에 의존한다.
 */
function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
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
        originalUrl: "https://example.com/images/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field("테리 버뮤다 반바지"),
    descriptionKo: field("부드러운 테리 소재 반바지입니다."),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field("따져코리아"),
    childCertification: field(
      {
        name: "한국기계전기전자시험연구원",
        companyName: "보보쇼즈",
        certificationNumber: "CB123456789",
        certificationDate: "2026-01-02",
      },
      "USER_EDITED",
    ),
    itemName: field("아동용 반바지"),
    // 🔴 출발점 — 셀러가 "상세페이지 참조"를 이미 눌러 둔 상태다. CEO가 지목한
    //    바로 그 경로이고, 화면이 "등록됩니다"라고 말하는 그 상태다.
    modelName: field("", "DETAIL_PAGE_REFERENCE"),
    weight: field("120g"),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
    ...overrides,
  } as unknown as CanonicalProduct;
}

/** 배송/주소/원산지 — 이 테스트의 관심사가 아니라 전부 채워 둔다. */
const PAYLOAD_ARGS = {
  leafCategoryId: "50000167",
  releaseAddressBookNo: "1",
  refundAddressBookNo: "1",
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "따져 고객센터",
  afterServiceTelephoneNumber: "02-000-0000",
  childCertificationInfoId: 1041,
  // 어린이인증 대상 카테고리 — naverShoppingSearchInfo.modelName이 NotEmpty로
  // 요구되는 바로 그 조건이다(N-3.65, 실제 등록 거부로 확인된 것).
  categoryRequiresChildCertification: true,
} as const;

function listingOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

function payloadOf(product: CanonicalProduct) {
  return buildNaverProductPayload({ product, listing: listingOf(product), ...PAYLOAD_ARGS } as never);
}

/**
 * 🔴 **서버 판정을 흉내 내지 않는다.** CommerceWorkspace는 product가 바뀔
 * 때마다 /api/naver/payload-preview를 다시 불러 validateNaverPayload() 결과를
 * 받아 온다. 여기서는 그 왕복만 생략하고 **같은 함수**를 그대로 부른다 —
 * 손으로 지어낸 validation을 쓰면 "readiness가 재계산된다"를 검사할 수 없다.
 */
function validationOf(product: CanonicalProduct) {
  return validateNaverPayload(
    payloadOf(product),
    {
      product,
      ...PAYLOAD_ARGS,
      returnCompaniesFetchFailed: false,
      originAreaRequiresImporter: false,
    } as never,
    true,
  );
}

let container: HTMLDivElement;
let root: Root;
let product: CanonicalProduct;

beforeEach(() => {
  // @ts-expect-error — React가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom에는 scrollIntoView가 없다. [이동] 버튼이 실제로 부르는 함수라
  // 없으면 그 클릭이 requestAnimationFrame 안에서 터진다 — 스크롤 동작
  // 자체는 이 테스트의 명제가 아니므로 자리만 채운다.
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

/**
 * CommerceWorkspace와 같은 구조 — 상품을 React가 들고 있고, updateField/
 * setFieldReference가 그것을 갈아끼우면 validation이 **그 상품으로 다시**
 * 계산된다(실제 화면에서는 그 자리에 서버 왕복이 있다).
 */
function Harness({ initial }: { initial: CanonicalProduct }) {
  const [current, setCurrent] = useState(initial);
  const validation = useMemo(() => validationOf(current), [current]);
  useEffect(() => {
    product = current;
  }, [current]);
  return createElement(PlatformPreview, {
    product: current,
    listing: listingOf(current),
    categoryCandidates: [],
    listingStatus: "DRAFT" as const,
    listingResult: null,
    naverValidation: validation,
    naverValidationLoading: false,
    naverValidationError: null,
    onFixTextField: (key: string, value: string) =>
      setCurrent((prev) => ({ ...prev, [key]: { value, source: "USER_EDITED", confidence: 1 } })),
    onSetFieldReference: (key: string, referenced: boolean) =>
      setCurrent((prev) => ({
        ...prev,
        [key]: referenced
          ? { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }
          : { value: "", source: "REQUIRED", confidence: 0 },
      })),
    onSelectCategory: () => {},
    onOpenListingModal: () => {},
    onRetryListing: () => {},
    developerMode: false,
  } as never);
}

async function render(initial: CanonicalProduct): Promise<void> {
  await act(async () => {
    root.render(createElement(Harness, { initial }));
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** 「기본정보」 아코디언 안의 "모델명" 줄(라벨 → 그 줄 전체). */
function modelNameRow(): HTMLElement {
  const label = Array.from(container.querySelectorAll("label")).find(
    (l) => (l.textContent ?? "").trim() === "모델명",
  );
  if (!label) throw new Error("「기본정보」에 '모델명' 라벨이 없다");
  const row = label.closest("div")?.parentElement;
  if (!row) throw new Error("'모델명' 줄을 찾지 못했다");
  return row as HTMLElement;
}

/**
 * 🔴 반드시 **모델명 줄 안에서** 누른다 — 「기본정보」에는 참조 가능한 필드가
 * 여럿이라 "상세페이지 참조로 등록" 버튼이 여러 개 있다. 화면 전체에서 첫
 * 번째를 누르면 엉뚱한 줄을 건드리고도 테스트는 초록으로 지나간다.
 */
async function clickInModelNameRow(label: string): Promise<void> {
  const button = Array.from(modelNameRow().querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").trim().includes(label),
  );
  if (!button) throw new Error(`모델명 줄에 "${label}" 버튼이 없다`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickAnywhere(label: string): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(label),
  );
  if (!button) throw new Error(`"${label}" 버튼이 화면에 없다`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** 실제 타이핑 — controlled input에 값을 넣고 focusout까지 한다(EditableText는
 *  blur 시점에만 onCommit한다). */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    input.focus();
  });
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.blur();
  });
}

/** 지금 화면이 읽고 있는 것과 **같은** 부족 항목 목록. */
function missingLabels(): string[] {
  return computeNaverPayloadReadiness(validationOf(product))
    .required.filter((i) => !i.passed)
    .map((i) => i.label);
}

const CATALOG_MODEL_NAME = "네이버 쇼핑 카탈로그 모델명";

/* ── 0. 조사 결과가 코드에 그대로 서 있는가 ────────────────────────────────── */

describe("REWORK-6 ① — 참조 문자열은 카탈로그 모델명으로 나가지 않는다(B 판정)", () => {
  it("🔴 참조를 골라도 naverShoppingSearchInfo.modelName은 비어 있다 — 거짓 데이터를 보내지 않는다", () => {
    const payload = payloadOf(makeProduct());
    expect(
      payload.originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName,
      "참조 문구가 카탈로그 모델명으로 새어 나갔다",
    ).toBeUndefined();
  });

  it("고시정보 모델명 쪽은 참조로 정상 대체된다 — 두 필드의 규칙이 서로 다르다", () => {
    const notice = payloadOf(makeProduct()).originProduct.detailAttribute?.productInfoProvidedNotice as
      | { kids?: { modelName?: string } }
      | undefined;
    expect(notice?.kids?.modelName).toBe("상품 상세페이지 참조");
  });
});

/* ── 1. 화면이 그 사실을 그 자리에서 말하는가 ──────────────────────────────── */

describe("REWORK-6 ① — 참조를 고른 자리에서 '쓸 수 없다'고 말한다", () => {
  it("🔴 참조 상태의 모델명 줄이 카탈로그에는 쓸 수 없다고 적는다 — 조용히 비우지 않는다", async () => {
    await render(makeProduct());
    const row = modelNameRow().textContent ?? "";
    expect(row).toContain("상세페이지 참조로 등록됩니다");
    expect(row, "참조가 통하지 않는 쪽을 그 자리에서 말하지 않는다").toContain(CATALOG_MODEL_NAME);
    expect(row).toContain("직접 입력해야");
  });

  it("직접 입력으로 돌아가는 길이 같은 줄 안에 있다", async () => {
    await render(makeProduct());
    const labels = Array.from(modelNameRow().querySelectorAll("button")).map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(labels).toContain("직접 입력으로 전환");
  });

  it("누르기 전에도 그 버튼이 무엇을 못 하는지 적혀 있다", async () => {
    await render(makeProduct({ modelName: field("", "REQUIRED") }));
    const row = modelNameRow().textContent ?? "";
    expect(row).toContain("상세페이지 참조로 등록");
    expect(row).toContain(CATALOG_MODEL_NAME);
  });
});

/* ── 2. CEO 지정 전체 사슬 7단계 ───────────────────────────────────────────── */

describe("REWORK-6 ① — 전체 사슬(부족 발견 → 이동 → 입력 → 재계산 → 제거)", () => {
  it("🔴 7단계를 한 번에 끝까지 밟는다", async () => {
    await render(makeProduct());

    /* ① 부족 항목 발견 — 남은 항목 1번이 이 필드다.
       REWORK-7 ①(2026-09-15) — 머리말이 "먼저 해결할 항목 1개" → "남은 항목 1개". */
    const before = text();
    expect(before).toContain("남은 항목 1개");
    expect(before, "부족 항목에 카탈로그 모델명이 서 있지 않다").toContain(CATALOG_MODEL_NAME);
    expect(before, "필드 경로를 날것으로 읽어 주면 안 된다").not.toContain("naverShoppingSearchInfo");
    expect(missingLabels()).toContain(CATALOG_MODEL_NAME);

    /* ② 왜 필요한가 — 카탈로그에 필요한 값이라고 말한다. */
    expect(before).toContain("네이버 쇼핑 카탈로그 검색");

    /* ③ 어디에서 입력 — 「기본정보」를 지목한다. */
    expect(before).toContain("이 화면의 「기본정보」에서 입력합니다.");

    /* ④ 해당 위치 이동 — [이동] 버튼을 실제로 누른다. */
    await clickAnywhere("「기본정보」에서 입력하기 →");
    // 이동한 자리에 정말 그 줄이 서 있다(누른 뒤 「기본정보」가 펼쳐진 상태).
    expect(modelNameRow().textContent ?? "").toContain("상세페이지 참조로 등록됩니다");

    /* ⑤ 실제 값 변경 — 참조를 풀고 직접 입력한다. */
    await clickInModelNameRow("직접 입력으로 전환");
    const input = modelNameRow().querySelector("input");
    expect(input, "전환했는데 입력칸이 나타나지 않았다").not.toBeNull();
    await type(input as HTMLInputElement, "B226AC043 AW26");

    expect(product.modelName.value).toBe("B226AC043 AW26");
    expect(product.modelName.source).toBe("USER_EDITED");
    // 화면이 아니라 payload가 대답해야 한다.
    expect(
      payloadOf(product).originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName,
    ).toBe("B226AC043 AW26");

    /* ⑥ readiness 재계산 — 서버 판정 함수가 이 필드를 더 이상 막지 않는다.
       (validate-payload.ts는 이 필드가 비었을 때만 항목을 만든다 — 채워지면
       BLOCKED 항목 자체가 사라지는 것이 "막지 않는다"의 형태다.) */
    const recomputed = validationOf(product);
    expect(
      recomputed.fields.filter((f) => f.field === "naverShoppingSearchInfo.modelName"),
      "값을 넣었는데 서버 판정이 여전히 이 필드를 들고 있다",
    ).toEqual([]);
    expect(recomputed.blockedCount).toBeLessThan(validationOf(makeProduct()).blockedCount);

    /* ⑦ 부족 항목에서 제거 — 화면에서도 사라진다. */
    expect(missingLabels(), "값을 넣었는데 부족 항목에 그대로 남아 있다").not.toContain(
      CATALOG_MODEL_NAME,
    );
    // 우측 요약이 그 사실을 그대로 말한다 — 남은 항목 블록이 통째로 사라진다.
    /* REWORK-7 ①(2026-09-15) — 머리말이 "먼저 해결할 항목 1개" → "남은 항목 N개",
       판정 문구가 "등록 준비 완료" → "등록 가능"으로 짧아졌다. 사슬(⑦ 부족 항목이
       화면에서 사라진다)을 보는 방식은 그대로다 — 이제 그 블록이 **통째로 서지
       않는 것**이 증거다(전부 통과하면 남은 항목 칸 자체를 그리지 않는다). */
    const after = text();
    expect(after, "남은 항목 카드가 아직 서 있다 — 부족 항목이 남았다는 뜻이다").not.toContain(
      "남은 항목",
    );
    expect(after).toContain("등록 가능");
    // 🔴 화면에 남은 "네이버 쇼핑 카탈로그 모델명"은 **부족 항목이 아니라**
    //    모델명 입력칸 옆의 사전 안내 한 줄뿐이다(참조 버튼이 무엇을 못 하는지).
    //    그 문구가 부족 항목 목록에서 사라졌다는 것이 위 missingLabels()다.
    expect(modelNameRow().textContent ?? "").toContain(CATALOG_MODEL_NAME);
  });

  /**
   * 🔴 사슬이 **참조 상태에서 출발해도** 끊기지 않는다는 것이 이번 판정의
   * 핵심이다. 참조를 골라 둔 셀러는 화면상 "등록됩니다"를 보고 있었고, 그
   * 상태에서 우선순위 카드가 여전히 이 필드를 지목해야 막다른 길이 아니다.
   */
  it("참조 상태에서도 [이동] 버튼이 그려진다 — action이 null이면 카드가 안내만 하고 끝난다", async () => {
    await render(makeProduct());
    const labels = Array.from(container.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim());
    expect(labels).toContain("「기본정보」에서 입력하기 →");
  });
});

/* ── 3. REWORK-7 ③ — SKU는 카탈로그 모델명이 아니다 ────────────────────────── */

/**
 * REWORK-7 ③(CEO 지시, 2026-09-15) — **"상품코드(SKU) AAA1804916이 있는데
 * readiness는 modelName이 없다고 한다"의 답을 코드에 못 박는다.**
 *
 * 판정: **B — SKU와 카탈로그 modelName은 별개다(입력 위치 UX 버그).**
 *
 * ── 근거 ① 같은 payload가 둘을 **다른 자리**로 보낸다 ─────────────────────
 *   product.sku            → originProduct.sellerManagementCode  (판매자 상품코드)
 *   카탈로그 모델명        → …detailAttribute.naverShoppingSearchInfo.modelName
 * 한 요청이 두 칸을 동시에 들고 나간다. 같은 개념이면 네이버 스키마에 칸이
 * 둘일 이유가 없다. 아래 테스트가 그 사실을 payload로 직접 확인한다.
 *
 * ── 근거 ② 원본 판매처가 이미 둘을 나눠 준다(라이브 실측) ─────────────────
 * Smallable JSON-LD(docs/matching-3.2-d-color-authority.md에 전문 기록):
 *   {"model":"430663", "sku":"AAA1804712", "color":"Lavender"}
 * AAA 접두사 값은 **판매처 자신의 재고번호**이고 모델번호는 별도 필드다.
 * 이 저장소는 그 구분을 이미 독립적으로 세워 두었다 —
 * crawler/comparison-search/seller-facts.ts: "판매처 자신의 상품코드/재고번호.
 * 브랜드 품번이 아니다." (brandModelCode에 넣으면 근거 없는 SAME이 만들어진다)
 *
 * ── 근거 ③ naverShoppingSearchInfo의 형제가 말해 준다 ─────────────────────
 * 이 객체에 함께 사는 필드는 manufacturerName · brandName이다(제조사 층위).
 * 판매자 재고번호가 낄 자리가 아니다.
 *
 * 🔴 그래서 SKU를 modelName에 복사하지 않는다. 이 테스트는 미래의 누군가가
 * "값이 있는데 왜 안 쓰냐"며 배선을 이어 붙이는 것을 막는 못이다.
 */
describe("REWORK-7 ③ — SKU는 카탈로그 모델명이 아니다(B 판정을 고정한다)", () => {
  const SELLER_STOCK_CODE = "AAA1804916";

  it("SKU는 sellerManagementCode로 간다 — 카탈로그 모델명 자리에 복사되지 않는다", () => {
    const product = makeProduct({ sku: field(SELLER_STOCK_CODE, "ORIGINAL") } as never);
    const origin = payloadOf(product).originProduct;
    expect(origin.sellerManagementCode, "SKU가 판매자 상품코드 자리에 안 들어간다").toBe(SELLER_STOCK_CODE);
    expect(
      origin.detailAttribute?.naverShoppingSearchInfo?.modelName,
      "🔴 판매처 재고번호가 카탈로그 모델명으로 새어 들어갔다",
    ).not.toBe(SELLER_STOCK_CODE);
  });

  it("SKU만 있고 모델명이 비면 카탈로그 모델명은 여전히 비어 있다 — 그래서 readiness가 막는다", () => {
    const product = makeProduct({
      sku: field(SELLER_STOCK_CODE, "ORIGINAL"),
      modelName: field("", "ORIGINAL"),
    } as never);
    expect(payloadOf(product).originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName).toBeUndefined();
    // 판정은 그대로다 — 값이 없으니 없다고 말한다(SKU로 메우지 않는다).
    expect(
      validationOf(product).fields.some((f) => f.field === "naverShoppingSearchInfo.modelName"),
      "SKU가 있다고 해서 카탈로그 모델명 판정이 조용히 통과되면 안 된다",
    ).toBe(true);
  });

  it("셀러가 기본정보에 직접 넣은 모델명만 카탈로그로 간다 — SKU와 서로 다른 값이 각자 자리로", () => {
    const product = makeProduct({
      sku: field(SELLER_STOCK_CODE, "ORIGINAL"),
      modelName: field("B226AC043", "USER_EDITED"),
    } as never);
    const origin = payloadOf(product).originProduct;
    expect(origin.sellerManagementCode).toBe(SELLER_STOCK_CODE);
    expect(origin.detailAttribute?.naverShoppingSearchInfo?.modelName).toBe("B226AC043");
  });
});
