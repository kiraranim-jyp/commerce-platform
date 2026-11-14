/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UX-CONSOLIDATION ①② — **셀러 화면에서 «도구»와 «내부 로드맵»을 뺀다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO 캡처(2026-11-14) — 화면 맨 아래에 ⒜ 쓰지 않는 「🔎 AI 검색으로 후보 찾기」
 *    ⒝ 내부 개발 로드맵 `BACKLOG` 가 떠 있었다.
 *
 * 🔴🔴 **삭제가 아니라 «노출 제거» 다** — 그래서 이 파일은 **부재와 보존을 «쌍으로»**
 *    단언한다(기능 소실을 부재 단언으로 덮지 않는다):
 * ```
 * ① 셀러 화면에 렌더되지 않는다        ← 제거 단언
 * ② 컴포넌트 파일은 그대로 살아 있다    ← 보존 단언
 * ③ 후보 조회/MI/가격 경로는 불변       ← 부작용 금지
 * ```
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PIPE = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(PIPE, p), "utf8").split(String.fromCharCode(13)).join("");
/** 🔴 주석을 벗기고 본다 — 이 리포가 여덟 번 밟은 함정이다(주석 속 예시가 통과시킨다). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const PAGE = strip(read("page.tsx"));
const WORKSPACE = strip(read("CommerceWorkspace.tsx"));

describe("UXC-① 🔎 AI 검색으로 후보 찾기 — 셀러 화면 노출 제거", () => {
  it("A-1 🔴 셀러 페이지가 그 영역을 **렌더하지 않는다**", () => {
    expect(PAGE, "🔴 북마크릿 도구가 셀러 화면에 되살아났다").not.toContain("<SmartSearchBookmarklet");
  });

  it("A-2 🟢 **삭제가 아니다** — 컴포넌트와 그 기능은 그대로 있다(되돌릴 수 있다)", () => {
    expect(existsSync(join(PIPE, "SmartSearchBookmarklet.tsx")), "🔴 컴포넌트 파일을 지웠다").toBe(true);
    const src = read("SmartSearchBookmarklet.tsx");
    expect(src, "🔴 컴포넌트 본문이 비었다").toContain("export function SmartSearchBookmarklet");
  });

  it("A-3 🔴 **후보 조회 경로에 부작용 0** — `candidateUrls` 입력 경계가 살아 있다", () => {
    /**
     * 🟢 북마크릿은 `candidateUrls` 로 들어오는 **생산자 하나** 일 뿐이고,
     *    그 입구는 `/check` 가 소유한다. 숨김이 그 경계를 건드리면 안 된다.
     */
    const CHECK = readFileSync(
      join(__dirname, "../../../api/price-history/check/route.ts"),
      "utf8",
    );
    expect(CHECK, "🔴 후보 URL 입력 경계가 사라졌다").toContain("candidateUrls");
  });
});

describe("UXC-② BACKLOG — 셀러 화면 노출 제거", () => {
  it("B-1 🔴 셀러 화면이 내부 로드맵을 **렌더하지 않는다**", () => {
    expect(WORKSPACE, "🔴 BACKLOG 가 셀러 화면에 되살아났다").not.toContain("<BacklogPanel");
  });

  it("B-2 🟢 **삭제가 아니다** — 목록은 그 파일에 그대로 있다", () => {
    const src = read("commerce/BacklogPanel.tsx");
    expect(src, "🔴 BacklogPanel 을 지웠다").toContain("BACKLOG_ITEMS");
  });

  it("B-3 🔴 **변경 이력(AuditLogPanel)은 같이 지우지 않았다** — 셀러의 기록이다", () => {
    expect(WORKSPACE, "🔴 셀러의 변경 이력까지 사라졌다").toContain("<AuditLogPanel");
  });

  it("B-4 🔴 로드맵 문구가 **다른 경로로** 셀러 화면에 새지 않는다", () => {
    for (const token of ["BACKLOG", "브랜드 추천 고도화", "카테고리 검색 고도화"]) {
      expect(WORKSPACE, `🔴 내부 로드맵 어휘가 셀러 화면에 남았다: ${token}`).not.toContain(token);
      expect(PAGE, `🔴 내부 로드맵 어휘가 셀러 화면에 남았다: ${token}`).not.toContain(token);
    }
  });
});
