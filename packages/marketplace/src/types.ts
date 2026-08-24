import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import type { CategorySelection } from "@commerce/category";

export type { PlatformId } from "@commerce/shared";

export type ValidationStatus = "PASS" | "WARNING" | "ERROR";

export interface ValidationResult {
  field: string;
  label: string;
  status: ValidationStatus;
  message?: string;
}

/**
 * CanonicalProduct를 플랫폼 등록 화면에 가깝게 변환한 결과. 실제 네이버/쿠팡 API
 * 요청 바디가 아니라 "이렇게 등록될 것이다"를 보여주기 위한 Preview 전용 모델이다.
 */
export interface ListingModel {
  platform: PlatformId;
  platformLabel: string;
  representativeImage?: string;
  additionalImages: string[];
  title: string;
  brand?: string;
  priceKrw: number;
  priceIsEstimate: boolean;
  options: string[];
  shippingInfo: string;
  description: string;
  /** 이 플랫폼에 대해 현재 선택된(또는 아직 미확정인) 카테고리 상태. 카테고리는
   * 플랫폼마다 다르므로 CanonicalProduct가 아니라 여기, ListingModel 단위로 갖는다. */
  category: CategorySelection;
  validations: ValidationResult[];
  /** 검증 결과를 0~100 점수로 요약한 것 — PASS=1점, WARNING=0.5점, ERROR=0점으로 계산한다. */
  registrableScore: number;
}

/**
 * 새 플랫폼을 추가할 때 CanonicalProduct나 다른 어댑터를 건드리지 않는다 —
 * 이 인터페이스를 구현하는 파일 하나만 추가하면 된다.
 *
 * categorySelection은 선택값이다 — 아직 카테고리 추천/선택이 이뤄지지 않은
 * 상태(UNRESOLVED)에서도 Preview는 정상적으로 렌더링되어야 한다.
 *
 * N-4.11 STEP11(대표님 지시: "실제 API를 기다리는 동안 공통 Adapter 계약만
 * 확정한다") — 조사 결과, 그 계약은 이미 존재한다. 다만 CommerceAdapter 하나로
 * 묶여 있지 않고 3개 인터페이스/함수 그룹으로 나뉘어 있다:
 *
 *   resolveCategory()  → CategoryProvider(@commerce/category, 플랫폼별 인스턴스)
 *   validate()          → this.toListingModel(...).validations (여기)
 *                          + validateNaverPayload/buildCoupangCompliance(플랫폼별)
 *   buildPayload()       → buildNaverProductPayload/buildCoupangPayload(플랫폼별)
 *   preview()            → toListingModel()(여기) + payload-preview API 라우트
 *   register()           → ListingExecutor.execute()(./executor.ts, packages/listing)
 *   getRegistrationStatus() → registration_attempts 조회(_lib/registration-status.ts)
 *
 * 하나의 CommerceAdapter 인터페이스로 강제 통합하지 않는다 — 지금 이 3그룹을
 * 억지로 하나로 묶으면 SmartStore/Coupang의 이미 동작 중인 등록 코드를 전부
 * 건드려야 한다(과도한 abstraction, 이번 작업지시서의 "절대 금지" 원칙과
 * 정면 충돌). 새 플랫폼(Kakao 등)을 추가할 때 지켜야 할 실제 최소 계약은
 * 이 5개 지점(카테고리 조회/검증/Payload 빌드/Preview/실행) 각각에 대응하는
 * 파일 하나씩을 만들고 PLATFORM_ADAPTERS(여기)와 LISTING_EXECUTORS(executor.ts)
 * 레지스트리에 등록하는 것 — 지금 SmartStore/Coupang이 이미 그렇게 돼 있다.
 */
export interface PlatformAdapter {
  platform: PlatformId;
  label: string;
  toListingModel(product: CanonicalProduct, categorySelection?: CategorySelection): ListingModel;
}
