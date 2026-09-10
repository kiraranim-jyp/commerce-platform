"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

/**
 * CS-OBSERVABILITY-1(CPO 지시, 2026-09-10) — CS가 문제를 직접 찾아내는 화면.
 *
 * 목표는 기능 나열이 아니라 하나의 흐름이다:
 *   사용자 → 최근 분석 → **원본 URL** → 당시 추출 결과
 * 이 흐름이 되면 "아까 그 상품 가격이 이상했다"는 문의에 URL을 되묻지 않는다.
 *
 * 새 저장 구조를 만들지 않았다 — audit_log와 product_snapshots를 이어 붙였을 뿐이다.
 */
interface ActivityEvent {
  id: string;
  event_type: string;
  actor: string | null;
  field: string | null;
  after_value: string | null;
  reason: string | null;
  snapshot_id: string | null;
  created_at: string;
}
interface AnalysisRow {
  id: string;
  job_key: string | null;
  source_url: string | null;
  title: string | null;
  status: string | null;
  created_at: string;
}
interface AnalysisDetail {
  analysisId: string;
  jobKey: string | null;
  sourceUrl: string | null;
  title: string | null;
  brand: string | null;
  sku: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  optionGroups: { name: string | null; values: string[] }[];
  status: string | null;
  workspaceId: string | null;
  createdAt: string | null;
  productDataAvailable: boolean;
}

const time = (v: string | null) => (v ? new Date(v).toLocaleString("ko-KR") : "—");

/** 인증 이벤트는 CS에서 가장 먼저 보는 것이라 눈에 띄게 둔다. */
const EVENT_LABEL: Record<string, string> = {
  AUTH_GOOGLE_START: "Google 로그인 시작",
  AUTH_GOOGLE_CALLBACK: "Google 콜백 수신",
  AUTH_LOGIN_SUCCESS: "로그인 성공",
  AUTH_LOGIN_FAILURE: "로그인 실패",
  AUTH_LOGOUT: "로그아웃",
  IMPERSONATION_STARTED: "관리자 계정 전환 시작",
  IMPERSONATION_ENDED: "관리자 계정 전환 종료",
  USER_STATUS_CHANGED: "계정 상태 변경",
  USER_PASSWORD_RESET: "비밀번호 재설정",
};

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id ?? "";
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/admin/users/${userId}/activity`).then((r) => r.json()),
        fetch(`/api/admin/users/${userId}/analyses`).then((r) => r.json()),
      ]);
      if (!a.ok || !b.ok) {
        setError("조회에 실패했습니다.");
        return;
      }
      setEvents(a.events ?? []);
      setAnalyses(b.analyses ?? []);
    } catch {
      setError("조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  async function openAnalysis(id: string) {
    setDetail(null);
    const r = await fetch(`/api/admin/analyses/${id}`).then((x) => x.json());
    if (r.ok) setDetail(r.analysis);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users" className="text-xs text-text-tertiary hover:underline">
            ← 사용자 목록
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-text-primary">사용자 상세</h1>
          <p className="text-[11px] text-text-tertiary">user_id {userId}</p>
        </div>
        <button onClick={() => void load()} className="rounded-md border border-border px-3 py-1.5 text-xs">
          새로고침
        </button>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error-soft px-3 py-2 text-xs text-error">{error}</p>}
      {loading && <p className="text-xs text-text-tertiary">불러오는 중…</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-text-primary">최근 활동</h2>
        {events.length === 0 ? (
          <p className="text-xs text-text-tertiary">
            기록된 활동이 없습니다. 인증 이벤트는 이번 배포 이후의 로그인부터 쌓입니다.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-xs">
                <span className="text-text-primary">
                  {EVENT_LABEL[e.event_type] ?? e.event_type}
                  {e.field === "provider" && e.after_value && (
                    <span className="ml-1 text-text-tertiary">({e.after_value})</span>
                  )}
                  {e.reason && <span className="ml-1 text-text-tertiary">— {e.reason}</span>}
                </span>
                <span className="shrink-0 text-text-tertiary">{time(e.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-text-primary">최근 분석 ({analyses.length})</h2>
        {analyses.length === 0 ? (
          <p className="text-xs text-text-tertiary">분석 기록이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {analyses.map((a) => (
              <li key={a.id} className="space-y-1 px-3 py-2 text-xs">
                <div className="flex items-baseline justify-between gap-3">
                  <button onClick={() => void openAnalysis(a.id)} className="text-left font-medium text-text-primary hover:underline">
                    {a.title ?? "(제목 없음)"}
                  </button>
                  <span className="shrink-0 text-text-tertiary">{time(a.created_at)}</span>
                </div>
                {/* 원본 URL — 이 화면의 존재 이유다. 클릭해서 바로 열 수 있어야 한다. */}
                {a.source_url && (
                  <a
                    href={a.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-[11px] text-primary hover:underline"
                  >
                    {a.source_url}
                  </a>
                )}
                <p className="text-[11px] text-text-tertiary">
                  Analysis {a.id}
                  {a.job_key && ` · job ${a.job_key}`}
                  {a.status && ` · ${a.status}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <section className="space-y-2 rounded-md border border-border bg-background p-4">
          <h2 className="text-sm font-medium text-text-primary">분석 상세</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <Row label="Analysis ID" value={detail.analysisId} />
            <Row label="Job Key" value={detail.jobKey} />
            <Row label="상품명" value={detail.title} />
            <Row label="브랜드" value={detail.brand} />
            <Row label="SKU" value={detail.sku} />
            <Row
              label="가격"
              value={detail.priceAmount != null ? `${detail.priceAmount} ${detail.priceCurrency ?? ""}`.trim() : null}
            />
            <Row label="상태" value={detail.status} />
            <Row label="workspace" value={detail.workspaceId} />
          </dl>
          <div className="text-xs">
            <span className="text-text-tertiary">원본 URL</span>
            <br />
            {detail.sourceUrl ? (
              <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">
                {detail.sourceUrl}
              </a>
            ) : (
              <span className="text-text-tertiary">—</span>
            )}
          </div>
          {detail.optionGroups.length > 0 && (
            <p className="text-xs text-text-secondary">
              옵션: {detail.optionGroups.map((g) => `${g.name ?? "?"}(${g.values.length})`).join(" · ")}
            </p>
          )}
          {!detail.productDataAvailable && (
            <p className="text-[11px] text-text-tertiary">
              저장된 상품 정보를 읽지 못했습니다 — 분석 당시 저장 형태가 달랐을 수 있습니다. 원본 URL로 확인해 주세요.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-text-tertiary">{label}</dt>
      <dd className="break-all text-text-primary">{value ?? "—"}</dd>
    </div>
  );
}
