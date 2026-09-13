import { pickJudgingMarketRow, type GlobalMarketCard } from "./global-market";
import { KR_TARGET_MARKET, type TargetMarket } from "./market-target";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";
import { PRICE_MEANING_LABEL, PRICE_SECTION_TITLE, type MarketContext } from "./price-hierarchy";

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — **② 한국 시장 경쟁가격**: 화면에서 비교가
 * 일어나는 유일한 자리.
 *
 * ── 왜 이 파일이 따로 있는가 ─────────────────────────────────────────────
 * 비교해야 하는 두 값은 서로 다른 파일이 만든다. 그리고 그 분리는 실수가 아니라
 * 장치다:
 *
 *   🇰🇷 원본 판매자 한국 표시가  global-market.ts   이 판매처가 한국에서 받는 값
 *   🇰🇷 국내 비교상품            price-hierarchy.ts 다른 한국 판매자들이 받는 값
 *
 * buildGlobalMarketCard()는 국내 비교상품을 **입력으로 받을 수 없고**,
 * buildMarketContext()는 시장 코드를 **인자로조차 받지 않는다**. 두 축이 서로의
 * 입력을 받게 두면 언젠가 둘을 하나의 평균으로 접는 코드가 들어오고, 그 순간
 * 셀러는 "₩78,000에 사서 ₩116,600에 파는" 기회를 "비슷한 숫자 둘"로 읽는다.
 *
 * 그래서 이 파일은 두 builder의 **결과만** 받는다. 입력을 섞지 않고 결과를 나란히
 * 놓는다 — 그것이 이번 지시가 요구한 "② 한 곳에서만 비교가 일어난다"이다.
 *
 * ── 계산하지 않는다 ─────────────────────────────────────────────────────
 * 차액도, 비율도, 평균도 내지 않는다. ₩38,600이라는 숫자는 매력적이지만 그건
 * 우리가 만든 값이고, 실제로는 그 사이에 국제배송비·국내 배송원가·수수료가 있다
 * (관부가세는 MI-COST-POLICY-1에서 빠졌다 — 구매자 부담이라 판매자 원가가 아니다).
 * 두 값을 나란히 놓는 것까지가 화면의 일이고, 빼는 것은 ③ 수익성의 일이다.
 */
export interface MarketComparisonSide {
  label: string;
  /** 화면에 그대로 쓰는 금액 문자열. 두 builder가 이미 완성한 값을 옮기기만 한다. */
  value: string | null;
  /** 이 값이 무엇을 기준으로 한 값인지. 둘의 차이는 여기서 갈린다. */
  basis: string | null;
  empty: MiEmptyState | null;
}

export interface MarketComparison {
  title: string;
  /** 왼쪽 — 이 판매처가 한국에서 직접 받는 값(① 아래 ⓘ 글로벌 시장의 🇰🇷 줄과 같은 관측이다). */
  seller: MarketComparisonSide;
  /** 오른쪽 — 다른 한국 판매자들이 받는 값(C 그룹 그대로). */
  domestic: MarketComparisonSide;
  /** 두 값 사이에 놓이는 기호. 비교라는 사실을 화면 모양이 말하게 한다. */
  versus: string;
  /** 무엇과 무엇을 비교하고 있는지 한 문장. 라벨만으로는 "둘 다 한국 가격"으로 읽힌다. */
  versusNote: string;
  /**
   * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — 비교할 국내 상품이 실제로 있는가.
   *
   * 없으면 화면은 이 블록을 **통째로 그리지 않는다**(빈 칸으로 남기지 않는다).
   * 빈 칸은 정보가 아니라 질문이다: 셀러는 "⚪ 검색 데이터 없음" 두 칸을 보고
   * 조회가 고장났는지, 자기가 뭘 안 했는지, 판정이 틀렸는지를 스스로 추론해야
   * 했다. 비교 근거가 없다는 사실 자체는 지우지 않고 "왜 이렇게 판단했나요?"
   * 안으로 옮긴다 — 그건 판정의 일부이지 본문의 숫자가 아니다
   * (mi-market-case.ts의 NO_DOMESTIC_COMPARABLE_NOTE).
   *
   * 판정은 여기서 하지 않는다. buildMarketContext가 이미 낸 comparable에 값이
   * 있는지만 본다 — "비교상품이 있다"의 기준을 두 곳에서 각자 정하면 언젠가
   * 블록은 숨겼는데 판정은 비교한 것으로 나오는 화면이 생긴다.
   */
  hasComparable: boolean;
}

