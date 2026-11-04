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
  /**
   * 🔴🔴🔴 CORE-2T §5·§13 — **「판매처 N곳」을 «레코드 수» 로 세지 않기 위한 키.**
   *
   * 🔴 이 칸이 없던 동안 이 집계는 **중복을 구조적으로 막을 수 없었다** — 레코드에
   *    URL 도 도메인도 없어서 「같은 판매처가 두 번 들어왔는가」를 **알 방법이 없었다**.
   *    ⟹ `count` 는 **수집 레코드 수** 였고 「실제 판매처 수」가 아니었다(§5 의 그 혼동).
   * 🟢 **옵셔널이다** — 넘기지 않으면 **동작이 한 글자도 바뀌지 않는다**(해외 축 불변 ·
   *    §9). `highestAmount` 를 CORE-2R-5 가 더한 것과 **같은 모양** 이다.
   * 🔴 국내는 **도메인** 을 넘긴다 — 「판매처」의 단위가 도메인이기 때문이다(§15-3
   *    「실제 unique seller 수」). 같은 판매처가 여러 레코드로 들어오면 **그 판매처의
   *    최저 확인가 하나** 로 접는다(아래 루프).
   * 🔴 **실측 주의** — 현재 transient 경로는 `judgeDomesticCandidate` 가 **샵당 best
   *    1건** 만 sink 에 싣고(WU-109), 러너가 canonical URL 로 생산자 간 중복을 이미
   *    막는다(`ALREADY_CANDIDATE`). ⟹ 🟢 **B226AC009 실측에서 이 가드의 효과는 0**
   *    이다(후보 2건 · 고유 URL 2건). 그래도 두는 이유는 **그 둘 중 하나라도 바뀌면
   *    「판매처 수」가 조용히 틀려지기** 때문이다(계약이 D1·D3 로 잠근다).
   */
  sellerKey?: string | null;
  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 SPRINT 3 P1 — **「유사상품」의 가격은 «동일상품 최저 확인가» 가 아니다**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **실측이 먼저다**(CPO 5단계 ①②③ · 2026-11-02). B226AC010 을 운영 함수로 돌려
   *    집계 진입 **15건** 의 구성을 읽었다:
   *    ```
   *    verdict  PRESUMED_SAME 9 · SAME 5 · **SIMILAR 1**
   *    tier     COMPARISON 9 · EXACT 5 · **REFERENCE 1**
   *    🔴 그 SIMILAR 1건(`milanik.tw` TWD 2,980)이 **TWD 최저 확인가** 였다
   *    ```
   *    ⟹ 🔴 `EXCLUDED` 만 걸러서는 **「⚪ 유사상품」 가격이 최저가** 가 된다.
   *       (CEO 가 B226AC043 에서 본 `CAD 26,300` 과 **같은 자리** 다)
   *
   * 🟢 **새 판정을 만들지 않는다** — `crossSellerVerdict` 는 **이미 계산된 값** 이고
   *    생산자가 `GeminiTransientEvidence.crossSellerVerdict` 로 들고 있다(run-domestic:339).
   *
   * 🔴🔴 **옵셔널이다 — 넘기지 않으면 동작이 한 글자도 바뀌지 않는다.**
   *    그래서 **국내 축이 회귀하지 않는다**(국내 레코드는 이 칸을 넘기지 않는다 · CPO ④).
   *    `sellerKey`·`highestAmount` 가 추가된 것과 **같은 모양** 이다.
   * 🔴 **`SAME` 만으로 좁히지 않는다** — `PRESUMED_SAME` 은 제품 정책이 **허용** 하고,
   *    `AGE-LINE-POLICY-01`(AB↔AC 연령 라인)이 **의도적으로** 그 등급으로 보류시킨다
   *    ⟹ 좁히면 CPO 가 열어 둔 recall 을 닫는다(「국내가 1 → 0」 선례와 같은 성질).
   */
  verdict?: string | null;
  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 STAGE 7-1(CPO 승인 · 실행 우선순위 1) — **확인되지 않은 가격은 «확인가» 가 아니다**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **실측이 먼저다**(FINAL-MARKET-COMPARISON-REVIEW §7~§9 · 스냅샷 `6cf3e50e`):
   * ```
   * 화면이 🌎 `CAD 370 ~ 19,100`(**51배**)을 냈고 그 안에 「**Diesel Viker Jeans**」
   * (다른 브랜드)가 있었다 · `USD 22,200`(통화 오인 의심) · 7건 중 **6건이
   * `UNVERIFIED_SEARCH`** 이고, 유일한 `VERIFIED_CURRENT`(junioredition GBP 75)가
   * **유일하게 원상품과 제목이 일치** 했다.
   * ```
   * ⟹ 🔴 **「검색 결과에서 주워 온 숫자」와 「상세 페이지에서 확인한 가격」을 한 범위로
   *    합치면 안 된다.** 그것이 CPO ① 「£21.20 과 £37 을 합치지 말라」와 같은 뿌리다.
   *
   * 🟢 **선례가 WU-062 다** — 「금액(`byCurrency`)에서만 뺀다 · `count`/`byMarket`/
   *    `byPriceTier` 는 **관측으로 유지**」. 후보는 **하나도 숨기지 않는다**(CPO 명시).
   *
   * 🔴🔴 **옵셔널이다 — 넘기지 않으면 동작이 한 글자도 바뀌지 않는다**(`sellerKey`·
   *    `highestAmount`·`verdict` 가 추가된 것과 **같은 모양**).
   * 🔴🔴 **`null` 은 막지 않는다.** `derivePriceStatus`(match.ts:568)는 `VERIFIED_CURRENT`
   *    또는 `UNVERIFIED_SEARCH` **둘만** 낸다 ⟹ `null` 은 **낡은 저장분의 artifact** 이고
   *    (DB 실측 경계: `10-20~11-01 null 104` → `11-02~03 null 0 · 채워짐 37`),
   *    막으면 **기존 후보가 조용히 사라진다**(이 파일의 기존 원칙).
   */
  priceStatus?: string | null;
  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 STAGE 7-2(CPO 승인 · 실행 우선순위 2) — **노출 등급 ↔ 가격 «자격» 분리**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 CPO 과제 원문: 「`PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON` 경로가
   *    **DIFFERENT 사례를 금액 집계로 유입** 시키는 문제를 해결하라. 🔴 후보를
   *    **숨겨서** 해결하지 말고 **노출은 유지하고 가격의 의미와 집계 자격을 분리** 하라.」
   *
   * 🟢🟢 **새 축을 만들지 않았다.** 쓰는 술어는 **이미 있는 `hasObservedDifference`** 다 —
   *    「양쪽에서 **서로 다른 값을 읽었다**」와 「**읽지 못했다**」를 가르는 owner 이고,
   *    `BRAND_UNCONFIRMED` 를 **의도적으로 제외** 한다(「모르는 것을 반증으로 쓰지 않는다」).
   *    🔴 그 분류표(`OBSERVED_DIFFERENCE_BLOCKERS`)를 **한 글자도 고치지 않았다** — Identity 정책이다.
   *
   * 🔴 **반사실을 먼저 쟀다**(저장 GT 33쌍 · `stage7-2-price-eligibility-cf.test.ts`):
   * ```
   * 현행   사람 SAME 12/18 진입 · 🔴 사람 DIFFERENT 6/9 진입   정밀도 12/18
   * 적용후 사람 SAME 11/18 진입 · 🟢 사람 DIFFERENT 4/9 진입   정밀도 **11/15**
   * 바뀌는 행 3 — 🟢 C19·C20(human DIFFERENT) 차단 · 🔴 S1-4(human SAME) 손실 1
   *   🔵 그 손실의 사유는 `FIT`(`relaxed fit` ↔ `loose fit`)이고 **CPO 우선순위 4
   *      (FIT 동의어 정규화)가 그것을 되돌린다** ⟹ 두 작업은 연결돼 있다
   * ```
   * 🔴🔴 **옵셔널이다 — 넘기지 않으면 동작이 한 글자도 바뀌지 않는다.**
   * 🔴 **tier·verdict·Identity 판정은 불변** 이다 — 바뀌는 것은 **«금액 자격» 하나** 다.
   */
  blockers?: readonly string[] | null;
}

