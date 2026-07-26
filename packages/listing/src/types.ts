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

export interface ListingError {
  /** 어느 단계에서 실패했는지 — "validation" | "category" | "auth" | "not_implemented" | "network" 등. */
  step: string;
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
