"use client";

import { useState } from "react";
import type { CategoryCandidate, CategorySelection } from "@commerce/category";
import { CategoryCandidateCard, candidateStars } from "./CategoryCandidateCard";
import { CategoryTreeBrowser } from "./CategoryTreeBrowser";
import { fetchCoupangCategoryTree, fetchNaverCategoryTree } from "./category-tree-adapters";

/** A-12.3-P0-4(CPO 3차 지시 — regression 수정: "AI 추천 → 항상 표시 / 검색 →
 * 결과 리스트까지 항상 동작 / 이 둘은 대체관계가 아니라 항상 동시에 존재해야
 * 한다") — 이전 버전은 candidates 하나를 추천/검색 겸용으로 썼고, "검증된
 * 것만 노출"이 겹치면서 두 기능이 동시에 죽는 회귀가 있었다(실측 확인,
 * git 4dbd5eb). 이번 버전은 두 결과를 완전히 분리된 prop(candidates=AI
 * 추천, searchCandidates=직접 검색)으로 받아 항상 나란히 렌더링한다. */
/**
 * REWORK-11 ①(CEO 지시, 2026-09-15) — **카테고리 추천이 서는 껍데기.**
 *
 * 롯데ON 탭도 "추천 → 후보 카드 → 선택"을 하는데, 그 목록이 앉아 있던 상자는
 * 이 파일의 것이 아니라 전용 박스였다(`rounded-md border bg-background px-3
 * py-2` — 여기는 `rounded-lg border p-4`). 제목 줄도 접기/펼치기도 없었다.
 * 같은 일을 하는 자리가 탭마다 다른 상자에 담겨 있으면 "같은 등록 화면"은
 * 렌더 결과에서 거짓이다.
 *
 * 🔴 판정·점수·후보는 여기 들어오지 않는다 — 껍데기만이다.
 */
export function CategoryRecommendationShell({
  subtitle,
  children,
}: {
  /** 제목 아래 한 줄 — 고른 카테고리 경로 또는 무엇을 하라는 안내. */
  subtitle: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <h3 className="text-base font-medium">카테고리 추천</h3>
          <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
        </div>
        <span className="shrink-0 text-xs text-text-tertiary">{expanded ? "접기" : "펼치기"}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-4" onClick={(event) => event.stopPropagation()}>
          {children}
        </div>
      )}
    </section>
  );
}

