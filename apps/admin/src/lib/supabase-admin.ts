import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 관리자 클라이언트 — service role 키로 RLS를 우회한다.
 * "use client" 컴포넌트에서 절대 import하면 안 된다(app/api/ 라우트 핸들러 전용).
 * 환경변수가 아직 없으면(로컬 개발 등) null을 반환해서 호출부가 env var 폴백으로
 * 넘어갈 수 있게 한다.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
