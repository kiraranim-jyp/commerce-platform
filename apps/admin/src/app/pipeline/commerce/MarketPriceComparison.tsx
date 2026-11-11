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
  /** 🔵 STEP 6 §4-B — 화면에서 **뺐다**(분석 과정 설명). 🔴 어휘 상수는 남아 있다. */
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
  sameConfirmedCountText,
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
  /**
   * 🔵🔵🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — **후보 리스트 선택기 하나.**
   * 🔴 가격 축(`selectMiSameCandidates`)과 **다른 함수** 다 — 그 정책은 변경 0.
   */
  selectCandidateList,
  /**
   * 🔵 UNIFIED-UX-1 ⑧ — 🔴 **화면이 자기 규칙을 만들지 않는다.** 자격 술어는
   *    집계기와 같은 owner 이고 어휘도 `mi-same-candidates` 가 소유한다.
   */
  candidatePriceUse,
  CANDIDATE_PRICE_USE_LABEL,
  /**
   * 🔵🔵 SOURCING-CARD-MINIMAL-1 — **「우리 판단」 어휘 셋을 이 파일이 더는 쓰지 않는다.**
   * 🔴 `CANDIDATE_JUDGEMENT_PREFIX`(「우리 판단:」) · `CANDIDATE_JUDGEMENT_BASIS_PREFIX`
   *    (「판단 근거:」) · `HUMAN_VERDICT_REFERENCE_PREFIX`(「이전에 사람이 확인함:」)
   * 🟢 **상수는 leaf 에 그대로 있다** — 지운 것은 **import 와 렌더** 뿐이다(CPO §4).
   * 🔴 되살리려면 CPO 결정이 필요하다(§3 이 그 글자를 셀러 화면 금지어로 지정했다).
   */
  CANDIDATE_LIST_HEADING,
  CANDIDATE_GROUP_LABEL,
  CANDIDATE_LIST_EMPTY,
  /** 🔵 CANDIDATE-UX-REFINE-01 — U1 보조 · U2/U6 그룹 설명 · U7 보조. */
  /** 🔵 STEP 6 §4-A — 화면에서 **뺐다**(반복 설명). 🔴 어휘 상수는 남아 있다. */
  CANDIDATE_GROUP_NOTE,
  CANDIDATE_LIST_EMPTY_NOTE,
  /** 🔵 SELLER-UX-IMPLEMENTATION-1 ④ — 분모 설명을 1차에서 내린 자리의 토글 라벨. */
  CANDIDATE_LIST_EMPTY_WHY_SUMMARY,
  /**
   * 🔵🔵 U5 — **가격 3상태.** 🔴 owner 는 `isPriceConfirmed` 하나이고
   *    `priceState` 는 그것을 UI 상태로 바꾸는 **어댑터** 다(새 판정 0).
   */
  priceState,
  isPriceConfirmed,
  CANDIDATE_PRICE_UNKNOWN,
  CANDIDATE_PRICE_UNVERIFIED,
  /** 🔵 U3 그룹 순서 owner · U4 이미지/링크/근거. 🔴 순서·문장을 화면에서 복제하지 않는다. */
  CANDIDATE_GROUP_ORDER,
  CANDIDATE_IMAGE_NONE,
  CANDIDATE_LINK_TEXT,
  /**
   * 🔵🔵 SOURCING-CARD-MINIMAL-1 — **근거 접힘이 제거되어 둘을 더는 쓰지 않는다.**
   * 🔴 `CANDIDATE_EVIDENCE_FOLD_LABEL`(「근거 확인」) · `candidateEvidenceLines`
   * 🟢 **leaf 의 상수·함수는 그대로다** — `GeminiTransientCandidates` 가 그 라벨을
   *    여전히 쓰고(`EVIDENCE_SUMMARY_LABEL`), 생산자는 내부 분석·GT 가 계속 쓴다.
   */
  /** 🔵 D2(STAGE 2-R) — 「내 판단」 어휘 owner. 🔴 내부 토큰이 아니라 **사람의 말** 이다. */
  HUMAN_NOTE_OPTIONS,
  HUMAN_NOTE_SECTION_LABEL,
  /** 🔵 §5 — 요약 줄의 **행동** 어휘. */
  CANDIDATE_LIST_OPEN_HINT,
  /** 🔵 §3·§4 — 해외 1차 소싱가의 원화 환산 어휘(CORE-2E §4-4 의 보류를 푼다). */
  SUMMARY_PRICE_KRW_PREFIX,
  SUMMARY_PRICE_KRW_UNAVAILABLE,
  overseasHasSingleCurrency,
  /**
   * 🔵🔵 `-02` — 🔴 `candidateReasonLines`(matchReasons 통째 렌더)를 **대체** 한다.
   *    카드는 **확인할 것만** 말한다. `matchReasons` 는 데이터/게이트에 **그대로 남는다**.
   *
   * 🔵🔵 SOURCING-CARD-MINIMAL-1 — **`candidateWarningLines` import 를 뺐다.**
   * 🔴 CPO 결정 C — 「확인 필요」 줄은 셀러 화면에 서지 않는다(내부 판단 설명).
   * 🟢 **생산자는 leaf 에 그대로** 다 — 내부 분석·GT·계약이 계속 호출한다.
   */
  type CandidateListGroup,
  MI_PRESUMED_HEADING,
  MARKET_RECHECK_BUTTON,
  MARKET_RECHECK_EMPTY,
  MARKET_RECHECK_BUSY,
  /** 🔵 MI-INVESTIGATION-STATE-UX-2 ④ — 조사 중 · 실패 문구(어휘 owner 는 같은 파일). */
  MARKET_RECHECK_INVESTIGATING,
  MARKET_RECHECK_FAILED,
  MI_PRESUMED_SCOPE,
  /** 🔴 WU-146 ② — **상태별 결론.** 한 문장 안내문이 아니다(가격 0 / SAME 0 / 국내 0 을 가른다). */
  marketDecisionLines,
  countPendingCandidates,
  /**
   * 🔵 MI-SELLER-MARKET-COMPARISON-A — 비교 세 줄의 **어휘 owner 는 그 파일 하나** 다.
   * 🔴 여기서 문자열을 만들지 않는다(「동일상품 확인」 가족과 갈라지지 않게).
   */
  COMPARE_DOMESTIC_LABEL,
  COMPARE_OVERSEAS_LABEL,
  /**
   * 🔴 **차액 어휘를 들여오지 않는다**(CPO 전략 정정 2026-11-10) — 차액은 제품이
   *    제공하지 않는다. 가격은 **나란히** 보여주고 판매 판단은 MI 가 한다.
   */
  COMPARE_SCOPE_NOTE,
  type MarketJudgement,
  type MiSameSelection,
} from "./mi-same-candidates";
import {
  priceText,
  stockText,
  /**
   * 🔵🔵 CORE-E2E-CLOSE-04 — 선택 UI 의 **어휘 owner** 는 그 파일 하나다.
   * 🔴 여기서 새 문구를 만들지 않는다 — `HUMAN_REVIEW_VALUES` 는 DB
   *    `candidate_reviews.human_verdict` check constraint 와 **같은 어휘** 다.
   */
  HUMAN_REVIEW_VALUES,
  HUMAN_REVIEW_BUTTON,
  SAVE_STATE_TEXT,
  type GeminiTransientRow,
} from "./GeminiTransientCandidates";
/** 🔵 CORE-E2E-CLOSE-04 — 저장 배선. 🔴 새 API 0 · POST 중복 구현 0(CPO §4). */
import {
  useCandidateReview,
  type CandidateReviewApi,
  /** 🔵 D3(STAGE 2) — 후보 맥락 타입. 🔴 화면이 이미 든 값만 담는다. */
  type ReviewCandidateContext,
} from "./use-candidate-review";
import {
  /**
   * 🔵 CORE-NEXT STEP 4 — **A(권장 판매가격)의 말 owner.** 🔴 이 영역은 A 를
   *    **계산하지 않는다** — 문구조차 자기가 들지 않는다(그 파일 머리가 이유를 든다).
   */
  marketPriceBasisLine,
  APPLY_RECOMMENDED_PRICE_LABEL,
  /** 🔵 MI-INVESTIGATION-STATE-UX-2 ③ — CTA 를 내린 «이유» 를 말하는 문구. */
  APPLY_SUPPRESSED_BY_VERDICT_NOTE,
  /** 🔵 MI-PRICE-BASIS-DISPLAY-1 — A/B 의 **전제** 와 판단 한 줄(어휘 owner 는 그 파일). */
  PRICE_BASIS_A_NOTE,
  PRICE_BASIS_B_BASIS_LABEL,
  PRICE_BASIS_B_NOTE,
  priceBasisVerdictLine,
  /** 🔵 R2 STEP 7 — 최종 선택 가격의 **글자**(값 owner 는 `priceOverrideKrw` 하나다). */
  FINAL_PRICE_LABEL,
  FINAL_PRICE_NONE_TEXT,
  FINAL_PRICE_SELECTED_BADGE,
  CONFIRM_CANDIDATE_PRICE_LABEL,
  /** 🔴 CLOSE-3 §0 — 「원화 후보에서만」 문구는 **폐기** 됐다(소비처 0 · 상수만 남는다). */
  EDIT_FINAL_PRICE_LINK_TEXT,
  PRICE_CALCULATION_LINK_TEXT,
  RECOMMENDED_PRICE_LABEL,
  /* 🔴 `SELL_VERDICT_HEADING` import 를 **뺐다** — CPO 결정 ⒝ 로 이 영역이 판정
     머리말을 쓰지 않는다. 🟢 상수 자체는 그대로 있고 요약·Action Center 가 쓴다. */
  /** 🔵 CLOSE-3 §0 — 후보 카드 «안» 의 환산 어휘(집계 영역엔 쓰지 않는다). */
  CANDIDATE_PRICE_KRW_PREFIX,
  CANDIDATE_PRICE_KRW_UNAVAILABLE,
  CONFIRM_PRICE_NO_RATE_NOTE,
  /**
   * 🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — 🔴 **어휘를 여기서 만들지 않는다.**
   *    금지 어휘(추천/비추천/낮추/경쟁력)를 계약이 한 자리에서 물 수 있어야 한다.
   */
  REFERENCE_PROFITABILITY_TITLE,
  REFERENCE_PROFITABILITY_BASIS_NOTE,
  REFERENCE_PROFITABILITY_NOT_A_VERDICT_NOTE,
  referenceProfitabilityBasisCount,
  referenceProfitabilityTargetLine,
} from "./recommended-price-copy";
/** 🟢 `PriceEditor` 가 쓰는 **그 포맷터** 다 — 두 화면이 같은 숫자를 다르게 적지 않는다. */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §4 — **이 파일은 환산하지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **`convertToKrwStrict` import 가 «의도적으로» 없다.** 전에는 이 파일이 그 함수를
 *    **환율 인자 없이** 세 곳(`:1857`·`:2486`·`:2658`)에서 불러 **내장 고정표** 로
 *    환산했고, 서버는 라이브 환율로 환산했다 ⟹ **같은 후보가 경로에 따라 다른 원화
 *    숫자** 를 가질 수 있었다. 그중 하나(`:2658`)는 **실제 판매가 확정** 경로였다.
 * 🟢 이제 환산 owner 는 **서버 하나** 다(`market-intelligence.ts` ·
 *    `convertToKrwStrict(amount, currency, liveRates)`). 이 파일은 서버가 후보 행에
 *    실어 보낸 `row.priceKrwDerived` 를 **읽기만** 한다.
 * 🔴🔴 **다시 import 하지 않는다.** 하는 순간 환산 owner 가 둘이 되고 이 WU 가 고친
 *    결함이 재발한다(계약 테스트가 이 파일의 호출 **0건** 을 단언한다).
 * 🔴 `formatKrw` 는 **표시 포맷터** 라 그대로 쓴다 — 환산이 아니다.
 */
import {
  formatKrw,
  /** 🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **타입만**(계산은 서버 owner 하나). */
  type ReferenceProfitabilityResult,
} from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §4 — **후보 행의 서버 환산값 읽기**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 함수가 «왜» 영역 밖에 있는가.** `mi-candidate-list` 구역에는
 *    「집계 어휘를 쓰지 않는다」는 계약이 있고(`core-e2e-close-03` :259 ·
 *    금지 `reference`·`byCurrency`·`priceKrw`·`priceTier`·`lowest`), 그 구역 안에서
 *    `row.priceKrwDerived` 를 직접 읽으면 **그 금지에 걸린다**.
 * 🟢 **가드를 느슨하게 하지 않고 어휘를 옮겼다** — WU-133 이 `blocker-text.ts` 를
 *    따로 만든 그 처리와 **같은 모양** 이다. 🔴 금지 목록은 **한 글자도 줄이지 않았다**.
 * 🔴 **CSS 로 숨기는 처리가 아니다**(CPO 명시) — 구역의 «코드 어휘» 를 바꾼 것이고
 *    서버 파생값은 그대로 읽힌다.
 * 🔴 `?? null` 을 여기서 한다 — `undefined` 가 흘러 숫자를 지어낼 자리를 막는다.
 */
