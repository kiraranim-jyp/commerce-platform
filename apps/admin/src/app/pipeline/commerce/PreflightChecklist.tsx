import type { CategorySelection } from "@commerce/category";
import type { ValidationResult } from "@commerce/marketplace";

interface ChecklistItem {
  label: string;
  passed: boolean;
  required: boolean;
}

/**
 * 상품 validation(브랜드/이미지/가격/설명 등)과 판매자 설정(출고지/반품지/택배사)을
 * 하나의 ✓/✗ 목록으로 합쳐서, 등록 버튼을 누르기 전에 무엇이 부족한지 한눈에
 * 보여준다. "필수"만 등록 버튼을 막는다 — 옵션/설명처럼 없어도 등록은 되는
 * 항목은 "권장"으로 따로 보여줘서 사용자가 급하지 않은 걸 억지로 채우지 않게 한다.
 *
 * 목적은 CPO가 지적한 문제 그대로다: "등록 API를 호출한 뒤에야 필수값 부족을
 * 안다"를 없애는 것 — 이 컴포넌트가 보여주는 필수 항목이 전부 ✓가 되기 전에는
 * ListingSection이 등록 버튼 자체를 열지 않는다(CommerceWorkspace의
 * effectiveListingStatus가 같은 조건을 게이트로 쓴다).
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
  const categoryConfirmed = category.state === "SELECTED" || category.state === "CONFIRMED";

  const items: ChecklistItem[] = [
    { label: "카테고리", passed: categoryConfirmed, required: true },
    ...validations
      .filter((v) => v.field !== "category" && v.field !== "shipping")
      .map((v) => ({
        label: v.label,
        passed: v.status === "PASS",
        required: v.status !== "WARNING",
      })),
    ...(settingsMissing ?? []).map((label) => ({ label, passed: false, required: true })),
  ];

  const required = items.filter((i) => i.required);
  const recommended = items.filter((i) => !i.required);
  const allRequiredPassed = required.every((i) => i.passed);

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

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className={item.passed ? "text-success" : "text-error"}>{item.passed ? "✓" : "✗"}</span>
      <span className={item.passed ? "text-text-primary" : "font-medium text-text-primary"}>
        {item.label}
      </span>
    </li>
  );
}
