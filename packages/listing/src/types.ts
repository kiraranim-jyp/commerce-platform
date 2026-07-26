import type { PlatformId } from "@commerce/shared";

/**
 * 사용자 화면에는 STATUS_LABELS로 번역해서 보여준다(예: DRAFT → "상품 준비 중").
 * DRAFT/READY는 저장된 값이 아니라 매 렌더마다 validation 결과로 파생시킨다 —
 * "필수 정보가 다 채워졌다"와 "사용자가 실제로 등록을 눌렀다"를 구분해야 하므로,
 * READY는 상태를 실제로 커밋하지 않고 화면 표시에만 쓴다(카테고리의
 * RECOMMENDED와 같은 패턴).
 */
export type ListingStatus =
  | "DRAFT"
  | "READY"
  | "USER_CONFIRMED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "FAILED";

/**
 * DRY_RUN: 실제 등록하지 않고 payload만 만들고 validation을 통과하는지 확인한다.
 * PREVIEW: DRY_RUN과 비슷하지만 상태를 SUBMITTED로 만들지 않고 READY로 멈춘다 —
 *   "등록될 데이터를 미리 보여주기만" 할 때 쓴다.
 * LIVE: 실제 플랫폼에 등록한다. 이번 Mission에는 실제 인증 정보가 없으므로
 *   LIVE를 시도해도 항상 인증 실패로 끝난다(코드가 있어도 실행되지 않는다).
 */
export type ExecutionMode = "DRY_RUN" | "PREVIEW" | "LIVE";

/** 실패 원인을 사용자에게 다른 문장/CTA로 보여주기 위한 분류. */
export type ListingErrorStep =
  | "VALIDATION"
  | "CATEGORY"
  | "AUTHENTICATION"
  | "NETWORK"
  | "NOT_IMPLEMENTED";

export interface ListingError {
  step: ListingErrorStep;
  message: string;
  retryable: boolean;
  resolution?: string;
}

export interface ListingResult {
  status: ListingStatus;
  platform: PlatformId;
  mode: ExecutionMode;
  externalProductId?: string;
  externalUrl?: string;
  submittedAt?: string;
  error?: ListingError;
  retryable: boolean;
  /** DRY_RUN/PREVIEW에서 "실제로 등록됐다면 이런 데이터가 갔을 것"을 보여주기 위한 값. */
  payload?: unknown;
}

/** PM 스펙의 VALID/WARNING/ERROR — ListingModel.validations의 PASS/WARNING/ERROR와
 * 이름만 다르고 의미는 같다(VALID=PASS). 새 이름을 쓰는 이유는 이 리포트가
 * "등록 준비도"라는 사용자용 화면 개념이라 marketplace의 내부 validation 결과와
 * 섞이지 않도록 구분하기 위해서다. */
export type ReadinessFieldStatus = "VALID" | "WARNING" | "ERROR";

export interface ReadinessField {
  field: string;
  label: string;
  status: ReadinessFieldStatus;
  message?: string;
  /** WARNING/ERROR일 때 보여줄 CTA 문구 — 예: "원산지 입력". */
  resolution?: string;
}

export interface ReadinessReport {
  fields: ReadinessField[];
  /** 0~100. VALID=1, WARNING=0.5, ERROR=0으로 평균 낸 값. */
  score: number;
  requiredTotal: number;
  requiredPassed: number;
  warningCount: number;
  errorCount: number;
}

/**
 * 등록 시도 이력 한 건 — 이번 Mission은 세션(브라우저 탭) 안에서만 들고 있는다.
 * 실제 DB 영속화는 범위 밖이다("이력을 저장할 수 있는 구조를 만든다"까지가
 * 요구사항이지, 새로고침 후에도 남아있어야 한다는 요구는 아니다).
 */
export interface RegistrationHistoryEntry {
  productName: string;
  platform: PlatformId;
  executedAt: string;
  mode: ExecutionMode;
  result: ListingResult;
}
