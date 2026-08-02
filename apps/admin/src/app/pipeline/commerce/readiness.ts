import type { CategorySelection } from "@commerce/category";
import type { ComplianceReport, ReadinessReport } from "@commerce/listing";
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
    })),
    ...(settingsMissing ?? []).map((label) => ({
      label,
      passed: false,
      required: true,
      group: "BUSINESS_SETTINGS" as const,
    })),
  ];

  return summarize(items);
}

/** SmartStore 전용 — validateSmartStoreListing이 이미 계산한 report.score를 그대로
 * 쓴다(그 함수 자체가 이미 필드별 가중치를 반영한 신뢰할 수 있는 계산이라 여기서
 * 다시 계산하지 않는다). 체크리스트 항목만 이 화면 형식에 맞게 변환한다. */
export function computeReadinessScoreSummary(report: ReadinessReport): ReadinessSummary {
  const items: ReadinessItem[] = report.fields.map((f) => ({
    label: f.label,
    passed: f.status === "VALID",
    required: f.status !== "WARNING",
    hint: f.status !== "VALID" ? (f.resolution ?? f.message) : undefined,
  }));
  return { ...summarize(items), percent: report.score };
}
