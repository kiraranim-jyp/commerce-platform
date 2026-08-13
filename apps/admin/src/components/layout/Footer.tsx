"use client";

import { useState } from "react";
import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";
import { BrandMark } from "./BrandMark";

/** N-3.26(CPO 요청 — 3열 구조 레퍼런스 반영) — 브랜드/서비스링크/약관링크를
 * 3열로 나란히 보여주고, 구분선 아래에 "▼ 사업자 정보" 토글로 전자상거래법
 * 표시 의무 항목을 접어둔다. N-3.17의 "브랜드 영역과 법적 고지 영역 분리"
 * 원칙은 그대로 유지 — 항상 펼쳐진 상태가 아니라 토글 뒤로 둔다.
 *
 * "사업자등록번호"는 레퍼런스 시안에 있었지만 BUSINESS_INFO에 확인된 값이
 * 없어 추가하지 않는다(파일 상단 주석 원칙: "확인되지 않은 정보는 추측해서
 * 추가하지 않는다") — 통신판매업 신고번호까지만 표시한다. */
export function Footer() {
  const [showBusinessInfo, setShowBusinessInfo] = useState(false);

  return (
    <footer className="shrink-0 border-t border-border bg-background px-6 py-8 text-xs text-text-tertiary">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <BrandMark size={18} />
            <span className="text-sm font-semibold text-text-primary">{BUSINESS_INFO.serviceName}</span>
          </div>
          <p className="mt-3 leading-relaxed">{BUSINESS_INFO.serviceName}: {BUSINESS_INFO.serviceDescription}</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary">서비스</p>
          <nav className="mt-3 flex flex-col gap-2">
            <Link href="/pipeline" className="hover:text-text-secondary hover:underline">
              상품등록
            </Link>
            <Link href="/snapshots" className="hover:text-text-secondary hover:underline">
              최근 작업
            </Link>
            <a href={`mailto:${BUSINESS_INFO.email}`} className="hover:text-text-secondary hover:underline">
              문의하기
            </a>
          </nav>
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary">약관</p>
          <nav className="mt-3 flex flex-col gap-2">
            <Link href="/terms" className="hover:text-text-secondary hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-text-secondary hover:underline">
              개인정보처리방침
            </Link>
            <Link href="/privacy-settings" className="hover:text-text-secondary hover:underline">
              개인정보 관리
            </Link>
          </nav>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-5xl border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setShowBusinessInfo((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-text-primary hover:text-text-secondary"
          aria-expanded={showBusinessInfo}
        >
          <span aria-hidden="true">{showBusinessInfo ? "▲" : "▼"}</span> 사업자 정보
        </button>

        {/* N-3.17 — 전자상거래법상 표시 의무가 있는 항목(상호/대표자/사업장 소재지/
         * 통신판매업 신고번호)은 삭제하지 않고 그대로 보여준다. */}
        {showBusinessInfo && (
          <div className="mt-3 flex flex-col gap-1 leading-relaxed">
            <div>상호 : {BUSINESS_INFO.businessName}</div>
            <div>대표자 : {BUSINESS_INFO.representative}</div>
            <div>사업장 소재지 : {BUSINESS_INFO.address}</div>
            <div>통신판매업 신고번호 : {BUSINESS_INFO.mailOrderRegistrationNumber}</div>
            <div>
              고객센터 :{" "}
              <a href={`mailto:${BUSINESS_INFO.email}`} className="text-primary hover:underline">
                {BUSINESS_INFO.email}
              </a>
            </div>
          </div>
        )}

        <div className="mt-4">
          © {new Date().getFullYear()} {BUSINESS_INFO.serviceName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
