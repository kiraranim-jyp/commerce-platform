import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";

// admin-auth.ts가 node:crypto(timingSafeEqual/createHmac)를 쓰므로 Edge가 아니라
// Node.js 런타임에서 미들웨어를 실행해야 한다.
export const runtime = "nodejs";

/**
 * 관리자 문의 게시판 접근을 막는다 — /admin/login과 /api/admin/login/logout은
 * 로그인 자체를 하려면 필요하니 예외로 둔다. 세션 쿠키 검증은 미들웨어(엣지)에서
 * 순수 HMAC 계산만 하므로 DB 조회 없이 빠르다.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isExempt =
    pathname === "/admin/login" ||
    pathname === "/api/admin/login" ||
    pathname === "/api/admin/logout";
  if (isExempt) return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (verifySessionToken(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }
  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
