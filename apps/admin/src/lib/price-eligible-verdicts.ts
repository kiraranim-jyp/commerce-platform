/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **동일상품 «금액» 자격을 가진 판정 — 집합 owner 하나**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 생긴 이유는 «사본 금지» 다.** `@/lib/price-disqualifying-blockers`
 *    와 **같은 이유·같은 모양** 이다 — 집합은 원래
 *    `api/price-history/_lib/candidate-market.ts` 안에 있었는데, 그 파일은
 *    `@commerce/crawler` **루트 배럴** 을 import 한다 ⟹ 클라이언트 컴포넌트가
 *    그것을 가져오면 **Node 전용 모듈이 브라우저 번들에 끌려 들어온다**.
 *    🔴 그렇다고 화면 쪽에 `"SAME"`·`"PRESUMED_SAME"` 를 **베껴 두면** 두 집합이
 *       갈리는 날이 온다 — 그때 **카드는 「반영」이라 적고 집계는 그 금액을 버린다**
 *       (= 화면이 거짓말한다. 실제로 그 상태였다 ·
 *        `MI-DOMESTIC-PRICE-CANDIDATE-CONSISTENCY-1` 이 그것을 고쳤다).
 * 🟢 그래서 **import 0 인 순수 모듈** 로 옮겼다. 집계기도 화면도 **이것 하나** 를 읽는다.
 *
 * 🔴 **이것은 가격 정책이다. Identity 정책이 아니다.**
 *    집합을 넓히거나 좁히는 것은 **제품 정책 변경** 이고 코드에서 임의로 고치지 않는다.
 * 🔴 `SAME` 단독으로 좁히지 않는다 — `PRESUMED_SAME`(동일상품 추정)의 가격을 빼면
 *    국내 참고가격이 **구조적으로 비어 버린다**
 *    (메모 `domestic-reference-price-admits-presumed-same`).
 * 🔴 `SIMILAR`·`CONFLICT`·`UNKNOWN` 은 **없다** — 「SAME 도 PRESUMED_SAME 도 아니라고
 *    «관측된»」 후보의 금액은 동일상품 금액이 아니다.
 *
 * ── 🔴🔴 그리고 이 게이트는 «시장마다 있는 것이 아니다» ──────────────────────
 * 생산자가 둘이고 **싣는 칸이 다르다**(`market-intelligence.ts`):
 * ```
 * 국내 `domesticTransientRecords.push`  verdict 를 **싣지 않는다**(계약 `sprint3-p1 D-2`)
 * 해외 `overseasEvidence.push`          verdict 를 **싣는다**
 * ```
 * ⟹ 🔴 집계기의 `r.verdict != null` 가드 때문에 **이 게이트는 해외 축에서만 발화한다.**
 *    화면이 그 사실을 무시하고 국내에도 적용하면 **국내에서 반대 방향으로 거짓** 이 된다
 *    (집계에는 들어간 금액을 카드가 「제외」라 적는다). 🟢 그래서 소비처가 시장으로 가른다.
 */
export const PRICE_ELIGIBLE_VERDICTS = new Set(["SAME", "PRESUMED_SAME"]);

/** 🟢 계약이 집합을 글자로 확인하는 지점(사본 금지). */
export const PRICE_ELIGIBLE_VERDICT_LIST: readonly string[] = [...PRICE_ELIGIBLE_VERDICTS];

/**
 * 🔵 **후보 하나가 「판정」 때문에 금액에서 빠지는가.**
 *
 * 🔴 집계기(`summarizeCandidateOverseasPrices`)의 그 줄과 **같은 술어** 다 —
 *    화면이 자기 규칙을 만들지 않게 하려고 여기 둔다.
 * 🔴 `verdict` 가 없으면(`null`/`undefined`) **false** 다 — 「모른다」를 「제외」로
 *    적지 않는다(집계기의 `r.verdict != null &&` 가드와 **같은 방향**).
 */
export function isPriceIneligibleByVerdict(verdict: string | null | undefined): boolean {
  if (verdict == null) return false;
  return !PRICE_ELIGIBLE_VERDICTS.has(verdict);
}
