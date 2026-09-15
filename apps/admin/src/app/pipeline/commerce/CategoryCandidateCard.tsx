"use client";

import type { ReactNode } from "react";

/**
 * REWORK-10 C(CEO 지시, 2026-09-15) — **세 채널이 카테고리를 고르는 한 가지 모양.**
 *
 * ── 왜 뽑아냈나 ──────────────────────────────────────────────────────────
 * 카테고리 데이터는 채널마다 다르다(네이버 리프 / 쿠팡 displayCategoryCode /
 * 롯데ON scatNo + dcatLst 2중 구조).
 * 그건 어쩔 수 없다. 그런데 **고르는 동작까지** 달랐다:
 *
 *   스마트스토어·쿠팡  경로 한 줄 + ★등급 + 이유 목록 + 오른쪽 [선택] 버튼
 *   롯데ON            줄 전체가 버튼이고, 점수·이유·파생값이 그 안에 섞여 있었다
 *
 * 셀러가 세 탭을 오가며 "여기서는 줄을 누르고 저기서는 버튼을 누른다"를 다시
 * 배워야 했다. 이 컴포넌트가 그 한 벌이다 — 같은 DOM · 같은 클릭 대상이다.
 *
 * ── 판정은 하지 않는다 ───────────────────────────────────────────────────
 * 등급(★)도 이유도 호출부가 이미 계산해 둔 값을 받아 그린다. 점수 규칙은
 * 채널별 recommender(scoreCategoryCandidate 등)에 그대로 있다.
 */
export function CategoryCandidateCard({
  path,
  stars,
  reasons,
  detail,
  isSelected,
  onSelect,
}: {
  /** 최상위 → 리프. 화면에는 " > "로 이어 붙인다. */
  path: string[];
  /** ★★★★★ 같은 등급 문자열. 호출부가 자기 기준으로 만든다. */
  stars: string;
  /** 사람이 읽는 추천 이유. 없으면 그리지 않는다. */
  reasons?: string[];
  /**
   * 그 채널에서만 참인 부가 사실(롯데ON의 "전시카테고리 3개 · 고시 품목 23").
   * 🔴 여기에 입력칸을 넣지 않는다 — 이 카드가 받는 동작은 [선택] 하나뿐이다.
   */
  detail?: ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      data-category-candidate
      className={`rounded-md border p-3 ${isSelected ? "border-selected-border bg-selected-soft" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{path.join(" > ")}</p>
          <p className="mt-0.5 text-xs tracking-wide text-warning" aria-label={`신뢰도 등급 ${stars}`}>
            {stars}
          </p>
          {reasons && reasons.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs text-text-secondary">
              {reasons.map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          )}
          {detail && <div className="mt-1 text-xs text-text-tertiary">{detail}</div>}
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={isSelected}
          className="shrink-0 rounded border border-border px-3 py-1 text-xs font-medium hover:bg-background disabled:opacity-50"
        >
          {isSelected ? "선택됨" : "선택"}
        </button>
      </div>
    </li>
  );
}

/**
 * 등급 규칙 한 곳. 플랫폼 API가 실제로 검증해 준 코드는 신뢰도 숫자와 무관하게
 * 최고 등급이다(그 코드는 추정이 아니라 사실이다).
 */
export function candidateStars(confidence: number, verified: boolean): string {
  if (verified) return "★★★★★";
  if (confidence >= 0.6) return "★★★★";
  return "★★";
}
