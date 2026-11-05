import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 2 — **E2E 하니스의 `query` 가 운영 러너와 «같은 네 줄» 인가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 계약이 막는 것은 측정의 거짓이다.**
 *    `collectOverseasAutoPool` 은 `query: ComparisonQuery` 를 받고, 그 안의
 *    `title`/`searchTerm`/`searchTerms`/`facts` 가 **해외 발견량을 결정** 한다.
 *    🔴 하니스가 그 조립을 **조금이라도 다르게** 하면 「해외 후보 N건」이 운영 값이
 *       아니게 되고, 그 숫자로 발견력을 보고하면 **거짓** 이다.
 *
 * 🟢 그래서 **owner 는 전부 운영 함수** 다 — `stripLeadingDevTag`(러너 export) ·
 *    `buildCrossSellerSearchQueries` · `productFactsFromIdentityDna`.
 *    🔴 하니스가 정규식·토큰화·질의 생성을 **직접 구현하지 않는다**(복제 금지).
 *
 * 🔴 네트워크 0 · DB 0 — **소스 앵커** 다(라이브 경로는 게이트 뒤에 있다).
 */

const LIB = path.join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const RUNNER = strip(readFileSync(path.join(LIB, "run-domestic-price-check.ts"), "utf8"));
const HARNESS = strip(readFileSync(path.join(__dirname, "sprint2-e2e-live.test.ts"), "utf8"));

describe("SPRINT2-QUERY-PARITY", () => {
  /** 🔴 네 줄의 **산출 owner** 가 양쪽에서 같다. */
  it("Q-1 🔴 `searchTitle` owner 가 같다 — `stripLeadingDevTag`", () => {
    expect(RUNNER).toContain("const searchTitle = stripLeadingDevTag(input.dna.title)");
    expect(HARNESS).toContain("stripLeadingDevTag(dna.title as string)");
    /** 🔴 하니스가 정규식을 **복제하지 않았다**(그러면 운영과 조용히 갈라진다). */
    expect(HARNESS, "🔴 하니스가 dev-tag 정규식을 복제했다").not.toContain("[^\\]]*");
  });

  it("Q-2 🔴 `sku` 규칙이 같다 — `identifier.tier === \"SKU\"` 일 때만", () => {
    expect(RUNNER).toContain('input.dna.identifier?.tier === "SKU" ? input.dna.identifier.value : undefined');
    expect(HARNESS).toContain('ident?.tier === "SKU" ? ident.value : undefined');
  });

  it("Q-3 🔴 `searchTerms`/`searchTerm` owner 와 순서가 같다", () => {
    expect(RUNNER).toContain("buildCrossSellerSearchQueries(input.dna).map(stripLeadingDevTag).filter(Boolean)");
    expect(HARNESS).toContain("buildCrossSellerSearchQueries(dna as never).map(stripLeadingDevTag).filter(Boolean)");
    /** 🔴 **첫 항목이 `searchTerm`** 이다 — 순서를 바꾸면 질의가 달라진다. */
    expect(RUNNER).toContain("const searchTerm = searchTerms[0] ?? searchTitle");
    expect(HARNESS).toContain("const searchTerm = searchTerms[0] ?? searchTitle");
  });

  it("Q-4 🔴 `facts` owner 가 같다 — `productFactsFromIdentityDna`", () => {
    expect(RUNNER).toContain("facts: productFactsFromIdentityDna(input.dna)");
    expect(HARNESS).toContain("facts: productFactsFromIdentityDna(dna as never)");
  });

  it("Q-5 🔴 `query` 칸 집합이 **일곱으로 같다** — 하나라도 빠지면 발견량이 달라진다", () => {
    for (const k of ["title:", "brand:", "sourceUrl:", "sku,", "searchTerm,", "searchTerms,", "facts:"]) {
      expect(RUNNER, `🔴 러너 query 에 ${k} 가 없다`).toContain(k);
      expect(HARNESS, `🔴 하니스 query 에 ${k} 가 없다`).toContain(k);
    }
  });

  /* ── 🔴 하니스가 «판정» 을 만들지 않는다 ─────────────────────────────────── */

  it("P-1 🔴🔴 판정은 **운영 러너** 가 낸다 — 하니스가 verdict/tier 를 만들지 않는다", () => {
    expect(HARNESS).toContain("runDomesticPriceCheck({");
    for (const forbidden of [
      "withConfidence(",
      "attachMatchTruth(",
      "judgeDomesticCandidate(",
      "priceTierFromLink(",
      'crossSellerVerdict: "',
      'priceTier: "',
    ]) {
      expect(HARNESS, `🔴 하니스가 판정을 지어낸다: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("P-2 🔴🔴 가격 «자격» 은 집계기를 **직접 돌려** 센다 — tier 로 추론하지 않는다", () => {
    expect(HARNESS).toContain("summarizeCandidateOverseasPrices(records as never)");
    /** 🔴 이 트랙에서 실제로 한 오독 — tier 를 자격으로 쓰는 모양을 금지한다. */
    expect(HARNESS, "🔴 tier 로 가격 자격을 세고 있다").not.toContain('priceTier === "COMPARISON"');
  });

  it("P-3 🔴 Search provider/질의/재시도를 건드리지 않았다(CPO §10)", () => {
    /**
     * 🔴🔴 **1차에 「APIFY」를 리터럴로 금지했다가 내 «필수 라벨» 이 FAIL 했다** —
     *    하니스는 「측정불가(APIFY Production 전용)」를 **적어야** 한다(그것이 0 으로
     *    적지 않는다는 선언이다). 🔴 이 저장소가 세 번 밟은 함정이다(「시장 평균」·
     *    「평균」 금지가 필수 부정문을 잡은 그 자리).
     * 🟢 그래서 지키려는 성질을 **직접** 적는다 — 「provider 를 **호출하지** 않는다」.
     */
    for (const forbidden of [
      "webSearch: true",
      "maxQueries",
      "collectWebSearchUrls",
      "APIFY_API_TOKEN",
      "process.env.APIFY",
    ]) {
      expect(HARNESS, `🔴 하니스가 ${forbidden} 를 쓴다`).not.toContain(forbidden);
    }
    /** 🟢 과금 0 — 외부 Search 를 끄고 돌린다. */
    expect(HARNESS).toContain("webSearch: false");
  });

  /* ── 🔴 열화를 0 으로 적지 않는다 ───────────────────────────────────────── */

  it("D-1 🔴🔴 원상품 추출이 전건 실패면 **측정을 거부** 한다", () => {
    expect(HARNESS).toContain('expect(extracted, "🔴 원상품 추출이 전건 실패');
    /** 🔴 그리고 WEB_SEARCH 축을 **측정불가로 적는다**(0 으로 적지 않는다). */
    expect(HARNESS).toContain("측정불가(APIFY Production 전용)");
  });

  it("D-2 🔴 후보 0 을 「실패」로 적지 않는다", () => {
    expect(HARNESS).toContain("「실패」가 아니라 공급 0");
  });
});
