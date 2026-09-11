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
  /** N-4.18-Q3 PART E-1(대표님 지시, 2026-08-27: "가격이 없어도 품절이라는
   * 중요한 운영 정보는 보존") — 완전 품절이라 가격 자체를 못 찾은 경우
   * (soldOut===true && 가격 없음) null. 0원을 지어내지 않는다. */
  priceAmount: number | null;
  shippingCostAmount: number | null;
  taxAmount: number | null;
  exchangeRate: number | null;
  priceKrw: number | null;
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
  /**
   * GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 마이그레이션 046이 저장해 두기만
   * 하던 관측 근거를 여기서 처음으로 읽는다. 실측(Bobo Choses B226AC043):
   * /en-kr ₩162,000 · /en-de €75 · /en-int €84 — 같은 판매처인데 시장마다
   * 가격이 다르고, €75와 €84는 통화까지 같다. "통화가 같으면 같은 시장"이
   * 성립하지 않는다는 뜻이라, 관측 당시 실제로 요청/확인된 코드를 그대로
   * 들고 다녀야 집계가 서로 다른 시장의 가격을 섞지 않는다.
   *
   *  marketCode    : 요청/확인된 시장 코드 그대로("", en-kr, en-int …). null
   *                  이거나 ""면 "시장 미확인"이다 — 어떤 시장으로도 바꿔
   *                  적지 않는다(기존 행은 전부 null이고 backfill하지 않는다).
   *  marketCountry : source가 스스로 선언한 기준 국가(/meta.json의 country 등).
   *                  null이면 "기준 국가 미확인" — 통화나 도메인에서 지어내지
   *                  않고, 반대로 이 값으로 시장을 역추론하지도 않는다.
   */
  marketCode: string | null;
  marketCountry: string | null;
  checkedAt: string;
}

/** 화면이 빈 값을 "어떤 시장"처럼 보여주지 않도록 문구를 한 곳에 둔다 —
 * 행을 숨기거나 추측으로 채우는 대신 모른다고 적는다(CPO 지시). */
export const UNKNOWN_MARKET_LABEL = "시장 미확인";
export const UNKNOWN_MARKET_COUNTRY_LABEL = "기준 국가 미확인";

/** 시장별 독립 집계 1건. markets끼리는 절대 합산하거나 서로 비교하지 않는다 —
 * €75(DE)와 €84(INT)를 하나의 "유럽 가격"으로 묶는 순간 둘 다 사실이 아니게
 * 된다(실측 근거는 PriceObservationRecord.marketCode 주석 참조). */
export interface MarketPriceSummary {
  /** 관측된 market_code 그대로(trim/소문자 정규화만). null = 시장 미확인. */
  marketCode: string | null;
  /** 이 시장의 관측들이 공통으로 선언한 기준 국가. 서로 다르면 null —
   * 하나로 단정하지 않는다. */
  marketCountry: string | null;
  lowestPriceKrw: number;
  highestPriceKrw: number;
  averagePriceKrw: number;
  /** 이 시장 안에서 본 판매처 수(Source 단위 distinct). */
  sellerCount: number;
  lowestPriceCheckedAt: string;
}

/** 한 판매처가 시장별로 낸 가격 1건. 원본 통화/금액을 함께 보존한다 —
 * 화면이 "🇩🇪 DE €75"처럼 관측된 그대로 보여줄 수 있어야 하고, 원화 환산값만
 * 남기면 시장이 다르다는 사실이 다시 사라진다. */
export interface SellerMarketPrice {
  marketCode: string | null;
  marketCountry: string | null;
  currency: string;
  priceAmount: number | null;
  priceKrw: number;
  productUrl: string | null;
  checkedAt: string;
}

/**
 * UX 2.4(CEO 지시, 2026-09-11) — **한 판매처가 시장마다 낸 가격 한 줄**.
 *
 * SellerMarketPrice와 필드가 겹치지만 따로 두는 이유는 soldOut 하나다. 위
 * SellerMarketPrice는 국내 비교상품 집계(summarizeFrom)가 이미 품절 행을
 * 걸러낸 뒤에 만드는 값이라 재고 상태를 들고 다닐 이유가 없었다. 판매자
 * 글로벌 시장 카드는 반대다 — "🇺🇸 미국 $53"이 지금 살 수 있는 가격인지
 * 품절인지가 매입처를 고르는 판단 그 자체이고, 셋(판매중/품절/확인 불가)을
 * 하나로 뭉개면 다시 "확인 못 한 것"이 "판매중"으로 읽힌다.
 */
