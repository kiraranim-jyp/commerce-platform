/**
 * N-4.01 Part J(대표님 지시) — 가격 판단 엔진. 단순 가격 "표시"에서 끝내지
 * 않고, 원가/현재 판매가/국내 시장가를 종합해 🟢유지 · 🟡조정검토 · 🔴마진위험
 * 세 상태 중 하나로 판정한다. 순수 함수(외부 호출 없음) — 국내 시장가가 아직
 * 없으면(domesticAveragePriceKrw=null) 경쟁력 비교 없이 마진만으로 판단한다
 * (있지도 않은 국내 시세를 지어내지 않는다, PART G 미연결 상태에서도 안전).
 */
export type PriceDecisionVerdict = "MAINTAIN" | "CONSIDER_LOWER" | "MARGIN_RISK";

/**
 * P0-D.2(CEO 결정, 2026-09-20) — 국내가격이 «어느 매칭 등급» 에서 왔는가.
 * `summarizeDomesticMarketSplit` 의 basis 와 같은 값이다(새 어휘가 아니다).
 */
export type DomesticPriceBasis = "EXACT" | "COMPARISON" | "NONE";

export interface PriceDecisionInput {
  costPriceKrw: number;
  currentSellingPriceKrw: number;
  domesticAveragePriceKrw: number | null;
  domesticLowestPriceKrw: number | null;
  /**
   * **위 두 숫자가 «어디서 왔는가».**
   *
   * ── 왜 필요한가 ──────────────────────────────────────────────────────────
   * 지금까지 이 함수는 숫자만 받았고, 그래서 그 가격이 «같은 상품» 의 것인지
   * «비슷해 보이는 다른 상품» 의 것인지 알 방법이 구조적으로 없었다.
   *
   * 실측(2026-09-20, 국내가격 보유 51건): EXACT 없이 COMPARISON 만 있는 6건 중
   * 4건이 `CONSIDER_LOWER` 였다. 즉 **같은 상품이 아닌 물건의 가격을 근거로
   * 판매자에게 「가격을 낮추라」고 권하고 있었다.** 그 말을 따르면 근거 없이
   * 싸게 판다.
   *
   *   EXACT       같은 상품이 국내에서 이 값에 팔린다  → 판정에 쓴다
   *   COMPARISON  비슷해 보이는 «다른» 상품의 값       → 🔴 판정에 쓰지 않는다
   *   NONE        국내 관측 없음                       → 쓸 값이 없다
   *
   * 🔴 COMPARISON 을 «0 으로» 취급하지 않는다. 판정 «입력에서 제외» 할 뿐이고,
   *    그 값은 참고정보로 화면에 그대로 남는다(CEO 명시).
   *
   * ── 🔴 undefined 의 뜻 ──────────────────────────────────────────────────
   * 「호출부가 아직 티어를 구분하지 않는다」이다. 그때는 예전과 똑같이 동작한다 —
   * 이번 변경으로 «조용히» 판정이 달라지는 호출부를 만들지 않기 위해서다.
   * 2026-09-20 기준 그런 호출부는 `compute-readiness.ts` 하나이고(그 파일은
   * summarizeDomesticMarket 으로 EXACT/COMPARISON 을 «합산» 한다), 이번 스프린트
   * 범위 밖이라 그대로 두었다.
   */
  domesticBasis?: DomesticPriceBasis;
  /** 마진율이 이 값(%) 미만이면 무조건 MARGIN_RISK(경쟁력과 무관) — 기본 10%. */
  marginFloorPercent?: number;
  /** 국내 평균가보다 이 비율(%) 이상 비싸면 CONSIDER_LOWER 후보 — 기본 10%. */
  competitiveGapPercent?: number;
}

export interface PriceDecisionResult {
  verdict: PriceDecisionVerdict;
  marginPercent: number;
  /** 국내 평균가 대비 현재 판매가 차이(%). 양수=더 비쌈. 국내 시세 없으면 null. */
  priceGapVsAveragePercent: number | null;
  /** N-4.18-H(대표님 지시, 2026-08-25: "🔴일 때는 최저가 대비로, 🟢일 때는
   * 평균가 대비로 보여줘야 경각심/안심 둘 다 정확히 전달된다") — 국내 최저가
   * 대비 현재 판매가 차이(%). 양수=더 비쌈. 최저가 데이터 없으면 null. */
  priceGapVsLowestPercent: number | null;
  reason: string;
}

const DEFAULT_MARGIN_FLOOR_PERCENT = 10;
// PART J 예시(현재 239,000 vs 국내 평균 219,000, gap ≈9.1%)가 🟡로 분류되므로
// 기본 threshold를 그 값보다 낮게 잡는다 — 10%로 두면 그 예시조차 MAINTAIN이
// 되어 대표님이 준 기준과 어긋난다.
const DEFAULT_COMPETITIVE_GAP_PERCENT = 5;

