import { describe, expect, it } from "vitest";
import { EXPAND_CANDIDATE_MARKET_CODES } from "../shopify-market-probe";

/**
 * GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — 확장 조회 후보 목록은 "존재를 단정"
 * 하는 게 아니라 "찔러볼 후보"지만, 어떤 형태를 후보로 두느냐에 따라 없는
 * 시장을 있는 것처럼 저장할 위험이 생긴다. N-3.2 실측(junioredition.com,
 * 2026-08-10)에서 "fr"/"de"/"es"/"ja"처럼 언어만 적은 코드는 전부 기본 가격
 * (GBP 74)을 그대로 되돌려줬다 — 그래서 언어만 있는 코드는 후보에 두지 않는다.
 *
 * "en-int"는 그 반례의 실증으로 추가됐다(Bobo Choses B226AC043, 2026-09-11):
 * 루트와 /en-de가 €75.00인데 /en-int는 €84.00이었다. 기본 가격을 되돌려주는
 * 가짜 market이 아니므로 후보로 둔다.
 */
describe("EXPAND_CANDIDATE_MARKET_CODES", () => {
  it("언어만 적힌 코드(fr/de/es/ja)는 후보에 없다 — 기본 가격을 되돌려주는 가짜 market이었다", () => {
    for (const languageOnly of ["fr", "de", "es", "ja", "en"]) {
      expect(EXPAND_CANDIDATE_MARKET_CODES).not.toContain(languageOnly);
    }
  });

  it("en-int이 후보에 있다 — 실측상 기본 가격(€75)과 다른 값(€84)을 내는 실제 시장이다", () => {
    expect(EXPAND_CANDIDATE_MARKET_CODES).toContain("en-int");
  });

  it("기본 조회가 이미 담당하는 두 곳(''/en-kr)은 확장 후보에 없다 — 같은 시장을 두 번 찌르지 않는다", () => {
    expect(EXPAND_CANDIDATE_MARKET_CODES).not.toContain("");
    expect(EXPAND_CANDIDATE_MARKET_CODES).not.toContain("en-kr");
  });

  it("후보에 중복이 없다 — 한 시장이 두 행으로 저장될 여지를 남기지 않는다", () => {
    expect(new Set(EXPAND_CANDIDATE_MARKET_CODES).size).toBe(EXPAND_CANDIDATE_MARKET_CODES.length);
  });
});
