import { describe, expect, it } from "vitest";
import { scoreCandidateMatch } from "../comparison-search/match";

/**
 * MI-MATCH-FIX-3(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **fullTitleScore는 구제용 폴백이지 색상 점수 통로가 아니다.**
 *
 * 이 보조 신호는 PART K에서 "한쪽만 색상이 분리돼 모델명 교집합이 0이 되는 비대칭"을
 * 구제하려고 도입됐다. 그런데 Math.max로 항상 경쟁시키면, 모델명이 이미 정상 비교되는
 * 경우에도 fullTitle이 색상 토큰을 주워 담아 이긴다. 그 색상은 아래에서 색상 신호로
 * 다시 가산되므로 같은 근거가 두 번 점수가 된다.
 *
 * 실측(감사 24쌍) — 최고 오답 65%가 정확히 이 경로였다. 공유 토큰이 panel/sweatpants
 * (둘 다 유형어)와 grey(색)뿐이고 상품을 특정하는 라인명(Milky Way vs Society)은
 * 하나도 겹치지 않는데, 색상이 두 번 계산돼 데이터셋 최고점이 됐다.
 */
const score = (f: string, b: string, d: string) =>
  scoreCandidateMatch({ title: f, brand: b } as never,
    { title: d, url: "", price: null, imageUrl: null, confidence: 0 } as never) as { confidence: number; reasons: string[] };

describe("색상이 모델명 점수로 둔갑하지 않는다", () => {
  it("핵심 회귀: 라인명이 다른데 유형+색상만 겹친 쌍이 최고점이 되지 않는다", () => {
    // 대표님 판정 NEGATIVE. 수정 전 65%로 데이터셋 최고였다.
    const r = score(
      "The Milky Way Rainbow Panel Sweatpants in Grey by Mini Rodini",
      "Mini Rodini",
      "[Minirodini 미니로디니] Mini Rodini Society Panel Sweatpants -Grey 스웻팬츠",
    );
    expect(r.confidence).toBeLessThan(0.6);
  });

  it("모델명이 이미 비교되고 있으면 fullTitle이 그 결과를 덮어쓰지 않는다", () => {
    // 위와 같은 실측 쌍. 모델명 교집합(panel, sweatpants)은 25%인데, fullTitle은
    // 여기에 grey를 더해 38%를 만든다. 수정 후에는 25%가 채택돼야 한다 —
    // 그 grey는 아래에서 색상 신호로 따로 가산되기 때문이다.
    const r = score(
      "The Milky Way Rainbow Panel Sweatpants in Grey by Mini Rodini",
      "Mini Rodini",
      "[Minirodini 미니로디니] Mini Rodini Society Panel Sweatpants -Grey 스웻팬츠",
    );
    expect(r.reasons).toContain("모델명 유사도 25%");
  });
});

describe("PART K 폴백은 그대로 살아있다", () => {
  it("핵심 회귀: 모델명 교집합이 0인 비대칭은 여전히 구제된다", () => {
    // "Vernice Nero"가 한쪽은 색상으로 분리되고 다른 쪽은 모델명에 남아 modelScore=0이
    // 되는 실측 골든케이스. 이 폴백이 없으면 진짜 동일상품이 0%가 된다.
    const g = score("Lulu T-Bar Shoes in Vernice Nero by PèPè", "Pèpè Shoes", "AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈");
    expect(g.confidence).toBeGreaterThan(0.3);
    expect(g.reasons.some((x) => x.startsWith("모델명 유사도") && x !== "모델명 유사도 0%")).toBe(true);
  });
});

describe("정답 2건은 영향받지 않는다", () => {
  it.each([
    ["[Minirodini 미니로디니] Catsuit Onesie - Black 수트 원시", 0.46],
    ["[Minirodini 미니로디니] Catsuit Baby Onesie - Black 베이비원시", 0.4],
  ])("%s → %d 유지", (domestic, expected) => {
    const r = score("Catsuit Kids Onesie by Mini Rodini", "Mini Rodini", domestic);
    expect(r.confidence).toBeCloseTo(expected, 2);
  });
});
