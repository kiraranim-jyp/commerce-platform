import type { CategorySelection } from "@commerce/category";
import type { ComplianceReport, NaverPayloadValidationResult } from "@commerce/listing";
import { isVerifiedCategorySelected, type ValidationResult } from "@commerce/marketplace";

/** Sprint A-6(개선4 — CPO 요구사항: "사용자는 왜 이것을 내가 입력해야 하지를
 * 바로 이해할 수 있어야 한다") — 남은 입력을 성격별로 나눈다. LEGAL(KC/인증
 * 등 법적 필수 — CartPilot이 절대 대신 채울 수 없음) / BUSINESS_SETTINGS(배송지/
 * 반품지/택배사 — Settings 페이지에서 한 번만 하면 됨) / PRODUCT_INFO(색상/
 * 소재/제조국 등 원문에서 못 찾은 상품 정보 — Resolver 개선 대상). */
export type ReadinessGroup = "LEGAL" | "BUSINESS_SETTINGS" | "PRODUCT_INFO";

export interface ReadinessItem {
  label: string;
  passed: boolean;
  required: boolean;
  /** Sprint A-3(Auto Scroll) — Sticky Summary에서 이 항목을 클릭하면 이동할
   * accordion 섹션 id. 없으면(예: settingsMissing 항목처럼 /settings로 가야 하는
   * 것) 클릭해도 스크롤하지 않는다. */
  sectionId?: string;
  /** Sprint A-3(작업7 — "무엇이 부족한지, 어떻게 채워지는지") — 통과 못 했을 때만
   * 의미 있는 설명. 통과한 항목은 굳이 채우지 않는다. */
  hint?: string;
  /** Sprint A-6(개선1) — CRITICAL이면 "자동입력 불가 · 법적 필수정보 ·
   * 사용자 확인 필요"를 문장이 아니라 구조화된 배지로 보여준다(추측 없음을
   * 명시적으로 드러내기 위함). */
  reasonCode?: "NO_VALUE" | "NO_RULE" | "ENUM_MISMATCH" | "CRITICAL";
  group?: ReadinessGroup;
  /** A-12.3(CPO 지시: "부족항목 오른쪽에 자동입력됨/기본설정 사용/직접입력 필요
   * 상태 표시") — 이 값이 어디서 채워지는지(또는 왜 안 채워졌는지) 사용자가 한
   * 눈에 알 수 있게 한다. 통과(passed=true)한 항목엔 표시하지 않는다. */
  /** A-12.3-P0-3(CPO 2차 지시) — DEFAULT_VALUE는 "CartPilot이 대신 관용적
   * 기본값을 채웠다"는 뜻으로, 실제 데이터를 확인한 AUTO나 Settings에서
   * 가져온 SETTINGS_DEFAULT와는 다른 신뢰 수준이라 별도 배지로 구분한다. */
  sourceStatus?: "AUTO" | "SETTINGS_DEFAULT" | "MANUAL_REQUIRED" | "DEFAULT_VALUE";
  /** A-12.3 — settingsRecommended/settingsMissing처럼 이 페이지 안이 아니라
   * /settings로 가야 채울 수 있는 항목의 이동 경로. sectionId와 배타적이다. */
  externalHref?: string;
}

export interface ReadinessSummary {
  items: ReadinessItem[];
  required: ReadinessItem[];
  recommended: ReadinessItem[];
  allRequiredPassed: boolean;
  /** 0~100. RegistrationReadinessCard(P0-UI Epic 2)와 PreflightChecklist가 항상
   * 같은 값을 봐야 한다 — 카드는 요약만, 체크리스트는 상세만 다르게 보여줄 뿐
   * "무엇이 통과했는지" 판정 자체는 이 한 곳에서만 계산한다. */
  percent: number;
}

