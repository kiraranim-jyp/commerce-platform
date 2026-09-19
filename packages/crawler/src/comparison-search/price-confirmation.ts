import { deriveProductMatchTruth } from "./product-identity";
import type { ComparisonCandidate, ComparisonQuery } from "./types";

/** Sprint B-1.8 — 사이트당 상세 가격 확인 요청 상한. 검색 결과가 몇 건이든 이 숫자를
 * 넘겨서 상세 API를 호출하지 않는다(비용 제한, CPO 지시). */
export const MAX_DETAIL_CONFIRMATIONS_PER_SHOP = 2;

/** P-4-DATA-4(CPO 지시, 2026-08-29) — 기존엔 medium(70~84%) 후보가 상세 검증
 * 대상에서 아예 제외됐다. 실측 확인된 실제 버그 2건(Booty Ghosts 반팔 £59→£35,
 * Misha & Puff Mink £270→£159)이 정확히 이 사각지대였다 — 둘 다 medium이라
 * 검증 자체를 시도하지 않았고, 검색 인덱스의 부정확한 값이 그대로 노출될 뻔했다.
 *
 * 그렇다고 "medium을 무조건 다 검증"하지 않는다(P-4-DATA-2 조사에서 확인: 상한을
 * 유지한 채 우선순위만 조정해도 이번 두 사례 모두 잡힌다 — very_high가 이미 슬롯
 * 1개만 쓰고 있었으므로 남는 슬롯이 medium으로 자동 채워지는 구조). 우선순위는
 * very_high > high > medium이고, 그 안에서는 confidence 내림차순(candidates
 * 배열이 이미 withConfidence()에서 정렬된 순서 — 이 함수는 그 순서를 그대로
 * 신뢰한다)이다. 사이트당 상한(MAX_DETAIL_CONFIRMATIONS_PER_SHOP)은 그대로
 * 유지 — 무제한 API 호출 증가를 막는다는 기존 원칙은 바뀌지 않는다. */
/**
 * P0-A.29-D ㉯(CEO 승인, 2026-09-19) — **「동일 모델 · 옵션 다름」도 상세확인
 * 대상이다. 다만 슬롯을 늘리지 않고 재배치한다.**
 *
 * 실사용(Pèpè Lulu T Bar Shoes, junioredition): 색상만 다른 후보가 화면에서
 * 「가격 확인 필요」로만 떴다. 가격이 «없어서» 가 아니라 상세확인 슬롯에서
 * 탈락해서였다 — 색상이 다르면 상품명 유사도가 떨어져 matchLevel 이 내려가고,
 * 샵당 두 칸을 동일상품 후보에게 내준다. 구조적으로 항상 밀린다.
 *
 * ── 왜 matchLevel 하한을 뚫는가 ─────────────────────────────────────────────
 * SAME_MODEL_VARIANT 는 «모델명 문자열 완전 일치 + 색상 다름» 이라는 근거로
 * 나온 값이다(product-identity.ts). 텍스트 점수가 낮은 이유가 바로 그 색상
 * 차이인데, 그 점수로 다시 떨어뜨리면 근거를 점수가 이기는 꼴이 된다 —
 * match-display.ts 의 mayShowCandidate 가 같은 이유로 근거 등급에는 점수
 * 하한을 적용하지 않는다.
 *
 * 🔴 상한(MAX_DETAIL_CONFIRMATIONS_PER_SHOP)은 그대로 2 다. 호출량은 늘지
 *    않는다. 늘어나는 것은 «누가 그 두 칸에 앉는가» 뿐이다. 그래서 대가가
 *    있다: 오늘 두 번째 칸에 앉던 약한 후보(VERY_SIMILAR/SIMILAR)가 변형
 *    후보에게 자리를 내주면, 그 후보의 가격은 표에서 「가격 확인 필요」가 된다.
 *    이 교환을 감춰서는 안 된다 — 측정해서 보고한다.
 *
 * query 를 주지 않으면 **예전과 한 글자도 다르지 않게** 동작한다(국내 경로는
 * 옵션 개념 자체가 없어 그대로 둔다).
 */
export function selectCandidatesForDetailConfirmation(
  candidates: ComparisonCandidate[],
  query?: ComparisonQuery,
): number[] {
  const truthOf = (c: ComparisonCandidate) => (query ? deriveProductMatchTruth(query, c, c.confidence) : undefined);
  const byTextLevel = (c: ComparisonCandidate) =>
    c.matchLevel === "very_high" || c.matchLevel === "high" || c.matchLevel === "medium";

  const eligible = candidates
    .map((c, i) => ({ c, i, truth: truthOf(c) }))
    .filter(({ c, truth }) => byTextLevel(c) || truth === "SAME_MODEL_VARIANT");

  const rank = ({ c, truth }: { c: ComparisonCandidate; truth?: string }): number => {
    // 동일상품 근거가 확실한 것이 언제나 첫 칸이다.
    if (truth === "EXACT_PRODUCT" || truth === "CONFIRMED_PRODUCT") return 0;
    if (truth === "SAME_MODEL_VARIANT") return 1;
    return c.matchLevel === "very_high" ? 2 : c.matchLevel === "high" ? 3 : 4;
  };
  eligible.sort((a, b) => rank(a) - rank(b));
  return eligible.slice(0, MAX_DETAIL_CONFIRMATIONS_PER_SHOP).map(({ i }) => i);
}
