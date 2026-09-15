import type { ManufacturerResolutionState } from "../use-manufacturer-resolution";

/**
 * REWORK-10 A(2026-09-15) — 세 채널 화면이 **반드시** 받아야 하는 제조사
 * resolver 결과. 테스트가 이 값을 명시적으로 넘기게 하려고 prop을 optional로
 * 두지 않았다 — 기본값을 주면 배선이 빠졌을 때 화면이 조용히 "제조사 없음"으로
 * 떨어진다(이번에 고친 버그가 정확히 그 모양이었다).
 *
 * 기본값은 "상품 원문에 제조사가 있다"(PRODUCT)이다 — 구조를 보는 테스트가
 * 제조사 안내문 때문에 흔들리지 않게.
 */
export function manufacturerFixture(
  overrides: Partial<ManufacturerResolutionState> = {},
): ManufacturerResolutionState {
  return { value: "보보쇼즈", source: "PRODUCT", resolved: true, loading: false, ...overrides };
}