/**
 * 🟢 **1차 가격 판단에 쓸 수 있는 verdict**(제품 정책 · CPO 확정 2026-11-02).
 * 🔴 집합을 넓히거나 좁히는 것은 **제품 정책 변경** 이다 — 코드에서 임의로 고치지 않는다.
 */
const PRICE_ELIGIBLE_VERDICTS = new Set(["SAME", "PRESUMED_SAME"]);

/**
 * 🟢 **확인가의 단일 술어**(STAGE 7-1). 🔴 owner 는 `derivePriceStatus` 이고 이 파일은
 *    그 값을 **읽기만** 한다 — 가격 신뢰도를 여기서 다시 판정하지 않는다.
 */
const PRICE_VERIFIED_STATUS = "VERIFIED_CURRENT";

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-2 — **동일상품 «금액» 자격을 잃는 보류: 「상대가 스스로 다르다고 말한」 셋**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **이것은 가격 정책이다. Identity 정책이 아니다.** 그래서 Identity 파일
 *    (`cross-seller.ts`)이 아니라 **가격 쪽** 에 둔다 — 거기에 두면 「Identity 가
 *    이 축으로 판정한다」로 읽힌다.
 * 🟢 그래도 **느슨해질 수 없다** — 계약이 이 집합이 `OBSERVED_DIFFERENCE_BLOCKER_LIST`
 *    의 **부분집합** 임을 단언한다(Identity 가 「관측된 차이」로 인정하지 않는 것을
 *    가격이 혼자 차이로 쓰는 일이 **구조적으로 불가능**).
 *
 * ── 🔴 왜 `hasObservedDifference` «전체» 를 쓰지 않는가 — 반사실로 갈랐다 ───────
 * ```
 * 저장 GT 33쌍 · 금액 자격                      정밀도        재현
 *   현행                                      12/18 (66.7%)  12/18
 *   A 전체(hasObservedDifference)              11/15 (73.3%)  🔴 11/18  ← 손실 1
 *   B 이 집합                                  **12/16 (75.0%)**  🟢 **12/18**  ← 손실 0
 * ⟹ 🟢 **B 가 A 를 두 축에서 모두 이긴다.** 막는 것은 같고(C19·C20 · human DIFFERENT)
 *    잃는 것만 없다(A 는 `FIT` 로 S1-4 human SAME 을 잃었다).
 * ```
 * 🔴 운영 실측도 같은 방향이다 — A 는 **같은 브랜드·같은 제목** 후보를 떨어뜨렸다:
 * ```
 * B226AC033 junioredition 「Bobo Choses Pop Sweatshirt by Bobo Choses」 GBP 58
 *           VERIFIED_CURRENT · 보류 **[MATERIAL]** 하나
 * B226AC110 junioredition 「Bobo Choses Embossed T-Shirt by Bobo Choses」 GBP 37
 *           VERIFIED_CURRENT · 보류 **[MODEL_CODE_AGE_LINE]**
 *           🔴 그 축(AC↔AB)은 **CEO 가 SAME 이라 라벨한** 축이고 **CPO ③ 가 현행 유지** 다
 * ```
 * 🔴 그래서 **표기·정규화·정책 축은 넣지 않았다** — `MATERIAL`·`FIT`·`SIZE_SYSTEM`
 *    (CPO ④ 동의어 정규화 대상) · `GARMENT_FORM`·`AUDIENCE_LINE`(CPO ⑥ 보류) ·
 *    `MODEL_CODE_AGE_LINE`(CPO ③ 현행 유지).
 * 🔴 **집합을 넓히거나 좁히는 것은 제품 정책 변경** 이다 — 코드에서 임의로 고치지 않는다.
 */
