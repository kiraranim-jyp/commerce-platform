import type { CandidateReviewRow, ReviewSource } from "./candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-UX-REFINE-04 **B-3 reader** — 저장된 후보를 «표시용» 으로 되돌린다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 파일이 따로 있는가 — 역할이 둘이었기 때문이다.**
 * ```
 * geminiEvidence   「가격 집계 입력」 «그리고» 「화면 후보 데이터」를 **겸한다**
 *                   ⟹ 복원분을 거기 실으면 가격 집계가 과거 저장분까지 먹는다
 * savedCandidateRows (이 파일)  **표시 전용.** 집계 경로에 들어갈 길이 구조적으로 없다
 * ```
 * 🔴 그래서 **`GeminiTransientEvidence` 를 쓰지 않는다**(CPO ⒝ 확정 · B3-03):
 *    그 타입의 `priceTier` 는 **required** 이고 그 계약을 느슨하게 하면
 *    「tier 가 없는 후보」가 집계 경로 타입을 통과해 버린다. 🟢 여기서는 **별 타입** 을
 *    두어 `priceTier: null` 을 **그대로** 실어 보낸다 ⟹ 저장 18행을 버리지 않는다(B3-02).
 *
 * 🔴 **이 파일은 아무것도 만들지 않는다**(순수 함수 · DB 접근 0 · HTTP 0):
 *    판정 0 · 점수 0 · 가격 0 · 통화 환산 0 · tier 생성 0 · verdict 승격 0.
 *    저장된 칸을 **이름만 바꿔** 옮긴다. 값이 없으면 `null` 로 둔다 —
 *    「확인됨」으로 **추정하지 않는다**(migration 081 의 backfill 금지와 같은 원칙).
 */

/**
 * 🔴 화면 타입(`GeminiTransientRow`)과 **구조적으로 같은 모양** 이다.
 *    🔴 그 타입을 import 하지 «않는다» — 그쪽은 클라이언트 컴포넌트 모듈이고
 *       이 파일은 서버 모듈이다(`GeminiTransientEvidence` 가 같은 이유로 그렇게 한다).
 *    🟢 칸 이름을 **글자 그대로** 같게 둬서 매핑 코드가 한 겹 더 생기지 않게 한다.
 */
export interface SavedCandidateRow {
  domain: string;
  title: string | null;
  source?: SavedCandidateSource;
  imageUrl: string | null;
  soldOut: boolean | null;
  priceStatus: string | null;
  discoveredUrl: string;
  crossSellerVerdict: string | null;
  matchTruth: string | null;
  /** 🔴 **nullable 이다**(집계 타입과 다른 점). 저장값이 없으면 null 그대로다. */
  priceTier: string | null;
  matchReasons: string[];
  crossSellerBlockers: string[];
  crossSellerConflicts: string[];
  priceAmount: number | null;
  priceCurrency: string | null;
  market: string | null;
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 MI-SOURCING-MARKET-PRICE-INTEGRATION ① — **국내 축의 입장권**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 국내 가격 집계 루프는 **두 조건** 을 요구한다(market-intelligence.ts:286·333):
   *    `market === "KR"` **그리고** `priceKrw != null`.
   *    🔴 이 칸이 없어서 **복원분이 그 루프에 영원히 못 들어갔다** — 그것이
   *       「재진입하면 국내 참고가격이 사라진다」의 직접 원인이다.
   *
   * 🔴🔴 **환산하지 않는다.** `KRW` 일 때만 `priceAmount` 를 그대로 옮긴다.
   *    다른 통화는 **`null`** 이다 — 환율을 적용하면
   *    ⒜ `overseas-reference.ts` 의 「환산 금지」 계약과 충돌하고
   *    ⒝ 저장 시점 환율과 조회 시점 환율이 달라 **같은 입력이 다른 값** 을 낸다
   *       (= 이 WU 가 고치려는 「POST/GET 일관성」을 스스로 깨뜨린다).
   * 🟢 KRW 후보에서 `priceAmount === priceKrw` 인 것은 **변환이 아니라 항등** 이다.
   */
  priceKrw: number | null;
}

