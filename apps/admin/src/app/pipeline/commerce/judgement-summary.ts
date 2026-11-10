import type { MarketEvidenceSummary } from "./market-evidence";
/** 🔴 WU-141-R3 — `priceText`/`priceConfidenceText` 는 **더 이상 쓰지 않는다**(가격 owner 분리). */
import { verdictDisplay, type GeminiTransientRow } from "./GeminiTransientCandidates";

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
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 SELLER-DECISION-UI-1 ⒝ — **요약이 말하는 «유일한» 금액**(CPO 확정 2026-11-08)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **owner 가 정정됐다 — 이 사실을 먼저 적는다.**
   * ```
   * 1차 승인  recommendation.recommendedPrice   🔴 **틀렸다**(실측으로 반증)
   * 정정 확정  **recommendedPriceKrw**  = `CommerceWorkspace` 의 `resolveListingPrice(...)`
   *           결과이고 `MarketPriceComparison` 이 받는 **바로 그 변수** 다
   * ```
   * 🔴 왜 중요한가 — 화면의 「추천 판매가」(`market-recommended-price-amount`)가 찍는 값
   *    **그리고** 「적용」 버튼이 `updateSalePriceKrw` 에 넣는 값이 **둘 다 그 변수** 다.
   *    🔴 `recommendation.recommendedPrice` 는 **별도 prop**(`marketPriceKrw`)으로 흐르고
   *       「추천 판매가」로 **표시되지 않는다** ⟹ 그것을 쓰면 요약이 판매 가격 설정과
   *       **다른 숫자** 를 말한다 = WU-141-R3 C-2 가 막으려던 **바로 그 실패** 다.
   * 🟢 그래서 Workspace 는 **같은 변수를 그대로** 넘긴다 — 동일성이 «구조적» 이다(재계산 0).
   * 🔴 **없으면 금액을 만들지 않는다** — 후보/집계 가격으로 **대체하지 않는다**(C-2-c).
   */
  recommendedPriceKrw?: number | null;
  /**
   * 🔵 SELLER-DECISION-UI-1 ⒝ — 「핵심 판단 이유」 한 줄. **기존 MI 산출을 그대로 옮긴다**
   *    (`sellerDecision.reasons[0]`). 🔴 새 문장을 만들지 않는다.
   * 🔴 그 문장에 **금액이 섞여 있으면 쓰지 않는다** — 요약의 금액은 추천 판매가격 하나뿐이다.
   */
  decisionReason?: string | null;
  /**
   * 🔴🔴 MI-SELLER-MARKET-COMPARISON-A — **여기에 `marketKrwComparison` 을 넣지 않는다.**
   *    1차에 이 칸을 추가했다가 **되돌렸다.** 위 WU-141-R3(CPO §2-A)이 이 블록에서
   *    가격 숫자를 **직접 제거** 했기 때문이다 — 이 카드는 패널의 첫 자식이라
   *    「가장 먼저 읽히는데 가장 약한 근거」가 되는 자리였다.
   * 🟢 국내↔해외 비교는 **가격 owner 인 「📊 시장 판매 판단」** 이 말한다.
   */
}

/**
 * 🔴🔴 **요약에서 금액을 가려내는 단 하나의 술어.** `wu-141-r3 C-2-a` 가 쓰던 그 정규식이고,
 *    여기서 **같은 식** 을 쓰는 이유는 계약과 구현이 서로 다른 기준을 갖지 않게 하기 위해서다.
 * 🔴 추천 판매가격은 이 검사를 **통과하지 않는다** — 그 값은 rows 가 아니라 **헤드라인** 이
 *    들고 있고, rows 에는 금액이 **한 글자도** 들어가지 않는다.
 */
export const containsMoney = (text: string): boolean =>
  /\d{1,3},\d{3}|₩|KRW|GBP|EUR|USD|€|\$|£/.test(text);

/** 🔴 값이 없으면 **줄 자체를 만들지 않는다**(아래 builder 가 null 을 걸러낸다). */
type MaybeRow = JudgementSummaryRow | null;

