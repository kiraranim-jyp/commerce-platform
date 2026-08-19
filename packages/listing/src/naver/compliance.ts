import type { CanonicalProduct } from "@commerce/shared";

/**
 * N-3.52/N-3.53(CPO 지시) — "API가 받아주면 등록"을 성공 기준으로 두지
 * 않는다. "API 등록이 가능하다" ≠ "법적으로 판매해도 된다"를 분리한다.
 * 네이버 공식 안내(스마트스토어 고객센터)도 구매대행 상품은 등록 전에
 * "KC가 필요한 품목인지, KC 없이 구매대행 가능한 품목인지"를 판매자가
 * 먼저 확인하도록 안내한다 — TTAEJYO가 그 법적 판단을 대신 내리지 않는다.
 * 이 파일은 그 판단을 "판매자가 직접 내리게" 만드는 상태 모델이다.
 *
 * N-3.53(CPO 지시) — KC를 4단계로 고정한다:
 * - NOT_APPLICABLE: 카테고리가 확정됐고, 어린이제품 인증(KC) 대상
 *   카테고리가 아님. 자동 통과 가능하지만 판매자 최종 확인은 여전히 필요
 *   (판매 전 최종 확인 화면에서 체크박스는 별도로 거친다).
 * - CERTIFIED_REFERENCE: 상세페이지/브랜드 자료 등 실제 자료에서 KC
 *   인증정보(번호/업체명/취득일자)가 확인된 경우. TTAEJYO가 인증번호를
 *   만들어내거나 추정하지 않는다 — 사용자가 직접 입력한 값만 인정한다.
 * - SELLER_REVIEW_REQUIRED: KC 대상 가능성이 있지만 TTAEJYO가 실제 인증
 *   여부를 확정할 수 없는 경우(예: KIDS인데 인증정보 미입력). 판매자가
 *   실제 자료/상황을 확인하고 명시적으로 승인해야만(SellerComplianceConfirmation)
 *   등록이 허용된다 — 브랜드가 유명하다는 이유로 자동 통과시키지 않는다
 *   (STEP4, CPO 지시).
 * - BLOCKED: TTAEJYO가 KC 대상 여부 자체를 판단할 근거가 없는 경우(카테고리
 *   미확정 등) — 등록 버튼 자체를 막는다. 판매자 확인으로도 우회할 수 없다.
 *
 * SAFETY_STANDARD_COMPLIANCE(안전기준 준수 대상, KC 인증번호와는 별개
 * 개념)는 의도적으로 이 enum에 넣지 않는다 — TTAEJYO에 카테고리별 안전기준
 * 세부 데이터가 없어 이 상태를 구분해 낼 실제 근거가 없다. 공식 자료로
 * 확인되지 않은 규칙을 코드로 지어내지 않는다는 원칙(CPO 지시)에 따라,
 * 그 경우도 지금은 SELLER_REVIEW_REQUIRED로 보낸다(판매자가 직접 확인).
 */
export type KcStatus = "NOT_APPLICABLE" | "CERTIFIED_REFERENCE" | "SELLER_REVIEW_REQUIRED" | "BLOCKED";

/** 정책이 바뀌면 기존 확인 기록을 영구히 신뢰하지 않는다(CPO STEP9) —
 * 값을 바꾸면 이전 policyVersion으로 저장된 SellerComplianceConfirmation은
 * register route의 재확인에서 더 이상 유효하지 않게 된다. */
export const COMPLIANCE_POLICY_VERSION = "2026-08-19";

/** register route가 DB에서 조회해 넘겨주는, 판매자가 실제로 확인한 기록의
 * 최소 형태 — 저장 스키마 전체(SellerComplianceConfirmation)는
 * apps/admin의 API 레이어에 있다(패키지에서는 DB에 접근하지 않는다).
 * N-3.53 — kcStatus 필드는 확인 시점의 상태를 남기는 감사 기록용이고,
 * registrable 판정 자체는 confirmed/policyVersion/categoryCode 세 값만
 * 본다(아래 isKcStatusRegistrable 참고). */
export interface SellerComplianceConfirmationInput {
  confirmed: boolean;
  kcStatus: KcStatus;
  policyVersion: string;
  categoryCode: string;
}

/**
 * KC 상태를 계산한다 — TTAEJYO가 직접 만들어낸 값(카테고리 분류 확정
 * 여부, 실제 인증정보 입력 여부)만 근거로 삼는다. 판매자 확인 여부는
 * 여기서 보지 않는다(N-3.53) — "TTAEJYO가 아는 것"과 "판매자가 확인한
 * 것"을 분리해야 상품 정보(카테고리 등)가 바뀌었을 때 이 함수의 결과값도
 * 그대로 다시 계산되고, registrable 판정만 별도로 무효화할 수 있다.
 */
