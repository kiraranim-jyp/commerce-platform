"use client";

import type { JSX } from "react";
import { OverseasReferencePrice } from "./OverseasReferencePrice";
import {
  DOMESTIC_REFERENCE_NOTE,
  DOMESTIC_REFERENCE_SCOPE,
  DOMESTIC_REFERENCE_TITLE,
  /** 🔴 CORE-2T §4 — 국내 「확인 N곳」 라벨 owner(해외는 기본값을 쓴다). */
  DOMESTIC_SELLER_COUNT_LABEL,
  /** 🔴 CORE-2U-A §1·§4 — 가격 바로 아래의 「동일상품 확정 없음」 한 줄. */
  DOMESTIC_REFERENCE_BASIS,
  type OverseasPriceSummary,
} from "./overseas-reference";
import {
  /** 🔴 CORE-2S §5-②③⑤ — 「🔎 동일상품 확인」·「가격 판단 기준」·「현재 판단」의 문구 owner. */
  NEXT_STEP_HEADING,
  PRICE_BASIS_HEADING,
  SAME_CHECK_HEADING,
  nextStepLines,
  /** 🟢 CORE-2AO-R2 — 1차에서 내려온 비용 축 줄들(상세에서 선다). */
  costHoldLines,
  PRICE_DETAIL_FOLD_LABEL,
  priceBasisLines,
  type MarketReferencePrices,
  MI_SAME_AREA_SCOPE,
  MI_SAME_DOMESTIC_HEADING,
  MI_SAME_EMPTY,
  MI_SAME_EXCLUSION_TEXT,
  MI_SAME_OVERSEAS_HEADING,
  MI_DETAIL_FOLD_LABEL,
  /** 🔴 CORE-2V §8 — 결론과 근거 수치를 가르는 접힘의 이름. */
  MARKET_EVIDENCE_FOLD_LABEL,
  MARKET_JUDGEMENT_NOTE,
  MARKET_JUDGEMENT_TITLE,
  MARKET_LABEL,
  /** 🔴 WU-140 — 시장 블록이 «먼저» 서고, 그 시장이 빈 «이유» 를 말한다(CPO 확정 순서). */
  MARKET_RESULT_HEADING,
  countMarketCandidates,
  countUnresolvedMarketCandidates,
  /** 🔴 CORE-2U-A §3 — 「가격이 실제로 섰는가」의 술어. 뷰와 **같은 조건** 을 쓴다. */
  hasReferencePrice,
  marketEmptyNote,
  marketUnresolvedNote,
  MARKET_TABLE_HEADERS,
  MARKET_VERDICT_TEXT,
  ON_SALE_SPLIT_PREFIX,
  /** 🔴 WU-139 — 가격 미확인 후보를 버리지 않고 링크로 주고, 1~2건으로 기준가를 안내한다. */
  PRICE_GUIDE_EMPTY,
  PRICE_GUIDE_RANGE_NOTE,
  PRICE_GUIDE_SINGLE_NOTE,
  PRICE_GUIDE_TITLE,
  PRICE_LINK_TEXT,
  buildPriceGuide,
  priceGuideCountNote,
  /**
   * 🔵 CORE-UX-SELLER-02 — **1차의 「동일상품 확인 N곳」 어휘 owner.** 🔴 새로 만들지
   *    않는다(이 상수가 이미 `priceGuideCountNote` · `marketEmptyNote` 와 **같은 말** 을 쓴다).
   */
  SAME_CONFIRMED_COUNT_LABEL,
  marketPriceHeadline,
  marketPriceHeadlineLabel,
  SALE_STATE_TEXT,
  buildMarketJudgement,
  onSaleCountNote,
  pendingNote,
  /** 🔴 WU-145 ① — 사유 분포는 **2차** 가 말한다(1차에서 «이동» · 삭제 아님). */
  pendingReasonNote,
  priceRangeScope,
  priceRangeText,
  selectMiSameCandidates,
  /**
   * 🔵🔵 CORE-E2E-CLOSE-03 — **표시 전용** 선택기.
   * 🔴 `selectMiSameCandidates`(가격 집계 선별기)와 **다른 함수** 다 — 그쪽은 한 글자도 안 바꿨다.
   */
  selectPresumedCandidates,
  MI_PRESUMED_HEADING,
  MI_PRESUMED_SCOPE,
  /** 🔴 WU-146 ② — **상태별 결론.** 한 문장 안내문이 아니다(가격 0 / SAME 0 / 국내 0 을 가른다). */
  marketDecisionLines,
  countPendingCandidates,
  type MarketJudgement,
  type MiSameSelection,
} from "./mi-same-candidates";
import { priceText, stockText, type GeminiTransientRow } from "./GeminiTransientCandidates";
import {
  /**
   * 🔵 CORE-NEXT STEP 4 — **A(권장 판매가격)의 말 owner.** 🔴 이 영역은 A 를
   *    **계산하지 않는다** — 문구조차 자기가 들지 않는다(그 파일 머리가 이유를 든다).
   */
  marketPriceBasisLine,
  APPLY_RECOMMENDED_PRICE_LABEL,
  PRICE_CALCULATION_LINK_TEXT,
  RECOMMENDED_PRICE_LABEL,
  SELL_VERDICT_HEADING,
} from "./recommended-price-copy";
/** 🟢 `PriceEditor` 가 쓰는 **그 포맷터** 다 — 두 화면이 같은 숫자를 다르게 적지 않는다. */
import { formatKrw } from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-132 ①②③ — **화면에 «하나뿐인» 동일상품 가격 비교 영역**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 영역이 생긴 이유는 「영역을 하나 더 만들기」가 아니다.**
 *
 * WU-132 전수검토가 찾은 구조적 사실:
 * ```
 * 「📊 시장 가격 비교」의 두 패널(DomesticShopSearch · ComparisonShopSearch)은
 * **클라이언트가 자기 검색을 돌려** `mayShowCandidate` 로 거른다 ⟹ `/check` 가 낸
 * **MI verdict 를 한 번도 보지 않는다.** 그래서 「MI 가 SAME 이라 판정한 후보」가
 * 가격 비교에 **구조적으로 닿지 못했다** — 그것이 이번에 고친 것이다.
 * ```
 * 🟢 그래서 이 컴포넌트는 그 접힘 **안쪽 맨 위** 에 서서 MI 산출을 공급하고,
 *    아래 두 패널은 그대로 **원자료 드릴다운** 으로 남는다(그 둘의 제목이 이미
 *    「… 의 원자료」라고 말한다 — 가격비교 영역이 둘이 되는 것이 아니다).
 *
 * ── 🔴 WU-130 ④ 영역을 «대체» 한다 (복제가 아니다) ─────────────────────────
 * ```
 * MI 패널 안의 `unified-price-comparison` 은 **제거됐고**, 그 안에 있던 두 참고가격
 * 블록(🇰🇷 국내 참고가격 · 🧾 해외 동일상품 참고가격)이 **이 영역으로 옮겨 왔다.**
 * 🔴 집계 계산은 한 글자도 바뀌지 않았다 — 같은 `OverseasReferencePrice` 에 같은
 *    `OverseasPriceSummary` 를 넘긴다(환산 0 · 통화별 · 합계 칸 없음).
 * ```
 *
 * ── 🔴 이 컴포넌트가 «하지 않는» 것 ────────────────────────────────────────
 * ```
 * ❌ 판정 — verdict/tier/threshold 를 만들지 않는다(`selectMiSameCandidates` 가 읽기만)
 * ❌ 집계 — 금액을 더하거나 최저가를 고르지 않는다(MI 가 낸 summary 를 그린다)
 * ❌ 환산 — 통화 그대로. 기호로 바꾸지도 않는다
 * ❌ 저장 — DB 를 모른다. 사람 판단 버튼도 여기 없다(④ 는 검토 구역의 몫)
 * ```
 */

export interface MarketPriceComparisonProps {
  /**
   * 🔴 `/check` 가 낸 **네 출처의 후보를 합친 배열.** 🟢 합치는 곳이 한 곳이어야
   *    같은 후보가 두 번 세어지지 않는다(출처 배지는 행이 계속 말한다).
   * 🔴 `null` = 조회가 아직 돌지 않았다. `[]` = 돌았는데 후보가 0 — **다른 사실** 이다.
   */
  rows?: readonly GeminiTransientRow[] | null;
  /** 🔴 MI 가 이미 낸 국내 참고가격 집계. 여기서 계산하지 않는다. */
  domesticReference?: OverseasPriceSummary | null;
  /** 🔴 MI 가 이미 낸 해외 참고가격 집계. 여기서 계산하지 않는다. */
  overseasReference?: OverseasPriceSummary | null;
  /**
   * 🔴🔴 CORE-2S §5-⑤ — **셀러가 입력한 매입 원가.** 🔴 이 영역은 그 값으로
   *    **아무것도 계산하지 않는다**(추천가 0 · 마진 0 · 예상수익 0) — 「비어 있다」는
   *    사실 하나를 말하기 위해서만 읽는다. 🟢 값 자체는 `PriceHistoryResponse.
   *    currentPrice.costPriceKrw` 로 **이미 응답에 있다**(새 API 0 · 새 계산 0).
   */
  costPriceKrw?: number | null;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 CORE-NEXT STEP 4 — **A 권장 판매가격**(CPO 확정 2026-10-26)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **이 영역이 만들지 않는다.** `CommerceWorkspace` 가 `resolveListingPrice()`
   *    하나로 낸 값(`recommendedPriceKrw`)을 그대로 받는다 — 즉 **`PriceEditor` 의
   *    「권장 판매가격」과 정의상 같은 숫자** 다(두 화면이 갈릴 경로가 없다).
   * 🔴 `null` = 원본가/배송비를 몰라 **계산 자체가 성립하지 않는 상태** 다 ⟹
   *    그때는 **줄을 만들지 않는다**(「₩0」 같은 거짓 숫자 금지 · P0-D 선례).
   */
  recommendedPriceKrw?: number | null;
  /**
   * 🔴 **B 시장가격** — `computePriceRecommendation()` 이 낸 값(국내 EXACT 최저가 기반).
   * 🔴🔴 **A 와 합치지 않는다 · 「권장 판매가격」으로 승격하지 않는다** —
   *    이 둘은 **근거 한 줄**(상세)로만 쓰인다(CPO FAIL 조건).
   */
  marketPriceKrw?: number | null;
  /** 🔴 B 를 따랐을 때의 예상 마진율. 🟢 **서버가 이미 낸 값** 이다(여기서 계산 0). */
  marketPriceMarginPercent?: number | null;
  /**
   * 🟢 「ⓘ 가격 계산 기준 보기」 — **화면 이동 하나뿐** 이다(계산·조회 0).
   * 🔴 `PriceEditor` 의 「가격 계산 기준 보기 →」와 **같은 핸들러** 를 받는다
   *    (도착지가 둘이 되면 셀러가 두 설명을 비교한다).
   */
  onOpenPriceCalculation?: () => void;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 CORE-UX-SELLER-01 ① — **판매판단. 🔴 이 영역이 «판정하지 않는다».**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **owner 는 하나다** — `resolveSellVerdict()`(CommerceWorkspace:727) → `sellVerdict`
   *    → **`FINAL_VERDICT_COPY`**(DomesticPriceIntelligencePanel:873). 이 prop 은 그 맵에서
   *    이미 고른 **문구 객체를 그대로** 받는다. ⟹ 오른쪽 Action Center(CW:4418)가 받는 것과
   *    **글자 그대로 같은 식** 이다(`sellVerdict ? FINAL_VERDICT_COPY[sellVerdict] : null`).
   * 🔴 그래서 **왼쪽/오른쪽이 갈릴 경로가 구조적으로 없다** — 「결론은 하나, 표현 위치는 둘」
   *    (CPO 확정 2026-10-26). 🔴 여기서 verdict 를 **계산하거나 문구를 새로 만들면** 그
   *    불변식이 깨진다(계약 UX-02 와 변이 M1 이 그것을 문다).
   * 🔴 `null` = 아직 판정이 없다 ⟹ **줄을 만들지 않는다**(「판단 보류」를 지어내지 않는다).
   */
  sellVerdictCopy?: { icon: string; title: string; tone: "GOOD" | "CAUTION" | "STOP" } | null;
  /**
   * 🔵🔵🔵 CORE-UX-SELLER-01 ② — **A 를 실제 판매가격으로 확정하는 CTA.**
   *
   * 🔴 **이 영역은 가격을 만들지 않는다** — `CommerceWorkspace` 가
   *    `() => updateSalePriceKrw(recommendedPriceKrw)` 로 **이미 묶어서** 넘긴다.
   *    즉 `PriceEditor` 의 「최종 판매가격에 적용」(:158)과 **같은 handler** 다.
   * 🔴 없으면 **버튼을 그리지 않는다**(갈 곳 없는 버튼 금지 · ⓘ 와 같은 규약).
   */
  onApplyRecommendedPrice?: () => void;
}