function summarize(items: ReadinessItem[]): ReadinessSummary {
  const required = items.filter((i) => i.required);
  const recommended = items.filter((i) => !i.required);
  const allRequiredPassed = required.every((i) => i.passed);
  // Sprint A-10(작업9 — CEO 재확인: "100% → 카테고리 선택 → 80%로 떨어졌다,
  // 이 값 없이도 실제 쿠팡 등록은 됐던 것으로 기억한다") — A-9에서 등록 버튼
  // 게이트(allRequiredPassed)는 서버와 맞췄지만, 이 카드 제목 자체가 "등록
  // 가능성"인데 정작 퍼센트는 선택 입력(권장) 항목까지 분모에 섞어서 계산했다.
  // 그래서 필수 항목을 전부 통과해 버튼이 이미 눌리는 상태에서도 선택 항목이
  // 비어있으면 80%처럼 보여 "등록이 막혔다"는 오해를 줬다. "등록 가능성"이라는
  // 라벨대로 필수 항목 충족률만 반영하고, 선택 입력은 "남은 작업" 카운트에서만
  // 보여준다(recommended는 그대로 items에 남아 있어 화면 목록에는 계속 뜬다).
  const passedRequiredCount = required.filter((i) => i.passed).length;
  const percent = required.length > 0 ? Math.round((passedRequiredCount / required.length) * 100) : 100;
  return { items, required, recommended, allRequiredPassed, percent };
}

/** ValidationResult.label(쿠팡 어댑터 기준 "상품명"/"브랜드"/"대표이미지"/"판매가격"/
 * "옵션"/"배송정보"/"상세설명")을 Registration Editor의 accordion 섹션 id로
 * 매핑한다 — 라벨 문자열이 두 곳(marketplace 어댑터, 여기)에 있는 게 이상적이진
 * 않지만, 검증 규칙 자체를 옮기는 건 이번 스프린트 범위 밖이라 매핑 테이블로
 * 최소 침습적으로 연결한다. */
const LABEL_TO_SECTION: Record<string, string> = {
  카테고리: "section-category",
  상품명: "section-basic",
  브랜드: "section-basic",
  대표이미지: "section-images",
  판매가격: "section-price",
  옵션: "section-options",
  배송정보: "section-shipping",
  상세설명: "section-description",
};

/**
 * PreflightChecklist와 RegistrationReadinessCard가 반드시 같은 계산을 써야 한다 —
 * "같은 판정 조건을 두 곳에서 따로 구현"한 게 CP001 버그의 근본 원인이었다(실제
 * register API는 통과 못 시키는데 미리보기 UI는 100%로 보여준 사고). category 확정
 * 조건은 register API(resolveVerifiedCategoryCode)와 완전히 동일하게
 * isVerifiedPlatformCode까지 확인한다 — state만 보고 판단하지 않는다.
 *
 * Sprint A-3(CPO 요구사항: "Summary는 ✔ KC ✖ 인증번호까지 보여야 한다") — 지금까지는
 * 고시정보/KC가 아예 이 계산에 안 들어가서 100%로 보여도 실제로는 고시정보가
 * 비어있을 수 있었다. compliance(있으면)의 userInputNeeded를 필수 항목으로 섞어서
 * 카테고리 필수속성/고시정보/KC 미입력도 퍼센트에 반영한다.
 */
