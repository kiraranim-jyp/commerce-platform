import type { CanonicalProduct } from "@commerce/shared";
import type { SoonConnectionStatus } from "./connection-status";

/**
 * N-4.02 Part N/O/P(대표님 지시) — SmartStore/Coupang 기존 코드는 전혀
 * 건드리지 않는다("기존 API path 변경 금지"). 이 파일은 완전히 새로운
 * 네임스페이스(packages/marketplace/src/soon/)에서, 아직 실제 credential이
 * 없는 차기 마켓플레이스(11번가/G마켓·옥션)를 위한 "내부적으로는 완성도
 * 있게, 화면에는 노출하지 않는" 어댑터 계약을 정의한다.
 *
 * 필드 상태 3단계(PART B-1)를 SmartStore attribute-resolver.ts와 동일한
 * 어휘로 통일한다 — MATCHED(확실히 매칭)/UNRESOLVED(원문은 있지만 못
 * 채움)/NOT_AVAILABLE(이 마켓·카테고리에 해당 필드 자체가 없음).
 */
export type FieldMatchStatus = "MATCHED" | "UNRESOLVED" | "NOT_AVAILABLE";

export interface CategoryResolution {
  status: FieldMatchStatus;
  categoryId: string | null;
  categoryName: string | null;
  reason?: string;
}

export interface OptionResolution {
  status: FieldMatchStatus;
  options: { name: string; values: string[] }[];
  reason?: string;
}

export interface AttributeResolution {
  status: FieldMatchStatus;
  attributes: { name: string; value: string }[];
  reason?: string;
}

export interface DeliveryResolution {
  status: FieldMatchStatus;
  reason?: string;
}

export interface PayloadIssue {
  field: string;
  severity: "MISSING" | "BLOCKED";
  reason: string;
}

export interface PayloadBuildResult<TPayload> {
  payload: TPayload | null;
  issues: PayloadIssue[];
}

export interface ValidationResult {
  ok: boolean;
  issues: PayloadIssue[];
}

/** 이번 스프린트에서는 이 상태만 실제로 나온다 — SOON 어댑터는 register()를
 * 실제로 호출하지 않는다(대표님 지시: "실제 신규 Marketplace API 호출은
 * 승인 필요"). credential이 있어도 마찬가지다 — SOON이라는 상태 자체가
 * "이번 스프린트엔 절대 실호출 안 함"이라는 뜻이다. */
export type RegistrationStatus = "NOT_IMPLEMENTED";

export interface RegistrationResult {
  status: RegistrationStatus;
  message: string;
}

/**
 * PART N 공통 계약 — CanonicalProduct → MarketplaceAdapter. SmartStore/Coupang의
 * 기존 어댑터(packages/marketplace/src/adapters/*)는 이 인터페이스를 구현하도록
 * 리팩터링하지 않는다(회귀 위험, 이번 스프린트 범위 밖) — 새 마켓플레이스만
 * 이 계약으로 시작한다.
 */
export interface NextGenMarketplaceAdapter<TPayload = unknown> {
  readonly id: string;
  readonly label: string;
  readonly status: "SOON";
  /** N-4.04 Part S — credential 존재 여부(호출부가 env 확인 후 넘긴다)만 받고,
   * 이 API 자체가 아직 공식 스펙 확보 전인지는 어댑터가 안다(resolveConnectionStatus
   * 내부에서 apiSpecConfirmed를 하드코딩) — 이 함수는 실제 네트워크 호출을 하지
   * 않는 순수 함수다. */
  resolveConnectionStatus(hasCredentials: boolean): SoonConnectionStatus;
  resolveCategory(product: CanonicalProduct): CategoryResolution;
  resolveOptions(product: CanonicalProduct): OptionResolution;
  resolveAttributes(product: CanonicalProduct, category: CategoryResolution): AttributeResolution;
  resolveDelivery(product: CanonicalProduct): DeliveryResolution;
  buildPayload(product: CanonicalProduct): PayloadBuildResult<TPayload>;
  validate(payload: TPayload): ValidationResult;
  register(payload: TPayload): Promise<RegistrationResult>;
}
