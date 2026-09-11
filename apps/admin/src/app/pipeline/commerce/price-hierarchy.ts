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
 * 사실이 사라지지 않는다. 원본가격·착지원가·내 판매가·수익은 접는 순간 셀러가
 * 답을 못 얻는다.
 */
export type ChainTier = "SUMMARY" | "DETAIL";

const TIER_BY_ROLE: Record<ChainRole, ChainTier> = {
  SOURCE: "SUMMARY",
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

export interface PriceChainInput {
  /** cost.originalAmount / cost.originalCurrency — 착지원가 계산에 실제로 들어간 값. */
  originPrice: { amount: number; currency: string } | null;
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
      tier: TIER_BY_ROLE.SOURCE,
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
    rows.push({
      key: "SOURCE_ORIGINAL_PRICE",
      role: "SOURCE",
      tier: TIER_BY_ROLE.SOURCE,
      label: PRICE_MEANING_LABEL.SOURCE_ORIGINAL_PRICE,
      basis: ["원본 판매자 페이지 기준", input.originPriceBasis].filter(Boolean).join(" · "),
      value: input.originPrice
        ? formatOriginAmount(input.originPrice.amount, input.originPrice.currency)
        : null,
      empty: input.originPrice
        ? null
        : miEmptyState("UNVERIFIABLE", "원본 상품 가격을 읽지 못했습니다"),
    });

    // ② 환산 단계. 원본 통화가 이미 원화면 이 줄을 만들지 않는다 — 같은 숫자에
    //    라벨을 하나 더 붙이는 것일 뿐이고, 그게 바로 이번 지시가 없애려는
    //    "같은 값이 두 개의 가격으로 보이는" 화면이다.
    const originIsKrw = input.originPrice?.currency.toUpperCase() === "KRW";
    if (!originIsKrw) {
      const rateNote =
        input.exchangeRate != null && input.originPrice
          ? `1 ${input.originPrice.currency.toUpperCase()} = ₩${Math.round(input.exchangeRate).toLocaleString("ko-KR")}${
              input.exchangeRateIsEstimate ? " · 실시간 조회 실패, 고정 참고환율" : " · 현재 환율"
            }`
          : "환율을 확인하지 못했습니다";
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
