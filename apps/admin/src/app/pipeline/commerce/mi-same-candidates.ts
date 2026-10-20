import {
  domesticMatchDisplay,
  tierDisplay,
  type MatchDisplay,
  type MatchDisplayTier,
} from "./match-display";
import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { GeminiTransientRow } from "./GeminiTransientCandidates";
/** 🔴 WU-133 — 축의 «말» 은 별 모듈이 소유한다(가드를 엄격하게 유지하기 위해 · 그 파일 머리 주석). */
import { blockerText } from "./blocker-text";

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

/* ───────────── 🔴🔴 WU-136 화면 문구 — **셀러의 말** 로만 적는다 ─────────────
 * 🔴 영역을 **새로 만들지 않았다**(CPO §A) — 같은 영역의 제목과 순서를 바꿨다.
 * 🔴 내부 토큰(`VERIFIED_CURRENT` · `PRESUMED_SAME` · tier · blocker)은 이 영역에
 *    **한 글자도** 노출되지 않는다. 기술 데이터는 지우지 않고 **접어** 둔다(§E).
 */
export const MARKET_JUDGEMENT_TITLE = "📊 시장 판매 판단";
export const MARKET_JUDGEMENT_NOTE =
  "이 상품이 지금 어디서 얼마에 팔리고 있는지부터 봅니다. 동일상품 판정은 그 판단을 위한 중간 단계입니다.";

/** 🔴 결론 한 줄. 넷을 **다른 문장** 으로 적는다 — 「없다」로 뭉치지 않는다. */
export const MARKET_VERDICT_TEXT: Record<MarketVerdict, string> = {
  NO_SAME: "동일상품으로 판정된 판매처가 아직 없습니다.",
  SAME_BUT_NONE_ON_SALE:
    "동일상품은 확인됐지만 현재 판매중인 판매처를 확인하지 못했습니다 — 품절이거나 판매여부를 확인할 수 없는 곳입니다.",
  ON_SALE_NO_PRICE: "동일상품이 판매중인 것은 확인됐지만 현재 가격을 확인할 수 없습니다.",
  ON_SALE: "동일상품이 현재 판매중입니다.",
};

/** 🟢 판매처 표의 머리 — **셀러가 읽는 네 칸**(CPO §C). */
export const MARKET_TABLE_HEADERS = ["시장", "판매처", "판매상태", "현재가격"] as const;

/** 🔴 판매상태를 **세 개의 다른 말** 로. 「모른다」를 「판매중」으로 적지 않는다. */
export const SALE_STATE_TEXT: Record<SaleState, string> = {
  ON_SALE: "🟢 판매중",
  SOLD_OUT: "🔴 품절",
  UNKNOWN: "⚪ 판매여부 확인불가",
};

export const MARKET_LABEL: Record<"KR" | "OVERSEAS" | "UNKNOWN", string> = {
  KR: "🇰🇷 국내",
  OVERSEAS: "🌎 해외",
  UNKNOWN: "❔ 미확정",
};

/**
 * 🔴🔴 CPO WU-136 §3 — **「시장 전체 판매처」로 읽히게 두지 않는다.**
 *
 * 우리가 셀 수 있는 것은 「**발견된 SAME 후보 중 판매여부를 확인할 수 있었고 실제
 * 판매중으로 확인된 곳**」 이다. 🔴 판매여부 신호가 현재 **Shopify 경로에서만** 확정되므로
 * (실측 2/9) 이 숫자는 **시장을 대표하지 않는다.** 🟢 그래서 국내/해외 분해 줄에도
 * **「판매중 확인 —」을 붙인다** — 수식어 없는 「🇰🇷 0곳 · 🌎 3곳」은 시장 전체로 읽힌다.
 */
export const ON_SALE_SPLIT_PREFIX = "판매중 확인";

/** 🔴 「판매중 N곳」은 **ON_SALE 만** 센 숫자다 — 그 사실을 화면이 같이 말한다. */
export function onSaleCountNote(j: MarketJudgement): string {
  const parts: string[] = [`판매중 확인 ${j.onSaleCount}곳`];
  if (j.unknownCount > 0) parts.push(`판매여부 확인불가 ${j.unknownCount}곳`);
  if (j.soldOutCount > 0) parts.push(`품절 ${j.soldOutCount}곳`);
  return parts.join(" · ");
}

/** 🔴 시장가격 한 줄. **통화별로만** 적고 환산하지 않는다. */
export function priceRangeText(r: MarketPriceRange): string {
  const range = r.lowest === r.highest ? `${r.lowest}` : `${r.lowest} ~ ${r.highest}`;
  return `${r.currency} ${range}`;
}

