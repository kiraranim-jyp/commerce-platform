"use client";

import type {
  CoupangPayload,
  ListingErrorStep,
  ListingResult,
  ListingStatus,
  ReadinessReport,
  RegistrationStepLog,
  SmartStorePayload,
} from "@commerce/listing";
import { buildRegistrationReport } from "@commerce/listing";
import { APP_VERSION } from "@/lib/app-version";
import { CoupangPayloadInspector } from "./CoupangPayloadInspector";
import { PayloadInspector } from "./PayloadInspector";
import { ReadinessScorePanel } from "./ReadinessScorePanel";
import { SupportInquiryButton } from "./SupportInquiryButton";

const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "상품 준비 중",
  READY: "등록 가능",
  USER_CONFIRMED: "등록 대기",
  SUBMITTING: "등록 중",
  SUBMITTED: "등록 완료",
  FAILED: "등록 실패",
};

/** ListingError.step -> "실패 단계" 사용자용 문구. */
const ERROR_STEP_LABELS: Record<ListingErrorStep, string> = {
  VALIDATION: "상품 정보 확인",
  CATEGORY: "카테고리 확인",
  AUTHENTICATION: "쿠팡 연결 확인",
  NETWORK: "쿠팡 서버 연결",
  IMAGE: "이미지 처리",
  COUPANG_API: "상품 등록 요청",
  NOT_IMPLEMENTED: "상품 등록 요청",
};

/** 이미지가 data URL(base64)로 들어있으면 그대로 JSON.stringify하면 payload
 * 미리보기가 base64 덩어리로 뒤덮인다 — 표시용으로만 줄여서 보여준다. */
function payloadReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:") && value.length > 80) {
    return `${value.slice(0, 40)}…(${value.length}자)`;
  }
  return value;
}

function isSmartStorePayload(payload: unknown): payload is SmartStorePayload {
  return typeof payload === "object" && payload !== null && "product" in payload && "shipping" in payload;
}

function isCoupangPayload(payload: unknown): payload is CoupangPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "sellerProductName" in payload &&
    "items" in payload
  );
}

/** 문의하기 진단 번들의 "Site" 필드용 — URL 파싱이 실패해도(빈 값 등) 화면이 깨지지
 * 않도록 항상 문자열을 반환한다. */
