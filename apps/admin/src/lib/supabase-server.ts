import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * BETA-SECURITY-2 §4 — 서버(라우트 핸들러 / 서버 컴포넌트)용 Supabase Auth
 * 클라이언트. 요청 쿠키에서 세션을 읽고, 토큰이 갱신되면 응답 쿠키에 다시
 * 써 넣는다.
 *
 * Next 16에서 cookies()는 async다(next/dist/docs의 authentication 가이드
 * 참고) — 그래서 이 함수도 async다.
 *
 * 이 클라이언트는 "지금 누구인가"만 판단한다. 데이터 조회는 기존
 * service_role 클라이언트(supabase-admin.ts)가 계속 담당한다 — 28개 파일의
 * 쿼리 경로를 이번에 한꺼번에 바꾸지 않는다는 §17 지시에 따른 것이다.
 * 대신 그 쿼리들 앞에 소유권 검사를 세운다(§5/§17).
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다(읽기 전용 컨텍스트).
          // 세션 갱신은 proxy.ts가 담당하므로 여기서 삼켜도 안전하다 —
          // Supabase 공식 SSR 가이드가 권장하는 처리다.
        }
      },
    },
  });
}
