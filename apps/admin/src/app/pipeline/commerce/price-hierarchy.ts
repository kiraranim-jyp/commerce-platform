import { KR_TARGET_MARKET, type TargetMarket } from "./market-target";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";
import { formatKrwAmount, formatOriginAmount } from "./mi-headline";

/**
 * UX 2.3(CEO 지시, 2026-09-11) — 화면의 "가격"은 한 종류가 아니다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 실제 화면에 £55 · ₩99,928 · 국내 비교가격 · 한국 시장 가격 · 판매가격이
 * 전부 같은 크기, 같은 모양의 숫자로 나란히 떠 있었다. 셀러 입장에서는 다섯
 * 개의 "가격"이 보이는데 그중 무엇이 내가 내는 돈이고 무엇이 남이 받는 돈인지
 * 화면이 말해주지 않는다 — 그래서 가격을 "판단"할 수가 없었다.
 *
 * 이 화면에 실제로 존재하는 숫자는 여덟 가지 **서로 다른 사실**이다:
 *
 *   원본 판매가격        해외 판매자 페이지에 적힌 값(통화 포함)
 *   원화 환산            그 값을 지금 환율로 바꾼 값
 *   착지원가             환산가 + 국제배송비 — 내가 실제로 치르는 매입 원가
 *   원본 판매자 한국 표시가  그 판매처가 한국 방문자에게 직접 보여주는 값
 *   국내 비교상품 가격    한국 편집샵에서 관측된 남의 판매가
 *   내 판매가격          내가 정한(또는 아직 안 정한) 값
 *   예상 수익 / 예상 마진  내 판매가에서 원가·수수료를 뺀 결과
 *
 * 라벨 하나가 이 중 둘을 겸하는 순간 셀러는 잘못된 사실을 읽는다. 실제로
 * 그랬다: "한국 시장 가격"이라는 한 라벨이 *원본 판매자의 한국 표시가*와
 * *국내 편집샵 비교가* 둘 다를 가리키고 있었다. 그래서 이 파일은 여덟 개의
 * 의미에 **각각 하나씩만** 라벨을 붙이고, 화면은 여기서 만든 라벨만 쓴다.
 *
 * ── 이 파일이 계산하지 않는 것 ───────────────────────────────────────────
 * 아무것도 계산하지 않는다. 서버가 이미 낸 값(cost / currentPrice /
 * unifiedDecision / recommendation / domesticCompetition)을 고르고, 어떤 순서로
 * 놓을지와 무엇을 기준으로 한 값인지만 정한다. 환율·착지원가·마진·CASE 판정
 * 산식은 packages/pricing 그대로다. 여기서 뺄셈 한 번이라도 하는 순간 같은
 * 숫자가 화면과 서버에서 갈라지기 시작한다 — 이 저장소에서 반복된 버그다.
 *
 * ── 두 축은 서로 독립이다(이번 지시의 핵심) ──────────────────────────────
 * 국내 비교상품이 0건이면 지금까지 화면은 "아무것도 판단할 수 없다"처럼
 * 읽혔다. 그건 틀렸다. 국내 비교 대상이 없어도 원본가격 → 환산 → 국제배송 →
 * 착지원가 → 내 판매가 → 예상 수익은 전부 그대로 계산된다. 확인할 수 없는
 * 것은 **가격 경쟁력** 하나뿐이다.
 *
 *   시장 비교 불가  ≠  수익성 계산 불가
 *
 * 그래서 buildPriceChain()과 buildMarketContext()가 서로의 입력을 받지 않는다 —
 * 한쪽이 비어도 다른 쪽이 절대 비지 않는다는 것을 타입으로 못박는 장치다.
 *
 * ── UX 2.4(CEO 지시, 2026-09-11) — 축이 넷으로 나뉜다 ─────────────────────
 * 위 두 축에 "판매자가 각 시장에서 직접 파는 가격"이 더해진다. 화면의 가격은
 * 이제 네 덩어리이고, 서로 절대 섞이지 않는다:
 *
 *   A 원본            buildPriceChain()의 첫 줄 (원본 판매가격 / 원화 환산)
 *   B 판매자 글로벌 시장  global-market.ts  ← 이 판매처가 KR/US/FR/DE/INT에 파는 값
 *   C 한국 경쟁시장     buildMarketContext()  ← **다른** 한국 판매자들이 파는 값
 *   D 내 판매가격·수익   buildPriceChain()의 뒷부분
 *
 * B와 C를 가르는 것이 이번 지시의 전부다. 둘 다 "🇰🇷 한국 · ₩" 모양이지만
 * B는 내가 살 값이고 C는 내가 경쟁할 값이다. 그래서 B는 아예 다른 파일에
 * 있고, buildMarketContext()는 시장 코드를 인자로조차 받지 않는다.
 *
 * ── UX 2.4.1(CEO 지시, 2026-09-11) — 판단은 원본에서 시작한다 ──────────────
 * 실제 화면은 "원본 판매자 한국 표시가 ₩104,600"으로 열리고 있었다. 셀러는
 * URL 하나를 붙여넣고 "이 상품이 원래 얼마지?"를 물었는데, 첫 줄이 원화라서
 * 되돌아오는 질문이 "원본가격이 왜 한국 돈이지?"였다.
 *
 * 원인은 라벨이 아니라 **입력**이었다. market-intelligence.ts는 최근 실측
 * 관측이 있으면 cost의 originalAmount/originalCurrency를 그 관측의 **원화값**
 * 으로 접어서 넘긴다(costSource = LATEST_SALE / LATEST_PRICE). 그래서 원본
 * 통화(£55)는 응답 안에 있으면서도 사슬의 첫 줄까지 오지 못했다. 아래
 * observedOriginPrice가 그 관측 행이 통화 그대로 들고 있는 값을 따로 받는다 —
 * 새로 계산하는 것은 없고, 이미 저장된 세 값(금액·통화·환율)을 고를 뿐이다.
 */

/** 화면에 뜨는 여덟 가지 "가격". 새 값이 생기면 여기에 키를 더해야 한다. */
export type PriceMeaning =
  | "SOURCE_ORIGINAL_PRICE"
  | "SOURCE_PRICE_KRW"
  | "LANDED_COST"
  | "KR_MARKET_PRICE"
  | "DOMESTIC_COMPARABLE_PRICE"
  | "SELLER_PLANNED_PRICE"
  | "EXPECTED_PROFIT"
  | "EXPECTED_MARGIN";

