import { describe, expect, it, vi } from "vitest";
import { compareModelCode, decideCandidateEvidence, type ComparisonCandidate } from "@commerce/crawler";
import { toDomesticMatchType } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { applyEvidenceDecision, selectDomesticCandidate } from "../run-domestic-price-check";

/**
 * N-4.18-Q3 PART H-3-9 STEP 4(대표님 지시, 2026-08-27) — selectDomesticCandidate()가
 * "confidence 1위가 conflict면 진짜 정답(더 낮은 순위)이 evidence 평가 기회조차
 * 못 얻는다"는 H-3-7 실측 문제를 실제로 고치는지 검증한다. scoreCandidateMatch/
 * classifyMatchLevel/threshold는 재계산하지 않는다 — candidates 배열은 이미
 * confidence 내림차순 정렬된 것으로 그대로 받는다(withConfidence의 실제 계약).
 *
 * 대표님이 요청한 6개 최소 케이스를 그대로 옮긴다.
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

describe("H-3-9 STEP 4: Top-N conflict 제외 후보 선택", () => {
  it("1) PèPè 실제 Top-3: Top-1 conflict, Top-2 conflict, Top-3 partial → Top-3 선택, REVIEW_REQUIRED/verified=false", async () => {
    // 실측(H-3-9 STEP 2, 2026-08-27): branduid 10228154(conflict)/10249010(conflict)/10226592(partial)
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10228154", confidence: 0.72, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10249010", confidence: 0.71, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", confidence: 0.71, matchLevel: "medium" }),
    ];
    const domesticCodeByUrl: Record<string, string> = {
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10228154": "PP24KASHE3000NER",
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10249010": "PP25KASHE3094VNE",
      "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592": "PP24KASHE1195NER",
    };
    const fetchModelCode = vi.fn(async (url: string) => domesticCodeByUrl[url] ?? null);

    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.candidate.url).toContain("10226592");
    expect(selection.modelCodeEvidence).toBe("partial");
    // N-4.18-Q3 UI 후속 — 2건(Top-1/Top-2)을 건너뛰고 3번째(index 2)를 선택했다는
    // 것을 화면이 문장으로 보여줄 수 있어야 한다.
    expect(selection.skippedConflictCount).toBe(2);

    const { matchType, autoVerified } = toDomesticMatchType(selection.candidate.matchLevel ?? "low");
    const decision = decideCandidateEvidence({
      match: { confidence: selection.candidate.confidence, level: selection.candidate.matchLevel ?? "low", reasons: [] },
      modelCode: selection.modelCodeEvidence,
      options: "unavailable",
      image: "unavailable",
    });
    const result = applyEvidenceDecision(autoVerified, [], decision);
    expect(matchType).toBe("REVIEW_REQUIRED");
    // P-7-C STEP 2(대표님 지시, 2026-08-29) — partial modelCode는 이제
    // deriveMatchTruth 기준 STRONG_IDENTIFIER라 auto_confirm이다(H-3-6과
    // 동일한 golden case, 정책만 바뀜 — run-domestic-price-check-evidence.test.ts
    // 참고).
    expect(decision.decision).toBe("auto_confirm");
    expect(result.verified).toBe(true);
    expect(result.matchReasons.some((r) => r.includes("부분 일치(식별자 근거)"))).toBe(true);
  });

  it("2) Top-1 evidence unavailable(비FORETFORET) → 기존 Top-1 그대로, fetch 호출 없음", async () => {
    const candidates = [
      candidate({ url: "https://www.deuxbebe.com/product/x", confidence: 0.72, matchLevel: "medium" }),
      candidate({ url: "https://www.deuxbebe.com/product/y", confidence: 0.5, matchLevel: "low" }),
    ];
    const fetchModelCode = vi.fn(async () => "무관한코드");

    const selection = await selectDomesticCandidate(candidates, "deuxbebe.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.candidate.url).toBe(candidates[0].url);
    expect(selection.modelCodeEvidence).toBe("unavailable");
    expect(selection.skippedConflictCount).toBe(0); // top-1 그대로라 "왜 이 후보" 문구도 안 붙는다
    expect(fetchModelCode).not.toHaveBeenCalled();
  });

  it("3) Top-1 conflict / Top-2 non-conflict(partial) → Top-2 선택", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.75, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=2", confidence: 0.7, matchLevel: "medium" }),
    ];
    const domesticCodeByUrl: Record<string, string> = {
      "https://www.foretforet.com/shop/shopdetail.html?branduid=1": "XYZ999QRS", // 01195와 무관
      "https://www.foretforet.com/shop/shopdetail.html?branduid=2": "PP24KASHE1195NER", // partial
    };
    const fetchModelCode = vi.fn(async (url: string) => domesticCodeByUrl[url] ?? null);

    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.candidate.url).toContain("branduid=2");
    expect(selection.modelCodeEvidence).toBe("partial");
    expect(selection.skippedConflictCount).toBe(1); // Top-1 하나를 건너뛰고 선택
  });

  it("4) Top-3 전부 conflict → confidence 최고인 기존 Top-1 유지, REVIEW_REQUIRED/verified=false", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.75, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=2", confidence: 0.72, matchLevel: "medium" }),
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=3", confidence: 0.7, matchLevel: "medium" }),
    ];
    // "01195-VERNICE-NERO"와 문자 하나도 안 겹치는 알파벳(A-Z0-9만 남기는
    // normalize() 규칙상 한글 placeholder는 빈 문자열이 돼 "unavailable"이
    // 돼버리므로, 반드시 A-Z 알파벳 코드로 conflict를 유도해야 한다).
    const fetchModelCode = vi.fn(async () => "ZZZZZZZZZ");

    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.candidate.url).toContain("branduid=1"); // 기존 top-1 그대로
    expect(selection.modelCodeEvidence).toBe("conflict");

    const { matchType, autoVerified } = toDomesticMatchType(selection.candidate.matchLevel ?? "low");
    const decision = decideCandidateEvidence({
      match: { confidence: selection.candidate.confidence, level: selection.candidate.matchLevel ?? "low", reasons: [] },
      modelCode: selection.modelCodeEvidence,
      options: "unavailable",
      image: "unavailable",
    });
    const result = applyEvidenceDecision(autoVerified, [], decision);
    expect(matchType).toBe("REVIEW_REQUIRED");
    expect(result.verified).toBe(false);
  });

  it("5) FORETFORET 외 사이트는 후보가 5개 있어도 top-1만 사용하고 추가 detail fetch 없음", async () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      candidate({ url: `https://www.looxloo.com/product/${i}`, confidence: 0.9 - i * 0.05, matchLevel: "medium" }),
    );
    const fetchModelCode = vi.fn(async () => "무관코드");

    const selection = await selectDomesticCandidate(candidates, "looxloo.com", "01195-VERNICE-NERO", fetchModelCode);
    expect(selection.candidate.url).toBe(candidates[0].url);
    expect(fetchModelCode).not.toHaveBeenCalled(); // H-3-9 전과 동일하게 요청 자체가 없어야 한다
  });

  it("6) exact + high 이상 후보 선택 후 기존 H-3-6 evidence decision이 verified=true로 정상 처리", async () => {
    const candidates = [
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=1", confidence: 0.7, matchLevel: "medium" }), // conflict 예정
      candidate({ url: "https://www.foretforet.com/shop/shopdetail.html?branduid=2", confidence: 0.88, matchLevel: "high" }), // exact 예정, 텍스트는 top-1보다 낮음
    ];
    const domesticCodeByUrl: Record<string, string> = {
      "https://www.foretforet.com/shop/shopdetail.html?branduid=1": "ZZZZZZZZZ", // B226AC010과 무관(conflict)
      "https://www.foretforet.com/shop/shopdetail.html?branduid=2": "B226AC010",
    };
    const fetchModelCode = vi.fn(async (url: string) => domesticCodeByUrl[url] ?? null);

    const selection = await selectDomesticCandidate(candidates, "foretforet.com", "B226AC010", fetchModelCode);
    expect(selection.candidate.url).toContain("branduid=2");
    expect(selection.modelCodeEvidence).toBe("exact");

    const { matchType, autoVerified } = toDomesticMatchType(selection.candidate.matchLevel ?? "low");
    expect(matchType).toBe("HIGH_CONFIDENCE");
    expect(autoVerified).toBe(false); // 텍스트만 보면 아직 자동확정 아님

    const decision = decideCandidateEvidence({
      match: { confidence: selection.candidate.confidence, level: selection.candidate.matchLevel ?? "low", reasons: [] },
      modelCode: selection.modelCodeEvidence,
      options: "unavailable",
      image: "unavailable",
    });
    expect(decision.decision).toBe("auto_confirm");

    const result = applyEvidenceDecision(autoVerified, [], decision);
    expect(result.verified).toBe(true); // exact + high 구조화 증거로 자동확정
  });
});
