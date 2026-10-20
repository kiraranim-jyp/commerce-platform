import {
  domesticMatchDisplay,
  tierDisplay,
  type MatchDisplay,
  type MatchDisplayTier,
} from "./match-display";
import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { GeminiTransientRow } from "./GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-132 ①② — **MI 가 낸 후보를 「가격 비교에 쓸 것」과 「사람이 볼 것」으로 가른다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **판정하지 않는다.** 이 파일에는 점수도 verdict 도 threshold 도 없다 —
 *    MI 가 이미 낸 `matchTruth`/`crossSellerVerdict`/`priceStatus`/`soldOut` 를
 *    **읽어서 거르기만** 한다. 🔴 새 판단축을 만들면 그 순간 화면과 판정기가
 *    서로 다른 답을 낸다(`match-display.ts` 의 `mayShowCandidate` 주석과 같은 원칙).
 *
 * ── 🔴🔴 이 파일이 생긴 이유 (WU-132 전수검토의 핵심 사실) ──────────────────
 * ```
 * 「📊 시장 가격 비교」의 두 패널(DomesticShopSearch · ComparisonShopSearch)은
 * **클라이언트가 자기 검색을 돌려** `mayShowCandidate` 로 거른다 ⟹ /check 의
 * **MI verdict 를 한 번도 보지 않는다.** 그래서 「MI 가 SAME 이라 판정한 후보」가
 * 가격 비교 영역에 **구조적으로 닿지 못했다.**
 * 🟢 이 파일은 그 영역에 **MI 산출을 공급** 하기 위한 선별기다 — 영역 추가가 아니다.
 * ```
 *
 * ── 🔴 CPO ② 가 요구한 세 축 ───────────────────────────────────────────────
 * ```
 * ① SAME        MI 가 동일상품이라 판정했는가            ← tier === "SAME"
 * ② 현재 판매중  지금 팔고 있는가                        ← soldOut !== true
 * ③ 가격확인     그 숫자를 보여줘도 되는가               ← priceStatus VERIFIED_CURRENT
 * ```
 */

/**
 * 🔴 후보 하나의 **표시 등급**. 🟢 owner 둘(`domesticMatchDisplay` · `tierDisplay`)을
 *    그대로 부른다 — 어휘를 새로 만들지 않는다.
 *
 * 🔴 `matchTruth` 가 **먼저** 다(`GeminiTransientCandidates.verdictDisplay` 와 같은
 *    순서). 그 값이 없으면 교차판매처 판정값이 `MatchDisplayTier` 와 **글자가 같아**
 *    같은 owner 가 말로 바꿔 준다. 🔴 둘 다 없으면 **판정이 없다**(`null`) —
 *    「UNKNOWN」으로 지어내지 않는다.
 */
export function transientDisplayTier(row: GeminiTransientRow): MatchDisplayTier | null {
  if (row.matchTruth) return domesticMatchDisplay(row.matchTruth as MatchTruth).tier;
  const verdict = row.crossSellerVerdict;
  if (verdict && (DISPLAYABLE_TIERS as readonly string[]).includes(verdict)) {
    return verdict as MatchDisplayTier;
  }
  return null;
}

/** 🔴 `MatchDisplayTier` 와 글자가 같은 값만 등급으로 받는다 — 모르는 값은 지어내지 않는다. */
export const DISPLAYABLE_TIERS = [
  "SAME",
  "SAME_MODEL_OPTION_DIFF",
  "PRESUMED_SAME",
  "SIMILAR",
  "UNKNOWN",
  "CONFLICT",
] as const;

/** 🟢 등급 → 배지 문구. owner 가 들고 있는 말을 그대로 돌려준다(사본 0). */
export function transientDisplay(row: GeminiTransientRow): MatchDisplay | null {
  const tier = transientDisplayTier(row);
  return tier ? tierDisplay(tier) : null;
}

/**
 * 🔴🔴 **② 현재 판매중인가.**
 *
 * 🔴 `=== false`(판매중 확인) 가 아니라 **`!== true`(품절 확인된 것만 제외)** 다.
 *    이유는 두 가지이고 둘 다 측정된 사실이다:
 * ```
 * ⒜ 운영 가격 집계 owner 가 그 규칙이다 — `price-history.ts` 의 summarizeFrom 은
 *    **품절을 뺀다**(「팔 수 없는 가격은 경쟁가격이 아니다」). 여기서 더 센 규칙을
 *    만들면 화면과 집계가 다른 집합을 말한다.
 * ⒝ 🔴 실측: 국내 관측 `sold_out` 은 **true 가 0행 · null 113행** 이다(헌장 §12).
 *    `=== false` 를 요구하면 가격 비교가 **구조적으로 항상 비어 있다** — 그건
 *    「판매중만 보여준다」가 아니라 「아무것도 안 보여준다」다.
 * ```
 * 🔴 그래서 화면은 `null` 을 **「판매중」이라고 적지 않는다** — 「재고 확인불가」다.
 */
export function isNotSoldOut(row: GeminiTransientRow): boolean {
  return row.soldOut !== true;
}

/**
 * 🔴🔴 **③ 가격을 숫자로 보여줘도 되는가.**
 *
 * 🟢 owner 는 `derivePriceStatus`(match.ts) 이고 그 값이 `VERIFIED_CURRENT` 일 때만
 *    상세 페이지에서 **실제로 확인한** 가격이다(P-4-DATA-4 의 절대 원칙 그대로).
 * 🔴 `UNVERIFIED_SEARCH` 를 승격하지 않는다 — 그건 「판매처 표시가」다.
 */
export function isPriceConfirmed(row: GeminiTransientRow): boolean {
  return row.priceStatus === "VERIFIED_CURRENT" && row.priceAmount != null && !!row.priceCurrency;
}

