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
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-INVESTIGATION-STATE-UX-2 ③ — **판매 비추천에서는 «기본 행동» 으로 주지 않는다**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기준선 덤프(CASE B)가 잡은 모양 — 화면이 「🔴 판매 비추천」이라 말하면서 바로 아래에
 *    「권장 판매가격 ₩115,200 · **이 가격으로 설정**」을 **기본 행동** 으로 내밀었다.
 * 🟢 CPO 확정 — 「가격 계산은 유지하되, 비추천 상태에서는 그 **행동의 노출과 안내** 를
 *    재검토한다. **기존 가격 편집 기능 자체는 삭제하지 않는다**」.
 * 🔴 그래서 **없애는 것은 CTA 하나** 다 — 권장가 A 숫자 · ⓘ 가격 계산 기준 · 「가격 수정 →」
 *    (= `PriceEditor` 로 가는 길)은 **전부 그대로** 다. 셀러가 팔고 싶으면 **직접 넣는다**.
 * 🔴 **A 를 계산하지 않게 만든 것이 아니다** — A 는 원가 기반이고 판정과 무관하다
 *    (메모 `recommended-price-is-cost-based-a-not-market-b`). 바뀐 것은 **권유** 뿐이다.
 * 🔴 「팔지 마세요」로 적지 않는다 — 판정 문구의 owner 는 `FINAL_VERDICT_COPY` 다.
 * 🔴 **금액을 품지 않는다** — 위 CTA 와 같은 이유(1차 `₩ count = 1` 계약).
 */
export const APPLY_SUPPRESSED_BY_VERDICT_NOTE =
  "목표마진에 미달해 이 가격을 바로 권하지 않습니다 — 직접 정하려면 「가격 수정」을 쓰세요.";

/* ═══════════════════════════════════════════════════════════════════════════
   🔵🔵🔵 UI/UX FINAL SPRINT R2 STEP 7 — **최종 선택 가격의 «말»**
   ═══════════════════════════════════════════════════════════════════════════
   🔴 어휘 owner 를 새로 만들지 않았다 — A 의 말이 사는 **이 파일** 에 같이 둔다
      (두 파일이 되면 「권장가」와 「최종가」가 서로 다른 어휘 규칙을 갖는다).
   🔴 **값 owner 는 `priceOverrideKrw` 하나** 이고 이 파일은 **글자만** 갖는다. */

/** 🟢 셀러가 **고른** 값의 이름. 🔴 「권장 판매가격」(A)과 **다른 것** — A 는 계산, 이것은 결정이다. */
export const FINAL_PRICE_LABEL = "최종 선택 가격";

/** 🔴 아직 고르지 않았을 때. 🔴 「0원」·「-」로 적지 않는다(없는 값을 숫자로 만들지 않는다). */
export const FINAL_PRICE_NONE_TEXT = "아직 선택하지 않았습니다";

/** 🟢 **셀러가 고른** 값임을 말한다 — 「시스템이 계산했다」와 구별되는 유일한 표시다. */
export const FINAL_PRICE_SELECTED_BADGE = "✓ 선택됨";

/**
 * 🔵 후보 카드의 CTA. 🔴 `APPLY_RECOMMENDED_PRICE_LABEL`(「이 가격으로 설정」)과
 *    **다른 글자** 를 쓴다 — 가리키는 대상이 다르다(그쪽은 권장가 A · 이쪽은 **그 후보의 가격**).
 * 🔴 금액을 품지 않는다(금액 owner 는 그 카드의 가격 줄 하나다).
 */
export const CONFIRM_CANDIDATE_PRICE_LABEL = "이 가격으로 확정";

/**
 * 🔴 **이 영역은 편집하지 않는다** — 기존 `PriceEditor` 로 가는 길의 이름이다(CPO 결정 ⒝).
 */
export const EDIT_FINAL_PRICE_LINK_TEXT = "가격 수정 →";

/**
 * 🔴🔴 **외화 후보에는 확정 CTA 를 그리지 않는다 — 그 사실을 «말로» 적는다.**
 *
 * 🔴 `priceOverrideKrw` 는 **KRW** 칸이고, 외화 후보 금액을 거기 넣으려면 **환산** 이
 *    필요하다. 환산은 이 트랙의 **금지축** 이다(`overseas-reference.ts` 「통화별로만
 *    집계 · 합계 칸이 없다」 · 지시서 §9 「임의 환산하여 표시하지 않는다」 · §19).
 * 🟢 그래서 **버튼을 숨기고 이유를 적는다** — 조용히 빼면 셀러가 「왜 어떤 후보만
 *    확정이 되는가」를 알 수 없다.
 */
