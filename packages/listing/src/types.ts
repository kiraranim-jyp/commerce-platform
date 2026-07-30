import type { ErrorCode, PlatformId } from "@commerce/shared";

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
 * LIVE: 실제 플랫폼에 등록한다. 쿠팡은 서버 API 라우트(/api/coupang/register)로
 *   위임해서 실제로 시도한다 — 이 환경처럼 COUPANG_ACCESS_KEY 등이 없으면
 *   NOT_CONFIGURED로 막히고, 있으면 실제 쿠팡 Open API를 호출한다.
 */
export type ExecutionMode = "DRY_RUN" | "PREVIEW" | "LIVE";

/** 실패 원인을 사용자에게 다른 문장/CTA로 보여주기 위한 분류.
 * IMAGE: 대표/추가 이미지가 플랫폼이 요구하는 형식(JPG 등)을 만족하지 못함.
 * COUPANG_API: 쿠팡 서버가 요청은 정상 인증했지만 등록을 거부함(필수 옵션 누락,
 *   카테고리 코드 오류 등) — AUTHENTICATION/CATEGORY/VALIDATION 어디에도 깔끔히
 *   안 들어가는, 쿠팡 응답 메시지를 그대로 보여줘야 하는 나머지 경우들. */
export type ListingErrorStep =
  | "VALIDATION"
  | "CATEGORY"
  | "AUTHENTICATION"
  | "NETWORK"
  | "IMAGE"
  | "COUPANG_API"
  | "NOT_IMPLEMENTED";

/**
 * 플랫폼 LIVE 등록 API에 대한 인증 연결 상태 — "쿠팡 연결 상태" UI 배지용.
 * UNKNOWN: 아직 확인 안 함(탭 진입 전). CHECKING: 확인 요청 중.
 * NOT_CONFIGURED: 서버에 인증 정보(access/secret/vendorId)가 아예 없음 — 이번
 *   세션처럼 LIVE 인증 정보를 안 넣은 로컬/스테이징 환경에서 나오는 정상 상태다.
 * CONNECTED: 인증 정보가 있고 쿠팡이 서명을 정상 수락함.
 * AUTH_FAILED: 인증 정보는 있지만 쿠팡이 서명/키를 거부함(오타, 만료 등).
 */
export type PlatformConnectionStatus =
  | "UNKNOWN"
  | "CHECKING"
  | "NOT_CONFIGURED"
  | "CONNECTED"
  | "AUTH_FAILED";

export interface ListingError {
  step: ListingErrorStep;
  message: string;
  retryable: boolean;
  resolution?: string;
  /** 문의하기/Registration Report에서 쓰는 표준 에러 코드 — step보다 더 세분화된
   * 원인 식별자다. 기존 step 분류를 대체하지 않고 나란히 둔다(하위 호환). */
  code?: ErrorCode;
}

/** 등록 시도 한 단계(인증 확인/설정 확인/카테고리 확인/API 호출 등)의 진행 로그
 * 한 줄 — 어느 단계에서 실패했는지 한눈에 보여주기 위한 용도다. */
export interface RegistrationStepLog {
  step: string;
  status: "success" | "failed" | "skipped";
  message: string;
  timestamp: string;
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
  /** 이 시도를 식별하는 고유 ID — 문의하기에 포함해서 서버 로그와 대조할 수 있게 한다. */
  traceId?: string;
  /** LIVE 등록 처리에 걸린 시간(ms) — 서버 라우트가 요청을 받은 시점부터 응답을
   * 만들기 직전까지. Registration Report의 "소요시간"에 쓴다. */
  durationMs?: number;
  /** 인증 확인 → 설정 확인 → 카테고리 확인 → 이미지 확인 → API 호출 → 완료 순서의
   * 단계별 로그 — LIVE 등록에서만 채워진다. */
  steps?: RegistrationStepLog[];
  /** Sprint B(Product Compliance Engine) — "등록됐다"와 별개로 "얼마나 실제
   * 판매/승인 가능한 수준인가"를 보여준다. 지금은 쿠팡만 채운다(coupang/
   * compliance-report.ts의 ComplianceReport) — payload와 같은 이유로 unknown:
   * 플랫폼마다 컴플라이언스 항목이 다를 수 있어 여기서 구체 타입을 강제하지 않는다. */
  complianceReport?: unknown;
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
  /** 같은 상품을 같은 플랫폼에 중복 LIVE 등록하지 않기 위한 키(productHash+platform
   * 대신 sourceUrl+platform으로 충분하다 — 세션 안에서만 비교하면 되므로). LIVE
   * 등록을 시도하기 전 이 값으로 기존 성공 이력이 있는지 먼저 확인한다. */
  listingKey?: string;
}

/**
 * 등록 시도 하나가 끝난 뒤 보여주는 요약 — buildRegistrationReport()(coupang.executor.ts
 * 옆에 둔다)가 ListingResult에서 파생시킨다. 성공/실패에 따라 보여줄 필드가
 * 근본적으로 다르므로 판별 유니언으로 분리한다.
 */
export interface RegistrationReportSuccess {
  outcome: "SUCCESS";
  productName: string;
  imageCount: number;
  optionCount: number;
  externalProductId?: string;
  durationMs?: number;
}

export interface RegistrationReportFailure {
  outcome: "FAILURE";
  reason: string;
  code?: ErrorCode;
  autoRetryable: boolean;
  resolution?: string;
}

export type RegistrationReport = RegistrationReportSuccess | RegistrationReportFailure;
