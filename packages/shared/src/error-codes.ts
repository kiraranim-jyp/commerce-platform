/**
 * 파이프라인 전체(추출/이미지/AI/쿠팡 등록/외부 API)에서 쓰는 표준 에러 코드.
 * 목적은 두 가지다: (1) 사용자가 "이미지를 찾을 수 없습니다" 같은 짧은 메시지만 봐도
 * 되게 하고, (2) 우리가 문의를 받았을 때 코드 하나로 원인을 바로 특정하게 한다.
 *
 * Prefix:
 * - IMG: 이미지 추출/다운로드/형식 문제
 * - EXT: 상품 페이지 접근/상품 데이터(제목·가격 등) 추출 문제
 * - AI: AI 카테고리 추천/콘텐츠 생성/이미지 분류 문제
 * - CP: 쿠팡 등록에 필요한 데이터가 없거나 비즈니스 규칙에 안 맞는 문제(사용자가
 *   직접 고쳐야 하는 것들 — 카테고리 미선택, 배송/반품 설정 누락, 옵션 누락 등)
 * - API: 쿠팡(또는 외부 서비스) API 호출 자체의 기술적 실패(인증 거부, 네트워크,
 *   타임아웃, 예상 밖 응답) — 사용자가 직접 못 고치고 재시도/설정 확인이 필요한 것들
 */
export type ErrorCode =
  | "IMG001"
  | "IMG002"
  | "IMG003"
  | "IMG004"
  | "IMG005"
  | "EXT001"
  | "EXT002"
  | "EXT003"
  | "EXT004"
  | "AI001"
  | "AI002"
  | "AI003"
  | "CP001"
  | "CP002"
  | "CP003"
  | "CP004"
  | "CP005"
  | "CP006"
  | "CP007"
  | "CP008"
  | "API001"
  | "API002"
  | "API003"
  | "API004"
  | "API005"
  | "API006";

export type ErrorCodeCategory = "IMG" | "EXT" | "AI" | "CP" | "API";

export interface ErrorCodeInfo {
  category: ErrorCodeCategory;
  /** 사용자에게 보여줄 기본 설명 — 실제 표시 메시지는 대개 더 구체적인 message로
   * 덮어써진다. 이 값은 message가 없을 때의 폴백이자, 코드만 보고도 뜻을 알 수
   * 있게 하는 문서 역할을 한다. */
  defaultMessage: string;
  /** true면 Epic 6 자동 재시도 대상 — 사용자 개입 없이 다시 시도해서 해결될 가능성이
   * 있는 일시적 오류(네트워크/타임아웃/Rate Limit)만 true다. 데이터 누락처럼
   * 사용자가 고쳐야 하는 원인은 재시도해도 똑같이 실패하므로 false. */
  autoRetryable: boolean;
}

