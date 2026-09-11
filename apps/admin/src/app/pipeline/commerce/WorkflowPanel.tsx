"use client";

import { useState } from "react";
import { stepInteraction, type StepInteraction } from "./stage-focus";
import {
  BIG_STEP_ORDER,
  SUB_STEP_ICON,
  type BigStep,
  type BigStepKey,
  type BigStepStatus,
  type SubStep,
  type SubStepStatus,
  type Workflow,
  type WorkflowNavTarget,
} from "./workflow";

/**
 * UX 2.1(CEO 지시, 2026-09-11) — 화면 맨 위의 **유일한** 진행 표시.
 *
 * 예전에는 이 자리에 진행바가 셋이었다(시스템 작업 / 상품등록 / MI 내부).
 * 지금은 workflow.ts가 만든 상태 하나만 그린다 — 화면은 판정하지 않는다.
 *
 * ── UX 2.2(CEO 지시, 2026-09-11)에서 바뀐 것 ─────────────────────────────
 * 1. **끝난 단계를 눌러도 그 단계로 돌아가지 않는다.** 예전에는 ②를 누르면
 *    판단 화면으로 탭을 옮기고 스크롤했다 — 그 순간 이 줄은 진행 표시가
 *    아니라 탭 내비게이션이 되고, "지금 어느 흐름에 서 있는지"가 다시
 *    여러 개가 된다(UX 2.1이 없앤 바로 그 혼란). 끝난 단계는 결과를 펼쳐
 *    보여줄 뿐이고(상세보기), 현재 단계만 실제 작업으로 데려간다.
 * 2. **완료 / 현재 / 예정의 차이를 훨씬 크게 그린다.** 현재 단계만 진하게
 *    테두리를 두르고, 끝난 단계는 작게 눌러 두고, 아직 안 온 단계는 🔒다.
 * 3. **compact 변형.** 본문이 현재 단계의 항목을 이미 작업면으로 갖고 있는
 *    화면(CommerceWorkspace)에서는 여기서 같은 체크리스트를 반복하지 않는다 —
 *    같은 목록이 위아래에 두 번 있으면 셀러는 둘이 다른 것인 줄 알고 두 번 읽는다.
 *    수집 중 화면(page.tsx)은 본문에 그 목록이 없으므로 full 그대로 쓴다.
 */
