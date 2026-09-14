"use client";

import type { ReactNode } from "react";
import type { ListingStatus } from "@commerce/listing";
import type { ReadinessItem } from "./readiness";
import { buildSummaryChecks } from "./summary-checklist";

/**
 * REWORK-7 ①(CEO 판정, 2026-09-15) — **승인 없이 늘린 우측 요약을 원복한다.**
 *
 * ── 없앤 것 ──────────────────────────────────────────────────────────────
 *   · 「법적 필수 / 비즈니스 설정 / 상품 정보 / 선택 입력」 네 묶음의 **필드
 *     나열**(상품명 · 브랜드 · 대표이미지 · 이미지 형식 · 판매가격 · 상세설명 …).
 *     좌측 상세가 이미 섹션마다 보여주는 것과 같은 목록이었다.
 *   · 큰 퍼센트 숫자와 진행 막대. CEO 판정 — 등록 가능성은 퍼센트보다
 *     **등록을 막는 필수 조건** 중심으로 말한다.
 *   · 자동 입력 % / 사용자 입력 % 격자(autoFillStats). 등록 여부와 무관한
 *     운영 지표라 이 자리에 설 이유가 없다.
 *
 * ── 대신 서는 것 ─────────────────────────────────────────────────────────
 *   ② 필수 확인 — 자리(섹션) 단위 체크 ✓ 카테고리 / ✓ 상품정보 / …
 *      (buildSummaryChecks — 판정이 아니라 접기다, summary-checklist.ts 참고)
 *   ④ [등록 시작] — 세 채널이 같은 문구를 쓰는 단 하나의 등록 진입점.
 *
 * ── 판정은 여전히 여기서 하지 않는다 ──────────────────────────────────────
 * required/allRequiredPassed/status는 전부 호출부가 이미 계산해 둔 값이고,
 * 이 컴포넌트는 그것을 접어서 보여줄 뿐이다.
 */

/** 등록 진행 축(status)에서만 문구가 갈린다 — 등록 전에는 언제나 [등록 시작]이다. */
const BUTTON_LABEL: Partial<Record<ListingStatus, string>> = {
  USER_CONFIRMED: "등록 대기 중...",
  SUBMITTING: "등록 중...",
  SUBMITTED: "등록 완료 ✓",
  FAILED: "등록 실패 — 아래에서 다시 시도",
  // N-3.50 STEP7 — Wing 확인 없이 바로 재시도 버튼을 누르면 중복 등록 위험이
  // 있어 문구로 먼저 막는다.
  UNKNOWN: "등록 결과 확인 필요 — Wing에서 먼저 확인해주세요",
};

export function RegistrationReadinessCard({
  isCalculating = false,
  errorMessage = null,
  onRetry,
  required,
  allRequiredPassed,
  status,
  onRegister,
  registrationEnabled = true,
  percentUnavailable = null,
  verifyAction = null,
}: {
  /** N-3.72 — 계산 중에는 required/allRequiredPassed를 신뢰할 수 없다. 확정
   * 판정처럼 보이는 화면 대신 중립적인 로딩 표시만 세운다. */
  isCalculating?: boolean;
  /** N-3.73 STEP1/2 — "값이 없다"와 "확인 자체가 안 됐다"를 같은 화면으로
   * 뭉치지 않는다. 있으면 전용 실패 화면을 보여준다. */
  errorMessage?: string | null;
  onRetry?: () => void;
  required: ReadinessItem[];
  allRequiredPassed: boolean;
  status: ListingStatus;
  onRegister: () => void;
  /** Sprint N-2.7 — false면 등록 버튼을 항상 비활성화하고 "미리보기 전용"으로 바꾼다. */
  registrationEnabled?: boolean;
  /**
   * REWORK-2 — **숫자를 말할 수 없는 상태**를 위한 자리. 롯데ON은 표준
   * 카테고리가 전시카테고리·고시 품목코드·과세구분·요구 안전인증을 함께
   * 결정하므로, 고르기 전에는 필수 항목의 **목록 자체**가 정해지지 않는다.
   * 그때 필수 확인 목록 대신 이 노드가 선다.
   */
  percentUnavailable?: ReactNode;
  /**
   * REWORK-2 — 등록 버튼 **바로 위**의 보조 행동. 롯데ON처럼 등록 전에 서버
   * 검증을 따로 돌리는 채널의 [등록 정보 확인]이 여기 온다.
   */
  verifyAction?: ReactNode;
}) {
  const canRegister = registrationEnabled && allRequiredPassed && status === "READY";
  const checks = buildSummaryChecks(required);

  if (isCalculating) {
    return (
      <section className="space-y-2 border-t border-border px-4 py-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">필수 확인</p>
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-warning-soft border-t-warning"
          />
          확인 중…
        </p>
        <p className="text-xs text-text-tertiary">
          가격/카테고리/인증정보 등 방금 입력한 값을 다시 확인하고 있습니다.
        </p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="space-y-2 border-t border-border bg-error-soft px-4 py-3 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">필수 확인</p>
        <p className="text-sm font-medium text-error">🔴 등록 가능 여부 확인 실패</p>
        <p className="text-xs text-text-secondary">{errorMessage}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-md border border-error/40 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-soft"
          >
            다시 확인
          </button>
        )}
      </section>
    );
  }

  return (
    <>
      {/* ② 필수 확인 — 자리 단위 체크. 필드를 나열하지 않는다. */}
      <section className="border-t border-border px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">필수 확인</p>
        {percentUnavailable ? (
          <div className="mt-1.5">{percentUnavailable}</div>
        ) : checks.length === 0 ? (
          <p className="mt-1.5 text-xs text-text-tertiary">확인할 필수 항목이 없습니다.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center gap-1.5 text-xs">
                <span aria-hidden className={`shrink-0 ${check.passed ? "text-success" : "text-error"}`}>
                  {check.passed ? "✓" : "✗"}
                </span>
                <span className={check.passed ? "text-text-secondary" : "font-medium text-text-primary"}>
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ④ 등록 시작 — 세 채널이 같은 문구를 쓰는 하나뿐인 등록 진입점. */}
      <section className="space-y-2 border-t border-border px-4 py-3">
        {verifyAction}
        <button
          type="button"
          onClick={onRegister}
          disabled={!canRegister}
          className={`w-full rounded-md px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
            status === "SUBMITTED"
              ? "bg-success-soft text-success"
              : status === "FAILED"
                ? "bg-error-soft text-error"
                : "bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
          }`}
        >
          {!registrationEnabled
            ? "미리보기 전용 — 등록 기능은 준비 중입니다"
            : (BUTTON_LABEL[status] ?? "등록 시작")}
        </button>
      </section>
    </>
  );
}
