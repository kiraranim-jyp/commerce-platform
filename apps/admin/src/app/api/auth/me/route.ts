import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * CEO-9A-3 §4/§10(CPO 지시, 2026-09-08) — 우측 상단 사용자 메뉴가 표시할
 * "지금 로그인한 계정" 정보.
 *
 * 이메일을 클라이언트가 정하지 않는다. 브라우저에서 Supabase 세션을 직접
 * 읽어 이메일을 그리는 방법도 있지만 그렇게 하지 않는 이유가 두 가지다:
 *   ① 표시값의 출처가 서버 판단(requireUser)과 갈라진다.
 *   ② Admin 사용자 전환 중에는 브라우저에 Supabase 세션이 아예 없다 —
 *      클라이언트에서 읽으면 전환 중에 메뉴가 사라지거나 Admin 본인
 *      계정이 뜨는, 사실과 다른 화면이 된다.
 *
 * requireUser()를 그대로 쓴다(§12 — 인증 로직은 변경하지 않는다). 읽기만
 * 하므로 권한 판단 방식은 달라지지 않는다.
 */
export async function GET() {
  const auth = await requireUser();
  // 비로그인은 401. 사용자 메뉴는 이걸 보고 조용히 아무것도 그리지 않는다(§5).
  if (!auth.ok) return auth.response;

  // Google 프로필 이미지는 있으면 쓰고 없으면 기본 아이콘을 쓴다(§4).
  // 전환 중에는 Supabase 세션이 없어 null이 되는데, 그 경우도 기본 아이콘으로
  // 자연스럽게 처리된다 — 없는 이미지를 지어내지 않는다.
  let avatarUrl: string | null = null;
  const supabase = await createSupabaseServerClient();
  if (supabase && !auth.user.impersonated) {
    const { data } = await supabase.auth.getUser();
    const meta = data.user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
    avatarUrl = meta?.avatar_url ?? meta?.picture ?? null;
  }

  return NextResponse.json({
    ok: true,
    user: {
      email: auth.user.email,
      avatarUrl,
      /** 전환 중이면 배너와 함께 "지금 보고 있는 계정"이 누구인지 일치시킨다. */
      impersonated: auth.user.impersonated,
    },
  });
}

