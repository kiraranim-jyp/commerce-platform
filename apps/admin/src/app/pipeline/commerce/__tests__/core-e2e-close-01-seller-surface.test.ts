/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { GeminiTransientCandidates, type GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CLOSE-01 §6/§7 — **셀러 화면이 무엇을 말하고 무엇을 숨기는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO LOCK: 「우리 제품은 **동일상품 판정기가 아니다**. AI 가 좋은 후보를 찾고,
 *    동일상품 **가능성** 을 보여주고, **가격을 붙여** 셀러가 판단하게 하는 서비스다.」
 *
 * 🔴🔴 그래서 이 파일이 보는 것은 정확도가 아니라 **화면의 전달** 이다:
 * ```
 * 보여야 함   후보 상품 · 판매처 · URL · 동일상품 가능성 · 가격 · 통화 ·
 *             국내/해외 · 후보 선택
 * 숨겨야 함   matcher score · threshold · matchTruth · 내부 blocker 토큰 ·
 *             Evidence hash · normalization · provenance · audit 정보
 * ```
 * 🔴 **QA X-Ray 와 Production UI 를 혼동하지 않는다**(CPO §9).
 * 🔴 운영 코드 변경 **0** · Search **0** · 판정 **0** · 가격 **0**.
 *
 * 🟢 입력은 **실측 후보** 다(DIF-02 · 새 Search 0):
 *    `miniboutique.co.kr` 🇰🇷 ₩117,000 SAME · `junioredition.com` 🌎 GBP 37 SAME ·
 *    `cissywears.com` 🌎 GBP 33 PRESUMED_SAME(가격 있음) · 가격 없는 후보 1
 */

const ROWS: GeminiTransientRow[] = [
  {
    domain: "miniboutique.co.kr",
    title: "메인스토리 버블 스웨트셔츠 AW26MS185",
    discoveredUrl: "https://miniboutique.co.kr/product/detail.html?product_no=1",
    crossSellerVerdict: "SAME",
    priceAmount: 117000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    source: "WEB_SEARCH",
  },
  {
    domain: "junioredition.com",
    title: "Hug Hairy Monster T-shirt by Bobo Choses",
    discoveredUrl: "https://www.junioredition.com/products/hug-hairy-monster-t-shirt-by-bobo-choses",
    crossSellerVerdict: "SAME",
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    source: "OVERSEAS_AUTO",
  },
  {
    domain: "cissywears.com",
    title: "Bobo Choses Baby Hug Hairy Monster T-Shirt",
    discoveredUrl: "https://cissywears.com/products/bobo-choses-baby-hug-hairy-monster-t-shirt",
    crossSellerVerdict: "PRESUMED_SAME",
    priceAmount: 33,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    source: "REVIEWED_SAME",
  },
  {
    /** 🔴 가격이 **없는** 후보 — 버리지 않고 「가격 미확인」이라고 적어야 한다(CPO §8). */
    domain: "trenbe.com",
    title: "Bobo Choses Hug Hairy Monster T-shirt",
    discoveredUrl: "https://global.trenbe.com/product/1",
    crossSellerVerdict: "PRESUMED_SAME",
    priceAmount: null,
    priceCurrency: null,
    market: "OVERSEAS",
    source: "WEB_SEARCH",
  },
];

function mount(props: Parameters<typeof GeminiTransientCandidates>[0]): HTMLDivElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => {
    root.render(createElement(GeminiTransientCandidates, props));
  });
  return host;
}
/** 🟢 접힘을 펼친 «전체» 텍스트 — 후보 상세는 접혀 있어도 내용은 있어야 한다. */
const allText = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ");

/**
 * 🔵🔵 CORE-E2E-CLOSE-04 — 후보 선택 저장의 **유일한 owner** 다(패널에서 «옮겼다»).
 * 🔴 그 파일을 지우거나 POST 를 되돌리면 아래 단언들이 **전부** FAIL 한다.
 */
const HOOK_SRC = readFileSync(
  join(__dirname, "..", "use-candidate-review.ts"),
  "utf8",
);

describe("CORE-E2E-CLOSE-01 §6 — 셀러가 **봐야 할 것** 이 화면에 있다", () => {
  it("E1 🟢 판매처 · 상품명 · 가격 · 통화 · 국내/해외 가 **전부** 보인다", () => {
    const t = allText(mount({ evidence: ROWS }));
    /** 판매처 + 상품명 */
    expect(t).toContain("miniboutique.co.kr");
    expect(t).toContain("junioredition.com");
    expect(t).toContain("메인스토리 버블 스웨트셔츠");
    /** 🔴 가격은 **통화를 그대로** 붙인다(환산 금지 · WU-056 계약). */
    expect(t).toContain("KRW");
    expect(t).toContain("GBP");
    expect(t).toContain("117,000");
    /** 🔴 국내/해외가 **말로** 적힌다(UNKNOWN 은 아무 말도 하지 않는다). */
    expect(t).toContain("국내");
    expect(t).toContain("해외");
  });

  it("E2 🟢 후보 **URL 이 링크로** 있다 — 셀러가 열어볼 수 있다", () => {
    const host = mount({ evidence: ROWS });
    const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const r of ROWS) expect(hrefs, r.domain).toContain(r.discoveredUrl);
  });

  it("E3 🟢 동일상품 **가능성** 이 행마다 적힌다 — 판정 라벨이 있다", () => {
    const host = mount({ evidence: ROWS });
    expect(host.querySelectorAll('[data-testid="gt-verdict"]').length).toBe(ROWS.length);
  });

  /** 🔴 가격이 없는 후보를 **버리지 않는다** — 그 사실을 적는다(CPO §8). */
  it("E4 🔴 가격 없는 후보도 **남고** 「가격 미확인」이라고 적는다", () => {
    const t = allText(mount({ evidence: ROWS }));
    expect(t).toContain("trenbe.com");
    expect(t).toContain("가격 미확인");
  });
});

