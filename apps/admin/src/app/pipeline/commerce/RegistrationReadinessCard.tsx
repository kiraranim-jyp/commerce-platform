"use client";

import type { ListingStatus } from "@commerce/listing";
import type { ReadinessItem } from "./readiness";

const BUTTON_LABEL: Record<ListingStatus, string> = {
  DRAFT: "필수 항목을 채워주세요",
  READY: "등록하기",
  USER_CONFIRMED: "등록 대기 중...",
  SUBMITTING: "등록 중...",
  SUBMITTED: "등록 완료 ✓",
  FAILED: "등록 실패 — 아래에서 다시 시도",
};

/**
 * P0-UI Epic 2(등록 준비 카드) — 우측에 고정(sticky)돼서 스크롤해도 항상 보이는
 * 단일 등록 진입점. 예전에는 체크리스트(PreflightChecklist)와 등록 버튼이
 * ListingSection 안에 같이 있어서 화면 아무 데나 있었다 — 이제 버튼은 여기 하나뿐이고,
 * PreflightChecklist는 상세 확인용으로 본문에 남지만 버튼은 갖지 않는다.
 *
 * percent/items 계산은 여기서 하지 않는다 — computeChecklistReadiness /
 * computeReadinessScoreSummary(readiness.ts) 결과를 그대로 받아 표시만 한다. 판정
 * 로직이 여러 곳에 있으면 CP001 버그(카드는 100%인데 실제 등록은 실패)가 재발한다.
 */
export function RegistrationReadinessCard({
  percent,
  items,
  allRequiredPassed,
  platformLabel,
  status,
  onRegister,
  settingsMissing,
}: {
  percent: number;
  items: ReadinessItem[];
  allRequiredPassed: boolean;
  platformLabel: string;
  status: ListingStatus;
  onRegister: () => void;
  settingsMissing?: string[];
}) {
  const scoreClassName = percent >= 90 ? "text-success" : percent >= 60 ? "text-warning" : "text-error";
  const barClassName = percent >= 90 ? "bg-success" : percent >= 60 ? "bg-warning" : "bg-error";
  const canRegister = allRequiredPassed && status === "READY";
  const isTerminal = status === "SUBMITTED" || status === "FAILED";

  return (
    <aside className="space-y-4 rounded-lg border border-border bg-surface p-4 text-sm shadow-elevated lg:sticky lg:top-4 lg:self-start">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 준비</p>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${scoreClassName}`}>{percent}%</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-background">
          <div
            className={`h-full rounded transition-all duration-300 ${barClassName}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2 text-xs">
            <span
              className={item.passed ? "text-success" : item.required ? "text-error" : "text-warning"}
            >
              {item.passed ? "✓" : item.required ? "✗" : "△"}
            </span>
            <span className={item.passed ? "text-text-primary" : "font-medium text-text-primary"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      {settingsMissing && settingsMissing.length > 0 && !isTerminal && (
        <a
          href="/settings"
          className="block rounded-md border border-border px-3 py-1.5 text-center text-xs font-medium text-text-secondary transition-colors hover:bg-background"
        >
          설정하러 가기
        </a>
      )}

      <button
        type="button"
        onClick={onRegister}
        disabled={!canRegister}
        className={`w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
          status === "SUBMITTED"
            ? "bg-success-soft text-success"
            : status === "FAILED"
              ? "bg-error-soft text-error"
              : "bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
        }`}
      >
        {status === "READY" ? `${platformLabel}에 등록` : BUTTON_LABEL[status]}
      </button>
    </aside>
  );
}
