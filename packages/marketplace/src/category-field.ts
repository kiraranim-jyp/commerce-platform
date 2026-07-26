import type { CategorySelection } from "@commerce/category";
import type { FieldRule } from "./validation";

/**
 * 3개 어댑터가 전부 같은 카테고리 규칙을 쓴다 — SELECTED/CONFIRMED만 PASS,
 * 그 외(UNRESOLVED/RECOMMENDED)는 WARNING. "추천이 떠 있다"와 "사용자가 실제로
 * 골랐다"를 구분해야 하므로 RECOMMENDED도 WARNING으로 남겨둔다.
 */
export function categoryFieldRule(categorySelection: CategorySelection): FieldRule {
  return {
    field: "category",
    label: "카테고리",
    check: () => categorySelection.state === "SELECTED" || categorySelection.state === "CONFIRMED",
    onFail: "WARNING",
    message:
      categorySelection.state === "RECOMMENDED"
        ? "추천된 카테고리를 확인하고 선택해주세요."
        : "카테고리를 선택해주세요 — 추천 후보 중 하나를 고르거나 직접 지정할 수 있습니다.",
  };
}
