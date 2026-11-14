import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectWebSearchUrls, webSearchIdentityFromDna } from "../web-search-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 4 GATE — **SEARCH INTENT / MARKET NEUTRALITY**(CPO 2026-11-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 묻는 것은 하나다:
 * ```
 * AI Search 가 「상품을 검색」하고 있는가,
 * 아니면 「이 상품과 **동일/유사한 상품의 국내·해외 판매처**」를 찾고 있는가?
 * 🔴 `brand + product name` 뿐이면 **FAIL** 이다.
 * ```
 *
 * ── 🔴 이 파일이 지키는 축 ────────────────────────────────────────────────
 * ```
 * C2  질의에 brand · 품번 · 상품명 · facts · **판매처 의도** 가 전부 있다
 * C3  **Market neutrality** — 입력 URL 의 시장이 Search 시장을 좁히지 않는다
 * ```
 * 🔴 네트워크 **0** — 검색은 주입구(`search`)로 받는다(회귀에서 매번 돈다 · 과금 0).
 * 🔴 **상수를 import 해서 비교하지 않는다**(동어반복 금지 · 메모
 *    `source-guard-must-lock-the-predicate`) — 확정 어휘는 **글자로** 단언한다.
 */

const LIB = join(__dirname, "..");
/** 🔴 주석을 벗긴다 — 이 저장소가 여덟 번 걸린 함정이다. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const POOL = strip(readFileSync(join(LIB, "web-search-pool.ts"), "utf8"));
const RUNNER = strip(readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8"));

/**
 * 🟢 **운영이 읽는 칸 그대로** 의 DNA — 값은 실제 상품(B226AC038)에서 운영이 읽은
 *    것과 같은 모양이다(운영 로그 `[SP07-websearch]` 2026-11-03 05:11 UTC).
 * 🔴 여기서 질의를 **조립하지 않는다** — owner 둘(`webSearchIdentityFromDna` ·
 *    `buildDiscoverySearchQuery`)을 그대로 부른다.
 */
const DNA = {
  sourceUrl: "https://bobochoses.com/en-kr/products/b226ac038-hidden-monster-sweatshirt",
  brand: { value: "Bobo Choses", confident: true },
  identifier: null,
  title: "Hidden Monster sweatshirt",
  coreTitleTokens: ["hidden", "monster", "sweatshirt"],
  color: "Blue",
  category: { value: "Sweatshirts", source: "BREADCRUMB" },
  representativeImageUrl: null,
  brandModelCode: "B226AC038",
  material: "cotton",
  fit: "loose fit",
};

const ORIGIN = DNA.sourceUrl;

/** 🟢 provider 경계에서 **실제로 건네진 문자열** 을 잡는다. */
async function captureSentQuery(identity: unknown): Promise<{ sent: string | null; metricsQuery: string | null }> {
  let sent: string | null = null;
  const out = await collectWebSearchUrls({
    identity: identity as never,
    search: async (q: string) => {
      sent = q;
      return [];
    },
    token: "x",
  });
  return { sent, metricsQuery: out.metrics.query };
}

