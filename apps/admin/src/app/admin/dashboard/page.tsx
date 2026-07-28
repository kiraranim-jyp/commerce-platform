"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/app/api/admin/dashboard/route";

/** 매일 아침 훑어보는 용도 — 복잡한 통계 없이 오늘 등록 성공/실패 건수와
 * ErrorCode 집계 두 가지만 보여준다. */
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "불러오기 실패");
        return res.json() as Promise<DashboardData>;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedCounts = data ? Object.entries(data.errorCodeCounts).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="mx-auto max-w-3xl p-6 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">운영 대시보드</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/registrations"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          >
            등록 이력 →
          </Link>
          <Link
            href="/admin/inquiries"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          >
            문의 게시판 →
          </Link>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
      {!data && !error && <p className="mt-3 text-xs text-text-tertiary">불러오는 중...</p>}

      {data && (
        <>
          <section className="mt-4 grid grid-cols-3 gap-3">
            <StatCard label="오늘 등록 시도" value={data.today.total} />
            <StatCard label="성공" value={data.today.success} tone="success" />
            <StatCard label="실패" value={data.today.failed} tone="error" />
          </section>

          <section className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-secondary">오늘 발생 ErrorCode 집계</p>
            {sortedCounts.length === 0 ? (
              <p className="mt-2 text-xs text-text-tertiary">오늘 발생한 오류가 없습니다.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {sortedCounts.map(([code, count]) => (
                  <li key={code} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium text-text-primary">{code}</span>
                    <span className="text-text-secondary">{count}건</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "error";
}) {
  const valueClass = tone === "success" ? "text-success" : tone === "error" ? "text-error" : "text-text-primary";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}건</p>
    </div>
  );
}
