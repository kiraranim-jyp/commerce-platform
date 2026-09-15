import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PlatformPreview } from "../PlatformPreview";
import { LotteOnRegistrationPanel } from "../LotteOnRegistrationPanel";
import { RegistrationStatusBanner } from "../RegistrationStatusBanner";
import { buildPriorityItems, describePriorityItem } from "../readiness-state";
import { computeChecklistReadiness } from "../readiness";
import { manufacturerFixture } from "./manufacturer-fixture";

/**
 * REWORK-4 §2(CEO 지시, 2026-09-14) — **추상 버튼을 없애고 1개 안내를 세운다.**
 *
 * CEO 지시 원문:
 *   ❌ 제거   "부족한 정보 한 번에 해결하기" — 무엇을·어디를 고칠지 불명확하고
 *             눌러도 해결되지 않는다
 *   ✅ 대신   먼저 해결할 항목 1개를, 네 가지를 전부 연결해서:
 *             무엇이 부족한가 → 왜 필요한가 → 어디서 입력하는가 → [바로 이동]
 *   🔴 금지   이동 경로가 없는 안내
 *
 * 이 파일은 그 네 가지가 **렌더 결과에 실제로 서 있는지**만 본다. 소스에
 * 문자열이 있다는 사실은 화면에 그것이 섰다는 증거가 아니다 — 이 저장소가
 * 여러 번 그렇게 틀렸다.
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
    sku: field("B226AC043"),
    description: field("Terry bermuda shorts."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
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
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function renderPlatformTab(platform: PlatformId): string {
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
      manufacturerResolution: manufacturerFixture(),
    }),
  );
}

function renderLotteOnTab(): string {
  return renderToStaticMarkup(
    createElement(LotteOnRegistrationPanel, {
      product: makeProduct(),
      commonPrice: { priceKrw: 128000, resolved: true },
      commonCategorySources: [],
      onChannelInfoChange: () => {},
      onEditCommonInfo: () => {},
      manufacturerResolution: manufacturerFixture(),
    }),
  );
}

const ALL_TABS: [string, () => string][] = [
  ["smartstore", () => renderPlatformTab("smartstore")],
  ["coupang", () => renderPlatformTab("coupang")],
  ["lotteon", renderLotteOnTab],
];

describe("§2 — 「부족한 정보 한 번에 해결하기」가 세 탭 어디에도 없다", () => {
  for (const [name, render] of ALL_TABS) {
    it(`${name} 탭에 추상 버튼이 0건이다`, () => {
      const text = stripTags(render());
      expect(text, `${name}: 추상 버튼이 남아 있다`).not.toContain("부족한 정보 한 번에 해결하기");
    });
  }
});

describe("§2 — 먼저 해결할 항목 1개가 네 가지를 전부 말한다", () => {
  /**
   * 실제 화면과 같은 입력으로 배너 하나를 그린다. priorityItems는 손으로
   * 적지 않는다 — 쿠팡 탭이 쓰는 그 계산(computeChecklistReadiness →
   * buildPriorityItems)을 그대로 부른다.
   */
  function bannerHtml() {
    const summary = computeChecklistReadiness([], UNRESOLVED_CATEGORY);
    const items = buildPriorityItems(summary, true, "section-price");
    return {
      html: renderToStaticMarkup(
        createElement(RegistrationStatusBanner, {
          state: "NEEDS_REVIEW" as const,
          priorityItems: items,
          onItemClick: () => {},
          checkedItems: summary.required,
        }),
      ),
      items,
    };
  }

  /* REWORK-7 ①(CEO 지시, 2026-09-15) — 머리말이 CEO가 §1에 적은 "남은 항목 N개"로
     바뀌었다. **"하나만 펼친다"는 규칙 자체는 그대로다** — 아래 세 검사(무엇/왜/
     어디서/[이동])가 여전히 첫 항목 하나에 대해서만 성립한다. */
  it("머리말이 '남은 항목 N개'다 — 목록이 아니라 하나를 편다", () => {
    const text = stripTags(bannerHtml().html);
    expect(text).toContain("남은 항목");
    // 펼쳐진 항목은 하나뿐이다 — 나머지를 번호로 나열하지 않는다.
    expect(text).not.toContain("그 다음");
  });

  it("① 무엇이 부족한가 · ② 왜 필요한가 · ③ 어디서 입력하는가가 전부 화면에 있다", () => {
    const { html, items } = bannerHtml();
    const guide = describePriorityItem(items[0]);
    const text = stripTags(html);
    expect(text, "무엇이 부족한가가 없다").toContain(stripTags(guide.what));
    expect(text, "왜 필요한가가 없다").toContain(stripTags(guide.why));
    expect(text, "어디서 입력하는가가 없다").toContain(stripTags(guide.where));
  });

  it("④ [바로 이동]이 실제 버튼으로 선다", () => {
    const { html, items } = bannerHtml();
    const guide = describePriorityItem(items[0]);
    expect(guide.action, "카테고리 항목에 갈 곳이 없다").not.toBeNull();
    // 카테고리는 이 화면 안의 「카테고리」 섹션으로 간다(기존 goToSection 그대로).
    expect(guide.action).toEqual({
      kind: "SECTION",
      sectionId: "section-category",
      label: "「카테고리」에서 입력하기 →",
    });
    expect(html).toContain("「카테고리」에서 입력하기 →");
  });

  /**
   * REWORK-7 ①(CEO 판정, 2026-09-15) — **여기 있던 "그 외 확인 항목 N개 ✓ 상품명
   * ✓ 브랜드 …"가 사라졌다.**
   *
   * BEFORE 렌더 덤프에서 이 줄과 바로 아래 준비도 카드가 **같은 필드 목록을 한
   * 기둥 안에서 두 번** 그리고 있었다(쿠팡: ✓ 상품명 ✓ 브랜드 ✓ 대표이미지
   * ✓ 이미지 형식 ✓ 판매가격 ✓ 상세설명 — 두 번). 무엇이 이미 끝났는지는
   * 사라지지 않는다: 아래 「필수 확인」이 **자리 단위**로 말한다(summary-checklist).
   *
   * 배너가 checkedItems로 하는 일은 이제 **세는 것뿐**이다.
   */
  it("통과 여부는 세기만 한다 — 배너가 항목 이름을 나열하지 않는다", () => {
    const summary = computeChecklistReadiness([], UNRESOLVED_CATEGORY);
    const html = renderToStaticMarkup(
      createElement(RegistrationStatusBanner, {
        state: "NEEDS_REVIEW" as const,
        priorityItems: buildPriorityItems(summary, true, "section-price"),
        onItemClick: () => {},
        checkedItems: [
          ...summary.required,
          { label: "상품명", passed: true, required: true },
          { label: "브랜드", passed: true, required: true },
        ],
      }),
    );
    const text = stripTags(html);
    expect(text).not.toContain("그 외 확인 항목");
    expect(text).not.toContain("✓ 상품명");
    expect(text).not.toContain("✓ 브랜드");
    // 미통과 개수(카테고리 1개)는 머리말이 말한다.
    expect(text).toContain("남은 항목 1개");
  });
});