export const ERROR_CODE_INFO: Record<ErrorCode, ErrorCodeInfo> = {
  IMG001: {
    category: "IMG",
    defaultMessage: "상품 이미지를 찾을 수 없습니다.",
    autoRetryable: false,
  },
  IMG002: {
    category: "IMG",
    defaultMessage: "이미지 다운로드에 실패했습니다.",
    autoRetryable: true,
  },
  IMG003: {
    category: "IMG",
    defaultMessage: "이미지 형식 변환에 실패했습니다.",
    autoRetryable: false,
  },
  IMG004: {
    category: "IMG",
    defaultMessage: "대표 이미지가 지정되지 않았습니다.",
    autoRetryable: false,
  },
  IMG005: {
    category: "IMG",
    defaultMessage: "이미지 개수가 플랫폼 제한을 초과했습니다.",
    autoRetryable: false,
  },
  EXT001: {
    category: "EXT",
    defaultMessage: "상품 페이지에 접근할 수 없습니다.",
    autoRetryable: false,
  },
  EXT002: {
    category: "EXT",
    defaultMessage: "상품명을 찾을 수 없습니다.",
    autoRetryable: false,
  },
  EXT003: {
    category: "EXT",
    defaultMessage: "가격 정보를 찾을 수 없습니다.",
    autoRetryable: false,
  },
  EXT004: {
    category: "EXT",
    defaultMessage: "지원하지 않는 사이트 구조입니다.",
    autoRetryable: false,
  },
  AI001: {
    category: "AI",
    defaultMessage: "AI 카테고리 추천에 실패했습니다.",
    autoRetryable: false,
  },
  AI002: {
    category: "AI",
    defaultMessage: "AI 콘텐츠 생성에 실패했습니다.",
    autoRetryable: false,
  },
  AI003: {
    category: "AI",
    defaultMessage: "AI 이미지 분류에 실패했습니다.",
    autoRetryable: false,
  },
  CP001: {
    category: "CP",
    defaultMessage: "쿠팡 카테고리를 찾을 수 없습니다.",
    autoRetryable: false,
  },
  CP002: {
    category: "CP",
    defaultMessage: "배송정보(출고지)가 없습니다.",
    autoRetryable: false,
  },
  CP003: {
    category: "CP",
    defaultMessage: "반품지 설정이 없습니다.",
    autoRetryable: false,
  },
  CP004: {
    category: "CP",
    defaultMessage: "필수 옵션이 누락되었습니다.",
    autoRetryable: false,
  },
  CP005: {
    category: "CP",
    defaultMessage: "필수 입력값이 누락되었습니다.",
    autoRetryable: false,
  },
  CP006: {
    category: "CP",
    defaultMessage: "이미지 형식이 플랫폼 요구사항에 맞지 않습니다.",
    autoRetryable: false,
  },
  /** Sprint A-6(작업2 — 실패 원인 자동 분류) — CPO 요구사항: "KC를 별도 항목으로
   * 남긴다." KC/인증은 CartPilot이 원본 사이트에서 알 수 없는, 반드시 사람이
   * 채워야 하는 값이라 CP004/CP005(일반 필수값 누락)와 원인이 다르다 — 대응
   * 방법도 다르다(전자는 Resolver 개선 대상이 아니라 판매자가 실제 인증
   * 정보를 입력해야 하는 문제). */
  CP007: {
    category: "CP",
    defaultMessage: "KC/인증 등 법적 필수 정보가 확인되지 않았습니다.",
    autoRetryable: false,
  },
  CP008: {
    category: "CP",
    defaultMessage: "판매가격을 확인할 수 없습니다.",
    autoRetryable: false,
  },
  API001: {
    category: "API",
    defaultMessage: "쿠팡 인증 정보가 설정되어 있지 않습니다.",
    autoRetryable: false,
  },
  API002: {
    category: "API",
    defaultMessage: "쿠팡이 인증 정보를 거부했습니다.",
    autoRetryable: false,
  },
  API003: {
    category: "API",
    defaultMessage: "쿠팡 서버에 연결할 수 없습니다.",
    autoRetryable: true,
  },
  API004: {
    category: "API",
    defaultMessage: "쿠팡 API 호출이 실패했습니다.",
    autoRetryable: true,
  },
  API005: {
    category: "API",
    defaultMessage: "쿠팡이 등록 요청을 거부했습니다.",
    autoRetryable: false,
  },
  /** Sprint A-6(작업2) — 429는 API004(일반 API 실패)로 뭉뚱그리면 "일시적으로
   * 너무 많이 요청했다"는 원인이 "쿠팡이 데이터를 거부했다"는 원인과 섞여
   * 보인다 — 전자는 잠시 후 재시도하면 그만이고 후자는 데이터를 고쳐야 한다. */
  API006: {
    category: "API",
    defaultMessage: "쿠팡 API 요청 한도를 초과했습니다(Rate Limit).",
    autoRetryable: true,
  },
};

