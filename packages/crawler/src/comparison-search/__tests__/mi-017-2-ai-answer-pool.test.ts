import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectAiAnswerCandidatePool } from "../ai-answer-pool";
import { withConfidence } from "../match";
import { productFactsFromListing } from "../seller-facts";
import type { ProductUrlFactsResult } from "../product-url-facts";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-017-2 — 붙여넣은 AI 답변 → **기존 MI 입력** (AI/API 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 AI 호출 0 · Gemini 0 · 외부 검색 API 0 · 키 0 · 비용 0 · **실제 HTTP 0**
 *    (`fetchFacts` 를 주입한다 — 운영 기본값은 `factsFromProductUrl` 이다).
 * 🔴 threshold 0 · 새 판정 엔진 0 · 새 상태 어휘 0 · Registry 0 · schema 0.
 * 🟢 fixture 는 **실측 도메인/품번** 이다(메모 fixtures-must-be-dirty) — 원상품은
 *    WU-008 이 추적한 `bobochoses.co.jp` `B226AC117`, 오염 후보는 WU-010 이 실제
 *    화면에서 잡은 junioredition 의 **ICHI 재킷** 이다.
 * 🔴 **정확도 숫자를 재지 않는다** — KPI 는 WU-017-E2E 부터다.
 */

const ORIGIN = "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket";
const OFFICIAL = "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket";
const ICHI = "https://junioredition.com/products/elovera-jacket-by-ichi";
const TENNIS = "https://tennis-warehouse.com/products/sergio-tacchini-tennis-jacket";

const QUERY: ComparisonQuery = {
  title: "B.C. Embossed Tracksuit Jacket",
  brand: "Bobo Choses",
  sourceUrl: ORIGIN,
  facts: productFactsFromListing({
    title: "B.C. Embossed Tracksuit Jacket",
    url: ORIGIN,
    brand: "Bobo Choses",
  }),
};

/**
 * 🔴 AI 가 «주장» 을 섞어 보내는 실제 모양 — 판정 어휘와 금액이 산문에 박혀 있다.
 * 🔴 **무관한 후보(ICHI)를 공식몰보다 먼저** 적어 둔다. 붙여넣은 순서와 점수 순서가
 *    어긋나야 「배열 단위 1회 + 정렬」을 측정할 수 있다.
 */
const ANSWER = `
세 곳 모두 **동일 상품**입니다. 국내 최저가는 ₩258,000 이고 가장 싼 판매처는 무스트입니다.

1. ${ICHI}
2. ${OFFICIAL}
3. https://bobochoses.com/collections/new-arrivals-kid
4. ${ORIGIN}?_pos=1
`;

/** 🟢 `factsFromProductUrl` 의 **실제 반환 모양** 그대로(칸을 추측하지 않는다). */
function candidateOf(url: string, title: string, brand: string | null): ComparisonCandidate {
  return {
    title,
    url,
    price: null,
    regularPrice: null,
    imageUrl: null,
    confidence: 0,
    brand: brand ?? undefined,
    facts: productFactsFromListing({ title, url, brand }),
  };
}

function ok(url: string, title: string, brand: string | null, httpCalls = 1): ProductUrlFactsResult {
  return {
    status: "OK",
    crawlerUrl: url,
    dedupeKey: url,
    candidate: candidateOf(url, title, brand),
    httpCalls,
    fetchPath: "PLAIN_HTML",
  };
}

function fail(status: "NOT_PRODUCT_URL" | "UNREACHABLE" | "NO_FACTS", httpCalls: number): ProductUrlFactsResult {
  return { status, crawlerUrl: null, dedupeKey: null, candidate: null, httpCalls, fetchPath: "PLAIN_HTML" };
}

const FACTS_BY_URL: Record<string, ProductUrlFactsResult> = {
  [ICHI]: ok(ICHI, "Elovera Jacket by ICHI", "ICHI"),
  [OFFICIAL]: ok(OFFICIAL, "B.C. Embossed Tracksuit Jacket", "Bobo Choses"),
};

/** 🔴 fixture 에 없는 URL 은 **throw** 한다 — 실패 격리를 공짜로 통과시키지 않는다. */
function recordingFetcher(table: Record<string, ProductUrlFactsResult> = FACTS_BY_URL): {
  fetchFacts: (url: string) => Promise<ProductUrlFactsResult>;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    fetchFacts: async (url) => {
      calls.push(url);
      const hit = table[url];
      if (!hit) throw new Error(`fixture 없음: ${url}`);
      return hit;
    },
  };
}

