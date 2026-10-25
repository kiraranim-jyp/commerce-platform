/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices } from "../../../api/price-history/_lib/candidate-market";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  COST_REQUIRED_NOTE,
  COST_REQUIRED_SCOPE,
  MARKET_EMPTY_REVIEW_HINT,
  MARKET_VERDICT_TEXT,
  NEXT_STEP_HEADING,
  PRICE_BASIS_CURRENCY_LINE,
  PRICE_BASIS_HEADING,
  PRICE_BASIS_REFERENCE_LINE,
  PRICE_BASIS_SAME_LINE,
  PRICE_BASIS_SINGLE_SELLER_LINE,
  PRICE_BASIS_SOURCE_LINE,
  SAME_CHECK_HEADING,
  SAME_CONFIRMED_COUNT_LABEL,
  buildMarketJudgement,
  buildPriceGuide,
  marketDecisionLines,
  nextStepLines,
  priceBasisLines,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2S — **셀러가 10초 안에 이해하는 «하나의 의사결정 화면»**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 **백엔드 트랙(CORE-2R)은 CLOSED** 다 — 수집·전달은 CEO Production 으로 닫혔다
 *    (🇰🇷 `KRW 88,000` · 판매처 1곳 / 🌎 `GBP 37` · `USD 58`). 이 파일은 **그 숫자가
 *    화면에서 올바르게 «읽히는가»** 만 잠근다. 🔴 MI·판정·집계·가격 수집은 **무변경** 이다.
 *
 * ── 🔴🔴 이 WU 가 고친 «모순» 한 줄 ─────────────────────────────────────────────
 * ```
 * 「국내 참고가격 **1곳**」 과 「동일상품 확정 **0곳**」 은 **모순이 아니다.**
 * 그 둘을 화면에서 **분리해 설명** 하는 것이 CORE-2S 의 전부다(CPO §2).
 * ```
 * 🔴 전 화면에서 셀러는 첫 줄로 **「0곳」** 을 읽었고, 그 아래의 `KRW 88,000` 은
 *    「그래도 없는 것」으로 읽혔다. 그리고 같은 「0」이 **네 곳**(결론 · verdict ·
 *    🇰🇷 블록 · 🌎 블록)에서 반복됐다.
 *
 * ── 🔴 잠그는 축 여덟 ───────────────────────────────────────────────────────────
 * ```
 * A 🇰🇷 가격이 1차에 · 「동일상품 확인」보다 **먼저**        E 💡 가격 판단 기준(금액 0)
 * B 🌎 가격이 1차에 · 통화 **분리**(합치지 않는다)          F 🧾 원가 보류(UNKNOWN ≠ 실패)
 * C 결론이 **참고가격을 말한다**(모순 제거)                  G **중복 0**(verdict 2차 · 금액 1회)
 * D 셀러에게 **일을 돌려주지 않는다**                        H MI/가격 산출 **불변**
 * ```
 */

const COMMERCE = join(__dirname, "..");
/** 🔴 소스 검사는 **주석을 벗기고** 한다(이 저장소에서 여덟 번 걸린 함정). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const AREA = strip(readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8"));
const PANEL = strip(readFileSync(join(COMMERCE, "DomesticPriceIntelligencePanel.tsx"), "utf8"));
const WORKSPACE = strip(readFileSync(join(COMMERCE, "..", "CommerceWorkspace.tsx"), "utf8"));

/* ═════════════════════════ fixture — CEO Production 실측 ═════════════════════════ */

/** 🟢 CORE-2R-4 실측 그대로 — 국내 후보 둘, 둘 다 `PRESUMED_SAME` ⟹ **SAME 축은 0** 이다. */
const ROWS: GeminiTransientRow[] = [
  {
    domain: "donokids.com",
    discoveredUrl: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785",
    title: "[보보쇼즈] Hug Hairy Monster T-shirt #226AC009",
    priceAmount: 88000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    soldOut: null,
    matchTruth: "TEXT_CONFIRMED",
    crossSellerVerdict: "PRESUMED_SAME",
  },
];

