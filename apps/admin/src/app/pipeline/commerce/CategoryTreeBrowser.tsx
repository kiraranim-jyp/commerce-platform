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

export function CategoryTreeBrowser({ onSelect }: { onSelect: (candidate: CategoryCandidate) => void }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<TreeNode[]>([]);

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