describe("SPRINT4-GATE-01 — Search Intent", () => {
  /* ── C2. 질의 재료 ─────────────────────────────────────────────────────── */

  /**
   * 🔴🔴 **행동으로** 단언한다. 전에는 이 배선이 라우트 안 인라인 리터럴이어서
   *    **문자열 검사** 밖에 할 수 없었고, 그 모양에서 실제로 `productName`/`color` 가
   *    null 로 보내진 사고가 났다(QUERY-ARCH-01 · E2E-HISTORY-10).
   */
  it("G1 🔴 identity owner 가 다섯 재료를 **값으로** 싣는다", () => {
    const id = webSearchIdentityFromDna(DNA as never, ORIGIN);
    expect(id.brand, "🔴 브랜드가 비었다").toBe("Bobo Choses");
    expect(id.productCode, "🔴 품번이 비었다").toBe("B226AC038");
    expect(id.productName, "🔴 상품명이 비었다").toBe("Hidden Monster sweatshirt");
    expect(id.color, "🔴 색상이 비었다").toBe("Blue");
    /** 🔴 상세설명 유래 사실 — 관측된 것만. 비면 질의가 「brand + name」으로 쪼그라든다. */
    expect(id.facts, "🔴 상세 사실 배선이 끊겼다").toEqual(["cotton", "loose fit"]);
    expect(id.sourceUrl).toBe(ORIGIN);
  });

  it("G2 🔴 재료가 **없으면 지어내지 않는다**(없는 축은 null/빈 배열)", () => {
    const bare = { ...DNA, brand: { value: "", confident: false }, brandModelCode: null, color: null, material: null, fit: null };
    const id = webSearchIdentityFromDna(bare as never, ORIGIN);
    expect(id.brand).toBeNull();
    expect(id.productCode).toBeNull();
    expect(id.color).toBeNull();
    expect(id.facts).toEqual([]);
  });

  /**
   * 🔴🔴🔴 **C2 본문** — provider 에 실제로 건네진 문자열에 다섯 축이 전부 있다.
   *    🔴 `metrics.query` 와 **건네진 값이 같은지** 까지 본다 — 계측만 맞고 실제로는
   *       다른 문자열을 보내는 모양을 막는다.
   */
  it("G3 🔴🔴 provider 에 **건네진** 질의에 brand · 품번 · 상품명 · facts · 판매처 의도가 전부 있다", async () => {
    const { sent, metricsQuery } = await captureSentQuery(webSearchIdentityFromDna(DNA as never, ORIGIN));
    expect(sent, "🔴 질의가 만들어지지 않았다").toBeTruthy();
    expect(metricsQuery, "🔴 계측값과 **실제 전달값** 이 다르다").toBe(sent);
    const q = sent!;
    expect(q, "🔴 브랜드가 질의에 없다").toContain("Bobo Choses");
    expect(q, "🔴 품번이 질의에 없다").toContain("B226AC038");
    expect(q, "🔴 상품명(디자인명)이 질의에 없다").toContain("Hidden Monster");
    expect(q, "🔴 상세 사실이 질의에 없다").toContain("loose fit");
    /** 🔴 **글자로** 단언한다 — 상수를 import 하면 상수를 바꿔도 통과한다(동어반복). */
    expect(q, "🔴🔴 **판매처 의도가 질의에 없다 — 이것이 C2 FAIL 조건이다**").toContain(
      "국내해외 동일상품 판매처",
    );
  });

  /**
   * 🔴🔴 CPO 의 FAIL 조건을 **직접** 단언한다 —
   *    「`brand + product name` 뿐이면 FAIL」.
   */
  it("G4 🔴🔴 질의가 「브랜드 + 상품명」 **뿐이 아니다**", async () => {
    const { sent } = await captureSentQuery(webSearchIdentityFromDna(DNA as never, ORIGIN));
    const q = sent!;
    const onlyBrandAndName = `"Bobo Choses" Hidden Monster sweatshirt`;
    expect(q, "🔴 질의가 브랜드+상품명으로 쪼그라들었다").not.toBe(onlyBrandAndName);
    /** 🟢 식별자는 **정확일치** 로 건다(브랜드·품번) — 그 모양이 유지돼야 한다. */
    expect(q).toContain('"B226AC038"');
    /** 🔴 의도 신호는 **꼬리** 에 있다(본문 토큰 사이에 끼워 넣지 않는다). */
    expect(q.trim().endsWith("국내해외 동일상품 판매처"), "🔴 의도 신호가 질의 꼬리가 아니다").toBe(true);
  });

  /* ── C3. Market neutrality ────────────────────────────────────────────── */

  /**
   * 🔴🔴🔴 **입력 URL 의 시장이 Search 시장을 좁히지 않는다.**
   *
   * 제품 전략: 「입력 URL 이 국내라고 국내만 / 해외라고 해외만 검색하지 않는다」.
   * 🟢 그래서 owner 가 **시장 축 셋을 항상 null** 로 둔다.
   */
  it("G5 🔴🔴 identity owner 가 **시장을 Search 에 넘기지 않는다**", () => {
    const id = webSearchIdentityFromDna(DNA as never, ORIGIN);
    expect(id.market, "🔴 시장이 Search 로 넘어간다").toBeNull();
    expect(id.sourceCountry, "🔴 국가가 Search 로 넘어간다").toBeNull();
    expect(id.sourceSite, "🔴 사이트가 Search 로 넘어간다").toBeNull();
  });

  /**
   * 🔴 owner 가 null 로 둔다는 것만으로는 부족하다 — **조립기가 그 값에 반응하면**
   *    다음 사람이 그 칸을 채우는 순간 질의가 시장별로 갈린다. 🟢 그래서
   *    「채워도 바이트 동일」을 단언한다.
   */
  it("G6 🔴🔴 시장 축을 **채워도 질의가 한 글자도 바뀌지 않는다**", async () => {
    const neutral = webSearchIdentityFromDna(DNA as never, ORIGIN);
    const kr = { ...neutral, market: "KR", sourceCountry: "KR", sourceSite: "bobochoses.com" };
    const os = { ...neutral, market: "OVERSEAS", sourceCountry: "ES", sourceSite: "bobochoses.com" };
    const a = await captureSentQuery(neutral);
    const b = await captureSentQuery(kr);
    const c = await captureSentQuery(os);
    expect(b.sent, "🔴 국내 입력에서 질의가 달라진다").toBe(a.sent);
    expect(c.sent, "🔴 해외 입력에서 질의가 달라진다").toBe(a.sent);
  });

  /**
   * 🔴🔴 **요청 모양** 으로도 중립이어야 한다 — provider 에 국가/언어/지역을 보내면
   *    질의가 같아도 **결과 시장이 좁혀진다**(그러면 C3 는 FAIL 이다).
   */
  it("G7 🔴🔴 provider 요청 본문에 국가·언어·지역 파라미터가 **없다**", () => {
    const at = POOL.indexOf("body: JSON.stringify({");
    expect(at, "🔴 요청 본문을 찾지 못했다").toBeGreaterThan(0);
    const body = POOL.slice(at, POOL.indexOf("}),", at));
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔵🔵 CPO ⒜ 승인(2026-11-14) — **한국 로케일 «둘만» 예외다. 전면 해제가 아니다.**
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴 왜 열렸나 — 로케일이 **아예 없으면** Google 은 actor 데이터센터 기준
     *    (사실상 미국)으로 답한다. 「형식적 중립」이 실제로는 「미국 기준」이었고
     *    그 비용을 **국내만 혼자** 치렀다(해외는 등록부 35곳이 받치고 국내는 8곳뿐).
     * 🔴 `searchLanguage`(=`lr`)는 **계속 금지** — 그쪽은 결과를 **한국어 문서로
     *    제한** 해 해외를 잃는다. `languageCode` 는 **인터페이스 언어**(=`hl`)이고
     *    의미가 다르다(Apify actor input schema 로 확인: "Interface language").
     * 🟢 아래 G7b 가 **그 둘이 정확히 kr/ko 인지** 를 따로 문다 — 아무 값이나 못 넣는다.
     */
    for (const banned of ["locationUule", "searchLanguage", "mobileResults", "gl:", "hl:", "cr:", "lr:"]) {
      expect(body, `🔴 Search 가 시장을 좁힌다: ${banned}`).not.toContain(banned);
    }
    /** 🔴 G7b — 예외는 **그 둘뿐이고 값도 상수로 고정** 이다. */
    expect(body, "🔴 국가 코드가 빠졌다 — 미국 기준 결과로 되돌아간다").toContain(
      "countryCode: SEARCH_COUNTRY_CODE",
    );
    expect(body, "🔴 언어 코드가 빠졌다").toContain("languageCode: SEARCH_LANGUAGE_CODE");
    expect(POOL, "🔴 로케일 값이 한국이 아니다").toContain('SEARCH_COUNTRY_CODE = "kr"');
    expect(POOL, "🔴 로케일 값이 한국이 아니다").toContain('SEARCH_LANGUAGE_CODE = "ko"');
    /** 🟢 보내는 것은 넷뿐이다 — 질의 · 페이지 수 · 페이지당 결과 수 · HTML 저장 끄기. */
    expect(body).toContain("queries: query");
    expect(body).toContain("maxPagesPerQuery: MAX_PAGES_PER_QUERY");
  });

  /**
   * 🔴 그리고 **분리 질의** 로 중립을 깨지 않는다 — 「국내용 질의 + 해외용 질의」는
   *    1 Product = 1 Search 계약과도 충돌한다.
   */
  it("G8 🔴 Search 층에 국내/해외 분리 질의가 없다", () => {
    expect(POOL.split("await run(").length - 1, "🔴 검색을 두 번 부른다").toBe(1);
    for (const banned of ["domesticQuery", "overseasQuery", "krQuery", "queryKo", "queryEn"]) {
      expect(POOL, `🔴 시장별 질의가 생겼다: ${banned}`).not.toContain(banned);
    }
  });

  /* ── 배선 ──────────────────────────────────────────────────────────────── */

  /**
   * 🔴🔴 owner 가 옳아도 **호출부가 안 부르면** 질의는 다시 쪼그라든다(WU-110 교훈 —
   *    「판정 함수를 직접 부르는 테스트는 배선을 못 본다」).
   */
  it("G9 🔴 운영 호출부가 그 owner 를 **실제로** 부른다 · 인라인 복제 0", () => {
    const at = RUNNER.indexOf("collectWebSearchUrls({");
    expect(at).toBeGreaterThan(0);
    const call = RUNNER.slice(at, RUNNER.indexOf("});", at));
    expect(call, "🔴 운영이 identity owner 를 부르지 않는다").toContain(
      "identity: webSearchIdentityFromDna(input.dna, query.sourceUrl)",
    );
    /** 🔴 인라인으로 되돌아가면(칸을 다시 손으로 옮기면) FAIL. */
    expect(call, "🔴 identity 를 다시 인라인으로 조립한다").not.toContain("brand: input.dna.brand.value");
    /** 🔴 owner 는 **하나** 다 — 두 번째 사본이 생기면 FAIL. */
    expect(POOL.split("export function webSearchIdentityFromDna").length - 1).toBe(1);
  });

  /** 🔴 owner 가 판정/가격 어휘를 끌어오지 않는다(Search 는 「어디서 찾을지」만 정한다). */
  it("G10 🔴 identity owner 에 판정·가격 어휘가 없다", () => {
    const at = POOL.indexOf("export function webSearchIdentityFromDna");
    const body = POOL.slice(at, POOL.indexOf("\n}", at));
    for (const banned of ["crossSellerVerdict", "matchTruth", "priceTier", "PRESUMED_SAME", "classifyCandidateMarket"]) {
      expect(body, `🔴 Search identity 가 하류 판정을 건드린다: ${banned}`).not.toContain(banned);
    }
  });
});
