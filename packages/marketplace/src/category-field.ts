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
/** 이 파일 밖(WorkflowPanel/PlatformPreview/CommerceWorkspace 등 UI 표시용
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
    /* ══ SELLER-UX-FINAL PHASE 4 (CEO 지시 2026-10-03) ════════════════════════
       🔴 `WARNING` 이었다. 그런데 이 검사가 실패하면 등록이 «실제로 막힌다» —
       `resolveVerifiedCategoryCode()` 가 null 을 돌려주고,
       `missingSellerConfigFields()` 가 「쿠팡 카테고리 코드」를 missing 에 넣고,
       `classifyMissingSellerConfig()` 가 **CP001** 로 등록을 끝낸다.

       즉 화면은 🟡「확인 필요」라고 말하는데 실제로는 🔴「등록 불가」였다.
       「등록을 막는 것과 봐야 하는 것을 다른 말로 적는다」가 이번 요구사항의
       ① 이고, 이 한 줄이 그것을 정면으로 어기고 있었다. 바로 위 함수 주석이
       이미 *"API가 CP001(카테고리 코드 없음)로 거부"* 라고 적어 두고 있었다 —
       근거가 코드 안에 있었는데 등급만 틀려 있었다.

       🔴 세 어댑터가 모두 이 규칙 하나를 쓰고, 세 채널 모두 플랫폼이 실제로
       돌려준 카테고리 코드 없이는 등록할 수 없다. 그래서 채널별로 가르지 않고
       공통으로 올린다. */
    onFail: "ERROR",
    message: !isSelected
      ? categorySelection.state === "RECOMMENDED"
        ? "추천된 카테고리를 확인하고 선택해주세요."
        : "카테고리를 선택해주세요 — 추천 후보 중 하나를 고르거나 직접 지정할 수 있습니다."
      : "선택된 카테고리가 플랫폼의 실제 카테고리 코드로 확인되지 않았습니다 — 카테고리 추천 결과에서 다시 선택해주세요.",
  };
}