export interface MarketObservation {
  /** 관측된 market_code 그대로(trim/소문자 정규화만). */
  marketCode: string;
  /** 그 시장 관측들이 공통으로 선언한 판매자 신고 국가. 서로 다르면 null. */
  marketCountry: string | null;
  currency: string;
  priceAmount: number | null;
  priceKrw: number;
  productUrl: string | null;
  /** null=재고 판정 불가, true=품절 확인, false=판매중 확인. */
  soldOut: boolean | null;
  checkedAt: string;
}

/**
 * UX 2.4(CEO 지시, 2026-09-11) — 관측 목록을 **시장별 최신 1건**으로 접는다.
 *
 * ── 계산하지 않는다 ─────────────────────────────────────────────────────
 * 최저/평균/최고를 내지 않는다. 시장끼리 비교하거나 합치지도 않는다. 이미
 * 저장된 행 중 시장마다 가장 최근 것을 고르고 순서만 정한다 — 여기서 평균을
 * 내는 순간 "판매자 글로벌 평균가"라는, 어느 시장에도 존재하지 않는 아홉
 * 번째 가격이 생긴다.
 *
 * ── market_code가 없는 행은 시장이 아니다 ────────────────────────────────
 * ""/null은 "시장 미확인"이고(로케일 프리픽스 없는 기본 요청) 그 행은 곧
 * 원본 판매자 페이지 관측 그 자체다 — 화면에서는 이미 "원본 판매가격"으로
 * 한 번 나온다. 여기에 다시 담으면 같은 숫자가 두 카드에 뜬다. 그래서
 * 걸러낸다: 통화·도메인·판매자 신고 국가로 시장을 지어내는 대신 아예 빼는 것이
 * 이 파일이 지켜온 "관측된 사실만 적는다"의 같은 규칙이다.
 *
 * priceKrw가 없는 행(완전 품절이라 가격 자체를 못 찾음)도 빠진다 — 시장
 * 가격을 말하는 줄인데 말할 가격이 없다(0원을 지어내지 않는다).
 */
export function groupMarketObservations(records: PriceObservationRecord[]): MarketObservation[] {
  const priced = records.filter((r): r is PricedRecord => r.priceKrw != null && marketKeyOf(r) !== "");
  return [...groupByKey(priced, marketKeyOf).entries()]
    .sort(([a], [b]) => compareMarketKey(a, b))
    .map(([marketKey, marketRecords]) => {
      const latest = marketRecords.reduce((newest, r) => (r.checkedAt > newest.checkedAt ? r : newest));
      return {
        marketCode: marketKey,
        marketCountry: declaredCountryOf(marketRecords),
        currency: latest.currency,
        priceAmount: latest.priceAmount,
        priceKrw: latest.priceKrw,
        productUrl: latest.sourceProductUrl,
        soldOut: latest.soldOut,
        checkedAt: latest.checkedAt,
      };
    });
}

/** 화면용 Source → Market 묶음. 판매처가 먼저고 시장이 그 아래다 — 한
 * 판매처가 세 시장에 있다고 판매처 셋으로 보이면 안 된다. */
export interface SellerMarketGroup {
  /** sellerIdentityKey 결과(호스트명 우선). 화면 key 용도이자 "한 판매처"의
   * 정의 그 자체다. */
  sellerKey: string;
  sellerLabel: string | null;
  markets: SellerMarketPrice[];
}

/** 요약 상단의 최저/평균/최고가가 "어느 시장의 가격인지"를 어떻게 정했는지.
 *  SINGLE     — 관측된 시장이 하나뿐이었다(market_code가 전부 null/""인 기존
 *               데이터가 여기 해당한다 — 예전과 완전히 같은 결과).
 *  ANALYSIS   — 이 분석이 판단하는 시장(실제로 팔 시장)과 일치하는 시장을 골랐다.
 *  UNRESOLVED — 시장이 둘 이상인데 무엇이 이 분석의 시장인지 모른다 → 판단 불가.
 *               아무거나 고르거나 섞어서 숫자를 만들지 않는다. */
