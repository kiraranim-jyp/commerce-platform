import { describe, expect, it } from "vitest";
import { isKoreanMarket, parseMarketRegion, splitByTargetMarket } from "../market-target";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — "시장을 절대 추론하지 않는다"를 테스트로 고정한다.
 *
 * 이 규칙은 주석만으로는 지켜지지 않는다. 화면에서 "한국 가격"을 보여줘야 하는데
 * market_code가 없는 행을 만나면, 다음 사람은 거의 반드시 통화(KRW)나 판매자
 * 신고 국가(market_country)로 메우고 싶어진다 — 그 순간 €75(DE) 관측이 한국
 * 시장 가격으로 둔갑한다. 아래 케이스가 그 유혹을 실패로 바꾼다.
 */
describe("parseMarketRegion()", () => {
  it("시장 코드에 적힌 지역만 읽는다", () => {
    expect(parseMarketRegion("en-kr")).toBe("kr");
    expect(parseMarketRegion("KR")).toBe("kr");
    expect(parseMarketRegion("en-de")).toBe("de");
  });

  it("국가가 아닌 코드는 지역으로 만들지 않는다", () => {
    // "int"는 국제 공용 페이지다 — 어느 나라도 아니다.
    expect(parseMarketRegion("en-int")).toBeNull();
    expect(parseMarketRegion("")).toBeNull();
    expect(parseMarketRegion(null)).toBeNull();
    expect(parseMarketRegion(undefined)).toBeNull();
  });
});

describe("isKoreanMarket()", () => {
  it("관측된 시장 코드가 한국일 때만 참이다", () => {
    expect(isKoreanMarket("en-kr")).toBe(true);
    expect(isKoreanMarket("kr")).toBe(true);
  });

  it("통화·도메인·국제 페이지로 한국을 추론하지 않는다", () => {
    // KRW를 표시하는 해외 페이지는 한국 시장이 아니다.
    expect(isKoreanMarket("KRW")).toBe(false);
    // 도메인 문자열이 들어와도 시장 코드가 아니므로 한국이 아니다.
    expect(isKoreanMarket("shop.example.kr")).toBe(false);
    expect(isKoreanMarket("en-int")).toBe(false);
    expect(isKoreanMarket("en-de")).toBe(false);
    // 시장 미확인은 "한국일 수도 있다"가 아니라 "한국이 아니다"로 다룬다 —
    // 확실하지 않은 관측을 판단 시장에 넣지 않는다.
    expect(isKoreanMarket(null)).toBe(false);
  });
});

describe("splitByTargetMarket()", () => {
  it("판단 시장과 참고 시장을 가르고, 합치지 않는다", () => {
    // 실측 사례(Bobo Choses): 한 판매처가 /en-kr · /en-de · /en-int를 동시에 갖는다.
    const rows = [
      { marketCode: "en-kr", priceKrw: 162000 },
      { marketCode: "en-de", priceKrw: 108000 },
      { marketCode: "en-int", priceKrw: 121000 },
    ];
    const { target, overseas } = splitByTargetMarket(rows);
    expect(target).toEqual([{ marketCode: "en-kr", priceKrw: 162000 }]);
    expect(overseas).toHaveLength(2);
    // 원소가 사라지거나 늘어나지 않는다(어느 쪽으로도 버리지 않는다).
    expect(target.length + overseas.length).toBe(rows.length);
  });

  it("판매자 신고 국가는 분류에 쓰이지 않는다", () => {
    // market_country = ES(판매자 신고 국가)인데 관측 시장은 en-kr인 행 —
    // 이건 한국 시장 관측이다. 신고 국가로 가르면 스페인으로 밀려난다.
    const rows = [{ marketCode: "en-kr", marketCountry: "ES" }];
    const { target, overseas } = splitByTargetMarket(rows);
    expect(target).toHaveLength(1);
    expect(overseas).toHaveLength(0);
  });
});
