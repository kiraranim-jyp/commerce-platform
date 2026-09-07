import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordAuditLog } from "@/lib/audit-log";
import { createImpersonationToken, IMPERSONATION_COOKIE, readImpersonation } from "@/lib/auth/impersonation";

/**
 * BETA-SECURITY-2 FINAL §4/§5(CPO 지시, 2026-09-07) — 사용자 전환 시작/종료.
 *
 * 전환은 서버에서만 만들어진다. 클라이언트가 보낸 userId는 "누구로 전환할지"
 * 요청일 뿐 권한 근거가 아니다 — 이 라우트는 /api/admin/* 이라 proxy의 Admin
 * HMAC 검사를 이미 통과했고, 그 위에서 대상 사용자의 존재까지 확인한 뒤에만
 * 서명 쿠키를 발급한다.
 *
 * 발급하는 것은 대상 사용자의 세션이 아니라 서명된 "전환 표식"이다
 * (impersonation.ts의 설계 근거 참고). Admin 세션이 없으면 이 쿠키만으로는
 * 아무것도 못 한다.
 */
export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase가 설정되지 않았습니다." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  const userId = body?.userId;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const token = createImpersonationToken(userId);
  if (!token) {
    // ADMIN_SESSION_SECRET이 없으면 서명할 수 없다. 서명 없는 전환을
    // 허용하면 쿠키를 손으로 써서 아무 계정이나 될 수 있다.
    return NextResponse.json({ ok: false, error: "전환 기능을 사용할 수 없습니다." }, { status: 500 });
  }

  const targetLabel = data.user.email ?? userId;
  await recordAuditLog({
    eventType: "IMPERSONATION_STARTED",
    actor: "admin",
    targetUserId: userId,
    targetLabel,
  });

  const response = NextResponse.json({ ok: true, target: { id: userId, email: data.user.email ?? null } });
  response.cookies.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

/** 전환 종료(§4 — "전환 종료 기능 제공"). */
export async function DELETE() {
  // 어떤 사용자에서 빠져나왔는지 기록하려면 지우기 전에 읽어야 한다.
  const current = await readImpersonation();
  if (current) {
    const admin = getSupabaseAdmin();
    let targetLabel = current.targetUserId;
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(current.targetUserId);
      targetLabel = data?.user?.email ?? current.targetUserId;
    }
    await recordAuditLog({
      eventType: "IMPERSONATION_ENDED",
      actor: "admin",
      targetUserId: current.targetUserId,
      targetLabel,
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(IMPERSONATION_COOKIE);
  return response;
}

/** 현재 전환 상태 — 화면 상단 배너가 쓴다. */
export async function GET() {
  const current = await readImpersonation();
  if (!current) return NextResponse.json({ ok: true, impersonating: null });

  const admin = getSupabaseAdmin();
  let email: string | null = null;
  if (admin) {
    const { data } = await admin.auth.admin.getUserById(current.targetUserId);
    email = data?.user?.email ?? null;
  }
  return NextResponse.json({ ok: true, impersonating: { id: current.targetUserId, email } });
}
