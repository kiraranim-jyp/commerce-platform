// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import type { PlatformId } from "@commerce/shared";
import { PlatformPreview } from "../PlatformPreview";
import { makeProduct } from "./product-tab-composition";
import { manufacturerFixture } from "./manufacturer-fixture";
import { mountExpanded, unmountTab } from "./mount-registration-tab";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-7 — **재고는 «배송» 이 아니라 «옵션» 에 산다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 화면을 보고 지적했다: 「Coupang 배송 탭에 재고가 표시됨 — UI 구조상
 * 잘못된 것」. 실제로 `<FieldRow label="재고">` 가 배송 섹션 안에서 배송비·
 * 반품안내와 나란히 서 있었다.
 *
 * 재고는 배송 «조건» 이 아니라 「팔 물건이 몇 개인가」이고, 옵션이 있으면
 * 옵션마다 달라지는 값이다.
 *
 * 🔴 소스 문자열이 아니라 «펼쳐서 그려진 DOM» 을 본다. C-2F 에서 내가 소스의
 * 가장 가까운 주석만 보고 감싼 섹션을 잘못 판정했다 — 섹션 소속은 렌더 결과로만
 * 확실해진다. 접힌 섹션은 자식을 그리지 않으므로 mountExpanded 로 펼친다.
 */

const TABS: PlatformId[] = ["smartstore", "coupang"];

afterEach(async () => {
  await unmountTab();
});

async function renderTab(platform: PlatformId): Promise<HTMLElement> {
  const product = makeProduct();
  const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
  return mountExpanded(
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
    } as never),
  );
}

/**
 * 섹션 «DOM 블록» 의 텍스트. `sectionProps(id)` 가 그 id 를 실제 요소에 붙인다.
 *
 * 🔴 텍스트를 제목으로 잘라 나누지 않는다. 처음에 그렇게 짰다가 옵션 섹션 안의
 * 안내문(「품목별 가격/재고에 그대로 반영됩니다」)의 «가격» 이 다음 섹션 제목으로
 * 오인돼 경계가 재고 앞에서 잘렸다 — 섹션 소속은 문자열 순서가 아니라 «감싼
 * 요소» 로만 확실하다.
 */
function sectionSlice(scope: HTMLElement, id: string): string {
  const block = scope.querySelector(`#${id}`);
  return ((block?.textContent ?? "") as string).replace(/\s+/g, " ");
}

describe.each(TABS)("S-7 — %s 재고의 자리", (platform) => {
  it("🔴 배송 영역에 재고가 «없다»", async () => {
    const scope = await renderTab(platform);
    const shipping = sectionSlice(scope, "section-shipping");
    /* 배송 영역이 실제로 그려졌는지부터 본다 — 빈 문자열이면 아무것도 검사하지
       못한 채 통과한다(가짜 PASS 방지). */
    expect(shipping.length, "배송 영역을 찾지 못했다").toBeGreaterThan(0);
    expect(shipping).not.toContain("재고");
  });

  it("옵션 영역에 재고가 «있다»", async () => {
    const scope = await renderTab(platform);
    const options = sectionSlice(scope, "section-options");
    expect(options.length, "옵션 영역을 찾지 못했다").toBeGreaterThan(0);
    expect(options).toContain("재고");
  });
});

describe("S-7 — 화면과 안내가 «같은 자리» 를 가리킨다", () => {
  /* 다르면 셀러는 안내를 눌러 엉뚱한 섹션으로 간다(REWORK-7 ① · N-3.55 가
     겪은 그 결함). C-2F 때 내가 넣은 section-price 가 정확히 그 상태였다. */
  it("쿠팡·스마트스토어 재고 안내가 section-options 로 간다", async () => {
    const { computeChecklistReadiness, computeNaverPayloadReadiness } = await import("../readiness");
    const coupang = computeChecklistReadiness(
      [{ field: "stock", label: "재고", status: "ERROR", message: "재고 수량이 없거나 0 이하입니다." }],
      { state: "CONFIRMED", candidate: null } as never,
    );
    expect(coupang.items.find((i) => i.label === "재고")?.sectionId).toBe("section-options");

    const naver = computeNaverPayloadReadiness({
      ok: false,
      fields: [{ field: "originProduct.stockQuantity", label: "재고", status: "MISSING", reason: "x" }],
    } as never);
    expect(naver.items.find((i) => i.label === "재고")?.sectionId).toBe("section-options");
  });
});
