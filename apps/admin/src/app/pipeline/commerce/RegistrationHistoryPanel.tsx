"use client";

import { useState } from "react";
import type { RegistrationHistoryEntry } from "@commerce/listing";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";

const COLLAPSED_LIMIT = 5;

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "성공",
  FAILED: "실패",
};

const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "text-success",
  FAILED: "text-error",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Sprint A-6(작업4 — 등록 소요시간 측정) — CPO 예시 형식("2분 31초") 그대로. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

export function RegistrationHistoryPanel({ history }: { history: RegistrationHistoryEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  if (history.length === 0) return null;

  // P1-UI Epic 8 — 이력이 쌓일수록 화면을 길게 늘어뜨리지 않는다. 최근 5건만
  // 기본으로 보여주고, 전체를 봐야 할 때만(재고/오류 추적 등) 펼친다.
  const visible = showAll ? history : history.slice(0, COLLAPSED_LIMIT);

  return (
    <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-text-primary">등록 이력</h3>
        {history.length > COLLAPSED_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            {showAll ? "최근 5건만 보기" : `전체보기 (${history.length}건)`}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        이 세션에서 시도한 등록 기록입니다 — 새로고침하면 초기화됩니다.
      </p>

      <ul className="mt-3 divide-y divide-border">
        {visible.map((entry, index) => (
          <li key={index} className="flex items-center justify-between gap-2 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-text-primary">{entry.productName}</p>
              <p className="text-text-secondary">
                {PLATFORM_ADAPTERS[entry.platform].label} ·{" "}
                <span className={entry.mode === "LIVE" ? "font-semibold text-error" : undefined}>
                  {entry.mode}
                </span>{" "}
                · {formatTime(entry.executedAt)}
              </p>
              {entry.result.status === "FAILED" && entry.result.error && (
                <p className="mt-0.5 text-error">{entry.result.error.message}</p>
              )}
              {/* N-3.70 STEP7 — 위 ListingSection.tsx와 같은 이유로 플랫폼별
               * 라벨을 분기한다(등록 이력에서도 SmartStore 건에 "쿠팡 상품
               * ID"가 뜨던 버그). */}
              {entry.result.externalProductId && (
                <p className="mt-0.5 text-text-secondary">
                  {entry.platform === "coupang" ? "쿠팡 상품 ID" : "네이버 상품번호"}: {entry.result.externalProductId}
                </p>
              )}
              {entry.result.externalUrl && (
                <p className="mt-0.5 text-text-secondary">{entry.result.externalUrl}</p>
              )}
              {entry.timing && (entry.timing.totalElapsedMs != null || entry.timing.editorElapsedMs != null) && (
                <p className="mt-0.5 text-text-tertiary">
                  {entry.timing.totalElapsedMs != null && `전체 ${formatDuration(entry.timing.totalElapsedMs)}`}
                  {entry.timing.totalElapsedMs != null && entry.timing.editorElapsedMs != null && " · "}
                  {entry.timing.editorElapsedMs != null && `입력 ${formatDuration(entry.timing.editorElapsedMs)}`}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 font-medium ${STATUS_CLASS[entry.result.status] ?? "text-text-secondary"}`}
            >
              {STATUS_LABEL[entry.result.status] ?? entry.result.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
