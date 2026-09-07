import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * BETA-SECURITY-2 FINAL §3(CPO 지시, 2026-09-07) — Admin 계정관리: 사용자 목록.
 *
 * 인증은 proxy가 담당한다 — 이 경로(/api/admin/*)는 Admin HMAC 세션이 없으면
 * proxy에서 401로 끊긴다. Seller의 Supabase Auth와 섞지 않는다(§7/§16):
 * requireUser()를 여기서 부르지 않는 이유가 그것이다. Admin은 seller가
 * 아니고 workspace를 갖지 않는다.
 *
 * 비밀번호는 어떤 형태로도 응답에 넣지 않는다(§19).
 */
export interface AdminUserSummary {
  id: string;
  email: string | null;
  /** 로그인 방식 — 'google' / 'email' 등. 여러 개일 수 있다. */
  providers: string[];
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  /** Supabase는 정지된 계정에 banned_until을 미래 시각으로 넣는다. */
  suspended: boolean;
  workspaceId: string | null;
}

export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase가 설정되지 않았습니다." }, { status: 500 });
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    console.warn("[admin/users] 목록 조회 실패:", error.message);
    return NextResponse.json({ ok: false, error: "사용자 목록을 불러오지 못했습니다." }, { status: 500 });
  }

  // workspace는 한 번의 추가 쿼리로 묶는다(사용자마다 조회하면 N+1이다).
  const { data: memberships } = await admin.from("workspace_members").select("user_id, workspace_id");
  const workspaceByUser = new Map<string, string>();
  for (const m of (memberships ?? []) as Array<{ user_id: string; workspace_id: string }>) {
    if (!workspaceByUser.has(m.user_id)) workspaceByUser.set(m.user_id, m.workspace_id);
  }

  const users: AdminUserSummary[] = data.users.map((u) => {
    const bannedUntil = (u as { banned_until?: string | null }).banned_until ?? null;
    return {
      id: u.id,
      email: u.email ?? null,
      providers: (u.identities ?? []).map((i) => i.provider),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      emailConfirmed: Boolean(u.email_confirmed_at),
      suspended: Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now()),
      workspaceId: workspaceByUser.get(u.id) ?? null,
    };
  });

  return NextResponse.json({ ok: true, users });
}
