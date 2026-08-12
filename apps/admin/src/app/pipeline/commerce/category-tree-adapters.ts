import type { CommerceCategoryTreeNode, CommerceCategoryTreeResult } from "@commerce/shared";

/**
 * N-3.10 Part C — CategoryTreeBrowser는 CommerceCategoryTreeNode 공통 모양만
 * 안다. 이 파일은 플랫폼별 원본 응답(쿠팡의 displayItemCategoryCode/child,
 * 네이버는 서버가 이미 공통 모양으로 변환해서 줌)을 그 공통 모양으로 바꾸는
 * "얇은" 어댑터만 담당한다 — 트리 UI 자체를 플랫폼별로 새로 만들지 않는다.
 */
interface CoupangRawCategoryNode {
  displayItemCategoryCode: number;
  name: string;
  status: "ACTIVE" | "READY" | "DISABLED";
  child?: CoupangRawCategoryNode[];
}

function coupangNodeToCommon(node: CoupangRawCategoryNode): CommerceCategoryTreeNode {
  const children = (node.child ?? [])
    .filter((child) => child.status !== "DISABLED")
    .map(coupangNodeToCommon);
  return {
    id: String(node.displayItemCategoryCode),
    name: node.name,
    children: children.length > 0 ? children : undefined,
  };
}

export async function fetchCoupangCategoryTree(): Promise<CommerceCategoryTreeResult> {
  const res = await fetch("/api/coupang/category-tree");
  const data = (await res.json()) as { status?: string; tree?: CoupangRawCategoryNode; error?: string };
  if (data.status !== "OK" || !data.tree) {
    return { status: data.status ?? "ERROR", error: data.error || "카테고리 목록을 불러오지 못했습니다." };
  }
  return { status: "OK", tree: coupangNodeToCommon(data.tree) };
}

export async function fetchNaverCategoryTree(): Promise<CommerceCategoryTreeResult> {
  const res = await fetch("/api/naver/category-tree");
  const data = (await res.json()) as CommerceCategoryTreeResult;
  if (data.status !== "OK" || !data.tree) {
    return { status: data.status ?? "ERROR", error: data.error || "카테고리 목록을 불러오지 못했습니다." };
  }
  return data;
}
