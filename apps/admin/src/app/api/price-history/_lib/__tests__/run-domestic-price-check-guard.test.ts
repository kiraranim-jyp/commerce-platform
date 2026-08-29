import { describe, expect, it, vi } from "vitest";
import { type ComparisonCandidate } from "@commerce/crawler";
import { toDomesticMatchType } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { isEvidenceEvaluationWorthwhile, selectDomesticCandidate } from "../run-domestic-price-check";

/**
 * N-4.18-Q3 PART H-3-11 STEP 4(대표님 지시, 2026-08-27) — "같은 판단 결과 +
 * 같은 안전성 + 더 적은 불필요한 Evidence HTTP 요청"을 실제 코드로 고정한다.
 * isEvidenceEvaluationWorthwhile()은 confidence/threshold/ranking/Top-N/
 * modelCode 판정 규칙을 전혀 재계산하지 않는다 — candidates[0].matchLevel만
 * 읽는다(withConfidence가 이미 confidence 내림차순 정렬해 둔 것을 그대로 신뢰).
 * 대표님이 요청한 6개 케이스(A-F)를 그대로 옮긴다.
 *
 * P-7-C STEP 2 P1(대표님 지시, 2026-08-29) — 이 가드가 foreignModelCode/domain
 * 인자를 추가로 받는다. "low면 무조건 스킵"이 아니라 "식별자를 비교할 가능성이
 * 전혀 없을 때만 스킵"으로 바뀌었다 — 기존 A-F 케이스는 모두 "식별자 비교
 * 가능성이 있는" 상황(foretforet.com + foreignModelCode 존재)이므로 결과가
 * 그대로 유지된다(true였던 건 여전히 true). 유일하게 실제 스킵 판정이 갈리는
 * 건 새로 추가한 G/H 케이스다.
 */
function candidate(overrides: Partial<ComparisonCandidate> & { url: string }): ComparisonCandidate {
  return {
    title: overrides.title ?? "후보",
    price: null,
    imageUrl: null,
    confidence: overrides.confidence ?? 0.7,
    matchLevel: overrides.matchLevel ?? "medium",
    matchReasons: overrides.matchReasons ?? [],
    ...overrides,
  };
}