const row = (label: string, value: string | null, note?: string | null): MaybeRow =>
  value ? { label, value, note: note ?? null } : null;

/**
 * 🔴🔴 WU-141-R3 — **`firstPricedRow` 를 제거했다.** 이 함수가 요약 카드의 독자적인
 *    가격 폴백(일시 후보의 가격을 「비교 가격」으로 올리던 경로)의 입력이었다 ⟹
 *    남겨 두면 다음 사람이 그 폴백을 **되살릴 자리** 가 된다(C-2 위반 경로를 비워 둔다).
 * 🟢 가격은 「📊 시장 판매 판단」(`mi-same-candidates`)이 단독으로 계산한다.
 */

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
 * 🔵 SELLER-DECISION-UI-1 ⒝ — 헤드라인 금액의 라벨.
 * 🔴 「시장 평균가」·「적정가」 같은 말을 쓰지 않는다 — 이 값은 **판매 가격 설정과 같은**
 *    추천 판매가격이고, 다른 이름을 붙이면 셀러가 **다른 숫자** 로 읽는다.
 */
export const JUDGEMENT_SUMMARY_PRICE_LABEL = "추천 판매가격";

/**
 * 네 가지 질문에 **한 덩어리로** 답한다:
 *   ① 팔아도 되는가  ② 동일상품인가  ③ 어디가 얼마인가  ④ 주의할 것은 무엇인가
 */