/** 🟢 CEO 가 본 그 값 — **판매처 1곳**(§8 PASS 1). */
const KR_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "KR", currency: "KRW", amount: 88000, priceTier: "COMPARISON" },
]);
/** 🟢 CEO 가 본 그 값 — **두 통화**(§8 PASS 2 · 합치면 FAIL 한다). */
const OS_REF: OverseasPriceSummary = summarizeCandidateOverseasPrices([
  { market: "OVERSEAS", currency: "GBP", amount: 37, priceTier: "EXACT" },
  { market: "OVERSEAS", currency: "USD", amount: 58, priceTier: "COMPARISON" },
]);

/** 🟢 SAME 이 실제로 있는 대조군 — 반대 분기가 살아 있는지 같이 본다. */
const SAME_ROW: GeminiTransientRow = {
  ...ROWS[0],
  discoveredUrl: "https://junioredition.com/products/hug-hairy-monster",
  domain: "junioredition.com",
  market: "OVERSEAS",
  priceAmount: 37,
  priceCurrency: "GBP",
  matchTruth: "EXACT_IDENTIFIER",
  crossSellerVerdict: "SAME",
};

let host: HTMLDivElement;

/** 🔴 **마운트 DOM** 축이다 — Render PASS ≠ 소스 PASS(이 저장소의 반복 교훈). */
function mount(props: Parameters<typeof MarketPriceComparison>[0]): HTMLDivElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(createElement(MarketPriceComparison, props));
  });
  return host;
}

const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);
const text = (el: HTMLElement, id: string) => q(el, id)?.textContent ?? "";

/**
 * 🔴🔴 **셀러가 «실제로 보는» 첫 화면** — 닫힌 `<details>` 를 떼어 낸 텍스트다.
 *    (wu-146 이 쓰는 그 방법 그대로 — 접힘 안의 글자를 1차로 세면 거짓 PASS 가 난다)
 */
function firstScreen(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

/* ══════════════════ A. 🇰🇷 — 가격이 「0곳」보다 «먼저» 온다 ══════════════════ */

describe("A. 🇰🇷 국내 — 가격이 먼저, 판정이 뒤", () => {
  it("A-1 🟢🟢 SAME 0 인데 **KRW 88,000 · 확인 1곳** 이 첫 화면에 있다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const first = firstScreen(el);
    expect(first).toContain("KRW 88,000");
    /**
     * 🔴 **CORE-2T §4 에서 어휘가 바뀌었다** — 국내는 「확인 N곳」 · 해외는 「판매처 N곳」.
     *    🟢 지키는 성질(「1차에 국내 금액과 그 분모가 같이 선다」)은 **그대로** 다.
     */
    expect(first).toContain("확인 1곳");
    expect(first).toContain("국내 가격 형성대");
  });

  /**
   * 🔴🔴🔴 **이 단언이 CORE-2S 의 핵심이다.**
   *    가격이 「동일상품 확인 0곳」 **뒤** 에 오면 셀러는 「0 이니까 가격도 없다」로 읽는다.
   *    ⟹ 순서를 되돌리면 이 단언이 FAIL 한다.
   */
  it("A-2 🔴🔴 🇰🇷 블록 안에서 **가격이 「동일상품 확인」보다 먼저** 온다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF });
    const block = q(el, "market-block-domestic") as HTMLElement;
    const html = block.innerHTML;
    const price = html.indexOf('data-testid="domestic-reference"');
    const same = html.indexOf('data-testid="market-empty-domestic"');
    expect(price, "🔴 1차 🇰🇷 블록에 가격이 없다").toBeGreaterThan(-1);
    expect(same).toBeGreaterThan(-1);
    expect(price, "🔴 「동일상품 확인 0곳」이 가격보다 먼저 온다 — 셀러가 「없다」로 읽는다").toBeLessThan(same);
  });

  /**
   * 🔴 **축의 이름이 붙어 있어야** 두 숫자가 다른 축으로 읽힌다.
   *    수식어 없이 「1곳」과 「0곳」을 나란히 두면 **모순으로 보인다**(§2 의 그 모양).
   */
  it("A-3 🔴 「🔎 동일상품 확인」 라벨이 가격 줄과 판정 줄을 가른다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF });
    const block = q(el, "market-block-domestic") as HTMLElement;
    expect(block.textContent).toContain(SAME_CHECK_HEADING);
    /** 🔴 라벨은 가격 **뒤** · 판정 **앞** 이다(그 사이가 그 라벨의 자리다). */
    const html = block.innerHTML;
    expect(html.indexOf(SAME_CHECK_HEADING)).toBeGreaterThan(html.indexOf('data-testid="domestic-reference"'));
    expect(html.indexOf(SAME_CHECK_HEADING)).toBeLessThan(html.indexOf('data-testid="market-empty-domestic"'));
  });

  /** 🟢 「0곳」이라는 **숫자 자체는 남긴다** — 사실이고, 지우면 WU-145 가 되돌아간다. */
  it("A-4 🟢 「동일상품 확인 0곳」은 그대로 있다(숨기지 않는다)", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF });
    expect(text(el, "market-empty-domestic")).toContain(`${SAME_CONFIRMED_COUNT_LABEL} 0곳`);
  });
});

