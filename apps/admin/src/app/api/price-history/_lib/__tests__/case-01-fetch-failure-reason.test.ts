/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CASE-01 실행단위 4 — **수집 실패 사유 보존 계약**(네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 확정된 원인: `global.trenbe.com` 이 운영 `CHROME_UA` 에 **HTTP 429** 를 준다
 *    (UA 없이는 200 · 690KB · 582ms · 실측 2026-11-18). limiter 가 429 backoff 를
 *    반복하고(65초) 끝내 `null` → 호출부가 `UNREACHABLE` 을 적었다. 국내 상세 URL ·
 *    품번 · JSON-LD 를 다 갖춘 후보가 **MI 판정에 도달하지 못한** 이유다.
 *
 * 🔴 이 계약이 잠그는 것은 **둘** 이다 — ⒜ 사유를 삼키지 않는다 ⒝ 차단을 «우회» 하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.join(
  process.cwd(), "..", "..", "packages", "crawler", "src", "shopify-product-json.ts",
);
/** 🔴 주석을 벗긴다 — 주석 속 설명이 「구현됐다」로 세어지는 함정. */
const bare = () =>
  readFileSync(SRC, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("CASE-01 실행단위 4 — fetch 실패 사유", () => {
  /**
   * 🔴 **대상 함수로 한정한다.** 이 파일에는 조용한 `catch` 가 **여섯 자리** 더 있고
   *    (`:35 :264 :384 :392 :556 :564`) 여럿은 **보강용 best-effort** 라 실패가 정상
   *    경로다. 🔴 CASE-01 의 범위는 **`fetchPlainHtmlWithFinalUrl` 하나** 다 — 여기서
   *    범위를 넓히면 WU 가 끝없이 커진다(§4 「관련 없는 리팩터 금지」).
   *    🟢 C-1 이 **처음에 그 여섯을 잡아 FAIL** 했다 — 가드가 범위를 알려 준 것이다.
   */
  it("C-1 🔴🔴 대상 함수의 `catch` 가 사유를 **삼키지 않는다**", () => {
    const src = bare();
    const at = src.indexOf("export async function fetchPlainHtmlWithFinalUrl");
    expect(at, "🔴 대상 함수가 사라졌다").toBeGreaterThan(0);
    const seg = src.slice(at, src.indexOf("function recordPlainHtmlFailure"));
    expect(seg, "🔴 빈 catch 가 돌아왔다 — 원인이 사라진다").not.toMatch(
      /catch\s*\{\s*return null;\s*\}/,
    );
    /** 🟢 **두 실패 경로 모두** 사유를 적는다 — `!ok` 와 예외. */
    expect((seg.match(/recordPlainHtmlFailure\(/g) ?? []).length).toBe(2);
  });

  it("C-2 🟢 실패 유형을 **구분한다** — HTTP 상태 · undici code · 예외 이름", () => {
    const src = bare();
    /** 🟢 4xx/429 는 「거부」다 — 「닿지 못했다」와 섞이지 않게 상태코드를 적는다. */
    expect(src).toContain("HTTP_${response.status}");
    /** 🔴 문구로 가르지 않는다 — `cause.code` 와 `name` 을 읽는다(WU-084 함정). */
    expect(src).toContain("?.cause?.code");
    expect(src).toContain('"UNKNOWN_ERROR"');
    expect(src, "🔴 오류 «문구» 로 유형을 가르면 DNS·거부·타임아웃이 뭉개진다").not.toContain(
      '.includes("fetch failed")',
    );
  });

  it("C-3 🔴🔴 로그에 **URL 원문·인증정보가 없다** — host 와 사유까지다", () => {
    const src = bare();
    const at = src.indexOf("function recordPlainHtmlFailure");
    expect(at).toBeGreaterThan(0);
    const seg = src.slice(at, at + 700);
    expect(seg).toContain("new URL(url).hostname");
    expect(seg).toContain("{ host, reason }");
    for (const banned of ["url,", "url }", "Authorization", "cookie", "token"]) {
      expect(seg, `🔴 로그에 ${banned} 가 섞였다`).not.toContain(banned);
    }
  });

  /**
   * 🔴🔴🔴 **이 단언이 가장 중요하다 — 차단을 «우회» 하지 않는다.**
   *
   * trenbe 429 는 UA 를 바꾸면 사라진다. 🔴 그러나 그것은 접근 차단 우회이고
   * **제품 정책 결정 사안** 이다. UA 가 늘어나거나 요청마다 바뀌면 FAIL 한다.
   */
  it("C-4 🔴🔴 UA 는 **하나이고 고정** 이다(우회·회전 금지)", () => {
    const src = bare();
    const uas = src.match(/Mozilla\/5\.0[^"`]*/g) ?? [];
    expect(uas.length, "🔴 UA 가 둘 이상이다 — 차단 우회로 읽힌다").toBe(1);
    for (const banned of ["UA_POOL", "randomUserAgent", "rotateUa", "USER_AGENTS"]) {
      expect(src, `🔴 ${banned} — UA 회전은 차단 우회다`).not.toContain(banned);
    }
  });

  /**
   * 🔴 실패를 성공으로 만들지 않는다 · 무차별 재시도·타임아웃 상향을 하지 않는다.
   *
   * 🔴🔴 **[범용 MI 에서 갱신 · 의도된 변경]** 이 단언은 원래 「두 실패 경로가 **둘 다
   *    `return null;`**」이었고 **FAIL 로 뒤집혔다.** 이유: 이제 owner 가
   *    `fetchPlainHtmlWithFinalUrlDetailed` 이고 실패를 **`{ ok: false, reason }` 으로
   *    돌려준다**(사유를 호출부까지 보낸다). 🟢 **성질은 한 글자도 안 바뀌었다** —
   *    실패는 그대로 실패고, 재시도·타임아웃·UA 는 불변이다.
   * 🟢 그래서 **느슨하게 하지 않고 모양만 갈아** 끼웠다 — 「성공으로 바꾸지 않는다」를
   *    `ok: false` **두 번** 으로 단언하고, 껍데기의 `null` 도 **같이** 잠근다.
   */
  it("C-5 🔴 실패 처리 정책이 **보존**된다", () => {
    const src = bare();
    const at = src.indexOf("export async function fetchPlainHtmlWithFinalUrlDetailed");
    expect(at, "🔴 fetch owner 가 사라졌다").toBeGreaterThan(0);
    const seg = src.slice(at, src.indexOf("function recordPlainHtmlFailure"));
    /** 🟢 !ok 와 catch 둘 다 여전히 **실패** 다 — 성공으로 바꾸지 않았다. */
    expect((seg.match(/return \{ ok: false, reason \}/g) ?? []).length).toBe(2);
    /** 🟢 기존 호출부가 받는 모양(`null`)은 껍데기가 **그대로** 유지한다. */
    expect(seg).toContain(": null;");
    expect(seg).toContain("AbortSignal.timeout(FETCH_TIMEOUT_MS)");
    expect(seg, "🔴 이 함수가 스스로 재시도하면 limiter 와 둘로 갈린다").not.toContain("while (");
  });

  /** 🟢 타임아웃 상수를 올리지 않았다 — 「무작정 늘리지 않는다」(CPO). */
  it("C-6 🟢 `FETCH_TIMEOUT_MS` 가 **10000** 그대로다", () => {
    expect(bare()).toContain("FETCH_TIMEOUT_MS = 10000");
  });
});