export type MarketResolutionBasis = "SINGLE" | "ANALYSIS" | "UNRESOLVED";

/** 집계가 "어느 시장을 판단 대상으로 보는지"를 호출부가 명시한다. 우선순위
 * (CPO 확정): ①이번 분석에서 명시적으로 요청/확인된 시장 ②이 상품을 실제로
 * 팔 시장 ③source가 선언한 기본 시장 ④판단 불가. 이 옵션을 주지 않으면
 * 시장이 둘 이상일 때 ④로 간다 — 여기서 추론해서 고르지 않는다. */
export interface MarketAggregationOptions {
  /** ②에 해당하는 국가 코드(예: "KR"). market_code 안에 적힌 지역과만
   * 대조한다 — marketCountry나 통화에서 시장을 역추론하지 않는다. */
  analysisMarketCountry?: string | null;
}

/** MI 국내 집계가 판단하는 시장은 언제나 한국이다 — 우선순위 ②("이 상품을
 * 실제로 팔 시장")에 해당한다. 국가나 통화에서 시장을 추론한 값이 아니라
 * 분석의 전제다: "국내 가격"이라는 질문에 독일 시장 가격을 답으로 내놓을 수는
 * 없다. 실측(Bobo Choses)에서 /en-kr ₩162,000과 /en-de €75가 같이 관측되는데,
 * 국내 판매 판단에 들어가야 하는 것은 ₩162,000 하나뿐이다. */
export const DOMESTIC_ANALYSIS_MARKET_COUNTRY = "KR";

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
  /**
   * MI-DATA-FRESHNESS-1(CPO 지시, 2026-09-06) — lowestPriceKrw가 **언제 관측된
   * 값인지**. getPriceHistory는 기간 필터 없이 최근 60건을 주므로 이 최저가는
   * "지금 최저가"가 아니라 "보관된 관측 중 최저가"다. 화면이 현재가처럼
   * 보여주지 않도록 시점을 함께 내보낸다. 집계 방식은 바꾸지 않는다 —
   * 최저가를 만든 그 레코드의 checkedAt을 그대로 싣는다.
   */
  lowestPriceCheckedAt: string | null;
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
  /**
   * MI-STOCK-CLARITY-1(CPO 지시, 2026-09-10) — 위 가격 집계에 실제로 들어간
   * 리스팅의 재고 상태를 셋으로 나눈 개수.
   *
   * soldOut은 세 가지 상태다: true=품절 확인, false=판매중 확인, null=재고를
   * 확인할 방법이 없음. 그런데 국내 자동검색 6곳 중 재고 판정이 구현된 곳은
   * 2곳뿐이라 null이 예외가 아니라 기본값이고, 집계 필터가 `soldOut !== true`라
   * null이 판매중과 함께 계산에 들어간다.
   *
   * 계산 방식은 바꾸지 않는다(CPO가 B안을 보류했다 — 재고 판정 커버리지가
   * 낮은 상태에서 null을 빼면 사이트별 구현 수준이 곧 가격 모집단이 된다).
   * 대신 "확인되지 않았다"는 사실을 숨기지 않도록 개수를 함께 내보낸다.
   * **null을 판매중으로 부르지 않는다.**
   */
  stockCounts: { onSale: number; unknown: number; soldOut: number };
  /**
   * GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 시장별로 따로 집계한 가격. 위의
   * lowestPriceKrw/averagePriceKrw는 이 중 **한 시장**(priceMarketCode)의
   * 값이고, 나머지 시장은 여기에만 남는다. 화면이 다른 시장 가격을 숨기지
   * 않으면서도 판단은 한 시장으로만 하도록 하기 위한 분리다.
   */
  markets: MarketPriceSummary[];
  /** 같은 값을 Source → Market 순서로 묶은 것(화면 표시용). sellerCount와
   * 이 배열의 길이는 항상 일치한다 — 시장이 늘어도 판매처는 늘지 않는다. */
  sellers: SellerMarketGroup[];
  /** 위 lowest/highest/average/sampleListings가 실제로 어느 시장에서 나온
   * 값인지. null이면 시장 미확인 그룹이거나(레거시 데이터) 판단 불가다. */
  priceMarketCode: string | null;
  priceMarketBasis: MarketResolutionBasis;
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