/* ══════════════════ B. 🌎 해외 — 🇰🇷 와 «같은 정보 구조» ══════════════════ */

describe("B. 🌎 해외 — 1차 · 통화 분리", () => {
  it("B-1 🟢🟢 **GBP 37 · USD 58 이 첫 화면** 에 있다(접힘을 열지 않아도)", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const first = firstScreen(el);
    expect(first, "🔴 해외 가격이 접힘 안에만 있다 — 🇰🇷 와 비대칭이다").toContain("GBP 37");
    expect(first).toContain("USD 58");
  });

  /** 🔴🔴 두 통화를 **하나의 범위로 합치지 않는다**(환산 금지의 화면 축). */
  it("B-2 🔴 통화를 합친 범위가 **없다**", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const whole = el.textContent ?? "";
    for (const bad of ["GBP 37 ~ 58", "37 ~ 58", "USD 37", "GBP 58"]) {
      expect(whole, `🔴 통화를 섞어 비교했다: ${bad}`).not.toContain(bad);
    }
  });

  /** 🔴 환산 흔적 0 — 기존 계약 여섯(`wu-141-r3`·`wu-144`·`wu-145`·`wu-146`·`wu-148`·`wu-139`). */
  it("B-3 🔴 영역 전체에 `₩`·`약 `·통화기호가 없다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const whole = el.textContent ?? "";
    expect(whole).not.toMatch(/[₩€$£¥]/);
    expect(whole).not.toContain("약 ");
  });

  /** 🔴 **같은 구조** 인지 본다 — 🌎 도 가격이 「동일상품 확인」보다 먼저여야 한다. */
  it("B-4 🔴 🌎 블록도 **가격 → 판정** 순서다(🇰🇷 와 같은 구조)", () => {
    const el = mount({ rows: ROWS, overseasReference: OS_REF });
    const html = (q(el, "market-block-overseas") as HTMLElement).innerHTML;
    const price = html.indexOf('data-testid="overseas-reference"');
    const same = html.indexOf('data-testid="market-empty-overseas"');
    expect(price).toBeGreaterThan(-1);
    expect(price).toBeLessThan(same);
  });
});

/* ══════════════ C. 결론 — 「1곳 ↔ 0곳」을 «같이» 말한다 ══════════════ */

