/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-01 — **검색 비용 상한 게이트 + 사용 원장**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일은 Gemini 를 채택하지 않는다.** Search Provider 는 **미정** 이고,
 *    여기 있는 것은 「돈을 쓰기 전에 잠가 두는 장치」뿐이다. HTTP **0** · 순수 함수.
 *
 * ── 🔴🔴 왜 「API 호출 1회 제한」으로는 부족한가 (CPO 지적 · 공식 문서 일치) ──
 * ```
 * Gemini 의 Google Search grounding 은 **검색 «쿼리» 단위로 과금** 된다.
 * 그런데 **한 번의 API 요청이 내부적으로 여러 검색 쿼리를 스스로 만든다.**
 *   실측(이 저장소) — 호출 1회 → `webSearchQueries` **6개**(probe · 2026-10-13)
 *                     호출 8회 → 평균 **5.5 쿼리/호출**(WU-011)
 * ⟹ 🔴 `maxQueries: 1` 로 **우리 쪽 쿼리** 를 1개로 묶어도 **과금 단위는 1 이 아니다**.
 * ⟹ 🔴 그래서 상한을 **「호출 수」가 아니라 «검색 쿼리 수»** 로 건다.
 * 🟢 이것이 과거 「몇 번 안 했는데 왜 ₩21,700?」의 구조적 원인이다(WU-012/013).
 * ```
 *
 * 🔴 **요금은 «관측값이 아니라 설정» 이다.** 아래 숫자는 CPO 가 확인한 공개 가격이고,
 *    바뀌면 **여기 한 곳만** 고친다. 🔴 실제 청구액의 ground truth 는 **Billing** 이다 —
 *    이 모듈의 산출은 **추정치** 이고 그렇게 이름 붙인다(`estimated…`).
 */

/** 🔴 CPO 확인(2026-10-27) — 월 5,000 쿼리 무료 · 이후 1,000 쿼리당 $14. */
export const GROUNDING_PRICING = {
  freeQueriesPerMonth: 5_000,
  usdPerThousandQueries: 14,
} as const;

/**
 * 🔴 **실험 기본 상한.** PHASE 1 은 상품 5~10개짜리 실험이므로 **아주 작게** 잡는다.
 *    🔴 늘리는 쪽은 **호출부가 명시** 해야 한다(기본값이 조용히 커지지 않게).
 */
export const EXPERIMENT_CAPS = {
  /** 상품 1개당 API 호출. */
  maxCallsPerProduct: 1,
  /** 상품 1개당 **우리가 만드는** 쿼리. 🔴 내부 확장은 이것으로 막히지 않는다. */
  maxPlannedQueriesPerProduct: 1,
  /**
   * 🔴🔴 **실험 전체에서 허용하는 «검색 쿼리» 총량.** 내부 확장까지 포함한 숫자다.
   *    실측 5.5~6 쿼리/호출 × 10 상품 ≈ 60 ⟹ 100 이면 10상품 실험을 덮고도 남는다.
   */
  maxGroundingQueriesPerRun: 100,
  /** 상품 1개에서 받아들이는 후보 URL 상한(출력을 극단적으로 줄인다). */
  maxCandidateUrlsPerProduct: 10,
} as const;

export interface SearchUsageRow {
  productId: string;
  /** 🔴 우리가 **보낸** 질의. 지어내지 않는다. */
  query: string;
  apiCalls: number;
  /** 🔴🔴 **과금 단위** — 응답의 `groundingMetadata.webSearchQueries.length` 합. */
  searchQueries: number;
  /** 🔴 실제 검색어 문자열. 개수만 세면 「무엇이 확장을 불렀는가」를 못 본다. */
  searchQueryTexts: string[];
  inputTokens: number;
  outputTokens: number;
  candidateUrlCount: number;
  /** 🔴 **추정치다.** ground truth 는 Billing 이다. */
  estimatedUsd: number;
}

/**
 * 🔴 **무료 구간을 넘은 쿼리만** 과금된다. 그래서 「이번에 쓴 쿼리 수」가 아니라
 *    **「이번 달 누적이 어디에 있는가」** 를 같이 넣어야 추정이 맞는다.
 */
