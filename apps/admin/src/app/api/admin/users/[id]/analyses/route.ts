import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * CS-OBSERVABILITY-1(CPO 지시, 2026-09-10) — "이 사용자가 최근 분석한 상품들".
 *
 * 이 라우트의 존재 이유는 **원본 URL**이다. CS 문의가 오면 사용자에게 URL을 다시
 * 묻지 않고 여기서 찾는다. product_snapshots.source_url이 016부터 이미 있었고,
 * 043이 workspace_id를 붙여 소유자까지 이어져 있다 — 새 테이블이 필요 없다.
 *
 * 사용자 → workspace → snapshot 순으로 좁힌다. workspace_members가 소유 관계의
 * 단일 출처다(require-user.ts가 세션에서 쓰는 것과 같은 테이블).
 *
 * 접근 통제는 proxy의 관리자 세션 검사에 의존한다(/api/admin/*). 판매자는 이
 * 경로에 도달하지 못하므로 남의 분석을 볼 수 없다.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: userId } = await context.params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  const { data: memberships, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  if (memberError) return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });

  const workspaceIds = (memberships ?? []).map((m) => m.workspace_id as string);
  if (workspaceIds.length === 0) return NextResponse.json({ ok: true, analyses: [], workspaceIds: [] });

  const { data, error } = await supabase
    .from("product_snapshots")
    .select("id, job_key, source_url, title, status, workspace_id, created_at, updated_at, last_opened_at")
    .in("workspace_id", workspaceIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, analyses: data ?? [], workspaceIds });
}