const PRICE_DISQUALIFYING_BLOCKERS: ReadonlySet<string> = new Set([
  /** 브랜드를 **읽었고 서로 달랐다**(「확인 못 했다」가 아니다). */
  "BRAND_MISMATCH",
  /** 제목이 **하나도 겹치지 않는다** — 겹침이 「없다」는 관측이다. */
  "NO_TITLE_OVERLAP",
  /** 🔴 **같은 판매처가 서로 다른 두 상품으로 진열했다** — 판매처 스스로의 선언이다. */
  "SAME_SELLER_DISTINCT_LISTING",
]);

/** 🟢 계약이 「부분집합인가」를 검사하는 지점(사본 금지). */
export const PRICE_DISQUALIFYING_BLOCKER_LIST: readonly string[] = [...PRICE_DISQUALIFYING_BLOCKERS];

export interface CandidateOverseasPriceSummary {
  /** 가격 증거가 있는 해외/UNKNOWN 후보 수. */
  count: number;
  /**
   * 🔴 통화를 **섞지 않는다** — 통화별로 갈라 센다.
   *
   * 🔴🔴 CORE-2R-5 — `highestAmount` 가 **추가** 됐다(기존 칸은 한 글자도 안 바뀐다).
   *    왜: 국내 참고 가격을 **「₩83,600 ~ ₩92,000」** 처럼 **구간** 으로 말하려면 최고가가
   *    필요한데 지금까지 최저가만 냈다. 🟢 같은 루프에서 세므로 **새 집계 경로 0** 이고,
   *    기존 소비처(해외 최저 확인가)는 이 칸을 **읽지 않으므로 숫자가 안 바뀐다**.
   */
  /**
   * 🔴🔴🔴 CORE-2T — **`count` 의 의미가 «정확해졌다». 칸을 더하지 않았다.**
   *
   * 🔴 1차 구현에서 `sellerCount` 를 **따로 뒀다가 지웠다.** 이 집계는 `sellerKey` 가
   *    오면 **판매처 단위로 먼저 접은 뒤** 세므로 그 둘이 **항상 같았다** ⟹ 같은 것을
   *    가리키는 칸 둘은 언젠가 갈라지고, 그때 화면이 어느 쪽을 믿는지 알 수 없다
   *    (이 저장소가 반복해 막아 온 「owner 둘」 그 모양이다).
   * 🟢 그래서 **칸은 그대로 셋** 이고 `count` 가 이렇게 읽힌다:
   * ```
   * sellerKey 있음(국내)  → **판매처 수**(같은 판매처는 최저 확인가 하나로 접힌 뒤)
   * sellerKey 없음(해외)  → **레코드 수**(접을 근거가 없다 · 기존 동작 그대로 · §9)
   * ```
   */
  byCurrency: Record<string, { count: number; lowestAmount: number; highestAmount: number }>;
  /** 🔴 시장 판정 분포 — `UNKNOWN` 을 해외로 합치지 않는다. */
  byMarket: Record<string, number>;
  /** 🟢 동일상품 축(EXACT/COMPARISON)과 참고 축을 가른다 — 승격이 아니라 분류다. */
  byPriceTier: Record<string, number>;
  /**
   * 🔴🔴 STAGE 7-1 — **금액 집계에서 «가격 미확인» 으로 빠진 수.**
   *
   * 🔴 「후보가 사라졌다」가 아니다 — `count`·`byMarket`·`byPriceTier` 는 **그대로** 세고
   *    후보 카드도 그대로 선다. 빠지는 것은 **`byCurrency` 하나** 다.
   * 🔴 그래서 이 수의 의미를 좁게 고정한다 — **「동일상품 가격으로 쓸 자격이 있고
   *    금액도 있는데 그 금액이 확인되지 않은」** 후보다(EXCLUDED·부적격 verdict·
   *    금액 없음은 **이 수에 들어가지 않는다** · 아래 루프 순서가 그것을 보장한다).
   * 🟢 이 칸이 있어야 화면이 **「왜 숫자가 줄었는지」** 를 말할 수 있다.
   */
  unverifiedCount: number;
  /**
   * 🔵🔵 STAGE 7-2 — **「상품 차이가 관측돼」 금액에서 빠진 수.**
   *
   * 🔴 `unverifiedCount`(= 가격을 못 읽었다)와 **다른 사실** 이라 칸을 갈랐다 —
   *    합치면 화면이 「가격을 못 봤다」와 「다른 상품으로 보인다」를 같은 말로 한다.
   * 🔴 후보는 **그대로 보인다** — 빠지는 것은 `byCurrency` 하나다.
   */
  observedDifferenceCount: number;
}

