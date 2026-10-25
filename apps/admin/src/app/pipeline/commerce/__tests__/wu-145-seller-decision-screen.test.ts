// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  /** 🔴 WU-146 — 결론 구간의 머리(「💡 판매 판단」). 리터럴로 적지 않는다(owner 가 상수다). */
  MARKET_RESULT_HEADING,
  MI_SAME_AREA_SCOPE,
  PRICE_GUIDE_TITLE,
  SAME_CONFIRMED_COUNT_LABEL,
  SAME_PRICE_LABEL,
  marketEmptyNote,
  pendingNote,
  pendingReasonNote,
} from "../mi-same-candidates";
import { KNOWN_BLOCKER_TOKENS, blockerText } from "../blocker-text";
import {
  REVIEW_HISTORY_HEADING,
  ReviewHistorySection,
  type GeminiTransientRow,
  type ReviewHistoryRow,
} from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-145 — **셀러 결론 화면 확정** (CPO 작업지시 2026-10-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **MI 코어 동결.** 이 파일은 **표시 계층만** 본다 — threshold · 8축 ·
 *    MODEL_CODE · BABY/CHILD · Registry · 환산 · 추천 판매가 · `price_alerts`
 *    **전부 불변** 이고, 아래 단언 중 그것을 요구하는 것이 **하나도 없다**.
 *
 * ── 🔴 이 파일이 잠그는 CPO 결정 둘 ──────────────────────────────────────────
 * ```
 * ① 어휘   「시장 참고가격」 ❌ → **「동일상품 확인 가격」** 하나
 *          🔴 단일 가격을 **범위로 만들지 않는다** · 다른 통화를 **합쳐 범위 금지**(환산 0)
 * ② 🇰🇷 0  1차는 「동일상품 확인 0곳」까지만 · 해외는 **확인된 사실만**
 *          🔴 **금지 문구 셋** — 「국내에서는 판매되지 않습니다」 ·
 *             「국내 시장 가격이 없습니다」 · 「국내는 USD 58 정도입니다」
 * ```
 * ── 🔴 그리고 남은 셋(①②③) 의 «구조» ────────────────────────────────────────
 * ```
 * ① MI blocker  1차 **건수만** / 2차(`▸ MI 상세 분석`) **사유 분포**  — 이동 · 삭제 아님
 * ② 결론 한 줄   「판매가격 판단: …」 — 🔴 **가격이 확인됐을 때만** · 추천가 **계산 0**
 * ③ 후보 상세    📚 이력도 **한 겹 접힘** — 🔴 출처 축(머리 문구)은 **보존**
 * ```
 *
 * 🔴🔴 **금지 문구를 운영 소스에 상수로 두지 않았다** — 두면 「소스에 그 문구가
 *    없다」는 검사가 **자기 상수에 걸려** 통과하지 못한다. 그래서 그 목록은
 *    **이 파일에만** 산다(헌장 §5 「주석을 벗기고 센다」와 같은 계열의 함정이다).
 */
const FORBIDDEN_PHRASES = [
  "국내에서는 판매되지 않습니다",
  "국내 시장 가격이 없습니다",
  "국내는 USD",
  "시장 참고가격",
] as const;

/** 🟢 실측 모양. 🔴 `priceTier`/`matchTruth` 를 지어내지 않는다(운영이 낸 조합 그대로). */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "t",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://a.example/p/1",
    matchTruth: "EXACT_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    confidence: 1,
    matchReasons: [],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: null,
    priceCurrency: null,
    priceStatus: null,
    market: "OVERSEAS",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

/**
 * 🟢 **S1/S2 는 WU-144 의 라이브 실측값 그대로다**(CPO: 「새 MI 조사부터 하지 않는다」).
 * ```
 * S1 B226AC010  🌎 동일상품 3 · 판매중 0 · 가격확인 3 → CAD 64 · GBP 37 · USD 58 · 🇰🇷 0
 * S2 B226AC009  🌎 동일상품 3 · 판매중 1 · 가격확인 2 · 확인필요 1 → USD 58 · 🇰🇷 0
 * ```
 */
const S1: GeminiTransientRow[] = [
  row({ domain: "kolkid.ca", discoveredUrl: "https://kolkid.ca/p/1", priceAmount: 64, priceCurrency: "CAD", priceStatus: "VERIFIED_CURRENT" }),
  row({ domain: "cissywears.com", discoveredUrl: "https://cissywears.com/p/2", priceAmount: 37, priceCurrency: "GBP", priceStatus: "VERIFIED_CURRENT" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
];

const S2: GeminiTransientRow[] = [
  row({ domain: "www.thefrontshop.com", discoveredUrl: "https://www.thefrontshop.com/p/1", soldOut: false, priceAmount: 58, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/2", priceAmount: 58, priceCurrency: "USD", priceStatus: "VERIFIED_CURRENT" }),
  /** 🔴 **가격을 못 가져온 SAME** — 버리지 않고 링크를 준다(WU-139). */
  row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/3" }),
];

/**
 * 🟢 **보류 후보**(가격은 있는데 SAME 이 아니다) — WU-133 B 의 실측 모양.
 * 🔴 이 행이 없으면 ① 의 「1차 ↔ 2차」를 **측정할 수 없다**(분모가 0 이 된다).
 */
const pendingRow = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow =>
  row({
    source: "REVIEWED_SAME",
    domain: "biskuit.kr",
    discoveredUrl: "https://biskuit.kr/p/9",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    confidence: 0.6,
    crossSellerBlockers: ["BRAND_UNCONFIRMED"],
    crossSellerConflicts: ["MODEL_CODE"],
    priceAmount: 88000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    ...over,
  });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (rows: GeminiTransientRow[] | null): void => {
  act(() => root.render(createElement(MarketPriceComparison, { rows })));
};
const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const flat = (): string => (container.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * 🔴🔴 **1차 화면 = 「▸」 접힘 «밖»** 이다. 접힘 안의 글자는 셀러가 **열어야** 보인다.
 *    🟢 React 는 `details` 가 닫혀 있어도 자식을 렌더하므로 `textContent` 만 보면
 *       **2차까지 섞여 들어온다** — 그대로 재면 ① 의 측정이 거짓이 된다.
 * ⟹ 그래서 **닫힌 `details` 를 떼어 낸 복사본** 에서 1차를 읽는다.
 */
const firstScreenText = (): string => {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) {
    if (!d.hasAttribute("open")) d.remove();
  }
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
};

/* ════════════ A. 🔴🔴 ① MI blocker — 1차 건수 / 2차 사유 (이동) ════════════ */

describe("A. ① MI blocker 는 1차에 노출되지 않는다 (삭제가 아니라 이동)", () => {
  it("🔴🔴 A-1 1차에 **사유 어휘가 하나도 없다** — 표 전수로 확인한다", () => {
    mount([...S2, pendingRow()]);
    const first = firstScreenText();
    for (const token of KNOWN_BLOCKER_TOKENS) {
      expect(first, `1차에 사유 어휘가 남았다: ${token}`).not.toContain(blockerText(token));
    }
    /** 🔴 내부 영문 토큰도 **어디에도** 없다(WU-056 의 `EXCLUDED` 누출 재발 방지). */
    for (const token of KNOWN_BLOCKER_TOKENS) {
      expect(flat(), `내부 토큰이 노출됐다: ${token}`).not.toContain(token);
    }
  });

  it("🟢🟢 A-2 **건수는 1차에 남는다** — WU-133 이 고친 거짓말이 되돌아오지 않는다", () => {
    mount([...S2, pendingRow()]);
    const el = q("mi-same-pending");
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain("1건");
    /** 🔴 그 줄이 **접힘 밖** 에 있어야 「1차에 남았다」가 참이다. */
    expect(firstScreenText()).toContain("1건");
  });

  it("🔴🔴 A-3 사유는 **2차에 그대로** 있다 — 「지우지 않는다」(CPO 명시)", () => {
    mount([...S2, pendingRow()]);
    const reasons = q("mi-same-pending-reasons");
    expect(reasons).not.toBeNull();
    /** 🟢 두 축이 **둘 다** 산다 — 건수도 정렬도 줄이지 않았다. */
    expect(reasons!.textContent).toContain("브랜드 미확인 1");
    expect(reasons!.textContent).toContain("품번 충돌 1");
    /** 🔴 그 자리가 **접혀 있다** — 안 접혀 있으면 「2차로 내렸다」가 거짓이다. */
    const fold = q("mi-detail-fold")!;
    expect(fold.contains(reasons!)).toBe(true);
    expect(fold.hasAttribute("open")).toBe(false);
  });

  it("🔴 A-4 보류가 0 이면 **두 줄 다 만들지 않는다**(없는 말을 적지 않는다)", () => {
    mount(S2);
    expect(q("mi-same-pending")).toBeNull();
    expect(q("mi-same-pending-reasons")).toBeNull();
    /** 🟢 순수 함수 축에서도 같다 — 호출부가 아니라 owner 가 그 규칙을 들고 있다. */
    expect(pendingNote({ count: 0, reasons: [] })).toBeNull();
    expect(pendingReasonNote({ count: 0, reasons: [] })).toBeNull();
    expect(pendingReasonNote({ count: 2, reasons: [] })).toBeNull();
  });
});

/* ════════════ B. 🔴🔴 ① 어휘 — 「동일상품 확인 가격」 하나 ════════════ */

describe("B. ① 가격 어휘는 하나다", () => {
  it("🟢🟢 B-1 1차 가격의 말이 **「동일상품 확인 가격」** 이다", () => {
    /**
     * 🔴🔴 **음성 대조가 내 단언의 구멍을 찾았다.** 1차에는
     *    `expect(firstScreenText()).toContain(SAME_PRICE_LABEL)` 만 있었다 —
     *    그런데 `PRICE_GUIDE_TITLE` 이 **그 상수로 만들어지므로** 상수를
     *    「시장 참고가격」으로 바꿔도 **그대로 통과한다**(M6 에서 실제로 통과했다).
     * ⟹ 🔴 가드를 느슨하게 두지 않고 **글자를 직접** 단언한다. 그래야 「어휘가
     *    확정됐다」가 측정되는 사실이 된다(CPO 결정 ①).
     */
    mount(S1);
    expect(SAME_PRICE_LABEL).toBe("동일상품 확인 가격");
    expect(firstScreenText()).toContain("동일상품 확인 가격");
    /** 🟢 두 시장 제목이 **같은 상수** 에서 나온다(두 벌로 적지 않는다). */
    for (const m of ["KR", "OVERSEAS"] as const) {
      expect(PRICE_GUIDE_TITLE[m]).toContain("동일상품 확인 가격");
    }
  });

  it("🔴🔴 B-2 **「시장 참고가격」을 쓰지 않는다** — 그 말은 다른 뜻으로 이미 쓰인다", () => {
    mount([...S1, pendingRow()]);
    expect(flat()).not.toContain("시장 참고가격");
    /**
     * 🟢 그리고 2차의 **참고 축은 그대로 살아 있다** — 「동일상품 확인 가격」과
     *    「참고가격」은 **다른 뜻** 이고, 두 말을 섞지 않는 것이 이 계약의 요지다
     *    (`wu-056r1` 이 그 블록 제목을 글자로 잠그고 있다 · 건드리지 않았다).
     */
    expect(MI_SAME_AREA_SCOPE.length).toBeGreaterThan(0);
  });

  it("🔴🔴 B-3 **단일 가격을 범위로 만들지 않는다** · 통화를 **합치지 않는다**", () => {
    mount(S2);
    const t = flat();
    /** 🔴 S2 는 USD 58 **두 곳인데 같은 금액** ⟹ 범위가 아니다(WU-139 B-2 유지). */
    expect(t).not.toContain("58 ~ 58");
    expect(t).toContain("USD 58");
    mount(S1);
    const t1 = flat();
    /** 🔴 서로 다른 **통화** 를 합쳐 범위로 적지 않는다(환산 0 · 합계 칸 없음). */
    expect(t1).not.toMatch(/\d+\s*~\s*\d+/);
    for (const cur of ["CAD", "GBP", "USD"]) expect(t1).toContain(cur);
    expect(t1).not.toContain("₩");
    expect(t1).not.toContain("약 ");
  });
});

/* ════════════ C. 🔴🔴 ② 결론 한 줄 — 해석이지 추천가가 아니다 ════════════ */

describe("C. ② 셀러가 읽는 결론", () => {
  /**
   * 🔴🔴 **WU-146 에서 owner 가 교체됐다** — WU-145 의 `market-price-judgement` 는
   *    **상태와 무관하게 같은 한 줄** 이라 결론이 아니라 **안내문** 이었다.
   *    🟢 이제 `seller-decision`(상태별 문장 배열)이 그 자리를 갖는다.
   * 🔴 **상태 기계 자체는 `wu-146` 이 소유한다** — 이 파일은 ⒜ 결론이 **1차에 선다**
   *    ⒝ 그 owner 가 **하나다** 만 본다(두 파일이 같은 것을 두 번 재지 않는다).
   */
  it("🟢 C-1 결론이 **1차 화면에 선다** · owner 는 **하나** 다", () => {
    mount(S1);
    expect(container.querySelectorAll('[data-testid="seller-decision"]').length).toBe(1);
    /** 🔴 WU-145 의 옛 owner 는 **사라졌다** — 두면 결론이 둘이 된다(STEP 7-2). */
    expect(q("market-price-judgement")).toBeNull();
    expect(firstScreenText()).toContain("동일상품");
    /**
     * 🔴 S1 은 **세 통화** 라 결론이 「확인된 **가격은** …」이다(「확인된 기준가격은」은
     *    단일 통화 분기다). 🟢 1차에 쓴 단언이 그 분기를 혼동했고 FAIL 로 드러났다 —
     *    문구를 **상태에 맞게** 고친다(상태 기계 자체는 `wu-146` 이 전수로 본다).
     */
    /**
     * 🔴 **WU-148 에서 갱신** — 결론이 **시장별 해석** 으로 갈리면서 구분자가
     *    「/」→「·」로 바뀌었다(🌎 통화별 **최저 확인가** 나열). 🟢 금액 셋은 그대로다.
     */
    for (const n of ["CAD 64", "GBP 37", "USD 58"]) expect(firstScreenText()).toContain(n);
  });

  it("🔴🔴 C-2 가격이 **0 이면 기준가격을 말하지 않는다** — 「기준이 있다」는 거짓이 된다", () => {
    /** 🔴 SAME 인데 가격이 **전건 없는** 모양(실측: trenbe 하나만 남은 경우). */
    mount([row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/3" })]);
    /** 🟢 결론 자체는 **선다** — 「아무 말도 안 한다」가 아니라 **다른 말** 을 한다. */
    expect(q("seller-decision")).not.toBeNull();
    expect(flat()).not.toContain("기준가격");
    expect(flat()).toContain("확인된 판매가가 아직 없습니다");
  });

  it("🔴🔴 C-3 **추천 판매가를 만들지 않는다**(§00-B 가격 보류 · CPO 명시)", () => {
    mount([...S1, ...S2]);
    const t = flat();
    for (const bad of ["판매가는", "로 설정하세요", "추천 판매가", "권장 판매가"]) {
      expect(t, `추천가 어휘가 나왔다: ${bad}`).not.toContain(bad);
    }
    /**
     * 🔴🔴 CORE-2AO — **「마진」·「수수료」는 «제외 문장에서만»**(아래 「평균」과 같은 자리).
     *    1차에 리터럴 금지로 뒀더니 CPO 가 요구한 필수 문구(「배송비·관부가세·수수료·
     *    목표마진은 **별도로 반영해야** 최종 판매가격이 됩니다」)가 FAIL 했다.
     * 🟢 느슨하게 하지 않고 **강화** 한다 — 그 낱말이 나오면 같은 문장에
     *    「별도로 반영」/「아닙니다」/「반영되지 않습니다」가 **반드시** 있어야 한다.
     */
    for (const m of t.match(/[^.。]*(?:마진|수수료)[^.。]*/g) ?? []) {
      expect(m, `마진/수수료가 계산 문장에 쓰였다: ${m}`).toMatch(
        /별도로 반영|아닙니다|아니다|반영되지 않습니다/,
      );
    }
    /** 🔴 금액·비율이 붙으면 어떤 문장에서도 FAIL — 계산을 시작한 것이다. */
    expect(t, "🔴 마진/수수료에 금액·비율이 붙었다").not.toMatch(
      /(?:마진|수수료)[^\n]{0,12}(?:₩|\d+\s*%|\d{3,})/,
    );
    /** 🔴 「평균」은 **부정문으로만** 쓴다(WU-144 E 와 같은 축 · 느슨하게 하지 않는다). */
    for (const m of t.match(/[^.。]*평균[^.。]*/g) ?? []) {
      expect(m, `평균이 긍정문에 쓰였다: ${m}`).toMatch(/아닙니다|아니다/);
    }
  });
});

/* ════════════ D. 🔴🔴 ② 🇰🇷 0 의 «말» — 거짓 국내 가격을 만들지 않는다 ════════════ */

describe("D. ② 국내 동일상품 0 일 때", () => {
  it("🟢🟢 D-1 1차는 **「동일상품 확인 0곳」** 까지다", () => {
    mount(S2);
    const kr = q("market-empty-domestic")?.textContent ?? "";
    expect(kr).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 0곳`);
  });

  it("🔴🔴🔴 D-2 **금지 문구 셋이 어디에도 없다**(CPO 명시)", () => {
    for (const rows of [S1, S2, [...S2, pendingRow()], []]) {
      mount(rows);
      for (const bad of FORBIDDEN_PHRASES) {
        expect(flat(), `금지 문구가 나왔다: ${bad}`).not.toContain(bad);
      }
    }
  });

  it("🔴🔴 D-3 해외 숫자를 **국내의 말로 옮기지 않는다** — 확인된 사실만", () => {
    mount(S2);
    const kr = q("market-block-domestic")!.textContent ?? "";
    /** 🔴 해외에 USD 58 이 있어도 🇰🇷 블록이 그 금액을 말하지 않는다(환산도 추정도 0). */
    expect(kr).not.toContain("USD");
    expect(kr).not.toContain("58");
    /** 🟢 그리고 「없다」로 단정하지 않는다 — 부재와 미발견은 다르다(WU-091 어휘 계약). */
    expect(kr).toMatch(/찾지 못했습니다|판정된 곳이 없습니다/);
  });

  it("🟢 D-4 순수 함수 축에서도 같다 — owner 가 그 말을 들고 있다", () => {
    const note = marketEmptyNote(0, { count: 0, reasons: [] });
    expect(note).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 0곳`);
    for (const bad of FORBIDDEN_PHRASES) expect(note).not.toContain(bad);
  });
});

/* ════════════ E. 🔴🔴 ③ 후보 상세는 한 겹 더 접힌다 ════════════ */

describe("E. ③ 📚 이전에 확인한 후보도 접혀 있다 (출처 축은 보존)", () => {
  const historyRow: ReviewHistoryRow = {
    candidateUrl: "https://biskuit.kr/p/9",
    candidateDomain: "biskuit.kr",
    candidateTitle: "Bobo Choses Hug Hairy Monster T-shirt",
    priceAmount: 88000,
    priceCurrency: "KRW",
    market: "KR",
    systemVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    humanVerdict: "SAME",
    source: "REVIEWED_SAME",
    lastSeenAt: "2026-10-21T00:00:00.000Z",
    reviewedAt: "2026-10-21T00:00:00.000Z",
  };

  const html = (rows: ReviewHistoryRow[]): string =>
    renderToStaticMarkup(ReviewHistorySection({ rows }) as never);

  it("🔴🔴 E-1 후보 행이 **접힘 뒤** 에 있다 — `open` 이 없다", () => {
    const out = html([historyRow]);
    expect(out).toContain("<details");
    /** 🔴 `open` 을 붙이면 1차 화면으로 되돌아간다(2026-09-19 사고 기전 · WU-091 ①). */
    expect(out).toMatch(/<details data-testid="candidate-fold"(?![^>]*\bopen\b)/);
  });

  it("🟢🟢 E-2 **출처 축(머리 문구)은 보존된다** — 접힘 라벨로 그대로 간다", () => {
    const out = html([historyRow]);
    expect(out).toContain(REVIEW_HISTORY_HEADING);
    /** 🔴 「추가 검토 후보」 하나로 합치면 출처가 사라진다(WU-130 이 잠근 축). */
    expect(out).toContain("1건");
  });

  it("🟢 E-3 행·데이터는 **한 글자도 사라지지 않았다** — 접기만 했다", () => {
    const out = html([historyRow]);
    for (const id of ["rh-row", "rh-url", "rh-price", "rh-system", "rh-human", "rh-seen"]) {
      expect(out, `행의 칸이 사라졌다: ${id}`).toContain(`data-testid="${id}"`);
    }
    expect(out).toContain("biskuit.kr");
    expect(out).toContain("KRW 88,000");
  });
});

/* ════════════ F. 🔴 전체 — 1차가 결론이고 탐색이 아니다 ════════════ */

describe("F. 1차 화면은 «결론» 이다", () => {
  it("🔴🔴 F-1 1차에 **열린 접힘이 없다** — 후보 URL·이미지·blocker 가 펼쳐지지 않는다", () => {
    for (const rows of [S1, S2, [...S2, pendingRow()]]) {
      mount(rows);
      expect(container.querySelector("details[open]")).toBeNull();
      /** 🟢 접힘은 **있다** — 삭제가 아니라 계층이다. */
      expect(container.querySelectorAll("details").length).toBeGreaterThan(0);
    }
  });

  it("🟢🟢 F-2 셀러가 1차에서 **동일상품 → 판매중 → 가격 → 판단** 을 순서대로 읽는다", () => {
    mount(S2);
    const first = firstScreenText();
    /** 🔴 WU-146 — 마지막 칸이 **「💡 판매 판단」** 으로 바뀌었다(결론 owner 교체). */
    const order = [`${SAME_CONFIRMED_COUNT_LABEL} 3곳`, "판매중 확인 1곳", "USD 58", MARKET_RESULT_HEADING];
    let at = -1;
    for (const part of order) {
      const i = first.indexOf(part);
      expect(i, `1차에 없다: ${part}`).toBeGreaterThan(-1);
      expect(i, `순서가 틀렸다: ${part}`).toBeGreaterThan(at);
      at = i;
    }
  });

  it("🔴 F-3 조회가 돌지 않았으면 **아무것도 그리지 않는다**(기존 계약 유지)", () => {
    mount(null);
    expect(flat()).toBe("");
  });
});
