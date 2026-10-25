/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-049 — **해외 동일상품 «참고가격»** 을 말로 바꾼다 (순수 함수)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **계산하지 않는다.** MI 가 이미 낸 `candidateOverseasPrice`
 *    (`summarizeCandidateOverseasPrices`)를 **문자열로 옮기기만** 한다.
 *    금액을 더하지도, 통화를 환산하지도, 등급을 매기지도 않는다.
 *
 * ── 🔴 지켜야 하는 경계 (CPO WU-049 금지항) ──────────────────────────────
 * ```
 * 환율 환산 0        — 통화별로 **따로** 적는다. 합계 칸이 아예 없다.
 * 국내 SAME 취급 0   — 이 값은 **해외 축** 이고 국내 최저가/판매판정에 들어가지 않는다
 * 승격 0             — `PRESUMED_SAME` 을 EXACT 로 올리지 않는다(분류만 보여 준다)
 * 저장 0             — transient 다. 이 파일은 DB 를 모른다
 * ```
 *
 * 🔴 **왜 필요했나**: MI 는 이 값을 이미 계산하는데 `/check` 응답이 그것을 **싣지
 *    않아서** 화면이 영원히 볼 수 없었다(WU-049 추적). 개별 후보는 WU-028 구역이
 *    이미 통화 그대로 보여 주고 있었고, 빠진 것은 **「참고가격」 한 줄** 이었다.
 */

export interface OverseasPriceSummary {
  count: number;
  /**
   * 🔴 CORE-2R-5 — `highestAmount` 는 **선택** 이다. 서버 집계는 항상 채우지만,
   *    최저가만 들고 있는 기존 fixture/호출부도 그대로 돈다(하위호환).
   */
  /**
   * 🔴 CORE-2T — `count` 는 **집계에 들어간 수** 다. 국내 축은 집계기가 **판매처 단위로
   *    접은 뒤** 세므로 그 값이 **판매처 수** 이고, 해외 축은 레코드 수다(§9 불변).
   *    🟢 그래서 칸을 더하지 않았다 — 같은 것을 가리키는 칸 둘을 만들지 않는다.
   */
  byCurrency: Record<string, { count: number; lowestAmount: number; highestAmount?: number }>;
  byMarket: Record<string, number>;
  byPriceTier: Record<string, number>;
}

/** 🔴 화면 문구는 **여기 하나**만 쓴다 — 두 곳에 적으면 갈라진다. */
/**
 * 🔴🔴 WU-056-R1 — **제목이 기존 카드와 충돌해 CEO 테스트가 FAIL 했다.**
 *
 * 기존 구역이 「**🌐** 글로벌 시장 가격」(price-hierarchy.ts:199)이고, WU-049 가
 * 「**🌐** 해외 참고가격」을 **같은 아이콘** 으로 세웠다. 같은 상품의 같은 `EUR 40` 이
 * 두 구역에 나란히 떠서 셀러가 **한 구역으로 읽었다** — 그러면 옆 카드의
 * `≈ ₩59,960`(저장된 환산값 · 정상)이 **이 구역의 환산** 으로 읽힌다.
 *
 * 🟢 그래서 **제목으로 역할을 가른다**(CPO 확정 ⒜):
 * ```
 * 🌐 글로벌 시장 가격          = 기존 시장가격 + 원화 환산을 포함하는 기존 기능
 * 🧾 해외 동일상품 참고가격     = 이번 MI 가 검증한 **동일상품** 의 해외 «원가격» 참고정보
 * ```
 * 🔴 `krwEquivalent`·환율·`global-market.ts` 는 **한 줄도 건드리지 않았다**(⒝ 미채택).
 */
