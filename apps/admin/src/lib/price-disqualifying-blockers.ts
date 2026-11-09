/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **동일상품 «금액» 자격을 잃는 보류 — 집합 owner 하나**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 생긴 이유는 «사본 금지» 다.** 집합은 원래
 *    `api/price-history/_lib/candidate-market.ts` 안에 있었는데, 그 파일은
 *    `@commerce/crawler` **루트 배럴** 을 import 한다 ⟹ 클라이언트 컴포넌트가
 *    그것을 가져오면 **Node 전용 모듈이 브라우저 번들에 끌려 들어온다**(P-9-A).
 *    🔴 그렇다고 화면 쪽에 **문자열을 베껴 두면** 두 집합이 갈리는 날이 온다 —
 *       그때 화면은 「제외」라 적고 서버는 금액에 넣는다(= 화면이 거짓말한다).
 * 🟢 그래서 **import 0 인 순수 모듈** 로 옮겼다. 서버도 화면도 **이것 하나** 를 읽는다.
 *
 * 🔴 **이것은 가격 정책이다. Identity 정책이 아니다.**
 *    집합을 넓히거나 좁히는 것은 **제품 정책 변경** 이고 코드에서 임의로 고치지 않는다.
 * 🔴 `BRAND_UNCONFIRMED` 는 **없다** — 「브랜드를 못 읽었다」로 가격을 지우지 않는다
 *    (실측: 그 사유의 4건이 **사람 SAME** 이다).
 * 🔴 `MATERIAL`·`FIT`·`MODEL_CODE_AGE_LINE` 도 **없다** — 표기·정규화·정책 축이다.
 */
export const PRICE_DISQUALIFYING_BLOCKERS: ReadonlySet<string> = new Set([
  /** 브랜드를 **읽었고 서로 달랐다**(「확인 못 했다」가 아니다). */
  "BRAND_MISMATCH",
  /** 제목이 **하나도 겹치지 않는다** — 겹침이 「없다」는 관측이다. */
  "NO_TITLE_OVERLAP",
  /** 🔴 **같은 판매처가 서로 다른 두 상품으로 진열했다** — 판매처 스스로의 선언이다. */
  "SAME_SELLER_DISTINCT_LISTING",
]);

/** 🟢 계약이 「부분집합인가」를 검사하는 지점(사본 금지). */
export const PRICE_DISQUALIFYING_BLOCKER_LIST: readonly string[] = [
  ...PRICE_DISQUALIFYING_BLOCKERS,
];

/**
 * 🔵 **후보 하나가 「관측 차이」로 금액에서 빠지는가.**
 *
 * 🔴 집계기(`summarizeCandidateOverseasPrices`)의 그 줄과 **같은 술어** 다 —
 *    화면이 자기 규칙을 만들지 않게 하려고 여기 둔다.
 * 🔴 `blockers` 가 없으면(`undefined`) **false** 다 — 「모른다」를 「제외」로 적지 않는다.
 */
export function isPriceDisqualifiedByObservedDifference(
  blockers: readonly string[] | null | undefined,
): boolean {
  if (!blockers) return false;
  return blockers.some((b) => PRICE_DISQUALIFYING_BLOCKERS.has(b));
}
