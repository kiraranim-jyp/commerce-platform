/**
 * N-4.01 Part E/G/H/I(대표님 지시) — "해외직구 → 국내 판매 가격 자동
 * 비교·감시"의 데이터 모델. `price-intelligence.ts`의 `PriceObservation`(실시간
 * 1회 조회 결과, DB에 저장하지 않음)과 이름이 겹치지 않도록 DB에 실제로
 * 쌓이는 이력 행은 `PriceObservationRecord`로 구분한다 — 저장 스키마와
 * 실시간 조회 스키마를 섞으면 나중에 "이 타입이 DB 행인지 API 응답인지"
 * 헷갈리는 문제가 생긴다(이 파일이 packages/database 마이그레이션
 * 027_price_observations.sql의 컬럼과 1:1로 대응한다).
 */

/** PART H — 특정 소스 하나를 식별한다. 하드코딩된 enum이 아니라 문자열이지만
 * (마이그레이션 주석과 동일한 이유 — 소스 추가 시 스키마 변경 불필요), 실제
 * 코드에서 만들 수 있는 값은 이 상수로만 제한한다("임의 소스명 방지").
 *
 * N-4.06(대표님 지시) — DOMESTIC_SHOP 추가: 사전 등록된 국내 편집샵에서
 * "동일상품 검증(domestic_product_links.verified=true)"까지 마친 뒤 수집한
 * 가격. NAVER_SHOPPING(검색 기반, 동일상품 검증 없이 후보만 찾음)과는
 * 신뢰도가 다르다 — summarizeDomesticMarket()이 이 둘을 구분해서 처리한다. */
export const PRICE_OBSERVATION_SOURCES = ["SELLER_ORIGIN", "NAVER_SHOPPING", "DOMESTIC_SHOP"] as const;
export type PriceObservationSource = (typeof PRICE_OBSERVATION_SOURCES)[number];

export interface PriceObservationRecord {
  id: string;
  snapshotId: string;
  source: PriceObservationSource;
  sourceLabel: string | null;
  sourceProductUrl: string | null;
  /** N-4.06 — DOMESTIC_SHOP일 때만 채워진다. domestic_price_sources.id를
   * 가리킨다(sourceLabel은 표시용 텍스트라 오타/개명에 취약 — 안정적인 조인은
   * 이 필드로 한다). */
  sourceRefId: string | null;
  currency: string;
  priceAmount: number;
  shippingCostAmount: number | null;
  taxAmount: number | null;
  exchangeRate: number | null;
  priceKrw: number;
  /** N-4.18-G STEP G-1(대표님 지시, 2026-08-25) — priceKrw(실제 판매가, 할인가
   * 있으면 할인가)의 의미는 그대로 두고, 할인/정가/품절 여부를 별도 필드로
   * 추가한다. 실측되지 않았거나(사이트가 정가/할인가를 구분해 보여주지
   * 않음) 아직 그 사이트용 파서를 만들지 않았으면 null — 0원/false를
   * 지어내지 않는다. */
  salePriceKrw: number | null;
  originalPriceKrw: number | null;
  /** null=판정 불가(그 사이트 품절 감지 미구현/판단 불가), true=실제 품절
   * 확인, false=실제 판매 가능 확인 — "정보 없음"과 "판매중"을 같은 값으로
   * 취급하지 않는다(대표님 명시 원칙). */
  soldOut: boolean | null;
  checkedAt: string;
}

/** PART G(N-4.06으로 갱신) — 국내 시장 요약. 저장하지 않고 조회 시점에 계산한다
 * (파생값 중복 저장 금지 원칙). 리스팅이 하나도 없으면 null 필드로 정직하게
 * 남긴다 — 0원을 최저가로 지어내지 않는다.
 *
 * N-4.06 Part 11(대표님 지시: "네이버 검색 결과를 가지고 바로 '국내 최저가'라고
 * 판단하면 안 된다") — DOMESTIC_SHOP(사전 등록 편집샵, 동일상품 검증됨)이
 * 하나라도 있으면 그것만으로 요약을 계산한다(Primary). DOMESTIC_SHOP이
 * 하나도 없을 때만 NAVER_SHOPPING(동일상품 검증 없는 검색 후보)으로
 * 폴백하고, `tier: "SECONDARY"`로 명시해 호출부가 "이건 확정된 국내
 * 최저가가 아니라 참고용 후보"라는 걸 구분할 수 있게 한다. */
export type DomesticMarketTier = "PRIMARY" | "SECONDARY" | "NONE";