/**
 * 가격이 아니라 착지원가에 더해지는 **비용 항목**. 가격 여덟 개와 같은 타입에
 * 넣지 않는 이유는 단순하다 — 섞어두면 언젠가 "국제배송비"가 아홉 번째 가격이
 * 되고, 그 순간 "가격 라벨은 여덟 개뿐"이라는 이 파일의 약속이 사라진다.
 */
export type CostComponentKey = "INTERNATIONAL_SHIPPING";

export type PriceLineKey = PriceMeaning | CostComponentKey;

/**
 * 의미 하나당 라벨 하나. **같은 문자열이 두 번 나오면 안 된다** — 그 순간
 * 한 라벨이 두 사실을 가리키게 되고, 이번 지시가 없애려는 화면으로 되돌아간다.
 * 테스트가 이 표의 값이 전부 다르다는 것을 고정하고 있다.
 */
export const PRICE_MEANING_LABEL: Record<PriceMeaning, string> = {
  SOURCE_ORIGINAL_PRICE: "원본 판매가격",
  // "원화 환산"이지 "한국 가격"이 아니다. 환산은 우리가 환율로 만든 값이고,
  // 한국 가격은 한국에서 실제로 관측된 값이다 — 이 둘을 같은 말로 부르던 것이
  // "€37 ≈ ₩57,756"을 "한국에서도 5만 8천 원"으로 읽히게 만든 원인이다.
  SOURCE_PRICE_KRW: "원화 환산",
  LANDED_COST: "착지원가",
  // 관측된 시장이 한국이라는 사실과 "그 판매처가 직접 보여주는 값"이라는
  // 사실을 라벨 하나에 함께 담는다. 아래 국내 비교상품과 절대 같은 말을 쓰지
  // 않는다 — 하나는 내가 살 값이고 하나는 남이 파는 값이다.
  KR_MARKET_PRICE: "원본 판매자 한국 표시가",
  DOMESTIC_COMPARABLE_PRICE: "국내 비교상품",
  SELLER_PLANNED_PRICE: "내 판매가격",
  EXPECTED_PROFIT: "예상 수익",
  EXPECTED_MARGIN: "예상 마진",
};

export const PRICE_LINE_LABEL: Record<PriceLineKey, string> = {
  ...PRICE_MEANING_LABEL,
  INTERNATIONAL_SHIPPING: "국제배송비",
};

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — 가격 영역을 읽는 순서. 제목 자체에 번호를
 * 박아 둔다.
 *
 * 이 순서는 취향이 아니라 판단의 순서다: ① 원래 얼마인가 → ② 한국에서는 누가
 * 얼마에 파나 → ③ 그래서 나는 얼마가 남나 → ④ 이 판단이 무엇 위에 서 있나.
 * 번호를 화면에 적어 두면 누군가 블록 하나를 위로 올렸을 때 번호가 먼저 어긋나
 * 보인다 — 배치 규칙을 화면이 스스로 감시하게 하는 장치다(테스트도 고정한다).
 *
 * ①이 반드시 원본 통화여야 하는 이유는 질문이 그것이기 때문이다. "원본 가격"
 * 자리에 원화가 서면 그건 답이 아니라 환산이고, 환산은 비교가 아니다.
 *
 * ── MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 본문은 세 가지 사실만 남는다 ───────
 * MI가 존재하는 이유는 질문 하나다: "이 상품을 한국에서 이 가격에 팔 만한가?"
 * 그 답에 필요한 사실은 셋뿐이다 — ① 원본 가격 ② 한국에서 팔 수 있는 가격
 * ③ 내 마진 기준으로 팔 만한가. 판매처가 프랑스/미국에서 각각 얼마를 받는지는
 * 매입처를 고를 때의 사실이지 "팔 만한가"의 답이 아니다.
 *
 * 그래서 판매자 글로벌 시장은 번호를 잃는다(UX 2.4의 ②였다). 번호가 없다는
 * 것이 곧 "본문의 읽는 순서에 속하지 않는다"는 뜻이고, 이 표가 순서를 감시하는
 * 방식 그대로(번호가 어긋나면 화면에서 먼저 보인다) 계층도 감시하게 만든
 * 것이다. 값이 사라진 것이 아니라 층이 바뀌었다: 본문 한 줄(ⓘ) → 펼치면
 * 시장별 원자료.
 */
export const PRICE_SECTION_TITLE = {
  ORIGINAL: "① 원본 상품 가격",
  /** 번호 없음 — 본문 카드가 아니라 ① 아래의 ⓘ 한 줄과 그 펼침의 제목이다. */
  SELLER_GLOBAL_MARKET: "🌎 판매자 글로벌 시장 가격",
  DOMESTIC_COMPETITION: "② 📊 한국 시장 경쟁가격",
  PROFITABILITY: "③ 💰 수익성",
  DECISION_EVIDENCE: "④ 🔎 판단 근거",
} as const;

/** 화면에 그대로 쓰는 한 줄. mi-headline.HeadlineNumber와 같은 모양이다 —
 * 값이 없을 때 빈 상태 어휘를 쓰는 규칙을 두 곳에서 다르게 만들지 않는다. */
export interface PriceLine {
  key: PriceLineKey;
  label: string;
  /** 이 숫자가 무엇을 기준으로 한 값인지. 라벨만으로 오해될 수 있으면 반드시 붙인다. */
  basis: string | null;
  /** 화면에 그대로 쓰는 문자열. 값이 없으면 null이고 그때는 empty를 쓴다. */
  value: string | null;
  empty: MiEmptyState | null;
}

/**
 * 사슬에서 이 줄이 맡는 자리. 화면이 `key === "LANDED_COST"`로 모양을 고르면
 * 값이 하나 늘 때마다 화면을 고쳐야 한다 — 자리는 여기서 정한다.
 *
 *   SOURCE   사슬의 출발점(해외에서 읽은 값)
 *   CONVERT  그 값을 원화로 바꾼 단계
 *   ADD      더해지는 비용
 *   TOTAL    합계(가로줄 아래)
 *   PLAN     내가 정하는 값
 *   RESULT   그래서 남는 값
 */
