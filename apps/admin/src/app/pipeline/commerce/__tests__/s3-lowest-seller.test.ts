import { describe, expect, it } from "vitest";

import { buildOverseasReference, type OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 S3 — **최저가의 «출처 판매처»**(CPO ㉯ 확정)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 `byCurrency` «밖» 인가 — 그 버킷 모양을 `toEqual` 로 고정한 계약이 **5파일**
 *    이고, 칸을 안에 더했더니 **11건이 깨졌다**(실측 → 되돌림 → ㉯ 재설계).
 *    서버 쪽은 `8fc1eba8` 이 최상위 `lowestSellerByCurrency` 로 넣었다.
 *
 * 🔴 이 파일이 **하지 않는** 것 — 최저가 재계산 0 · 선정 알고리즘 0 · 환산 0 ·
 *    `scope`(판매처 N곳) 의미 변경 0.
 */

/** 두 통화 · 통화마다 다른 판매처 — 「섞이지 않는다」를 재기 위한 모양. */
function summary(): OverseasPriceSummary {
  return {
    count: 3,
    byCurrency: {
      KRW: { count: 2, lowestAmount: 88000, highestAmount: 99000 },
      USD: { count: 1, lowestAmount: 58, highestAmount: 58 },
    },
    lowestSellerByCurrency: { KRW: "biskuit.kr", USD: "thefrontshop.com" },
    byMarket: { KR: 2, OVERSEAS: 1 },
    byPriceTier: { COMPARISON: 3 },
  };
}

function lineOf(s: OverseasPriceSummary, currency: string) {
  return buildOverseasReference(s)?.lines.find((l) => l.currency === currency) ?? null;
}

describe("S3 최저가 출처 — 서버가 고른 값의 출처를 «읽기만» 한다", () => {
  it("🟢 통화별 최저가 판매처가 그대로 전달된다", () => {
    expect(lineOf(summary(), "KRW")?.lowestSeller).toBe("biskuit.kr");
    expect(lineOf(summary(), "USD")?.lowestSeller).toBe("thefrontshop.com");
  });

  it("🔴🔴 통화별 판매처를 **섞지 않는다** — 다른 통화의 출처가 새어 들어오지 않는다", () => {
    expect(lineOf(summary(), "KRW")?.lowestSeller).not.toBe("thefrontshop.com");
    expect(lineOf(summary(), "USD")?.lowestSeller).not.toBe("biskuit.kr");
  });

  it("🔴 그 통화의 출처가 없으면 `null` 이다 — 다른 통화 값으로 메우지 않는다", () => {
    const s = summary();
    s.lowestSellerByCurrency = { KRW: "biskuit.kr" }; // USD 는 없다
    expect(lineOf(s, "KRW")?.lowestSeller).toBe("biskuit.kr");
    expect(lineOf(s, "USD")?.lowestSeller).toBeNull();
  });

  it("🔴 칸 자체가 없는 기존 응답도 그대로 돈다(하위호환) — 전부 `null`", () => {
    const s = summary();
    delete s.lowestSellerByCurrency;
    const view = buildOverseasReference(s);
    expect(view?.lines.length).toBe(2);
    for (const l of view?.lines ?? []) expect(l.lowestSeller).toBeNull();
  });

  it("🔴 빈 문자열·공백은 «미확인» 이다 — 빈 판매처 이름을 만들지 않는다", () => {
    const s = summary();
    s.lowestSellerByCurrency = { KRW: "   ", USD: "" };
    expect(lineOf(s, "KRW")?.lowestSeller).toBeNull();
    expect(lineOf(s, "USD")?.lowestSeller).toBeNull();
  });

  it("🔴 `scope`(판매처 N곳)를 **대신하지 않는다** — 둘은 다른 질문이다", () => {
    const krw = lineOf(summary(), "KRW");
    // 판매처 수는 2곳인데 최저가 출처는 그중 **한 곳** 이다 — 같은 숫자가 아니다.
    expect(krw?.scope).toContain("2");
    expect(krw?.lowestSeller).toBe("biskuit.kr");
  });

  it("🟢 금액·통화 표현은 **한 글자도 바뀌지 않았다**(출처는 별도 칸이다)", () => {
    const krw = lineOf(summary(), "KRW");
    expect(krw?.lowest).toContain("KRW");
    // 🔴 `₩` 로 바꾸지 않는다 — 이 영역의 통화 기호 금지 계약이 유효하다.
    expect(krw?.lowest).not.toContain("₩");
  });
});