export function CategoryRecommendationPanel({
  candidates,
  selection,
  onSelect,
  onFetchCoupangCategory,
  coupangCategoryFetching,
  resolverDecision,
  searchCandidates,
  searchAttempted,
  recommendAttempted,
  candidatesLoading,
  candidatesError,
  onRetryCandidates,
}: {
  /**
   * COMMERCE-UI-PARITY-02 P1-3 — 후보가 «없는» 것이 아니라 조회가 «실패» 했을
   * 때의 사유. 있으면 화면은 「추천 못 함」 대신 「조회 실패」를 말한다.
   * 🔴 판정을 여기서 만들지 않는다 — 조회한 쪽이 준 문장을 그대로 쓴다.
   */
  candidatesError?: string | null;
  /** 같은 입력으로 조회를 다시 쏜다. 쿠팡에는 이미 있던 [다시 확인]과 같은 일. */
  onRetryCandidates?: () => void;
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
  /** "직접 검색" 결과 — AI 추천(candidates)과 완전히 분리된 목록. */
  searchCandidates?: CategoryCandidate[];
  /** 검색을 한 번이라도 시도했는지 — 결과가 0개일 때 "검색 결과 없음"과
   * "아직 검색 안 함"을 구분하는 데 쓴다. */
  searchAttempted?: boolean;
  /** AI 추천을 한 번이라도 시도했는지(자동 fetch 포함) — 0개일 때 "추천 결과
   * 없음"과 "아직 불러오는 중"을 구분하는 데 쓴다. */
  recommendAttempted?: boolean;
  /**
   * REWORK-10 B(CEO 지시, 2026-09-15) — 스마트스토어의 카테고리 후보 조회가
   * 도는 중인가(CommerceWorkspace의 naverCategoryLoading).
   *
   * 이 prop이 생긴 이유: 스마트스토어 탭 맨 위에 있던 **전용 대기 배너**가
   * 사라졌기 때문이다. 조회 자체는 그대로 돈다 — 그 사실을 말하는 자리를
   * 쿠팡이 이미 쓰던 그 자리(아래 "AI 추천을 불러오는 중…")로 옮긴다.
   */
  candidatesLoading?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const isConfirmed = selection.state === "SELECTED" || selection.state === "CONFIRMED";

  const isCoupang = !!onFetchCoupangCategory;

  // Sprint A-10(작업2/8 — CEO 지시: "① 쿠팡 API 추천 ② 추천 후보 ③ 전체 후보
  // 보기") — verified는 항상 최상위(① 쿠팡 API 추천). 나머지는 confidence로
  // ②(0.6 이상 — 바로 눈에 띄게)와 ③(그 미만 — 접어서 필요할 때만 펼침)으로
  // 나눈다. ②③ 둘 다 CandidateCard의 "선택" 버튼이 항상 활성화돼 있어 클릭할
  // 수 있다 — "등록불가"라는 표현은 어디에도 쓰지 않는다(대표님 피드백: "지금은
  // 왜 못 누르는지 모르겠습니다" — 실제로는 늘 눌렀는데 문구만 오해를 줬었다).
  // CEO 피드백(2026-08-04) — 쿠팡 탭은 CommerceWorkspace가 이미 순수
  // coupangApiCandidates만 내려주므로(rule-based 제거), verified/recommended/
  // similar로 다시 나눌 이유가 없다(CPO 지적) — 아래 3분할은 스마트스토어 등
  // rule-based만 존재하는 비-쿠팡 탭에서만 쓴다.
  // Sprint P2(CEO 지시, 2026-08-19: "카테고리 추천은 가장 높은 3개만 —
  // 지금 너무 많다") — verified(쿠팡 API가 확인한 코드)를 항상 최우선으로
  // 남기고, 그다음 confidence 내림차순으로 최대 3개까지만 보여준다. 정렬만
  // 다시 하고 점수 자체는 그대로 쓴다(새 판정 로직 아님) — "직접 검색"
  // 결과(searchCandidates)는 사용자가 명시적으로 검색한 결과라 이 상한
  // 대상이 아니다(그대로 둔다).
  const topCandidates = [...candidates]
    .sort((a, b) => {
      if (a.isVerifiedPlatformCode !== b.isVerifiedPlatformCode) return a.isVerifiedPlatformCode ? -1 : 1;
      return b.confidence - a.confidence;
    })
    .slice(0, 3);
  const verifiedCandidates = topCandidates.filter((c) => c.isVerifiedPlatformCode);
  const unverified = topCandidates.filter((c) => !c.isVerifiedPlatformCode);
  const recommendedCandidates = unverified.filter((c) => c.confidence >= 0.6);
  const similarCandidates = unverified.filter((c) => c.confidence < 0.6);

  const search = searchCandidates ?? [];
  const verifiedSearch = search.filter((c) => c.isVerifiedPlatformCode);
  const otherSearch = search.filter((c) => !c.isVerifiedPlatformCode);

  const recommendEmpty = candidates.length === 0;
  const recommendLoading = !!candidatesLoading || (!!coupangCategoryFetching && !recommendAttempted);

  return (
    <CategoryRecommendationShell
      subtitle={
        isConfirmed && selection.candidate
          ? `선택됨: ${selection.candidate.path.join(" > ")}`
          : "AI 추천 또는 검색으로 카테고리를 선택하세요."
      }
    >
      {/* ── 추천 (항상 존재) ─────────────────────────────────── */}
      <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-text-secondary">
                {isCoupang ? "쿠팡 추천 카테고리" : "AI 추천"}
              </p>
              {isCoupang && (
                <button
                  type="button"
                  onClick={() => onFetchCoupangCategory!()}
                  disabled={coupangCategoryFetching}
                  className="rounded border border-border px-2 py-0.5 text-[11px] font-medium text-text-tertiary transition-colors hover:bg-background disabled:opacity-50"
                >
                  {coupangCategoryFetching ? "확인 중…" : "다시 확인"}
                </button>
              )}
            </div>

            {resolverDecision?.decision === "REJECT" && (
              <div className="mt-2 rounded-md border border-warning bg-warning-soft p-3 text-xs text-warning">
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

            {/* CEO 피드백(2026-08-04) — 쿠팡 탭은 candidates가 이미 순수
                coupangApiCandidates뿐이라 verified/recommended/similar 3단계로
                다시 나눌 필요가 없다(CPO 지적) — 그냥 하나의 목록으로 나열한다.
                스마트스토어 등 rule-based만 있는 탭은 기존 ①②③ 등급 표시를
                그대로 쓴다. */}
            {isCoupang ? (
              topCandidates.length > 0 && (
                <ol className="mt-2 space-y-2">
                  {topCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      isSelected={isConfirmed && selection.candidate?.id === candidate.id}
                      onSelect={onSelect}
                      verified={candidate.isVerifiedPlatformCode ?? false}
                    />
                  ))}
                </ol>
              )
            ) : (
              <>
                {verifiedCandidates.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-text-secondary">① 검증된 카테고리 — 바로 등록 가능</p>
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
                {recommendedCandidates.length > 0 && (
                  <div className="mt-2">
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
                {similarCandidates.length > 0 && (
                  <div className="mt-2">
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
                  </div>
                )}
              </>
            )}

            {/* A-12.3-P0-4 — 후보가 진짜 0개일 때 빈 화면 대신 명시적 안내를
                보여준다(CPO 지시: "추천이 없으면 빈화면이 아니라 '추천 결과가
                없습니다. 검색을 이용해주세요.'를 보여주세요"). 아직 첫 시도
                전이거나 로딩 중이면 빈 화면 대신 진행 상태를 보여준다.
                SmartStore 플로우 개선 STEP2(CPO 지시: "자동 추천 실패 시 카테고리를 직접
                선택하는 fallback을 제공") — 스마트스토어(비-쿠팡)는 검색
                UI가 없으므로 "검색을 이용해주세요" 대신 아래 카테고리 목록
                브라우저를 가리킨다. */}
            {/* ══ COMMERCE-UI-PARITY-02 P1-3(CEO 지시, 2026-09-22) ══
                「조회가 실패했다」가 먼저 온다. 예전에는 이 분기가 없어서 실패가
                아래 「자동으로 결정하지 못했습니다」로 흘러갔다 — 추천기가 상품을
                보고 «못 고른 것»과 조회가 «닿지도 못한 것»이 한 문장이었다.
                🔴 실패는 다시 시도하면 풀릴 수 있는 일이므로 [다시 확인]을 함께
                세운다. 롯데ON 카테고리 실패(REWORK-12 ②)가 이미 쓰는 모양이다. */}
            {recommendEmpty && candidatesError && !recommendLoading && (
              <div className="mt-2 rounded-md bg-error/5 px-3 py-2.5">
                <p className="text-xs font-medium text-error">🔴 카테고리 조회 실패 — {candidatesError}</p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  잠시 후 다시 확인하거나, 아래 목록에서 카테고리를 직접 선택해 주세요.
                </p>
                {onRetryCandidates && (
                  <button
                    type="button"
                    onClick={onRetryCandidates}
                    className="mt-2 rounded border border-error/40 px-2 py-0.5 text-[11px] font-medium text-error transition-colors hover:bg-error-soft"
                  >
                    다시 확인
                  </button>
                )}
              </div>
            )}

            {recommendEmpty && !(candidatesError && !recommendLoading) && (
              <p className="mt-2 rounded-md bg-background p-2.5 text-xs text-text-tertiary">
                {recommendLoading || (isCoupang && !recommendAttempted)
                  ? "AI 추천을 불러오는 중…"
                  : isCoupang
                    ? "추천 결과가 없습니다. 검색을 이용해주세요."
                    : "⚠️ 카테고리를 자동으로 결정하지 못했습니다. 아래에서 카테고리를 직접 선택해주세요."}
              </p>
            )}

            {/* SmartStore 플로우 개선 STEP2 — 자동 추천(AI)을 대체하는 게 아니라, 실패했을 때도
                항상 손닿는 곳에 있는 안전한 fallback이다(Coupang이 이미 검색+
                트리 브라우저를 이렇게 항상 노출해왔다 — 같은 패턴). 스마트스토어
                전용 트리는 /api/naver/category-tree(fetchNaverCategoryTree,
                N-3.10에서 이미 만들어져 있었지만 이 화면에 연결된 적이 없었다)를
                그대로 재사용한다 — 새 API 없음. */}
            {!isCoupang && (
              <CategoryTreeBrowser
                platform="smartstore"
                platformLabel="스마트스토어"
                fetchTree={fetchNaverCategoryTree}
                onSelect={onSelect}
              />
            )}
          </div>

          {/* ── 직접 검색 (항상 존재, 추천의 대체가 아니라 별도 경로) ──── */}
          {isCoupang && (
            <div>
              <p className="text-xs font-medium text-text-secondary">직접 검색</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (searchQuery.trim()) onFetchCoupangCategory!(searchQuery);
                }}
                className="mt-1.5 flex gap-1.5"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="예: 샌들"
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

              {verifiedSearch.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-text-secondary">검색결과 — 바로 등록 가능</p>
                  <ol className="mt-1.5 space-y-2">
                    {verifiedSearch.map((candidate) => (
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
              {otherSearch.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-text-secondary">검색결과 — 참고용</p>
                  <ol className="mt-1.5 space-y-2">
                    {otherSearch.map((candidate) => (
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
              {/* A-12.3-P0-4(CPO 지시: "검색 버튼만 있고 아무 결과도 안 나오면
                  안 된다") — 검색을 시도했는데 결과가 0개면 반드시 사유를
                  보여준다. 아직 검색을 안 했으면(searchAttempted=false)
                  아무것도 보여주지 않는다(빈 결과와 "아직 안 함"을 구분). */}
              {search.length === 0 && searchAttempted && !coupangCategoryFetching && (
                <p className="mt-2 rounded-md bg-background p-2.5 text-xs text-text-tertiary">
                  검색 결과가 없습니다 — 다른 검색어로 다시 시도해주세요.
                </p>
              )}

              {/* CEO 지시(2026-08-03) — 검색(predict API)이 흔한 검색어에서
                  관련없는 카테고리를 줄 때가 있다(실측 확인) — 대분류부터
                  직접 훑어 고르는 목록형 대안. */}
              <CategoryTreeBrowser
                platform="coupang"
                platformLabel="쿠팡"
                fetchTree={fetchCoupangCategoryTree}
                onSelect={onSelect}
              />
            </div>
          )}
    </CategoryRecommendationShell>
  );
}

/**
 * REWORK-10 C(CEO 지시, 2026-09-15) — 모양은 공통 카드(CategoryCandidateCard)가
 * 그린다. 여기 남는 것은 **CategoryCandidate를 그 카드의 입력으로 옮겨 적는 일**
 * 하나뿐이다 — 롯데ON 탭이 같은 카드를 쓰기 때문에 세 탭의 선택 동작이 같다.
 */
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
  /* N-3.1 — leaf 이름 하나가 아니라 전체 경로. hierarchy(실제 id 포함)가 있으면
     그걸 우선 쓰고, 없으면 path(이름만)로 대체한다. */
  const path = candidate.hierarchy?.resolved
    ? candidate.hierarchy.nodes.map((n) => n.name)
    : candidate.path;
  return (
    <CategoryCandidateCard
      path={path}
      stars={candidateStars(candidate.confidence, verified)}
      /* 참고 후보는 기술적 판단 근거(키워드 매칭 등) 대신 등급만 — 대표님
         피드백: 너무 기술적이면 도움이 안 된다. */
      reasons={verified ? candidate.reason : []}
      detail={
        !candidate.hierarchy?.resolved && candidate.path.length <= 1
          ? "(상위 경로 조회 불가 — leaf만 확인됨)"
          : undefined
      }
      isSelected={isSelected}
      onSelect={() => onSelect(candidate)}
    />
  );
}
