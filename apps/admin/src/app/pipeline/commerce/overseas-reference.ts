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
  byCurrency: Record<string, { count: number; lowestAmount: number }>;
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
export const DOMESTIC_REFERENCE_TITLE = "국내 참고가격";
export const DOMESTIC_REFERENCE_NOTE =
  "국내 판매처의 상세 페이지에서 확인한 가격입니다 — 원래 통화 그대로입니다.";
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
export function buildOverseasReference(summary: OverseasPriceSummary | null | undefined): OverseasReferenceView | null {
  if (!summary || summary.count <= 0) return null;

  const lines: OverseasReferenceLine[] = Object.entries(summary.byCurrency)
    /** 🔴 통화 간 «순서» 를 금액으로 매기지 않는다 — 환산 없이 비교할 수 없다. */
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, v]) => ({
      currency,
      lowest: `${currency} ${v.lowestAmount.toLocaleString("ko-KR")}`,
      scope: `판매처 ${v.count}곳`,
    }));
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
