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
 */
export interface PlatformAdapter {
  platform: PlatformId;
  label: string;
  toListingModel(product: CanonicalProduct, categorySelection?: CategorySelection): ListingModel;
}