export function computeChecklistReadiness(
  validations: ValidationResult[],
  category: CategorySelection,
  settingsMissing?: string[],
  compliance?: ComplianceReport,
  // Sprint A-11(작업8) — 없어도 등록은 되지만 채워두면 좋은 판매자 설정
  // (배송비/반품배송비/교환배송비/제조자/품질보증/AS연락처). settingsMissing과
  // 달리 required:false로 넣어서 등록 버튼을 막지 않는다.
  settingsRecommended?: string[],
): ReadinessSummary {
  const categoryConfirmed = isVerifiedCategorySelected(category);

  const items: ReadinessItem[] = [
    { label: "카테고리", passed: categoryConfirmed, required: true, sectionId: "section-category", group: "PRODUCT_INFO" },
    ...validations
      .filter((v) => v.field !== "category" && v.field !== "shipping")
      .map((v) => ({
        label: v.label,
        passed: v.status === "PASS",
        required: v.status !== "WARNING",
        sectionId: LABEL_TO_SECTION[v.label],
        hint: v.status !== "PASS" ? v.message : undefined,
        group: "PRODUCT_INFO" as const,
      })),
    ...(compliance?.userInputNeeded ?? []).map((f) => ({
      label: f.fieldName,
      passed: false,
      // Sprint A-9(작업9 — CEO 실측 피드백: "이 값 없이도 실제 쿠팡 등록은
      // 됐던 것으로 기억합니다") — register/route.ts의 실제 서버 게이트
      // (compliance-report.ts: verdict FAIL은 criticalMissing일 때만)를
      // 그대로 확인해보니 정확히 그랬다: 서버는 KC/인증/수입자 등 CRITICAL
      // 필드가 없을 때만 제출을 막고, 색상/소재/제조자(비-KC) 같은 나머지는
      // WARNING으로 통과시킨다. 그런데 이 화면(client)은 지금까지 전부
      // required:true로 막고 있었다 — 서버는 등록해주는데 화면이 못 누르게
      // 막는 모순([[project_commerce_platform_readiness_gate]] 참고). 이제
      // "실제 등록을 막는 것(CRITICAL)"만 필수로 취급하고, 나머지는 권장으로
      // 내려서 두 게이트를 일치시킨다.
      required: f.reasonCode === "CRITICAL",
      sectionId: /인증|KC/i.test(f.fieldName) ? "section-kc" : "section-notice",
      hint: f.reason,
      reasonCode: f.reasonCode,
      // Sprint A-6(개선4) — CartPilot이 원본에서 절대 알 수 없는 KC/인증/수입자
      // 계열만 LEGAL로 분류한다. 나머지(색상/제조국 등 Resolver가 놓친 값)는
      // PRODUCT_INFO — "법적으로 막힌 것"과 "아직 Resolver가 못 찾은 것"은
      // 사용자 입장에서 완전히 다른 문제라 섞으면 안 된다.
      group: (f.reasonCode === "CRITICAL" ? "LEGAL" : "PRODUCT_INFO") as ReadinessGroup,
      // A-12.3 — Resolver가 상품 원문에서 못 찾았고 규칙도 없어서 CartPilot이
      // 대신 채울 수 없다는 뜻이니 전부 "직접입력 필요"다.
      sourceStatus: "MANUAL_REQUIRED" as const,
    })),
    // A-12.3-P0-3(CPO 2차 지시 — "준비도 카드에 자동 적용 상태 표시: ⚠ KC 인증
    // → 기본값 적용") — 이 필드들은 이제 PLACEHOLDER가 아니라서(userInputNeeded에
    // 안 잡힘) 등록을 막지 않지만, "CartPilot이 관용적 기본값을 대신 채워 넣었다"는
    // 사실 자체는 사용자가 알아야 한다 — 조용히 사라지면 KC 문구가 실제로 이
    // 상품에 맞는지 확인할 기회를 놓친다.
    ...(compliance?.defaultsApplied ?? []).map((f) => ({
      label: f.fieldName,
      passed: true,
      required: false,
      sectionId: /인증|KC/i.test(f.fieldName) ? "section-kc" : "section-notice",
      hint: `기본값 자동 적용: ${f.value}`,
      group: (/인증|KC/i.test(f.fieldName) ? "LEGAL" : "PRODUCT_INFO") as ReadinessGroup,
      sourceStatus: "DEFAULT_VALUE" as const,
    })),
    ...(settingsMissing ?? []).map((label) => ({
      label,
      passed: false,
      required: true,
      group: "BUSINESS_SETTINGS" as const,
      // A-12.3 — settingsMissing은 출고지/반품지처럼 애초에 Settings에서만
      // 만들 수 있는 값이라 이 페이지 안에서는 채울 방법이 없다 — /settings로
      // 보내는 것 자체가 "직접입력 필요"에 대한 해결책이다.
      sourceStatus: "MANUAL_REQUIRED" as const,
      externalHref: "/settings",
    })),
    // Sprint A-11(작업8) — 이미 채워져 있으면(즉, settingsRecommended에 없으면)
    // 여기서 굳이 항목을 만들지 않는다(통과한 걸 매번 뭉텅이로 보여줄 필요는
    // 없다는 기존 hint 원칙과 같다) — 비어있는 것만 △로 보여준다.
    ...(settingsRecommended ?? []).map((label) => ({
      label,
      passed: false,
      required: false,
      group: "BUSINESS_SETTINGS" as const,
      hint: "Settings에서 한 번 채워두면 이후 모든 상품에 자동 적용됩니다(없어도 등록은 됩니다)",
      // A-12.3(CPO 지시: "제조자/원산지는 Brand Profile, 품질보증/AS는
      // SellerProfile에서 가져온다") — 둘 다 "지금 당장 이 상품에 직접
      // 입력"이 아니라 "Settings에 기본값을 한 번 등록해두면 그걸 쓴다"는
      // 성격이 같아서 SETTINGS_DEFAULT로 통일한다. 값을 채우는 장소가
      // Settings라는 사실 자체가 핵심이지, Brand Profile인지 SellerProfile
      // 인지는 이 카드가 구분할 정보가 아니다(Settings 페이지 안에서 각
      // 필드가 어디 속하는지 이미 보여주고 있다).
      sourceStatus: "SETTINGS_DEFAULT" as const,
      externalHref: "/settings",
    })),
  ];

  return summarize(items);
}

