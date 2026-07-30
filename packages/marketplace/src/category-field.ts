import type { CategorySelection } from "@commerce/category";
import type { FieldRule } from "./validation";

/**
 * 3개 어댑터가 전부 같은 카테고리 규칙을 쓴다 — SELECTED/CONFIRMED "그리고"
 * isVerifiedPlatformCode(플랫폼이 실제로 돌려준 카테고리 코드)여야만 PASS.
 *
 * 예전엔 state만 봤는데, 실제 등록에서 "미리보기는 등록가능성 100%인데 register
 * API가 CP001(카테고리 코드 없음)로 거부"하는 버그가 실측으로 확인됐다 —
 * CommerceWorkspace의 카테고리 후보 목록에는 쿠팡이 실제로 검증한 후보와
 * CartPilot 내부 AI 추천이 섞여 있는데, 사용자가 내부 추천 쪽을 선택해도 state는
 * 똑같이 SELECTED가 된다. 하지만 register 라우트(resolveVerifiedCategoryCode)는
 * isVerifiedPlatformCode가 true인 후보만 실제 카테고리 코드로 인정한다 — 이
 * 미리보기 규칙과 실제 등록 라우트가 서로 다른 기준을 쓰고 있었다는 뜻이다.
 * 이제 이 파일이 유일한 기준이 되도록 등록 라우트도 이 논리와 정확히 일치하게
 * 맞춘다("등록 가능 100%"가 실제로 등록 가능함을 보장해야 한다).
 */
/** 이 파일 밖(StageStepper/PlatformPreview/CommerceWorkspace 등 UI 표시용
 * 코드)에서 "카테고리가 확정됐는가"를 다시 판단해야 할 때는 반드시 이 함수를
 * 써야 한다 — state만 보는 자체 판정을 새로 만들면 위 주석에 적힌 CP001
 * 버그가 그대로 재발한다(실제로 SaaS-UX 개편 때 3곳에서 재발했었다). */
export function isVerifiedCategorySelected(categorySelection: CategorySelection): boolean {
  const isSelected = categorySelection.state === "SELECTED" || categorySelection.state === "CONFIRMED";
  const isVerified = categorySelection.candidate?.isVerifiedPlatformCode === true;
  return isSelected && isVerified;
}

export function categoryFieldRule(categorySelection: CategorySelection): FieldRule {
  const isSelected = categorySelection.state === "SELECTED" || categorySelection.state === "CONFIRMED";
  return {
    field: "category",
    label: "카테고리",
    check: () => isVerifiedCategorySelected(categorySelection),
    onFail: "WARNING",
    message: !isSelected
      ? categorySelection.state === "RECOMMENDED"
        ? "추천된 카테고리를 확인하고 선택해주세요."
        : "카테고리를 선택해주세요 — 추천 후보 중 하나를 고르거나 직접 지정할 수 있습니다."
      : "선택된 카테고리가 플랫폼의 실제 카테고리 코드로 확인되지 않았습니다 — 카테고리 추천 결과에서 다시 선택해주세요.",
  };
}
