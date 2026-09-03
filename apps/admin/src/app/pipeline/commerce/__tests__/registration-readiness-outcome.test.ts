import { describe, expect, it } from "vitest";
import {
  buildSellAndRegisterView,
  computeRegistrationReadiness,
  toActionItems,
  toRegistrationOutcome,
  type PlatformReadinessInput,
  type RegistrationOutcome,
} from "../registration-readiness-outcome";
import type { PriorityItem, RegistrationReadinessState } from "../readiness-state";
import type { SellerFacingVerdictCode } from "@commerce/pricing";

/**
 * P-32(CPO 지시, 2026-09-03) — "팔 만한가?"와 "지금 등록할 수 있는가?"는
 * 다른 질문이다. 이 파일이 보장하는 핵심은 두 축의 독립성이다.
 */
function platform(
  platformId: string,
  state: RegistrationReadinessState | null,
  priorityItems: PriorityItem[] = [],
): PlatformReadinessInput {
  return { platformId, label: platformId === "naver" ? "스마트스토어" : "쿠팡", state, priorityItems };
}

const ALL_SELL_VERDICTS: (SellerFacingVerdictCode | null)[] = [
  "RECOMMENDED",
  "CONDITIONAL",
  "NOT_RECOMMENDED",
  null,
];

describe("toRegistrationOutcome — 기존 4-state를 화면 4단계로 정규화", () => {
  it("READY/BLOCKED는 그대로, 검토 상태는 보완 필요로 묶는다", () => {
    expect(toRegistrationOutcome("READY")).toBe("READY");
    expect(toRegistrationOutcome("BLOCKED")).toBe("BLOCKED");
    expect(toRegistrationOutcome("NEEDS_REVIEW")).toBe("NEEDS_WORK");
    expect(toRegistrationOutcome("SELLER_REVIEW")).toBe("NEEDS_WORK");
  });

  it("검증이 아직 안 돌았으면 UNKNOWN — 등록 불가(BLOCKED)로 표시하지 않는다", () => {
    expect(toRegistrationOutcome(null)).toBe("UNKNOWN");
    expect(toRegistrationOutcome(undefined)).toBe("UNKNOWN");
    expect(toRegistrationOutcome(null)).not.toBe("BLOCKED");
  });
});

describe("computeRegistrationReadiness — 플랫폼별/전체 집계", () => {
  it("한 곳이라도 등록 가능하면 전체는 등록 가능이다", () => {
    const r = computeRegistrationReadiness([platform("naver", "READY"), platform("coupang", "BLOCKED")]);
    expect(r.overall).toBe("READY");
    expect(r.platforms.map((p) => p.outcome)).toEqual(["READY", "BLOCKED"]);
  });

  it("등록 가능이 없고 보완 가능만 있으면 보완 필요다", () => {
    expect(computeRegistrationReadiness([platform("naver", "NEEDS_REVIEW"), platform("coupang", "BLOCKED")]).overall).toBe(
      "NEEDS_WORK",
    );
  });

  it("확인된 플랫폼이 전부 막혀 있어야 등록 불가다", () => {
    expect(computeRegistrationReadiness([platform("naver", "BLOCKED"), platform("coupang", "BLOCKED")]).overall).toBe(
      "BLOCKED",
    );
  });

  it("아무 플랫폼도 확인되지 않았으면 UNKNOWN이다(등록 불가가 아니다)", () => {
    const r = computeRegistrationReadiness([platform("naver", null), platform("coupang", null)]);
    expect(r.overall).toBe("UNKNOWN");
    expect(r.overall).not.toBe("BLOCKED");
    expect(r.knownPlatformCount).toBe(0);
  });

  it("일부만 확인됐으면 확인된 것만으로 집계하고 개수를 함께 돌려준다", () => {
    const r = computeRegistrationReadiness([platform("naver", "READY"), platform("coupang", null)]);
    expect(r.overall).toBe("READY");
    expect(r.knownPlatformCount).toBe(1);
  });

  it("플랫폼이 하나도 없으면 UNKNOWN이다", () => {
    expect(computeRegistrationReadiness([]).overall).toBe("UNKNOWN");
  });
});

