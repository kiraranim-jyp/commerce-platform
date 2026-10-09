// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { sourceKeywords } from "@commerce/crawler/src/source-keywords";
import { extractCountryOfOrigin } from "@commerce/crawler";
import { SourceDataView } from "../SourceDataView";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 재작업(CEO 실측 6건, 2026-10-09) — **최종 UX 기준으로 다시 잰다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 앞선 스프린트의 잘못: 「코드가 있는가」를 재고 「이미 구현됨」으로 닫았다.
 *    이 파일은 **CEO 가 화면에서 본 것** 을 기준으로 잰다.
 *
 *   ① 상품정보에 옵션 항목이 2개 보인다            → 하나만 남는가
 *   ② 커머스 탭의 옵션은 못 고치지만 보인다 → 제거  → 사라졌는가
 *   ③ 상세설명이 source data · 필수정보 두 곳       → Source Data 하나인가
 *   ④ 태그 값을 불러오지 못한다                    → 원본 태그가 들어오는가
 *   ⑤ KC 경고판이 여전히 2개                       → 덩어리가 하나인가
 *   ⑥ 원산지는 공식 자료에서 찾아 입력해야 한다      → 원본을 먼저 제대로 읽는가
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

function makeProduct(over: Record<string, unknown> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://www.smallable.com/en/product/short-123456",
    title: field("아동용 반바지"),
    titleKo: field("아동용 반바지"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field("ORIGINAL EN TEXT"),
    descriptionKo: field("등록될 한국어 상세설명", "AI_GENERATED"),
    material: field("코튼 100%"),
    color: field("블루"),
    recommendedAge: field("3-4Y"),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
    options: field(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["2Y", "3Y"] }],
    variants: [
      { id: "v1", optionValues: { 사이즈: "2Y" }, stockQuantity: 3 },
      { id: "v2", optionValues: { 사이즈: "3Y" } },
    ],
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
    keywords: field(["수입원피스", "아동"]),
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
    ...over,
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

async function mountSource(over: Record<string, unknown> = {}): Promise<void> {
  await act(async () => {
    root.render(
      createElement(SourceDataView, {
        product: makeProduct(over),
        onUpdateField: () => {},
        onUpdatePrice: () => {},
        onUpdateKeywords: () => {},
        onUpdateVariant: () => {},
        onGenerateDescription: () => {},
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

const flat = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const screen = () => flat(container);
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SV = () => strip(readFileSync(join(__dirname, "../SourceDataView.tsx"), "utf8"));
const WS = () => strip(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("① 🔴 상품정보에 「옵션」은 한 자리다", () => {
  it("축 이름만 고치는 deprecated 칸이 사라졌다", async () => {
    await mountSource();
    /* 그 칸의 유일한 표식: placeholder "옵션 없음 (쉼표로 구분)". */
    const placeholders = Array.from(container.querySelectorAll<HTMLInputElement>("input")).map(
      (i) => i.placeholder,
    );
    expect(placeholders, "축 이름 편집칸이 남아 있다").not.toContain("옵션 없음 (쉼표로 구분)");
  });

  it("🔴 onUpdateOptions prop 과 배선까지 지웠다 — 받아 놓고 안 쓰지 않는다", () => {
    expect(SV()).not.toContain("onUpdateOptions");
    expect(WS()).not.toContain("onUpdateOptions=");
  });

  it("실제 구조(그룹·값·단품 표)는 그대로 있다 — 지운 쪽이 반대가 아니다", async () => {
    await mountSource();
    const t = screen();
    expect(t).toContain("사이즈");
    expect(t).toContain("2Y");
    expect(t).toContain("옵션 조합(원본값)");
  });

  it("🔴 어느 칸이 원본이고 어느 칸이 판매용인지 말한다", async () => {
    await mountSource();
    expect(screen()).toContain("왼쪽은 원본 사이트의 값");
  });

  it("🔴 재고가 «전부» 비면 왜 비었는지 말한다 — 0 으로 채우지 않는다", async () => {
    await mountSource({
      variants: [
        { id: "v1", optionValues: { 사이즈: "2Y" } },
        { id: "v2", optionValues: { 사이즈: "3Y" } },
      ],
    });
    expect(screen()).toContain("원본 사이트가 옵션별 재고 수량을 공개하지 않습니다");
  });

  it("대조군 — 재고가 하나라도 실측되면 그 안내를 띄우지 않는다", async () => {
    await mountSource();
    expect(screen()).not.toContain("원본 사이트가 옵션별 재고 수량을 공개하지 않습니다");
  });
});

describe("② 🔴 커머스 탭에서 옵션 «목록» 이 사라졌다", () => {
  it.each(["smartstore", "coupang"] as const)("%s — 옵션값 칩이 없다", async (platform) => {
    await mountChannel(platform);
    const region = container.querySelector("#section-options");
    expect(region, "옵션 섹션이 없다 — 전제가 깨졌다").not.toBeNull();
    const t = flat(region);
    expect(t, "옵션 값이 아직 채널 탭에 서 있다").not.toContain("2Y");
    expect(t).not.toContain("3Y");
  });

  /* 🔴 P5.6 FINAL(CPO FAIL ①) — 그 한 줄조차 지웠다. CPO: 「영역 «자체» 제거 ·
     read-only 로 남기는 것도 금지 · 안내조차 최소화」. 섹션 이름도 「재고」가 됐다. */
  it.each(["smartstore", "coupang"] as const)("%s — 개수·갈 곳 한 줄도 사라졌다", async (platform) => {
    await mountChannel(platform);
    const region = container.querySelector("#section-options");
    const body = region?.querySelector(":scope > div");
    const t = ((body ?? region)?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(t, "옵션 영역을 읽지 못했다").toContain("재고");
    expect(t).not.toContain("단품");
    expect(t).not.toContain("상품정보 → 옵션");
  });

  it.each(["smartstore", "coupang"] as const)("%s — 옵션 입력칸은 재고 한 칸뿐이다", async (platform) => {
    await mountChannel(platform);
    const inputs = container.querySelectorAll("#section-options input, #section-options textarea");
    expect(inputs.length, `옵션 영역 입력칸 ${inputs.length}개`).toBeLessThanOrEqual(1);
  });
});

describe("③ 🔴 상세설명은 Source Data 한 곳이다", () => {
  it("Source Data 의 상세설명이 «등록될 글»(descriptionKo)을 고친다", async () => {
    await mountSource();
    const areas = Array.from(container.querySelectorAll<HTMLTextAreaElement>("textarea")).map((t) => t.value);
    expect(areas, "등록될 글이 편집칸에 없다").toContain("등록될 한국어 상세설명");
    expect(areas, "원문을 고치는 칸이 남아 있다").not.toContain("ORIGINAL EN TEXT");
  });

  it("「상세설명 자동 작성」 버튼이 Source Data 에 있다", async () => {
    await mountSource();
    const names = Array.from(container.querySelectorAll("button")).map((b) => (b.textContent ?? "").trim());
    expect(names).toContain("상세설명 자동 작성");
  });

  it("🔴 원문은 지우지 않고 읽기 전용 접힘으로 남는다", async () => {
    await mountSource();
    expect(screen()).toContain("원본 상세설명 보기");
    expect(screen()).toContain("ORIGINAL EN TEXT");
  });

  it("🔴 필수정보 영역의 「상세설명」 섹션이 사라졌다", () => {
    const ws = WS();
    const at = ws.indexOf("ProductDetailBlocksPanel");
    expect(at).toBeGreaterThan(-1);
    /* 그 영역에 있던 표식: <h3>상세설명</h3> + 자동 작성 버튼. */
    expect(ws.slice(at, at + 2500)).not.toContain('<h3 className="text-base font-medium">상세설명</h3>');
  });

  it("🔴 자동 작성은 «같은 함수» 다 — 새 생성기를 만들지 않았다", () => {
    const ws = WS();
    expect(ws).toContain("onGenerateDescription={generateDescriptionOnly}");
    expect(ws).toContain("mockProductContentProvider.generateDescription");
  });

  it("🔴 「AI 콘텐츠」 탭은 준비중 그대로다 — URGENT ④ 를 뒤집지 않았다", () => {
    expect(WS()).toContain('<TabButton active={tab === "content"} disabled');
  });
});

describe("④ 🔴 태그는 원본에서 «들어온다»", () => {
  it("Shopify 쉼표 문자열을 태그 목록으로 나눈다", () => {
    expect(sourceKeywords("children, Kid, SS26")).toEqual(["children", "Kid", "SS26"]);
  });

  it("배열로 와도 받는다 — 한 모양만 받으면 다른 사이트에서 0건이 된다", () => {
    expect(sourceKeywords(["children", "Kid"])).toEqual(["children", "Kid"]);
  });

  it("🔴 기계 키는 떨어낸다 — 셀러가 적은 적 없는 글자가 검색에 오르지 않게", () => {
    expect(sourceKeywords("__label:new, type:shirt, Kid")).toEqual(["Kid"]);
  });

  it("중복은 대소문자를 무시하고 걷되 «표시값» 은 원문 그대로다", () => {
    expect(sourceKeywords("Kid, kid, KID")).toEqual(["Kid"]);
  });

  it("🔴 비면 «만들지 않는다» — 브랜드명을 합성해 넣지 않는다", () => {
    expect(sourceKeywords(undefined)).toEqual([]);
    expect(sourceKeywords(" , , ")).toEqual([]);
  });

  it("🔴 수집 경로가 실제로 그 함수를 쓴다 — 선언만 하고 안 쓴 실수가 세 번 있었다", () => {
    const cp = strip(readFileSync(join(__dirname, "../../../api/pipeline/canonical-product.ts"), "utf8"));
    expect(cp).toContain("sourceKeywords(productData.shopifyTags)");
    expect(cp, "빈 배열 고정 초기화가 남아 있다").not.toContain(
      'keywords: { value: [], source: "ORIGINAL", confidence: 0 },',
    );
  });

  it("화면이 그 값을 보여준다", async () => {
    await mountSource();
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input")).map((i) => i.value);
    expect(inputs).toContain("수입원피스, 아동");
  });
});

describe("⑤ 🔴 KC 는 덩어리가 하나다", () => {
  it("색 있는 경고 덩어리가 1개다", async () => {
    await mountChannel("smartstore");
    const panels = Array.from(container.querySelectorAll("div")).filter((d) =>
      /bg-(error|warning)-soft/.test(d.className || ""),
    );
    expect(panels.length, `경고 덩어리 ${panels.length}개`).toBeLessThanOrEqual(1);
  });

  it("🔴 배너가 있을 때 인증정보 블록이 «카드 껍데기» 를 두르지 않는다", () => {
    const pv = strip(readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8"));
    expect(pv).toContain(
      'statusBannerShown ? "mt-3 space-y-3" : "mt-3 space-y-3 rounded-md border border-border bg-background p-3"',
    );
  });
});

describe("⑥ 🔴 원산지 — 폴백보다 «원본» 을 먼저 제대로 읽는다", () => {
  it("설명문의 Made in 을 읽는다", () => {
    expect(extractCountryOfOrigin("SS26 Made in Italy.")).toBe("Italy");
  });

  it("🔴 소재/스펙 줄에 적혀 있어도 읽는다 — 전에는 설명문만 봤다", () => {
    const cp = strip(readFileSync(join(__dirname, "../../../api/pipeline/canonical-product.ts"), "utf8"));
    expect(cp).toContain("extractCountryOfOrigin(productData.material)");
    expect(cp).toContain("extractCountryOfOrigin(productData.title)");
  });

  it("🔴 못 찾으면 REQUIRED 로 남는다 — 지어내지 않는다", () => {
    expect(extractCountryOfOrigin("100% Cotton.")).toBeUndefined();
    const cp = strip(readFileSync(join(__dirname, "../../../api/pipeline/canonical-product.ts"), "utf8"));
    expect(cp).toContain('{ value: "", source: "REQUIRED", confidence: 0 }');
  });
});
