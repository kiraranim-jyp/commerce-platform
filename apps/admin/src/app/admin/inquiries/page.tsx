"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InquiryRecord } from "@/app/api/admin/inquiries/route";

const STATUS_LABEL: Record<InquiryRecord["status"], string> = {
  OPEN: "미처리",
  IN_PROGRESS: "확인중",
  RESOLVED: "해결완료",
};

const STATUS_OPTIONS: InquiryRecord["status"][] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 운영자 전용 문의 게시판 — 화려한 UI가 필요 없다는 CPO 지시에 맞춰 표 하나로
 * 끝낸다. 목적은 "오늘 어떤 ErrorCode가 많이 발생했는가"를 빠르게 훑는 것과,
 * 개별 케이스의 TraceId/StepLog로 원인을 추적하는 것 두 가지다.
 */
export default function AdminInquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<InquiryRecord["status"] | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/inquiries")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "불러오기 실패");
        return res.json() as Promise<{ inquiries: InquiryRecord[] }>;
      })
      .then((data) => {
        setInquiries(data.inquiries);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // load()를 직접 effect 콜백으로 넘기면 setState가 effect 본문 내에서 동기적으로
  // 실행된 것으로 잡혀 react-hooks/set-state-in-effect에 걸린다 — 마운트 시
  // 최초 호출만 이 effect 안에서 fetch 체인을 그대로 인라인해서 우회한다(load()는
  // 새로고침 버튼 등 재사용을 위해 그대로 남겨둔다). loading의 초기값이 이미
  // true이므로 effect 안에서 setLoading(true)를 다시 호출할 필요도 없다.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/inquiries")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "불러오기 실패");
        return res.json() as Promise<{ inquiries: InquiryRecord[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setInquiries(data.inquiries);
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

  const handleStatusChange = async (id: string, status: InquiryRecord["status"]) => {
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const filtered =
    statusFilter === "ALL" ? inquiries : inquiries.filter((i) => i.status === statusFilter);

  return (
    <div className="mx-auto max-w-5xl p-6 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">문의 게시판</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/dashboard"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          >
            ← 대시보드
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
          >
            로그아웃
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label className="text-xs text-text-secondary">상태</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InquiryRecord["status"] | "ALL")}
          className="rounded-md border border-border px-2 py-1 text-xs"
        >
          <option value="ALL">전체</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-background"
        >
          새로고침
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-error">{error}</p>}
      {loading && <p className="mt-3 text-xs text-text-tertiary">불러오는 중...</p>}

      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-background text-text-secondary">
            <tr>
              <th className="px-3 py-2">발생 시간</th>
              <th className="px-3 py-2">ErrorCode</th>
              <th className="px-3 py-2">메시지</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inquiry) => (
              <Fragment key={inquiry.id}>
                <tr
                  className="cursor-pointer border-t border-border hover:bg-background"
                  onClick={() => setExpandedId(expandedId === inquiry.id ? null : inquiry.id)}
                >
                  <td className="px-3 py-2 text-text-secondary">{formatDateTime(inquiry.created_at)}</td>
                  <td className="px-3 py-2 font-mono font-medium text-error">
                    {inquiry.error_code ?? "—"}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-text-primary">{inquiry.error_message}</td>
                  <td className="px-3 py-2 text-text-secondary">{inquiry.site ?? "—"}</td>
                  <td className="px-3 py-2 text-text-secondary">{inquiry.platform ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={inquiry.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        handleStatusChange(inquiry.id, e.target.value as InquiryRecord["status"])
                      }
                      className="rounded border border-border px-1.5 py-0.5 text-xs"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                {expandedId === inquiry.id && (
                  <tr key={`${inquiry.id}-detail`} className="border-t border-border bg-background">
                    <td colSpan={6} className="px-3 py-3">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <dt className="text-text-secondary">TraceId</dt>
                        <dd className="font-mono text-text-primary">{inquiry.trace_id ?? "—"}</dd>
                        <dt className="text-text-secondary">URL</dt>
                        <dd className="truncate text-text-primary">{inquiry.url ?? "—"}</dd>
                        <dt className="text-text-secondary">App Version</dt>
                        <dd className="text-text-primary">{inquiry.app_version ?? "—"}</dd>
                        <dt className="text-text-secondary">사용자 메모</dt>
                        <dd className="text-text-primary">{inquiry.user_note ?? "—"}</dd>
                      </dl>
                      {Boolean(inquiry.step_log) && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-surface p-2 text-[11px] text-text-secondary">
                          {JSON.stringify(inquiry.step_log, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-text-tertiary">해당하는 문의가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
