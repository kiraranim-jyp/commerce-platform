import type { CommerceCategoryNode, CommerceCategoryPathResult } from "@commerce/shared";
import type { CategoryTreeNode } from "./category-tree";

/**
 * Sprint N-3.1 — 쿠팡 `GET .../marketplace/meta/display-categories`(이미
 * category-tree.ts에서 확인/사용 중)는 대분류부터 leaf까지 전체 트리를
 * 중첩 구조로 반환하고, 모든 노드(중간 노드 포함)가 실제
 * displayItemCategoryCode를 갖고 있다. 이 파일은 그 트리에서 root→leaf
 * 경로 전체(id+name)를 DFS로 복원한다 — Naver의 buildNaverCategoryPath와
 * 대응되는 쿠팡판.
 */
function findPath(node: CategoryTreeNode, targetCode: number, ancestors: CommerceCategoryNode[]): CommerceCategoryNode[] | null {
  const path = [...ancestors, { id: String(node.displayItemCategoryCode), name: node.name }];
  if (node.displayItemCategoryCode === targetCode) return path;
  for (const child of node.child ?? []) {
    const found = findPath(child, targetCode, path);
    if (found) return found;
  }
  return null;
}

export function buildCoupangCategoryPath(leafCode: number, tree: CategoryTreeNode): CommerceCategoryPathResult {
  const nodes = findPath(tree, leafCode, []);
  if (!nodes) {
    return {
      resolved: false,
      platform: "coupang",
      leafCategoryId: String(leafCode),
      leafName: null,
      reason: "카테고리 트리에서 해당 코드를 찾지 못했습니다.",
    };
  }
  return {
    resolved: true,
    platform: "coupang",
    leafCategoryId: String(leafCode),
    leafName: nodes[nodes.length - 1].name,
    nodes,
    fullPath: nodes.map((n) => n.name).join(" > "),
    depth: nodes.length,
  };
}