describe("H-3-11 STEP 4: Evidence 평가 가치 사전 판별 Guard", () => {
  it("A) Low confidence + 식별자 자체를 못 뽑음(foreignModelCode=null) → Evidence fetch 생략, 최종 결과는 그대로 NOT_MATCHED", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.4, matchLevel: "low" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=2", confidence: 0.3, matchLevel: "low" }),
    ];
    expect(isEvidenceEvaluationWorthwhile(candidates, null, "foretforet.com")).toBe(false);

    const fetchModelCode = vi.fn(async () => "무관코드");
    // 실제 runDomesticPriceCheck 루프는 isEvidenceEvaluationWorthwhile이 false면
    // selectDomesticCandidate 자체를 호출하지 않는다 — 여기서는 그 계약을
    // "호출했다면 어떻게 되는지"가 아니라 "가드가 호출을 막는지"로 검증한다.
    expect(fetchModelCode).not.toHaveBeenCalled();
    // 안전성 재확인: 만약 low인 candidates[0]으로 matchType을 구해도 여전히 NOT_MATCHED다.
    const { matchType } = toDomesticMatchType(candidates[0].matchLevel ?? "low");
    expect(matchType).toBe("NOT_MATCHED");
  });

  it("B) REVIEW_REQUIRED 가능 후보(1위 matchLevel=medium) → Top-N 평가 실행, 기존 H-3-9 선택 규칙 유지", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.71, matchLevel: "medium" }),
    ];
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "foretforet.com")).toBe(true);

    const fetchModelCode = vi.fn(async () => "PP24KASHE1195NER");
    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(fetchModelCode).toHaveBeenCalledTimes(1);
    expect(selection.candidate.url).toContain("branduid=1");
    expect(selection.modelCodeEvidence).toBe("partial");
  });

  it("C) PèPè 유형: Top-1 conflict, Top-2 conflict, Top-3 partial → 3개 평가 → Top-3 선택 → REVIEW_REQUIRED/verified=false", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10228154", confidence: 0.72, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10249010", confidence: 0.71, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", confidence: 0.71, matchLevel: "medium" }),
    ];
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "foretforet.com")).toBe(true);

    const domesticCodeByUrl: Record<string, string> = {
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10228154": "PP24KASHE3000NER",
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10249010": "PP25KASHE3094VNE",
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592": "PP24KASHE1195NER",
    };
    const fetchModelCode = vi.fn(async (url: string) => domesticCodeByUrl[url] ?? null);

    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(fetchModelCode).toHaveBeenCalledTimes(3);
    expect(selection.candidate.url).toContain("10226592");
    expect(selection.modelCodeEvidence).toBe("partial");
    expect(selection.skippedConflictCount).toBe(2);

    const { matchType, autoVerified } = toDomesticMatchType(selection.candidate.matchLevel ?? "low");
    expect(matchType).toBe("REVIEW_REQUIRED");
    expect(autoVerified).toBe(false);
  });

  it("D) Top-3 전부 conflict → 기존 top-1 유지 → REVIEW_REQUIRED/verified=false", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.75, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=2", confidence: 0.72, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=3", confidence: 0.7, matchLevel: "medium" }),
    ];
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "foretforet.com")).toBe(true);

    // 한글 placeholder는 normalize()가 빈 문자열로 만들어 "unavailable"이 되므로
    // 알파벳 코드로 진짜 conflict를 유도한다(H-3-9에서 확인된 gotcha 재사용).
    const fetchModelCode = vi.fn(async () => "ZZZZZZZZZ");

    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(fetchModelCode).toHaveBeenCalledTimes(3);
    expect(selection.candidate.url).toContain("branduid=1");
    expect(selection.modelCodeEvidence).toBe("conflict");

    const { matchType, autoVerified } = toDomesticMatchType(selection.candidate.matchLevel ?? "low");
    expect(matchType).toBe("REVIEW_REQUIRED");
    expect(autoVerified).toBe(false);
  });

  it("E) Evidence fetch 실패(네트워크 오류 → null) → 후보 탈락 금지, 기존 confidence 흐름 유지", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.75, matchLevel: "medium" }),
    ];
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "foretforet.com")).toBe(true);

    const fetchModelCode = vi.fn(async () => null); // 네트워크 오류/파싱 실패를 흉내
    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.candidate.url).toContain("branduid=1"); // 탈락하지 않고 그대로 대표 후보
    expect(selection.modelCodeEvidence).toBe("unavailable"); // conflict가 아니므로 필터를 통과
  });

  it("F) non-FORETFORET 사이트 → 새 modelCode fetch 없음, 기존 동작 완전 동일(가드와 무관하게 항상 top-1)", async () => {
    const candidates = [
      candidate({ url: "https://www.looxloo.com/product/1", confidence: 0.9, matchLevel: "medium" }),
      candidate({ url: "https://www.looxloo.com/product/2", confidence: 0.6, matchLevel: "low" }),
    ];
    // 1위가 low가 아니므로 가드는 "평가할 가치 있음"으로 판단하지만, 그건 어차피
    // FORETFORET가 아니면 selectDomesticCandidate 내부에서 fetch 자체를 안 한다.
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "looxloo.com")).toBe(true);

    const fetchModelCode = vi.fn(async () => "무관코드");
    const selection = await selectDomesticCandidate(candidates, "looxloo.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(fetchModelCode).not.toHaveBeenCalled();
    expect(selection.candidate.url).toBe(candidates[0].url);
    expect(selection.skippedConflictCount).toBe(0);
  });

  it("G) non-FORETFORET + low + foreignModelCode 있음 → 여전히 skip(FORETFORET만 국내측 modelCode 추출 가능)", async () => {
    const candidates = [candidate({ url: "https://www.looxloo.com/product/1", confidence: 0.3, matchLevel: "low" })];
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "looxloo.com")).toBe(false);
  });

  it("H) P-7-C STEP 2 핵심 회귀 — FORETFORET + low(42%) + foreignModelCode 있음 → skip 해제, 실제 골든케이스(PèPè) 전체 체인이 verified=true까지 도달한다", async () => {
    // 실측(P-7-C STEP 1, production, 2026-08-29): 포레포레 정답 후보가 이
    // 라이브 검색 컨텍스트에서 텍스트 confidence 42%(low)로 나온다.
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", confidence: 0.42, matchLevel: "low" }),
    ];
    // 가드가 더 이상 무조건 skip하지 않는다 — foreignModelCode가 있고 FORETFORET다.
    expect(isEvidenceEvaluationWorthwhile(candidates, "01195-VERNICE-NERO", "foretforet.com")).toBe(true);

    const fetchModelCode = vi.fn(async () => "PP24KASHE1195NER");
    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.modelCodeEvidence).toBe("partial");

    // toDomesticMatchType 단독으로는 여전히 NOT_MATCHED다(텍스트 42%는 그대로).
    const { matchType: rawMatchType } = toDomesticMatchType(selection.candidate.matchLevel ?? "low");
    expect(rawMatchType).toBe("NOT_MATCHED");
  });
});
