import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PlatformPreview } from "../PlatformPreview";
import { manufacturerFixture } from "./manufacturer-fixture";

/**
 * REWORK-10 B(CEO 정정, 2026-09-15) — **SmartStore 전용 대기 UI 제거.**
 *
 * ── 이 파일의 역사 ────────────────────────────────────────────────────────
 * REWORK-9에서 이 파일은 「등록 대상 정보를 확인하고 있습니다」 배너가 **무엇을**
 * 확인하는지 적혔는지를 고정했다. CEO 판정이 뒤집혔다 — 요구는 제거다.
 * 스마트스토어만 중간 상태를 보여주는 구조 자체가 세 탭의 UX 차이였다.
 *
 * ── 조회는 그대로 돈다 ────────────────────────────────────────────────────
 *   naverCategoryLoading    POST /api/naver/category-search  (상품이 바뀔 때 자동)
 *   naverValidationLoading  GET  /api/naver/resolve → validateNaverPayload
 * 둘 다 살아 있고, 등록 게이트도 그대로 smartStoreValidation.ok를 쓴다.
 * 바뀐 것은 **그 사실을 스마트스토어 탭 전용 화면으로 보여주던 자리**뿐이고,
 * 그 상태는 세 채널 공용 UI 두 곳으로 흡수됐다(아래 테스트가 그것을 잡는다).
 */
function field<T>(value: T) {
  return { value, source: "USER_EDITED", confidence: 1 } as never;
}

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/a",
    title: field("Terry Bermuda Shorts"),
    brand: field("Bobo Choses"),
    price: field({ amount: 50, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("AAA1804916"),
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
    childCertification: field(null),
    itemName: field("아동용 반바지"),
    modelName: field("B226AC043"),
    weight: field("120g"),
    certificationType: field("안전확인대상"),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    priceOverrideKrw: undefined,
  } as unknown as CanonicalProduct;
}

function renderTab(platform: PlatformId, flags: Record<string, unknown>): string {
  const product = makeProduct();
  const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
  return renderToStaticMarkup(
    createElement(PlatformPreview, {
      manufacturerResolution: manufacturerFixture(),
      product,
      listing,
      categoryCandidates: [],
      listingStatus: "DRAFT" as const,
      listingResult: null,
      onUpdateField: () => {},
      onSelectCategory: () => {},
      onOpenListingModal: () => {},
      onRetryListing: () => {},
      developerMode: false,
      ...flags,
    } as never),
  );
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("REWORK-10 B — SmartStore 전용 대기 UI가 없다", () => {
  /**
   * 🔴 CEO 정정(2026-09-15) — REWORK-9은 이 배너에 **이름을 붙였다.** 이번 판정은
   * **제거**다: 세 채널 중 스마트스토어만 중간 상태를 보여주는 구조 자체가
   * UX 차이였다. 그래서 이 파일은 이제 "무엇을 확인하는지 적혔는가"가 아니라
   * **"그 화면이 없는가"**를 렌더 결과로 고정한다.
   */
  const BANNER_MARKERS = [
    "등록 대상 정보를 확인하고 있습니다",
    "대상정보를 확인중입니다",
    "카테고리 후보 조회",
    "등록 가능성 검증",
    "조회만 합니다",
    "상품 정보를 바꾸지 않습니다",
  ];

  it("🔴 조회가 전부 도는 동안에도 스마트스토어 전용 배너가 0건이다", () => {
    const text = stripTags(
      renderTab("smartstore", { naverCategoryLoading: true, naverValidationLoading: true }),
    );
    for (const marker of BANNER_MARKERS) {
      expect(text, `스마트스토어 전용 대기 UI가 남아 있다 — ${marker}`).not.toContain(marker);
    }
  });

  it("🔴 조회가 끝난 뒤에도 마찬가지다 — 상태에 관계없이 이 화면은 존재하지 않는다", () => {
    const text = stripTags(
      renderTab("smartstore", { naverCategoryLoading: false, naverValidationLoading: false }),
    );
    for (const marker of BANNER_MARKERS) {
      expect(text, marker).not.toContain(marker);
    }
  });

  it("🔴 쿠팡에도 같은 배너가 없다 — 한 채널만 다른 화면을 갖지 않는다", () => {
    const busy = stripTags(renderTab("coupang", { coupangCategoryFetching: true }));
    for (const marker of BANNER_MARKERS) {
      expect(busy, marker).not.toContain(marker);
    }
  });

  /**
   * 🔴 조회를 없앤 것이 아니다 — **다른 채널과 같은 자리로 흡수**했다.
   *
   *   등록 가능성 검증 중  → 우측 요약의 「필수 확인 · 확인 중…」
   *                          (RegistrationReadinessCard의 isCalculating — 세 채널 공용)
   *   카테고리 조회 중      → 카테고리 추천 패널 안의 「AI 추천을 불러오는 중…」
   *                          (쿠팡이 이미 쓰던 그 한 줄)
   */
  it("등록 가능성 검증 중은 세 채널 공용 우측 요약이 말한다", () => {
    const text = stripTags(renderTab("smartstore", { naverValidationLoading: true }));
    expect(text).toContain("필수 확인");
    expect(text).toContain("확인 중…");
  });

  it("카테고리 조회 중은 세 채널 공용 카테고리 패널이 말한다", () => {
    const text = stripTags(renderTab("smartstore", { naverCategoryLoading: true }));
    expect(text).toContain("카테고리 후보를 불러오는 중…");
  });

  /** 🔴 등록 게이트는 한 줄도 바뀌지 않았다 — 조회 자체는 그대로 돈다. */
  it("등록 게이트(smartStoreValidation.ok)가 그대로 남아 있다", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../../CommerceWorkspace.tsx", import.meta.url), "utf8"),
    );
    expect(source).toContain("smartStoreValidation ? smartStoreValidation.ok : true");
    expect(source).toContain("/api/naver/resolve");
  });
});
