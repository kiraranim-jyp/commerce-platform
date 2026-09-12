import { SELLER_FACING_COPY, type MarketCaseCode } from "@commerce/pricing";

/**
 * MI-SIMPLIFY-1(CPO 지시, 2026-09-12) — CASE A/B/C/D를 셀러 어휘로 옮기는 **단
 * 하나의** 지점.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * MI가 답해야 하는 질문은 하나다: "이 상품을 한국에서 이 가격에 팔 만한가?"
 * 그 답을 이미 computePriceRecommendation()이 marketCase로 내고 있는데, 화면은
 * 그 판정을 배지 한 줄로 말하는 대신 조건마다 다른 문장을 즉석에서 조립했다
 * (`marketCase === "B" && " (목표마진 미달, 손실 아님)"`,
 *  `marketCase === "C" ? "국내 시장가로 팔면…" : "국내 동일상품 가격이…"`).
 * 분기가 화면 안에 흩어져 있으면 CASE가 하나 늘 때마다 화면을 뒤져야 하고,
 * 그러다 언젠가 내부 이름("CASE B")이 그대로 새어 나간다 — mi-empty-state.ts가
 * NO_DATA/UNAVAILABLE에 대해 막아 둔 것과 정확히 같은 사고다.
 *
 * ── 왜 SELLER_FACING_COPY를 가져다 쓰는가 ────────────────────────────────
 * 🟢 판매 추천 / 🟡 조건부 판매 / 🔴 판매 비추천이라는 세 마디는 이미 서버가
 * 갖고 있다(packages/pricing/representative-seller-decision.ts). 여기서 같은
 * 말을 다시 타이핑하면 판정 하나에 어휘가 두 벌이 되고, 한쪽만 고쳐지는 날
 * 같은 상품이 헤드라인과 ③ 수익성에서 서로 다른 말을 한다. 그래서 아이콘과
 * 제목은 **가져오고**, 이 파일이 새로 만드는 것은 "왜 그 판정인가"를 한 마디로
 * 말하는 note 하나뿐이다.
 *
 * ── CASE D만 SELLER_FACING_COPY에 없는 이유 ──────────────────────────────
 * 서버의 3단계는 "팔아도 되는가"의 답이고, CASE D는 그 답을 **아직 내지 못한**
 * 상태다(국내 동일상품 가격을 확정하지 못했다). 세 단계 중 하나로 접으면
 * 🟡(조건부)이든 🔴(비추천)이든 "판단했다"는 뜻이 되어버린다 — 근거가 없다는
 * 사실이 근거 있는 판정으로 바뀐다. ⚪는 이 저장소가 "데이터 없음 ≠ 나쁨"에
 * 일관되게 쓰는 기호다(mi-empty-state / MARKET_OUTLOOK_BADGE와 같은 규칙).
 *
 * 판정 자체는 절대 다시 계산하지 않는다. marketCase를 받아 문구로 바꾸기만
 * 한다 — 비교도, 반올림도, 하한선도 여기에 없다.
 */
export interface MiMarketCaseVerdict {
  icon: string;
  /** 판정 한 마디. A/B/C는 서버의 SELLER_FACING_COPY 그대로다. */
  title: string;
  /** 왜 그 판정인가 — 셀러가 다음에 무엇을 할지 고를 수 있는 만큼만. */
  note: string;
}

/**
 * CASE → 판정 배지. 내부 이름(A/B/C/D)은 이 표의 **키**로만 존재하고 값 어디에도
 * 적히지 않는다 — 화면에 "CASE B"가 뜨는 경로 자체를 없앤다(테스트가 고정한다).
 */
const MARKET_CASE_VERDICT: Record<MarketCaseCode, MiMarketCaseVerdict> = {
  // 시장가가 설정 마진을 감당한다 — 그대로 팔면 된다.
  A: { ...SELLER_FACING_COPY.RECOMMENDED, note: "설정 마진 기준 판매 가능" },
  // 손실 구간은 아닌데 설정 마진에는 못 미친다. "팔지 마라"가 아니라
  // "이 마진으로도 괜찮은지 네가 정해라"이므로 🔴이 아니라 🟡이다.
  B: { ...SELLER_FACING_COPY.CONDITIONAL, note: "설정 마진은 부족하지만 손실은 아님" },
  // 시장가로 팔면 착지원가도 회수하지 못한다. 여기서만 "비추천"이라고 말한다.
  C: { ...SELLER_FACING_COPY.NOT_RECOMMENDED, note: "현재 시장가격으로는 원가 이하" },
  // 판단을 내리지 못한 상태. "나쁘다"가 아니라 "아직 말할 수 없다"이다.
  D: { icon: "⚪", title: "판단 보류", note: "동일상품 가격 비교 근거 부족" },
};

/** marketCase가 아직 없는 상품(추천 자체가 계산되지 않은 상태)은 CASE D와 같은
 * 자리에 선다 — 근거가 없다는 사실은 둘 다 같고, 없는 판정을 지어내지 않는다. */
export function miMarketCaseVerdict(marketCase: MarketCaseCode | null | undefined): MiMarketCaseVerdict {
  return MARKET_CASE_VERDICT[marketCase ?? "D"];
}

/**
 * ② 한국 시장 경쟁가격 블록이 통째로 사라졌을 때 그 사실이 가는 자리.
 *
 * 블록을 숨기는 것과 "판단하지 않았다"를 말하지 않는 것은 다르다. 비교 근거가
 * 없다는 사실은 판정의 일부라서, 본문에서 빠지면 "왜 이렇게 판단했나요?" 안에
 * 반드시 남아야 한다 — 그러지 않으면 셀러는 가격 경쟁력까지 확인된 판정으로
 * 읽는다(UX 2.3의 "시장 비교 불가 ≠ 수익성 계산 불가"와 같은 종류의 장치다).
 */
export const NO_DOMESTIC_COMPARABLE_NOTE =
  "국내 동일/유사 상품을 확인하지 못해 가격 경쟁력은 판단하지 않았습니다.";

/**
 * ⓘ 가격 계산 기준 — 권장 판매가격이 무엇으로 만들어졌는지 한 줄.
 *
 * 여기에 숫자를 적지 않는다. 숫자를 적는 순간 그 값은 computePriceBreakdown이
 * 낸 값의 **사본**이 되고, 둘 중 하나만 고쳐지는 날 화면이 자기 계산과 다른
 * 설명을 달게 된다. 이 줄이 말하는 것은 공식의 모양뿐이고, 실제 입력과 결과는
 * 같은 자리의 상세 계산(PriceCalculationDetail)이 그대로 보여준다.
 */
export const PRICE_BASIS_TOOLTIP = "상품가격 + 해외배송비 + 설정 가격정책 → 권장 판매가격";
