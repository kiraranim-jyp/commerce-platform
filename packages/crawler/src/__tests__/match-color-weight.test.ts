import { describe, expect, it } from "vitest";
import { scoreCandidateMatch } from "../comparison-search/match";

/**
 * MI-MATCH-FIX-1(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **흔한 색상 하나가 겹쳤다고 다른 상품이 비교상품으로 올라오지 않는다.**
 *
 * 대표님이 27쌍을 직접 판정한 매칭 감사에서, 점수 상위 오답 4건이 전부 "색상
 * 일치(제목 내 확인)" 경로로 올라왔다. 그중 청바지↔반바지, 스웨터↔맨투맨은 70%로
 * medium 등급을 받아 **국내 비교가격에 실제로 반영되고 있었다**. 같은 표본에서 이
 * 경로로 가산을 받은 정답은 한 건도 없었다.
 *
 * 그래서 이 경로의 가산을 구조적 색상 일치(0.4)와 분리해 약신호(0.1)로 낮췄다.
 * 신호를 없애지는 않았다 — 색상명이 그대로 노출돼 실제 동일상품을 가리키는 경우가
 * 있기 때문이다(PART K "Vernice Nero").
 */
const cand = (title: string) => ({ title, url: "", price: null, imageUrl: null, confidence: 0 }) as never;
const score = (foreign: string, brand: string, domestic: string) =>
  scoreCandidateMatch({ title: foreign, brand } as never, cand(domestic)) as { confidence: number; level: string; reasons: string[] };

describe("색상 우연 일치가 오답을 비교상품으로 올리지 않는다", () => {
  it("핵심 회귀: 청바지 ↔ 반바지가 색상만 같다고 medium이 되지 않는다", () => {
    // 실측(대표님 판정 #22) — 수정 전 70%로 medium이었다.
    const r = score(
      "Blossoms Twill Jeans in Off White by Tinycottons",
      "Tinycottons",
      "[Tinycottons 타이니코튼] Flamingos short - off white",
    );
    expect(r.confidence).toBeLessThan(0.7);
    expect(r.level).toBe("low");
  });

  it("핵심 회귀: 스웨터 ↔ 맨투맨도 마찬가지다", () => {
    // 실측(대표님 판정 #25) — 수정 전 70%.
    const r = score(
      "Stripes Sweater in Dusty Yellow by Tinycottons",
      "Tinycottons",
      "[Tinycottons 타이니코튼] Rock'n Roll Sweatshirt - dusty yellow",
    );
    expect(r.confidence).toBeLessThan(0.7);
  });

  it("스웨터 ↔ 양말처럼 유형이 완전히 다른 것도 낮게 남는다", () => {
    // 실측(대표님 판정 #19) — 수정 전 63%.
    const r = score(
      "Stripes Sweater in Ultramarine by Tinycottons",
      "Tinycottons",
      "타이니코튼 긴목 양말-울트라마린 Tiny Medium Height socks - ultramarine [457] tinycottons",
    );
    expect(r.confidence).toBeLessThan(0.6);
  });
});

describe("색상 신호를 없애지는 않았다", () => {
  it("제목 내 색상 확인은 여전히 근거로 남는다 — 판단 근거가 사라지면 안 된다", () => {
    const r = score("Lulu T-Bar Shoes in Vernice Nero by PèPè", "Pèpè Shoes", "AW26 RE[페페슈즈]VERNICE NERO T-스트랩 슈즈");
    expect(r.reasons).toContain("색상 일치(제목 내 확인)");
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("양쪽이 모두 색상을 분리해낸 구조적 일치는 약해지지 않았다", () => {
    // "in X by Y"가 양쪽에 다 있는 경우 — 이 경로는 손대지 않았다.
    const same = score("Nolan Pile Jacket in Riverside by Liewood", "Liewood", "Nolan Pile Jacket in Riverside by Liewood");
    expect(same.reasons).toContain("색상 일치");
    expect(same.confidence).toBeGreaterThan(0.9);
  });

  it("색상 불일치 감점은 그대로다", () => {
    const diff = score("Nolan Pile Jacket in Riverside by Liewood", "Liewood", "Nolan Pile Jacket in Sandy by Liewood");
    expect(diff.reasons).toContain("색상 불일치");
  });
});
