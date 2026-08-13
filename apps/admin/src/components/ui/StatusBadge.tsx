/**
 * N-3.15 Phase 2(CPO 지시: "공통 StatusBadge") — 화면마다 이모지+텍스트를 직접
 * 하드코딩하던 상태 표현(🟢 연결됨/🟡 입력 필요/🟠 확인 필요/🔴 오류/○ 미연결)을
 * 하나의 컴포넌트로 통일한다. 라벨은 화면마다 다를 수 있어(연결 상태는 "연결됨",
 * 등록 준비도는 "완료") status만 5종으로 고정하고 label은 props로 받는다 — 상태
 * 색상/아이콘의 의미는 항상 같아야 하지만 문구까지 강제하면 오히려 부자연스러운
 * 화면이 나온다.
 */
export type StatusBadgeStatus = "success" | "warning" | "needsCheck" | "error" | "neutral";

const STATUS_META: Record<StatusBadgeStatus, { icon: string; defaultLabel: string; className: string }> = {
  success: { icon: "🟢", defaultLabel: "완료", className: "text-success" },
  warning: { icon: "🟡", defaultLabel: "입력 필요", className: "text-warning" },
  needsCheck: { icon: "🟠", defaultLabel: "확인 필요", className: "text-warning" },
  error: { icon: "🔴", defaultLabel: "오류", className: "text-error" },
  neutral: { icon: "○", defaultLabel: "미연결", className: "text-text-tertiary" },
};

export function StatusBadge({
  status,
  label,
  caption,
  className = "",
}: {
  status: StatusBadgeStatus;
  /** 기본 라벨을 화면 맥락에 맞게 덮어쓴다(예: "연결됨" vs "완료"). */
  label?: string;
  /** 배지 뒤에 덧붙는 부가 설명 — 예: "(마지막 확인: 2분 전)". 실제 데이터가 있을 때만 넘긴다. */
  caption?: string;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className={`text-xs font-medium ${meta.className} ${className}`}>
      {meta.icon} {label ?? meta.defaultLabel}
      {caption && <span className="ml-1.5 font-normal text-text-tertiary">{caption}</span>}
    </span>
  );
}
