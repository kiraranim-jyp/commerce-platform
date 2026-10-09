// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { resolveCommonOrigin } from "@commerce/listing";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";
import { expandAllSections } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2-12(CPO ⑧, 2026-10-09) — **칸은 「미확인」인데 payload 는 채워진다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실측(세르지오 타치니): 「공식 홈페이지에서 확인하도록 했는데 실제 반영되지
 * 않음」. 열어 보니 화면과 payload 가 서로 «다른 말» 을 하고 있었다 —
 *
 *   이 칸        product.countryOfOrigin → 비면 「원산지 미확인」
 *   실제 등록값  resolveCommonOrigin()   → 상품 → «브랜드 기본값» → 판매자 기본값
 *
 * 셀러가 공식 자료를 찾으려 칸을 봤을 때 화면은 「없다」고 말하는데, 등록은
 * 브랜드 프로필의 국가로 이미 나가고 있었다. 그래서 「반영되지 않았다」로 읽혔다.
 *
 * ── 🔴 고치지 «않은» 것 ───────────────────────────────────────────────────
 *   · 폴백 사다리 — Production 세 채널이 같은 순서로 돈다. 바꾸면 payload 가
 *     조용히 바뀐다(common/origin.ts 가 그 실측을 주석으로 들고 있다).
 *   · 공식 홈페이지 수집 — 새로 긁지 않는다.
 *   · 브랜드 국가 → 상품 제조국 승격 — 제조국 자동 추론 금지 그대로다.
 *
 * ── 🔴 한 것 ──────────────────────────────────────────────────────────────
 * 서버가 «이미 계산해 둔» 값·출처(naverResolved.origin, N-4.12 후속 P1-1)를
 * 고칠 칸 «옆» 에 적는다. 그 사실은 지금까지 한참 아래 ⑩ 등록정보에서만 보였다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

