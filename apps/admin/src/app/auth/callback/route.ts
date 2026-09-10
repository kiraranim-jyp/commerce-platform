import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireUser } from "@/lib/auth/require-user";
import { recordAuditLog } from "@/lib/audit-log";

/**
 * BETA-SECURITY-2 FINAL §2/§12(CPO 지시, 2026-09-07) — Google OAuth 콜백.
 *
 * Supabase가 authorization code를 쿼리로 붙여 여기로 돌려보낸다. 그 코드를
 * 세션으로 교환하는 것이 이 라우트의 유일한 책임이다.
 *
 * §12가 지정한 순서를 그대로 따른다:
 *   ① code 교환 → ② 세션 생성 → ③ 사용자 확인 → ④ membership 확인
 *   → ⑤ 없으면 Default Workspace 생성 / ⑥ 있으면 기존 것 사용 → ⑦ 이동
 *
 * ③~⑥은 requireUser()가 이미 하는 일이라 그대로 재사용한다(§13 — Google
 * 로그인과 이메일 로그인이 서로 다른 authorization 경로를 갖지 않는다).
 * 여기서 workspace 생성 로직을 다시 쓰면 두 경로가 갈라진다.
 *
 * 중요(§3): requireUser()는 workspace_members를 먼저 조회하고 있을 때만
 * 재사용한다. 그래서 043으로 이미 대표 workspace에 연결된 Auth user가
 * Google로 로그인하면 새 workspace가 만들어지지 않고 기존 것이 그대로
 * 쓰인다 — 이 라우트가 따로 처리할 필요가 없다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  // 사용자가 Google 동의 화면에서 취소한 경우 등. 기술적 원인을 화면에
  // 노출하지 않고 로그인 화면으로 되돌린다(§18과 같은 원칙).
  if (oauthError || !code) {
    // CS-OBSERVABILITY-1 — 왜 로그인이 실패했는지 Admin에서 볼 수 있어야 한다.
    // code 값 자체는 남기지 않는다(그것으로 세션을 만들 수 있다).
    await recordAuditLog({
      eventType: "AUTH_LOGIN_FAILURE",
      actor: "seller",
      reason: oauthError ? "google-consent-denied-or-error" : "missing-code",
    });
    return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
  }

  await recordAuditLog({ eventType: "AUTH_GOOGLE_CALLBACK", actor: "seller" });

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=auth-unavailable`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    await recordAuditLog({ eventType: "AUTH_LOGIN_FAILURE", actor: "seller", reason: "code-exchange-failed" });
    return NextResponse.redirect(`${origin}/login?error=oauth-failed`);
  }

  // ③~⑥ — 세션이 생겼으니 workspace까지 확보되는지 여기서 확인한다.
  // 첫 화면에 도착한 뒤에 workspace가 없어서 실패하는 것보다, 로그인
  // 흐름 안에서 처리하는 편이 사용자에게 훨씬 덜 혼란스럽다.
  const auth = await requireUser();
  if (!auth.ok) {
    await recordAuditLog({ eventType: "AUTH_LOGIN_FAILURE", actor: "seller", reason: "workspace-unavailable" });
    return NextResponse.redirect(`${origin}/login?error=workspace-unavailable`);
  }

  await recordAuditLog({
    eventType: "AUTH_LOGIN_SUCCESS",
    actor: "seller",
    targetUserId: auth.user.userId,
    targetLabel: auth.user.email ?? null,
    // 어떤 방식으로 들어왔는지 — 이 값이 없으면 Google 로그인과 비밀번호
    // 로그인을 사후에 구분할 수 없다.
    field: "provider",
    afterValue: "google",
  });

  // `next`는 우리 앱 내부 경로만 허용한다 — 외부 URL이 들어오면 오픈
  // 리다이렉트가 되어 피싱에 쓰일 수 있다.
  const requestedNext = searchParams.get("next");
  const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/pipeline";

  return NextResponse.redirect(`${origin}${next}`);
}