/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 CORE-2AO ⒝ — **「동일상품」 주장을 제목에서 «뺀다»**(CPO 확정 2026-10-25)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 전 제목은 「해외 **동일상품** 참고가격」이었다. 그런데 이 집계의 분모는
 *    `EXCLUDED` 만 뺀 것이고(WU-062) **`COMPARISON`(유사상품)이 들어간다** —
 *    국내 블록과 **같은 성질** 이다(market-intelligence.ts:318 `EXACT || COMPARISON`).
 * 🟢 그래서 제목에서 그 주장을 **빼는 쪽** 이 정직하다. 「최저 소싱가」는
 *    「확인된 가격 중 가장 낮은 것」이라는 **관측** 이고 동일성 **판정이 아니다**.
 * 🔴 집계·필터·통화 분리·환산 금지는 **한 줄도 바뀌지 않았다** — 바뀐 것은 **이 글자** 뿐이다.
 * 🔴 `wu-056r1` 「구역 제목 상호 비포함」 유지 — 「국내 참고가격」 ↔ 「해외 최저 소싱가」.
 */
export const OVERSEAS_REFERENCE_TITLE = "해외 최저 소싱가";
export const OVERSEAS_REFERENCE_NOTE =
  "해외 판매처에서 확인한 가격입니다 — 원래 통화 그대로이고, 환율로 환산하지 않았습니다.";
/** 🔴🔴 이 구역이 판매판정/국내 최저가에 **들어가지 않는다**는 사실을 화면이 말한다. */
export const OVERSEAS_REFERENCE_SCOPE = "참고용입니다 — 판매판정과 국내 최저가에는 반영되지 않습니다.";

/**
 * 🔴🔴 WU-056 — **국내 축 문구. 해외 문구를 그대로 쓰지 않는다.**
 *
 * 🔴 「판매판정과 국내 최저가에는 반영되지 않습니다」를 **국내에 복사하지 않았다.**
 *    그 문장이 국내에서는 **단정할 수 없다** — POST `/check` 는 transient 를 포함한
 *    `sellerAction` 으로 `price_alerts` 를 갱신한다(check/route.ts:168-183). 화면의
 *    판매판정은 GET 기반이라 바뀌지 않지만, 「영향이 전혀 없다」고 적으면 알림 경로에서
 *    거짓이 된다. 🔴 문구를 **제품 정책 판단 없이** 넓히지 않는다.
 * 🟢 그래서 **확실한 사실만** 적는다 — 저장되지 않고, 새로고침하면 사라진다.
 */
/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2U-A — **이름이 「형성대」에서 「참고가격」으로 «되돌아왔다». 이유를 적는다.**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CORE-2T 가 이 제목을 **「국내 가격 형성대」** 로 바꿨고 **CPO 가 그것을 반려했다.**
 *    CEO Production 화면이 「국내 가격 형성대  **유사상품 1**」로 떴기 때문이다 —
 *    그 숫자의 근거는 `TEXT_CONFIRMED → COMPARISON`(= 유사상품)이고,
 *    **유사상품 가격을 「형성대」라고 부르면 셀러 의사결정 기준이 틀린다**(CPO 문장).
 *
 * ── 🔴 왜 「형성대」를 쓸 수 없는가 (코드로 확정된 사실) ───────────────────────────
 * ```
 * 국내 후보 → crossSellerVerdict PRESUMED_SAME → match-truth.ts:233 crossSellerReserved
 *          → :237 식별자 경로 **차단** → matchTruth **TEXT_CONFIRMED**
 *          ├ domestic-product-link.ts:88  → **COMPARISON** (= 이 참고 축에 들어온다)
 *          └ match-display.ts:268         → **PRESUMED_SAME** (= SAME 축에서 탈락)
 * ⟹ 🔴 국내에서 SAME/EXACT 는 **구조적으로 도달 불가** 다(그 완화는 WU-066 실측
 *    precision **91.7% → 55.6%** 로 **영구 폐기** · 8축/threshold FREEZE).
 * ```
 * 🟢 그래서 **가격을 지우지 않고 이름을 정직하게 가른다**(CPO 결정 A):
 * ```
 * SAME 가격 있음  → 「💰 … 동일상품 확인 가격」 + 금액이 다르면 **가격대**(`DOMESTIC_BAND_LABEL`)
 * SAME 가격 없음  → **「국내 참고가격」** + 「동일상품으로 확정된 국내 판매처는 없습니다」
 * ```
 * 🔴 **「가격 형성대」는 SAME 가격이 없는 상태에서 쓰지 않는다**(CPO §1 명시).
 * 🟢 금액 표현(최저 ~ 최고 · 1건은 범위 금지)은 CORE-2T 그대로 **유지** 한다 —
 *    유사상품 기준에서도 **여러 판매처의 폭** 은 사실이고, 이름이 그 성질을 말한다.
 * 🔴 **`₩` 로 바꾸지 않았다** — 이 영역의 `₩` 는 계약 6건이 금지한다(실측: `convertToKrw` 가
 *    모르는 통화를 그대로 KRW 로 취급해 `CAD 64` → **「약 ₩64」** · CORE-2E §4-4).
 */
