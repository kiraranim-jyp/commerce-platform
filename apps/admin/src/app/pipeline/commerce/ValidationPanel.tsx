import type { ValidationResult } from "@commerce/marketplace";

const STATUS_META: Record<ValidationResult["status"], { icon: string; className: string }> = {
  PASS: { icon: "✓", className: "text-emerald-600" },
  WARNING: { icon: "!", className: "text-amber-600" },
  ERROR: { icon: "✕", className: "text-red-600" },
};

export function ValidationPanel({
  validations,
  score,
}: {
  validations: ValidationResult[];
  score: number;
}) {
  const scoreClassName =
    score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <section className="rounded-lg border border-zinc-200 p-4 text-sm">
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
              <span className="font-medium text-zinc-800">{v.label}</span>
              {v.message && <span className="ml-2 text-xs text-zinc-500">{v.message}</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
