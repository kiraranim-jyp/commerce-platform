/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 상단 진행 표시를 4단계로 다시 세운다.
 *
 *   ① 상품 수집  →  ② ⭐ 시장 판단  →  ③ 등록 준비  →  ④ 커머스 등록
 *
 * ── 왜 5단계에서 4단계로 줄였나 ──────────────────────────────────────────
 * 기존 5단계(상품 분석 → 이미지 준비 → 카테고리 확인 → AI 콘텐츠 → 스토어 등록)는
 * 전부 *등록 작업*의 순서였다. 그 안에 "이 상품을 팔 만한가"라는 판단이 한 칸도
 * 없어서, 진행바가 항상 "카테고리를 확인해주세요"를 가리켰다 — 셀러가 아직
 * 팔지 말지도 정하지 않았는데 등록 준비부터 재촉하는 화면이었다.
 *
 * 그래서 판단을 독립된 ②로 올리고, 원래 3·4단계였던 카테고리/AI 콘텐츠와
 * 이미지를 ③ 등록 준비 *안의 항목*으로 내렸다. 항목 판정 기준은 하나도 바꾸지
 * 않는다 — 특히 카테고리는 그대로 남는다. 실제로 등록 payload에 들어가는
 * 값이기 때문이다(smartstore leafCategoryId / coupang displayCategoryCode).
 * 카테고리가 확정되지 않으면 register API가 CP001로 거부하므로, ④는 여전히
 * 카테고리 확정 전에는 열리지 않는다 — 아래 register 단계의 게이트가 그것이다.
 */
export type StageKey = "collect" | "market" | "prepare" | "register";
export type StageStatus = "LOCKED" | "IN_PROGRESS" | "COMPLETED" | "NEEDS_ACTION";
export type PrepareItemKey = "images" | "category" | "content";

export const STAGE_ORDER: StageKey[] = ["collect", "market", "prepare", "register"];

export const STAGE_LABELS: Record<StageKey, string> = {
  collect: "상품 수집",
  market: "시장 판단",
  prepare: "등록 준비",
  register: "커머스 등록",
};

export const PREPARE_ITEM_ORDER: PrepareItemKey[] = ["images", "category", "content"];

export const PREPARE_ITEM_LABELS: Record<PrepareItemKey, string> = {
  images: "이미지",
  category: "카테고리",
  content: "AI 콘텐츠",
};

export interface StageProgressInput {
  /** 이미지가 한 장이라도 있는가(product.images.length > 0). */
  imagesDone: boolean;
  /**
   * 카테고리가 *검증된 플랫폼 코드로* 확정됐는가.
   * 호출부는 반드시 isVerifiedCategorySelected()를 쓴다 — state만 보면
   * CP001 버그가 재발한다(packages/marketplace/src/category-field.ts 참고).
   */
  categoryDone: boolean;
  /** 한국어 상품명이 채워졌는가(AI 콘텐츠 산출물). */
  contentDone: boolean;
  /**
   * 시장 판단 결과가 나왔는가. null이면 아직 분석 중이거나 판단 근거가 없다 —
   * "나쁘다"가 아니므로 NEEDS_ACTION(경고)이 아니라 IN_PROGRESS로 둔다.
   */
  verdictKnown: boolean;
}

export interface StageProgress {
  statuses: Record<StageKey, StageStatus>;
  /** 지금 사용자가 서 있는 단계 — 아직 완료되지 않은 첫 단계다. */
  currentStage: StageKey;
  /** ③ 안에서 아직 남은 항목. 없으면 ③이 끝난 것이다. */
  pendingPrepareItems: PrepareItemKey[];
}

export function resolveStageProgress(input: StageProgressInput): StageProgress {
  const prepareDone: Record<PrepareItemKey, boolean> = {
    images: input.imagesDone,
    category: input.categoryDone,
    content: input.contentDone,
  };
  const pendingPrepareItems = PREPARE_ITEM_ORDER.filter((key) => !prepareDone[key]);

  const statuses: Record<StageKey, StageStatus> = {
    // 이 컴포넌트는 수집·분석이 끝난 뒤에만 마운트된다(page.tsx의 로딩 화면이
    // 그 이전 구간을 따로 보여준다) — 그래서 ①은 항상 완료다.
    collect: "COMPLETED",
    market: input.verdictKnown ? "COMPLETED" : "IN_PROGRESS",
    prepare: pendingPrepareItems.length === 0 ? "COMPLETED" : "NEEDS_ACTION",
    register: pendingPrepareItems.length === 0 ? "NEEDS_ACTION" : "LOCKED",
  };

  return {
    statuses,
    currentStage: STAGE_ORDER.find((stage) => statuses[stage] !== "COMPLETED") ?? "register",
    pendingPrepareItems,
  };
}
