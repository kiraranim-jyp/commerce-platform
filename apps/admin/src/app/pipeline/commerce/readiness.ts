import type { CategorySelection } from "@commerce/category";
import type { ReadinessReport } from "@commerce/listing";
import { isVerifiedCategorySelected, type ValidationResult } from "@commerce/marketplace";

export interface ReadinessItem {
  label: string;
  passed: boolean;
  required: boolean;
}

export interface ReadinessSummary {
  items: ReadinessItem[];
  required: ReadinessItem[];
  recommended: ReadinessItem[];
  allRequiredPassed: boolean;
  /** 0~100. RegistrationReadinessCard(P0-UI Epic 2)와 PreflightChecklist가 항상
   * 같은 값을 봐야 한다 — 카드는 요약만, 체크리스트는 상세만 다르게 보여줄 뿐
   * "무엇이 통과했는지" 판정 자체는 이 한 곳에서만 계산한다. */
  percent: number;
}

function summarize(items: ReadinessItem[]): ReadinessSummary {
  const required = items.filter((i) => i.required);
  const recommended = items.filter((i) => !i.required);
  const allRequiredPassed = required.every((i) => i.passed);
  const passedCount = items.filter((i) => i.passed).length;
  const percent = items.length > 0 ? Math.round((passedCount / items.length) * 100) : 100;
  return { items, required, recommended, allRequiredPassed, percent };
}

/**
 * PreflightChecklist와 RegistrationReadinessCard가 반드시 같은 계산을 써야 한다 —
 * "같은 판정 조건을 두 곳에서 따로 구현"한 게 CP001 버그의 근본 원인이었다(실제
 * register API는 통과 못 시키는데 미리보기 UI는 100%로 보여준 사고). category 확정
 * 조건은 register API(resolveVerifiedCategoryCode)와 완전히 동일하게
 * isVerifiedPlatformCode까지 확인한다 — state만 보고 판단하지 않는다.
 */
export function computeChecklistReadiness(
  validations: ValidationResult[],
  category: CategorySelection,
  settingsMissing?: string[],
): ReadinessSummary {
  const categoryConfirmed = isVerifiedCategorySelected(category);

  const items: ReadinessItem[] = [
    { label: "카테고리", passed: categoryConfirmed, required: true },
    ...validations
      .filter((v) => v.field !== "category" && v.field !== "shipping")
      .map((v) => ({ label: v.label, passed: v.status === "PASS", required: v.status !== "WARNING" })),
    ...(settingsMissing ?? []).map((label) => ({ label, passed: false, required: true })),
  ];

  return summarize(items);
}

/** SmartStore 전용 — validateSmartStoreListing이 이미 계산한 report.score를 그대로
 * 쓴다(그 함수 자체가 이미 필드별 가중치를 반영한 신뢰할 수 있는 계산이라 여기서
 * 다시 계산하지 않는다). 체크리스트 항목만 이 화면 형식에 맞게 변환한다. */
export function computeReadinessScoreSummary(report: ReadinessReport): ReadinessSummary {
  const items: ReadinessItem[] = report.fields.map((f) => ({
    label: f.label,
    passed: f.status === "VALID",
    required: f.status !== "WARNING",
  }));
  return { ...summarize(items), percent: report.score };
}
