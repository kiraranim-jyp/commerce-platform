import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BETA-SECURITY-2 FINAL §4(CPO 지시, 2026-09-07) — 사용자 전환의 보안 경계.
 *
 * 여기서 지키는 핵심 불변조건:
 *   "전환 쿠키만으로는 아무것도 할 수 없다. 유효한 Admin 세션이 함께 있어야
 *    한다."
 *
 * 이게 깨지면 서명 쿠키 하나를 얻은 사람이 임의 계정 화면에 들어갈 수 있다.
 * §4의 "일반 사용자는 impersonation 불가", "client가 전달한 userId만으로
 * 전환 불가"가 코드로 성립하는지 확인한다.
 */

const SECRET = "test-secret-for-impersonation";
const TARGET = "target-user-id";

let cookieJar: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar[name] ? { value: cookieJar[name] } : undefined),
  }),
}));

describe("BETA-SECURITY-2 FINAL §4 — 사용자 전환 경계", () => {
  beforeEach(() => {
    vi.resetModules();
    cookieJar = {};
    process.env.ADMIN_SESSION_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
  });

  /** 실제 admin-auth와 동일한 방식으로 유효한 Admin 세션 쿠키를 만든다. */
  async function validAdminCookie(): Promise<string> {
    const { createSessionToken } = await import("../admin-auth");
    const token = createSessionToken();
    if (!token) throw new Error("admin 토큰 생성 실패");
    return token;
  }

  it("Admin 세션 + 유효한 전환 쿠키 → 전환이 인정된다", async () => {
    const { createImpersonationToken, readImpersonation, IMPERSONATION_COOKIE } = await import(
      "../auth/impersonation"
    );
    const { ADMIN_SESSION_COOKIE } = await import("../admin-auth");

    cookieJar[ADMIN_SESSION_COOKIE] = await validAdminCookie();
    cookieJar[IMPERSONATION_COOKIE] = createImpersonationToken(TARGET)!;

    const result = await readImpersonation();
    expect(result?.targetUserId).toBe(TARGET);
  });

  it("핵심 — Admin 세션 없이 전환 쿠키만 있으면 무효다", async () => {
    const { createImpersonationToken, readImpersonation, IMPERSONATION_COOKIE } = await import(
      "../auth/impersonation"
    );
    // 전환 쿠키는 정상 서명이지만 Admin 세션이 없다.
    cookieJar[IMPERSONATION_COOKIE] = createImpersonationToken(TARGET)!;

    expect(await readImpersonation()).toBeNull();
  });

  it("Admin이 로그아웃하면(세션 쿠키 제거) 전환도 즉시 끝난다", async () => {
    const { createImpersonationToken, readImpersonation, IMPERSONATION_COOKIE } = await import(
      "../auth/impersonation"
    );
    const { ADMIN_SESSION_COOKIE } = await import("../admin-auth");

    cookieJar[ADMIN_SESSION_COOKIE] = await validAdminCookie();
    cookieJar[IMPERSONATION_COOKIE] = createImpersonationToken(TARGET)!;
    expect(await readImpersonation()).not.toBeNull();

    delete cookieJar[ADMIN_SESSION_COOKIE];
    expect(await readImpersonation()).toBeNull();
  });

  it("서명을 위조한 전환 쿠키는 거부된다 — userId를 손으로 바꿔 넣을 수 없다", async () => {
    const { readImpersonation, IMPERSONATION_COOKIE } = await import("../auth/impersonation");
    const { ADMIN_SESSION_COOKIE } = await import("../admin-auth");

    cookieJar[ADMIN_SESSION_COOKIE] = await validAdminCookie();
    // 서명 자리를 아무 값으로 채운다(길이는 sha256 hex와 동일하게 맞춤).
    cookieJar[IMPERSONATION_COOKIE] = `victim-user.${Date.now() + 60_000}.${"a".repeat(64)}`;

    expect(await readImpersonation()).toBeNull();
  });

  it("다른 비밀키로 만든 전환 쿠키는 거부된다", async () => {
    const { createImpersonationToken } = await import("../auth/impersonation");
    const forged = createImpersonationToken(TARGET)!;

    // 서버 비밀키가 바뀌면 기존 토큰은 더 이상 유효하지 않아야 한다.
    vi.resetModules();
    process.env.ADMIN_SESSION_SECRET = "completely-different-secret";
    const { readImpersonation, IMPERSONATION_COOKIE } = await import("../auth/impersonation");
    const { ADMIN_SESSION_COOKIE, createSessionToken } = await import("../admin-auth");

    cookieJar[ADMIN_SESSION_COOKIE] = createSessionToken()!;
    cookieJar[IMPERSONATION_COOKIE] = forged;

    expect(await readImpersonation()).toBeNull();
  });

  it("만료된 전환 쿠키는 거부된다 — 전환은 영구 상태가 아니다", async () => {
    const { readImpersonation, IMPERSONATION_COOKIE } = await import("../auth/impersonation");
    const { ADMIN_SESSION_COOKIE } = await import("../admin-auth");
    const crypto = await import("node:crypto");

    const expired = Date.now() - 1000;
    const payload = `${TARGET}.${expired}`;
    const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");

    cookieJar[ADMIN_SESSION_COOKIE] = await validAdminCookie();
    cookieJar[IMPERSONATION_COOKIE] = `${payload}.${sig}`;

    expect(await readImpersonation()).toBeNull();
  });

  it("ADMIN_SESSION_SECRET이 없으면 전환 토큰을 아예 발급하지 않는다", async () => {
    vi.resetModules();
    delete process.env.ADMIN_SESSION_SECRET;
    const { createImpersonationToken } = await import("../auth/impersonation");
    expect(createImpersonationToken(TARGET)).toBeNull();
  });
});
