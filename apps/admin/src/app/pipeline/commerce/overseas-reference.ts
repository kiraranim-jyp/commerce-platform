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
export const OVERSEAS_REFERENCE_TITLE = "해외 동일상품 참고가격";
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
 * 🔴🔴🔴 CORE-2T §4·§8 — **「국내 참고가격」 → 「국내 가격 형성대」.**
 *
 * 🔴 CPO: 「우리가 원하는 최종 결과는 **국내 가격 형성대** 다 … 현재 화면은
 *    `판매처 1곳 / 88,000원` 처럼 **단일 참고가격으로 보이는 상태** 다」.
 * 🟢 제목이 그 축의 이름을 말해야 셀러가 **「이 상품이 국내에서 어느 가격대인가」**
 *    로 읽는다 — 「참고가격」은 **무엇의 참고인지** 를 말하지 않는다.
 * 🔴 **1건이면 범위를 만들지 않는다**(§4) — 그때도 제목은 이 축의 이름 그대로 두고
 *    **금액 한 줄 + 「확인 1곳」** 으로 적는다(억지 `88,000 ~ 88,000` 금지).
 * 🔴 **`₩` 로 바꾸지 않았다.** CPO 예시는 `₩83,600 ~ ₩88,000` 이지만 이 영역의 `₩` 는
 *    **계약 6건이 금지** 한다(`wu-141-r3`·`wu-144`·`wu-145`·`wu-146`·`wu-148`·`wu-139`) —
 *    근거는 실측이다: `convertToKrw` 가 모르는 통화를 그대로 KRW 로 취급해 `CAD 64` 가
 *    **「약 ₩64」** 로 떴다(CORE-2E §4-4). 🟢 그래서 **ISO 코드** 를 유지한다
 *    (`KRW 83,600 ~ 88,000`) — 통화를 잃지 않는 쪽이고 §4 의 «뜻» 은 그대로 지킨다.
 *    🔵 기호 표기를 쓰려면 그 여섯 앵커 갱신이 선행이고 **가격 표시 정책** 이다(CPO 판정).
 */
export const DOMESTIC_REFERENCE_TITLE = "국내 가격 형성대";
export const DOMESTIC_REFERENCE_NOTE =
  "국내 판매처의 상세 페이지에서 확인한 가격입니다 — 원래 통화 그대로입니다.";
/** 🔴 CORE-2T §4 — 국내는 **「확인 N곳」** 이다(「판매처 N곳」은 해외 축의 기존 말). */
export const DOMESTIC_SELLER_COUNT_LABEL = "확인";
/** 🟢 해외 축의 기존 말 — **한 글자도 바꾸지 않는다**(§9). */
export const OVERSEAS_SELLER_COUNT_LABEL = "판매처";
export const DOMESTIC_REFERENCE_SCOPE =
  "이번 확인에만 쓰이고 저장되지 않습니다 — 새로고침하면 사라집니다.";

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
  opts?: { sellerCountLabel?: string },
): OverseasReferenceView | null {
  if (!summary || summary.count <= 0) return null;
  const countLabel = opts?.sellerCountLabel ?? OVERSEAS_SELLER_COUNT_LABEL;

  const lines: OverseasReferenceLine[] = Object.entries(summary.byCurrency)
    /** 🔴 통화 간 «순서» 를 금액으로 매기지 않는다 — 환산 없이 비교할 수 없다. */
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => {
      const n = (v.lowestAmount ?? 0).toLocaleString("ko-KR");
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
      const hi = v.highestAmount;
      const isBand = hi != null && Number.isFinite(hi) && hi > v.lowestAmount;
      return {
        currency,
        lowest: isBand
          ? `${currency} ${n} ~ ${(hi as number).toLocaleString("ko-KR")}`
          : `${currency} ${n}`,
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
    tierNote: tierParts.length > 0 ? tierParts.join(" · ") : null,
    /** 🔴 `UNKNOWN` 을 「해외」로 적지 않는다 — 시장을 확인하지 못한 것이다. */
    unknownMarketNote: unknown > 0 ? `${unknown}곳은 판매 시장을 확인하지 못했습니다.` : null,
  };
}
