import type { CommerceCategoryNode, CommerceCategoryPathResult } from "@commerce/shared";

/**
 * Sprint N-3.1 — Naver `GET /v1/categories`(last=true 없이 호출)는 leaf뿐
 * 아니라 non-leaf 노드까지 포함한 전체 flat tree를 돌려주고, non-leaf
 * 노드도 실제 id를 갖고 있다(문서에 없는 동작 — debug/naver-category-raw
 * 프로브로 직접 확인, 실측: 5815개 = leaf 4999 + non-leaf 816). 이 파일은
 * 그 전체 목록에서 leaf의 상위 카테고리 id 체인을 복원한다.
 */
export interface NaverCategoryTreeNode {
  id: string;
  name: string;
  /** "출산/육아>유아동잡화>모자" 형태. */
  wholeCategoryName: string;
  last: boolean;
}

export function buildNaverCategoryPath(
  leafId: string,
  allCategories: NaverCategoryTreeNode[],
): CommerceCategoryPathResult {
  const target = allCategories.find((c) => c.id === leafId);
  if (!target) {
    return {
      resolved: false,
      platform: "naver",
      leafCategoryId: leafId,
      leafName: null,
      reason: "카테고리 전체 목록에서 해당 id를 찾지 못했습니다.",
    };
  }

  const byWholeName = new Map(allCategories.map((c) => [c.wholeCategoryName, c]));
  const parts = target.wholeCategoryName.split(">");
  const nodes: CommerceCategoryNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.slice(0, i + 1).join(">");
    const node = byWholeName.get(prefix);
    if (!node) {
      return {
        resolved: false,
        platform: "naver",
        leafCategoryId: leafId,
        leafName: target.name,
        reason: `상위 카테고리("${prefix}")의 id를 전체 목록에서 확인하지 못했습니다.`,
      };
    }
    nodes.push({ id: node.id, name: node.name });
  }

  return {
    resolved: true,
    platform: "naver",
    leafCategoryId: leafId,
    leafName: target.name,
    nodes,
    fullPath: parts.join(" > "),
    depth: nodes.length,
  };
}
