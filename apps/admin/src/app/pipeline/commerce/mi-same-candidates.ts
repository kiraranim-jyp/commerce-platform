import {
  domesticMatchDisplay,
  tierDisplay,
  type MatchDisplay,
  type MatchDisplayTier,
} from "./match-display";
import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { GeminiTransientRow } from "./GeminiTransientCandidates";
/**
 * 🔴 CORE-2S — **타입만** 가져온다. 이 파일은 참고가격을 **계산하지 않는다** —
 *    MI 가 이미 낸 집계(`candidateDomesticPrice` · `candidateOverseasPrice`)를
 *    「있는가 / 몇 곳인가 / 통화가 몇 개인가」로 **읽기만** 한다(환산 0 · 합산 0).
 */
import type { OverseasPriceSummary } from "./overseas-reference";
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
/**
 * 🔴 CORE-2S §5-⑥ — **「눈으로 확인하세요」를 지웠다**(`pendingNote` 와 같은 이유).
 *    🟢 **두 번째 문장은 한 글자도 바꾸지 않았다** — 그 문장이 「참고가격과 이 목록의
 *       건수가 다를 수 있다」를 말하고, 그것이 2026-09-19 사고를 막는 핵심이다.
 */
export const MI_SAME_AREA_SCOPE =
  "이 목록은 동일상품으로 «확정» 된 후보만 담습니다 — 그래서 위의 「참고가격」과 건수가 다를 수 있습니다. 확정되지 않은 후보는 아래 검토 구역에 그대로 남아 있습니다.";
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

/* ═══════ 🔴🔴 WU-139 — **가격을 못 가져온 후보를 «버리지 않는다»** (CPO 전략 수정) ═══════
 *
 * 🔴 CPO: 「동일상품은 최대한 정확하게. **가격을 못 가져오는 판매처는 버리지 않는다** —
 *    링크를 보여주고 셀러가 직접 확인하게 한다. **확인된 가격 1~2개만 있어도** 그것을
 *    기준으로 적정 판매가격대를 안내한다. 목적은 『모든 가격 수집』이 아니라
 *    **『셀러가 판매가를 결정할 근거』** 다.」
 *
 * 🔴🔴 **그래서 MI 는 한 글자도 완화하지 않는다** — 판정은 그대로 엄격하고, 바뀌는 것은
 *    **가격 축의 부분 성공을 허용** 하는 것뿐이다(CPO ①②③ 분리).
 *
 * 🔴🔴🔴 **1건을 「시장 평균가」처럼 적지 않는다**(CPO 명시 금지). 그래서 아래
 *    `PriceGuide.basis` 가 **SINGLE ↔ RANGE 를 가른다** — 문장이 달라야 한다.
 */

/** 🔴 「없다 / 1건 기준 / 가격대」를 **다른 말** 로 적기 위한 축. */
export type PriceGuideBasis = "NONE" | "SINGLE" | "RANGE";

/**
 * 🔴🔴 WU-149 — **가격 판단에 쓰는 동일상품 상한**(통화별).
 *
 * 🔴 CPO North Star: 「SAME 1개 = 최소 기준 · 2개 = 가격대 형성 · **3개 = 신뢰도 충분** ·
 *    4·5·20개는 **비례 가치 없음**」. ⟹ 🟢 제품 목표가 **2~3개** 이므로 그 상한을 코드가 들고 있다.
 * 🔴 **수집·판정에는 적용하지 않는다** — 이 상한은 **가격 계산** 전용이다(`buildPriceGuide`).
 */
export const SAME_PRICE_CAP = 3;

export interface PriceGuide {
  market: "KR" | "OVERSEAS";
  /** 동일상품으로 판정된 판매처 수(가격 유무와 **무관**). */
  sameCount: number;
  onSaleCount: number;
  /** 🟢 가격을 확인한 곳. */
  pricedCount: number;
  /** 🔴 **버리지 않는다** — 링크를 주는 곳. */
  unpricedCount: number;
  byCurrency: MarketPriceRange[];
  basis: PriceGuideBasis;
}

/**
 * 🔴 한 시장의 가격 가이드. **집계를 새로 만들지 않는다** — `buildMarketJudgement` 가
 *    이미 낸 `sellers` 를 시장으로 나눠 센다(판정 0 · threshold 0 · 환산 0).
 * 🔴 **품절은 가격 축에서 빼고**(팔 수 없는 가격은 기준가가 아니다) **미확인은 남긴다**
 *    (빼면 그 통화 축이 사라져 셀러가 기준가를 아예 못 본다 · WU-136 과 같은 규칙).
 */
