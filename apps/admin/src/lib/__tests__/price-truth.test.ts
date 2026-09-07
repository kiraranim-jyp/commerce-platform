import { describe, expect, it } from "vitest";
import { computeFxLine, computeKrwAmount, formatMoney, isOnSale, isPriceDisplayable } from "../price-truth";

/** P-4-DATA-7(CPO 지시, 2026-08-29) — 불변조건 1/3/4를 직접 코드 레벨에서
 * 보증한다. ComparisonShopSearch.tsx(PriceCell/SourceVerificationCard)가
 * 이 파일의 함수를 그대로 가져다 쓰므로, 여기 테스트가 통과하면 실제 화면도
 * 같은 규칙을 따른다(로직 중복 없음 — UI 안에서 재구현하지 않음). */

describe("P-4-DATA-7 불변조건 1 — VERIFIED_CURRENT 가격만 숫자 표시 가능", () => {
  it("VERIFIED_CURRENT + price 있음 → 표시 가능", () => {
    expect(isPriceDisplayable("VERIFIED_CURRENT", { amount: 37, currency: "GBP" })).toBe(true);
  });

  it("VERIFIED_CURRENT인데 price가 null이면(모순 상태) 표시 불가", () => {
    expect(isPriceDisplayable("VERIFIED_CURRENT", null)).toBe(false);
  });

  it("PT-04(Hug Hairy Monster 재현): matchLevel=very_high여도 priceStatus=PRICE_UNAVAILABLE이면 숫자 비노출", () => {
    // 매칭 신뢰도(matchLevel)는 이 함수의 입력이 아니다 — priceStatus만 본다는 것 자체가
    // "동일상품 100%"도 가격 검증 실패 시 예외 없이 숨긴다는 불변조건의 증거.
    expect(isPriceDisplayable("PRICE_UNAVAILABLE", { amount: 62, currency: "GBP" })).toBe(false);
  });

  it("PT-03(Misha & Puff Mink 재현): 검색 인덱스 원값(£270)이 있어도 UNVERIFIED_SEARCH면 숫자 비노출", () => {
    expect(isPriceDisplayable("UNVERIFIED_SEARCH", { amount: 270, currency: "GBP" })).toBe(false);
  });

  it("priceStatus가 undefined(구버전 스냅샷 등 마이그레이션 이전 데이터)면 안전 측(숨김)으로 처리", () => {
    expect(isPriceDisplayable(undefined, { amount: 37, currency: "GBP" })).toBe(false);
  });
});

describe("P-4-DATA-7 불변조건 3/4 — KRW 참고환산은 단일 FX 소스, 조회 실패 시 숫자 비노출", () => {
  const krwRates = { GBP: 1851.8518518518517, USD: 1369.8630136986303 };

  it("PT-01(Booty Ghosts Long Sleeve 실측): £37 × 1,851.85 ≈ ₩68,519", () => {
    expect(computeKrwAmount(37, "GBP", krwRates)).toBe(68519);
  });

  it("PT-02(Booty Ghosts T-Shirt 실측): £35 × 1,851.85 ≈ ₩64,815(CPO 목표 수치 ₩64,820과 반올림 오차 5원 이내 일치)", () => {
    expect(computeKrwAmount(35, "GBP", krwRates)).toBe(64815);
  });

  it("krwRates가 null이면(환율 조회 자체 실패) KRW 숫자를 만들지 않는다 — 추측 금지", () => {
    expect(computeKrwAmount(37, "GBP", null)).toBeNull();
  });

  it("krwRates에 해당 통화가 없으면(지원 목록 밖) KRW 숫자를 만들지 않는다", () => {
    expect(computeKrwAmount(37, "SEK", krwRates)).toBeNull();
  });

  it("PT-07 연관: 환율 병기 문구가 실제 사용된 환율을 그대로 보여준다", () => {
    expect(computeFxLine("GBP", krwRates, "frankfurter")).toBe("기준 환율 1 GBP = ₩1,852");
  });

  it("환율 소스가 fallback(고정 참고환율)이면 그 사실을 문구에 명시한다 — Frankfurter 실시간 조회와 혼동 금지", () => {
    expect(computeFxLine("GBP", krwRates, "fallback")).toBe("기준 환율 1 GBP = ₩1,852 (실시간 조회 실패 — 고정 참고환율)");
  });

  it("환율이 없으면 fxLine도 null — computeKrwAmount와 항상 동일한 조건으로 숨긴다(불일치 방지)", () => {
    expect(computeFxLine("GBP", null, null)).toBeNull();
  });
});

