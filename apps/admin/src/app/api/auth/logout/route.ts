import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { recordAuditLog } from "@/lib/audit-log";

/**
 * BETA-SECURITY-2 §19/§21(CASE I) — Seller 로그아웃.
 *
 * 서버에서 signOut()을 부르는 이유: 브라우저에서만 쿠키를 지우면 refresh
 * 토큰이 Supabase 쪽에 살아 있어서, 남은 토큰으로 세션을 되살릴 수 있다.
 * 서버에서 무효화해야 "로그아웃 후 기존 세션으로 보호 API 호출 → 차단"이
 * 실제로 성립한다.
 *
 * 관리자 로그아웃(/api/admin/logout)과 별개다 — 서로의 세션을 건드리지 않는다.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    // CS-OBSERVABILITY-1 — 누가 로그아웃했는지는 signOut() 전에만 알 수 있다.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await recordAuditLog({
        eventType: "AUTH_LOGOUT",
        actor: "seller",
        targetUserId: data.user.id,
        targetLabel: data.user.email ?? null,
      });
    }
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true });
}
