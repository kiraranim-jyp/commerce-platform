import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "./BrandMark";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <BrandMark size={22} />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-text-primary">{BUSINESS_INFO.serviceName}</div>
          <div className="text-[10px] font-medium tracking-wide text-text-tertiary">
            {BUSINESS_INFO.serviceNameEn}
          </div>
        </div>
      </div>
      {/* 버전/알림/사용자 메뉴 예약 자리 — 이번 스프린트는 기능 없음 */}
      <div className="flex items-center gap-3" />
    </header>
  );
}
