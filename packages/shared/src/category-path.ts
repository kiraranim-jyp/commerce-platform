/**
 * Sprint N-3.1 — 모든 커머스 플랫폼이 공유하는 카테고리 계층 타입. 지금까지는
 * "leaf category ID/이름 하나"만 다뤘는데(N-2.9), 사용자가 그 leaf가 실제로
 * 어느 대분류/중분류 아래에 있는지 알 수 없다는 문제가 있었다. 플랫폼별 raw
 * 데이터를 UI에 그대로 노출하지 않고, 이 공통 타입으로 정규화한 뒤 UI는 이
 * 타입 하나만 그리면 되게 한다.
 *
 * 중요: nodes[]의 모든 id는 실제 플랫폼 API 응답에서 나온 값이어야 한다.
 * 상위 카테고리 id를 조회할 방법이 없으면(예: 이름만 있고 id가 없는 경우)
 * CommerceCategoryPathUnresolved로 명확히 "조회 불가"를 표시한다 — 추측으로
 * id를 채우지 않는다(CPO 원칙).
 */
export interface CommerceCategoryNode {
  id: string;
  name: string;
}

export interface CommerceCategoryPath {
  resolved: true;
  platform: string;
  leafCategoryId: string;
  leafName: string;
  /** 최상위(root)부터 leaf까지 순서대로 — 마지막 원소가 leaf와 동일하다. */
  nodes: CommerceCategoryNode[];
  fullPath: string;
  depth: number;
}

export interface CommerceCategoryPathUnresolved {
  resolved: false;
  platform: string;
  leafCategoryId: string;
  leafName: string | null;
  reason: string;
}

export type CommerceCategoryPathResult = CommerceCategoryPath | CommerceCategoryPathUnresolved;

export function formatCommerceCategoryFullPath(nodes: Pick<CommerceCategoryNode, "name">[]): string {
  return nodes.map((n) => n.name).join(" > ");
}
