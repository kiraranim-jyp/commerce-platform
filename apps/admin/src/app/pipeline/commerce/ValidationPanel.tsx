import type { ValidationResult } from "@commerce/marketplace";

const STATUS_META: Record<ValidationResult["status"], { icon: string; className: string }> = {
  PASS: { icon: "✓", className: "text-success" },
  WARNING: { icon: "!", className: "text-warning" },
  ERROR: { icon: "✕", className: "text-error" },
};

export function ValidationPanel({
  validations,
  score,
}: {
  validations: ValidationResult[];
  score: number;
}) {
  const scoreClassName = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-error";

  return (
    <section className="rounded-lg border border-border p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-medium">Validation</h3>
        <span className="text-sm font-semibold">
          등록 가능성: <span className={scoreClassName}>{score}%</span>
        </span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {validations.map((v) => (
          <li key={v.field} className="flex items-start gap-2">
            <span className={`mt-0.5 font-bold ${STATUS_META[v.status].className}`}>
              {STATUS_META[v.status].icon}
            </span>
            <div>
              <span className="font-medium text-text-primary">{v.label}</span>
              {v.message && <span className="ml-2 text-xs text-text-secondary">{v.message}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