export const DOMESTIC_REFERENCE_TITLE = "국내 참고가격";
export const DOMESTIC_REFERENCE_NOTE =
  "국내 판매처의 상세 페이지에서 확인한 가격입니다 — 원래 통화 그대로입니다.";
/**
 * 🔴🔴🔴 CORE-2U-A §1·§4 — **가격 바로 아래에서 「확정이 아니다」를 말한다.**
 *
 * 🔴 이 한 줄이 없으면 셀러는 「국내 참고가격 KRW 88,000」을 **동일상품 가격으로 읽는다** —
 *    그것이 2026-09-19 사고의 기전이고, CEO 화면에서 실제로 모순으로 보인 것이다.
 * 🟢 그래서 **두 사실을 나란히** 둔다(CPO §4): 가격은 **있고**, 동일상품 확정은 **없다**.
 * 🔴 「없다」로 끝내지 않되 **셀러에게 판단을 떠넘기지도 않는다**(§7) — 「사진으로
 *    확인해 주세요」류를 쓰지 않는다.
 */
export const DOMESTIC_SAME_NOT_CONFIRMED = "동일상품으로 확정된 국내 판매처는 없습니다.";
/** 🔴 CORE-2T §4 — 국내는 **「확인 N곳」** 이다(「판매처 N곳」은 해외 축의 기존 말). */
export const DOMESTIC_SELLER_COUNT_LABEL = "확인";
/** 🟢 해외 축의 기존 말 — **한 글자도 바꾸지 않는다**(§9). */
export const OVERSEAS_SELLER_COUNT_LABEL = "판매처";
export const DOMESTIC_REFERENCE_SCOPE =
  "이번 확인에만 쓰이고 저장되지 않습니다 — 새로고침하면 사라집니다.";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2W — **금액 문자열의 owner 는 «하나» 다.**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO §4-C 가 **결론 문장에도 금액** 을 넣으라고 했다(「국내 참고가격은 KRW 88,000 으로
 *    확인됐습니다 …」). 🔴 그런데 포맷을 그 자리에서 다시 쓰면 **블록과 결론이 다른
 *    글자** 를 낼 수 있다(한쪽만 범위를 적거나 천단위 구분이 갈린다).
 * 🟢 그래서 **블록이 쓰던 그 식을 함수로 뽑아** 결론도 같은 것을 부른다 — 새 규칙 0.
 *
 * 🔴 **1건(또는 같은 금액)을 억지 범위로 만들지 않는다** — `88,000 ~ 88,000` 은 거짓 폭이다.
 *    🟢 판별은 **금액 비교** 로 한다(건수로 하면 「판매처 2곳인데 같은 가격」이 범위가 된다).
 * 🔴 환산 **0** · 통화 **혼합 0** · 기호 변환 **0**(ISO 코드 그대로 — `wu-056r1`).
 */
export function formatReferenceAmount(
  currency: string,
  v: { lowestAmount: number; highestAmount?: number },
): string {
  const lo = (v.lowestAmount ?? 0).toLocaleString("ko-KR");
  const hi = v.highestAmount;
  const isBand = hi != null && Number.isFinite(hi) && hi > v.lowestAmount;
  return isBand ? `${currency} ${lo} ~ ${hi.toLocaleString("ko-KR")}` : `${currency} ${lo}`;
}

