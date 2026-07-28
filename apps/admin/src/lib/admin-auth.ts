import crypto from "node:crypto";

/**
 * 관리자(문의 게시판) 세션 — 별도 세션 저장소(DB/Redis) 없이 HMAC 서명된 쿠키
 * 하나로 처리한다. 쿠키 값은 `${만료timestamp}.${서명}` 형태이고, 서명은
 * ADMIN_SESSION_SECRET으로 만든다 — 이 값이 없으면(로컬/미설정 환경) 세션을
 * 아예 발급하지 않는다(안전 기본값: 인증 기능 자체가 꺼진 것처럼 동작).
 *
 * 자격 증명(ADMIN_USERNAME/ADMIN_PASSWORD)은 코드에 절대 하드코딩하지 않고
 * Vercel 환경변수(Sensitive)로만 관리한다 — 이미 이 프로젝트의 COUPANG_SECRET_KEY,
 * DEBUG_NAVIGATE_TOKEN과 같은 패턴이다.
 */
export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

function getSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) return false;
  // 타이밍 공격 방지 — 길이가 다르면 timingSafeEqual이 바로 throw하므로 먼저 맞춘다.
  const usernameOk =
    username.length === expectedUsername.length &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(expectedUsername));
  const passwordOk =
    password.length === expectedPassword.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword));
  return usernameOk && passwordOk;
}

export function createSessionToken(): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  const secret = getSecret();
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}
