/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SMALLABLE-LOCAL-CURRENCY-FOLLOWUP — **「현지통화인가 사이트 환산인가」의 기준**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **`a0b3c08`(CPO CLOSED 2026-11-07)을 재조사하지 않는다.** 그 WU 가 Smallable 에
 *    대해 내린 판정은 **사실로 취급** 한다 — JP 는 EUR 이고 `?currency=` 는 **표시 계층** 이다.
 * 🟢 이 모듈은 그 WU 가 **한 상품의 격자에 손으로 적용한 방법** 을 **재사용 가능한 기준** 으로
 *    옮긴 것이다(CPO 「한 사이트의 예외 처리가 목적이 아니다 — 기준을 확보하는 작업이다」).
 *
 * ── 🔴 방법: **단일 환율 구간 교집합**(편차 임계값이 아니다) ──────────────────
 * ```
 * 통화쌍 (a,b) 마다, 관측 하나가 허용하는 환율 구간은 — 🔴 **분자와 분모 둘 다** 반올림된다
 *     [ (x − ux/2) / (y + uy/2) , (x + ux/2) / (y − uy/2) ]      x=a 금액 · y=b 금액
 * 그 구간들의 **교집합이 비어 있지 않으면** → 하나의 환율이 전부를 설명한다 → **SITE_FX**
 *                **비어 있으면**           → 환율로 설명되지 않는다   → **LOCAL_CURRENCY**
 * ```
 * 🔴🔴 **편차 임계값(`spread < 0.5%`)을 쓰지 않는다.** 그것이 `a0b3c08` 에서 USD 를
 *    「시장별 독립」으로 **오판** 하게 만든 그 계산이다(정수 반올림 통화의 ±0.5 단위 잡음).
 *    🟢 그 오판은 그 WU 의 계약 `C-2` 가 기록으로 남겼고, 이 모듈은 **그 교훈의 구현** 이다.
 *
 * ── 🔴 「확인 불가」와 「수집 실패」를 가른다(CPO §3) ──────────────────────────
 * ```
 * INSUFFICIENT  통화가 하나뿐 / 비교 가능한 관측이 부족하다   = **확인 불가**
 * (수집 실패)    가격·통화 칸이 비어 있다                      = 이 모듈의 입력이 **아니다**
 * ⟹ 🔴 둘을 같은 칸에 적지 않는다. 「확인 불가」를 「실패」로도, 「현지통화 없음」으로도 쓰지 않는다.
 * ```
 *
 * 🔴 **운영 모듈이 아니다** — `__tests__` 아래에 둔다(측정·계약 전용 · 운영 surface 0).
 *    🔴 수집 정책·통화 정책·판정 로직을 **바꾸지 않는다**.
 */

/** 🔴 한 관측 = (상품, 시장, 통화, 금액). 🔴 금액/통화가 없으면 **입력이 아니다**. */
export interface MarketCurrencyObservation {
  groupKey: string;
  market: string;
  currency: string;
  amount: number;
}

export type MarketCurrencyVerdict = "SITE_FX" | "LOCAL_CURRENCY" | "INSUFFICIENT";

export interface MarketCurrencyEvidence {
  verdict: MarketCurrencyVerdict;
  /** 비교에 쓰인 통화 집합(정렬). */
  currencies: string[];
  /** 🔴 **쌍별 결과** — 어느 통화쌍이 환율로 설명되는지 적는다(합치지 않는다). */
  pairs: Array<{
    pair: [string, string];
    /** 같은 상품에서 두 통화가 함께 관측된 수. 🔴 2 미만이면 판정 불가다. */
    samples: number;
    explainedBySingleRate: boolean | null;
  }>;
  /** 🔴 왜 INSUFFICIENT 인지 — 「없다」로 적지 않는다. */
  reason: string | null;
}

/**
 * 🔴 통화의 **반올림 단위** — 금액이 정수면 1, 소수면 0.01 로 본다.
 *    🟢 `a0b3c08` 의 그 식과 같다(통화 코드 표를 새로 만들지 않는다 · 관측값에서 읽는다).
 */
const unitOf = (amount: number): number => (Number.isInteger(amount) ? 1 : 0.01);

