"use client";

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
 * ── 이 컴포넌트의 규칙 ───────────────────────────────────────────────────
 * 1. 큰 단계는 넷뿐이고, 그중 정확히 하나만 활성이다(workflow.current).
 * 2. 하위 항목은 **현재 단계의 것만** 보여준다. 끝난 단계의 체크리스트는
 *    지우고 한 줄 결과로 바꾼다 — 끝난 목록이 계속 앉아 있으면 셀러는
 *    "아직 뭔가 돌고 있나"로 읽는다.
 * 3. 동시에 여러 항목을 "진행 중"으로 그리지 않는다. ● 는 항상 하나다.
 * 4. 내부 작업명을 쓰지 않는다. 문장은 전부 workflow.ts가 만들어 내려준다.
 * 5. 빨간 실패 표시가 없다 — 만들 수 있는 값 자체가 타입에 없다.
 *
 * ── 왜 두 곳에서 렌더되는가 ──────────────────────────────────────────────
 * 수집 중에는 page.tsx가(아직 CommerceWorkspace가 마운트되기 전이다),
 * 수집이 끝난 뒤에는 CommerceWorkspace가 이 컴포넌트를 그린다. 둘은 같은
 * 순간에 함께 존재하지 않고(page.tsx는 result가 오면 넘겨준다) 같은
 * resolveWorkflow()를 쓰므로, 화면에 보이는 Flow는 언제나 하나다.
 */
export function WorkflowPanel({
  workflow,
  onNavigate,
}: {
  workflow: Workflow;
  /** 항목을 눌렀을 때의 이동. 수집 중에는 갈 곳이 없으므로 넘기지 않는다. */
  onNavigate?: (target: WorkflowNavTarget) => void;
}) {
  const { steps, current, currentSubStep, completed } = workflow;
  const byKey = new Map<BigStepKey, BigStep>(steps.map((step) => [step.key, step]));
  const finished = steps.filter((step) => step.done && step.key !== current.key);

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      {/* ── 큰 단계 4칸 ──────────────────────────────────────────────────
          접지 않는다. 네 칸이면 한 줄에 들어가고, "지금 어디쯤인지"는
          첫 화면에서 보여야 하는 정보다. */}
      <ol className="flex flex-wrap items-center gap-y-2">
        {BIG_STEP_ORDER.map((key, index) => {
          const step = byKey.get(key);
          if (!step) return null;
          const active = step.key === current.key;
          return (
            <li key={key} className="flex items-center">
              <button
                type="button"
                onClick={onNavigate ? () => onNavigate(defaultTargetOf(step)) : undefined}
                disabled={!onNavigate}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                  onNavigate ? "hover:bg-background" : "cursor-default"
                } ${active ? "bg-primary-soft" : ""}`}
              >
                <BigStepIcon status={step.status} index={step.index} active={active} />
                <span
                  className={
                    active
                      ? "font-semibold text-primary"
                      : step.status === "COMPLETED"
                        ? "text-text-secondary"
                        : step.status === "LOCKED"
                          ? "text-text-tertiary"
                          : "font-medium text-text-primary"
                  }
                >
                  {/* ②는 이 제품의 핵심 단계다 — 나머지와 같은 무게로 두면 화면이
                      다시 "등록 도구"로 읽힌다. ⭐는 장식이 아니라 위계 표시다. */}
                  {step.key === "MARKET_JUDGING" ? "⭐ " : ""}
                  {step.label}
                </span>
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
          현재 단계의 항목만. 전부 끝난 뒤에는 목록 대신 결과 한 줄이다. */}
      {completed ? (
        <p className="mt-3 rounded-md bg-background px-3 py-2 text-xs text-text-secondary">
          ✓ {current.summary ?? "모든 단계가 끝났습니다"}
        </p>
      ) : (
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
      )}

      {/* ── 끝난 단계의 결과 요약 ────────────────────────────────────────
          "② 시장 판단 ✓ 분석 완료 · 국내 비교상품 ⚪ 검색 데이터 없음"처럼,
          비어 있던 항목이 있으면 그 사실까지 한 줄에 남긴다 — 결과가 없었다는
          것도 결과다. 이걸 지우면 셀러는 분석이 안 돌았다고 생각한다. */}
      {finished.length > 0 && (
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
      )}
    </section>
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

function BigStepIcon({ status, index, active }: { status: BigStepStatus; index: number; active: boolean }) {
  if (status === "COMPLETED") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (status === "ATTENTION") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
        !
      </span>
    );
  }
  if (status === "IN_PROGRESS" && active) {
    return (
      <span className="flex h-5 w-5 shrink-0 animate-pulse items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
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
