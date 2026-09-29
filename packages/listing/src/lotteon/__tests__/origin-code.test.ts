import { describe, expect, it } from "vitest";
import { autoPickLotteOnOriginCode } from "../origin-code";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-FINAL-02 P0 — 원산지 자동 매핑의 «안전 조건»
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 지키는 것은 「맞추는가」보다 **「틀리게 고르지 않는가」** 다.
 * 첫 LIVE 등록이 거절된 이유가 코드 자리에 코드가 아닌 것을 보낸 것이었다
 * (`"oplcCd": "OPLC_CD"`). 여기서 한 번 잘못 고르면 그때와 같은 일이 된다.
 */

/** 롯데ON 목록의 모양 그대로(실제 239건 중 일부). */
const ITEMS = [
  { code: "KR", name: "대한민국" },
  { code: "ES", name: "스페인" },
  { code: "FR", name: "프랑스" },
  { code: "CN", name: "중국" },
];

describe("① 맞출 수 있으면 맞춘다", () => {
  it("한국어 원산지는 그대로 맞는다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "스페인")?.code).toBe("ES");
  });

  it("🔴 영문 원산지도 맞는다 — 상품 원문이 «Spain» 인 경우가 실제로 있다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "Spain")?.code).toBe("ES");
    expect(autoPickLotteOnOriginCode(ITEMS, "  spain  ")?.code).toBe("ES");
  });

  it("앞뒤/연속 공백은 무시한다 — 값을 «바꾸지» 는 않는다", () => {
    expect(autoPickLotteOnOriginCode([{ code: "X", name: " 프랑스 " }], "프랑스")?.code).toBe("X");
  });
});

describe("🔴🔴 ② 틀리게 고르느니 «고르지 않는다»", () => {
  it("목록에 없으면 null — 국가코드를 지어내지 않는다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "안도라")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "Andorra")).toBeNull();
  });

  it("🔴 부분일치로 잡지 않는다 — 「스페인」이 「스페인령…」을 집으면 안 된다", () => {
    const tricky = [{ code: "ZZ", name: "스페인령 카나리아제도" }];
    expect(autoPickLotteOnOriginCode(tricky, "스페인")).toBeNull();
  });

  it("🔴 같은 이름이 여럿이면 고르지 않는다 — 배송지 autoPick 과 같은 규칙", () => {
    const dup = [
      { code: "A1", name: "스페인" },
      { code: "A2", name: "스페인" },
    ];
    expect(autoPickLotteOnOriginCode(dup, "스페인")).toBeNull();
  });

  it("빈 원산지·빈 목록은 null 이다", () => {
    expect(autoPickLotteOnOriginCode(ITEMS, "")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "   ")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, null)).toBeNull();
    expect(autoPickLotteOnOriginCode([], "스페인")).toBeNull();
  });

  it("🔴 코드 자체를 원산지 텍스트로 준 경우에도 이름으로만 본다", () => {
    /* 「ES」 는 이름이 아니다. 코드로 역매칭하면 셀러가 적은 엉뚱한 문자열이
       코드로 승격된다 — 그 길을 열지 않는다. */
    expect(autoPickLotteOnOriginCode(ITEMS, "ES")).toBeNull();
    expect(autoPickLotteOnOriginCode(ITEMS, "OPLC_CD")).toBeNull();
  });
});