/**
 * P-21(CPO 지시, 2026-09-02) — sellerCount는 "가격을 몇 번 관측했는가"가 아니라
 * "실제 몇 개 쇼핑몰에서 판매하는가"여야 한다. sourceProductUrl의 hostname을
 * 우선 식별자로 쓴다(같은 판매처를 서로 다른 시점에 여러 번 관측해도 URL의
 * 호스트명은 그대로다 — CPO 실측 사례: 포레포레를 두 시점에 관측한 PèPè
 * 케이스). URL이 없는(레거시/파싱 실패) 행만 sourceLabel(상호명)로 폴백한다
 * — 그것도 없으면 record.id로 각자 별개 판매처 취급(과대축소 방지, "정보
 * 없음"을 임의로 합치지 않는다는 기존 프로젝트 원칙과 동일선상). */
function sellerIdentityKey(record: PriceObservationRecord): string {
  if (record.sourceProductUrl) {
    try {
      return `host:${new URL(record.sourceProductUrl).hostname.replace(/^www\./, "").toLowerCase()}`;
    } catch {
      // URL 파싱 실패 — 아래 폴백으로.
    }
  }
  if (record.sourceLabel) return `label:${record.sourceLabel.trim().toLowerCase()}`;
  return `id:${record.id}`;
}

type PricedRecord = PriceObservationRecord & { priceKrw: number };

/** GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — market_code는 null과 "" 두 가지
 * 형태로 "모름"이 들어온다(046 마이그레이션이 로케일 없는 기본 요청의 ""를
 * 그대로 저장하기 때문). 둘을 같은 한 그룹으로 묶되 어떤 시장인지 채우지
 * 않는다 — 키 ""가 곧 "시장 미확인"이다. */
function marketKeyOf(record: PriceObservationRecord): string {
  return record.marketCode?.trim().toLowerCase() ?? "";
}

function marketCodeFromKey(key: string): string | null {
  return key === "" ? null : key;
}

/** 시장 코드가 스스로 가리키는 지역. Shopify Markets 프리픽스는 실측상
 * "xx-yy"(en-kr) 형태이고 지역만 적힌 경우도 있다(shopify-market-probe.ts의
 * EXPAND_CANDIDATE_MARKET_CODES 주석과 같은 근거). 코드 **안에 적힌 글자**를
 * 읽을 뿐이고, marketCountry나 통화에서 시장을 역추론하지 않는다. "en-int"
 * 처럼 국가가 아닌 코드는 null — 어느 나라로도 단정하지 않는다. */
function marketRegionOf(marketKey: string): string | null {
  const matched = /^(?:[a-z]{2}-)?([a-z]{2})$/.exec(marketKey);
  return matched ? matched[1].toUpperCase() : null;
}

/** 시장 미확인("")은 항상 마지막 — 아는 시장을 먼저 보여준다. */
function compareMarketKey(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return a < b ? -1 : 1;
}

function groupByKey<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** 같은 시장 안의 관측들이 전부 같은 기준 국가를 선언했을 때만 그 국가를
 * 쓴다. 서로 다르면 null — 하나를 골라 적으면 화면에 없는 국가가 그려진다. */
function declaredCountryOf(records: PriceObservationRecord[]): string | null {
  const countries = new Set(
    records.map((r) => r.marketCountry?.trim().toUpperCase()).filter((c): c is string => Boolean(c)),
  );
  return countries.size === 1 ? [...countries][0] : null;
}

function summarizeMarketGroup(key: string, records: PricedRecord[]): MarketPriceSummary {
  const prices = records.map((r) => r.priceKrw);
  const lowestPriceKrw = Math.min(...prices);
  return {
    marketCode: marketCodeFromKey(key),
    marketCountry: declaredCountryOf(records),
    lowestPriceKrw,
    highestPriceKrw: Math.max(...prices),
    averagePriceKrw: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
    // 시장 안에서도 판매처는 Source 단위로 센다(위 summarizeFrom과 같은 기준).
    sellerCount: new Set(records.map(sellerIdentityKey)).size,
    lowestPriceCheckedAt: records
      .filter((r) => r.priceKrw === lowestPriceKrw)
      .reduce((latest, r) => (r.checkedAt > latest ? r.checkedAt : latest), ""),
  };
}

