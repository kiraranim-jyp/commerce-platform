// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { normalizeOptionModel } from "@commerce/crawler/src/common-option-model";
import { SourceDataView } from "../SourceDataView";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P1-5(CPO ①, 2026-10-09) — **옵션의 주인은 상품정보 하나다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측: 「옵션은 들어오지만 개별 Commerce 탭에서 보인다」.
 *
 * 열어 보니 상품정보에는 축 «이름» 한 줄(`product.options`, deprecated)만
 * 있었고, 실제 구조 — 옵션그룹 × 값, 단품별 SKU·재고·가격 — 는 세 채널 탭에만
 * 있었다. 세 탭이 모두 «공통» 데이터(CanonicalProduct.variants)를 고치므로,
 * 셀러는 같은 값을 세 곳에서 고치고 있었다.
 *
 * ── 🔴 이 파일이 재는 것 ───────────────────────────────────────────────────
 *   ① 상품정보에 실제 옵션 구조가 «있다»            (없으면 옮긴 것이 아니다)
 *   ② 채널 탭에 옵션 «입력칸» 이 없다                (중복 편집이 사라졌는가)
 *   ③ 🔴 채널 탭에 옵션 «표시» 는 남아 있다          (지운 것이 아니라 옮긴 것)
 *   ④ 받아 놓고 안 쓰는 prop 을 남기지 않았다
 *
 * ③ 이 없으면 이 수정은 「옵션을 채널 화면에서 삭제했다」와 구별되지 않는다.
 * 셀러는 이 채널 payload 가 무엇을 받는지 볼 자리가 필요하다.
 *
 * ── 🔴 옵션을 손으로 만들지 않는다 ─────────────────────────────────────────
 * `normalizeOptionModel` 은 P5.6 Phase 1 이 만든 «공용 한 문» 이고, 모든 사이트
 * 추출 결과가 CanonicalProduct 에 닿기 직전 지나는 함수다. 여기서도 그것을
 * 통과시킨 결과만 쓴다 — 통과하지 못할 모양으로 재면 화면은 맞는데 실제
 * 상품에서는 다른 그림이 된다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

/** Smallable 실측 모양 — 사이즈 축 하나 + 단품 3개(재고는 둘만 실측). */
const RAW_GROUPS = [{ name: "사이즈", values: ["2Y", "3Y", "4Y"] }];
const RAW_VARIANTS = [
  { id: "v1", optionValues: { 사이즈: "2Y" }, stockQuantity: 3 },
  { id: "v2", optionValues: { 사이즈: "3Y" }, stockQuantity: 0 },
  { id: "v3", optionValues: { 사이즈: "4Y" } },
];

