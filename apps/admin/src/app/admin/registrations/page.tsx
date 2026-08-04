"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import type { ComplianceReport } from "@commerce/listing";
import type { RegistrationAttemptRecord } from "@/app/api/admin/registrations/route";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

/** register/route.ts의 brandResolutionMeta와 같은 모양 — DB에는 jsonb로 통째로
 * 저장되므로(brand_resolution 컬럼) 여기서만 타입을 붙인다. */
interface BrandResolutionRecord {
  raw: string;
  cleaned: string;
  ruleApplied: string[];
  confidence: "HIGH" | "LOW";
  brandId: string | null;
  brandNameKr: string | null;
}

function complianceScoreClass(score: number | null): string {
  if (score == null) return "text-text-tertiary";
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-error";
}

const STATUS_LABEL: Record<RegistrationAttemptRecord["status"], string> = {
  SUBMITTED: "성공",
  FAILED: "실패",
};

const STATUS_CLASS: Record<RegistrationAttemptRecord["status"], string> = {
  SUBMITTED: "text-success",
  FAILED: "text-error",
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** payload/response는 base64 이미지처럼 큰 데이터가 없다(vendorPath는 URL 문자열)
 * — 그래도 화면이 너무 길어지지 않게 pretty-print만 하고 별도 축약은 안 한다. */
function formatJson(value: unknown): string {
  if (value == null) return "—";
  return JSON.stringify(value, null, 2);
}

/**
 * 등록 이력 — "같은 URL 3회 연속 성공" 같은 회귀 확인, 실패 원인 추적(Payload/
 * Response/ErrorCode/TraceId) 둘 다 이 화면 하나로 한다.
 */
export default function AdminRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationAttemptRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/registrations")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "불러오기 실패");
        return res.json() as Promise<{ registrations: RegistrationAttemptRecord[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setRegistrations(data.registrations);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="등록 이력"
        subtitle="모든 LIVE 등록 시도(성공/실패)를 시간 역순으로 보여줍니다. 행을 클릭하면 Payload/Response 상세를 볼 수 있습니다."
        actions={
          <Link
            href="/admin/dashboard"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          >
            ← 대시보드
          </Link>
        }
      />
      <PageContainer size="xl" className="text-sm">
      {error && <p className="mt-3 text-xs text-error">{error}</p>}
      {loading && <p className="mt-3 text-xs text-text-tertiary">불러오는 중...</p>}

      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-background text-text-secondary">
            <tr>
              <th className="px-3 py-2">시간</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">상품명</th>
              <th className="px-3 py-2">등록번호</th>
              <th className="px-3 py-2">Compliance</th>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">ErrorCode</th>
              <th className="px-3 py-2">소요시간</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => {
              const compliance = r.compliance_report as ComplianceReport | null;
              const brandResolution = r.brand_resolution as BrandResolutionRecord | null;
              return (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-background"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <td className="px-3 py-2 text-text-secondary">{formatDateTime(r.created_at)}</td>
                  <td className={`px-3 py-2 font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-text-primary">{r.product_name ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.external_product_id ?? "—"}</td>
                  <td className={`px-3 py-2 font-medium ${complianceScoreClass(r.compliance_score)}`}>
                    {r.compliance_score != null ? `${r.compliance_score}점` : "—"}
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2 text-text-secondary">
                    {brandResolution?.cleaned ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono font-medium text-error">{r.error_code ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}초` : "—"}
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="border-t border-border bg-background">
                    <td colSpan={8} className="px-3 py-3">
                      <p className="text-xs text-text-secondary">TraceId: {r.trace_id ?? "—"}</p>
                      {compliance && (
                        <div className="mt-2 rounded border border-border bg-surface p-2">
                          <p className="text-xs font-medium text-text-secondary">
                            Compliance {compliance.score}점 — 필수옵션 {compliance.requiredAttributeRate}% · 고시정보{" "}
                            {compliance.requiredNoticeRate}% · 자동입력 {compliance.autoResolvedCount}/
                            {compliance.autoResolvedCount + compliance.userRequiredCount} · 평균신뢰도{" "}
                            {Math.round(compliance.confidenceAvg * 100)}% ·{" "}
                            <span
                              className={
                                compliance.verdict === "PASS"
                                  ? "text-success"
                                  : compliance.verdict === "WARNING"
                                    ? "text-warning"
                                    : "text-error"
                              }
                            >
                              {compliance.verdict}
                            </span>{" "}
                            · 승인가능성{" "}
                            <span
                              className={
                                compliance.approvalReadiness === "High"
                                  ? "text-success"
                                  : compliance.approvalReadiness === "Medium"
                                    ? "text-warning"
                                    : "text-error"
                              }
                            >
                              {compliance.approvalReadiness}
                            </span>
                          </p>
                          {compliance.scoreBreakdown.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-text-secondary">
                              {compliance.scoreBreakdown.map((b) => (
                                <li key={b.fieldName}>
                                  -{b.deduction}점 {b.fieldName} — {b.reason}
                                </li>
                              ))}
                            </ul>
                          )}
                          {compliance.userInputNeeded.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-text-secondary">
                              {compliance.userInputNeeded.map((f) => (
                                <li key={f.fieldName}>
                                  ☐ {f.fieldName} — {f.reason}(신뢰도 {Math.round(f.confidence * 100)}%)
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {brandResolution && (
                        <div className="mt-2 rounded border border-border bg-surface p-2">
                          <p className="text-xs font-medium text-text-secondary">Brand Resolver</p>
                          <p className="mt-1 text-[11px] text-text-secondary">
                            Raw <span className="font-mono text-text-primary">{brandResolution.raw || "—"}</span>
                            {" → "}
                            Cleaned{" "}
                            <span className="font-mono text-text-primary">{brandResolution.cleaned || "—"}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-text-secondary">
                            Rule Applied{" "}
                            <span className="font-mono">
                              {brandResolution.ruleApplied.length > 0
                                ? brandResolution.ruleApplied.join(", ")
                                : "(정제 없음)"}
                            </span>
                            {" · "}
                            신뢰도{" "}
                            <span
                              className={
                                brandResolution.confidence === "HIGH" ? "text-success" : "text-warning"
                              }
                            >
                              {brandResolution.confidence}
                            </span>
                          </p>
                          <p className="mt-1 text-[11px] text-text-secondary">
                            Brand API 매칭{" "}
                            {brandResolution.brandId ? (
                              <span className="text-success">
                                {brandResolution.brandNameKr ?? brandResolution.cleaned} ({brandResolution.brandId})
                              </span>
                            ) : (
                              <span className="text-warning">미매칭 — brandId 없이 등록</span>
                            )}
                          </p>
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-text-secondary">Payload</p>
                          <pre className="mt-1 max-h-64 overflow-auto rounded bg-surface p-2 text-[11px] text-text-secondary">
                            {formatJson(r.payload)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-text-secondary">Response</p>
                          <pre className="mt-1 max-h-64 overflow-auto rounded bg-surface p-2 text-[11px] text-text-secondary">
                            {formatJson(r.response)}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
              );
            })}
          </tbody>
        </table>
        {!loading && registrations.length === 0 && (
          <p className="p-4 text-center text-xs text-text-tertiary">등록 이력이 없습니다.</p>
        )}
      </div>
      </PageContainer>
    </>
  );
}
