import { describe, expect, it } from "vitest";
import { resolveBrand, normalizeBrandKey } from "@commerce/crawler";

/**
 * P-13B(대표님/CPO 지시, 2026-08-31) — STEP 1 실측(Evidence 1/2)에서 확인된
 * 유일한 실제 fragmentation 케이스: "Clothing"이 MARKETING_SUFFIX_PATTERN에
 * 없어서 "Konges Sløjd"가 두 그룹으로 갈라져 있었다. 지어낸 케이스 아님 —
 * 전부 실제 production brand 문자열(P-13B STEP0/1 조사).
 */
describe("P-13B — 'Clothing' suffix 규칙 확장", () => {
  it("실측: Konges Slojd Clothing / Konges Sløjd Clothing / Konges Sløjd Summer 26 Drop 1이 전부 같은 normalizedBrandKey로 통합된다", () => {
    const a = resolveBrand("Konges Slojd Clothing");
    const b = resolveBrand("Konges Sløjd Clothing");
    const c = resolveBrand("Konges Sløjd Summer 26 Drop 1");
    expect(a?.normalizedBrandKey).toBe(b?.normalizedBrandKey);
    expect(b?.normalizedBrandKey).toBe(c?.normalizedBrandKey);
    expect(a?.normalizedBrandKey).toBe("konges slojd");
  });

  it("displayBrand는 Clothing 제거 후 표기를 유지한다", () => {
    expect(resolveBrand("Konges Sløjd Clothing")?.displayBrand).toBe("Konges Sløjd");
  });
});

describe("P-13B — 회귀: 기존 정상 케이스 유지", () => {
  it("Misha & Puff 3-way 그룹은 Clothing 규칙 추가와 무관하게 그대로 유지된다", () => {
    const a = resolveBrand("Misha & Puff");
    const b = resolveBrand("Misha & Puff Fall 26 Drop 2");
    const c = resolveBrand("Misha & Puff Winter 25");
    expect(a?.normalizedBrandKey).toBe(b?.normalizedBrandKey);
    expect(b?.normalizedBrandKey).toBe(c?.normalizedBrandKey);
  });
});

describe("P-13B — 오병합 방지: 실제 Production의 나머지 서로 다른 브랜드는 Clothing 규칙 추가로 합쳐지지 않는다", () => {
  // 실측(P-13B STEP0): 현재 Production에 저장된 19개 distinct brand 문자열 전체.
  const productionBrands = [
    "Arsène et Les Pipelettes",
    "Bobo Choses",
    "Bonpoint",
    "Emile et Ida",
    "Hundred Pieces",
    "Konges Slojd Clothing",
    "Konges Sløjd Clothing",
    "Konges Sløjd Summer 26 Drop 1",
    "Liewood",
    "Main Story",
    "Misha & Puff",
    "Misha & Puff Fall 26 Drop 2",
    "Misha & Puff Winter 25",
    "Pèpè Shoes",
    "Smallable Kid",
    "Sofie Schnoor",
    "The Animals Observatory",
    "the new society",
    "Tumble N'Dry",
  ];

  // 실측(P-13B STEP1 Evidence 1)으로 확인된, 이 규칙 추가로 새로 합쳐져야 "맞는" 유일한 그룹.
  const EXPECTED_MERGED_GROUP = new Set([
    "Konges Slojd Clothing",
    "Konges Sløjd Clothing",
    "Konges Sløjd Summer 26 Drop 1",
  ]);

  it("Konges Sløjd 그룹 외의 모든 문자열 쌍은 서로 다른 normalizedBrandKey를 유지한다(19개 실측 문자열 전수 비교)", () => {
    const keyOf = new Map(productionBrands.map((raw) => [raw, normalizeBrandKey(resolveBrand(raw)?.displayBrand ?? raw)]));
    for (let i = 0; i < productionBrands.length; i++) {
      for (let j = i + 1; j < productionBrands.length; j++) {
        const a = productionBrands[i];
        const b = productionBrands[j];
        const bothInMergedGroup = EXPECTED_MERGED_GROUP.has(a) && EXPECTED_MERGED_GROUP.has(b);
        const sameGroupAlready = ["Misha & Puff", "Misha & Puff Fall 26 Drop 2", "Misha & Puff Winter 25"].includes(a) &&
          ["Misha & Puff", "Misha & Puff Fall 26 Drop 2", "Misha & Puff Winter 25"].includes(b);
        if (bothInMergedGroup || sameGroupAlready) {
          expect(keyOf.get(a)).toBe(keyOf.get(b));
        } else {
          expect(keyOf.get(a)).not.toBe(keyOf.get(b));
        }
      }
    }
  });
});
