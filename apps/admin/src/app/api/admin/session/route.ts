import { NextResponse } from "next/server";

/**
 * CS-OBSERVABILITY-1.2(CPO 지시, 2026-09-11) — "지금 관리자인가"를 화면이 물어보는 곳.
 *
 * 판정은 여기서 하지 않는다. `/api/admin/*`은 proxy가 관리자 세션 쿠키(HMAC 서명)를
 * 검증해서 통과시키므로, **이 응답에 도달했다는 사실 자체가 관리자라는 뜻**이다.
 * 관리자가 아니면 proxy가 401로 끊어서 이 코드는 실행되지도 않는다.
 *
 * 그래서 클라이언트가 "나 관리자야"라고 주장할 여지가 없다 — 화면은 이 요청의
 * 성공/실패만 보고 메뉴를 결정하고, 실제 접근 통제는 계속 proxy가 한다.
 * 메뉴를 숨기는 것은 UX이지 권한이 아니며, 숨기지 않아도 경로는 막혀 있다.
 *
 * 세션 정보를 돌려주지 않는다 — 토큰·만료·서명은 응답에 담지 않는다.
 */
export async function GET() {
  return NextResponse.json({ ok: true, isAdmin: true });
}
