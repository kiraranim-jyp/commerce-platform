"use client";

import type { RegistrationHistoryEntry } from "@commerce/listing";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";

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

export function RegistrationHistoryPanel({ history }: { history: RegistrationHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
      <h3 className="text-base font-semibold tracking-tight text-text-primary">등록 이력</h3>
      <p className="mt-1 text-xs text-text-secondary">
        이 세션에서 시도한 등록 기록입니다 — 새로고침하면 초기화됩니다.
      </p>

      <ul className="mt-3 divide-y divide-border">
        {history.map((entry, index) => (
          <li key={index} className="flex items-center justify-between gap-2 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-text-primary">{entry.productName}</p>
              <p className="text-text-secondary">
                {PLATFORM_ADAPTERS[entry.platform].label} · {entry.mode} · {formatTime(entry.executedAt)}
              </p>
              {entry.result.status === "FAILED" && entry.result.error && (
                <p className="mt-0.5 text-error">{entry.result.error.message}</p>
              )}
              {entry.result.externalUrl && (
                <p className="mt-0.5 text-text-secondary">{entry.result.externalUrl}</p>
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