export function estimateGroundingCostUsd(usedThisMonth: number, newQueries: number): number {
  if (newQueries <= 0) return 0;
  const free = GROUNDING_PRICING.freeQueriesPerMonth;
  const billableBefore = Math.max(0, usedThisMonth - free);
  const billableAfter = Math.max(0, usedThisMonth + newQueries - free);
  const billable = billableAfter - billableBefore;
  return (billable / 1000) * GROUNDING_PRICING.usdPerThousandQueries;
}

export type BudgetDecision =
  | { allowed: true }
  | { allowed: false; reason: string; code: "RUN_QUERY_CAP" | "PRODUCT_CALL_CAP" };

export interface BudgetState {
  /** 이번 실행에서 **지금까지 발생한** 검색 쿼리 수(원장 합계). */
  groundingQueriesSoFar: number;
  /** 이 상품에 대해 이미 보낸 호출 수. */
  callsForThisProduct: number;
  /** 🔴 실측 평균으로 **다음 호출이 쓸 쿼리** 를 «보수적으로» 예상한다. */
  expectedQueriesPerCall?: number;
  caps?: Partial<typeof EXPERIMENT_CAPS>;
}

/**
 * 🔴🔴 **호출 «전» 에 묻는다.** 사후 집계만 하면 이미 돈이 나간 뒤다 —
 *    그것이 과거에 일어난 일이다.
 *
 * 🔴 예상 쿼리 수는 **보수적으로** 잡는다(실측 5.5~6 ⟹ 기본 6).
 *    모르는 값을 1 로 가정하면 상한이 **구조적으로 뚫린다**.
 */
export function checkSearchBudget(state: BudgetState): BudgetDecision {
  const caps = { ...EXPERIMENT_CAPS, ...state.caps };
  if (state.callsForThisProduct >= caps.maxCallsPerProduct) {
    return {
      allowed: false,
      code: "PRODUCT_CALL_CAP",
      reason: `상품당 호출 상한 ${caps.maxCallsPerProduct} 에 도달했습니다`,
    };
  }
  const expected = Math.max(1, state.expectedQueriesPerCall ?? 6);
  if (state.groundingQueriesSoFar + expected > caps.maxGroundingQueriesPerRun) {
    return {
      allowed: false,
      code: "RUN_QUERY_CAP",
      reason:
        `실행 전체 검색 쿼리 상한 ${caps.maxGroundingQueriesPerRun} 을 넘습니다` +
        ` (누적 ${state.groundingQueriesSoFar} + 예상 ${expected})`,
    };
  }
  return { allowed: true };
}

/** 🔴 URL 출력은 **상한으로 자른다** — 모델이 많이 주면 그만큼 우리가 crawl 한다. */
export function capCandidateUrls(urls: readonly string[], max = EXPERIMENT_CAPS.maxCandidateUrlsPerProduct): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    /** 🔴 http(s) 만 — 모델이 설명문을 섞어 보내도 URL 이 아닌 것은 버린다. */
    if (!/^https?:\/\//i.test(u)) continue;
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

export interface LedgerSummary {
  products: number;
  apiCalls: number;
  searchQueries: number;
  /** 🔴 호출당 평균 쿼리 — 「1 call = 1 query」가 **거짓** 임을 숫자로 남긴다. */
  queriesPerCall: number;
  candidateUrls: number;
  estimatedUsd: number;
}

export function summarizeLedger(rows: readonly SearchUsageRow[]): LedgerSummary {
  const apiCalls = rows.reduce((s, r) => s + r.apiCalls, 0);
  const searchQueries = rows.reduce((s, r) => s + r.searchQueries, 0);
  return {
    products: new Set(rows.map((r) => r.productId)).size,
    apiCalls,
    searchQueries,
    queriesPerCall: apiCalls === 0 ? 0 : Number((searchQueries / apiCalls).toFixed(2)),
    candidateUrls: rows.reduce((s, r) => s + r.candidateUrlCount, 0),
    estimatedUsd: Number(rows.reduce((s, r) => s + r.estimatedUsd, 0).toFixed(4)),
  };
}