/** 우선순위(CPO 확정) ①이번 분석에서 명시적으로 요청/확인된 시장 ②실제로 팔
 * 시장 ③source가 선언한 기본 시장 ④판단 불가. 지금 호출부가 줄 수 있는 것은
 * ②뿐이라 ②만 구현한다 — ①/③이 생기기 전까지는 나머지를 ④로 남긴다.
 * 시장이 하나뿐이면 고를 것이 없으므로 그대로 쓴다(기존 데이터 = 전부 이 경로). */
function resolvePriceMarketKey(
  keys: string[],
  analysisMarketCountry: string | null | undefined,
): { key: string; basis: "SINGLE" | "ANALYSIS" } | null {
  if (keys.length === 1) return { key: keys[0], basis: "SINGLE" };
  const target = analysisMarketCountry?.trim().toUpperCase();
  if (!target) return null;
  const matched = keys.filter((key) => marketRegionOf(key) === target);
  // 정확히 하나일 때만 확정한다. 둘 이상 매칭되면(예: "kr"과 "en-kr"이 함께
  // 관측됨) 어느 쪽이 이 분석의 시장인지 우리가 모르는 것이라 고르지 않는다.
  return matched.length === 1 ? { key: matched[0], basis: "ANALYSIS" } : null;
}

/** 화면용 Source → Market 묶음. 시장별로 가장 최근 관측 1건만 남긴다 — 한
 * 시장의 시계열을 여기서 합치거나 평균내지 않는다(그건 markets/trend의 일). */
function groupSellersByMarket(records: PricedRecord[]): SellerMarketGroup[] {
  return [...groupByKey(records, sellerIdentityKey).entries()].map(([sellerKey, sellerRecords]) => ({
    sellerKey,
    sellerLabel: sellerRecords.find((r) => r.sourceLabel)?.sourceLabel ?? null,
    markets: [...groupByKey(sellerRecords, marketKeyOf).entries()]
      .sort(([a], [b]) => compareMarketKey(a, b))
      .map(([marketKey, marketRecords]) => {
        const latest = marketRecords.reduce((newest, r) => (r.checkedAt > newest.checkedAt ? r : newest));
        return {
          marketCode: marketCodeFromKey(marketKey),
          marketCountry: declaredCountryOf(marketRecords),
          currency: latest.currency,
          priceAmount: latest.priceAmount,
          priceKrw: latest.priceKrw,
          productUrl: latest.sourceProductUrl,
          checkedAt: latest.checkedAt,
        };
      }),
  }));
}

/** N-4.18-G STEP G-4(대표님 지시: "VERIFIED + ACTIVE + 현재 판매 가능 →
 * 가격 경쟁력 계산", "품절 상품을 최저가 계산에 포함시키면 안 됩니다") —
 * soldOut===true인 관측치만 최저/평균/최고가·sellerCount 계산에서 뺀다.
 * soldOut===false 또는 null(그 사이트 품절 감지 미구현)은 기존과 동일하게
 * 포함한다 — RULII 외 사이트는 항상 soldOut=null이라 이 변경으로 기존
 * 가격비교 결과가 달라지지 않는다(회귀 없음).
 *
 * GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 여기에 시장 분리를 더한다. 원칙은
 * 두 줄이다:
 *   가격        = Source + Market 단위 (시장끼리 합산·비교하지 않는다)
 *   sellerCount = Source 단위 distinct (한 판매처는 N개 시장에 있어도 한 곳)
 * 실측(Bobo Choses)에서 한 판매처가 KR/DE/INT 세 시장에 동시에 있었고, 예전
 * 집계는 이걸 판매처 3곳으로 세면서 ₩162,000·€75·€84를 하나의 최저/평균으로
 * 뭉갰다. 최저/평균/최고가는 이제 **한 시장**(priceMarketCode)에서만 나온다.
 * market_code가 전부 null/""인 기존 데이터는 시장 그룹이 하나라 예전과 결과가
 * 완전히 같다(basis="SINGLE"). */
