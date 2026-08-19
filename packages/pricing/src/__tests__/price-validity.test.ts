import { describe, expect, it } from "vitest";
import { resolveSourcePrice } from "../price-validity";

/**
 * N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고, 계산했으면
 * 그 가격의 근거가 무엇인지 보여줘야 한다") — STEP11에서 지정한 8개 케이스를
 * 그대로 코드로 고정한다. 실제 계기는 Smallable(smallable.com) T-shirt Nils
 * Coton Bio 상품에서 Source Data 가격=0.00인데 아래 가격 계산 패널은 배송비만
 * 으로 ₩15,400을 만들어낸 모순이었다 — 두 값 다 근본적으로 "원본 가격을
 * 못 읽었다"는 같은 원인에서 나온 서로 다른 증상이었다.
 */
describe("N-3.54 STEP11: resolveSourcePrice — 8개 필수 케이스", () => {
  it("1) sourcePrice=29, currency=EUR → VALID", () => {
    const r = resolveSourcePrice(29, "EUR");
    expect(r).toEqual({ validity: "VALID", amount: 29, currency: "EUR" });
  });

  it("2) sourcePrice=0, currency=EUR → INVALID(0 이하)", () => {
    const r = resolveSourcePrice(0, "EUR");
    expect(r.validity).toBe("INVALID");
    expect(r.amount).toBe(0);
    expect(r.currency).toBe("EUR");
  });

  it("3) sourcePrice=null, currency=EUR → MISSING", () => {
    const r = resolveSourcePrice(null, "EUR");
    expect(r.validity).toBe("MISSING");
    expect(r.amount).toBeNull();
  });

  it("4) sourcePrice=29, currency=null → MISSING(통화 없음)", () => {
    const r = resolveSourcePrice(29, null);
    expect(r.validity).toBe("MISSING");
    expect(r.currency).toBeNull();
  });

  it('5) "29,00 €" → {amount:29, currency:EUR}(유럽식 소수점 콤마)', () => {
    const r = resolveSourcePrice("29,00 €", undefined);
    expect(r).toMatchObject({ validity: "VALID", amount: 29, currency: "EUR" });
  });

  it('6) "35,00 $US" → {amount:35, currency:USD}', () => {
    const r = resolveSourcePrice("35,00 $US", undefined);
    expect(r).toMatchObject({ validity: "VALID", amount: 35, currency: "USD" });
  });

  it('7) "가격 확인 필요"(텍스트, 숫자 없음) → INVALID', () => {
    const r = resolveSourcePrice("가격 확인 필요", undefined);
    expect(r.validity).toBe("INVALID");
    expect(r.rawText).toBe("가격 확인 필요");
  });

  it("8) 정상 가격 + FX 조회 실패 → UNRESOLVED", () => {
    const r = resolveSourcePrice(29, "EUR", { rateAvailable: false });
    expect(r.validity).toBe("UNRESOLVED");
    expect(r.amount).toBe(29);
    expect(r.currency).toBe("EUR");
  });
});

describe("N-3.54: 미국식 천단위 구분자는 기존처럼 콤마를 제거만 한다(회귀)", () => {
  it('"1,234.56" → 1234.56', () => {
    const r = resolveSourcePrice("1,234.56", "USD");
    expect(r).toMatchObject({ validity: "VALID", amount: 1234.56, currency: "USD" });
  });

  it('순수 숫자 문자열 "2900"(콤마 없음) → 2900 그대로', () => {
    const r = resolveSourcePrice("2900", "KRW");
    expect(r).toMatchObject({ validity: "VALID", amount: 2900, currency: "KRW" });
  });
});