function makeProduct(): CanonicalProduct {
  /* 🔴 운영 함수를 통과시킨다 — 이 결과가 실제로 저장되는 모양이다. */
  const normalized = normalizeOptionModel(RAW_GROUPS as never, RAW_VARIANTS as never);
  return {
    sourceUrl: "https://www.smallable.com/en/product/short-123456",
    title: field("아동용 반바지"),
    titleKo: field("아동용 반바지"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field("설명"),
    descriptionKo: field("설명"),
    material: field("코튼 100%"),
    color: field("블루"),
    recommendedAge: field("3-4Y"),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
    options: field(normalized.optionGroups.map((g) => g.name)),
    ...normalized,
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
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("스페인"),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field("따조"),
    itemName: field("유아동 반바지"),
    modelName: field("BC-SHORT-01"),
    weight: field("120g"),
    certificationType: field(""),
    childCertification: field(null),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function mountSource(): Promise<void> {
  const product = makeProduct();
  await act(async () => {
    root.render(
      createElement(SourceDataView, {
        product,
        onUpdateField: () => {},
        onUpdatePrice: () => {},
        onUpdateOptions: () => {},
        onUpdateKeywords: () => {},
        onUpdateVariant: () => {},
      } as never),
    );
  });
}

async function mountChannel(platform: "smartstore" | "coupang"): Promise<void> {
  const product = makeProduct();
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
        developerMode: false,
      } as never),
    );
  });
  await act(async () => {
    expandAllSections(container);
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}
/** 🔴 「옵션 영역」만 본다 — 다른 섹션의 입력칸을 세면 이 단언이 늘 실패한다. */
function optionRegion(): HTMLElement | null {
  const section = container.querySelector("#section-options");
  return (section as HTMLElement | null) ?? null;
}

describe("① 🔴 전제 — 공용 정규화를 통과한 옵션이 실제로 남는다", () => {
  it("축 1개 · 값 3개 · 단품 3개가 살아 있다", () => {
    const p = makeProduct();
    expect(p.optionGroups).toHaveLength(1);
    expect(p.optionGroups[0].values).toEqual(["2Y", "3Y", "4Y"]);
    expect(p.variants).toHaveLength(3);
  });
});

describe("② 🔴 상품정보가 옵션의 «실제 구조» 를 보여준다", () => {
  it("옵션 그룹 이름과 값이 화면에 있다", async () => {
    await mountSource();
    const t = text();
    expect(t, "축 이름이 없다").toContain("사이즈");
    for (const v of ["2Y", "3Y", "4Y"]) expect(t, `값 ${v} 가 없다`).toContain(v);
  });

  it("🔴 단품별 SKU·재고·가격 표가 있다 — 축 이름 한 줄이 전부가 아니다", async () => {
    await mountSource();
    expect(text()).toContain("옵션 조합별 SKU · 재고 · 가격");
  });

  it("단품 3줄이 실제로 그려진다 — 표 머리만 있는 것이 아니다", async () => {
    await mountSource();
    const rows = container.querySelectorAll("tbody tr");
    const combos = Array.from(rows).map((r) => r.querySelector("td")?.textContent?.trim());
    for (const v of ["2Y", "3Y", "4Y"]) expect(combos).toContain(v);
  });

  it("재고를 «고칠 수» 있다 — 보여주기만 하는 것이 아니다", async () => {
    await mountSource();
    const row = Array.from(container.querySelectorAll("tbody tr")).find((r) =>
      r.querySelector("td")?.textContent?.trim() === "2Y",
    );
    expect(row, "2Y 줄이 없다").toBeTruthy();
    const inputs = row!.querySelectorAll("input, button");
    expect(inputs.length, "단품 줄에 입력 수단이 없다").toBeGreaterThan(0);
  });

  it("🔴 「가격차이·최종판매가」 열은 «없다» — 채널 최종가를 상품정보가 지어내지 않는다", async () => {
    await mountSource();
    const t = text();
    expect(t).not.toContain("최종판매가");
    expect(t).not.toContain("가격차이");
  });

  it("🔴 옵션이 없는 상품에서는 블록 자체를 그리지 않는다 — 빈 표를 세우지 않는다", async () => {
    const bare = { ...makeProduct(), optionGroups: [], variants: [] } as CanonicalProduct;
    await act(async () => {
      root.render(
        createElement(SourceDataView, {
          product: bare,
          onUpdateField: () => {},
          onUpdatePrice: () => {},
          onUpdateOptions: () => {},
          onUpdateVariant: () => {},
        } as never),
      );
    });
    expect(text()).not.toContain("옵션 조합별 SKU · 재고 · 가격");
  });
});

describe("③ 🔴 채널 탭에서 옵션을 «고치지» 못한다", () => {
  it.each(["smartstore", "coupang"] as const)("%s — 옵션 영역에 단품 편집 표가 없다", async (platform) => {
    await mountChannel(platform);
    expect(text(), "채널 탭에 단품 편집 표가 남아 있다").not.toContain("옵션 조합별 SKU · 재고 · 가격");
  });

  it.each(["smartstore", "coupang"] as const)("%s — 옵션 영역에 축 이름 편집칸이 없다", async (platform) => {
    await mountChannel(platform);
    const region = optionRegion();
    expect(region, "옵션 섹션이 화면에 없다 — 이 테스트의 전제가 깨졌다").not.toBeNull();
    /* 🔴 「재고」 한 칸은 S-7(CEO 확정, 2026-09-26)이 이 자리에 둔 것이고 옵션
       구조가 아니다. 그 칸은 세지 않는다 — 그러나 «그 하나뿐» 임을 센다.
       둘 이상이면 옵션 편집칸이 돌아온 것이다. */
    const inputs = region!.querySelectorAll("input, textarea");
    expect(inputs.length, `옵션 영역 입력칸 ${inputs.length}개 — 재고 한 칸만 남아야 한다`).toBeLessThanOrEqual(1);
  });
});

describe("④ 🔴 지운 것이 아니라 «옮긴» 것이다 — 표시는 남는다", () => {
  /* ══ 🔴 P5.6 재작업(CEO 판정, 2026-10-09) — **이 단언을 뒤집었다.** ══

     여기 있던 것: 「채널 탭에 옵션 그룹·값 «표시» 는 남아 있다」. 근거는
     「지운 것이 아니라 옮긴 것임을 구별해야 한다」였다.

     CEO 판정: 「못 고치고 보이기만 하지만 제거해야 함」. 그 판정이 맞다 —
     읽기 전용이어도 같은 값이 네 화면(상품정보 + 세 채널)에 서 있으면 셀러는
     여전히 「커머스마다 옵션이 있다」고 읽는다. CPO 지시도 「옵션 자체를 중복
     표시하지 않는 방향 · 안내조차 최소화」다.

     🔴 그래도 「지운 것」과 「옮긴 것」을 구별할 필요는 그대로다. 그래서 값
        목록이 사라졌음을 재는 «동시에», 개수와 갈 곳이 남아 있음을 센다 —
        섹션이 통째로 비면 셀러가 「옵션 없는 상품」으로 읽는다. */
  it.each(["smartstore", "coupang"] as const)("%s — 옵션 값 목록이 «사라졌다»", async (platform) => {
    await mountChannel(platform);
    const region = container.querySelector("#section-options");
    expect(region, "옵션 섹션이 없다 — 전제가 깨졌다").not.toBeNull();
    const t = (region?.textContent ?? "").replace(/\s+/g, " ").trim();
    for (const v of ["2Y", "3Y", "4Y"]) expect(t, `값 ${v} 가 채널 탭에 아직 있다`).not.toContain(v);
  });

  it.each(["smartstore", "coupang"] as const)("%s — 개수와 갈 곳은 남는다", async (platform) => {
    await mountChannel(platform);
    const t = (container.querySelector("#section-options")?.textContent ?? "").replace(/\s+/g, " ");
    expect(t).toContain("단품 3개");
    expect(t).toContain("상품정보 → 옵션");
  });

  it.each(["smartstore", "coupang"] as const)("%s — 어디서 고치는지 화면이 말한다", async (platform) => {
    await mountChannel(platform);
    expect(text()).toContain("상품정보 → 옵션");
  });

  it("단품 수를 숨기지 않는다", async () => {
    await mountChannel("smartstore");
    expect(text()).toContain("단품 3개");
  });
});

describe("⑤ 🔴 받아 놓고 안 쓰는 prop 을 남기지 않았다", () => {
  const PV = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const WS = readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it.each(["onUpdateOptions", "onUpdateVariant"])("PlatformPreview 가 %s 를 더 받지 않는다", (prop) => {
    expect(PV).not.toContain(prop);
  });

  it("🔴 SourceDataView 쪽으로 배선이 «실제로» 갔다 — 선언만 하고 안 넘긴 실수가 세 번 있었다", () => {
    const at = WS.indexOf("<SourceDataView");
    expect(at).toBeGreaterThan(-1);
    expect(WS.slice(at, at + 1600), "상품정보에 단품 setter 배선이 없다").toContain(
      "onUpdateVariant={updateVariant}",
    );
  });

  it("🔴 setter 가 «같은 함수» 다 — 두 벌을 만들지 않았다", () => {
    expect(WS.match(/onUpdateVariant=\{updateVariant\}/g) ?? []).toHaveLength(1);
  });

  it("🔴 편집기를 복제하지 않았다 — OptionVariantEditor 는 한 파일에서만 import 된다", () => {
    const SV = readFileSync(join(__dirname, "../SourceDataView.tsx"), "utf8");
    expect(SV).toContain('from "./OptionVariantEditor"');
    expect(PV).not.toContain("OptionVariantEditor");
  });
});
