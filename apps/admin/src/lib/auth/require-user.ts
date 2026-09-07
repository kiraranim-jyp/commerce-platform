import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * BETA-SECURITY-2 §5/§13 — 서버에서 "지금 누구인가"를 정하는 단 하나의 경로.
 *
 * 절대 규칙: 요청 body/query의 userId·ownerId·workspaceId를 권한 근거로
 * 쓰지 않는다. 그런 값이 들어와도 무시한다 — 최종 권한 기준은 세션의
 * 사용자뿐이다. 이 파일 밖에서 사용자 신원을 다시 판단하지 않는다.
 *
 * Next 문서(01-app/02-guides/authentication.md)가 명시하듯 proxy(구
 * middleware)는 authorization solution이 아니다. proxy는 쿠키만 보는
 * optimistic check이고, 실제 권한 검사는 반드시 이 함수를 통해 라우트
 * 안에서 이뤄져야 한다.
 */
export interface AuthedUser {
  userId: string;
  email: string | null;
  workspaceId: string;
}

/** 인증 실패를 라우트가 그대로 반환할 수 있는 형태로 돌려준다. 예외를
 * 던지지 않는 이유: 기존 67개 라우트가 전부 try/catch 없이 NextResponse를
 * 반환하는 스타일이라, 예외 방식으로 바꾸면 라우트마다 래퍼가 필요하다. */
export type RequireUserResult = { ok: true; user: AuthedUser } | { ok: false; response: NextResponse };

function unauthorized(): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 }),
  };
}

/**
 * 현재 세션 사용자 + 그 사용자의 Default Workspace를 돌려준다.
 *
 * workspace가 없으면(신규 가입 직후) 만들어 준다 — §7의 idempotent 요구를
 * workspace_members의 unique(workspace_id, user_id) 제약과 "있으면 재사용"
 * 조회로 보장한다. 로그인할 때마다 workspace가 새로 생기지 않는다.
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return unauthorized();

  // getUser()는 로컬 쿠키를 신뢰하지 않고 Auth 서버에 토큰을 검증시킨다.
  // getSession()은 쿠키 내용을 그대로 믿으므로 인가 판단에 쓰면 안 된다.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return unauthorized();

  const workspaceId = await resolveDefaultWorkspaceId(data.user.id);
  if (!workspaceId) {
    // 사용자는 인증됐는데 workspace를 확보하지 못한 상태다. 데이터를
    // 보여줄 근거가 없으므로 통과시키지 않는다(빈 목록을 주지 않는다 —
    // "내 데이터가 사라졌다"로 보이는 것보다 명시적 실패가 낫다).
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "워크스페이스를 준비하지 못했습니다." }, { status: 500 }),
    };
  }

  return { ok: true, user: { userId: data.user.id, email: data.user.email ?? null, workspaceId } };
}

/** 사용자의 기본 workspace id. 없으면 생성한다(§7). */
async function resolveDefaultWorkspaceId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: existing } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.workspace_id) return existing.workspace_id as string;

  const { data: created, error: createError } = await admin
    .from("workspaces")
    .insert({ name: "기본 워크스페이스", created_by: userId })
    .select("id")
    .single();
  if (createError || !created) return null;

  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({ workspace_id: created.id, user_id: userId, role: "OWNER" });
  if (memberError) {
    // 동시 로그인 등으로 이미 만들어졌을 수 있다 — 다시 조회해서 확인한다.
    const { data: retry } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return (retry?.workspace_id as string) ?? null;
  }
  return created.id as string;
}
