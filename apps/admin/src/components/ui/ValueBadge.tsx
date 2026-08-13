/**
 * N-3.15 Phase 2(CPO 지시: "ValueBadge — 원본/AI추천/사용자확정 시각적 분리") —
 * CartPilot의 핵심 원칙(원본 데이터와 AI/변환값을 절대 같은 수준으로 표시하지
 * 않는다)을 색상으로 강제한다. 화면마다 회색/보라/파랑을 각자 다시 정의하지
 *않도록 여기 하나로 고정한다. 아직 실제 화면(가격/카테고리)에는 연결하지
 * 않았다 — 그 작업은 Phase 3(상품 정보/Category/Price 개편)에서 기존 화면을
 * 교체할 때 진행한다.
 */
export type ValueBadgeKind = "original" | "aiSuggested" | "userConfirmed";

const KIND_META: Record<ValueBadgeKind, { label: string; textClass: string; dotClass: string }> = {
  original: { label: "원본", textClass: "text-text-tertiary", dotClass: "bg-text-tertiary" },
  aiSuggested: { label: "AI 추천", textClass: "text-[#6366F1]", dotClass: "bg-[#6366F1]" },
  userConfirmed: { label: "사용자 확정", textClass: "text-primary", dotClass: "bg-primary" },
};

export function ValueBadge({ kind, className = "" }: { kind: ValueBadgeKind; className?: string }) {
  const meta = KIND_META[kind];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${meta.textClass} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
      {meta.label}
    </span>
  );
}
