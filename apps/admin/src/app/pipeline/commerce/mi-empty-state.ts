import type { RadarAxisState } from "@commerce/pricing";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — "값이 없다"를 한 가지로 뭉뚱그리지 않는다.
 *
 * 화면에 빈 값이 뜨는 이유는 실제로 세 가지고, 셀러가 해야 할 일이 전부 다르다:
 *
 *   ⚪ 검색 데이터 없음  정상적으로 조회했는데 결과가 없었다.
 *                        → 데이터가 틀린 게 아니라 시장에 그 흔적이 없는 것이다.
 *   ⚪ 확인 불가         조회 자체를 못 했거나 계산 입력이 빠졌다.
 *                        → 빠진 값을 채우면 답이 나올 수 있다.
 *   ⚪ 판단 불가         판단을 세울 근거가 하나도 없다.
 *                        → "나쁘다"가 아니다. 아직 아무것도 말할 수 없다는 뜻이다.
 *
 * 셋을 같은 "—"로 그리면 셀러는 전부 "나쁨"으로 읽는다(☆☆☆☆☆를 쓰지 않는 것과
 * 정확히 같은 이유다). 반대로 내부 상태명(NO_DATA/UNAVAILABLE/CASE D/EXACT)을
 * 그대로 노출하면 읽을 수는 있어도 무엇을 해야 할지는 여전히 모른다 — 그래서
 * 이 파일은 상태명을 문장으로 번역하는 단 하나의 지점이다.
 */
export type MiEmptyKind = "NO_SEARCH_DATA" | "UNVERIFIABLE" | "UNJUDGEABLE";

export interface MiEmptyState {
  kind: MiEmptyKind;
  /** 화면에 그대로 쓰는 상태 칩. 내부 상태명을 절대 담지 않는다. */
  chip: string;
  /**
   * 왜 비었는지 한 줄. 칩이 이미 같은 사실을 말하는 경우에는 null이다 —
   * "⚪ 검색 데이터 없음 · 검색 데이터가 없습니다"처럼 같은 말을 두 번 하면
   * 글자 수만 늘고 읽는 사람은 두 문장이 다른 뜻인 줄 알고 한 번 더 읽는다.
   */
  reason: string | null;
}

const EMPTY_CHIP: Record<MiEmptyKind, string> = {
  NO_SEARCH_DATA: "⚪ 검색 데이터 없음",
  UNVERIFIABLE: "⚪ 확인 불가",
  UNJUDGEABLE: "⚪ 판단 불가",
};

export function miEmptyState(kind: MiEmptyKind, reason: string | null = null): MiEmptyState {
  return { kind, chip: EMPTY_CHIP[kind], reason };
}

/**
 * 레이더 축 상태를 화면 빈 상태로 옮긴다. 등급이 매겨진 축은 null을 돌려준다
 * (빈 상태가 아니다). 판정은 여기서 하지 않는다 — computeRadar()가 이미 낸
 * status/reason을 문구로 바꾸기만 한다.
 */
export function emptyStateForAxis(state: RadarAxisState): MiEmptyState | null {
  if (state.status === "SCORED") return null;
  if (state.status === "NO_DATA") {
    // NO_DATA의 사유는 오늘 "검색 데이터가 없습니다" 하나뿐이라 칩과 같은 말이다.
    return miEmptyState("NO_SEARCH_DATA", null);
  }
  // UNAVAILABLE — 사유가 "무엇을" 확인 못 했는지를 말하므로 반드시 함께 보여준다.
  return miEmptyState("UNVERIFIABLE", state.reason);
}