describe("CORE-E2E-CLOSE-01 §6 — 🔴 **숨겨야 할 것** 이 화면에 없다", () => {
  /**
   * 🔴🔴 CPO §9 금지 목록. 내부 토큰이 셀러 화면에 뜨면 그것은 **QA X-Ray** 다.
   * 🟢 `review`/`onReview` 를 준 상태(= 셀러 선택이 켜진 상태)로 본다 — 가장 넓은 면이다.
   */
  it("E5 🔴 내부 토큰이 **하나도** 노출되지 않는다", () => {
    const t = allText(
      mount({
        evidence: ROWS,
        review: {},
        onReview: () => {},
        saveState: {},
      }),
    );
    const FORBIDDEN = [
      "matchTruth",
      "TEXT_CONFIRMED",
      "STRONG_IDENTIFIER",
      "EXACT_IDENTIFIER",
      "NO_TITLE_OVERLAP",
      "AUDIENCE_LINE",
      "MODEL_CODE_AGE_LINE",
      "BRAND_MISMATCH",
      "SAME_SELLER_DISTINCT_LISTING",
      "EVIDENCE_NOT_WORTHWHILE",
      "priceTier",
      "COMPARISON",
      "EXCLUDED",
      "matchLevel",
      "threshold",
      "Apify",
      "WEB_SEARCH",
      "OVERSEAS_AUTO",
      "REVIEWED_SAME",
      "provenance",
      "normalization",
    ];
    for (const w of FORBIDDEN) expect(t, `🔴 내부 토큰 노출: ${w}`).not.toContain(w);
  });

  /** 🔴 영문 verdict 토큰 자체도 셀러 어휘로 바뀌어야 한다(WU-056 `TIER_LABEL` 규약). */
  it("E6 🔴 `PRESUMED_SAME` 같은 **영문 판정 토큰** 이 그대로 뜨지 않는다", () => {
    const t = allText(mount({ evidence: ROWS }));
    for (const w of ["PRESUMED_SAME", "SIMILAR", "CONFLICT", "UNKNOWN"])
      expect(t, `🔴 내부 verdict 토큰 노출: ${w}`).not.toContain(w);
  });
});

describe("CORE-E2E-CLOSE-01 §7 — 셀러가 후보를 **선택할 수 있다**", () => {
  /** 🔴 선택 UI 는 `onReview` 가 있을 때만 뜬다(WU-081) — 그 배선을 확인한다. */
  it("E7 🟢 선택 버튼이 렌더되고 클릭이 콜백을 부른다", () => {
    const picked: string[] = [];
    const host = mount({
      evidence: ROWS,
      review: {},
      onReview: (url) => picked.push(url),
      saveState: {},
    });
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons.length, "선택 버튼이 없다").toBeGreaterThan(0);
    act(() => {
      buttons[0]!.click();
    });
    expect(picked.length, "🔴 클릭이 선택 콜백을 부르지 않는다").toBeGreaterThan(0);
    expect(ROWS.map((r) => r.discoveredUrl)).toContain(picked[0]);
  });

  /** 🔴 `onReview` 가 없으면 선택 UI 가 **아예 없다** — 기존 구역 불변(WU-081 계약). */
  it("E8 🔴 `onReview` 없으면 선택 UI 가 **렌더되지 않는다**", () => {
    const host = mount({ evidence: ROWS });
    expect(host.querySelectorAll("button").length).toBe(0);
  });

  /**
   * 🟢 §7 — 선택 결과가 **저장 경로로 간다**(WU-131 `candidate-reviews`).
   * 🔴 그 경로를 여기서 다시 감사하지 않는다(CPO §10) — **배선만** 확인한다.
   */
  it("E9 🟢 패널이 선택을 `candidate-reviews` 로 보낸다(배선)", () => {
    const panel = readFileSync(join(__dirname, "../DomesticPriceIntelligencePanel.tsx"), "utf8");
    const code = panel.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
        /**
     * 🔴🔴 **CORE-E2E-CLOSE-04 — 이 앵커의 «위치» 가 바뀌었다. 성질은 그대로다.**
     *    저장 로직(이력 읽기 · 낙관적 저장 · 실패 되돌림 · POST)이 패널 «안» 에서
     *    `candidate-review.ts` 의 `useCandidateReview` 로 **옮겨졌다**(복제 0).
     *    🔴 패널이 `HIDDEN`(→ `return null`)이라 셀러가 **고를 수 없었던** 것이
     *       CORE-E2E 의 마지막 구멍이었고, 결론 영역이 그 핸들러에 닿게 했다.
     * 🟢 그래서 **owner 파일을 보도록** 고쳤고, 패널은 그것을 «쓴다» 는 것까지 단언한다.
     */
    expect(HOOK_SRC).toContain("/candidate-reviews`, {");
    expect(code).toContain("useCandidateReview(");
    expect(code).toContain("onDomesticReview");
  });
});
