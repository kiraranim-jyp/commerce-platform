/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-CANDIDATE-PRICE-EVIDENCE-020 §4 — 후보 가격이 «어느 시장» 의 가격인가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WU-019R 이 찾은 사실에서 출발한다:
 *
 * ```
 * ComparisonCandidate 에 market/country/locale 칸이 **0개** 다(types.ts grep).
 * → 해외 가격을 MI 에 넣으려 하면 그때마다 시장을 «추측» 하게 된다.
 * ```
 *
 * 🔴🔴 **그래서 새 국가 판정 시스템을 만들지 않았다.** 이 파일은 순수 함수 하나이고
 *    규칙은 **증거 둘의 교차** 뿐이다 — 도메인 증거 × 통화 증거.
 *
 * ── 🔴 CPO 가 명시한 두 금지가 규칙의 뼈대다 (WU-020 §4) ───────────────────
 * ```
 * ❌ 「currency 만으로」 시장을 결정한다
 *      → KRW 인데 KR 도메인 증거가 없으면 **UNKNOWN** 이다
 * ❌ 「등록부에 있음 + EUR」 을 국내로 넣는다  ·  「bobochoses + EUR」 을 해외로 단정한다
 *      → **둘 다 금지.** 등록부 소속과 외화가 **동시에** 관찰되면 그것은 **충돌** 이고
 *        UNKNOWN 으로 남긴다. 실측 근거: `bobochoses.com` 이 국내 등록부에
 *        「Bobo Choses Korea(공식)」로 등록돼 있는데 가격 증거가 **EUR** 였다.
 * ```
 *
 * 🔴 **등록부 소속은 「시장 증거」가 아니다.** 위 실측이 그것을 반증했다 —
 *    등록부는 「우리가 뒤지는 샵인가」이고 「그 샵이 한국 시장인가」가 아니다.
 *    그래서 이 파일에서 등록부는 **충돌 감지에만** 쓰인다(KR 근거로 쓰지 않는다).
 *
 * 🔴 판정의 «목적» 은 가격 귀속 하나다. 그래서 **통화가 없으면 판정하지 않는다** —
 *    가격이 없는 후보는 귀속시킬 것이 없고, 그때 시장을 적으면 추측이 된다.
 *    (가격 없는 후보 자체는 **버리지 않는다** — WU-020 §6. identity evidence 로 남는다.)
 */

import { hasCompositeKrSellerEvidence, type MarketEvidence } from "@commerce/crawler";

/** 🔴 `KR` 과 `OVERSEAS` 는 «증거가 일치할 때만» 쓴다. 나머지는 전부 UNKNOWN 이다. */
export type CandidateMarket = "KR" | "OVERSEAS" | "UNKNOWN";

export type CandidateMarketBasis =
  /** `.kr`/`.co.kr` 국가 TLD 와 KRW 가 **함께** 관찰됐다. */
  | "KR_TLD_AND_KRW"
  /** 국내 등록부 샵에서 KRW 가 관찰됐다(둘이 일치). */
  | "REGISTERED_SHOP_AND_KRW"
  /**
   * 🔴🔴 CORE-2R-4 STEP 4 — **사이트가 스스로 적은 한국 사업자 증거 «둘 이상» + KRW.**
   *    등록부와 무관하게 성립한다(그것이 이 축을 만든 이유다).
   */
  | "KR_SELLER_EVIDENCE_AND_KRW"
  /** 🔴 한국 사업자 증거 ↔ 외화 **충돌**. 국내로도 해외로도 쓰지 않는다. */
  | "CONFLICT_KR_SELLER_EVIDENCE_WITH_FOREIGN_CURRENCY"
  /** 외화 + KR 도메인 증거 **없음** + 등록부 **밖**. */
  | "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE"
  /** 🔴 등록부 소속 ↔ 외화 **충돌**(Bobo Choses 사례). 국내로도 해외로도 쓰지 않는다. */
  | "CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY"
  /** 🔴 KR TLD ↔ 외화 충돌. */
  | "CONFLICT_KR_TLD_WITH_FOREIGN_CURRENCY"
  /** 🔴 KRW 뿐이고 도메인 증거가 없다 — 통화 단독으로 결정하지 않는다. */
  | "KRW_WITHOUT_DOMAIN_EVIDENCE"
  /** 🔴 가격(통화) 증거 자체가 없다 — 귀속시킬 것이 없어 판정하지 않는다. */
  | "NO_PRICE_EVIDENCE";