export function resolveKcStatus(input: {
  categoryVerified: boolean;
  categoryRequiresChildCertification: boolean;
  childCertification: CanonicalProduct["childCertification"] | undefined;
}): KcStatus {
  if (!input.categoryVerified) return "BLOCKED";
  if (!input.categoryRequiresChildCertification) return "NOT_APPLICABLE";

  const cert = input.childCertification?.value;
  const hasFullCert = Boolean(cert?.certificationNumber && cert?.companyName && cert?.certificationDate);
  return hasFullCert ? "CERTIFIED_REFERENCE" : "SELLER_REVIEW_REQUIRED";
}

/**
 * 이 KC 상태로 실제 등록(POST)을 진행해도 되는지.
 * - NOT_APPLICABLE/CERTIFIED_REFERENCE: 항상 통과(단, 등록 자체는 별도의
 *   "판매 전 최종 확인" 체크박스를 여전히 거친다 — 이 함수는 KC 한정
 *   게이트다).
 * - SELLER_REVIEW_REQUIRED: 판매자가 이 카테고리/정책버전 기준으로 실제
 *   확인했다는 기록(SellerComplianceConfirmation)이 있을 때만 통과 —
 *   "유명 브랜드라서" 같은 추정으로는 절대 통과시키지 않는다(STEP4).
 * - BLOCKED: 판매자 확인으로도 우회할 수 없다 — 등록 버튼 자체를 막는다.
 */
export function isKcStatusRegistrable(
  status: KcStatus,
  sellerConfirmation: SellerComplianceConfirmationInput | null | undefined,
  context: { policyVersion: string; categoryCode: string },
): boolean {
  if (status === "NOT_APPLICABLE" || status === "CERTIFIED_REFERENCE") return true;
  if (status === "BLOCKED") return false;
  // SELLER_REVIEW_REQUIRED
  return Boolean(
    sellerConfirmation &&
      sellerConfirmation.confirmed &&
      sellerConfirmation.policyVersion === context.policyVersion &&
      sellerConfirmation.categoryCode === context.categoryCode,
  );
}

/**
 * 카테고리별 "판매 전 확인" 필요도. 법적으로 확정되지 않은 카테고리별
 * 규칙(전자제품 KC/방송통신기자재 인증 등)을 코드에 임의로 넣지 않는다 —
 * TTAEJYO가 실제로 갖고 있는 신호는 카테고리 확정 여부와
 * categoryRequiresChildCertification(어린이제품 여부) 둘뿐이다. 그 외
 * 카테고리는 REVIEW_REQUIRED가 아니라 LOW로 두되(추가로 막을 근거가
 * 없으므로), UI 문구에서 "TTAEJYO가 법적으로 안전하다고 판정한 것이
 * 아니다"를 명확히 한다(N-3.52 핵심 원칙).
 */
export type CategoryRiskLevel = "LOW" | "KIDS_REVIEW" | "REVIEW_REQUIRED";

export interface CategoryComplianceProfile {
  riskLevel: CategoryRiskLevel;
  requiresSellerReview: boolean;
  reasons: string[];
}

export function resolveCategoryComplianceProfile(input: {
  categoryVerified: boolean;
  categoryRequiresChildCertification: boolean;
}): CategoryComplianceProfile {
  if (!input.categoryVerified) {
    return {
      riskLevel: "REVIEW_REQUIRED",
      requiresSellerReview: true,
      reasons: ["카테고리가 아직 확정되지 않았습니다 — 카테고리를 먼저 확정해주세요."],
    };
  }
  if (input.categoryRequiresChildCertification) {
    return {
      riskLevel: "KIDS_REVIEW",
      requiresSellerReview: true,
      reasons: ["어린이제품(유아동) 카테고리입니다 — KC 인증정보 또는 판매 가능 여부를 확인해야 합니다."],
    };
  }
  return { riskLevel: "LOW", requiresSellerReview: false, reasons: [] };
}

