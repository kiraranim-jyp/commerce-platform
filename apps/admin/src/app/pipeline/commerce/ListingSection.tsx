"use client";

import type { ListingResult, ListingStatus } from "@commerce/listing";

const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "상품 준비 중",
  READY: "등록 가능",
  USER_CONFIRMED: "등록 대기",
  SUBMITTING: "등록 중",
  SUBMITTED: "등록 완료",
  FAILED: "등록 실패",
};

/** 이미지가 data URL(base64)로 들어있으면 그대로 JSON.stringify하면 payload
 * 미리보기가 base64 덩어리로 뒤덮인다 — 표시용으로만 줄여서 보여준다. */
function payloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 80) {
    return `${value.slice(0, 40)}…(${value.length}자)`;
  }
  return value;
}

export function ListingSection({
  platformLabel,
  status,
  result,
  onOpenModal,
  onRetry,
}: {
  platformLabel: string;
  status: ListingStatus;
  result: ListingResult | null;
  onOpenModal: () => void;
  onRetry: () => void;
}) {
  if (status === "DRAFT") {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
        <p className="text-text-secondary">
          필수 정보를 먼저 채워주세요 — 상품명, 대표이미지, 판매가격, 카테고리가 필요합니다.
        </p>
      </section>
    );
  }

  if (status === "READY") {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
        <p className="font-medium text-text-primary">상품 등록 준비 완료</p>
        <p className="mt-1 text-xs text-text-secondary">
          필수 정보가 모두 준비됐습니다. 등록 전 마지막으로 확인해주세요.
        </p>
        <button
          type="button"
          onClick={onOpenModal}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {platformLabel}에 등록
        </button>
      </section>
    );
  }

  if (status === "USER_CONFIRMED" || status === "SUBMITTING") {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
        <p className="font-medium text-text-primary">{STATUS_LABELS[status]}</p>
        <ol className="mt-3 space-y-1.5 text-xs">
          <ProgressStep done label="상품 데이터 확인" />
          <ProgressStep done label="이미지 준비" />
          <ProgressStep
            done={false}
            current={status === "SUBMITTING"}
            label={`${platformLabel} 등록 중`}
          />
          <ProgressStep done={false} label="등록 완료" />
        </ol>
      </section>
    );
  }

  if (status === "SUBMITTED") {
    return (
      <section className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm">
        <p className="font-medium text-success">✓ 등록 완료</p>
        {result?.mode === "DRY_RUN" && (
          <p className="mt-1 text-xs text-warning">
            DRY_RUN 모드 — 실제로 등록되지 않았습니다. 등록될 데이터만 검증하고 생성했습니다.
          </p>
        )}
        {result?.payload != null && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-surface p-2 text-[11px] text-text-secondary">
            {JSON.stringify(result.payload, payloadReplacer, 2)}
          </pre>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
        >
          다시 준비하기
        </button>
      </section>
    );
  }

  if (status === "FAILED" && result?.error) {
    const isCategoryError = result.error.step === "category";
    return (
      <section className="rounded-lg border border-error/30 bg-error-soft p-4 text-sm">
        <p className="font-medium text-error">{platformLabel} 등록 실패</p>
        <p className="mt-1 text-xs text-text-secondary">원인: {result.error.message}</p>
        {result.error.resolution && (
          <p className="mt-1 text-xs text-text-secondary">해결 방법: {result.error.resolution}</p>
        )}
        {result.error.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            {isCategoryError ? "카테고리 다시 선택" : "다시 시도"}
          </button>
        )}
      </section>
    );
  }

  return null;
}

function ProgressStep({
  done,
  current,
  label,
}: {
  done: boolean;
  current?: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className={done ? "text-success" : current ? "text-warning" : "text-text-tertiary"}>
        {done ? "✓" : current ? "●" : "○"}
      </span>
      <span className={done || current ? "font-medium text-text-primary" : "text-text-tertiary"}>
        {label}
      </span>
    </li>
  );
}