/**
 * 🔴🔴 **폐기됨**(CPO LOCK 2026-11-02) — 「외화는 확정하지 않는다」가 **철회** 됐다.
 *    🟢 이제 외화 후보도 **환산 KRW 로** 확정한다(CLOSE-3 §0).
 * 🔴 상수를 **지우지 않은 이유** — 그 결정이 있었다는 기록이고, 되돌리려면 **CPO 결정** 이
 *    필요하다는 표시다. 🔴 화면 소비처는 **0** 이다(계약이 그것을 문다).
 */
export const CONFIRM_PRICE_FOREIGN_NOTE = "원화 후보에서만 확정할 수 있습니다";

/* ═══════════════════════════════════════════════════════════════════════════
   🔵🔵🔵 CLOSE-3 §0 — **후보 카드 «안» 의 원화 환산**
   ═══════════════════════════════════════════════════════════════════════════
   🔴 허용 범위는 **후보 카드 내부뿐** 이다 — 가격 요약·집계·`buildPriceGuide`·
      `OverseasReferencePrice`·WU-148 통화별 의미는 **한 글자도 바뀌지 않는다**.
   🔴 환산 **owner 는 `convertToKrwStrict`** 하나다(새 환율 API 0 · 새 상수 0). */

/** 🟢 「약」 — 폴백 환율일 수 있으므로 **확정값처럼 적지 않는다**(보조 표시다). */
export const CANDIDATE_PRICE_KRW_PREFIX = "약 ";

/** 🔴 환율을 모르는 통화 — **숫자를 만들지 않는다**(원본 가격은 그대로 남는다). */
export const CANDIDATE_PRICE_KRW_UNAVAILABLE = "원화 환산 불가";

/** 🔴 환산을 못 하면 확정할 숫자가 없다 ⟹ 버튼 대신 이 줄(갈 곳 없는 버튼 금지). */
export const CONFIRM_PRICE_NO_RATE_NOTE = "환율 정보가 없어 확정할 수 없습니다";

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

/* ═══════════════════════════════════════════════════════════════════════════
   🔵🔵🔵 MI-PRICE-BASIS-DISPLAY-1 — **A 와 B 는 «전제» 가 다르다**(CPO 2026-11-08)
   ═══════════════════════════════════════════════════════════════════════════
   🔴🔴 CPO 가 고정한 세 의미 — 이 셋을 **합치지 않는다**:
   ```
   추천 판매가격 A   원가 기반으로 **목표마진을 달성하는** 판매가격
   시장가격 B        실제 시장에서 **관측된** 가격 근거
   판단              **B 가 목표마진 조건을 충족하는가**
   ```
   🔴 「두 가격이 다르다는 이유로 어느 한쪽을 임의 수정하지 않는다」(CPO 명시).
   🔴 **새 판정 owner 를 만들지 않았다** — 판단은 위 `marketPriceBasisLine` 이 이미
      쓰는 **그 비교**(`marketPriceKrw` ↔ `recommendedPriceKrw`)에서 나온다.
      A 는 「목표마진을 반영한 가격」이므로 **B < A 면 목표마진 미달** 이 산술적으로 참이다.
   🔴 `recommendedPriceKrw` 유지 · 시장가격 산출 공식 유지 · CASE A/B/C/D 유지 ·
      정책 A 유지 · 국내 EXACT 자격 유지 · GET 집계 owner 유지 · 원본 통화 유지.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 🔴 A 의 **전제**. 금액이 아니라 「그 숫자가 무엇인가」를 말한다. */
export const PRICE_BASIS_A_NOTE = `${RECOMMENDED_PRICE_LABEL} — 원가에 목표마진을 더한 가격입니다`;
/** 🔴 B 의 **전제**. 「시장 평균/적정가」로 적지 않는다(관측값이다 · WU-146 어휘 계약). */
export const PRICE_BASIS_B_LABEL = "국내 시장 참고가격";
export const PRICE_BASIS_B_NOTE = `${PRICE_BASIS_B_LABEL} — 국내에서 실제로 확인된 가격입니다`;
/**
 * 🔴 1차에 서는 **기준 라벨**. 🔴 **금액을 품지 않는다** — 계약 셋이 B 금액 노출을 막는다
 *    (`UX-04-c` · `core-next-step4 B-6` · `C-4` · 전부 CPO 확정 WU 산출).
 *    🟡 금액을 열려면 그 셋을 같이 개정해야 하고 그것은 **CPO 판정 사안** 이다.
 */
