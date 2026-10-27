import { describe, expect, it } from "vitest";
import {
  EXPERIMENT_CAPS,
  GROUNDING_PRICING,
  capCandidateUrls,
  checkSearchBudget,
  estimateGroundingCostUsd,
  summarizeLedger,
  type SearchUsageRow,
} from "../search-cost-ledger";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-01 — **비용 상한 계약**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 파일이 지키는 단 하나의 명제:
 * ```
 * **「API 호출 1회」는 「검색 쿼리 1회」가 아니다.**
 * 그래서 상한을 «호출 수» 가 아니라 «검색 쿼리 수» 로 건다.
 * ```
 * 🔴 과거 「몇 번 안 했는데 왜 ₩21,700?」이 정확히 이 혼동에서 나왔다.
 */

describe("DISCOVERY-SEARCH-PROVIDER-01 §비용 추정", () => {
  it("무료 구간 안에서는 0 달러다", () => {
    expect(estimateGroundingCostUsd(0, 60)).toBe(0);
    expect(estimateGroundingCostUsd(4_000, 1_000)).toBe(0);
  });

  it("🔴 무료 구간을 «넘은 분» 만 과금된다", () => {
    /** 4,900 쓴 상태에서 200 더 쓰면 과금은 **100 쿼리** 분이다. */
    expect(estimateGroundingCostUsd(4_900, 200)).toBeCloseTo((100 / 1000) * 14, 6);
    /** 이미 넘긴 뒤에는 전량 과금. */
    expect(estimateGroundingCostUsd(6_000, 1_000)).toBeCloseTo(14, 6);
  });

  it("요금 상수가 한 곳에 있다(바뀌면 여기만 고친다)", () => {
    expect(GROUNDING_PRICING.freeQueriesPerMonth).toBe(5_000);
    expect(GROUNDING_PRICING.usdPerThousandQueries).toBe(14);
  });
});

describe("DISCOVERY-SEARCH-PROVIDER-01 §상한 게이트 — 🔴 호출 «전» 에 막는다", () => {
  it("상품당 호출 상한을 넘으면 거부한다", () => {
    const d = checkSearchBudget({ groundingQueriesSoFar: 0, callsForThisProduct: 1 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("PRODUCT_CALL_CAP");
  });

  it("🔴🔴 **예상 쿼리를 보수적으로(기본 6) 잡아** 실행 상한을 지킨다", () => {
    /** 누적 96 + 예상 6 = 102 > 100 ⟹ 막아야 한다. */
    const d = checkSearchBudget({ groundingQueriesSoFar: 96, callsForThisProduct: 0 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("RUN_QUERY_CAP");
    /** 94 + 6 = 100 ⟹ 아직 허용. */
    expect(checkSearchBudget({ groundingQueriesSoFar: 94, callsForThisProduct: 0 }).allowed).toBe(true);
  });

  it("🔴 예상치를 1 로 가정하면 상한이 뚫린다 — 그 전제를 쓰지 않는다", () => {
    /** 🔴 만약 기본 예상이 1 이었다면 99 에서도 통과했을 것이다(= 구조적 구멍). */
    expect(checkSearchBudget({ groundingQueriesSoFar: 99, callsForThisProduct: 0 }).allowed).toBe(false);
    /** 🟢 호출부가 «명시적으로» 낮출 수는 있다 — 그때는 그 선택이 코드에 보인다. */
    expect(
      checkSearchBudget({ groundingQueriesSoFar: 99, callsForThisProduct: 0, expectedQueriesPerCall: 1 }).allowed,
    ).toBe(true);
  });

  it("실험 기본 상한이 «작다»(PHASE 1 은 5~10 상품이다)", () => {
    expect(EXPERIMENT_CAPS.maxCallsPerProduct).toBe(1);
    expect(EXPERIMENT_CAPS.maxPlannedQueriesPerProduct).toBe(1);
    expect(EXPERIMENT_CAPS.maxGroundingQueriesPerRun).toBeLessThanOrEqual(100);
  });
});

describe("DISCOVERY-SEARCH-PROVIDER-01 §출력 축소 — URL 만 받는다", () => {
  it("http(s) 가 아닌 것은 버리고 중복을 접고 상한으로 자른다", () => {
    const out = capCandidateUrls(
      [
        "https://a.test/1",
        "  https://a.test/1  ",
        "이 상품은 여기서 팔립니다",
        "ftp://x.test/2",
        "https://b.test/2",
        "https://c.test/3",
      ],
      2,
    );
    expect(out).toEqual(["https://a.test/1", "https://b.test/2"]);
  });

  it("기본 상한이 걸려 있다", () => {
    const many = Array.from({ length: 50 }, (_, i) => `https://x.test/${i}`);
    expect(capCandidateUrls(many)).toHaveLength(EXPERIMENT_CAPS.maxCandidateUrlsPerProduct);
  });
});

describe("DISCOVERY-SEARCH-PROVIDER-01 §원장 — 🔴 「1 call = 1 query」가 거짓임을 숫자로 남긴다", () => {
  const rows: SearchUsageRow[] = [
    {
      productId: "p1",
      query: '"Bobo Choses" "B226AC010"',
      apiCalls: 1,
      searchQueries: 6,
      searchQueryTexts: ["q1", "q2", "q3", "q4", "q5", "q6"],
      inputTokens: 1899,
      outputTokens: 300,
      candidateUrlCount: 5,
      estimatedUsd: 0,
    },
    {
      productId: "p2",
      query: '"Main Story" "AW26MS185"',
      apiCalls: 1,
      searchQueries: 5,
      searchQueryTexts: ["q1", "q2", "q3", "q4", "q5"],
      inputTokens: 1800,
      outputTokens: 280,
      candidateUrlCount: 3,
      estimatedUsd: 0,
    },
  ];

  it("호출당 평균 쿼리가 집계된다", () => {
    const s = summarizeLedger(rows);
    expect(s.products).toBe(2);
    expect(s.apiCalls).toBe(2);
    expect(s.searchQueries).toBe(11);
    /** 🔴 **5.5** — 「호출 2회니까 쿼리 2회」가 아니다. */
    expect(s.queriesPerCall).toBe(5.5);
    expect(s.candidateUrls).toBe(8);
  });

  it("빈 원장에서 0 으로 나눈 값을 만들지 않는다", () => {
    expect(summarizeLedger([]).queriesPerCall).toBe(0);
  });
});
