import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createSessionToken, verifyCredentials } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  if (!body?.username || !body?.password) {
    return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
  }

  if (!verifyCredentials(body.username, body.password)) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = createSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "관리자 로그인이 아직 설정되지 않았습니다(ADMIN_SESSION_SECRET 미설정)." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
