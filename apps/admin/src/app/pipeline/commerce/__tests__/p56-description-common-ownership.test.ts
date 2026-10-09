// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { effectiveDescription } from "@commerce/marketplace/src/content-field";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P1-9(CPO ⑬, 2026-10-09) — **상세설명은 한 곳에서만 고친다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측: 「롯데ON에서만 엉뚱한 상세정보가 표시된다」.
 *
 * 열어 보니 엉뚱한 쪽은 롯데ON 이 «아니었다». 세 채널이 똑같은 값을 받는데
 * (effectiveDescription = descriptionKo || description), 그 값을 고칠 수 있는
 * 자리가 disabled 인 「AI 콘텐츠」 탭 하나뿐이었다. 그래서 자동 작성이 만든
 * 템플릿 글이 세 채널에 그대로 나갔고, 셀러는 손댈 수 없었다.
 *
 * ── 🔴 그리고 채널 탭의 입력칸은 «틀려» 있었다(실측) ──────────────────────
 *     보여준 값   listing.description  = descriptionKo || description
 *     고친 값     product.description  = 원문
 *
 * descriptionKo 가 있으면 그 칸에서 고친 글은 등록값을 한 글자도 바꾸지 못하고,
 * 대신 원문을 조용히 덮었다. 「고쳤는데 그대로」가 여기서 났다.
 *
 * ── 🔴 이 파일이 재는 것 ───────────────────────────────────────────────────
 *   ① 결함 자체가 실재한다                 (고정값이 아니라 운영 함수로 센다)
 *   ② 채널 탭에 상세설명 «입력칸» 이 없다
 *   ③ 🔴 그래도 «무엇이 나가는지» 는 보인다 (지운 것이 아니라 옮긴 것)
 *   ④ 상품정보에서 등록값을 고칠 수 있다
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

const KO = "생성된 한국어 상세설명";
const EN = "ORIGINAL ENGLISH DESCRIPTION";

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://www.smallable.com/en/product/short-123456",
    title: field("아동용 반바지"),
    titleKo: field("아동용 반바지"),
    brand: field("Bobo Choses"),
    price: field({ amount: 45, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
    description: field(EN),
    descriptionKo: field(KO, "AI_GENERATED"),
    material: field("코튼 100%"),
    color: field("블루"),
    recommendedAge: field("3-4Y"),
    manufacturer: field("Bobo Choses"),
    careInstructions: field(""),
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
    ...overrides,
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

function descriptionRegion(): HTMLElement {
  const section = container.querySelector("#section-description");
  if (!section) throw new Error("상세설명 섹션이 화면에 없다 — 이 테스트의 전제가 깨졌다");
  return section as HTMLElement;
}
function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("① 🔴 결함이 실재한다 — 운영 함수로 센다", () => {
  it("채널이 받는 값은 descriptionKo 다 — 원문이 아니다", () => {
    expect(effectiveDescription(makeProduct())).toBe(KO);
  });

  it("🔴 원문만 고쳐도 등록값은 그대로다 — 「고쳤는데 그대로」의 원인", () => {
    const edited = makeProduct({ description: field("셀러가 고친 글", "USER_EDITED") as never });
    expect(effectiveDescription(edited)).toBe(KO);
  });

  it("descriptionKo 가 비면 원문으로 내려간다 — 폴백은 건드리지 않았다", () => {
    const noKo = makeProduct({ descriptionKo: field("") as never });
    expect(effectiveDescription(noKo)).toBe(EN);
  });

  it.each(["smartstore", "coupang"] as const)("%s 어댑터도 같은 값을 쓴다 — 채널별 변환이 없다", (p) => {
    const product = makeProduct();
    const listing = PLATFORM_ADAPTERS[p].toListingModel(product, UNRESOLVED_CATEGORY, undefined, p);
    expect(listing.description).toBe(KO);
  });
});

describe("② 🔴 채널 탭에서 상세설명을 «고치지» 못한다", () => {
  it.each(["smartstore", "coupang"] as const)("%s — 상세설명 영역에 입력칸이 0개다", async (platform) => {
    await mountChannel(platform);
    const inputs = descriptionRegion().querySelectorAll("input, textarea");
    expect(inputs.length, `상세설명 입력칸 ${inputs.length}개 — 0개여야 한다`).toBe(0);
  });

  it("🔴 onUpdateField union 에서 \"description\" 이 빠졌다 — 받아 놓고 안 쓰지 않는다", () => {
    const PV = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(PV).toContain('onUpdateField: (key: "title" | "brand", value: string) => void;');
    expect(PV, "채널 탭이 아직 상세설명을 쓴다").not.toContain('onUpdateField("description"');
  });
});

describe("③ 🔴 지운 것이 아니라 «옮긴» 것이다", () => {
  it.each(["smartstore", "coupang"] as const)("%s — 등록될 글이 그대로 보인다", async (platform) => {
    await mountChannel(platform);
    expect(text(descriptionRegion()), "무엇이 등록되는지 볼 자리가 사라졌다").toContain(KO);
  });

  it.each(["smartstore", "coupang"] as const)("%s — 어디서 고치는지 화면이 말한다", async (platform) => {
    await mountChannel(platform);
    expect(text(descriptionRegion())).toContain("상품정보 → 상세설명");
  });

  it("🔴 원문(영문)을 등록될 글이라고 보여주지 않는다 — 보는 값과 나가는 값이 같다", async () => {
    await mountChannel("smartstore");
    expect(text(descriptionRegion())).not.toContain(EN);
  });
});

describe("④ 🔴 상품정보에서 «등록값» 을 고칠 수 있다", () => {
  const WS = readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("descriptionKo 를 쓰는 편집기가 있다 — 보여주기만 하지 않는다", () => {
    const at = WS.indexOf("상세설명 자동 작성");
    expect(at).toBeGreaterThan(-1);
    const after = WS.slice(at, at + 900);
    expect(after, "자동 작성 옆에 편집기가 없다").toContain("<EditableTextarea");
    expect(after).toContain('updateField("descriptionKo", v)');
  });

  it("🔴 원문 칸(description)은 그대로 남아 있다 — 두 값을 하나로 접지 않았다", () => {
    const SV = readFileSync(join(__dirname, "../SourceDataView.tsx"), "utf8");
    expect(SV).toContain('onUpdateField("description", v)');
  });

  it("🔴 새 생성기를 만들지 않았다 — 같은 provider 의 같은 메서드다", () => {
    expect(WS).toContain("mockProductContentProvider.generateDescription");
  });

  it("🔴 「AI 콘텐츠」 탭은 준비중 그대로다 — URGENT ④ 결정을 뒤집지 않았다", () => {
    /* 🔴 느슨하게 쓰지 않는다. `/content[\s\S]{0,400}disabled/` 로 쓰면 탭이
       열려 있어도 통과한다 — 파일 어딘가의 "content" 와 무관한 disabled 가
       붙는다. p56-tag-visibility 가 쓰는 «실제 그 한 줄» 을 그대로 센다. */
    expect(WS).toContain('<TabButton active={tab === "content"} disabled');
  });
});
