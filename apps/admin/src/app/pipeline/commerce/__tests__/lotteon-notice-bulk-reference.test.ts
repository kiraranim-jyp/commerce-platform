// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, FieldSource, LotteOnChannelInfo, ProvenanceField } from "@commerce/shared";
import { DETAIL_PAGE_REFERENCE_TEXT, resolveLotteOnNotice } from "@commerce/listing";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-NOTICE-BULK-REFERENCE-01 — **화면 증거** (CPO 승인 「E」, 2026-09-30)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 형제 파일 `packages/listing/src/lotteon/__tests__/notice-bulk-reference.test.ts`
 * 는 규칙(무엇을 덮지 «않는가»)을 순수 함수로 잰다. 그것만으로는 셀러가 화면에서
 * «누를 수 있는지» 를 알 수 없다 — 이 저장소에서 「함수는 되는데 화면은 안 되는」
 * 상태가 여러 번 있었다(Render PASS ≠ 소스 PASS).
 *
 * ── 🔴 왜 별 파일인가 ─────────────────────────────────────────────────────
 * `lotteon-picked-category.test.ts` 에도 마운트 하니스가 있지만, 그 파일의 preview
 * 대역은 **고시 resolver 를 일부러 돌리지 않는다**(자기 주석이 그렇게 적어 뒀다 —
 * 관심축이 안전인증이라 고시를 fixture 로 눌러 둔다). 그래서 거기서는 이 블록이
 * 아예 서지 않는다. 남의 하니스를 이 테스트에 맞게 «고치지 않고» 여기에 따로 둔다.
 *
 * ── 🔴 fills 를 지어내지 않는다 ────────────────────────────────────────────
 * 대역이 돌려주는 고시 상태는 **실제 `resolveLotteOnNotice`** 의 출력이다. 손으로
 * 적은 fills 로 재면 「테스트는 통과하는데 실제 판정과 다른」 값 위에서 증명하게 된다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 유아동(고시 품목코드 23). 0220·1830 이 셀러 입력 대상이 되는 유일한 축이다. */
const NOTICE_ITEM_CODE = "23";

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kids-shorts",
    title: field("Kids Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 89, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("유아동 반바지"),
    material: field("17% 리사이클 코튼"),
    color: field("네이비"),
    recommendedAge: field("2-3 Years"),
    manufacturer: field("Bobo Choses"),
    careInstructions: field("찬물 손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    titleKo: field("유아동 반바지"),
    descriptionKo: field("유아동 반바지"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(999),
    certification: field(""),
    importer: field("따조"),
    itemName: field("유아동 반바지"),
    modelName: field("B226AC043"),
    weight: field("120g"),
    certificationType: field(""),
    childCertification: field(null),
    images: [],
    lotteOnChannelInfo: saved,
  } as unknown as CanonicalProduct;
}

/** 셀러가 고시를 채워 둔 상태에서 시작한다 — 0220/1830 «만» 비어 있게 둔다. */
function baseChannelInfo(articleValues?: Record<string, string>): LotteOnChannelInfo {
  return {
    category: { standardCategoryNo: "BC63080300", displayCategoryNos: ["FC11130203"] },
    notice: { itemCode: NOTICE_ITEM_CODE, articlesText: "", ...(articleValues ? { articleValues } : {}) },
    certification: { safetyTarget: "EXCLUDED", safetyText: "", importProxyCode: "" },
    delivery: {},
    codes: {},
  } as unknown as LotteOnChannelInfo;
}

let saved: LotteOnChannelInfo;
let container: HTMLElement;
let root: Root;

/** 🔴 실제 resolver 로 고시 상태를 만든다. 손으로 적은 fills 를 쓰지 않는다. */
function realNoticeFills(articleValues: Record<string, string>) {
  return resolveLotteOnNotice(NOTICE_ITEM_CODE, {
    color: "네이비",
    material: "17% 리사이클 코튼",
    countryOfOrigin: "스페인",
    careInstructions: "찬물 손세탁",
    recommendedAge: "2-3 Years",
    itemName: "유아동 반바지",
    modelName: "B226AC043",
    weight: "120g",
    manufacturer: "Bobo Choses",
    importer: "따조",
    sellerArticleValues: articleValues,
  } as never).fills;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url.includes("/api/lotteon/payload-preview")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              /* 🔴 화면이 읽는 고시 상태 — 실제 resolver 출력이다. */
              notice: { fills: realNoticeFills(saved.notice.articleValues ?? {}) },
            }),
        });
      }
      /* 그 외 조회(공통코드·배송지 등)는 빈 목록으로 답한다 — 이 파일의 축이 아니다. */
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, items: [] }) });
    }),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function enterTab(): Promise<void> {
  await act(async () => {
    root.render(
      createElement(LotteOnRegistrationPanel, {
        product: makeProduct(),
        commonPrice: { priceKrw: 128000, resolved: true },
        commonCategorySources: [],
        channelInfo: saved,
        onChannelInfoChange: (info: LotteOnChannelInfo) => {
          saved = info;
        },
        onEditCommonInfo: () => {},
        manufacturerResolution: manufacturerFixture(),
        onReadinessChange: () => {},
      } as never),
    );
  });
  await act(async () => {
    expandAllSections(container);
  });
}

