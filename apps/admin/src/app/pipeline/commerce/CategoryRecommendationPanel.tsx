"use client";

import { useState } from "react";
import type { CategoryCandidate, CategorySelection } from "@commerce/category";

const REJECT_REASON_TEXT =
  "쿠팡 API가 예측한 카테고리가 이 상품 유형과 명백히 다른 분야라 자동으로 채택하지 않았습니다 — 아래 참고 후보 중에서 고르거나, 검색으로 직접 확인해주세요.";

export function CategoryRecommendationPanel({
  candidates,
  selection,
  onSelect,
  onFetchCoupangCategory,
  coupangCategoryFetching,
  resolverDecision,
}: {
  candidates: CategoryCandidate[];
  selection: CategorySelection;
  onSelect: (candidate: CategoryCandidate) => void;
  /** 쿠팡 탭에서만 넘어온다 — 있으면 "쿠팡 API로 카테고리 확인"/검색 UI가 보인다.
   * query를 주면 상품명 대신 그 검색어로 쿠팡 카테고리 예측 API를 호출한다(MVP —
   * 전체 카테고리 트리 대신 검색어 기반으로 실제 쿠팡 API에 물어본다). */
  onFetchCoupangCategory?: (query?: string) => void;
  coupangCategoryFetching?: boolean;
  /** Sprint A-9(작업2/8) — "등록불가"가 API reject/Resolver reject/낮은 점수 중
   * 무엇인지 사람이 읽을 문장으로 설명한다. REJECT일 때만 배너를 보여준다. */
  resolverDecision?: { decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT"; score: number } | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isConfirmed = selection.state === "SELECTED" || selection.state === "CONFIRMED";
  const verifiedCandidates = candidates.filter((c) => c.isVerifiedPlatformCode);
  const unverifiedCandidates = candidates.filter((c) => !c.isVerifiedPlatformCode);

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

      {expanded && resolverDecision?.decision === "REJECT" && (
        <div className="mt-3 rounded-md border border-warning bg-warning-soft p-3 text-xs text-warning">
          <p className="font-medium">쿠팡 API 추천이 자동 채택되지 않았습니다(유사도 {resolverDecision.score}%)</p>
          <p className="mt-1">{REJECT_REASON_TEXT}</p>
        </div>
      )}

      {/* Sprint A-9(작업2/8 — CEO 지시: "① 쿠팡 API 추천 ② 참고 후보 순서로,
          선택 가능한지 명확히 표시") — 이전엔 신뢰도 순위로만 섞어서 보여줬다.
          isVerifiedPlatformCode로 두 그룹을 나누고, 각 그룹이 무엇을 의미하는지
          헤더에서 먼저 설명한다. */}
      {expanded && verifiedCandidates.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-text-secondary">① 쿠팡 API 추천 — 바로 등록 가능</p>
          <ol className="mt-1.5 space-y-2">
            {verifiedCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                isSelected={isConfirmed && selection.candidate?.id === candidate.id}
                onSelect={onSelect}
                verified
              />
            ))}
          </ol>
        </div>
      )}
      {expanded && unverifiedCandidates.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-text-secondary">② 참고 후보 — AI가 추정, 등록 전 확인 필요</p>
          <p className="mt-0.5 text-[11px] text-text-tertiary">
            실제 쿠팡 카테고리 코드가 아니라 이대로는 등록할 수 없습니다. 위 "쿠팡 API로 카테고리 확인"을
            눌러 실제 후보를 받아오세요.
          </p>
          <ol className="mt-1.5 space-y-2">
            {unverifiedCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                isSelected={isConfirmed && selection.candidate?.id === candidate.id}
                onSelect={onSelect}
                verified={false}
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function CandidateCard({
  candidate,
  isSelected,
  onSelect,
  verified,
}: {
  candidate: CategoryCandidate;
  isSelected: boolean;
  onSelect: (candidate: CategoryCandidate) => void;
  verified: boolean;
}) {
  return (
    <li className={`rounded-md border p-3 ${isSelected ? "border-selected-border bg-selected-soft" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-text-primary">{candidate.path.join(" > ")}</p>
          <p className="mt-0.5 text-xs text-text-secondary">신뢰도 {Math.round(candidate.confidence * 100)}%</p>
          {/* 참고 후보는 기술적 판단 근거(키워드 매칭 등) 대신 한 줄 설명만 —
              대표님 피드백: "왜 등록불가인지 전혀 이해하지 못합니다"의 반대
              방향(왜 이 후보를 추천했는지)도 너무 기술적이면 도움이 안 된다. */}
          {verified && candidate.reason.length > 0 && (
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
}