export function summarizeCandidateOverseasPrices(
  records: CandidateOverseasPriceRecord[],
): CandidateOverseasPriceSummary {
  const byCurrency: CandidateOverseasPriceSummary["byCurrency"] = {};
  const byMarket: Record<string, number> = {};
  const byPriceTier: Record<string, number> = {};
  /**
   * 🔴🔴🔴 CORE-2T §5·§13 — **판매처별 「확인가 하나」.**
   *
   * 🔴 같은 판매처가 여러 레코드로 들어오면 **그 판매처의 최저 확인가 하나** 로 접는다.
   *    접지 않으면 ⒜ 「판매처 N곳」이 부풀고 ⒝ **중복 레코드가 형성대를 넓힌다**
   *    (D1 — 같은 URL 2회면 `최저 ~ 최고` 가 **거짓** 이 된다).
   * 🔴 「첫 레코드가 이긴다」로 하지 않는다 — 임의 선택이다. **최저** 가 그 판매처에서
   *    셀러가 실제로 살 수 있는 확인가다(기존 「최저 확인가」 어휘와 같은 방향).
   * 🟢 `sellerKey` 가 **없는** 레코드는 접지 않는다 — 접을 근거가 없고, 그것이
   *    해외 축의 동작을 **한 글자도 바꾸지 않는** 이유다.
   */
  const lowestBySeller = new Map<string, Map<string, number>>();
  /** 🔴 STAGE 7-1 — 금액 집계에서 「가격 미확인」으로 빠진 수(관측용 · 금액에 합치지 않는다). */
  let unverifiedCount = 0;
  /** 🔵 STAGE 7-2 — **관측된 차이** 때문에 금액에서 빠진 수(관측용 · 금액에 합치지 않는다). */
  let observedDifferenceCount = 0;
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
    /**
     * 🔴🔴🔴 SPRINT 3 P1 — **verdict 가 «있으면» 자격을 본다.**
     *
     * 🟢 `undefined` 면 **이 줄이 아무것도 하지 않는다** ⟹ 국내 축·기존 호출부는
     *    동작이 한 글자도 바뀌지 않는다(위 `verdict` 칸 주석의 그 이유).
     * 🔴 `null`(판정을 거친 적이 없다)도 **막지 않는다** — 「모르는 것」으로 가격을
     *    지우면 판정 경로를 타지 않는 기존 후보가 조용히 사라진다(이 파일의 기존 원칙).
     * 🔴 막는 것은 **「SAME 도 PRESUMED_SAME 도 아니라고 «관측된»」** 후보 하나다
     *    (`SIMILAR` · `UNKNOWN` · `CONFLICT`).
     * 🟢 **관측은 지우지 않는다** — `byMarket`·`byPriceTier` 는 위에서 **이미** 세어졌다.
     */
    if (r.verdict != null && !PRICE_ELIGIBLE_VERDICTS.has(r.verdict)) continue;
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔵🔵🔵 STAGE 7-2 — **「관측된 차이」가 있으면 동일상품 금액으로 쓰지 않는다.**
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🟢 집합은 `PRICE_DISQUALIFYING_BLOCKERS`(이 파일 머리) 하나이고 **가격 정책** 이다.
     *    🟢 계약이 그것이 Identity 의 「관측된 차이」 집합의 **부분집합** 임을 단언한다.
     * 🔴 `BRAND_UNCONFIRMED` 는 **없다** ⟹ 「브랜드를 못 읽었다」로 가격을 지우지
     *    않는다(실측: 그 사유의 4건이 **사람 SAME** 이다).
     * 🔴 `MATERIAL`·`FIT`·`MODEL_CODE_AGE_LINE` 도 **없다** — 표기·정규화·정책 축이다.
     * 🔴 **금액 자격만** 좁힌다 — tier·verdict·노출은 **불변** 이다(CPO: 숨기지 말라).
     * 🟢 넘기지 않으면(`undefined`) 이 줄이 **아무것도 하지 않는다**(하위호환).
     */
    if (r.blockers != null && r.blockers.some((b) => PRICE_DISQUALIFYING_BLOCKERS.has(b))) {
      observedDifferenceCount += 1;
      continue;
    }
    if (r.amount == null || !Number.isFinite(r.amount)) continue;
    /**
     * ══════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 STAGE 7-1 — **확인되지 않은 금액을 확인가 집계에 넣지 않는다.**
     * ══════════════════════════════════════════════════════════════════════
     *
     * 🔴 **순서가 의미다.** 이 줄이 `byMarket`·`byPriceTier`(관측) **뒤** 이고
     *    `EXCLUDED`·verdict·금액 유무 **뒤** 다 ⟹ `unverifiedCount` 는
     *    **「자격도 금액도 있는데 확인만 안 된」** 수 하나를 정확히 가리킨다.
     *    (순서를 올리면 「동일상품 아님」까지 「미확인」으로 세어 화면이 거짓을 말한다)
     * 🔴 `null` 은 **막지 않는다**(위 칸 주석 — 낡은 저장분 artifact).
     * 🟢 `priceTierFromLink` 는 **건드리지 않았다** — tier 는 그대로이고 바뀌는 것은
     *    **«금액 자격»** 하나다(= 좁히는 방향 = 가격 안전장치 **강화**).
     */
    if (r.priceStatus != null && r.priceStatus !== PRICE_VERIFIED_STATUS) {
      unverifiedCount += 1;
      continue;
    }
    /**
     * 🔴🔴 CORE-2T — **키가 있으면 판매처 단위로 모은다.** 집계는 루프 뒤에서 한 번에
     *    한다(그래야 「같은 판매처의 두 번째 레코드」가 형성대를 넓히지 못한다).
     */
    const key = r.sellerKey?.trim().toLowerCase();
    if (key) {
      const perSeller = lowestBySeller.get(r.currency) ?? new Map<string, number>();
      const prev = perSeller.get(key);
      if (prev == null || r.amount < prev) perSeller.set(key, r.amount);
      lowestBySeller.set(r.currency, perSeller);
      continue;
    }
    const bucket = byCurrency[r.currency];
    if (!bucket) {
      byCurrency[r.currency] = { count: 1, lowestAmount: r.amount, highestAmount: r.amount };
    } else {
      bucket.count += 1;
      if (r.amount < bucket.lowestAmount) bucket.lowestAmount = r.amount;
      /** 🔴 CORE-2R-5 — 같은 루프에서 센다(새 집계 경로 0 · 환산 0 · 통화 혼합 0). */
      if (r.amount > bucket.highestAmount) bucket.highestAmount = r.amount;
    }
  }
  /**
   * 🔴 **판매처 단위로 접힌 레코드를 통화별로 합친다.** 🔴 통화를 **섞지 않는다**(환산 0).
   * 🟢 그래서 여기서의 `count` 는 **판매처 수** 다 — 「확인 N곳」이 그 값을 읽는다.
   */
  for (const [currency, perSeller] of lowestBySeller) {
    const amounts = [...perSeller.values()];
    if (amounts.length === 0) continue;
    byCurrency[currency] = {
      count: perSeller.size,
      lowestAmount: Math.min(...amounts),
      highestAmount: Math.max(...amounts),
    };
  }
  return {
    count: records.length,
    byCurrency,
    byMarket,
    byPriceTier,
    unverifiedCount,
    observedDifferenceCount,
  };
}