export const PRICE_BASIS_B_BASIS_LABEL = `${PRICE_BASIS_B_LABEL} 기준`;

/**
 * 🔴 **판단 한 줄.** B 가 목표마진을 충족하는지만 말한다.
 *    🔴 「팔지 마세요」·「추천」으로 적지 않는다 — 판매 판정의 owner 는 `FINAL_VERDICT_COPY`
 *       이고 그 문구는 **상단 요약과 Action Center** 가 말한다(결론 영역은 근거다).
 *    🔴 둘 중 하나가 없으면 **null** — 없는 데이터로 판단을 지어내지 않는다.
 */
export function priceBasisVerdictLine(input: {
  recommendedPriceKrw?: number | null;
  marketPriceKrw?: number | null;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 SELLER-UX-IMPLEMENTATION-1 ⒜ — **후보에 가격이 있으면 「판단 불가」를 말하지 않는다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴🔴 조사가 찾은 **1차 모순**(`SELLER-UX-GAP-INVESTIGATION-1` §2-⒝) — 같은 1차에:
   * ```
   * 「국내 시장가격이 **확인되지 않아** 목표마진 달성 여부를 판단할 수 없습니다」
   * 「🇰🇷 국내 동일상품 **확인 가격 KRW 88,000**」      ← 바로 아래 줄
   * ```
   *    앞 문장은 **B**(서버 `domesticCompetition` 산출), 뒤 문장은
   *    `buildPriceGuide(POST transient rows)` 를 본다 ⟹ 후보가 transient 로만 오면
   *    **B 가 null 로 남아** 화면이 스스로 모순된다. 🔴 `40bb52c7` 이 만든 자리다.
   * 🟢 CPO 승인 **최소 수정** — 「B 도 없고 **rows 도 비어 있을 때만**」 그 문구를 세운다.
   * 🔴🔴 **POST 를 GET 집계 owner 로 승격하는 것이 아니다**(CPO 명시) — 이 값은
   *    **표시 게이트용 불리언 하나** 이고 금액·건수·집계에 **들어가지 않는다**.
   */
  hasCandidatePrice?: boolean;
}): string | null {
  const { recommendedPriceKrw, marketPriceKrw } = input;
  if (recommendedPriceKrw == null) return null;
  /**
   * 🔴🔴 **B 가 없으면 「판단 불가」를 말한다 — 빈 자리를 두지 않는다.**
   *
   * 🔴 이 자리를 처음 구현했을 때 `marketPriceKrw == null` 이면 **줄 자체를 만들지
   *    않았다.** 그런데 판정 머리말을 뺀 자리가 바로 여기라서, **B 가 없는 CASE D**
   *    (가장 흔한 상태)에서 결론 영역의 첫 줄이 **통째로 비었다**(계약 둘이 잡았다).
   * 🟢 CPO 판단 원칙 ⒟ — 「근거 없는 판정 금지 · 데이터 없으면 **UNKNOWN / 데이터 없음**」.
   *    🔴 「달성 가능」으로도 「어렵다」로도 적지 않는다 — **모른다** 가 정확한 상태다.
   */
  if (marketPriceKrw == null) {
    /**
     * 🔴 **후보에 가격이 있으면 그 줄을 만들지 않는다**(CPO 승인 ⒜). 「없다」고 말하면
     *    바로 아래 블록이 보여주는 금액과 **같은 화면에서 모순** 된다.
     * 🟢 그 상태의 가격 근거는 🇰🇷/🌎 블록이 **이미** 말한다(새 문장 0).
     */
    if (input.hasCandidatePrice) return null;
    return "국내 시장가격이 확인되지 않아 목표마진 달성 여부를 판단할 수 없습니다.";
  }
  if (marketPriceKrw < recommendedPriceKrw) {
    return "현재 시장가격으로는 목표마진 달성이 어렵습니다.";
  }
  return "현재 시장가격으로도 목표마진을 달성할 수 있습니다.";
}