/** N-3.27(CPO 지시: "Readiness ↔ 실제 Payload Validation 단일화") — register
 * route가 실제 POST 직전 최종 게이트로 쓰는 validateNaverPayload(를 그대로 재사용,
 * 여기서 새 규칙을 만들지 않는다)의 결과를 RegistrationReadinessCard가 이해하는
 * ReadinessItem[]로 옮겨 담기만 하는 얇은 adapter. READY가 아닌 필드는(MISSING이든
 * BLOCKED이든) 전부 required:true로 취급한다 — summarize()의 allRequiredPassed는
 * 그래서 자동으로 "missingCount===0 && blockedCount===0"(=validation.ok)과 정확히
 * 같은 뜻이 된다. BLOCKED만 별도로 reasonCode:"CRITICAL"/group:"LEGAL"을 붙여
 * "자동입력 불가 · 법적 필수정보" 배지(기존 UI 어휘, RegistrationReadinessCard.tsx
 * 참고)로 보이게 한다 — MISSING과 시각적으로 구분되지만 둘 다 등록을 막는다는
 * 점은 동일하다. */
export function computeNaverPayloadReadiness(validation: NaverPayloadValidationResult | null): ReadinessSummary {
  if (!validation) {
    // 조회 전(초기 로딩/카테고리 미확정) — "등록 가능"으로 낙관적으로 보이면
    // 안 되므로(안전 기본값), required 미통과 항목 하나로 percent를 0%에
    // 묶어둔다. 로딩이 끝나면 실제 validation 결과로 곧바로 대체된다.
    return summarize([
      {
        label: "Payload 검증 결과 확인 중",
        passed: false,
        required: true,
        group: "PRODUCT_INFO",
      },
    ]);
  }
  const items: ReadinessItem[] = validation.fields
    .filter((f) => !f.advisory)
    .map((f) => ({
      label: naverFieldLabel(f.field),
      passed: f.status === "READY",
      // Sprint P0(CPO 지시, 2026-08-19: "필수값과 선택값을 분리해야 합니다") —
      // 이전엔 advisory만 아니면 무조건 required:true였다(치수처럼 옵션이
      // 없으면 절대 채워질 수 없는 필드까지 등록을 영원히 막는 원인). 이제
      // validateNaverPayload가 표시한 f.optional을 그대로 따른다 —
      // validation.ok 계산(blockingMissingCount)과 반드시 같은 기준이어야
      // 화면 게이트와 서버 게이트가 일치한다(CP001 재발 방지).
      required: !f.optional,
      hint: f.status !== "READY" ? f.reason : undefined,
      reasonCode: f.status === "BLOCKED" ? ("CRITICAL" as const) : undefined,
      group: (f.status === "BLOCKED"
        ? "LEGAL"
        : NAVER_SETTINGS_FIELD_PREFIXES.some((p) => f.field.startsWith(p))
          ? "BUSINESS_SETTINGS"
          : "PRODUCT_INFO") as ReadinessGroup,
      sourceStatus: f.status === "READY" ? undefined : ("MANUAL_REQUIRED" as const),
      externalHref: naverFieldExternalHref(f.field),
      // N-3.29 — "다음 입력하기" 자동 스크롤(A-10.1-②)이 SmartStore에서도
      // 동작하도록 PlatformPreview accordion의 실제 DOM id로 보낸다.
      sectionId: naverFieldSectionId(f.field),
    }));
  return summarize(items);
}

