import type { RadarAxisKey, RadarLevel, RadarResult } from "@commerce/pricing";
import { emptyStateForAxis } from "./mi-empty-state";

/**
 * MI-UX-FINAL-4(CEO 지시, 2026-09-13) — 「판단 근거 자세히 보기」가 여는 것은
 * **네 줄**이다.
 *
 * ── 이 자리가 지금까지 무엇이었나 ────────────────────────────────────────
 * 되물음 한 단계 아래에는 화면의 나머지 절반이 전부 들어 있었다: 판정 설명 두
 * 문장 · 👉 행동 · 상세 계산 dl · 왜 이 판정인가 목록 · 아직 확인되지 않은 비용 ·
 * 시장 신호 3종 · 종합 시장 상태 · 전략 가이드 · 판단 근거 체크리스트 · 레이더 ·
 * 시장 판단 요인표 · 국내 비교상품 원자료 표 · 동일상품 근거(매칭 알고리즘) ·
 * 상표권 안내 두 문단 · 분석 기준 시장 배너 · 🔄 다시 확인. 층은 계속 내려갔지만
 * 셀러가 "정말?"을 눌렀을 때 받는 것은 여전히 스무 덩어리였고, 그러면 이 자리는
 * 답이 아니라 **두 번째 화면**이 된다.
 *
 * ── 이 파일이 만드는 것 ──────────────────────────────────────────────────
 * 판정을 떠받치는 네 축을, 축마다 **한 줄씩**. 그 네 축은 이미 계산돼 있다 —
 * computeRadar()가 내는 바로 그 축이다. 여기서 판정을 다시 내리지 않고, 등급을
 * 다시 매기지도 않는다. 하는 일은 두 가지뿐이다:
 *
 *   ① CEO가 지정한 이름과 순서로 네 축을 세운다
 *      (💰 수익성 · 🇰🇷 가격 경쟁력 · 🔎 상품 동일성 · 📊 시장 신호).
 *   ② 각 축의 상태를 한 낱말로 옮긴다(등급어 또는 빈 상태 칩).
 *
 * ── 숫자를 적지 않는다 ──────────────────────────────────────────────────
 * 이 네 줄에는 금액도 퍼센트도 개수도 없다. 그 숫자들은 전부 바로 위 본문이
 * 이미 보여준 값이고(원본가 · 국내 시장 · 해외 시장 · 수익성), 같은 사실이 한
 * 화면에 두 번 서면 셀러는 둘이 다른 값인 줄 알고 다시 읽는다. 여기가 답하는
 * 질문은 "그래서 그 숫자들이 어느 쪽으로 읽혔는가" 하나다.
 *
 * ── 별점도 적지 않는다 ──────────────────────────────────────────────────
 * 바로 위 GO/STOP 카드의 레이더가 같은 네 축을 그림으로 보여준다. 그 옆에 별점
 * 목록을 한 벌 더 두면 축 값이 한 화면에 두 번 뜬다(그것이 예전 구조였다).
 * 그림은 카드에, 낱말은 이 네 줄에 — 한 사실은 한 곳에 있다.
 */

/** CEO가 지정한 이름과 순서. 레이더 축 키와 1:1로 붙는다. */
export const MI_EVIDENCE_AXES: { key: RadarAxisKey; title: string }[] = [
  { key: "profitability", title: "💰 수익성" },
  { key: "priceCompetitiveness", title: "🇰🇷 가격 경쟁력" },
  { key: "matchConfidence", title: "🔎 상품 동일성" },
  { key: "marketDemand", title: "📊 시장 신호" },
];

/**
 * 등급을 낱말로. MiRadar의 LEVEL_STARS와 **같은 세 낱말**을 쓴다 — 같은 등급이
 * 화면 두 곳에서 다른 이름으로 불리면 셀러는 두 판정이 있는 줄 안다. 별 기호는
 * 여기 오지 않는다(그림이 그 일을 한다).
 */
const LEVEL_WORD: Record<RadarLevel, string> = {
  HIGH: "매우 좋음",
  MEDIUM: "보통",
  LOW: "낮음",
};

export interface MiEvidenceLine {
  key: RadarAxisKey;
  /** 왼쪽 이름. 이모지를 포함한 화면 문자열 그대로다. */
  title: string;
  /** 오른쪽 한 낱말. 등급어이거나 빈 상태 칩(+사유)이다. */
  detail: string;
  /** 등급이 매겨진 축인가. 화면이 색을 고르는 데만 쓴다(판정이 아니다). */
  scored: boolean;
}

/**
 * 네 줄. 길이가 넷이라는 것은 취향이 아니라 계약이다 — 테스트가 상한을 고정하고,
 * 다음 기능이 다섯 번째 줄을 세우려 하면 거기서 먼저 걸린다.
 *
 * 축이 하나라도 빠진 레이더(구버전 응답 등)가 와도 네 줄을 채운다. 없는 축은
 * "확인 불가"이지 "낮음"이 아니다 — 모르는 것과 나쁜 것을 섞지 않는다는 이
 * 저장소의 규칙 그대로다.
 */
export function buildMiVerdictEvidence(radar: RadarResult): MiEvidenceLine[] {
  return MI_EVIDENCE_AXES.map(({ key, title }) => {
    const axis = radar.axes.find((a) => a.key === key);
    if (!axis) return { key, title, detail: "⚪ 확인 불가", scored: false };
    if (axis.state.status === "SCORED") {
      return { key, title, detail: LEVEL_WORD[axis.state.level], scored: true };
    }
    const empty = emptyStateForAxis(axis.state);
    return {
      key,
      title,
      detail: empty?.reason ? `${empty.chip} · ${empty.reason}` : (empty?.chip ?? "⚪ 확인 불가"),
      scored: false,
    };
  });
}