export function WorkflowPanel({
  workflow,
  onNavigate,
  variant = "full",
  onOpenStageDetail,
}: {
  workflow: Workflow;
  /** 항목을 눌렀을 때의 이동. 수집 중에는 갈 곳이 없으므로 넘기지 않는다. */
  onNavigate?: (target: WorkflowNavTarget) => void;
  /**
   * full    — 현재 단계의 하위 항목을 여기서 목록으로 보여준다(본문에 없을 때).
   * compact — 본문이 그 목록을 갖고 있으므로 여기서는 단계와 한 줄 안내만.
   */
  variant?: "full" | "compact";
  /**
   * 끝난 단계의 [상세보기]가 화면 본문에서 열려야 하는 경우(오늘은 ② 시장 판단
   * 하나뿐 — 판단 카드는 이 좁은 줄에 들어가지 않는다). 넘기지 않으면 이
   * 컴포넌트 안에서 결과 요약만 펼친다.
   */
  onOpenStageDetail?: (key: BigStepKey) => void;
}) {
  const { steps, current, currentSubStep, completed } = workflow;
  const byKey = new Map<BigStepKey, BigStep>(steps.map((step) => [step.key, step]));
  /** 끝난 단계 중 지금 결과를 펼쳐 둔 것. 한 번에 하나만 — 여기도 흐름은 하나다. */
  const [openDetailKey, setOpenDetailKey] = useState<BigStepKey | null>(null);
  const openDetail = openDetailKey ? (byKey.get(openDetailKey) ?? null) : null;

  function handleStepClick(step: BigStep, interaction: StepInteraction) {
    if (interaction === "LOCKED") return;
    if (interaction === "ACTIVE") {
      onNavigate?.(defaultTargetOf(step));
      return;
    }
    // DETAIL_ONLY — 결과만 보여준다. 단계는 바뀌지 않는다.
    setOpenDetailKey((prev) => (prev === step.key ? null : step.key));
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      {/* ── 큰 단계 4칸 ──────────────────────────────────────────────────
          접지 않는다. 네 칸이면 한 줄에 들어가고, "지금 어디쯤인지"는
          첫 화면에서 보여야 하는 정보다. */}
      <ol className="flex flex-wrap items-center gap-y-2">
        {BIG_STEP_ORDER.map((key, index) => {
          const step = byKey.get(key);
          if (!step) return null;
          const interaction = stepInteraction(step, current.key);
          const active = interaction === "ACTIVE";
          const locked = interaction === "LOCKED";
          return (
            <li key={key} className="flex items-center">
              <button
                type="button"
                onClick={() => handleStepClick(step, interaction)}
                disabled={locked || (active && !onNavigate)}
                title={
                  locked
                    ? "앞 단계가 끝나면 열립니다"
                    : active
                      ? "지금 이 단계입니다"
                      : "끝난 단계입니다 — 결과만 확인합니다"
                }
                className={`flex items-center gap-1.5 rounded-md transition-colors ${
                  active
                    ? // 현재 단계 — 화면에서 제일 진한 칸. 끝난 단계보다 크다.
                      "border border-primary bg-primary-soft px-2.5 py-1.5 text-sm shadow-subtle"
                    : locked
                      ? "cursor-default px-2 py-1 text-xs opacity-50"
                      : "px-2 py-1 text-xs hover:bg-background"
                }`}
              >
                <BigStepIcon status={step.status} index={step.index} active={active} locked={locked} />
                <span
                  className={
                    active
                      ? "font-bold text-primary"
                      : locked
                        ? "text-text-tertiary"
                        : // 끝난 단계 — 줄을 지우지는 않되(결과가 있었다는 사실도 정보다)
                          // 무게를 확실히 낮춘다.
                          "text-text-tertiary"
                  }
                >
                  {/* ②는 이 제품의 핵심 단계다 — 나머지와 같은 무게로 두면 화면이
                      다시 "등록 도구"로 읽힌다. ⭐는 장식이 아니라 위계 표시다. */}
                  {step.key === "MARKET_JUDGING" ? "⭐ " : ""}
                  {step.label}
                </span>
                {interaction === "DETAIL_ONLY" && (
                  <span className="text-[10px] text-primary/70">{openDetailKey === key ? "접기" : "상세보기"}</span>
                )}
              </button>
              {index < BIG_STEP_ORDER.length - 1 && (
                <span className="mx-0.5 text-text-tertiary" aria-hidden>
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* ── 지금 무엇을 하고 있는지 한 줄 ─────────────────────────────────
          진행바를 훑어 해석하게 만들지 않는다. 문장은 workflow.ts가 정한다. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-primary-soft px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-primary/70">
            현재 단계: {current.index}. {current.label}
          </p>
          <p className="truncate text-sm font-medium text-primary">
            {completed ? (current.summary ?? current.headline) : current.headline}
          </p>
        </div>
        {/* 지금 갈 곳은 언제나 하나뿐이다. 돌고 있는 항목에 갈 곳이 없으면
            (배경 작업이라 볼 것이 없거나, 아직 분석이 시작되지 않았거나)
            그 단계의 기본 자리로 데려간다 — 버튼이 사라져서 "그래서 뭘 하라는
            거지"로 끝나는 순간을 만들지 않는다. */}
        {onNavigate && !completed && (
          <button
            type="button"
            onClick={() => onNavigate((currentSubStep?.target as WorkflowNavTarget) ?? defaultTargetOf(current))}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
          >
            {currentSubStep?.target ? currentSubStep.label : current.label} 확인하기 →
          </button>
        )}
      </div>

      {/* ── 하위 작업 영역 ──────────────────────────────────────────────
          현재 단계의 항목만. 전부 끝난 뒤에는 목록 대신 결과 한 줄이다.
          compact에서는 본문이 같은 목록을 작업면으로 갖고 있으므로 생략한다. */}
      {completed ? (
        <p className="mt-3 rounded-md bg-background px-3 py-2 text-xs text-text-secondary">
          ✓ {current.summary ?? "모든 단계가 끝났습니다"}
        </p>
      ) : (
        variant === "full" && (
          <ul className="mt-3 space-y-1">
            {current.subSteps.map((sub) => (
              <SubStepRow
                key={sub.key}
                sub={sub}
                highlighted={sub.key === currentSubStep?.key}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )
      )}

      {/* ── 끝난 단계의 결과 ────────────────────────────────────────────
          기본은 한 줄 요약뿐이다("② 시장 판단 ✓ 분석 완료 · 국내 비교상품
          ⚪ 검색 데이터 없음"). 비어 있던 항목이 있으면 그 사실까지 남긴다 —
          결과가 없었다는 것도 결과다. 이걸 지우면 셀러는 분석이 안 돌았다고
          생각한다. 자세한 항목별 결과는 눌렀을 때만 펼친다. */}
      {openDetail && (
        <div className="mt-3 rounded-md border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-text-primary">
              {openDetail.index}. {openDetail.label} — 결과
            </p>
            <div className="flex items-center gap-2">
              {/* 판단 카드처럼 이 줄에 들어가지 않는 결과는 본문에서 펼친다.
                  그래도 현재 단계는 바뀌지 않는다 — 보기만 하는 동작이다. */}
              {onOpenStageDetail && openDetail.key === "MARKET_JUDGING" && (
                <button
                  type="button"
                  onClick={() => onOpenStageDetail(openDetail.key)}
                  className="rounded-md border border-border px-2 py-0.5 text-[11px] text-primary hover:bg-surface"
                >
                  판단 상세보기 →
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpenDetailKey(null)}
                className="text-[11px] text-text-tertiary hover:underline"
              >
                닫기
              </button>
            </div>
          </div>
          {openDetail.summary && <p className="mt-1 text-[11px] text-text-secondary">{openDetail.summary}</p>}
          <ul className="mt-2 space-y-0.5">
            {openDetail.subSteps.map((sub) => (
              <li key={sub.key} className="flex items-start gap-1.5 text-[11px] text-text-secondary">
                <span className={`w-3 shrink-0 ${ICON_CLASS[sub.status]}`} aria-hidden>
                  {SUB_STEP_ICON[sub.status]}
                </span>
                <span>
                  {sub.label}
                  {sub.message && <span className="ml-1 text-text-tertiary">{sub.message}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FinishedStageSummary steps={steps} currentKey={current.key} />
    </section>
  );
}

/** 끝난 단계들의 한 줄 결과. 목록을 그대로 남겨두지 않기 위한 자리다. */
function FinishedStageSummary({ steps, currentKey }: { steps: BigStep[]; currentKey: BigStepKey }) {
  const finished = steps.filter((step) => step.done && step.key !== currentKey);
  if (finished.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px]">
      {finished.map((step) => (
        <li key={step.key} className="flex flex-wrap items-center gap-x-1.5 text-text-tertiary">
          <span className={step.status === "ATTENTION" ? "text-warning" : "text-success"}>
            {step.status === "ATTENTION" ? "⚠" : "✓"}
          </span>
          <span className="text-text-secondary">
            {step.index}. {step.label}
          </span>
          {step.summary && <span>— {step.summary}</span>}
          {step.subSteps
            .filter((s) => s.status === "DONE_NO_DATA" || s.status === "ATTENTION")
            .map((s) => (
              <span key={s.key} className={s.status === "ATTENTION" ? "text-warning" : undefined}>
                · {s.label} {s.message}
              </span>
            ))}
        </li>
      ))}
    </ul>
  );
}

/** 큰 단계를 눌렀을 때의 기본 이동처 — 그 단계에서 실제로 볼 것이 있는 자리. */
function defaultTargetOf(step: BigStep): WorkflowNavTarget {
  if (step.key === "MARKET_JUDGING") return "market";
  if (step.key === "COMMERCE_REGISTERING") {
    const actionable = step.subSteps.find((s) => s.target != null);
    return (actionable?.target as WorkflowNavTarget | undefined) ?? "source";
  }
  if (step.key === "REGISTRATION_PREPARING") {
    const pending = step.subSteps.find((s) => s.status === "ATTENTION" && s.target != null);
    return (pending?.target as WorkflowNavTarget | undefined) ?? "source";
  }
  return "source";
}

function SubStepRow({
  sub,
  highlighted,
  onNavigate,
}: {
  sub: SubStep;
  highlighted: boolean;
  onNavigate?: (target: WorkflowNavTarget) => void;
}) {
  const clickable = Boolean(onNavigate && sub.target);
  const body = (
    <span className="flex items-start gap-1.5 text-left">
      <span className={`w-3 shrink-0 ${ICON_CLASS[sub.status]}`} aria-hidden>
        {SUB_STEP_ICON[sub.status]}
      </span>
      <span className={highlighted ? "font-medium text-text-primary" : "text-text-secondary"}>
        {sub.label}
        {sub.message && (
          <span className={`ml-1 ${sub.status === "ATTENTION" ? "text-warning" : "text-text-tertiary"}`}>
            {sub.status === "RUNNING" ? `— ${sub.message}` : sub.message}
          </span>
        )}
      </span>
    </span>
  );

  return (
    <li
      className={`rounded-md px-2 py-1 text-xs ${
        highlighted ? "bg-background" : ""
      } ${sub.status === "UPCOMING" ? "text-text-tertiary" : ""}`}
    >
      {clickable ? (
        <button
          type="button"
          onClick={() => onNavigate?.(sub.target as WorkflowNavTarget)}
          className="w-full hover:underline"
        >
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
}

const ICON_CLASS: Record<SubStepStatus, string> = {
  DONE: "text-success",
  // 결과가 비었어도 단계는 끝났다 — 회색으로 두되 ✓를 빼앗지 않는다.
  DONE_NO_DATA: "text-text-tertiary",
  RUNNING: "animate-pulse text-primary",
  UPCOMING: "text-text-tertiary",
  ATTENTION: "text-warning",
};

function BigStepIcon({
  status,
  index,
  active,
  locked,
}: {
  status: BigStepStatus;
  index: number;
  active: boolean;
  locked: boolean;
}) {
  // 아직 오지 않은 단계는 번호가 아니라 자물쇠다 — 번호만 있으면 "눌러도
  // 되는 칸"으로 읽히고, 눌렀는데 아무 일도 없으면 고장으로 읽힌다.
  if (locked) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[9px] text-text-tertiary">
        🔒
      </span>
    );
  }
  if (status === "COMPLETED") {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success text-[9px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (status === "ATTENTION") {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-warning font-bold text-white ${
          active ? "h-6 w-6 text-[11px]" : "h-4 w-4 text-[9px]"
        }`}
      >
        !
      </span>
    );
  }
  if (status === "IN_PROGRESS" && active) {
    return (
      <span className="flex h-6 w-6 shrink-0 animate-pulse items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
        ●
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border text-[9px] font-medium text-text-tertiary">
      {index}
    </span>
  );
}