/** claimDeliveryInfo/deliveryInfo로 시작하는 필드는 출고지/반품지/택배사/반품·교환배송비 —
 * 전부 Settings(SellerProfile/주소록)에서 한 번 채우면 되는 값이라 BUSINESS_SETTINGS로
 * 분류한다(validate-payload.ts의 필드 의미 그대로, 새 판정 기준이 아니다). */
const NAVER_SETTINGS_FIELD_PREFIXES = ["claimDeliveryInfo", "deliveryInfo"];

/** validateNaverPayload가 쓰는 field 문자열(예: "originProduct.salePrice")을
 * 사람이 읽는 라벨로만 바꾼다 — validate-payload.ts 각 필드의 reason 주석에 이미
 * 적힌 의미를 그대로 옮긴 것이라 새 판정 기준이 아니다. */
const NAVER_FIELD_LABEL: Record<string, string> = {
  "originProduct.leafCategoryId": "카테고리",
  "originProduct.name": "상품명",
  "originProduct.detailContent": "상세설명",
  "originProduct.images.representativeImage": "대표이미지",
  "originProduct.salePrice": "판매가",
  "originProduct.stockQuantity": "재고",
  "claimDeliveryInfo.shippingAddressId": "출고지 주소",
  "claimDeliveryInfo.returnAddressId": "반품지 주소",
  "deliveryInfo.deliveryCompany": "출고 택배사",
  "claimDeliveryInfo.returnDeliveryCompanyPriorityType": "반품 택배사",
  "claimDeliveryInfo.returnDeliveryFee": "반품 배송비",
  "claimDeliveryInfo.exchangeDeliveryFee": "교환 배송비",
  productCertificationInfos: "인증정보(KC)",
  "productCertificationInfos[].certificationNumber": "인증서 번호(KC)",
  "detailAttribute.optionInfo": "옵션 정보",
  "detailAttribute.optionInfo.optionCombinations[].optionName": "옵션 값",
  "detailAttribute.originAreaInfo.originAreaCode": "원산지",
  "detailAttribute.originAreaInfo.importer": "수입사명",
  "smartstoreChannelProduct.naverShoppingRegistration": "네이버쇼핑 연동",
};

const NAVER_NOTICE_FIELD_LABEL: Record<string, string> = {
  returnCostReason: "반품비용 부담 안내",
  noRefundReason: "환불 불가 사유",
  qualityAssuranceStandard: "품질보증기준(고시)",
  compensationProcedure: "피해보상 절차",
  troubleShootingContents: "분쟁해결 기준",
  material: "소재",
  color: "색상",
  manufacturer: "제조자",
  caution: "세탁방법 및 취급시 주의사항",
  warrantyPolicy: "품질보증기준",
  afterServiceDirector: "A/S 책임자 및 전화번호",
  size: "치수(사이즈)",
  recommendedAge: "사용연령",
  certificationType: "인증구분",
  itemName: "품명",
  modelName: "모델명",
  weight: "중량",
};

function naverFieldLabel(field: string): string {
  if (field.startsWith("productInfoProvidedNotice")) {
    const suffix = field.split(".").pop() ?? field;
    return NAVER_NOTICE_FIELD_LABEL[suffix] ?? suffix;
  }
  return NAVER_FIELD_LABEL[field] ?? field;
}