/** 🔴 화면 배지가 아는 집합의 **부분집합** 이다 — 새 값을 만들지 않는다. */
export type SavedCandidateSource = "SELLER_URL" | "OVERSEAS_AUTO";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵 **LOCK — Source 복원 정책**(CPO ⒝ 확정 2026-11-01)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **원칙 — 출처를 «추측해서» 바꾸지 않는다.** `source` 는 provenance 다.
 *
 * 저장측(`ReviewSource`)과 화면측(`GeminiTransientRow["source"]`)이 **다른 집합** 이고
 * 겹치는 것은 **둘뿐** 이다:
 * ```
 * SELLER_URL        → SELLER_URL      🟢 의미가 정확히 같다
 * OVERSEAS_AUTO     → OVERSEAS_AUTO   🟢
 * DOMESTIC_REGISTRY → 매핑하지 않는다
 * GEMINI            → 매핑하지 않는다
 * GT_IMPORT         → 매핑하지 않는다 (대응하는 화면 값이 **애초에 없다**)
 * ```
 * 🔴 **미매핑은 `undefined` 다 — 빈 문자열이 아니다.** 화면이 `{row.source && (…)}` 로
 *    가드하므로 배지 **자체가 렌더되지 않는다**(DoD ②③ · UI 변경 **0**).
 * 🔴 금지 — `GEMINI_DISCOVERY`/`DOMESTIC_LISTING`/`WEB_SEARCH` 로 **임의 변환**(출처가
 *    거짓이 된다) · 「복원됨」 같은 새 source 신설(그것은 출처가 아니다) · 빈 배지 렌더.
 * 🔴 DB 의 원값은 **변조하지 않는다** — 이 매핑은 **표시 경로에만** 있다(DoD ④).
 */
const DISPLAY_SOURCE: Partial<Record<ReviewSource, SavedCandidateSource>> = {
  SELLER_URL: "SELLER_URL",
  OVERSEAS_AUTO: "OVERSEAS_AUTO",
};

/**
 * 🔴 `candidate_domain` 은 nullable 인데 화면은 `domain: string` 을 요구한다.
 * 🟢 **지어내지 않는다** — 그 후보의 URL **자신의 host** 를 읽는다(같은 사실의 다른 표현).
 *    🔴 URL 이 파싱되지 않으면 빈 문자열이다(가짜 도메인을 만들지 않는다).
 */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * 저장 행 → 표시 행. 🔴 **거르지 않는다**(입력 N == 출력 N · B3-02).
 *
 * 🔴🔴 **`blockers` 는 저장 시 `[...blockers, ...conflicts]` 로 «합쳐져» 있다**
 *    (`check/route.ts` 의 `recordSeenCandidates` 입력). 둘을 되돌릴 방법이 **없다** ⟹
 *    🟢 그 배열을 **`crossSellerConflicts` 로 넣고 `crossSellerBlockers` 를 `[]`** 로 둔다.
 *    🔴 그 선택이 안전한 이유 — 소비자 둘의 결과가 **모든 경우에 같다**:
 * ```
 * isModelCodeOnlyReference  conflicts 가 **정확히 [MODEL_CODE] 하나** 이고
 *                           blockers 가 **비어 있을 때만** true.
 *   원래 (conflicts=[MODEL_CODE], blockers=[])  → 합친 길이 1 → 🟢 **true 유지**
 *   원래 blocker 가 하나라도 있었으면 → 합친 길이 ≥2 이거나 단일 비-MODEL_CODE
 *                                     → 🟢 **false 유지**(원래도 false)
 * candidateWarningLines     둘을 **합쳐** 쓰므로 글자가 같다
 * ```
 * 🔴 그래서 「품번만 충돌한 참고 후보」(POSSIBLE 군)가 재진입에서 **사라지지 않는다** —
 *    단 그 게이트가 `matchReasons.length > 0` 을 요구하므로 **`match_reasons` 가
 *    저장된 행에서만** 성립한다(migration 081 이전 행은 빈 배열이다 · 분모를 갈라 적는다).
 */
export function toSavedCandidateRows(rows: readonly CandidateReviewRow[]): SavedCandidateRow[] {
  return rows.map((r) => {
    const display = DISPLAY_SOURCE[r.source];
    return {
      domain: r.candidateDomain ?? hostOf(r.candidateUrl),
      title: r.candidateTitle,
      /** 🔴 미매핑이면 **칸을 세우지 않는다**(배지 미렌더). */
      ...(display ? { source: display } : {}),
      imageUrl: r.imageUrl,
      soldOut: r.soldOut,
      /** 🔴 null 이면 null 이다 — `VERIFIED_CURRENT` 로 추정하면 P2 가 P1 로 거짓 승격된다. */
      priceStatus: r.priceStatus,
      discoveredUrl: r.candidateUrl,
      crossSellerVerdict: r.systemVerdict,
      matchTruth: r.matchTruth,
      priceTier: r.priceTier,
      matchReasons: r.matchReasons,
      crossSellerBlockers: [],
      crossSellerConflicts: r.blockers,
      priceAmount: r.priceAmount,
      priceCurrency: r.priceCurrency,
      market: r.market,
      /**
       * 🔵 ① — **KRW 일 때만** 국내 축 입장권을 준다(환산 0 · 추정 0).
       * 🔴 대소문자·공백을 정규화해서 본다 — 저장분에 `"krw"`·`" KRW"` 가 섞인다.
       * 🔴 금액이 숫자가 아니면 `null` 이다(저장값을 믿고 그대로 싣지 않는다).
       */
      priceKrw:
        r.priceCurrency?.trim().toUpperCase() === "KRW" &&
        r.priceAmount != null &&
        Number.isFinite(r.priceAmount)
          ? r.priceAmount
          : null,
    };
  });
}
