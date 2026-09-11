"use client";

import { useEffect, useRef, useState } from "react";
import type { PipelineProgressEvent } from "./types";

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * UX 2.1(CEO 지시, 2026-09-11) — 여기 있던 `상품 분석 → 이미지 다운로드 →
 * 이미지 처리 → 마무리` 4칸 바를 없앤다.
 *
 * 기능을 지운 게 아니라 **자리를 옮겼다**. 그 네 칸은 이제 하나뿐인 작업
 * Flow의 ① 상품 수집 안쪽 하위 단계다(workflow.ts의 COLLECT_SUB_STEPS —
 * 구간 경계값 7/21/96/100은 그대로다). 화면 위에 4칸 바가 있고 그 아래
 * 또 다른 4단계 바가 있으면, 둘이 같은 작업인지 다른 작업인지 셀러는
 * 알 수 없다 — 그게 이번 지시가 없애려는 문제 그 자체였다.
 *
 * 이 컴포넌트에 남는 것은 두 가지뿐이다: 실제 진행률 막대와 개발 로그.
 * 둘 다 단계 판정을 하지 않는다.
 */
export function ProgressPanel({
  current,
  log,
  developerMode = false,
}: {
  current: PipelineProgressEvent | null;
  log: PipelineProgressEvent[];
  /**
   * UX 2.1 — 파이프라인이 흘려주는 원본 메시지("중복 이미지 검사 중...",
   * "대표 이미지 선정 중...")는 내부 작업 이름이다. 셀러가 읽어야 할 문장은
   * 작업 Flow가 이미 한 줄로 보여주고 있으므로, 여기서 같은 순간에 더 잘게
   * 쪼갠 두 번째 문장을 또 띄우지 않는다 — 두 문장이 다르면 셀러는 둘이
   * 다른 작업인 줄 안다. 정보를 지우는 게 아니라 개발 로그 쪽으로만 남긴다.
   */
  developerMode?: boolean;
}) {
  const [logExpanded, setLogExpanded] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logExpanded) logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log.length, logExpanded]);

  const percent = current?.percent ?? 0;

  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-background">
          <div
            className="h-full rounded bg-primary transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        {developerMode && current && (
          <p className="mt-1 truncate font-mono text-[11px] text-text-tertiary">
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
