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
  | "API001"
  | "API002"
  | "API003"
  | "API004"
  | "API005";

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
};
