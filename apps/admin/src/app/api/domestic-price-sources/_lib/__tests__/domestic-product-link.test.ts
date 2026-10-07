import { describe, expect, it } from "vitest";
import { priceTierFromLink } from "../domestic-product-link";

/**
 * P-19-B Sprint 6/10(CPO 지시, 2026-09-02) — "SKU·모델코드 등 식별자 근거 없이,
 * 텍스트 유사도만으로 동일상품 확인/verified 처리 금지" 원칙을 priceTierFromLink()
 * 하나로 고정한다. T1~T4에 해당한다.
 */
describe("priceTierFromLink", () => {
  it("T2) 브랜드 + SKU/모델코드 정확 일치(EXACT_IDENTIFIER) → EXACT", () => {
    expect(priceTierFromLink({ matchTruth: "EXACT_IDENTIFIER", verified: true })).toBe("EXACT");
  });

  it("브랜드 + 강한 구조화 식별자 일치(STRONG_IDENTIFIER) → EXACT", () => {
    expect(priceTierFromLink({ matchTruth: "STRONG_IDENTIFIER", verified: true })).toBe("EXACT");
  });

  it("T1) 텍스트 99% + SKU 없음(TEXT_CONFIRMED, 식별자 없음) → COMPARISON, EXACT로 승격 금지", () => {
    expect(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false })).toBe("COMPARISON");
  });

  /** MI P0 IDENTITY PRECISION FIX(CPO 결정 2, 2026-10-07) — SIMILAR 은 바로 위
   *  TEXT_CONFIRMED 와 «같은 칸» 이 아니다. 「제한적 가격 참고」(COMPARISON)와
   *  「경쟁상품 참고」(REFERENCE)를 가른다 — REFERENCE 는 가격비교 버킷에 들어가지
   *  않고, 가격 재조회 대상에만 남는다. */
  it("브랜드 + 상품명 매우 유사, 식별자 없음(SIMILAR) → REFERENCE (가격비교 아님)", () => {
    expect(priceTierFromLink({ matchTruth: "SIMILAR", verified: false })).toBe("REFERENCE");
    // 🔴 TEXT_CONFIRMED 와 «다른» 칸이라는 것 자체가 이 결정의 내용이다.
    expect(priceTierFromLink({ matchTruth: "SIMILAR", verified: false })).not.toBe(
      priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false }),
    );
  });

  it("T3/T4) 브랜드/모델 충돌(CONFLICT) → EXCLUDED, 동일상품 가격/비교상품 가격 어느 쪽에도 사용 금지", () => {
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
  });

  it("근거 부족(INSUFFICIENT_EVIDENCE) → EXCLUDED", () => {
    expect(priceTierFromLink({ matchTruth: "INSUFFICIENT_EVIDENCE", verified: false })).toBe("EXCLUDED");
  });

  it("레거시 행(matchTruth=null, 마이그레이션 030 이전) — verified로만 판단, 일괄 backfill 없음", () => {
    expect(priceTierFromLink({ matchTruth: null, verified: true })).toBe("EXACT");
    expect(priceTierFromLink({ matchTruth: null, verified: false })).toBe("COMPARISON");
  });
});
