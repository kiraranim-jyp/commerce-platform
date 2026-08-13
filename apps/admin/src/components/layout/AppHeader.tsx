import { BUSINESS_INFO } from "@/lib/business-info";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <rect width="22" height="22" rx="6" fill="var(--color-primary)" />
          <path
            d="M6 15.5V8.5L11 6L16 8.5V15.5L11 18L6 15.5Z"
            stroke="white"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-text-primary">{BUSINESS_INFO.serviceName}</div>
          <div className="text-[10px] font-medium text-text-tertiary">{BUSINESS_INFO.serviceDescription}</div>
        </div>
      </div>
      {/* 버전/알림/사용자 메뉴 예약 자리 — 이번 스프린트는 기능 없음 */}
      <div className="flex items-center gap-3" />
    </header>
  );
}
