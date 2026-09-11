/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — "분석 기준 시장"을 화면 전체에서 한 곳으로 모은다.
 *
 * ── 이 파일이 존재하는 이유 ───────────────────────────────────────────────
 * 지금까지 "이 상품은 한국에서 팔 만한가"라는 질문의 *한국*이 화면 어디에도
 * 명시돼 있지 않았다. 판매 판단은 이미 한국 시장을 기준으로 계산되는데
 * (KR_MARKET 관측 기준), 화면에는 €75(DE)·€84(INT)·₩162,000(KR)이 같은 층위로
 * 나열돼 있어서 "무엇을 기준으로 판단한 결과인지"를 셀러가 역추적해야 했다.
 *
 * ── 절대 하지 않는 추론 ───────────────────────────────────────────────────
 * 통화·도메인·판매자 신고 국가로 시장을 지어내지 않는다. 구체적으로:
 *   EUR  → 독일        ✕ (유로는 20개국이 쓴다)
 *   KRW  → 한국        ✕ (해외 사이트도 원화를 표시한다)
 *   .kr  → 한국        ✕ (도메인은 판매 시장이 아니다)
 *   ES   → 스페인 시장 ✕ (market_country는 *판매자가 신고한 국가*다)
 *   en-int → 특정 국가 ✕ (국제 공용 페이지라 국가가 아니다)
 *
 * 판단 근거로 쓰는 것은 관측된 시장 코드(market_code, 예: "en-kr") 하나뿐이다.
 * DB에서 market_country(판매자 신고 국가)와 market_code(관측된 시장)는 서로
 * 다른 사실이고, 이 파일은 그 둘을 절대 같은 값으로 취급하지 않는다 —
 * isKoreanMarket()이 marketCountry를 인자로조차 받지 않는 것이 그 장치다.
 */

/** 지금 판매 판단이 서 있는 시장. 미래에 시장 선택기가 생기면 이 값이 상태가 된다. */
export interface TargetMarket {
  /** 시장 코드의 지역 파트(소문자 2자). market_code "en-kr"의 "kr". */
  region: string;
  flag: string;
  /** 배너에 그대로 쓰는 나라 이름. */
  label: string;
  /** 목록/배지에 쓰는 짧은 이름. */
  shortLabel: string;
}

export const KR_TARGET_MARKET: TargetMarket = {
  region: "kr",
  flag: "🇰🇷",
  label: "대한민국",
  shortLabel: "한국 시장",
};

/**
 * 오늘 지원하는 판단 시장 목록. 배열로 두는 이유는 화면 때문이 아니라
 * 구조 때문이다 — 미래에 시장 선택기가 생겼을 때 이 배열에 원소를 더하는
 * 것만으로 배너가 선택기가 되어야 하고, "한국"이라는 문자열이 컴포넌트
 * 안에 하드코딩돼 있으면 그때 다시 찾아 고쳐야 한다.
 */
export const SUPPORTED_TARGET_MARKETS: TargetMarket[] = [KR_TARGET_MARKET];

/**
 * 관측된 시장 코드에서 지역 코드만 읽는다. 코드에 적혀 있지 않으면 null이다 —
 * 여기서 통화나 도메인으로 보충하지 않는다.
 *
 * 허용하는 모양은 DomesticPriceIntelligencePanel의 marketLabel()과 같다:
 *   "kr" / "en-kr"  → "kr"
 *   "en-int"        → null (국가가 아니다)
 *   null / ""       → null (시장 미확인)
 */
export function parseMarketRegion(marketCode: string | null | undefined): string | null {
  const code = marketCode?.trim().toLowerCase() ?? "";
  if (!code) return null;
  return /^(?:[a-z]{2}-)?([a-z]{2})$/.exec(code)?.[1] ?? null;
}

/**
 * 이 관측이 판단 시장(오늘은 한국)의 관측인가.
 *
 * 인자가 marketCode 하나뿐인 것은 의도적이다. 판매자 신고 국가(market_country)를
 * 넘길 수 있게 두면 언젠가 누군가 그것으로 시장을 판정하게 된다 — 타입으로 막는다.
 */
export function isTargetMarket(marketCode: string | null | undefined, target: TargetMarket = KR_TARGET_MARKET): boolean {
  return parseMarketRegion(marketCode) === target.region;
}

/** 오늘의 판단 시장이 한국이므로 자주 쓰는 형태를 별칭으로 둔다. */
export function isKoreanMarket(marketCode: string | null | undefined): boolean {
  return isTargetMarket(marketCode, KR_TARGET_MARKET);
}

/**
 * 관측 목록을 "판단 시장"과 "그 외 참고 시장"으로 가른다. 합치거나 평균 내지
 * 않는다 — 가격은 Source+Market 단위이고 시장끼리 섞으면 그 순간 의미가 사라진다.
 */
export function splitByTargetMarket<T extends { marketCode: string | null }>(
  observations: T[],
  target: TargetMarket = KR_TARGET_MARKET,
): { target: T[]; overseas: T[] } {
  const inTarget: T[] = [];
  const overseas: T[] = [];
  for (const o of observations) {
    if (isTargetMarket(o.marketCode, target)) inTarget.push(o);
    else overseas.push(o);
  }
  return { target: inTarget, overseas };
}
