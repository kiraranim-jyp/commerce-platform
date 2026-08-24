"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

type DetailContentItem = { kind: "text"; text: string } | { kind: "image"; url: string };

/**
 * B-3(CPO 지시: "이미 등록된 상품을 다시 보기 → 현재 설정과 실제 등록 이력을
 * 구분해서 표시") — registration_attempts.payload는 등록 시점에 이미 완전히
 * resolve된 상세페이지 내용을 담고 있다(공통이미지 URL 포함, DB 마이그레이션
 * 불필요 — B-3 조사에서 확인). 여기서는 그걸 사람이 읽을 수 있게만 풀어준다.
 * Coupang(items[0].contents 배열)과 SmartStore(originProduct.detailContent
 * HTML 문자열)는 저장 형태가 달라 플랫폼별로 파싱한다.
 */
function extractDetailContent(platform: string, payload: unknown): DetailContentItem[] {
  if (!payload || typeof payload !== "object") return [];

  if (platform === "coupang") {
    const items = (payload as { items?: unknown }).items;
    if (!Array.isArray(items) || !items[0]) return [];
    const contents = (items[0] as { contents?: unknown }).contents;
    if (!Array.isArray(contents)) return [];
    const result: DetailContentItem[] = [];
    for (const block of contents) {
      const details = (block as { contentDetails?: unknown }).contentDetails;
      if (!Array.isArray(details)) continue;
      for (const detail of details) {
        const d = detail as { detailType?: string; content?: string };
        if (!d.content) continue;
        result.push(d.detailType === "IMAGE" ? { kind: "image", url: d.content } : { kind: "text", text: d.content });
      }
    }
    return result;
  }

  if (platform === "smartstore") {
    const originProduct = (payload as { originProduct?: unknown }).originProduct;
    const html = originProduct && typeof originProduct === "object" ? (originProduct as { detailContent?: unknown }).detailContent : undefined;
    if (typeof html !== "string" || !html) return [];
    const result: DetailContentItem[] = [];
    const tagPattern = /<p>([\s\S]*?)<\/p>|<img src="([^"]*)"/g;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(html)) !== null) {
      if (match[1] !== undefined) {
        const text = match[1].replace(/<br\s*\/?>/g, "\n").trim();
        if (text) result.push({ kind: "text", text });
      } else if (match[2]) {
        result.push({ kind: "image", url: match[2] });
      }
    }
    return result;
  }

  return [];
}

/**
 * 등록 이력 — "같은 URL 3회 연속 성공" 같은 회귀 확인, 실패 원인 추적(Payload/
 * Response/ErrorCode/TraceId) 둘 다 이 화면 하나로 한다.
 * B-3(CPO 지시) — ?snapshotId= 가 있으면 그 상품의 이력만 보여준다(상품 등록
 * 화면에서 "실제 등록 이력 보기" 링크로 들어올 때 쓴다).
 */
function AdminRegistrationsPageInner() {
  const searchParams = useSearchParams();
  const snapshotId = searchParams.get("snapshotId");
  const [registrations, setRegistrations] = useState<RegistrationAttemptRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = snapshotId ? `/api/admin/registrations?snapshotId=${encodeURIComponent(snapshotId)}` : "/api/admin/registrations";
    fetch(url)
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
  }, [snapshotId]);

  return (
    <>
      <PageHeader
        title={snapshotId ? "등록 이력 (이 상품만)" : "등록 이력"}
        subtitle={
          snapshotId
            ? "이 상품의 등록 시도만 보여줍니다. 아래 Payload는 그 시도 당시 실제로 제출된 값입니다 — 지금 설정과 다를 수 있습니다."
            : "모든 LIVE 등록 시도(성공/실패)를 시간 역순으로 보여줍니다. 행을 클릭하면 Payload/Response 상세를 볼 수 있습니다."
        }
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
              const detailContent = expandedId === r.id ? extractDetailContent(r.platform, r.payload) : [];
              return (
              <Fragment key={r.id}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-background"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <td className="px-3 py-2 text-text-secondary">{formatDateTime(r.created_at)}</td>
                  <td className={`px-3 py-2 font-medium ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-text-primary">{r.product_name ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {r.external_product_id ?? (
                      /* N-4.12 STEP10 — SUBMITTED인데 상품 ID가 없는 애매한 상태를
                       * "—"로 조용히 숨기지 않는다(RegistrationHistoryPanel.tsx와
                       * 같은 이유). */
                      <span className={r.status === "SUBMITTED" ? "text-warning" : undefined}>
                        {r.status === "SUBMITTED" ? "⚠️ 확인 필요" : "—"}
                      </span>
                    )}
                  </td>
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
                      <p className="text-xs text-text-secondary">Job Key: {r.job_key ?? "—"}</p>
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
                      {detailContent.length > 0 && (
                        <div className="mt-2 rounded border border-border bg-surface p-2">
                          <p className="text-xs font-medium text-text-secondary">
                            이 등록 시도에 실제 제출된 상세페이지 내용
                          </p>
                          <p className="mt-0.5 text-[10px] text-text-tertiary">
                            현재 설정(공통 이미지/템플릿)이 바뀌었더라도 아래 내용은 이 등록 시도 당시 실제로
                            제출된 값 그대로입니다. 상단/하단 공통 이미지가 켜져 있었다면 각각 맨 앞/맨 뒤
                            항목으로 이 목록에 포함됩니다(블록 순서를 직접 바꾼 경우는 다를 수 있습니다 — 항목별로
                            "이게 공통 이미지다"라고 단정하지 않고, 실제 제출 순서 그대로만 보여드립니다).
                          </p>
                          <div className="mt-2 space-y-2">
                            {detailContent.map((item, i) =>
                              item.kind === "image" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={i}
                                  src={item.url}
                                  alt="등록 시 제출된 상세페이지 이미지"
                                  className="max-h-40 rounded border border-border"
                                />
                              ) : (
                                <p key={i} className="whitespace-pre-wrap text-[11px] text-text-secondary">
                                  {item.text}
                                </p>
                              ),
                            )}
                          </div>
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

/** useSearchParams는 Suspense 경계 안에서만 쓸 수 있다(Next.js App Router 요구사항). */
export default function AdminRegistrationsPage() {
  return (
    <Suspense fallback={<PageContainer size="xl" className="text-sm" />}>
      <AdminRegistrationsPageInner />
    </Suspense>
  );
}
