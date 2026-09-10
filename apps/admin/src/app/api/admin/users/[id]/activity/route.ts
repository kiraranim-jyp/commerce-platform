import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * CS-OBSERVABILITY-1(CPO 지시, 2026-09-10) — "이 사용자에게 무슨 일이 있었는가".
 *
 * 지금까지 CS 문의가 오면 사용자에게 URL과 시각을 다시 물어봐야 했다. 필요한
 * 데이터는 이미 다 있었고(audit_log.target_user_id + 044의 인덱스,
 * product_snapshots.source_url + workspace_id) 이어 붙인 화면만 없었다.
 *
 * 새 테이블을 만들지 않는다 — 기존 audit_log와 product_snapshots를 그대로 읽는다.
 *
 * 접근 통제: /api/admin/* 은 proxy가 관리자 세션으로 이미 막고 있다(proxy.ts
 * isAdminPath — 세션 없으면 401). 그래서 이 라우트는 관리자만 도달한다.
 * 반대로 판매자는 이 경로 자체에 들어올 수 없으므로 남의 활동을 볼 수 없다.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: userId } = await context.params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, event_type, actor, target_label, snapshot_id, field, after_value, reason, created_at")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, events: data ?? [] });
}
