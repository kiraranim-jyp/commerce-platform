/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-NEXT STEP 4 — **권장 판매가격(A)이 결론 화면에서 끝난다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 확정(2026-10-26) — 다시 묻지 않는 정책:
 * ```
 * 권장 판매가격 = **A** `breakdown.suggestedPriceKrw`(착지원가 + 수수료 + 목표마진)
 * 시장가격      = **B** `computePriceRecommendation().recommendedPrice`
 * 🔴 A 와 B 를 **합치지 않는다** · B 를 「권장 판매가격」으로 **승격하지 않는다**
 * 🔴 「ⓘ 가격 계산 기준」은 **A 전용** 이다
 * ```
 *
 * 🔴 **FAIL 조건(CPO)** — B 가 SUMMARY 권장가가 됨 · A/B 가 한 owner 로 합쳐짐 ·
 *    ⓘ 가 B 를 설명함 · 전체 MI 패널이 다시 노출됨 · 기존 가격/MI/등록 로직 변경.
 *
 * 🔴 「Production UI PASS」로 쓰지 않는다 — 실제 따져 화면은 CTO 가 볼 수 없다.
 *    이것은 **마운트 DOM + 소스 배선** 축이고 최종 확인은 CEO 1회다(§12).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
import {
  marketPriceBasisLine,
  PRICE_CALCULATION_LINK_TEXT,
  RECOMMENDED_PRICE_LABEL,
} from "../recommended-price-copy";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import type { OverseasPriceSummary } from "../overseas-reference";

const COMMERCE = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const AREA = strip(readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8"));
const PANEL = strip(readFileSync(join(COMMERCE, "DomesticPriceIntelligencePanel.tsx"), "utf8"));
const WORKSPACE = strip(readFileSync(join(COMMERCE, "..", "CommerceWorkspace.tsx"), "utf8"));
const COPY = strip(readFileSync(join(COMMERCE, "recommended-price-copy.ts"), "utf8"));

/**
 * 🔴 운영 DB 실측 표본(START-HERE §6-NEXT) — snapshot `32f7b651`
 *    `Lulu T Bar Shoes in Vernice Nero by PèPè`.
 * ```
 * A suggestedPriceKrw ₩295,796   B recommendedPrice ₩258,000 · Net 0.6%
 * ```
 * 🔴 이 숫자를 **다시 재지 않는다**(조사 종료 · 재조사 금지).
 */
const A_KRW = 295796;
const B_KRW = 258000;
const B_MARGIN = 0.6;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * 🔴 **row 모양을 손으로 지어내지 않는다** — 기존 계약(`core-2ao-r1`)이 쓰는 빌더를
 *    그대로 베꼈다(이 트랙에서 반복된 함정: 모양이 틀리면 「후보 1곳」으로 뭉친다).
 */
const row = (over: Partial<GeminiTransientRow>): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: "a.example",
    title: "Lulu T Bar Shoes",
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
    priceStatus: "VERIFIED_CURRENT",
    market: "OVERSEAS",
    basis: "TLD",
    ...over,
  }) as GeminiTransientRow;

const ROWS: GeminiTransientRow[] = [
  row({ domain: "junioredition.com", discoveredUrl: "https://junioredition.com/p/1", soldOut: false, priceAmount: 37, priceCurrency: "GBP" }),
  row({ domain: "www.tinyapple.net", discoveredUrl: "https://www.tinyapple.net/p/3", priceAmount: 58, priceCurrency: "USD" }),
];

/** 🇰🇷 국내 참고가격 — 실측 표본의 국내 EXACT 최저가(포레포레)와 **같은 금액** 이다. */
const KR_REF: OverseasPriceSummary = {
  count: 1,
  byCurrency: { KRW: { lowestAmount: B_KRW, highestAmount: B_KRW, count: 1 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
} as unknown as OverseasPriceSummary;

type Props = Record<string, unknown>;

function mount(props: Props = {}): void {
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows: ROWS,
        domesticReference: KR_REF,
        ...props,
      } as never),
    );
  });
}

/** 🔴 닫힌 `details` 를 지운다 = **셀러가 «펼치지 않고» 보는 것**(접힘은 1차가 아니다). */
function firstScreen(): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const d of [...clone.querySelectorAll("details")]) if (!d.hasAttribute("open")) d.remove();
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}
const whole = (): string => (container.textContent ?? "").replace(/\s+/g, " ").trim();
const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);

/* ══════════════════ A. 순수 함수 — B 근거 한 줄 ══════════════════ */

