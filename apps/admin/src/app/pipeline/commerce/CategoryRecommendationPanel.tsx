"use client";

import { useState } from "react";
import type { CategoryCandidate, CategorySelection } from "@commerce/category";

export function CategoryRecommendationPanel({
  candidates,
  selection,
  onSelect,
}: {
  candidates: CategoryCandidate[];
  selection: CategorySelection;
  onSelect: (candidate: CategoryCandidate) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isConfirmed = selection.state === "SELECTED" || selection.state === "CONFIRMED";

  return (
    <section className="rounded-lg border border-zinc-200 p-4 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <h3 className="text-base font-medium">카테고리 추천</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            {isConfirmed && selection.candidate
              ? `선택됨: ${selection.candidate.path.join(" > ")}`
              : candidates.length > 0
                ? "추천 후보 중 하나를 선택하세요."
                : "상품명/설명에서 카테고리를 추론할 수 없습니다 — 직접 확인이 필요합니다."}
          </p>
        </div>
        <span className="shrink-0 text-xs text-zinc-400">{expanded ? "접기" : "펼치기"}</span>
      </button>

      {expanded && candidates.length > 0 && (
        <ol className="mt-3 space-y-2">
          {candidates.map((candidate, index) => {
            const isSelected = isConfirmed && selection.candidate?.id === candidate.id;
            return (
              <li
                key={candidate.id}
                className={`rounded border p-3 ${isSelected ? "border-emerald-400 bg-emerald-50" : "border-zinc-200"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-400">{index + 1}순위</p>
                    <p className="font-medium text-zinc-800">{candidate.path.join(" > ")}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      신뢰도 {Math.round(candidate.confidence * 100)}%
                    </p>
                    {candidate.reason.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-500">
                        {candidate.reason.map((r) => (
                          <li key={r}>- {r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(candidate)}
                    disabled={isSelected}
                    className="shrink-0 rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {isSelected ? "선택됨" : "선택"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
