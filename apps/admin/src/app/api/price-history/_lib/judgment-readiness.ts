/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-FINAL-VISUAL-01 — **기존 판단을 «읽어서» READY / LIMITED / HOLD 로 적는다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 파일은 아무것도 «판단» 하지 않는다.**
 * ```
 * ❌ Identity 재계산   ❌ 가격 재계산   ❌ MI 재계산   ❌ 권장가 재계산
 * ❌ threshold · shortcut · synonym/Korean/IMAGE → SAME
 * 🟢 하는 일 — **이미 나온 결과를 읽어** 「무엇이 가능하고 무엇이 막혔는가」를 적는다
 * ```
 * 🔴 CPO §2 — 「기존 판단 가능 = 그대로 사용」. 그래서 이 모듈은 **입력을 만들지 않고**
 *    `computeMarketIntelligence` 가 이미 낸 값과 기존 Identity 결과만 **인자로 받는다**.
 *    ⟹ 값이 틀리면 그것은 **기존 파이프라인의 상태** 이고 이 파일이 만든 것이 아니다.
 *
 * ── 🔴 왜 「HOLD 이유」가 중요한가 (CPO §9 · §12) ────────────────────────────
 * ```
 * CASE A  시스템도 못 하고 **사람도 못 한다**      → 수정하지 않는다
 * CASE B  Evidence 를 보면 **사람은 충분히 한다**  → 개선 대상
 * ⟹ 그 둘을 가르려면 **「왜 막혔는지」가 화면에 있어야** 한다. 그것이 이 파일의 목적이다.
 * ```
 */

/** 🔴 기존 결과를 **그대로** 받는다. 여기서 만들어 내는 값이 하나도 없다. */
export interface JudgmentReadinessInput {
  /** 기존 Identity 결과(`crossSellerVerdict`) — SAME · PRESUMED_SAME · SIMILAR · CONFLICT · UNKNOWN. */
  identityVerdict: string | null;
  /** 기존 `priceTierFromLink` 결과 — EXACT · COMPARISON · REFERENCE · EXCLUDED. */
  priceTier: string | null;
  /** 기존 국내 참고가격 근거 수(0 이면 근거가 없다는 **사실**). */
  domesticReferenceCount: number;
  /** 기존 국내 최저가(KRW). */
  domesticLowestKrw: number | null;
  /** 기존 해외 최저 소싱가. 🔴 통화를 환산하지 않는다. */
  overseasLowest: { amount: number; currency: string } | null;
  /** 기존 MI 판매판단(`sellerFacingVerdict`). */
  sellerFacingVerdict: string | null;
  /** 기존 권장 판매가격(A 원가 역산). */
  recommendedPriceKrw: number | null;
}

export type ReadinessState = "READY" | "LIMITED" | "HOLD";

export interface ReadinessStep {
  /** 화면에 그대로 찍히는 단계 이름. */
  name: string;
  state: ReadinessState;
  /** 사람이 읽는 현재 값/사유. 🔴 **없으면 「없음」이라고 적는다**(빈칸으로 두지 않는다). */
  detail: string;
}

export interface JudgmentReadiness {
  state: ReadinessState;
  steps: ReadinessStep[];
  /** 🔴 HOLD/LIMITED 면 **반드시** 비어 있지 않다(계약이 잠근다). */
  reasons: string[];
}

/**
 * 🔴 Identity 어휘는 **기존 그대로** 쓴다. 이 표는 「그 상태가 가격 판단에 충분한가」를
 *    적을 뿐이고, **판정을 바꾸지 않는다**(SAME 을 더 만들지도, 없애지도 않는다).
 * 🟢 `PRESUMED_SAME` 이 LIMITED 인 것은 CPO §3-A 가 그렇게 적은 상태다.
 */
const IDENTITY_STATE: Record<string, ReadinessState> = {
  SAME: "READY",
  PRESUMED_SAME: "LIMITED",
  SIMILAR: "HOLD",
  CONFLICT: "HOLD",
  UNKNOWN: "HOLD",
};