export function MarketPriceComparison({
  rows,
  domesticReference,
  overseasReference,
  costPriceKrw,
  recommendedPriceKrw,
  marketPriceKrw,
  marketPriceMarginPercent,
  onOpenPriceCalculation,
  sellVerdictCopy,
  onApplyRecommendedPrice,
}: MarketPriceComparisonProps): JSX.Element | null {
  const domestic = selectMiSameCandidates(rows, "KR");
  const overseas = selectMiSameCandidates(rows, "OVERSEAS");
  /**
   * 🔵🔵🔵 CORE-E2E-CLOSE-03 — **동일 «가능성» 후보.**
   * 🔴 위 두 줄(가격 집계 선별기)과 **다른 함수** 다 — 그 정책은 변경 0(CPO §3).
   */
  const domesticPresumed = selectPresumedCandidates(rows, "KR");
  const overseasPresumed = selectPresumedCandidates(rows, "OVERSEAS");
  /**
   * 🔴🔴 WU-136 — **판매여부를 가격보다 먼저 계산한다**(CPO §B). 시장별로 나누기 «전» 에
   *    센다 — 셀러의 1순위 질문(「팔리고 있는가」)은 국내/해외로 갈리지 않는다.
   */
  const judgement = buildMarketJudgement(rows);
  /**
   * 🔴🔴 WU-146 ② — **셀러가 읽는 «결론» 하나.** 🔴 상태(SAME 0 / 가격 0 / 국내 0)에 따라
   *    **다른 문장** 이 나온다 — 같은 말을 돌려쓰면 그것은 결론이 아니라 안내문이다.
   * 🟢 집계·판정 **0** — `judgement` 와 `buildPriceGuide` 가 이미 낸 수치를 읽는다.
   */
  /**
   * 🔴🔴🔴 CORE-2S §5-② — **결론이 참고가격을 «보게» 한다.**
   *
   * 🔴 전까지 `marketDecisionLines(judgement)` 는 **SAME 축만** 봤다 ⟹ SAME 0 이면
   *    🇰🇷 블록에 `KRW 88,000` 이 떠 있는데도 결론이 「없습니다」로 끝났다(CEO 화면의 모순).
   * 🟢 집계는 **한 글자도 새로 만들지 않는다** — 이 영역이 이미 prop 으로 받고 있는
   *    두 집계를 그대로 묶어 넘긴다(금액 출력은 그 함수가 하지 않는다 · 계약으로 잠근다).
   */
  const references: MarketReferencePrices = { domestic: domesticReference, overseas: overseasReference };
  const decision = marketDecisionLines(judgement, references);
  /**
   * 🔴🔴 CORE-2S §5-③ — **「그 가격이 왜 그 가격인가」.** 🔴 금액 0 · 내부 토큰 0 ·
   *    전부 **조건부** 다(상태와 무관한 안내문은 WU-146 이 지운 모양이다).
   */
  const basis = priceBasisLines(judgement, references);
  /**
   * 🔴🔴 CORE-2S §5-⑤ — **「원가가 비었다」와 「데이터가 없다」를 가른다**(UNKNOWN ≠ 실패).
   * 🔴 가격이 있을 때만 말한다 — 가격도 없는데 원가를 요구하면 순서가 틀린다.
   */
  /** 🔴 CORE-2AO-R2 — 1차는 **한 줄**, 비용 축은 **상세** 로 갈렸다(문장 삭제 0). */
  const nextSteps = nextStepLines(basis.length > 0);
  const costHolds = costHoldLines(basis.length > 0, costPriceKrw);
  /**
   * 🔵 CORE-NEXT STEP 4 — **B 근거 한 줄**(상세에서만 선다).
   * 🔴 금액 **0** · 계산 **0** — 서버가 낸 마진율과 A 와의 대소 비교뿐이다.
   */
  const marketBasis = marketPriceBasisLine({
    marketPriceKrw,
    marketPriceMarginPercent,
    recommendedPriceKrw,
  });
  /**
   * 🔴 WU-133 — **시장과 무관하게** 센다. 「국내/해외로 갈려서 안 보인다」가 아니라
   *    「판정이 보류돼서 안 보인다」가 사실이고, 그 사실은 시장별로 나누면 흐려진다.
   */
  const pendingSummary = countPendingCandidates(rows);
  const pending = pendingNote(pendingSummary);
  /**
   * 🔴🔴 WU-145 ① — **1차에서 내려온 사유 분포가 여기서 산다**(삭제가 아니라 이동).
   *
   * 🔴 **왜 `▸ 판단 근거`(패널) 가 아니라 `▸ MI 상세 분석`(이 영역) 인가** — CPO 지시의
   *    말은 「2차 근거로 격리」이고, 그 두 접힘은 **둘 다 2차** 다. 그런데 사유의 입력은
   *    `rows`(이 컴포넌트의 prop)이고 `▸ 판단 근거` 는 **다른 컴포넌트**
   *    (`DomesticPriceIntelligencePanel`)가 소유한다. 거기로 보내려면 **같은 집계를
   *    두 곳에서** 하거나 prop 을 새로 뚫어야 한다 ⟹ 🔴 같은 숫자의 owner 가 둘이 된다.
   * 🟢 `▸ MI 상세 분석` 은 **이 영역의 2차 접힘이고 이름 그대로 «MI 상세»** 다 —
   *    보류 축의 사유 분포가 사는 자리로 정확하다(새 prop 0 · 집계 0 · 중복 0).
   * 🔴 1차 노출 금지라는 **정책은 그대로 지켜진다** — 바뀐 것은 「어느 2차냐」뿐이다.
   */
  const pendingReasons = pendingReasonNote(pendingSummary);
  /** 🔴 WU-140 — 시장이 확정되지 않아 **두 블록 어디에도 안 들어간** 후보 수(실측 근거는 그 함수). */
  const unresolvedNote = marketUnresolvedNote(countUnresolvedMarketCandidates(rows));

  /**
   * 🔴🔴 **「조회가 돌았는가」가 렌더 조건이다**(WU-130 ② 가 세운 그 계약).
   *    「후보가 있는가」로 두면 후보 0 일 때 영역이 통째로 사라지고, 셀러는
   *    **「조회조차 안 했다」** 로 읽는다 — 그 둘은 다른 사실이다.
   */
  const checkRan = rows != null || !!domesticReference || !!overseasReference;
  if (!checkRan) return null;

  return (
    <section
      data-testid="market-price-comparison"
      className="rounded-md border border-border bg-surface/30 p-3"
    >
      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 CORE-2AO-R2 — **첫 화면 = 판단 · 상세 화면 = 근거**(CPO 2026-10-26)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO: 「셀러가 첫 화면에서 알아야 할 건 **3개뿐** — ① 국내 얼마에 팔리는가
       *    ② 해외에서 얼마에 가져올 수 있는가 ③ 그래서 얼마를 기준으로 팔면 되는가」.
       * 🟢 그래서 1차는 **세 블록** 이고 나머지는 전부 `＋ 상세정보 보기` 뒤다.
       * 🔴 **한 문장도 지우지 않았다** — 전부 **이동** 이다(계약이 그 보존을 문다).
       * 🔴 `MARKET_JUDGEMENT_NOTE`(MI 분석 문장)도 상세로 내려갔다 — CPO 제거 목록.
       */}
      <p className="text-[11px] font-medium text-text-secondary">{MARKET_JUDGEMENT_TITLE}</p>

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 CORE-UX-SELLER-01 ① — **「팔아도 되는가」가 첫 줄이다**(CPO 2026-10-26)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 **이 영역은 판정하지 않는다.** `FINAL_VERDICT_COPY` 에서 이미 고른 문구
       *    객체를 prop 으로 받아 **그리기만** 한다 ⟹ 오른쪽 Action Center(CW:4418)와
       *    **같은 식·같은 owner** 다(「결론은 하나, 표현 위치는 둘」).
       * 🔴 머리말은 `SELL_VERDICT_HEADING`(「판매 판단」)이고 **`MARKET_RESULT_HEADING`
       *    (「💡 판매 판단」)이 아니다** — 후자는 결론 «문장» 블록의 제목이고 상세에
       *    남아 있어야 한다(계약 core-2v:232 · wu-146:222 가 그것을 문다).
       * 🔴 verdict 가 없으면 **줄을 만들지 않는다**(「판단 보류」를 지어내지 않는다).
       */}
      {sellVerdictCopy && (
        <div
          data-testid="market-sell-verdict"
          className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2"
        >
          <span className="text-[11px] text-text-secondary">{SELL_VERDICT_HEADING}</span>
          <span
            data-testid="market-sell-verdict-title"
            className="text-sm font-semibold text-text-primary"
          >
            {sellVerdictCopy.icon} {sellVerdictCopy.title}
          </span>
        </div>
      )}

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 CORE-UX-SELLER-01 ② — **「얼마에 팔면 되는가」가 그 다음이다**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 **WU-140 ② 의 「시장 블록이 먼저다」를 CPO 가 다시 뒤집었다**(2026-10-26).
       * ```
       * WU-140      🇰🇷 국내 → 🌎 해외 → 판단 결과      (근거 먼저 · 요약 나중)
       * CORE-UX-01  ① 판매판단 → ② 권장가 → ③ 근거 → ④ ⓘ   ← **지금 이것이다**
       * ```
       * 🔴 이유가 바뀌었다 — WU-140 의 걱정은 「요약 한 줄만 읽고 판단한다」였고, 지금은
       *    **결론 다음에 근거가 바로 붙어 있다**(③ 가 접히지 않는다) ⟹ 셀러는 판단을
       *    먼저 받고 **같은 화면에서** 근거를 확인한다. 🟢 블록 **내용은 이동뿐** 이다.
       * 🔴 `market-next-step-line`(설명문 ≤ 1줄)·`₩ 1개` 계약은 **그대로** 다.
       * 🔴 ⓘ 는 이 블록에 **없다** — ③ 근거 **뒤** 로 내려갔다(④ · CPO 고정 순서).
       */}
      {(nextSteps.length > 0 || recommendedPriceKrw != null) && (
        <div data-testid="market-next-step" className="mt-3">
          <p className="text-[11px] font-medium text-text-secondary">{NEXT_STEP_HEADING}</p>
          {nextSteps.map((line) => (
            <p key={line} data-testid="market-next-step-line" className="text-[11px] text-text-tertiary">
              {line}
            </p>
          ))}
          {recommendedPriceKrw != null && (
            <>
              {/**
               * 🟢 CEO 요구(CORE-2AO-R2)와 같은 층위 — **셀러가 읽을 숫자는 크게.**
               * 🔴 「시장 평균/적정가」가 아니다 — 라벨 owner 가 그 뜻을 들고 있다.
               */}
              <div
                data-testid="market-recommended-price"
                className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2"
              >
                <span className="text-[11px] text-text-secondary">{RECOMMENDED_PRICE_LABEL}</span>
                <span
                  data-testid="market-recommended-price-amount"
                  className="text-lg font-semibold tabular-nums text-text-primary"
                >
                  {formatKrw(recommendedPriceKrw)}
                </span>
              </div>
              {/**
               * 🔵🔵 CORE-UX-SELLER-01 ② — **「그 가격으로 하겠다」를 그 자리에서 끝낸다.**
               *
               * 🔴 **새 가격을 만들지 않는다** — `CommerceWorkspace` 가 묶어 넘긴
               *    `() => updateSalePriceKrw(recommendedPriceKrw)` 하나를 부른다 ⟹
               *    `PriceEditor` 의 「최종 판매가격에 적용」(:158)과 **같은 handler** 다.
               * 🔴 **금액을 문구에 담지 않는다**(1차 `₩ 1개` 계약) · 핸들러가 없으면
               *    **버튼을 그리지 않는다**(갈 곳 없는 버튼 금지).
               */}
              {onApplyRecommendedPrice && (
                <button
                  type="button"
                  data-testid="market-apply-recommended-price"
                  onClick={onApplyRecommendedPrice}
                  className="mt-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-surface"
                >
                  {APPLY_RECOMMENDED_PRICE_LABEL}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 ③ 가격 판단 근거 — **🇰🇷 국내 · 🌎 해외**(WU-140 ② 의 그 블록)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CORE-UX-SELLER-01 에서 **순서만** 바뀌었다(① ② 뒤로). 블록 **안쪽은 불변** 이다.
       *
       * 🔴🔴 **성공 기준이 「위로 올라갔다」가 아니다**(CPO): 「페이지를 열었을 때 셀러가
       *    **후보 목록을 읽지 않아도** 🇰🇷/🌎 의 동일상품 수 · 판매중 수 · 확인 가격 ·
       *    가격 확인 필요 여부를 **먼저** 이해할 수 있는가」.
       * 🟢 그래서 블록 **안쪽** 은 한 글자도 새로 계산하지 않는다 — `buildPriceGuide` 가
       *    이미 내는 시장별 수치를 그 자리로 **옮긴** 것이다(집계 0 · 판정 0 · 환산 0).
       *
       * 🔴🔴 **성공 기준이 「위로 올라갔다」가 아니다**(CPO): 「페이지를 열었을 때 셀러가
       *    **후보 목록을 읽지 않아도** 🇰🇷/🌎 의 동일상품 수 · 판매중 수 · 확인 가격 ·
       *    가격 확인 필요 여부를 **먼저** 이해할 수 있는가」.
       * 🟢 그래서 블록 **안쪽** 은 한 글자도 새로 계산하지 않는다 — `buildPriceGuide` 가
       *    이미 내는 시장별 수치를 그 자리로 **옮긴** 것이다(집계 0 · 판정 0 · 환산 0).
       */}
      <div data-testid="market-blocks" className="mt-2 grid gap-2 md:grid-cols-2">
        {(["KR", "OVERSEAS"] as const).map((mk) => (
          <MarketBlock
            key={mk}
            market={mk}
            judgement={judgement}
            rows={rows}
            /**
             * 🔴🔴 CORE-2R-5 — **가격 evidence 의 «소비 위치» 를 1차로 올린다.**
             *    이 집계(`candidateDomesticPrice` · `candidateOverseasPrice`)는
             *    `EXACT | COMPARISON` 를 담는 **기존 정책 그대로** 이고, 지금까지
             *    **`▸ MI 상세 분석` 접힘 안** 에만 그려져 셀러가 볼 수 없었다.
             * 🔴 **승격이 아니다** — `PRESUMED_SAME → SAME` 을 하지 않았고 SAME 게이트도
             *    threshold 도 한 글자 안 바꿨다. 바뀐 것은 **이미 만든 숫자를 어디서 보여
             *    주는가** 뿐이다.
             *
             * ── 🔴🔴🔴 CORE-2S §5-④ — **해외도 «같은 정보 구조» 로 올렸다** ────────────
             * ```
             * 🔴 CORE-2R-5 는 **국내만** 1차로 올렸다 ⟹ 🇰🇷 는 가격이 첫 화면에 있고
             *    🌎 는 **접힘을 열어야** 보였다. 그 비대칭이 CPO §5-④ 가 지목한 것이다
             *    (「🌎 해외 블록을 🇰🇷 와 **같은 정보 구조** 로」).
             * 🟢 **복제가 아니라 이동** 이다 — 아래 2차의 해외 칸은 `reference={null}` 로
             *    껐다(국내가 CORE-2R-5 에서 그렇게 됐던 것과 **같은 처리**) ⟹ 같은
             *    금액이 화면에 두 번 뜨지 않는다(「가격 숫자 중복 금지」 유지).
             * 🔴 집계·환산·통화 처리는 **한 글자도** 바뀌지 않았다 — 같은
             *    `OverseasReferencePrice` 에 같은 `OverseasPriceSummary` 를 넘긴다.
             * ```
             */
            reference={mk === "KR" ? domesticReference : overseasReference}
            variant="SUMMARY"
          />
        ))}
      </div>

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 CORE-UX-SELLER-01 ④ — **「왜 그 가격인가」로 가는 통로**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO 고정 순서의 **마지막** 이다 — ① 판매판단 → ② 권장가 → ③ 근거 → **④ 기준**.
       *    🔴 ③ «뒤» 에 두는 것이 설계다: 셀러는 근거를 본 뒤에 「그 숫자가 어떻게
       *       나왔나」를 묻는다. ② 에 붙여 두면 근거를 읽기 **전** 에 계산식으로 빠진다.
       * 🔴🔴 **이 버튼은 A 전용** 이다 — B(🇰🇷 국내 참고가격)를 설명하지 않는다
       *    (`PRICE_CALCULATION_LINK_TEXT` 가 그 뜻을 들고 있고 계약 UX-05 가 문다).
       * 🔴 A 가 없거나 도착지(핸들러)가 없으면 **그리지 않는다** — 갈 곳 없는 버튼이
       *    바로 CORE-NEXT STEP 4 가 고친 그 결함이다(앵커가 HIDDEN 패널에 갇혀 있었다).
       * 🟢 조건은 **이동 전과 같다** — 전에는 `market-next-step` 안에서
       *    `recommendedPriceKrw != null` 가지 아래 `onOpenPriceCalculation &&` 였다.
       */}
      {recommendedPriceKrw != null && onOpenPriceCalculation && (
        <button
          type="button"
          data-testid="market-price-calculation-link"
          onClick={onOpenPriceCalculation}
          className="mt-2 text-[11px] font-medium text-primary hover:underline"
        >
          {PRICE_CALCULATION_LINK_TEXT}
        </button>
      )}

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 CORE-2AO-R2 — **＋ 상세정보 보기 — 「근거」가 전부 여기 산다**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 `open` 을 **붙이지 않는다**(붙이면 1차로 되돌아온다 · 2026-09-19 기전).
       * 🟢 React 는 닫힌 `details` 의 자식도 렌더하므로 **기존 마운트 DOM 계약이
       *    전부 유지** 된다 — 사라진 것은 **첫 화면 노출** 뿐이고 데이터는 그대로다.
       */}
      <details data-testid="price-detail-fold" className="mt-3">
        <summary className="cursor-pointer text-[11px] font-medium text-text-secondary">
          ＋ {PRICE_DETAIL_FOLD_LABEL}
        </summary>

        {/** 🔴 MI 분석 문장 — 1차에서 내려왔다(CPO 제거 목록). 삭제 0. */}
        <p className="mt-1 text-[11px] text-text-tertiary">{MARKET_JUDGEMENT_NOTE}</p>

        {/**
         * 🔴 시장별 **근거** 블록 — 금액은 **그리지 않는다**(1차가 유일한 금액 owner).
         *    판정 상태 · 출처 문구 · 저장 범위 · 「동일상품 확인 N곳」이 여기 산다.
         */}
        <div data-testid="market-detail-blocks" className="mt-2 grid gap-2 md:grid-cols-2">
          {(["KR", "OVERSEAS"] as const).map((mk) => (
            <MarketBlock
              key={mk}
              market={mk}
              judgement={judgement}
              rows={rows}
              reference={mk === "KR" ? domesticReference : overseasReference}
              variant="DETAIL"
            />
          ))}
        </div>

        {/**
         * 🔵🔵 CORE-NEXT STEP 4 ④ — **B(시장가격) 근거 한 줄.**
         *
         * 🔴 **1차에 두지 않는다** — 1차의 답은 A 하나다(둘을 나란히 두면 셀러가
         *    「어느 쪽에 팔아야 하나」를 다시 고른다 = CPO FAIL 조건).
         * 🔴 **금액을 적지 않는다**(금액 owner 는 시장 블록) · **계산 0**.
         */}
        {marketBasis && (
          <p data-testid="market-price-basis-line" className="mt-2 text-[11px] text-text-tertiary">
            {marketBasis}
          </p>
        )}

        {/** 🔴 비용 축 — 1차의 한 줄에서 내려온 나머지(글자 불변 · 계산 0). */}
        {costHolds.length > 0 && (
          <div data-testid="market-cost-hold" className="mt-3">
            {costHolds.map((line) => (
              <p key={line} data-testid="market-cost-hold-line" className="text-[11px] text-text-tertiary">
                {line}
              </p>
            ))}
          </div>
        )}
      {/**
       * 🔴 아래는 **원본 JSX 를 그대로 둔 것** 이다 — 조건·순서·`data-testid` 가
       *    한 글자도 바뀌지 않았다(그래야 기존 마운트 DOM 계약이 그대로 산다).
       *    바뀐 것은 **이 `<details>` 안에 들어왔다** 는 사실 하나다.
       */}
      {/**
       * 🔴🔴 **두 블록 어디에도 안 들어간 후보를 조용히 없애지 않는다.**
       *    실측(B226AC010 · `beaumonde.co.kr`): 사람이 SAME 이라 한 `.kr` 후보가
       *    **가격이 없어서** 시장 축 `UNKNOWN` 으로 남는다 ⟹ 그 상태로 두면 🇰🇷 블록이
       *    「후보를 찾지 못했습니다」라고 **거짓** 을 말한다.
       * 🔴 시장을 **지어내지 않는다**(UNKNOWN → KR 승격 금지 · WU-020 §4 유지).
       */}
      {unresolvedNote && (
        <p data-testid="market-unresolved" className="mt-1 text-[11px] text-text-tertiary">
          {unresolvedNote}
        </p>
      )}

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 CORE-2S §5-③ — **「💡 가격 판단 기준」이 여기 선다**(CPO 고정 순서 ④)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO 가 고정한 정보 우선순위는
       *    **① 조사했다 → ② 🇰🇷 → ③ 🌎 → ④ 가격 판단 «기준» → ⑤ 판매 판단 → ⑥ 입력할 것**
       *    이다 ⟹ 숫자(②③) **뒤**, 결론(⑤) **앞** 이 이 영역의 자리다.
       * 🟢 wu-140 의 순서 계약은 그대로 지켜진다 — `market-blocks` 는 여전히 맨 앞이고
       *    `market-judgement` 와 `mi-detail-fold` 는 여전히 그 뒤다.
       * 🔴 **금액을 적지 않는다** — 금액 owner 는 위 두 블록 하나다(계약이 「KRW 88,000 은
       *    화면에 1회」를 문다). 🔴 내부 토큰·tier·blocker 어휘 **0**.
       * 🔴 조건이 없으면 **영역 자체가 서지 않는다**(빈 틀을 만들지 않는다).
       */}
      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴 CORE-2AO-R1 — **이 영역이 «접혔다»**(CEO 피드백 ③ · 삭제 0)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CEO: 「`가격 판단 기준`과 `판매 판단`이 **길게 분리** 되어 결론이 한 번에
       *    꽂히지 않는다 — **근거 설명은 접거나 짧게** 두는 편이 맞다」.
       * 🟢 둘 중 **접는 쪽** 을 골랐다 — 이 영역은 **근거 설명** 이고(결론은 아래
       *    `market-judgement` 다) 문장을 지우면 「왜 이 가격을 기준으로 쓰는가」가
       *    사라진다. 🔴 **한 줄도 지우지 않았다** — `buildPriceBasis` 는 그대로다.
       * 🔴 `open` 을 **붙이지 않는다**(붙이면 1차로 되돌아온다 · 2026-09-19 기전).
       * 🟢 `data-testid` 와 `price-basis-line` 은 **그대로** 다 — React 는 닫힌
       *    `details` 의 자식도 렌더하므로 마운트 DOM 계약이 전부 유지된다.
       */}
      {basis.length > 0 && (
        <details data-testid="price-basis" className="mt-3">
          <summary className="cursor-pointer text-[11px] font-medium text-text-secondary">
            ▸ {PRICE_BASIS_HEADING}
          </summary>
          <ul className="mt-0.5 space-y-0.5">
            {basis.map((line) => (
              <li key={line} data-testid="price-basis-line" className="text-[11px] text-text-tertiary">
                {line}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/**
       * 🔴🔴 WU-136 §A — **「팔아도 되는가」 한 줄.** 🔴 WU-140 에서 이 구간이 시장 블록
       *    «뒤» 로 내려왔다(CPO 확정). 🟢 **testid 는 전부 그대로** 다 —
       *    `market-verdict` · `market-sale-counts` · `market-split` ·
       *    `market-price-range` · `market-seller-table` 을 계약이 보고 있고,
       *    이름을 바꾸면 그 계약들이 **조용히** 통과해 버린다.
       * 🔴 네 결론을 **다른 문장** 으로 적는다 — 「없다」로 뭉치면 셀러가 할 행동이
       *    달라지는데 화면이 같은 말을 한다(§G).
       */}
      <div data-testid="market-judgement" className="mt-3 space-y-1">
        <p className="text-[11px] font-medium text-text-secondary">{MARKET_RESULT_HEADING}</p>
        {/**
         * ══════════════════════════════════════════════════════════════════════
         * 🔴🔴🔴 WU-146 ② — **결론이 «머리 바로 뒤» 다** (CPO STEP 2)
         * ══════════════════════════════════════════════════════════════════════
         *
         * 🔴 CPO: 「`💡 판매 판단` ↓ **셀러가 바로 이해할 수 있는 결론**」.
         * 🔴🔴 그래서 `verdict`(네 상태 라벨) **앞** 이다. `verdict` 는 **분류어**
         *    (「판매중인 동일상품이 있습니다」류)이고 셀러가 원하는 답은 **「그래서
         *    얼마냐」** 다. 요약을 먼저 읽히게 두면 그 한 줄만 보고 판단한다(WU-140 교훈).
         * 🔴 **결론 owner 는 하나다**(STEP 7-2) — `marketDecisionLines` 뿐이고, 아래 줄들은
         *    전부 그 결론의 **근거 수치** 다(새 결론을 또 만들지 않는다).
         * 🔴 가격 숫자를 **여기서 집계하지 않는다** — `judgement.byCurrency` 를 읽는다
         *    (`market-price-range` 와 **같은 값** 이라 두 자리가 어긋날 수 없다 · STEP 7-1).
         */}
        <ul data-testid="seller-decision" className="space-y-0.5">
          {decision.lines.map((line) => (
            <li
              key={line}
              data-testid="seller-decision-line"
              className="text-[12px] font-medium text-text-primary"
            >
              {line}
            </li>
          ))}
        </ul>
        {/**
         * ══════════════════════════════════════════════════════════════════════
         * 🔴🔴🔴 CORE-2S §5-⑧ — **`market-verdict` 가 여기서 2차로 내려갔다**(삭제 아님)
         * ══════════════════════════════════════════════════════════════════════
         *
         * 🔴 그 줄은 **바로 위 결론과 같은 말** 이었다. 실측 비교(SAME 0 상태):
         * ```
         * seller-decision  「아직 동일상품으로 확정된 판매처가 없습니다.」
         * market-verdict   「동일상품으로 판정된 판매처가 아직 없습니다.」   ← 같은 사실
         * market-block ×2  「동일상품 확인 0곳 — …」                        ← 또 같은 사실
         * ```
         * ⟹ 🔴 셀러가 첫 화면에서 **「0」을 네 번** 읽는다. 그러면 바로 옆의
         *    `KRW 88,000` 이 「그래도 없는 것」으로 읽힌다 — 그것이 §2 가 고치라는 모순이다.
         * 🟢 그래서 **분류 라벨(verdict)을 2차로 내렸다** — WU-145 가 「건수는 1차 ·
         *    사유 어휘는 2차」로 가른 그 선례와 **같은 모양** 이다.
         * 🔴 **지우지 않았다** — 같은 `data-testid` 로 `▸ MI 상세 분석` 안에 그대로 선다
         *    (계약 `wu-132`·`wu-136-render` 가 그 값을 보고 있고, 지우면 네 상태
         *    (NO_SAME/SAME_BUT_NONE_ON_SALE/ON_SALE_NO_PRICE/ON_SALE)의 구분이 사라진다).
         * 🔴 **결론 owner 는 하나** 라는 `wu-146` STEP 7-2 계약이 이것으로 더 강해진다.
         */}
        {judgement.sellers.length > 0 && (
          /**
           * ══════════════════════════════════════════════════════════════════
           * 🔴🔴🔴 CORE-2V §2·§3·§8 — **근거 수치가 «접힘» 으로 내려갔다**(삭제 0)
           * ══════════════════════════════════════════════════════════════════
           *
           * 🔴 CEO 캡처 실측 — 이 네 줄(`market-sale-counts` · `market-split` ·
           *    `market-price-range` · `market-seller-table`)이 **1차에 펼쳐져 있었다**.
           *    그래서 ⒜ 🌎 블록의 「최저 확인가 GBP 37 · USD 58」이 **아래에서 또**
           *    「GBP 37 (3곳 …)」로 반복됐고(§2 가격 숫자 중복) ⒝ 결론이 **근거 표에
           *    묻혔다**(§3·§8 — 셀러가 아래까지 내려가야 핵심을 본다).
           * 🟢 **한 글자도 지우지 않았다** — `data-testid` 넷이 그대로 있고 계약
           *    (`wu-140`·`wu-136-render`·`wu-146` Q6)이 계속 그 값을 읽는다
           *    (React 는 닫힌 `details` 의 자식도 렌더한다).
           * 🔴 **`open` 을 붙이지 않는다** — 붙이면 1차로 되돌아온다(2026-09-19 사고의 기전).
           * 🔴 JSX 를 **옮기지 않았다** — 옮기면 이 블록의 조건·순서 계약이 흔들린다.
           *    바꾼 것은 **감싼 것 하나** 다.
           */
          <details data-testid="market-evidence-fold" className="mt-1">
            <summary className="cursor-pointer text-[11px] text-text-tertiary">
              ▸ {MARKET_EVIDENCE_FOLD_LABEL}
            </summary>
            {/**
             * 🔴🔴 「판매중 N곳」은 **ON_SALE 만** 센 숫자다. 미확인·품절을 **같은 줄에**
             *    적어 그 분모를 숨기지 않는다 — 실측(호스트 9)에서 **7곳이 재고 칸을
             *    공개하지 않아** 미확인이고, 그것을 판매중에 넣으면 거짓이 된다.
             */}
            <p data-testid="market-sale-counts" className="text-[11px] text-text-secondary">
              {onSaleCountNote(judgement)}
            </p>
            {/**
             * 🔴🔴 CPO §3 — **「시장 전체 판매처」로 읽히게 두지 않는다.**
             *    수식어 없는 「🇰🇷 0곳 · 🌎 3곳」은 시장 전체 집계로 읽힌다. 🔴 그런데
             *    판매여부 신호는 현재 **Shopify 경로에서만** 확정되므로(실측 2/9) 이
             *    숫자는 **시장을 대표하지 않는다** — 「발견된 SAME 후보 중 판매중으로
             *    확인된 곳」이다. 🟢 그래서 접두사를 붙여 그 범위를 직접 말한다.
             */}
            {judgement.onSaleCount > 0 && (
              <p data-testid="market-split" className="text-[11px] text-text-secondary">
                {ON_SALE_SPLIT_PREFIX} — {MARKET_LABEL.KR} {judgement.domesticOnSale}곳 ·{" "}
                {MARKET_LABEL.OVERSEAS} {judgement.overseasOnSale}곳
              </p>
            )}
            {/* 🔴 통화별로만 · **환산 0**(기존 `overseas-reference` 계약과 같은 축). */}
            {judgement.byCurrency.length > 0 && (
              <ul data-testid="market-price-range" className="space-y-0.5">
                {judgement.byCurrency.map((r) => (
                  <li key={r.currency} className="text-[11px] text-text-secondary">
                    <span className="font-medium">{priceRangeText(r)}</span>{" "}
                    <span className="text-text-tertiary">({priceRangeScope(r)})</span>
                  </li>
                ))}
              </ul>
            )}
            {/**
             * 🔴🔴🔴 **WU-146 — WU-145 의 `market-price-judgement` 한 줄이 여기서 사라졌다.**
             *
             * 🔴 그 줄은 **상태와 무관하게 같은 말** 이었다(「확인된 동일상품 가격을 기준으로
             *    위 가격대를 … 참고할 수 있습니다」) ⟹ 결론이 아니라 **안내문** 이었고,
             *    위의 `seller-decision` 과 함께 두면 **셀러가 읽는 결론이 «둘»** 이 된다.
             * 🔴 STEP 7-2 의 계약이 그것을 금지한다 — **seller-facing final judgement = 1.**
             * 🟢 그 문장이 하던 일(가격이 있으면 그 사실을 말한다)은 `marketDecisionLines` 의
             *    `PRICED` 분기가 **더 정확하게** 한다(통화 수·국내 0·미확인까지 가른다).
             */}
            {/**
             * 🔴 WU-136 §C — **셀러가 읽는 네 칸.** 도메인·판매상태·현재가격까지
             *    한 줄에 있어야 「어디서 얼마에」가 한눈에 보인다.
             * 🔴 정렬은 **판매중 → 미확인 → 품절** 이다(술어가 그 순서를 들고 있다).
             */}
            <table data-testid="market-seller-table" className="mt-1 w-full text-[11px]">
              <thead>
                <tr className="text-text-tertiary">
                  {MARKET_TABLE_HEADERS.map((h) => (
                    <th key={h} className="py-0.5 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {judgement.sellers.map((s) => (
                  <tr key={s.row.discoveredUrl} data-testid="market-seller-row" className="align-top">
                    <td className="py-0.5 pr-2 whitespace-nowrap">{MARKET_LABEL[s.market]}</td>
                    <td className="py-0.5 pr-2">
                      <a
                        href={s.row.discoveredUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-text-secondary underline"
                      >
                        {s.row.domain}
                      </a>
                    </td>
                    <td
                      data-testid="market-seller-sale"
                      className="py-0.5 pr-2 whitespace-nowrap text-text-secondary"
                    >
                      {SALE_STATE_TEXT[s.sale]}
                    </td>
                    {/* 🔴 가격을 **지어내지 않는다** — 확인 못 했으면 그렇게 적는다. */}
                    <td
                      data-testid="market-seller-price"
                      className="py-0.5 whitespace-nowrap text-text-secondary"
                    >
                      {/**
                       * 🔴🔴 WU-139 — **가격을 못 가져온 후보를 «버리지 않는다»**(CPO 전략).
                       *    전까지는 「가격 확인 필요」라는 **글자** 였다. 🟢 이제 그 자리가
                       *    **판매처로 가는 링크** 다 — 셀러가 직접 확인할 수 있어야 그
                       *    후보가 실제 가치를 낸다. 🔴 가격을 **지어내지 않는다.**
                       */}
                      {s.price ? (
                        `${s.price.currency} ${s.price.amount}`
                      ) : (
                        <a
                          data-testid="market-seller-price-link"
                          href={s.row.discoveredUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="underline"
                        >
                          {PRICE_LINK_TEXT}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 CORE-2S §5-⑤ — **「🧾 현재 판단」**(CPO 고정 순서 ⑥ = 셀러가 입력할 것)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO: 「원가 없으면 **『수익성 판단 보류 · 원가 입력 필요』**」 ·
       *    「🔴 **「데이터 없음」처럼 보이지 않게** 한다(**UNKNOWN ≠ 실패**)」.
       * 🔴🔴 지금 화면은 시장가격을 **다 찾아 놓고도** 최종 판단이 `UNKNOWN` 으로 끝난다 —
       *    셀러에게는 「아무것도 못 했다」로 읽히는데 **비어 있는 칸은 원가 하나** 다.
       * 🔴 **계산 0** — 추천 판매가 · 마진 · 예상 수익을 만들지 않는다(§3 금지축).
       *    이 영역이 하는 일은 **「무엇이 비어 있는지」** 한 줄로 말하는 것이 전부다.
       * 🔴 입력칸을 **여기 만들지 않는다** — `wu-154 A-1`(결론 영역에 `<input>` 금지)이
       *    그것을 문다. 원가 입력의 owner 는 ③ 수익성의 비용 화면이다.
       *
       * 🔴🔴🔴 **CORE-2AO-R2 — 이 블록은 «1차» 로 올라갔다**(CPO 의 세 번째 블록).
       *    여기 두면 `market-next-step` 이 **두 번** 렌더되고 설명문 수 계약이 깨진다
       *    (실제로 깨졌고 R2-2 가 잡았다). 🟢 비용 축 줄들은 위 `market-cost-hold`
       *    에서 **상세로** 선다 — 문장 삭제 0.
       */}

      {/**
       * 🔴🔴🔴 WU-133 — **「비었다」로 끝내지 않는다.**
       *
       * 전수 추적(human SAME 13건)이 측정한 것: 판정까지 간 7건이 **전부 보류/충돌** 이고
       * 그중 **6건은 가격까지 확보** 돼 있다. 🔴 그런데 WU-132 의 화면은 「동일상품으로
       * 판정되고 가격까지 확인된 후보가 아직 없습니다」만 말했다 — **그 아래에 그 6건이
       * 서 있는데** 말이다. 셀러에게는 「아무것도 못 찾았다」로 읽히고 그것은 **거짓** 이다.
       *
       * 🟢 그래서 **이미 계산된 보류 사유를 세어** 한 줄 적는다(집계 0 · 판정 0 · 완화 0).
       * 🔴 「동일상품이다」라고 **단정하지 않는다** — 「판정이 보류됐다」가 정확한 말이고
       *    판단은 셀러가 아래 검토 구역에서 사진으로 한다.
       */}
      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 CORE-2U-A §5 — **이 줄이 2차로 내려갔다**(삭제 아님)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 CPO §5: 「**브랜드 미확인 · TEXT_CONFIRMED · PRESUMED_SAME · 후보별 내부
       *    verdict · 내부 blocker** 는 기본 화면에서 **셀러의 결론처럼 보이지 않게** 한다」.
       * 🔴 그런데 이 줄은 「가격까지 확인됐지만 **동일상품 판정이 보류·충돌된** 후보가
       *    N건 있습니다」로 **MI 내부 상태를 1차에서 말하고 있었다** — 그리고 바로 위
       *    🇰🇷 블록이 이미 「동일상품으로 확정된 국내 판매처는 없습니다」를 말하므로
       *    **같은 사실을 두 번** 적는 중복이기도 했다(§6).
       * 🟢 그래서 **`▸ MI 상세 분석` 안으로 옮겼다** — `data-testid` 와 문구 owner
       *    (`pendingNote`)는 **그대로** 이고 사유 분포(`pendingReasonNote`)가 이미 그 안에 있다.
       * 🔴 **WU-133 이 고친 거짓말은 되돌아오지 않는다** — 그때의 위험(「아무것도 못
       *    찾았다」로 읽힘)은 **가격이 1차에 없을 때** 의 것이고, 이제 금액이 1차에 선다.
       */}

      {/**
       * 🔴🔴🔴 WU-136 §E — **기술/참고 정보는 «지우지 않고» 접는다.**
       *
       * 🔴 CPO: 「정보를 삭제하는 것이 아니라 셀러의 시야에서 치우는 것」.
       *    그래서 ⒜ 두 시장의 참고가격 집계 ⒝ SAME 행 목록 ⒞ 제외 사유 목록이
       *    **한 글자도 사라지지 않았다** — 접힘 뒤로 옮겼을 뿐이다.
       * 🟢 그래서 `wu-056r1`(가격 구역 식별)과 `wu-132` 계약의 DOM 단언이 **그대로
       *    유효** 하다(React 는 `details` 가 닫혀 있어도 자식을 렌더한다).
       * 🔴 **`open` 을 붙이지 않는다** — 붙이면 셀러 시야에 다시 들어오고, 그것이
       *    2026-09-19 사고의 기전이다(WU-091 ① 과 같은 계약).
       */}
      <details data-testid="mi-detail-fold" className="mt-2">
        <summary className="cursor-pointer text-[11px] text-text-tertiary">
          ▸ {MI_DETAIL_FOLD_LABEL}
        </summary>
        {/**
         * 🔴🔴 CORE-2S §5-⑧ — **1차에서 내려온 분류 라벨.** 「지우지 않는다」의 구현부다.
         *    🟢 `data-testid` 와 문구 owner(`MARKET_VERDICT_TEXT`)는 **그대로** 이므로
         *       네 상태의 구분이 보존되고 기존 계약 둘이 계속 그 값을 읽는다.
         *    🔴 1차에서는 `seller-decision` 이 **결론 owner 하나** 다(`wu-146` STEP 7-2).
         */}
        <p data-testid="market-verdict" className="mt-1 text-[11px] text-text-secondary">
          {MARKET_VERDICT_TEXT[judgement.verdict]}
        </p>
        {/* 🔴 「유사상품은 비교에 쓰지 않는다」를 영역이 **직접** 말한다(②의 절반). */}
        <p className="mt-1 text-[11px] text-text-tertiary">{MI_SAME_AREA_SCOPE}</p>
        {/**
         * 🔴🔴🔴 WU-145 ① — **1차에서 내려온 보류 사유 분포.** 「지우지 않는다」의 구현부다.
         *
         * 🔴 CPO: 「그 문장을 `▸ 판단 근거` 안으로 **옮긴다** · **지우지 않는다**(MI
         *    추적용이다)」. ⟹ 🟢 **한 건도 줄이지 않았다** — 정렬·건수·어휘 전부 그대로다.
         * 🔴 1차에 남은 것은 **건수 한 줄**(`mi-same-pending`)이고, 축의 **이름**
         *    (브랜드 미확인 · 품번 충돌 …)은 **이 접힘 안에서만** 보인다.
         * 🔴 사유가 없으면 **줄을 만들지 않는다** — 그 함수가 `null` 을 낸다(없는 말 금지).
         */}
        {/** 🔴 CORE-2U-A §5 — 1차에서 내려온 **보류 건수** 줄(위 주석이 이유를 들고 있다). */}
        {pending && (
          <p data-testid="mi-same-pending" className="mt-1 text-[11px] text-warning">
            {pending}
          </p>
        )}
        {pendingReasons && (
          <p data-testid="mi-same-pending-reasons" className="mt-1 text-[11px] text-text-tertiary">
            {pendingReasons}
          </p>
        )}
        {/* 🔴 국내를 해외 «앞» 에 둔다 — 셀러의 질문 순서가 그렇다(WU-056 과 같은 이유). */}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
        <MarketColumn
          testId="mi-same-domestic"
          heading={MI_SAME_DOMESTIC_HEADING}
          selection={domestic}
          /**
           * 🔵 CORE-E2E-CLOSE-03 — 같은 `rows` 에서 **다른 선택기** 로 뽑는다.
           * 🔴 `selectMiSameCandidates`(가격 집계 축)는 한 글자도 안 바꿨다(CPO §3).
           */
          presumed={domesticPresumed}
          /**
           * 🔴🔴 CORE-2R-5 — **국내 집계는 여기서 «꺼진다».** 1차 🇰🇷 블록으로 **옮겼다**
           *    (복제가 아니다). 두 곳에 두면 같은 `KRW 88,000` 이 화면에 두 번 뜨고
           *    그것이 WU-145/149 가 닫은 「가격 owner 하나」 계약 위반이다.
           * 🔴 해외 집계는 **그대로** 다(아래 `MarketColumn`) — 그 축은 이번 범위가 아니다.
           */
          reference={null}
          referenceProps={{
            title: DOMESTIC_REFERENCE_TITLE,
            note: DOMESTIC_REFERENCE_NOTE,
            scope: DOMESTIC_REFERENCE_SCOPE,
            icon: "🇰🇷",
            testId: "domestic-reference",
            amountTestId: "domestic-lowest",
          }}
        />
        <MarketColumn
          testId="mi-same-overseas"
          heading={MI_SAME_OVERSEAS_HEADING}
          selection={overseas}
          /** 🔵 CORE-E2E-CLOSE-03 — 해외도 **같은 구역** 이다(두 벌을 만들지 않는다). */
          presumed={overseasPresumed}
          /**
           * 🔴🔴 CORE-2S §5-④ — **해외 집계도 여기서 «꺼진다».** 1차 🌎 블록으로
           *    **옮겼다**(복제가 아니다 — 국내가 CORE-2R-5 에서 그렇게 됐던 것과 같다).
           *    두 곳에 두면 같은 `GBP 37 · USD 58` 이 화면에 두 번 뜨고, 그것이
           *    WU-145/149 가 닫은 「가격 숫자 중복 금지」 계약 위반이다.
           * 🔴 제목·문구·🧾 아이콘·환산 금지는 **한 글자도 안 바뀌었다** — 1차에서
           *    같은 컴포넌트에 같은 기본값으로 선다(`wu-056r1` 다섯이 그대로 유효하다).
           */
          reference={null}
          /** 🔴 해외 블록의 제목·문구·🧾 아이콘은 **기본값 그대로** 다(`wu-056r1` 계약). */
          referenceProps={{}}
        />
        </div>
      </details>
      {/** 🔴 CORE-2AO-R2 — 여기까지가 `＋ 상세정보 보기` 안이다. */}
      </details>
    </section>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-140 ②③ — **한 시장의 결론 블록** (셀러가 «가장 먼저» 읽는 칸)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 가 요구한 것은 **네 상태를 셀러가 구분할 수 있는 것** 이다:
 * ```
 * ⒜ 검색 자체가 안 됨          후보 0            → 「후보를 찾지 못했습니다」
 * ⒝ SAME 판정 대기·보류         후보 N · SAME 0   → 「N곳 찾았지만 …」 (+ 사유)
 * ⒞ SAME 이지만 가격 확인 필요   → 건수 줄 + 🔗(판매처 표의 링크)
 * ⒟ 가격 확인 완료             → 기준가 + SINGLE/RANGE 문장
 * ```
 * 🔴🔴 전까지 ⒜ 와 ⒝ 가 화면에서 **같은 빈 칸** 이었다 — 셀러가 할 행동이 전혀 다른데
 *    (앞은 기다리는 것, 뒤는 **사진으로 직접 판단하는 것**) 화면이 같은 말을 했다.
 *
 * 🔴 **빈 틀을 만들지 않는다** — `sameCount === 0` 이면 가격 가이드(`price-guide-*`)를
 *    **렌더하지 않는다**(기존 계약 `wu-139 C-4`). 그 자리에 들어가는 것은 **기준가가
 *    아니라 이유** 다. 🔴 기준가를 **지어내지 않는다.**
 * 🔴 통화 **환산 0** · 추천 판매가 **계산 0**(§00-B 가격 보류).
 */
function MarketBlock({
  market,
  judgement,
  rows,
  reference,
  /**
   * 🔴 CORE-2AO-R2 — `SUMMARY`(첫 화면 · 금액) ↔ `DETAIL`(상세 · 근거).
   *    🔴 기본값을 `SUMMARY` 로 두지 않는다 — 호출부가 **의식적으로 고르게** 한다
   *       (기본값이 있으면 새 호출부가 조용히 금액을 두 번 그릴 수 있다).
   */
  variant,
}: {
  market: "KR" | "OVERSEAS";
  judgement: MarketJudgement;
  rows?: readonly GeminiTransientRow[] | null;
  variant: "SUMMARY" | "DETAIL";
  /**
   * 🔴 CORE-2S §5-④ — **두 시장이 같은 prop 을 쓴다.** 전에는 `domesticReference` 라
   *    이름이 국내에 묶여 있었고, 그래서 해외는 1차에 가격을 **올릴 자리가 없었다**.
   * 🟢 호출부가 시장별 집계를 골라 넘기므로 이 컴포넌트는 **시장을 판단하지 않는다**.
   */
  reference?: OverseasPriceSummary | null;
}): JSX.Element {
  const g = buildPriceGuide(judgement, market);
  /**
   * 🔴🔴 WU-148 — **시장별 해석.** 전까지 두 시장이 `priceGuideHeadline`(통화별 범위)
   *    **하나** 를 같이 써서 국내에도 「범위」가 나왔다. 🟢 이제 owner 가 분기를 갖는다 —
   *    🇰🇷 **시장 가격대**(1건이면 「가격대 확정 불가」) · 🌎 **최저 확인가**.
   * 🔴 호출부는 **분기하지 않는다**(그 규칙이 두 벌이 되면 한쪽만 고치는 날이 온다).
   */
  const head = marketPriceHeadline(g);
  const headLabel = marketPriceHeadlineLabel(g);
  const suffix = market === "KR" ? "domestic" : "overseas";
  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 CORE-2AO-R2 — **같은 블록을 «두 번» 그린다. 금액은 한 번만.**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO: 「첫 화면 = **판단**(국내 가격 · 해외 소싱가 · 가이드 한 줄) ·
   *    상세 화면 = **근거**」. ⟹ 이 블록의 내용이 **두 층으로 갈린다**.
   * 🟢 `SUMMARY` 는 **제목 + 금액 + 건수**, `DETAIL` 은 **그 외 전부**(금액 제외).
   * 🔴 **금액을 두 층에 넣지 않는다** — 그것이 CEO 가 FAIL 로 지목한 모양이다.
   * 🔴 문장은 **하나도 지우지 않았다** — 전부 `DETAIL` 로 «옮겼다».
   */
  const isSummary = variant === "SUMMARY";
  /**
   * 🔴 1차에서 **이 시장이 금액 블록을 실제로 그리는가.** 🟢 술어를 지어내지 않고
   *    두 분기가 쓰는 **그 조건 그대로** 를 읽는다(`buildOverseasReference` 의 조건 ·
   *    `sameCount`). 어긋나면 라벨이 중복되거나 칸이 빈다.
   */
  const hasSummaryAmount = g.sameCount === 0 ? hasReferencePrice(reference) : true;
  return (
    <div
      data-testid={isSummary ? `market-block-${suffix}` : `market-detail-${suffix}`}
      className="rounded border border-border/60 p-2"
    >
      {/**
       * 🟢 라벨 owner 는 `MARKET_LABEL` 하나다 — 두 벌로 적지 않는다.
       * 🔴🔴 CORE-2AO-R2 — **1차에서는 가격 제목이 있으면 그리지 않는다.** 그 제목이
       *    **이미 시장을 말한다**(「🇰🇷 국내 참고가격」 · 「💰 해외 최저 소싱가」) ⟹
       *    둘을 같이 두면 「🇰🇷 국내 / 🇰🇷 국내 참고가격」처럼 **시장 이름이 두 번** 뜬다
       *    (CPO 목업은 한 번이다).
       * 🔴🔴 **그러나 가격 블록이 아예 안 서는 시장에서는 «반드시» 그린다** — 안 그러면
       *    그 시장 칸이 **통째로 비어** 셀러가 「조회조차 안 됐다」로 읽는다. 그것은
       *    WU-130 ② 가 계약으로 막아 둔 바로 그 거짓말이다(배포 전 계약이 잡았다).
       */}
      {(!isSummary || !hasSummaryAmount) && (
        <p className="text-[11px] font-medium text-text-primary">{MARKET_LABEL[market]}</p>
      )}
      {g.sameCount === 0 ? (
        /**
         * 🔴 ⒜ ↔ ⒝ 를 **가른다.** 🔴 「이 시장에 동일상품이 없다」로 적지 않는다 —
         *    부재와 미발견은 다르다(WU-091 어휘 계약).
         */
        <>
          {/**
           * ══════════════════════════════════════════════════════════════════
           * 🔴🔴🔴 CORE-2R-5 — **「국내 가격을 못 찾는 단계」는 끝났다. 소비 위치를 연다.**
           * ══════════════════════════════════════════════════════════════════
           *
           * 실측(B226AC009) — 국내 후보 **2곳이 둘 다 `KRW 88,000`** 이고 `VERIFIED_CURRENT`
           * 인데, 등급이 `PRESUMED_SAME → COMPARISON` 이라 **SAME 축(`buildPriceGuide`)에
           * 들어가지 않는다** ⟹ 이 블록이 「찾지 못했습니다」만 말했다.
           *
           * 🟢 그런데 그 금액은 **이미 집계돼 있다** — `candidateDomesticPrice` 는
           *    `EXACT | COMPARISON` 을 담는 **기존 정책** 이다. 지금까지 그 집계가
           *    **`▸ MI 상세 분석` 접힘 안에만** 그려져 셀러 시야 밖이었다.
           * 🔴 그래서 **승격이 아니라 «이동»** 이다 — 아래 2차의 집계는 **끄고**
           *    (`reference={null}`) 여기 하나만 그린다 ⟹ **같은 숫자가 두 곳에 뜨지 않는다**.
           * 🔴 SAME 이 **있으면** 이 줄을 그리지 않는다 — 그때는 SAME 축이 더 강한 근거이고
           *    둘을 같이 두면 가격 숫자가 둘이 된다(CPO 「EXACT 우선 · 없을 때 COMPARISON」).
           * 🟢 컴포넌트·문구·testid 는 **WU-056 의 그것 그대로** 다(새 가격 owner 0).
           *
           * ── 🔴🔴🔴 CORE-2S §5-② — **가격이 「0곳」보다 «먼저» 온다** ─────────────────
           * ```
           * 🔴 CORE-2R-5 는 이 줄을 「동일상품 확인 0곳 — …」 **뒤** 에 뒀다. 그래서
           *    CEO 화면에서 셀러가 가장 먼저 읽는 글자가 **「0곳」** 이고, 그 아래의
           *    `KRW 88,000` 은 「그래도 없는 것」으로 읽혔다. **그것이 그 모순이다.**
           * 🟢 두 줄의 **순서를 뒤집었다** — 위는 돈(🇰🇷/🧾), 아래는 판정(🔎).
           * 🔴 그리고 아래 줄에 **축의 이름**(`SAME_CHECK_HEADING`)을 붙였다 — 수식어
           *    없이 나란히 두면 두 축이 **한 축으로** 읽힌다(「1곳 ↔ 0곳」이 모순으로 보인다).
           * 🔴 숫자·집계·판정은 **한 글자도** 바뀌지 않았다. 바뀐 것은 **순서와 라벨** 뿐이다.
           * ```
           */}
          <OverseasReferencePrice
            summary={reference}
            compact={isSummary}
            evidenceOnly={!isSummary}
            {...(market === "KR"
              ? {
                  title: DOMESTIC_REFERENCE_TITLE,
                  /**
                   * ══════════════════════════════════════════════════════════
                   * 🔴🔴🔴 CANDIDATE-SYNC-01 §6·§7 — **의미 충돌 문장 셋을 걷어낸다**
                   * ══════════════════════════════════════════════════════════
                   *
                   * CEO 캡처 — 「국내 참고가격 ₩88,000」 **그리고** 「동일상품으로 확정된
                   * 국내 판매처는 없습니다」 **그리고** 「국내 판매처의 상세 페이지에서
                   * 확인한 가격입니다…」가 한 블록에 같이 있었다.
                   *
                   * 🔴🔴 **owner 를 먼저 확정했다**(§6 「최종 문구는 owner 확인 뒤」):
                   * ```
                   * 이 블록 숫자 = `candidateDomesticPrice` — **일시 후보 집계**
                   *                (tier `EXACT|COMPARISON` · WU-056 정책 그대로)
                   * 🔴 `domesticCompetition.lowestPriceKrw`(← price_observations · **영속**)는
                   *    **다른 칸** 이다. 그 칸이 Main Story 에서 **117** 을 내고 있다(§5 보고).
                   * ⟹ 🟢 그래서 `scope`(「이번 확인에만 … 저장되지 않습니다」)는 이 블록에서
                   *    **참** 이다 — 1차 수정에서 내가 거짓이라고 적었고 **그 판단이 틀렸다**.
                   *    `note`·`scope` 는 **되돌려 놓았다**(둘 다 `!compact` = 상세 전용).
                   * ```
                   * 🔴 남은 진짜 모순은 **하나** 다 — `DOMESTIC_SAME_NOT_CONFIRMED` 가
                   *    「국내 판매처는 **없습니다**」라고 말해 **가격이 있는데 없다** 로 읽혔다.
                   *    그 문장은 **등급**(SAME 확정) 축인데 숫자 축과 한 블록에 있었다.
                   * 🟢 그래서 **부정문을 쓰지 않는 짧은 근거 라벨** 로 바꾼다 —
                   *    `DOMESTIC_REFERENCE_BASIS`(「국내 가격 참고값」 · CPO §6 문구).
                   * 🔴 **숫자·집계·판정은 한 글자도 바뀌지 않는다** · 상수 삭제 **0**.
                   */
                  note: DOMESTIC_REFERENCE_NOTE,
                  scope: DOMESTIC_REFERENCE_SCOPE,
                  icon: "🇰🇷",
                  testId: "domestic-reference",
                  amountTestId: "domestic-lowest",
                  /** 🔴 CORE-2T §4 — 국내는 「확인 N곳」이다(해외는 기본값 「판매처」 그대로). */
                  sellerCountLabel: DOMESTIC_SELLER_COUNT_LABEL,
                  /** 🔴🔴 CORE-2U-A §5 — 「유사상품 1」(내부 등급 분포)을 **끈다.** */
                  showTierNote: false,
                  /**
                   * 🔴🔴🔴 **CORE-2U-A 의 부정문을 CANDIDATE-SYNC-01 이 교체했다.**
                   *    그때의 근거(「`sameCount === 0` 분기라 구조적으로 참」)는 **여전히
                   *    참** 이다 — 바뀐 것은 **그 «문장» 을 가격 숫자 옆에 두면 안 된다** 는
                   *    CPO 판정이다(두 축이 한 축으로 읽힌다 · §6·§9).
                   * 🟢 **삭제가 아니라 교체** 다 — 근거 줄은 상세에 그대로 서고,
                   *    같은 사실을 「동일상품 확인 0곳」 **숫자 줄** 이 1차에서 말한다.
                   */
                  statusLine: DOMESTIC_REFERENCE_BASIS,
                }
              : {
                  /**
                   * 🔴🔴🔴 CORE-2V §5 — **해외의 「유사상품 1」도 끈다**(CPO 가 이번에 명시).
                   *
                   * 🔴 CORE-2U 에서 이것을 **CPO 판정으로 올려 두었다** — 제목이
                   *    「해외 **동일상품** 참고가격」인데 `tierNote` 가 「동일상품 1 ·
                   *    **유사상품 1**」이라 **국내와 같은 성질의 모순** 이었다.
                   * 🟢 CORE-2V §5 가 `유사상품 1` 을 **핵심 가격 영역에서 제거** 하라고
                   *    명시했고 **시장을 가르지 않았다** ⟹ 해외에도 적용한다.
                   * 🔴 **가격 숫자·통화·집계는 한 글자도 안 바뀐다** — 등급 «분포 라벨» 만
                   *    꺼진다(§9 가 금지한 「해외 가격」은 로직/숫자다).
                   * 🟢 등급 분포는 `▸ MI 상세 분석` 이 계속 들고 있다(삭제 0).
                   */
                  showTierNote: false,
                })}
          />
          {/**
           * ══════════════════════════════════════════════════════════════════
           * 🔵🔵🔵 CORE-UX-SELLER-02 — **숫자는 1차 · 문장은 상세**(CPO 확정 2026-10-26)
           * ══════════════════════════════════════════════════════════════════
           *
           * 🔴🔴 **고치는 모순이 무엇인지 먼저 적는다**(마운트 DOM 실측):
           * ```
           * 1차   「🇰🇷 국내 참고가격 KRW 88,000 · 확인 1곳」        ← 셀러가 본다
           * 상세  「🔎 동일상품 확인 0곳 — …」                        ← 🔴 펼치지 않으면 못 본다
           * ⟹ 셀러는 「가격이 있다」만 읽고 **그 가격을 동일상품으로 확인한 곳이 0** 이라는
           *    사실을 **볼 수 없었다**. 그것이 CEO 가 지목한 모순이다.
           * ```
           *
           * 🟢🟢 **그런데 CORE-2AO-R2 와 충돌하지 않는다 — 축이 다르다**:
           * ```
           * 2AO-R2 가 1차에서 뺀 것 = **문장**(statusLine · marketEmptyNote 의 사유)
           * 이 WU 가 1차에 세우는 것 = **숫자 한 줄**(「동일상품 확인 0곳」)
           * ⟹ 아래 `{!isSummary}` 게이트를 **풀지 않는다** — 문장은 상세에 그대로 있다
           * ```
           *
           * 🔴 **새 어휘 0** — `SAME_CONFIRMED_COUNT_LABEL`(mi-same-candidates.ts:372)을
           *    그대로 쓴다. 🔴 `SAME_CHECK_HEADING`(「🔎 …」)을 쓰지 않는다 — 그쪽은
           *    **상세 머리말** 이고 1차로 올리면 2AO-R2 가 뺀 그 블록이 되돌아온다.
           * 🔴 **새 계산 0** — 이 분기가 이미 들고 있는 `g.sameCount` 를 그대로 읽는다.
           * 🔴 **새 블록 0** — 기존 🇰🇷/🌎 블록 **안** 의 한 줄이다(`R2-2` 「1차는 세 블록」 유지).
           * 🟢 이 분기는 `g.sameCount === 0` 안이라 그 숫자가 **항상 0** 이다 — 그래도
           *    상수를 거쳐 **값으로** 적는다(「0곳」을 손으로 박으면 분기가 바뀔 때 거짓이 된다).
           */}
          {isSummary && (
            <p
              data-testid={`market-same-count-${suffix}`}
              className="mt-0.5 text-[11px] text-text-tertiary"
            >
              {`${SAME_CONFIRMED_COUNT_LABEL} ${g.sameCount}곳`}
            </p>
          )}
          {/**
           * 🔴 CORE-2AO-R2 — 「🔎 동일상품 확인 … 0곳 — …」은 **근거 문장** 이다
           *    (CPO 제거 목록의 「동일상품 여부에 대한 긴 설명」) ⟹ 상세에서만 선다.
           * 🟢 **지우지 않았다** — `DETAIL` 이 같은 자리에서 같은 글자를 그린다.
           */}
          {!isSummary && (
            <>
          <p className="mt-2 text-[11px] font-medium text-text-secondary">{SAME_CHECK_HEADING}</p>
          <p data-testid={`market-empty-${suffix}`} className="text-[11px] text-text-tertiary">
            {marketEmptyNote(
              countMarketCandidates(rows, market),
              countPendingCandidates(rows, market),
              /**
               * 🔴🔴 CORE-2U-A §3·§7 — **가격이 이미 1차에 섰으면 후보 수를 또 말하지 않는다.**
               *    🟢 조건은 **그 블록이 실제로 금액을 그렸는가** 다 — 같은 술어를 쓰는
               *       `buildOverseasReference` 와 어긋나지 않게 그 함수의 조건을 읽는다.
               */
              hasReferencePrice(reference),
            )}
          </p>
            </>
          )}
        </>
      ) : (
        <div data-testid={`price-guide-${suffix}`}>
          <p className="text-[11px] font-medium text-text-secondary">{PRICE_GUIDE_TITLE[market]}</p>
          {/**
           * 🔴🔴🔴 CORE-2AO-R2 — **1차는 «금액» 하나, 상세는 «그 금액의 근거» 전부.**
           *
           * 🔴🔴🔴 CORE-2E §4-4 — **원화 보조 표시를 여기에 «넣었다가 되돌렸다».**
           *    실측 — `CAD 64` 가 **「약 ₩64」** 로 떴다(`convertToKrw` 는 모르는
           *    통화를 **그대로 KRW 로 취급** 한다 · `pricing/currency.ts:24`).
           *    「약」을 붙여도 그것은 **거짓 숫자** 다. 🔴 그리고 기존 계약 **6건** 이
           *    이 영역 전체에 `₩` 를 금지한다 ⟹ **CPO 예시의 `₩88,000` 을 쓰지 않았다**
           *    (ISO 코드 `KRW 88,000` 유지 · 판정 사안으로 보고한다).
           */}
          {isSummary ? (
            head ? (
              /** 🟢 CEO 요구 — **가격 숫자를 가장 크게.** */
              <p
                data-testid="price-guide-headline"
                className="mt-1 text-lg font-semibold tabular-nums text-text-primary"
              >
                {head}
              </p>
            ) : (
              /** 🔴 「가격을 못 가져왔다」와 「동일상품이 없다」는 다른 문장이다. */
              <p data-testid="price-guide-empty" className="text-[11px] text-text-tertiary">
                {PRICE_GUIDE_EMPTY}
              </p>
            )
          ) : (
            <>
              {/* 🟢 ⒞ 와 ⒟ 를 가르는 건수 줄 — 「동일상품 확인」과 「가격 확인」을 따로 적는다. */}
              <p data-testid="price-guide-counts" className="text-[11px] text-text-secondary">
                {priceGuideCountNote(g)}
              </p>
              {/**
               * 🔴🔴 WU-148 — **그 숫자가 «무엇인지» 를 말한다.** 🟢 🇰🇷 가격대일 때
               *    「국내 시장 가격대」 · 🌎 통화가 섞였을 때 「하나의 최저가로 합치지
               *    않습니다」. 🔴 라벨이 없는 상태는 줄을 **만들지 않는다**.
               */}
              {head && headLabel && (
                <p data-testid="price-guide-headline-label" className="text-[11px] text-text-tertiary">
                  {headLabel}
                </p>
              )}
              {/* 🔴 표본이 하나면 그 사실을 **문장으로** 말한다(1건 ≠ 시장 평균). */}
              {head && (
                <p data-testid="price-guide-note" className="text-[11px] text-text-tertiary">
                  {g.basis === "SINGLE" ? PRICE_GUIDE_SINGLE_NOTE : PRICE_GUIDE_RANGE_NOTE}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 한 시장(국내 ↔ 해외)의 칸.
 *
 * 🔴 두 시장이 **같은 컴포넌트** 를 쓴다 — 두 벌이 되면 한쪽만 고치는 날이 온다
 *    (`match-display.ts` 가 라벨을 하나로 모은 그 이유).
 */
function MarketColumn({
  testId,
  heading,
  selection,
  presumed,
  reference,
  referenceProps,
}: {
  testId: string;
  heading: string;
  selection: MiSameSelection;
  /**
   * 🔵🔵 CORE-E2E-CLOSE-03 — **동일 «가능성» 후보**(표시 전용).
   * 🔴 `selection` 과 **행이 겹치지 않는다** — 이쪽엔 SAME 이 오지 않는다.
   */
  presumed: readonly GeminiTransientRow[];
  reference?: OverseasPriceSummary | null;
  referenceProps: {
    title?: string;
    note?: string;
    scope?: string;
    icon?: string;
    testId?: string;
    amountTestId?: string;
  };
}): JSX.Element {
  return (
    <div data-testid={testId} className="space-y-2">
      <p className="text-[11px] font-medium text-text-primary">{heading}</p>
      {/* 🟢 MI 가 이미 낸 집계. 🔴 환산 0 · 통화별로만(그 성질은 그 컴포넌트의 계약이다). */}
      <OverseasReferencePrice summary={reference} {...referenceProps} />
      {selection.priced.length === 0 ? (
        /** 🔴 「동일상품이 없다」로 적지 않는다 — 부재와 미발견은 다르다. */
        <p data-testid="mi-same-empty" className="text-[11px] text-text-tertiary">
          {MI_SAME_EMPTY}
        </p>
      ) : (
        <ul className="space-y-1">
          {selection.priced.map((row) => (
            <li
              key={row.discoveredUrl}
              data-testid="mi-same-row"
              className="rounded border border-border/60 p-2"
            >
              {row.title && <p className="truncate text-[11px] text-text-primary">{row.title}</p>}
              <div className="flex items-baseline justify-between gap-2">
                <a
                  href={row.discoveredUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-[11px] text-text-tertiary underline"
                >
                  {row.domain}
                </a>
                {/* 🔴 통화 그대로 · 환산 없음(그 함수가 owner 다). */}
                <span data-testid="mi-same-price" className="shrink-0 text-[11px] font-medium text-text-secondary">
                  {priceText(row)}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">{stockText(row.soldOut)}</p>
            </li>
          ))}
        </ul>
      )}
      {/**
       * 🔴🔴 **「동일상품인데 빠진 것」을 조용히 버리지 않는다.**
       *    「동일상품이 없다」와 「동일상품인데 지금 가격을 확인하지 못했다」는 셀러가
       *    해야 할 행동이 **다르다**(앞은 기다리는 것, 뒤는 그 링크를 직접 보는 것).
       */}
      {/**
        * ══════════════════════════════════════════════════════════════════════
        * 🔵🔵🔵 CORE-E2E-CLOSE-03 — **동일 «가능성» 후보 구역**
        * ══════════════════════════════════════════════════════════════════════
        *
        * 🔴🔴 CEO 육안 FAIL 의 자리다. WU-152 가 MI 패널을 `HIDDEN` 으로 두면서
        *    그 안의 **출처별 후보 구역** 이 함께 사라졌고(CORE-E2E-CLOSE-02),
        *    이 결론 영역은 `selectMiSameCandidates` 로 **SAME 만** 그린다
        *    ⟹ `PRESUMED_SAME` 후보와 그 가격이 **화면 어디에도 없었다.**
        * 🔴 `selectMiSameCandidates` 주석이 「사라지는 것은 아니다 — MI 패널의
        *    출처별 구역이 모든 행을 그린다」고 약속했는데 **그 전제가 깨져 있었다.**
        *
        * 🟢 그래서 **패널을 되살리지 않고**(CPO §2) 여기에 구역 하나를 세운다.
        * 🔴 **표시 전용** 이다 — 가격 집계·판정·공급 배선 **변경 0.**
        * 🔴 기본 **접힘** 이다 — 펼친 채로 두면 「유력 후보」로 읽힌다(WU-091 ①).
        * 🔴 내부 토큰(`PRESUMED_SAME`·matchTruth·tier)을 **글자로 쓰지 않는다.**
        */}
      {presumed.length > 0 && (
        <details data-testid="mi-presumed-area" className="mt-1">
          <summary className="cursor-pointer text-[11px] text-text-secondary">
            {MI_PRESUMED_HEADING} {presumed.length}곳
          </summary>
          <p data-testid="mi-presumed-scope" className="mt-0.5 text-[11px] text-text-tertiary">
            {MI_PRESUMED_SCOPE}
          </p>
          <ul className="mt-1 space-y-1">
            {presumed.map((row) => (
              <li
                key={row.discoveredUrl}
                data-testid="mi-presumed-row"
                className="rounded border border-border/60 p-2"
              >
                {row.title ? (
                  <p className="truncate text-[11px] text-text-primary">{row.title}</p>
                ) : null}
                <div className="flex items-baseline justify-between gap-2">
                  <a
                    href={row.discoveredUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[11px] text-accent underline"
                  >
                    {row.domain}
                  </a>
                  {/** 🔴 가격이 없으면 「가격 미확인」 — 그 말의 owner 는 `priceText` 다(환산 0). */}
                  <span
                    data-testid="mi-presumed-price"
                    className="shrink-0 text-[11px] text-text-primary"
                  >
                    {priceText(row)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {selection.sameButExcluded.length > 0 && (
        <ul data-testid="mi-same-excluded" className="space-y-0.5">
          {selection.sameButExcluded.map(({ row, reason }) => (
            <li key={row.discoveredUrl} className="text-[11px] text-text-tertiary">
              {row.domain} — {MI_SAME_EXCLUSION_TEXT[reason]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