describe("C. 결론이 참고가격을 말한다 — 모순 제거", () => {
  /**
   * 🔴🔴🔴 **CEO 화면의 모순이 살던 자리.** 참고가격이 있는데 결론이
   *    「없습니다」로만 끝나면 셀러는 바로 위의 `KRW 88,000` 을 무시한다.
   */
  it("C-1 🔴🔴 참고가격이 있으면 결론이 **그 사실을 말한다**", () => {
    const d = marketDecisionLines(buildMarketJudgement(ROWS), { domestic: KR_REF, overseas: OS_REF });
    expect(d.kind).toBe("NO_SAME_WITH_REFERENCE");
    const joined = d.lines.join(" ");
    expect(joined).toContain("국내");
    expect(joined).toContain("해외");
    expect(joined).toContain("참고가격");
    /** 🔴 **확정 가격으로 적지 않는다** — 그것이 참고 축과 SAME 축의 차이다. */
    expect(joined).toContain("확정된 동일상품 가격은 아닙니다");
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 **C-1-b 는 「C-1 이 통과했는데 화면은 안 바뀐다」를 막는다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **음성 대조가 내 구멍을 찾았다** — 컴포넌트에서 `marketDecisionLines(judgement,
   *    references)` 의 **두 번째 인자를 떼어 내도 C-1 이 통과했다.** C-1 은 순수 함수를
   *    **직접** 부르므로 **배선이 끊겨도 초록** 이다(WU-110 이 적어 둔 그 함정 —
   *    「판정 함수를 직접 부르는 테스트는 배선을 못 본다」).
   * 🟢 그래서 **마운트 DOM 축** 과 **소스 앵커** 를 같이 둔다.
   */
  it("C-1-b 🔴🔴 **화면의 결론 줄** 이 참고가격을 말한다(배선 축)", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const d = text(el, "seller-decision");
    expect(d, "🔴 결론이 참고가격을 말하지 않는다 — 배선이 끊겼다").toContain("참고가격");
    expect(d).toContain("확정된 동일상품 가격은 아닙니다");
    /** 🔴 소스 앵커 — 두 번째 인자를 떼면 FAIL 한다. */
    expect(AREA).toContain("marketDecisionLines(judgement, references)");
    expect(AREA).toContain("priceBasisLines(judgement, references)");
  });

  /** 🔴 **금액을 결론에서 또 적지 않는다** — 금액 owner 는 두 블록 하나다. */
  it("C-2 🔴 결론 문장에 금액이 **없다**(숫자 중복 금지)", () => {
    const d = marketDecisionLines(buildMarketJudgement(ROWS), { domestic: KR_REF, overseas: OS_REF });
    const joined = d.lines.join(" ");
    for (const n of ["88,000", "88000", "37", "58"]) {
      expect(joined, `🔴 결론이 금액을 적는다: ${n}`).not.toContain(n);
    }
  });

  /** 🟢 **refs 가 없으면 동작이 전과 똑같다** — 기존 호출부·계약이 바뀌지 않는다. */
  it("C-3 🟢 참고가격이 없으면 기존 `NO_SAME` 그대로다", () => {
    expect(marketDecisionLines(buildMarketJudgement(ROWS)).kind).toBe("NO_SAME");
    expect(marketDecisionLines(buildMarketJudgement(ROWS), {}).kind).toBe("NO_SAME");
    expect(marketDecisionLines(buildMarketJudgement([])).kind).toBe("NO_SAME");
  });

  /**
   * 🔴 **`count > 0` 만 보고 「있다」로 적지 않는다** — 통화 칸이 비면 참고가격 블록도
   *    렌더되지 않는다(`buildOverseasReference` 가 `null`) ⟹ 결론만 「확인됐습니다」면 거짓이다.
   */
  it("C-4 🔴 통화 칸이 빈 집계를 「가격이 있다」로 읽지 않는다", () => {
    const empty: OverseasPriceSummary = { count: 2, byCurrency: {}, byMarket: {}, byPriceTier: {} };
    expect(marketDecisionLines(buildMarketJudgement(ROWS), { domestic: empty }).kind).toBe("NO_SAME");
  });

  /** 🟢 SAME 이 **있으면** 기존 `PRICED` 분기가 그대로 산다(반대 분기 보존). */
  it("C-5 🟢 SAME 가격이 있으면 `PRICED` 다 — 기존 해석이 살아 있다", () => {
    const d = marketDecisionLines(buildMarketJudgement([SAME_ROW]), { domestic: KR_REF });
    expect(d.kind).toBe("PRICED");
    expect(d.lines.join(" ")).toContain("GBP 37");
  });
});

/* ══════════════ D. 셀러에게 «일» 을 돌려주지 않는다 ══════════════ */

describe("D. 셀러에게 조사/재분석을 요구하지 않는다", () => {
  /**
   * 🔴🔴🔴 **WU-154 가 입력칸을 폐기한 것과 «같은 이유» 다.** 그때 계약은
   *    `MarketPriceComparison.tsx` **소스만** 봤고, 문구는 상수 파일에 있어서
   *    「아래 후보 검토 구역에서 **사진으로 확인해 주세요**」가 **살아남았다**.
   * 🔴 그것은 셀러에게 **동일상품 판정을 시키는 말** 이고 North Star 와 충돌한다.
   */
  it("D-1 🔴🔴 첫 화면이 셀러에게 **판정·조사를 요구하지 않는다**", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const first = firstScreen(el);
    for (const bad of [
      "사진으로 확인",
      "직접 확인해",
      "직접 찾",
      "동일상품인지 확인해",
      "직접 판단해",
      "다시 분석",
      "URL 추가",
      "URL을 추가",
    ]) {
      expect(first, `🔴 셀러에게 일을 돌려준다: ${bad}`).not.toContain(bad);
    }
  });

  /** 🟢 **「어디서 볼 수 있는지」는 남긴다** — 그것이 WU-133 이 고친 거짓말을 막는다. */
  it("D-2 🟢 「어디서 볼 수 있는지」는 그대로 말한다", () => {
    expect(MARKET_EMPTY_REVIEW_HINT).toContain("MI 상세 분석");
    expect(MARKET_EMPTY_REVIEW_HINT).not.toContain("사진으로 확인");
  });

  /** 🔴 결론 영역에 입력칸·요청이 **없다**(`wu-154 A-1` 의 CORE-2S 버전). */
  it("D-3 🔴 결론 영역에 입력칸·요청이 없다", () => {
    expect(AREA).not.toMatch(/<input\b/);
    expect(AREA).not.toMatch(/<textarea\b/);
    expect(AREA).not.toContain("fetch(");
  });
});

