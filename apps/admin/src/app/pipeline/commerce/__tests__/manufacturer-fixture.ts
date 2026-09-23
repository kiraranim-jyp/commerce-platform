import type { ManufacturerResolutionState } from "../use-manufacturer-resolution";

/**
 * REWORK-10 A(2026-09-15) — 세 채널 화면이 **반드시** 받아야 하는 제조사
 * resolver 결과. 테스트가 이 값을 명시적으로 넘기게 하려고 prop을 optional로
 * 두지 않았다 — 기본값을 주면 배선이 빠졌을 때 화면이 조용히 "제조사 없음"으로
 * 떨어진다(이번에 고친 버그가 정확히 그 모양이었다).
 *
 * 기본값은 "상품 원문에 제조사가 있다"(PRODUCT_INFO)이다 — 구조를 보는 테스트가
 * 제조사 안내문 때문에 흔들리지 않게.
 *
 * REWORK-13A(2026-09-15) — 단계 이름이 `PRODUCT` → `PRODUCT_INFO`로 갈렸다
 * (①원본 페이지 명시 / ②원본 상품정보 / ⑤직접 입력). 기본값이 가리키는 상태
 * 자체는 그대로다 — «상품이 이미 제조사를 들고 있다».
 */
export function manufacturerFixture(
  overrides: Partial<ManufacturerResolutionState> = {},
): ManufacturerResolutionState {
  return {
    value: "보보쇼즈",
    source: "PRODUCT_INFO",
    resolved: true,
    /* PIVOT NEXT-04c-2 — 기본값은 상품 사실이다. 확인이 더 필요하지 않다. */
    resolutionType: "PRODUCT_FACT",
    requiresReview: false,
    loading: false,
    /* REWORK-12 ④ — 조회에 쓴 브랜드 이름. 화면이 «브랜드 X로 찾아봤다»라고
       말하는 데 쓴다(판정에는 들어가지 않는다). */
    brand: "Bobo Choses",
    ...overrides,
  };
}
