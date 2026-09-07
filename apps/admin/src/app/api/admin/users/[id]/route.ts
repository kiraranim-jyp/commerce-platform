import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordAuditLog } from "@/lib/audit-log";

/**
 * BETA-SECURITY-2 FINAL §3/§5(CPO 지시, 2026-09-07) — Admin 계정관리:
 * 상태 변경(사용중/일시정지)과 비밀번호 재설정.
 *
 * 인증은 proxy의 Admin HMAC 검사에 의존한다(/api/admin/* 경로).
 *
 * §19 — 비밀번호는 응답/로그 어디에도 남기지 않는다. 재설정은 "새 비밀번호를
 * 만들어 알려주는" 방식이 아니라 Supabase의 복구 메일을 보내는 방식이다.
 * Admin이 사용자의 비밀번호를 알게 되는 경로 자체를 만들지 않는다 — CS는
 * 사용자 전환(impersonation)으로 하고, 그건 비밀번호가 필요 없다(§4).
 */
type Action = { action: "suspend" } | { action: "activate" } | { action: "resetPassword" };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase가 설정되지 않았습니다." }, { status: 500 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Action | null;
  if (!body?.action) {
    return NextResponse.json({ ok: false, error: "action이 필요합니다." }, { status: 400 });
  }

  const { data: target, error: lookupError } = await admin.auth.admin.getUserById(id);
  if (lookupError || !target.user) {
    return NextResponse.json({ ok: false, error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }
  const targetLabel = target.user.email ?? id;

  if (body.action === "suspend" || body.action === "activate") {
    // Supabase는 정지를 "banned_until"로 표현한다. 해제는 0초로 되돌린다.
    const banDuration = body.action === "suspend" ? "876000h" : "none";
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: banDuration });
    if (error) {
      console.warn("[admin/users] 상태 변경 실패:", error.message);
      return NextResponse.json({ ok: false, error: "상태를 변경하지 못했습니다." }, { status: 500 });
    }
    await recordAuditLog({
      eventType: "USER_STATUS_CHANGED",
      actor: "admin",
      targetUserId: id,
      targetLabel,
      field: "status",
      afterValue: body.action === "suspend" ? "SUSPENDED" : "ACTIVE",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resetPassword") {
    if (!target.user.email) {
      return NextResponse.json({ ok: false, error: "이메일이 없는 계정입니다." }, { status: 400 });
    }
    // 복구 링크를 생성한다. Admin이 비밀번호 자체를 정하지 않는다 — 값이
    // 오가지 않으므로 로그/화면에 노출될 비밀번호가 애초에 없다.
    const { error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: target.user.email,
    });
    if (error) {
      console.warn("[admin/users] 비밀번호 재설정 실패:", error.message);
      return NextResponse.json({ ok: false, error: "비밀번호 재설정을 시작하지 못했습니다." }, { status: 500 });
    }
    await recordAuditLog({
      eventType: "USER_PASSWORD_RESET",
      actor: "admin",
      targetUserId: id,
      targetLabel,
    });
    // 생성된 링크는 응답에 넣지 않는다 — 그 자체가 계정 탈취 수단이다.
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "지원하지 않는 action입니다." }, { status: 400 });
}
