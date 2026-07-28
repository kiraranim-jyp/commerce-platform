"use client";

import { useState } from "react";
import type { RegistrationStepLog } from "@commerce/listing";

export interface DiagnosticBundle {
  url: string;
  site: string;
  platform: string;
  errorCode?: string;
  errorMessage: string;
  traceId?: string;
  registeredAt: string;
  appVersion: string;
  stepLog?: RegistrationStepLog[];
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
 * 클립보드 복사 + 서버 저장만 한다. 이메일을 대신 만들어 보내지 않는다: 여기서
 * 여는 건 사용자 메일 클라이언트의 "쓰기" 화면일 뿐, 실제 전송은 사용자가 직접
 * 눌러야 한다. */
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/**
 * 등록 실패 시 노출되는 "문의하기" 버튼 — 클릭하면 선택 메모 입력창이 펼쳐지고,
 * 제출하면 (1) /api/support/inquiries에 저장(관리자 문의 게시판에서 확인),
 * (2) 클립보드에 복사(설정돼 있으면 메일 초안도 같이 연다) 두 가지를 동시에 한다.
 * 서버 저장이 실패해도(Supabase 미설정 등) 클립보드 복사는 항상 동작한다 — 사용자
 * 경험이 백엔드 상태에 좌우되지 않게 한다.
 */
export function SupportInquiryButton({ bundle }: { bundle: DiagnosticBundle }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done">("idle");

  const handleSubmit = async () => {
    setState("submitting");
    const text = formatBundle(bundle);

    void fetch("/api/support/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errorCode: bundle.errorCode,
        errorMessage: bundle.errorMessage,
        traceId: bundle.traceId,
        url: bundle.url,
        platform: bundle.platform,
        site: bundle.site,
        appVersion: bundle.appVersion,
        occurredAt: bundle.registeredAt,
        userNote: note.trim() || undefined,
        stepLog: bundle.stepLog,
      }),
    }).catch(() => {
      // 저장 실패는 조용히 무시 — 클립보드 복사가 항상 동작하는 폴백이다.
    });

    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // 클립보드 권한이 없는 환경 — mailto만이라도 열어준다.
    }

    if (SUPPORT_EMAIL) {
      const subject = encodeURIComponent(`[CartPilot] 등록 실패 문의 (${bundle.errorCode ?? "미분류"})`);
      const body = encodeURIComponent(note ? `${text}\n\n메모: ${note}` : text);
      window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    }

    setState("done");
  };

  if (!expanded) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
        >
          문의하기
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface p-3">
      <label className="text-xs text-text-secondary">
        추가로 알려주실 내용이 있으면 적어주세요(선택)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
        placeholder="예: 카테고리를 여러 번 선택해도 계속 실패해요"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={state === "submitting"}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {state === "submitting" ? "제출 중..." : "제출하기"}
        </button>
        <span className="text-xs text-text-tertiary">
          {state === "done"
            ? `진단 정보가 접수·복사되었습니다${SUPPORT_EMAIL ? " — 메일 앱을 확인해주세요" : ""}`
            : "제출하면 진단 정보가 저장되고 클립보드에도 복사됩니다"}
        </span>
      </div>
    </div>
  );
}
