import crypto from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";

/**
 * BETA-SECURITY-2 FINAL §3/§4(CPO 지시, 2026-09-07) — Admin "사용자 전환".
 *
 * 목적은 CS다. Admin이 특정 사용자의 실제 서비스 화면에 들어가서 상태를
 * 확인할 수 있어야 한다. 비밀번호를 알아내거나 바꿔서 로그인하는 방식이
 * 아니다(§4 명시).
 *
 * ── 설계에서 가장 중요한 판단 ───────────────────────────────────────────
 * 대상 사용자의 진짜 Supabase 세션을 발급하지 않는다.
 *
 * service_role은 임의 사용자의 access token을 만들 수 있지만, 그렇게 하면
 * 관리 기능 하나가 사실상 "모든 계정 탈취 도구"가 된다. 그 토큰이 로그나
 * 브라우저에 남으면 Admin 세션이 끝난 뒤에도 계속 유효하다.
 *
 * 대신 ADMIN_SESSION_SECRET으로 서명한 별도 쿠키 하나만 쓴다. 이 쿠키는
 * 그 자체로는 아무 권한이 없다 — 유효한 Admin 세션 쿠키가 함께 있을 때만
 * 의미를 갖는다(readImpersonation이 매번 둘 다 검사한다). 그래서:
 *   - Admin이 로그아웃하면 전환도 즉시 끝난다.
 *   - 쿠키만 훔쳐도 Admin 세션이 없으면 쓸 수 없다.
 *   - 대상 사용자의 자격증명은 어디에도 만들어지지 않는다.
 *
 * 클라이언트가 보낸 userId를 그대로 믿지 않는다(§4) — 전환을 시작할 때
 * 서버가 Admin 인증과 대상 사용자 존재를 확인한 뒤 서명해서 넣는다.
 */
export const IMPERSONATION_COOKIE = "admin_impersonation";

/** Admin 세션(24시간)보다 짧게 둔다 — CS 목적의 일시적 전환이지 상주
 * 상태가 아니다. 만료되면 자동으로 Admin 자신으로 돌아간다. */
const IMPERSONATION_TTL_MS = 60 * 60 * 1000; // 1시간

function getSecret(): string | null {
  return process.env.ADMIN_SESSION_SECRET ?? null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** `${targetUserId}.${expiresAt}.${서명}` */
export function createImpersonationToken(targetUserId: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const expiresAt = Date.now() + IMPERSONATION_TTL_MS;
  const payload = `${targetUserId}.${expiresAt}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** 쿠키 저장소가 아니라 토큰 문자열을 직접 받는다 — proxy는 next/headers의
 * cookies()가 아니라 request.cookies를 쓰므로 이 형태가 필요하다. */
export function verifyImpersonationToken(token: string | undefined | null): string | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [targetUserId, expiresAtRaw, signature] = parts;
  if (!targetUserId || !expiresAtRaw || !signature) return null;

  const expected = sign(`${targetUserId}.${expiresAtRaw}`, secret);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return null;
  return targetUserId;
}

export interface ImpersonationContext {
  /** 전환 대상 사용자 id — 이 요청 동안 "사용자"로 취급되는 쪽. */
  targetUserId: string;
}

/**
 * 지금 요청이 Admin의 사용자 전환 상태인지 판단한다.
 *
 * 두 조건을 모두 만족해야 한다:
 *   ① 유효한 Admin 세션 쿠키 (실제 행위자가 Admin임)
 *   ② 유효한 서명 + 미만료 impersonation 쿠키 (전환 대상이 정해짐)
 *
 * 하나라도 없으면 null이고, 호출부는 평소대로 Supabase 세션을 본다.
 * ①을 빼먹으면 서명 쿠키만 가진 사람이 아무 계정이나 될 수 있다 —
 * 이 함수에서 가장 중요한 줄이다.
 */
export async function readImpersonation(): Promise<ImpersonationContext | null> {
  const cookieStore = await cookies();

  const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifySessionToken(adminToken)) return null;

  const targetUserId = verifyImpersonationToken(cookieStore.get(IMPERSONATION_COOKIE)?.value);
  if (!targetUserId) return null;

  return { targetUserId };
}
