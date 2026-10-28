import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { stripComments } from "@/app/pipeline/commerce/__tests__/source-text";
import { collectUrlCandidatePool, isCollectionBlocked } from "../url-candidate-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 POLICY-GATE-01 — **수집 정책은 «생산자» 가 아니라 «사이트» 가 결정한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-28). 그 전까지 비대칭이 **실재했다**:
 * ```
 * 등록부 검색   collection_strategy 게이트 O   (comparison-search/index.ts:285)
 * AI Search    게이트 **없음**                 ⟹ NOT_AVAILABLE 인 11st 를 실제로 크롤했다
 * ```
 * 🔴 `NOT_AVAILABLE` 의 뜻은 **「약관으로 자동수집 대상이 아니다」** 다(WU-115).
 * 🔴 **Search 를 막는 것이 아니다** — URL 발견은 그대로이고 **여는 것** 만 막는다.
 * 🟢 네트워크 0 · DB 0 — fetch 는 주입구로 **센다**.
 */

const LIB = join(__dirname, "..");
const RUNNER = stripComments(readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8").replace(/\r\n/g, "\n"));
const POOL = stripComments(readFileSync(join(LIB, "url-candidate-pool.ts"), "utf8").replace(/\r\n/g, "\n"));
const GEMINI = stripComments(readFileSync(join(LIB, "gemini-candidate-pool.ts"), "utf8").replace(/\r\n/g, "\n"));

/** 🔴 실제 등록부 값이다 — 지어내지 않았다(운영 DB 실측 2026-10-28). */
const BLOCKED = new Set(["11st.co.kr", "coupang.com", "gmarket.co.kr"]);
const BLOCKED_URL = "https://www.11st.co.kr/products/9589851221";
/** 🟢 `danawa` 는 **MANUAL** 이다 — 「약관 금지」가 아니라 「미조사」이므로 **막히면 안 된다**. */
const ALLOWED_URL = "https://m.danawa.com/product/product.html?code=123688298";

const okFacts = (url: string) =>
  Promise.resolve({
    status: "OK" as const,
    httpCalls: 1,
    candidate: { url, title: "t", domain: new URL(url).hostname } as never,
  });

async function run(urls: string[], blocked?: ReadonlySet<string>) {
  const fetchFacts = vi.fn((u: string) => okFacts(u));
  const result = await collectUrlCandidatePool({
    urls,
    originUrl: "https://bobochoses.com/en-kr/products/x",
    maxUrls: 10,
    existingCanonicalUrls: new Set<string>(),
    notAvailableDomains: blocked,
    fetchFacts: fetchFacts as never,
  });
  return { result, fetchFacts };
}

describe("POLICY-GATE-01", () => {
  it("M1 🔴🔴 AI Search 가 `NOT_AVAILABLE` URL 을 줘도 **열지 않는다**(fetch 0)", async () => {
    const { result, fetchFacts } = await run([BLOCKED_URL], BLOCKED);
    expect(fetchFacts, "약관상 금지된 사이트를 열었다").toHaveBeenCalledTimes(0);
    expect(result.metrics.usableProductUrls).toBe(0);
    expect(result.metrics.miEligibleCandidates).toBe(0);
    expect(result.searchResults.flatMap((r) => (r.status === "ok" ? r.candidates : []))).toHaveLength(0);
  });

  it("M7 🔴🔴 **Search 를 막은 것이 아니다** — 발견은 남고 «사유» 로 기록된다", async () => {
    const { result } = await run([BLOCKED_URL], BLOCKED);
    /** 🔴 분모가 줄면 그것은 **Search 를 막은 잘못된 구현** 이다. */
    expect(result.metrics.suppliedUrls, "공급 URL 분모가 줄었다 — Search 를 막았다").toBe(1);
    expect(result.metrics.dropped).toEqual([{ url: BLOCKED_URL, reason: "COLLECTION_NOT_AVAILABLE" }]);
    /** 🔴 다른 사유로 뭉개지 않는다 — 원인이 다르다. */
    for (const bad of ["NOT_PRODUCT_PAGE", "UNREACHABLE", "ALREADY_CANDIDATE"]) {
      expect(result.metrics.dropped.map((d) => d.reason)).not.toContain(bad);
    }
  });

  it("M3 🟢 `AVAILABLE`(목록 밖) URL 은 **기존대로** 열린다", async () => {
    const { result, fetchFacts } = await run([ALLOWED_URL], BLOCKED);
    expect(fetchFacts).toHaveBeenCalledTimes(1);
    expect(result.metrics.miEligibleCandidates).toBe(1);
  });

  it("M4 🟢 집합이 비면 **오늘 동작 그대로** 다(기존 호출부 무영향)", async () => {
    const { result, fetchFacts } = await run([BLOCKED_URL, ALLOWED_URL], undefined);
    expect(fetchFacts).toHaveBeenCalledTimes(2);
    expect(result.metrics.dropped).toHaveLength(0);
  });

  it("🔴 서브도메인도 같은 사이트다 — `m.` / `www.` 가 우회가 되지 않는다", () => {
    expect(isCollectionBlocked("https://m.coupang.com/vm/products/1", BLOCKED)).toBe(true);
    expect(isCollectionBlocked("https://www.11st.co.kr/products/1", BLOCKED)).toBe(true);
    /** 🔴 접미사만 같은 **다른 도메인** 을 잡지 않는다(과잉 차단 금지). */
    expect(isCollectionBlocked("https://not-coupang.com/p/1", BLOCKED)).toBe(false);
    /** 🔴 파싱 못 하면 **막지 않는다** — 그 자리는 `NOT_PUBLIC_HOST` 소관이다. */
    expect(isCollectionBlocked("not a url", BLOCKED)).toBe(false);
  });

  it("M2 🟢 등록부 경로의 기존 게이트는 **그대로** 다", () => {
    const idx = stripComments(
      readFileSync(join(LIB, "../../../../../../../packages/crawler/src/comparison-search/index.ts"), "utf8").replace(
        /\r\n/g,
        "\n",
      ),
    );
    expect(idx, "등록부 게이트가 사라졌다").toContain(
      'source.collectionStrategy !== "AUTO_API" && source.collectionStrategy !== "AUTO_SCRAPE"',
    );
  });

  it("M5 🔴🔴 **모든 생산자가 같은 집합** 을 받는다(정책 복제 0)", () => {
    /** 🟢 호출부 수를 손으로 적지 않는다 — pool 호출 전수에서 센다. */
    const poolCalls = (RUNNER.match(/await collectUrlCandidatePool\(\{/g) ?? []).length;
    const geminiCalls = (RUNNER.match(/await collectGeminiCandidatePool\(\{/g) ?? []).length;
    const wired = (RUNNER.match(/^\s*notAvailableDomains,$/gm) ?? []).length;
    expect(poolCalls).toBeGreaterThanOrEqual(4);
    expect(wired, "생산자 중 일부만 정책을 받는다 — 비대칭이 되돌아온다").toBe(poolCalls + geminiCalls);
    /** 🔴 `MANUAL` 을 섞지 않는다 — 「미조사」를 「금지」로 바꾸면 정상 후보가 사라진다. */
    const derive = RUNNER.slice(RUNNER.indexOf("const notAvailableDomains"), RUNNER.indexOf("const notAvailableDomains") + 400);
    expect(derive).toContain('collectionStrategy === "NOT_AVAILABLE"');
    expect(derive, "MANUAL 까지 막고 있다").not.toContain("MANUAL");
  });

  it("M6 🔴 정책 술어의 **owner 는 하나** 다 — 생산자가 사본을 만들지 않는다", () => {
    expect(POOL).toContain("export function isCollectionBlocked");
    /** 🔴 Gemini 는 **import 해서** 쓴다(자기 구현 금지). */
    expect(GEMINI).toContain("isCollectionBlocked");
    expect(GEMINI, "Gemini 가 정책 술어를 자기 파일에 다시 적었다").not.toContain(
      "function isCollectionBlocked",
    );
    /**
     * 🔴 HTTP «앞» 이어야 한다 — `resolveCandidate` 도 HTTP 를 쓴다.
     * 🔴 **import 줄이 아니라 «호출» 을 본다** — 1차에 `indexOf("isCollectionBlocked")`
     *    로 썼더니 **import 를 집어서** 게이트를 지워도 통과했다(변이 G6 가 잡았다).
     */
    const CALL = "isCollectionBlocked(found.url, input.notAvailableDomains)";
    expect(GEMINI, "Gemini 경로에 정책 게이트 «호출» 이 없다").toContain(CALL);
    expect(GEMINI.indexOf(CALL)).toBeLessThan(GEMINI.indexOf("await resolveCandidate"));
  });
});
