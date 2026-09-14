import type { KcStatus } from "@commerce/listing";
import type { ReadinessGroup, ReadinessItem, ReadinessSummary } from "./readiness";

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
  /** N-4.12 STEP1/STEP9(대표님 지시: "데이터 오류와 API 오류를 절대 같은
   * 방식으로 보여주지 않는다") — true면 사용자가 고쳐야 할 데이터 문제가
   * 아니라 일시적 조회 실패(타임아웃/네트워크)다. 기본값은 false(데이터
   * 문제) — 명시적으로 표시하는 곳만 true를 넘긴다. */
  retryable?: boolean;
}

/** N-4.12 STEP2(대표님 지시: "무엇을 고쳐야 하는지 구체적으로 보여준다" —
 * 예시: "스마트스토어 3개 항목 확인 필요: •원산지 •KC인증정보 •모델명") —
 * "N개 입력"처럼 개수만 보여주면 사용자가 아코디언을 다 열어봐야 한다.
 * 새 라벨 체계를 만들지 않는다 — ReadinessItem.label(이미 사람이 읽는
 * 한국어, readiness.ts NAVER_FIELD_LABEL 등)을 그대로 나열만 한다. */
function summarizeItemLabels(items: ReadinessItem[], maxShown = 3): string {
  const labels = items.map((i) => i.label);
  const shown = labels.slice(0, maxShown);
  const rest = labels.length - shown.length;
  const suffix = rest > 0 ? ` 외 ${rest}개` : "";
  return `${shown.join(" · ")}${suffix}`;
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
      label: legalItems.length === 1 ? first.label : `법적 필수정보 ${legalItems.length}개 확인: ${summarizeItemLabels(legalItems)}`,
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
      label:
        restItems.length === 1
          ? `${restItems[0].label} 확인`
          : `필수 상품정보 ${restItems.length}개 확인: ${summarizeItemLabels(restItems)}`,
      sectionId: restItems[0].sectionId,
      externalHref: restItems[0].externalHref,
      sourceItems: restItems,
    });
  }
  return items;
}

/* ── REWORK-4 §2 — "무엇이 · 왜 · 어디서 · [바로 이동]" ────────────────────── */

/**
 * REWORK-4 §2(CEO 지시, 2026-09-14) — **추상 버튼을 없애고 그 자리를 채운다.**
 *
 * 지금까지 이 판정 아래에 서 있던 것은 「부족한 정보 한 번에 해결하기」 버튼
 * 하나였다. 무엇을·어디를 고치는 것인지 문장에 없었고, 눌러도 해결되지 않았다
 * (모달이 같은 목록을 한 번 더 읽어줄 뿐이었다). 대신 지금 당장 해야 하는 **한
 * 개**를 네 가지가 다 붙은 채로 보여준다:
 *
 *   무엇이 부족한가 → 왜 필요한가 → 어디서 입력하는가 → [바로 이동]
 *
 * 🔴 새 판정을 만들지 않는다. 네 문장 전부 이미 계산된 값에서만 나온다 —
 * buildPriorityItems가 고른 순서, ReadinessItem.label / hint / group,
 * 그리고 이미 있던 이동 장치(sectionId · externalHref) 그대로다.
 *
 * 🔴 **이동 경로가 없는 안내를 만들지 않는다.** action이 null이면 버튼을 그리지
 * 않는다 — 아래 REGISTRATION_SECTION_LABEL에 없는 sectionId는 화면에 그 앵커가
 * 실제로 없다는 뜻이라(예: readiness.ts가 대표이미지에 매핑해 둔 "section-images"
 * 는 PlatformPreview에 존재하지 않는다) 눌러도 아무 데도 가지 않는다. 그런
 * 버튼은 「부족한 정보 한 번에 해결하기」와 같은 종류의 거짓말이다.
 */
