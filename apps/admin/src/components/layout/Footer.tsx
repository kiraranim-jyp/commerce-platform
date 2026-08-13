"use client";

import { useState } from "react";
import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";

/** N-3.17(CPO 지시: "브랜드 영역과 법적 고지 영역 분리") — 예전엔 상호/대표자/
 * 사업장 소재지/통신판매업 신고번호/이메일이 항상 펼쳐진 채로 브랜드 영역과
 * 뒤섞여 있었다. 전자상거래법상 상호·대표자 성명 등은 사이버몰 초기 화면에서
 * "쉽게 확인할 수 있어야" 하는 것이지 "항상 펼쳐져 있어야" 하는 것은 아니라서,
 * 값은 하나도 지우지 않고 "사업자 정보" 토글 뒤로 옮긴다 — 기본 화면은 브랜드
 * + 내비게이션만 간결하게 보여준다. */
export function Footer() {
  const [showBusinessInfo, setShowBusinessInfo] = useState(false);

  return (
    <footer className="shrink-0 border-t border-border bg-surface px-4 py-3 text-[11px] text-text-tertiary">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="leading-relaxed">
          <span className="text-xs font-semibold text-text-secondary">{BUSINESS_INFO.serviceName}</span>
          <span className="ml-1.5">{BUSINESS_INFO.serviceDescription}</span>
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
            <span aria-hidden="true">|</span>
            <button
              type="button"
              onClick={() => setShowBusinessInfo((v) => !v)}
              className="hover:text-text-secondary hover:underline"
              aria-expanded={showBusinessInfo}
            >
              사업자 정보 {showBusinessInfo ? "▲" : "▼"}
            </button>
          </nav>
          <div>© {BUSINESS_INFO.serviceName}. All rights reserved.</div>
        </div>
      </div>

      {/* N-3.17 — 전자상거래법상 표시 의무가 있는 항목(상호/대표자/사업장 소재지/
       * 통신판매업 신고번호)은 삭제하지 않고 그대로 보여준다. 임의로 필수/비필수를
       * 판단해 항목을 지우지 않는다 — 토글로 접근성만 유지하고 내용은 원본 그대로. */}
      {showBusinessInfo && (
        <div className="mt-2 border-t border-border pt-2 leading-relaxed sm:text-right">
          <div className="flex flex-wrap items-baseline gap-x-1.5 sm:justify-end">
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
      )}
    </footer>
  );
}
