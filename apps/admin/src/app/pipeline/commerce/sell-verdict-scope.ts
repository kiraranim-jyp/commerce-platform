import type { SellerFinalVerdict } from "./DomesticPriceIntelligencePanel";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-SELL-VERDICT-SNAPSHOT-ISOLATION-01 (CEO 지시, 2026-09-30)
 * **판매 판정은 전역 UI 상태가 아니라 «그 상품» 에 귀속된다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 터졌나 ──────────────────────────────────────────────────────────
 * 상품 A 의 판정이 상품 B 의 요약(ActionCenter)에 남아 있었다. 실측한 경로:
 *
 *   DomesticPriceIntelligencePanel.tsx  useEffect: `if (loading) return`
 *       → 새 상품을 «불러오는 동안» 아무것도 보고하지 않는다
 *   CommerceWorkspace.tsx               sellVerdict / verdictReported
 *       → snapshotId 가 바뀔 때 초기화되지 않는다
 *
 *   A → CONDITIONAL 보고 → sellVerdict="CONDITIONAL", verdictReported=true
 *   B → loading=true → 보고 없음 → 요약은 여전히 🟡 조건부 판매 (= A 의 답)
 *
 * 🔴 `verdictPending = !verdictReported` 도 false 라서 「⏳ 시장 분석 중」조차
 * 뜨지 않았다. 이전 상품의 결론을 «확신에 찬 얼굴로» 보여준다. A 가 🟢 판매
 * 추천이고 B 가 🔴 판매 비추천이면 요약은 B 를 「판매 추천」이라고 말한다 —
 * 셀러의 판매 의사결정에 직접 닿는 거짓말이다.
 *
 * ── 🔴 왜 «초기화 effect» 가 아닌가 ────────────────────────────────────────
 * `useEffect(() => reset(), [snapshotId])` 는 **렌더 «뒤»** 에 돈다. 그래서
 * snapshotId 가 바뀐 «첫 렌더» 한 프레임 동안 이전 판정이 새 상품의 판정처럼
 * 그려진다. 그 한 프레임이 바로 이 결함이 하는 일이라, effect 로 고치면 결함을
 * 작게 만들 뿐 없애지는 못한다(CEO 가 지시서 3A 에서 지목한 지점).
 *
 * 그래서 **상태에 snapshotId 를 같이 담고, 읽을 때 대조** 한다. 파생값이라
 * 렌더와 같은 프레임에 결정되고, 안 맞으면 처음부터 「아직 없음」이다.
 *
 * ── 🔴 sticky 는 «보존» 한다 ───────────────────────────────────────────────
 * 탭을 옮기면 분석 패널이 언마운트되지만 같은 상품의 판정은 유지돼야 한다
 * (CommerceWorkspace 의 sticky visited 원칙 — 의도된 설계다). 그건 그대로
 * 살아 있다: 탭 이동은 snapshotId 를 바꾸지 않으므로 아래 대조가 통과한다.
 * 이 파일이 끊는 것은 «상품 경계» 하나뿐이다.
 */

/** 보고된 판정 한 벌 — 🔴 «어느 상품의» 판정인지 값과 «같이» 들고 다닌다. */
export interface ScopedSellVerdict {
  /** 보고 당시의 snapshotId. 스냅샷 생성 전이면 null 이다. */
  snapshotId: string | null;
  /** 서버가 낸 값. 🔴 null 은 「판정 없음」이고 「아직 안 옴」이 아니다. */
  verdict: SellerFinalVerdict | null;
}

/** 요약이 실제로 그릴 두 값. */
export interface ResolvedSellVerdict {
  /** 지금 상품의 판정. 없으면 null. */
  verdict: SellerFinalVerdict | null;
  /**
   * 🔴 「아직 안 옴」과 「판단 불가」를 가른다. 이 상품이 한 번이라도 보고했는가.
   *
   * false 면 요약은 판정이 아니라 «대기» 를 보여준다. 이 구분을 잃으면 새 상품의
   * 미보고 상태가 곧바로 「판단 불가」로 읽히고, 그건 또 다른 거짓말이다.
   */
  reported: boolean;
}

/**
 * 지금 보고 있는 상품의 판정만 돌려준다.
 *
 * 🔴 `null` 을 반환하는 두 경우를 «섞지 않는다»:
 *   보고가 없다            → { verdict: null, reported: false }  = 대기
 *   이 상품이 null 을 보고  → { verdict: null, reported: true  }  = 판단 불가
 *
 * 🔴 다른 상품의 판정은 «절대» 재사용하지 않는다 — 가장 그럴듯한 오답이
 * 「어차피 곧 새 값이 올 테니 그동안 이전 값을 두자」다. 그 사이에 셀러가 등록을
 * 누른다.
 */
export function resolveSellVerdict(
  reported: ScopedSellVerdict | null,
  currentSnapshotId: string | null | undefined,
): ResolvedSellVerdict {
  if (!reported) return { verdict: null, reported: false };
  /* undefined 와 null 은 「스냅샷 없음」이라는 같은 사실이다 — 하나로 눌러서 본다.
     여기서 둘을 다르게 다루면 스냅샷 생성 직전/직후에 판정이 깜빡인다. */
  if (reported.snapshotId !== (currentSnapshotId ?? null)) {
    return { verdict: null, reported: false };
  }
  return { verdict: reported.verdict, reported: true };
}