export function buildPriceGuide(j: MarketJudgement, market: "KR" | "OVERSEAS"): PriceGuide {
  const mine = j.sellers.filter((s) => s.market === market);
  const priced = mine.filter((s) => s.price != null && s.sale !== "SOLD_OUT");
  /**
   * ════════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-149 STEP 3/4 — **가격 판단에 쓰는 동일상품은 «통화별 3개» 까지다**
   * ════════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO: 「4번째·5번째·10번째 SAME 을 찾는 것을 제품 목표로 삼지 않는다」 ·
   *    「**출력/가격 계산의 상한을 3개로 둔다**」 · 🔴 「검색 오케스트레이션 자체를
   *    뜯어고치지 않는다」(그것이 이 코드베이스에서 **가장 안전한 최소 변경** 이다).
   *
   * ── 🔴🔴 왜 «통화별» 인가 — 전역 3개로 자르면 **가격 신호가 틀어진다** ───────────
   * ```
   * 전역으로 금액 오름차순 3개를 고르면 **통화를 섞어 숫자를 비교** 하게 된다
   * (GBP 37 < USD 58 ?). 그 비교는 환산 없이는 **무의미** 하고, 환산은 금지다.
   * ⟹ 🔴 그러면 USD 축이 통째로 떨어져 「최저 확인가」가 **거짓** 이 될 수 있다.
   * 🟢 그래서 **통화 안에서만** 오름차순 3개를 남긴다 — 각 통화의 **최저가가 항상 보존**
   *    된다(🌎 「최저 확인가」의 전제). 🇰🇷 가격대는 **확인된 하위 3곳 기준** 이 된다.
   * ```
   * 🟢 「전체 시장 가격대가 아니다」는 이미 `PRICE_GUIDE_RANGE_NOTE` 가 말한다(WU-139) —
   *    그래서 상한을 둬도 셀러가 그 범위를 시장 전체로 읽지 않는다.
   * 🔴 **건수는 자르지 않는다** — `sameCount`·`onSaleCount`·`pricedCount`·`unpricedCount` 는
   *    **관측된 사실** 이고 CPO STEP 10 이 「현재 결과를 숨기지 말고 정확히 표시」를 요구한다.
   *    ⟹ 상한은 **가격 «계산»** 에만 적용된다(판정 0 · 수집 0 · MI 0).
   */
  const byCur = new Map<string, MarketSeller[]>();
  for (const s of priced) {
    const cur = (s.price as { currency: string }).currency;
    byCur.set(cur, [...(byCur.get(cur) ?? []), s]);
  }
  const byCurrencyMap = new Map<string, MarketPriceRange>();
  for (const [currency, list] of byCur) {
    /** 🔴 **통화 안에서만** 정렬한다 — 그래야 그 통화의 최저가가 반드시 남는다. */
    const used = [...list]
      .sort((a, b) => (a.price as { amount: number }).amount - (b.price as { amount: number }).amount)
      .slice(0, SAME_PRICE_CAP);
    const amounts = used.map((s) => (s.price as { amount: number }).amount);
    byCurrencyMap.set(currency, {
      currency,
      lowest: Math.min(...amounts),
      highest: Math.max(...amounts),
      n: used.length,
      onSale: used.filter((s) => s.sale === "ON_SALE").length,
    });
  }
  const byCurrency = [...byCurrencyMap.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  /**
   * 🔴 **표본 하나를 가격대라고 부르지 않는다.** 한 통화 안에 둘 이상이고 금액이
   *    실제로 다를 때만 `RANGE` 다 — 같은 금액 둘은 「가격대」가 아니다.
   */
  const basis: PriceGuideBasis =
    priced.length === 0 ? "NONE" : byCurrency.some((c) => c.n >= 2 && c.highest > c.lowest) ? "RANGE" : "SINGLE";
  return {
    market,
    sameCount: mine.length,
    onSaleCount: mine.filter((s) => s.sale === "ON_SALE").length,
    pricedCount: priced.length,
    unpricedCount: mine.filter((s) => s.price == null).length,
    byCurrency,
    basis,
  };
}

/**
 * 🔴 **동일상품 «수» 의 말.** 🔴 WU-145 — owner 를 상수로 뺐다. 이 말은 두 곳이 쓴다
 *    (`priceGuideCountNote` · `marketEmptyNote` 의 0곳 머리) ⟹ 손으로 두 벌 적으면
 *    한쪽만 고치는 날이 오고, 그때 셀러는 **같은 축을 다른 이름으로** 보게 된다.
 */
export const SAME_CONFIRMED_COUNT_LABEL = "동일상품 확인";

/** 🔴 그 숫자들을 **셀러의 말** 로. 「동일상품 확인」과 「가격 확인」을 가른다. */
export function priceGuideCountNote(g: PriceGuide): string {
  const parts = [
    `${SAME_CONFIRMED_COUNT_LABEL} ${g.sameCount}곳`,
    `판매중 확인 ${g.onSaleCount}곳`,
    `가격 확인 ${g.pricedCount}곳`,
  ];
  if (g.unpricedCount > 0) parts.push(`가격 확인 필요 ${g.unpricedCount}곳`);
  return parts.join(" · ");
}

/**
 * 🔴🔴 **기준가격 문장.** `basis` 에 따라 **다른 말** 을 쓴다 —
 *    1건을 「가격대」나 「평균」으로 적으면 CPO 가 금지한 그 거짓이 된다.
 * 🔴 통화 **환산 0** · 추천가를 **계산하지 않는다**(그 수식은 원가·수수료 축이고
 *    §00-B 가격 보류다 — 지어내면 셀러가 그 숫자로 가격을 정한다).
 */
export function priceGuideHeadline(g: PriceGuide): string | null {
  if (g.basis === "NONE") return null;
  return g.byCurrency
    .map((c) =>
      c.n >= 2 && c.highest > c.lowest
        ? `${c.currency} ${c.lowest} ~ ${c.highest}`
        : `${c.currency} ${c.lowest}`,
    )
    .join(" · ");
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-145 ① — **셀러 화면의 가격 어휘는 «하나» 다** (CPO 확정 2026-10-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **「시장 참고가격」을 쓰지 않는다**(CPO 명시 금지). 이유는 취향이 아니라 **충돌** 이다:
 * ```
 * `MI_SAME_AREA_SCOPE` 가 「참고가격」을 **이미 다른 뜻** 으로 쓴다 —
 * 그쪽은 **유사상품까지 포함한 참고 축**(`domestic-reference` · `🧾 해외 동일상품
 * 참고가격`)이고, 그 블록들의 제목은 `wu-056r1` 계약이 **글자로 잠그고 있다**.
 * ⟹ 1차 결론에 「시장 참고가격」을 쓰면 **같은 말이 두 뜻** 이 된다.
 * ```
 * 🟢 그래서 1차 결론의 말은 **「동일상품 확인 가격」** 하나로 고정하고, 2차(`mi-detail-fold`)
 *    안의 **참고가격 블록은 한 글자도 건드리지 않는다** — 두 말을 **섞지 않는다**.
 *
 * 🔴 라벨 owner 를 **상수 하나** 로 둔다 — 두 시장 제목을 손으로 두 벌 적으면
 *    한쪽만 고치는 날이 온다(`MARKET_LABEL` 이 생긴 그 이유).
 */
export const SAME_PRICE_LABEL = "동일상품 확인 가격";
export const PRICE_GUIDE_TITLE: Record<"KR" | "OVERSEAS", string> = {
  KR: `💰 국내 ${SAME_PRICE_LABEL}`,
  OVERSEAS: `💰 해외 ${SAME_PRICE_LABEL}`,
};

/* ═══════════ 🔴🔴🔴 WU-146 ② — **「💡 판매 판단」은 «상태별» 결론이다** ═══════════
 *
 * 🔴 CPO(2026-10-22): 「**동일상품 3곳 / 가격 USD 58** 만 보여주는 것은 «데이터 표시» 다.
 *    우리가 필요한 것은 **셀러 판단을 돕는 결론**」.
 * 🔴🔴 WU-145 의 한 줄은 **상태와 무관하게 같은 말** 이었다(「확인된 동일상품 가격을
 *    기준으로 … 참고할 수 있습니다」) ⟹ 가격이 하나든 셋이든 국내가 0 이든 **똑같이** 적혔다.
 *    그래서 그 문장은 결론이 아니라 **안내문** 이었다. 이 함수가 그것을 갈랐다.
 *
 * 🔴 **금지(CPO 명시)** — 「시장 평균」·「적정 판매가」·「권장 판매가」를 쓰지 않는다.
 *    우리가 가진 것은 **시장 기준가격** 이고 셀러의 원가·수수료·마진이 **없다**(§00-B).
 * 🔴 통화를 **환산해 하나로 합치지 않는다**(「GBP 37 / USD 58」로 **나란히** 적는다).
 * 🔴 **가격 숫자를 새로 집계하지 않는다** — `j.byCurrency`(화면이 이미 쓰는 그 값)를
 *    읽는다. 그래야 「seller-facing price owner = 1」(STEP 7-1)이 유지된다.
 */

/**
 * 🔴🔴🔴 **이름이 `sellerDecision` 이 «아닌» 이유 — 회귀가 잡았다.**
 *
 * 1차 구현을 `sellerDecision` 이라 불렀고 `wu-130` **F-4** 가 FAIL 했다:
 * 「통합은 **표시만** 이다 — 집계/판정/알림 어휘가 그 영역에 없다」.
 * 🔴 **그 가드가 맞았다** — `sellerDecision` 은 **이미 판매판정 owner 의 어휘** 다:
 * ```
 * market-intelligence.ts:846        const sellerDecision = buildSellerDecision({ … })  → finalVerdict
 * packages/pricing/…/unified-price-decision.ts   sellerDecisionStateFromUnifiedDecision
 * packages/pricing/representative-seller-decision.ts · seller-action.ts  computeSellerAction
 * ```
 * ⟹ 같은 이름이 **두 개의 다른 것**(실제 판매판정 ↔ 결론 «문장» 생성기)을 가리키면,
 *    다음 사람이 이 표시 영역에서 **판정이 일어난다고 읽는다**. 그것이 그 가드가 막는 것이다.
 * 🟢 그래서 **가드를 느슨하게 하지 않고 이름을 이 파일의 어휘 가족** 으로 옮겼다 —
 *    `MARKET_JUDGEMENT_TITLE` · `MARKET_JUDGEMENT_NOTE` · `buildMarketJudgement` ·
 *    `market-judgement` 가 이미 그 가족이다(WU-133 이 `blocker-text.ts` 를 따로 만든 그 선례).
 * 🔴 **DOM 이름(`data-testid="seller-decision"`)은 그대로 둔다** — 그것은 셀러가 보는
 *    「💡 판매 판단」의 이름이고 CPO 의 말이다. 가드가 보는 것은 **코드 어휘** 다.
 */
/**
 * 🔴🔴🔴 CORE-2S §5-② — **`NO_SAME_WITH_REFERENCE` 가 새로 생겼다. 그 이유를 적는다.**
 *
 * 🔴 전까지 상태가 셋이라, 「SAME 0」이면 참고가격이 **있어도** 결론이
 *    「아직 동일상품으로 확정된 판매처가 없습니다」로 끝났다. ⟹ CEO 화면의 바로 그 모양이다 —
 *    **🇰🇷 블록에 `KRW 88,000` 이 떠 있는데 결론은 그 숫자를 한 글자도 말하지 않았다.**
 * 🔴🔴 그것이 §2 가 지목한 모순이다: 「국내 참고가격 **1곳**」 ↔ 「동일상품 확정 **0곳**」은
 *    **모순이 아니라 서로 다른 두 축** 이고, 결론이 그 둘을 **같이** 말해야 한다.
 * 🟢 **판정을 바꾸지 않았다** — `PRESUMED_SAME → SAME` 승격 0 · threshold 0 · 집계 0.
 *    바뀐 것은 **이미 만든 참고가격 집계의 «존재» 를 결론이 읽는다** 는 것뿐이다.
 * 🔴 그리고 그 상태는 `PRICED`(= SAME 가격 확인)와 **반드시 달라야** 한다 —
 *    참고가격은 **확정 가격이 아니다**(유사상품까지 포함한 참고 축 · `MI_SAME_AREA_SCOPE`).
 */
export type MarketDecisionKind = "NO_SAME" | "NO_SAME_WITH_REFERENCE" | "SAME_NO_PRICE" | "PRICED";

export interface MarketDecisionLines {
  kind: MarketDecisionKind;
  /** 🔴 **문장 배열** 이다 — 한 문장에 몰아넣으면 셀러가 읽지 않는다(CPO 예시도 2줄). */
  lines: string[];
}

/**
 * 🔴 산문용 시장 이름. 🔴 `MARKET_LABEL` 과 **다른 자리** 인 이유 — 그쪽은 **뱃지**
 *    (「🇰🇷 국내」)라 이모지를 들고 있고, 문장 안에 넣으면 「🇰🇷 국내에서 동일상품
 *    판매가가 확인됩니다」가 된다. 🟢 두 쓰임이 달라서 둘이고, **둘 다 상수** 다.
 */
const MARKET_PLAIN_NAME: Record<"KR" | "OVERSEAS", string> = { KR: "국내", OVERSEAS: "해외" };

/* ═══════ 🔴🔴🔴 WU-148 — **시장이 다른 것은 «검색» 이 아니라 «가격 해석» 이다** ═══════
 *
 * 🔴 CPO(2026-10-22): 「국내와 해외의 차이는 **검색 시스템이 아니라 가격 해석** 이다」
 * ```
 * 🇰🇷 국내   «시장 가격대»     — 89,000 ~ 95,000 ⟹ 「대략 9만원대에 형성돼 있다」
 * 🌎 해외   «최저 확인가»     — 어디에서 얼마에 가장 싸게 팔리는가
 * ```
 * 🔴 **1개를 가격대라고 부르지 않는다**(STEP 4 명시) — 「가격대 확정 불가」로 적는다.
 * 🔴 **환산 0** — 통화를 섞어 하나의 숫자로 만들지 않는다.
 */

/** 🔴 국내 가격 신호의 **상태**. 1건과 가격대를 **다른 말** 로 적기 위한 축이다. */
export type PriceBandKind = "NONE" | "SINGLE" | "BAND";

export interface DomesticPriceBand {
  kind: PriceBandKind;
  /** 🔴 통화를 **지어내지 않는다** — 국내라고 KRW 로 단정하지 않는다(관측값을 쓴다). */
  currency: string | null;
  lowest: number | null;
  highest: number | null;
  n: number;
}

/**
 * 🔴🔴 **국내는 「최저가 하나」가 아니라 «가격대» 다**(CPO STEP 4).
 *
 * 🔴 **새 집계를 만들지 않는다** — `buildPriceGuide(j,"KR")` 가 이미 낸 `byCurrency` 를 읽는다.
 * 🔴🔴 **통화가 둘 이상이면 «가격대를 만들지 않는다»** — 그러려면 환산이 필요하고
 *    환산은 금지다(`overseas-reference` 계약). 그 경우 **가장 건수가 많은 통화** 도
 *    고르지 않는다 — 🟢 **단일 통화일 때만** 가격대를 말한다(정직한 상한).
 */
export function domesticPriceBand(g: PriceGuide): DomesticPriceBand {
  if (g.byCurrency.length !== 1) {
    return { kind: "NONE", currency: null, lowest: null, highest: null, n: 0 };
  }
  const c = g.byCurrency[0];
  /** 🔴 **같은 금액 둘은 가격대가 아니다**(WU-139 B-2 와 같은 규칙). */
  const kind: PriceBandKind = c.n >= 2 && c.highest > c.lowest ? "BAND" : "SINGLE";
  return { kind, currency: c.currency, lowest: c.lowest, highest: c.highest, n: c.n };
}

/** 🔴 「가격대 확정 불가」를 **글자로** 말한다 — 1건을 가격대처럼 읽히게 두지 않는다. */
export const PRICE_BAND_UNDETERMINED = "가격대 확정 불가";
export const DOMESTIC_BAND_LABEL = "국내 시장 가격대";

export function domesticBandText(b: DomesticPriceBand): string | null {
  if (b.kind === "NONE" || b.currency == null || b.lowest == null) return null;
  if (b.kind === "SINGLE") return `${b.currency} ${b.lowest} · ${PRICE_BAND_UNDETERMINED}`;
  return `${b.currency} ${b.lowest} ─ ${b.highest}`;
}

/**
 * 🔴🔴🔴 **해외는 «최저 확인가» 다** — 그런데 **통화가 섞이면 최저를 고를 수 없다.**
 *
 * 🔴 CPO 예시(「최저 USD 58」)는 **단일 통화 가정** 이다. 🔴 그러나 실측 S1 은
 *    **CAD 64 · GBP 37 · USD 58 세 통화** 다 — 거기서 「GBP 37 이 최저」라고 적으면
 *    **거짓** 이다(비교하려면 환산이 필요하고 환산은 금지다).
 * 🟢 그래서 **통화별 최저** 를 적는다. 통화가 하나면 그것이 곧 「최저 확인가」다.
 * 🔴 **새 집계 0** — `byCurrency[].lowest` 가 이미 그 값이다.
 */
export const OVERSEAS_LOWEST_LABEL = "최저 확인가";
export const OVERSEAS_LOWEST_PER_CURRENCY_NOTE =
  "통화가 여러 개라 하나의 최저가로 합치지 않습니다 — 통화별 최저 확인가입니다.";

export function overseasLowestText(g: PriceGuide): string | null {
  if (g.byCurrency.length === 0) return null;
  return g.byCurrency.map((c) => `${c.currency} ${c.lowest}`).join(" · ");
}

/** 🟢 통화가 하나일 때만 「최저 확인가 X」라고 **단정** 할 수 있다. */
export function overseasHasSingleCurrency(g: PriceGuide): boolean {
  return g.byCurrency.length === 1;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2E §4-4 — **원화 보조 표시를 «구현했다가 되돌렸다».** 이유를 남긴다.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 는 「`GBP 37 (약 ₩XX,XXX)` 형태를 **허용한다**」고 했다 — **요구가 아니라 허용** 이다.
 * 🟢 실제로 구현해 마운트 DOM 까지 붙였고, **두 가지가 동시에 드러나 되돌렸다**:
 *
 * ```
 * 🔴🔴 ① **거짓 숫자가 나온다.** 실측 — `CAD 64` → **「약 ₩64」**.
 *    `convertToKrw` 는 주석이 명시한 대로 「알 수 없는 통화는 변환하지 않고 원래
 *    금액을 그대로 KRW 로 취급」 한다(`pricing/currency.ts:24`). 고정표에 **CAD 가
 *    없어서** 64 CAD 가 **₩64** 로 셀러 화면에 떴다. 🔴 「약」을 붙여도 그것은 거짓이다.
 *    🟡 안전한 쪽은 `convertToKrwStrict`(모르는 통화 → `null`)지만, 그러면 **통화마다
 *       보이는 줄이 달라진다** — 그것은 **가격 표시 정책** 이다.
 * 🔴 ② **기존 계약 6건이 그 영역 전체에 `₩` 를 금지한다** — `wu-141-r3` C-1-b ·
 *    `wu-144` F · `wu-145` B-3 · `wu-146` 1-b · `wu-148` B-2 · `wu-139` B-5.
 *    그 금지들은 「seller-facing 가격 숫자의 owner 는 **하나**」와 「통화를 **합치지
 *    않는다**」를 지킨다. 🔴 **「허용」 한 줄로 그 여섯을 풀지 않았다.**
 * ```
 *
 * 🔵 **CPO 판정 사안** — 넣으려면 ⒜ `convertToKrwStrict` 로 바꿔 미지원 통화는
 *    **표시하지 않고** ⒝ 그 여섯 앵커를 **성질 기반** 으로 갱신해야 한다.
 * 🔴 §10 의 PASS 기준에 이 표시는 **없다** ⟹ CTO 가 임의로 밀지 않았다.
 */

/**
 * 🔴🔴 **시장 블록의 가격 한 줄 — owner 하나.**
 *
 * 🔴 전까지 두 시장이 `priceGuideHeadline`(통화별 범위) **하나** 를 같이 썼다 ⟹
 *    국내에도 「범위」가, 해외에도 「범위」가 나왔다. 🔴 CPO 가 가른 해석
 *    (국내=가격대 · 해외=최저 확인가)이 **화면에 반영되지 않았다**.
 * 🟢 이 함수가 그 분기를 **한 곳에서** 소유한다 — 호출부(MarketBlock)는 분기하지 않는다.
 * 🔴 가격이 없으면 `null` — 호출부가 「확인된 가격이 아직 없습니다」를 쓴다(기존 계약).
 */
export function marketPriceHeadline(g: PriceGuide): string | null {
  if (g.market === "KR") return domesticBandText(domesticPriceBand(g));
  const lowest = overseasLowestText(g);
  return lowest == null ? null : `${OVERSEAS_LOWEST_LABEL} ${lowest}`;
}

/** 🔴 그 한 줄이 **무엇인지** 를 셀러에게 말한다 — 숫자만 두면 「최저」인지 「가격대」인지 모른다. */
export function marketPriceHeadlineLabel(g: PriceGuide): string | null {
  if (g.market === "KR") {
    const b = domesticPriceBand(g);
    return b.kind === "BAND" ? DOMESTIC_BAND_LABEL : null;
  }
  return overseasHasSingleCurrency(g) ? null : OVERSEAS_LOWEST_PER_CURRENCY_NOTE;
}

/**
 * 🔴🔴🔴 **셀러가 첫 화면에서 읽는 «결론».**
 *
 * 🔴 「동일상품이 없다」·「국내 판매처 없음」·「시장에 없음」을 **쓰지 않는다**(STEP 3).
 *    `SAME = 0` 의 뜻은 **「현재 MI 가 동일상품으로 확정한 후보가 0 개」** 이고
 *    **시장 부재가 아니다**(WU-091 어휘 계약 · 계약이 글자로 잠근다).
 * 🔴 국내 0 의 「해외를 기준으로 참고」 문장은 **해외에 실제 가격이 있을 때만** 쓴다
 *    (CPO 명시 — 없는데 쓰면 그것이 바로 「없는 데이터를 기준으로 만들기」다).
 */
/**
 * 🔴 MI 가 이미 낸 **두 참고가격 집계**(`candidateDomesticPrice` ·
 *    `candidateOverseasPrice`). 🔴 이 파일은 그것을 **계산하지 않는다** —
 *    「있는가 · 몇 곳인가 · 통화가 몇 개인가」만 읽는다(금액을 꺼내지 않는다).
 */
export interface MarketReferencePrices {
  domestic?: OverseasPriceSummary | null;
  overseas?: OverseasPriceSummary | null;
}

/**
 * 🔴 **`count > 0` 만 보고 「가격이 있다」로 적지 않는다.** 통화 칸이 비어 있으면
 *    화면의 참고가격 블록도 **렌더되지 않는다**(`buildOverseasReference` 가 `null`) ⟹
 *    결론만 「가격이 확인됐습니다」라고 말하면 **없는 숫자를 가리키는 거짓** 이 된다.
 * 🟢 그래서 그 컴포넌트와 **같은 조건** 을 쓴다(술어를 두 벌로 두지 않는다).
 */
export function hasReferencePrice(s?: OverseasPriceSummary | null): boolean {
  return !!s && s.count > 0 && Object.keys(s.byCurrency ?? {}).length > 0;
}

/** 🔴 참고가격이 선 **시장 이름**. 순서는 화면과 같다(🇰🇷 국내 → 🌎 해외). */
export function referenceMarkets(refs?: MarketReferencePrices): string[] {
  const out: string[] = [];
  if (hasReferencePrice(refs?.domestic)) out.push(MARKET_PLAIN_NAME.KR);
  if (hasReferencePrice(refs?.overseas)) out.push(MARKET_PLAIN_NAME.OVERSEAS);
  return out;
}

/** 🔴 통화 **개수** 만 센다 — 금액을 꺼내지 않는다(그 숫자 owner 는 참고가격 블록이다). */
export function referenceCurrencyCount(refs?: MarketReferencePrices): number {
  const cur = new Set<string>();
  for (const s of [refs?.domestic, refs?.overseas]) {
    if (!hasReferencePrice(s)) continue;
    for (const c of Object.keys((s as OverseasPriceSummary).byCurrency)) cur.add(c);
  }
  return cur.size;
}

/** 🟢 그 집계가 **몇 곳** 기준인가 — 「한 곳뿐이라 가격대가 아니다」를 말하기 위해서다. */
export function referenceSellerCount(s?: OverseasPriceSummary | null): number {
  return hasReferencePrice(s) ? (s as OverseasPriceSummary).count : 0;
}

/**
 * 🔴🔴 CORE-2S — **`refs` 는 «옵셔널» 이다.** 주지 않으면 **동작이 전과 똑같다**
 *    (WU-140 이 `countPendingCandidates(rows, market?)` 에 쓴 그 선례 그대로) ⟹
 *    기존 호출부·계약이 한 줄도 바뀌지 않는다.
 */
export function marketDecisionLines(
  j: MarketJudgement,
  refs?: MarketReferencePrices,
): MarketDecisionLines {
  /** 🟢 시장별 수치는 **기존 owner** 가 낸다 — 여기서 다시 세지 않는다. */
  const kr = buildPriceGuide(j, "KR");
  const os = buildPriceGuide(j, "OVERSEAS");

  if (j.sellers.length === 0) {
    /**
     * 🔴🔴🔴 **여기가 CEO 화면의 모순이 살던 자리다.**
     *    SAME 0 이면 참고가격이 **있어도** 결론이 「없습니다」로 끝났다 —
     *    바로 위 🇰🇷 블록에 `KRW 88,000` 이 떠 있는데 말이다.
     * 🟢 이제 **그 둘을 한 결론에서 같이** 말한다. 🔴 승격 0 · 집계 0 · 금액 출력 0
     *    (금액은 참고가격 블록이 **유일한 owner** 다 — 여기서 숫자를 또 적으면
     *    「가격 숫자 중복 금지」 계약을 깬다).
     */
    const markets = referenceMarkets(refs);
    if (markets.length === 0) {
      return {
        kind: "NO_SAME",
        /** 🔴 「없다」로 끝내지 않는다 — **어디서 볼 수 있는지** 까지 말한다. */
        lines: [
          "아직 동일상품으로 확정된 판매처가 없습니다.",
          "확인된 후보와 보류 사유는 아래 상세 근거에서 볼 수 있습니다.",
        ],
      };
    }
    const where = markets.join("·");
    return {
      kind: "NO_SAME_WITH_REFERENCE",
      lines: [
        `동일상품으로 확정된 판매처는 아직 없지만, ${where}에서 같은 상품으로 보이는 판매처의 가격은 확인됐습니다.`,
        `지금의 시장가격 판단 근거는 위 ${where} 블록의 참고가격입니다 — 확정된 동일상품 가격은 아닙니다.`,
      ],
    };
  }

  if (j.byCurrency.length === 0) {
    return {
      kind: "SAME_NO_PRICE",
      /** 🔴 가격을 **지어내지 않는다** — 링크로 보내는 것이 정확한 답이다(WU-139). */
      lines: [
        "동일상품은 확인됐지만 확인된 판매가가 아직 없습니다.",
        "아래 판매처 목록의 링크에서 직접 확인할 수 있습니다.",
      ],
    };
  }

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 WU-148 — **시장별로 «다른 해석» 을 말한다** (CPO STEP 1/4/5/9)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 전까지는 두 시장을 **한 문장** 으로 뭉쳐(「{국내·해외} 동일상품 가격이
   *    확인됩니다」) **같은 해석** 을 적었다. 🔴 그런데 셀러가 두 시장에서 묻는 질문이
   *    **다르다**(CPO):
   * ```
   * 🇰🇷 국내  「이 상품은 국내에서 대략 얼마에 형성돼 있나」  → **시장 가격대**
   * 🌎 해외  「어디에서 얼마에 가장 싸게 팔리나」            → **최저 확인가**
   * ```
   * 🟢 그래서 **시장마다 한 줄씩** 적는다. 🔴 집계는 **하나도 새로 만들지 않았다** —
   *    `buildPriceGuide` 가 이미 낸 `byCurrency` 를 두 해석기가 읽는다.
   * 🔴 **「약 9만원대」를 만들지 않았다** — 그 말은 금액을 만원 단위로 **버림** 해야
   *    나오고, 가격대가 89,000~105,000 이면 **거짓** 이 된다(새 반올림 규칙 = 새 정책).
   *    🟢 그래서 **관측된 숫자를 그대로** 적는다.
   */
  const lines: string[] = [];

  if (kr.pricedCount > 0) {
    const band = domesticPriceBand(kr);
    const text = domesticBandText(band);
    if (band.kind === "BAND") {
      lines.push(`${MARKET_PLAIN_NAME.KR} ${DOMESTIC_BAND_LABEL}는 ${text} 로 확인됩니다.`);
    } else if (band.kind === "SINGLE") {
      /** 🔴 **1개를 가격대라고 부르지 않는다**(CPO STEP 4 명시). */
      lines.push(`${MARKET_PLAIN_NAME.KR}는 ${text} 입니다 — 확인된 가격이 1건이라 가격대를 말하지 않습니다.`);
    } else {
      /** 🔴 통화가 섞였다 — **환산해서 가격대를 만들지 않는다.** */
      lines.push(`${MARKET_PLAIN_NAME.KR} 확인 가격의 통화가 여러 개라 하나의 가격대로 합치지 않았습니다.`);
    }
  }

  if (os.pricedCount > 0) {
    const lowest = overseasLowestText(os);
    if (overseasHasSingleCurrency(os)) {
      lines.push(`${MARKET_PLAIN_NAME.OVERSEAS} ${OVERSEAS_LOWEST_LABEL}는 ${lowest} 입니다.`);
    } else {
      /**
       * 🔴🔴 **통화가 섞이면 「최저」를 하나로 고를 수 없다.** 실측 S1 은 CAD 64 ·
       *    GBP 37 · USD 58 세 통화이고, 거기서 「GBP 37 이 최저」라고 적으면 **거짓**
       *    이다(비교에 환산이 필요하고 환산은 금지다). 🟢 통화별로 적는다.
       */
      lines.push(`${MARKET_PLAIN_NAME.OVERSEAS} ${OVERSEAS_LOWEST_LABEL}는 통화별로 ${lowest} 입니다.`);
      lines.push(OVERSEAS_LOWEST_PER_CURRENCY_NOTE);
    }
  }

  /** 🔴 **가격을 못 가져온 동일상품을 숨기지 않는다** — 그 사실도 결론의 일부다. */
  const unpriced = kr.unpricedCount + os.unpricedCount;
  if (unpriced > 0) {
    lines.push("동일상품은 확인됐지만 일부 판매처의 가격은 직접 확인이 필요합니다.");
  }

  /**
   * 🔴🔴 국내 0 의 말. **「국내 동일상품이 없습니다」가 아니다**(CPO 금지).
   * 🔴 그리고 **해외에 실제 가격이 있을 때만** 이 문장을 쓴다 — 조건이 그 자리다.
   */
  if (kr.sameCount === 0 && os.pricedCount > 0) {
    lines.push(
      "현재 확인된 국내 동일상품 가격은 없습니다.",
      "해외에서 확인된 동일상품 가격을 기준으로 참고할 수 있습니다.",
    );
  }
  return { kind: "PRICED", lines };
}
/** 🔴 **1건을 시장 평균처럼 읽히게 두지 않는다**(CPO 명시 금지). */
export const PRICE_GUIDE_SINGLE_NOTE = "확인 가능한 가격 1건 기준입니다 — 시장 평균가가 아닙니다.";
export const PRICE_GUIDE_RANGE_NOTE = "현재 확인된 판매가 범위입니다 — 전체 시장 가격대가 아닙니다.";
/** 🔴 가격이 없는 SAME 후보를 **버리지 않는다** — 링크를 준다. */
export const PRICE_LINK_TEXT = "🔗 가격 확인";
/** 🔴 「가격을 못 가져왔다」와 「동일상품이 없다」는 다른 문장이다. */
export const PRICE_GUIDE_EMPTY = "확인된 가격이 아직 없습니다 — 아래 판매처에서 직접 확인할 수 있습니다.";

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
 * 🔴 시장이 확정되지 않은 후보도 **센다**(전역 호출일 때) — 그 후보도 「아래에 서 있는데
 *    비교에 없는」 것이다.
 *
 * ── 🔴🔴 WU-140 — **`market` 인자가 생겼다. 이것은 「UI 수정」이 아니다** ───────────
 * ```
 * CPO: 「`countPendingCandidates` 에 market 인자를 추가하는 것은 단순 UI 수정이 아니라
 *       **상태 의미를 정확히 만드는 핵심 수정**」.
 * 🔴 전역으로만 셀 수 있던 동안 화면은 「🇰🇷 국내가 비었다」의 **이유를 말할 수 없었다** —
 *    ⒜ 그 시장에서 후보를 못 찾은 것과 ⒝ 후보는 있는데 판정이 보류된 것이 **같은 빈 칸**
 *    으로 보였다. 셀러가 할 행동이 전혀 다른데 화면이 같은 말을 한 것이다.
 * 🟢 바뀐 것은 **필터 한 줄** 이다 — 집계 0 · 판정 0 · threshold 0 · 완화 0.
 * 🔴 `market` 을 **주지 않으면 동작이 전과 똑같다**(전역 집계) — 기존 호출부 불변.
 * 🔴 `market` 을 주면 `UNKNOWN` 시장 후보는 **어느 쪽에도 들어가지 않는다**(WU-020 §4 ·
 *    「시장을 추측하지 않는다」). 그래서 전역 합계가 두 시장의 합보다 클 수 있고,
 *    그것이 **정확한 상태** 다.
 * ```
 */
export function countPendingCandidates(
  rows: readonly GeminiTransientRow[] | null | undefined,
  market?: "KR" | "OVERSEAS",
): PendingSummary {
  if (!rows || rows.length === 0) return { count: 0, reasons: [] };
  const seen = new Set<string>();
  const freq = new Map<string, number>();
  let count = 0;
  for (const row of rows) {
    if (market != null && row.market !== market) continue;
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

/**
 * 🔴🔴 WU-140 — **그 시장에서 후보를 «몇 곳» 봤는가.** 판정·가격과 **무관** 하다.
 *
 * 🔴 이 숫자가 없으면 「후보를 못 찾았다」와 「후보는 봤는데 판정이 안 됐다」를 가를 수
 *    없다. 🔴 그리고 `countPendingCandidates` 로는 **가를 수 없다** — 그 함수는
 *    「가격까지 확인된」 후보만 세므로, 가격이 없는 보류 후보가 5곳 있어도 **0** 이다.
 *    그 0 을 「후보 없음」으로 적으면 **거짓** 이다(그 거짓이 이 함수가 생긴 이유다).
 * 🔴 URL 중복은 접는다 — 네 생산자가 같은 판매처를 낼 수 있다(선별기와 같은 규칙).
 */
export function countMarketCandidates(
  rows: readonly GeminiTransientRow[] | null | undefined,
  market: "KR" | "OVERSEAS",
): number {
  if (!rows || rows.length === 0) return 0;
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.market !== market) continue;
    if (seen.has(row.discoveredUrl)) continue;
    seen.add(row.discoveredUrl);
  }
  return seen.size;
}

/** 🔴 「이 시장에 동일상품이 없다」로 적지 않는다 — **부재와 미발견은 다르다**(WU-091 어휘 계약). */
export const MARKET_EMPTY_NO_CANDIDATE = "아직 이 시장에서 비교할 후보를 찾지 못했습니다.";
/**
 * 🔴🔴🔴 CORE-2S §5-⑥ — **셀러에게 «조사 업무» 를 돌려주지 않는다.**
 *
 * 🔴 전 문구는 「**아래 후보 검토 구역에서 사진으로 확인해 주세요**」였다 — 그것은
 *    셀러에게 **동일상품 판정을 시키는 말** 이고, 이 제품의 North Star 와 정면으로
 *    충돌한다(START-HERE §2: 「셀러가 직접 SAME/SIMILAR 를 판단하지 않는다 — MI 가 한다」).
 *    🔴 WU-154 가 같은 이유로 「URL 을 찾아 넣는」 입력칸을 폐기했는데, **같은 요구가
 *    문장으로 남아 있었다**(그 계약은 `MarketPriceComparison.tsx` 소스만 보므로
 *    이 상수 파일의 문장을 잡지 못했다).
 * 🟢 그래서 「**어디서 볼 수 있는지**」만 말한다 — WU-133 이 고친 거짓말(「아무것도
 *    못 찾았다」로 읽히는 화면)은 그대로 막히고, 일을 떠넘기는 말만 사라진다.
 * 🔴 상수 owner 는 하나다 — 계약(`wu-140`)이 이 상수를 import 해서 보므로 문구를
 *    두 벌로 적으면 그 계약이 조용히 통과한다.
 */
export const MARKET_EMPTY_REVIEW_HINT = "확인한 후보와 보류 사유는 아래 「MI 상세 분석」에 있습니다.";
/**
 * 🔴🔴🔴 CORE-2S §5-② — **「동일상품 확인」은 «가격» 과 다른 축이다.**
 *
 * 🔴 CEO 화면의 핵심 혼동이 이것이다 — 「국내 참고가격 **1곳**」과 「동일상품 확정
 *    **0곳**」이 **모순이 아닌데** 한 블록에 수식어 없이 나란히 서면 셀러가
 *    「0 이니까 가격도 없는 것」으로 읽는다.
 * 🟢 그래서 블록 안에서 **축의 이름을 붙여** 가른다 — 위는 돈(💰/🇰🇷/🧾), 아래는 판정(🔎).
 * 🔴 판정을 **새로 만들지 않는다** — 라벨 한 줄이고 숫자는 기존 `marketEmptyNote` 가 낸다.
 */
export const SAME_CHECK_HEADING = "🔎 동일상품 확인";

/**
 * 🔴🔴🔴 WU-140 ③ — **그 시장이 빈 «이유» 를 말한다**(CPO: 네 상태를 구분해야 한다).
 *
 * ```
 * ⒜ 검색 자체가 안 됨          후보 0          → MARKET_EMPTY_NO_CANDIDATE
 * ⒝ SAME 판정 대기·보류         후보 N · SAME 0 → 「N곳을 찾았지만 …」 (+ 사유)
 * ⒞ SAME 이지만 가격 확인 필요   → 가격 가이드가 말한다(`priceGuideCountNote` + 🔗)
 * ⒟ 가격 확인 완료             → 가격 가이드가 말한다(`priceGuideHeadline`)
 * ```
 * 🔴 ⒞⒟ 는 이 함수가 말하지 않는다 — 그 둘은 **가격 가이드 블록의 소관** 이고,
 *    여기서 또 적으면 같은 사실이 두 곳에서 갈린다.
 * 🔴 사유를 **지어내지 않는다** — `reasons` 가 비면 사유 절을 **아예 쓰지 않는다**.
 *
 * ── 🔴🔴🔴 WU-145 ①② — **숫자는 남기고 «사유 어휘» 를 2차로 내린다** ──────────────
 * ```
 * 🔴 CPO STEP 3: 「MI blocker 는 **기본 노출 없음** · 후보 조사는 **2차 근거로 격리**」.
 *    전까지 이 문장이 1차 화면에 **「주요 사유 — 브랜드 미확인 5 · 품번 충돌 2」** 를 찍었다.
 * 🔴🔴 그런데 **지우면 WU-133 이 고친 거짓말이 되돌아온다** — 「아무것도 못 찾았다」로
 *    읽히는 그 화면이다. ⟹ 🟢 **삭제가 아니라 «이동» 이다**(CPO 명시):
 *      1차  보류 **건수** 까지                      ← 지금 이 함수
 *      2차  사유 분포(`pendingReasonNote`)          ← `▸ MI 상세 분석` 안
 * 🔴 그리고 **머리에 「동일상품 확인 0곳」을 붙인다**(CPO ② 1차 레이아웃). 전까지 이
 *    블록은 `sameCount === 0` 일 때 **건수 줄 자체가 없어서**(가격 가이드가 안 선다)
 *    셀러가 「0 곳」이라는 **숫자를 못 봤다** — 빈 칸과 0 은 다른 사실이다.
 * ```
 * 🔴 **금지 문구 셋은 여기서도 쓰지 않는다** — 「국내에서는 판매되지 않습니다」·
 *    「국내 시장 가격이 없습니다」·「국내는 USD 58 정도입니다」(CPO ② · 계약이 잠근다).
 */
export function marketEmptyNote(
  candidateCount: number,
  pending: PendingSummary,
  /**
   * 🔴🔴🔴 CORE-2U-A §3·§6·§7 — **참고가격이 «이미 섰으면» 후보 수를 또 말하지 않는다.**
   *
   * 🔴 CPO: 「셀러에게는 숫자가 여러 개 나오면 안 된다 … `국내 가격 1곳` · `동일상품
   *    가격 0곳` · `유사상품 참고가격 1곳` 이렇게 나오면 **실패** 다」(§7) ·
   *    「**후보 개수와 가격 evidence 개수를 동일한 의미처럼 표시**」 금지(§6).
   * 🔴🔴 그런데 **후보 수를 늘 지우면 WU-133 이 고친 거짓말이 되돌아온다** —
   *    「아무것도 못 찾았다」로 읽히는 그 화면이다. 🟢 그 거짓말은 **참고가격이 없을 때만**
   *    위험하다(가격이 서 있으면 화면이 이미 「KRW 88,000 · 확인 N곳」을 말한다).
   * ⟹ 🟢 그래서 **조건부** 로 가른다 — 넘기지 않으면 **동작이 전과 똑같다**(기존 호출부 불변).
   */
  hasReferencePriceShown?: boolean,
): string {
  /** 🔴 **0 을 숫자로 말한다** — 「동일상품 확인 N곳」 축을 두 블록이 **같은 말** 로 쓴다. */
  const head = `${SAME_CONFIRMED_COUNT_LABEL} 0곳`;
  if (candidateCount === 0) return `${head} — ${MARKET_EMPTY_NO_CANDIDATE}`;
  /**
   * 🟢 CORE-2U-A — 가격이 **이미** 1차에 섰으면 **상태 한 줄로 끝낸다**(숫자 하나 원칙).
   *    🔴 사유·후보 수·보류 수는 **지우지 않는다** — `▸ MI 상세 분석` 이 그대로 들고 있다.
   */
  if (hasReferencePriceShown) return `${head} — ${SAME_NOT_CONFIRMED_SHORT}`;
  /**
   * 🔴 **건수는 1차에 남긴다**(그것이 ⒜ 와 ⒝ 를 가르는 사실이다) · **사유 어휘는 2차로**.
   * 🔴 사유를 지어내지 않듯 **보류 0 이면 그 절도 쓰지 않는다**.
   */
  const held = pending.count > 0 ? ` 그중 판정 보류·충돌 ${pending.count}곳입니다.` : "";
  return (
    `${head} — 후보 ${candidateCount}곳을 찾았지만 아직 동일상품으로 판정된 곳이 없습니다.${held} ` +
    MARKET_EMPTY_REVIEW_HINT
  );
}

/** 🟢 CORE-2U-A — 참고가격이 이미 선 블록에서 쓰는 **짧은 상태 문장**(후보 수 노출 0). */
export const SAME_NOT_CONFIRMED_SHORT = "아직 동일상품으로 확정된 판매처가 없습니다.";

/**
 * 🔴🔴🔴 WU-140 — **시장이 «확정되지 않은» 후보를 조용히 없애지 않는다.**
 *
 * ── 🔴 이것은 가정이 아니라 **실측** 이다 (WU-138 하니스 · 2026-10-21) ─────────
 * ```
 * B226AC010 의 `www.beaumonde.co.kr` 은 **사람이 SAME 이라 한 `.kr` 후보** 인데
 * **가격이 없어서** 시장 축이 `UNKNOWN` 으로 남는다(WU-077 의 ⒞ 「가격 자체가 없다」).
 * ⟹ 🔴 그 후보는 `buildPriceGuide` 의 두 시장 어디에도 **들어가지 않는다**
 *    (WU-020 §4 · 「시장을 추측하지 않는다」 — 그 계약은 **옳고 유지한다**).
 * 🔴 그런데 그러면 🇰🇷 블록이 「후보를 찾지 못했습니다」라고 말한다 — **한국 도메인
 *    후보가 실재하는데** 말이다. 그것은 화면이 거짓말하는 것이다.
 * ```
 * 🟢 그래서 **한 문장** 을 더한다. 🔴 시장을 **지어내지 않고**(UNKNOWN 을 KR 로 올리지
 *    않는다) 「세지 않았다」는 사실과 **어디서 볼 수 있는지** 를 말한다.
 * 🔴 새 영역 **0** · 집계 **0** · 판정 **0** — 이미 있는 행을 **세어 적는** 것이 전부다.
 */
export function countUnresolvedMarketCandidates(
  rows: readonly GeminiTransientRow[] | null | undefined,
): number {
  if (!rows || rows.length === 0) return 0;
  const seen = new Set<string>();
  for (const row of rows) {
    /** 🔴 `KR`/`OVERSEAS` 가 **아닌 모든 것** 이다 — `UNKNOWN` · null · undefined 포함. */
    if (row.market === "KR" || row.market === "OVERSEAS") continue;
    if (seen.has(row.discoveredUrl)) continue;
    seen.add(row.discoveredUrl);
  }
  return seen.size;
}

/** 🔴 「없다」와 「모른다」를 같은 말로 적지 않는다. */
export function marketUnresolvedNote(n: number): string | null {
  if (n <= 0) return null;
  return (
    `국내·해외 중 어디인지 확인하지 못한 후보 ${n}곳은 위 두 블록에 세지 않았습니다 — ` +
    `아래 상세 근거와 후보 검토 구역에서 볼 수 있습니다.`
  );
}

/**
 * 🟢 ③ 구간의 머리. 🔴 결론(verdict)은 시장 블록의 **요약** 이므로 그 뒤에 온다(CPO 확정 순서).
 *
 * 🔴 **WU-146 에서 문구가 바뀌었다** — 「판매·가격 판단 결과」는 **표의 제목처럼** 읽혔다.
 *    CPO 가 고정한 말은 **「💡 판매 판단」** 이고, 그 아래가 «결론» 이다(데이터 표시가 아니다).
 * 🟢 상수라 소비처(화면 1 · 계약 1)가 자동으로 따라온다.
 */
export const MARKET_RESULT_HEADING = "💡 판매 판단";

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
  /**
   * 🔴🔴🔴 WU-145 ① — **사유 어휘가 이 문장에서 빠졌다. 지워진 것이 «아니다».**
   *
   * 🔴 CPO STEP 3: 「MI blocker 는 **기본 노출 없음**」. 전까지 이 한 줄이 1차 화면에
   *    **「주요 사유 — 브랜드 미확인 5 · 품번 충돌 2」** 까지 찍었고, 그래서 셀러가 가장
   *    먼저 읽는 영역이 **MI 내부 축의 이름** 으로 채워졌다.
   * 🟢 사유는 `pendingReasonNote` 가 **그대로** 들고 2차(`▸ MI 상세 분석`)에 선다 —
   *    **건수와 「어디서 보는지」는 1차에 남긴다**(그래야 WU-133 이 고친 거짓말,
   *    즉 「아무것도 못 찾았다」로 읽히는 화면이 되돌아오지 않는다).
   */
  /**
   * 🔴🔴🔴 CORE-2S §5-⑥ — **「사진으로 확인하고 판단해 주세요」를 지웠다.**
   *
   * 🔴 그 꼬리는 셀러에게 **동일상품 판정을 시키는 말** 이고, WU-154 가 입력칸을
   *    폐기한 것과 **같은 종류의 요구** 다(「시스템이 동일상품을 찾아서 판단해주는
   *    시스템」 — CPO). 🔴 그 계약은 `MarketPriceComparison.tsx` **소스만** 봤기 때문에
   *    상수 파일에 있던 이 문장을 **잡지 못했다**(`MARKET_EMPTY_REVIEW_HINT` 와 같은 자리).
   * 🟢 **건수는 그대로 남는다** — 그것이 WU-133 이 고친 거짓말(「아무것도 못 찾았다」)을
   *    막는 사실이고, 바뀐 것은 **「어디서 볼 수 있는지」만 말한다** 는 것뿐이다.
   */
  return (
    `가격까지 확인됐지만 동일상품 판정이 보류·충돌된 후보가 ${summary.count}건 있습니다 — ` +
    `사유와 후보 목록은 아래 「MI 상세 분석」에 있습니다.`
  );
}

/**
 * 🔴🔴 WU-145 ① — **2차(MI 상세)에서 그 «사유 분포» 를 말한다.**
 *
 * 🔴 이 함수가 생긴 이유는 「사유를 지우지 않기 위해서」다 — CPO 지시는 **이동** 이고
 *    삭제가 아니다. 🔴 MI 추적용 정보라 **한 건도 줄이지 않는다**(정렬·건수 그대로).
 * 🔴 사유를 **지어내지 않는다** — `reasons` 가 비면 **null**(없는 말을 적지 않는다).
 * 🟢 내부 토큰은 들어오지 않는다 — `blockerText` 가 이미 셀러의 말로 바꿨다
 *    (WU-056 의 `EXCLUDED` 누출 재발 방지 · `blocker-text.ts` 가 그 owner 다).
 */
export function pendingReasonNote(summary: PendingSummary): string | null {
  if (summary.count === 0 || summary.reasons.length === 0) return null;
  return `주요 사유 — ${summary.reasons.map((r) => `${r.text} ${r.n}`).join(" · ")}`;
}

/* ═══════ 🔴🔴🔴 CORE-2S §5-③ — **「그 가격이 왜 그 가격인가」를 화면이 말한다** ═══════
 *
 * 🔴 CPO: 「셀러가 **『이 가격이 왜 나온 거지?』라는 질문을 하지 않아도** 되도록
 *    출처/기준을 이해할 수 있어야 한다」(§8 PASS 5).
 * 🔴🔴 지금 화면에는 그 영역이 **없다.** 가격 숫자와 「동일상품 0곳」만 있어서, 셀러는
 *    **그 숫자가 어떤 집합의 가격인지** 를 알 수 없다(그것이 2026-09-19 사고의 기전과
 *    같은 모양이다 — 숫자는 보이는데 그 숫자의 **성질** 이 화면에 없다).
 *
 * ── 🔴 세 가지를 «하지 않는다» ────────────────────────────────────────────────
 * ```
 * ❌ 금액을 적지 않는다      — 금액 owner 는 참고가격 블록/가격 가이드 **하나** 다
 *                              (적으면 `core-2r5 A-2`「KRW 88,000 은 화면에 1회」가 깨진다)
 * ❌ 내부 토큰을 적지 않는다  — `COMPARISON`·`PRESUMED_SAME`·`EXACT`·tier·blocker 0
 * ❌ 상태와 무관한 안내문을 만들지 않는다 — WU-146 이 지운 그 모양이다. 아래 네 줄은
 *                              **전부 조건부** 이고, 조건이 없으면 영역 자체가 서지 않는다
 * ```
 * 🔴 그리고 **「가격 계산 기준」과 다른 이름** 이다 — 그 말은 ③ 수익성의
 *    `ⓘ 가격 계산 기준`(`DomesticPriceIntelligencePanel:3767`)이 **이미 소유** 하고
 *    있다. 두 구역이 같은 이름을 쓰면 셀러가 한 구역으로 읽는다(`wu-056r1` 의 기전).
 */
export const PRICE_BASIS_HEADING = "💡 가격 판단 기준";

/** 🟢 가격의 **출처**. 🔴 「검색 목록의 표시가가 아니다」가 이 줄의 핵심이다. */
export const PRICE_BASIS_SOURCE_LINE =
  "이 화면의 가격은 판매처 상세 페이지에서 확인한 금액입니다 — 검색 목록의 표시가가 아닙니다.";
/** 🟢 SAME 가격이 있을 때 — 가장 강한 근거다. */
export const PRICE_BASIS_SAME_LINE = "동일상품으로 판정된 판매처의 가격을 기준으로 씁니다.";
/**
 * 🔴🔴 SAME 이 없을 때 — **이 줄이 CEO 화면의 「왜 88,000 인가」에 답한다.**
 *    🔴 「유사상품」이라는 등급 어휘를 쓰지 않는다(`TIER_LABEL` 의 말이고 내부 축이다) —
 *       셀러의 말로 **「같은 상품으로 보이는」** 이라고 적는다.
 */
export const PRICE_BASIS_REFERENCE_LINE =
  "국내 참고가격은 현재 확보된 국내 판매처의 가격을 참고한 값이며, 동일상품으로 확정된 가격만을 의미하지 않습니다.";
/** 🔴 환산 금지를 **셀러에게도** 말한다 — 안 적으면 두 통화를 비교해도 되는 줄 안다. */
export const PRICE_BASIS_CURRENCY_LINE =
  "통화가 다른 가격은 환산하지 않고 통화별로 따로 적습니다.";
/**
 * 🔴 **한 곳을 가격대로 읽히게 두지 않는다**(`PRICE_BAND_UNDETERMINED` 와 같은 축).
 * 🔴 **국내 전용** 이다 — 「가격대」는 🇰🇷 의 해석이고 🌎 는 「최저 확인가」다
 *    (START-HERE §3 MARKET RULE). 두 시장 판매처를 합쳐 세면 그 규칙이 섞인다.
 */
export const PRICE_BASIS_SINGLE_SELLER_LINE =
  "국내는 확인된 판매처가 한 곳이라 가격대가 아니라 참고가격 한 건입니다.";

/**
 * 🔴 **가격이 하나도 없으면 빈 배열** 이다 — 호출부가 영역을 **아예 세우지 않는다**.
 *    (없는 기준을 설명하는 칸을 만들지 않는다 · 이 저장소가 반복해 막아 온 「빈 틀」)
 */
export function priceBasisLines(
  j: MarketJudgement,
  refs?: MarketReferencePrices,
): string[] {
  const sameHasPrice = j.byCurrency.length > 0;
  const refMarkets = referenceMarkets(refs);
  if (!sameHasPrice && refMarkets.length === 0) return [];

  const lines = [PRICE_BASIS_SOURCE_LINE];
  lines.push(sameHasPrice ? PRICE_BASIS_SAME_LINE : PRICE_BASIS_REFERENCE_LINE);

  /** 🔴 통화 개수는 **두 축을 합쳐** 센다 — SAME 축과 참고 축이 다른 통화일 수 있다. */
  const currencies = new Set<string>(j.byCurrency.map((c) => c.currency));
  for (const s of [refs?.domestic, refs?.overseas]) {
    if (!hasReferencePrice(s)) continue;
    for (const c of Object.keys((s as OverseasPriceSummary).byCurrency)) currencies.add(c);
  }
  if (currencies.size >= 2) lines.push(PRICE_BASIS_CURRENCY_LINE);

  /**
   * 🔴 「한 곳뿐」은 **참고 축에서만** 적는다 — SAME 축의 1건은
   *    `PRICE_GUIDE_SINGLE_NOTE`(「… 시장 평균가가 아닙니다」)가 **이미** 말한다.
   *    두 곳에서 같은 사실을 적으면 그것이 중복이다.
   */
  if (!sameHasPrice && referenceSellerCount(refs?.domestic) === 1) {
    lines.push(PRICE_BASIS_SINGLE_SELLER_LINE);
  }
  return lines;
}

/* ═══ 🔴🔴🔴 CORE-2S §5-⑤ — **「원가가 없다」를 「데이터가 없다」로 보이게 두지 않는다** ═══
 *
 * 🔴 CPO: 「원가 없으면 **『수익성 판단 보류 · 원가 입력 필요』** · 🔴 「데이터 없음」처럼
 *    보이지 않게 한다(**UNKNOWN ≠ 실패**)」(§5-⑤).
 * 🔴🔴 지금 화면은 시장가격을 다 찾아 놓고도 최종 판단이 `UNKNOWN` 으로 끝난다 —
 *    셀러에게는 「아무것도 못 했다」로 읽히는데 **사실은 한 칸만 비어 있다**.
 *
 * 🔴 **계산하지 않는다** — 추천 판매가 · 마진 · 예상 수익을 만들지 않는다(§3 금지).
 *    이 함수가 하는 일은 **「무엇이 비어 있는지」 한 줄로 말하는 것** 이 전부다.
 * 🔴 그리고 **가격이 있을 때만** 말한다 — 가격도 없는 상태에서 「원가를 입력하세요」는
 *    순서가 틀린 요구다(그때의 결론은 `marketDecisionLines` 가 이미 말한다).
 */
export const NEXT_STEP_HEADING = "🧾 현재 판단";
export const COST_REQUIRED_NOTE =
  "수익성 판단 보류 — 매입 원가를 입력하면 위 시장가격을 기준으로 예상 수익을 계산합니다.";
/** 🔴🔴 **이 줄이 「실패로 보이는 것」을 막는다.** 지우면 UNKNOWN 이 다시 실패로 읽힌다. */
export const COST_REQUIRED_SCOPE =
  "시장가격을 찾지 못한 것이 아닙니다 — 원가가 아직 없어서 수익 계산만 남은 상태입니다.";

/** 🟢 가격이 있고 원가가 없을 때만 두 줄. 그 외에는 **빈 배열**(칸을 만들지 않는다). */
export function nextStepLines(
  hasMarketPrice: boolean,
  costPriceKrw?: number | null,
): string[] {
  if (!hasMarketPrice) return [];
  if (costPriceKrw != null) return [];
  return [COST_REQUIRED_NOTE, COST_REQUIRED_SCOPE];
}
