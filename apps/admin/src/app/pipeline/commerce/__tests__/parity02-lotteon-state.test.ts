// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { RegistrationReadinessCard } from "../RegistrationReadinessCard";
import { ReadOnlyFieldRow } from "../registration-fields";
import { summarizeCommonProduct } from "../lotteon-channel-form";
import { mountExpanded, unmountTab } from "./mount-registration-tab";
import { manufacturerFixture } from "./manufacturer-fixture";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMERCE-UI-PARITY-02(CEO 작업지시서, 2026-09-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO가 실제 Production 화면에서 본 두 가지:
 *
 *   ① 우측 등록 요약이 「필수 확인 / 확인 중…」에서 멈춤
 *   ② 색상·사용연령·품명·모델명이 「입력 필요」 — 쿠팡에서는 같은 상품 같은 칸이
 *      「상세페이지 참조로 등록됩니다」
 *
 * ── ①의 실체(Production 로그 실측, 2026-09-22) ─────────────────────────────
 *   /api/lotteon/payload-preview    → 207 identity   NETWORK_ERROR 20,177ms timeout
 *   /api/lotteon/category-recommend → 205 카테고리 1p NETWORK_ERROR 20,387ms timeout
 *   /api/lotteon/delivery-settings  → 207 identity   NETWORK_ERROR 20,175ms timeout
 *
 * 멈춘 것이 아니라 20초를 기다렸다가 **실패**한 것이고, 그 실패가 화면에
 * 도착하지 못했다. 아래 검사는 **네트워크가 실패했을 때 화면이 무엇을 말하는가**
 * 를 고정한다 — 네트워크를 고치는 검사가 아니다(그것은 우리 코드 밖이다).
 *
 * 🔴 이 파일은 fixture로 PASS를 만들지 않는다. 쓰이는 실패 응답은 Production
 *    로그가 실제로 만든 그 응답의 모양 그대로다.
 */

const field = <T,>(value: T, source: FieldSource = "ORIGINAL") =>
  ({ value, source, confidence: source === "REQUIRED" ? 0 : 1 }) as never;

function makeProduct(overrides: Partial<Record<string, unknown>> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field("", "REQUIRED"),
    color: field("", "REQUIRED"),
    recommendedAge: field("", "REQUIRED"),
    manufacturer: field("", "REQUIRED"),
    careInstructions: field("", "REQUIRED"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
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
    importer: field("", "REQUIRED"),
    childCertification: field(null),
    itemName: field("", "REQUIRED"),
    modelName: field("", "REQUIRED"),
    weight: field("", "REQUIRED"),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
    ...overrides,
  } as unknown as CanonicalProduct;
}

/** 상품 정보 탭에서 「선택 N건 상세페이지 참조로 일괄 등록」을 누른 뒤의 상품.
 *  CommerceWorkspace L869 그대로 — **값은 비우고 source만 바꾼다.** */
function afterBulkReference(): CanonicalProduct {
  return makeProduct({
    color: field("", "DETAIL_PAGE_REFERENCE"),
    recommendedAge: field("", "DETAIL_PAGE_REFERENCE"),
    itemName: field("", "DETAIL_PAGE_REFERENCE"),
    modelName: field("", "DETAIL_PAGE_REFERENCE"),
  });
}

const PRICE = { priceKrw: 128_000, resolved: true };
const rowOf = (product: CanonicalProduct, label: string) =>
  summarizeCommonProduct(product, PRICE).rows.find((row) => row.label === label);

/* ════════════════════════════════════════════════════════════════════════════
   P0-3 ㉠ — 상태 «계약»: 참조는 값이 아니라 source 로 산다
   ════════════════════════════════════════════════════════════════════════════ */

describe("P0-3 ㉠ 공통 상품정보 요약이 필드의 source 를 버리지 않는다", () => {
  it.each(["색상", "사용연령", "품명", "모델명"])(
    "🔴 «%s» — 일괄 참조 뒤 값은 여전히 비어 있지만 source 는 DETAIL_PAGE_REFERENCE 로 실린다",
    (label) => {
      const row = rowOf(afterBulkReference(), label)!;
      expect(row.value).toBeNull(); // 값을 지어내지 않는다
      expect(row.source).toBe("DETAIL_PAGE_REFERENCE");
    },
  );

  it.each(["색상", "사용연령", "품명", "모델명"])(
    "«%s» — 참조 «전»에는 REQUIRED 그대로다(두 상태가 뭉개지지 않는다)",
    (label) => {
      expect(rowOf(makeProduct(), label)!.source).toBe("REQUIRED");
    },
  );

  it("🔴 값을 여러 개 조립해 만든 행은 source 를 «주지 않는다» — 없는 출처를 지어내지 않는다", () => {
    for (const label of ["상품명", "대표이미지", "상세페이지", "판매가격", "옵션", "재고"]) {
      expect(rowOf(afterBulkReference(), label)!.source).toBeUndefined();
    }
  });

  it("🔴 참조는 등록 필수 판정을 바꾸지 않는다 — missing 은 그대로 false 다(§STEP 8)", () => {
    const before = summarizeCommonProduct(makeProduct(), PRICE);
    const after = summarizeCommonProduct(afterBulkReference(), PRICE);
    expect(after.rows.map((r) => r.missing)).toEqual(before.rows.map((r) => r.missing));
    expect(after.hasMissing).toBe(before.hasMissing);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   P0-3 ㉡ — 렌더: 참조와 «빈 값» 이 같은 말을 쓰지 않는다
   ════════════════════════════════════════════════════════════════════════════ */

describe("P0-3 ㉡ ReadOnlyFieldRow — 참조 ≠ 입력 필요", () => {
  const draw = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(ReadOnlyFieldRow, {
        label: "색상",
        value: "",
        placeholder: "입력 필요 — 상품정보에서 채워주세요",
        ...props,
      } as never),
    );

  it("🔴 referenced — 쿠팡과 «같은 문장»을 쓴다", () => {
    const html = draw({ referenced: true });
    expect(html).toContain("상세페이지 참조로 등록됩니다");
    expect(html).not.toContain("입력 필요");
  });

  it("🔴 referenced 아님 — 예전 그대로 「입력 필요」다(무회귀)", () => {
    const html = draw({ referenced: false });
    expect(html).toContain("입력 필요 — 상품정보에서 채워주세요");
    expect(html).not.toContain("상세페이지 참조로 등록됩니다");
  });

  it("🔴 값이 실제로 있으면 참조 문구가 값을 «덮지 않는다»", () => {
    const html = draw({ value: "네이비", referenced: true });
    expect(html).toContain("네이비");
    expect(html).not.toContain("상세페이지 참조로 등록됩니다");
  });

  it("참조 칸은 상태를 렌더 결과에 이름으로 남긴다(클래스 이름에 기대지 않기 위해)", () => {
    expect(draw({ referenced: true })).toContain('data-field-state="detail-page-reference"');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   P0-3 ㉢ — 탭을 통째로 그린다: CEO가 본 그 네 칸
   ════════════════════════════════════════════════════════════════════════════ */

describe("P0-3 ㉢ 롯데ON 탭 — CEO가 「입력 필요」로 본 네 칸", () => {
  afterEach(async () => {
    await unmountTab();
    vi.unstubAllGlobals();
  });

  async function drawTab(product: CanonicalProduct): Promise<string> {
    // 네트워크는 이 검사의 대상이 아니다 — Production과 같은 실패로 고정해 둔다.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const container = await mountExpanded(
      createElement(LotteOnRegistrationPanel, {
        product,
        commonPrice: PRICE,
        commonCategorySources: [],
        onEditCommonInfo: () => {},
        manufacturerResolution: manufacturerFixture(),
      } as never),
    );
    return container.innerHTML;
  }

  it("🔴 일괄 참조 뒤에는 그 네 칸이 「상세페이지 참조로 등록됩니다」다", async () => {
    const html = await drawTab(afterBulkReference());
    const referenced = html.split('data-field-state="detail-page-reference"').length - 1;
    // 색상 · 사용연령 · 품명 · 모델명
    expect(referenced).toBeGreaterThanOrEqual(4);
    expect(html).toContain("상세페이지 참조로 등록됩니다");
  });

  it("🔴 참조 «전»에는 같은 칸이 「입력 필요」다 — 이 검사가 참조 문구를 늘 통과시키지 않는다", async () => {
    const html = await drawTab(makeProduct());
    expect(html).toContain("입력 필요 — 상품정보에서 채워주세요");
    expect(html).not.toContain('data-field-state="detail-page-reference"');
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   P0-1 — 우측 요약: 「확인 중」 · 「실패」 · 「아직 안 함」 은 서로 다른 말이다
   ════════════════════════════════════════════════════════════════════════════ */

describe("P0-1 ㉠ 공용 요약 카드는 세 상태를 이미 구분한다", () => {
  const NOT_RUN = "아직 확인하지 않았습니다";
  const card = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      createElement(RegistrationReadinessCard, {
        required: [],
        allRequiredPassed: false,
        status: "DRAFT",
        onRegister: () => {},
        percentUnavailable: createElement("p", null, `${NOT_RUN} — 아래 [등록 정보 확인]을 눌러 주세요.`),
        ...props,
      } as never),
    );

  it("CHECKING — 「확인 중…」과 무엇을 기다리는지 한 줄", () => {
    const html = card({ isCalculating: true });
    expect(html).toContain("확인 중…");
    expect(html).not.toContain(NOT_RUN);
  });

  it("🔴 ERROR — 실패는 «실패»로 말한다. 「아직 확인하지 않았습니다」로 바꿔 말하지 않는다", () => {
    const html = card({
      // Production 로그가 실제로 만든 그 문장(classifyLotteOnNetworkError).
      errorMessage: "롯데ON 응답이 제한 시간 안에 오지 않았습니다.",
      onRetry: () => {},
    });
    expect(html).toContain("등록 가능 여부 확인 실패");
    expect(html).toContain("롯데ON 응답이 제한 시간 안에 오지 않았습니다.");
    expect(html).toContain("다시 확인");
    expect(html).not.toContain(NOT_RUN);
  });

  it("NOT_RUN — 정말 한 번도 돌지 않았을 때만 그렇게 말한다", () => {
    const html = card({});
    expect(html).toContain(NOT_RUN);
    expect(html).not.toContain("등록 가능 여부 확인 실패");
  });
});

describe("P0-1 ㉡ 롯데ON 탭 — 20초 뒤 timeout 이 화면에 «도착»한다", () => {
  afterEach(async () => {
    await unmountTab();
    vi.unstubAllGlobals();
  });

  /** Production 로그 실측(2026-09-22)이 만든 payload-preview 실패 응답 그대로. */
  const TIMEOUT_RESPONSE = {
    ok: false,
    reason: "NETWORK_ERROR",
    step: "207 identity(거래처 조회)",
    elapsedMs: 20_177,
    proxyProvider: "OCI",
    message: "롯데ON 응답이 제한 시간 안에 오지 않았습니다.",
    nextAction: "잠시 후 [다시 확인]을 눌러 주세요. 계속 반복되면 롯데ON 점검 여부를 확인해야 합니다.",
  };

  it("🔴 실패 사유가 우측 요약에 서고, 「아직 확인하지 않았습니다」가 «아니다»", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => TIMEOUT_RESPONSE } as never),
    );
    const container = await mountExpanded(
      createElement(LotteOnRegistrationPanel, {
        product: makeProduct(),
        commonPrice: PRICE,
        commonCategorySources: [],
        onEditCommonInfo: () => {},
        manufacturerResolution: manufacturerFixture(),
      } as never),
    );
    const html = container.innerHTML;
    expect(html).toContain("등록 가능 여부 확인 실패");
    expect(html).toContain("롯데ON 응답이 제한 시간 안에 오지 않았습니다.");
    expect(html).not.toContain("아직 확인하지 않았습니다");
  });

  it("🔴 로딩이 «끝난다» — 응답이 온 뒤 화면에 「확인 중…」이 남지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => TIMEOUT_RESPONSE } as never),
    );
    const container = await mountExpanded(
      createElement(LotteOnRegistrationPanel, {
        product: makeProduct(),
        commonPrice: PRICE,
        commonCategorySources: [],
        onEditCommonInfo: () => {},
        manufacturerResolution: manufacturerFixture(),
      } as never),
    );
    expect(container.innerHTML).not.toContain("확인 중…");
  });
});
