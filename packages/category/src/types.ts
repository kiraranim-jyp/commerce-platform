import type { PlatformId } from "@commerce/shared";

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