export interface DomesticMarketSummary {
  tier: DomesticMarketTier;
  lowestPriceKrw: number | null;
  highestPriceKrw: number | null;
  averagePriceKrw: number | null;
  sellerCount: number;
  /** "대표 경쟁상품" — 최저가 리스팅 상위 몇 개. N-4.07 Sprint(대표님 지시:
   * "출처 + 가격 + 확인시간을 보여준다") — checkedAt을 추가한다(이전엔 요약
   * 전체의 checkedAt만 있고 리스팅별로는 없었다). */
  sampleListings: {
    mallName: string | null;
    priceKrw: number;
    productUrl: string | null;
    checkedAt: string;
    salePriceKrw: number | null;
    originalPriceKrw: number | null;
  }[];
  /** N-4.18-G STEP G-4(대표님 지시: "품절 상품을 최저가 계산에 포함시키면
   * 안 됩니다") — soldOut===true로 확인된 리스팅은 위 lowest/highest/average/
   * sellerCount 계산에서 제외하고 여기 따로 담는다(화면에는 보여주되 가격
   * 계산에는 안 쓴다). */
  soldOutListings: { mallName: string | null; productUrl: string | null; checkedAt: string }[];
  checkedAt: string | null;
}

/** N-4.07 Sprint(대표님 지시: "오래된 가격은 🟡 오래된 가격 표시") — 이 값보다
 * 오래된 관측치는 "여전히 최신 데이터인 것처럼" 보여주지 않는다. cron이 매일
 * 도는 게 정상이니 7일이면 이미 여러 번 갱신 실패가 이어졌다는 뜻이다. */
export const STALE_PRICE_DAYS = 7;

export function isPriceStale(checkedAt: string, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - new Date(checkedAt).getTime();
  return ageMs > STALE_PRICE_DAYS * 24 * 60 * 60 * 1000;
}

/** N-4.11 STEP1(대표님 지시: "오늘 확인/1~6일/7~30일/30일+/가격 없음을 명확하게") —
 * isPriceStale()의 단순 boolean보다 세분화된 단계. 새 신뢰도 판정이 아니라
 * "확인한 지 얼마나 됐는지"만 보여주는 표시용 값 — STALE/VERY_STALE 둘 다
 * isPriceStale()==true 구간과 정확히 겹친다(7일 경계를 두 곳에서 서로 다르게
 * 재정의하지 않는다). */
export type PriceAgeTier = "TODAY" | "RECENT" | "STALE" | "VERY_STALE";

export function priceAgeTier(checkedAt: string, now: Date = new Date()): PriceAgeTier {
  const ageDays = (now.getTime() - new Date(checkedAt).getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < 1) return "TODAY";
  if (ageDays < STALE_PRICE_DAYS) return "RECENT";
  if (ageDays < 30) return "STALE";
  return "VERY_STALE";
}

/** N-4.18-G STEP G-4(대표님 지시: "VERIFIED + ACTIVE + 현재 판매 가능 →
 * 가격 경쟁력 계산", "품절 상품을 최저가 계산에 포함시키면 안 됩니다") —
 * soldOut===true인 관측치만 최저/평균/최고가·sellerCount 계산에서 뺀다.
 * soldOut===false 또는 null(그 사이트 품절 감지 미구현)은 기존과 동일하게
 * 포함한다 — RULII 외 사이트는 항상 soldOut=null이라 이 변경으로 기존
 * 가격비교 결과가 달라지지 않는다(회귀 없음). */
function summarizeFrom(records: PriceObservationRecord[], tier: DomesticMarketTier): DomesticMarketSummary {
  const activeRecords = records.filter((r) => r.soldOut !== true);
  const soldOutRecords = records.filter((r) => r.soldOut === true);
  const checkedAt = records.reduce((latest, r) => (r.checkedAt > latest ? r.checkedAt : latest), records[0].checkedAt);
  const soldOutListings = soldOutRecords.map((r) => ({
    mallName: r.sourceLabel,
    productUrl: r.sourceProductUrl,
    checkedAt: r.checkedAt,
  }));

  if (activeRecords.length === 0) {
    return {
      tier,
      lowestPriceKrw: null,
      highestPriceKrw: null,
      averagePriceKrw: null,
      sellerCount: 0,
      sampleListings: [],
      soldOutListings,
      checkedAt,
    };
  }

  const prices = activeRecords.map((r) => r.priceKrw);
  const lowestPriceKrw = Math.min(...prices);
  const highestPriceKrw = Math.max(...prices);
  const averagePriceKrw = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  const sorted = [...activeRecords].sort((a, b) => a.priceKrw - b.priceKrw);
  return {
    tier,
    lowestPriceKrw,
    highestPriceKrw,
    averagePriceKrw,
    sellerCount: activeRecords.length,
    sampleListings: sorted.slice(0, 5).map((r) => ({
      mallName: r.sourceLabel,
      priceKrw: r.priceKrw,
      productUrl: r.sourceProductUrl,
      checkedAt: r.checkedAt,
      salePriceKrw: r.salePriceKrw,
      originalPriceKrw: r.originalPriceKrw,
    })),
    soldOutListings,
    checkedAt,
  };
}

