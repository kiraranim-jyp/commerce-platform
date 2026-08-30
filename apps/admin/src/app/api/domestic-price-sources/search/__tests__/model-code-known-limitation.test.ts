import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler";

describe("compareModelCode — known limitation (P-10 STEP 7, 대표님/CPO 지시 2026-08-30)", () => {
  it(
    "Known limitation / Future P-10-F candidate — " +
      "B126AC050 vs B126AC999(진짜 다른 상품, 앞 6자 'B126AC' 접두사만 공유)가 " +
      "현재 로직으로는 partial(=식별자 증거 있음)로 판정된다. " +
      "이 값이 '진짜 다른 상품이 STRONG_IDENTIFIER로 자동확정된다'는 위험으로 " +
      "이어지지 않도록, compareModelCode()의 LCS≥4 임계값을 별도 P-10-F에서 " +
      "재검토하기 전까지는 이 케이스를 CONFLICT로 취급하지 않는다 — 이 테스트는 " +
      "'정상 동작' 인증이 아니라 현재 동작을 그대로 문서화하는 것이 목적이다. " +
      "P-10 STEP 4/5/6(matchTruth 저장/전달/표시)는 compareModelCode() 자체를 " +
      "건드리지 않으므로 이 한계가 P-10의 PASS 조건은 아니다.",
    () => {
      expect(compareModelCode("B126AC050", "B126AC999")).toBe("partial");
    },
  );

  it("대조군 — Pepe 골든케이스(01195-VERNICE-NERO vs PP24KASHE1195NER)는 의미있는 4자리 숫자 '1195'를 공유해 partial", () => {
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER")).toBe("partial");
  });
});