/**
 * 두 축의 **결과**를 나란히 놓는다. 어느 쪽 builder의 입력에도 손대지 않는다.
 *
 * 판매자 한국 가격은 글로벌 시장 카드의 판단 시장 줄에서만 온다 — 그 줄이 정확히 하나일
 * 때만 쓰고, 없으면 "확인되지 않았다", 둘 이상이면 "확정하지 못했다"고 말한다
 * (buildGlobalMarketCard의 원가 기준 판별과 같은 규칙이다: 모르면 고르지 않는다).
 */
export function buildMarketComparison(
  card: GlobalMarketCard,
  context: MarketContext,
  market: TargetMarket = KR_TARGET_MARKET,
): MarketComparison {
  const judging = card.rows.filter((row) => row.isJudgingMarket);
  const row = pickJudgingMarketRow(card);

  const seller: MarketComparisonSide = {
    // 라벨은 price-hierarchy의 표에서만 나온다. 여기서 "판매자 한국 가격" 같은
    // 두 번째 이름을 만들면 같은 사실에 라벨이 둘이 되고, 그게 이 계층이
    // 없애려던 문제 그 자체다(의미 하나당 라벨 하나).
    label: PRICE_MEANING_LABEL.KR_MARKET_PRICE,
    value: row ? row.observedPrice : null,
    basis: row
      ? [
          `${row.flag} ${row.name} · ${row.code}`,
          // MI/PRICE-2(CEO 지시, 2026-09-12) — 여기 있던 "착지원가 기준"을 뺐다.
          // 이 칸의 ₩162,000은 **관측된 시장가**이고, 착지원가(€75 → ₩116,742 +
          // 국제배송비)는 다른 숫자다. 비교의 한쪽 칸에 원가 라벨이 붙으면
          // "판매자가 받는 값 VS 다른 판매자가 받는 값"이라는 이 블록의 문장이
          // "내 원가 VS 남의 판매가"로 읽힌다 — ②의 배지와 같은 종류의 오독이다.
          // 같은 관측이 ③ 원가 계산의 출발점이라는 사실은 ①이 말한다.
          "이 판매처가 직접 파는 값",
          // MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — 여기 있던
          // "원화 환산 ₩113,629"를 뺀다. 판단 시장 줄의 대표값은 이제 **언제나
          // 원화**라(global-market.ts), 그 원화는 왼쪽 칸의 value가 이미 들고
          // 있다 — 같은 숫자를 기준 문장에 한 번 더 적으면 셀러는 두 금액이
          // 있는 줄로 읽는다. 남길 사실은 "그 원화가 환산값인가"이고, 그건
          // 판매처가 페이지에 실제로 적어 둔 외화 표시가가 말한다.
          row.observedOriginPrice ? `원 표시가 ${row.observedOriginPrice}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : `${market.label} 시장 관측`,
    empty: row
      ? null
      : judging.length > 1
        ? miEmptyState(
            "UNVERIFIABLE",
            `${market.label} 시장 관측이 여러 개라 이 판매처의 한국 가격을 확정하지 못했습니다`,
          )
        : miEmptyState("NO_SEARCH_DATA", `이 판매처의 ${market.label} 시장 가격이 확인되지 않았습니다`),
  };

  const domestic: MarketComparisonSide = {
    label: context.comparable.label,
    value: context.comparable.value,
    basis: context.comparable.basis,
    empty: context.comparable.empty,
  };

  return {
    title: PRICE_SECTION_TITLE.DOMESTIC_COMPETITION,
    seller,
    domestic,
    versus: "VS",
    versusNote: `왼쪽은 이 판매처가 ${market.label}에서 직접 받는 값, 오른쪽은 다른 ${market.label} 판매자들이 받는 값입니다 — 같은 상품의 서로 다른 두 가격입니다.`,
    // 오른쪽 칸(국내 비교상품)에 값이 있을 때만 이 블록이 비교다. 왼쪽만 있는
    // 상태는 비교가 아니라 관측 하나이고, 그 관측은 ①이 이미 말하고 있다.
    hasComparable: domestic.value != null,
  };
}
