import { describe, expect, it } from "vitest";
import { compareModelCode, deriveMatchTruth, extractForeignModelCode, MATCH_TRUTH_RANK } from "@commerce/crawler";

/**
 * P-7-B(CPO 지시, 2026-08-29) — MT-01. CEO가 실측으로 발견한 사고를 영구 회귀
 * fixture로 고정한다.
 *
 * 원본: Junior Edition "Lulu T-Bar Shoes in Vernice Nero by PèPè"
 *   설명문: "...Article code: 01195-VERNICE-NERO."
 * 실제 동일상품: 포레포레 "AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈"
 *   상품코드(mpn): PP24KASHE1195NER
 * 잘못된 후보: 듀베베 "페페 VERNICE NERO"(상품코드 없음), 텍스트 유사도만 72%
 *
 * 이 fixture가 고정하는 것: 텍스트 유사도(confidence)만 보면 듀베베(72%)가 진짜
 * 동일상품인 포레포레(71%)보다 높게 나온다 — 이게 실제 사고였다. deriveMatchTruth는
 * confidence를 다시 계산하지 않는다(match.ts/classifyMatchLevel 그대로) — 대신
 * modelCode 증거를 별도 축으로 얹어서, 실제 동일상품이 유사상품보다 항상 위에
 * 오도록 만드는 게 이 테스트의 목적이다.
 */

describe("MT-01a — 포레포레 정답(PP24KASHE1195NER): 원본 설명문 품번과 partial 일치 → STRONG_IDENTIFIER", () => {
  it("실측 문자열 그대로: 01195-VERNICE-NERO vs PP24KASHE1195NER는 partial(공유 4자리 '1195')", () => {
    const foreignModelCode = extractForeignModelCode("Article code: 01195-VERNICE-NERO.");
    expect(foreignModelCode).toBe("01195-VERNICE-NERO");
    expect(compareModelCode(foreignModelCode, "PP24KASHE1195NER")).toBe("partial");
  });

  it("텍스트 유사도가 71%(medium)에 그쳐도 partial modelCode가 있으면 STRONG_IDENTIFIER — 유사상품 등급으로 취급하지 않는다", () => {
    const truth = deriveMatchTruth("medium", "partial");
    expect(truth).toBe("STRONG_IDENTIFIER");
  });
});

describe("MT-01b — 포레포레 오답 후보(PP24KASHE3000NER/PP25KASHE3094VNE): 4자 미만만 공유 → conflict → CONFLICT", () => {
  it("PP24KASHE3000NER는 '01195-VERNICE-NERO'와 3자('NER')만 공유 — conflict", () => {
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE3000NER")).toBe("conflict");
  });

  it("PP25KASHE3094VNE도 마찬가지로 conflict", () => {
    expect(compareModelCode("01195-VERNICE-NERO", "PP25KASHE3094VNE")).toBe("conflict");
  });

  it("텍스트 점수가 아무리 높아도(medium/high여도) modelCode conflict면 항상 CONFLICT — 최하위 취급", () => {
    expect(deriveMatchTruth("medium", "conflict")).toBe("CONFLICT");
    expect(deriveMatchTruth("high", "conflict")).toBe("CONFLICT");
  });
});

describe("MT-01c — 듀베베 오답(페페 VERNICE NERO, 상품코드 없음): unavailable + medium(72%) → SIMILAR", () => {
  it("듀베베는 modelCode 추출 기능 자체가 없다 — compareModelCode(x, null)은 항상 unavailable", () => {
    expect(compareModelCode("01195-VERNICE-NERO", null)).toBe("unavailable");
  });

  it("텍스트 유사도가 포레포레(71%)보다 높아도(72%) 식별자 증거가 없으면 SIMILAR — 동일상품 등급으로 승격되지 않는다", () => {
    const truth = deriveMatchTruth("medium", "unavailable");
    expect(truth).toBe("SIMILAR");
  });
});

