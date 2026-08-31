import type { CanonicalProduct } from "@commerce/shared";

/**
 * P-13C-2 STEP2(2026-08-31) — CPO 지시: "Resolver Confidence"와 "Human
 * Confirmation"을 혼동하지 않는다. STEP0 실측(production 73개 categoryResolverKpi
 * 전수 조사)으로 확인된 사실: 현재 아키텍처에는 사람이 클릭하지 않고 자동
 * 저장되는 경로가 없다(selectCategory()는 오직 사용자 클릭 시에만 호출된다) —
 * 그래서 "AUTO_SELECT + 사용자 확인"과 "AUTO_SELECT + 시스템이 자동 저장"을
 * 구분할 새 필드가 지금은 필요 없다. 기존 3개 필드(manualOverride/
 * resolverDecision/selectedResult 존재 여부)의 조합만으로 4개 상태 전부
 * 결정론적으로 갈린다 — 실측 73건에서 모순되는 조합 0건, 새 DB 컬럼/마이그레이션
 * 없음.
 */
export type CategoryResolutionStatus = "MANUAL" | "RESOLVED" | "LOW_CONFIDENCE" | "UNKNOWN";

type CategoryResolverKpi = NonNullable<CanonicalProduct["categoryResolverKpi"]>;

export function resolveCategoryStatus(
  kpi: CategoryResolverKpi | null | undefined,
): CategoryResolutionStatus {
  if (!kpi?.selectedResult) return "UNKNOWN";
  if (kpi.manualOverride) return "MANUAL";
  if (kpi.resolverDecision === "AUTO_SELECT") return "RESOLVED";
  if (kpi.resolverDecision === "RECOMMEND") return "LOW_CONFIDENCE";
  // 실측 73건 중 0건이었지만(이론상 가능성만 존재) — predict 후보가 아예 없어서
  // (REJECT/null) predictResult가 null이면 CommerceWorkspace.tsx의 저장 로직상
  // manualOverride는 무조건 false로 남는다(predictResult != null 가드). 이 경우
  // 사람이 직접 검색해서 골랐을 가능성이 높지만, 저장된 값만으로는 그렇게
  // 단정할 근거가 없다 — 추정하지 않고 정직하게 UNKNOWN으로 남긴다.
  return "UNKNOWN";
}