const derivedKrwOf = (row: { priceKrwDerived?: number | null }): number | null =>
  row.priceKrwDerived ?? null;

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
  /**
   * 🔵🔵🔵 CORE-E2E-CLOSE-04 — **후보 선택 저장의 식별자.**
   * 🔴 없으면 선택은 화면 state 로만 남고 **저장했다고 말하지 않는다**(없는 주소로
   *    POST 해서 실패를 「저장됨」으로 칠하지 않는다 — 기존 규약 그대로).
   * 🔴 `CommerceWorkspace` 는 **저장 state 를 만들지 않는다** — 이 값만 내려보낸다(CPO §4).
   */
  snapshotId?: string | null;
  /**
   * 🔵🔵🔵 CORE-E2E-CLOSE-05 — **셀러가 직접 다시 조회한다.**
   * 🔴 재진입하면 `/check` 가 돌지 않아 `rows` 가 null 이고 이 영역이 통째로
   *    사라졌다(CEO Production FAIL). 🟢 그 복구 수단을 **여기** 에 둔다.
   * 🔴 자동으로 부르지 않는다 — **클릭할 때만** 이다(CPO §2 비용 정책).
   * 🔴 `/check` 구현은 **패널의 기존 `recheckNow`** 하나다(새 API 0 · 복제 0).
   */
  onRecheck?: (() => void) | null;
  /** 🔴 진행 중 — 중복 클릭을 막고 「분석 중」을 말한다(CPO §4). */
  rechecking?: boolean;
  /** 🔴 MI 가 이미 낸 국내 참고가격 집계. 여기서 계산하지 않는다. */
  domesticReference?: OverseasPriceSummary | null;
  /** 🔴 MI 가 이미 낸 해외 참고가격 집계. 여기서 계산하지 않는다. */
  overseasReference?: OverseasPriceSummary | null;
  /**
   * 🔵🔵🔵 MI-SELLER-MARKET-COMPARISON-A — **국내 ↔ 해외 최저 ↔ 차액**(표시 전용).
   * 🔴 서버 compareDomesticVsOverseasKrw 가 낸 값이다 — 이 파일은 **환산도 계산도
   *    하지 않는다**(환산 owner 는 서버 하나 · 이 파일의 직접 환산 호출 0건이 계약이다).
   * 🔴 한쪽이라도 없으면 서버가 **null** 을 준다 ⟹ **줄을 그리지 않는다**(0원 차이 금지).
   * 🔴 판정·CASE·추천가격은 이 값을 **읽지 않는다**.
   */
  marketKrwComparison?: {
    domesticKrw: number;
    overseasKrw: number;
    overseasCurrency: string;
    overseasAmount: number;
    differenceKrw: number;
  } | null;
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
   * 🔵🔵🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **참고가격 기준 예상 수익성**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 **위 A/B 와 «세 번째 축» 이다** — 분모가 다르다:
   * ```
   * A 추천 판매가격   원가 + 목표마진           (`resolveListingPrice`)
   * B 시장가격        국내 **EXACT** 최저가      (`computePriceRecommendation`)
   * 🔵 이 축          수집된 **참고가격**(COMPARISON 포함) (`computeReferenceProfitability`)
   * ```
   * 🔴 그래서 **같은 줄·같은 블록에 적지 않는다**(CPO 경계 ③ · B 금액 비노출 동결 유지).
   * 🟢 **서버가 이미 낸 값** 이다 — 이 컴포넌트는 계산하지 않는다(비율 사본 0).
   * 🔴 `null` 이면 **영역을 그리지 않는다**(없는 수익성을 지어내지 않는다).
   */
  referenceProfitability?: ReferenceProfitabilityResult | null;
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
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 MI-INVESTIGATION-STATE-UX-2 ④ — **조사 «상태»**(결과와 다른 축이다)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 전까지 이 영역은 `rows`(결과)만 받아서 「진행 중」과 「결과 없음」을 **구별할 수
   *    없었다** ⟹ 조사 중에도 「후보 조회 결과가 아직 없습니다」를 말했다(기준선 덤프).
   * 🔴 기본값 `"READY"` — 넘기지 않는 기존 호출부·계약은 **한 글자도 바뀌지 않는다**.
   */
  investigation?: "INVESTIGATING" | "READY" | "FAILED";
  /**
   * 🔵🔵🔵 CORE-UX-SELLER-01 ② — **A 를 실제 판매가격으로 확정하는 CTA.**
   *
   * 🔴 **이 영역은 가격을 만들지 않는다** — `CommerceWorkspace` 가
   *    `() => updateSalePriceKrw(recommendedPriceKrw)` 로 **이미 묶어서** 넘긴다.
   *    즉 `PriceEditor` 의 「최종 판매가격에 적용」(:158)과 **같은 handler** 다.
   * 🔴 없으면 **버튼을 그리지 않는다**(갈 곳 없는 버튼 금지 · ⓘ 와 같은 규약).
   */
  onApplyRecommendedPrice?: () => void;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 R2 STEP 7 — **최종 선택 가격.** 🔴 owner 는 `priceOverrideKrw` «하나» 다
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO 결정 ⒝ — 이 영역은 **표시 + 확정** 만 한다. **편집 owner 는 `PriceEditor`** 다.
   *    🔴 그래서 여기에 입력칸/새 state/새 저장 경로를 **만들지 않았다**(새 가격 개념 0).
   * 🟢 값은 `CommerceWorkspace` 가 `product.priceOverrideKrw?.value` 를 그대로 내려준다 —
   *    `canonicalProduct` 칸이라 **저장·재진입 복원이 이미 된다**(새 migration 0 · STEP 8).
   * 🔴 `null` = 아직 확정하지 않았다(= 「권장가로 갈 것인가」는 `PriceEditor` 의 몫).
   */
  finalPriceKrw?: number | null;
  /**
   * 🔴🔴 **후보 가격을 최종 판매가격으로 확정하는 handler.** `(krw) => void` 다.
   *
   * 🔴 `onApplyRecommendedPrice`(인자 없는 묶음)와 **다른 모양** 인 이유 — 그쪽은
   *    권장가 **하나** 를 적용하고, 이쪽은 **셀러가 고른 후보의 금액** 을 적용한다.
   * 🟢 가는 곳은 **같다** — `CommerceWorkspace.updateSalePriceKrw(:1452)` 그 함수다
   *    (= `PriceEditor` 의 「최종 판매가격에 적용」이 쓰는 그것) ⟹ owner 가 둘이 되지 않는다.
   * 🔴 없으면 버튼을 그리지 않는다(갈 곳 없는 버튼 금지 · 이 파일의 기존 규약).
   */
  onConfirmPriceKrw?: (krw: number) => void;
  /**
   * 🔴 「가격 수정」 — **이 영역이 편집하지 않는다.** 기존 편집기로 보내는 길만 받는다
   *    (§10 「기존 편집 기능으로 연결한다」). 🔴 없으면 그 링크를 그리지 않는다.
   */
  onOpenPriceEditor?: () => void;
}

