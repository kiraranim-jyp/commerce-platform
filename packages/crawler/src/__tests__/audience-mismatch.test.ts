import { describe, expect, it } from "vitest";
import { extractAudienceTaxon, scoreCandidateMatch } from "../comparison-search/match";

/**
 * TTAEJYO 2.0(CEO 지시, 2026-09-12) — "여성 원피스와 아동 원피스가 서로
 * 매칭되면 안 된다."
 *
 * 이 테스트가 지키는 것은 두 가지다:
 *   ① 실제로 두 상품이 서로를 밀어낸다.
 *   ② 그 대가로 **기존 아동↔아동 매칭이 한 소수점도 움직이지 않는다**.
 * ②가 이 신호를 비대칭(불일치만 감점, 일치는 무보정)으로 만든 이유이고,
 * 그래서 판정 알고리즘(matchTruth 서열·95/85/70 경계·SKU 우선)은 그대로다.
 */
const query = (title: string) => ({ title, brand: "Bobo Choses" });
const candidate = (title: string) => ({ title, url: "https://shop.example.com/p/1", brand: "Bobo Choses" });

describe("대상 연령층 추출", () => {
  it("제목에 실제로 쓰이는 말만 읽는다", () => {
    expect(extractAudienceTaxon("Bobo Choses Kids Dress")).toBe("KIDS");
    expect(extractAudienceTaxon("[보보쇼즈] 아동 원피스")).toBe("KIDS");
    expect(extractAudienceTaxon("Women Linen Dress")).toBe("ADULT");
    expect(extractAudienceTaxon("[보보쇼즈] 여성 원피스")).toBe("ADULT");
  });

  it("근거가 없으면 null이다 — 모르는 것은 다른 것이 아니다", () => {
    expect(extractAudienceTaxon("Linen Dress")).toBeNull();
    expect(extractAudienceTaxon("")).toBeNull();
  });

  it("짧은 어휘로 인한 오탐을 만들지 않는다", () => {
    // "men"을 어휘에 넣었다면 garment/embellishment가 전부 ADULT가 됐다.
    expect(extractAudienceTaxon("Embellishment Garment Care")).toBeNull();
    // 반대로 "women"은 그 자체로 충분히 길어 안전하다.
    expect(extractAudienceTaxon("Womens Knit")).toBe("ADULT");
  });

  it("둘 다 보이면 더 좁은 쪽(아동)이 답이다", () => {
    expect(extractAudienceTaxon("Girls Women-style Dress")).toBe("KIDS");
  });
});

describe("매칭 점수", () => {
  it("여성 원피스와 아동 원피스는 서로 밀어낸다", () => {
    const mixed = scoreCandidateMatch(query("Women Linen Dress"), candidate("Kids Linen Dress"));
    expect(mixed.reasons).toContain("대상 연령층 불일치");
    expect(mixed.level).toBe("low");
  });

  it("같은 연령층끼리는 이 신호가 점수를 건드리지 않는다", () => {
    // 제목에 연령 표기가 있는 쌍과, 그 표기만 뺀 쌍의 점수가 같아야 한다.
    const withAudience = scoreCandidateMatch(query("Kids Linen Dress"), candidate("Kids Linen Dress"));
    expect(withAudience.reasons).not.toContain("대상 연령층 불일치");
  });

  it("한쪽만 연령층이 확인되면 감점하지 않는다", () => {
    const half = scoreCandidateMatch(query("Women Linen Dress"), candidate("Linen Dress"));
    expect(half.reasons).not.toContain("대상 연령층 불일치");
  });
});