describe("MT-01 핵심 회귀 — 실제 동일상품(포레포레)이 유사상품(듀베베)보다 항상 더 높은 우선순위로 표시돼야 한다", () => {
  it("포레포레 STRONG_IDENTIFIER > 듀베베 SIMILAR — 텍스트 점수(71% < 72%)와 반대 방향으로 랭크가 뒤집혀야 정상", () => {
    const foretforetTruth = deriveMatchTruth("medium", "partial"); // 71%, 진짜 동일상품
    const deuxbebeTruth = deriveMatchTruth("medium", "unavailable"); // 72%, 실제로는 다른 상품
    expect(MATCH_TRUTH_RANK[foretforetTruth]).toBeGreaterThan(MATCH_TRUTH_RANK[deuxbebeTruth]);
  });

  it("포레포레 오답 후보(CONFLICT)는 듀베베(SIMILAR)보다도 낮아야 한다 — modelCode 충돌은 텍스트 유사도와 무관하게 최하위", () => {
    const foretforetWrong = deriveMatchTruth("medium", "conflict"); // 72%, modelCode 충돌
    const deuxbebeTruth = deriveMatchTruth("medium", "unavailable");
    expect(MATCH_TRUTH_RANK[foretforetWrong]).toBeLessThan(MATCH_TRUTH_RANK[deuxbebeTruth]);
  });
});

describe("deriveMatchTruth — 나머지 규칙 조합(대표님 지시 표 그대로)", () => {
  it("exact + high 이상 → EXACT_IDENTIFIER(가장 강한 등급)", () => {
    expect(deriveMatchTruth("very_high", "exact")).toBe("EXACT_IDENTIFIER");
    expect(deriveMatchTruth("high", "exact")).toBe("EXACT_IDENTIFIER");
  });

  it("exact인데 medium/low면 STRONG_IDENTIFIER(승격은 하되 최고 등급은 아님)", () => {
    expect(deriveMatchTruth("medium", "exact")).toBe("STRONG_IDENTIFIER");
  });

  it("unavailable + high 이상 → TEXT_CONFIRMED(식별자 증거는 없지만 텍스트만으로도 강함)", () => {
    expect(deriveMatchTruth("very_high", "unavailable")).toBe("TEXT_CONFIRMED");
    expect(deriveMatchTruth("high", "unavailable")).toBe("TEXT_CONFIRMED");
  });

  it("level=low + unavailable(식별자 증거 없음)이면 INSUFFICIENT_EVIDENCE", () => {
    expect(deriveMatchTruth("low", "unavailable")).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("level=low여도 exact/partial(식별자 증거 있음)이면 승격한다 — 대표님 지시 원문 \"텍스트 점수가 낮아도(medium 이하)\"의 '이하'에는 low도 포함된다", () => {
    expect(deriveMatchTruth("low", "exact")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("low", "partial")).toBe("STRONG_IDENTIFIER");
  });
});

describe("MT-01 실측 재확인(2026-08-29 production) — 이 라이브 검색 라우트에서는 포레포레 정답 후보의 텍스트 confidence가 42%(low)로 나온다", () => {
  it("포레포레 정답(low+partial, STRONG_IDENTIFIER)이 듀베베 오답(medium+unavailable, SIMILAR)보다 항상 위여야 한다 — level=low 무조건 최하위 처리였다면 여기서 다시 뒤집혔을 것", () => {
    const foretforetTruth = deriveMatchTruth("low", "partial");
    const deuxbebeTruth = deriveMatchTruth("medium", "unavailable");
    expect(foretforetTruth).toBe("STRONG_IDENTIFIER");
    expect(deuxbebeTruth).toBe("SIMILAR");
    expect(MATCH_TRUTH_RANK[foretforetTruth]).toBeGreaterThan(MATCH_TRUTH_RANK[deuxbebeTruth]);
  });
});
