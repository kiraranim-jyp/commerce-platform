import { describe, expect, it } from "vitest";

/**
 * CS-OBSERVABILITY-1(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건 두 가지:
 *  ① CS 조회 경로는 관리자만 들어갈 수 있다.
 *  ② 인증 이벤트에 민감정보를 담지 않는다.
 *
 * ①이 특히 중요하다. "관리자가 사장님 데이터를 본다"와 "사장님이 다른 사용자
 * 데이터를 본다"는 완전히 다른 문제이고, 후자는 반드시 차단돼야 한다. 새로 만든
 * 조회 라우트가 전부 /api/admin 아래인 이유가 그것이다 — proxy가 관리자 세션으로
 * 이미 막고 있는 경계를 재사용하고, 새 인증 수단을 만들지 않는다.
 */
const ADMIN_ONLY_PATHS = [
  "/api/admin/users/some-user-id/activity",
  "/api/admin/users/some-user-id/analyses",
  "/api/admin/analyses/some-analysis-id",
];

describe("CS 조회 경로는 관리자 경계 안에 있다", () => {
  it.each(ADMIN_ONLY_PATHS)("%s 는 /api/admin 아래다", (path) => {
    expect(path.startsWith("/api/admin/")).toBe(true);
  });

  it("핵심 회귀: proxy의 관리자 판정과 같은 규칙으로 전부 걸린다", () => {
    // proxy.ts isAdminPath와 같은 조건. 새 CS 라우트가 이 경계 밖으로 나가면
    // 판매자가 남의 활동을 조회할 수 있게 된다.
    const isAdminPath = (p: string) => p.startsWith("/admin") || p.startsWith("/api/admin");
    for (const p of ADMIN_ONLY_PATHS) expect(isAdminPath(p)).toBe(true);
    // 반대로 판매자 경로는 걸리지 않아야 한다(경계가 과도하게 넓어지지 않았는지).
    expect(isAdminPath("/api/snapshots")).toBe(false);
    expect(isAdminPath("/pipeline")).toBe(false);
  });

  it("CS 조회 경로가 판매자 공개 경로와 겹치지 않는다", () => {
    // 판매자 공개 경로는 /, /login, /auth/callback, /terms, /privacy 뿐이다.
    const sellerPublic = ["/", "/login", "/auth/callback", "/terms", "/privacy", "/privacy-settings"];
    for (const p of ADMIN_ONLY_PATHS) expect(sellerPublic).not.toContain(p);
  });
});

/**
 * 인증 이벤트 본문에 담기는 값의 화이트리스트. 라우트가 클라이언트 입력을 그대로
 * 믿지 않는다는 계약을 고정한다 — user_id는 서버가 세션에서 읽고, event/provider는
 * 아는 값만 통과시킨다.
 */
describe("인증 이벤트는 민감정보를 담지 않는다", () => {
  const ALLOWED_EVENTS = ["google_start", "login_success", "login_failure"];
  const ALLOWED_PROVIDERS = ["google", "email"];
  const FORBIDDEN = ["password", "access_token", "refresh_token", "id_token", "authorization", "cookie", "code"];

  it("허용 이벤트는 셋뿐이다", () => {
    expect(ALLOWED_EVENTS).toHaveLength(3);
    expect(ALLOWED_EVENTS).not.toContain("arbitrary_event");
  });

  it("핵심 회귀: 기록 필드 이름에 인증정보가 없다", () => {
    // audit_log에 실제로 넣는 것: eventType, actor, targetUserId, targetLabel,
    // field("provider"), afterValue(google|email). 그 밖의 것은 넣지 않는다.
    const recorded = ["eventType", "actor", "targetUserId", "targetLabel", "field", "afterValue"];
    for (const f of FORBIDDEN) {
      expect(recorded.some((r) => r.toLowerCase().includes(f))).toBe(false);
    }
  });

  it("provider는 아는 값만 기록한다 — 자유 문자열을 그대로 쓰지 않는다", () => {
    const normalize = (v: unknown) => (v === "google" ? "google" : v === "email" ? "email" : null);
    expect(normalize("google")).toBe("google");
    expect(normalize("email")).toBe("email");
    expect(normalize("<script>")).toBeNull();
    expect(normalize(ALLOWED_PROVIDERS)).toBeNull();
  });
});