const EMPTY_SUMMARY: DomesticMarketSummary = {
  tier: "NONE",
  lowestPriceKrw: null,
  highestPriceKrw: null,
  averagePriceKrw: null,
  sellerCount: 0,
  sampleListings: [],
  soldOutListings: [],
  checkedAt: null,
};

export function summarizeDomesticMarket(records: PriceObservationRecord[]): DomesticMarketSummary {
  const verified = records.filter((r) => r.source === "DOMESTIC_SHOP");
  if (verified.length > 0) return summarizeFrom(verified, "PRIMARY");
  const candidates = records.filter((r) => r.source === "NAVER_SHOPPING");
  if (candidates.length > 0) return summarizeFrom(candidates, "SECONDARY");
  return EMPTY_SUMMARY;
}

/** PART I-1 — 전일 대비 가격 변화("8/22 189,000 → 8/23 179,000, -10,000/-5.29%").
 * 같은 소스의 관측치를 checked_at 내림차순으로 봤을 때 가장 최근 2개를 비교한다.
 * 관측치가 2개 미만이면(오늘 처음 수집했거나 어제 수집 실패) 비교 불가로
 * null을 돌려준다 — 0%로 지어내지 않는다. */
export interface PriceChange {
  oldPriceKrw: number;
  newPriceKrw: number;
  changeAmountKrw: number;
  changeRatePercent: number;
  oldCheckedAt: string;
  newCheckedAt: string;
}

export function computePriceChange(
  recordsForSource: PriceObservationRecord[],
): PriceChange | null {
  if (recordsForSource.length < 2) return null;
  const sorted = [...recordsForSource].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));
  const [latest, previous] = sorted;
  const changeAmountKrw = latest.priceKrw - previous.priceKrw;
  const changeRatePercent =
    previous.priceKrw !== 0 ? Number(((changeAmountKrw / previous.priceKrw) * 100).toFixed(2)) : 0;
  return {
    oldPriceKrw: previous.priceKrw,
    newPriceKrw: latest.priceKrw,
    changeAmountKrw,
    changeRatePercent,
    oldCheckedAt: previous.checkedAt,
    newCheckedAt: latest.checkedAt,
  };
}

/** N-4.03 Part 5(대표님 지시) — "오늘/어제/7일전/30일전" 추세. 각 기준일에
 * 가장 가까운(그 날짜 이전 중 최신) 관측치를 찾는다 — 정확히 그 날짜에
 * 관측 기록이 없어도(가격체크를 며칠 걸렀거나 최근에 시작한 상품) 합리적인
 * 값을 돌려준다. 비교 대상 자체가 없으면(관측 이력이 1건뿐 등) trend는
 * "NEW"로 — 오르지도 내리지도 않은 게 아니라 "아직 비교할 과거가 없다"는
 * 뜻이라 "UNCHANGED"와 구분한다. */
export type PriceTrend = "UP" | "DOWN" | "UNCHANGED" | "NEW";

export interface PriceTrendResult {
  current: number | null;
  previous: number | null;
  change: number | null;
  changeRate: number | null;
  trend: PriceTrend;
}

function closestObservationAtOrBefore(
  sorted: PriceObservationRecord[],
  targetIso: string,
): PriceObservationRecord | null {
  // sorted는 checkedAt 내림차순(최신 먼저)이라고 가정 — target 이하인 것 중 첫 번째(=가장 최신).
  return sorted.find((r) => r.checkedAt <= targetIso) ?? null;
}

export function computePriceTrend(
  recordsForSource: PriceObservationRecord[],
  daysAgo: number,
  now: Date = new Date(),
): PriceTrendResult {
  const sorted = [...recordsForSource].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));
  const current = sorted[0]?.priceKrw ?? null;
  if (current == null) {
    return { current: null, previous: null, change: null, changeRate: null, trend: "NEW" };
  }
  const targetDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  // 오늘(daysAgo=0)이 아닌 이상, 최신 관측치 자체를 "과거"로 다시 잡지 않도록
  // 최신보다 하루 이상 이전인 것만 후보로 본다.
  const candidates = daysAgo === 0 ? sorted : sorted.slice(1);
  const previousRecord = closestObservationAtOrBefore(candidates, targetDate.toISOString());
  if (!previousRecord) {
    return { current, previous: null, change: null, changeRate: null, trend: "NEW" };
  }
  const previous = previousRecord.priceKrw;
  const change = current - previous;
  const changeRate = previous !== 0 ? Number(((change / previous) * 100).toFixed(2)) : 0;
  const trend: PriceTrend = change > 0 ? "UP" : change < 0 ? "DOWN" : "UNCHANGED";
  return { current, previous, change, changeRate, trend };
}
