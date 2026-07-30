import type { CategorySelection } from "@commerce/category";
import type { ValidationResult } from "@commerce/marketplace";
import { computeChecklistReadiness, type ReadinessItem } from "./readiness";

/**
 * 상품 validation(브랜드/이미지/가격/설명 등)과 판매자 설정(출고지/반품지/택배사)을
 * 하나의 ✓/✗ 목록으로 합쳐서, 등록 버튼을 누르기 전에 무엇이 부족한지 한눈에
 * 보여준다. "필수"만 등록 버튼을 막는다 — 옵션/설명처럼 없어도 등록은 되는
 * 항목은 "권장"으로 따로 보여줘서 사용자가 급하지 않은 걸 억지로 채우지 않게 한다.
 *
 * 판정 로직 자체는 여기 없다 — computeChecklistReadiness(commerce/readiness.ts)
 * 하나만 쓴다. RegistrationReadinessCard(우측 고정 카드)도 같은 함수를 쓰므로 이
 * 컴포넌트와 카드가 서로 다른 답을 보여줄 수 없다.
 */
export function PreflightChecklist({
  validations,
  category,
  settingsMissing,
}: {
  validations: ValidationResult[];
  category: CategorySelection;
  /** 쿠팡 탭에서만 넘어온다 — 판매자 설정(출고지/반품지/택배사 등) 중 비어있는
   * 한글 라벨 목록. */
  settingsMissing?: string[];
}) {
  const { required, recommended, allRequiredPassed } = computeChecklistReadiness(
    validations,
    category,
    settingsMissing,
  );

  return (
    <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
      <p className="font-medium text-text-primary">등록 전 확인</p>
      <ul className="mt-2 space-y-1">
        {required.map((item) => (
          <ChecklistRow key={item.label} item={item} />
        ))}
      </ul>
      {recommended.length > 0 && (
        <>
          <p className="mt-3 text-xs font-medium text-text-secondary">권장(없어도 등록 가능)</p>
          <ul className="mt-1 space-y-1">
            {recommended.map((item) => (
              <ChecklistRow key={item.label} item={item} />
            ))}
          </ul>
        </>
      )}
      {!allRequiredPassed && (
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
          필수 항목을 모두 채우면 등록을 시작할 수 있습니다.
        </p>
      )}
    </section>
  );
}

function ChecklistRow({ item }: { item: ReadinessItem }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className={item.passed ? "text-success" : "text-error"}>{item.passed ? "✓" : "✗"}</span>
      <span className={item.passed ? "text-text-primary" : "font-medium text-text-primary"}>
        {item.label}
      </span>
    </li>
  );
}
