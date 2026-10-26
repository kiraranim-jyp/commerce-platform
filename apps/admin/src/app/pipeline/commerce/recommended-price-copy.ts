/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-NEXT STEP 4 — **권장 판매가격(A)의 «말» owner**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **A 와 B 를 합치지 않는다**(CPO 확정 2026-10-26):
 * ```
 * A 권장 판매가격 = 착지원가 + 수수료 + 목표마진   ← `breakdown.suggestedPriceKrw`
 *                   (= `profitability.recommendedPriceKrw` · `PriceEditor` 가 쓰는 그 값)
 * B 시장가격      = 국내 EXACT 최저가 기반 추천     ← `computePriceRecommendation()`
 * ```
 * 🔴 **B 를 「권장 판매가격」으로 승격하지 않는다** — B 는 **근거 한 줄** 로만 선다.
 * 🔴 **「ⓘ 가격 계산 기준」은 A 전용** 이다(B 설명으로 바꾸지 않는다).
 *
 * ── 🔴🔴 왜 이 파일이 «따로» 생겼는가 ──────────────────────────────────────
 * ```
 * 이 말들을 `mi-same-candidates.ts`(SAME 선별기)에 두면 기존 계약
 * `wu-139 B-5` 가 **FAIL** 한다 — 그 파일은 "권장"·"margin"·"추천가" 리터럴과
 * 「마진 N%」 같은 **계산 서술 자체** 를 금지한다(선별기에 가격 계산 어휘가
 * 들어오는 것을 막는 가드다).
 * 🟢 그래서 **가드를 느슨하게 하지 않고 코드를 옮겼다** — WU-133 이
 *    `blocker-text.ts` 를 따로 만든 것과 **같은 선례** 다.
 * ```
 *
 * 🔴 이 파일은 **계산하지 않는다** — 환율·원가·수수료·목표마진을 모른다.
 *    받는 것은 ⒜ 이미 계산된 A ⒝ 서버가 이미 낸 B 와 B 의 마진율뿐이다.
 */

/** 🟢 A 의 이름. 🔴 「추천/적정 판매가」가 아니다 — 화면 두 곳(확정 카드 · 결론 영역)이 **같은 말** 을 쓴다. */
export const RECOMMENDED_PRICE_LABEL = "권장 판매가격";

/**
 * 🟢 「왜 그 값인가」로 가는 **단 하나의 통로.**
 * 🔴 `PriceEditor` 의 「가격 계산 기준 보기 →」와 **같은 핸들러** 를 쓴다 —
 *    문구가 둘이어도 도착지가 하나여야 셀러가 두 설명을 비교하지 않는다.
 */
export const PRICE_CALCULATION_LINK_TEXT = "ⓘ 가격 계산 기준 보기";

/**
 * 🔵🔵🔵 CORE-UX-SELLER-01 — **A 를 실제 판매가격으로 확정하는 CTA 의 «말».**
 *
 * 🔴 **새 가격을 만들지 않는다** — 누르면 `updateSalePriceKrw(recommendedPriceKrw)`
 *    하나를 부른다. 즉 `PriceEditor` 의 「최종 판매가격에 적용」(:158)과 **같은 동작** 이고
 *    **같은 handler** 다(사본 0 · 새 state 0 · 재계산 0).
 * 🔴 **금액을 품지 않는다** — 「₩」가 이 문구에 들어오면 1차의 `₩ count = 1` 계약이
 *    깨진다(금액 owner 는 바로 위 A 줄 하나다).
 * 🔴 「추천/적정/시장가로 설정」이 아니다 — **셀러가 보고 있는 그 가격(A)** 을 가리킨다.
 */
export const APPLY_RECOMMENDED_PRICE_LABEL = "이 가격으로 설정";

/**
 * 🔵🔵🔵 CORE-UX-SELLER-01 ① — **1차 판매판단 줄의 머리말.**
 *
 * 🔴🔴 **`MARKET_RESULT_HEADING`(「💡 판매 판단」)과 «다른 것» 이다 — 합치지 않는다:**
 * ```
 * MARKET_RESULT_HEADING   결론 «문장» 블록(`seller-decision` 여러 줄)의 제목
 *                         🔴 CORE-2AO-R2 가 그것을 **상세로 내렸고** 계약 둘이
 *                            「1차로 되돌아오면 FAIL」을 문다
 *                            (core-2v:232 · wu-146:222)
 * SELL_VERDICT_HEADING    **한 줄 verdict**(🟡 조건부 판매)의 머리말
 *                         🟢 CPO 가 1차에 세우라고 확정한 것이 **이것** 이다(2026-10-26)
 * ```
 * 🔴 그러므로 이 상수를 「💡 판매 판단」으로 바꾸면 그 계약 둘이 FAIL 한다 —
 *    **그것은 가드가 맞는 것이다**(둘은 다른 요소다).
 * 🟢 글자는 오른쪽 Action Center 의 머리말(`ActionCenter.tsx:128`)과 **같다** —
 *    같은 것을 좌우에서 다른 말로 부르지 않는다.
 */
export const SELL_VERDICT_HEADING = "판매 판단";

/**
 * 🔴 **B 근거 한 줄.**
 *
 * 🔴 **금액을 적지 않는다** — 금액 owner 는 시장 블록 하나다(CORE-2AO-R1 §금액 owner).
 *    그래서 「KRW 258,000」 같은 숫자가 이 줄에 들어오지 않는다.
 * 🟢 쓰는 숫자는 **서버가 이미 낸 마진율 하나** 이고, 방향(낮다/높다)은 A 와의
 *    **대소 비교** 다 — 새 가격을 만들지 않는다(§4 ABSOLUTE FREEZE 준수).
 * 🔴 **「목표마진 미달」로 단정하지 않는다** — 목표 마진 «값» 은 이 영역에 없다.
 *    🟢 대신 A 가 **목표 마진을 반영한 값** 이라는 사실을 적는다(정의상 참이다).
 * 🔴 둘 중 하나라도 없으면 **줄을 만들지 않는다**(없는 말을 지어내지 않는다).
 */
export function marketPriceBasisLine(input: {
  marketPriceKrw?: number | null;
  marketPriceMarginPercent?: number | null;
  recommendedPriceKrw?: number | null;
}): string | null {
  const { marketPriceKrw, marketPriceMarginPercent, recommendedPriceKrw } = input;
  if (marketPriceKrw == null || marketPriceMarginPercent == null) return null;
  /** 🟢 퍼센트 표기는 이 저장소의 기존 규약 그대로다(`mi-headline` · `price-hierarchy`). */
  const head = `국내 시장가격에 맞추면 예상 마진 ${marketPriceMarginPercent.toFixed(1)}% 입니다`;
  if (recommendedPriceKrw == null) return `${head}.`;
  if (marketPriceKrw < recommendedPriceKrw) {
    return `${head} — ${RECOMMENDED_PRICE_LABEL}(목표 마진 반영)보다 낮습니다.`;
  }
  if (marketPriceKrw > recommendedPriceKrw) {
    return `${head} — ${RECOMMENDED_PRICE_LABEL}(목표 마진 반영)보다 높습니다.`;
  }
  return `${head} — ${RECOMMENDED_PRICE_LABEL}과 같습니다.`;
}
