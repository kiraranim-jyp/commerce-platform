import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PlatformPreview } from "../PlatformPreview";

/**
 * REWORK-9(CEO 지시, 2026-09-15) — **«대상정보를 확인중입니다»가 무엇인가.**
 *
 * ── 조사 결과 ─────────────────────────────────────────────────────────────
 * 이 배너는 PlatformPreview 좌측 상세 맨 위에 서고, 두 플래그로만 켜진다
 * (CommerceWorkspace.tsx 실측):
 *
 *   naverCategoryLoading    L1105 effect · deps [tab, product]
 *                           POST /api/naver/category-search — 상품이 바뀔 때마다 자동
 *   naverValidationLoading  L2031 effect · deps [eligible, listing, product, retry]
 *                           500ms 디바운스 → GET /api/naver/resolve →
 *                           buildNaverProductPayload + validateNaverPayload
 *   coupangCategoryFetching L1774 — 셀러가 버튼을 눌렀을 때만 켜진다
 *
 * → **SmartStore에만 뜨는 이유**는 채널 차이가 아니라 배선 차이다. SmartStore만
 *   자동 조회를 둘 걸어 두었고, 쿠팡 쪽 플래그는 사용자가 눌러야 켜진다.
 *
 * ── 판정 ─────────────────────────────────────────────────────────────────
 * **의미 있다 → 제거하지 않는다.** 조회는 읽기 전용이지만(상품을 바꾸지 않는다)
 * 결과를 기다려야 한다 — 등록 게이트가 smartStoreValidation.ok를 쓰고
 * (CommerceWorkspace L2197), 끝나기 전에는 우측 요약의 부족 항목이 확정되지 않는다.
 *
 * 그래서 문구만 바꾸지 않고 **확인 항목을 나열하고 각각의 완료 여부를 보여준다.**
 * 이 파일은 그 세 가지(무엇을 확인하는지 · 현재 상태 · 완료 여부)가 실제 렌더에
 * 전부 서 있는지를 고정한다.
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

describe("REWORK-9 — 확인 중 배너가 무엇을 확인하는지 말한다", () => {
  it("🔴 두 조회를 이름으로 나열한다 — «대상정보»라는 정체불명 낱말이 사라졌다", () => {
    const text = stripTags(renderTab("smartstore", { naverCategoryLoading: true, naverValidationLoading: true }));
    expect(text, "정체를 말하지 않는 옛 문구가 남아 있다").not.toContain("대상정보를 확인중입니다");
    expect(text).toContain("등록 대상 정보를 확인하고 있습니다");
    expect(text).toContain("카테고리 후보 조회");
    expect(text).toContain("등록 가능성 검증");
    // 무엇을 읽어 오는지까지 적는다 — 이름만으로는 셀러가 무엇을 기다리는지 모른다.
    expect(text).toContain("출고지·반품지·배송비·원산지·고시정보를 네이버에서 읽어 판정");
  });

  it("🔴 항목별 완료 여부를 따로 말한다 — 하나가 끝나도 배너가 통째로 «확인 중»이 아니다", () => {
    const text = stripTags(
      renderTab("smartstore", { naverCategoryLoading: false, naverValidationLoading: true }),
    );
    // 끝난 것은 완료, 남은 것은 확인 중 — 둘이 같은 화면에 동시에 선다.
    expect(text).toContain("완료");
    expect(text).toContain("확인 중");
    const categoryIdx = text.indexOf("카테고리 후보 조회");
    const validationIdx = text.indexOf("등록 가능성 검증");
    expect(categoryIdx).toBeGreaterThanOrEqual(0);
    expect(validationIdx).toBeGreaterThan(categoryIdx);
    // 카테고리 줄(= 첫 줄)이 "완료"를 달고 있다.
    expect(text.slice(categoryIdx, validationIdx)).toContain("완료");
    expect(text.slice(categoryIdx, validationIdx)).not.toContain("확인 중");
  });

  it("상품을 바꾸지 않는다는 사실과, 끝나면 무엇이 일어나는지를 적는다", () => {
    const text = stripTags(renderTab("smartstore", { naverCategoryLoading: true }));
    expect(text).toContain("조회만 합니다");
    expect(text).toContain("상품 정보를 바꾸지 않습니다");
    expect(text).toContain("등록 준비 상태");
  });

  it("전부 끝나면 배너가 통째로 사라진다 — 남아서 기다리게 하지 않는다", () => {
    const text = stripTags(
      renderTab("smartstore", { naverCategoryLoading: false, naverValidationLoading: false }),
    );
    expect(text).not.toContain("등록 대상 정보를 확인하고 있습니다");
    expect(text).not.toContain("카테고리 후보 조회");
  });

  it("쿠팡은 셀러가 조회를 누른 동안에만, 그리고 자기 항목 하나만 보여준다", () => {
    const busy = stripTags(renderTab("coupang", { coupangCategoryFetching: true }));
    expect(busy).toContain("등록 대상 정보를 확인하고 있습니다");
    expect(busy).toContain("카테고리 추천 조회");
    // 🔴 쿠팡에는 네이버 검증 줄이 서지 않는다(없는 조회를 있다고 말하지 않는다).
    expect(busy).not.toContain("등록 가능성 검증");

    const idle = stripTags(renderTab("coupang", {}));
    expect(idle, "쿠팡은 누르지 않으면 이 배너가 뜨지 않는다").not.toContain(
      "등록 대상 정보를 확인하고 있습니다",
    );
  });
});