/** 🔴 왜 그 후보가 가격비교에서 빠졌는가. 🟢 **조용히 버리지 않는다**(한 줄로 적는다). */
export type MiSameExclusion = "NOT_SAME" | "SOLD_OUT" | "PRICE_UNCONFIRMED";

export interface MiSameSelection {
  /** 🟢 가격비교에 올릴 후보 — 세 축을 **전부** 통과한 것만. */
  priced: GeminiTransientRow[];
  /**
   * 🔴 **SAME 인데 ②③ 에서 빠진 후보.** 「동일상품이 없다」와 「동일상품인데 지금
   *    가격을 확인하지 못했다」는 **다른 사실** 이라 화면이 둘을 가려 말해야 한다.
   */
  sameButExcluded: { row: GeminiTransientRow; reason: Exclude<MiSameExclusion, "NOT_SAME"> }[];
}

/**
 * 후보 배열 → 세 묶음.
 *
 * 🔴 **시장을 추측하지 않는다.** `market` 은 운영 `classifyCandidateMarket` 산출이고,
 *    `UNKNOWN` 은 국내로도 해외로도 세지 않는다(WU-020 §4 · 기존 계약 그대로).
 * 🔴 중복 URL 은 **접는다** — 네 생산자가 같은 판매처를 낼 수 있고, 접지 않으면
 *    셀러가 「판매처가 두 곳」으로 읽는다.
 */
export function selectMiSameCandidates(
  rows: readonly GeminiTransientRow[] | null | undefined,
  market: "KR" | "OVERSEAS",
): MiSameSelection {
  const out: MiSameSelection = { priced: [], sameButExcluded: [] };
  if (!rows || rows.length === 0) return out;
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.market !== market) continue;
    if (seen.has(row.discoveredUrl)) continue;
    seen.add(row.discoveredUrl);
    /**
     * 🔴 SAME 이 아니면 **이 영역에 오지 않는다.** 🟢 사라지는 것은 아니다 —
     *    MI 패널의 출처별 후보 구역이 **모든 행** 을 그대로 그리고, 거기서 사람이
     *    원본 ↔ 후보 사진을 보고 판단한다(④). 🔴 그래서 여기서 「검토용 배열」을
     *    따로 만들지 않는다 — 만들면 같은 행이 **두 구역에 복제** 된다(WU-081 금지).
     */
    if (transientDisplayTier(row) !== "SAME") continue;
    if (!isNotSoldOut(row)) {
      out.sameButExcluded.push({ row, reason: "SOLD_OUT" });
      continue;
    }
    if (!isPriceConfirmed(row)) {
      out.sameButExcluded.push({ row, reason: "PRICE_UNCONFIRMED" });
      continue;
    }
    out.priced.push(row);
  }
  return out;
}

/* ──────────────────────────────── 화면 문구 ────────────────────────────────
 * 🔴 문구는 **여기 하나** 다 — 두 곳에 적으면 갈라진다(MATCHING-UNIFY-1 과 같은 이유).
 */

/**
 * 🔴🔴 WU-132 ③ — **가격 비교 영역은 화면에 «하나» 다.**
 *    WU-130 ④ 가 MI 패널 안에 만든 `unified-price-comparison` 은 **제거됐고**,
 *    그 안에 있던 두 참고가격 블록이 이 영역으로 옮겨 왔다(복제 아님 · 이동).
 */
export const MI_SAME_AREA_TITLE = "📊 동일상품 가격 비교";
export const MI_SAME_AREA_NOTE =
  "우리 MI 가 동일상품으로 판정하고, 지금 판매중이며, 상세 페이지에서 가격을 확인한 후보만 비교합니다.";
/**
 * 🔴 셋 중 하나라도 못 지킨 후보는 **여기 오지 않는다** — 그 사실을 영역이 직접 말한다.
 *
 * 🔴🔴 **두 번째 문장이 중요하다.** 같은 영역 안의 참고가격 집계는 **유사상품까지
 *    포함한 참고 축**(tier `EXACT|COMPARISON`)이라 **동일상품 행이 0 인데 참고가격
 *    숫자는 있는** 모양이 실제로 나온다(E2E 실측: S2 는 참고 축에 KRW 88,000 이
 *    있는데 SAME 판정은 0건이었다). 🔴 그 차이를 화면이 말하지 않으면 셀러는
 *    **그 숫자를 「동일상품 가격」으로 읽는다** — 그것이 2026-09-19 사고의 기전이다.
 */
export const MI_SAME_AREA_SCOPE =
  "유사상품·판단보류 후보는 이 비교에 쓰지 않습니다 — 아래 검토 구역에서 눈으로 확인하세요. 각 시장의 「참고가격」은 유사상품까지 포함한 참고 축이라 이 목록과 건수가 다를 수 있습니다.";
export const MI_SAME_DOMESTIC_HEADING = "🇰🇷 국내";
export const MI_SAME_OVERSEAS_HEADING = "🌎 해외";
/** 🔴 「국내에 동일상품이 없다」로 적지 않는다 — 부재와 미발견은 다르다(WU-091 어휘 계약). */
export const MI_SAME_EMPTY = "동일상품으로 판정되고 가격까지 확인된 후보가 아직 없습니다.";

/** 🔴 제외 사유를 **셀러의 말** 로. 내부 토큰(`UNVERIFIED_SEARCH`)을 노출하지 않는다. */
export const MI_SAME_EXCLUSION_TEXT: Record<Exclude<MiSameExclusion, "NOT_SAME">, string> = {
  SOLD_OUT: "품절 — 현재 판매중이 아니라 가격 비교에서 제외했습니다",
  PRICE_UNCONFIRMED: "가격 확인 필요 — 상세 페이지에서 현재가를 확인하지 못했습니다",
};