/**
 * N-3.53(STEP5) — 하드코딩 if-분기가 카테고리마다 계속 늘어나는 걸
 * 막기 위한 최소 구조. 이번 스프린트에서 법률을 새로 해석해서 확정하지
 * 않는다 — TTAEJYO가 실제로 판별할 수 있는 신호가 있는 그룹(WEAR/KIDS)만
 * 채우고, 나머지는 전부 GENERAL(REVIEW_REQUIRED 기본)로 보수적으로
 * 표시한다. 실제 데이터/API 신호가 생기기 전까지 TOY/ELECTRONICS/
 * COSMETIC/FOOD/HOUSEHOLD_CHEMICAL 세부 규칙을 지어내지 않는다.
 */
export type ComplianceCategoryGroup =
  | "WEAR"
  | "KIDS"
  | "TOY"
  | "ELECTRONICS"
  | "COSMETIC"
  | "FOOD"
  | "HOUSEHOLD_CHEMICAL"
  | "GENERAL";

export interface ComplianceRule {
  categoryGroup: ComplianceCategoryGroup;
  /** "review"는 카테고리만으로는 KC 필요 여부를 확정할 수 없어(예: KIDS는
   * 세부 품목에 따라 갈린다) 판매자 확인이 항상 필요하다는 뜻 — boolean이
   * 아니다(N-3.52 핵심 원칙 유지). */
  kcRequired: boolean | "review";
  sellerConfirmationRequired: boolean;
  /** 판매자가 실제로 제시할 수 있는 근거 유형 — UI 문구용, TTAEJYO가
   * 이 중 하나를 자동으로 생성하지 않는다. */
  evidenceTypes: string[];
}

/** categoryRequiresChildCertification(Naver 카테고리 API의 실제 신호)이
 * 유일하게 확정적인 입력이라, KIDS/WEAR 두 그룹만 그 신호로 나뉜다 — 다른
 * 그룹은 아직 TTAEJYO에 판별 신호가 없어 전부 GENERAL로 수렴한다. */
export const COMPLIANCE_RULES: Record<ComplianceCategoryGroup, ComplianceRule> = {
  WEAR: {
    categoryGroup: "WEAR",
    kcRequired: false,
    sellerConfirmationRequired: false,
    evidenceTypes: [],
  },
  KIDS: {
    categoryGroup: "KIDS",
    kcRequired: "review",
    sellerConfirmationRequired: true,
    evidenceTypes: ["KC 인증번호", "인증기관/업체명", "인증일자"],
  },
  TOY: {
    categoryGroup: "TOY",
    kcRequired: "review",
    sellerConfirmationRequired: true,
    evidenceTypes: ["KC 인증번호", "인증기관/업체명", "인증일자"],
  },
  ELECTRONICS: {
    categoryGroup: "ELECTRONICS",
    kcRequired: "review",
    sellerConfirmationRequired: true,
    evidenceTypes: ["KC 인증번호(전기용품)"],
  },
  COSMETIC: {
    categoryGroup: "COSMETIC",
    kcRequired: "review",
    sellerConfirmationRequired: true,
    evidenceTypes: ["기능성화장품 심사/보고 자료"],
  },
  FOOD: {
    categoryGroup: "FOOD",
    kcRequired: "review",
    sellerConfirmationRequired: true,
    evidenceTypes: ["수입식품 신고 자료"],
  },
  HOUSEHOLD_CHEMICAL: {
    categoryGroup: "HOUSEHOLD_CHEMICAL",
    kcRequired: "review",
    sellerConfirmationRequired: true,
    evidenceTypes: ["안전확인대상생활화학제품 신고번호"],
  },
  GENERAL: {
    categoryGroup: "GENERAL",
    kcRequired: "review",
    sellerConfirmationRequired: false,
    evidenceTypes: [],
  },
};

/**
 * TTAEJYO가 실제로 구분할 수 있는 신호는 categoryRequiresChildCertification
 * (Naver 카테고리 API) 하나뿐이다 — true면 KIDS, false면 WEAR로 본다(이미
 * build-payload.ts가 같은 신호로 productInfoProvidedNoticeType을
 * WEAR/KIDS 중 하나로 결정한다 — 여기서 새 판단을 만들지 않고 그대로
 * 재사용한다). ELECTRONICS/COSMETIC/FOOD/HOUSEHOLD_CHEMICAL/TOY는 아직
 * 판별 신호가 없어 이 함수가 절대 그 값을 반환하지 않는다(지어내지 않음) —
 * 신호가 생기면 이 함수 하나만 확장하면 된다.
 */
export function resolveComplianceCategoryGroup(input: {
  categoryRequiresChildCertification: boolean;
}): ComplianceCategoryGroup {
  return input.categoryRequiresChildCertification ? "KIDS" : "WEAR";
}