describe("A. marketPriceBasisLine — 금액을 만들지 않는다", () => {
  it("A-1 🟢 B < A 면 **「권장 판매가격보다 낮습니다」** 로 끝난다", () => {
    const line = marketPriceBasisLine({
      marketPriceKrw: B_KRW,
      marketPriceMarginPercent: B_MARGIN,
      recommendedPriceKrw: A_KRW,
    });
    expect(line).toBe("국내 시장가격에 맞추면 예상 마진 0.6% 입니다 — 권장 판매가격(목표 마진 반영)보다 낮습니다.");
  });

  it("A-2 🟢 B > A · B == A 도 **다른 문장** 이다", () => {
    const hi = marketPriceBasisLine({ marketPriceKrw: 400000, marketPriceMarginPercent: 30, recommendedPriceKrw: A_KRW });
    const eq = marketPriceBasisLine({ marketPriceKrw: A_KRW, marketPriceMarginPercent: 12, recommendedPriceKrw: A_KRW });
    expect(hi).toContain("보다 높습니다");
    expect(eq).toContain("과 같습니다");
    expect(hi).not.toBe(eq);
  });

  /** 🔴 A 가 없으면 **방향을 말하지 않는다** — 없는 값과 비교할 수 없다. */
  it("A-3 🔴 A 가 없으면 마진만 말한다(방향 0)", () => {
    const line = marketPriceBasisLine({ marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN, recommendedPriceKrw: null });
    expect(line).toBe("국내 시장가격에 맞추면 예상 마진 0.6% 입니다.");
    expect(line).not.toContain("권장 판매가격");
  });

  /** 🔴 **없는 말을 지어내지 않는다** — 둘 중 하나라도 없으면 줄 자체가 없다. */
  it("A-4 🔴 B 나 마진율이 없으면 **null**", () => {
    expect(marketPriceBasisLine({ marketPriceKrw: null, marketPriceMarginPercent: B_MARGIN })).toBeNull();
    expect(marketPriceBasisLine({ marketPriceKrw: B_KRW, marketPriceMarginPercent: null })).toBeNull();
    expect(marketPriceBasisLine({})).toBeNull();
  });

  /**
   * 🔴🔴 **금액 owner 는 시장 블록 하나다** — 이 줄에 금액이 들어오면 같은 숫자가
   *    화면에 두 번 뜬다(CORE-2AO-R1 이 CEO FAIL 로 잡은 그 모양).
   */
  it("A-5 🔴 어떤 조합에서도 **금액·통화기호가 없다**", () => {
    for (const a of [null, A_KRW]) {
      for (const b of [1000, B_KRW, 999999]) {
        const line = marketPriceBasisLine({ marketPriceKrw: b, marketPriceMarginPercent: 1.5, recommendedPriceKrw: a });
        expect(line, `🔴 금액이 들어왔다: ${line}`).not.toMatch(/[₩€$£¥]|\d{3,}/);
      }
    }
  });

  /** 🔴 말 owner 가 **이 파일 하나** 다 — 계산 어휘를 들이지 않는다. */
  it("A-6 🔴 copy owner 에 계산·환율 어휘가 **없다**", () => {
    for (const banned of ["computePriceBreakdown", "computePriceRecommendation", "convertToKrw", "exchangeRate", "suggestedPriceKrw"]) {
      expect(COPY, `🔴 ${banned} 가 말 owner 에 들어왔다`).not.toContain(banned);
    }
  });
});

/* ══════════════════ B. 1차 화면 — A 하나가 답이다 ══════════════════ */