/** N-3.29 — "다음 입력하기"(A-10.1-②) 클릭 시 스크롤할 실제 DOM id. 이번
 * 스프린트에서 새로 만든 두 섹션(Importer는 "고시정보"=section-notice 안에,
 * KC 인증정보는 새 "section-kc")만 정확히 안다고 확신할 수 있어 그것만
 * 매핑한다 — 나머지 기존 필드는 실제 위치를 재검증하지 않은 채 추측으로
 * 연결하면 엉뚱한 곳으로 스크롤될 위험이 있어 그대로 undefined(클릭 불가)로
 * 둔다(기존에도 sectionId가 없었으므로 회귀가 아니다).
 *
 * N-3.38 — CPO 지시("우측 요약정보에서 대상 선택하면 해당 위치로 이동") 대응.
 * PlatformPreview.tsx를 실제로 다시 읽어 각 필드가 어느 CollapsibleSection
 * 안에 있는지 확인한 뒤에만 추가한다(추측 금지 원칙 유지) —
 * material/color/manufacturer는 "section-basic"(423-446줄), caution은
 * "section-notice"(641줄)에 실제로 있는 EditableText를 확인했다. */
const NAVER_NOTICE_FIELD_SECTION: Record<string, string> = {
  material: "section-basic",
  color: "section-basic",
  manufacturer: "section-basic",
  recommendedAge: "section-basic",
  caution: "section-notice",
  // Sprint P2(CEO 지시, 2026-08-19: "치수(사이즈) 눌러도 이동이 안됨") —
  // size는 PlatformPreview에 전용 입력 필드가 없다(resolveSizeFromOptions가
  // product.optionGroups의 SIZE 옵션값을 그대로 재사용할 뿐 별도 텍스트
  // 입력 UI를 만들지 않았다, N-3.13 R2 지시). 값을 채우려면 사용자가 실제로
  // 할 수 있는 유일한 일은 "옵션" 섹션에서 SIZE 옵션을 추가/수정하는
  // 것이므로 거기로 보낸다(실제로 PlatformPreview.tsx의 "section-options"
  // CollapsibleSection을 확인했다 — 추측이 아니다).
  size: "section-options",
};

function naverFieldSectionId(field: string): string | undefined {
  if (field === "detailAttribute.originAreaInfo.importer") return "section-notice";
  if (field.startsWith("productCertificationInfos")) return "section-kc";
  // N-3.55(CPO 지시: "먼저 해결할 항목 ① 가격 확인") — 판매가 필드는 지금까지
  // sectionId가 없어 "다음 입력하기"/가이드 모달에서 클릭해도 이동하지
  // 않았다. computeChecklistReadiness(coupang/11번가)가 이미 쓰는 것과 같은
  // DOM id("section-price", PlatformPreview.tsx에 실제로 존재 확인)로 통일한다.
  if (field === "originProduct.salePrice") return "section-price";
  if (field.startsWith("productInfoProvidedNotice")) {
    const suffix = field.split(".").pop() ?? field;
    return NAVER_NOTICE_FIELD_SECTION[suffix];
  }
  return undefined;
}

/** N-3.38 — warrantyPolicy/afterServiceDirector는 PlatformPreview 안에 입력
 * UI가 없다(SellerProfile.qualityGuarantee/asContactNumber를 Settings에서만
 * 입력받는다, N-3.13 Part E-12) — 실제로 PlatformPreview.tsx를 grep해서
 * 확인했다(0건). sectionId 대신 /settings로 보낸다(claimDeliveryInfo/
 * deliveryInfo와 같은 패턴, NAVER_SETTINGS_FIELD_PREFIXES 참고). */
const NAVER_NOTICE_FIELD_EXTERNAL_HREF: Record<string, string> = {
  warrantyPolicy: "/settings",
  afterServiceDirector: "/settings",
};

function naverFieldExternalHref(field: string): string | undefined {
  if (NAVER_SETTINGS_FIELD_PREFIXES.some((p) => field.startsWith(p))) return "/settings";
  if (field.startsWith("productInfoProvidedNotice")) {
    const suffix = field.split(".").pop() ?? field;
    return NAVER_NOTICE_FIELD_EXTERNAL_HREF[suffix];
  }
  return undefined;
}