/**
 * 🟢 CORE-2W — 집계 전체를 **한 줄** 로(통화가 여럿이면 `·` 로 나란히). 🔴 **합치지 않는다.**
 *    🔴 가격이 없으면 `null` — 호출부가 「없는 금액」을 문장에 넣지 못하게 한다.
 */
export function referenceAmountSummary(s?: OverseasPriceSummary | null): string | null {
  if (!s || s.count <= 0) return null;
  const parts = Object.entries(s.byCurrency)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => formatReferenceAmount(currency, v));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface OverseasReferenceLine {
  /** `EUR` 같은 ISO 코드. 🔴 기호로 바꾸지 않는다(기호는 통화를 잃는다). */
  currency: string;
  /** `EUR 40` — 🔴 원래 통화 그대로. */
  lowest: string;
  /** `판매처 2곳` */
  scope: string;
}

export interface OverseasReferenceView {
  lines: OverseasReferenceLine[];
  /** 「동일상품 2 · 비교상품 1」 — 🔴 등급을 **합치지 않는다**. */
  tierNote: string | null;
  /** 시장이 `UNKNOWN` 인 후보가 섞여 있으면 그 사실을 적는다(해외로 단정하지 않는다). */
  unknownMarketNote: string | null;
}

/** 🔴 등급 어휘는 owner(`match-display`)와 같은 말을 쓴다 — 사본을 만들지 않는다. */
const TIER_LABEL: Record<string, string> = {
  EXACT: "동일상품",
  CONFIRMED: "동일상품",
  COMPARISON: "유사상품",
  REFERENCE: "참고",
  /**
   * 🔴🔴 WU-056 — **이 줄이 없어서 화면에 영문 내부 토큰이 찍혔다.**
   *
   * 실데이터(GT 51건)로 재 보니 해외 집계 16건의 tier 분포가
   * `EXACT 10 · COMPARISON 2 · REFERENCE 2 · **EXCLUDED 2**` 였다.
   * 🔴 해외 축은 **tier 를 거르지 않고** 가격 있는 후보를 전부 담는다
   *    (market-intelligence.ts 의 `market !== "KR"` 분기). 국내 축은 반대로
   *    `EXACT || COMPARISON` 만 담는다(:318) — **두 축이 비대칭** 이다.
   * ⟹ `EXCLUDED` 가 집계에 들어오는데 이 표에 없어서 `?? tier` 로 떨어지고
   *    셀러 화면에 **「EXCLUDED 2」** 가 그대로 출력됐다.
   *
   * 🟢 **집계에서 빼지 않았다** — 그러면 WU-049 가 측정·고정한 해외 집계 수가
   *    바뀐다(그 축은 보호 대상이다). 🔴 비대칭 자체를 없앨지는 **제품 정책** 이라
   *    CPO 판정으로 올린다.
   * 🟢 지금 고치는 것은 **어휘 누출 하나** 다 — 셀러가 읽을 수 있는 말로 적는다.
   */
  EXCLUDED: "동일상품 아님",
};

/**
 * 🔴 값이 없으면 **null** 을 돌려준다 — 「0건」이나 「-」로 칸을 만들지 않는다.
 *    (이 저장소가 반복해서 막아 온 「화면이 아는 척하는」 사고)
 */
