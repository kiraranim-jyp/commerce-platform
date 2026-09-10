import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { recordAuditLog, type AuditEventType } from "@/lib/audit-log";

/**
 * CS-OBSERVABILITY-1(CPO 지시, 2026-09-10) — 브라우저에서만 일어나는 인증 사건을
 * 서버 기록으로 남긴다.
 *
 * Google 시작(리다이렉트 직전)과 비밀번호 로그인은 supabase-js가 클라이언트에서
 * 직접 처리해서 서버 라우트를 거치지 않는다. 그래서 이 두 사건은 화면이 알려주지
 * 않으면 어디에도 남지 않는다 — 지금까지 "사장님이 어느 방식으로 로그인했는가"를
 * 확인할 수 없었던 이유다.
 *
 * 보안 원칙: 클라이언트가 보내는 값을 그대로 믿지 않는다.
 *  - 허용하는 event는 아래 세 개뿐이다(성공/실패/구글 시작).
 *  - user_id는 요청 본문에서 받지 않고 **서버가 세션에서 직접 읽는다**. 그래야
 *    남의 계정으로 가짜 로그인 기록을 심을 수 없다.
 *  - 비밀번호·토큰·쿠키는 본문에 담기지 않으며 받더라도 기록하지 않는다.
 */
const ALLOWED: Record<string, AuditEventType> = {
  google_start: "AUTH_GOOGLE_START",
  login_success: "AUTH_LOGIN_SUCCESS",
  login_failure: "AUTH_LOGIN_FAILURE",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { event?: string; provider?: string } | null;
  const eventType = body?.event ? ALLOWED[body.event] : undefined;
  if (!eventType) return NextResponse.json({ ok: false }, { status: 400 });

  // provider도 자유 문자열을 받지 않는다 — 아는 값만 기록한다.
  const provider = body?.provider === "google" ? "google" : body?.provider === "email" ? "email" : null;

  // 성공 기록은 실제로 세션이 생겼을 때만 의미가 있다. 세션에서 읽으므로
  // 클라이언트가 남의 user_id를 주장할 수 없다.
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (eventType === "AUTH_LOGIN_SUCCESS" && !user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await recordAuditLog({
    eventType,
    actor: "seller",
    targetUserId: user?.id ?? null,
    targetLabel: user?.email ?? null,
    ...(provider ? { field: "provider", afterValue: provider } : {}),
  });
  return NextResponse.json({ ok: true });
}
