// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY, type CategoryCandidate } from "@commerce/category";
import { generateNaverCategoryCandidates } from "@commerce/listing";
import { CategoryRecommendationPanel } from "../CategoryRecommendationPanel";

/**
 * GOLF-01.5 축 B(CEO 지시, 2026-09-16) — **화면 증거.**
 *
 * 형제 파일 golf015-three-channel-category.test.ts 는 세 채널의 추천 «함수»가
 * 무엇을 내는지 본다. 그것만으로는 셀러가 화면에서 그 후보를 실제로 «고를 수
 * 있는지» 알 수 없다 — 이 저장소에서 UI 완료 판정이 화면 사실과 어긋난 적이
 * 여러 번 있었다. 여기서는 추천 엔진이 방금 만든 후보를 그대로 패널에
 * 마운트하고, 실제로 [선택] 버튼을 눌러서 판정한다(후보를 손으로 지어내지
 * 않는다 — 엔진 출력 그대로다).
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

/** 실상품 — lazrusgolf.com/products/lazrus-golf-laz2-d-10-5-adjustable-driver.json */
const GOLF_DRIVER = {
  sourceUrl: "https://lazrusgolf.com/products/lazrus-golf-laz2-d-10-5-adjustable-driver",
  title: field("Lazrus Golf LAZ2-D Adjustable Driver"),
  brand: field("LAZRUS Golf"),
  price: field({ amount: 249, currency: "USD" }),
  priceValidity: "VALID",
  sku: field(""),
  description: field("Lazrus Golf LAZ2-D Adjustable Driver (Head Cover Included) Available in 9° and 10.5°."),
  material: field(""),
  color: field(""),
  recommendedAge: field(""),
  manufacturer: field(""),
  careInstructions: field(""),
  options: field([]),
  optionGroups: [],
  variants: [],
  images: [],
  shopifyProductType: "Driver",
  shopifyTags: "Best Seller, Distance, LAZ2",
} as unknown as CanonicalProduct;

/** 한 트리에 골프 자리와 아동/여성 자리를 함께 둔다 — 아동이 «앞»에 있어도
 *  화면에 서는 것이 골프여야 한다. 경로 문자열은 CEO 지시문 원문 그대로다. */
const NAVER_LEAVES = [
  { id: "50000167", wholeCategoryName: "출산/육아>유아동의류>티셔츠" },
  { id: "50000168", wholeCategoryName: "출산/육아>유아동의류>맨투맨/후드티" },
  { id: "50000803", wholeCategoryName: "패션의류>여성의류>맨투맨/스웨트셔츠" },
  { id: "50004780", wholeCategoryName: "스포츠/레저>골프>골프클럽>드라이버" },
  { id: "50004781", wholeCategoryName: "스포츠/레저>골프>골프클럽>아이언" },
];

describe("GOLF-01.5 축 B — 골프 카테고리가 화면에 서고, 눌러서 고를 수 있다", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("🔴 jsdom 마운트 + 실제 클릭 — '스포츠/레저 > 골프 > 골프클럽 > 드라이버'가 보이고 선택된다", async () => {
    // CommerceWorkspace가 API 응답을 CategoryCandidate로 옮기는 것과 같은 모양.
    const candidates: CategoryCandidate[] = generateNaverCategoryCandidates(GOLF_DRIVER, NAVER_LEAVES, 5).map((c) => ({
      id: c.categoryId,
      name: c.categoryPath[c.categoryPath.length - 1]!,
      path: c.categoryPath,
      platform: "smartstore",
      confidence: c.score / 100,
      reason: [c.reason],
      source: "rule",
      isVerifiedPlatformCode: true,
    }));
    expect(candidates.length, "추천 엔진이 후보를 0개 냈다 — 화면 이전 단계에서 이미 실패다").toBeGreaterThan(0);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const picked: string[][] = [];
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(CategoryRecommendationPanel, {
          candidates,
          selection: UNRESOLVED_CATEGORY,
          onSelect: (candidate: CategoryCandidate) => picked.push(candidate.path),
        }),
      );
    });

    const cards = [...container.querySelectorAll("[data-category-candidate]")];
    expect(cards.length, "화면에 후보 카드가 하나도 서지 않았다").toBeGreaterThan(0);
    expect(cards[0]!.textContent).toContain("스포츠/레저 > 골프 > 골프클럽 > 드라이버");
    // 아동 카테고리는 화면에 아예 없다(수정 전 롯데ON 1순위가 유아동 티셔츠였다).
    expect(container.textContent ?? "").not.toContain("유아동");

    const selectButton = [...cards[0]!.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("선택"),
    ) as HTMLButtonElement;
    await act(async () => {
      selectButton.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(picked, "[선택]을 눌렀는데 아무것도 고르지 못했다").toEqual([
      ["스포츠/레저", "골프", "골프클럽", "드라이버"],
    ]);

    await act(async () => root.unmount());
    container.remove();
  });
});
