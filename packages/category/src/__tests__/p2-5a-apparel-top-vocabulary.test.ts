import { describe, expect, it } from "vitest";
import { scoreCategoryCandidate } from "../candidate-scoring";
import { resolveProductSignals } from "../product-resolver";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-5a-1 — 의류 상의 어휘 2개 (CPO 확정, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 오추천: Magro Long Sleeve 의 롯데ON 추천 1순위가
 * 「가방/지갑 > 남성가방 53점」이고 「스포츠 > 테니스 > 테니스의류」가 50점이었다.
 *
 * 🔴 원인은 scoring 가중치가 «아니다». `productType` 이 null 이어서 유형 대조가
 * 통째로 생략되고, 남은 신호인 성별(「남성」)만 +3 을 준 것이다. 이미 있던
 * `APPAREL_CONFLICT`(가방·신발 포함)가 발동할 기회조차 없었다.
 *
 * 그래서 이 파일은 **점수의 «방향 전환»** 을 고정한다 — 숫자 자체가 아니라
 * 「타 상품군이 conflict 로 걸러지는가」가 계약이다.
 */
const ADULT_MEN = { gender: "men", ageGroup: "adult" } as const;

const CANDIDATES = {
  남성가방: ["가방/지갑", "남성가방"],
  남성신발: ["신발", "남성신발"],
  남성티셔츠: ["패션의류", "남성의류", "남성 티셔츠"],
  테니스의류: ["스포츠", "테니스", "테니스의류"],
} as const;

const scoreOf = (key: keyof typeof CANDIDATES, productType: string | null) =>
  scoreCategoryCandidate(key, [...CANDIDATES[key]], { productType, ...ADULT_MEN } as never);

describe("① 🔴 고치기 전 상태를 못박는다 — productType null 이면 타 상품군이 이긴다", () => {
  it("남성가방·남성신발이 테니스의류보다 «높다»", () => {
    const bag = scoreOf("남성가방", null);
    const shoe = scoreOf("남성신발", null);
    const tennis = scoreOf("테니스의류", null);
    /* 이것이 실측된 53 / 50 의 구조다. */
    expect(bag.score).toBeGreaterThan(tennis.score);
    expect(shoe.score).toBeGreaterThan(tennis.score);
    /* 🔴 그리고 아무것도 conflict 로 걸리지 않는다 — 걸러낼 근거가 없다. */
    expect(bag.conflict).toBe(false);
    expect(shoe.conflict).toBe(false);
  });
});

describe("② 🔴 어휘가 잡히면 가방·신발이 conflict 로 «제외» 된다", () => {
  /* productType 이 「티셔츠」로 잡힌 뒤의 상태. */
  it("남성가방 — 5점 · conflict=true", () => {
    const r = scoreOf("남성가방", "티셔츠");
    expect(r.conflict).toBe(true);
    expect(r.score).toBe(5);
    expect(r.reason).toContain("가방");
  });

  it("남성신발 — 5점 · conflict=true", () => {
    const r = scoreOf("남성신발", "티셔츠");
    expect(r.conflict).toBe(true);
    expect(r.score).toBe(5);
  });

  it("🔴 방향이 뒤집힌다 — 의류 후보가 가방·신발보다 위다", () => {
    const tee = scoreOf("남성티셔츠", "티셔츠");
    const tennis = scoreOf("테니스의류", "티셔츠");
    for (const other of [scoreOf("남성가방", "티셔츠"), scoreOf("남성신발", "티셔츠")]) {
      expect(tee.score).toBeGreaterThan(other.score);
      expect(tennis.score).toBeGreaterThan(other.score);
    }
  });

  it("🔴 다만 테니스가 1순위는 «아직» 아니다 — P2-5a-2 가 할 일", () => {
    /* expect 목록이 ["티셔츠"] 라서 「테니스의류」에는 히트가 없다(60점).
       이 사실을 적어 두지 않으면 다음 사람이 「다 고쳐졌다」고 읽는다. */
    expect(scoreOf("남성티셔츠", "티셔츠").score).toBeGreaterThan(scoreOf("테니스의류", "티셔츠").score);
  });
});

describe("③ 🔴 기존 상품군 추천이 깨지지 않는다 (회귀)", () => {
  it("가방 상품에서는 가방 카테고리가 맞는 답이다", () => {
    const r = scoreOf("남성가방", "가방");
    expect(r.conflict).toBe(false);
    expect(r.score).toBeGreaterThan(scoreOf("남성티셔츠", "가방").score);
  });

  it("신발 상품에서는 신발 카테고리가 맞는 답이다", () => {
    const r = scoreOf("남성신발", "신발");
    expect(r.conflict).toBe(false);
    expect(r.score).toBeGreaterThan(scoreOf("남성가방", "신발").score);
  });

  it("🔴 골프 상품군은 손대지 않았다 — 의류 카테고리가 conflict 로 남는다", () => {
    const apparel = scoreCategoryCandidate(
      "골프웨어",
      ["스포츠/레저", "골프", "골프웨어"],
      { productType: "골프드라이버", ...ADULT_MEN } as never,
    );
    /* GOLF_OUTER_CONFLICT 에 「의류」가 있고 골프 형제(골프웨어)도 들어 있다. */
    expect(apparel.conflict).toBe(true);
  });

  it("홈/리빙·뷰티 판정이 그대로다", () => {
    expect(scoreCategoryCandidate("침구", ["홈", "침구"], { productType: "홈/리빙", ...ADULT_MEN } as never).score).toBe(95);
    expect(
      scoreCategoryCandidate("스킨케어", ["뷰티", "스킨케어"], { productType: "뷰티", ...ADULT_MEN } as never).score,
    ).toBe(95);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   ④ 어휘가 «실제 상품명» 에서 잡히는가 — resolver 단
   ════════════════════════════════════════════════════════════════════════════ */
const f = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 1 });
const product = (title: string, description = "") =>
  resolveProductSignals({
    title: f(title),
    description: f(description),
    brand: f(""),
    recommendedAge: f(""),
    sourceUrl: "https://example.com/p",
  } as never);

describe("④ 🔴 실측 상품명에서 productType 이 잡힌다", () => {
  it("Long Sleeve — 실측 STMMLS", () => {
    expect(product("Sergio Tacchini Men's Magro Long Sleeve").productType).toBe("티셔츠");
  });

  it("Polo — 실측 STMFTP", () => {
    expect(product("Sergio Tacchini Men's Trattino Polo").productType).toBe("티셔츠");
  });

  it("기존 어휘가 그대로다", () => {
    expect(product("Organic Cotton Tee").productType).toBe("티셔츠");
    expect(product("Kids T-Shirt").productType).toBe("티셔츠");
  });
});

describe("⑤ 🔴 알려진 한계 — 표 «순서» 가 가방·신발을 보호한다", () => {
  it("「Polo」가 들어간 가방은 여전히 가방이다 — 가방이 티셔츠보다 앞이다", () => {
    expect(product("Polo Ralph Lauren Leather Backpack").productType).toBe("가방");
  });

  it("「Polo」가 들어간 신발도 신발이다", () => {
    expect(product("Polo Ralph Lauren Sneakers").productType).toBe("신발");
  });

  it("🔴 한계를 적어 둔다 — 상품군 단어가 «없는» 폴로 브랜드 상품은 티셔츠로 잡힌다", () => {
    /* 이 경우 의류 conflict(가방·신발·가전…)에 걸리는 카테고리만 5점이 되고,
       뷰티처럼 APPAREL_CONFLICT 밖인 카테고리는 60점으로 남아 등록을 막지 않는다.
       `top` 을 이번에 보류한 것과 같은 이유로, 넓히기 전에 실측이 필요하다. */
    expect(product("Polo Ralph Lauren Eau de Toilette 100ml").productType).toBe("티셔츠");
  });

  it("🔴 「top」은 넣지 않았다 — 「Top Rated」가 의류로 잡히지 않는다", () => {
    expect(product("Wireless Earbuds", "Top Rated by customers").productType).not.toBe("티셔츠");
  });
});
