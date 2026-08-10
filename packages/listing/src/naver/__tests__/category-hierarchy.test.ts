import { describe, expect, it } from "vitest";
import { buildNaverCategoryPath, type NaverCategoryTreeNode } from "../category-hierarchy";

/** N-3.1 — debug/naver-category-raw 프로브로 실제 확인한 값 그대로 사용
 * (50000349 "출산/육아>유아동잡화>모자" ← 50000005 "출산/육아" ← 50000139
 * "출산/육아>유아동잡화"). 조상 노드 id도 전부 실제 production 응답에서
 * 나온 값이다 — 임의로 만든 id가 아니다. */
const ALL_CATEGORIES: NaverCategoryTreeNode[] = [
  { id: "50000005", name: "출산/육아", wholeCategoryName: "출산/육아", last: false },
  { id: "50000139", name: "유아동잡화", wholeCategoryName: "출산/육아>유아동잡화", last: false },
  { id: "50000349", name: "모자", wholeCategoryName: "출산/육아>유아동잡화>모자", last: true },
  { id: "50000000", name: "패션의류", wholeCategoryName: "패션의류", last: false },
];

describe("buildNaverCategoryPath", () => {
  it("실제 leaf id로 root부터 leaf까지 모든 노드의 실제 id를 복원한다", () => {
    const result = buildNaverCategoryPath("50000349", ALL_CATEGORIES);
    expect(result.resolved).toBe(true);
    if (!result.resolved) throw new Error("unreachable");
    expect(result.nodes).toEqual([
      { id: "50000005", name: "출산/육아" },
      { id: "50000139", name: "유아동잡화" },
      { id: "50000349", name: "모자" },
    ]);
    expect(result.fullPath).toBe("출산/육아 > 유아동잡화 > 모자");
    expect(result.depth).toBe(3);
  });

  it("최상위(depth 1) 카테고리는 노드 1개짜리 경로를 반환한다", () => {
    const result = buildNaverCategoryPath("50000000", ALL_CATEGORIES);
    expect(result.resolved).toBe(true);
    if (!result.resolved) throw new Error("unreachable");
    expect(result.nodes).toEqual([{ id: "50000000", name: "패션의류" }]);
  });

  it("목록에 없는 id는 추측하지 않고 resolved:false를 반환한다", () => {
    const result = buildNaverCategoryPath("99999999", ALL_CATEGORIES);
    expect(result.resolved).toBe(false);
    if (result.resolved) throw new Error("unreachable");
    expect(result.reason).toContain("찾지 못했습니다");
  });

  it("상위 노드가 목록에서 누락된 경우도 추측하지 않고 resolved:false를 반환한다", () => {
    const incomplete: NaverCategoryTreeNode[] = [
      { id: "50000349", name: "모자", wholeCategoryName: "출산/육아>유아동잡화>모자", last: true },
    ];
    const result = buildNaverCategoryPath("50000349", incomplete);
    expect(result.resolved).toBe(false);
    if (result.resolved) throw new Error("unreachable");
    expect(result.reason).toContain("확인하지 못했습니다");
  });
});
