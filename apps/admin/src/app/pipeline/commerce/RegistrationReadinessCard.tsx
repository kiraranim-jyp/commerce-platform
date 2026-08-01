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
 * P0-UI Epic 2(등록 준비 카드) → Sprint A-3(Registration Editor) — 우측에
 * 고정(sticky)돼서 스크롤해도 항상 보이는 단일 등록 진입점.
 *
 * Sprint A-3 CPO 요구사항: "가능/불가능이 아니라 95%처럼, 그리고 왜 95%인지 —
 * 무엇이 부족한지 — 어떻게 채워지는지까지 보여야 한다." 필수/선택을 분리하고,
 * 통과 못 한 항목엔 hint(readiness.ts가 채워준 이유/CTA 문구)를 보여주고, 항목을
 * 클릭하면 해당 accordion 섹션으로 스크롤+펼침(onItemClick)한다.
 *
 * percent/items 계산은 여기서 하지 않는다 — computeChecklistReadiness /
 * computeReadinessScoreSummary(readiness.ts) 결과를 그대로 받아 표시만 한다. 판정
 * 로직이 여러 곳에 있으면 CP001 버그(카드는 100%인데 실제 등록은 실패)가 재발한다.
 */
export function RegistrationReadinessCard({
  percent,
  required,
  recommended,
  allRequiredPassed,
  platformLabel,
  status,
  onRegister,
  onItemClick,
  settingsMissing,
  autoFillStats,
}: {
  percent: number;
  required: ReadinessItem[];
  recommended: ReadinessItem[];
  allRequiredPassed: boolean;
  platformLabel: string;
  status: ListingStatus;
  onRegister: () => void;
  /** Sprint A-3(Auto Scroll) — 항목에 sectionId가 있을 때만 클릭 가능하게 렌더한다. */
  onItemClick?: (sectionId: string) => void;
  settingsMissing?: string[];
  /** Sprint A-6(작업3 — Auto Fill KPI) — CPO 요구사항: "대표님이 가장 궁금한
   * 숫자." "필수항목 총 18개, 자동입력 15, 사용자입력 3" 그대로. Compliance
   * Report의 autoResolvedCount/userRequiredCount를 그대로 옮겨온 값이라 이
   * 카드가 다시 계산하지 않는다(판정 로직 중복 방지 원칙). */
  autoFillStats?: { total: number; autoFilled: number; userInput: number };
}) {
  const scoreClassName = percent >= 90 ? "text-success" : percent >= 60 ? "text-warning" : "text-error";
  const barClassName = percent >= 90 ? "bg-success" : percent >= 60 ? "bg-warning" : "bg-error";
  const canRegister = allRequiredPassed && status === "READY";
  const isTerminal = status === "SUBMITTED" || status === "FAILED";
  const remaining = [...required, ...recommended].filter((i) => !i.passed).length;

  return (
    <aside className="space-y-4 rounded-lg border border-border bg-surface p-4 text-sm shadow-elevated lg:sticky lg:top-4 lg:self-start">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">등록 가능성</p>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${scoreClassName}`}>{percent}%</p>
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-background">
          <div
            className={`h-full rounded transition-all duration-300 ${barClassName}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {/* Sprint A-6(작업3 — Auto Fill KPI) — "대표님이 가장 궁금한 숫자"를
            CPO 예시 형식 그대로("필수항목 총 18개, 자동입력 15, 사용자입력
            3") 등록 가능성 % 바로 아래, 항상 보이는 위치에 둔다. */}
        {autoFillStats && (
          <p className="mt-2 text-xs text-text-secondary">
            필수항목 총 <span className="font-medium text-text-primary">{autoFillStats.total}개</span> 중 자동입력{" "}
            <span className="font-medium text-success">{autoFillStats.autoFilled}</span> · 사용자입력{" "}
            <span className="font-medium text-warning">{autoFillStats.userInput}</span>
          </p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-text-tertiary">필수</p>
        <ItemList items={required} onItemClick={onItemClick} />
      </div>

      {recommended.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-tertiary">선택</p>
          <ItemList items={recommended} onItemClick={onItemClick} />
        </div>
      )}

      <p className="border-t border-border pt-2 text-xs text-text-secondary">
        남은 작업 <span className="font-medium text-text-primary">{remaining}개</span>
      </p>

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

function ItemList({
  items,
  onItemClick,
}: {
  items: ReadinessItem[];
  onItemClick?: (sectionId: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => {
        const clickable = !item.passed && item.sectionId && onItemClick;
        const content = (
          <>
            <span
              className={`shrink-0 ${item.passed ? "text-success" : item.required ? "text-error" : "text-warning"}`}
            >
              {item.passed ? "✓" : item.required ? "✗" : "△"}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className={item.passed ? "text-text-primary" : "font-medium text-text-primary"}>
                {item.label}
              </span>
              {!item.passed && item.hint && (
                <span className="block text-[11px] text-text-tertiary">{item.hint}</span>
              )}
            </span>
          </>
        );
        return (
          <li key={`${item.label}-${index}`} className="text-xs">
            {clickable ? (
              <button
                type="button"
                onClick={() => onItemClick!(item.sectionId!)}
                className="flex w-full items-start gap-2 rounded px-1 py-0.5 text-left hover:bg-background"
              >
                {content}
              </button>
            ) : (
              <div className="flex items-start gap-2 px-1 py-0.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