export type ChainRole = "SOURCE" | "CONVERT" | "ADD" | "TOTAL" | "PLAN" | "RESULT";

/**
 * UX 2.4(CEO 지시, 2026-09-11) — 접힌 화면에서 이 줄이 보이는가.
 *
 *   SUMMARY  원본 → 착지원가 → 내 판매가격 → 수익. 판단에 필요한 최소한.
 *   DETAIL   그 사이의 과정(환율 환산 · 국제배송비). 펼쳤을 때만 본다.
 *
 * 두 배열로 나눠 돌려주지 않고 한 배열에 표식만 다는 이유가 중요하다. 나누면
 * 화면이 두 목록을 이어 붙이는 순서를 스스로 정하게 되고, 그때부터 "착지원가가
 * 국제배송비보다 위에 있는" 화면이 생길 수 있다. 순서는 여전히 계산 순서이고,
 * 접힘은 그 순서 위에 씌우는 필터일 뿐이다.
 *
 * 무엇이 DETAIL인지는 "없어도 판단이 되는가"로 가른다. 환산가와 국제배송비는
 * 착지원가 안에 이미 합쳐져 있어서(= 결과가 SUMMARY에 남아 있어서) 접어도
 * 사실이 사라지지 않는다. 착지원가·내 판매가·수익은 접는 순간 셀러가 답을
 * 못 얻는다.
 *
 * ── MI/PRICE-1(CEO 지시, 2026-09-12) — SOURCE는 왜 DETAIL로 내려갔나 ───────
 * "원본 판매가격"은 이 사슬이 답하는 유일한 값이 아니다. 바로 위 ① 원본 상품
 * 가격이 같은 값을 원본 통화로, 이 화면에서 가장 큰 숫자로 이미 답하고 있다.
 * 그 상태에서 ④의 요약 첫 줄이 또 원본가격이면 같은 사실이 한 카드 안에서 두
 * 번 나온다 — 이번 지시가 없애라고 한 "가격이 두 번 계산되는 것처럼 보이는"
 * 화면의 한 조각이다. ④ 요약에 남는 것은 ①이 답하지 못하는 넷뿐이다:
 * 착지원가 · 내 판매가격 · 예상 수익 · 예상 마진.
 *
 * 다만 원가 기준이 "판매자의 한국 표시가"인 상품(costBasisIsKrMarket)은
 * 예외다. 그때 ①은 스냅샷의 원본 통화 가격을 세우기 때문에, 실제로 원가에
 * 들어간 한국 표시가를 ①이 대신 말해주지 못한다 — 그 줄만 SUMMARY로 남긴다
 * (buildPriceChain의 해당 분기에서 tier를 직접 지정한다).
 */
export type ChainTier = "SUMMARY" | "DETAIL";

const TIER_BY_ROLE: Record<ChainRole, ChainTier> = {
  SOURCE: "DETAIL",
  CONVERT: "DETAIL",
  ADD: "DETAIL",
  TOTAL: "SUMMARY",
  PLAN: "SUMMARY",
  RESULT: "SUMMARY",
};

export interface PriceChainRow extends PriceLine {
  role: ChainRole;
  tier: ChainTier;
}

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — 원가 사슬의 출발점이 된 **관측 행**이 그
 * 통화 그대로 들고 있는 값.
 *
 * cost.originalAmount로는 이 사실을 알 수 없다. 최근 실측 관측이 있으면
 * market-intelligence.ts가 그 관측의 원화값을 originalAmount로, "KRW"를
 * originalCurrency로 접어서 넘기기 때문이다(costSource = LATEST_SALE /
 * LATEST_PRICE). 그래서 화면의 첫 줄이 "원본 판매가격 ₩99,928"이 됐다 —
 * 값은 맞지만 질문("원래 얼마지?")에 대한 답은 아니다.
 *
 * 세 값을 한 행에서 통째로 받는 이유는 곱셈을 하지 않기 위해서다. 금액·통화·
 * 환율이 같은 관측 행에서 나와야 amount × rate = krw가 우리 화면 밖에서 이미
 * 성립한다. 여기서 환율을 다시 곱하는 순간 서버가 저장한 값과 화면이 말하는
 * 값이 갈라지기 시작한다(이 저장소에서 반복된 버그다).
 */
export interface ObservedOriginPrice {
  amount: number;
  currency: string;
  /** 그 관측 행에 함께 저장된 환율(price_observations.exchange_rate). 없으면 null. */
  exchangeRate: number | null;
}

export interface PriceChainInput {
  /** cost.originalAmount / cost.originalCurrency — 착지원가 계산에 실제로 들어간 값. */
  originPrice: { amount: number; currency: string } | null;
  /**
   * 위 originPrice가 원화로 접히기 전의 원본 통화 값. 있으면 사슬의 첫 줄은
   * 이것이 되고, 원화는 바로 다음 "원화 환산" 줄로 내려간다 — 원본과 환산이
   * 한 줄에서 자리를 다투지 않는다. 없으면(구버전 응답·스냅샷 기준 계산)
   * 지금까지와 완전히 같은 동작이다.
   */
  observedOriginPrice: ObservedOriginPrice | null;
  /** costSource 라벨("최신 확인가 기준" 등). 어느 시점 가격인지 숨기지 않는다. */
  originPriceBasis: string | null;
  /**
   * currentPrice.costBasis === "KR_MARKET"인가.
   *
   * 이 플래그가 켜지면 위 originPrice는 "원본 통화 가격"이 아니라 *그 판매처가
   * 한국 방문자에게 직접 보여주는 원화 가격*이다(run-price-check.ts가 en-kr
   * 시장 가격을 원가 기준으로 승격시킨 경우). 실측 근거: PèPè £200×환율=₩377,400
   * 인데 실제 한국 로케일 표시가는 ₩234,800이었다. 두 값을 같은 라벨로 부르면
   * 차액 ₩142,600이 화면에서 사라진다 — 그래서 라벨 자체를 바꾼다.
   */
  costBasisIsKrMarket: boolean;
  /** cost.costKrw — 원본가 × 환율. */
  sourcePriceKrw: number | null;
  /** fx.rate — 위 환산에 실제로 쓰인 환율. */
  exchangeRate: number | null;
  /** fx.isEstimate — 실시간 조회 실패로 고정 표를 썼는가. */
  exchangeRateIsEstimate: boolean;
  /** cost.shippingKrw — 국제배송비(판매자 기본값, 추정). */
  internationalShippingKrw: number | null;
  /** cost.landedCostKrw — 환산가 + 국제배송비. */
  landedCostKrw: number | null;
  /** currentPrice.sellingPriceKrw — 판매자가 실제로 정한 값. 추천가를 여기에 넣지 않는다. */
  sellerPlannedPriceKrw: number | null;
  /** unifiedDecision.estimatedProfitKrw.value */
  expectedProfitKrw: number | null;
  /** unifiedDecision.platformFeeKrw.value — 수익 계산에서 추가로 빠진 금액. */
  platformFeeKrw: number | null;
  /** unifiedDecision.dataCompleteness === "INCOMPLETE" — 아직 모르는 비용이 있다. */
  costIncomplete: boolean;
  /** unifiedDecision.marginPercent.value 또는 recommendation.estimatedMarginPercent. */
  marginPercent: number | null;
  /** 위 마진이 어느 판매가 기준인가. 두 마진을 같은 라벨로 내보내지 않기 위한 값이다. */
  marginBasis: "PLANNED" | "RECOMMENDED" | null;
}

