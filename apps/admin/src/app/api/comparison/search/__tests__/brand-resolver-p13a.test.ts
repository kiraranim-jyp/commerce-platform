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

/**
 * REWORK-12 ④(CEO 실측 캡처 2026-09-15 + DB 실측) — **문자열 전체가 시즌코드.**
 *
 * 실측(product_snapshots, SELECT only): bobochoses.com 스냅샷 32건의
 * `canonicalProduct.brand.value` 가 전부 `"AW26"` 이었다. Shopify `vendor` 가
 * 그 값이고(오염 기록: packages/category/src/product-resolver.ts L383),
 * shopify-product-json.ts 가 `brand: product.vendor` 로 그대로 옮긴다.
 *
 * 왜 기존 규칙이 못 잡았나 — `earliestMatchAfterStart` 가 index 0 의 매치를
 * 건너뛴다("New Balance"의 New 를 지키는 가드). 문자열이 시즌코드 하나뿐이면
 * 지킬 이름이 애초에 없다.
 *
 * 🔴 이것이 「제조사 미확인」의 근본이었다 — 브랜드가 "AW26" 이면
 * coupang_brand_profiles 조회는 영원히 0건이다.
 */
describe("REWORK-12 ④ — 문자열 전체가 시즌코드면 브랜드가 아니다", () => {
  it("🔴 실측 값 'AW26' 은 브랜드가 아니다 — 빈 값이 되고, 지어내지 않는다", () => {
    const result = resolveBrandName("AW26");
    expect(result?.cleaned).toBe("");
    expect(result?.changed).toBe(true);
    expect(result?.confidence).toBe("HIGH");
    expect(result?.raw).toBe("AW26");
  });

  it("같은 계열 전부 — SS26 · FW25 · 'Winter 25' 도 마찬가지다", () => {
    for (const raw of ["SS26", "FW25", "AW 26", "Winter 25", "summer26"]) {
      expect(resolveBrandName(raw)?.cleaned, raw).toBe("");
    }
  });

  it("🔴 진짜 브랜드는 하나도 건드리지 않는다 — 회귀 방지", () => {
    for (const raw of ["Bobo Choses", "New Balance", "The New Society", "Misha & Puff", "AW Lab"]) {
      expect(resolveBrandName(raw)?.cleaned, raw).toBe(raw);
    }
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
