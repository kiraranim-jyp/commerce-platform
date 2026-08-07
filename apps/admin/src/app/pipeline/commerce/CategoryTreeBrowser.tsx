"use client";

import { useState } from "react";
import type { CategoryCandidate } from "@commerce/category";

/** CEO 지시(2026-08-03) — "추천 카테고리 없을시, 쿠팡의 카테고리 검색이 아닌,
 * 목록을 제공해 주면 어때? 검색했더니 안맞는 데이터가 존재 함." predict API
 * 기반 검색은 흔한 검색어 하나만 넣으면(예: "원피스") 관련 없는 카테고리를
 * 낮은 신뢰도로 주는 경우가 실측 확인됐다 — Wing이 쓰는 대분류→소분류 트리
 * 드릴다운이 검색보다 확실하다. /api/coupang/category-tree(display-categories
 * Open API)가 반환하는 원본 트리를 그대로 컬럼별로 탐색한다 — 서버는 가공 없이
 * 그대로 전달하므로 이 컴포넌트가 유일한 판단 지점이다. */
interface TreeNode {
  displayItemCategoryCode: number;
  name: string;
  status: "ACTIVE" | "READY" | "DISABLED";
  child?: TreeNode[];
}

/** CEO 피드백(2026-08-07) — "AI 추천이 어려우면 직접 선택하면 되는데 너무
 * 맞추는 노력이 없다." 트리 드릴다운만 있으면 "kids"/"baby" 같은 키워드를
 * 알아도 대분류부터 몇 단계를 직접 눌러야만 도달할 수 있었다 — 이미 받아온
 * 트리(위 fetch 결과) 전체를 평탄화해서 이름에 검색어가 포함된 노드를 찾고,
 * 클릭하면 그 노드까지의 전체 경로(대분류→...→해당 노드)로 바로 이동한다.
 * 새 API 호출 없이 클라이언트에서만 처리 — 이미 트리를 통째로 갖고 있다. */
function flattenTree(node: TreeNode, ancestors: TreeNode[] = []): { node: TreeNode; path: TreeNode[] }[] {
  const path = [...ancestors, node];
  const own = node.status !== "DISABLED" ? [{ node, path }] : [];
  const children = (node.child ?? []).flatMap((child) => flattenTree(child, path));
  return [...own, ...children];
}

export function CategoryTreeBrowser({ onSelect }: { onSelect: (candidate: CategoryCandidate) => void }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<TreeNode[]>([]);
  const [treeSearch, setTreeSearch] = useState("");

  async function handleOpen() {
    setOpen(true);
    if (tree || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coupang/category-tree");
      const data = await res.json();
      if (data.status !== "OK" || !data.tree) {
        setError(data.error || "카테고리 목록을 불러오지 못했습니다.");
        return;
      }
      setTree(data.tree as TreeNode);
    } catch {
      setError("카테고리 목록을 불러오지 못했습니다 — 네트워크를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function handlePick(node: TreeNode, columnIndex: number) {
    setPath((prev) => [...prev.slice(0, columnIndex), node]);
  }

  const columns: TreeNode[][] = [];
  if (tree) {
    columns.push((tree.child ?? []).filter((n) => n.status !== "DISABLED"));
    for (const node of path) {
      if (!node.child || node.child.length === 0) break;
      columns.push(node.child.filter((n) => n.status !== "DISABLED"));
    }
  }
  const leaf = path.length > 0 && path[path.length - 1] && !(path[path.length - 1].child?.length);

  const trimmedSearch = treeSearch.trim().toLowerCase();
  const searchResults =
    tree && trimmedSearch
      ? flattenTree(tree)
          .filter(({ node }) => node.name.toLowerCase().includes(trimmedSearch))
          .slice(0, 30)
      : [];

  return (
    <div className="mt-3 border-t border-border pt-3">
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
        >
          카테고리 목록에서 직접 찾기
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-secondary">
              카테고리 목록 — 대분류부터 순서대로 눌러 찾아주세요
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-text-tertiary hover:underline"
            >
              닫기
            </button>
          </div>

          {loading && <p className="mt-2 text-xs text-text-tertiary">전체 카테고리를 불러오는 중… (최초 1회, 몇 초 걸릴 수 있습니다)</p>}
          {error && <p className="mt-2 text-xs text-error">{error}</p>}

          {tree && (
            <input
              type="text"
              value={treeSearch}
              onChange={(event) => setTreeSearch(event.target.value)}
              placeholder="이름으로 찾기 — 예: 유아동, 키즈"
              className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            />
          )}

          {trimmedSearch && (
            <ul className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-border bg-white">
              {searchResults.length === 0 ? (
                <li className="px-2 py-1.5 text-xs text-text-tertiary">일치하는 카테고리가 없습니다.</li>
              ) : (
                searchResults.map(({ node, path: nodePath }) => (
                  <li key={node.displayItemCategoryCode}>
                    <button
                      type="button"
                      onClick={() => {
                        setPath(nodePath);
                        setTreeSearch("");
                      }}
                      className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left text-xs transition-colors hover:bg-background"
                    >
                      <span className="truncate">{nodePath.map((n) => n.name).join(" > ")}</span>
                      {(node.child?.length ?? 0) === 0 && (
                        <span className="shrink-0 text-[10px] text-selected-border">선택 가능</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {columns.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto rounded-md border border-border bg-background p-1.5">
              {columns.map((column, columnIndex) => (
                <ul
                  key={columnIndex}
                  className="max-h-64 w-40 shrink-0 overflow-y-auto rounded border border-border bg-white"
                >
                  {column.map((node) => {
                    const selected = path[columnIndex]?.displayItemCategoryCode === node.displayItemCategoryCode;
                    const hasChildren = (node.child?.length ?? 0) > 0;
                    return (
                      <li key={node.displayItemCategoryCode}>
                        <button
                          type="button"
                          onClick={() => handlePick(node, columnIndex)}
                          className={`flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left text-xs transition-colors hover:bg-background ${
                            selected ? "bg-selected-soft font-medium text-selected-border" : "text-text-primary"
                          }`}
                        >
                          <span className="truncate">{node.name}</span>
                          {hasChildren && <span className="shrink-0 text-text-tertiary">›</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          )}

          {leaf && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-selected-border bg-selected-soft p-2.5">
              <p className="text-xs font-medium text-text-primary">{path.map((n) => n.name).join(" > ")}</p>
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    id: String(path[path.length - 1].displayItemCategoryCode),
                    name: path[path.length - 1].name,
                    path: path.map((n) => n.name),
                    platform: "coupang",
                    confidence: 1,
                    reason: ["✓ 카테고리 목록에서 직접 선택한 실제 쿠팡 카테고리입니다."],
                    source: "rule",
                    isVerifiedPlatformCode: true,
                  })
                }
                className="shrink-0 rounded border border-selected-border bg-white px-3 py-1 text-xs font-medium text-selected-border hover:bg-selected-soft"
              >
                이 카테고리로 선택
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
