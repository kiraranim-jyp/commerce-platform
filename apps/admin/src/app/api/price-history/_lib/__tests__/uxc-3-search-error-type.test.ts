/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 UXC-③ — **401 의 «이유» 를 코드가 말한다**(토큰은 절대 싣지 않는다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영이 401 을 **세 번 연속** 냈는데 본문을 버려서 「토큰 무효 · 권한 · 사용량」
 *    중 무엇인지 코드로 답할 수 없었다(CPO 가 그 구분을 명시 요구).
 *
 * 🟢 **외부 축은 CTO 가 실측으로 갈랐다**(비용 0 · 비밀값 0):
 * ```
 * 토큰 파라미터 없음 / 빈 문자열 → HTTP **402**     ← 운영은 402 가 아니었다
 * 토큰 무효 / 형식 오류          → HTTP **401**     ← 운영이 받은 값
 * actor 메타 조회                → HTTP **200**     ← Actor ID·경로는 유효
 * ```
 * 🔴 그래서 **「사용량 소진」으로 적지 않는다** — 무토큰도 402 이고 잔액도 남아 있다.
 *
 * 🔴 이 파일이 잠그는 것은 **진단 가능성** 이다 — 다음 장애에서 또 추측하지 않도록.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collectWebSearchUrls } from "../web-search-pool";

const SRC = readFileSync(join(__dirname, "../web-search-pool.ts"), "utf8")
  .split(String.fromCharCode(13))
  .join("");
/** 🔴 **주석을 벗기고** 본다 — 이 리포가 여덟 번 밟은 함정이다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("UXC-③ 검색 실패의 «분류 코드» 를 남긴다", () => {
  it("A-1 🔴 실패 응답의 **본문을 읽고 나서** 던진다(버리지 않는다)", () => {
    expect(CODE, "🔴 본문을 다시 버리고 상태코드만 던진다").toContain(
      "throw new SearchHttpError(res.status, await readErrorType(res))",
    );
  });

  it("A-2 🔴🔴 **토큰이 샐 수 있는 것은 하나도 싣지 않는다**", () => {
    const i = CODE.indexOf("function readErrorType");
    const fn = CODE.slice(i, CODE.indexOf("\n}", i));
    /** 🟢 담는 것은 `error.type` **하나** 다. */
    expect(fn, "🔴 분류 코드를 안 읽는다").toContain("error?.type");
    for (const leak of ["res.url", "JSON.stringify(body)", "error?.message", "headers"]) {
      expect(fn, `🔴 민감정보가 샐 수 있는 값을 담았다: ${leak}`).not.toContain(leak);
    }
    /** 🔴 길이를 자른다 — 공급자가 긴 문장을 type 에 넣어도 로그가 터지지 않는다. */
    expect(fn, "🔴 길이 상한이 없다").toContain("slice(0, APIFY_ERROR_TYPE_MAX)");
  });

  it("A-3 🟢 **기록 모양을 바꾸지 않았다** — 기존 `errorCode` 칸으로 흐른다", () => {
    expect(CODE, "🔴 기존 배선이 읽는 `code` 를 안 채운다").toContain("this.code = errorType ?? undefined");
    /**
     * 🔴 **새 metrics 칸을 만들지 않았다** — 소비처가 늘면 계약이 또 갈린다.
     * 🔴 범위를 `WebSearchPoolMetrics` 안으로 좁힌다 — 1차에 파일 전체를 봐서
     *    내 **클래스 필드 선언** 을 잡고 FAIL 했다(내 단언이 틀렸다).
     */
    const mi = CODE.indexOf("interface WebSearchPoolMetrics");
    const metrics = CODE.slice(mi, CODE.indexOf("}", mi));
    expect(metrics, "🔴 기록 칸을 새로 만들었다").not.toContain("errorType");
    expect(metrics, "🔴 기존 분류 코드 칸이 사라졌다").toContain("errorCode");
  });

  it("A-4 🔴 **분류 코드가 실제로 끝까지 간다**(주입 실패로 재현)", async () => {
    const r = await collectWebSearchUrls({
      identity: { brand: "Bobo Choses", productCode: "B226AC009" } as never,
      token: "zz",
      search: () => {
        const e = new Error("search HTTP 401") as Error & { status: number; code: string };
        e.name = "SearchHttpError";
        e.status = 401;
        e.code = "token-not-found";
        return Promise.reject(e);
      },
    });
    expect(r.metrics.failed, "🔴 실패가 실패로 안 적힌다").toBe(true);
    expect(r.metrics.errorStatus).toBe(401);
    expect(r.metrics.errorCode, "🔴 분류 코드가 기록까지 못 간다").toBe("token-not-found");
    /** 🔴 **실패를 「결과 0」으로 적지 않는다**(미측정 ≠ 0 · 절대불변 7 ⑤). */
    expect(r.metrics.organicResults).toBe(0);
    expect(r.urls).toEqual([]);
  });

  it("A-5 🔴 **토큰 없음과 토큰 무효는 다른 상태다** — 둘을 한 문장으로 적지 않는다", async () => {
    const r = await collectWebSearchUrls({
      identity: { brand: "Bobo Choses", productCode: "B226AC009" } as never,
      token: null,
    });
    /** 🟢 못 물어본 것이지 실패가 아니다(기존 계약 유지 · 여기서 재확인). */
    expect(r.metrics.skipped, "🔴 「키 없음」이 「검색 실패」로 뭉개졌다").toBe("NOT_CONFIGURED");
    expect(r.metrics.failed).toBe(false);
    expect(r.metrics.errorStatus).toBeNull();
  });
});