/**
 * Sprint A-6(작업2 — 실패 원인 자동 분류) — CPO가 지정한 9개 버킷(CATEGORY/
 * ATTRIBUTE/KC/OPTION/IMAGE/PRICE/API_ERROR/RATE_LIMIT/NETWORK)으로 기존
 * ErrorCode를 묶는다. "무조건 등록 실패"가 아니라 원인별로 다음 개선
 * 우선순위를 정할 수 있게 하는 게 목적이다 — ErrorCode 자체(더 세밀함)는 그대로
 * 두고, 이 함수는 리포트/대시보드 표시용 상위 분류만 담당한다.
 */
export type FailureBucket =
  | "CATEGORY"
  | "ATTRIBUTE"
  | "KC"
  | "OPTION"
  | "IMAGE"
  | "PRICE"
  | "API_ERROR"
  | "RATE_LIMIT"
  | "NETWORK";

const FAILURE_BUCKET_BY_CODE: Record<ErrorCode, FailureBucket> = {
  IMG001: "IMAGE",
  IMG002: "IMAGE",
  IMG003: "IMAGE",
  IMG004: "IMAGE",
  IMG005: "IMAGE",
  EXT001: "NETWORK",
  EXT002: "ATTRIBUTE",
  EXT003: "PRICE",
  EXT004: "NETWORK",
  AI001: "CATEGORY",
  AI002: "ATTRIBUTE",
  AI003: "IMAGE",
  CP001: "CATEGORY",
  CP002: "OPTION",
  CP003: "OPTION",
  CP004: "OPTION",
  CP005: "ATTRIBUTE",
  CP006: "IMAGE",
  CP007: "KC",
  CP008: "PRICE",
  API001: "NETWORK",
  API002: "NETWORK",
  API003: "NETWORK",
  API004: "API_ERROR",
  API005: "API_ERROR",
  API006: "RATE_LIMIT",
};

export function classifyFailureBucket(code: ErrorCode): FailureBucket {
  return FAILURE_BUCKET_BY_CODE[code];
}

/**
 * N-4.11 STEP12(대표님 지시: "커머스가 늘어나기 전에 공통 결과 형태를 확정한다,
 * 판매자에게는 기술 에러 대신 '쿠팡 카테고리가 필요합니다'처럼 보여야 한다") —
 * 조사 결과, 요청하신 형태는 이미 이 파일에 구현돼 있다:
 *
 *   등록 성공/실패     → ListingResult.status(packages/listing/src/types.ts)
 *   인증 실패          → API001/API002
 *   카테고리 오류       → AI001/CP001
 *   필수정보 누락       → CP005(일반)/CP002·CP003(배송·반품지)/CP004(옵션)
 *   가격 오류           → EXT003/CP008
 *   재고 오류           → 전용 코드 없음(쿠팡 API가 실제로 이 사유로 거부한
 *                          사례를 아직 실측하지 못했다 — 발생하면 API005
 *                          "쿠팡이 등록 요청을 거부했습니다"로 잡히고 있다.
 *                          실제 사례 확인 전에는 재고 전용 코드를 새로 만들지
 *                          않는다, 추측 코드 금지 원칙)
 *   배송정보 오류       → CP002/CP003
 *   커머스 API 오류     → API003/API004/API006
 *
 * 이 구조는 현재 Coupang(CP·API 코드) 전용으로 채워져 있지만 prefix 체계
 * (IMG/EXT/AI/CP/API) 자체는 플랫폼에 종속되지 않는다 — SmartStore/향후
 * Kakao가 등록 시점에 실패 사유를 이 표현으로 매핑하려면, 새 prefix(예: NV
 * for Naver, KK for Kakao)를 여기 ErrorCode 유니언에 추가하고
 * FAILURE_BUCKET_BY_CODE에 버킷만 매핑하면 된다 — 새 구조를 만들 필요 없다.
 * SmartStore는 지금 이 코드 체계 대신 필드별 READY/MISSING/BLOCKED
 * (validate-payload.ts)를 쓰는데, 그건 "등록 전 무엇이 부족한지"를 보여주는
 * 다른 층위의 문제라 여기서 통합하지 않는다(등록 실행 자체의 실패 사유
 * 분류가 이 파일의 역할).
 */