/* ═══════════════════ ① 기본 경로 — URL 을 열어 사실로 판정한다 ═══════════════════ */

describe("WU-017-2 ① 붙여넣은 답변이 기존 MI 후보가 된다", () => {
  it("🟢 상품 상세 URL 만 열고, 후보에는 **점수가 붙어** 돌아온다", async () => {
    const { fetchFacts, calls } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 10, fetchFacts });

    /** 🟢 목록 URL·자기참조는 017-1 이 **HTTP 없이** 걸렀다 — 실제로 열어 본 것은 둘이다. */
    expect(calls).toEqual([ICHI, OFFICIAL]);
    expect(r.candidates).toHaveLength(2);
    for (const c of r.candidates) {
      expect(c.matchLevel).toBeTruthy();
      expect(typeof c.confidence).toBe("number");
    }
  });

  it("🔴🔴 `withConfidence` 를 **배열 단위 정확히 1회** 부른다 — 정렬까지 같다", async () => {
    const { fetchFacts } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 10, fetchFacts });

    /**
     * 🔴 후보마다 1개짜리 배열로 부르면 점수는 같아도 **순서가 붙여넣은 순서** 로
     *    남는다(그 함수가 마지막에 confidence 내림차순 정렬을 한다 · match.ts:553).
     *    🟢 그래서 「같은 입력을 **붙여넣은 순서대로** 배열로 한 번 넣은 결과」와
     *       완전히 같은지 단언한다.
     */
    const expected = withConfidence(QUERY, [
      candidateOf(ICHI, "Elovera Jacket by ICHI", "ICHI"),
      candidateOf(OFFICIAL, "B.C. Embossed Tracksuit Jacket", "Bobo Choses"),
    ]);
    expect(r.candidates).toEqual(expected);

    /** 🔴 그 정렬이 **실제로 순서를 바꿨는지** 확인한다 — 안 바뀌면 위 단언이 공짜다. */
    expect(r.candidates[0].url).toBe(OFFICIAL);
    expect(r.candidates[0].confidence).toBeGreaterThan(r.candidates[1].confidence);
  });

  it("🔴 호출이 **한 곳** 이다 — 루프 안에서 다시 부르면 정렬 계약이 깨진다(주석 벗기고)", () => {
    const src = readFileSync(path.join(__dirname, "..", "ai-answer-pool.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src.match(/withConfidence\(/g) ?? []).toHaveLength(1);
    /** 🔴 두 번째 인자가 **배열 변수** 다 — `[c]` 처럼 1건을 싸서 넣으면 같은 결함이다. */
    expect(src).toMatch(/withConfidence\(input\.query,\s*collected\)/);
    expect(src).not.toMatch(/withConfidence\([^)]*\[/);
  });
});

/* ═══════════════════ ② 실패 격리 — 하나가 죽어도 나머지는 간다 ═══════════════════ */

describe("WU-017-2 ② 실패를 이유와 함께 남긴다", () => {
  it("🔴 세 실패 상태를 **뭉치지 않는다** — 그 함수가 낸 값을 그대로 적는다", async () => {
    for (const status of ["NOT_PRODUCT_URL", "UNREACHABLE", "NO_FACTS"] as const) {
      const { fetchFacts } = recordingFetcher({ [OFFICIAL]: fail(status, status === "NOT_PRODUCT_URL" ? 0 : 1) });
      const r = await collectAiAnswerCandidatePool({ text: OFFICIAL, query: QUERY, maxUrls: 10, fetchFacts });
      expect(r.candidates).toEqual([]);
      expect(r.dropped).toEqual([{ url: OFFICIAL, reason: status }]);
    }
  });

  it("🔴 후보 하나가 **throw** 해도 나머지는 그대로 처리된다 — 이유는 UNREACHABLE", async () => {
    const { fetchFacts, calls } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({
      text: `${ICHI}\n${TENNIS}\n${OFFICIAL}`,
      query: QUERY,
      maxUrls: 10,
      fetchFacts,
    });

    expect(calls).toEqual([ICHI, TENNIS, OFFICIAL]);
    expect([...r.candidates.map((c) => c.url)].sort()).toEqual([ICHI, OFFICIAL].sort());
    /** 🔴 「접근 실패/판단 불가」이고 **「그 사이트에 그 상품이 없다」가 아니다**. */
    expect(r.dropped).toEqual([{ url: TENNIS, reason: "UNREACHABLE" }]);
  });

  it("🟢 `httpCalls` 는 **실패분까지** 합한다 — 비용을 코드가 직접 보고한다", async () => {
    const { fetchFacts } = recordingFetcher({
      [OFFICIAL]: ok(OFFICIAL, "B.C. Embossed Tracksuit Jacket", "Bobo Choses", 2),
      [ICHI]: fail("NO_FACTS", 1),
    });
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 10, fetchFacts });
    expect(r.httpCalls).toBe(3);
    expect(r.candidates).toHaveLength(1);
  });
});

