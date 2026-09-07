"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * BETA-SECURITY-2 §19/§20(CPO 지시, 2026-09-07) — Seller(Beta 사용자) 로그인.
 *
 * 관리자 로그인(/admin/login)과 별개 화면이다. 두 인증 축이 섞이면 한쪽
 * 자격으로 다른 쪽에 들어가는 사고가 나므로 UI도 분리한다.
 *
 * Beta 운영 방식상 회원가입은 열지 않는다 — 계정은 운영자가 Supabase 콘솔에서
 * 만들어 전달한다. 여기에 가입 폼을 두면 누구나 계정을 만들어 파이프라인
 * (AI/크롤러 비용)을 쓸 수 있게 된다.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get("next") ?? "/pipeline";
  const authUnavailable = searchParams.get("error") === "auth-unavailable";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // §18과 같은 원칙 — 어느 쪽이 틀렸는지(이메일 없음/비밀번호 틀림)
        // 알려주면 계정 존재 여부를 확인하는 도구가 된다.
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      // 서버 컴포넌트가 새 세션 쿠키를 보도록 강제로 새로고침한다.
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary">따져 로그인</h1>
        <p className="text-xs text-text-tertiary">
          Beta 기간에는 운영자가 발급한 계정으로만 로그인할 수 있습니다.
        </p>
      </div>

      {authUnavailable && (
        <p className="rounded-md border border-error/30 bg-error-soft px-3 py-2 text-xs text-error">
          인증 설정이 준비되지 않아 로그인할 수 없습니다. 운영자에게 문의해 주세요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-medium text-text-secondary">
            이메일
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-medium text-text-secondary">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams는 Suspense 경계가 필요하다(App Router 요구사항).
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
