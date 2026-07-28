"use client";

import { useState } from "react";

export interface DiagnosticBundle {
  url: string;
  site: string;
  platform: string;
  errorCode?: string;
  errorMessage: string;
  traceId?: string;
  registeredAt: string;
  appVersion: string;
}

function formatBundle(bundle: DiagnosticBundle): string {
  return [
    `URL: ${bundle.url}`,
    `Site: ${bundle.site}`,
    `Platform: ${bundle.platform}`,
    `ErrorCode: ${bundle.errorCode ?? "미분류"}`,
    `Error Message: ${bundle.errorMessage}`,
    `Trace ID: ${bundle.traceId ?? "-"}`,
    `등록 시간: ${bundle.registeredAt}`,
    `App Version: ${bundle.appVersion}`,
  ].join("\n");
}

/** 지원 이메일이 설정된 경우에만 mailto 초안을 띄운다 — 설정 안 돼 있으면(기본값)
 * 클립보드 복사만 한다. 이메일을 대신 만들어 보내지 않는다: 여기서 여는 건 사용자
 * 메일 클라이언트의 "쓰기" 화면일 뿐, 실제 전송은 사용자가 직접 눌러야 한다. */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/**
 * 등록 실패 시 노출되는 "문의하기" 버튼 — 사용자가 원인을 설명할 필요 없이,
 * URL/Site/Platform/ErrorCode/ErrorMessage/TraceId/등록시간/AppVersion을 한 번에
 * 클립보드로 복사하고(설정돼 있으면 메일 초안도 같이 연다) 그대로 전달할 수 있게 한다.
 */
export function SupportInquiryButton({ bundle }: { bundle: DiagnosticBundle }) {
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    const text = formatBundle(bundle);
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {
        // 클립보드 권한이 없는 환경 — mailto만이라도 열어준다.
      });

    if (SUPPORT_EMAIL) {
      const subject = encodeURIComponent(`[CartPilot] 등록 실패 문의 (${bundle.errorCode ?? "미분류"})`);
      const body = encodeURIComponent(text);
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
      >
        문의하기
      </button>
      <span className="text-xs text-text-tertiary">
        {copied
          ? `진단 정보가 복사되었습니다${SUPPORT_EMAIL ? " — 메일 앱을 확인해주세요" : ""}`
          : "클릭하면 진단 정보가 클립보드에 복사됩니다"}
      </span>
    </div>
  );
}