/* ═══════════════════ ③ 경계 — 상한 · 자기참조 · 중복 ═══════════════════ */

describe("WU-017-2 ③ 경계 조건", () => {
  it("🔴 `maxUrls` 를 넘은 URL 은 **열어 보지 않고** 그 사실을 남긴다", async () => {
    const { fetchFacts, calls } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 1, fetchFacts });

    expect(calls).toEqual([ICHI]);
    expect(r.candidates).toHaveLength(1);
    /** 🔴 조용히 버리지 않는다 — 「상품이 없다」와 「안 봤다」는 다르다. */
    expect(r.notFetchedOverLimit).toEqual([OFFICIAL]);
    expect(r.dropped.map((d) => d.url)).not.toContain(OFFICIAL);
  });

  it("🔴 **열린 페이지** 가 원상품과 같은 listing 이면 빠진다 — 입력 경계는 그것을 모른다", async () => {
    /** 🟢 `?variant=` 는 식별 파라미터라 017-1 이 **통과시킨다**(제외 대상이 아니다).
     *     🔴 그런데 `crawlerUrl` 은 쿼리를 떼므로 **열린 것이 원본과 같은 listing** 이다.
     *     🔴 라이브 실측에서 이 그물을 떼 봤더니 **원상품 자기 자신이 SAME/very_high 후보**
     *        로 섰다(junioredition en-kr → /products/booty-ghosts-…). 그래서 유지한다. */
    const withVariant = `${ORIGIN}?variant=44551`;
    const { fetchFacts, calls } = recordingFetcher({
      [withVariant]: ok(ORIGIN, "B.C. Embossed Tracksuit Jacket", "Bobo Choses"),
    });
    const r = await collectAiAnswerCandidatePool({ text: withVariant, query: QUERY, maxUrls: 10, fetchFacts });

    /** 🔴 실제로 열어 봤다 — 「입력 경계가 이미 걸렀다」가 아니다(그러면 이 그물이 공짜다). */
    expect(calls).toEqual([withVariant]);
    expect(r.candidates).toEqual([]);
    expect(r.dropped).toEqual([{ url: withVariant, reason: "SELF_REFERENCE" }]);
  });

  /**
   * 🔴🔴 **WU-017-E2E 실측 성질 — 고치지 않았다(공용 함수라 CPO 판정 사안).**
   *
   * `toCrawlerUrl` 이 **로케일을 떼므로** `/en-kr/` URL 을 넣어도 **Global 페이지** 를
   * 읽는다. 그래서 로케일만 다른 두 입력은 **같은 페이지** 를 열고 중복으로 접힌다.
   * 🔴 그 대가가 「이 경로로는 KR 시장 가격 증거를 얻을 수 없다」 다 — WU-008 이
   *    `.com/en-kr` 에서 `KRW 258,000` 을 실측했는데 그 시장에 **닿지 못한다.**
   * 🔴 이 테스트는 그 성질을 **현재 동작으로 고정** 할 뿐 「옳다」고 말하지 않는다.
   *    정규화기를 고치면 이 단언이 FAIL 로 뒤집히고, **그것이 수정의 증거** 다.
   */
  it("🔴 로케일만 다른 입력은 **같은 페이지를 열어** DUPLICATE 가 된다(KR 시장에 닿지 못한다)", async () => {
    const enKr = "https://bobochoses.com/en-kr/products/b226ac117-b-c-embossed-tracksuit-jacket";
    /** 🟢 fixture 가 실측을 그대로 재현한다 — 두 입력의 `crawlerUrl`·`dedupeKey` 가 같다. */
    const collapsed = ok(OFFICIAL, "B.C. Embossed Tracksuit Jacket", "Bobo Choses");
    const { fetchFacts } = recordingFetcher({ [OFFICIAL]: collapsed, [enKr]: collapsed });
    const r = await collectAiAnswerCandidatePool({
      text: `${OFFICIAL}\n${enKr}`,
      query: QUERY,
      maxUrls: 10,
      fetchFacts,
    });
    expect(r.candidates).toHaveLength(1);
    expect(r.dropped).toEqual([{ url: enKr, reason: "DUPLICATE" }]);
  });

  it("🟢 **목록 세그먼트만 다른** 두 입력도 같은 listing 이라 DUPLICATE 다(008A)", async () => {
    const viaCollection = "https://bobochoses.com/collections/kid/products/b226ac117-b-c-embossed-tracksuit-jacket";
    const same = ok(OFFICIAL, "B.C. Embossed Tracksuit Jacket", "Bobo Choses");
    const { fetchFacts } = recordingFetcher({ [OFFICIAL]: same, [viaCollection]: same });
    const r = await collectAiAnswerCandidatePool({
      text: `${OFFICIAL}\n${viaCollection}`,
      query: QUERY,
      maxUrls: 10,
      fetchFacts,
    });
    /** 🔴 같은 상품을 두 후보로 세면 MI 가 「판매처 2곳」으로 읽는다. */
    expect(r.candidates).toHaveLength(1);
    expect(r.dropped).toEqual([{ url: viaCollection, reason: "DUPLICATE" }]);
  });

  it("🟢 017-1 이 거른 것은 **HTTP 0** 으로 이미 빠져 있다(분모는 남는다)", async () => {
    const { fetchFacts } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 10, fetchFacts });
    const byReason = r.dropped.map((d) => d.reason);
    expect(byReason).toContain("NOT_PRODUCT_PAGE");
    expect(byReason).toContain("SELF_REFERENCE");
    expect(r.foundCount).toBe(4);
    expect(r.extractedUrlCount).toBe(2);
  });

  it("🔴 URL 이 없는 답변은 **HTTP 0 · 후보 0** 이고 그것을 「상품 없음」으로 적지 않는다", async () => {
    const { fetchFacts, calls } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({
      text: "동일 상품을 찾지 못했습니다. 국내 최저가는 확인되지 않습니다.",
      query: QUERY,
      maxUrls: 10,
      fetchFacts,
    });
    expect(calls).toEqual([]);
    expect(r).toEqual({
      candidates: [],
      dropped: [],
      foundCount: 0,
      extractedUrlCount: 0,
      notFetchedOverLimit: [],
      httpCalls: 0,
    });
  });
});

