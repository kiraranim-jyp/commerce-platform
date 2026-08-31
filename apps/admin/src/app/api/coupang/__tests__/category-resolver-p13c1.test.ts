import { describe, expect, it } from "vitest";
import { resolveProductSignals, KNOWN_KIDS_BRANDS } from "@commerce/category";

/**
 * P-13C-1(2026-08-31) — Category Resolver Type 1(결정론적 신호 누락) 최소
 * 수정 회귀 테스트. P-13C STEP 2/3에서 실측으로 확인된 프랑스어 연령/성별
 * 신호 누락 + 두 아동 브랜드 미인식 케이스를 고정한다. Type 2("robe" 언어
 * 충돌)/Type 4(완구/아우터 leaf 특이성 부족)는 이번 범위 밖 — 그대로 미해결
 * 상태를 기대값으로 남긴다.
 */

type ResolverInput = Parameters<typeof resolveProductSignals>[0];

function product(overrides: Partial<ResolverInput>): ResolverInput {
  const field = (value: string) => ({ value, source: "ORIGINAL" as const, confidence: 1 });
  return {
    title: field(""),
    description: field(""),
    brand: field(""),
    recommendedAge: field(""),
    breadcrumbPath: undefined,
    jsonLdCategory: undefined,
    sourceUrl: "https://example.com/product",
    shopifyTags: undefined,
    shopifyProductType: undefined,
    ...overrides,
  } as ResolverInput;
}

describe("P-13C-1: 프랑스어 연령 신호", () => {
  it('breadcrumb "Mode Enfant" -> ageGroup=kids', () => {
    const signals = resolveProductSignals(
      product({ breadcrumbPath: ["Home", "Mode Enfant", "Fille"] } as Partial<ResolverInput>),
    );
    expect(signals.ageGroup).toBe("kids");
  });

  it('title "Femme" -> ageGroup=adult', () => {
    const signals = resolveProductSignals(
      product({ title: { value: "Robe Femme", source: "ORIGINAL", confidence: 1 } } as Partial<ResolverInput>),
    );
    expect(signals.ageGroup).toBe("adult");
  });

  it('title "Homme" -> ageGroup=adult', () => {
    const signals = resolveProductSignals(
      product({ title: { value: "Pull Homme", source: "ORIGINAL", confidence: 1 } } as Partial<ResolverInput>),
    );
    expect(signals.ageGroup).toBe("adult");
  });
});

describe("P-13C-1: 프랑스어 성별 신호", () => {
  it('breadcrumb "Fille" -> gender=girl', () => {
    const signals = resolveProductSignals(
      product({ breadcrumbPath: ["Home", "Mode Enfant", "Fille"] } as Partial<ResolverInput>),
    );
    expect(signals.gender).toBe("girl");
  });

  it('breadcrumb "Garçon" -> gender=boy', () => {
    const signals = resolveProductSignals(
      product({ breadcrumbPath: ["Home", "Mode Adolescent", "Garçon"] } as Partial<ResolverInput>),
    );
    expect(signals.gender).toBe("boy");
  });
});

describe("P-13C-1: 실제 상품 회귀 케이스(STEP2/3)", () => {
  it("Jupe Iris — 여아 스커트로 판단 가능해야 한다", () => {
    const signals = resolveProductSignals(
      product({
        title: { value: "Jupe Iris | Ecru", source: "ORIGINAL", confidence: 1 },
        description: {
          value: "Jupe courte en coton Dobby écru ligné de rayures mates et brillantes",
          source: "ORIGINAL",
          confidence: 1,
        },
        brand: { value: "Emile et Ida", source: "ORIGINAL", confidence: 1 },
        breadcrumbPath: ["Home", "Mode  Enfant", "Fille", "Bloomer, short, jupe", "Jupe Iris | Ecru"],
      } as Partial<ResolverInput>),
    );
    expect(signals.ageGroup).toBe("kids");
    expect(signals.gender).toBe("girl");
    expect(signals.productType).toBe("스커트");
  });

  it("Skating Pond Skirt(Misha & Puff) — demographic이 kids로 개선돼야 한다", () => {
    const signals = resolveProductSignals(
      product({
        title: {
          value: "Skating Pond Skirt in Snowglobe Confetti by Misha & Puff - Last Ones In Stock - 4-8 Years",
          source: "ORIGINAL",
          confidence: 1,
        },
        brand: { value: "Misha & Puff Winter 25", source: "ORIGINAL", confidence: 1 },
        shopifyTags: "dresses-and-skirts, skirt, skirts, misha-puff",
      } as Partial<ResolverInput>),
    );
    // 브랜드가 KNOWN_KIDS_BRANDS에 새로 들어가서 unknown/adult가 아니라 kids로
    // 개선된다 — dress/skirt 태그 충돌(Type 2)은 이번 범위 밖이라 productType
    // 자체가 완전히 옳다고 단정하지 않는다.
    expect(signals.ageGroup).toBe("kids");
  });

  it("Bermuda Denim Conrad — Garçon 신호가 gender=boy로 인식돼야 한다", () => {
    const signals = resolveProductSignals(
      product({
        title: { value: "Bermuda Denim Conrad | Bleu jean", source: "ORIGINAL", confidence: 1 },
        brand: { value: "Hundred Pieces", source: "ORIGINAL", confidence: 1 },
        breadcrumbPath: ["Home", "Mode  Adolescent", "Garçon", "Bloomer, short, jupe", "Bermuda Denim Conrad | Bleu jean"],
      } as Partial<ResolverInput>),
    );
    expect(signals.gender).toBe("boy");
  });
});

describe("P-13C-1: Known Kids Brand", () => {
  it.each(["Misha & Puff", "misha & puff", "The Animals Observatory", "the animals observatory"])(
    '"%s" 브랜드는 아동 전문 브랜드로 인식돼야 한다',
    (brandName) => {
      const signals = resolveProductSignals(
        product({
          title: { value: "Some Product", source: "ORIGINAL", confidence: 1 },
          brand: { value: brandName, source: "ORIGINAL", confidence: 1 },
        } as Partial<ResolverInput>),
      );
      expect(signals.ageGroup).toBe("kids");
    },
  );

  it("KNOWN_KIDS_BRANDS 목록에 실제로 포함돼 있다", () => {
    expect(KNOWN_KIDS_BRANDS).toContain("misha & puff");
    expect(KNOWN_KIDS_BRANDS).toContain("the animals observatory");
  });
});

describe("P-13C-1: 회귀 방지 — PèPè 신발군(기존 정상 케이스)", () => {
  const pepeCases = [
    "Lulu T Bar Shoes in Vernice Nero by PèPè",
    "Ginevra Patent Leather Ballet Slippers in Black by PèPè",
    "Bruno Cut Out Sandals in Lobelia Blue by PèPè",
    "Lucy Cut Out Sandals in Kava Brown by PèPè",
    "Giulia Flower Sandals in Ombretto Pink by PèPè",
    "Darlyn Glitter Ballet Slippers in Miele by PèPè",
  ];

  it.each(pepeCases)('"%s" — productType=신발 유지, 새 프랑스어 키워드로 인한 회귀 없음', (title) => {
    const signals = resolveProductSignals(
      product({
        title: { value: title, source: "ORIGINAL", confidence: 1 },
        brand: { value: "Pèpè Shoes", source: "ORIGINAL", confidence: 1 },
        shopifyTags: "footwear, pepe-shoes, shoes, small",
        shopifyProductType: "Shoes",
      } as Partial<ResolverInput>),
    );
    expect(signals.productType).toBe("신발");
  });
});
