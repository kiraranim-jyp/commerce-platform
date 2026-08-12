"use client";

import type { PlatformConnectionStatus } from "@commerce/listing";

const STATUS_DISPLAY: Record<PlatformConnectionStatus, { label: string; className: string }> = {
  UNKNOWN: { label: "연결 상태 미확인", className: "text-text-tertiary" },
  CHECKING: { label: "확인 중…", className: "text-text-tertiary" },
  NOT_CONFIGURED: { label: "⚠ 연결 설정 필요", className: "text-warning" },
  CONNECTED: { label: "✓ 연결됨", className: "text-success" },
  AUTH_FAILED: { label: "✕ 인증 정보 확인 필요", className: "text-error" },
};

/** "방금 전"/"N분 전" — 초 단위까지는 필요 없어서 분 단위로만 반올림한다. */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}시간 전`;
}

/**
 * 페이지 로딩/탭 진입마다 커머스 API를 자동 호출하지 않는다 — 사용자가 [연결 다시
 * 확인]을 눌렀을 때만 실제 인증 요청이 나간다(불필요한 API 호출 방지 + 사용자가
 * "지금 확인 중"임을 명확히 인지하게 하기 위해). 등록 직전에는 CommerceWorkspace가
 * 이 컴포넌트와 별개로 한 번 더 자동 재확인한다.
 *
 * N-3.8 — "Naver/Coupang을 서로 다른 제품처럼 만들지 않는다" 원칙에 따라, 원래
 * 쿠팡 전용이던 이 컴포넌트를 platformLabel prop으로 일반화해서 네이버 연결
 * 상태 표시(커머스 계정 관리)에도 그대로 재사용한다 — 새 컴포넌트를 만들지 않았다.
 */
export function CoupangConnectionPanel({
  status,
  checking,
  checkedAt,
  onCheck,
  platformLabel = "쿠팡",
}: {
  status: PlatformConnectionStatus;
  checking: boolean;
  checkedAt: string | null;
  onCheck: () => void;
  platformLabel?: string;
}) {
  const display = STATUS_DISPLAY[status];

  return (
    <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-text-primary">{platformLabel} 연결</p>
          <p className={`mt-0.5 text-sm font-medium ${display.className}`}>
            {checking ? "확인 중…" : display.label}
          </p>
          {checkedAt && !checking && (
            <p className="mt-0.5 text-xs text-text-tertiary">마지막 확인: {formatRelativeTime(checkedAt)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background disabled:opacity-50"
        >
          {checking ? "확인 중…" : "연결 다시 확인"}
        </button>
      </div>
    </section>
  );
}
