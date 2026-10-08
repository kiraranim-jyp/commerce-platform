import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CRAWLER_USER_AGENT } from "../utils/user-agent";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.5-B(CPO 승인, 2026-10-08) — **UA 는 한 벌이고, 브라우저도 그것을 보낸다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 단일 변수 실험(STMMLS · Accept 계열은 양쪽 모두 비움으로 통제):
 *     A UA 미설정(HeadlessChrome) → 406 ·      20B · offers 0
 *     B UA 만 설정                → 200 · 185,047B · offers 5
 *
 * 반영 후 실제 경로 재측정:
 *     tennis STMMLS  200 · offers 5 · 사이즈 [S,M,L,XL,XXL] · variants 5
 *     tennis STMFTP  200 · offers 5 · 사이즈 [S,M,L,XL,XXL] · variants 5
 *     smallable      403 → 200 (브라우저 경로가 열렸다 — 옵션은 별 사안)
 *
 * 🔴 이 파일은 «복제되지 않음» 과 «브라우저가 그 UA 를 쓴다» 를 잠근다.
 *    실제 HTTP 결과는 외부 사이트에 의존하므로 단위 테스트로 고정하지 않는다.
 */
function src(rel: string): string {
  return readFileSync(path.join(__dirname, "..", rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("🔴🔴 UA 문자열이 한 곳에만 있다", () => {
  it("상수가 Chrome UA 다 — HeadlessChrome 이 아니다", () => {
    expect(CRAWLER_USER_AGENT).toContain("Chrome/120.0.0.0");
    expect(CRAWLER_USER_AGENT).not.toContain("HeadlessChrome");
  });

  it("🔴 UA 문자열이 다른 파일에 «복제되지 않았다»", () => {
    for (const f of [
      "browser-launcher.ts",
      "comparison-search/littleluna.ts",
      "comparison-search/product-url-facts.ts",
      "discovery-benchmark/live-page-probe.ts",
    ]) {
      expect(src(f), `${f} 에 UA 가 복제됐다`).not.toContain("Chrome/120.0.0.0 Safari/537.36");
      expect(src(f), `${f} 가 공용 상수를 쓰지 않는다`).toContain("CRAWLER_USER_AGENT");
    }
  });
});

describe("🔴🔴 브라우저가 그 UA 를 보낸다", () => {
  const launcher = () => src("browser-launcher.ts");

  it("두 실행 경로 «모두» UA 를 설정한다 — 로컬에서만 되는 상태를 만들지 않는다", () => {
    const hits = launcher().match(/--user-agent=\$\{CRAWLER_USER_AGENT\}/g) ?? [];
    expect(hits.length, "serverless/로컬 중 한 쪽만 설정했다").toBe(2);
  });

  it("🔴 serverless 는 기존 args 를 «버리지 않는다» — chromium 바이너리 인자가 필요하다", () => {
    expect(launcher()).toContain("...chromiumBinary.args");
  });

  it("🔴 Accept 계열은 건드리지 않았다 — 원인이 아님이 측정됐다", () => {
    for (const h of ["accept-language", "Accept-Language", "accept-encoding", "Accept-Encoding"]) {
      expect(launcher(), `UA 외 헤더(${h})를 손댔다`).not.toContain(h);
    }
  });
});