export function MarketPriceComparison({
  rows,
  snapshotId,
  onRecheck,
  rechecking = false,
  /** 🔵 A — 서버가 낸 국내↔해외 비교값(표시 전용 · 없으면 줄을 그리지 않는다). */
  marketKrwComparison = null,
  domesticReference,
  overseasReference,
  costPriceKrw,
  recommendedPriceKrw,
  marketPriceKrw,
  marketPriceMarginPercent,
  onOpenPriceCalculation,
  /** 🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — 🔴 **세 번째 축**(A/B 와 분모가 다르다). */
  referenceProfitability,
  sellVerdictCopy,
  /** 🔵 MI-INVESTIGATION-STATE-UX-2 ④ — 기본 `"READY"`(기존 호출부 동작 불변). */
  investigation = "READY",
  onApplyRecommendedPrice,
  finalPriceKrw = null,
  onConfirmPriceKrw,
  onOpenPriceEditor,
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
   * 🔵🔵🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — **셀러가 보는 후보 리스트.**
   * 🔴🔴 CEO 모순의 수정 자리다 — 「가격은 뜨는데 후보 리스트가 없다」.
   *    가격이 뜨는 후보가 이 리스트에서 **사라질 수 없다**(계약 CAND-07 이 양쪽 시장에서
   *    `priced ⊆ list` 를 단언한다). 🔴 가격 집계 정책은 **변경 0** 이다.
   */
  const domesticList = selectCandidateList(rows, "KR");
  const overseasList = selectCandidateList(rows, "OVERSEAS");
  /**
   * 🔵🔵🔵 CORE-E2E-CLOSE-04 — **후보 선택의 활성 owner 가 여기다.**
   * 🔴 MI 패널은 운영에서 항상 `HIDDEN` 이라 그쪽 instance 를 **껐다** ⟹ 이력 GET 이
   *    두 번 돌지 않는다. 🔴 `CommerceWorkspace` 에 저장 state 를 만들지 않았다(CPO §4) —
   *    넘어오는 것은 **식별자 하나** 다.
   */
  const reviewApi = useCandidateReview(snapshotId);
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
  /**
   * 🔵 MI-PRICE-BASIS-DISPLAY-1 — **판단 한 줄.** 🔴 새 산식 0 — `B ↔ A` 비교 하나다.
   *    🔴 둘 중 하나라도 없으면 `null` 이고 그러면 그 줄을 **만들지 않는다**.
   */
  const priceBasisVerdict = priceBasisVerdictLine({
    recommendedPriceKrw,
    marketPriceKrw,
    /**
     * 🔴 **표시 게이트용 불리언 하나** 다 — 「후보 중에 가격이 하나라도 있는가」.
     *    🔴 집계가 아니다(금액·건수·통화를 만들지 않는다 · CPO: POST 승격 금지).
     *    🟢 금액의 owner 는 여전히 🇰🇷/🌎 블록의 `buildPriceGuide` 하나다.
     */
    hasCandidatePrice: (rows ?? []).some((r) => r.priceAmount != null),
  });
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
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 CORE-E2E-CLOSE-05 §4 — **영역이 «무조건» 사라지지는 않는다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 전까지 `!checkRan` 이면 `return null` 이라 **재진입 화면에서 가격비교가
   *    통째로 없어졌다**(CEO Production FAIL · 마운트 DOM 으로 재현했다).
   *    그리고 복구 버튼은 `HIDDEN` 패널 안이라 **셀러가 할 수 있는 일이 0** 이었다.
   * 🟢 이제 **재조회 수단이 있으면** 영역이 서고 「아직 조회하지 않았다 + 다시 분석」
   *    을 말한다. 🔴 「후보가 없다」로 적지 않는다 — **미조회와 부재는 다른 사실** 이다
   *    (WU-130 ② 가 세운 그 구분이고, 여기서 **세 번째 상태** 가 생겼다).
   * 🔴 자동 조회는 **하지 않는다** — 이 줄은 «표시» 조건이고 네트워크를 부르지 않는다.
   */
  const canRecheck = typeof onRecheck === "function";
  if (!checkRan && !canRecheck) return null;

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
        * 🔵🔵🔵 CORE-E2E-CLOSE-05 — **셀러가 직접 다시 조회한다**
        * ══════════════════════════════════════════════════════════════════════
        *
        * 🔴🔴 기존 분석 결과로 **재진입** 하면 `/check` 가 돌지 않아(`isFirstInsert`
        *    블록 안에만 있다) `rows` 가 null 이고, 전까지 이 영역이 **통째로 사라졌다**.
        *    복구 버튼은 `HIDDEN` 패널 안이라 **셀러가 할 수 있는 일이 0** 이었다.
        * 🟢 이제 **그 버튼이 여기** 있고 **패널의 기존 `recheckNow`** 를 부른다 —
        *    `/check` 새 구현 **0** · 새 API **0** · 자동 재조회 **0**(CPO §2·§3).
        * 🔴 진행 중에는 **잠근다**(중복 클릭 방지 · `disabled` + 함수 안 가드 둘).
        * 🔴 후보가 **이미 있으면** 이 줄은 그 위에 그냥 같이 선다 — 기존 표시를
        *    가리거나 바꾸지 않는다(§4 「이미 후보가 있는 경우 정상 표시」).
        */}
      {/**
        * ══════════════════════════════════════════════════════════════════════
        * 🔵🔵🔵 UI/UX FINAL SPRINT R2 STEP 4 — **정상 화면에서 CTA 를 없앤다**
        * ══════════════════════════════════════════════════════════════════════
        *
        * 🔴 CPO 결정 ②: 「시장분석 **결과를 보기 위해** 사용자가 다시 눌러야 하는 CTA」를
        *    제품의 정상 UX 에서 제거한다 ⟹ **결과가 이미 있으면(`checkRan`) 그리지 않는다.**
        *    그것이 「왜 다시 분석해야 하지?」를 없애는 전부다(계약 C: 정상 화면 CTA = 0).
        *
        * 🔴🔴 **그러나 `!checkRan` 일 때는 남긴다 — 지우면 되돌아가는 사고가 있다.**
        *    CORE-E2E-CLOSE-05 가 이 버튼을 **여기에 둔 이유** 가 바로 그것이다:
        *    복구 수단이 `HIDDEN` 패널 안에 있어서 **셀러가 할 수 있는 일이 0** 이었다
        *    (CEO Production FAIL). 결과가 없는 화면에서 이것까지 지우면 **막다른 화면** 이 된다.
        * 🟢 그리고 지시서 §5 가 그 경우를 **명시적으로 허용** 한다 — 「다른 목적을 갖는
        *    기능까지 임의 삭제하지 않는다」. 이 버튼의 두 목적이 여기서 갈린다:
        *    결과 있음 = **군더더기 CTA**(제거) · 결과 없음 = **유일한 복구 수단**(유지).
        * 🔴 자동 재조회로 대체하지 **않았다**(§4 금지) — 네트워크 호출 추가 0.
        */}
      {canRecheck && !checkRan ? (
        <div data-testid="market-recheck" className="mt-1 flex items-center gap-2">
          <button
            type="button"
            data-testid="market-recheck-button"
            disabled={rechecking}
            onClick={() => onRecheck?.()}
            className="rounded border border-border px-1.5 py-0.5 text-[11px] text-text-secondary disabled:opacity-50"
          >
            {MARKET_RECHECK_BUTTON}
          </button>
          {/**
           * 🔴 「조회하지 않았다」와 「후보가 없다」는 **다른 사실** 이다(WU-130 ②).
           *    후보가 아직 없을 때만 그 사실을 적고, **실패로 적지 않는다.**
           */}
          {/**
           * 🔴 「조회하지 않았다」와 「후보가 없다」는 **다른 사실** 이다(WU-130 ②).
           * 🟢 R2 STEP 4 로 이 블록이 **`!checkRan` 일 때만** 서므로, 전에 있던
           *    「결과가 있는데 진행 중」 가지는 **도달 불가** 가 됐다 ⟹ 지웠다(죽은 분기 0).
           *    🔴 문구 상수는 **둘 다 그대로** 쓴다(어휘 owner 변경 0).
           */}
          {/**
           * ══════════════════════════════════════════════════════════════════
           * 🔵🔵🔵 MI-INVESTIGATION-STATE-UX-2 ④ — **네 상태를 갈라서 말한다**
           * ══════════════════════════════════════════════════════════════════
           *
           * 🔴 기준선 덤프가 잡은 거짓말 — 조사가 **돌고 있는 동안에도** 이 줄이
           *    「후보 조회 결과가 아직 없습니다」였다(= 「없다」고 단정).
           * ```
           * 조사 중   autoChecking || loading   → MARKET_RECHECK_INVESTIGATING
           * 재조회 중  rechecking(셀러가 눌렀다)  → MARKET_RECHECK_BUSY   ← 기존
           * 실패      응답이 없다               → MARKET_RECHECK_FAILED
           * 미조회    그 외                    → MARKET_RECHECK_EMPTY   ← 의미 축소
           * 결과 있음  (이 블록이 애초에 서지 않는다 · `!checkRan` 조건)
           * ```
           * 🔴 **순서가 정책이다** — 진행 중이면 **실패로 적지 않는다**(아직 모른다).
           * 🔴 이 블록의 **렌더 조건(`canRecheck && !checkRan`)은 바꾸지 않았다** —
           *    R2 STEP 4(「결과가 있으면 CTA 를 그리지 않는다」)가 CPO 결정이다.
           *    ⟹ 바뀐 것은 **어느 문장을 고르는가** 하나다(새 블록 0 · 줄 수 불변).
           */}
          <span data-testid="market-recheck-note" className="text-[11px] text-text-tertiary">
            {investigation === "INVESTIGATING"
              ? MARKET_RECHECK_INVESTIGATING
              : rechecking
                ? MARKET_RECHECK_BUSY
                : investigation === "FAILED"
                  ? MARKET_RECHECK_FAILED
                  : MARKET_RECHECK_EMPTY}
          </span>
        </div>
      ) : null}

      {/**
       * 🔴 [기록] 여기 있던 `CORE-UX-SELLER-01 ①`(「팔아도 되는가가 첫 줄이다」) 블록은
       *    **CPO 결정 ⒝(2026-11-08)로 제거됐다.** 🟢 그 정책이 폐기된 것이 아니다 —
       *    판매 판단은 **이 영역 위의 상단 요약** 과 **Action Center** 가 계속 말한다.
       *    🔴 「결론은 하나, 표현 위치는 둘」로 바뀌었다(전에는 셋이었다).
       */}
      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 MI-PRICE-BASIS-DISPLAY-1 + ⒝ — **판정 반복 대신 «가격 근거» 다**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 **CPO 결정 ⒝(2026-11-08) — 결론 영역에서만 판정 문구를 뺀다.**
       * ```
       * 상단 요약        판매 판단   ← 🟢 **유지**(최종 판정의 대표 위치)
       * Action Center   판매 판단   ← 🟢 **유지**(실행 가능한 다음 행동과 나란히 · P-32)
       * 이 영역          판매 판단   ← 🔴 **제거**(여기는 근거의 자리다)
       * ```
       * 🔴 **일관성 계약은 그대로다** — `sellVerdictCopy` prop 은 **살아 있고**
       *    `resolveSellVerdictCopy` 하나에서 온다. 바뀐 것은 **이 영역이 그것을 «머리말로»
       *    되풀이하지 않는다** 는 것뿐이고, 그 값은 여기서 **③ 비추천 CTA 게이트** 가 쓴다.
       * 🔴 1차 화면 «전체» 순서는 유지된다(CPO 명시) — 판매 판단은 이 영역 **위** 의
       *    요약 블록이 말하므로 「① 판단 → ② 권장가 A → ③ 근거」가 화면에서 그대로 성립한다.
       *
       * 🔵 그 자리에 **가격 전제의 판단 한 줄** 이 선다(CPO `MI-PRICE-BASIS-DISPLAY-1`):
       * ```
       * 기준 라벨   국내 시장 참고가격 기준          ← B 가 **관측값** 이라는 사실
       * 판단        현재 시장가격으로는 목표마진 달성이 어렵습니다
       * (A 는 아래 「권장 판매가격 ₩…」 줄이 말한다 — **원가 + 목표마진**)
       * ```
       * 🔴 **새 판정 owner 0** — 판단은 `priceBasisVerdictLine` 이 `B ↔ A` 비교로 낸다
       *    (A 가 「목표마진 반영가」이므로 `B < A` = 목표마진 미달이 **산술적으로** 참이다).
       * 🔴 두 금액을 **합치거나 어느 한쪽을 고치지 않는다**(CPO 명시) · 환산 0 · 집계 0.
       *
       * 🔴🔴 **B 의 «금액» 은 적지 않는다 — 계약 셋이 그것을 막는다.**
       * ```
       * UX-04-c                 1차 `₩` 는 **A 줄 하나뿐**
       * core-next-step4 B-6     「시장 금액에는 ₩ 가 없다」
       * core-next-step4 C-4     상세에서도 「금액은 A 자리 하나」
       * ```
       *    🔴 그 셋은 **CPO 확정 WU 둘** 에서 나왔고 이유도 적혀 있다 — 「둘을 나란히
       *       두면 셀러가 **어느 쪽에 팔아야 하나** 를 다시 고른다」(CPO FAIL 조건).
       *    🟡 CPO 의 `MI-PRICE-BASIS-DISPLAY-1` 예시는 B 금액(₩88,000)을 포함했다 ⟹
       *       **긴장이 있고 CTO 가 임의로 열지 않았다**(§4-B D). 금액을 열려면 그 셋을
       *       같이 개정해야 하므로 **CPO 판정 사안** 으로 올렸다.
       * 🔴 B 가 없으면 **줄을 만들지 않는다** — 없는 가격으로 판단을 지어내지 않는다.
       */}
      {priceBasisVerdict && (
        <div
          data-testid="market-price-basis"
          className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2"
        >
          <span data-testid="market-price-basis-b" className="text-[11px] text-text-secondary">
            {PRICE_BASIS_B_BASIS_LABEL}
          </span>
          <span data-testid="market-price-basis-verdict" className="text-[11px] text-text-primary">
            {priceBasisVerdict}
          </span>
        </div>
      )}

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 MI-SELLER-MARKET-COMPARISON-A — **국내 ↔ 해외 최저 ↔ 차액**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 **왜 이 영역인가.** 가격 숫자의 owner 는 「📊 시장 판매 판단」 **하나** 다
       *    (WU-141-R3 이 요약 카드에서 가격을 제거해 그렇게 모았다). 그래서 이 비교는
       *    요약 카드가 아니라 **여기** 에 선다.
       * 🟢 CPO 승인(2026-11-10) — 2026-11-08 동결 대상인 **B 금액**은
       *    `recommendation.recommendedPrice`(시장 기반 추천가격)이고 **이 셋과 다른 데이터** 다.
       *    ⟹ 그 동결은 **그대로** 지켜진다(여기에 추천가격 B 를 적지 않는다).
       *
       * 🔴 **이 영역은 아무것도 계산하지 않는다** — 환산·차액 모두 서버
       *    `compareDomesticVsOverseasKrw` 가 낸 값을 **그대로** 그린다.
       * 🔴 서버가 한쪽이라도 없으면 `null` 을 주므로 **줄 자체가 서지 않는다**
       *    ⟹ 「0원 차이」를 만들 자리가 구조적으로 없다(CPO §3).
       * 🔴 **자격 범위를 라벨과 주석이 말한다**(CPO §2) — 카드 목록에 더 싼 후보가
       *    보여도 퍼널을 못 넘으면 이 숫자가 아니다. 그것을 안 적으면 셀러가
       *    「왜 더 싼 게 있는데 이 값이냐」로 읽는다(실제로 그렇게 읽혔다).
       * 🔴 원본 통화·금액을 **같이** 적는다 — 환산만 보여 주면 되짚을 수 없다.
       */}
      {marketKrwComparison && (
        <div
          data-testid="market-krw-comparison"
          className="mt-2 rounded border border-border/60 bg-surface-subtle/40 p-2"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-[11px] text-text-secondary">{COMPARE_DOMESTIC_LABEL}</span>
            <span
              data-testid="market-krw-comparison-domestic"
              className="text-[12px] font-medium tabular-nums text-text-primary"
            >
              {formatKrw(marketKrwComparison.domesticKrw)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-[11px] text-text-secondary">{COMPARE_OVERSEAS_LABEL}</span>
            <span
              data-testid="market-krw-comparison-overseas"
              className="text-[12px] font-medium tabular-nums text-text-primary"
            >
              {/** 🔴 원본(GBP 37)을 같이 적는다 — 환산만 두면 어느 후보인지 되짚을 수 없다. */}
              {`${marketKrwComparison.overseasCurrency} ${marketKrwComparison.overseasAmount.toLocaleString("ko-KR")} · ${formatKrw(marketKrwComparison.overseasKrw)}`}
            </span>
          </div>
          {/**
           * ══════════════════════════════════════════════════════════════════
           * 🔴🔴🔴 **차액을 그리지 않는다** (CPO 전략 정정 2026-11-10)
           * ══════════════════════════════════════════════════════════════════
           *
           * 1차에 「국내 − 해외 차이 ₩N · 국내가 더 비쌈」을 그렸다가 **제거했다.**
           * 🔴 CPO: 「차액을 계산해 셀러에게 **판매 결정을 유도** 하는 방향은 제품 전략과
           *    맞지 않는다. 가격 정보는 **정확하게 제공** 하고 **판매 판단은 MI** 가 한다.」
           * 🔴 그래서 이 영역은 두 가격을 **나란히 보여줄 뿐** 하나의 숫자로 합치지 않는다
           *    (국내·해외를 억지로 최저가·차액으로 뭉치지 않는다).
           * 🔴 **판단 채널과 섞지 않는다** — 판매 가능 여부는 CASE·MI 가 말한다.
           * 🟢 서버의 `differenceKrw` 는 **지우지 않았다** — 다른 소비처 계약을 확인하기
           *    전에 제거하지 말라는 CPO 지시다(현재 셀러 화면 소비는 **0**).
           */}
          <p
            data-testid="market-krw-comparison-scope"
            className="mt-1 text-[11px] text-text-tertiary"
          >
            {COMPARE_SCOPE_NOTE}
          </p>
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
            /**
             * 🔵 FINAL UX REBUILD — `DETAIL` 이 쓰는 입력이라 1차에서도 **같은 값** 을
             *    넘긴다(prop 을 두 벌로 만들지 않는다). 🔴 `SUMMARY` 는 그것으로
             *    **아무것도 그리지 않는다**(`!isSummary` 게이트가 그것을 지킨다).
             */
            selection={mk === "KR" ? domestic : overseas}
          />
        ))}
      </div>

      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 FINAL UX REBUILD — **후보 칸이 «1차» 로 올라왔다**(CPO NO-GO 2026-11-02)
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 CEO 화면 FAIL 의 원인은 복원이 아니라 **접힘 깊이** 였다. 이 두 칸이
       *    `＋ 상세정보 보기` **안** 의 `▸ MI 상세 분석` **안** 에 있었고, 후보 카드는
       *    그 안의 `mi-candidate-list` **안** 이라 **세 번 펼쳐야** 보였다.
       * 🟢 그래서 **격자를 그대로 들어 올렸다** — JSX·props·순서·testid 를 한 글자도
       *    바꾸지 않았고(이동) 카드의 조상 `<details>` 가 **`mi-candidate-list` 하나** 가 됐다.
       * 🔴 `mi-candidate-list` 에 `open` 을 **붙이지 않았다** — 펼친 채로 두면 후보가
       *    「유력 후보」로 읽힌다(WU-091 ① · 2026-09-19 사고의 기전).
       * 🔴 그래서 1차에 서는 것은 **「후보 N곳」 요약 한 줄** 이고 그것이 CPO 목표 화면의
       *    `[후보 보기]` 다. 카드 자체는 **여전히 접혀 있다.**
       * 🔴🔴 **설명·집계·최종가는 같이 올라오지 않았다** — `mi-same-empty` ·
       *    `mi-same-excluded` · `market-final-price` 는 **상세 근거 블록으로 옮겼다**
       *    (CPO LOCK ⒜ 「최종 선택 가격은 상세 안에 둔다」를 지킨다).
       */}
        {/* 🔴 국내를 해외 «앞» 에 둔다 — 셀러의 질문 순서가 그렇다(WU-056 과 같은 이유). */}
        <div className="mt-2 grid gap-2 md:grid-cols-2">
        <MarketColumn
          testId="mi-same-domestic"
          heading={MI_SAME_DOMESTIC_HEADING}
          /**
           * 🔵🔵 CANDIDATE-UX-REFINE-01 U1/U7 — 🔴 이 컴포넌트는 **국내·해외가 공유** 한다.
           *    이 prop 이 없으면 후보 제목·빈 상태가 **국내 칸에서도 「해외」라고 적는다.**
           * 🔴 `testId` 로 시장을 추론하지 않는다 — testid 가 바뀌면 시장이 조용히 뒤집힌다.
           */
          market="KR"
          /**
           * 🔵 CORE-E2E-CLOSE-03 — 같은 `rows` 에서 **다른 선택기** 로 뽑는다.
           * 🔴 `selectMiSameCandidates`(가격 집계 축)는 한 글자도 안 바꿨다(CPO §3).
           */
          presumed={domesticPresumed}
          /** 🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — 같은 `rows` · 리스트 선택기 하나. */
          list={domesticList}
          /**
           * 🔵🔵 MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 — 🔴 **`MarketBlock` 의 분기와
           *    «같은 식» 이다**(`g.sameCount === 0 ? 서버 집계 : SAME 전용 가이드`).
           *    🟢 그래서 사본이 아니라 **같은 함수의 같은 산출** 이다(새 계산 0).
           * 🔴 국내도 같은 분기를 쓴다 — 한쪽만 고치면 국내 카드가 같은 거짓을 말한다.
           */
          sameOnlyPriceAxis={buildPriceGuide(judgement, "KR").sameCount > 0}
          /** 🔵 CORE-E2E-CLOSE-04 — 선택 owner 는 위 `useCandidateReview` 하나다. */
          reviewApi={reviewApi}
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
          /**
           * 🔵 R2 STEP 7 — **후보 카드의 「이 가격으로 확정」 하나만 남았다.**
           * 🔴🔴 `finalPriceKrw`·`onOpenPriceEditor` 는 **상세 근거 블록으로 옮겼다**
           *    (FINAL UX REBUILD · CPO LOCK ⒜). 이 칸이 1차라서 거기 두면 최종 선택
           *    가격이 첫 화면에 서고, 그것은 CPO 가 「직관성이 떨어진다」로 닫은 모양이다.
           */
          onConfirmPriceKrw={onConfirmPriceKrw}
        />
        <MarketColumn
          testId="mi-same-overseas"
          heading={MI_SAME_OVERSEAS_HEADING}
          /** 🔵 U1/U7 — 🔴 국내 칸과 **같은 구조 · 시장명만 다르다**(CPO §1). */
          market="OVERSEAS"
          /** 🔵 CORE-E2E-CLOSE-03 — 해외도 **같은 구역** 이다(두 벌을 만들지 않는다). */
          presumed={overseasPresumed}
          /** 🔵 해외도 **같은 선택기** 를 쓴다(두 벌을 만들지 않는다). */
          list={overseasList}
          /** 🔵🔵 MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 — 🌎 도 **같은 식** 이다(위 참조). */
          sameOnlyPriceAxis={buildPriceGuide(judgement, "OVERSEAS").sameCount > 0}
          /** 🔵 CORE-E2E-CLOSE-04 — 🌎 도 **같은 owner** 를 쓴다(두 벌 금지). */
          reviewApi={reviewApi}
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
          /** 🔵 R2 STEP 7 — 🔴 **국내와 글자 그대로 같은 prop** 이다(§6 구조 통일). */
          onConfirmPriceKrw={onConfirmPriceKrw}
        />
        </div>

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
              {/**
               * ══════════════════════════════════════════════════════════════
               * 🔵🔵🔵 MI-INVESTIGATION-STATE-UX-2 ③ — **비추천이면 CTA 를 «권하지» 않는다**
               * ══════════════════════════════════════════════════════════════
               *
               * 🔴 CASE B 기준선 — 「🔴 판매 비추천」 바로 아래에 「이 가격으로 설정」이
               *    **기본 행동** 으로 서 있었다. 🟢 CPO 확정으로 그 **행동만** 내린다.
               * 🔴 **세 번째 조건** 일 뿐이다 — 기존 둘(`onApplyRecommendedPrice` 없음 ·
               *    A 없음 → CTA 없음 · `UX-03-b/c`)을 **한 글자도 바꾸지 않았다**.
               *    그래서 기존 계약(기본 fixture = `CONDITIONAL`)은 전부 그대로 통과한다.
               * 🔴 `tone` 으로 가른다 — **이 영역이 판정하지 않는다**(`UX-02-c` 유지).
               *    `STOP` 은 `FINAL_VERDICT_COPY.NOT_RECOMMENDED` 의 tone 이고,
               *    그 매핑의 owner 는 패널이다(여기서 verdict 를 해석하지 않는다).
               * 🔴 **가격 편집 길은 남긴다** — 바로 아래 「가격 수정 →」 · ⓘ · A 숫자 전부 유지.
               */}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {onApplyRecommendedPrice && sellVerdictCopy?.tone !== "STOP" && (
                  <button
                    type="button"
                    data-testid="market-apply-recommended-price"
                    onClick={onApplyRecommendedPrice}
                    className="rounded border border-border px-2 py-1 text-[11px] font-medium text-text-primary hover:bg-surface"
                  >
                    {APPLY_RECOMMENDED_PRICE_LABEL}
                  </button>
                )}
                {/**
                 * 🔴 **버튼을 조용히 없애지 않는다** — 없어진 이유를 같은 자리에서 말한다.
                 *    🔴 조건이 CTA 의 **부정과 정확히 맞물린다**(둘이 같이 서거나 같이 빈다).
                 */}
                {onApplyRecommendedPrice && sellVerdictCopy?.tone === "STOP" && (
                  <span
                    data-testid="market-apply-suppressed-note"
                    className="text-[11px] text-text-tertiary"
                  >
                    {APPLY_SUPPRESSED_BY_VERDICT_NOTE}
                  </span>
                )}
                {/**
                 * ══════════════════════════════════════════════════════════════
                 * 🔵🔵🔵 PRICE & CANDIDATE UX FINAL FIX §3 — **「가격 수정」이 여기 선다**
                 * ══════════════════════════════════════════════════════════════
                 *
                 * 🔴🔴 **새 편집기를 만들지 않았다** — `onOpenPriceEditor` 는 상세의
                 *    `market-edit-final-price` 와 **같은 함수** 이고 편집 owner 는
                 *    `PriceEditor` **하나** 다(진입점이 둘일 뿐 값 owner 는 하나다).
                 * 🔴 **금액을 적지 않는다** — 1차 `₩` 는 권장가 줄 하나다(UX-04-c 유지).
                 * 🔴 `market-edit-final-price` 를 **여기에 쓰지 않는다** — 그 testid 는
                 *    「두 시장에 같은 구조로 선다」(계약 R2-B · 개수 **2**)를 뜻하고,
                 *    1차의 이것은 **시장과 무관한 단일 진입점** 이라 다른 축이다.
                 * 🔴 핸들러가 없으면 **그리지 않는다**(갈 곳 없는 버튼 금지).
                 */}
                {onOpenPriceEditor && (
                  <button
                    type="button"
                    data-testid="market-edit-price-link"
                    onClick={onOpenPriceEditor}
                    className="text-[11px] text-accent underline"
                  >
                    {EDIT_FINAL_PRICE_LINK_TEXT}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

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
       * 🔵🔵🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **참고가격 기준 예상 수익성**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 **왜 이 영역이 생겼나** — 셀러 화면이 「동일상품 EXACT 가 아니다」는 이유로
       *    **수익성을 아예 말하지 못했다**(`domesticBasis !== "EXACT"` → `marketCase D`).
       *    그런데 화면에는 참고가격(예: 🇰🇷 ₩88,000)이 **이미 서 있었다** ⟹ 셀러는
       *    「가격은 보이는데 팔아서 남는지는 모른다」는 상태였다.
       * 🟢 CPO ③ — 「동일상품 검증은 가격정보를 **없애는 스위치가 아니라** 가격 근거의
       *    **신뢰도를 설명하는 기준**」. 그래서 **별도 축** 으로 비율만 낸다.
       *
       * 🔴 **이 블록이 하지 않는 것**(계약이 전부 문다):
       * ```
       * ❌ 판매 추천/비추천 · 가격 인하 권고 · 「경쟁력」 판정 — 어휘 0
       * ❌ A(추천 판매가격) · B(시장가격)와 같은 줄 — **분모가 다르다**
       * ❌ 판매 판정(`sellVerdictCopy`)에 입력 — 서로의 입력이 아니다
       * ❌ tier 승격 · 금액 재집계 · 환산
       * ```
       * 🔴 **테두리로 가른다** — 같은 1차에 있지만 **다른 상자** 여야 셀러가 축을 섞지
       *    않는다(판정 영역은 요약·Action Center 이고 이 상자가 아니다).
       * 🔴 비율이 없으면(`marginPercent == null`) **그리지 않는다** — 「0%」는 거짓이다.
       */}
      {referenceProfitability?.marginPercent != null && (
        <div
          data-testid="reference-profitability"
          className="mt-3 rounded-lg border border-border-subtle bg-surface-subtle p-2"
        >
          <p
            data-testid="reference-profitability-title"
            className="text-[11px] font-semibold text-text-secondary"
          >
            {REFERENCE_PROFITABILITY_TITLE}
          </p>
          {/** 🔴 제목 **바로 밑** 에 전제를 둔다 — 이 줄이 확정 판단과 가르는 장치다. */}
          <p
            data-testid="reference-profitability-basis-note"
            className="mt-0.5 text-[11px] text-text-tertiary"
          >
            {REFERENCE_PROFITABILITY_BASIS_NOTE}
          </p>
          <p
            data-testid="reference-profitability-margin"
            className="mt-1 text-[13px] font-semibold text-text-primary"
          >
            {/** 🔴 소수점을 만들지 않는다 — 참고 축에서 0.1% 는 **없는 정밀도** 다. */}
            예상 마진 {Math.round(referenceProfitability.marginPercent)}%
          </p>
          {/** 🟢 분모를 같이 적는다 — 근거 수·제외 수 없이 비율만 주면 셀러가 과신한다. */}
          <p
            data-testid="reference-profitability-basis-count"
            className="mt-0.5 text-[11px] text-text-tertiary"
          >
            {referenceProfitabilityBasisCount({
              sellerCount: referenceProfitability.sellerCount,
              excludedUnverified: referenceProfitability.excludedUnverified,
              excludedObservedDifference: referenceProfitability.excludedObservedDifference,
            })}
          </p>
          {/** 🔴 목표마진 비교는 **사실 한 줄** 이다(권고가 아니다) · 없으면 안 선다. */}
          {(() => {
            const line = referenceProfitabilityTargetLine({
              meetsTargetMargin: referenceProfitability.meetsTargetMargin,
              targetMarginPercent: referenceProfitability.targetMarginPercent,
            });
            if (line == null) return null;
            return (
              <p
                data-testid="reference-profitability-target"
                className="mt-0.5 text-[11px] text-text-secondary"
              >
                {line}
              </p>
            );
          })()}
          {/** 🔴 「판정이 아니다」를 **화면이 직접 말한다** — 주석으로만 두면 셀러가 모른다. */}
          <p
            data-testid="reference-profitability-not-a-verdict"
            className="mt-0.5 text-[11px] text-text-tertiary"
          >
            {REFERENCE_PROFITABILITY_NOT_A_VERDICT_NOTE}
          </p>
        </div>
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
      {/**
       * ══════════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 MI-SELLER-RESULT-UX-REFINE-1 D(CPO 옵션 ⒝ 승인) — **판단은 남기고
       *    설명을 지운다.**
       * ══════════════════════════════════════════════════════════════════════════
       *
       * 🔴 접힘 **셋이 사라졌다** — 「＋ 상세정보 보기」(price-detail-fold) ·
       *    「💡 가격 판단 기준」(price-basis) · 「▸ MI 상세 분석」(mi-detail-fold).
       *    그 안의 **표 · 근거 · 설명** 도 셀러 화면에서 제거했다.
       * 🟢 **유지(= CPO 지정)** — market-judgement · seller-decision(-line) ·
       *    market-split · market-verdict. 🔴 넷은 **판단 «결과»** 이고 설명 UI 가 아니다.
       * 🔴🔴 **내부 계산 · 근거 · API · 판정 로직은 한 줄도 지우지 않았다** — 지운 것은
       *    **화면** 이다(`judgement` 는 그대로 계산되고 이 영역이 그중 결과만 그린다).
       * 🔴 `market-split` 은 제거 대상 접힘(`market-evidence-fold`) **안** 에 있었다 ⟹
       *    접힘을 지우면서 **그 한 줄만 꺼내** 유지한다(중첩이라 놓치기 쉬운 자리다).
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
            {judgement.onSaleCount > 0 && (
              <p data-testid="market-split" className="text-[11px] text-text-secondary">
                {ON_SALE_SPLIT_PREFIX} — {MARKET_LABEL.KR} {judgement.domesticOnSale}곳 ·{" "}
                {MARKET_LABEL.OVERSEAS} {judgement.overseasOnSale}곳
              </p>
            )}
      </div>
        <p data-testid="market-verdict" className="mt-1 text-[11px] text-text-secondary">
          {MARKET_VERDICT_TEXT[judgement.verdict]}
        </p>
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
  /**
   * 🔵🔵 FINAL UX REBUILD — **`DETAIL` 에서만 쓰는 세 입력.**
   *
   * 🔴 전까지 이 셋은 `MarketColumn` 이 들고 있었다. 그 칸이 **1차로 올라가면서**
   *    설명·제외사유·최종가가 같이 끌려 올라왔고, 그것이 CPO NO-GO 의 그 모양이다.
   * 🔴 그래서 **값 owner 를 바꾸지 않고 자리만** 옮겼다 — `selection` 은 같은
   *    `MiSameSelection`, `finalPriceKrw` 는 같은 `priceOverrideKrw` 다(계산 0).
   * 🔴 `SUMMARY` 에서는 **그리지 않는다**(1차로 되돌아가면 안 된다).
   */
  selection,
  finalPriceKrw,
  onOpenPriceEditor,
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
  /** 🔵 FINAL UX REBUILD — `DETAIL` 전용(위 주석이 이유를 들고 있다). */
  selection: MiSameSelection;
  finalPriceKrw?: number | null;
  onOpenPriceEditor?: () => void;
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
                  /**
                   * 🔴 CORE-2T §4 — 국내는 해외와 **다른 지표** 다(해외는 기본값 그대로).
                   * 🔵 MI-SELLER-RESULT-UX-REFINE-1 A-① — 「확인 N곳」 ⟹ **「반영 판매처 N곳」**.
                   *    🔴 단위를 **같이** 넘긴다 — 국내는 판매처를 세므로 「곳」 이다
                   *    (해외는 레코드를 세므로 「건」 · 그 기본값은 owner 가 들고 있다).
                   */
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
              {sameConfirmedCountText(g.sameCount)}
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
              /**
               * 🔵🔵 STAGE 7-3 — **금액 자격을 «잃은» 후보 수.** 집계가 이미 센 값이고
               *    여기서 다시 판정하지 않는다(7-1 가격 미확인 + 7-2 상품 차이).
               * 🔴 둘을 더해서 넘기는 이유 — 이 문장이 묻는 것은 **「비교할 금액이 0인가」**
               *    하나다. 사유별 문장은 금액 블록이 각각 말한다(그 블록이 설 때).
               */
              (reference?.unverifiedCount ?? 0) + (reference?.observedDifferenceCount ?? 0),
            )}
          </p>
            </>
          )}
        </>
      ) : (
        <div
          data-testid={`price-guide-${suffix}`}
          /**
           * ══════════════════════════════════════════════════════════════════
           * 🔵🔵🔵 MI-SELLER-RESULT-UX-REFINE-1 B — **두 분기가 «같은 카드» 로 선다**
           * ══════════════════════════════════════════════════════════════════
           *
           * 🔴 CEO 캡처의 비대칭은 **컴포넌트가 달라서가 아니라 «분기» 가 달라서** 였다:
           * ```
           * sameCount === 0 → <OverseasReferencePrice>  카드 셸(테두리·배경·p-3)
           * sameCount  > 0 → 이 블록                    🔴 테두리도 배경도 없는 맨 div
           * ```
           *    ⟹ 🇰🇷(SAME 0)는 **카드**, 🌎(SAME 3)는 **맨 줄** 로 떠서 같은 성격의 두
           *    정보가 **다른 무게** 로 읽혔다.
           * 🟢 그래서 **그 카드의 셸 클래스를 그대로** 쓴다(사본이 아니라 같은 값).
           * 🔴 `data-testid` · 문구 · 금액 · 건수 · 집계 · 분모 · 판정은 **한 글자도**
           *    바뀌지 않는다 — 바뀌는 것은 **테두리/배경/여백/제목 크기** 뿐이다.
           * 🟢 금액 위계는 **이미 같았다**(둘 다 `text-lg font-semibold` · `compact`).
           */
          className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
        >
          {/**
           * 🔵 B — 제목 위계도 참고가격 카드와 **같게**(그쪽은 `font-medium` 이고 본문
           *    크기를 셸에서 상속받는다). 🔴 글자·아이콘은 owner 상수 그대로다.
           */}
          <p className="font-medium text-text-primary">{PRICE_GUIDE_TITLE[market]}</p>
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
              <>
              {/** 🟢 CEO 요구 — **가격 숫자를 가장 크게.** */}
              <p
                data-testid="price-guide-headline"
                className="mt-1 text-lg font-semibold tabular-nums text-text-primary"
              >
                {head}
              </p>
              {/**
               * ══════════════════════════════════════════════════════════════
               * 🔵🔵🔵 PRICE & CANDIDATE UX FINAL FIX §3·§4 — **원 통화 + 원화 환산**
               * ══════════════════════════════════════════════════════════════
               *
               * 🔴🔴 **CORE-2E §4-4 가 보류한 그 줄이다.** 그때 막은 둘을 지시서가 풀었다 —
               *    ⒜ `convertToKrwStrict` 라 **모르는 통화는 숫자를 만들지 않는다**
               *       (`CAD 64 → 약 ₩64` 라는 거짓 숫자가 구조적으로 불가능하다)
               *    ⒝ 환산 불가는 **조용히 빼지 않고** 「원화 환산 불가」로 적는다
               * 🔴 **원본 줄을 덮어쓰지 않는다** — 위 `price-guide-headline` 은 한 글자도
               *    안 바뀌었다(통화 ISO 그대로). 이 줄은 **추가** 다.
               * 🔴 **국내에는 그리지 않는다** — `₩88,000` 아래 `약 ₩88,000` 은 같은 숫자를
               *    두 번 적는 것이다(후보 카드가 쓰는 그 규칙과 **같다**).
               * 🔴🔴 **통화가 섞이면 그리지 않는다** — 최저가를 하나로 고를 수 없다(WU-148).
               *    그때 1차는 「GBP 37 · USD 80」 과 「통화가 여러 개라 …」를 그대로 말한다.
               * 🔴 이 값은 **집계로 가지 않는다** — `buildPriceGuide`·`byCurrency` 는 이
               *    변수를 **읽지 않는다**(표시 전용 · 새 가격 owner 0).
               */}
              {market === "OVERSEAS" && overseasHasSingleCurrency(g) && g.byCurrency[0]
                ? (() => {
                    const c = g.byCurrency[0]!;
                    if (c.currency === "KRW") return null;
                    /**
                     * 🔵🔵🔵 MI-UNIFIED-MARKET-PRICE-COMPARISON-1 §4 — **서버 파생값을 읽는다.**
                     *
                     * 🔴🔴 전에는 이 줄이 `convertToKrwStrict(c.lowest, c.currency)` 로
                     *    **환율 없이** 환산했다 ⟹ 내장 고정표를 썼고, 서버는 라이브 환율로
                     *    환산해 **같은 후보가 경로에 따라 다른 숫자** 를 가질 수 있었다.
                     * 🟢 이제 `buildPriceGuide` 가 서버 `row.priceKrwDerived` 를 **고른** 값이다
                     *    ⟹ 아래 후보 줄(`:2486`)·확정 버튼(`:2658`)과 **같은 숫자** 다.
                     * 🔴 `null` 이면 숫자를 만들지 않고 「원화 환산 불가」를 적는다(전과 동일).
                     */
                    const krw = c.lowestKrw == null ? null : { amountKrw: c.lowestKrw };
                    return krw ? (
                      <p
                        data-testid="market-summary-price-krw"
                        className="text-[12px] tabular-nums text-text-secondary"
                      >
                        {SUMMARY_PRICE_KRW_PREFIX}
                        {formatKrw(krw.amountKrw)}
                      </p>
                    ) : (
                      <p
                        data-testid="market-summary-price-krw-unavailable"
                        className="text-[11px] text-text-tertiary"
                      >
                        {SUMMARY_PRICE_KRW_UNAVAILABLE}
                      </p>
                    );
                  })()
                : null}
              </>
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
      {/**
       * ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 FINAL UX REBUILD — **설명·제외사유·최종가가 «상세 근거» 로 내려왔다**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴🔴 후보 칸(`MarketColumn`)이 **1차로 올라가면서** 그 안에 같이 있던 세 블록이
       *    첫 화면으로 끌려 올라왔다 — 그것이 CPO 가 NO-GO 로 지목한 **「설명이 먼저
       *    오고 의사결정 정보가 묻힌다」** 그 모양이다. 🟢 그래서 **여기로 옮겼다**.
       * 🔴 **한 글자도 지우지 않았다** — `MI_SAME_EMPTY` · `MI_SAME_EXCLUSION_TEXT` ·
       *    `FINAL_PRICE_LABEL` 과 `data-testid` 넷이 **그대로** 다(이동이지 삭제가 아니다).
       * 🔴 `DETAIL` 에서만 그린다 — 1차(`SUMMARY`)에 두면 되돌아간다.
       * 🔴 **최종 선택 가격은 상세 안에 둔다**(CPO LOCK ⒜ 2026-11-02) — 1차에 올리면
       *    가격 숫자가 넷(권장·국내·해외·최종)이 되어 직관성이 떨어진다는 그 판정이다.
       * 🟢 시장마다 **한 번** 선다(`DETAIL` 블록이 KR·OVERSEAS 둘) ⟹ `market-final-price`
       *    와 `market-edit-final-price` 의 **개수 2 가 그대로** 다(계약 R2).
       */}
      {!isSummary && (
        <>
      {selection.priced.length === 0 ? (
        /** 🔴 「동일상품이 없다」로 적지 않는다 — 부재와 미발견은 다르다. */
        <p data-testid="mi-same-empty" className="text-[11px] text-text-tertiary">
          {MI_SAME_EMPTY}
        </p>
      ) : (
        /**
         * ══════════════════════════════════════════════════════════════════
         * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 A — **중복 표시 surface 를 «제거» 했다**
         * ══════════════════════════════════════════════════════════════════
         *
         * 🔴🔴 여기 있던 `<ul data-testid="mi-same-row">` 가 **같은 후보를 두 번째로**
         *    그렸고, 그쪽이 **접힘 «밖»** 이라 셀러가 **먼저** 보는 표면이었다.
         * ```
         * 실측 — 국내 beaumonde.co.kr 이 mi-same-row «와» mi-candidate-row 양쪽에 ·
         *        해외 4건이 12건 «안» 에 중복
         * 그 표면엔 이미지 **없음** · 판정 라벨 **없음**(🔴 WU-091 「행마다 판정 라벨」
         *        불변식 미준수) · 경고 **없음**
         * ⟹ `-01`·`-02`·`-03` 이 접힘 «안» 을 고쳤는데 **첫 화면이 안 바뀐** 이유다
         * ```
         * 🟢 **가격 집계는 한 글자도 안 죽는다** — 이 영역의 가격 owner 는 위
         *    `<OverseasReferencePrice>` 와 `buildPriceGuide` 이고 `selection.priced` 는
         *    **여기서 표시용** 이었다. `selectMiSameCandidates` **수정 0**.
         * 🟢 **후보도 안 사라진다** — `priced` 는 tier **SAME** + 판매중 + 가격확인이고
         *    `selectCandidateList` 의 `LIKELY_TIERS` 에 **반드시 포함** 된다(`CAND-07`).
         * 🔴 `mi-same-empty`(결론)와 `mi-same-excluded`(제외 사유)는 **유지** — 후보
         *    표면이 아니라 **말** 이다.
         */
        null
      )}
      {/**
        * 🔴 아래 보류 구역은 **CLOSE-03 의 것** 이고 이제 위 리스트의 **부분집합** 이다.
        *    🟢 그래서 **제거** 했다 — 같은 행이 두 번 서면 WU-081 금지에 걸린다.
        */}
      {/**
        * 🔴🔴 **CANDIDATE-EVIDENCE-VISIBILITY-01 — CLOSE-03 의 `mi-presumed-area` 를 «제거» 했다.**
        *    그 구역은 `PRESUMED_SAME` 만 그렸고, 이제 그 행들은 위 **후보 리스트의**
        *    **부분집합** 이다(🟢 유력 군). 🔴 남겨 두면 같은 행이 **두 번** 서고
        *    그것이 WU-081 이 금지한 복제다.
        * 🟢 잃은 것은 **없다** — 범위 문장은 리스트의 그룹 배지가, 접힘은 리스트가,
        *    선택은 같은 `<CandidateSelect>` 가 그대로 들고 있다.
        */}
      {selection.sameButExcluded.length > 0 && (
        <ul data-testid="mi-same-excluded" className="space-y-0.5">
          {selection.sameButExcluded.map(({ row, reason }) => (
            <li key={row.discoveredUrl} className="text-[11px] text-text-tertiary">
              {row.domain} — {MI_SAME_EXCLUSION_TEXT[reason]}
            </li>
          ))}
        </ul>
      )}
      {/**
        * ══════════════════════════════════════════════════════════════════════
        * 🔵🔵🔵 R2 STEP 7/§9 — **「최종 선택 가격」 — 블록의 마지막 줄**
        * ══════════════════════════════════════════════════════════════════════
        *
        * 🟢 국내/해외가 **같은 컴포넌트의 같은 줄** 이라 §6 의 「구조 동일」이 자동으로 성립한다
        *    (전용 카드·전용 블록을 만들지 않았다 · 계약 D 10번 항목).
        * 🔴 이 컴포넌트는 시장마다 **한 번만** 마운트된다(:1089 국내 · :1124 해외) ⟹
        *    금액이 한 화면에 두 번 서지 않는다(`MarketBlock` 의 `SUMMARY/DETAIL` 과 다르다).
        * 🔴 **값을 계산하지 않는다** — `finalPriceKrw` 는 `priceOverrideKrw` 를 그대로 받은 것이다.
        * 🔴 **편집하지 않는다** — 입력칸이 없고, 수정은 기존 `PriceEditor` 로 **보낸다**(§10).
        */}
      {(finalPriceKrw != null || onOpenPriceEditor) && (
        <div data-testid="market-final-price" className="mt-2 border-t border-border/60 pt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="text-[11px] text-text-secondary">{FINAL_PRICE_LABEL}</span>
            {finalPriceKrw != null ? (
              <span className="flex items-baseline gap-1">
                <span
                  data-testid="market-final-price-amount"
                  className="text-lg font-semibold tabular-nums text-text-primary"
                >
                  {formatKrw(finalPriceKrw)}
                </span>
                {/** 🟢 **셀러가 고른 값** 임을 말한다 — 권장가(계산)와 구별되는 유일한 표시다. */}
                <span data-testid="market-final-price-badge" className="text-[11px] text-text-tertiary">
                  {FINAL_PRICE_SELECTED_BADGE}
                </span>
              </span>
            ) : (
              /** 🔴 없는 값을 숫자로 만들지 않는다 — 「0원」·「-」 금지. */
              <span data-testid="market-final-price-none" className="text-[11px] text-text-tertiary">
                {FINAL_PRICE_NONE_TEXT}
              </span>
            )}
          </div>
          {/** 🔴 갈 곳이 없으면 그리지 않는다(이 파일의 기존 규약 · 죽은 링크 금지). */}
          {onOpenPriceEditor && (
            <button
              type="button"
              data-testid="market-edit-final-price"
              onClick={onOpenPriceEditor}
              className="mt-1 text-[11px] text-accent underline"
            >
              {EDIT_FINAL_PRICE_LINK_TEXT}
            </button>
          )}
        </div>
      )}
        </>
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
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-04 — **후보 선택 한 벌.** 두 구역이 **같은 것** 을 쓴다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `SAME` 구역과 보류 구역에 마크업을 **두 벌 두지 않는다** — 두 벌이 되면
 *    한쪽만 고치는 날이 오고, 그게 이 저장소가 반복해 적은 그 함정이다.
 * 🔴 어휘 owner 는 `HUMAN_REVIEW_BUTTON` / `SAVE_STATE_TEXT`(`GeminiTransientCandidates`)
 *    **하나** 다 — 여기서 새 문구를 만들지 않았다(DB check constraint 와 같은 어휘).
 * 🔴 `SIMILAR` 는 이 자리에 **오지 않는다** — 두 선택기가 `SAME` / `PRESUMED_SAME`
 *    만 고르므로 선택 UI 가 **구조적으로** 서지 않는다(CPO §7-A · 계약이 잠근다).
 * 🔴 저장은 **기존 흐름** 이다(`useCandidateReview` → `candidate-reviews` POST) —
 *    새 API 0 · 중복 구현 0.
 */
function CandidateSelect({
  row,
  api,
}: {
  row: GeminiTransientRow;
  api?: CandidateReviewApi;
}): JSX.Element | null {
  /** 🔴 핸들러가 없으면 **아무것도 그리지 않는다**(WU-081 규약). */
  if (!api) return null;
  const chosen = api.review[row.discoveredUrl];
  const save = api.saveState[row.discoveredUrl];
  return (
    <div data-testid="mi-candidate-select" className="mt-1 space-y-0.5">
      <div className="flex flex-wrap gap-1">
        {HUMAN_REVIEW_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            data-testid={`mi-select-${v.toLowerCase()}`}
            aria-pressed={chosen === v}
            onClick={() => api.onReview(row.discoveredUrl, v, { candidate: reviewContextOf(row) })}
            className={
              chosen === v
                ? "rounded border border-accent px-1.5 py-0.5 text-[11px] text-accent"
                : "rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-text-tertiary"
            }
          >
            {HUMAN_REVIEW_BUTTON[v]}
          </button>
        ))}
      </div>
      {/**
        * 🔴🔴 D2(STAGE 2) — **여기에 입력칸을 두지 못한다. 계약이 막았고 그 계약이 맞다.**
        *
        * 1차 구현이 「판단 근거」 `<input>` 을 이 자리에 넣었고 기존 계약
        * `core-2s-seller-screen D-3`(「결론 영역에 **입력칸·요청이 없다**」)이 **FAIL** 했다.
        * 🔴 그 계약의 뜻은 **「셀러에게 조사/재분석을 요구하지 않는다」** 이고, 판단 근거를
        *    적게 하는 것은 **셀러에게 글쓰기를 요구하는 것** 이라 정확히 그 금지에 든다.
        * 🟢 그래서 **계약을 풀지 않고 UI 를 뺐다** — `humanNote` 의 **저장·복원 경로는
        *    살아 있다**(hook `note` · POST `humanNote` · GET 복원 · DB 칸).
        * 🔵 어디에 둘지는 **UX 계약 변경** 이라 CPO 결정이다(STAGE 2 STOP 조건 그대로).
        */}
      {/** 🔴 「눌렀다」가 아니라 **「저장됐다」** 를 말한다(WU-131 §8). */}
      {save ? (
        <span data-testid="mi-select-save" className="text-[11px] text-text-tertiary">
          {SAVE_STATE_TEXT[save]}
        </span>
      ) : null}
    </div>
  );
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 D2(STAGE 2-R) — **「내 판단」 사유를 «선택» 으로 남긴다**(CPO 확정 구조)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **자리가 계약이다** — 결론 카드가 아니라 **`후보 → 근거 확인` 접힘 안** 이다.
 *    1차 구현이 결론 카드에 자유 입력칸을 뒀다가 `core-2s D-3` 로 FAIL 했고,
 *    CPO 가 이 자리로 옮기면서 **선택형** 으로 고정했다.
 * 🔴 **`<input>` 을 쓰지 않는다** — 셀러에게 글쓰기를 요구하지 않는다(그 계약 유지).
 * 🔴 **판정을 고른 뒤에만** 뜬다 — 사유는 판단에 붙는 것이고, 판정이 없으면
 *    저장할 `humanVerdict` 를 **지어내야 한다**(그건 금지다).
 * 🔴 **시스템 판정을 바꾸지 않는다** — 같은 verdict 를 그대로 다시 보내고
 *    `humanNote` 만 더한다(threshold·matchTruth·blocker **0**).
 * 🟢 같은 것을 다시 누르면 **지운다**(토글) — 잘못 고른 것을 되돌릴 수 있어야 한다.
 */
function CandidateNoteChoices({
  row,
  api,
}: {
  row: GeminiTransientRow;
  api?: CandidateReviewApi;
}): JSX.Element | null {
  /** 🔴 핸들러가 없으면 아무것도 그리지 않는다(WU-081 규약). */
  if (!api) return null;
  const chosen = api.review[row.discoveredUrl];
  /** 🔴 판정이 없으면 사유를 받지 않는다 — verdict 를 지어내지 않기 위해서다. */
  if (!chosen) return null;
  const note = api.note?.[row.discoveredUrl] ?? "";
  return (
    <div data-testid="mi-candidate-note" className="mt-1">
      <p className="text-[11px] text-text-tertiary">{HUMAN_NOTE_SECTION_LABEL}</p>
      <div className="flex flex-wrap gap-1">
        {HUMAN_NOTE_OPTIONS.map((label) => (
          <button
            key={label}
            type="button"
            data-testid="mi-note-option"
            aria-pressed={note === label}
            onClick={() =>
              api.onReview(row.discoveredUrl, chosen, {
                /** 🟢 토글 — 같은 것을 다시 누르면 비운다. */
                humanNote: note === label ? "" : label,
                candidate: reviewContextOf(row),
              })
            }
            className={
              note === label
                ? "rounded border border-accent px-1.5 py-0.5 text-[11px] text-accent"
                : "rounded border border-border/60 px-1.5 py-0.5 text-[11px] text-text-tertiary"
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 🔵 D3 — **화면이 이미 들고 있는 «후보 식별» 값만** 보낸다.
 *
 * 🔴🔴 **판정 어휘는 여기서 보내지 않는다** — 1차 구현이 `priceTier`·`crossSellerBlockers`·
 *    `matchTruth` 까지 담았고 계약 둘이 **FAIL** 했다:
 *    `core-e2e-close-04 D-4`(「선택은 가격 집계에 들어가지 않는다」 — 이 함수 소스에
 *    `priceTier` 금지) · `wu-136 E-2`(「이 영역 코드에 내부 판정 토큰이 **문자열로** 없다」).
 *    🟢 그 둘이 맞다 — 선택 UI 가 판정/가격 어휘를 들면 **그 영역이 다시 판정처럼 읽힌다.**
 * 🟢 그래서 **CPO 가 허용한 범위대로** 줄였다(「기존 데이터 모델과 충돌하지 않는 범위에서」).
 *    남긴 것은 D3 의 **핵심 목적** 그대로다 — 재진입에서 「어느 판매처의 무엇을 판단했는가」.
 * 🔴 지어내지 않는다 · 재판정하지 않는다 · 없는 칸은 **보내지 않는다**(`undefined`).
 */
function reviewContextOf(row: GeminiTransientRow): ReviewCandidateContext {
  return {
    domain: row.domain,
    title: row.title ?? undefined,
    market: row.market ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    priceAmount: row.priceAmount ?? undefined,
    priceCurrency: row.priceCurrency ?? undefined,
  };
}

function MarketColumn({
  testId,
  heading,
  /**
   * 🔵🔵🔵 CANDIDATE-UX-REFINE-01 — **이 컴포넌트는 KR·OVERSEAS 가 공유한다.**
   * 🔴 그래서 후보 제목/빈 상태의 시장명을 **글자로 하드코딩하면 국내 칸이 거짓말한다.**
   * 🟢 값은 호출부가 이미 아는 것이고 `selectCandidateList(rows, market)` 와 **같은 union** 이다
   *    (새 타입 0 · 새 추론 0).
   */
  market,
  presumed,
  /** 🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — 후보 리스트(유력 + 확장). */
  list,
  /**
   * 🔵🔵 SOURCING-CARD-MINIMAL-1 — **`reviewApi` 를 구조분해에서 뺐다(타입에는 남는다).**
   * 🔴 사람 판정 표시가 셀러 화면에서 제거되어 이 컴포넌트가 그 값을 **읽지 않는다**.
   * 🟢 **prop·타입·호출부(:798·:832)·`useCandidateReview`(GET/POST)는 그대로** 다 —
   *    그 fetch 를 단언하는 계약이 넷 있고 데이터 경로를 끊지 않는다(CPO §4·§5).
   * 🔴 그래서 **삭제가 아니라 「읽지 않음」** 이다.
   */
  reference,
  referenceProps,
  /**
   * 🔵🔵🔵 R2 STEP 7 — **후보 가격 → 최종가 확정.** 🔴 **값 owner 가 아니다.**
   *
   * 🔴🔴 **FINAL UX REBUILD 에서 셋 중 둘이 빠졌다** — `finalPriceKrw`(표시)와
   *    `onOpenPriceEditor`(수정 링크)는 **상세 근거 블록**(`MarketBlock`
   *    `variant="DETAIL"`)으로 옮겼다. 이 칸이 1차로 올라왔고, 최종 선택 가격을
   *    1차에 두지 않는 것이 CPO LOCK ⒜ 다.
   * 🟢 남은 것은 **후보 카드 안의 「이 가격으로 확정」** 하나다 — 그 버튼은 CPO
   *    목표 화면의 후보 카드 구성에 **들어 있다**.
   */
  onConfirmPriceKrw,
  /**
   * 🔵🔵🔵 MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 — **위 가격 숫자가 SAME 전용인가.**
   *
   * 🔴 `MarketBlock` 은 `g.sameCount === 0` 이면 **서버 집계**(추정 포함)를, 그 외에는
   *    `buildPriceGuide`(**SAME 전용**)를 그린다 — **제목이 같다.** 그래서 SAME 이 하나
   *    생기는 순간 추정 후보의 가격이 화면에서 조용히 빠지는데 카드는 「참고가격에
   *    반영」이라 적고 있었다(운영 DB 실측 `25a3bba7…` — GBP 58 이 그렇게 사라진다).
   * 🟢 값은 호출부가 **같은 함수**(`buildPriceGuide`)로 만든다 — 사본 0 · 새 계산 0.
   */
  sameOnlyPriceAxis,
}: {
  testId: string;
  heading: string;
  market: "KR" | "OVERSEAS";
  sameOnlyPriceAxis?: boolean;
  onConfirmPriceKrw?: (krw: number) => void;
  /**
   * 🔵🔵 CORE-E2E-CLOSE-03 — **동일 «가능성» 후보**(표시 전용).
   * 🔴 `selection` 과 **행이 겹치지 않는다** — 이쪽엔 SAME 이 오지 않는다.
   */
  presumed: readonly GeminiTransientRow[];
  /**
   * 🔵🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — **후보 리스트(유력 + 확장).**
   * 🔴 가격 축과 **같은 Candidate** 다 — 두 목록을 따로 만들지 않는다(CPO §3).
   */
  list: ReadonlyArray<{ row: GeminiTransientRow; group: CandidateListGroup }>;
  reference?: OverseasPriceSummary | null;
  referenceProps: {
    title?: string;
    note?: string;
    scope?: string;
    icon?: string;
    testId?: string;
    amountTestId?: string;
  };
  /**
   * 🔵🔵🔵 CORE-E2E-CLOSE-04 — **후보 선택.** owner 는 `useCandidateReview` 하나다.
   * 🔴 `undefined` 면 선택 UI 가 **렌더되지 않는다**(WU-081 의 그 규약 — `onReview`
   *    없는 구역엔 버튼이 서지 않는다).
   */
  reviewApi?: CandidateReviewApi;
}): JSX.Element {
  return (
    <div data-testid={testId} className="space-y-2">
      <p className="text-[11px] font-medium text-text-primary">{heading}</p>
      {/* 🟢 MI 가 이미 낸 집계. 🔴 환산 0 · 통화별로만(그 성질은 그 컴포넌트의 계약이다). */}
      <OverseasReferencePrice summary={reference} {...referenceProps} />
      {/**
       * 🔵 FINAL UX REBUILD — 이 자리에 있던 세 블록(`mi-same-empty` ·
       *    `mi-same-excluded` · `market-final-price`)은 **상세 근거 블록
       *    (`MarketBlock` `variant="DETAIL"`)으로 옮겼다** — 삭제 0.
       *    🔴 이 칸이 1차로 올라왔으므로 여기 두면 긴 부정문·제외 사유·네 번째
       *       가격 숫자가 **첫 화면에** 선다(CPO NO-GO 의 그 모양).
       */}
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
      {/**
        * ══════════════════════════════════════════════════════════════════════
        * 🔵🔵🔵 CANDIDATE-EVIDENCE-VISIBILITY-01 — **후보 리스트는 «하나» 다**
        * ══════════════════════════════════════════════════════════════════════
        *
        * 🔴🔴 CEO 모순: 「동일하다고 **가격은 뜨는데** 후보군 리스트가 안 보인다」.
        *    같은 Candidate 를 **두 기준** 으로 걸러낸 것이 원인이었다 —
        *    가격 축은 `SAME + 판매중 + 가격확인`, 표시 축은 `PRESUMED_SAME` 만.
        *    ⟹ SIMILAR 은 어디에도 없고, SAME 이라도 품절/가격미확인이면 **둘 다에서** 빠졌다.
        *
        * 🟢 그래서 `selectCandidateList` **하나** 로 그린다 — 유력(🟢) + 확장(🟡).
        * 🔴🔴 **가격이 뜨는 후보는 여기서 사라질 수 없다**(계약 CAND-07).
        * 🔴 가격 **집계** 정책은 변경 0 — 넓힌 것은 **표시** 뿐이다(CPO §4-B).
        * 🔴 기본 **접힘** 유지(WU-091 ① — 펼치면 「유력」으로 읽힌다).
        * 🔴 판정은 **승격하지 않는다** — 각 행의 등급은 그대로이고 배지만 그린다.
        */}
      {list.length > 0 ? (
        <details data-testid="mi-candidate-list" className="mt-1">
          <summary className="cursor-pointer text-[11px] text-text-secondary">
            {/** 🔴 「N곳」은 **`list.length` 파생** 이다 — 상수에 넣으면 실제 행 수와 갈라진다. */}
            {CANDIDATE_LIST_HEADING[market]} {list.length}곳 ·{" "}
            {/**
              * 🔵 §5 — **행동을 적는다.** 「후보가 있다」만 적으면 셀러가 **무엇을 할 수
              *    있는지** 를 모른다(CEO 화면에서 그렇게 보였다).
              * 🔴 `open` 은 붙이지 않는다 — 바뀐 것은 **말** 뿐이다(WU-091 ① 유지).
              */}
            <span data-testid="mi-candidate-list-hint" className="text-accent underline">
              {CANDIDATE_LIST_OPEN_HINT}
            </span>
          </summary>
          {/**
            * ══════════════════════════════════════════════════════════════════
            * 🔵🔵🔵 STEP 6 §4-A — **반복 설명을 지웠다**(CPO 가 지목한 그 문장)
            * ══════════════════════════════════════════════════════════════════
            *
            * 🔴 여기 있던 `CANDIDATE_LIST_NOTE`(「원상품과 같거나 같을 가능성이 높은
            *    판매처입니다.」 27자)가 **국내·해외 양쪽에** 떠서 한 화면에 **54자** 를 썼다.
            * 🟢 **이미 badge 가 그 뜻을 말한다** — 「🟢 동일상품 가능성 높음」 ·
            *    「🟡 동일상품 추정」이 행마다 서 있다(§4-A 「badge 만으로 의미가 전달되면 제거」).
            * 🔴 **판정·가격·판매처·경고·최종가를 지우지 않았다**(§5 금지 전수 확인).
            * 🟢 어휘 상수는 **지우지 않았다** — 화면에서 빼는 것과 어휘를 없애는 것은 다르다.
            */}
          {/**
            * 🔵🔵 U3 — **그룹을 «묶는다».** 전에는 카드마다 라벨이 반복돼 셀러가
            *    「몇 곳이 유력인가」를 세어야 했다.
            * 🔴 그룹 **순서** 는 `CANDIDATE_GROUP_ORDER` 가 owner 다 —
            *    `selectCandidateList` 의 push 순서를 복제하지 않는다.
            * 🔴 빈 그룹은 **렌더하지 않는다**(「0곳」을 적으면 없는 축이 있는 것처럼 읽힌다).
            * 🔴 행은 **옮기기만** 한다 — 복제하면 WU-081 금지에 걸린다(총 행 수 불변).
            */}
          <div className="mt-2 space-y-3">
            {CANDIDATE_GROUP_ORDER.map((group) => {
              const rowsInGroup = list.filter((e) => e.group === group);
              if (rowsInGroup.length === 0) return null;
              return (
                <section
                  key={group}
                  data-testid="mi-candidate-group-block"
                  data-group={group}
                  className="space-y-1"
                >
                  {/**
                    * 🔴 내부 토큰이 아니라 **사람의 말** 이다(CPO §6).
                    * 🔵 U6 — tooltip 은 **U2 와 같은 상수** 를 쓴다(두 벌 금지).
                    *
                    * 🔴🔴 **testid 가 `mi-candidate-group` 이 «아니다».** 그 이름은
                    *    **행 안의** 판정 라벨이 쓰고 있고 그것은 WU-091 이 잠근 불변식
                    *    (「행마다 판정 라벨」)이다. 1차 구현에서 라벨을 여기로 **옮겼다가**
                    *    `ccl-01-H`·`pp-01 PP-09` 가 **2건 FAIL** 로 잡았다 — 가드가 맞았다.
                    *    🟢 그래서 **가드를 고치지 않고** 헤더에 **다른 이름** 을 줬다.
                    */}
                  <p
                    data-testid="mi-candidate-group-heading"
                    title={CANDIDATE_GROUP_NOTE[group]}
                    className="text-[11px] font-medium text-text-secondary"
                  >
                    {CANDIDATE_GROUP_LABEL[group]} {rowsInGroup.length}곳
                  </p>
                  {/**
                    * ══════════════════════════════════════════════════════════════
                    * 🔵🔵🔵 UX-FINAL-01 ⒜ — **그룹 설명 «본문» 을 지웠다. 뜻은 남는다.**
                    * ══════════════════════════════════════════════════════════════
                    *
                    * 🔴 여기 있던 `<p data-testid="mi-candidate-group-note">` 가
                    *    그룹마다 **한 문장을 더** 깔아서, 후보 세 군이 서면 설명문이
                    *    **세 줄** 이 됐다 — 셀러가 보려는 것은 설명이 아니라 **후보** 다.
                    * 🟢 **지운 것은 중복뿐이다** — 같은 문장이 바로 위 헤더의
                    *    `title={CANDIDATE_GROUP_NOTE[group]}` 으로 **그대로 살아 있다**
                    *    (마우스를 올리면 읽힌다). ⟹ 설명은 사라지고 **뜻은 남는다**.
                    * 🔴 **글자를 새로 쓰지 않았다** — 어휘 owner(`CANDIDATE_GROUP_NOTE`)는
                    *    한 글자도 안 바꿨고, 이 WU 의 금지(「텍스트를 늘려 해결」)의 반대다.
                    * 🔴 라벨(`CANDIDATE_GROUP_LABEL`)은 **헤더와 행 양쪽에 그대로** 다 —
                    *    WU-091 의 「행마다 판정 라벨」은 건드리지 않았다.
                    */}
                  <ul className="space-y-1">
                    {rowsInGroup.map(({ row }) => (
                      <li
                        key={row.discoveredUrl}
                        data-testid="mi-candidate-row"
                        data-group={group}
                        data-price-state={priceState(row)}
                        className="rounded border border-border/60 p-2"
                      >
                        {/**
                          * 🔵🔵 U4 — 순서가 **이미지 → 등급 → 가격 → 상품명 → 판매처 → 근거 → 링크** 다.
                          * 🔴 셀러가 먼저 보는 것이 사진이다 — WU-099 에서 CEO 평가 26건 중
                          *    **12건이 「이미지가 없어서」 측정불가** 로 돌아온 그 자리다.
                          * 🔴 없으면 **「이미지 없음」을 적는다**(대체 사진 금지 · WU-132 ④).
                          */}
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            data-testid="mi-candidate-image"
                            src={row.imageUrl}
                            alt=""
                            className="mb-1 h-20 w-20 rounded border border-border/40 object-contain"
                          />
                        ) : (
                          <p
                            data-testid="mi-candidate-image"
                            className="mb-1 text-[11px] text-text-tertiary"
                          >
                            {CANDIDATE_IMAGE_NONE}
                          </p>
                        )}
                        {/**
                          * 🔴🔴 **U4 ② 등급 — 행에서 빼지 않는다.** WU-091 의 네 조건 중
                          *    「행마다 판정 라벨」이고, 빠지면 후보가 **「유력 후보」로 읽힌다**
                          *    (2026-09-19 사고의 기전). 🟢 그룹 헤더가 같은 말을 해도
                          *    **행의 라벨을 대체하지 않는다** — 행은 혼자서도 자기 등급을 말해야 한다.
                          * 🟢 헤더가 이미 크게 말하므로 여기서는 **작고 조용하게** 둔다(중복 소음 최소화).
                          */}
                        {/**
                          * ══════════════════════════════════════════════════════════
                          * 🔵🔵🔵 SOURCING-CARD-MINIMAL-1 ③ — **등급 배지가 «기본 영역» 으로 돌아왔다**
                          * ══════════════════════════════════════════════════════════
                          *
                          * 🔴 CPO 결정 C — 별도 「우리 판단」 영역(`mi-candidate-judgement`)을
                          *    **제거** 하고 **배지만** 기본 카드 정보로 올린다.
                          *    ⟹ 셀러는 상품·가격·동일성·참고가격을 **한 카드에서 바로** 본다.
                          * 🔴🔴 **접두사 `우리 판단:` 을 붙이지 않는다** — CPO §3 이 그 글자를
                          *    셀러 화면 금지어로 지정했다. 🟢 어휘 owner(`CANDIDATE_GROUP_LABEL`)는
                          *    **한 글자도 바꾸지 않았다**(CPO 결정 A — 3그룹·현행 문구 유지).
                          * 🟢 testid(`mi-candidate-group`)는 **그대로** 다 ⟹ WU-091 의
                          *    「행마다 판정 라벨」이 **깨지지 않는다**(배지가 사라지면 2026-09-19 사고).
                          * 🔴 **승격·축소 0** — LIKELY/PRESUMED/POSSIBLE 세 군이 그대로 선다
                          *    (`EXACT`·「동일상품 확정」 같은 새 tier/문구를 만들지 않았다).
                          * 🔴 가격 **위** 에 둔다 — 등급을 모르고 금액부터 읽으면 추정 후보의
                          *    가격을 확정가로 읽는다(UNIFIED-UX-1 이전의 원래 배치이기도 하다).
                          */}
                        <p
                          data-testid="mi-candidate-group"
                          className="text-[11px] text-text-secondary"
                        >
                          {CANDIDATE_GROUP_LABEL[group]}
                        </p>
                        {/**
                          * 🔵🔵🔵 U5 — **가격 3상태.** 🔴 2분법으로 두면 「금액 있음 + 검증 전」이
                          *    확정가와 **똑같이** 보이고 셀러가 그 숫자로 판매가를 정한다.
                          * 🔴 `priceText` 는 **고치지 않는다** — 그 함수는 다른 화면도 쓰고
                          *    계약 둘이 잠갔다. 여기서 **갈라서** 쓴다(환산 0 · 기호 추가 0).
                          */}
                        {/**
                          * ══════════════════════════════════════════════════════════
                          * 🔵🔵🔵 UX-FINAL-01 ⒝ — **가격이 카드에서 «가장 큰 글자» 다**
                          * ══════════════════════════════════════════════════════════
                          *
                          * 🔴🔴 **DOM 순서를 바꾸지 않았다**(CPO 확정 — 「1순위 = 시각 비중」).
                          *    계약 `R2-08`(`group` 이 `price` 보다 **앞**)은 **그대로 통과** 한다 —
                          *    등급은 여전히 가격 위에 서고, 바뀐 것은 **크기·굵기** 뿐이다.
                          * 🔴 왜 — 카드의 모든 줄이 10~11px 였고 가격만 13px/semibold 라
                          *    **차이가 2px** 였다. 셀러가 「얼마에 팔리나」를 보려고 글자를
                          *    훑어야 했다. 🟢 이제 가격이 **한눈에 먼저** 읽힌다.
                          * 🔴 **숫자·통화·상태를 한 글자도 바꾸지 않았다** — `priceText` 무변경 ·
                          *    환산 0 · 기호 추가 0 · P1/P2/P3 판정 0(아래 P2 줄 그대로).
                          */}
                        <p className="text-[17px] font-bold leading-tight text-text-primary">
                          <span data-testid="mi-candidate-price">
                            {row.priceAmount != null && row.priceCurrency
                              ? priceText(row)
                              : CANDIDATE_PRICE_UNKNOWN}
                          </span>
                        </p>
                        {/**
                          * ══════════════════════════════════════════════════════
                          * 🔵🔵🔵 CLOSE-3 §2 — **원본 그대로 + 원화 환산 «추가»**
                          * ══════════════════════════════════════════════════════
                          *
                          * 🔴🔴 **원본을 덮어쓰지 않는다** — 위 `mi-candidate-price` 줄은
                          *    한 글자도 안 바뀌었다(SOURCE 불변). 이 줄은 **추가** 다.
                          * 🔴 **KRW 후보에는 그리지 않는다** — `₩88,000` 아래 `약 ₩88,000` 은
                          *    같은 숫자를 두 번 적는 것이다(§2 「중복 환산 없음」).
                          * 🔴 **환율을 모르면 숫자를 만들지 않는다** — `null` 이면 「원화 환산
                          *    불가」를 적고 **원본 가격은 그대로 남는다**(§2 · P3 가 아니다).
                          * 🔴 이 값은 **집계로 가지 않는다** — `buildPriceGuide` ·
                          *    `OverseasReferencePrice` 는 이 변수를 **읽지 않는다**(§7).
                          */}
                        {row.priceAmount != null &&
                        row.priceCurrency &&
                        row.priceCurrency !== "KRW"
                          ? (() => {
                              /**
                               * 🔵🔵🔵 §4 — **서버 파생값을 읽는다**(자체 환산 제거).
                               * 🔴 `:2658`(확정 버튼)과 **같은 칸** 을 읽으므로
                               *    「표시 KRW == 확정 KRW」가 구조적으로 보장된다.
                               */
                              const derived = derivedKrwOf(row);
                              const krw = derived == null ? null : { amountKrw: derived };
                              return krw ? (
                                <p
                                  data-testid="mi-candidate-price-krw"
                                  className="text-[12px] tabular-nums text-text-secondary"
                                >
                                  {CANDIDATE_PRICE_KRW_PREFIX}
                                  {formatKrw(krw.amountKrw)}
                                </p>
                              ) : (
                                <p
                                  data-testid="mi-candidate-price-krw-unavailable"
                                  className="text-[11px] text-text-tertiary"
                                >
                                  {CANDIDATE_PRICE_KRW_UNAVAILABLE}
                                </p>
                              );
                            })()
                          : null}
                        {/** 🔴 P2 에서만 선다 — 상태가 없으면 P1 과 구별되지 않는다(FAIL-04). */}
                        {!isPriceConfirmed(row) &&
                        row.priceAmount != null &&
                        row.priceCurrency ? (
                          <p
                            data-testid="mi-candidate-price-unverified"
                            className="text-[11px] text-text-tertiary"
                          >
                            {CANDIDATE_PRICE_UNVERIFIED}
                          </p>
                        ) : null}
                        {/**
                          * 🔵 MI-SOURCING-CANDIDATE-TEMPLATE-UNIFICATION-1 — **testid 하나만 더한다.**
                          * 🔴 표시·순서·문구·조건 **변경 0** — 이 줄은 **계약이 볼 수 있게** 하는 것이
                          *    목적이다(전까지 상품명은 testid 가 없어 「국내·해외가 같은 칸을 그린다」를
                          *    기계로 단언할 수 없었다).
                          */}
                        {row.title ? (
                          <p
                            data-testid="mi-candidate-title"
                            className="truncate text-[11px] text-text-primary"
                          >
                            {row.title}
                          </p>
                        ) : null}
                        <p
                          data-testid="mi-candidate-seller"
                          className="truncate text-[11px] text-text-secondary"
                        >
                          {row.domain}
                        </p>
                        {/**
                          * ══════════════════════════════════════════════════════════
                          * 🔵🔵🔵 SOURCING-CARD-MINIMAL-1 ④ — **「우리 판단」 영역이 «없다»**
                          * ══════════════════════════════════════════════════════════
                          *
                          * 🔴 CPO 결정 C·D — 이 자리에 있던 **셋을 전부 셀러 화면에서 뺐다**:
                          * ```
                          * mi-candidate-judgement        별도 영역(div) — 제거
                          * mi-candidate-judgement-basis  판단 근거 한 줄 — 제거
                          * mi-candidate-human-verdict    사람 판정 표시 — 제거(내부 검증 데이터)
                          * ```
                          * 🟢 **등급 배지는 삭제가 아니라 «이동»** 이다 — 위 기본 정보 영역에 산다.
                          * 🔴🔴 **내부 데이터는 한 줄도 지우지 않았다**(CPO §4) —
                          *    `candidateWarningLines` · `candidateEvidenceLines` · `matchReasons` ·
                          *    `crossSellerBlockers` · `human_verdict` · `useCandidateReview`(GET/POST)
                          *    전부 **그대로** 다. 끊긴 것은 **이 카드의 렌더** 하나다.
                          * 🔴 `reviewApi` prop 도 **타입에 남겨 둔다** — 호출부(:798·:832)와 데이터
                          *    경로를 보존한다(그 fetch 를 단언하는 계약이 넷 있다).
                          * 🔴 되살리려면 **CPO 결정이 필요하다** — 「셀러에게 내부 판단을 보여주지
                          *    않는다」가 이 WU 의 합격 기준 자체다.
                          */}
                        {/**
                          * 🔵🔵🔵 CANDIDATE-UX-REFINE-02 ④ — **「확인 필요」만 적는다.**
                          *
                          * 🔴🔴 `-01` 은 여기에 `matchReasons` 를 통째로 그렸고 그것이
                          *    CEO 가 본 FAIL 의 원인이다 — 그 배열은 **내부 진단 로그** 라
                          *    「모델명 유사도 0%」·「브랜드 **불일치**」가 🟢 카드 안에 같이 섰다.
                          * 🟢 이제 owner 는 `candidateWarningLines` 이고 **blockers/conflicts 만** 본다.
                          * 🔴 확인할 것이 없으면 **아무 줄도 서지 않는다** — 「✓ 모든 정보 일치」
                          *    같은 문장을 **만들지 않는다**(CPO §9). 등급이 이미 결과를 말한다.
                          */}
                        {/**
                          * ══════════════════════════════════════════════════════
                          * 🔵🔵🔵 FINAL UX REBUILD — **근거는 카드 «안» 의 접힘으로**
                          * ══════════════════════════════════════════════════════
                          *
                          * 🔴 CPO 목표 화면: 「`matchReasons` · `blockers` · 내부 판정
                          *    문구는 **기본 화면에서 제거**(근거 안으로)」.
                          * 🟢 **줄을 지우지 않았다** — `data-testid` · 어휘 owner
                          *    (`candidateWarningLines`) · DOM 위치가 그대로다. 바뀐 것은
                          *    **감싼 것 하나** 이고 React 는 닫힌 `details` 의 자식도
                          *    렌더하므로 기존 마운트 DOM 계약이 전부 유지된다.
                          * 🔴 `open` 을 **붙이지 않는다** · 확인할 것이 없으면 접힘 자체가
                          *    **서지 않는다**(빈 틀 금지 · 「✓ 모든 정보 일치」 생성 금지).
                          * 🔴 카드의 **조상 `<details>` 수를 늘리지 않는다** — 이것은 카드
                          *    **안쪽** 이라 접힘 깊이 계약(카드 ≤ 1)과 무관하다.
                          */}
                        {/**
                          * 🔵🔵 D1(STAGE 2) — **긍정 근거를 같은 접힘 «안» 에 되살린다.**
                          * 🔴 이것은 복구다 — 운영이 이미 저장한 `matchReasons` 의
                          *    「근거:」 줄이 화면에서 **한 번도 보이지 않고 있었다**.
                          * 🔴 보류(⚠)와 **다른 줄 · 다른 testid · 다른 색** 으로 가른다 —
                          *    섞으면 카드가 다시 「스스로 모순」된다.
                          * 🔴 내부 판정 어휘(`판정방법:`·`판정근거:`)는 leaf 가 버린다.
                          */}
                        {/**
                          * ══════════════════════════════════════════════════════
                          * 🔵🔵🔵 UNIFIED-UX-1 ⑧ — **이 후보가 참고가격에 «쓰였는가»**
                          * ══════════════════════════════════════════════════════
                          *
                          * 🔴🔴 CEO 화면의 실제 불만이 이 줄의 부재였다 — 「확인 1곳」이
                          *    **어느 후보** 인지, 나머지가 **왜 빠졌는지** 알 수 없었다.
                          * 🟢 분모는 이미 맞았다(후보 2 = 반영 1 + 제외 1 · 합계 3이 아니다).
                          *    빠진 것은 **표시** 하나다.
                          * 🔴 **새 규칙 0** — 자격 술어는 집계기와 **같은 owner** 를 쓴다.
                          *    가격 공식·제외 조건 **변경 0**(CPO 실행 조건).
                          * 🔴 접힘 **밖** 에 둔다 — 접으면 또 「안 적는 것」과 같아진다.
                          * 🔴 「모른다」(가격 없음·미확인)면 **줄을 만들지 않는다**.
                          * 🟢 국내·해외가 **같은 카드** 라 이 줄도 두 시장에 **동시에** 선다.
                          */}
                        {CANDIDATE_PRICE_USE_LABEL[candidatePriceUse(row, { sameOnlyPriceAxis })] ? (
                          <p
                            data-testid="mi-candidate-price-use"
                            data-use={candidatePriceUse(row, { sameOnlyPriceAxis })}
                            className={
                              candidatePriceUse(row, { sameOnlyPriceAxis }) === "USED"
                                ? "mt-1 text-[11px] text-text-secondary"
                                : "mt-1 text-[11px] text-text-tertiary"
                            }
                          >
                            {CANDIDATE_PRICE_USE_LABEL[candidatePriceUse(row, { sameOnlyPriceAxis })]}
                          </p>
                        ) : null}
                        {/**
                          * ══════════════════════════════════════════════════════════
                          * 🔵🔵🔵 SOURCING-CARD-MINIMAL-1 ⑤ — **상세 근거 접힘이 «없다»**
                          * ══════════════════════════════════════════════════════════
                          *
                          * 🔴 CPO 결정 C — `mi-candidate-evidence` 접힘과 그 안의
                          *    `mi-candidate-evidence-line` 을 **셀러 화면에서 제거** 했다.
                          *    ⟹ 「판단 근거 펼쳐보기」 UI 가 **0** 이다(§8 계약).
                          * 🔴🔴 **JUDGEMENT-DEDUP-1 을 되돌린 것이 아니다.** 그 WU 는 같은
                          *    문장이 **두 곳** 에 서는 것을 고쳤고, 이번에는 CPO 가 **두 곳 모두**
                          *    셀러에게 보여주지 않기로 결정했다 ⟹ 중복은 **여전히 0** 이다.
                          * 🟢 생산자 `candidateEvidenceLines` 는 **그대로 살아 있다**(leaf 무변경) —
                          *    내부 분석·GT·API 가 계속 쓴다. 끊긴 것은 **이 카드의 렌더** 하나다.
                          * 🟢 `CANDIDATE_EVIDENCE_FOLD_LABEL` 상수도 **지우지 않았다** —
                          *    다른 표면(`GeminiTransientCandidates`)이 그 값을 쓴다.
                          * 🔴 셀러가 보는 것은 **상품 · 가격 · 동일성 배지 · 참고가격 상태** 넷이다.
                          */}
                        {/**
                          * 🔵 ⑤ — **선택과 이동을 같은 줄에** 둔다(CPO §4 목업).
                          * 🟢 선택은 **기존 저장 흐름** 이다(CLOSE-04 · 새 저장 로직 0 ·
                          *    row binding·API 변경 0).
                          * 🔴 링크의 **target 은 그대로** 다 — 글자만 짧게 적어 URL 소음을 없앤다.
                          */}
                        {/**
                          * ══════════════════════════════════════════════════════
                          * 🔵🔵🔵 R2 STEP 7/§8 — **「이 가격으로 확정」(후보 가격 → 최종가)**
                          * ══════════════════════════════════════════════════════
                          *
                          * 🔴🔴 **원화 후보에서만 그린다.** `priceOverrideKrw` 는 KRW 칸이고
                          *    외화 금액을 거기 넣으려면 **환산** 이 필요하다 — 환산은 이 트랙의
                          *    금지축이다(§9 · §19 · `overseas-reference.ts`). 🟢 그래서 버튼을
                          *    숨기고 **이유를 한 줄로 적는다**(조용히 빼지 않는다).
                          * 🔴 **새 가격을 만들지 않는다** — `onConfirmPriceKrw` 는
                          *    `updateSalePriceKrw`(:1452) 그 함수이고 `PriceEditor` 가 쓰는 것과 같다.
                          * 🔴 **candidate 원본 가격을 건드리지 않는다**(§12) — 읽기만 한다.
                          */}
                        {onConfirmPriceKrw && row.priceAmount != null && row.priceCurrency
                          ? (() => {
                              /**
                               * 🔵🔵🔵 CLOSE-3 §4 — **외화 후보도 환산 KRW 로 확정한다.**
                               *
                               * 🔴 넘기는 값은 위 줄이 **화면에 이미 보여준 그 환산값** 이다
                               *    (같은 함수 · 같은 숫자 · 추정/보정 0).
                               * 🔴🔴 **SOURCE 는 불변** — `row.priceAmount`(GBP 37)를 고치지
                               *    않고 `priceOverrideKrw`(SELLING)에 **KRW 만** 기록한다.
                               * 🔴 환율을 모르면 **버튼을 그리지 않는다**(확정할 숫자가 없다).
                               */
                              /**
                               * 🔵🔵🔵 §4 — **확정 KRW 는 «표시한 그 값» 이다.**
                               *
                               * 🔴🔴 이 줄이 이 WU 에서 **가장 중요한 자리** 다(CPO 지목) —
                               *    여기서 나온 숫자가 `priceOverrideKrw` 로 **실제 판매가
                               *    확정에** 들어간다. 전에는 `:2486`(표시)과 이 줄이 **각각**
                               *    `convertToKrwStrict` 를 환율 없이 불렀고, 둘이 갈릴 수 있었다.
                               * 🟢 이제 **둘 다 `row.priceKrwDerived` 하나를 읽는다**
                               *    ⟹ 「표시 KRW == 확정 KRW」가 구조적으로 성립한다.
                               * 🔴 KRW 후보는 환산하지 않고 원본을 그대로 쓴다(기존 성질 보존).
                               * 🔴 환율을 모르면 `null` ⟹ 아래가 **버튼을 그리지 않는다**(보존).
                               */
                              const krw =
                                row.priceCurrency === "KRW" ? row.priceAmount : derivedKrwOf(row);
                              if (krw == null) {
                                return (
                                  <p
                                    data-testid="mi-candidate-confirm-unavailable"
                                    className="mt-1 text-[11px] text-text-tertiary"
                                  >
                                    {CONFIRM_PRICE_NO_RATE_NOTE}
                                  </p>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  data-testid="mi-candidate-confirm-price"
                                  onClick={() => onConfirmPriceKrw(krw)}
                                  className="mt-1 rounded border border-border px-2 py-0.5 text-[11px] font-medium text-text-primary hover:bg-surface"
                                >
                                  {CONFIRM_CANDIDATE_PRICE_LABEL}
                                </button>
                              );
                            })()
                          : null}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          {/**
                            * 🔵🔵 UNIFIED-UX-1 ⑦ — **동일상품 «선택» 버튼 넷을 제거했다**(CPO 승인 ⒝).
                            * 🔴 CEO 가 원한 것은 셀러가 후보를 하나씩 고르는 화면이 «아니라»
                            *    시스템이 내린 판단과 근거를 보여주는 화면이다.
                            * 🟢 기존 human_verdict **39건은 보존** 되고 「우리 판단」 영역에
                            *    참고로 표시된다 · `useCandidateReview`·POST·DB **변경 0**.
                            * 🔴🔴 그 대가 — **새 사람 판정 입력이 끊긴다 ⟹ GT 신규 누적 중단**
                            *    (CPO 인정 · 「계속 누적된다」로 보고하지 않는다).
                            */}
                          {/**
                            * 🔵 MI-SOURCING-CANDIDATE-TEMPLATE-UNIFICATION-1 — **testid 하나만 더한다.**
                            * 🔴 `href`·`target`·`rel`·문구·위치 **변경 0** — CPO §7 의 「링크 정상
                            *    작동」을 기계로 단언하려면 계약이 이 앵커를 찾을 수 있어야 한다.
                            */}
                          <a
                            data-testid="mi-candidate-link"
                            href={row.discoveredUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-[11px] text-accent underline"
                          >
                            {CANDIDATE_LINK_TEXT}
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </details>
      ) : (
        <>
          <p data-testid="mi-candidate-empty" className="text-[11px] text-text-tertiary">
            {CANDIDATE_LIST_EMPTY[market]}
          </p>
          {/**
           * ══════════════════════════════════════════════════════════════════
           * 🔵🔵🔵 SELLER-UX-IMPLEMENTATION-1 ④ — **분모 설명을 1차에서 내린다**
           * ══════════════════════════════════════════════════════════════════
           *
           * 🔴 조사 실측 — 이 문장은 🇰🇷/🌎 **두 블록에서 글자가 완전히 같고** 각 45자라
           *    둘이 **90자 = CASE D 1차의 23%** 를 썼다. CPO: 「분모 설명을 첫 화면에
           *    여러 번 보여주지 않는다 · **상세는 삭제하지 않고 열어볼 수 있게 보존**」.
           * 🟢 그래서 **지우지 않고 `<details>` 안으로** 넣었다 — 셀러가 「왜 0인가」를
           *    물을 때 그 자리에서 열린다(정보 손실 **0**).
           * 🔴 **1차 요약 문장(`mi-candidate-empty`)은 그대로 둔다** — 「후보가 없다」는
           *    사실 자체는 판단 재료다. 내린 것은 **우리 내부 분모 사정** 뿐이다.
           * 🔴 testid 를 **바꾸지 않았다** — 기존 계약이 이 이름으로 그 문장을 찾는다.
           */}
          <details data-testid="mi-candidate-empty-why">
            <summary className="cursor-pointer text-[11px] text-text-tertiary">
              {CANDIDATE_LIST_EMPTY_WHY_SUMMARY}
            </summary>
            <p data-testid="mi-candidate-empty-note" className="text-[11px] text-text-tertiary">
              {CANDIDATE_LIST_EMPTY_NOTE}
            </p>
          </details>
        </>
      )}
    </div>
  );
}
