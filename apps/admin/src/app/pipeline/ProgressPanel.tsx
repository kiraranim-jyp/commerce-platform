"use client";

import { useEffect, useRef } from "react";
import type { PipelineProgressEvent } from "./types";

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 진행률 바 + 현재 단계 표시 + 타임스탬프 로그 콘솔. 운영툴이라 "지금 멈춘 건지
 * 진행 중인지" 헷갈리지 않도록 실시간으로 갱신되는 걸 보여주는 게 핵심이다. */
export function ProgressPanel({
  current,
  log,
}: {
  current: PipelineProgressEvent | null;
  log: PipelineProgressEvent[];
}) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log.length]);

  return (
    <div className="mt-4 space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-800">{current?.step ?? "대기 중"}</span>
          <span className="text-zinc-500">{current?.percent ?? 0}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded bg-zinc-100">
          <div
            className="h-full rounded bg-black transition-all duration-300 ease-out"
            style={{ width: `${current?.percent ?? 0}%` }}
          />
        </div>
        {current && (
          <p className="mt-1 truncate text-xs text-zinc-500">
            {current.message}
            {current.fileName && current.current != null && current.total != null
              ? ` (${current.current}/${current.total})`
              : ""}
          </p>
        )}
      </div>

      <div className="h-48 overflow-y-auto rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-xs text-zinc-200">
        {log.length === 0 && <p className="text-zinc-500">로그 대기 중...</p>}
        {log.map((entry, index) => (
          <p key={index} className={entry.status === "failed" ? "text-red-400" : undefined}>
            <span className="text-zinc-500">[{formatTime(entry.timestamp)}]</span> {entry.message}
          </p>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
