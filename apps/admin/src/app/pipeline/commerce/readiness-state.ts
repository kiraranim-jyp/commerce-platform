import type { KcStatus } from "@commerce/listing";
import type { ReadinessItem, ReadinessSummary } from "./readiness";

/**
 * N-3.56(버그 수정) — RegistrationStatusBanner.tsx는 최상단에 "use client"가
 * 있어서, 그 파일에서 export한 순수 함수(resolveRegistrationReadinessState/
 * buildPriorityItems)를 대시보드 서버 라우트(/api/dashboard/readiness)에서
 * import하면 Next.js가 "client 함수를 서버에서 호출할 수 없다"는 런타임
 * 에러를 던진다(실제 프로덕션 배포로 확인) — 컴포넌트가 아닌 순수 로직이라도
 * "use client" 파일 전체가 클라이언트 전용으로 취급된다. 판정 로직 자체를
 * 이 파일(지시어 없음)로 옮기고, RegistrationStatusBanner.tsx는 여기서
 * re-export만 해서 기존 import 경로(PlatformPreview.tsx 등)를 그대로
 * 유지한다 — 판정 로직이 두 곳에 생기지 않는다.
 */
export type RegistrationReadinessState = "BLOCKED" | "SELLER_REVIEW" | "NEEDS_REVIEW" | "READY";

/** N-4.08 STEP6-2(CPO 지시: "내부 검증 정밀도는 유지하고 UI는 단순화") — 탭
 * 배지처럼 한눈에 보여줄 자리에는 4단계가 아니라 3단계(🟢🟡🔴)만 필요하다.
 * 새 판정을 만들지 않는다 — RegistrationReadinessState(이미 실제 화면에서
 * 쓰는 유일한 4-state) 하나만 입력으로 받아 이름만 다시 붙인다.
 *
 * SELLER_REVIEW를 YELLOW로 묶는 이유: 이 상태의 실제 의미는 "TTAEJYO가
 * 임의로 판단하지 않고 판매자의 확인을 기다리는 중"이다(validate-payload.ts
 * SELLER_SAFETY_CONFIRMATION_REQUIRED 참고) — 데이터가 없어서 막힌 BLOCKED와
 * 성격이 다르다. 탭 배지는 "어디를 봐야 하는지"를 알려주는 내비게이션
 * 신호일 뿐이고, 실제 등록 가능 여부의 정확한 이유(판매자 확인 필요 vs
 * 데이터 누락)는 탭 안의 RegistrationStatusBanner(4-state 그대로 유지)가
 * 계속 보여준다 — 이 매핑이 register API 게이트를 대신하지 않는다. */
export type ReadinessLevel = "GREEN" | "YELLOW" | "RED";

export function readinessStateToLevel(state: RegistrationReadinessState): ReadinessLevel {
  if (state === "READY") return "GREEN";
  if (state === "BLOCKED") return "RED";
  return "YELLOW"; // NEEDS_REVIEW | SELLER_REVIEW
}

export function resolveRegistrationReadinessState(
  summary: ReadinessSummary,
  priceValid: boolean,
  kcStatus?: KcStatus,
): RegistrationReadinessState {
  if (!priceValid) return "BLOCKED";
  if (kcStatus === "BLOCKED") return "BLOCKED";
  if (kcStatus === "SELLER_REVIEW_REQUIRED") return "SELLER_REVIEW";
  if (!summary.allRequiredPassed) return "NEEDS_REVIEW";
  return "READY";
}

export interface PriorityItem {
  key: string;
  label: string;
  detail?: string;
  sectionId?: string;
  externalHref?: string;
  sourceItems: ReadinessItem[];
}

export function buildPriorityItems(
  summary: ReadinessSummary,
  priceValid: boolean,
  priceSectionId: string | undefined,
): PriorityItem[] {
  const items: PriorityItem[] = [];
  if (!priceValid) {
    items.push({
      key: "price",
      label: "가격 확인",
      detail: "원본 상품 가격을 확인할 수 없습니다 — 해외 사이트의 가격을 확인한 후 등록할 수 있습니다.",
      sectionId: priceSectionId,
      sourceItems: [],
    });
  }
  const unresolvedRequired = summary.required.filter((i) => !i.passed);
  const categoryItem = unresolvedRequired.find((i) => i.label === "카테고리");
  if (categoryItem) {
    items.push({
      key: "category",
      label: "카테고리 확인",
      sectionId: categoryItem.sectionId,
      externalHref: categoryItem.externalHref,
      sourceItems: [categoryItem],
    });
  }
  const legalItems = unresolvedRequired.filter((i) => i.group === "LEGAL" && i.label !== "카테고리");
  if (legalItems.length > 0) {
    const [first] = legalItems;
    items.push({
      key: "legal",
      label: legalItems.length === 1 ? first.label : "KC/판매 가능 여부 확인",
      detail: first.hint,
      sectionId: first.sectionId,
      externalHref: first.externalHref,
      sourceItems: legalItems,
    });
  }
  const restItems = unresolvedRequired.filter((i) => i.label !== "카테고리" && i.group !== "LEGAL");
  if (restItems.length > 0) {
    items.push({
      key: "product-info",
      label: `필수 상품정보 ${restItems.length}개 입력`,
      sectionId: restItems[0].sectionId,
      externalHref: restItems[0].externalHref,
      sourceItems: restItems,
    });
  }
  return items;
}
