import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";

// 이전 middleware.ts에는 `export const runtime = "nodejs"`가 있었다(admin-auth.ts가
// node:crypto를 쓰기 때문). Next 16의 proxy는 항상 Node.js 런타임에서 돌고 route
// segment config 자체를 금지한다(빌드 에러: "Route segment config is not allowed
// in Proxy file") — 그래서 제거했다. 런타임 요구사항은 그대로 충족된다.

/**
 * BETA-SECURITY-2 §15(CPO 지시, 2026-09-07) — Seller 인증 추가.
 *
 * Next 16에서 middleware는 proxy로 이름이 바뀌었다(기능 동일, 이전 파일명은
 * deprecated 경고를 냈다). next/dist/docs의 01-app/01-getting-started/16-proxy.md
 * 참고 — 그래서 middleware.ts를 이 파일로 옮겼다.
 *
 * 이 파일은 인가(authorization)를 책임지지 않는다. Next 공식 문서가 명시한다:
 *   "Proxy ... should not be used as a full session management or authorization
 *    solution."
 * 여기서 하는 것은 optimistic check(쿠키 확인 후 리다이렉트)뿐이고, 실제 권한
 * 판단은 각 API 라우트의 requireUser()가 한다(§15의 3단계 중 1단계).
 *
 * 인증 축이 둘이라는 점이 중요하다(STOP F 대응):
 *   - 관리자(문의 게시판): 기존 ADMIN_SESSION_SECRET HMAC 쿠키. 그대로 둔다.
 *   - Seller(Beta 사용자): Supabase Auth 쿠키.
 * 두 축은 쿠키 이름도 검증 방식도 겹치지 않는다. 관리자 경로에서 Supabase
 * 세션을 요구하지 않고, Seller 경로에서 admin 쿠키를 인정하지 않는다 —
 * 한쪽 로그인으로 다른 쪽에 들어갈 수 있으면 안 된다.
 */

/** 로그인 없이 접근할 수 있는 Seller 경로. */
const SELLER_PUBLIC_PATHS = new Set(["/login", "/terms", "/privacy", "/privacy-settings"]);

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 관리자 축 — 기존 동작을 그대로 유지한다 ────────────────────────────
  if (isAdminPath(pathname)) {
    const isExempt =
      pathname === "/admin/login" || pathname === "/api/admin/login" || pathname === "/api/admin/logout";
    if (isExempt) return NextResponse.next();

    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (verifySessionToken(token)) return NextResponse.next();

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  // ── Seller 축 ─────────────────────────────────────────────────────────
  if (SELLER_PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // 세션 쿠키를 읽고, 만료가 임박했으면 갱신해서 응답 쿠키에 다시 써 넣는다.
  // 이 갱신을 proxy에서 하지 않으면 서버 컴포넌트(쿠키 쓰기 불가)에서 세션이
  // 조용히 끊긴다 — Supabase SSR 가이드가 이 위치를 지정한 이유다.
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 인증 설정이 없으면 통과시키지 않는다. "설정이 없으니 일단 열어둔다"가
  // 바로 지금까지 /pipeline이 공개돼 있던 이유다 — 안전한 기본값은 차단이다.
  if (!url || !anonKey) {
    // §20 — API는 리다이렉트가 아니라 401이어야 한다. 리다이렉트를 주면
    // fetch가 그걸 따라가서 로그인 페이지 HTML을 JSON으로 파싱하려다
    // "Unexpected token <"로 실패한다(원인이 인증이라는 게 안 보인다).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=auth-unavailable", request.url));
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // API는 리다이렉트가 아니라 401을 준다(§20) — fetch 호출부가 HTML
    // 로그인 페이지를 JSON으로 파싱하려다 실패하는 상황을 만들지 않는다.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    // 로그인 후 원래 보려던 화면으로 돌려보낸다.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

/**
 * matcher에서 빼는 것들:
 *  - _next/static, _next/image, favicon 등 정적 자산(모든 요청마다 Auth 서버를
 *    부르면 느려진다)
 *  - /api/cron: Vercel Cron이 Bearer 헤더로 호출한다(쿠키가 없다)
 *  - /api/debug: 자체 토큰(DEBUG_NAVIGATE_TOKEN)으로 이미 fail-closed다
 *  - /api/auth: 로그인/로그아웃 자체가 세션 없이 호출돼야 한다
 *  - /api/support/inquiries: 로그인 전 사용자도 문의를 넣을 수 있어야 한다
 *
 * 여기서 제외됐다고 "보호되지 않는다"는 뜻은 아니다 — 각 라우트가 자기
 * 인증 수단을 갖고 있다. 반대로 matcher에 포함된 API도 proxy의 401은
 * optimistic일 뿐이고, 최종 판단은 라우트 안의 requireUser()다.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|opengraph-image|api/cron|api/debug|api/auth|api/support|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
