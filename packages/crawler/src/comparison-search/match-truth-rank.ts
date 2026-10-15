/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-026 — `MatchTruth` 어휘와 **순위표** 만 담는 leaf (의존 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 쪼갰나 — 화면이 crawler 의 fetch 스택을 통째로 끌고 있었다.**
 *
 * 실측(WU-026): 클라이언트 컴포넌트가 정렬 함수 하나(`sortDomesticCandidatesByTrust`)를
 * 쓰는데, 그 **값 import 사슬** 이 이렇게 이어져 있었다:
 * ```
 * display-priority → match-truth → cross-seller → match → domestic-identifiers
 *                  → foretforet → **domain-rate-limiter**(= fetch 스택)
 * ```
 * 🔴 그래서 브라우저 번들에 `node:net`/`node:dns`/`undici` 같은 **서버 전용 것들이
 *    끌려 들어왔다** — WU-026 이 dispatcher 를 붙이자 그 사슬로 **undici 전체(약 1MB)**
 *    가 클라이언트 청크에 들어가는 것이 측정됐다(기준선 0 → 1파일).
 *
 * 🟢 그런데 화면이 실제로 필요한 것은 **이 파일에 있는 두 개** 뿐이다 — 어휘와 순위표.
 *    둘 다 **순수 데이터** 이고 아무것도 import 하지 않는다.
 *
 * 🔴 **로직은 한 줄도 바뀌지 않았다.** `match-truth.ts` 가 이 둘을 **그대로 re-export**
 *    하므로 기존 import 경로(`./match-truth` · 배럴 · 화면의 깊은 import)는 전부 그대로다.
 * 🔴 이 파일에 **판정 로직을 넣지 않는다.** 넣는 순간 다시 같은 사슬이 생긴다 —
 *    그것이 이 파일이 존재하는 이유다(테스트가 「의존 0」을 단언한다).
 */

/** 서로 다른 판매처의 후보가 「같은 상품인가」에 대한 **근거 등급**. */
export type MatchTruth =
  | "EXACT_IDENTIFIER"
  | "STRONG_IDENTIFIER"
  | "TEXT_CONFIRMED"
  | "SIMILAR"
  | "CONFLICT"
  | "INSUFFICIENT_EVIDENCE";

/**
 * 값이 클수록 "더 신뢰할 수 있는 동일상품 근거".
 * 🔴 이 표의 숫자는 **판정 임계값이 아니다** — 정렬/비교에만 쓰인다.
 */
export const MATCH_TRUTH_RANK: Record<MatchTruth, number> = {
  EXACT_IDENTIFIER: 5,
  STRONG_IDENTIFIER: 4,
  TEXT_CONFIRMED: 3,
  SIMILAR: 2,
  INSUFFICIENT_EVIDENCE: 1,
  CONFLICT: 0,
};
