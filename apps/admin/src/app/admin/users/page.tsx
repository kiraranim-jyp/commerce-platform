"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminUserSummary } from "@/app/api/admin/users/route";

/**
 * BETA-SECURITY-2 FINAL §3/§8(CPO 지시, 2026-09-07) — Admin 계정관리.
 *
 * 범위는 A안이다: 사용자 목록/상세/상태 변경/비밀번호 재설정/사용자 전환까지.
 * 사용자별 설정을 여기서 직접 편집하는 화면은 만들지 않는다(§6) — Admin은
 * 전환한 뒤 기존 설정관리 화면을 그대로 쓴다.
 *
 * 이 경로(/admin/*)는 proxy의 Admin HMAC 검사를 통과해야만 열린다.
 */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // setError(null)을 여기 두면 effect 본문에서 동기적으로 setState가 일어나
  // react-hooks/set-state-in-effect에 걸린다. 오류 초기화는 사용자가 직접
  // 행동을 시작하는 act()/impersonate()에서만 한다.
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as { ok: boolean; users?: AdminUserSummary[]; error?: string };
      if (!data.ok) {
        setError(data.error ?? "사용자 목록을 불러오지 못했습니다.");
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setError("사용자 목록을 불러오지 못했습니다.");
    }
  }, []);

  // 최초 1회 로드. effect 본문에서 동기적으로 setState하지 않도록 await 뒤에서만
  // 상태를 바꾼다(react-hooks/set-state-in-effect) — ImpersonationBanner와 같은 패턴.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/users");
        const data = (await res.json()) as { ok: boolean; users?: AdminUserSummary[]; error?: string };
        if (cancelled) return;
        if (!data.ok) {
          setError(data.error ?? "사용자 목록을 불러오지 못했습니다.");
          return;
        }
        setUsers(data.users ?? []);
      } catch {
        if (!cancelled) setError("사용자 목록을 불러오지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(user: AdminUserSummary, action: "suspend" | "activate" | "resetPassword") {
    setBusyId(user.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "요청을 처리하지 못했습니다.");
        return;
      }
      setNotice(
        action === "resetPassword"
          ? `${user.email ?? user.id} 에게 비밀번호 재설정 메일을 보냈습니다.`
          : "상태를 변경했습니다.",
      );
      await load();
    } catch {
      setError("요청을 처리하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function impersonate(user: AdminUserSummary) {
    setBusyId(user.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "사용자 전환에 실패했습니다.");
        return;
      }
      // 전환 후에는 그 사용자의 실제 서비스 화면으로 들어간다(§4).
      // 쿠키 기반 신원 변경이라 전체 리로드로 서버가 새 쿠키를 다시 읽게 한다.
      window.location.assign("/pipeline");
    } catch {
      setError("사용자 전환에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">계정관리</h1>
        <p className="text-xs text-text-tertiary">
          Beta 사용자 계정을 조회하고 상태를 관리합니다. 설정은 사용자 전환 후 기존 설정 화면에서 확인하세요.
        </p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error-soft px-3 py-2 text-xs text-error">{error}</p>}
      {notice && (
        <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-xs text-success">{notice}</p>
      )}

      {users === null ? (
        <p className="text-xs text-text-tertiary">불러오는 중...</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-text-tertiary">등록된 사용자가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[880px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-border bg-background text-text-secondary">
                <th className="px-2 py-1.5 font-medium">이메일</th>
                <th className="whitespace-nowrap px-2 py-1.5 font-medium">로그인 방식</th>
                <th className="whitespace-nowrap px-2 py-1.5 font-medium">상태</th>
                <th className="whitespace-nowrap px-2 py-1.5 font-medium">가입일</th>
                <th className="whitespace-nowrap px-2 py-1.5 font-medium">마지막 로그인</th>
                <th className="whitespace-nowrap px-2 py-1.5 font-medium">워크스페이스</th>
                <th className="whitespace-nowrap px-2 py-1.5 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border align-top last:border-b-0">
                  <td className="px-2 py-1.5 text-text-primary">
                    {u.email ?? "—"}
                    {!u.emailConfirmed && (
                      <span className="ml-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] text-warning">
                        이메일 미확인
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-text-secondary">
                    {u.providers.length ? u.providers.join(", ") : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        u.suspended ? "bg-error-soft text-error" : "bg-success-soft text-success"
                      }`}
                    >
                      {u.suspended ? "일시정지" : "사용중"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-text-secondary">
                    {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-text-secondary">
                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString("ko-KR") : "—"}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-text-tertiary">
                    {u.workspaceId ? `${u.workspaceId.slice(0, 8)}…` : "미생성"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => void impersonate(u)}
                        className="rounded border border-primary px-2 py-0.5 text-[10px] font-medium text-primary disabled:opacity-50"
                      >
                        사용자 전환
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => void act(u, u.suspended ? "activate" : "suspend")}
                        className="rounded border border-border px-2 py-0.5 text-[10px] text-text-primary disabled:opacity-50"
                      >
                        {u.suspended ? "사용 재개" : "일시정지"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id || !u.email}
                        onClick={() => void act(u, "resetPassword")}
                        className="rounded border border-border px-2 py-0.5 text-[10px] text-text-primary disabled:opacity-50"
                      >
                        비밀번호 재설정
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