export function buildOverseasReference(
  summary: OverseasPriceSummary | null | undefined,
  /**
   * 🔴 CORE-2T — 국내는 「**확인** N곳」 · 해외는 「**판매처** N곳」이다. 🟢 기본값이
   *    해외의 기존 말이라 **해외 호출부는 한 글자도 바뀌지 않는다**(§9).
   */
  opts?: {
    sellerCountLabel?: string;
    /**
     * 🔴🔴🔴 CORE-2U-A §1·§5 — **등급 분포(`tierNote`)를 국내에서 끈다.**
     *
     * 🔴 CEO 화면의 「국내 가격 형성대 **유사상품 1**」이 바로 이 줄이었다. 그 어휘는
     *    `TIER_LABEL`(= 내부 tier 의 말)이고, **셀러의 결론 옆에 설 정보가 아니다**
     *    (§5 「후보별 내부 verdict 는 MI 상세로 격리」).
     * 🟢 **지우지 않았다** — 같은 사실을 1차에서 **셀러의 말**(`DOMESTIC_SAME_NOT_CONFIRMED`)
     *    로 적고, 등급 분포는 `▸ MI 상세 분석` 이 계속 들고 있다.
     * 🔴 **기본값은 `true`** 다 ⟹ 해외 축은 **한 글자도 바뀌지 않는다**(§9).
     */
    showTierNote?: boolean;
  },
): OverseasReferenceView | null {
  if (!summary || summary.count <= 0) return null;
  const countLabel = opts?.sellerCountLabel ?? OVERSEAS_SELLER_COUNT_LABEL;
  const showTierNote = opts?.showTierNote ?? true;

  const lines: OverseasReferenceLine[] = Object.entries(summary.byCurrency)
    /** 🔴 통화 간 «순서» 를 금액으로 매기지 않는다 — 환산 없이 비교할 수 없다. */
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => {
      /**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴🔴🔴 CORE-2T §16 — **「마지막 1미터」가 바로 이 줄이었다.**
       * ══════════════════════════════════════════════════════════════════════
       *
       * 🔴 `highestAmount` 는 **CORE-2R-5 가 이미 집계** 하고 있었는데 이 함수가 그 칸을
       *    **한 번도 읽지 않았다** ⟹ 금액이 **서로 달라도** 화면은 **최저가 한 줄** 만
       *    보여줬다. 그래서 「국내 가격 형성대」가 **구조적으로 표시될 수 없었다** —
       *    CPO 가 「단일 참고가격으로 보이는 상태」라고 지적한 그 모양이다.
       * 🟢 고친 것은 **읽는 쪽 하나** 다 — 집계·수집·판정·중복제거는 건드리지 않았다.
       *
       * 🔴 **1건(또는 같은 금액)을 억지 범위로 만들지 않는다**(§4 명시) —
       *    `88,000 ~ 88,000` 은 거짓 폭이다. 🟢 그 판별은 **금액 비교** 로 한다
       *    (건수로 하면 「판매처 2곳인데 같은 가격」이 범위가 돼 버린다 · 실측 D4).
       * 🔴 환산 **0** · 통화 **혼합 0** — 범위는 **한 통화 «안»** 에서만 만든다.
       */
      return {
        currency,
        lowest: formatReferenceAmount(currency, v),
        /**
         * 🔴 `count` 는 **집계에 들어간 수** 다 — 국내는 집계기가 **판매처 단위로 접은
         *    뒤** 세므로 그 값이 「확인 N곳」의 분모로 정확하다(중복이 새어 나오지 않는다).
         */
        scope: `${countLabel} ${v.count}곳`,
      };
    });
  if (lines.length === 0) return null;

  const tierParts = Object.entries(summary.byPriceTier)
    .filter(([, n]) => n > 0)
    .map(([tier, n]) => `${TIER_LABEL[tier] ?? tier} ${n}`);

  const unknown = summary.byMarket.UNKNOWN ?? 0;

  return {
    lines,
    /** 🔴 CORE-2U-A — 국내는 **끈다**(내부 등급 어휘를 셀러 결론 옆에 두지 않는다 · §5). */
    tierNote: showTierNote && tierParts.length > 0 ? tierParts.join(" · ") : null,
    /** 🔴 `UNKNOWN` 을 「해외」로 적지 않는다 — 시장을 확인하지 못한 것이다. */
    unknownMarketNote: unknown > 0 ? `${unknown}곳은 판매 시장을 확인하지 못했습니다.` : null,
  };
}