/**
 * 🔵 **같은 상품 안에서** 두 통화가 함께 관측된 쌍을 모아 환율 구간을 교집합한다.
 *
 * 🔴 **상품을 가로질러 금액을 섞지 않는다** — 다른 상품은 가격이 다르므로 비율만 비교한다.
 * 🔴 표본이 **2개 미만** 이면 `null`(판정 불가) 이다 — 관측 하나는 **어떤 환율로도** 설명되므로
 *    그것으로 「사이트 환산」이라 적으면 거짓이다(1식 1미지수).
 */
function explainedBySingleRate(
  rows: readonly MarketCurrencyObservation[],
  a: string,
  b: string,
): { samples: number; explained: boolean | null } {
  const byProduct = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byProduct.get(r.groupKey) ?? new Map<string, number>();
    /** 🔴 같은 (상품, 통화)가 여러 시장에서 오면 **최저** 하나로 접는다(임의 선택 금지). */
    const prev = m.get(r.currency);
    if (prev == null || r.amount < prev) m.set(r.currency, r.amount);
    byProduct.set(r.groupKey, m);
  }
  let lo = -Infinity;
  let hi = Infinity;
  let samples = 0;
  for (const m of byProduct.values()) {
    const x = m.get(a);
    const y = m.get(b);
    if (x == null || y == null || !(y > 0)) continue;
    samples += 1;
    /**
     * 🔴🔴 **1차에 분모의 반올림을 빼먹었고 그것이 닫힌 판정을 재현하지 못했다.**
     *    `JPY/USD` 처럼 **둘 다 반올림된** 쌍에서 구간이 거짓으로 비었다
     *    (JP 159.97 · KR 160.44 · US 159.55 ⟹ 「현지통화」로 오판).
     * 🟢 분모의 ±u/2 를 넣으면 교집합이 성립한다(159.03~160.85) — EUR 축만 보던
     *    `a0b3c08` 의 두 쌍과 **같은 답** 이 되고, 쌍을 더 봐도 틀리지 않는다.
     */
    const ux = unitOf(x);
    const uy = unitOf(y);
    lo = Math.max(lo, (x - ux / 2) / (y + uy / 2));
    hi = Math.min(hi, (x + ux / 2) / (y - uy / 2));
  }
  if (samples < 2) return { samples, explained: null };
  return { samples, explained: lo <= hi };
}

/**
 * 🔵🔵 **기준 하나.** 🔴 「통화가 여러 개다 ⟹ 현지통화다」로 판정하지 않는다 —
 *    그것이 이 기준이 막는 추론이다(사이트가 환산해서 여러 통화를 보여줄 수 있다).
 */
export function classifyMarketCurrencyEvidence(
  rows: readonly MarketCurrencyObservation[],
): MarketCurrencyEvidence {
  const usable = rows.filter((r) => Number.isFinite(r.amount) && r.amount > 0 && r.currency !== "");
  const currencies = [...new Set(usable.map((r) => r.currency))].sort();
  if (currencies.length < 2) {
    return {
      verdict: "INSUFFICIENT",
      currencies,
      pairs: [],
      reason:
        currencies.length === 0
          ? "비교 가능한 관측이 없다(가격·통화가 있는 행이 0)"
          : "통화가 하나뿐이라 환율로 설명되는지 판정할 수 없다",
    };
  }
  const pairs: MarketCurrencyEvidence["pairs"] = [];
  for (let i = 0; i < currencies.length; i += 1) {
    for (let j = i + 1; j < currencies.length; j += 1) {
      const a = currencies[i]!;
      const b = currencies[j]!;
      const { samples, explained } = explainedBySingleRate(usable, a, b);
      pairs.push({ pair: [a, b], samples, explainedBySingleRate: explained });
    }
  }
  const judged = pairs.filter((p) => p.explainedBySingleRate != null);
  if (judged.length === 0) {
    return {
      verdict: "INSUFFICIENT",
      currencies,
      pairs,
      /** 🔴 **상품 하나로는 판정할 수 없다** — 비율 하나는 어떤 환율로도 설명된다. */
      reason: "같은 상품에서 두 통화가 함께 관측된 쌍이 2개 미만이다(상품 1개로는 판정 불가)",
    };
  }
  /**
   * 🔴 **하나라도 환율로 설명되지 않으면 그 판매처는 현지 가격을 낸다** — 쌍 전부가
   *    설명될 때만 「사이트 환산」이다(약한 쪽으로 단정하지 않는다).
   */
  const allExplained = judged.every((p) => p.explainedBySingleRate === true);
  return {
    verdict: allExplained ? "SITE_FX" : "LOCAL_CURRENCY",
    currencies,
    pairs,
    reason: null,
  };
}