export const REGISTRATION_SECTION_LABEL: Record<string, string> = {
  // PlatformPreview.tsx의 CollapsibleSection 제목 그대로다 — 안내가 부르는
  // 이름과 셀러가 화면에서 읽는 제목이 달라지면 "거기가 어딘데"가 다시 생긴다.
  "section-category": "카테고리",
  "section-basic": "기본정보",
  "section-options": "옵션",
  "section-price": "가격",
  "section-shipping": "배송",
  "section-notice": "고시정보",
  "section-kc": "KC (어린이제품 등 인증정보)",
  "section-description": "상세설명",
};

export type PriorityAction =
  /** 이 화면 안의 섹션으로 스크롤한다(기존 goToSection 그대로). */
  | { kind: "SECTION"; sectionId: string; label: string }
  /** 이 화면 밖(설정·판매자센터)으로 보낸다(기존 externalHref 그대로). */
  | { kind: "EXTERNAL"; href: string; label: string };

export interface PriorityGuidance {
  /** 무엇이 부족한가 — 실제로 비어 있는 항목 이름들. */
  what: string;
  /** 왜 필요한가 / 왜 자동으로 채우지 못했는가. */
  why: string;
  /** 어디서 입력하는가. 버튼이 없어도 이 문장은 항상 있다. */
  where: string;
  /** 바로 이동. 갈 곳이 확실할 때만 만든다. */
  action: PriorityAction | null;
}

/** 서버가 사유를 주지 않았을 때 쓰는 문장. 성격(group)마다 이유가 다르다. */
const WHY_BY_GROUP: Record<ReadinessGroup, string> = {
  LEGAL: "법적 필수 정보라 TTAEJYO가 대신 만들어낼 수 없습니다 — 실제 값을 확인해 입력해야 합니다.",
  BUSINESS_SETTINGS: "판매자 설정에서 한 번 채우면 이후 모든 상품에 자동으로 적용되는 값입니다.",
  PRODUCT_INFO: "상품 원문에서 이 값을 찾지 못해 자동으로 채우지 못했습니다.",
};

export function describePriorityItem(item: PriorityItem): PriorityGuidance {
  const missingLabels = item.sourceItems.map((i) => i.label);
  const what =
    missingLabels.length > 0
      ? `비어 있는 항목: ${missingLabels.join(" · ")}`
      : `${item.label} — 아직 확인되지 않았습니다.`;

  const group = item.sourceItems.find((i) => i.group)?.group;
  const why = item.detail ?? item.sourceItems.find((i) => i.hint)?.hint ?? WHY_BY_GROUP[group ?? "PRODUCT_INFO"];

  const sectionLabel = item.sectionId ? REGISTRATION_SECTION_LABEL[item.sectionId] : undefined;
  if (sectionLabel && item.sectionId) {
    return {
      what,
      why,
      where: `이 화면의 「${sectionLabel}」에서 입력합니다.`,
      action: { kind: "SECTION", sectionId: item.sectionId, label: `「${sectionLabel}」에서 입력하기 →` },
    };
  }
  if (item.externalHref) {
    const external = item.externalHref === "/settings";
    return {
      what,
      why,
      where: external
        ? "설정 화면에서 채웁니다 — 상품마다 다시 입력하지 않습니다."
        : "아래 안내로 이동해 해결합니다.",
      action: {
        kind: "EXTERNAL",
        href: item.externalHref,
        label: external ? "설정으로 가기 →" : "해결 방법 보기 →",
      },
    };
  }
  return {
    what,
    why,
    /* 갈 곳을 만들어내지 않는다 — 어디인지 모르면 모른다고 말하고 버튼을 빼놓는다.
       REWORK-7 ①(2026-09-15) — 이 문구가 가리키던 "아래 필수항목 목록"이
       없어졌다(우측 요약은 이제 자리 단위 체크만 그린다). 없는 목록으로
       보내지 않고, 좌측 상세에서 찾아야 한다고 사실대로 적는다. */
    where: "좌측 등록 상세의 해당 섹션에서 찾아 채웁니다 — 이동할 자리를 아직 특정하지 못했습니다.",
    action: null,
  };
}