function safeHostname(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const STEP_STATUS_ICON: Record<RegistrationStepLog["status"], string> = {
  success: "✓",
  failed: "✗",
  skipped: "—",
};

const STEP_STATUS_CLASS: Record<RegistrationStepLog["status"], string> = {
  success: "text-success",
  failed: "text-error",
  skipped: "text-text-tertiary",
};

/** 등록 시도가 어느 단계(인증 확인 → 설정 확인 → API 호출 → 완료)까지 갔다가
 * 어디서 실패했는지 한눈에 보여준다 — SUBMITTED/FAILED 양쪽에서 재사용한다. */
function StepLogList({ steps }: { steps: RegistrationStepLog[] }) {
  return (
    <ol className="mt-3 space-y-1 rounded-md bg-surface p-3 text-xs">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className={`shrink-0 font-medium ${STEP_STATUS_CLASS[step.status]}`}>
            {STEP_STATUS_ICON[step.status]}
          </span>
          <span className="text-text-primary">
            {step.step}
            <span className="ml-1.5 text-text-secondary">{step.message}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ListingSection({
  platformLabel,
  status,
  result,
  readiness,
  onFixTextField,
  onFixNumberField,
  onOpenModal,
  onRetry,
  settingsMissing,
  sourceUrl,
}: {
  platformLabel: string;
  status: ListingStatus;
  result: ListingResult | null;
  /** SmartStore에서만 넘어온다 — 있으면 점수/체크리스트/보완 UI를 보여준다. */
  readiness?: ReadinessReport;
  onFixTextField?: (field: "countryOfOrigin" | "returnPolicy", value: string) => void;
  onFixNumberField?: (field: "shippingFee" | "stockQuantity", value: number) => void;
  onOpenModal: () => void;
  onRetry: () => void;
  /** 쿠팡 탭에서만 넘어온다 — 판매자 계정 설정(출고지/반품지/택배사 등)이 저장 안
   * 됐으면 등록 버튼 대신 이 목록과 "설정하러 가기" 버튼을 보여준다. 아직 상품
   * 데이터를 확인하기 전(READY/DRAFT)에만 끼어든다 — 이미 등록을 시도한 뒤라면
   * 그 결과 화면을 그대로 보여준다. */
  settingsMissing?: string[];
  /** 문의하기 진단 번들의 URL/Site 필드용 — 원본 상품 URL. */
  sourceUrl?: string;
}) {
  if ((status === "DRAFT" || status === "READY") && settingsMissing && settingsMissing.length > 0) {
    return (
      <section className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm">
        <p className="font-medium text-warning">⚠ {platformLabel} 등록을 위해 추가 설정이 필요합니다.</p>
        <p className="mt-2 text-xs font-medium text-text-secondary">필수 항목</p>
        <ul className="mt-1 space-y-1 text-xs text-text-secondary">
          {settingsMissing.map((label) => (
            <li key={label}>□ {label}</li>
          ))}
        </ul>
        <a
          href="/settings"
          className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          설정하러 가기
        </a>
      </section>
    );
  }

  if (status === "DRAFT" || status === "READY") {
    if (readiness && onFixTextField && onFixNumberField) {
      return (
        <div className="space-y-3">
          <ReadinessScorePanel
            report={readiness}
            onFixTextField={onFixTextField}
            onFixNumberField={onFixNumberField}
          />
          {status === "READY" ? (
            <button
              type="button"
              onClick={onOpenModal}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {platformLabel}에 등록
            </button>
          ) : (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
              누락된 정보를 모두 채우면 등록을 시작할 수 있습니다.
            </p>
          )}
        </div>
      );
    }

    if (status === "DRAFT") {
      return (
        <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
          <p className="text-text-secondary">
            필수 정보를 먼저 채워주세요 — 상품명, 대표이미지, 판매가격, 카테고리가 필요합니다.
          </p>
        </section>
      );
    }

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
    const report = result ? buildRegistrationReport(result) : null;
    return (
      <section className="rounded-lg border border-success/30 bg-success-soft p-4 text-sm">
        <p className="font-medium text-success">✓ 등록 완료</p>
        {result?.mode === "DRY_RUN" && (
          <p className="mt-1 text-xs text-warning">
            미리보기 모드 — 실제로 등록되지 않았습니다. 등록될 데이터만 검증하고 생성했습니다.
          </p>
        )}
        {result?.mode === "LIVE" && result.externalProductId && (
          <p className="mt-1 text-xs text-success">
            실제로 등록되었습니다 — 쿠팡 상품 ID: {result.externalProductId}. Wing에서 최종 확인해주세요.
          </p>
        )}
        {report?.outcome === "SUCCESS" && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-surface p-3 text-xs">
            <dt className="text-text-secondary">상품명</dt>
            <dd className="truncate text-text-primary">{report.productName || "—"}</dd>
            <dt className="text-text-secondary">이미지</dt>
            <dd className="text-text-primary">{report.imageCount}장</dd>
            <dt className="text-text-secondary">옵션</dt>
            <dd className="text-text-primary">{report.optionCount}개</dd>
            {report.externalProductId && (
              <>
                <dt className="text-text-secondary">등록번호</dt>
                <dd className="text-text-primary">{report.externalProductId}</dd>
              </>
            )}
            {report.durationMs != null && (
              <>
                <dt className="text-text-secondary">소요시간</dt>
                <dd className="text-text-primary">{(report.durationMs / 1000).toFixed(1)}초</dd>
              </>
            )}
          </dl>
        )}
        {result?.steps && result.steps.length > 0 && <StepLogList steps={result.steps} />}
        {result?.payload != null && (
          <div className="mt-3">
            {isSmartStorePayload(result.payload) ? (
              <PayloadInspector payload={result.payload} />
            ) : isCoupangPayload(result.payload) ? (
              <CoupangPayloadInspector payload={result.payload} />
            ) : (
              <pre className="max-h-48 overflow-auto rounded-md bg-surface p-2 text-[11px] text-text-secondary">
                {JSON.stringify(result.payload, payloadReplacer, 2)}
              </pre>
            )}
          </div>
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
    const isCategoryError = result.error.step === "CATEGORY";
    const code = result.error.code;
    const bundle = {
      url: sourceUrl ?? "",
      site: safeHostname(sourceUrl),
      platform: platformLabel,
      errorCode: code,
      errorMessage: result.error.message,
      traceId: result.traceId,
      registeredAt: new Date().toISOString(),
      appVersion: APP_VERSION,
    };
    return (
      <section className="rounded-lg border border-error/30 bg-error-soft p-4 text-sm">
        <div className="flex items-center gap-2">
          <p className="font-medium text-error">{platformLabel} 등록 실패</p>
          {code && (
            <span className="rounded-full bg-error/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-error">
              {code}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          실패 단계: {ERROR_STEP_LABELS[result.error.step]}
        </p>
        <p className="mt-1 text-xs text-text-secondary">원인: {result.error.message}</p>
        {result.error.resolution && (
          <p className="mt-1 text-xs text-text-secondary">해결 방법: {result.error.resolution}</p>
        )}
        <p className="mt-1 text-xs text-text-secondary">
          자동 해결 가능: {result.error.retryable ? "예 — 다시 시도해보세요" : "아니오 — 설정/데이터 확인 필요"}
        </p>
        {result.steps && result.steps.length > 0 && <StepLogList steps={result.steps} />}
        {result.error.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            {isCategoryError ? "카테고리 다시 선택" : "다시 시도"}
          </button>
        )}
        <SupportInquiryButton bundle={bundle} />
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