describe("§2 — 🔴 이동 경로가 없는 안내를 만들지 않는다", () => {
  /**
   * 갈 곳이 확실하지 않으면 버튼을 그리지 않는다. 그래서 이 검사는 "버튼이
   * 있다"가 아니라 **"화면에 선 이동 버튼은 전부 실제 목적지를 갖는다"**를 본다.
   *
   * readiness.ts는 대표이미지를 "section-images"로 매핑해 두었는데 그 앵커는
   * PlatformPreview에 존재하지 않는다 — 그런 sectionId가 버튼이 되면 눌러도
   * 아무 데도 가지 않는다. describePriorityItem이 그것을 걸러낸다.
   */
  it("존재하지 않는 섹션으로 보내는 버튼은 만들어지지 않는다", () => {
    const guide = describePriorityItem({
      key: "x",
      label: "대표이미지",
      sectionId: "section-images", // 실제 화면에 없는 앵커
      sourceItems: [{ label: "대표이미지", passed: false, required: true, group: "PRODUCT_INFO" }],
    });
    expect(guide.action, "없는 곳으로 보내는 버튼이 만들어졌다").toBeNull();
    // 그래도 "어디서"는 말한다 — 모른다고 침묵하지 않는다.
    expect(guide.where.length).toBeGreaterThan(0);
  });

  it("세 탭 어디에도 목적지 없는 이동 버튼이 서 있지 않다", () => {
    for (const [name, render] of ALL_TABS) {
      const html = render();
      const doc = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
      const deadLinks = Array.from(doc.querySelectorAll("a")).filter((a) => {
        const href = a.getAttribute("href");
        return href == null || href === "" || href === "#";
      });
      expect(deadLinks.map((a) => a.textContent), `${name}: 갈 곳 없는 링크가 있다`).toEqual([]);
    }
  });
});
