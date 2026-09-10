import { describe, expect, it } from "vitest";
import { convertToKrw, convertToKrwStrict, hasKnownRateToKrw } from "../currency";

/**
 * PRICE-ACCURACY-REGRESSION-1.1(CPO 결정, 2026-09-11).
 *
 * 지키는 불변조건: **환율을 모르는 통화의 금액을 원화로 둔갑시키지 않는다.**
 *
 * 실제로 있던 결함 — convertToKrw는 모르는 통화를 만나면 금액을 그대로 KRW로
 * 돌려준다(마지막 폴백). MI 표시/스냅샷 저장 경로가 그 값을 그대로 쓰면
 * `499 DKK`가 `₩499`가 되고, 그 숫자가 마진·CASE 판정까지 흘러간다.
 *
 * 여기서 못 박는 것은 두 가지다.
 *  ① 원가는 버리지 않는다 — 버리는 건 "원화 환산"뿐이다(그래서 null).
 *  ② 아는 통화의 계산 결과는 기존과 한 원도 달라지지 않는다.
 */
describe("환율을 모르는 통화는 환산하지 않는다", () => {
  it("핵심 회귀: 499 DKK를 ₩499로 만들지 않는다", () => {
    // 기존 함수의 위험한 동작을 먼저 고정해 둔다 — 이게 사라지면 이 테스트의
    // 전제가 바뀐 것이므로 같이 다시 봐야 한다.
    expect(convertToKrw(499, "DKK").amountKrw).toBe(499);
    // strict는 같은 입력에서 값을 만들어내지 않는다.
    expect(convertToKrwStrict(499, "DKK")).toBeNull();
  });

  it("환율표에 있으면 환산한다 — 아는 통화의 결과는 그대로다", () => {
    expect(convertToKrwStrict(10, "EUR")?.amountKrw).toBe(convertToKrw(10, "EUR").amountKrw);
    expect(convertToKrwStrict(75, "EUR", { EUR: 1561 })?.amountKrw).toBe(117075);
  });

  it("liveRates로 새 통화가 들어오면 그때부터 환산된다", () => {
    expect(convertToKrwStrict(499, "DKK")).toBeNull();
    expect(convertToKrwStrict(499, "DKK", { DKK: 209 })?.amountKrw).toBe(104291);
  });

  it("KRW는 환율 조회 없이도 아는 통화다", () => {
    expect(hasKnownRateToKrw("KRW")).toBe(true);
    expect(convertToKrwStrict(1000, "KRW")?.amountKrw).toBe(1000);
  });

  it("통화가 비어 있으면 모르는 것으로 취급한다", () => {
    // 추출은 됐는데 통화 라벨을 못 읽은 경우 — 금액만 있다고 원화로 쓰면 안 된다.
    expect(hasKnownRateToKrw(null)).toBe(false);
    expect(hasKnownRateToKrw("")).toBe(false);
    expect(convertToKrwStrict(499, "")).toBeNull();
  });

  it("대소문자는 구분하지 않는다", () => {
    expect(hasKnownRateToKrw("eur")).toBe(true);
    expect(convertToKrwStrict(10, "eur")?.amountKrw).toBe(convertToKrwStrict(10, "EUR")?.amountKrw);
  });
});
