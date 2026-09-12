import type { MarketCaseCode } from "@commerce/pricing";

/**
 * MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 「왜 이렇게 판단했나요?」가 답하는 질문은
 * **하나**다: 왜 이 판정인가.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 이 접힘 안에는 지금까지 화면의 나머지 절반이 전부 들어 있었다 — 판정 설명
 * 두 문장, 👉 행동 문장, 왜 이런 판단인가 목록, 상세 계산 참고표, 아직 확인되지
 * 않은 비용, 시장 신호 요약, 판단 근거 체크리스트, 시장 판단 요인표, 종합 시장
 * 상태, 신호 3종, 전략 가이드, 레이더, 재조회, 국내 비교상품, 동일상품 근거,
 * 상표권 안내, 참고용 판단 안내. 층은 내려갔지만 셀러가 "정말?"을 눌렀을 때
 * 받는 것은 여전히 스무 덩어리였고, 그러면 되물음은 답이 아니라 두 번째 화면이
 * 된다.
 *
 * 그래서 이 파일이 만드는 것은 **네 줄**이다. 한 줄에 한 사실만 있고, 마지막
 * 줄은 언제나 "그래서 어떻게 하라"이다:
 *
 *   🟢 설정 마진을 확보할 수 있습니다.        ← 수익성(CASE)
 *   💰 국내 비교가격보다 경쟁 가능한 가격대입니다.  ← 가격 경쟁력
 *   🔎 동일상품 가격 근거가 충분합니다.       ← 근거의 강도
 *   → 판매를 진행해도 좋습니다.               ← 행동
 *
 * ── 판정하지 않는다 ────────────────────────────────────────────────────
 * marketCase(computePriceRecommendation이 낸 CASE A/B/C/D)와 이미 계산된 두
 * 사실(비교상품이 있는가 · 동일상품 근거인가)을 문장으로 옮기기만 한다. 비교도,
 * 임계값도, 반올림도 여기에 없다 — 판정을 여기서 한 번 더 내리면 배지("설정
 * 마진 기준 판매 가능")와 이 줄이 다른 말을 하는 날이 온다.
 *
 * 수익성 배지와 **같은 입력**(marketCase)을 쓰는 것이 핵심이다. 되물음은 바로
 * 위에서 본 판정을 설명하는 자리이지 두 번째 판정을 내리는 자리가 아니다.
 */
export type MiVerdictCase = MarketCaseCode;

/** 근거의 강도. domesticMarketSplit.basis 그대로다 — 화면이 다시 세지 않는다. */
export type MiEvidenceBasis = "EXACT" | "COMPARISON" | "NONE";

export interface MiVerdictExplanationInput {
  /** recommendation.marketCase ?? null. 없으면 CASE D와 같은 자리에 선다. */
  marketCase: MarketCaseCode | null;
  /** buildMarketComparison(...).hasComparable — 국내 비교가격이 실제로 있는가. */
  hasComparable: boolean;
  /** domesticMarketSplit.basis — 그 가격이 동일상품 기준인가 참고가 기준인가. */
  evidenceBasis: MiEvidenceBasis;
}

/** 1번째 줄 — 수익성. 아이콘은 판정 배지(mi-market-case.ts)와 같은 세 색이다. */
const MARGIN_LINE: Record<MarketCaseCode, string> = {
  A: "🟢 설정 마진을 확보할 수 있습니다.",
  B: "🟡 설정 마진에는 못 미치지만 손실 구간은 아닙니다.",
  C: "🔴 현재 시장가격으로는 착지원가를 회수할 수 없습니다.",
  D: "⚪ 설정 마진을 확보할 수 있는지 아직 판단하지 못했습니다.",
};

/** 4번째 줄 — 그래서 무엇을 하라. 화면의 CTA 버튼과 같은 방향만 말한다. */
const ACTION_LINE: Record<MarketCaseCode, string> = {
  A: "→ 판매를 진행해도 좋습니다.",
  B: "→ 이 마진으로 팔지 직접 정하세요.",
  C: "→ 지금 가격으로는 판매를 권하지 않습니다.",
  D: "→ 국내 동일상품을 확인한 뒤 다시 판단하세요.",
};

/**
 * 2번째 줄 — 가격 경쟁력. 비교할 국내 가격이 없으면 "나쁘다"가 아니라 "못 봤다"이다
 * (이 저장소가 빈 상태에 일관되게 쓰는 규칙 — 데이터 없음 ≠ 나쁨).
 */
function competitivenessLine(input: MiVerdictExplanationInput): string {
  if (!input.hasComparable) return "💰 국내 비교가격을 확인하지 못했습니다.";
  // CASE C만 "시장가 < 착지원가"라는 사실이 이미 확정돼 있다(computePriceRecommendation).
  if (input.marketCase === "C") return "💰 국내 비교가격이 착지원가보다 낮습니다.";
  return "💰 국내 비교가격보다 경쟁 가능한 가격대입니다.";
}

/** 3번째 줄 — 근거의 강도. 판정이 무엇 위에 서 있는지 한 마디로. */
const EVIDENCE_LINE: Record<MiEvidenceBasis, string> = {
  EXACT: "🔎 동일상품 가격 근거가 충분합니다.",
  COMPARISON: "🔎 동일상품은 확인되지 않아 비교상품 참고가 기준입니다.",
  NONE: "🔎 국내 가격 근거를 찾지 못했습니다.",
};

/**
 * 네 줄. 길이가 네 줄이라는 것은 취향이 아니라 계약이다 — 테스트가 상한을
 * 고정하고, 다음 기능이 다섯 번째 줄을 세우려 하면 거기서 먼저 걸린다.
 */
export function buildMiVerdictExplanation(input: MiVerdictExplanationInput): string[] {
  const code: MarketCaseCode = input.marketCase ?? "D";
  return [MARGIN_LINE[code], competitivenessLine(input), EVIDENCE_LINE[input.evidenceBasis], ACTION_LINE[code]];
}

/**
 * 네 줄 아래의 나머지 전부가 사는 자리의 이름.
 *
 * 지금까지 되물음에 들어 있던 스무 덩어리(레이더 · 시장 신호 · 판단 근거
 * 체크리스트 · 국내 비교상품 목록 · 동일상품 근거 · 재조회 · 상표권 안내 …)는
 * 지우지 않는다. 한 단계 더 들어가야 나올 뿐이다 — CEO 지시문의 "Radar expands
 * only inside it, on demand" 그대로다.
 */
export const MI_VERDICT_EVIDENCE_TOGGLE_LABEL = "판단 근거 자세히 보기";
