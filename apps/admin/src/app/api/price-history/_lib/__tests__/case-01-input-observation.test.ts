/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CASE-01 — **탈락 관측 계약**(영구) + **임시 계측 제거 계약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 **실행단위 1 의 임시 계측(`[CASE-01-INPUT]`)은 제거됐다** — 할 일을 끝냈다.
 *    CASE-01 의 원인이 ①공급이 아니라 **②수집** 으로 확정됐다: `global.trenbe.com` 이
 *    운영 `CHROME_UA` 에 **HTTP 429** 를 주고, 도메인 limiter 의 429 backoff 재시도가
 *    **10초 타임아웃을 넘겨** `TimeoutError` → `UNREACHABLE` 이 된다.
 *    🔴 **MI 매칭 결함이 아니었다.**
 *
 * 🔴 이 파일에 남는 것은 **영구 가치가 있는 둘** 이다:
 * ```
 * A  `[CASE-01-INPUT]` 이 **되살아나지 않는다**(라우트는 관측·판정을 소유하지 않는다)
 * B  주경로 탈락이 **host:reason** 으로 적힌다 — 형제 생산자와 «같은 모양»
 * ```
 * 🟢 실패 «사유» 보존 계약은 `case-01-fetch-failure-reason.test.ts` 가 소유한다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROUTE = path.join(process.cwd(), "src", "app", "api", "price-history", "check", "route.ts");
/** 🔴 주석을 벗긴다 — 주석 속 예시가 「구현됐다」로 세어지는 함정(이 트랙이 여덟 번 걸렸다). */
const bare = () =>
  readFileSync(ROUTE, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/**
 * 🔴🔴🔴 **임시 계측이 되살아나지 않는다.**
 *
 * 그 로그는 ①(브라우저 AI Search 원문)의 공백을 메우는 **임시 수단** 이었고, 원인이
 * ②로 확정된 뒤에는 **고객 요청마다 운영 로그에 한 줄을 더 남기는 비용** 만 남는다.
 * 🔴 그리고 이 라우트는 **판정을 하지 않는다** — 입력 경계는 pool 이 소유한다(`wu-024`).
 */
describe("CASE-01 — 임시 입력 계측이 제거된 상태", () => {
  it("A-1 🔴🔴 `[CASE-01-INPUT]` 이 **코드에 없다**(주석 기록은 허용)", () => {
    expect(bare(), "🔴 임시 계측이 되살아났다").not.toContain("[CASE-01-INPUT]");
  });

  it("A-2 🔴 라우트가 후보 URL 을 **세지도 분류하지도 않는다**", () => {
    const src = bare();
    for (const banned of ["classifyUrlShape", "PRODUCT_PAGE", "LISTING_PAGE", "hosts.size"]) {
      expect(src, `🔴 ${banned} — 입력 경계는 pool 이 소유한다`).not.toContain(banned);
    }
  });

  /** 🟢 제거가 **입력 경계 자체** 를 건드리지 않았음을 같이 잠근다(보존 단언). */
  it("A-3 🟢 `candidateUrls` 정규화와 상한은 **그대로** 다", () => {
    const src = bare();
    expect(src).toContain("candidateUrls = body.candidateUrls");
    expect(src).toContain("MAX_CANDIDATE_URL_PAYLOAD");
    expect(src).toContain("MAX_CANDIDATE_URL_LENGTH");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CASE-01 실행단위 2 — **탈락은 «어디서» 났는지와 함께 적는다**(영구)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `__url_candidates__` 가 CASE-01 의 **주경로** 다(브라우저 AI Search → candidateUrls).
 *    그 풀의 탈락 로그가 **`reason` 만** 이라 「국내가 빠졌나 해외가 빠졌나」를 **가를 수
 *    없었다** ⟹ 「국내 소싱 후보 0」의 원인이 ②인지 ③인지 구조적으로 미측정이었다.
 * 🟢 형제 생산자 `[SP07-pool]` 은 처음부터 `host:reason` 을 찍고 있었다 — 같은 모양으로 맞췄다.
 * 🔴 이 계약은 **두 생산자를 같이** 본다. 한쪽만 되돌리면 FAIL 한다.
 */
describe("CASE-01 실행단위 2 — 탈락 관측의 모양", () => {
  const RUNNER = path.join(
    process.cwd(),
    "src", "app", "api", "price-history", "_lib", "run-domestic-price-check.ts",
  );
  const runner = () =>
    readFileSync(RUNNER, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  /** 🟢 주경로와 형제 생산자가 **둘 다** host 를 붙인다. */
  it.each([
    ["[WU-024-urlpool]", "__url_candidates__ — CASE-01 주경로"],
    ["[SP07-pool]", "__web_search__ — 형제 생산자"],
  ])("B-1 %s 의 dropped 가 **host 와 함께** 적힌다 (%s)", (tag) => {
    const src = runner();
    const at = src.indexOf(tag);
    expect(at, `🔴 ${tag} 로그가 사라졌다`).toBeGreaterThan(0);
    const end = src.indexOf("})}", at);
    const seg = src.slice(at, end > at ? end : at + 2500);
    expect(seg, `🔴 ${tag} 이 dropped 를 안 적는다`).toContain("dropped:");
    expect(seg, `🔴 ${tag} 이 host 없이 reason 만 적는다 — 원인이 안 갈린다`).toContain(
      "new URL(d.url).hostname",
    );
    expect(seg).toContain("${host}:${d.reason}");
  });

  /** 🔴🔴 URL 원문을 로그에 싣지 않는다 — host 까지다. */
  it("B-2 🔴🔴 dropped 에 **URL 원문을 그대로 싣지 않는다**", () => {
    const src = runner();
    const at = src.indexOf("[WU-024-urlpool]");
    const end = src.indexOf("})}", at);
    const seg = src.slice(at, end);
    expect(seg, "🔴 d.url 을 그대로 내보내고 있다").not.toMatch(/=>\s*d\.url\b/);
    expect(seg).not.toContain("d.url}:");
  });

  /** 🔴 파싱 실패를 **조용히 버리지 않는다** — 그것도 관측값이다. */
  it("B-3 🔴 파싱 실패한 URL 을 탈락 목록에서 **지우지 않는다**", () => {
    const src = runner();
    const at = src.indexOf("[WU-024-urlpool]");
    const end = src.indexOf("})}", at);
    const seg = src.slice(at, end);
    const c = seg.slice(seg.indexOf("} catch {"));
    expect(seg).toContain("let host = d.url;");
    expect(c.slice(0, 160), "🔴 catch 에서 걸러내면 분모가 줄어든다").not.toContain("return null");
  });
});
