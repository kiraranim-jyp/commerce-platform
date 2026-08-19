import type { CommerceCategoryPathResult, PlatformId } from "@commerce/shared";

/**
 * 이 카테고리 값이 어디서 왔는지.
 * INFERRED: 아직 사용자가 아무것도 안 함 — 시스템이 상품 데이터만 보고 내부적으로
 *   후보를 계산했지만 화면에 확정 표시는 안 된 상태(=UNRESOLVED와 짝을 이룬다).
 * RECOMMENDED: 추천 후보 1순위를 화면에 보여주고 있지만 사용자가 아직 누르지 않음.
 * USER_SELECTED: 사용자가 추천 후보 중 하나(또는 대안)를 직접 클릭해서 선택함.
 * AI_GENERATED: 규칙 기반이 아니라 AI가 만든 후보 — 이번 Mission에는 없지만 다음에
 *   실제 AI 분류기를 붙일 자리를 미리 만들어둔다.
 */
export type CategoryProvenance = "INFERRED" | "RECOMMENDED" | "USER_SELECTED" | "AI_GENERATED";

/**
 * UNRESOLVED → RECOMMENDED → SELECTED → CONFIRMED
 * Validation은 SELECTED/CONFIRMED만 PASS로 취급하고 나머지는 WARNING이다 —
 * "추천이 보이고 있다"와 "사용자가 실제로 확정했다"를 구분하기 위해서다.
 */
export type CategoryState = "UNRESOLVED" | "RECOMMENDED" | "SELECTED" | "CONFIRMED";

export interface CategoryCandidate {
  id: string;
  name: string;
  /** 최상위 → 최하위 순서의 카테고리 경로. 예: ["유아동패션", "유아동의류", "티셔츠"] */
  path: string[];
  platform: PlatformId;
  /** 0~1 */
  confidence: number;
  /** 사람이 읽을 수 있는 추천 이유 목록. */
  reason: string[];
  source: "rule" | "ai";
  /**
   * true면 id가 CartPilot 내부 카테고리 id가 아니라 플랫폼 공식 API가 돌려준
   * 실제 카테고리 코드다(예: 쿠팡 categorization/predict의 predictedCategoryId).
   * 등록 payload의 displayCategoryCode 같은 필드는 이 값이 true인 candidate가
   * 선택됐을 때만 채운다 — "AI 추천 내부 카테고리를 그대로 실제 플랫폼 코드로
   * 보내면 안 된다"는 원칙을 타입 레벨에서 강제한다.
   */
  isVerifiedPlatformCode?: boolean;
  /** N-3.1 — 각 노드의 실제 id를 포함한 전체 계층(플랫폼 API가 실제로 준
   * 값만). path(이름 배열)와 별개로, UI가 root→leaf 트리를 id까지 신뢰하고
   * 보여줄 수 있는 경우에만 채운다 — 없으면 path만으로 표시한다. */
  hierarchy?: CommerceCategoryPathResult;
  /** SmartStore 플로우 개선(CPO 지시 — "수동 선택 후에는 '✎ 판매자 선택' 상태
   * 표시") — CategoryTreeBrowser에서 카테고리 목록을 직접 훑어 고른
   * candidate에만 true를 준다. AI 추천 카드를 클릭해 확정한 candidate는
   * provenance가 이미 USER_SELECTED가 되지만(모든 확정이 클릭을 거친다) 그건
   * "추천을 승인함"이지 "추천 없이 직접 찾음"과는 다르다 — 이 필드가 그 차이를
   * 구분한다. */
  manuallySelected?: boolean;
}

export interface CategorySelection {
  state: CategoryState;
  candidate?: CategoryCandidate;
  provenance: CategoryProvenance;
}

export const UNRESOLVED_CATEGORY: CategorySelection = {
  state: "UNRESOLVED",
  provenance: "INFERRED",
};