export interface CandidateMarketInput {
  /** 후보의 실제 host. */
  domain: string;
  /** 후보 가격의 통화. 가격이 없으면 `null` 이다. */
  currency: string | null;
  /** 그 host 가 국내 판매처 등록부에 있는가. 🔴 KR 근거가 아니라 **충돌 감지용** 이다. */
  isRegisteredDomesticShop: boolean;
  /**
   * 🔴🔴 CORE-2R-4 STEP 3/4 — **그 상품 페이지가 스스로 적은 판매자 사실.**
   *
   * 🔴 안 넘기면(`undefined`) 아래 분기가 **한 줄도 돌지 않는다** — 기존 동작 100% 유지.
   * 🔴 이 칸 하나로 KR 을 만들지 않는다 — **강한 증거 2개 이상 «그리고» KRW** 가
   *    함께일 때만 발화한다(= 사실 셋). CPO 가 금지한 「단독 신호 KR」이 **구조적으로
   *    불가능** 하다.
   */
  marketEvidence?: MarketEvidence | null;
}

export interface CandidateMarketResult {
  market: CandidateMarket;
  basis: CandidateMarketBasis;
}

/** `.kr` 은 국가 TLD 다 — 이것은 실제 시장 증거다(등록부 소속과 다르다). */
function hasKrTld(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  return d === "kr" || d.endsWith(".kr");
}

/**
 * 🔴 **증거가 일치할 때만** KR / OVERSEAS 를 낸다. 충돌·부족은 전부 UNKNOWN 이다.
 * 🔴 순수 함수다 — 네트워크·DB·시각을 보지 않는다.
 */
export function classifyCandidateMarket(input: CandidateMarketInput): CandidateMarketResult {
  const currency = input.currency?.trim().toUpperCase() ?? null;
  const krTld = hasKrTld(input.domain);
  /**
   * 🔴🔴 CORE-2R-4 STEP 4 — **「여러 증거를 종합한다」가 여기 한 줄이다.**
   *    `hasCompositeKrSellerEvidence` 는 **강한 증거 2개 이상** 일 때만 참이고,
   *    아래에서 **통화 증거와 다시 교차** 하므로 KR 확정에는 **사실 셋** 이 필요하다.
   */
  const krSellerEvidence = hasCompositeKrSellerEvidence(input.marketEvidence);

  /** ① 통화가 없으면 **판정하지 않는다.** 가격 귀속이 이 판정의 유일한 목적이다. */
  if (!currency) return { market: "UNKNOWN", basis: "NO_PRICE_EVIDENCE" };

  if (currency === "KRW") {
    /** ② KR 도메인 증거와 KRW 가 **함께** 있을 때만 KR 이다. */
    if (krTld) return { market: "KR", basis: "KR_TLD_AND_KRW" };
    /**
     * 🔴🔴 ②-b CORE-2R-4 — **등록부 «앞» 에 둔다.** CPO 지시가 「`domestic_price_sources`
     *    를 국내 판정의 **권위 있는 근거로 쓰지 않는다**」이므로, 사이트가 스스로 적은
     *    증거가 있으면 **그것이 판정의 이유** 여야 한다(`basis` 가 그 사실을 말한다).
     * 🟢 등록부 분기는 **지우지 않았다**(아래 ②-c) — 증거가 없는 기존 후보의 동작이
     *    한 글자도 바뀌지 않게 하기 위해서다(CPO: DB 행도 삭제하지 않는다).
     */
    if (krSellerEvidence) return { market: "KR", basis: "KR_SELLER_EVIDENCE_AND_KRW" };
    /** ②-c 기존 경로 — 증거를 못 읽은 후보는 **여기서 그대로** 판정된다. */
    if (input.isRegisteredDomesticShop) return { market: "KR", basis: "REGISTERED_SHOP_AND_KRW" };
    /** 🔴 ③ 통화 단독으로 결정하지 않는다(CPO §4). */
    return { market: "UNKNOWN", basis: "KRW_WITHOUT_DOMAIN_EVIDENCE" };
  }

  /** 🔴 ④ 외화인데 KR 증거가 같이 관찰되면 **충돌** 이다 — 둘 중 하나를 고르지 않는다. */
  if (input.isRegisteredDomesticShop) {
    return { market: "UNKNOWN", basis: "CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY" };
  }
  if (krTld) return { market: "UNKNOWN", basis: "CONFLICT_KR_TLD_WITH_FOREIGN_CURRENCY" };
  /**
   * 🔴 ④-b CORE-2R-4 — 한국 사업자 증거 + **외화** 도 같은 성질의 충돌이다.
   *    (실측 선례: 등록부 「Bobo Choses Korea(공식)」의 가격 증거가 **EUR** 였다)
   *    🔴 기존 두 충돌 «뒤» 에 둔다 — 기존 후보의 `basis` 를 바꾸지 않기 위해서다.
   */
  if (krSellerEvidence) {
    return { market: "UNKNOWN", basis: "CONFLICT_KR_SELLER_EVIDENCE_WITH_FOREIGN_CURRENCY" };
  }

  /** ⑤ 외화 + KR 증거 없음 → 해외. */
  return { market: "OVERSEAS", basis: "FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE" };
}

