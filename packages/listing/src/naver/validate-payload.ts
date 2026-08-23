import type { CanonicalProduct } from "@commerce/shared";
import { hasRealProductOptions } from "./build-payload";
import type { NaverPayloadInput } from "./build-payload";
import type { NaverProductRegistrationPayload } from "./types";
import { isNoticeFieldSatisfied } from "../notice/reference-eligibility";
import {
  resolveKcStatus,
  isKcStatusRegistrable,
  COMPLIANCE_POLICY_VERSION,
  type KcStatus,
  type SellerComplianceConfirmationInput,
} from "./compliance";

/**
 * Sprint N-2.6 — 실제 POST 없이 payload가 등록 가능한 수준인지 검증한다.
 * "필드가 확인 안 됐다"와 "필드가 비어있다"를 구분한다 — 전자는 BLOCKED(임의
 * 값을 넣을 수 없어서 아예 진행 불가), 후자는 일반 필수값 누락으로 취급한다.
 *
 * Sprint N-3.5(Final Validator) — 이전까지는 "문제 있는 필드만" issues 배열에
 * 담고, Preview 쪽에서 countTotalCheckedFields()라는 별도 근사 함수로
 * READY 개수를 "전체 - 문제개수"로 역산했다(하드코딩된 BASE 상수 유지보수
 * 필요, 실제 검사 로직과 분리돼 있어 어긋날 위험). 이제 이 함수 자체가 검사한
 * "모든" 필드(문제없는 것 포함)를 fields 배열로 반환하고, READY/MISSING/
 * BLOCKED 개수도 함께 계산해서 돌려준다 — Preview는 이 값을 그대로 쓰고
 * 별도로 재계산하지 않는다(CPO 지시, "Preview에서 별도 판단 로직을 만들지
 * 않는다").
 */
/**
 * N-3.48(CPO 지시: "reason을 구조화한다") — 지금까지 issue/field의 유일한
 * 실패 정보는 사람이 읽는 한국어 reason 문자열뿐이었다. UI가 "이 필드가 왜
 * 막혔는지"에 따라 다른 동작(예: KC는 참조 버튼 자체를 안 보여주고 전용
 * 경고+입력 폼을 띄운다)을 해야 할 때 문자열을 파싱해서 판단하면 문구가
 *바뀔 때마다 UI가 깨진다. code는 그런 "필드가 왜 막혔는지"의 안정적인
 * 식별자다 — 아직은 KC 하나뿐이지만(다른 필드는 문자열 reason만으로 충분),
 * 필요해지면 여기에 값을 추가한다.
 */
export type NaverPayloadBlockCode = "KC_CERTIFICATION_REQUIRED" | "SELLER_SAFETY_CONFIRMATION_REQUIRED" | "PRICE_UNRESOLVED";

export interface NaverPayloadValidationIssue {
  field: string;
  reason: string;
  /** BLOCKED: 스키마가 확인 안 됐거나 CartPilot이 만들어낼 수 없는 값(실제 인증
   * 정보 등)이라 이 상태로는 등록 시도조차 하면 안 된다.
   * MISSING: 값을 확인/입력하면 채울 수 있는 일반 필수값 누락. */
  severity: "BLOCKED" | "MISSING";
  code?: NaverPayloadBlockCode;
}

export interface NaverPayloadFieldCheck {
  field: string;
  status: "READY" | "MISSING" | "BLOCKED";
  /** READY가 아닐 때만 채운다. */
  reason?: string;
  /** READY가 아닐 때만, code가 정의된 필드에만 채운다(위 NaverPayloadBlockCode 참고). */
  code?: NaverPayloadBlockCode;
  /** N-3.13 Part I(CPO 결정, 2026-08-12) — CartPilot이 절대 채울 수 없는(추측
   * 금지) 외부 상태값이라 등록 Gate 판단(ok/readyCount/missingCount/
   * blockedCount)에서 제외하고 참고 정보로만 보여준다. 지금은
   * naverShoppingRegistration(네이버쇼핑 광고주 전용 설정 — 광고주가
   * 아니면 무엇을 보내든 서버가 강제로 false 처리) 하나뿐이다. MISSING을
   * BLOCKED/READY로 바꿔치기하는 게 아니라 "이건 등록 가능 여부와 무관한
   * 별도 상태"라고 명시하는 것 — CPO 지시: "Gate에서 제외, 별도 표시로
   * 분리". */
  advisory?: boolean;
  /** Sprint P0(CPO 지시, 2026-08-19) → N-3.71(CPO 지시, 2026-08-21)로 범위가
   * 축소됐다. advisory와 다르다: advisory는 "등록 가능 여부와 아예 무관한
   * 계정 상태"라 화면 요약에서 완전히 빠지지만, optional은 "CartPilot이
   * 채울 방법이 있으면 좋은 값이지만 없다고 등록을 막을 이유는 없는" MISSING
   * 필드다. 등록 Gate(ok/register route 차단)와 readiness required 판정
   * 둘 다에서 반드시 같은 기준을 써야 한다(하나만 바꾸면 CP001과 같은
   * UI↔서버 불일치 재발).
   *
   * 2026-08-19 CEO 지시로 material/color/manufacturer/caution/
   * recommendedAge/itemName/modelName/weight/warrantyPolicy/
   * afterServiceDirector/afterServiceTelephoneNumber까지 전부 optional:true로
   * 확장했었지만, N-3.71(2026-08-21)에서 실제 프로덕션 등록 1건이 정확히
   * 이 필드들(치수 제외 9개) 때문에 Naver로부터 HTTP 400을 받으면서 그
   * 확장이 잘못됐다는 게 드러났다 — "상세페이지 참조 대체가 공식으로
   * 허용된다"는 전제는 맞지만, 그 대체는 셀러가 실제로 그 소스를
   * 선택했을 때만 적용되지 필드를 아예 안 건드린 기본 상태까지 자동으로
   * 통과시켜주지 않는다. N-3.71부터 optional:true는 다시 size(치수) 하나만
   * 쓴다 — 다만 size는 이제 build-payload.ts가 SIZE 옵션이 없을 때 항상
   * "상세페이지 참조"로 자동 대체하므로(위 size 필드 주석 참고) 실제로는
   * MISSING 상태 자체가 발생하지 않는다(optional:true를 쓸 일이 없다).
   * KC 관련 필드(productCertificationInfos/certificationType)는 처음부터
   * 지금까지 한 번도 이 목록에 포함된 적이 없다 — 상품명/가격/카테고리/
   * 재고/이미지/상세설명/배송정보/KC는 항상 required로 남는다. */
  optional?: boolean;
}

