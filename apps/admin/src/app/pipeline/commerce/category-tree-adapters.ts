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

/**
 * P2-5b-③ — 롯데ON 트리. 🔴 **네이버와 같은 「통과만」 어댑터다.**
 *
 * 205 는 페이징 응답이라 서버(`/api/lotteon/category-tree`)가 페이징하고 공통
 * `CommerceCategoryTreeNode` 로 변환해 한 번에 내려준다 — 클라이언트가 수십 번
 * fetch 하는 구조를 만들지 않았다. 그래서 여기서 변환할 것이 없다.
 *
 * 🔴 `status` 를 덮어쓰지 않는다. 서버가 `PARSE_EMPTY`(응답은 받았지만 한 건도
 * 못 읽음)를 돌려줄 수 있고, 그것을 「ERROR」로 뭉개면 「카테고리가 없다」와
 * 「우리가 못 읽었다」가 같은 말이 된다 — 셀러가 원인을 못 읽는다.
 */
export async function fetchLotteOnCategoryTree(): Promise<CommerceCategoryTreeResult> {
  const res = await fetch("/api/lotteon/category-tree");
  const data = (await res.json().catch(() => null)) as CommerceCategoryTreeResult | null;
  if (!data) return { status: "ERROR", error: "카테고리 목록을 불러오지 못했습니다." };
  if (data.status !== "OK" || !data.tree) {
    return { status: data.status ?? "ERROR", error: data.error || "카테고리 목록을 불러오지 못했습니다." };
  }
  return data;
}

export async function fetchNaverCategoryTree(): Promise<CommerceCategoryTreeResult> {
  const res = await fetch("/api/naver/category-tree");
  const data = (await res.json()) as CommerceCategoryTreeResult;
  if (data.status !== "OK" || !data.tree) {
    return { status: data.status ?? "ERROR", error: data.error || "카테고리 목록을 불러오지 못했습니다." };
  }
  return data;
}
