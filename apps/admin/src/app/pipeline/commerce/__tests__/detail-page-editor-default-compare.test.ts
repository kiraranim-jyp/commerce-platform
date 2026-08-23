import { describe, expect, it } from "vitest";
import { defaultDetailBlocks, type DetailPageBlock } from "@commerce/listing";
import { blocksMatchDefault } from "../detail-block-compare";

/**
 * N-4.08 P1-1(대표님 지시: "상품별 예외 UX") — "기본 설정 사용 중" vs "이 상품만
 * 변경됨" 배지와 "[기본 설정 다시 적용]" 버튼이 blocksMatchDefault()의 정확한
 * 비교 결과에 의존한다. id는 블록 인스턴스마다 새로 발급되는 값(defaultDetailBlocks()
 * 내부 카운터, DetailPageEditor의 newBlockId())이라 실제로 셀러 기본값과 완전히
 * 같은 구성이어도 id만 다를 수 있다 — id 차이 때문에 "변경됨"으로 잘못 표시되면
 * 안 된다.
 */

describe("blocksMatchDefault — id는 무시하고 구성만 비교", () => {
  it("defaultDetailBlocks()를 두 번 호출한 결과(서로 다른 id)는 같다고 판정한다", () => {
    expect(blocksMatchDefault(defaultDetailBlocks(), defaultDetailBlocks())).toBe(true);
  });

  it("enabled를 하나만 바꾸면 다르다고 판정한다(P1-1: 이 상품만 변경됨)", () => {
    const blocks = defaultDetailBlocks().map((b) =>
      b.kind === "TEMPLATE_SECTION" && b.section === "shipping" ? { ...b, enabled: true } : b,
    );
    expect(blocksMatchDefault(blocks, defaultDetailBlocks())).toBe(false);
  });

  it("순서를 바꾸면 다르다고 판정한다", () => {
    const blocks = defaultDetailBlocks();
    const reordered = [blocks[1], blocks[0], ...blocks.slice(2)];
    expect(blocksMatchDefault(reordered, defaultDetailBlocks())).toBe(false);
  });

  it("블록 개수가 다르면(옵트인 블록 추가) 다르다고 판정한다", () => {
    const withExtra: DetailPageBlock[] = [
      ...defaultDetailBlocks(),
      { id: "extra-1", kind: "BRAND_INTRO", enabled: true },
    ];
    expect(blocksMatchDefault(withExtra, defaultDetailBlocks())).toBe(false);
  });

  it("Settings에 저장된 커스텀 기본값과 비교해도 id 차이를 무시하고 정확히 판정한다", () => {
    const sellerDefault: DetailPageBlock[] = defaultDetailBlocks().map((b, i) => ({
      ...b,
      id: `seller-default-${i}`,
    }));
    // 실제로 같은 구성 -> 일치
    const sameConfig: DetailPageBlock[] = sellerDefault.map((b, i) => ({ ...b, id: `product-${i}` }));
    expect(blocksMatchDefault(sameConfig, sellerDefault)).toBe(true);

    // 상단 공통 이미지만 켠 상품 -> 불일치(P1-1: "이 상품만 변경됨")
    const changed = sameConfig.map((b) =>
      b.kind === "COMMON_IMAGE" && b.position === "top" ? { ...b, enabled: true } : b,
    );
    expect(blocksMatchDefault(changed, sellerDefault)).toBe(false);
  });
});