export interface NaverPayloadValidationResult {
  ok: boolean;
  readyCount: number;
  missingCount: number;
  blockedCount: number;
  /** 이 상품/카테고리에서 실제로 검사한 모든 필드(문제없는 것 포함) — 옵션/
   * 인증/수입사명처럼 상품마다 있고 없고가 달라지는 항목은 해당될 때만 담긴다.
   * advisory:true인 항목도 포함된다(섹션 요약에서는 보이되 Gate 판단에는
   * 반영되지 않는다). */
  fields: NaverPayloadFieldCheck[];
  /** fields 중 advisory가 아니면서 READY가 아닌 것만 골라 기존 UI(클릭 시
   * 섹션 이동 등)와 호환되는 모양으로 다시 담은 배열 — 하위호환을 위해
   * 유지한다. advisory 항목은 여기 안 들어간다(등록 차단 목록에 섞이면
   * "이거 때문에 등록이 막혔다"는 오해를 준다 — CPO 지시로 분리). */
  issues: NaverPayloadValidationIssue[];
  /** N-3.13 Part I — advisory:true인 항목만 모은 목록. Registration Gate와는
   * 무관하지만 판매자가 알아야 하는 참고 정보(예: 등록 후 Wing에서 네이버쇼핑
   * 광고주 여부 별도 확인)를 UI가 따로 보여줄 때 쓴다. */
  advisoryNotes: NaverPayloadFieldCheck[];
  /** N-3.52(CPO 지시: "API 등록 가능"과 "판매 가능"을 분리) — KC를
   * boolean으로 취급하지 않는다. 이 카테고리/상품 조합에서 KC 상태가
   * 무엇인지(compliance.ts 참고) — UI가 "판매 전 최종 확인" 화면에서
   * 별도로 보여줄 때 쓴다. ok 판정과는 이미 fields의 BLOCKED 여부로
   * 반영돼 있으므로 이 필드는 표시 전용이다. */
  kcStatus: KcStatus;
}

function check(
  fields: NaverPayloadFieldCheck[],
  field: string,
  ok: boolean,
  severity: "MISSING" | "BLOCKED",
  reason: string,
  code?: NaverPayloadBlockCode,
  optional?: boolean,
): void {
  fields.push(ok ? { field, status: "READY" } : { field, status: severity, reason, code, optional });
}

function blocked(fields: NaverPayloadFieldCheck[], field: string, reason: string, code?: NaverPayloadBlockCode): void {
  fields.push({ field, status: "BLOCKED", reason, code });
}

/**
 * categoryRequiresChildCertification — N-2.4에서 확인한 카테고리 detail의
 * exceptionalCategories에 CHILD_CERTIFICATION이 있는지(호출부가 판단해서 넘긴다,
 * 이 함수는 카테고리 API를 다시 호출하지 않는다).
 */