/* ══════════════ E. 💡 가격 판단 기준 — 복구 ══════════════ */

describe("E. 💡 가격 판단 기준", () => {
  it("E-1 🟢🟢 **영역이 첫 화면에 선다**(접힘이 아니다)", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const first = firstScreen(el);
    expect(first).toContain(PRICE_BASIS_HEADING);
    expect(first).toContain(PRICE_BASIS_SOURCE_LINE);
  });

  /**
   * 🔴🔴 **CPO 고정 순서** — ② 🇰🇷 → ③ 🌎 → **④ 가격 판단 기준** → ⑤ 판매 판단.
   *    숫자 뒤 · 결론 앞이 이 영역의 자리다(wu-140 의 순서 계약과 충돌하지 않는다).
   */
  it("E-2 🔴 **시장 블록 뒤 · 결론 앞** 에 선다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF });
    const html = el.innerHTML;
    const at = (id: string) => html.indexOf(`data-testid="${id}"`);
    expect(at("market-blocks")).toBeLessThan(at("price-basis"));
    expect(at("price-basis")).toBeLessThan(at("market-judgement"));
  });

  /** 🔴 **금액을 적지 않는다** — 금액 owner 는 두 블록 하나다(§8 「중복 0」). */
  it("E-3 🔴 이 영역에 금액·내부 토큰이 **없다**", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const basis = text(el, "price-basis");
    for (const n of ["88,000", "88000", "GBP", "USD", "KRW"]) {
      expect(basis, `🔴 가격 판단 기준이 금액/통화를 적는다: ${n}`).not.toContain(n);
    }
    for (const token of [
      "COMPARISON",
      "PRESUMED_SAME",
      "EXACT",
      "TEXT_CONFIRMED",
      "crossSeller",
      "priceTier",
      "VERIFIED_CURRENT",
      "matchTruth",
    ]) {
      expect(basis, `🔴 내부 토큰이 노출됐다: ${token}`).not.toContain(token);
    }
  });

  /** 🔴 **상태별로 다른 말** 이다 — 상태와 무관한 안내문은 WU-146 이 지운 모양이다. */
  it("E-4 🔴 SAME 유무에 따라 **기준 문장이 갈린다**", () => {
    const ref = priceBasisLines(buildMarketJudgement(ROWS), { domestic: KR_REF });
    expect(ref).toContain(PRICE_BASIS_REFERENCE_LINE);
    expect(ref).not.toContain(PRICE_BASIS_SAME_LINE);

    const same = priceBasisLines(buildMarketJudgement([SAME_ROW]), {});
    expect(same).toContain(PRICE_BASIS_SAME_LINE);
    expect(same).not.toContain(PRICE_BASIS_REFERENCE_LINE);
  });

  /** 🔴 통화가 둘 이상일 때만 환산 금지 문장을 쓴다(없는 말을 적지 않는다). */
  it("E-5 🔴 통화 축 문장은 **통화가 둘 이상일 때만** 선다", () => {
    expect(priceBasisLines(buildMarketJudgement(ROWS), { domestic: KR_REF })).not.toContain(
      PRICE_BASIS_CURRENCY_LINE,
    );
    expect(
      priceBasisLines(buildMarketJudgement(ROWS), { domestic: KR_REF, overseas: OS_REF }),
    ).toContain(PRICE_BASIS_CURRENCY_LINE);
  });

  /** 🔴 국내 1곳이면 「가격대가 아니다」를 말한다(START-HERE §3 MARKET RULE). */
  it("E-6 🔴 국내 판매처 **1곳** 이면 「가격대가 아니다」를 말한다", () => {
    expect(priceBasisLines(buildMarketJudgement(ROWS), { domestic: KR_REF })).toContain(
      PRICE_BASIS_SINGLE_SELLER_LINE,
    );
    /** 🟢 SAME 축의 1건은 `PRICE_GUIDE_SINGLE_NOTE` 가 **이미** 말한다 — 두 번 적지 않는다. */
    expect(priceBasisLines(buildMarketJudgement([SAME_ROW]), { domestic: KR_REF })).not.toContain(
      PRICE_BASIS_SINGLE_SELLER_LINE,
    );
  });

  /** 🔴 가격이 하나도 없으면 **영역을 만들지 않는다**(빈 틀 금지). */
  it("E-7 🔴 가격이 없으면 영역이 **서지 않는다**", () => {
    expect(priceBasisLines(buildMarketJudgement([]), {})).toEqual([]);
    const el = mount({ rows: [] });
    expect(q(el, "price-basis")).toBeNull();
  });
});

