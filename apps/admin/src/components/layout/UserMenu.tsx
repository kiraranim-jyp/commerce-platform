"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";

/**
 * CEO-9A-3(CPO 지시, 2026-09-08) — 우측 상단 로그인 사용자 메뉴.
 *
 * 좌측 하단에 있던 로그아웃을 여기로 옮긴다. 같은 기능이 두 곳에 있으면
 * 안 되므로 기존 것은 제거했다(§8).
 *
 * 이메일은 /api/auth/me가 서버에서 내려준다 — 하드코딩하지 않고, 클라이언트가
 * 임의로 지정할 수도 없다(§4/§10). 비로그인(401)이면 아무것도 그리지 않는다(§5).
 *
 * 로그아웃은 기존 /api/auth/logout을 그대로 재사용한다(§6) — 새 인증 로직을
 * 만들지 않는다.
 */
interface MeResponse {
  email: string | null;
  avatarUrl: string | null;
  impersonated: boolean;
}

export function UserMenu() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return; // 401 = 비로그인. 조용히 넘어간다.
        const data = (await res.json()) as { ok: boolean; user: MeResponse };
        if (!cancelled && data.ok) setMe(data.user);
      } catch {
        // 헤더 부가 정보라 실패해도 화면을 막지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 바깥을 클릭하면 닫는다 — 드롭다운이 열린 채로 남아 화면을 가리지 않게.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!me) return null;

  const label = me.email ?? "로그인됨";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // CEO-10 §5 — 로그아웃 후에는 Landing으로 간다. /login으로 보내면
      // "방금 나왔는데 왜 또 로그인 화면인가"처럼 읽힌다.
      router.replace("/");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-text-primary transition-colors hover:bg-background"
      >
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 외부(Google) 프로필 URL이라 next/image 도메인 설정을 새로 추가하지 않는다.
          <img src={me.avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full" />
        ) : (
          <User size={16} className="shrink-0 text-text-tertiary" />
        )}
        {/* §9 — 좁은 화면에서 이메일이 레이아웃을 밀지 않도록 잘라서 보여준다.
            전체 이메일은 아래 드롭다운에서 확인할 수 있다. */}
        <span className="hidden truncate sm:inline">{label}</span>
        <ChevronDown size={14} className="shrink-0 text-text-tertiary" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="break-all text-xs font-medium text-text-primary">{label}</p>
            {me.impersonated && (
              <p className="mt-0.5 text-[10px] text-warning">관리자가 전환하여 사용 중인 계정입니다.</p>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-background disabled:opacity-50"
          >
            <LogOut size={14} className="shrink-0" />
            {loggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}
