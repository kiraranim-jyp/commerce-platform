import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface InquiryRecord {
  id: string;
  error_code: string | null;
  error_message: string;
  trace_id: string | null;
  /** Sprint B-1 — 마이그레이션 025 실행 전 저장된 레거시 문의는 null. */
  job_key: string | null;
  url: string | null;
  platform: string | null;
  site: string | null;
  app_version: string | null;
  occurred_at: string;
  user_note: string | null;
  step_log: unknown;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  created_at: string;
}

const LIST_LIMIT = 200;

/** 최근 문의 목록 + ErrorCode별 집계(오늘 발생분) — "IMG001 15건, CP001 8건"처럼
 * 매일 확인해서 다음 개선 우선순위를 정하는 용도다. middleware.ts가 이미
 * /api/admin/* 전체를 세션 쿠키로 막아두므로 여기서 별도 인증 체크는 안 한다. */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("support_inquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const inquiries = (data ?? []) as InquiryRecord[];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const countsByErrorCodeToday: Record<string, number> = {};
  for (const inquiry of inquiries) {
    if (new Date(inquiry.created_at) < todayStart) continue;
    const code = inquiry.error_code ?? "미분류";
    countsByErrorCodeToday[code] = (countsByErrorCodeToday[code] ?? 0) + 1;
  }

  return NextResponse.json({ inquiries, countsByErrorCodeToday });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: InquiryRecord["status"];
  } | null;
  if (!body?.id || !body.status) {
    return NextResponse.json({ error: "id와 status가 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const { error } = await supabase
    .from("support_inquiries")
    .update({ status: body.status })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