function krwLine(
  key: PriceLineKey,
  role: ChainRole,
  krw: number | null,
  basis: string | null,
  emptyReason: string,
): PriceChainRow {
  return {
    key,
    role,
    tier: TIER_BY_ROLE[role],
    label: PRICE_LINE_LABEL[key],
    basis,
    value: krw != null ? formatKrwAmount(krw) : null,
    empty: krw != null ? null : miEmptyState("UNVERIFIABLE", emptyReason),
  };
}

/**
 * "1 GBP = ₩1,817 · 가격 확인 시점 환율" 한 줄. 환산 줄과 ① 헤드라인이 같은
 * 문자열을 쓰게 만드는 유일한 지점이다 — 두 곳이 각자 문장을 만들면 같은 환산에
 * 서로 다른 기준이 적히는 날이 온다.
 *
 * 곱셈은 하지 않는다. 환율은 "이 원화가 어디서 왔는지"를 밝히는 근거 문장일
 * 뿐이고, 원화값 자체는 서버가 낸 값을 그대로 쓴다.
 */
function exchangeRateNote(
  currency: string | null,
  rate: number | null,
  source: "OBSERVED" | "LIVE",
  isEstimate: boolean,
): string {
  if (rate == null || !currency) return "환율을 확인하지 못했습니다";
  const basis =
    source === "OBSERVED"
      ? // 관측 행에 저장된 환율이다. "현재 환율"이라고 부르면 우리가 방금 조회한
        // 값처럼 읽히는데, 실제로는 그 가격을 확인하던 시점의 환율이다.
        " · 가격 확인 시점 환율"
      : isEstimate
        ? " · 실시간 조회 실패, 고정 참고환율"
        : " · 현재 환율";
  return `1 ${currency.toUpperCase()} = ₩${Math.round(rate).toLocaleString("ko-KR")}${basis}`;
}

/**
 * 원본가격 → 환산 → 국제배송 → 착지원가 → 내 판매가 → 예상 수익.
 *
 * 관계가 보이게 **순서대로** 돌려준다. 화면이 이 배열의 순서를 다시 정하지
 * 않는다 — 순서가 곧 계산 순서이고, 순서를 화면이 고르기 시작하면 "착지원가가
 * 원본가격보다 위에 있는" 화면이 언젠가 생긴다.
 */
