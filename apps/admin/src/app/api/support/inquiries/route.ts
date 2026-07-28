import { NextResponse } from "next/server";
import type { RegistrationStepLog } from "@commerce/listing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

interface InquiryBody {
  errorCode?: string;
  errorMessage: string;
  traceId?: string;
  url?: string;
  platform?: string;
  site?: string;
  appVersion?: string;
  occurredAt: string;
  userNote?: string;
  stepLog?: RegistrationStepLog[];
}

/**
 * 등록 실패 화면의 "문의하기" 버튼이 호출한다 — 인증 없이 누구나 호출 가능하다
 * (사용자가 아직 어떤 계정으로도 로그인하지 않은 상태에서 실패를 겪을 수 있으므로).
 * Supabase가 아직 설정 안 됐으면(로컬 개발 등) 조용히 stored:false만 반환한다 —
 * 클립보드 복사라는 폴백 경로가 이미 있으므로 이 저장 실패가 사용자 경험을 막으면
 * 안 된다.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as InquiryBody | null;
  if (!body?.errorMessage || !body.occurredAt) {
    return NextResponse.json({ error: "errorMessage와 occurredAt이 필요합니다." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ stored: false, reason: "SUPABASE_NOT_CONFIGURED" });
  }

  const { error } = await supabase.from("support_inquiries").insert({
    error_code: body.errorCode ?? null,
    error_message: body.errorMessage,
    trace_id: body.traceId ?? null,
    url: body.url ?? null,
    platform: body.platform ?? null,
    site: body.site ?? null,
    app_version: body.appVersion ?? null,
    occurred_at: body.occurredAt,
    user_note: body.userNote ?? null,
    step_log: body.stepLog ?? null,
  });

  if (error) {
    console.warn("[support/inquiries] 저장 실패:", error.message);
    return NextResponse.json({ stored: false, reason: error.message });
  }
  return NextResponse.json({ stored: true });
}
