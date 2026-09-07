"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * BETA-SECURITY-2 §4 — 브라우저(로그인 UI)용 Supabase 클라이언트.
 *
 * anon key만 쓴다. 이 키는 공개돼도 되는 값이고(RLS와 Auth가 실제 경계다),
 * service_role 키는 이 파일 근처에도 오면 안 된다 — service_role은
 * supabase-admin.ts(서버 전용)에만 있다.
 *
 * 이 클라이언트가 하는 일은 로그인/로그아웃뿐이다. 데이터 조회는 하지
 * 않는다 — 모든 데이터는 서버 라우트가 requireUser()로 사용자를 확인한
 * 뒤에 내려준다(§5). 브라우저에서 직접 테이블을 읽게 만들면 RLS 정책이
 * 없는 현재 상태에서 곧바로 구멍이 된다.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // 환경변수가 없으면 "로그인은 됐는데 세션이 없는" 애매한 상태를 만들지
    // 않고 즉시 실패한다 — 인증 기능이 조용히 꺼지는 것이 가장 위험하다.
    throw new Error("Supabase 인증 설정이 없습니다(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  return createBrowserClient(url, anonKey);
}