/**
 * 🔴🔴 그 가격이 **어떤 집합의 가격인지** 를 같이 적는다.
 *    실측(2026-10-20): 호스트 7/9 가 재고 칸을 공개하지 않아 **미확인** 이다 —
 *    그 숫자를 「N곳에서 판매중」으로 읽히게 두면 모르는 것을 판매중으로 만든다.
 */
export function priceRangeScope(r: MarketPriceRange): string {
  return r.onSale === r.n ? `${r.n}곳 · 전부 판매중 확인` : `${r.n}곳 · 그중 판매중 확인 ${r.onSale}곳`;
}

/**
 * 🔴 유사·보류 후보 구역은 **접는다**(삭제가 아니다 · CPO §D).
 *
 * 🔴 접힘의 «말» 은 **각 구역의 기존 머리 문구를 그대로 쓴다**(「🇰🇷 국내 후보 검토」 ·
 *    「🌎 해외 자동검색 후보」 · 「🔁 이전 확인 후보 재검증」 · 「🔗 직접 확인한 판매처」).
 *    넷을 「추가 검토 후보」 하나로 바꾸면 **출처가 사라진다** — 그 출처는 WU-130 이
 *    「생산자가 늘 때 조용히 엉뚱한 배열에 담긴다」를 막기 위해 세운 축이고
 *    계약으로 잠겨 있다. 🟢 CPO 가 요구한 성질(「셀러 시야에서 치운다」)은 **접힘**
 *    자체가 만족한다 ⟹ 라벨 상수를 **따로 두지 않았다**(쓰지 않는 상수를 남기지 않는다).
 */
/** 🔴 기술 데이터는 **접는다**(삭제가 아니다 · CPO §E). */
export const MI_DETAIL_FOLD_LABEL = "MI 상세 분석";

/* ──────────────── 🔴🔴 WU-133 — 「왜 비었나」를 화면이 말한다 ────────────────
 *
 * WU-133 전수 추적이 찾은 것: 사람이 SAME 이라 확인한 13건 중 **판정까지 간 7건이
 * 전부 보류(PRESUMED_SAME 5)/충돌(CONFLICT 2)** 이고, 그래서 가격비교가 **0건** 이다.
 *
 * 🔴 그런데 WU-132 의 화면은 「동일상품으로 판정되고 가격까지 확인된 후보가 아직
 *    없습니다」만 말했다. **그 아래에 가격까지 확보된 후보 7건이 서 있는데** 말이다 —
 *    셀러에게는 「아무것도 못 찾았다」로 읽히고, 그것은 **거짓** 이다.
 * 🟢 그래서 **이미 계산된 보류 사유를 세어** 한 줄로 적는다. 🔴 집계 0 · 판정 0 ·
 *    완화 0 — 읽어서 말하는 것이 전부다.
 */

export interface PendingSummary {
  /** 가격까지 확보됐는데 **SAME 이 아니라서** 비교에 못 들어간 후보 수. */
  count: number;
  /** 사유별 건수 — 많은 것부터. 🔴 「없음」을 지어내지 않는다(빈 배열이면 사유 미기록). */
  reasons: { text: string; n: number }[];
}

/**
 * 🔴 **가격은 있는데 SAME 이 아닌 후보** 를 사유별로 센다.
 *
 * 🔴 함수 이름이 `summarize…` 가 **아닌 이유** — 이 저장소에서 `summarize` 는
 *    **금액 집계** 의 어휘이고(`summarizeCandidateOverseasPrices` ·
 *    `summarizeDomesticMarketSplit` · `summarizeFrom`), 가격 영역에 그 어휘가
 *    들어오지 못하게 하는 계약(`wu-130 F-4`)이 있다. 🟢 이 함수는 **건수를 센다** —
 *    돈을 더하지 않는다. 그래서 이름도 그렇게 둔다(가드를 느슨하게 하지 않는다).
 *
 * 🔴 `soldOut === true` 는 **세지 않는다** — 그건 「팔지 않는다」이고 「판정이 보류됐다」와
 *    다른 사실이다(둘을 한 숫자로 뭉치면 셀러가 할 행동이 달라진다).
 * 🔴 시장이 확정되지 않은 후보도 **센다** — 그 후보도 「아래에 서 있는데 비교에 없는」 것이다.
 */
export function countPendingCandidates(
  rows: readonly GeminiTransientRow[] | null | undefined,
): PendingSummary {
  if (!rows || rows.length === 0) return { count: 0, reasons: [] };
  const seen = new Set<string>();
  const freq = new Map<string, number>();
  let count = 0;
  for (const row of rows) {
    if (seen.has(row.discoveredUrl)) continue;
    seen.add(row.discoveredUrl);
    if (transientDisplayTier(row) === "SAME") continue;
    if (!isNotSoldOut(row)) continue;
    if (!isPriceConfirmed(row)) continue;
    count += 1;
    const tokens = [...(row.crossSellerBlockers ?? []), ...(row.crossSellerConflicts ?? [])];
    for (const t of new Set(tokens.map(blockerText))) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return {
    count,
    reasons: [...freq.entries()]
      .map(([text, n]) => ({ text, n }))
      .sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)),
  };
}