describe("toActionItems — 무엇이/왜/무엇을 분리, 문구를 지어내지 않는다", () => {
  it("PriorityItem의 라벨과 힌트를 그대로 쓴다", () => {
    const items = toActionItems("쿠팡", [
      { key: "legal", label: "KC 인증정보", detail: "안전기준 확인이 필요합니다", sourceItems: [] },
    ]);
    expect(items[0].what).toBe("KC 인증정보");
    expect(items[0].why).toBe("안전기준 확인이 필요합니다");
    expect(items[0].action).toContain("쿠팡");
  });

  it("근거가 없으면 why는 null이다 — 이유를 만들어내지 않는다", () => {
    const items = toActionItems("쿠팡", [{ key: "x", label: "반품지", sourceItems: [] }]);
    expect(items[0].why).toBeNull();
  });

  it("외부 설정이 필요한 항목은 행동 문구가 달라진다", () => {
    const items = toActionItems("쿠팡", [
      { key: "x", label: "반품지", sourceItems: [], externalHref: "https://example.com" },
    ]);
    expect(items[0].action).toContain("설정");
  });
});

describe("핵심 불변식 — 판매 판단과 등록 준비는 서로에게 영향을 주지 않는다", () => {
  it("어떤 판매 판정이든 등록 준비 결과는 동일하다", () => {
    const inputs = [platform("naver", "NEEDS_REVIEW"), platform("coupang", "READY")];
    const baseline = computeRegistrationReadiness(inputs);
    for (const verdict of ALL_SELL_VERDICTS) {
      expect(buildSellAndRegisterView(verdict, computeRegistrationReadiness(inputs)).registration).toEqual(baseline);
    }
  });

  it("판매 판정은 그대로 통과될 뿐 등록 상태에 의해 바뀌지 않는다", () => {
    for (const outcome of ["READY", "NEEDS_WORK", "BLOCKED", "UNKNOWN"] as RegistrationOutcome[]) {
      const registration = { overall: outcome, platforms: [], knownPlatformCount: 0 };
      for (const verdict of ALL_SELL_VERDICTS) {
        expect(buildSellAndRegisterView(verdict, registration).sellVerdict).toBe(verdict);
      }
    }
  });
});

describe("CPO 지정 조합 매트릭스 — 판매 추천 ≠ 등록 가능", () => {
  const view = (verdict: SellerFacingVerdictCode | null, state: RegistrationReadinessState | null) =>
    buildSellAndRegisterView(verdict, computeRegistrationReadiness([platform("naver", state)]));

  it("판매 추천 × 등록 가능", () => {
    const v = view("RECOMMENDED", "READY");
    expect(v.sellVerdict).toBe("RECOMMENDED");
    expect(v.registration.overall).toBe("READY");
  });

  it("판매 추천 × 보완 필요 — 추천이라고 등록이 가능해지지 않는다", () => {
    const v = view("RECOMMENDED", "NEEDS_REVIEW");
    expect(v.sellVerdict).toBe("RECOMMENDED");
    expect(v.registration.overall).toBe("NEEDS_WORK");
    expect(v.registration.overall).not.toBe("READY");
  });

  it("판매 추천 × 등록 불가", () => {
    const v = view("RECOMMENDED", "BLOCKED");
    expect(v.registration.overall).toBe("BLOCKED");
  });

  it("조건부 × 등록 가능 / 조건부 × 보완 필요", () => {
    expect(view("CONDITIONAL", "READY").registration.overall).toBe("READY");
    expect(view("CONDITIONAL", "SELLER_REVIEW").registration.overall).toBe("NEEDS_WORK");
  });

  it("비추천 × 등록 가능 — 등록은 막지 않는다(마진이 낮아도 등록 자체는 가능)", () => {
    const v = view("NOT_RECOMMENDED", "READY");
    expect(v.registration.overall).toBe("READY");
    expect(v.nextAction).toContain("판매를 권장하지 않습니다");
  });

  it("판단 보류(판매 판정 없음) × 등록 가능", () => {
    const v = view(null, "READY");
    expect(v.sellVerdict).toBeNull();
    expect(v.registration.overall).toBe("READY");
  });
});

describe("nextAction — 다음 행동을 안내한다", () => {
  it("등록이 막혀 있으면 판매 판정과 무관하게 등록 해결을 먼저 안내한다", () => {
    for (const verdict of ALL_SELL_VERDICTS) {
      const v = buildSellAndRegisterView(verdict, computeRegistrationReadiness([platform("naver", "BLOCKED")]));
      expect(v.nextAction).toContain("먼저");
    }
  });

  it("확인 전에는 '등록 불가'가 아니라 확인을 안내한다", () => {
    const v = buildSellAndRegisterView("RECOMMENDED", computeRegistrationReadiness([platform("naver", null)]));
    expect(v.nextAction).toContain("확인");
  });
});
