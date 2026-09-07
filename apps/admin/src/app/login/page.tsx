"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "@/components/layout/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * BETA-SECURITY-2 FINAL §1/§9(CPO 지시, 2026-09-07) — Seller 로그인.
 *
 * 기본 로그인은 Google이다. 이메일/비밀번호는 Beta QA 테스트 계정용 보조
 * 수단으로만 남긴다(§5) — 그래서 Google 버튼이 primary이고 이메일 폼은
 * 구분선 아래 secondary로 둔다.
 *
 * 관리자 로그인(/admin/login)과는 완전히 별개 화면이다(§16). 두 인증 축이
 * 섞이면 한쪽 자격으로 다른 쪽에 들어가는 사고가 난다.
 *
 * 회원가입 폼은 두지 않는다(§10) — Beta 계정은 운영자가 발급한다. 여기에
 * 가입을 열면 누구나 계정을 만들어 파이프라인(AI/크롤러 비용)을 쓸 수 있다.
 */
const ERROR_MESSAGES: Record<string, string> = {
  "auth-unavailable": "인증 설정이 준비되지 않아 로그인할 수 없습니다. 운영자에게 문의해 주세요.",
  "oauth-failed": "Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
  "workspace-unavailable": "워크스페이스를 준비하지 못했습니다. 운영자에게 문의해 주세요.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);

  const nextPath = searchParams.get("next") ?? "/pipeline";
  const urlError = searchParams.get("error");
  const banner = urlError ? (ERROR_MESSAGES[urlError] ?? "로그인 중 문제가 발생했습니다.") : null;

  async function handleGoogle() {
    setLoading("google");
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // 콜백 라우트가 code를 세션으로 교환한 뒤 next로 보낸다.
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (oauthError) {
        setError("Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setLoading(null);
      }
      // 성공하면 브라우저가 Google로 이동하므로 여기서 할 일이 없다.
    } catch {
      setError("Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setLoading(null);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading("email");
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // §18과 같은 원칙 — 이메일이 없는 건지 비밀번호가 틀린 건지 알려주면
        // 계정 존재 여부를 확인하는 도구가 된다.
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-5 px-4">
      {/* CEO-10 §3 — 로고를 누르면 Landing으로 돌아간다. 로그인 화면에서
          나갈 길이 없으면 서비스 설명을 다시 볼 방법이 없다. */}
      <Link href="/" className="flex items-center gap-2 self-start">
        <BrandMark size={22} />
        <span className="text-sm font-semibold tracking-tight text-text-primary">
          {BUSINESS_INFO.serviceName}
        </span>
      </Link>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text-primary">따져 시작하기</h1>
        <p className="text-xs text-text-tertiary">해외 상품을 국내 판매용으로 준비합니다.</p>
      </div>

      {(banner || error) && (
        <p className="rounded-md border border-error/30 bg-error-soft px-3 py-2 text-xs text-error">
          {error ?? banner}
        </p>
      )}

      {/* §9 — Google이 primary CTA. */}
      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-background disabled:opacity-50"
      >
        <GoogleMark />
        {loading === "google" ? "Google로 이동 중..." : "Google로 시작하기"}
      </button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] text-text-tertiary">또는</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* §5/§9 — Beta 테스트 계정용 보조 로그인. */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
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

        <button
          type="submit"
          disabled={loading !== null || !email || !password}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
        >
          {loading === "email" ? "로그인 중..." : "이메일로 로그인"}
        </button>
      </form>

      <p className="text-[11px] text-text-tertiary">
        Beta 기간에는 운영자가 발급한 계정으로만 이용할 수 있습니다.
      </p>
    </div>
  );
}

/** Google 브랜드 마크(공식 4색). 외부 이미지 요청 없이 인라인 SVG로 둔다. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
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