export function summarizeFrom(
  records: PriceObservationRecord[],
  tier: DomesticMarketTier,
  options: MarketAggregationOptions = {},
): DomesticMarketSummary {
  // N-4.18-Q3 PART E-1 — priceKrw가 null인 행(완전 품절, 가격 자체를 못 찾음)은
  // soldOut!==true인 경우에도 최저/평균/최고가 계산에서 제외한다(가격이 없는데
  // 계산에 넣을 수 없다 — 0원을 지어내지 않는다는 원칙과 동일선상).
  const activeRecords = records.filter(
    (r): r is PricedRecord => r.soldOut !== true && r.priceKrw != null,
  );
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
      lowestPriceCheckedAt: null,
      sampleListings: [],
      soldOutListings,
      stockCounts: { onSale: 0, unknown: 0, soldOut: soldOutRecords.length },
      markets: [],
      sellers: [],
      priceMarketCode: null,
      priceMarketBasis: "UNRESOLVED",
      checkedAt,
    };
  }

  const marketGroups = groupByKey(activeRecords, marketKeyOf);
  const marketKeys = [...marketGroups.keys()].sort(compareMarketKey);
  const markets = marketKeys.map((key) => summarizeMarketGroup(key, marketGroups.get(key)!));
  const resolved = resolvePriceMarketKey(marketKeys, options.analysisMarketCountry);
  // 판단 대상 시장을 못 고르면 빈 배열이다 — 아무 시장이나 골라 숫자를 내는
  // 대신 최저/평균/최고가를 null로 남긴다(markets/sellers에는 전부 남아 있으니
  // 데이터를 버리는 것도, 행을 숨기는 것도 아니다).
  const priceRecords = resolved ? marketGroups.get(resolved.key)! : [];

  // 가격 집계에 실제로 들어간 리스팅만 센다 — 화면에 보이는 최저가/평균가가
  // 어떤 재고 상태 위에 세워졌는지를 그대로 반영해야 한다. 판단 시장 밖의
  // 관측은 그 최저가를 만든 적이 없으므로 여기서도 세지 않는다.
  const stockCounts = {
    onSale: priceRecords.filter((r) => r.soldOut === false).length,
    unknown: priceRecords.filter((r) => r.soldOut == null).length,
    soldOut: soldOutRecords.length,
  };

  // sellerCount만은 시장으로 나누지 않는다 — Bobo Choses가 KR/DE/INT 세
  // 시장에 있어도 판매처는 여전히 한 곳이다. sellerIdentityKey(호스트명 우선)에
  // 시장을 섞지 않는 것이 이 규칙의 구현 그 자체다.
  const sellerCount = new Set(activeRecords.map(sellerIdentityKey)).size;
  const sellers = groupSellersByMarket(activeRecords);

  const resolvedMarket = resolved ? markets.find((m) => m.marketCode === marketCodeFromKey(resolved.key))! : null;
  const sorted = [...priceRecords].sort((a, b) => a.priceKrw - b.priceKrw);
  return {
    tier,
    lowestPriceKrw: resolvedMarket?.lowestPriceKrw ?? null,
    highestPriceKrw: resolvedMarket?.highestPriceKrw ?? null,
    averagePriceKrw: resolvedMarket?.averagePriceKrw ?? null,
    sellerCount,
    // 같은 최저가가 여러 시점에 관측됐다면 가장 최근 관측을 쓴다 — 화면이
    // 실제보다 오래됐다고 말하지 않게 하기 위함(보수적으로 최신 쪽).
    lowestPriceCheckedAt: resolvedMarket?.lowestPriceCheckedAt ?? null,
    sampleListings: sorted.slice(0, 5).map((r) => ({
      mallName: r.sourceLabel,
      priceKrw: r.priceKrw,
      productUrl: r.sourceProductUrl,
      checkedAt: r.checkedAt,
      salePriceKrw: r.salePriceKrw,
      originalPriceKrw: r.originalPriceKrw,
    })),
    soldOutListings,
    stockCounts,
    markets,
    sellers,
    priceMarketCode: resolved ? marketCodeFromKey(resolved.key) : null,
    priceMarketBasis: resolved?.basis ?? "UNRESOLVED",
    checkedAt,
  };
}

