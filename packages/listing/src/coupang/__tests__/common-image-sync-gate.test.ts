import { describe, expect, it } from "vitest";
import { assembleContentsFromBlocks, defaultDetailBlocks, type DetailPageBlock } from "../build-payload";

/**
 * N-4.08 긴급 P0(CPO 지시, 2026-08-24) — "상단/하단 공통 이미지가 간헐적으로
 * 반영 안 됨" 근본 원인 회귀 테스트. 실제 버그는 코드 오류가 아니라 UX
 * 설계였다: 상단/하단 공통 이미지가 실제로 payload에 들어가려면 두 개의
 * 독립된 플래그가 둘 다 true여야 한다 —
 *   1) blocks[].enabled (Settings "상세페이지 기본 구성" 카드의 "기본 사용" 체크박스)
 *   2) sellerConfig.topCommonImageEnabled/bottomCommonImageEnabled (Settings
 *      "공통 상단/하단 이미지" 카드의 "사용(ON)" 체크박스)
 * 이 두 체크박스가 서로 다른 카드에 있어서, 사용자가 하나만 바꾸면 화면에는
 * "켰다"고 보여도 실제로는 반영되지 않는다. apps/admin/src/app/settings/page.tsx의
 * setTopCommonImageEnabledSynced/setBottomCommonImageEnabledSynced/
 * handleDetailBlocksChange가 이제 두 플래그를 항상 같이 맞춰서 UI에서는 이
 * 불일치가 다시 발생하지 않게 한다 — 이 테스트는 그 전제가 되는 하위 계약
 * (AND 게이트가 실제로 이렇게 동작한다는 것)을 고정한다.
 */

const baseCtx = {
  aiDescription: "테스트 상품 설명",
  productImageUrls: ["https://example.com/p1.jpg"],
  sizeChartImageUrls: [] as string[],
  template: null,
};

function imagesIn(contents: ReturnType<typeof assembleContentsFromBlocks>): string[] {
  return contents
    .filter((c) => c.contentsType === "IMAGE")
    .map((c) => c.contentDetails[0]?.content)
    .filter((v): v is string => Boolean(v));
}

describe("공통 이미지 AND 게이트 계약 (block.enabled && sellerConfig.xxxEnabled)", () => {
  it("블록은 ON, 판매자 설정은 OFF면 이미지가 안 나온다 — 재발한 실제 사고 시나리오", () => {
    const blocks: DetailPageBlock[] = defaultDetailBlocks().map((b) =>
      b.kind === "COMMON_IMAGE" && b.position === "top" ? { ...b, enabled: true } : b,
    );
    const contents = assembleContentsFromBlocks(blocks, {
      ...baseCtx,
      sellerConfig: {
        topCommonImageUrl: "https://example.com/top.jpg",
        topCommonImageEnabled: false,
        bottomCommonImageUrl: null,
        bottomCommonImageEnabled: false,
      } as never,
    });
    expect(imagesIn(contents)).not.toContain("https://example.com/top.jpg");
  });

  it("판매자 설정은 ON, 블록은 OFF면 이미지가 안 나온다", () => {
    const contents = assembleContentsFromBlocks(defaultDetailBlocks(), {
      ...baseCtx,
      sellerConfig: {
        topCommonImageUrl: "https://example.com/top.jpg",
        topCommonImageEnabled: true,
        bottomCommonImageUrl: null,
        bottomCommonImageEnabled: false,
      } as never,
    });
    // defaultDetailBlocks()의 top COMMON_IMAGE는 enabled:false가 기본값
    expect(imagesIn(contents)).not.toContain("https://example.com/top.jpg");
  });

  it("둘 다 ON이면 이미지가 나온다", () => {
    const blocks: DetailPageBlock[] = defaultDetailBlocks().map((b) =>
      b.kind === "COMMON_IMAGE" && b.position === "top" ? { ...b, enabled: true } : b,
    );
    const contents = assembleContentsFromBlocks(blocks, {
      ...baseCtx,
      sellerConfig: {
        topCommonImageUrl: "https://example.com/top.jpg",
        topCommonImageEnabled: true,
        bottomCommonImageUrl: null,
        bottomCommonImageEnabled: false,
      } as never,
    });
    expect(imagesIn(contents)).toContain("https://example.com/top.jpg");
  });

  it("둘 다 OFF면 이미지가 안 나온다", () => {
    const contents = assembleContentsFromBlocks(defaultDetailBlocks(), {
      ...baseCtx,
      sellerConfig: {
        topCommonImageUrl: "https://example.com/top.jpg",
        topCommonImageEnabled: false,
        bottomCommonImageUrl: "https://example.com/bottom.jpg",
        bottomCommonImageEnabled: false,
      } as never,
    });
    const images = imagesIn(contents);
    expect(images).not.toContain("https://example.com/top.jpg");
    expect(images).not.toContain("https://example.com/bottom.jpg");
  });

  it("하단도 동일한 AND 게이트를 따른다(기본값은 블록 ON)", () => {
    const contentsBothOn = assembleContentsFromBlocks(defaultDetailBlocks(), {
      ...baseCtx,
      sellerConfig: {
        topCommonImageUrl: null,
        topCommonImageEnabled: false,
        bottomCommonImageUrl: "https://example.com/bottom.jpg",
        bottomCommonImageEnabled: true,
      } as never,
    });
    expect(imagesIn(contentsBothOn)).toContain("https://example.com/bottom.jpg");

    const blocksBottomOff: DetailPageBlock[] = defaultDetailBlocks().map((b) =>
      b.kind === "COMMON_IMAGE" && b.position === "bottom" ? { ...b, enabled: false } : b,
    );
    const contentsBlockOff = assembleContentsFromBlocks(blocksBottomOff, {
      ...baseCtx,
      sellerConfig: {
        topCommonImageUrl: null,
        topCommonImageEnabled: false,
        bottomCommonImageUrl: "https://example.com/bottom.jpg",
        bottomCommonImageEnabled: true,
      } as never,
    });
    expect(imagesIn(contentsBlockOff)).not.toContain("https://example.com/bottom.jpg");
  });
});