export function buildJudgementSummary(input: JudgementSummaryInput): JudgementSummaryRow[] {
  const groups = (input.transient ?? []).filter((g) => g.rows.length > 0);
  const transientCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const verdictRow = firstVerdictRow(groups);

  /** ② 동일상품 — 저장된 국내 근거의 **최상위 등급** 이 있으면 그것, 없으면 일시 후보. */
  const domesticTier = input.domestic?.tiers?.[0] ?? null;
  const sameProduct = domesticTier
    ? `${domesticTier.icon} ${domesticTier.label}`
    : verdictRow
      ? `${verdictDisplay(verdictRow)!.icon} ${verdictDisplay(verdictRow)!.label}`
      : null;

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-141-R3 — **요약 카드는 가격 숫자의 owner 가 아니다** (CPO §2-A)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO: 「현재 `비교 가격 ₩88,000` · `해외 시장 £37` — **이 숫자는 제거한다**」.
   *
   * 🔴🔴 **왜 요약 카드가 가장 위험한 자리였나** — 이 블록은 패널의 **첫 번째 자식**
   *    이고(`DomesticPriceIntelligencePanel.tsx` 의 `<ProductJudgementSummary>`),
   *    「📊 시장 판매 판단」보다 **위** 에 선다. 그래서 셀러가 **가장 먼저 읽는 가격
   *    숫자** 가 ① 이 아니라 여기였다 ⟹ 두 숫자가 다르면 그 즉시 신뢰가 깨진다.
   *
   * 🔴 그리고 이 자리에는 **독자적인 가격 계산** 까지 있었다:
   * ```
   * comparePrice = input.domestic?.figure ?? (priced ? priceText(priced.row) : null)
   *                                           └ 🔴 저장 근거가 없으면 **일시 후보의
   *                                              가격** 으로 폴백했다 ⟹ ① 과 다른
   *                                              게이트(SAME·품절·검증 안 봄)의 숫자다
   * ```
   * ⟹ 🔴 C-2(「가격 집계가 다른 seller-facing 영역에 독립적으로 존재하지 않는다」)
   *    위반의 **실체** 가 이 폴백이었다. 그래서 줄과 함께 **그 계산도 제거** 했다.
   *
   * 🟢 **데이터는 잃지 않는다** — 가격은 「📊 시장 판매 판단」이 시장별로 말하고
   *    (동일상품 확인 N곳 · 판매중 N곳 · 가격 확인 N곳 · 확인 가격 · 🔗), 후보별
   *    가격은 `▸ 판단 근거 보기` 안의 후보 행이 그대로 보여준다.
   * 🔴 「시장 판단」·「동일상품」·「비교 근거」는 **가격 숫자가 아니라 판정/근거 두께**
   *    이므로 남는다 — 요약 카드의 역할(팔아도 되는가)에 속한다.
   */
  /** ③-b 근거의 두께 — 저장된 근거가 없을 때 쓰는 **일시 후보 건수**(출처별). */
  const transientScope =
    transientCount > 0 ? groups.map((g) => `${g.sourceLabel} ${g.rows.length}건`).join(" · ") : null;

  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 SELLER-DECISION-UI-1 ⒝ — **네 줄로 재구성했다**(CEO 확인 · CPO 확정)
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CEO: 「하단의 모든 내용을 요약해서 **팔지말지 · 가격은 어떻게 되는지** 가 보여야 해」.
   * 🔴 라벨이 바뀐 자리를 **이력으로** 남긴다(계약이 그 글자를 보고 있었다):
   * ```
   * 시장 판단 → **판매 판단**        동일상품 ─┐
   * 비교 근거 ─────────────────────────────────┴→ **국내 가격 분석**(한 줄로 합쳤다)
   * (신설) **해외 가격 분석**        (신설) **핵심 판단 이유**
   * ```
   * 🔴🔴 **rows 에는 금액이 한 글자도 들어가지 않는다**(C-2-a 유지) — 요약의 금액은
   *    헤드라인의 **추천 판매가격 하나** 뿐이고 그 owner 는 `recommendedPriceKrw` 다.
   * 🟢 정보는 **잃지 않았다** — 「동일상품 등급」과 「근거 두께」가 국내 줄 안으로 들어갔다.
   */
  /**
   * 🔴🔴 **출처 건수를 잃지 않는다** — `wu-030` 의 「출처를 요약에서도 잃지 않는다」가
   *    1차 구현을 **FAIL 로 잡았다**. 등급으로 «대체» 하면 「직접 입력 1건 · 웹 검색 1건」이
   *    사라진다 ⟹ 🟢 그래서 **둘을 잇는다**(등급 · 출처 건수).
   * 🟢 저장 근거(`domestic`)가 있으면 `marketLine` 이 등급+근거 두께를 이미 들고 온다.
   */
  const domesticFallback =
    [sameProduct, transientScope].filter((s): s is string => Boolean(s)).join(" · ") || null;
  const domesticLine = marketLine(input.domestic) ?? domesticFallback;
  const overseasLine = marketLine(input.overseas);
  /** 🔴 금액이 섞인 이유 문장은 **쓰지 않는다** — 요약의 금액 owner 를 둘로 만들지 않는다. */
  const reason = (input.decisionReason ?? "").trim();

  return [
    row("판매 판단", input.verdictLabel ?? "확인 중", input.verdictLabel ? null : "아직 판단에 필요한 정보가 모이지 않았습니다."),
    row("국내 가격 분석", domesticLine),
    row("해외 가격 분석", overseasLine),
    row("핵심 판단 이유", reason && !containsMoney(reason) ? reason : null),
  ].filter((r): r is JudgementSummaryRow => r !== null);
}

/**
 * 🔴 시장 한 줄 — **등급 + 근거 두께** 만 적는다. 🔴 `figure`(금액)는 **쓰지 않는다**.
 * 🟢 값은 전부 다른 owner 가 만든 문자열이다(`match-display` · `market-evidence`).
 */
function marketLine(market: MarketEvidenceSummary | null | undefined): string | null {
  if (!market) return null;
  const tier = market.tiers?.[0] ? `${market.tiers[0].icon} ${market.tiers[0].label}` : null;
  const line = [tier, market.scopeLabel].filter((s): s is string => Boolean(s && s.trim())).join(" · ");
  /** 🔴 혹시라도 금액이 섞여 들어오면 **줄을 만들지 않는다**(C-2-a 는 구현에서도 지킨다). */
  return line && !containsMoney(line) ? line : null;
}
