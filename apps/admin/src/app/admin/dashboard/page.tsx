"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/app/api/admin/dashboard/route";
import { classifyFailureBucket, type ErrorCode } from "@commerce/shared";

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

  /** Sprint A-6(작업2 — 실패 원인 자동 분류) — CPO 요구사항: "무조건 등록 실패가
   * 아니라 CATEGORY/ATTRIBUTE/KC/OPTION/IMAGE/PRICE/API_ERROR/RATE_LIMIT/
   * NETWORK로 자동 분류한다." errorCodeCounts는 이미 코드별로 집계돼 있으니
   * classifyFailureBucket으로 상위 버킷별 합계만 한 번 더 낸다 — "미분류"(코드
   * 없는 레코드)는 버킷을 매길 근거가 없어 제외한다. */
  const bucketCounts = sortedCounts.reduce<Record<string, number>>((acc, [code, count]) => {
    if (code === "미분류") return acc;
    const bucket = classifyFailureBucket(code as ErrorCode);
    acc[bucket] = (acc[bucket] ?? 0) + count;
    return acc;
  }, {});
  const sortedBuckets = Object.entries(bucketCounts).sort((a, b) => b[1] - a[1]);

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
          <Link
            href="/admin/resolver-validation"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          >
            Resolver 정확도 →
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
              <>
                {/* Sprint A-6(작업2) — 원인별 다음 개선 우선순위를 바로 알 수
                    있게 상위 버킷 요약을 코드 목록보다 먼저 보여준다. */}
                {sortedBuckets.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {sortedBuckets.map(([bucket, count]) => (
                      <li
                        key={bucket}
                        className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-text-primary"
                      >
                        {bucket} {count}건
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="mt-2 space-y-1.5">
                  {sortedCounts.map(([code, count]) => (
                    <li key={code} className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-text-primary">{code}</span>
                      <span className="text-text-secondary">{count}건</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium text-text-secondary">Category Resolver KPI</p>
            {data.categoryResolverKpi.columnMissing ? (
              <p className="mt-2 text-xs text-text-tertiary">
                011 마이그레이션(category_resolver_kpi 컬럼)이 아직 실행되지 않아 집계할 수
                없습니다.
              </p>
            ) : data.categoryResolverKpi.totalWithKpi === 0 ? (
              <p className="mt-2 text-xs text-text-tertiary">
                아직 카테고리 선택 이력이 있는 등록이 없습니다.
              </p>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
                  <span>
                    최근 {data.categoryResolverKpi.totalWithKpi}건 중 Manual Override{" "}
                    <span className="font-medium text-text-primary">
                      {data.categoryResolverKpi.manualOverrideRate}%
                    </span>
                    ({data.categoryResolverKpi.manualOverrideCount}건)
                  </span>
                </div>

                {/* Sprint A-5(Category Resolver 3.0 KPI) — CPO 요구사항: "Predict
                    Accuracy / Resolver Accuracy / Manual Override / Reject
                    Rate." resolverDecision을 기록해둔 건수가 있을 때만 보여준다
                    (A-5 배포 이전 기록만 있으면 0/0이라 표시할 게 없다). */}
                {data.categoryResolverKpi.resolverV3.totalWithDecision > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-background p-2 text-center sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] text-text-tertiary">Resolver Accuracy</p>
                      <p className="text-sm font-semibold tabular-nums text-text-primary">
                        {data.categoryResolverKpi.resolverV3.resolverAccuracy}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary">Reject Rate</p>
                      <p
                        className={`text-sm font-semibold tabular-nums ${data.categoryResolverKpi.resolverV3.rejectRate > 0 ? "text-warning" : "text-text-primary"}`}
                      >
                        {data.categoryResolverKpi.resolverV3.rejectRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary">Auto Select</p>
                      <p className="text-sm font-semibold tabular-nums text-text-primary">
                        {data.categoryResolverKpi.resolverV3.autoSelectCount}건
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-text-tertiary">Reject</p>
                      <p className="text-sm font-semibold tabular-nums text-text-primary">
                        {data.categoryResolverKpi.resolverV3.rejectCount}건
                      </p>
                    </div>
                  </div>
                )}

                <ul className="mt-2 space-y-1">
                  {data.categoryResolverKpi.recent.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-xs">
                      <span className="text-text-tertiary">
                        {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                      <span className="truncate text-text-secondary">
                        Predict: {r.predictResult ?? "-"} → 최종: {r.finalRegistered ?? "-"}
                        {r.resolverDecision && ` (${r.resolverDecision}${r.similarityScore != null ? ` ${r.similarityScore}%` : ""})`}
                      </span>
                      {r.manualOverride && <span className="text-warning">수동변경</span>}
                    </li>
                  ))}
                </ul>
              </>
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
