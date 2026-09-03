import type { PriorityItem, RegistrationReadinessState } from "./readiness-state";
import type { SellerFacingVerdictCode } from "@commerce/pricing";

/**
 * P-32(CPO 지시, 2026-09-03) — "이 상품은 팔 만한가?"와 "그렇다면 지금 등록할
 * 수 있는가?"는 서로 다른 질문이다. 지금까지 두 판정은 각각 존재했지만
 * (DomesticPriceIntelligencePanel의 판매 판정 / PlatformPreview의 등록 준비)
 * 한 화면에서 같이 답한 적이 없었다.
 *
 * 이 모듈은 **새 판정을 만들지 않는다**. 이미 계산된 두 값을 받아서
 *  ① 등록 준비를 4단계로 정규화하고(UNKNOWN 포함)
 *  ② 플랫폼별/전체 준비상태를 집계하고
 *  ③ 두 축을 나란히 놓기만 한다.
 *
 * ── 가장 중요한 불변식 ──────────────────────────────────────────────
 * 판매 판정과 등록 준비는 서로에게 영향을 주지 않는다.
 * "판매 추천"이라고 등록 가능이 되지 않고, "등록 가능"이라고 판매 추천이
 * 되지 않는다. 마진이 낮아도 등록 자체는 막히지 않는다는 기존 정책
 * (DomesticPriceIntelligencePanel 하단 안내 문구)과 정확히 같은 원칙이다.
 * 이 파일의 어떤 함수도 sellVerdict를 읽고 등록 결과를 바꾸지 않는다.
 */

/** CPO 지정 4단계. 기존 RegistrationReadinessState(4-state)를 화면 어휘로
 * 정규화한 것이며, 여기에 "아직 확인 못 함(UNKNOWN)"을 추가한다 — 검증을
 * 돌리지 않은 상태를 "등록 불가"로 표시하면 데이터 부족이 판정으로 둔갑한다
 * (P-31 UNKNOWN 정책과 같은 이유). */
export type RegistrationOutcome = "READY" | "NEEDS_WORK" | "BLOCKED" | "UNKNOWN";

export const REGISTRATION_OUTCOME_COPY: Record<RegistrationOutcome, { icon: string; title: string }> = {
  READY: { icon: "🟢", title: "등록 가능" },
  NEEDS_WORK: { icon: "🟡", title: "보완 후 등록 가능" },
  BLOCKED: { icon: "🔴", title: "등록 불가" },
  UNKNOWN: { icon: "⚪", title: "판단 보류" },
};

/**
 * 기존 4-state를 화면 4단계로 정규화한다.
 *
 * SELLER_REVIEW(판매자 확인 대기)를 NEEDS_WORK로 묶는 근거는 기존
 * readinessStateToLevel()이 이미 YELLOW로 묶고 있는 것과 동일하다 — 새로운
 * 분류 기준을 만들지 않는다. state를 아직 모르면(탭을 한 번도 열지 않아
 * 검증이 돌지 않음) UNKNOWN이다.
 */
export function toRegistrationOutcome(state: RegistrationReadinessState | null | undefined): RegistrationOutcome {
  if (state == null) return "UNKNOWN";
  if (state === "READY") return "READY";
  if (state === "BLOCKED") return "BLOCKED";
  return "NEEDS_WORK"; // NEEDS_REVIEW | SELLER_REVIEW
}

/** "무엇이 문제인지 → 왜 필요한지 → 무엇을 해야 하는지"를 분리해서 담는다.
 * 문구를 새로 지어내지 않고 PriorityItem(readiness-state.ts가 이미 만든
 * 사람이 읽는 라벨/힌트)에서 가져온다. */
export interface RegistrationActionItem {
  key: string;
  /** 무엇이 문제인지 */
  what: string;
  /** 왜 필요한지 — 원본 hint가 없으면 null(문구를 지어내지 않는다) */
  why: string | null;
  /** 무엇을 해야 하는지 */
  action: string;
  sectionId?: string;
  externalHref?: string;
}

export function toActionItems(platformLabel: string, items: PriorityItem[]): RegistrationActionItem[] {
  return items.map((item) => ({
    key: item.key,
    what: item.label,
    why: item.detail ?? item.sourceItems.find((s) => s.hint)?.hint ?? null,
    action: item.externalHref
      ? `${platformLabel} 설정에서 등록하세요`
      : `${platformLabel} 탭에서 해당 항목을 입력하세요`,
    sectionId: item.sectionId,
    externalHref: item.externalHref,
  }));
}

