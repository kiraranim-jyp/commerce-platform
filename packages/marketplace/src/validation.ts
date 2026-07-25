import type { ValidationResult, ValidationStatus } from "./types";

/** 어댑터마다 같은 형태의 "필드 있으면 PASS, 없으면 WARNING/ERROR" 판정을 반복하지
 * 않도록 공용 규칙 실행기를 둔다. 각 플랫폼은 규칙 목록(어떤 필드가 필수인지,
 * 없을 때 WARNING인지 ERROR인지)만 선언하면 된다. */
export interface FieldRule {
  field: string;
  label: string;
  /** true를 반환하면 PASS. */
  check: () => boolean;
  /** check가 실패했을 때의 상태 — 플랫폼마다 같은 필드도 요구 강도가 다르다
   * (예: 브랜드는 쿠팡에서는 ERROR, 스마트스토어에서는 WARNING). */
  onFail: ValidationStatus;
  message?: string;
}

export function runValidation(rules: FieldRule[]): ValidationResult[] {
  return rules.map((rule) => ({
    field: rule.field,
    label: rule.label,
    status: rule.check() ? "PASS" : rule.onFail,
    message: rule.check() ? undefined : rule.message,
  }));
}

/** PASS=1, WARNING=0.5, ERROR=0으로 평균 내서 0~100 점수로 요약한다. */
export function scoreValidations(results: ValidationResult[]): number {
  if (results.length === 0) return 100;
  const weights: Record<ValidationStatus, number> = { PASS: 1, WARNING: 0.5, ERROR: 0 };
  const total = results.reduce((sum, r) => sum + weights[r.status], 0);
  return Math.round((total / results.length) * 100);
}
