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
  /** 쿠팡 탭에서만 넘어온다 — 있으면 "쿠팡 API로 카테고리 확인"/검색 UI가 보인다.
   * query를 주면 상품명 대신 그 검색어로 쿠팡 카테고리 예측 API를 호출한다(MVP —
   * 전체 카테고리 트리 대신 검색어 기반으로 실제 쿠팡 API에 물어본다). */
  onFetchCoupangCategory?: (query?: string) => void;
  coupangCategoryFetching?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
        <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => onFetchCoupangCategory()}
            disabled={coupangCategoryFetching}
            className="w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background disabled:opacity-50"
          >
            {coupangCategoryFetching ? "쿠팡 API 확인 중…" : "쿠팡 API로 카테고리 확인"}
          </button>

          {!searching ? (
            <button
              type="button"
              onClick={() => setSearching(true)}
              className="w-full rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-background"
            >
              카테고리 변경 (검색)
            </button>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (searchQuery.trim()) onFetchCoupangCategory(searchQuery);
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="예: 샌들"
                autoFocus
                className="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={coupangCategoryFetching || !searchQuery.trim()}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                검색
              </button>
            </form>
          )}
        </div>
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
                      {candidate.isVerifiedPlatformCode ? (
                        <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          쿠팡 API 추천
                        </span>
                      ) : (
                        // 이 후보는 CartPilot 내부 AI 추천이라 실제 쿠팡 카테고리 코드가
                        // 아니다 — 선택해도 실제 등록은 막힌다("쿠팡 API로 카테고리
                        // 확인" 후보를 골라야 진짜로 등록 가능해진다). 배지가 없으면
                        // 사용자가 이것도 확정 가능한 후보로 오해할 수 있다.
                        <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          참고용 — 등록 불가
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
