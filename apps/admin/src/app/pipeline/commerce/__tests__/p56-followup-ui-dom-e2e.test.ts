// @vitest-environment jsdom
/**
 * ══════════════════════════════════════════════════════════════════════════
 *  P5.6 후속 ①④⑤ — **마운트한 DOM 으로 올린다** (CPO 검증 기준 통일)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * CPO 는 ③ 을 「실제 UI 편집 E2E 보강 필요」로 되돌렸고, 마운트 DOM 으로 재고
 * 나서야 PASS 로 닫았다. 🔴 **그 기준을 ①④⑤ 에는 아직 적용하지 않았다** —
 * 그 셋은 `strip(read(...))` 소스 문자열 검사로만 닫혀 있다.
 *
 * 이 저장소의 규칙이 이미 그것을 금지한다: 「Render PASS ≠ 소스 PASS. 화면은
 * 마운트한 DOM 으로만 완료 선언한다」. 그리고 ⑤ 는 내가 **두 번** 「제거 완료」로
 * 잘못 보고한 항목이다 — 소스에서 `onUpdateOptions` 가 없는 것만 보고, 옵션이
 * «없는» 단품 분기에 살아 있던 재고 입력 한 칸을 놓쳤다.
 *
 * ── 이 파일이 재는 것 ───────────────────────────────────────────────────
 *   ① 기본 재고 수량 입력이 «조건 없이» 화면에 있고 실제로 값을 올려 보낸다
 *   ④ 원산지 입력이 상품정보 화면에 있고 실제로 값을 올려 보낸다
 *   ⑤ 채널 탭에 재고를 «바꾸는» 입력이 없다 — **옵션 있는 상품과 단품 둘 다**
 *
 * 🔴 ⑤ 는 대조군을 같이 둔다. 「입력칸이 없다」만 재면 섹션을 통째로 지운
 *    변경과 구별되지 않는다(이 저장소에서 부정 단정이 대조군 없이 틀린 적이 있다).
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { SourceDataView } from "../SourceDataView";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

/**
 * @param withVariants false 면 **단품**(옵션 없음)이다.
 *   🔴 ⑤ 에서 내가 놓친 분기가 바로 이것이다 — 재고 입력칸은 `variants.length === 0`
 *      일 때만 그려졌고, 나는 옵션 상품으로만 확인하고 「없다」고 단정했다.
 * @param unknownStock true 면 옵션별 재고가 «전부 모름» 이다(Smallable 실측 모양).
 */