function bulkArea(): HTMLElement | null {
  return container.querySelector("[data-lotteon-notice-bulk]");
}
function button(action: "bulk-apply" | "bulk-clear"): HTMLButtonElement | null {
  return container.querySelector(`[data-action="${action}"]`);
}
async function click(action: "bulk-apply" | "bulk-clear"): Promise<void> {
  const target = button(action);
  if (!target) throw new Error(`[${action}] 버튼이 화면에 없다`);
  await act(async () => {
    target.click();
  });
}

describe("일괄 영역이 화면에 선다", () => {
  beforeEach(() => {
    saved = baseChannelInfo();
  });

  it("셀러가 채울 고시 칸이 있으면 일괄 적용 버튼이 마운트된 DOM 에 있다", async () => {
    await enterTab();
    expect(bulkArea(), "일괄 영역이 없다 — 배선이 끊겼다").not.toBeNull();
    expect(button("bulk-apply")).not.toBeNull();
  });

  it("🔴 셀러는 항목«코드» 를 보지 않는다 — 0220/1830 이 노출되지 않는다", async () => {
    await enterTab();
    const label = bulkArea()?.textContent ?? "";
    expect(label).not.toContain("0220");
    expect(label).not.toContain("1830");
  });
});

describe("실제로 누른다", () => {
  beforeEach(() => {
    saved = baseChannelInfo();
  });

  it("🔴 누르면 두 칸이 «상품 상세페이지 참조» 로 상품에 남는다", async () => {
    await enterTab();
    await click("bulk-apply");
    /* 🔴 상품 수준(channelInfo)에 남는 것이 증거다 — 화면 상태만 바뀌면
       새로고침에 사라지고, 그러면 셀러는 또 눌러야 한다. */
    const values = saved.notice.articleValues ?? {};
    expect(values["0220"]).toBe(DETAIL_PAGE_REFERENCE_TEXT);
    expect(values["1830"]).toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });

  it("🔴 누른 뒤 적용 버튼이 사라지고 해제가 남는다 — 멱등", async () => {
    await enterTab();
    await click("bulk-apply");
    expect(button("bulk-apply")).toBeNull();
    expect(button("bulk-clear")).not.toBeNull();
  });

  it("🔴 KC·원산지는 일괄이 건드리지 않는다", async () => {
    await enterTab();
    await click("bulk-apply");
    const values = saved.notice.articleValues ?? {};
    expect(values["0200"]).toBeUndefined();
    expect(values["0060"]).toBeUndefined();
  });
});

describe("기존 값 보호", () => {
  beforeEach(() => {
    saved = baseChannelInfo({ "1830": "최대 체중 20kg" });
  });

  it("🔴 셀러가 적어 둔 값은 덮지 않고, 화면이 그 사실을 말한다", async () => {
    await enterTab();
    expect(bulkArea()?.querySelector("[data-bulk-skipped]"), "건드리지 않았다는 사실이 화면에 없다").not.toBeNull();
    await click("bulk-apply");
    const values = saved.notice.articleValues ?? {};
    expect(values["1830"]).toBe("최대 체중 20kg");
    expect(values["0220"]).toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });
});

describe("해제", () => {
  beforeEach(() => {
    saved = baseChannelInfo({ "0220": DETAIL_PAGE_REFERENCE_TEXT, "1830": DETAIL_PAGE_REFERENCE_TEXT });
  });

  it("🔴 해제하면 «빈 칸» 으로 돌아간다 — 미적용 = 미입력", async () => {
    await enterTab();
    await click("bulk-clear");
    const values = saved.notice.articleValues ?? {};
    expect(values["0220"] ?? "").toBe("");
    expect(values["1830"] ?? "").toBe("");
  });

  it("전부 참조면 적용 버튼은 서지 않는다", async () => {
    await enterTab();
    expect(button("bulk-apply")).toBeNull();
  });
});
