import type { CanonicalProduct, ProvenanceField } from "@commerce/shared";

/**
 * N-3.45(CPO 지시: "상품정보제공고시 공통 관리") — 이전까지는 Naver 고시정보의
 * 개별 필드(품명/모델명/중량/세탁방법 등)가 "실제 값이 있으면 READY, 없으면
 * 무조건 MISSING"이라는 이분법이었다. 이게 N-3.43~44에서 반복적으로 "쿠팡은
 * 되는데 네이버는 필수값 부족"으로 등록이 막히는 원인이었다 — 상품 상세페이지에
 * 이미 나와 있는 정보(예: 세탁방법)까지 CartPilot이 별도 구조화 값을 요구했기
 * 때문이다.
 *
 * 이 파일은 "사용자가 상세페이지 참조로 대체해도 되는 필드가 어느 것인지"를
 * 한 곳에서 관리한다 — Coupang/Naver 등 여러 어댑터가 각자 다른 기준을 만들면
 * 다시 플랫폼별로 판단이 갈라지는 문제가 재발한다.
 *
 * KC 인증정보(childCertification/certificationType)는 절대 이 목록에 넣지
 * 않는다(CPO 지시, N-3.45 STEP10) — 실제 인증 취득 여부를 CartPilot이 알 수
 * 없어서 "상세페이지 참조"로 얼버무리면 규제 위반 위험이 있다. 이 두 필드는
 * 항상 실제 구조화된 값만 READY로 인정한다.
 */
export const NOTICE_REFERENCE_ELIGIBLE_FIELDS = [
  "itemName",
  "modelName",
  "weight",
  "material",
  "color",
  "manufacturer",
  "careInstructions",
  "recommendedAge",
  "importer",
] as const;

export type NoticeReferenceEligibleField = (typeof NOTICE_REFERENCE_ELIGIBLE_FIELDS)[number];

export function isNoticeReferenceEligible(field: string): field is NoticeReferenceEligibleField {
  return (NOTICE_REFERENCE_ELIGIBLE_FIELDS as readonly string[]).includes(field);
}

/** Naver 서버가 5개 고시 필드(returnCostReason 등)를 비워두면 자동으로 채우는
 * 공식 문구(validate-payload.ts 기존 주석 근거)와 같은 표현을 쓴다 — CartPilot이
 * 새 문구를 지어내지 않고 이미 Naver 스펙이 쓰는 관용구를 그대로 따른다. */
export const DETAIL_PAGE_REFERENCE_TEXT = "상품 상세페이지 참조";

/**
 * field.value가 있으면 그대로, 없고 "상세페이지 참조"를 선택한 상태(source가
 * DETAIL_PAGE_REFERENCE)면서 이 필드가 화이트리스트에 있으면 참조 문구로,
 * 그 외엔 undefined를 돌려준다 — build-payload.ts가 undefined를 받으면 지금까지처럼
 * 그 필드를 아예 채우지 않는다(임의 값 생성 없음 원칙 유지).
 */
export function resolveNoticeFieldValue(
  fieldKey: NoticeReferenceEligibleField,
  field: ProvenanceField<string> | undefined,
): string | undefined {
  if (field?.value) return field.value;
  if (field?.source === "DETAIL_PAGE_REFERENCE" && isNoticeReferenceEligible(fieldKey)) {
    return DETAIL_PAGE_REFERENCE_TEXT;
  }
  return undefined;
}

/**
 * validate-payload.ts용 — 이 필드가 READY로 판정돼야 하는지(실제 값이 있거나,
 * 참조 처리가 허용된 필드에서 사용자가 참조를 선택했을 때).
 */
export function isNoticeFieldSatisfied(
  fieldKey: NoticeReferenceEligibleField,
  field: ProvenanceField<string> | undefined,
): boolean {
  return Boolean(resolveNoticeFieldValue(fieldKey, field));
}

/** 참조 처리 중인지(값은 없고 source만 DETAIL_PAGE_REFERENCE) — UI가 "상세페이지
 * 참조로 등록됩니다" 배지를 보여줄 때 쓴다. */
export function isFieldDetailPageReferenced(field: ProvenanceField<string> | undefined): boolean {
  return field?.source === "DETAIL_PAGE_REFERENCE";
}

/** N-3.45 STEP10 — 실수로라도 KC 필드에 화이트리스트를 적용하지 않는다는 걸
 * 코드로 고정해두는 가드. childCertification은 문자열 필드가 아니라 여기
 * 화이트리스트 타입에 애초에 들어올 수 없지만, certificationType은 문자열이라
 * 실수로 추가될 위험이 있어 명시적으로 테스트에서 검증한다(reference-eligibility.test.ts).
 */
export const NOTICE_KC_FIELDS_NEVER_REFERENCE_ELIGIBLE = ["certificationType", "childCertification"] as const;

export type NoticeReferenceEligibleProduct = Pick<CanonicalProduct, NoticeReferenceEligibleField>;