export function computePriceDecision(input: PriceDecisionInput): PriceDecisionResult {
  const {
    costPriceKrw,
    currentSellingPriceKrw,
    domesticAveragePriceKrw: reportedDomesticAveragePriceKrw,
    domesticLowestPriceKrw: reportedDomesticLowestPriceKrw,
    domesticBasis,
    marginFloorPercent = DEFAULT_MARGIN_FLOOR_PERCENT,
    competitiveGapPercent = DEFAULT_COMPETITIVE_GAP_PERCENT,
  } = input;

  /**
   * 🔴 P0-D.2 정책 A(CEO 결정, 2026-09-20) — **EXACT 만 판정에 쓴다.**
   *
   * 여기서 하는 일은 «제외» 뿐이다. COMPARISON 가격을 0 으로 바꾸지 않고,
   * 없애지도 않는다 — 판정의 입력에서만 빼고 참고정보로는 그대로 산다.
   *
   * 🔴 그래서 새 분기를 만들지 않았다. 아래에 이미 「국내 시세를 아직 모르면
   *    마진만으로 유지 판정한다 — 없는 경쟁가격을 만들어내지 않는다」는 문이
   *    있고, COMPARISON 만 있는 상품은 정확히 그 상태다. 그 문을 그대로 탄다.
   *
   * undefined(호출부가 티어를 모름)는 예전과 같게 둔다 — 위 타입 주석 참고.
   */
  const domesticUsableForDecision = domesticBasis == null || domesticBasis === "EXACT";
  const domesticAveragePriceKrw = domesticUsableForDecision ? reportedDomesticAveragePriceKrw : null;
  const domesticLowestPriceKrw = domesticUsableForDecision ? reportedDomesticLowestPriceKrw : null;

  const marginPercent =
    currentSellingPriceKrw > 0
      ? Number((((currentSellingPriceKrw - costPriceKrw) / currentSellingPriceKrw) * 100).toFixed(1))
      : 0;

  const priceGapVsAveragePercent =
    domesticAveragePriceKrw && domesticAveragePriceKrw > 0
      ? Number((((currentSellingPriceKrw - domesticAveragePriceKrw) / domesticAveragePriceKrw) * 100).toFixed(1))
      : null;
  const priceGapVsLowestPercent =
    domesticLowestPriceKrw && domesticLowestPriceKrw > 0
      ? Number((((currentSellingPriceKrw - domesticLowestPriceKrw) / domesticLowestPriceKrw) * 100).toFixed(1))
      : null;

  // 마진 자체가 바닥 미만이면 경쟁력과 무관하게 무조건 위험 — 국내 시세가
  // 아무리 낮아도 손해를 보면서 유지/인하를 권할 수 없다.
  if (marginPercent < marginFloorPercent) {
    return {
      verdict: "MARGIN_RISK",
      marginPercent,
      priceGapVsAveragePercent,
      priceGapVsLowestPercent,
      reason:
        marginPercent < 0
          ? `현재 판매가(₩${currentSellingPriceKrw.toLocaleString()})가 원가(₩${costPriceKrw.toLocaleString()})보다 낮습니다 — 판매할수록 손해입니다.`
          : `예상 마진 ${marginPercent}%가 최소 기준(${marginFloorPercent}%) 미만입니다 — 가격 인하 금지, 판매가 유지 또는 판매 중지를 검토하세요.`,
    };
  }

  // 국내 시세를 아직 모르면(PART G 미연결/조회 실패) 마진만으로 유지 판정한다
  // — 없는 경쟁가격을 만들어내지 않는다.
  if (priceGapVsAveragePercent === null) {
    return {
      verdict: "MAINTAIN",
      marginPercent,
      priceGapVsAveragePercent: null,
      priceGapVsLowestPercent: null,
      reason: `예상 마진 ${marginPercent}%로 기준을 충족합니다(국내 가격 비교 데이터 없음 — 마진 기준으로만 판단).`,
    };
  }

  // N-4.18-H(대표님 지시: "🔴일 때는 최저가 대비로 경각심을, 🟢일 때는 평균가
  // 대비로 안심을 정확히 전달") — CONSIDER_LOWER는 최저가 대비 문구를
  // 우선한다(최저가 데이터 있을 때만, 없으면 평균가 문구로 폴백 — 지어내지 않음).
  if (priceGapVsAveragePercent > competitiveGapPercent) {
    const reason =
      priceGapVsLowestPercent != null
        ? `현재 판매가가 국내 최저가(₩${domesticLowestPriceKrw!.toLocaleString()})보다 ${priceGapVsLowestPercent}% 높습니다(마진 ${marginPercent}%는 충분) — 가격 인하를 검토해보세요. 국내 평균가는 ₩${domesticAveragePriceKrw!.toLocaleString()}입니다.`
        : `현재 판매가가 국내 평균(₩${domesticAveragePriceKrw!.toLocaleString()})보다 ${priceGapVsAveragePercent}% 높습니다(마진 ${marginPercent}%는 충분) — 가격 인하를 검토해보세요.`;
    return { verdict: "CONSIDER_LOWER", marginPercent, priceGapVsAveragePercent, priceGapVsLowestPercent, reason };
  }

  return {
    verdict: "MAINTAIN",
    marginPercent,
    priceGapVsAveragePercent,
    priceGapVsLowestPercent,
    reason: `현재 판매가: ₩${currentSellingPriceKrw.toLocaleString()}, 국내 평균: ₩${domesticAveragePriceKrw!.toLocaleString()}, 예상 마진: ${marginPercent}% — 가격 경쟁력이 있어 유지를 권장합니다.`,
  };
}

/** N-4.07 Sprint(대표님 지시: "전체 등록상태/대시보드에 가격경쟁력을 🟢🟡🔴로,
 * 단 데이터가 없으면 🔴가 아니라 ⚪ 판단불가로") — verdict 3-state에 "아직 계산
 * 못함"을 더한 4번째 값. 서버(대시보드 API)와 클라이언트(패널 UI) 양쪽에서
 * 같은 매핑을 쓰기 위해 packages/pricing에 둔다 — 두 곳에 각자 새로 만들지
 * 않는다. */
export type PriceLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export function priceLevelFromVerdict(verdict: PriceDecisionVerdict | null): PriceLevel {
  if (!verdict) return "UNKNOWN";
  if (verdict === "MAINTAIN") return "GREEN";
  if (verdict === "CONSIDER_LOWER") return "YELLOW";
  return "RED";
}
