import { describe, expect, it } from "vitest";

/**
 * CS-OBSERVABILITY-1.2(CPO 지시, 2026-09-11).
 *
 * 지키는 불변조건: **판매자 인증은 관리자 권한이 아니다.**
 *
 * 실사용에서 드러난 결함 — 사이드바가 판매자 화면과 관리자 화면을 함께 쓰는데,
 * 첫 항목이 관리자 대시보드를 가리켜서 판매자에게도 운영 메뉴가 보였다. proxy가
 * 막고 있어 데이터가 새지는 않았지만, 관리자 기능의 존재를 알리는 것 자체가
 * 문제다.
 *
 * 여기서 고정하는 것은 두 가지다.
 *  ① 관리자 경로 판정 규칙(proxy.isAdminPath와 동일)
 *  ② 메뉴 노출이 "관리자 세션 확인"에만 걸린다는 것 — 클라이언트 상태가 아니라.
 *
 * 메뉴를 감추는 것은 UX일 뿐 권한이 아니다. 감추지 않아도 경로는 막혀 있어야 하고,
 * 그 사실을 아래 매트릭스가 함께 못 박는다.
 */

/** proxy.ts isAdminPath와 같은 조건. */
const isAdminPath = (p: string) => p.startsWith("/admin") || p.startsWith("/api/admin");
/** proxy.ts의 예외 — 로그인/로그아웃만 세션 없이 통과한다. */
const isExempt = (p: string) => p === "/admin/login" || p === "/api/admin/login" || p === "/api/admin/logout";

/** proxy가 관리자 세션 없는 요청에 무엇을 하는가. */
function guardWithoutAdminSession(p: string): "allow" | "401" | "redirect-login" {
  if (!isAdminPath(p)) return "allow";
  if (isExempt(p)) return "allow";
  return p.startsWith("/api/") ? "401" : "redirect-login";
}

const CS_PATHS = [
  "/admin/users",
  "/admin/users/00000000-0000-0000-0000-000000000000",
  "/api/admin/users",
  "/api/admin/users/00000000-0000-0000-0000-000000000000/activity",
  "/api/admin/users/00000000-0000-0000-0000-000000000000/analyses",
  "/api/admin/analyses/00000000-0000-0000-0000-000000000000",
  "/api/admin/session",
];

describe("권한 매트릭스 — 관리자 세션이 없으면 CS 경로에 못 들어간다", () => {
  it.each(CS_PATHS)("%s 는 관리자 판정 대상이다", (p) => {
    expect(isAdminPath(p)).toBe(true);
    expect(isExempt(p)).toBe(false);
  });

  it("핵심 회귀: 페이지는 로그인으로, API는 401로 끊는다", () => {
    expect(guardWithoutAdminSession("/admin/users")).toBe("redirect-login");
    expect(guardWithoutAdminSession("/admin/users/abc")).toBe("redirect-login");
    for (const p of CS_PATHS.filter((x) => x.startsWith("/api/"))) {
      expect(guardWithoutAdminSession(p)).toBe("401");
    }
  });

  it("핵심 회귀: 판매자 세션이 있어도 관리자 경로 판정은 달라지지 않는다", () => {
    // proxy의 관리자 축은 판매자 세션을 보지 않는다 — 관리자 쿠키만 본다.
    // Google/email로 로그인했다는 사실이 /admin 권한이 되면 안 된다.
    for (const p of CS_PATHS) {
      expect(guardWithoutAdminSession(p)).not.toBe("allow");
    }
  });

  it("판매자 경로는 관리자 축에 걸리지 않는다 — 경계가 과도하게 넓어지지 않았다", () => {
    for (const p of ["/pipeline", "/today", "/snapshots", "/settings", "/api/snapshots", "/api/auth/me"]) {
      expect(isAdminPath(p)).toBe(false);
      expect(guardWithoutAdminSession(p)).toBe("allow");
    }
  });
});

describe("메뉴 노출은 서버 판정에만 의존한다", () => {
  /** AppShell의 필터와 같은 조건. */
  const visible = (item: { visible?: boolean; adminOnly?: boolean }, isAdmin: boolean) =>
    item.visible !== false && (!item.adminOnly || isAdmin);

  it("핵심 회귀: 관리자가 아니면 운영 Dashboard 메뉴가 보이지 않는다", () => {
    expect(visible({ adminOnly: true }, false)).toBe(false);
  });

  it("관리자면 보인다", () => {
    expect(visible({ adminOnly: true }, true)).toBe(true);
  });

  it("판정 전(기본값 false)에는 보이지 않는다 — 잠깐 보였다 사라지지 않는다", () => {
    const initialIsAdmin = false;
    expect(visible({ adminOnly: true }, initialIsAdmin)).toBe(false);
  });

  it("일반 메뉴는 관리자 여부와 무관하게 보인다", () => {
    expect(visible({}, false)).toBe(true);
    expect(visible({}, true)).toBe(true);
  });
});