const worst = (states: ReadinessState[]): ReadinessState =>
  states.includes("HOLD") ? "HOLD" : states.includes("LIMITED") ? "LIMITED" : "READY";

/**
 * 기존 결과를 읽어 단계별 상태와 **막힌 이유** 를 돌려준다.
 *
 * 🔴 **새 정책이 아니다.** 각 단계의 판단 기준은 「기존 파이프라인이 값을 냈는가」 하나다 —
 *    값이 있으면 READY, 없으면 그 사실을 **이유로 적는다**.
 */
export function summarizeJudgmentReadiness(input: JudgmentReadinessInput): JudgmentReadiness {
  const reasons: string[] = [];
  const steps: ReadinessStep[] = [];

  /* ① 동일상품 판단 — 기존 Identity 결과를 그대로 읽는다. */
  const identity = input.identityVerdict;
  const identityState: ReadinessState = identity ? (IDENTITY_STATE[identity] ?? "HOLD") : "HOLD";
  steps.push({
    name: "동일상품 판단",
    state: identityState,
    detail: identity
      ? `${identity}${input.priceTier ? ` · tier ${input.priceTier}` : ""}`
      : "기존 Identity 결과 없음",
  });
  if (identityState === "HOLD") {
    reasons.push(identity ? `동일상품 확정 근거 부족(${identity})` : "동일상품 판단 결과가 없습니다");
  } else if (identityState === "LIMITED") {
    reasons.push("동일상품이 «보류»(PRESUMED_SAME) 상태입니다 — 확정 근거가 부족합니다");
  }

  /* ② 국내 참고가격 — 기존 집계가 값을 냈는가. */
  const domesticOk = input.domesticReferenceCount > 0 && input.domesticLowestKrw != null;
  steps.push({
    name: "국내 참고가격",
    state: domesticOk ? "READY" : "HOLD",
    detail: domesticOk
      ? `근거 ${input.domesticReferenceCount}건 · 최저 ₩${input.domesticLowestKrw!.toLocaleString("ko-KR")}`
      : input.domesticReferenceCount > 0
        ? `후보 ${input.domesticReferenceCount}건이지만 가격이 확인되지 않았습니다`
        : "국내 비교 후보 부족",
  });
  if (!domesticOk) reasons.push(steps[steps.length - 1]!.detail);

  /* ③ 해외 최저 소싱가 — 🔴 환산하지 않는다(원 통화 그대로). */
  const overseasOk = input.overseasLowest != null;
  steps.push({
    name: "해외 최저 소싱가",
    state: overseasOk ? "READY" : "HOLD",
    detail: overseasOk
      ? `${input.overseasLowest!.currency} ${input.overseasLowest!.amount}`
      : "해외 소싱가 근거 부족",
  });
  if (!overseasOk) reasons.push("해외 최저 소싱가 근거가 부족합니다");

  /* ④ MI 판매판단 — 기존 sellerFacingVerdict. */
  steps.push({
    name: "MI 판매판단",
    state: input.sellerFacingVerdict ? "READY" : "HOLD",
    detail: input.sellerFacingVerdict ?? "판매판단 결과 없음",
  });
  if (!input.sellerFacingVerdict) reasons.push("MI 판매판단 결과가 없습니다");

  /* ⑤ 권장 판매가격 — 기존 A(원가 역산) 결과. */
  steps.push({
    name: "권장 판매가격",
    state: input.recommendedPriceKrw != null ? "READY" : "HOLD",
    detail:
      input.recommendedPriceKrw != null
        ? `₩${input.recommendedPriceKrw.toLocaleString("ko-KR")}`
        : "원가 근거 부족으로 계산되지 않았습니다",
  });
  if (input.recommendedPriceKrw == null) reasons.push("권장 판매가격이 계산되지 않았습니다");

  const state = worst(steps.map((s) => s.state));
  /** 🔴 **계약** — READY 가 아니면 이유가 **반드시** 있다(빈 HOLD 를 만들지 않는다). */
  if (state !== "READY" && reasons.length === 0) reasons.push("원인을 특정하지 못했습니다");
  return { state, steps, reasons };
}
