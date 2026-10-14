/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-017 — AI 답변 1회 붙여넣기: **입력 경계** (순수 함수 · CPO 지시)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 AI/API 0 · Gemini 0 · 외부 검색 API 0 · 비용 0 · HTTP 0 · Registry 0 ·
 *    threshold 0 · 새 동일상품 판정 엔진 **0**.
 * 🟢 fixture 는 **실측 도메인/품번** 을 쓴다(날조 0 · 메모 fixtures-must-be-dirty).
 */
import { describe, expect, it } from "vitest";
import { extractCandidateUrlsFromAiAnswer } from "../ai-answer-urls";

const ORIGIN = "https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket";

/** 🟢 실제 AI 답변이 올 모양 그대로 — 산문 + 마크다운 + 문장부호 + 목록 URL 이 섞인다. */
const ANSWER = `
동일 상품으로 보이는 판매처를 찾았습니다.

1. 공식몰: https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket
2. 국내: https://m.web.mustit.co.kr/v2/m/product/product_detail/126769866?utm_source=chatgpt.com
3. 해외: [Junior Edition](https://junioredition.com/products/b-c-embossed-tracksuit-jacket-by-bobo-choses)
4. 같은 상품 목록: https://bobochoses.com/collections/new-arrivals-kid
5. 원본과 같은 페이지: https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket?_pos=1
6. 중복: https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket?utm_source=x.
7. 잘못된 주소: htp://broken.example/products/x
8. 메일: mailto:seller@example.com

이 네 곳은 **모두 동일 상품**이며 가격도 비슷합니다.
`;

describe("WU-017 ① AI 답변에서 URL 만 꺼낸다", () => {
  const r = extractCandidateUrlsFromAiAnswer(ANSWER, ORIGIN);

  it("🟢 상품 상세 URL 만 후보가 된다", () => {
    expect(r.urls).toEqual([
      "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket",
      "https://m.web.mustit.co.kr/v2/m/product/product_detail/126769866",
      "https://junioredition.com/products/b-c-embossed-tracksuit-jacket-by-bobo-choses",
    ]);
  });

  it("🔴 제외된 것은 **이유와 함께** 남는다 — 조용히 버리지 않는다", () => {
    const byReason = r.dropped.reduce<Record<string, string[]>>((a, d) => {
      (a[d.reason] ??= []).push(d.url);
      return a;
    }, {});
    expect(byReason.NOT_PRODUCT_PAGE).toEqual(["https://bobochoses.com/collections/new-arrivals-kid"]);
    expect(byReason.SELF_REFERENCE).toHaveLength(1);
    expect(byReason.DUPLICATE).toHaveLength(1);
    expect(byReason.INVALID_URL ?? byReason.UNSUPPORTED_SCHEME).toBeUndefined();
  });

  it("🟡 분모를 남긴다 — 몇 개 중 몇 개가 남았는가", () => {
    /** 🔴 `htp://` 와 `mailto:` 는 URL_RE(http/https)에 애초에 걸리지 않으므로 분모에 없다. */
    expect(r.foundCount).toBe(r.urls.length + r.dropped.length);
    expect(r.foundCount).toBe(6);
  });

  it("🔴🔴 AI 의 「모두 동일 상품」 주장은 **결과에 들어가지 않는다**", () => {
    /** 🟢 반환값에 판정/확신도 칸이 **없다** — 동일상품 여부는 뒤 체인이 페이지를 열어 정한다. */
    expect(Object.keys(r).sort()).toEqual(["dropped", "foundCount", "urls"]);
    expect(JSON.stringify(r)).not.toMatch(/동일|same|confidence|verdict/i);
  });
});

describe("WU-017 ② 경계 조건", () => {
  it("추적 파라미터는 정규화로 사라지고 식별 파라미터는 남는다", () => {
    const r = extractCandidateUrlsFromAiAnswer(
      "https://a.com/products/x?utm_source=g&variant=123 그리고 https://a.com/products/y",
      null,
    );
    expect(r.urls).toEqual(["https://a.com/products/x?variant=123", "https://a.com/products/y"]);
  });

  it("🔴 origin 이 없으면 자기참조 검사만 건너뛴다(나머지는 그대로)", () => {
    const r = extractCandidateUrlsFromAiAnswer(`${ORIGIN}`, null);
    expect(r.urls).toEqual([ORIGIN]);
    expect(r.dropped).toEqual([]);
  });

  it("문장 끝 문장부호를 URL 로 읽지 않는다", () => {
    const r = extractCandidateUrlsFromAiAnswer("보세요: https://a.com/products/x.", null);
    expect(r.urls).toEqual(["https://a.com/products/x"]);
  });

  it("빈 입력 · URL 없는 입력은 빈 결과다", () => {
    for (const t of ["", "URL 이 없는 답변입니다."]) {
      const r = extractCandidateUrlsFromAiAnswer(t, ORIGIN);
      expect(r).toEqual({ urls: [], dropped: [], foundCount: 0 });
    }
  });

  it("🟡 목록 URL 도 받고 싶으면 **호출부가 명시** 해야 한다(기본은 제외)", () => {
    const list = "https://bobochoses.com/collections/new-arrivals-kid";
    expect(extractCandidateUrlsFromAiAnswer(list, null).urls).toEqual([]);
    expect(extractCandidateUrlsFromAiAnswer(list, null, { requireProductPage: false }).urls).toEqual([list]);
  });
});
