"use client";

import { useState } from "react";
import type { CategoryCandidate, CategorySelection } from "@commerce/category";

export function CategoryRecommendationPanel({
  candidates,
  selection,
  onSelect,
  onFetchCoupangCategory,
  coupangCategoryFetching,
}: {
  candidates: CategoryCandidate[];
  selection: CategorySelection;
  onSelect: (candidate: CategoryCandidate) => void;
  /** 쿠팡 탭에서만 넘어온다 — 있으면 "쿠팡 API로 카테고리 확인" 버튼이 보인다. */
  onFetchCoupangCategory?: () => void;
  coupangCategoryFetching?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const isConfirmed = selection.state === "SELECTED" || selection.state === "CONFIRMED";

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <h3 className="text-base font-medium">카테고리 추천</h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            {isConfirmed && selection.candidate
              ? `선택됨: ${selection.candidate.path.join(" > ")}`
              : candidates.length > 0
                ? "추천 후보 중 하나를 선택하세요."
                : "상품명/설명에서 카테고리를 추론할 수 없습니다 — 직접 확인이 필요합니다."}
          </p>
        </div>
        <span className="shrink-0 text-xs text-text-tertiary">{expanded ? "접기" : "펼치기"}</span>
      </button>

      {expanded && onFetchCoupangCategory && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFetchCoupangCategory();
          }}
          disabled={coupangCategoryFetching}
          className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background disabled:opacity-50"
        >
          {coupangCategoryFetching ? "쿠팡 API 확인 중…" : "쿠팡 API로 카테고리 확인"}
        </button>
      )}

      {expanded && candidates.length > 0 && (
        <ol className="mt-3 space-y-2">
          {candidates.map((candidate, index) => {
            const isSelected = isConfirmed && selection.candidate?.id === candidate.id;
            return (
              <li
                key={candidate.id}
                className={`rounded-md border p-3 ${isSelected ? "border-selected-border bg-selected-soft" : "border-border"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-text-tertiary">{index + 1}순위</p>
                      {candidate.isVerifiedPlatformCode && (
                        <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          쿠팡 API 추천
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-text-primary">{candidate.path.join(" > ")}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      신뢰도 {Math.round(candidate.confidence * 100)}%
                    </p>
                    {candidate.reason.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-text-secondary">
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
                    className="shrink-0 rounded border border-border px-3 py-1 text-xs font-medium hover:bg-background disabled:opacity-50"
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