/* ══════════════ F. 🧾 현재 판단 — UNKNOWN ≠ 실패 ══════════════ */

describe("F. 🧾 원가 보류 — 「데이터 없음」이 아니다", () => {
  it("F-1 🟢🟢 가격이 있고 원가가 없으면 **「수익성 판단 보류 · 원가 입력」**", () => {
    const el = mount({
      rows: ROWS,
      domesticReference: KR_REF,
      overseasReference: OS_REF,
      costPriceKrw: null,
    });
    const first = firstScreen(el);
    expect(first).toContain(NEXT_STEP_HEADING);
    expect(first).toContain(COST_REQUIRED_NOTE);
    /** 🔴🔴 **이 줄이 「실패로 보이는 것」을 막는다.** 지우면 UNKNOWN 이 다시 실패로 읽힌다. */
    expect(first).toContain(COST_REQUIRED_SCOPE);
  });

  it("F-2 🟢 원가가 있으면 그 줄이 **사라진다**(상태 기반)", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, costPriceKrw: 40000 });
    expect(q(el, "market-next-step")).toBeNull();
  });

  /** 🔴 가격도 없는데 원가를 요구하지 않는다 — 순서가 틀린 요구다. */
  it("F-3 🔴 가격이 없으면 원가를 요구하지 않는다", () => {
    expect(nextStepLines(false, null)).toEqual([]);
    const el = mount({ rows: [], costPriceKrw: null });
    expect(q(el, "market-next-step")).toBeNull();
  });

  /** 🔴 **계산하지 않는다** — 추천가·마진·예상수익 어휘가 이 영역에 0 이다(§3 금지축). */
  it("F-4 🔴 추천가·마진 어휘가 **없다**", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, costPriceKrw: null });
    const whole = el.textContent ?? "";
    for (const bad of ["추천 판매가", "권장 판매가", "적정 판매가", "마진율", "예상 이익"]) {
      expect(whole, `🔴 계산 어휘가 들어왔다: ${bad}`).not.toContain(bad);
    }
  });

  /** 🔴 배선이 끊기면 영구히 보류로 남는다 — **다섯 자리** 를 같이 본다(CORE-2R-5 함정). */
  it("F-5 🔴 `costPriceKrw` 배선이 **타입 → 패널 → Workspace → 영역** 으로 이어진다", () => {
    expect(PANEL, "🔴 MarketComparisonInput 에 칸이 없다").toContain("costPriceKrw: number | null");
    expect(PANEL, "🔴 패널이 응답의 원가를 올려보내지 않는다").toContain(
      "costPriceKrw: data?.currentPrice?.costPriceKrw ?? null",
    );
    expect(PANEL, "🔴 deps 에 없으면 원가를 넣어도 보류로 남는다").toContain(
      "data?.currentPrice?.costPriceKrw,",
    );
    expect(WORKSPACE).toContain("costPriceKrw={marketComparison?.costPriceKrw ?? null}");
    expect(AREA).toContain("costPriceKrw?: number | null");
  });
});

