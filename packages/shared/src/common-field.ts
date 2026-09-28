import type { FieldRequirementKind, FieldValueSource } from "./field-requirement";
import type { FieldSource } from "./product-types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COMMERCE-COMMON — **한 필드의 «지금 상태»를 한 모양으로 말한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이 파일이 «새로 만드는» 것은 최소다 ───────────────────────────────────
 * 요구도(`FieldRequirementKind`)와 출처(`FieldValueSource`)는 이미 있다
 * (`field-requirement.ts`, 장기 스프린트 S-20/21/22). 상품값의 출처
 * (`FieldSource`)도 이미 있다. 이 파일은 그 셋을 «엮고», 없던 두 축만 더한다 —
 * **값 상태**와 **판매자 확인**이다.
 *
 * ── 🔴 왜 값 상태와 확인을 나누는가 ───────────────────────────────────────
 * 처음 설계에서는 확인을 값 상태 안에 넣으려 했다(`CONFIRMED` 를 한 칸에).
 * 그러면 이것을 표현할 수 없다 —
 *
 *     KC 인증정보   값은 있다   그러나 판매자가 아직 확인하지 않았다
 *
 * 「값이 있으니 확인된 것」으로 읽히는 순간 시스템이 판매자의 책임을 대신 진다.
 * 이 저장소는 그 실수를 이미 한 번 겪었다(KC 「값 있음」 ≠ 「확인됨」).
 * 그래서 두 칸으로 나눈다.
 */

/**
 * 값 자체에 대한 «사실». 🔴 확인 여부는 여기 없다.
 *
 *  VALUE    쓸 수 있는 값이 있다.
 *  MISSING  없다 — 채우면 된다.
 *  UNKNOWN  🔴 판단할 수 없다. `MISSING` 과 섞지 않는다 — 앞엣것은 「채우면
 *           되는」 것이고 이것은 「무엇이 맞는지 모르는」 것이다.
 *  INVALID  값은 있는데 그대로 쓸 수 없다(형식·범위).
 */
export type CommonValueState = "VALUE" | "MISSING" | "UNKNOWN" | "INVALID";

/**
 * 판매자가 «확인했다»는 기록.
 *
 * 🔴 `policyVersion` 이 함께 있는 이유: 정책이 바뀌면 과거의 확인을 영구히
 * 신뢰하지 않는다. 이 규칙은 우리가 만든 것이 아니라 이미 있다 —
 * `seller_compliance_confirmations.policy_version`(migration 024)과
 * `COMPLIANCE_POLICY_VERSION`(naver/compliance.ts). 같은 규칙을 이어받는다.
 */
export interface CommonConfirmation {
  confirmedAt: string;
  policyVersion: string;
}

/** 한 필드의 지금 상태 전부. */
export interface CommonField<T = string> {
  /** Common 의미. 🔴 채널 필드명이 아니라 «의미» 다(ORIGIN · COLOR · KC …). */
  concept: string;
  /** 🔴 값이 없으면 `null` 이다. 빈 문자열로 「있는 척」하지 않는다. */
  value: T | null;
  valueState: CommonValueState;
  requirement: FieldRequirementKind;
  /** 어느 «계층» 이 줬는가. */
  source: FieldValueSource;
  /**
   * 그 값이 «어떻게 생겼는가»(상품에서 온 값일 때만).
   * 🔴 `source` 와 합치지 않는다 — 서로 다른 질문이다.
   */
  provenance?: FieldSource;
  /** 확인한 적이 없으면 `null`. 🔴 `undefined` 와 구분하지 않는다(둘 다 미확인). */
  confirmation: CommonConfirmation | null;
  /** 왜 이 상태인지. 셀러에게 보여줄 수 있는 문장. */
  reason?: string;
}