/* ═══════════════ 🔴🔴 WU-136 — **판매여부가 1순위다** (CPO 재정의) ═══════════════
 *
 * 🔴 CPO: 「셀러가 원상품 URL 을 넣는 이유는 **이 상품을 팔아도 되는가** 다.
 *    `SAME` 은 목적이 아니라 그 판단을 하기 위한 **중간 판정** 이다.」
 *    ⟹ 화면 순서가 **① 판매중인가 → ② 몇 곳 → ③ 얼마 → ④ 팔 가치** 로 고정됐다.
 *
 * ── 🔴🔴 실측이 설계를 한 번 뒤집었다 (2026-10-20 · Shopify 공개 JSON · 호스트 9) ──
 * ```
 * inventory_management  9/9 가 "shopify"
 * inventory_quantity    **2곳만** 돌려준다(thefrontshop · junioredition)
 * ⟹ 운영 `isVariantAvailable` 의 `inventory_quantity ?? 0` 을 후보에 그대로 쓰면
 *    **7곳이 「품절」로 떨어진다** — 「모른다」를 「0」으로 취급하는 그 행위다.
 * 🟢 그래서 생산자는 `shopifyVariantAvailability`(boolean | null)를 쓰고,
 *    여기서는 그 **세 상태를 그대로** 받는다. 🔴 모르는 것을 판매중으로 만들지 않는다.
 * ```
 */

/** 🔴 **세 상태** 다. `UNKNOWN` 을 `ON_SALE` 로도 `SOLD_OUT` 으로도 접지 않는다. */
export type SaleState = "ON_SALE" | "SOLD_OUT" | "UNKNOWN";

/**
 * 🟢 운영이 낸 `soldOut`(boolean | null)을 **읽어서** 세 상태로 옮긴다.
 * 🔴 `null` 은 **판매여부를 확인하지 못한 것** 이고, 그 자리는 `UNKNOWN` 이다 —
 *    「품절」이 아니다(사이트가 재고 칸을 공개하지 않는 경우가 실측 7/9 다).
 */
export function saleState(row: GeminiTransientRow): SaleState {
  if (row.soldOut === true) return "SOLD_OUT";
  if (row.soldOut === false) return "ON_SALE";
  return "UNKNOWN";
}

/** 🟢 셀러가 읽는 **판매처 한 줄**. 🔴 값은 전부 운영 산출이다(지어낸 칸 0). */
export interface MarketSeller {
  row: GeminiTransientRow;
  /** 🔴 운영 `classifyCandidateMarket` 산출을 그대로. `UNKNOWN` 을 국내로 세지 않는다. */
  market: "KR" | "OVERSEAS" | "UNKNOWN";
  sale: SaleState;
  /** 🔴 `VERIFIED_CURRENT` 만. 그 외는 `null` 이고 화면이 「가격 확인 필요」로 적는다. */
  price: { amount: number; currency: string } | null;
}

/** 통화별 시장가격. 🔴 **환산하지 않는다** — 합계 칸이 없다(`overseas-reference` 계약과 같은 축). */
export interface MarketPriceRange {
  currency: string;
  lowest: number;
  highest: number;
  /** 그 통화에 든 판매처 수. */
  n: number;
  /** 🔴 그중 **판매중이 확인된** 곳. 「n 곳에서 판매중」으로 읽히지 않게 같이 적는다. */
  onSale: number;
}

/**
 * 🔴 셀러에게 할 **한 문장의 결론**. 넷을 섞지 않는다(CPO §G 가 요구한 예외 처리).
 * ```
 * NO_SAME                 동일상품 판정이 아직 없다
 * SAME_BUT_NONE_ON_SALE   동일상품은 있는데 **판매중이 확인된 곳이 없다**
 * ON_SALE_NO_PRICE        판매중은 확인됐는데 **가격을 확인하지 못했다**
 * ON_SALE                 판매중 + 가격 확인 ⟹ 비교 가능
 * ```
 */
export type MarketVerdict = "NO_SAME" | "SAME_BUT_NONE_ON_SALE" | "ON_SALE_NO_PRICE" | "ON_SALE";

export interface MarketJudgement {
  /** SAME 후보 전수(URL 중복 접음). 🟢 **판매중 → 미확인 → 품절** 순으로 정렬돼 있다. */
  sellers: MarketSeller[];
  onSaleCount: number;
  soldOutCount: number;
  unknownCount: number;
  domesticOnSale: number;
  overseasOnSale: number;
  /** 가격 축의 분모 — 가격이 확인됐고 **품절이 아닌** 판매처. */
  pricedSellers: MarketSeller[];
  byCurrency: MarketPriceRange[];
  verdict: MarketVerdict;
}

