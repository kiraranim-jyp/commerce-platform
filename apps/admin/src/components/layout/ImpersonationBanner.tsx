"use client";

import { useEffect, useState } from "react";

/**
 * BETA-SECURITY-2 FINAL §4(CPO 지시, 2026-09-07) — 전환 중임을 항상 보이게 한다.
 *
 * 이 배너가 없으면 Admin이 자기 화면인 줄 알고 남의 데이터를 고칠 수 있다.
 * CS 도구에서 가장 흔한 사고라 "명확한 표시"가 지시서에 따로 적힌 것이다.
 *
 * 전환 상태가 아니면 아무것도 그리지 않으므로 일반 사용자 화면에는 영향이 없다.
 */
interface ImpersonationState {
  id: string;
  email: string | null;
}

export function ImpersonationBanner() {
  const [target, setTarget] = useState<ImpersonationState | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/impersonate");
        // 일반 사용자는 Admin 세션이 없어 401이 온다 — 정상이므로 조용히 넘어간다.
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; impersonating: ImpersonationState | null };
        if (!cancelled && data.ok) setTarget(data.impersonating);
      } catch {
        // 배너는 부가 정보라 실패해도 화면을 막지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) return null;

  async function endImpersonation() {
    setEnding(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      window.location.assign("/admin/users");
    } catch {
      setEnding(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2 text-xs text-white">
      <span className="font-medium">
        현재 {target.email ?? target.id} 계정으로 전환하여 사용 중입니다 — 이 화면의 작업은 해당 사용자의 데이터에
        적용됩니다.
      </span>
      <button
        type="button"
        onClick={() => void endImpersonation()}
        disabled={ending}
        className="rounded border border-white/60 px-2 py-0.5 text-[11px] font-medium hover:bg-white/10 disabled:opacity-50"
      >
        {ending ? "종료 중..." : "전환 종료"}
      </button>
    </div>
  );
}
