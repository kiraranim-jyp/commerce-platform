import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface RegistrationAttemptRecord {
  id: string;
  platform: string;
  status: "SUBMITTED" | "FAILED";
  error_code: string | null;
  trace_id: string | null;
  duration_ms: number | null;
  product_name: string | null;
  external_product_id: string | null;
  payload: unknown;
  response: unknown;
  compliance_score: number | null;
  compliance_report: unknown;
  brand_resolution: unknown;
  price_breakdown: unknown;
  created_at: string;
}

const LIST_LIMIT = 100;

/** 등록 시도 이력 — 회귀 테스트("같은 URL 3회 연속 성공") 확인과 실패 원인 추적
 * 둘 다에 쓴다. middleware.ts가 이미 /api/admin/* 전체를 세션 쿠키로 막아둔다. */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("registration_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ registrations: (data ?? []) as RegistrationAttemptRecord[] });
}
