import { describe, expect, it } from "vitest";
import { resolveBrand, resolveBrandName, normalizeBrandKey } from "@commerce/crawler";

/**
 * P-13A(대표님/CPO 지시, 2026-08-31) — 실측 확인된 실제 문제 케이스만 테스트한다
 * (2026-08-31 STEP 0 조사에서 발견된 실제 raw brand 문자열, 지어낸 값 아님).
 * @commerce/crawler 패키지 자체엔 vitest 설정이 없어(기존 컨벤션) admin 쪽
 * 테스트 트리에 둔다(product-identity.test.ts와 동일 패턴).
 */
describe("P-13A — 풀어쓴 시즌명 처리(기존 약어 패턴의 실측 공백)", () => {
  it("실측: 'Konges Sløjd Summer 26 Drop 1'이 기존엔 안 잘렸다 — 이제 잘려야 한다", () => {
    const result = resolveBrandName("Konges Sløjd Summer 26 Drop 1");
    expect(result?.cleaned).toBe("Konges Sløjd");
    expect(result?.changed).toBe(true);
    expect(result?.confidence).toBe("HIGH");
  });

  it("실측: 'Misha & Puff Winter 25 50% Off Sale' — Winter 25까지 통째로 잘려야 한다", () => {
    const result = resolveBrandName("Misha & Puff Winter 25 50% Off Sale");
    expect(result?.cleaned).toBe("Misha & Puff");
  });

  it("실측: 'Misha & Puff Fall 26 Drop 2' — 이전엔 resolution:null이었다", () => {
    const result = resolveBrandName("Misha & Puff Fall 26 Drop 2");
    expect(result?.cleaned).toBe("Misha & Puff");
    expect(result?.changed).toBe(true);
  });

  it("기존 약어 패턴(AW26/SS26)은 그대로 동작한다(회귀 확인)", () => {
    expect(resolveBrandName("Bobo Choses AW26 Drop 2")?.cleaned).toBe("Bobo Choses");
    expect(resolveBrandName("Bobo Choses SS26 50% Off Sale")?.cleaned).toBe("Bobo Choses");
  });
});

describe("P-13A — diacritic 정규화(normalizeBrandKey)", () => {
  it("실측: 'Konges Slojd Clothing'(ASCII o)과 'Konges Sløjd Clothing'(ø)이 같은 키로 묶여야 한다", () => {
    expect(normalizeBrandKey("Konges Slojd Clothing")).toBe(normalizeBrandKey("Konges Sløjd Clothing"));
  });

  it("결합형 발음기호(Pèpè)는 NFD로 정규화된다", () => {
    expect(normalizeBrandKey("Pèpè Shoes")).toBe("pepe shoes");
  });

  it("표시용 브랜드명(displayBrand)은 원래 표기를 그대로 유지한다 — normalizedBrandKey만 접는다", () => {
    const resolved = resolveBrand("Konges Sløjd Summer 26 Drop 1");
    expect(resolved?.displayBrand).toBe("Konges Sløjd");
    expect(resolved?.normalizedBrandKey).toBe("konges slojd");
  });

  it("서로 다른 브랜드는 절대 같은 키로 묶이지 않는다(과잉병합 방지 확인)", () => {
    expect(normalizeBrandKey("ABC Kids")).not.toBe(normalizeBrandKey("ABC Kids Studio"));
    expect(normalizeBrandKey("ABC Kids")).not.toBe(normalizeBrandKey("ABC"));
  });
});