/* ═══════════════════ ④ AI 의 «주장» 은 판정 입력이 0 이다 ═══════════════════ */

describe("WU-017-2 ④ AI 가 말한 것은 한 칸도 들어오지 않는다", () => {
  it("🔴🔴 반환 칸이 전수 고정이다 — SAME·최저가·판매처 칸이 **없다**", async () => {
    const { fetchFacts } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 10, fetchFacts });
    expect(Object.keys(r).sort()).toEqual([
      "candidates",
      "dropped",
      "extractedUrlCount",
      "foundCount",
      "httpCalls",
      "notFetchedOverLimit",
    ]);
  });

  it("🔴🔴 답변에 박힌 금액·판정 문구가 후보에 **전염되지 않는다**", async () => {
    const { fetchFacts } = recordingFetcher();
    const r = await collectAiAnswerCandidatePool({ text: ANSWER, query: QUERY, maxUrls: 10, fetchFacts });

    /** 🔴 산문의 `₩258,000` · 「동일 상품」 · 「무스트」가 결과 어디에도 없다. */
    expect(JSON.stringify(r.candidates)).not.toMatch(/258,?000|동일 상품|무스트|최저가/);
    /** 🔴 가격은 **페이지에서 읽은 것만** 이다 — 이 fixture 는 `price: null` 이다. */
    for (const c of r.candidates) expect(c.price).toBeNull();
  });
});
