import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler";

/**
 * P-10-F(CEO 승인, 2026-09-11) — 2026-08-30에 "나중에 재검토"로 예약해 둔
 * LCS≥4 임계값 문제를 여기서 끝낸다. 이 파일은 원래 "현재 동작을 그대로
 * 문서화"하는 용도였고, 이제 고쳐진 동작을 고정하는 용도로 바뀐다.
 *
 * 실측 계기(Bobo Choses, 대표님 제보): 원본 B226AC043에 대해 국내 후보로
 * B226AC042(다른 색)와 B226AC043(정답)이 함께 올라왔는데 **둘 다 같은 등급**
 * 이었다. 두 상품은 상품명이 완전히 같아서("Mystery BC half zipped sweatshirt",
 * 색상이 제목에 없다) 텍스트로는 원리상 구분되지 않는다 — 코드가 유일한 판별
 * 근거인데, 앞 8자를 공유한다는 이유로 partial(=식별자 증거 있음)이 되어
 * 오히려 오매칭을 승격시키고 있었다.
 *
 * 가르는 기준은 "얼마나 겹치는가"가 아니라 **어디가 겹치는가**다.
 */
describe("compareModelCode — 같은 코드 체계에서 갈라지면 다른 상품이다", () => {
  it("핵심 회귀: 앞자리를 공유하다 뒤가 갈라지면 conflict다(예전엔 partial이었다)", () => {
    // 이번 사건의 실제 쌍 — 색상만 다른 별개 상품.
    expect(compareModelCode("B226AC043", "B226AC042")).toBe("conflict");
    // 2026-08-30에 known limitation으로 적어 둔 쌍. 같은 성질이라 같이 풀린다.
    expect(compareModelCode("B126AC050", "B126AC999")).toBe("conflict");
  });

  it("정답 쌍은 그대로 exact다", () => {
    expect(compareModelCode("B226AC043", "B226AC043")).toBe("exact");
  });

  it("핵심 회귀: 사이즈 접미사가 붙은 SKU는 여전히 partial이다", () => {
    // handle은 접미사가 없고 variants[].sku에는 색상·사이즈 접미사가 붙는다.
    // 한쪽이 다른 쪽을 통째로 품는 관계라 "다른 상품"이 아니다.
    expect(compareModelCode("B126AI018", "B126AI01831152")).toBe("partial");
    expect(compareModelCode("B226AC043", "B226AC04341101")).toBe("partial");
  });

  it("핵심 회귀: PèPè 골든케이스는 깨지지 않는다 — 표기법이 달라 접두사를 공유하지 않는다", () => {
    // 해외 설명문 Article code vs 국내 FORETFORET mpn. 접두사가 전혀 다르고
    // 의미있는 숫자 코어 "1195"만 공유한다 — 이건 같은 상품의 다른 표기다.
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER")).toBe("partial");
  });

  it("한쪽이라도 코드가 없으면 비교 자체를 못 한다", () => {
    expect(compareModelCode("B226AC043", null)).toBe("unavailable");
    expect(compareModelCode(null, "B226AC043")).toBe("unavailable");
  });
});
