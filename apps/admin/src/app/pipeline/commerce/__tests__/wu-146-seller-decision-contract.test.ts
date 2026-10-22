// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  MARKET_RESULT_HEADING,
  SAME_CONFIRMED_COUNT_LABEL,
  /** 🔴 WU-148 — 🌎 해외는 «최저 확인가» 다(통화가 섞이면 하나로 고르지 않는다). */
  OVERSEAS_LOWEST_LABEL,
  OVERSEAS_LOWEST_PER_CURRENCY_NOTE,
  buildMarketJudgement,
  marketDecisionLines,
} from "../mi-same-candidates";
import { KNOWN_BLOCKER_TOKENS, blockerText } from "../blocker-text";
import { renderToStaticMarkup } from "react-dom/server";
/** 🔴 7-d — 후보 구역의 접힘은 **그 컴포넌트에서** 봐야 측정된다(아래 주석). */
import { GeminiTransientCandidates, type GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-146 — **Seller Decision 절대조건 7** (CPO STEP 7 · 2026-10-22)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **MI core frozen.** 이 파일은 **표현/배선만** 본다 — threshold ·
 *    SAME_MIN_AXES · MODEL_CODE · AUDIENCE_LINE · NO_TITLE_OVERLAP · BRAND_* ·
 *    SHOP_GATE · SHOP_REP · GARMENT_FORM · Registry · `price_alerts` ·
 *    MI CASE · 가격 계산 · DB schema **전부 불변** 이고 아래 단언 중 그것을
 *    요구하는 것이 **하나도 없다**.
 *
 * 🔴 **North Star** — 「상품 URL → MI 가 동일상품/판매상태/가격을 조사 → 셀러에게
 *    **판매 판단으로 압축**」. ⟹ 이 제품은 **후보를 많이 보여주는 조사 도구가 아니다.**
 *    후보 리스트는 주인공이 아니라 **예외가 생겼을 때 보는 evidence layer** 다(STEP 5).
 *
 * ── 🔴 절대조건 7 (CPO 문장 그대로) ──────────────────────────────────────────
 * ```
 * 1  seller-facing price owner = 1
 * 2  seller-facing final judgement = 1
 * 3  domestic/overseas = 동일 판단 영역
 * 4  SAME 0 ≠ 시장에 상품 없음
 * 5  가격 없음 ≠ 후보 삭제
 * 6  가격 없음 → 실제 candidate URL
 * 7  후보 상세는 기본 접힘
 * ```
 */

/**
 * 🔴🔴 **금지 표현은 이 파일에만 둔다.** 운영 소스에 상수로 두면 「소스에 그 말이
 *    없다」는 검사가 **자기 상수에 걸린다**(WU-145 에서 확인한 함정). 🟢 그리고 이
 *    파일의 단언은 **마운트 DOM** 축이라 주석·상수가 섞여 들어오지 않는다.
 */
const FORBIDDEN = [
  "국내 판매처 없음",
  "국내 경쟁상품 없음",
  "시장에 없음",
  "국내에 동일상품이 없",
  "국내 동일상품이 없습니다",
  "국내 상품이 없",
  "국내에서는 판매되지 않습니다",
  "국내 시장 가격이 없습니다",
  /** 🔴 CPO 명시 금지 — 우리가 가진 것은 **시장 기준가격** 이다(원가·수수료·마진 0). */
  "적정 판매가",
  "권장 판매가",
  "추천 판매가",
] as const;

/**
 * 🔴🔴 **「평균」은 리터럴 금지 목록에 넣을 수 없다 — 또 걸렸다.**
 *
 * 1차에 `"시장 평균"` 을 금지 목록에 넣었더니 **필수 부정문** 이 FAIL 했다:
 * `PRICE_GUIDE_SINGLE_NOTE = "확인 가능한 가격 1건 기준입니다 — 시장 평균가가 아닙니다."`
 * 🟢 그 문장은 **지켜야 하는 것** 이다(1건을 평균으로 읽지 않게 막는다 · WU-139).
 * ⟹ 🔴 가드를 느슨하게 하지 않고 **「평균은 부정문으로만」** 으로 바꾼다(wu-144 E 와 같은 규칙).
 * 🔴 WU-139 · WU-144 가 **이미 적어 둔 함정** 인데 세 번째로 밟았다 — 그래서 여기 적는다.
 */
const expectAverageOnlyInNegation = (text: string): void => {
  for (const m of text.match(/[^.。]*평균[^.。]*/g) ?? []) {
    expect(m, `평균이 긍정문에 쓰였다: ${m}`).toMatch(/아닙니다|아니다/);
  }
};

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
 * 🟢 **S1/S2 는 WU-144 의 라이브 실측값 그대로다**(CPO STEP 6: 「새 fixture 를 만들지
 *    않는다」). 🔴 두 상품 **모두 🇰🇷 국내 SAME 0** 이고 그것이 **정상 상태** 다
 *    (WU-138 에서 원인 확정 · 완화 REJECT · WU-143 에서 네 레버 전부 되돌렸다).
 * ```
 * S1 B226AC010  🌎 SAME 3 · 판매중 0 · 가격 3통화(CAD 64 · GBP 37 · USD 58)
 * S2 B226AC009  🌎 SAME 3 · 판매중 1 · 가격 2곳(USD 58) · **가격 확인 필요 1**
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
  /** 🔴 **가격을 못 가져온 SAME** — 절대조건 5·6 의 분모다. */
  row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/3" }),
];
/** 🟢 국내에 SAME 이 **있는** 모양 — 「국내 0」 분기와 대조하기 위한 대조군이다. */
const KR_SAME: GeminiTransientRow[] = [
  row({ domain: "biskuit.kr", discoveredUrl: "https://biskuit.kr/p/1", market: "KR", priceAmount: 88000, priceCurrency: "KRW", priceStatus: "VERIFIED_CURRENT" }),
];
/** 🟢 보류 후보(가격 있고 SAME 아님) — 절대조건 7(blocker 1차 비노출)의 분모다. */
const PENDING: GeminiTransientRow = row({
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
const all = (id: string) => container.querySelectorAll(`[data-testid="${id}"]`);
const flat = (): string => (container.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * 🔴🔴 **1차 화면 = 「▸」 접힘 «밖»** 이다. React 는 `details` 가 닫혀 있어도 자식을
 *    렌더하므로 `textContent` 를 그대로 재면 **2차까지 섞여** 측정이 거짓이 된다.
 */
const firstScreenText = (): string => {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
};

/* ═══════════════ 1·2. owner 는 각각 «하나» 다 ═══════════════ */

describe("1·2. seller-facing price owner = 1 · final judgement = 1", () => {
  it("🔴🔴 1-a 결론 요소가 **정확히 하나** 다 — 두 곳이 결론을 말하면 셀러가 어느 쪽을 믿는다", () => {
    for (const rows of [S1, S2, KR_SAME, [...S2, PENDING], []]) {
      mount(rows);
      expect(all("seller-decision").length, `결론 owner 가 하나가 아니다: ${flat().slice(0, 40)}`).toBe(1);
      /** 🔴 WU-145 의 옛 owner 가 **되돌아오지 않는다**. */
      expect(q("market-price-judgement")).toBeNull();
    }
  });

  it("🔴🔴 1-b 가격 **숫자** 의 출처가 하나다 — 결론과 근거 줄이 **같은 값** 을 쓴다", () => {
    mount(S1);
    const decision = q("seller-decision")!.textContent ?? "";
    const range = q("market-price-range")!.textContent ?? "";
    /**
     * 🔴 `sellerDecision` 이 **자기 집계를 만들지 않는다**(`judgement.byCurrency` 를 읽는다)
     *    ⟹ 세 통화의 금액이 두 자리에서 **글자 그대로 같다**. 어긋나면 집계가 둘이다.
     */
    for (const n of ["CAD 64", "GBP 37", "USD 58"]) {
      expect(decision, `결론에 없다: ${n}`).toContain(n);
      expect(range, `근거 줄에 없다: ${n}`).toContain(n);
    }
    /** 🔴 환산 **0** — 세 통화를 하나로 합치지 않는다(CPO 명시). */
    expect(flat()).not.toContain("₩");
    expect(flat()).not.toContain("약 ");
  });

  it("🔴 1-c 결론이 **1차 화면** 에 있다 — 접힘 뒤로 숨지 않는다", () => {
    mount(S2);
    expect(firstScreenText()).toContain(MARKET_RESULT_HEADING);
    /**
     * 🔴 **WU-148 에서 갱신** — 결론 문구가 **시장별 해석** 으로 갈렸다
     *    (🇰🇷 「시장 가격대」 · 🌎 「최저 확인가」) ⟹ 「확인된 기준가격」이라는
     *    **시장 공통 문구가 사라졌다.** 🟢 S2 는 해외 단일 통화라 그 해석이 나온다.
     */
    expect(firstScreenText()).toContain(OVERSEAS_LOWEST_LABEL);
    expect(firstScreenText()).toContain("USD 58");
  });
});

/* ═══════════════ 3. 국내/해외는 «한» 판단 영역이다 ═══════════════ */

describe("3. domestic/overseas = 동일 판단 영역", () => {
  it("🔴🔴 3-a 판단 영역이 **하나** 이고 그 «안» 에서 두 시장이 갈린다", () => {
    mount([...S2, ...KR_SAME]);
    expect(all("market-price-comparison").length).toBe(1);
    const area = q("market-price-comparison")!;
    for (const id of ["market-block-domestic", "market-block-overseas", "seller-decision"]) {
      expect(area.querySelector(`[data-testid="${id}"]`), `영역 밖에 있다: ${id}`).not.toBeNull();
    }
  });

  it("🔴 3-b 두 시장이 **서로의 숫자를 쓰지 않는다** — 환산도 전이도 0", () => {
    mount([...S2, ...KR_SAME]);
    const kr = q("market-block-domestic")!.textContent ?? "";
    const os = q("market-block-overseas")!.textContent ?? "";
    expect(kr).toContain("KRW 88000");
    expect(kr).not.toContain("USD");
    expect(os).toContain("USD 58");
    expect(os).not.toContain("KRW");
  });
});

/* ═══════════════ 4. SAME 0 ≠ 시장에 상품 없음 ═══════════════ */

describe("4. SAME 0 은 «확정 0» 이지 «시장 부재» 가 아니다", () => {
  it("🔴🔴🔴 4-a 금지 표현이 **어디에도** 없다 — 국내 0 인 두 실측 상품에서", () => {
    for (const rows of [S1, S2, [...S2, PENDING], []]) {
      mount(rows);
      for (const bad of FORBIDDEN) {
        expect(flat(), `금지 표현이 나왔다: ${bad}`).not.toContain(bad);
      }
      /** 🔴 「평균」은 **부정문으로만** — 리터럴 금지로는 필수 부정문이 걸린다(위 주석). */
      expectAverageOnlyInNegation(flat());
    }
  });

  it("🟢 4-b 「동일상품 확인 0곳」은 **허용** 이다 — 숫자는 사실이다", () => {
    mount(S2);
    expect(q("market-empty-domestic")?.textContent).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 0곳`);
  });

  it("🔴🔴 4-c 국내 0 의 결론은 **「해외를 기준으로 참고」** 다 — 단정하지 않는다", () => {
    mount(S2);
    const d = q("seller-decision")!.textContent ?? "";
    expect(d).toContain("현재 확인된 국내 동일상품 가격은 없습니다");
    expect(d).toContain("해외에서 확인된 동일상품 가격을 기준으로 참고할 수 있습니다");
  });

  it("🔴🔴 4-d 해외에 **가격이 없으면** 그 참고 문장을 **쓰지 않는다**(CPO 조건)", () => {
    /** 🔴 국내 0 + 해외 SAME 은 있는데 **가격이 없다** ⟹ 기준으로 삼을 것이 없다. */
    mount([row({ domain: "global.trenbe.com", discoveredUrl: "https://global.trenbe.com/p/3" })]);
    const d = q("seller-decision")!.textContent ?? "";
    expect(d).not.toContain("기준으로 참고할 수 있습니다");
    expect(d).toContain("확인된 판매가가 아직 없습니다");
  });

  it("🟢 4-e 국내에 SAME 이 **있으면** 그 참고 문장이 **사라진다**(상태별이 맞다)", () => {
    mount(KR_SAME);
    const d = q("seller-decision")!.textContent ?? "";
    expect(d).not.toContain("현재 확인된 국내 동일상품 가격은 없습니다");
    expect(d).toContain("국내");
  });

  it("🔴 4-f 후보가 0 이어도 **「없다」로 끝내지 않는다** — 어디서 보는지 말한다", () => {
    mount([]);
    const d = q("seller-decision")!.textContent ?? "";
    expect(d).toContain("아직 동일상품으로 확정된 판매처가 없습니다");
    expect(d).toMatch(/상세 근거|판단 근거/);
  });
});