export interface PlatformReadinessInput {
  platformId: string;
  label: string;
  /** 아직 검증이 돌지 않았으면 null — BLOCKED와 구분한다. */
  state: RegistrationReadinessState | null;
  priorityItems: PriorityItem[];
}

export interface PlatformReadinessResult {
  platformId: string;
  label: string;
  outcome: RegistrationOutcome;
  actionItems: RegistrationActionItem[];
}

export interface RegistrationReadinessResult {
  /** 플랫폼 전체를 합친 결과 — "어디든 한 곳에 등록할 수 있는가". */
  overall: RegistrationOutcome;
  platforms: PlatformReadinessResult[];
  /** 확인이 끝난(UNKNOWN이 아닌) 플랫폼 수 — UI가 "아직 확인 안 됨"을
   * 정직하게 설명할 수 있게 함께 돌려준다. */
  knownPlatformCount: number;
}

/**
 * 플랫폼별 준비상태를 집계한다.
 *
 * 한 곳에만 등록해도 판매는 시작되므로, 하나라도 READY면 전체는 READY다.
 * 아무 플랫폼도 확인되지 않았으면 BLOCKED가 아니라 UNKNOWN이다.
 */
export function computeRegistrationReadiness(inputs: PlatformReadinessInput[]): RegistrationReadinessResult {
  const platforms: PlatformReadinessResult[] = inputs.map((input) => ({
    platformId: input.platformId,
    label: input.label,
    outcome: toRegistrationOutcome(input.state),
    actionItems: toActionItems(input.label, input.priorityItems),
  }));

  const known = platforms.filter((p) => p.outcome !== "UNKNOWN");
  let overall: RegistrationOutcome;
  if (known.length === 0) overall = "UNKNOWN";
  else if (known.some((p) => p.outcome === "READY")) overall = "READY";
  else if (known.some((p) => p.outcome === "NEEDS_WORK")) overall = "NEEDS_WORK";
  else overall = "BLOCKED";

  return { overall, platforms, knownPlatformCount: known.length };
}

export interface SellAndRegisterView {
  /** 판매 판단 — 입력을 그대로 통과시킨다(여기서 다시 판정하지 않는다). */
  sellVerdict: SellerFacingVerdictCode | null;
  registration: RegistrationReadinessResult;
  /** 두 축을 합쳐서 "지금 무엇을 할 차례인가"만 문장으로 만든다.
   * 판정을 새로 만드는 것이 아니라 안내 문구다. */
  nextAction: string;
}

/**
 * 판매 판단과 등록 준비를 나란히 놓는다.
 *
 * 두 값을 곱해서 새로운 종합 판정을 만들지 않는다 — 판매 추천이어도 등록이
 * 막혀 있을 수 있고, 등록이 가능해도 팔지 말아야 할 수 있다. 사용자가 두
 * 사실을 각각 보고 스스로 결정하게 두고, nextAction으로 다음 행동만 돕는다.
 */
export function buildSellAndRegisterView(
  sellVerdict: SellerFacingVerdictCode | null,
  registration: RegistrationReadinessResult,
): SellAndRegisterView {
  return { sellVerdict, registration, nextAction: resolveNextAction(sellVerdict, registration.overall) };
}

function resolveNextAction(sellVerdict: SellerFacingVerdictCode | null, outcome: RegistrationOutcome): string {
  if (outcome === "UNKNOWN") {
    return "플랫폼 탭을 열어 등록 필수정보를 확인해주세요 — 등록 가능 여부가 아직 확인되지 않았습니다.";
  }
  if (outcome === "BLOCKED") {
    return "등록에 필요한 정보가 아직 채워지지 않았습니다 — 아래 항목을 먼저 해결해주세요.";
  }
  if (outcome === "NEEDS_WORK") {
    return "아래 항목을 보완하면 등록할 수 있습니다.";
  }
  // 등록은 가능한 상태 — 남은 판단은 "팔 것인가"다.
  if (sellVerdict === "NOT_RECOMMENDED") {
    return "등록 자체는 가능하지만 현재 조건으로는 판매를 권장하지 않습니다 — 소싱가나 판매가를 다시 확인해보세요.";
  }
  if (sellVerdict === "CONDITIONAL") {
    return "등록 가능한 상태입니다 — 판매 조건(마진·시장 신호)을 확인한 뒤 등록하세요.";
  }
  if (sellVerdict === "RECOMMENDED") {
    return "등록 가능한 상태입니다 — 바로 등록을 진행할 수 있습니다.";
  }
  return "등록 가능한 상태입니다 — 판매 판단은 별도로 확인해주세요.";
}
