import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "./BrandMark";
import { UserMenu } from "./UserMenu";

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
      {/* CEO-9A-3 — 로그인 사용자 영역. 공통 헤더 한 곳에서만 그린다(§7):
          페이지마다 따로 두면 계정 표시가 화면마다 어긋난다. */}
      <div className="flex items-center gap-3">
        <UserMenu />
      </div>
    </header>
  );
}