describe("P-4-DATA-7 PT-05(Voyage Dress 재현) — 세일 판정: 정가가 판매가보다 클 때만 할인", () => {
  it("£51.20 판매가 / £128 정가 → 할인 중", () => {
    expect(isOnSale({ amount: 51.2 }, { amount: 128 })).toBe(true);
  });

  it("정가가 없으면(null) 할인 아님 — 추측 금지", () => {
    expect(isOnSale({ amount: 51.2 }, null)).toBe(false);
  });

  it("정가와 판매가가 같으면 할인 아님(사이트가 정가를 판매가와 동일하게 채워 보내는 경우 오탐 방지)", () => {
    expect(isOnSale({ amount: 37 }, { amount: 37 })).toBe(false);
  });

  it("정가가 판매가보다 낮으면(데이터 오류) 할인으로 취급하지 않는다", () => {
    expect(isOnSale({ amount: 37 }, { amount: 30 })).toBe(false);
  });
});

/** MI-UX-9(CPO 지시, 2026-09-07 §3/§4) — CEO가 Production에서 확인한
 * `177900.00 KRW` 표기를 코드 레벨에서 막는다. 표시 포맷만 바꾸는 함수이고
 * 계산에 쓰는 raw number는 건드리지 않는다. */
describe("MI-UX-9 §4 — formatMoney: 사람이 읽는 통화 표기", () => {
  it("핵심 회귀: 177900 KRW는 `177900.00 KRW`가 아니라 `₩177,900`", () => {
    expect(formatMoney(177900, "KRW")).toBe("₩177,900");
  });

  it("KRW/JPY는 최소 단위가 1이므로 소수점을 붙이지 않는다", () => {
    expect(formatMoney(159000, "KRW")).toBe("₩159,000");
    expect(formatMoney(1200, "JPY")).toBe("¥1,200");
  });

  it("소수 단위가 있는 통화는 두 자리를 유지한다(£59 → £59.00)", () => {
    expect(formatMoney(59, "GBP")).toBe("£59.00");
    expect(formatMoney(1234.5, "EUR")).toBe("€1,234.50");
  });

  it("천단위 구분이 항상 들어간다 — 자릿수를 눈으로 비교할 수 있어야 한다", () => {
    expect(formatMoney(1234567, "KRW")).toBe("₩1,234,567");
  });

  it("심볼을 모르는 통화는 심볼을 지어내지 않고 코드를 뒤에 붙인다", () => {
    expect(formatMoney(1234, "SEK")).toBe("1,234.00 SEK");
  });

  it("통화 코드가 소문자로 와도 같은 결과", () => {
    expect(formatMoney(177900, "krw")).toBe("₩177,900");
  });

  it("값이 없으면 0원으로 떨어뜨리지 않는다 — 0원과 미확인은 다르다", () => {
    expect(formatMoney(null, "KRW")).toBe("—");
    expect(formatMoney(undefined, "KRW")).toBe("—");
    expect(formatMoney(Number.NaN, "KRW")).toBe("—");
  });

  it("0원은 실제 값이므로 그대로 표시한다(미확인과 구분)", () => {
    expect(formatMoney(0, "KRW")).toBe("₩0");
  });

  it("통화가 없으면 `1,234 UNDEFINED` 같은 문자열을 만들지 않는다", () => {
    expect(formatMoney(1234, null)).toBe("1,234.00");
  });
});