const EMPTY_SUMMARY: DomesticMarketSummary = {
  tier: "NONE",
  lowestPriceKrw: null,
  highestPriceKrw: null,
  averagePriceKrw: null,
  sellerCount: 0,
  lowestPriceCheckedAt: null,
  sampleListings: [],
  soldOutListings: [],
  stockCounts: { onSale: 0, unknown: 0, soldOut: 0 },
  markets: [],
  sellers: [],
  priceMarketCode: null,
  priceMarketBasis: "UNRESOLVED",
  checkedAt: null,
};

export function summarizeDomesticMarket(
  records: PriceObservationRecord[],
  options: MarketAggregationOptions = {},
): DomesticMarketSummary {
  const verified = records.filter((r) => r.source === "DOMESTIC_SHOP");
  if (verified.length > 0) return summarizeFrom(verified, "PRIMARY", options);
  const candidates = records.filter((r) => r.source === "NAVER_SHOPPING");
  if (candidates.length > 0) return summarizeFrom(candidates, "SECONDARY", options);
  return EMPTY_SUMMARY;
}

/**
 * P-19-B Sprint 7(CPO 지시, 2026-09-02) — "동일상품 가격"과 "비교상품 시장가격"을
 * 완전히 분리된 두 버킷으로 집계한다. summarizeFrom()의 집계 수식(최저/평균/최고/
 * sellerCount)은 그대로 재사용한다(새 계산식 없음) — 호출부(market-intelligence.ts)가
 * domestic_product_links.matchTruth로 DOMESTIC_SHOP 레코드를 이미 두 배열로 나눠서
 * 넘긴다. 우선순위(대표님 지시): 1순위 동일상품가격, 없으면 2순위 비교상품
 * 시장가격, 둘 다 없으면 시장 데이터 부족(resolved=EMPTY, basis="NONE").
 */
export interface DomesticMarketSplit {
  exact: DomesticMarketSummary;
  comparison: DomesticMarketSummary;
  resolved: DomesticMarketSummary;
  basis: "EXACT" | "COMPARISON" | "NONE";
}

export function summarizeDomesticMarketSplit(
  exactRecords: PriceObservationRecord[],
  comparisonRecords: PriceObservationRecord[],
  // GLOBAL-MARKET ② — 두 버킷 모두 같은 분석 시장을 기준으로 판단해야 한다.
  // 버킷마다 다른 시장의 가격을 고르면 EXACT/COMPARISON 비교 자체가 무의미해진다.
  options: MarketAggregationOptions = {},
): DomesticMarketSplit {
  const exact = exactRecords.length > 0 ? summarizeFrom(exactRecords, "PRIMARY", options) : EMPTY_SUMMARY;
  const comparison =
    comparisonRecords.length > 0 ? summarizeFrom(comparisonRecords, "SECONDARY", options) : EMPTY_SUMMARY;
  if (exact.sellerCount > 0) return { exact, comparison, resolved: exact, basis: "EXACT" };
  if (comparison.sellerCount > 0) return { exact, comparison, resolved: comparison, basis: "COMPARISON" };
  return { exact, comparison, resolved: EMPTY_SUMMARY, basis: "NONE" };
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
  // N-4.18-Q3 PART E-1 — priceKrw가 없는 관측치(완전 품절)는 가격 변화 비교
  // 대상에서 제외한다(비교할 가격 자체가 없다 — 0으로 대체하지 않는다).
  const priced = recordsForSource.filter((r): r is PriceObservationRecord & { priceKrw: number } => r.priceKrw != null);
  if (priced.length < 2) return null;
  const sorted = [...priced].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));
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

function closestObservationAtOrBefore<T extends PriceObservationRecord>(sorted: T[], targetIso: string): T | null {
  // sorted는 checkedAt 내림차순(최신 먼저)이라고 가정 — target 이하인 것 중 첫 번째(=가장 최신).
  return sorted.find((r) => r.checkedAt <= targetIso) ?? null;
}

export function computePriceTrend(
  recordsForSource: PriceObservationRecord[],
  daysAgo: number,
  now: Date = new Date(),
): PriceTrendResult {
  // N-4.18-Q3 PART E-1 — priceKrw가 없는 관측치(완전 품절)는 추세 계산에서 제외한다.
  const priced = recordsForSource.filter((r): r is PriceObservationRecord & { priceKrw: number } => r.priceKrw != null);
  const sorted = [...priced].sort((a, b) => (a.checkedAt < b.checkedAt ? 1 : -1));
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