/* ═══════════════ 5·6. 가격 없음 ≠ 후보 삭제 · 실제 URL ═══════════════ */

describe("5·6. 가격 없는 동일상품을 버리지 않고 링크를 준다", () => {
  it("🔴🔴 5-a 가격 없는 SAME 이 **판매처 수에 들어간다** — 조용히 사라지지 않는다", () => {
    mount(S2);
    /** 🟢 S2 는 SAME 3곳 중 가격 확인 2곳 · 확인 필요 1곳 — **셋 다** 보인다. */
    const os = q("market-block-overseas")!.textContent ?? "";
    expect(os).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 3곳`);
    expect(os).toContain("가격 확인 2곳");
    expect(os).toContain("가격 확인 필요 1곳");
    expect(all("market-seller-row").length).toBe(3);
  });

  it("🔴🔴 6-a 그 자리가 **실제 candidate URL** 이다 — 글자가 아니라 링크다", () => {
    mount(S2);
    const link = q("market-seller-price-link");
    expect(link).not.toBeNull();
    /** 🔴 **그 후보의 URL** 이어야 한다 — 다른 데로 보내면 셀러가 확인할 수 없다. */
    expect(link!.getAttribute("href")).toBe("https://global.trenbe.com/p/3");
    expect(link!.getAttribute("target")).toBe("_blank");
    /** 🔴 그 링크가 **1차 화면** 에 있다 — 접힘 뒤면 「확인할 수 있다」가 거짓이다. */
    expect(firstScreenText()).toContain("가격 확인");
  });

  it("🔴 6-b 결론이 그 사실을 **말한다** — 숫자만 보여주지 않는다", () => {
    mount(S2);
    expect(q("seller-decision")!.textContent).toContain("일부 판매처의 가격은 직접 확인이 필요합니다");
  });

  it("🟢 6-c 전건 가격이 있으면 **그 문장을 만들지 않는다**(없는 말 금지)", () => {
    mount(S1);
    expect(q("seller-decision")!.textContent).not.toContain("직접 확인이 필요합니다");
    expect(q("market-seller-price-link")).toBeNull();
  });
});

/* ═══════════════ 7. 후보 상세·blocker 는 2차다 ═══════════════ */

describe("7. 후보 상세는 기본 접힘 · blocker 는 1차에 없다", () => {
  it("🔴🔴 7-a 1차에 **열린 접힘이 없다** — 후보가 「유력」으로 읽히면 2026-09-19 사고다", () => {
    for (const rows of [S1, S2, [...S2, PENDING], KR_SAME]) {
      mount(rows);
      expect(container.querySelector("details[open]")).toBeNull();
      expect(container.querySelectorAll("details").length).toBeGreaterThan(0);
    }
  });

  it("🔴🔴 7-b MI blocker 를 **1차에서 셀러에게 떠넘기지 않는다** — 표 전수로 확인", () => {
    mount([...S2, PENDING]);
    const first = firstScreenText();
    for (const token of KNOWN_BLOCKER_TOKENS) {
      expect(first, `1차에 사유가 남았다: ${blockerText(token)}`).not.toContain(blockerText(token));
      expect(flat(), `내부 토큰이 노출됐다: ${token}`).not.toContain(token);
    }
  });

  it("🟢 7-c 그 사유는 **2차에 그대로** 있다 — 삭제가 아니라 계층이다", () => {
    mount([...S2, PENDING]);
    const reasons = q("mi-same-pending-reasons");
    expect(reasons).not.toBeNull();
    expect(reasons!.textContent).toContain("브랜드 미확인");
    expect(q("mi-detail-fold")!.contains(reasons!)).toBe(true);
  });

  /**
   * 🔴🔴 **변이가 이 계약의 구멍을 찾았다.** 7-a/7-b 는 `MarketPriceComparison` 을
   *    마운트하는데 **후보 구역은 이 컴포넌트가 렌더하지 않는다**(패널의 몫) ⟹
   *    `Fold` 를 **전면 무력화** 하는 변이(N5)에서 **7-a 가 통과했다**.
   * 🟢 그래서 후보 구역의 접힘을 **그 컴포넌트에서 직접** 단언한다 — STEP 5 의
   *    「후보 리스트는 주인공이 아니라 evidence layer」가 이 자리에서만 측정된다.
   */
  it("🔴🔴 7-d 후보 구역이 **접힘을 만든다** — evidence layer 가 1차로 올라오지 않는다", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: S2 as GeminiTransientRow[],
        heading: "🌎 해외 자동검색 후보",
        collapsed: true,
      }) as never,
    );
    /** 🔴 `<details>` 가 **실제로** 만들어져야 한다(`<p>` 로 펼치면 1차 화면이 된다). */
    expect(html).toContain('<details data-testid="candidate-fold"');
    /** 🔴 `open` 금지 — 붙이면 2026-09-19 사고(「유력 후보 5건」)의 기전이다. */
    expect(html).toMatch(/<details data-testid="candidate-fold"(?![^>]*\bopen\b)/);
    /** 🟢 행은 **사라지지 않는다** — 접기만 했다(삭제가 아니라 계층이다). */
    expect(html).toContain("global.trenbe.com");
  });
});

/* ═══════════════ STEP 4 — 셀러가 실제로 얻는 정보만 (Q1~Q7) ═══════════════ */

describe("STEP 4 — CPO Q1~Q7", () => {
  it("🟢🟢 Q1·Q3·Q4 첫 화면에서 **후보를 열지 않고** 시장·수량·가격·확인 경로를 읽는다", () => {
    mount(S2);
    const first = firstScreenText();
    /** Q1 — 후보 URL 목록이 1차에 **펼쳐져 있지 않다**. */
    expect(container.querySelector("details[open]")).toBeNull();
    /** Q3 — 가격대가 바로 보인다. */
    expect(first).toContain("USD 58");
    /** Q4 — 가격 없는 곳은 **어디를 누를지** 보인다. */
    expect(first).toContain("가격 확인");
    /** 🟢 그리고 시장·수량이 보인다. */
    expect(first).toContain("🇰🇷");
    expect(first).toContain("🌎");
    expect(first).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 3곳`);
  });

  it("🔴 Q2 셀러에게 **동일/유사 판단을 다시 시키지 않는다** — 1차에 판정 요구 문구 0", () => {
    mount([...S2, PENDING]);
    const first = firstScreenText();
    for (const bad of ["동일상품인지 확인해", "직접 판단해", "유사상품인지"]) {
      expect(first, `셀러에게 판정을 떠넘긴다: ${bad}`).not.toContain(bad);
    }
  });

  it("🟢 Q5·Q6 두 상품에서 **같은 구조·같은 숫자** 다 — 충돌 0", () => {
    for (const rows of [S1, S2]) {
      mount(rows);
      /** Q5 — 영역 하나 · 결론 하나. */
      expect(all("market-price-comparison").length).toBe(1);
      expect(all("seller-decision").length).toBe(1);
      /** Q6 — 결론의 금액이 근거 줄의 금액과 **같다**(1-b 의 두 상품 버전). */
      const d = q("seller-decision")!.textContent ?? "";
      for (const c of q("market-price-range")!.querySelectorAll("li")) {
        const cur = (c.textContent ?? "").split(" ")[0];
        if (cur) expect(d, `결론에 ${cur} 가 없다`).toContain(cur);
      }
    }
  });
});

