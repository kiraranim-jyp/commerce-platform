import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";

/** N-3.13 Part N(CPO 지시) — 모든 주요 화면에 실제 운영 사업자 정보를 일관되게
 * 표시한다. AppShell 안에서 한 번만 마운트한다(페이지별 중복 렌더링 금지 —
 * "Page owns no UI" 원칙). */
export function Footer() {
  return (
    <footer className="shrink-0 border-t border-border bg-surface px-4 py-3 text-[11px] text-text-tertiary">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="leading-relaxed">
          <div className="text-xs font-semibold text-text-secondary">{BUSINESS_INFO.serviceName}</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span>상호: {BUSINESS_INFO.businessName}</span>
            <span className="hidden sm:inline">·</span>
            <span>대표자: {BUSINESS_INFO.representative}</span>
          </div>
          <div>사업장 소재지: {BUSINESS_INFO.address}</div>
          <div>통신판매업 신고번호: {BUSINESS_INFO.mailOrderRegistrationNumber}</div>
          <div>
            대표 이메일:{" "}
            <a href={`mailto:${BUSINESS_INFO.email}`} className="text-primary hover:underline">
              {BUSINESS_INFO.email}
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <nav className="flex items-center gap-1.5">
            <Link href="/terms" className="hover:text-text-secondary hover:underline">
              이용약관
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/privacy" className="hover:text-text-secondary hover:underline">
              개인정보처리방침
            </Link>
            <span aria-hidden="true">|</span>
            <Link href="/privacy-settings" className="hover:text-text-secondary hover:underline">
              개인정보 관리
            </Link>
          </nav>
          <div>© {BUSINESS_INFO.serviceName}. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