function makeProduct(origin: string): CanonicalProduct {
  return {
    sourceUrl: "https://www.sergiotacchini.com/product/polo-123",
    title: field("세르지오 타치니 폴로"),
    titleKo: field("세르지오 타치니 폴로"),
    brand: field("Sergio Tacchini"),
    price: field({ amount: 89, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("ST-POLO-01"),
    description: field("설명"),
    descriptionKo: field("설명"),
    material: field("코튼 100%"),
    color: field("화이트"),
    recommendedAge: field(""),
    manufacturer: field("Sergio Tacchini"),
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
    /* 🔴 실측 모양 — 공식몰이 원산지를 적지 않아 이 칸이 «빈» 것이 기본이다. */
    countryOfOrigin: field(origin),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field("따조"),
    itemName: field("성인 폴로"),
    modelName: field("ST-POLO-01"),
    weight: field("250g"),
    certificationType: field(""),
    childCertification: field(null),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

/** 🔴 서버 응답 모양을 손으로 만들지 않는다 — 운영 함수가 낸 값을 그대로 담는다. */
function resolvedOf(productOrigin: string, brandDefault: string | null, sellerDefault: string | null) {
  const common = resolveCommonOrigin({
    product: { value: productOrigin },
    brandDefault,
    sellerDefault,
  });
  return {
    status: "OK" as const,
    /* 🔴 원산지 외의 칸은 «이 테스트가 보는 것이 아니다». 컴포넌트가 마운트되는
       데 필요한 최소 모양만 비워 둔다 — 값을 지어내면 다른 섹션이 그 허구를
       화면에 그린다(fixture 는 더럽게, 단 «빈» 것은 빈 채로). */
    category: null,
    address: { releaseAddressBookNo: null, refundAddressBookNo: null },
    courier: { available: false, value: null, source: null },
    delivery: {
      returnCompanies: [],
      returnCompaniesFetchFailed: false,
      primaryReturnCompany: null,
      deliveryFee: null,
      returnDeliveryFee: null,
      exchangeDeliveryFee: null,
    },
    notice: {
      warrantyPolicy: null,
      afterServiceDirector: null,
      companyContactNumber: null,
      manufacturer: null,
      manufacturerSource: "NONE" as const,
    },
    origin: {
      areaListFetchFailed: false,
      resolvedCountryText: common.value,
      match: { status: "NO_INPUT" as const, code: null, matchedDisplayName: null, requiresImporter: false },
      /* resolve-context.ts:218 의 그 식 그대로다 — 새 판정을 만들지 않는다. */
      resolvedCountryTextSource: productOrigin.trim()
        ? ("PRODUCT_FIELD" as const)
        : brandDefault
          ? ("BRAND_DEFAULT" as const)
          : sellerDefault
            ? ("SELLER_DEFAULT" as const)
            : ("NONE" as const),
    },
  };
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

/**
 * @param staleResolvedFor 🔴 서버 응답이 «낡은» 경우를 만든다. 셀러가 칸에 값을
 *   방금 적었지만 naverResolved 는 아직 다시 받아오지 않은 상태 — 그때 서버가
 *   들고 있는 출처는 여전히 BRAND_DEFAULT 다. 이것이 `!value.trim()` 조건이
 *   실제로 막는 «유일한» 경우이고, 처음에 이 경우를 재지 않아서 그 조건을 지운
 *   변이(O4)가 통과했다.
 */
async function mount(
  productOrigin: string,
  brandDefault: string | null,
  sellerDefault: string | null,
  staleResolvedFor?: string,
) {
  const product = makeProduct(productOrigin);
  await act(async () => {
    root.render(
      createElement(PlatformPreview, {
        manufacturerResolution: manufacturerFixture(),
        product,
        listing: PLATFORM_ADAPTERS.smartstore.toListingModel(
          product,
          UNRESOLVED_CATEGORY,
          undefined,
          "smartstore",
        ),
        categoryCandidates: [],
        listingStatus: "DRAFT" as const,
        listingResult: null,
        naverResolved: resolvedOf(staleResolvedFor ?? productOrigin, brandDefault, sellerDefault),
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

function originField(): HTMLElement {
  const el = container.querySelector("#field-countryOfOrigin");
  if (!el) throw new Error("원산지 칸이 화면에 없다 — 이 테스트의 전제가 깨졌다");
  return el as HTMLElement;
}
function originText(): string {
  return (originField().textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("① 🔴 결함이 실재한다 — 운영 함수로 센다", () => {
  it("상품이 비면 브랜드 기본값이 «등록값» 이 된다", () => {
    const r = resolveCommonOrigin({ product: { value: "" }, brandDefault: "이탈리아", sellerDefault: "중국" });
    expect(r.value).toBe("이탈리아");
    expect(r.valueState).toBe("VALUE");
  });

  it("브랜드가 없으면 판매자 기본값으로 내려간다 — 순서를 바꾸지 않았다", () => {
    const r = resolveCommonOrigin({ product: { value: "" }, brandDefault: null, sellerDefault: "중국" });
    expect(r.value).toBe("중국");
  });

  it("🔴 셋 다 없으면 «만들지 않는다» — MISSING 이다", () => {
    const r = resolveCommonOrigin({ product: { value: "" }, brandDefault: null, sellerDefault: null });
    expect(r.valueState).toBe("MISSING");
    expect(r.value).toBeNull();
  });

  it("상품에 값이 있으면 그것이 먼저다 — 폴백이 덮지 않는다", () => {
    const r = resolveCommonOrigin({ product: { value: "스페인" }, brandDefault: "이탈리아", sellerDefault: "중국" });
    expect(r.value).toBe("스페인");
  });
});

describe("② 🔴 칸 «옆» 에서 무엇이 등록되는지 말한다", () => {
  it("브랜드 기본값으로 채워질 때 값과 출처를 적는다", async () => {
    await mount("", "이탈리아", null);
    const t = originText();
    expect(t, "무엇이 등록되는지 칸 옆에서 알 수 없다").toContain("이탈리아");
    expect(t).toContain("브랜드 기본값");
    expect(t, "상품에서 온 값이 아니라는 말이 없다").toContain("상품에서 확인된 값이 아닙니다");
  });

  it("판매자 기본 설정으로 채워질 때는 그렇게 적는다 — 출처를 뭉개지 않는다", async () => {
    await mount("", null, "중국");
    const t = originText();
    expect(t).toContain("중국");
    expect(t).toContain("판매자 기본 설정");
    expect(t).not.toContain("브랜드 기본값");
  });

  it("🔴 공식 자료로 고치라고 말한다 — 셀러가 할 일을 적는다", async () => {
    await mount("", "이탈리아", null);
    expect(originText()).toContain("공식 자료로 확인한 원산지가 있으면 직접 적어 주세요");
  });
});

describe("③ 🔴 대조군 — 말할 것이 없으면 아무 말도 하지 않는다", () => {
  it("상품에 값이 있으면 폴백 안내를 띄우지 않는다", async () => {
    await mount("스페인", "이탈리아", "중국");
    const t = originText();
    expect(t, "상품 값이 있는데 폴백을 말한다").not.toContain("이 칸이 비어 있어");
    expect(t).not.toContain("브랜드 기본값");
  });

  it("🔴 셋 다 없으면 지어내지 않는다 — 안내도 띄우지 않는다", async () => {
    await mount("", null, null);
    expect(originText()).not.toContain("이 칸이 비어 있어");
  });

  it("🔴🔴 서버 응답이 낡아도 「비어 있다」고 말하지 않는다 — 칸을 먼저 본다", async () => {
    /* 셀러가 「포르투갈」을 방금 적었다. naverResolved 는 아직 그 전 상태라
       출처가 BRAND_DEFAULT 로 남아 있다. 이때 안내를 띄우면 화면이 「이 칸이
       비어 있어 이탈리아가 등록됩니다」라고 «거짓» 을 말한다 — 칸에는 값이 있고
       등록될 값도 포르투갈이다.

       🔴 이 테스트가 없어서 `!product.countryOfOrigin.value.trim()` 를 지운
          변이가 통과했다(O4). 조건이 지키는 경우를 재지 않으면 그 조건은
          가드가 아니라 장식이다. */
    await mount("포르투갈", "이탈리아", null, "");
    expect(originText(), "칸에 값이 있는데 「비어 있다」고 말한다").not.toContain("이 칸이 비어 있어");
    /* 🔴 입력칸의 값은 textContent 에 «없다» — value 속성이다. 처음에 textContent
       로 재서 전제가 깨졌고, 그 실패가 하니스 오류를 잡아 줬다. */
    const input = originField().querySelector("input") as HTMLInputElement | null;
    expect(input?.value, "셀러가 적은 값이 칸에 없다 — 전제가 깨졌다").toBe("포르투갈");
  });
});

describe("④ 🔴 폴백 자체를 건드리지 않았다", () => {
  const ORIGIN = readFileSync(
    join(__dirname, "../../../../../../../packages/listing/src/common/origin.ts"),
    "utf8",
  );

  it("사다리 순서가 그대로다 — 상품 → 브랜드/판매자", () => {
    expect(ORIGIN).toContain('allowedSources: ["USER_CONFIRMED", "COMMON_PRODUCT", "SELLER_SETTINGS"],');
  });

  it("🔴 브랜드가 판매자보다 먼저인 것도 그대로다 — Production 실측 순서다", () => {
    const at = ORIGIN.indexOf('if (source === "SELLER_SETTINGS")');
    const body = ORIGIN.slice(at, at + 600);
    expect(body.indexOf("input.brandDefault")).toBeLessThan(body.indexOf("input.sellerDefault"));
  });

  it("🔴 관용 기본값을 허용하지 않는 규칙도 그대로다", () => {
    expect(ORIGIN).toContain("defaultAllowed: false,");
  });

  it("🔴 공식 홈페이지를 긁는 코드를 더하지 않았다", () => {
    const PV = readFileSync(join(__dirname, "../PlatformPreview.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const forbidden of ["fetch(", "officialSite", "brandSite"]) {
      expect(PV.slice(PV.indexOf("field-countryOfOrigin"), PV.indexOf("field-countryOfOrigin") + 2500)).not.toContain(
        forbidden,
      );
    }
  });
});
