import type { MarketEvidenceSummary } from "./market-evidence";
import { priceConfidenceText, priceText, verdictDisplay, type GeminiTransientRow } from "./GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-030 — **상품 판단 요약**: 이미 계산된 결과를 «한 곳» 으로 모은다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 판정값을 계산하지 않는다.** 이 파일은 숫자를 만들지도, 등급을 매기지도,
 *    통화를 환산하지도 않는다. 하는 일은 **이미 다른 owner 가 낸 문자열을 고르는 것**
 *    뿐이다:
 * ```
 * 판매 판단   FINAL_VERDICT_COPY[...]            (seller-decision owner)
 * 시장 요약   MarketEvidenceSummary.figure/scope (market-evidence owner)
 * 등급 이름   MarketEvidenceTierCount.label      (match-display owner)
 * 일시 후보   verdictDisplay / priceText / priceConfidenceText (WU-028 owner)
 * ```
 * 🔴 그래서 요약과 상세가 **절대 갈라질 수 없다** — 같은 값을 두 번 계산하지 않기 때문이다.
 *
 * ── 🔴 왜 이 블록이 생겼나 (CPO 2026-10-16) ─────────────────────────────────
 * 결론(①팔아도 되는가 ②동일상품인가 ③어디가 얼마인가)이 **상단에 있기는 했지만
 * 서로 떨어져 있어서**, 셀러가 화면을 읽어 내려가며 스스로 조합해야 했다.
 * 🟢 데이터는 그대로 두고 **읽는 순서만** 하나로 모은다.
 *
 * 🔴 **모르는 것은 줄을 만들지 않는다.** 빈 값을 「-」나 「0원」으로 채우지 않는다 —
 *    그것이 이 저장소가 반복해서 막아 온 「화면이 아는 척하는」 사고다.
 */

export interface JudgementSummaryRow {
  /** 왼쪽 라벨. 셀러가 묻는 질문의 이름이다. */
  label: string;
  /** 오른쪽 값. **다른 owner 가 만든 문자열을 그대로** 옮긴다. */
  value: string;
  /** 값만으로 오해할 수 있을 때만 붙는 한 줄. 없으면 null. */
  note?: string | null;
}

export interface TransientGroup {
  /** 「직접 입력」 / 「웹 검색」 — 출처를 요약에서도 잃지 않는다. */
  sourceLabel: string;
  rows: GeminiTransientRow[];
}

export interface JudgementSummaryInput {
  /** 이미 확정된 판매 판단 문구. 없으면 아직 판단 전이다. */
  verdictLabel: string | null;
  /** 국내/해외 시장 요약 — `market-evidence.ts` 가 낸 **그 객체** 다. */
  domestic: MarketEvidenceSummary | null;
  overseas: MarketEvidenceSummary | null;
  /** 저장되지 않는 일시 후보(웹 검색 · 직접 입력). 비어 있으면 줄이 생기지 않는다. */
  transient?: TransientGroup[];
}

/** 🔴 값이 없으면 **줄 자체를 만들지 않는다**(아래 builder 가 null 을 걸러낸다). */
type MaybeRow = JudgementSummaryRow | null;

const row = (label: string, value: string | null, note?: string | null): MaybeRow =>
  value ? { label, value, note: note ?? null } : null;

/** 🔴 가격이 붙은 **첫** 후보. 순서는 `withConfidence` 가 정한 것이고 여기서 다시 세우지 않는다. */
function firstPricedRow(groups: TransientGroup[]): { group: TransientGroup; row: GeminiTransientRow } | null {
  for (const group of groups) {
    for (const candidate of group.rows) {
      if (candidate.priceAmount != null && candidate.priceCurrency) return { group, row: candidate };
    }
  }
  return null;
}

/** 🔴 판정이 붙은 첫 후보 — 등급을 **새로 매기지 않는다**(owner 의 라벨을 그대로 쓴다). */
function firstVerdictRow(groups: TransientGroup[]): GeminiTransientRow | null {
  for (const group of groups) {
    for (const candidate of group.rows) {
      if (verdictDisplay(candidate)) return candidate;
    }
  }
  return null;
}

export const JUDGEMENT_SUMMARY_TITLE = "상품 판단 요약";
/** 🔴 CPO 가 지정한 성질 — 요약은 **결론만** 말하고 근거는 아래 상세가 그대로 갖는다. */
export const JUDGEMENT_SUMMARY_HINT = "아래 상세 분석의 결론만 모았습니다 — 근거는 그대로 아래에 있습니다.";

/**
 * 네 가지 질문에 **한 덩어리로** 답한다:
 *   ① 팔아도 되는가  ② 동일상품인가  ③ 어디가 얼마인가  ④ 주의할 것은 무엇인가
 */
export function buildJudgementSummary(input: JudgementSummaryInput): JudgementSummaryRow[] {
  const groups = (input.transient ?? []).filter((g) => g.rows.length > 0);
  const transientCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const priced = firstPricedRow(groups);
  const verdictRow = firstVerdictRow(groups);

  /** ② 동일상품 — 저장된 국내 근거의 **최상위 등급** 이 있으면 그것, 없으면 일시 후보. */
  const domesticTier = input.domestic?.tiers?.[0] ?? null;
  const sameProduct = domesticTier
    ? `${domesticTier.icon} ${domesticTier.label}`
    : verdictRow
      ? `${verdictDisplay(verdictRow)!.icon} ${verdictDisplay(verdictRow)!.label}`
      : null;

  /** ③ 비교 가격 — 저장된 국내 대표 숫자가 있으면 그것, 없으면 일시 후보의 가격. */
  const comparePrice = input.domestic?.figure ?? (priced ? priceText(priced.row) : null);

  /** ③-b 근거의 두께 — 저장된 근거가 없으면 **일시 후보 건수** 를 출처와 함께 적는다. */
  const scope =
    input.domestic?.scopeLabel ??
    (transientCount > 0 ? groups.map((g) => `${g.sourceLabel} ${g.rows.length}건`).join(" · ") : null);

  return [
    row("시장 판단", input.verdictLabel ?? "확인 중", input.verdictLabel ? null : "아직 판단에 필요한 정보가 모이지 않았습니다."),
    row("동일상품", sameProduct),
    row("비교 가격", comparePrice, input.domestic?.figureBasis ?? null),
    row("비교 근거", scope),
    row("해외 시장", input.overseas?.figure ?? null, input.overseas?.figureBasis ?? null),
    /**
     * ④ 🔴🔴 **가격이 있는데 판매판정에 안 들어가는 이유** 를 요약에서 바로 말한다.
     *    저장된 국내 근거가 있으면 그쪽이 정식 경로이므로 이 줄은 서지 않는다 —
     *    일시 후보의 가격만 있을 때가 오해가 생기는 바로 그 상황이다.
     */
    input.domestic?.figure == null && priced ? row("가격 상태", priceConfidenceText(priced.row)) : null,
  ].filter((r): r is JudgementSummaryRow => r !== null);
}
