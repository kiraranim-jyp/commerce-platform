"use client";

import { useState } from "react";
import type { CategoryCandidate, CategorySelection } from "@commerce/category";

/** Sprint A-10(작업2/8 — CEO 지시: "★★★★★ 쿠팡 추천 / ★★★★ 추천 후보 / ★★ 유사
 * 카테고리"처럼 등급을 별점으로") — 실제 쿠팡 API가 검증한 코드(isVerifiedPlatformCode)는
 * 신뢰도 숫자와 무관하게 최고 등급이다(API가 확인해준 실제 코드이기 때문). 나머지는
 * AI 추정치의 confidence로 나눈다. */
function starsFor(candidate: CategoryCandidate, verified: boolean): string {
  if (verified) return "★★★★★";
  if (candidate.confidence >= 0.6) return "★★★★";
  return "★★";
}

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
  /** Sprint A-9(작업2/8) → A-10(작업2/8) — "등록불가"가 API reject/Resolver
   * reject/낮은 점수 중 무엇인지 사람이 읽을 문장으로 설명한다. reason/
   * rejectedCandidates는 scoreCategoryCandidate(packages/category)가 실제로 계산한
   * 대조 근거를 그대로 옮긴 것 — 지어낸 사유 목록이 아니다. */
  resolverDecision?: {
    decision: "AUTO_SELECT" | "RECOMMEND" | "REJECT";
    score: number;
    reason?: string;
    rejectedCandidates?: { categoryName: string; categoryCode: number; score: number; reason: string }[];
  } | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const isConfirmed = selection.state === "SELECTED" || selection.state === "CONFIRMED";

  // Sprint A-10(작업2/8 — CEO 지시: "① 쿠팡 API 추천 ② 추천 후보 ③ 전체 후보
  // 보기") — verified는 항상 최상위(① 쿠팡 API 추천). 나머지는 confidence로
  // ②(0.6 이상 — 바로 눈에 띄게)와 ③(그 미만 — 접어서 필요할 때만 펼침)으로
  // 나눈다. ②③ 둘 다 CandidateCard의 "선택" 버튼이 항상 활성화돼 있어 클릭할
  // 수 있다 — "등록불가"라는 표현은 어디에도 쓰지 않는다(대표님 피드백: "지금은
  // 왜 못 누르는지 모르겠습니다" — 실제로는 늘 눌렀는데 문구만 오해를 줬었다).
  const verifiedCandidates = candidates.filter((c) => c.isVerifiedPlatformCode);
  const unverified = candidates.filter((c) => !c.isVerifiedPlatformCode);
  const recommendedCandidates = unverified.filter((c) => c.confidence >= 0.6);
  const similarCandidates = unverified.filter((c) => c.confidence < 0.6);

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
          <p className="font-medium">이 카테고리는 상품 특성과 맞지 않아 추천하지 않습니다.</p>
          {(resolverDecision.reason || (resolverDecision.rejectedCandidates?.length ?? 0) > 0) && (
            <div className="mt-1.5">
              <p className="font-medium">사유</p>
              <ul className="mt-0.5 space-y-0.5">
                {resolverDecision.reason && <li>- {resolverDecision.reason}</li>}
                {resolverDecision.rejectedCandidates
                  ?.filter((c) => c.reason !== resolverDecision.reason)
                  .map((c) => (
                    <li key={c.categoryCode}>
                      - {c.categoryName}: {c.reason}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <p className="mt-1.5">아래 추천 후보 중에서 고르거나, 검색으로 직접 확인해주세요.</p>
        </div>
      )}

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
      {expanded && recommendedCandidates.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-text-secondary">② 추천 후보 — AI가 추정, 선택 가능</p>
          <ol className="mt-1.5 space-y-2">
            {recommendedCandidates.map((candidate) => (
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
      {expanded && similarCandidates.length > 0 && (
        <div className="mt-3">
          {!showAllCandidates ? (
            <button
              type="button"
              onClick={() => setShowAllCandidates(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              ③ 전체 후보 보기 ({similarCandidates.length}개)
            </button>
          ) : (
            <>
              <p className="text-xs font-medium text-text-secondary">③ 유사 카테고리 — 신뢰도가 낮아 참고용</p>
              <ol className="mt-1.5 space-y-2">
                {similarCandidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    isSelected={isConfirmed && selection.candidate?.id === candidate.id}
                    onSelect={onSelect}
                    verified={false}
                  />
                ))}
              </ol>
            </>
          )}
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
          <p className="mt-0.5 text-xs tracking-wide text-warning" aria-label={`신뢰도 등급 ${starsFor(candidate, verified)}`}>
            {starsFor(candidate, verified)}
          </p>
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
