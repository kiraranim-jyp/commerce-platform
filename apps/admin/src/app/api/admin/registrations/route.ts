import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface RegistrationAttemptRecord {
  id: string;
  platform: string;
  status: "SUBMITTED" | "FAILED";
  error_code: string | null;
  trace_id: string | null;
  /** Sprint B-1 — 마이그레이션 025 실행 전 기록된 레거시 시도는 null. */
  job_key: string | null;
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
 * 둘 다에 쓴다. middleware.ts가 이미 /api/admin/* 전체를 세션 쿠키로 막아둔다.
 * B-3(CPO 지시: "이미 등록된 상품을 다시 보기 → 현재 설정과 실제 등록 이력을
 * 구분해서 표시") — ?snapshotId= 로 특정 상품의 이력만 볼 수 있게 한다(전체
 * 목록에서 찾기보다, 상품 화면에서 바로 링크로 들어올 때 필요). */
export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const snapshotId = new URL(request.url).searchParams.get("snapshotId");

  let query = supabase.from("registration_attempts").select("*").order("created_at", { ascending: false });
  query = snapshotId ? query.eq("snapshot_id", snapshotId).limit(LIST_LIMIT) : query.limit(LIST_LIMIT);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ registrations: (data ?? []) as RegistrationAttemptRecord[] });
}