/* ══════════════ G. 중복 0 — 같은 사실을 두 번 말하지 않는다 ══════════════ */

describe("G. 중복 제거", () => {
  /**
   * 🔴🔴🔴 **SAME 0 에서 「0」이 네 번 반복됐다** — 결론 · verdict · 🇰🇷 · 🌎.
   *    `market-verdict` 는 결론과 **같은 사실의 분류 라벨** 이므로 2차로 내렸다.
   * 🔴 **지운 것이 아니다** — 같은 testid 로 접힘 안에 그대로 있다.
   */
  it("G-1 🔴🔴 `market-verdict` 가 **첫 화면에 없고** 2차에 **있다**", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF });
    expect(firstScreen(el), "🔴 분류 라벨이 1차에서 결론과 같은 말을 한다").not.toContain(
      MARKET_VERDICT_TEXT.NO_SAME,
    );
    const fold = q(el, "mi-detail-fold") as HTMLElement;
    expect(fold.querySelector('[data-testid="market-verdict"]')).not.toBeNull();
    expect(text(el, "market-verdict")).toBe(MARKET_VERDICT_TEXT.NO_SAME);
  });

  /** 🔴 **결론 owner 는 하나** 다(`wu-146` STEP 7-2 의 CORE-2S 확인). */
  it("G-2 🔴 결론 요소가 정확히 하나다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    expect(el.querySelectorAll('[data-testid="seller-decision"]').length).toBe(1);
    expect(q(el, "market-price-judgement")).toBeNull();
  });

  /** 🔴 **같은 금액이 화면에 한 번만** 뜬다(두 시장 각각). */
  it("G-3 🔴 금액이 화면에 **한 번만** 뜬다", () => {
    const el = mount({ rows: ROWS, domesticReference: KR_REF, overseasReference: OS_REF });
    const html = el.innerHTML;
    expect((html.match(/KRW 88,000/g) ?? []).length).toBe(1);
    expect((html.match(/GBP 37/g) ?? []).length).toBe(1);
    expect((html.match(/USD 58/g) ?? []).length).toBe(1);
    expect(el.querySelectorAll('[data-testid="domestic-reference"]').length).toBe(1);
    expect(el.querySelectorAll('[data-testid="overseas-reference"]').length).toBe(1);
  });
});

/* ══════════════ H. MI/가격 산출 불변 ══════════════ */

describe("H. 🔴 MI·가격 데이터는 **한 글자도** 바뀌지 않았다", () => {
  /**
   * 🔴🔴 **참고가격을 결론이 읽는 것이 판정에 영향을 주면 안 된다.**
   *    (`refs` 는 **문장 생성** 입력일 뿐이다 — 판정·집계의 입력이 아니다)
   */
  it("H-1 🔴 `refs` 를 넣어도 판정/집계 산출이 **동일하다**", () => {
    const j = buildMarketJudgement(ROWS);
    expect(j.sellers.length).toBe(0);
    expect(j.verdict).toBe("NO_SAME");
    expect(buildPriceGuide(j, "KR").sameCount).toBe(0);
    expect(buildPriceGuide(j, "OVERSEAS").sameCount).toBe(0);
    /** 🔴 참고가격이 SAME 축을 **만들지 않는다**(승격 0). */
    const withRefs = marketDecisionLines(j, { domestic: KR_REF, overseas: OS_REF });
    expect(withRefs.kind).not.toBe("PRICED");
    expect(buildMarketJudgement(ROWS).sellers.length).toBe(0);
  });

  /** 🔴 영역이 **판정·집계 함수를 만들지 않는다**(읽기만 한다). */
  it("H-2 🔴 영역에 판정/집계/승격 어휘가 없다", () => {
    for (const banned of [
      "SAME_MIN_AXES",
      "threshold",
      "computeMarketIntelligence",
      "summarizeCandidateOverseasPrices",
      "convertToKrw",
      "crossSellerReserved",
    ]) {
      expect(AREA, `🔴 ${banned} 가 표시 영역에 들어왔다`).not.toContain(banned);
    }
  });
});
