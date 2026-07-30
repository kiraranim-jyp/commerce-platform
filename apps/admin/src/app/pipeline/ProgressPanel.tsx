"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineProgressEvent } from "./types";

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * P0-UI Epic 5(진행 단계 단순화) — packages/image/src/pipeline/progress.ts의
 * STAGE_WEIGHTS 누적 퍼센트 경계를 그대로 옮겨와 4단계로 묶는다. 실제 파이프라인
 * 세부 단계(analyze/extract/download/dedup/classify/product/model/...)를 그대로
 * 보여주는 대신 사용자가 이해할 수 있는 이름으로 요약한다 — 세부 단계는 "▼ 개발
 * 로그"를 펼치면 그대로 보인다(정보를 지운 게 아니라 기본 노출만 줄였다).
 */
const SIMPLE_STAGES = [
  { label: "상품 분석", upTo: 7 },
  { label: "이미지 다운로드", upTo: 21 },
  { label: "이미지 처리", upTo: 96 },
  { label: "마무리", upTo: 100 },
] as const;

function currentSimpleStageIndex(percent: number): number {
  const index = SIMPLE_STAGES.findIndex((s) => percent <= s.upTo);
  return index === -1 ? SIMPLE_STAGES.length - 1 : index;
}

/** 진행률 바 + 단순화된 4단계 요약. 세부 타임스탬프 로그는 기본 접혀 있다. */
export function ProgressPanel({
  current,
  log,
}: {
  current: PipelineProgressEvent | null;
  log: PipelineProgressEvent[];
}) {
  const [logExpanded, setLogExpanded] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logExpanded) logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log.length, logExpanded]);

  const percent = current?.percent ?? 0;
  const activeIndex = currentSimpleStageIndex(percent);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-xs">
        {SIMPLE_STAGES.map((stage, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "locked";
          return (
            <div key={stage.label} className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
                  state === "done"
                    ? "border-success/30 bg-success-soft text-success"
                    : state === "active"
                      ? "border-warning/30 bg-warning-soft text-warning"
                      : "border-border text-text-tertiary"
                }`}
              >
                <span aria-hidden>{state === "done" ? "✓" : state === "active" ? "●" : "○"}</span>
                {stage.label}
              </span>
              {index < SIMPLE_STAGES.length - 1 && (
                <span className="text-text-tertiary" aria-hidden>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-background">
          <div
            className="h-full rounded bg-primary transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {current && (
          <p className="mt-1 truncate text-xs text-text-secondary">
            {current.message}
            {current.fileName && current.current != null && current.total != null
              ? ` (${current.current}/${current.total})`
              : ""}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setLogExpanded((v) => !v)}
        className="text-xs font-medium text-text-secondary hover:text-text-primary"
      >
        {logExpanded ? "개발 로그 접기 ▲" : "▼ 개발 로그"}
      </button>

      {logExpanded && (
        <div className="h-48 overflow-y-auto rounded-md border border-text-primary bg-text-primary p-2 font-mono text-xs text-white/80">
          {log.length === 0 && <p className="text-white/50">로그 대기 중...</p>}
          {log.map((entry, index) => (
            <p key={index} className={entry.status === "failed" ? "text-error" : undefined}>
              <span className="text-white/40">[{formatTime(entry.timestamp)}]</span> {entry.message}
            </p>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
