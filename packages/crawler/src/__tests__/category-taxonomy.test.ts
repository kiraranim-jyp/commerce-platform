import { describe, expect, it } from "vitest";
import { extractCategoryTaxon, scoreCandidateMatch } from "../comparison-search/match";

/**
 * MI-MATCH-FIX-2(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건 두 가지:
 *  ① 명백히 다른 상품 유형(스웨터↔양말, 맨투맨↔스커트)은 불일치로 잡힌다.
 *  ② **브랜드명 때문에 유형이 잘못 잡히지 않는다.**
 *
 * ②가 특히 중요하다. 이 매칭은 형태소 분석 없이 정규화 문자열의 부분포함만 보는데,
 * normalizeText가 NFKD로 한글을 자모 분해하기 때문에 "코트"가 "타이니코튼"의 부분
 * 문자열이 된다. 실제로 taxonomy를 넓히다가 양말·반바지가 OUTER로 잡히는 것을
 * 실측으로 발견했다 — 점수는 좋아졌지만 틀린 이유였다. 짧은 한글 유형어를 추가할
 * 때마다 이 함정이 되살아나므로 여기서 못 박는다.
 */
describe("확장된 taxonomy — 실측에서 관측된 유형어를 잡는다", () => {
  it.each([
    ["[Minirodini 미니로디니] Catsuit Onesie - Black 수트 원시", "ONE_PIECE"],
    ["[Minirodini 미니로디니] Tulle Skirt - Black 튤스커트", "SKIRT"],
    ["AW26 2차[미니로디니]Rabbits 올오버 패딩자켓-MR26KAPAD0101BLK", "OUTER"],
    ["[Minirodini 미니로디니] Alaska stripe glove - black", "ACCESSORY"],
    ["타이니코튼 긴목 양말-울트라마린 Tiny Medium Height socks [457]", "ACCESSORY"],
    ["[Tinycottons 타이니코튼] Peace sweater - almond", "TOP"],
    ["Blossoms Twill Jeans in Off White by Tinycottons", "PANTS"],
  ])("%s → %s", (title, taxon) => {
    expect(extractCategoryTaxon(title)).toBe(taxon);
  });
});

describe("핵심 회귀 — 브랜드명이 유형을 오염시키지 않는다", () => {
  it("'타이니코튼'(Tinycottons)이 OUTER로 잡히지 않는다", () => {
    // "코트"를 넣으면 NFKD 분해 후 "타이니코튼"에 부분일치한다. 넣지 않았다.
    expect(extractCategoryTaxon("[Tinycottons 타이니코튼] Flamingos short - off white")).not.toBe("OUTER");
    expect(extractCategoryTaxon("[Tinycottons 타이니코튼] Tiny Music Tee - Off white")).not.toBe("OUTER");
  });

  it("'미니로디니'가 어떤 유형으로도 잡히지 않는다", () => {
    expect(extractCategoryTaxon("[Minirodini 미니로디니]")).toBeNull();
  });
});

const score = (f: string, b: string, d: string) =>
  scoreCandidateMatch({ title: f, brand: b } as never,
    { title: d, url: "", price: null, imageUrl: null, confidence: 0 } as never) as { confidence: number; reasons: string[] };

describe("다른 유형 상품은 확실히 걸러진다", () => {
  it("핵심 회귀: 스웨터 ↔ 양말은 불일치로 감점된다", () => {
    // 실측(대표님 판정 #19) — 확장 전에는 신호가 아예 없어 45%였다.
    const r = score("Stripes Sweater in Ultramarine by Tinycottons", "Tinycottons",
      "타이니코튼 긴목 양말-울트라마린 Tiny Medium Height socks - ultramarine [457] tinycottons");
    expect(r.reasons).toContain("카테고리 불일치");
    expect(r.confidence).toBeLessThan(0.45);
  });

  it("핵심 회귀: 맨투맨 ↔ 스커트도 불일치로 감점된다", () => {
    const r = score("Space Tour Sweatshirt in Black by Mini Rodini", "Mini Rodini",
      "[Minirodini 미니로디니] Tulle Skirt - Black 튤스커트");
    expect(r.reasons).toContain("카테고리 불일치");
    expect(r.confidence).toBeLessThan(0.15);
  });

  it("원피스형 ↔ 아우터도 불일치다", () => {
    const r = score("Catsuit Kids Onesie by Mini Rodini", "Mini Rodini",
      "AW26 2차[미니로디니]Rabbits 올오버 패딩자켓-MR26KAPAD0101BLK");
    expect(r.reasons).toContain("카테고리 불일치");
  });
});

describe("같은 유형인 정답은 신호를 받는다", () => {
  it("onesie ↔ onesie는 일치로 잡힌다 — 확장 전에는 둘 다 미검출이었다", () => {
    // 대표님이 동일상품으로 확정한 유일한 정답쌍(#1).
    const r = score("Catsuit Kids Onesie by Mini Rodini", "Mini Rodini",
      "[Minirodini 미니로디니] Catsuit Onesie - Black 수트 원시");
    expect(r.reasons).toContain("카테고리 일치");
  });

  it("TOP은 세분화하지 않는다 — 맨투맨과 티셔츠는 같은 유형으로 둔다", () => {
    // 해외/국내가 같은 상품을 다르게 부르는 일이 흔해 세분화는 보류(CPO 지시).
    expect(extractCategoryTaxon("Sweatshirt")).toBe(extractCategoryTaxon("티셔츠"));
  });
});