/* ══════════════════════════════════════════════════════════════════════════
 * §5/§6 — 해외 가격의 «읽는 쪽»
 * ══════════════════════════════════════════════════════════════════════════
 *
 * WU-019R 이 찾은 둘째 공백은 「해외 가격을 담을 축이 없다」였고, 그 WU 가 동시에
 * 확인한 사실이 **「새 source 로 저장만 하면 한 원도 움직이지 않는다 — 읽는 쪽이
 * 없기 때문」** 이다(리포 기존 테스트 `overseas-observation-storage-impact.test.ts`).
 *
 * 🔴 그래서 이 함수가 그 **읽는 쪽** 이다. 단 범위를 좁게 고정한다:
 * ```
 * ❌ 환율 변환 · KRW 환산 · 배송비 · 세금 · variant 최적화 (§2 에서 전부 제외)
 * ❌ 기존 국내/원가 집계에 섞기 (§5 — 오염 금지)
 * ❌ DB 저장 (§11 — schema 변경 0)
 * 🟢 **통화별로 세고, 통화별 최저가만 낸다.** 서로 다른 통화를 더하지 않는다.
 * ```
 */
export interface CandidateOverseasPriceRecord {
  market: string;
  currency: string;
  amount: number | null;
  priceTier: string;
}

export interface CandidateOverseasPriceSummary {
  /** 가격 증거가 있는 해외/UNKNOWN 후보 수. */
  count: number;
  /** 🔴 통화를 **섞지 않는다** — 통화별로 갈라 센다. */
  byCurrency: Record<string, { count: number; lowestAmount: number }>;
  /** 🔴 시장 판정 분포 — `UNKNOWN` 을 해외로 합치지 않는다. */
  byMarket: Record<string, number>;
  /** 🟢 동일상품 축(EXACT/COMPARISON)과 참고 축을 가른다 — 승격이 아니라 분류다. */
  byPriceTier: Record<string, number>;
}

export function summarizeCandidateOverseasPrices(
  records: CandidateOverseasPriceRecord[],
): CandidateOverseasPriceSummary {
  const byCurrency: Record<string, { count: number; lowestAmount: number }> = {};
  const byMarket: Record<string, number> = {};
  const byPriceTier: Record<string, number> = {};
  for (const r of records) {
    byMarket[r.market] = (byMarket[r.market] ?? 0) + 1;
    byPriceTier[r.priceTier] = (byPriceTier[r.priceTier] ?? 0) + 1;
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴 WU-062(CPO 승인 2026-10-18) — **「동일상품 아님」은 동일상품 금액이 아니다.**
     * ══════════════════════════════════════════════════════════════════════
     *
     * 이 집계의 소비처 제목이 **「해외 동일상품 참고가격」** 인데, `EXCLUDED`
     * (= 화면 라벨 「동일상품 아님」) 후보의 금액이 **최저가가 될 수 있었다.**
     * 실측(WU-061): EUR 최저 **9 → 40**(4.4배) · USD **12 → 98**(8.2배) ·
     * GT 51 의 `EXCLUDED` 비중 **8/51 = 15.7%**.
     *
     * 🔴 **관측을 지우는 것이 아니다.** 바로 위 두 줄(`byMarket`·`byPriceTier`)이
     *    **먼저** 세어졌으므로 「동일상품 아님 N건」 표시는 **그대로 남는다**.
     *    여기서 빠지는 것은 **금액 집계(`byCurrency`)** 하나이고, 입력 배열도
     *    반환 `count: records.length` 도 건드리지 않는다.
     *
     * 🟢 **국내 축은 영향이 없다.** 같은 함수를 국내도 쓰지만 국내 레코드는 적재
     *    시점에 이미 `EXACT | COMPARISON` 둘뿐이다(`market-intelligence.ts`) —
     *    즉 이 분기는 국내 입력에서 **발화하지 않는다**(테스트로 잠갔다).
     *
     * 🔴 `REFERENCE` 는 **빼지 않는다.** CPO 가 `EXCLUDED` 하나만 승인했고,
     *    `REFERENCE`(참고)는 「다른 상품이라고 관측된 것」이 아니다.
     */
    if (r.priceTier === "EXCLUDED") continue;
    if (r.amount == null || !Number.isFinite(r.amount)) continue;
    const bucket = byCurrency[r.currency];
    if (!bucket) byCurrency[r.currency] = { count: 1, lowestAmount: r.amount };
    else {
      bucket.count += 1;
      if (r.amount < bucket.lowestAmount) bucket.lowestAmount = r.amount;
    }
  }
  return { count: records.length, byCurrency, byMarket, byPriceTier };
}
