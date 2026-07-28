import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface DashboardData {
  today: {
    total: number;
    success: number;
    failed: number;
  };
  errorCodeCounts: Record<string, number>;
}

/**
 * "오늘 등록 18건, 성공 15건, 실패 3건" + ErrorCode 집계 — registration_attempts
 * (모든 시도, 사용자가 문의를 안 남겨도 잡힘)와 support_inquiries(사용자가 직접
 * 제출한 것, IMG001처럼 등록 이전 단계 실패도 포함)를 합쳐서 낸다.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const [attemptsRes, inquiriesRes] = await Promise.all([
    supabase
      .from("registration_attempts")
      .select("status, error_code")
      .gte("created_at", todayStartIso),
    supabase.from("support_inquiries").select("error_code").gte("created_at", todayStartIso),
  ]);

  if (attemptsRes.error) {
    return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
  }
  if (inquiriesRes.error) {
    return NextResponse.json({ error: inquiriesRes.error.message }, { status: 500 });
  }

  const attempts = attemptsRes.data ?? [];
  const inquiries = inquiriesRes.data ?? [];

  const today = {
    total: attempts.length,
    success: attempts.filter((a) => a.status === "SUBMITTED").length,
    failed: attempts.filter((a) => a.status === "FAILED").length,
  };

  const errorCodeCounts: Record<string, number> = {};
  const bump = (code: string | null) => {
    const key = code ?? "미분류";
    errorCodeCounts[key] = (errorCodeCounts[key] ?? 0) + 1;
  };
  for (const a of attempts) {
    if (a.status === "FAILED") bump(a.error_code);
  }
  for (const i of inquiries) {
    bump(i.error_code);
  }

  const data: DashboardData = { today, errorCodeCounts };
  return NextResponse.json(data);
}