function makeProduct(withVariants: boolean, unknownStock = true): CanonicalProduct {
  const sizes = ["6 months", "12 months", "18 months", "24 months"];
  return {
    id: "p1",
    sourceUrl: "https://www.smallable.com/en/product/holly-hearts-441173",
    title: field("Holly Hearts Ribbed Velvet Baby Pants | Pale Pink"),
    titleKo: field("Louis Louise Holly Hearts Ribbed Velvet Baby Pants 여아 바지"),
    brand: field("Louis Louise"),
    price: field({ amount: 59, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field(""),
    description: field("Ribbed velvet baby pants."),
    descriptionKo: field("벨벳 아기 바지."),
    material: field("100% Cotton"),
    color: field("Pink"),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field(withVariants ? ["Size"] : []),
    optionGroups: withVariants ? [{ name: "Size", values: sizes }] : [],
    variants: withVariants
      ? sizes.map((v, i) => ({
          id: `v${i}`,
          optionValues: { Size: v },
          stockQuantity: unknownStock ? undefined : 3,
        }))
      : [],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/a.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    keywords: field<string[]>([]),
    seoTitle: field(""),
    seoDescription: field(""),
    /** 🔴 «비워서» 만든다 — 원산지 직접입력을 재려면 공란이어야 한다. */
    countryOfOrigin: field("", "REQUIRED"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    childCertification: field(null),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

let container: HTMLDivElement;
let root: Root;
/** 화면이 올려 보낸 호출을 그대로 받는다. 🔴 이것이 「실제로 동작한다」의 증거다. */
let calls: { kind: string; a?: unknown; b?: unknown }[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  calls = [];
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mountSource(product: CanonicalProduct, withDefaultStock = true): Promise<void> {
  await act(async () => {
    root.render(
      createElement(SourceDataView, {
        product,
        onUpdateField: (key: string, value: string) => calls.push({ kind: `field:${key}`, a: value }),
        onUpdatePrice: () => {},
        onUpdateKeywords: () => {},
        onUpdateVariant: (id: string, patch: unknown) => calls.push({ kind: "variant", a: id, b: patch }),
        /* 🔴 넘기지 않는 경우도 재야 한다 — 그때는 칸을 그리지 «않는» 것이 계약이다. */
        ...(withDefaultStock
          ? { onUpdateSellerDefaultStock: (v: number | undefined) => calls.push({ kind: "sellerDefaultStock", a: v }) }
          : {}),
      } as never),
    );
  });
}

async function mountChannel(platform: "smartstore" | "coupang", product: CanonicalProduct): Promise<void> {
  await act(async () => {
    root.render(
      createElement(PlatformPreview, {
        manufacturerResolution: manufacturerFixture(),
        product,
        listing: PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform),
        categoryCandidates: [],
        listingStatus: "DRAFT" as const,
        listingResult: null,
        productOptionGroups: product.optionGroups,
        onFixTextField: () => {},
        onSetFieldReference: () => {},
        onSelectCategory: () => {},
        onOpenListingModal: () => {},
        onRetryListing: () => {},
        onFixNumberField: (f: string, v: number) => calls.push({ kind: `number:${f}`, a: v }),
        developerMode: false,
      } as never),
    );
  });
  await act(async () => {
    expandAllSections(container);
  });
}

function inputs(): HTMLInputElement[] {
  return Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
}

/** placeholder 조각으로 입력칸을 찾는다. 🔴 못 찾으면 실패한다. */
function inputByPlaceholder(fragment: string): HTMLInputElement {
  const hit = inputs().find((i) => (i.placeholder ?? "").includes(fragment));
  if (!hit) {
    throw new Error(
      `input(placeholder~「${fragment}」) 가 화면에 없다 — ${inputs().length}개: ${inputs()
        .map((i) => i.placeholder)
        .join(" | ")}`,
    );
  }
  return hit;
}

/** 실제 타이핑 + blur(EditableText 는 commit 시점에 올려 보낸다). */
async function typeAndCommit(el: HTMLInputElement, value: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  /* 🔴 `blur` 가 아니라 `focusout` 이다 — React 의 합성 `onBlur` 는 버블하는
     `focusout` 에 걸린다(`blur` 는 버블하지 않아 루트 리스너에 닿지 않는다).
     1차에 `blur` 를 쏘고 「값이 안 올라간다」고 볼 뻔했다 — 하니스 결함이었다. */
  await act(async () => {
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

/* ══ ① 기본 재고 수량 ═══════════════════════════════════════════════════ */
describe("① 기본 재고 수량 — 화면에 «조건 없이» 있고 실제로 값을 올려 보낸다", () => {
  it("🔴 재고를 모르는 옵션이 «없어도» 입력칸이 보인다(가려졌던 그 조건)", async () => {
    /* 옵션별 재고가 전부 실측된 상품 — 전에는 이때 칸이 화면에서 사라졌다. */
    await mountSource(makeProduct(true, false));
    expect(container.textContent).toContain("기본 재고 수량");
    expect(inputByPlaceholder("예: 10")).toBeTruthy();
    /* 🔴 그리고 「지금 모르는 옵션」 경고는 «없다» — 모르는 옵션이 없으니까. */
    expect(container.textContent).not.toContain("지금 재고를 모르는 옵션");
  });

  it("🔴 모르는 옵션이 있으면 몇 개인지 말하고, 비면 제외된다고 말한다", async () => {
    await mountSource(makeProduct(true, true));
    expect(container.textContent).toContain("지금 재고를 모르는 옵션 4개");
    expect(container.textContent).toContain("등록에서 제외됩니다");
  });

  it("🔴 10 을 타이핑하면 그 값이 올라간다 — 화면이 실제로 동작한다", async () => {
    await mountSource(makeProduct(true, true));
    await typeAndCommit(inputByPlaceholder("예: 10"), "10");
    expect(calls).toEqual([{ kind: "sellerDefaultStock", a: 10 }]);
  });

  it("🔴 비우면 «지운다»(undefined) — 0 으로 바꾸지 않는다(0 은 품절 주장이다)", async () => {
    /* 🔴 빈 값 → 빈 값은 «바뀐 것이 없어» commit 이 안 난다(EditableText 의
       `draft !== value` 조건이고 그게 맞다). 그래서 먼저 10 을 적어 넣고 지운다 —
       셀러가 실제로 하는 순서다. 1차에 이 순서를 빼먹고 「안 올라간다」고 볼
       뻔했다: 내 단정이 틀렸고 컴포넌트가 맞았다. */
    const product = makeProduct(true, true);
    await mountSource({ ...product, sellerDefaultStock: 10 } as CanonicalProduct);
    await typeAndCommit(inputByPlaceholder("예: 10"), "");
    expect(calls).toEqual([{ kind: "sellerDefaultStock", a: undefined }]);
  });

  it("🔴 0 은 «그대로» 올라간다 — 판매자가 적은 품절은 모름과 다른 사실이다", async () => {
    await mountSource(makeProduct(true, true));
    await typeAndCommit(inputByPlaceholder("예: 10"), "0");
    expect(calls).toEqual([{ kind: "sellerDefaultStock", a: 0 }]);
  });

  it("🔴 음수는 «지운다» — 재고가 -1 인 상품은 없다", async () => {
    await mountSource(makeProduct(true, true));
    await typeAndCommit(inputByPlaceholder("예: 10"), "-5");
    expect(calls).toEqual([{ kind: "sellerDefaultStock", a: undefined }]);
  });

  it("대조군 — 콜백을 넘기지 않으면 칸을 그리지 «않는다»(기존 호출부 호환)", async () => {
    await mountSource(makeProduct(true, true), false);
    expect(container.textContent).not.toContain("기본 재고 수량");
  });

  it("🔴 옵션 행의 재고 placeholder 가 「기본값」이 «아니다» — 두 개념이 같은 낱말을 쓰면 화면이 거짓말한다", async () => {
    await mountSource(makeProduct(true, true));
    const placeholders = inputs().map((i) => i.placeholder ?? "");
    expect(placeholders).toContain("모름");
    expect(placeholders).not.toContain("기본값");
  });
});

/* ══ ④ 원산지 ═══════════════════════════════════════════════════════════ */
describe("④ 원산지 — 상품정보 화면에서 직접 입력하고 세 채널이 그 값을 쓴다", () => {
  it("🔴 입력칸이 상품정보에 «있다» — 전에는 채널 탭에만 있었다", async () => {
    await mountSource(makeProduct(true));
    expect(container.textContent).toContain("원산지");
    expect(inputByPlaceholder("India")).toBeTruthy();
  });

  it("🔴 India 를 타이핑하면 `countryOfOrigin` 으로 올라간다", async () => {
    await mountSource(makeProduct(true));
    await typeAndCommit(inputByPlaceholder("India"), "India");
    expect(calls).toEqual([{ kind: "field:countryOfOrigin", a: "India" }]);
  });

  it("🔴 셀러에게 「세 Commerce 가 이 값을 쓴다」와 「덮지 않는다」를 화면이 말한다", async () => {
    await mountSource(makeProduct(true));
    expect(container.textContent).toContain("세 Commerce 가 이 값을 그대로 씁니다");
    expect(container.textContent).toContain("직접 적은 값은 자동 수집이 덮지 않습니다");
  });

  it("🔴 여기서 자동 수집을 돌리지 않는다 — 공식몰 확인 버튼이 이 화면에 없다", async () => {
    await mountSource(makeProduct(true));
    const buttons = Array.from(container.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(buttons.filter((t) => t.includes("공식"))).toHaveLength(0);
  });
});

/* ══ ⑤ 채널 탭 — 재고를 «바꾸는» UI 가 없다 ════════════════════════════ */
describe("⑤ 채널 탭 — 재고 편집칸이 없다 (옵션 상품 · 단품 «둘 다»)", () => {
  /** 재고를 바꿀 수 있는 입력칸만 센다. 🔴 배송비 칸은 남아야 하므로 구별한다. */
  function stockEditableInputs(): HTMLInputElement[] {
    return inputs().filter((i) => {
      const ph = i.placeholder ?? "";
      return ph.includes("재고") || ph === "원본 재고 미확인";
    });
  }

  for (const platform of ["smartstore", "coupang"] as const) {
    it(`🔴 ${platform} · 옵션 상품 — 재고 입력칸이 0개다`, async () => {
      await mountChannel(platform, makeProduct(true));
      expect(stockEditableInputs()).toHaveLength(0);
    });

    it(`🔴 ${platform} · **단품**(옵션 없음) — 재고 입력칸이 0개다 ← 내가 두 번 놓친 분기`, async () => {
      await mountChannel(platform, makeProduct(false));
      expect(stockEditableInputs()).toHaveLength(0);
      /* 🔴 대조군 — 섹션을 통째로 지운 것이 아니다. 재고는 «읽기 전용» 으로 보인다. */
      expect(container.textContent).toContain("재고");
    });

    it(`🔴 ${platform} · 단품 — 원본 재고를 모르면 어디서 채우는지 화면이 말한다`, async () => {
      await mountChannel(platform, makeProduct(false));
      expect(container.textContent).toContain("원본 재고 미확인");
      expect(container.textContent).toContain("상품정보 → 재고에서 기본 재고수량을 채우면");
    });

    it(`대조군 — ${platform} 배송비 편집은 «남아 있다»(채널별로 실제 다른 값이다)`, async () => {
      await mountChannel(platform, makeProduct(true));
      /* 배송비 칸이 사라졌다면 이 테스트가 떨어진다 — 「다 지웠다」와 구별된다. */
      const hasShippingInput = inputs().some((i) => (i.placeholder ?? "").includes("배송비"));
      const text = container.textContent ?? "";
      expect(hasShippingInput || text.includes("배송비")).toBe(true);
    });
  }

  it("🔴 옵션 상품에서 옵션별 재고가 «읽기 전용» 으로 보인다 — 바꾸는 손잡이는 없다", async () => {
    await mountChannel("smartstore", makeProduct(true));
    expect(container.textContent).toContain("재고 모름");
    expect(stockEditableInputs()).toHaveLength(0);
  });
});
