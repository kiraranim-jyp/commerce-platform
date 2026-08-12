"use client";

import { useState } from "react";
import type { CategoryCandidate } from "@commerce/category";
import type { CommerceCategoryTreeNode, CommerceCategoryTreeResult } from "@commerce/shared";
import type { PlatformId } from "@commerce/shared";

/** CEO 지시(2026-08-03) — "추천 카테고리 없을시, 쿠팡의 카테고리 검색이 아닌,
 * 목록을 제공해 주면 어때? 검색했더니 안맞는 데이터가 존재 함." predict API
 * 기반 검색은 흔한 검색어 하나만 넣으면(예: "원피스") 관련 없는 카테고리를
 * 낮은 신뢰도로 주는 경우가 실측 확인됐다 — Wing이 쓰는 대분류→소분류 트리
 * 드릴다운이 검색보다 확실하다.
 *
 * N-3.10 Part C — 원래 이 컴포넌트는 쿠팡 전용(원본 트리 모양을 그대로 받아
 * displayItemCategoryCode 필드로 탐색)이었다. CPO 지시("Naver/Coupang 별도
 * 구현 금지, CommerceCategoryTree 같은 공통 SDK")에 따라 CommerceCategoryTreeNode
 * 공통 모양만 알도록 일반화했다 — 트리를 실제로 가져오는 방법(fetchTree)과
 * 선택 결과에 붙일 platform은 호출하는 쪽(Coupang/Naver 각 Preview)이 넘긴다.
 * 서버 쪽 변환은 각 플랫폼 API 라우트(/api/coupang/category-tree,
 * /api/naver/category-tree)가 담당한다. */
function flattenTree(
  node: CommerceCategoryTreeNode,
  ancestors: CommerceCategoryTreeNode[] = [],
): { node: CommerceCategoryTreeNode; path: CommerceCategoryTreeNode[] }[] {
  const path = [...ancestors, node];
  const own = (node.children?.length ?? 0) === 0 ? [{ node, path }] : [];
  const children = (node.children ?? []).flatMap((child) => flattenTree(child, path));
  return [...own, ...children];
}

export function CategoryTreeBrowser({
  platform,
  platformLabel,
  fetchTree,
  onSelect,
}: {
  platform: PlatformId;
  /** "쿠팡" / "네이버" 등 — 선택 확정 메시지에만 쓴다. */
  platformLabel: string;
  fetchTree: () => Promise<CommerceCategoryTreeResult>;
  onSelect: (candidate: CategoryCandidate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<CommerceCategoryTreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<CommerceCategoryTreeNode[]>([]);
  const [treeSearch, setTreeSearch] = useState("");

  async function handleOpen() {
    setOpen(true);
    if (tree || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTree();
      if (result.status !== "OK" || !result.tree) {
        setError(result.error || "카테고리 목록을 불러오지 못했습니다.");
        return;
      }
      setTree(result.tree);
    } catch {
      setError("카테고리 목록을 불러오지 못했습니다 — 네트워크를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function handlePick(node: CommerceCategoryTreeNode, columnIndex: number) {
    setPath((prev) => [...prev.slice(0, columnIndex), node]);
  }

  const columns: CommerceCategoryTreeNode[][] = [];
  if (tree) {
    columns.push(tree.children ?? []);
    for (const node of path) {
      if (!node.children || node.children.length === 0) break;
      columns.push(node.children);
    }
  }
  const leaf = path.length > 0 && !(path[path.length - 1].children?.length);

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
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPath(nodePath);
                        setTreeSearch("");
                      }}
                      className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left text-xs transition-colors hover:bg-background"
                    >
                      <span className="truncate">{nodePath.map((n) => n.name).join(" > ")}</span>
                      {(node.children?.length ?? 0) === 0 && (
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
                    const selected = path[columnIndex]?.id === node.id;
                    const hasChildren = (node.children?.length ?? 0) > 0;
                    return (
                      <li key={node.id}>
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
                    id: path[path.length - 1].id,
                    name: path[path.length - 1].name,
                    path: path.map((n) => n.name),
                    platform,
                    confidence: 1,
                    reason: [`✓ 카테고리 목록에서 직접 선택한 실제 ${platformLabel} 카테고리입니다.`],
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
