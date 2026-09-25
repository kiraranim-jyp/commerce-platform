import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14-3 — **수정 화면에 기준값을 내려주는 라우트**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 셋:
 *   ① 상품번호를 «받지» 않는다 — 서버가 찾는다(F-12b: 섞이면 남의 상품을 고친다).
 *   ② 읽기에도 «같은 게이트» 가 선다 — 네이버 자격증명은 전역 싱글턴이다.
 *   ③ 읽지 못한 것을 빈 기준값으로 내려보내지 않는다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = codeOnly(readFileSync(join(__dirname, "../registered-product/route.ts"), "utf8"));

describe("① 🔴 상품번호를 받지 않는다 — 서버가 찾는다", () => {
  it("쿼리에서 읽는 것은 snapshotId 하나뿐이다", () => {
    expect(ROUTE).toContain('searchParams.get("snapshotId")');
    for (const forbidden of ["externalProductId", "originProductNo", "productId"]) {
      expect(ROUTE, `상품번호를 쿼리로 받았다: ${forbidden}`).not.toContain(`searchParams.get("${forbidden}")`);
    }
  });

  it("번호는 channel_products 에서 온다", () => {
    expect(ROUTE).toContain('findChannelProductBySnapshot(snapshotId, "smartstore")');
    expect(ROUTE).toContain("link.externalProductId");
  });

  it("🔴 연결이 없으면 채널을 부르지 않는다", () => {
    const iLink = ROUTE.indexOf("if (!link) {");
    const iToken = ROUTE.indexOf("issueNaverAccessToken(");
    const iFetch = ROUTE.indexOf("fetchRegisteredProduct(");
    expect(iLink).toBeGreaterThan(-1);
    expect(iLink).toBeLessThan(iToken);
    expect(iLink).toBeLessThan(iFetch);
    const gate = ROUTE.slice(iLink, iToken);
    expect(gate).toContain("NOT_LINKED");
    expect(gate).toContain("return NextResponse.json(");
  });
});

describe("② 🔴 읽기에도 같은 게이트가 선다", () => {
  it("등록 라우트 3개와 «같은 함수» 를 쓴다", () => {
    expect(ROUTE).toContain("requireRegistrationAccess(snapshotId)");
    expect(ROUTE).toContain("if (!access.ok) return access.response;");
  });

  it("🔴 게이트가 자격증명을 «쓰기 전» 에 있다", () => {
    const iGate = ROUTE.indexOf("requireRegistrationAccess(");
    for (const use of ["getNaverCredentials(", "issueNaverAccessToken(", "fetchRegisteredProduct("]) {
      expect(iGate, `${use} 가 게이트보다 먼저다`).toBeLessThan(ROUTE.indexOf(use));
    }
  });

  it("🔴 연결 조회도 게이트 뒤다 — 남의 연결을 읽어 보지 않는다", () => {
    expect(ROUTE.indexOf("requireRegistrationAccess(")).toBeLessThan(
      ROUTE.indexOf("findChannelProductBySnapshot("),
    );
  });
});

describe("③ 🔴 읽지 못한 것을 값으로 만들지 않는다", () => {
  it("GET 실패 → 기준값을 만들지 않는다", () => {
    const iFail = ROUTE.indexOf("if (!fetched.ok) {");
    const iBuild = ROUTE.indexOf("buildChannelEditModel(");
    expect(iFail).toBeGreaterThan(-1);
    expect(iFail).toBeLessThan(iBuild);
    const gate = ROUTE.slice(iFail, iBuild);
    expect(gate).toContain("FETCH_FAILED");
    expect(gate).not.toContain("buildChannelEditModel");
  });

  it("기준값은 «채널 GET» 출처로만 만든다", () => {
    expect(ROUTE).toContain('kind: "CHANNEL_GET"');
    expect(ROUTE).toContain("fetched.snapshot");
  });

  it("🔴 성공 응답에 필드 목록을 «같이» 싣지 않는다 — 두 번째 진실이 없다", () => {
    const success = ROUTE.slice(ROUTE.indexOf("ok: true, model:"));
    expect(success).toContain("model: built.model");
    expect(ROUTE).not.toContain("editorFieldSchema");
  });

  it("이 라우트는 lifecycle 을 «정하지» 않는다", () => {
    expect(ROUTE).not.toContain("resolveLifecycle");
    expect(ROUTE).not.toContain("updateRegisteredProduct");
    /* 🔴 읽기 전용이다 — PUT/POST 를 내보내지 않는다. */
    expect(ROUTE).not.toContain('method: "PUT"');
    expect(ROUTE).not.toContain("export async function POST");
  });
});