describe("B. 1차(SUMMARY) — 「그래서 얼마에 팔면 되는가」", () => {
  it("B-1 🟢🟢 A 가 오면 **권장 판매가격이 1차에 선다**", () => {
    mount({ recommendedPriceKrw: A_KRW });
    const first = firstScreen();
    expect(first, "🔴 권장 판매가격 라벨이 1차에 없다").toContain(RECOMMENDED_PRICE_LABEL);
    expect(first, "🔴 A 금액이 1차에 없다").toContain("₩295,796");
    expect(q("market-recommended-price-amount")?.textContent).toBe("₩295,796");
  });

  it("B-2 🟢 ⓘ 가 1차에 있고 **누르면 핸들러가 한 번** 돈다", () => {
    const onOpen = vi.fn();
    mount({ recommendedPriceKrw: A_KRW, onOpenPriceCalculation: onOpen });
    expect(firstScreen()).toContain(PRICE_CALCULATION_LINK_TEXT);
    const btn = q("market-price-calculation-link") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  /** 🔴 **갈 곳 없는 버튼을 그리지 않는다** — 이 WU 가 고치는 것이 바로 그 모양이다. */
  it("B-3 🔴 핸들러가 없으면 ⓘ 버튼이 **렌더되지 않는다**", () => {
    mount({ recommendedPriceKrw: A_KRW });
    expect(q("market-price-calculation-link")).toBeNull();
    expect(whole()).not.toContain(PRICE_CALCULATION_LINK_TEXT);
  });

  /** 🔴 A 가 없으면(원본가·배송비 미확인) **거짓 숫자를 만들지 않는다**. */
  it("B-4 🔴 A 가 null 이면 권장 판매가격 줄이 **없다**", () => {
    mount({ recommendedPriceKrw: null, onOpenPriceCalculation: () => {} });
    expect(q("market-recommended-price")).toBeNull();
    expect(q("market-price-calculation-link")).toBeNull();
    expect(whole(), "🔴 A 가 없는데 권장 판매가격이라는 말이 떴다").not.toContain(RECOMMENDED_PRICE_LABEL);
    expect(whole(), "🔴 환산/금액 기호가 생겼다").not.toMatch(/[₩€$£¥]/);
  });

  /**
   * 🔴🔴 **CPO FAIL 조건 — B 가 SUMMARY 권장가가 되면 안 된다.**
   *    B 만 있고 A 가 없으면 1차에 **아무 가격도 서지 않는다**(대신 채우지 않는다).
   */
  it("B-5 🔴🔴 B 는 1차에 **올라오지 않는다**", () => {
    mount({ marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN });
    const first = firstScreen();
    expect(first, "🔴 B 가 1차로 승격됐다").not.toContain("예상 마진");
    expect(q("market-recommended-price"), "🔴 B 로 권장가 칸을 채웠다").toBeNull();
    /** 🟢 그래도 **사라지지 않았다** — 상세에 근거로 있다. */
    expect(whole()).toContain("예상 마진 0.6%");
  });

  /**
   * 🔴🔴 **환산 금지의 화면 축** — `₩` 는 **A 줄에만** 쓴다.
   *    A 는 애초에 원화로 계산된 값이고(환산 아님), 시장 금액은 **ISO 코드 그대로** 다.
   * 🔴 이 단언이 기존 「영역 전체에 ₩ 0」 계약들의 **A 있음 버전** 이다 — 그 계약들은
   *    A 를 넘기지 않는 입력에서 여전히 유효하고, 여기서 **개수** 로 더 좁게 잠근다.
   */
  it("B-6 🔴🔴 `₩` 는 **A 줄 하나뿐** 이고 시장 금액에는 **없다**", () => {
    mount({ recommendedPriceKrw: A_KRW, marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN, onOpenPriceCalculation: () => {} });
    const all = whole();
    expect((all.match(/₩/g) ?? []).length, "🔴 `₩` 가 A 줄 밖에서도 쓰였다").toBe(1);
    expect(all, "🔴 다른 통화 기호가 들어왔다").not.toMatch(/[€$£¥]/);
    expect(all, "🔴 환산 흔적이 생겼다").not.toContain("약 ₩");
    /** 🟢 시장 금액은 ISO 코드 그대로 선다(그 owner 는 시장 블록이다). */
    const kr = q("market-block-domestic")?.textContent ?? "";
    expect(kr).toContain("KRW 258,000");
    expect(kr, "🔴 시장 금액에 ₩ 가 붙었다").not.toMatch(/[₩€$£¥]/);
  });

  /** 🔴 1차 **설명문은 최대 한 줄** 이다(CPO 명시 · `core-2ao-r1 R2-2` 와 같은 축). */
  it("B-7 🔴 설명문 줄 수는 **1** 이다(A 를 더해도 늘지 않는다)", () => {
    mount({ recommendedPriceKrw: A_KRW, onOpenPriceCalculation: () => {} });
    expect(container.querySelectorAll('[data-testid="market-next-step-line"]').length).toBe(1);
  });

  /** 🔴 **1차가 다시 설명 화면이 되지 않는다** — 비율로 잠근다(R2-3 과 같은 기준). */
  it("B-8 🔴 1차 글자 비중이 25% 를 넘지 않는다", () => {
    mount({ recommendedPriceKrw: A_KRW, marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN, onOpenPriceCalculation: () => {} });
    const ratio = firstScreen().length / whole().length;
    expect(ratio, `🔴 1차가 다시 길어졌다: ${(ratio * 100).toFixed(1)}%`).toBeLessThan(0.25);
  });
});

/* ══════════════════ C. 상세 — B 는 «근거» 다 ══════════════════ */

describe("C. 상세(DETAIL) — B 근거 한 줄", () => {
  it("C-1 🟢 B 근거가 **상세에만** 선다", () => {
    mount({ recommendedPriceKrw: A_KRW, marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN });
    const line = q("market-price-basis-line");
    expect(line, "🔴 B 근거 줄이 없다").not.toBeNull();
    expect(line!.textContent).toContain("예상 마진 0.6%");
    expect(firstScreen(), "🔴 B 근거가 1차로 올라왔다").not.toContain("예상 마진");
  });

  it("C-2 🔴 그 줄에 **금액이 없다**", () => {
    mount({ recommendedPriceKrw: A_KRW, marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN });
    const t = q("market-price-basis-line")?.textContent ?? "";
    expect(t).not.toMatch(/[₩€$£¥]/);
    expect(t, "🔴 금액이 근거 줄에 들어왔다").not.toContain("258,000");
  });

  /** 🔴 B 가 없으면 줄이 **아예 없다**(빈 틀을 만들지 않는다). */
  it("C-3 🔴 B 가 없으면 줄이 **서지 않는다**", () => {
    mount({ recommendedPriceKrw: A_KRW });
    expect(q("market-price-basis-line")).toBeNull();
  });

  /**
   * 🔴🔴 **A/B 가 한 owner 로 합쳐지지 않는다**(CPO FAIL 조건) —
   *    **금액이 그려지는 자리는 A 하나** 이고 B 는 글자뿐이다.
   */
  it("C-4 🔴🔴 금액은 A 자리 **하나** 다", () => {
    mount({ recommendedPriceKrw: A_KRW, marketPriceKrw: B_KRW, marketPriceMarginPercent: B_MARGIN, onOpenPriceCalculation: () => {} });
    const all = whole();
    expect((all.match(/₩295,796/g) ?? []).length, "🔴 A 금액이 두 번 떴다").toBe(1);
    expect((all.match(/258,000/g) ?? []).length, "🔴 B 금액이 시장 블록 밖에서도 떴다").toBe(1);
  });

  /** 🔴 ⓘ 가 **B 를 설명하지 않는다**(CPO FAIL 조건) — 그 말에 시장 어휘가 0 이다. */
  it("C-5 🔴 ⓘ 문구는 **A 전용** 이다", () => {
    expect(PRICE_CALCULATION_LINK_TEXT).toContain("가격 계산 기준");
    expect(PRICE_CALCULATION_LINK_TEXT, "🔴 ⓘ 가 시장가격 설명이 됐다").not.toContain("시장");
  });
});

/* ══════════════════ D. 배선 — 끊기면 조용히 사라진다 ══════════════════ */

describe("D. 배선 다섯 자리 + 앵커 복구", () => {
  /** 🔴 CORE-2R-5 가 남긴 함정 그대로 — 타입 · useMemo · deps 를 **같이** 본다. */
  it("D-1 🔴 B 가 **타입 → useMemo → deps** 로 이어진다", () => {
    expect(PANEL, "🔴 타입에 칸이 없다").toContain("marketPriceKrw: number | null");
    expect(PANEL, "🔴 타입에 마진 칸이 없다").toContain("marketPriceMarginPercent: number | null");
    expect(PANEL, "🔴 패널이 B 를 올려보내지 않는다").toContain(
      "marketPriceKrw: data?.recommendation?.recommendedPrice ?? null",
    );
    expect(PANEL).toContain("marketPriceMarginPercent: data?.recommendation?.estimatedMarginPercent ?? null");
    expect(PANEL, "🔴 deps 에 없으면 B 가 영원히 null 이다").toContain("data?.recommendation?.recommendedPrice,");
    expect(PANEL).toContain("data?.recommendation?.estimatedMarginPercent,");
  });

  it("D-2 🔴 Workspace 가 A · B · 핸들러를 **같이** 넘긴다", () => {
    expect(WORKSPACE, "🔴 A 배선이 끊겼다").toContain("recommendedPriceKrw={recommendedPriceKrw}");
    expect(WORKSPACE).toContain("marketPriceKrw={marketComparison?.marketPriceKrw ?? null}");
    expect(WORKSPACE).toContain(
      "marketPriceMarginPercent={marketComparison?.marketPriceMarginPercent ?? null}",
    );
    /** 🟢 **같은 핸들러** 다 — `PriceEditor` 와 도착지가 하나여야 한다(사본 0). */
    expect(WORKSPACE).toContain("onOpenPriceCalculation={handleOpenPriceCalculation}");
    expect(
      (WORKSPACE.match(/onOpenPriceCalculation=\{handleOpenPriceCalculation\}/g) ?? []).length,
      "🔴 핸들러가 두 벌이 됐다(또는 하나가 사라졌다)",
    ).toBe(2);
  });

  /**
   * 🔴🔴 **이 영역은 A 를 «계산하지» 않는다.** prop 으로 받은 값을 그릴 뿐이다 —
   *    계산을 들이면 같은 상품이 화면 위아래에서 다른 권장가를 말한다(반복된 버그).
   */
  it("D-3 🔴🔴 영역에 **가격 계산 어휘가 0** 이다", () => {
    for (const banned of [
      "computePriceBreakdown",
      "resolveListingPrice",
      "computePriceRecommendation",
      "suggestedPriceKrw",
      "convertToKrw",
      "exchangeRate",
      "priceBreakdown",
    ]) {
      expect(AREA, `🔴 ${banned} 가 표시 영역에 들어왔다`).not.toContain(banned);
    }
    /** 🔴 받은 값으로 **산수를 시작하지도 않는다**(마진·수수료를 다시 세지 않는다). */
    expect(AREA, "🔴 A 로 산수를 시작했다").not.toMatch(/recommendedPriceKrw\s*[-*/+]/);
    expect(AREA, "🔴 B 로 산수를 시작했다").not.toMatch(/marketPriceKrw\s*[-*/+]/);
  });

  /**
   * 🔴🔴🔴 **앵커 복구 — 「가격 계산 기준 보기」가 도착지를 되찾았다.**
   *
   * 🔴 WU-152 가 MI 패널을 `presentation="HIDDEN"` 으로 두면서 그 패널 **안** 의
   *    `PRICE_CALCULATION_ANCHOR_ID` 가 **렌더되지 않게** 됐다 ⟹ 버튼 둘이 죽어 있었다.
   * 🟢 이제 Workspace 가 그 앵커와 상세 계산 노드를 **셀러가 ⓘ 를 누른 뒤에만** 세운다.
   */
  it("D-4 🔴🔴 앵커가 Workspace 에 있고 **요청 뒤에만** 선다", () => {
    expect(WORKSPACE).toContain("{priceDetailRequest > 0 && (");
    const at = WORKSPACE.indexOf("{priceDetailRequest > 0 && (");
    const block = WORKSPACE.slice(at, at + 260);
    expect(block, "🔴 앵커가 그 블록에 없다 — 스크롤이 도착지를 잃는다").toContain(
      "id={PRICE_CALCULATION_ANCHOR_ID}",
    );
    expect(block, "🔴 상세 계산 노드가 그 블록에 없다").toContain("{priceCalculationDetail}");
    /** 🔴 노드는 **하나** 다 — 사본을 만들면 타이핑 중 값이 두 곳에서 갈린다. */
    expect(
      (WORKSPACE.match(/<PriceCalculationDetail/g) ?? []).length,
      "🔴 상세 계산 노드가 두 벌이 됐다",
    ).toBe(1);
  });

  /**
   * 🔴🔴 **전체 MI 패널을 되살리지 않았다**(CPO FAIL 조건).
   * 🔴 그리고 그 사실이 **앵커가 둘이 되지 않는 근거** 다 — 패널 안에도 같은 id 가
   *    있으므로, `HIDDEN` 이 아니게 되는 날 이 단언이 FAIL 해서 그 사실을 알린다.
   */
  it("D-5 🔴🔴 패널은 여전히 **HIDDEN** 이다(앵커 중복 방지)", () => {
    expect(WORKSPACE, "🔴 MI 패널이 다시 노출됐다 — 앵커가 둘이 된다").toContain('presentation="HIDDEN"');
    expect(PANEL, "🔴 패널 안의 앵커가 사라졌다(보존 계약)").toContain("id={PRICE_CALCULATION_ANCHOR_ID}");
  });

  /** 🔴 **기존 가격/MI/등록 로직을 바꾸지 않았다**(CPO FAIL 조건) — 산출 owner 불변. */
  it("D-6 🟢 A 의 owner 가 그대로다 — `resolveListingPrice` 한 번", () => {
    expect(WORKSPACE).toContain("priceOverrideKrw: null,");
    /**
     * 🟢🟢 **확정 카드와 결론 영역이 «같은 변수» 를 받는다** — 그래서 두 화면이
     *    서로 다른 권장가를 말할 경로가 **구조적으로** 없다.
     * 🔴 셋이 되면(또는 하나가 자기 계산을 갖게 되면) 이 숫자가 흔들린다.
     */
    expect(
      (WORKSPACE.match(/recommendedPriceKrw=\{recommendedPriceKrw\}/g) ?? []).length,
      "🔴 A 를 받는 자리가 둘이 아니다(확정 카드 · 결론 영역)",
    ).toBe(2);
  });
});