const SALE_ORDER: Record<SaleState, number> = { ON_SALE: 0, UNKNOWN: 1, SOLD_OUT: 2 };

/**
 * 🔴🔴 **판매여부를 가격보다 «먼저» 계산한다**(CPO §B).
 *
 * 🔴 판정하지 않는다 — `transientDisplayTier` · `saleState` · `isPriceConfirmed` 는
 *    전부 **운영 산출을 읽는** 술어다. threshold 0 · 새 축 0 · 집계 완화 0.
 * 🔴 `SIMILAR`/`PRESUMED_SAME`/`CONFLICT` 는 **들어오지 않는다**(CPO §B 그대로).
 * 🔴 **품절은 가격에서 뺀다** — 「팔 수 없는 가격은 경쟁가격이 아니다」(운영
 *    `summarizeFrom` 과 같은 방향). 🔴 그러나 **미확인은 빼지 않는다** —
 *    빼면 그 통화 축이 사라져 셀러가 시장가를 **아예 못 본다**(WU-111 에서 측정된 손실).
 *    🟢 대신 `onSale` 을 같이 실어 화면이 **「그중 판매중 확정 N곳」을 말한다**.
 */
export function buildMarketJudgement(
  rows: readonly GeminiTransientRow[] | null | undefined,
): MarketJudgement {
  const sellers: MarketSeller[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    if (seen.has(row.discoveredUrl)) continue;
    seen.add(row.discoveredUrl);
    if (transientDisplayTier(row) !== "SAME") continue;
    const market = row.market === "KR" || row.market === "OVERSEAS" ? row.market : "UNKNOWN";
    sellers.push({
      row,
      market,
      sale: saleState(row),
      price: isPriceConfirmed(row)
        ? { amount: row.priceAmount as number, currency: row.priceCurrency as string }
        : null,
    });
  }
  sellers.sort((a, b) => SALE_ORDER[a.sale] - SALE_ORDER[b.sale]);

  const onSale = sellers.filter((s) => s.sale === "ON_SALE");
  const pricedSellers = sellers.filter((s) => s.price != null && s.sale !== "SOLD_OUT");

  const byCurrencyMap = new Map<string, MarketPriceRange>();
  for (const s of pricedSellers) {
    const p = s.price as { amount: number; currency: string };
    const cur = byCurrencyMap.get(p.currency);
    if (!cur) {
      byCurrencyMap.set(p.currency, {
        currency: p.currency,
        lowest: p.amount,
        highest: p.amount,
        n: 1,
        onSale: s.sale === "ON_SALE" ? 1 : 0,
      });
      continue;
    }
    cur.lowest = Math.min(cur.lowest, p.amount);
    cur.highest = Math.max(cur.highest, p.amount);
    cur.n += 1;
    if (s.sale === "ON_SALE") cur.onSale += 1;
  }

  const verdict: MarketVerdict =
    sellers.length === 0
      ? "NO_SAME"
      : onSale.length === 0
        ? "SAME_BUT_NONE_ON_SALE"
        : pricedSellers.length === 0
          ? "ON_SALE_NO_PRICE"
          : "ON_SALE";

  return {
    sellers,
    onSaleCount: onSale.length,
    soldOutCount: sellers.filter((s) => s.sale === "SOLD_OUT").length,
    unknownCount: sellers.filter((s) => s.sale === "UNKNOWN").length,
    domesticOnSale: onSale.filter((s) => s.market === "KR").length,
    overseasOnSale: onSale.filter((s) => s.market === "OVERSEAS").length,
    pricedSellers,
    byCurrency: [...byCurrencyMap.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    verdict,
  };
}

/**
 * 🔴🔴 그 사실을 적는 문장. **「없다」로 끝내지 않는다.**
 *
 * 🔴 「동일상품」이라고 **단정하지 않는다** — 「판정이 보류됐다」가 정확한 말이고,
 *    그 판단은 셀러가 아래 검토 구역에서 눈으로 한다(⑤ 의 입력이 그것이다).
 */
export function pendingNote(summary: PendingSummary): string | null {
  if (summary.count === 0) return null;
  const why =
    summary.reasons.length > 0
      ? ` 주요 사유 — ${summary.reasons.map((r) => `${r.text} ${r.n}`).join(" · ")}.`
      : "";
  return (
    `가격까지 확인됐지만 동일상품 판정이 보류·충돌된 후보가 ${summary.count}건 있습니다 — ` +
    `아래 후보 검토 구역에서 사진으로 확인하고 판단해 주세요.${why}`
  );
}