export function buildPriceChain(input: PriceChainInput): PriceChainRow[] {
  const rows: PriceChainRow[] = [];

  // ① 출발점. costBasisIsKrMarket이면 이건 원본 통화 가격이 아니라 그 판매처의
  //    한국 표시가다 — 같은 자리에 놓되 라벨과 기준 문장을 통째로 바꾼다.
  if (input.costBasisIsKrMarket) {
    rows.push({
      key: "KR_MARKET_PRICE",
      role: "SOURCE",
      // MI/PRICE-1 — 이 줄만 요약에 남는다. ①은 이 경우 스냅샷의 원본 통화
      // 가격을 세우므로, 실제로 착지원가에 들어간 한국 표시가를 화면 어디서도
      // 대신 말해주지 않는다(위 ChainTier 주석의 예외 하나).
      tier: "SUMMARY",
      label: PRICE_MEANING_LABEL.KR_MARKET_PRICE,
      basis: [
        "이 판매처가 한국 방문자에게 직접 보여주는 가격 · 환율 환산이 아닙니다",
        input.originPriceBasis,
      ]
        .filter(Boolean)
        .join(" · "),
      value: input.sourcePriceKrw != null ? formatKrwAmount(input.sourcePriceKrw) : null,
      empty:
        input.sourcePriceKrw != null
          ? null
          : miEmptyState("UNVERIFIABLE", "한국 표시가를 읽지 못했습니다"),
    });
  } else {
    // UX 2.4.1 — 사슬의 첫 줄은 **원본 통화**다. 관측 행이 통화 그대로의 값을
    // 들고 있으면 그것이 원본이고, cost.originalAmount(이미 원화로 접힌 값)는
    // 바로 아래 환산 줄이 받는다. 관측이 없으면(스냅샷 기준) 지금까지와 같다.
    const origin = input.observedOriginPrice ?? input.originPrice;
    rows.push({
      key: "SOURCE_ORIGINAL_PRICE",
      role: "SOURCE",
      tier: TIER_BY_ROLE.SOURCE,
      label: PRICE_MEANING_LABEL.SOURCE_ORIGINAL_PRICE,
      basis: ["원본 판매자 페이지 기준", input.originPriceBasis].filter(Boolean).join(" · "),
      value: origin ? formatOriginAmount(origin.amount, origin.currency) : null,
      empty: origin ? null : miEmptyState("UNVERIFIABLE", "원본 상품 가격을 읽지 못했습니다"),
    });

    // ② 환산 단계. 원본 통화가 이미 원화면 이 줄을 만들지 않는다 — 같은 숫자에
    //    라벨을 하나 더 붙이는 것일 뿐이고, 그게 바로 이번 지시가 없애려는
    //    "같은 값이 두 개의 가격으로 보이는" 화면이다.
    const originIsKrw = origin?.currency.toUpperCase() === "KRW";
    if (!originIsKrw) {
      // 환율은 원본 금액이 온 곳에서 같이 온 것을 쓴다. 관측 행의 금액에
      // 서버가 방금 조회한 환율(fx.rate)을 붙이면 두 시점이 섞인다 — 게다가
      // 그 fx.rate는 원가가 이미 원화로 접힌 경우 1이다("1 GBP = ₩1").
      const rateNote = input.observedOriginPrice
        ? exchangeRateNote(
            input.observedOriginPrice.currency,
            input.observedOriginPrice.exchangeRate,
            "OBSERVED",
            false,
          )
        : exchangeRateNote(origin?.currency ?? null, input.exchangeRate, "LIVE", input.exchangeRateIsEstimate);
      rows.push(
        krwLine(
          "SOURCE_PRICE_KRW",
          "CONVERT",
          input.sourcePriceKrw,
          rateNote,
          "환율을 확인하지 못해 환산할 수 없습니다",
        ),
      );
    }
  }

  // ③ 더해지는 비용.
  rows.push(
    krwLine(
      "INTERNATIONAL_SHIPPING",
      "ADD",
      input.internationalShippingKrw,
      "판매자 기본값 · 추정치",
      "국제배송비가 입력되지 않았습니다",
    ),
  );

  // ④ 합계 — 여기까지가 "내가 치르는 돈"이다.
  rows.push(
    krwLine(
      "LANDED_COST",
      "TOTAL",
      input.landedCostKrw,
      input.costBasisIsKrMarket ? "한국 표시가 + 국제배송비" : "원화 환산 + 국제배송비",
      "원본 가격을 확인하지 못해 원가를 계산할 수 없습니다",
    ),
  );

  // ⑤ 내가 정하는 값. 추천가를 절대 여기에 넣지 않는다 — 넣는 순간 셀러는
  //    "이미 이 가격으로 팔기로 되어 있다"고 읽는다(추천가는 별도 줄에 있다).
  rows.push({
    key: "SELLER_PLANNED_PRICE",
    role: "PLAN",
    tier: TIER_BY_ROLE.PLAN,
    label: PRICE_MEANING_LABEL.SELLER_PLANNED_PRICE,
    basis: "판매자가 정한 판매가",
    value: input.sellerPlannedPriceKrw != null ? formatKrwAmount(input.sellerPlannedPriceKrw) : null,
    empty:
      input.sellerPlannedPriceKrw != null
        ? null
        : miEmptyState("UNVERIFIABLE", "아직 판매가를 정하지 않았습니다"),
  });

  // ⑥ 그래서 남는 값. 착지원가만 빼는 게 아니라 플랫폼 수수료(와 확인된
  //    관부가세)까지 빠진 값이라, 화면에서 "판매가 − 착지원가"로 암산했을 때
  //    맞지 않는다. 그 차이를 숨기지 않고 기준 문장에 적는다.
  const profitBasis = [
    "내 판매가 − 확인된 원가 − 플랫폼 수수료",
    input.platformFeeKrw != null ? `수수료 ${formatKrwAmount(input.platformFeeKrw)}` : null,
    input.costIncomplete ? "아직 확인되지 않은 비용이 있어 실제 수익은 더 낮을 수 있습니다" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  rows.push(
    krwLine(
      "EXPECTED_PROFIT",
      "RESULT",
      input.expectedProfitKrw,
      profitBasis,
      "판매가를 정하면 예상 수익을 계산합니다",
    ),
  );

  rows.push({
    key: "EXPECTED_MARGIN",
    role: "RESULT",
    tier: TIER_BY_ROLE.RESULT,
    label: PRICE_MEANING_LABEL.EXPECTED_MARGIN,
    // 같은 "예상 마진"이라도 내 판매가 기준과 추천 판매가 기준은 다른 숫자다.
    // 기준을 적지 않으면 한 라벨이 두 사실을 가리키게 된다.
    basis: input.marginBasis === "RECOMMENDED" ? "추천 판매가 기준" : "내 판매가 기준",
    value: input.marginPercent != null ? `${input.marginPercent.toFixed(1)}%` : null,
    empty:
      input.marginPercent != null
        ? null
        : miEmptyState("UNVERIFIABLE", "판매가를 정하면 예상 마진을 계산합니다"),
  });

  return rows;
}

/* ──────────────────────── ① 원본 상품 가격(헤드라인) ──────────────────────── */

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — 화면이 여는 첫 줄.
 *
 * ── 왜 사슬의 첫 줄을 그대로 쓰지 않는가 ─────────────────────────────────
 * 대부분은 그대로 쓴다(아래 첫 분기). 다만 원가 기준이 "판매자의 한국 표시가"인
 * 상품(costBasis = KR_MARKET)에서는 사슬의 첫 줄이 ₩104,600이다 — 그 값은
 * **내가 치르는 돈**으로서는 맞지만 "이 상품이 원래 얼마인가"의 답은 아니다.
 * 그래서 그때만 스냅샷에 저장된 원본 판매자 페이지 가격(통화 그대로)을 ①에
 * 세우고, 한국 표시가는 ⓘ 글로벌 시장의 🇰🇷 줄과 ③ 사슬에 그대로 남긴다. 지우지 않는다 —
 * 자리를 바꿀 뿐이다. 두 값은 서로 다른 사실이라 같은 카드에서 겨루면 안 된다.
 *
 * ── MI/PRICE-2(CEO 지시, 2026-09-12) — 한국 표시가는 ①에도 선다 ────────────
 * "겨루면 안 된다"와 "같은 카드에 있으면 안 된다"는 다른 말이다. /en-kr의
 * ₩162,000은 남의 가격이 아니라 **그 판매처 자신의 페이지에서 직접 읽은 값**이라
 * 원본 상품의 사실에 속한다. 그래서 krMarket 줄로 ①에 함께 세우되, 큰 숫자
 * 자리는 여전히 원본 통화(€75)가 갖는다 — 첫 질문의 답은 그쪽이기 때문이다.
 * 두 줄은 크기와 라벨로 층이 갈리지 겨루지 않는다.
 *
 * ── 없는 환산을 만들지 않는다 ────────────────────────────────────────────
 * 스냅샷 원본가를 쓰는 경우 그 금액에 대응하는 원화값이 응답에 없다. 환율을
 * 곱해 만들어 낼 수는 있지만 그 순간 화면에만 존재하는 아홉 번째 숫자가 생기고,
 * 그 숫자는 서버의 어떤 계산과도 일치하지 않는다. 그래서 converted는 null이 되고
 * 화면은 환산 줄을 그리지 않는다.
 */
export interface OriginalPriceHeadline {
  title: string;
  /** 원본 통화 그대로의 한 줄. 값이 없어도 줄 자체는 존재한다. */
  price: PriceLine;
  /** 원화 환산 한 줄. 대응하는 원화값이 응답에 없으면 null이다(곱하지 않는다). */
  converted: PriceLine | null;
  /**
   * MI/PRICE-2(CEO 지시, 2026-09-12) — 그 판매처가 한국 방문자에게 직접 보여주는
   * 값 한 줄. 관측이 없으면 null이고, ①의 첫 줄이 이미 그 값일 때도 null이다
   * (같은 라벨을 한 카드에서 두 번 쓰지 않는다).
   *
   * 왜 ①인가: /en-kr의 ₩162,000은 **판매자 자신의 페이지에서 직접 읽은 값**이다.
   * 남이 파는 값도, 우리가 환율로 만든 값도 아니라 "이 상품이 원래 얼마인가"에
   * 딸린 원본 사실이다. 그래서 원본 상품 가격과 같은 카드에 산다 — €75와
   * ₩162,000이 한 판매처의 두 시장 표시가라는 것이 여기서 한눈에 읽힌다.
   */
  krMarket: PriceLine | null;
  /**
   * 원본 통화 가격과 한국 표시가가 다른 사실이라는 것을 말하는 한 줄.
   * 둘을 나란히 놓을 이유가 없는 상품에서는 null이다.
   */
  note: string | null;
}

export interface OriginalPriceHeadlineInput {
  /** 사슬과 **같은 값**을 받는다. 두 곳이 서로 다른 원본을 말할 수 없게. */
  observedOriginPrice: ObservedOriginPrice | null;
  originPrice: { amount: number; currency: string } | null;
  /** cost.costKrw — 위 원본 금액의 원화 짝. 사슬의 환산 줄과 같은 값이다. */
  sourcePriceKrw: number | null;
  exchangeRate: number | null;
  exchangeRateIsEstimate: boolean;
  originPriceBasis: string | null;
  costBasisIsKrMarket: boolean;
  /**
   * 스냅샷(product_snapshots.canonicalProduct.price)에 저장된 원본 판매자 페이지
   * 가격. 원가가 한국 표시가 기준일 때 "원래 얼마인가"에 답할 수 있는 유일한
   * 값이다. 가격을 읽지 못한 스냅샷(priceValidity ≠ VALID)은 호출부가 null로
   * 넘긴다 — 못 읽은 값을 원본가격이라고 부르지 않는다.
   */
  snapshotOriginPrice: { amount: number; currency: string } | null;
  /**
   * MI/PRICE-2(CEO 지시, 2026-09-12) — ② 글로벌 시장에서 관측된 **판단 시장(한국)
   * 줄** 그대로. 금액 문자열과 그 줄의 시장 코드만 받는다.
   *
   * 숫자가 아니라 이미 완성된 문자열을 받는 것이 중요하다. 여기서 원화 금액을
   * 다시 포맷하면 ②의 "₩162,000"과 ①의 "₩162,000"이 서로 다른 코드에서 나오고,
   * 언젠가 한쪽만 고쳐진다. 같은 관측이 두 자리에 보이는 것은 사본이 아니라
   * **같은 사실의 두 표시**여야 한다.
   *
   * 판단 시장 관측이 정확히 하나일 때만 호출부가 값을 넘긴다
   * (global-market.pickJudgingMarketRow) — 모르면 고르지 않는다.
   */
  krMarketObservation: { price: string; marketCode: string } | null;
}

function isKrw(currency: string): boolean {
  return currency.toUpperCase() === "KRW";
}

/**
 * MI/PRICE-2(CEO 지시, 2026-09-12) — ①에 놓이는 "원본 판매자 한국 표시가" 한 줄.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 실제 화면(Bobo Choses B226AC043)의 ② 글로벌 시장 카드가 이랬다:
 *
 *   🇰🇷 한국 · en-kr    착지원가 기준    ₩162,000
 *
 * ₩162,000은 착지원가가 아니다. 그건 그 판매처가 한국 방문자에게 보여주는
 * **관측된 시장가**이고, 착지원가는 €75 → 환율 → ₩116,742 + 국제배송비다.
 * 배지는 "이 관측이 곧 원가 사슬의 출발점"이라는 참인 사실을 말하려던 것인데,
 * 시장가 옆에 붙는 순간 그 숫자 자체가 원가로 읽혔다.
 *
 * ── 사실을 어떻게 보존하는가 ─────────────────────────────────────────────
 * 배지는 지우고, 사실은 여기로 옮긴다. 관측된 값은 ①에서 자기 라벨(원본 판매자
 * 한국 표시가)을 달고 서고, "이 관측이 ④의 출발점"이라는 관계는 금액이 아니라
 * 기준 문장이 말한다. 라벨은 무엇인지를, 기준 문장은 어디에 쓰였는지를 말한다 —
 * 배지 하나가 둘을 겸하려다 첫 번째를 틀리게 만들었던 자리다.
 */
function krMarketLine(input: OriginalPriceHeadlineInput): PriceLine | null {
  const observed = input.krMarketObservation;
  if (!observed) return null;
  return {
    key: "KR_MARKET_PRICE",
    label: PRICE_MEANING_LABEL.KR_MARKET_PRICE,
    basis: [
      `${observed.marketCode} 페이지에서 직접 관측 · 환율 환산이 아닙니다`,
      // 같은 관측이 ③ 원가 계산의 출발점인 상품에서만 붙는다. 숨기면 셀러가
      // 같은 숫자를 두 번 세고, 금액 옆에 배지로 붙이면 시장가가 원가가 된다.
      input.costBasisIsKrMarket ? "③ 수익성의 착지원가가 이 관측에서 출발합니다" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    value: observed.price,
    empty: null,
  };
}

export function buildOriginalPriceHeadline(input: OriginalPriceHeadlineInput): OriginalPriceHeadline {
  const title = PRICE_SECTION_TITLE.ORIGINAL;
  const krMarket = krMarketLine(input);
  // 원가가 한국 표시가 기준이면 그 원화값은 원본 통화 가격이 아니다 — 사슬의
  // 첫 줄을 ①으로 올릴 수 없는 유일한 경우다.
  const chainOrigin = input.costBasisIsKrMarket ? null : (input.observedOriginPrice ?? input.originPrice);

  if (chainOrigin && !isKrw(chainOrigin.currency)) {
    return {
      title,
      price: {
        key: "SOURCE_ORIGINAL_PRICE",
        label: PRICE_MEANING_LABEL.SOURCE_ORIGINAL_PRICE,
        basis: ["원본 판매자 페이지 기준", input.originPriceBasis].filter(Boolean).join(" · "),
        value: formatOriginAmount(chainOrigin.amount, chainOrigin.currency),
        empty: null,
      },
      // 사슬의 환산 줄과 **같은 입력**에서 나온 같은 값이다(사본이 아니라 같은 사실).
      converted: {
        key: "SOURCE_PRICE_KRW",
        label: PRICE_MEANING_LABEL.SOURCE_PRICE_KRW,
        basis: input.observedOriginPrice
          ? exchangeRateNote(input.observedOriginPrice.currency, input.observedOriginPrice.exchangeRate, "OBSERVED", false)
          : exchangeRateNote(chainOrigin.currency, input.exchangeRate, "LIVE", input.exchangeRateIsEstimate),
        value: input.sourcePriceKrw != null ? formatKrwAmount(input.sourcePriceKrw) : null,
        empty:
          input.sourcePriceKrw != null
            ? null
            : miEmptyState("UNVERIFIABLE", "환율을 확인하지 못해 환산할 수 없습니다"),
      },
      krMarket,
      note: null,
    };
  }

  if (input.snapshotOriginPrice && !isKrw(input.snapshotOriginPrice.currency)) {
    return {
      title,
      price: {
        key: "SOURCE_ORIGINAL_PRICE",
        label: PRICE_MEANING_LABEL.SOURCE_ORIGINAL_PRICE,
        // 언제 읽은 값인지 숨기지 않는다 — 최신 확인가가 아니라 스냅샷 값이다.
        basis: "원본 판매자 페이지 기준 · 상품을 가져온 시점에 저장된 가격",
        value: formatOriginAmount(input.snapshotOriginPrice.amount, input.snapshotOriginPrice.currency),
        empty: null,
      },
      // 이 금액의 원화 짝이 응답에 없다. 환율을 곱해 만들지 않는다.
      converted: null,
      krMarket,
      // MI/PRICE-2 — 한국 표시가가 이제 바로 아래 줄에 서 있으므로 "아래 ②·④에서
      // 확인하세요"라고 보낼 이유가 없다. 대신 두 값이 왜 다른지를 말한다:
      // €75는 원본 페이지의 값이고 ₩162,000은 같은 판매처의 한국 페이지 값이다.
      note:
        input.costBasisIsKrMarket || krMarket
          ? `${PRICE_MEANING_LABEL.KR_MARKET_PRICE}는 이 값의 환율 환산이 아니라, 같은 판매처가 한국 페이지에 따로 매긴 값입니다.`
          : null,
    };
  }

  // 원본이 원화로만 확인된 경우. 없는 외화 가격을 지어내지 않고, 그 원화가
  // 무엇인지(한국 표시가인지 원본 페이지 가격인지)를 라벨로 정확히 말한다.
  const krwOnly = input.costBasisIsKrMarket
    ? { key: "KR_MARKET_PRICE" as const, basis: "이 판매처가 한국 방문자에게 직접 보여주는 가격 · 환율 환산이 아닙니다" }
    : { key: "SOURCE_ORIGINAL_PRICE" as const, basis: "원본 판매자 페이지 기준" };
  const krw = input.costBasisIsKrMarket ? input.sourcePriceKrw : (chainOrigin?.amount ?? input.sourcePriceKrw);
  return {
    title,
    price: {
      key: krwOnly.key,
      label: PRICE_MEANING_LABEL[krwOnly.key],
      basis: [krwOnly.basis, input.originPriceBasis].filter(Boolean).join(" · "),
      value: krw != null ? formatKrwAmount(krw) : null,
      empty: krw != null ? null : miEmptyState("UNVERIFIABLE", "원본 상품 가격을 읽지 못했습니다"),
    },
    converted: null,
    // 이 분기의 첫 줄이 이미 한국 표시가면(krwOnly.key === "KR_MARKET_PRICE")
    // 같은 라벨을 한 카드에서 두 번 쓰게 된다 — 그때는 줄을 만들지 않는다.
    krMarket: krwOnly.key === "KR_MARKET_PRICE" ? null : krMarket,
    note:
      krw != null && input.costBasisIsKrMarket
        ? "이 판매처는 한국 방문자에게 원화로 직접 가격을 매깁니다 — 원본 통화 가격은 따로 확인되지 않았습니다."
        : null,
  };
}

/* ─────────────────────────── 시장 맥락(두 번째 축) ─────────────────────────── */

/**
 * 가격 경쟁력 축의 상태. 수익성 축(위 사슬)과 **완전히 분리된** 값이다.
 *
 *   AVAILABLE     한국 편집샵 가격이 있어 비교할 수 있다.
 *   REFERENCE_ONLY 동일상품이 아닌 비교상품 참고가뿐이다(있지만 확정 근거는 아니다).
 *   NO_DATA       조회했는데 결과가 없었다 — 나쁜 게 아니라 흔적이 없는 것이다.
 *   UNRESOLVED    관측된 시장이 여러 개라 한국 기준을 확정하지 못했다.
 */
export type CompetitivenessState = "AVAILABLE" | "REFERENCE_ONLY" | "NO_DATA" | "UNRESOLVED";

export interface MarketContextInput {
  /** domesticMarketSplit.basis */
  domesticBasis: "EXACT" | "COMPARISON" | "NONE";
  /** domesticCompetition.averagePriceKrw */
  domesticAveragePriceKrw: number | null;
  /** domesticCompetition.lowestPriceKrw — 평균가가 없을 때만 대표값으로 쓴다(UX-1D). */
  domesticLowestPriceKrw: number | null;
  /** domesticCompetition.sellerCount — Source 단위 판매처 수(시장 수가 아니다). */
  domesticSellerCount: number;
  /** domesticCompetition.priceMarketBasis === "UNRESOLVED" */
  domesticUnresolved: boolean;
  /**
   * UX 2.4(CEO 지시, 2026-09-11) — 여기 있던 overseasMarketCount를 없앴다.
   *
   * UX 2.3에서는 "해외 시장 참고 N개"가 이 블록 안에 접혀 있었다. 두 가지가
   * 틀렸다. ① 그 목록의 출처는 domesticCompetition.sellers, 즉 **국내 편집샵**
   * 관측이다. DOMESTIC_SHOP은 market_code를 저장하지 않아 전부 null이고,
   * splitByTargetMarket이 null을 "한국이 아님"으로 분류하는 바람에 국내
   * 비교상품 판매처들이 "🌎 해외 시장 참고"라는 제목 아래 서 있었다 — 이번
   * 지시가 없애라고 한 혼동을 화면이 스스로 만들고 있었다. ② 판매자가 실제로
   * 여러 시장에 낸 가격(en-us/en-fr/en-de/en-int)은 애초에 이 블록에 들어온
   * 적이 없다. 그건 SELLER_ORIGIN 관측이고, 이제 global-market.ts가 만드는
   * 별도 카드가 책임진다.
   *
   * 그래서 이 타입에서 필드를 지운 것 자체가 장치다 — 이 블록(한국 경쟁시장)이
   * 다른 시장 가격을 들고 있을 수 있는 자리를 없앤다.
   */
}

export interface MarketContext {
  market: TargetMarket;
  /** 국내 비교상품 한 줄. 값이 없어도 반드시 존재한다(줄 자체를 지우지 않는다). */
  comparable: PriceLine;
  competitiveness: CompetitivenessState;
  /** "가격 경쟁력만 확인할 수 없다"는 사실을 그대로 말하는 한 줄. 비교 가능하면 null. */
  competitivenessNote: string | null;
  /** 비교 대상 판매처 수(Source 단위). 가격이 아니라 근거의 두께다 — 값이
   * 없어도 "0곳"이라고 말할 수 있는 유일한 숫자라 라벨과 함께 들고 다닌다. */
  sellerCount: { count: number; label: string };
}

/**
 * 한국 시장 맥락을 만든다. **사슬(수익성)의 값을 하나도 받지 않는다** — 받게
 * 두면 언젠가 "국내 데이터가 없으니 마진도 숨기자"는 코드가 여기 들어온다.
 * 그게 정확히 이번 지시가 틀렸다고 말한 화면이다.
 */
export function buildMarketContext(
  input: MarketContextInput,
  market: TargetMarket = KR_TARGET_MARKET,
): MarketContext {
  const competitiveness: CompetitivenessState = input.domesticUnresolved
    ? "UNRESOLVED"
    : input.domesticBasis === "EXACT"
      ? "AVAILABLE"
      : input.domesticBasis === "COMPARISON"
        ? "REFERENCE_ONLY"
        : "NO_DATA";

  // 대표값 우선순위는 mi-headline.pickTargetMarketPrice()와 같다 — 평균가가
  // 먼저고, 없을 때만 최저가이며, 최저가라는 사실을 기준에 밝힌다. 두 곳이
  // 다른 값을 고르면 같은 상품의 "국내 비교상품"이 화면 위아래에서 달라진다.
  const representative =
    competitiveness === "NO_DATA" || input.domesticUnresolved
      ? null
      : input.domesticAveragePriceKrw != null
        ? { krw: input.domesticAveragePriceKrw, kind: "평균가" }
        : input.domesticLowestPriceKrw != null
          ? { krw: input.domesticLowestPriceKrw, kind: "최저가" }
          : null;

  const grade = input.domesticBasis === "EXACT" ? "동일상품 기준" : "비교상품 참고가 기준";
  const sellerNote = input.domesticSellerCount > 0 ? ` · 비교상품 ${input.domesticSellerCount}곳` : "";

  const comparable: PriceLine = {
    key: "DOMESTIC_COMPARABLE_PRICE",
    label: PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE,
    basis: representative
      ? `${market.label} 시장 관측 ${representative.kind} · ${grade}${sellerNote}`
      : `${market.label} 시장 관측`,
    value: representative ? formatKrwAmount(representative.krw) : null,
    empty: representative
      ? null
      : input.domesticUnresolved
        ? // 시장이 여러 개인데 어느 것이 한국 관측인지 확정 못 했다. 아무 시장
          // 가격이나 골라 "국내 비교상품"이라고 부르지 않는다.
          miEmptyState("UNVERIFIABLE", "관측된 시장이 여러 개라 한국 기준 가격을 확정하지 못했습니다")
        : miEmptyState("NO_SEARCH_DATA", null),
  };

  const competitivenessNote =
    competitiveness === "AVAILABLE"
      ? null
      : competitiveness === "REFERENCE_ONLY"
        ? "동일상품이 확인되지 않아 가격 경쟁력은 참고 수준입니다 — 원가·수익 계산은 그대로입니다."
        : competitiveness === "UNRESOLVED"
          ? "한국 기준 시장을 확정하지 못해 가격 경쟁력은 확인할 수 없습니다 — 원가·수익 계산은 그대로입니다."
          : // NO_DATA — 이번 지시의 핵심 문장이다. 비교 불가와 계산 불가를 가른다.
            "시장 경쟁가격은 확인할 수 없습니다 — 원가·수익 계산은 그대로 유효합니다.";

  return {
    market,
    comparable,
    competitiveness,
    competitivenessNote,
    // "비교 판매처 3곳"(CEO 지시문의 C 그룹 그대로). 0곳도 사실이므로 숨기지
    // 않는다 — 값이 없는 것과 "찾아봤는데 0곳"은 셀러에게 다른 정보다.
    sellerCount: {
      count: input.domesticSellerCount,
      label: `비교 판매처 ${input.domesticSellerCount}곳`,
    },
  };
}