/**
 * 필드마다 «허용되는 출처» 가 다르다.
 *
 * 🔴 `FIELD_SOURCE_PRIORITY` 를 전역 고정 순서로 쓰면 안 된다(CPO 확정).
 * 배송 기본값은 괜찮지만 제조국 기본값은 위험하고 KC 기본값은 금지다.
 * 그래서 순서가 아니라 **필드별 정책**이 결정한다.
 */
export interface CommonFieldSourcePolicy {
  /** 이 필드가 값을 받을 수 있는 계층. 순서가 곧 우선순위다. */
  allowedSources: readonly FieldValueSource[];
  /** 🔴 관용 기본값을 이 필드에 채워도 되는가. 대부분 `false` 다. */
  defaultAllowed: boolean;
  /** 판매자 확인이 의미를 갖는 필드인가. */
  userConfirmationAllowed: boolean;
  /** 왜 이렇게 정했는가 — 추측이 아니라는 근거를 칸으로 강제한다. */
  rationale: string;
}

/**
 * 한 필드의 등록 준비 상태.
 *
 *  READY               등록 가능.
 *  WARNING             등록은 되지만 주의가 있다. 🔴 막지 «않는다».
 *  NEEDS_CONFIRMATION  판매자가 판단해야 한다.
 *  BLOCKED             등록 불가.
 *
 * 🔴 `WARNING` 이 필요한 이유는 쿠팡이다. 쿠팡 검증기는 `PASS|WARNING|ERROR`
 * 인데 `WARNING` 은 지금 등록을 막지 않는다. 공통 어휘로 올리면서 이것을
 * `BLOCKED` 로 바꾸면 **지금 등록되는 상품이 막힌다.**
 *
 * 🔴 이것은 `RegistrationReadinessState`(apps/admin)와 «다른 층» 이다.
 * 저것은 상품 하나의 종합 상태이고, 이것은 필드 하나의 상태다. 합치지 않는다.
 */
export type CommonReadiness = "READY" | "WARNING" | "NEEDS_CONFIRMATION" | "BLOCKED";

/** 그 채널이 이 필드를 어떻게 요구하는가. */
export interface CommerceFieldRequirement {
  requirement: FieldRequirementKind;
  /** `CONDITIONAL_REQUIRED` 일 때 지금 조건이 성립하는가. */
  conditionMet?: boolean;
  /** 채널 검증기가 이미 내놓은 신호(있으면). 🔴 우리가 다시 판정하지 않는다. */
  channelSignal?: "PASS" | "WARNING" | "ERROR";
}

/**
 * 필드 상태 × 채널 요구도 → 준비 상태.
 *
 * 🔴 요구도와 결과 상태를 «섞지 않는다»(CPO 확정). 같은 `MISSING` 이라도
 * 요구도가 무엇이냐에 따라 답이 다르다.
 */
export function resolveCommonReadiness(field: CommonField, channel: CommerceFieldRequirement): CommonReadiness {
  /* 채널이 이미 오류라고 말했으면 그대로 받는다 — 우리가 뒤집지 않는다. */
  if (channel.channelSignal === "ERROR") return "BLOCKED";

  /* 조건부인데 조건이 성립하지 않으면 «해당 없음» 이다. 막지 않는다. */
  if (channel.requirement === "CONDITIONAL_REQUIRED" && channel.conditionMet === false) return "READY";

  if (channel.requirement === "USER_CONFIRMATION") {
    /* 🔴 값이 있어도 확인 전이면 확인이 필요하다. 이것이 이 표준의 핵심이다. */
    return field.confirmation ? "READY" : "NEEDS_CONFIRMATION";
  }

  if (channel.requirement === "OPTIONAL") {
    return channel.channelSignal === "WARNING" ? "WARNING" : "READY";
  }

  /* REQUIRED · 조건이 성립한 CONDITIONAL_REQUIRED */
  if (field.valueState === "VALUE") {
    return channel.channelSignal === "WARNING" ? "WARNING" : "READY";
  }
  /* MISSING · UNKNOWN · INVALID 는 전부 막는다 — 다만 이유가 다르다. */
  return "BLOCKED";
}