/* ═══════════════ 순수 함수 축 — 상태 기계 ═══════════════ */

describe("순수 함수 — sellerDecision 상태 기계", () => {
  const kindOf = (rows: GeminiTransientRow[]) => marketDecisionLines(buildMarketJudgement(rows)).kind;

  it("🟢 세 상태가 **입력에 따라 갈린다**", () => {
    expect(kindOf([])).toBe("NO_SAME");
    expect(kindOf([row({})])).toBe("SAME_NO_PRICE");
    expect(kindOf(S1)).toBe("PRICED");
  });

  it("🔴 단일 통화 1건을 **「가격대」로 적지 않는다** · 여러 통화는 **나란히**", () => {
    const one = marketDecisionLines(buildMarketJudgement(S2)).lines.join(" ");
    expect(one).toContain("USD 58");
    expect(one).not.toContain("58 ~ 58");
    expect(one).not.toMatch(/평균|적정|권장/);
    /**
     * 🔴🔴 **WU-148 에서 갱신·강화됨** — 통화가 섞이면 **최저가를 하나로 고르지 않는다.**
     *    S1 은 CAD 64 · GBP 37 · USD 58 세 통화고, 거기서 「GBP 37 이 최저」라고 적으면
     *    **거짓** 이다(비교에 환산이 필요하고 환산은 금지다). 🟢 통화별로 나란히 적고
     *    **그 사실을 문장으로도** 말한다 ⟹ 단언이 하나 늘었다.
     */
    const many = marketDecisionLines(buildMarketJudgement(S1)).lines.join(" ");
    for (const n of ["CAD 64", "GBP 37", "USD 58"]) expect(many).toContain(n);
    expect(many).toContain(OVERSEAS_LOWEST_PER_CURRENCY_NOTE);
  });

  it("🔴 **금지 표현이 결론 문장에 없다**(순수 축에서도)", () => {
    for (const rows of [[], [row({})], S1, S2, KR_SAME]) {
      const lines = marketDecisionLines(buildMarketJudgement(rows)).lines.join(" ");
      for (const bad of FORBIDDEN) expect(lines, `금지 표현: ${bad}`).not.toContain(bad);
      /** 🔴 결론 문장은 **평균을 아예 쓰지 않는다**(필수 부정문은 가격 가이드의 것이다). */
      expect(lines).not.toContain("평균");
      /** 🔴 문장이 **하나라도** 있어야 한다 — 「결론 없음」은 상태가 아니다. */
      expect(lines.length).toBeGreaterThan(0);
    }
  });
});