export function validateNaverPayload(
  payload: NaverProductRegistrationPayload,
  input: Pick<
    NaverPayloadInput,
    | "product"
    | "releaseAddressBookNo"
    | "refundAddressBookNo"
    | "primaryReturnDeliveryCompanyPriorityType"
    | "returnDeliveryFee"
    | "exchangeDeliveryFee"
    | "childCertificationInfoId"
    | "originAreaCode"
    | "deliveryCompany"
    | "warrantyPolicy"
    | "afterServiceDirector"
    | "afterServiceTelephoneNumber"
  > & {
    /** N-3.3 — 반품 택배사 목록 조회 자체가 실패했는지(계정/네트워크 문제 등).
     * 실패와 "택배사 미등록"은 서로 다른 사유라 구분한다. */
    returnCompaniesFetchFailed: boolean;
    /** N-3.4 — originAreaCode가 수입산(02) 계열로 매칭됐는지. true면
     * originAreaInfo.importer가 스펙상 필수인데 CartPilot에는 이 값의
     * 소스가 없어(제조사와 별개 개념) 항상 MISSING으로 표시한다. */
    originAreaRequiresImporter: boolean;
  },
  categoryRequiresChildCertification: boolean,
  /** N-3.52(CPO 지시) — "API 등록 가능"과 "판매 가능"을 분리한다. 옵션이라
   * 기존 호출부(테스트 등)는 그대로 동작한다(categoryVerified 기본값
   * true — 이미 카테고리가 확정된 상태를 가정하던 기존 동작과 동일). */
  complianceContext?: {
    /** false면 카테고리 분류 자체가 아직 불확실하다는 뜻 — kcStatus가
     * UNKNOWN이 된다(categoryRequiresChildCertification 값 자체를 신뢰할
     * 수 없으므로). */
    categoryVerified?: boolean;
    /** register route가 DB에서 조회해 넘겨주는, 이 상품/카테고리에 대해
     * 판매자가 실제로 남긴 최신 확인 기록. */
    sellerComplianceConfirmation?: SellerComplianceConfirmationInput | null;
  },
): NaverPayloadValidationResult {
  const fields: NaverPayloadFieldCheck[] = [];
  const { originProduct } = payload;
  const categoryVerified = complianceContext?.categoryVerified ?? true;
  const kcStatus = resolveKcStatus({
    categoryVerified,
    categoryRequiresChildCertification,
    childCertification: input.product.childCertification,
  });

  check(fields, "originProduct.leafCategoryId", Boolean(originProduct.leafCategoryId), "MISSING", "리프 카테고리 ID가 없습니다.");
  check(fields, "originProduct.name", Boolean(originProduct.name), "MISSING", "상품명이 없습니다.");
  check(
    fields,
    "originProduct.images.representativeImage",
    Boolean(originProduct.images.representativeImage.url),
    "MISSING",
    "대표 이미지가 없습니다.",
  );
  // N-3.5 — detailContent는 공식 OpenAPI에서 "상품 수정 시에만 생략 가능"이라고
  // 명시된 필수 필드(ExternalApiOriginProductVo.product required 목록)인데
  // 지금까지 이 파일에서 별도로 검사한 적이 없었다(재검증 중 발견).
  check(fields, "originProduct.detailContent", Boolean(originProduct.detailContent), "MISSING", "상품 상세 설명이 없습니다.");
  // N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고") — 기존
  // "salePrice > 0" 체크만으로는 원본 가격을 못 읽어(sourcePrice=0/null) 배송비
  // 등만으로 우연히 0보다 큰 salePrice가 계산된 경우를 잡지 못했다(Smallable
  // 실측: Source Data 가격=0.00인데 아래 가격 계산은 배송비만으로 ₩15,400을
  // 만들어낸 모순). product.priceValidity가 VALID가 아니면 salePrice가
  // 얼마든 상관없이 BLOCKED — 이 상품은 원본 가격 자체를 신뢰할 수 없다.
  if (input.product.priceValidity !== "VALID") {
    blocked(
      fields,
      "originProduct.salePrice",
      "원본 상품 가격을 확인할 수 없습니다 — 해외 사이트의 가격을 확인한 후 등록할 수 있습니다.",
      "PRICE_UNRESOLVED",
    );
  } else {
    check(
      fields,
      "originProduct.salePrice",
      Boolean(originProduct.salePrice) && originProduct.salePrice > 0,
      "MISSING",
      "판매가가 없거나 0 이하입니다.",
    );
  }
  check(
    fields,
    "originProduct.stockQuantity",
    Boolean(originProduct.stockQuantity) && originProduct.stockQuantity > 0,
    "MISSING",
    "재고 수량이 없거나 0 이하입니다.",
  );

  // N-3.3 — claimDeliveryInfo.shippingAddressId/returnAddressId가 addressBookNo를
  // 그대로 가리킨다는 게 공식 OpenAPI 스펙(제목 "출고지 주소록 번호"/"반품/교환지
  // 주소록 번호")으로 확인됐다 — N-2.6~N-3.2까지의 BLOCKED("매핑이 실제 등록으로
  // 검증되지 않음")는 더 이상 정확하지 않다. 이제는 값이 있으면 READY, 없으면
  // 일반 MISSING(판매자 주소록 등록 필요)으로만 취급한다.
  check(
    fields,
    "claimDeliveryInfo.shippingAddressId",
    input.releaseAddressBookNo !== null,
    "MISSING",
    "출고지 주소(addressType=RELEASE)를 찾지 못했습니다 — 판매자 주소록에 등록 필요.",
  );
  check(
    fields,
    "claimDeliveryInfo.returnAddressId",
    input.refundAddressBookNo !== null,
    "MISSING",
    "반품지 주소(addressType=REFUND_OR_EXCHANGE)를 찾지 못했습니다 — 판매자 주소록에 등록 필요.",
  );

  // N-3.6(개정 Part A) — 출고 택배사 조회 API는 여전히 없다(N-2.5/N-3.3/N-3.5/
  // N-3.6 재확인, 배송 관련 스키마 전수 확인 포함). 하지만 Coupang의
  // deliveryCompanyCode와 같은 패턴으로 판매자가 Settings에서 직접 입력할 수
  // 있게 됐으므로, "해결 불가"인 BLOCKED가 아니라 "입력하면 해결됨"인
  // MISSING이 정확하다 — 값이 있으면 READY.
  check(
    fields,
    "deliveryInfo.deliveryCompany",
    Boolean(input.deliveryCompany),
    "MISSING",
    "출고 택배사가 입력되어 있지 않습니다 — Settings의 배송 프로필에서 네이버 택배사를 입력하면 해결됩니다(공식 조회 API는 없어 직접 입력이 필요합니다).",
  );

  // N-3.3 — 반품 택배사는 실제 조회 API(GET /v2/product-delivery-info/
  // return-delivery-companies)가 확인됐다. 조회 자체가 실패하면 BLOCKED(계정/
  // 네트워크 문제로 확인 불가), 조회는 됐는데 판매자가 하나도 등록 안 했으면
  // MISSING(Wing에서 등록 필요), 있으면 READY(스펙상 미입력해도 PRIMARY가
  // 기본값이라 별도 이슈를 남기지 않는다).
  if (input.returnCompaniesFetchFailed) {
    blocked(fields, "claimDeliveryInfo.returnDeliveryCompanyPriorityType", "반품 택배사 목록 조회에 실패했습니다(네이버 API 오류).");
  } else {
    check(
      fields,
      "claimDeliveryInfo.returnDeliveryCompanyPriorityType",
      input.primaryReturnDeliveryCompanyPriorityType !== null,
      "MISSING",
      "판매자 계정에 등록된 반품 택배사가 없습니다 — Wing에서 반품 택배사 등록 필요.",
    );
  }

  check(
    fields,
    "claimDeliveryInfo.returnDeliveryFee",
    input.returnDeliveryFee !== null,
    "MISSING",
    "반품 배송비 정책이 설정되어 있지 않습니다 — Settings에서 판매자 배송 정책 입력 필요.",
  );
  check(
    fields,
    "claimDeliveryInfo.exchangeDeliveryFee",
    input.exchangeDeliveryFee !== null,
    "MISSING",
    "교환 배송비 정책이 설정되어 있지 않습니다 — Settings에서 판매자 배송 정책 입력 필요.",
  );

  if (categoryRequiresChildCertification) {
    if (input.childCertificationInfoId === null) {
      blocked(fields, "productCertificationInfos", "이 카테고리는 어린이제품 인증(CHILD_CERTIFICATION)이 필요하지만 카테고리 인증 유형 정보를 확인하지 못했습니다.");
    } else if (
      isKcStatusRegistrable(kcStatus, complianceContext?.sellerComplianceConfirmation ?? null, {
        policyVersion: COMPLIANCE_POLICY_VERSION,
        categoryCode: originProduct.leafCategoryId ?? "",
      })
    ) {
      // N-3.29(CPO 지시) — 이제 product.childCertification에 판매자가 직접
      // 입력할 수 있는 경로가 생겼다(Editor). 세 값(번호/업체명/취득일자)이
      // 전부 채워졌을 때만 READY — 하나라도 비어있으면 여전히 BLOCKED다(CPO
      // STEP7 지시: "인증정보 없음 → BLOCKED"). TTAEJYO가 값을 대신
      // 만들어내지는 않는다 — 사용자가 실제로 입력한 값만 통과시킨다.
      // N-3.53(CPO 지시) — kcStatus === "SELLER_REVIEW_REQUIRED"도 여기서
      // READY로 인정될 수 있다. 단 TTAEJYO가 그 판단을 자동으로 내리는 게
      // 아니다 — isKcStatusRegistrable은 register route가 넘겨준, 판매자가
      // 실제로 남긴 SellerComplianceConfirmation(현재 policyVersion 기준)이
      // 있을 때만 true를 돌려준다.
      fields.push({ field: "productCertificationInfos[].certificationNumber", status: "READY" });
      // N-3.71 STEP8(실제 프로덕션 등록 시도로 발견) — certificationNumber/
      // companyName/certificationDate 세 값만 채워졌어도 Naver가
      // "productCertificationInfos[0].name: 인증기관 항목을 입력해 주세요"로
      // 거부했다. product-types.ts N-3.67 주석에 이미 근거가 있었다 —
      // name(인증 기관명, companyName과는 다른 개념)은 어린이제품 인증
      // "공급자적합성"(certificationInfoId=1042)에서만 비필수 예외이고,
      // "안전확인/안전인증"(1041/1040, resolve-context.ts가 실제로 우선
      // 선택하는 값)에서는 필수다 — 이 사실이 build-payload.ts/types.ts에는
      // 반영돼 있었지만(name?: string 필드, N-3.67 회귀 테스트) 정작
      // validator가 한 번도 검사하지 않아서 "READY라고 나왔는데 실제
      // Naver는 거부"하는 이번 스프린트의 바로 그 문제 패턴이 KC 필드에도
      // 그대로 있었다.
      if (input.childCertificationInfoId !== 1042 && !input.product.childCertification.value?.name) {
        blocked(
          fields,
          "productCertificationInfos[].name",
          "인증 기관명(name)이 없습니다 — 실제 KC 인증서에 기재된 발급 기관명을 직접 입력해야 합니다(\"상세페이지 참조\"로 대체할 수 없습니다).",
          "KC_CERTIFICATION_REQUIRED",
        );
      }
    } else if (kcStatus === "BLOCKED") {
      blocked(
        fields,
        "productCertificationInfos[].certificationNumber",
        "카테고리가 아직 확정되지 않아 KC 대상 여부를 판단할 수 없습니다 — 카테고리를 먼저 확정해주세요.",
        "KC_CERTIFICATION_REQUIRED",
      );
    } else {
      // SELLER_REVIEW_REQUIRED, 아직 판매자 확인 기록이 없는 상태 —
      // TTAEJYO가 KC 필요 여부 자체를 확정할 수 없거나, 판매자가 아직 실제
      // 인증정보/판매 가능 여부를 확인하지 않은 상태다. N-3.45 STEP10과
      // 같은 이유로 여기서도 TTAEJYO가 임의로 판단해 통과시키지 않는다 —
      // "판매 전 최종 확인" 화면에서 판매자가 직접 확인해야 한다.
      blocked(
        fields,
        "productCertificationInfos[].certificationNumber",
        "이 상품의 KC 인증정보 또는 판매 가능 여부를 판매자가 먼저 확인해야 합니다 — '판매 전 최종 확인' 화면에서 확인할 수 있습니다.",
        "SELLER_SAFETY_CONFIRMATION_REQUIRED",
      );
    }
  }

  // N-3.13 Part E-12(CPO 지시: "고시정보를 절대 임의로 🟢 처리하지 않는다") —
  // build-payload.ts는 productInfoProvidedNotice(WEAR/KIDS)를 항상 만들지만,
  // 이 파일은 지금까지 그 안의 개별 필드가 실제로 채워졌는지 전혀 검사하지
  // 않았다(재검증 중 발견 — 항상 거짓 READY였던 gap). 공식 OpenAPI 스펙
  // (ExternalApiWearInfoProvidedNoticeVo.product / ExternalApiKidsInfoProvidedNoticeVo.product)
  // 의 required 배열을 직접 확인해 두 그룹으로 나눴다:
  //
  // 1) returnCostReason/noRefundReason/qualityAssuranceStandard/
  //    compensationProcedure/troubleShootingContents — 스펙 설명에 "미입력 시
  //    상품상세 참조로 입력됩니다"라고 명시돼 있다(Naver 서버가 값이 없으면
  //    자동으로 상품상세 참조 문구를 채운다). CartPilot이 이 값을 만들지
  //    않아도 등록이 막히지 않는다는 뜻이라 임의 판단이 아니라 스펙 근거로
  //    READY 처리한다.
  // 2) material/color/manufacturer/caution/size/warrantyPolicy/
  //    afterServiceDirector(+KIDS 전용 certificationType/itemName/modelName/
  //    recommendedAge/weight) — 이런 자동 기본값 설명이 없는 진짜 필수
  //    콘텐츠다. material/color/manufacturer/caution/recommendedAge는
  //    product 필드에서, warrantyPolicy/afterServiceDirector는
  //    SellerProfile.qualityGuarantee/asContactNumber에서 채워지면 READY —
  //    size는 N-3.13 R2(CPO 지시)부터 product.optionGroups의 실제 SIZE 옵션
  //    값을 재사용한다(resolveSizeFromOptions — 옵션이 없으면 그대로 MISSING,
  //    임의 값을 만들지 않는다). certificationType/itemName/modelName/weight는
  //    여전히 CartPilot에 입력 경로가 없어 항상 MISSING이다(향후 실제 입력
  //    필드가 생기면 그때 READY로 바뀐다).
  const notice = categoryRequiresChildCertification ? "kids" : "wear";
  const noticePrefix = notice === "kids" ? "productInfoProvidedNotice(KIDS)" : "productInfoProvidedNotice(WEAR)";
  for (const field of [
    "returnCostReason",
    "noRefundReason",
    "qualityAssuranceStandard",
    "compensationProcedure",
    "troubleShootingContents",
  ]) {
    fields.push({ field: `${noticePrefix}.${field}`, status: "READY" });
  }
  // N-3.71(CPO 지시, 2026-08-21: "등록 가능성 100%는 PASS가 아니다 — Naver가
  // 실제 originProductNo를 반환해야 PASS다") — 위 2026-08-19 CEO 지시로
  // optional:true를 붙였던 material/color/manufacturer/caution/
  // recommendedAge/itemName/modelName/weight/warrantyPolicy/
  // afterServiceDirector가, 실제 프로덕션 등록 1건에서 정확히 이 필드들
  // 때문에 Naver로부터 HTTP 400을 받았다(originProduct.detailAttribute.
  // productInfoProvidedNotice.kids.{...}: "데이터를 입력해 주세요.").
  // "상세페이지 참조 텍스트 대체가 공식으로 허용된다"는 전제 자체는 맞지만,
  // 그 대체는 셀러가 실제로 DETAIL_PAGE_REFERENCE를 선택했을 때만
  // 적용된다(isNoticeFieldSatisfied 참고) — 필드를 아예 건드리지 않은
  // 기본 상태(source: "REQUIRED")까지 "선택 입력이라 등록을 막지 않는다"로
  // 취급한 게 이 버그의 원인이었다. optional:true를 제거해 진짜 빈값(실제값도
  // 없고 상세페이지 참조도 선택 안 한 상태)은 다시 등록을 막고, 실제값이
  // 있거나 DETAIL_PAGE_REFERENCE를 선택한 경우는 isNoticeFieldSatisfied가
  // 이미 true를 반환하므로 READY로 그대로 통과한다(동작 변화 없음) — "UI가
  // 100%라고 보여준 상태와 실제 Naver 계약이 항상 같아야 한다"는 N-3.71
  // 원칙에 맞춘 것이다. KC 관련 필드(certificationType/
  // productCertificationInfos)는 원래도 이 목록에 없었다(N-3.45 STEP10
  // 가드, 계속 유지).
  check(
    fields,
    `${noticePrefix}.material`,
    isNoticeFieldSatisfied("material", input.product.material),
    "MISSING",
    "제품 소재가 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다. 상세페이지에 이미 나와 있으면 \"상세페이지 참조\"로 대체할 수 있습니다.",
  );
  check(
    fields,
    `${noticePrefix}.color`,
    isNoticeFieldSatisfied("color", input.product.color),
    "MISSING",
    "색상이 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다. 상세페이지에 이미 나와 있으면 \"상세페이지 참조\"로 대체할 수 있습니다.",
  );
  check(
    fields,
    `${noticePrefix}.manufacturer`,
    isNoticeFieldSatisfied("manufacturer", input.product.manufacturer),
    "MISSING",
    "제조자(사)가 없습니다 — 판매자 정보 기본값(Settings)에도 없습니다. 상세페이지에 이미 나와 있으면 \"상세페이지 참조\"로 대체할 수 있습니다.",
  );
  check(
    fields,
    `${noticePrefix}.caution`,
    isNoticeFieldSatisfied("careInstructions", input.product.careInstructions),
    "MISSING",
    "세탁 방법 및 취급 시 주의사항이 없습니다. 상세페이지에 이미 나와 있으면 \"상세페이지 참조\"로 대체할 수 있습니다.",
  );
  // 품질보증기준/AS 연락처는 Settings의 판매자 정보 탭에서 "한 번만" 채워두면
  // 이후 모든 상품에 자동 적용되는 값이다(Coupang 쪽 settingsRecommended와
  // 같은 성격 — A-11 작업8). Naver 실등록에서 이 두 값은 이미 정상 전송되고
  // 있었지만(실패 사유 9개에 포함되지 않았음), optional:true로 두면 셀러가
  // Settings를 아예 설정하지 않은 채로도 "등록 가능 100%"라고 잘못 표시될 수
  // 있어 다른 8개 필드와 동일하게 실제 필수로 되돌린다.
  check(
    fields,
    `${noticePrefix}.warrantyPolicy`,
    Boolean(input.warrantyPolicy),
    "MISSING",
    "품질 보증 기준이 없습니다 — Settings의 판매자 정보 탭에서 \"품질보증기준\"을 입력하면 해결됩니다.",
  );
  check(
    fields,
    `${noticePrefix}.afterServiceDirector`,
    Boolean(input.afterServiceDirector),
    "MISSING",
    "A/S 책임자와 전화번호가 없습니다 — Settings의 판매자 정보 탭에서 \"A/S 연락처\"를 입력하면 해결됩니다.",
  );
  // N-3.71 — build-payload.ts가 이제 SIZE 옵션이 없을 때도 "상세페이지
  // 참조" 문구로 자동 대체한다(위 size 필드 주석 참고) — payload는 항상
  // 값을 갖게 됐으므로 이 체크도 그에 맞춰 항상 READY다("실제 페이로드
  // 기준으로 판정한다"는 N-3.71 STEP4/5 원칙 — 여기서 optional:true로 남겨
  // 두면 payload는 값이 있는데 validator만 "선택 입력 비어있음"이라고
  // 잘못 보고하는 새 불일치가 생긴다).
  fields.push({ field: `${noticePrefix}.size`, status: "READY" });
  if (notice === "kids") {
    check(
      fields,
      "productInfoProvidedNotice(KIDS).recommendedAge",
      isNoticeFieldSatisfied("recommendedAge", input.product.recommendedAge),
      "MISSING",
      "사용연령이 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다. 상세페이지에 이미 나와 있으면 \"상세페이지 참조\"로 대체할 수 있습니다.",
    );
    // N-3.45 STEP10(CPO 지시, 영구 가드) — certificationType(KC 인증정보 대상
    // 여부/유형 설명 텍스트)은 reference-eligibility.ts 화이트리스트에 절대
    // 넣지 않는다 — "상세페이지 참조"로 대체하면 실제 인증 여부를 확인 안 한
    // 채 등록될 위험이 있어, 여기서도 항상 실제 값만 READY로 인정한다. CEO의
    // "필수 아닌 값은 전부 optional" 지시에도 KC는 명시적으로 예외다(CPO
    // 원본 분류표: KC=조건부 필수 🔴) — optional:true를 붙이지 않는다.
    check(
      fields,
      "productInfoProvidedNotice(KIDS).certificationType",
      Boolean(input.product.certificationType?.value),
      "MISSING",
      "KC 인증정보(대상 여부)가 없습니다 — 실제 값을 직접 입력해야 합니다(\"상세페이지 참조\"로 대체할 수 없습니다).",
      "KC_CERTIFICATION_REQUIRED",
    );
    // N-3.45(CPO 지시) — itemName/modelName은 실제 값이 없어도 "상세페이지
    // 참조"를 선택했으면 READY다.
    check(
      fields,
      "productInfoProvidedNotice(KIDS).itemName",
      isNoticeFieldSatisfied("itemName", input.product.itemName),
      "MISSING",
      "품명이 없습니다 — 상품 정보 편집 화면에서 직접 입력하거나 \"상세페이지 참조\"로 대체할 수 있습니다.",
    );
    check(
      fields,
      "productInfoProvidedNotice(KIDS).modelName",
      isNoticeFieldSatisfied("modelName", input.product.modelName),
      "MISSING",
      "모델명이 없습니다 — 상품 정보 편집 화면에서 직접 입력하거나 \"상세페이지 참조\"로 대체할 수 있습니다.",
    );
    // N-3.71 — 이전에는 size 옵션만 있어도(실제 weight 값도, DETAIL_PAGE_
    // REFERENCE 선택도 없이) weight를 READY로 표시했지만, build-payload.ts는
    // weight 필드에 size 값을 넣지 않는다(resolveNoticeFieldValue("weight", ...)
    // 만 사용) — validator는 READY라 말하는데 실제 payload엔 값이 비어 있는
    // UI/payload 불일치였다(정확히 이번 실패 9개 필드 중 하나). 다른 8개
    // 필드와 동일하게 isNoticeFieldSatisfied만으로 판정한다 — 실제값이
    // 없으면 DETAIL_PAGE_REFERENCE를 선택해야 READY가 되고, 그 값이 그대로
    // payload에 들어간다.
    check(
      fields,
      "productInfoProvidedNotice(KIDS).weight",
      isNoticeFieldSatisfied("weight", input.product.weight),
      "MISSING",
      "중량이 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다. 상세페이지에 이미 나와 있으면 \"상세페이지 참조\"로 대체할 수 있습니다.",
    );
    // N-3.71 STEP8(실제 프로덕션 등록 시도로 발견) — naverShoppingSearchInfo.
    // modelName은 productInfoProvidedNotice(KIDS).modelName과는 완전히 다른
    // 별도 필드다(N-3.65부터 build-payload.ts가 resolveModelNameFromDescription
    // 으로 상품 원문의 "Product code XXXX" 패턴만 채운다 — 패턴이 없으면
    // 필드 자체를 만들지 않는다, 임의 값 금지). 지금까지 이 필드를 검사하는
    // 로직이 한 번도 없어서, 원문에 그 패턴이 없는 상품은 validator가
    // READY라고 보고해도 Naver가 "어린이인증 대상 카테고리 상품은 카탈로그
    // 입력이 필수입니다"로 거부했다 — 정확히 이번 스프린트가 없애려는 바로
    // 그 UI/payload 불일치 패턴이다. 이 값은 "상세페이지 참조"로 대체할 수
    // 있다는 근거가 없어(다른 8개 고시필드와 다른 카탈로그 매칭용 필드라
    // 텍스트 대체가 통할지 불명확) 자동으로 채우지 않고 BLOCK한다 — 원문에
    // 실제 모델 코드가 없으면 사용자가 상품 정보 편집 화면에서 직접
    // 입력해야 한다.
    if (!originProduct.detailAttribute?.naverShoppingSearchInfo?.modelName) {
      blocked(
        fields,
        "naverShoppingSearchInfo.modelName",
        "네이버 쇼핑 카탈로그용 모델명이 없습니다 — 상품 원문에 'Product code' 표기가 없어 자동으로 추출하지 못했습니다. 상품 정보 편집 화면에서 모델명을 직접 입력해야 합니다.",
        "KC_CERTIFICATION_REQUIRED",
      );
    }
  }

  // N-3.50 STEP3(CPO 지시: "API가 요구함"과 "모든 상품에 의미 있는 값이
  // 존재함"을 분리) — N-3.49 실등록 3차 시도에서 처음 발견된 4개 필드를
  // validator에도 반영한다. deliveryType/deliveryAttributeType/
  // minorPurchasable은 build-payload.ts가 판매자/카테고리와 무관하게 항상
  // 같은 고정값(DELIVERY/NORMAL/true — 해외구매대행 사업모델 전체에 적용되는
  // 값이라 상품별 입력 항목이 아니다)을 채우므로 결정론적으로 READY다.
  check(
    fields,
    "deliveryInfo.deliveryType",
    Boolean(originProduct.deliveryInfo?.deliveryType),
    "MISSING",
    "배송 방법(deliveryType)이 없습니다.",
  );
  check(
    fields,
    "deliveryInfo.deliveryAttributeType",
    Boolean(originProduct.deliveryInfo?.deliveryAttributeType),
    "MISSING",
    "배송 속성(deliveryAttributeType)이 없습니다.",
  );
  // N-3.71 STEP8(실제 프로덕션 등록 시도로 발견) — deliveryFeeType이 PAID인데
  // deliveryFeePayType이 없으면 Naver가 거부한다(위 build-payload.ts 주석
  // 참고). FREE일 때는 Naver가 이 필드를 요구하지 않으므로 검사하지 않는다.
  if (originProduct.deliveryInfo?.deliveryFee?.deliveryFeeType === "PAID") {
    check(
      fields,
      "deliveryInfo.deliveryFee.deliveryFeePayType",
      Boolean(originProduct.deliveryInfo?.deliveryFee?.deliveryFeePayType),
      "MISSING",
      "배송비 결제방식(deliveryFeePayType)이 없습니다.",
    );
  }
  check(
    fields,
    "detailAttribute.minorPurchasable",
    originProduct.detailAttribute?.minorPurchasable !== undefined,
    "MISSING",
    "미성년자 구매 가능 여부(minorPurchasable)가 없습니다.",
  );
  // N-3.51 STEP6(7차 실등록 시도로 발견) — deliveryType/minorPurchasable과
  // 같은 사업모델 전체 고정값(항상 해외 출고지라 항상 필요, 항상 "INCLUDED").
  check(
    fields,
    "detailAttribute.customsTaxType",
    Boolean(originProduct.detailAttribute?.customsTaxType),
    "MISSING",
    "관부가세 부과 여부(customsTaxType)가 없습니다.",
  );
  // N-3.51 STEP2(CPO 지시) — afterServiceInfo.afterServiceTelephoneNumber는
  // afterServiceDirector(고시용 자유 텍스트)와 다른 실제 소스를 쓴다:
  // SellerProfile.companyContactNumber(Coupang 쪽에서 이미 실제 전화번호로
  // 채워져 있던 필드, 예: "+821046458306"). 값이 없으면 MISSING, 있는데
  // 형식이 안 맞으면(숫자/-/+ 외 문자 포함) BLOCKED — N-3.49 5차 실등록
  // 시도에서 실제 Naver가 "숫자, -, +만 입력 가능합니다"로 거부한 걸
  // 확인했다. 임의 전화번호로 바꿔치기하지 않는다(CPO 지시).
  const AFTER_SERVICE_PHONE_PATTERN = /^[0-9+-]+$/;
  if (!input.afterServiceTelephoneNumber) {
    // N-3.71 — warrantyPolicy/afterServiceDirector와 같은 이유로 optional:true를
    // 제거한다(위 두 필드 주석 참고) — Settings 미설정 상태를 "등록 가능
    // 100%"로 잘못 보여주지 않기 위해 다른 Settings 기반 필드와 동일하게
    // 다룬다. 값을 넣었는데 형식이 틀린 경우(아래 else if)는 별개다 —
    // "안 채웠다"가 아니라 "잘못 채웠다"라 여전히 BLOCKED로 남긴다.
    check(
      fields,
      "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber",
      false,
      "MISSING",
      "A/S 전화번호가 없습니다 — Settings의 판매자 정보 탭에서 실제 전화번호 형식(숫자, -, + 만 가능)으로 입력하면 해결됩니다.",
    );
  } else if (!AFTER_SERVICE_PHONE_PATTERN.test(input.afterServiceTelephoneNumber)) {
    blocked(
      fields,
      "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber",
      `Settings에 입력된 연락처("${input.afterServiceTelephoneNumber}")가 전화번호 형식이 아닙니다 — 네이버는 이 필드에 숫자, -, + 만 허용합니다(실제 등록 시도로 확인된 제약). 실제 전화번호로 수정해야 합니다.`,
    );
  } else {
    fields.push({ field: "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber", status: "READY" });
  }

  // N-2.8/N-3.4 — optionCombinations 필드명/각 필드 설명은 공식 OpenAPI로
  // 확인됐다(id는 "기존 옵션 수정용"이라 신규 등록엔 항상 비움, N-3.4에서
  // 수정된 실제 버그). N-3.47(CPO 지시) — price 필드의 의미(절대가 vs
  // salePrice 대비 추가금액)는 Naver 공식 계정 답변(GitHub Discussion #2312,
  // 2025-02-17, types.ts의 NaverOptionCombination 주석에 원문 인용)으로
  // 확정됐다 — "옵션가"는 추가금액(delta)이다. build-payload.ts의 계산은 이미
  // 이 의미와 일치하므로 더 이상 "확인 안 된 값이라 신뢰 못 함"으로 BLOCKED
  // 처리하지 않는다. 대신 Naver 자신이 명시한 실제 제약(옵션 선택 시 최종
  // 판매가가 0원 미만이 되면 안 됨)을 직접 계산해서 검사한다 — 이건 추측이
  // 아니라 공식 답변에 나온 검증 규칙 그대로다.
  const product = input.product as CanonicalProduct;
  // N-3.32(CPO 지시) — build-payload.ts와 동일한 hasRealProductOptions 기준을
  // 쓴다. Shopify의 단일 SKU placeholder({name:"Title",values:["Default
  // Title"]}, variants=[])는 이제 여기서도 "옵션 없음"으로 정확히 판정된다.
  const hasOptions = hasRealProductOptions(product);
  if (hasOptions) {
    const combos = originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    const negativeFinalPriceCombos = combos.filter((c) => originProduct.salePrice + c.price < 0);
    if (negativeFinalPriceCombos.length > 0) {
      blocked(
        fields,
        "detailAttribute.optionInfo.optionCombinations[].price",
        `옵션 선택 시 최종 판매가가 0원 미만이 되는 옵션 조합이 ${negativeFinalPriceCombos.length}개 있습니다 — 옵션가(추가금액)를 다시 확인해야 합니다(Naver 공식 정책상 등록 자체가 거부됩니다).`,
      );
    } else {
      fields.push({ field: "detailAttribute.optionInfo", status: "READY" });
    }
    // N-3.4 — 옵션명은 있는데 특정 조합의 옵션값이 비어 있으면(원본 페이지
    // 파싱이 일부만 성공한 경우) price 의미와 무관하게 별도로 알려준다.
    const groupNames = product.optionGroups.map((g) => g.name);
    const hasIncompleteVariant = product.variants.some((v) => groupNames.some((name) => !v.optionValues[name]));
    check(
      fields,
      "detailAttribute.optionInfo.optionCombinations[].optionName",
      !hasIncompleteVariant,
      "MISSING",
      "일부 옵션 조합에 값이 비어 있는 옵션 그룹이 있습니다 — 원본 상품의 옵션 값을 확인해야 합니다.",
    );
  }

  // N-3.4 — originAreaCode는 GET /v1/product-origin-areas(535개 실제 코드)로
  // 확인됐다(더 이상 BLOCKED 아님). 원산지 텍스트 자체가 없으면 MISSING,
  // 수입산(02) 계열로 매칭됐으면 importer(수입사명)가 스펙상 필수다.
  check(
    fields,
    "detailAttribute.originAreaInfo.originAreaCode",
    input.originAreaCode !== null,
    "MISSING",
    "원산지 텍스트를 확인하지 못했습니다 — 상품 원본/브랜드 설정/판매자 기본값 중 어느 것도 없습니다.",
  );
  // N-3.29(CPO 지시) — product.importer에 사용자가 Editor에서 직접 입력한
  // 값이 있으면 READY. 다른 필드(manufacturer/브랜드/원산지)에서 자동 추론하지
  // 않는다(임의 필드 재활용 금지).
  if (input.originAreaCode !== null && input.originAreaRequiresImporter) {
    // N-3.45 STEP8(CPO 지시) — "구매대행이라고 해서 판매자가 법적으로 수입자인
    // 것은 아니다"(CPO가 이전 오판을 직접 정정). 판매자의 수입자 지위가 실제로
    // 확인되지 않았으면 CartPilot이 자동으로 추정하지 않고, 사용자가 직접 입력
    // 하거나 "상세페이지 참조"를 선택했을 때만 READY로 인정한다.
    check(
      fields,
      "detailAttribute.originAreaInfo.importer",
      isNoticeFieldSatisfied("importer", input.product.importer),
      "MISSING",
      "원산지가 수입산으로 확인되어 수입사명이 필수입니다 — 등록 화면에서 직접 입력하거나 \"상세페이지 참조\"로 대체할 수 있습니다.",
    );
  }

  // N-3.5 — smartstoreChannelProduct.naverShoppingRegistration은 공식
  // OpenAPI 스펙(ExternalApiSmartstoreChannelProductVo.product)의 required
  // 목록에 있는 필수 필드인데, 지금까지 이 파일도 build-payload.ts도 이
  // 필드를 다루지 않고 있었다(N-3.5 재검증 중 새로 발견). "네이버 쇼핑
  // 광고주 여부"에 따라 서버가 강제로 false 처리하는 경우도 있다고 스펙에
  // 적혀 있어(광고주가 아니면 무엇을 보내든 false로 저장됨) CartPilot이
  // 임의로 true/false를 정할 근거가 없다 — 항상 MISSING으로 표시한다.
  // N-3.13 Part I(CPO 결정, 2026-08-12) — 이 필드는 등록 자체를 막는 조건이
  // 아니라 "네이버쇼핑 광고주인지" 라는 CartPilot 밖의 계정 상태다(광고주가
  // 아니면 서버가 무조건 false로 저장한다고 스펙에 명시돼 있다). 그래서
  // Gate 판단(readyCount/missingCount/blockedCount/ok)에서 제외하고
  // advisory로만 남긴다 — READY로 바꿔치기하는 게 아니라 "판단 대상에서
  // 뺀다"는 뜻이다.
  // N-3.25(STEP 2) — build-payload.ts가 이제 false를 명시 전송한다(광고주가
  // 아니면 서버가 어차피 강제로 false 처리, 광고주라도 자동 등록 흐름에서는
  // 미연동이 안전한 기본값). 값은 채워졌지만 "네이버쇼핑 광고주 여부"라는
  // CartPilot 밖의 계정 상태와 여전히 무관하므로 advisory는 유지하되
  // status를 READY로, 문구를 실제 동작에 맞게 갱신한다.
  fields.push({
    field: "smartstoreChannelProduct.naverShoppingRegistration",
    status: "READY",
    reason: "true로 명시 전송됩니다 — 네이버쇼핑 광고주가 아니면 서버가 어차피 false로 강제 저장하고, 광고주라면 등록 즉시 노출 신청이 반영됩니다.",
    advisory: true,
  });

  // N-3.13 Part I — advisory 필드는 Gate 판단(카운트/issues/ok)에서 전부
  // 제외한다. fields 배열 자체에는 그대로 남아있어 섹션 요약에서는 보인다.
  const gateFields = fields.filter((f) => !f.advisory);

  const issues: NaverPayloadValidationIssue[] = gateFields
    .filter((f): f is NaverPayloadFieldCheck & { status: "MISSING" | "BLOCKED"; reason: string } => f.status !== "READY")
    .map((f) => ({ field: f.field, reason: f.reason, severity: f.status, code: f.code }));

  const advisoryNotes = fields.filter((f) => f.advisory);

  const readyCount = gateFields.filter((f) => f.status === "READY").length;
  const missingCount = gateFields.filter((f) => f.status === "MISSING").length;
  const blockedCount = gateFields.filter((f) => f.status === "BLOCKED").length;
  // Sprint P0(CPO 지시, 2026-08-19) — missingCount는 기존 그대로 "MISSING
  // 상태인 필드 전체 개수"를 뜻한다(UI 배지/진단 스크립트가 이미 이 의미로
  // 쓰고 있어 바꾸지 않는다). optional:true인 MISSING(지금은 치수뿐)은
  // "채우면 좋지만 없어도 등록을 막을 이유가 없는" 필드라 ok 판정에서만
  // 별도로 뺀다 — register route(apps/admin/.../smartstore/register/route.ts)
  // 의 `if (!validation.ok)` 차단과 readiness.ts의 required 판정이 반드시
  // 같은 기준을 써야 한다(안 그러면 화면은 등록 가능하다고 보여주는데 실제
  // POST는 막히는 CP001류 불일치가 재발한다).
  const blockingMissingCount = gateFields.filter((f) => f.status === "MISSING" && !f.optional).length;

  return {
    ok: blockedCount === 0 && blockingMissingCount === 0,
    readyCount,
    missingCount,
    blockedCount,
    fields,
    issues,
    advisoryNotes,
    kcStatus,
  };
}
