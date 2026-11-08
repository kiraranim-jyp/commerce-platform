// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildJudgementSummaryInput,
  FINAL_VERDICT_COPY,
  type JudgementSummarySource,
} from "../DomesticPriceIntelligencePanel";
import { ProductJudgementSummary } from "../ProductJudgementSummary";
import { buildJudgementSummary, JUDGEMENT_SUMMARY_TITLE } from "../judgement-summary";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-COMPARISON-UI-1 STEP 2 잔여 — **상품 판단 요약을 화면 최상단으로**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **먼저 — 이 WU 는 「이동」이 아니라 「처음 연결」이다.**
 *
 * 작업지시서 전제는 「요약이 `MiPanelView` 안에서 그려져 후보 카드와 **중복 노출** 중」
 * 이었다. 🔴 실측으로 반증됐다:
 * ```
 * CommerceWorkspace   <DomesticPriceIntelligencePanel presentation="HIDDEN" …>  (전수 1곳)
 * 패널                 if (presentation === "HIDDEN") return null;   ← <MiPanelView> «앞»
 *   ⟹ `MiPanelView` 는 **운영에서 한 번도 마운트되지 않는다**
 *   ⟹ 그 안의 `<ProductJudgementSummary>` 는 **죽은 렌더** 였다
 * ```
 * ⟹ 🔴 셀러는 상품 판단 요약을 **본 적이 없다.** 그래서 ⒜(「`MiPanelView` 에서 두 번째
 *    콜백」)를 글자 그대로 두면 **effect 가 영원히 발화하지 않는다.**
 * 🟢 CPO 가 ⒜ 로 지키려던 제약 셋은 그대로 지킨다 — ① Workspace 재계산 0
 *    ② 요약 owner 하나 ③ `MarketComparisonInput` 계약 불변. 바뀐 것은 **콜백을 누가
 *    발화하는가** 뿐이고, 그 자리는 `HIDDEN` 에서도 훅이 전부 도는 **바깥 패널** 이다.
 *
 * 🔴 `.test.ts` + `createElement` — vitest `include` 가 `.test.tsx` 를 수집하지 않는다.
 * 🔴 소스 단언은 **주석을 벗기고** 한다(이 저장소가 여덟 번 걸린 함정).
 */

const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..");
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const read = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");
const WS_RAW = read("apps/admin/src/app/pipeline/CommerceWorkspace.tsx");
const WS = strip(WS_RAW);
const PANEL_RAW = read("apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx");
const PANEL = strip(PANEL_RAW);

/** 🔴 금액이 **없는** 경쟁 블록 — 요약이 가격 owner 가 아님을 깨뜨리지 않기 위해서다. */
const competition = (over: Partial<JudgementSummarySource["domesticCompetition"]> = {}) =>
  ({
    tier: "NONE",
    lowestPriceKrw: null,
    highestPriceKrw: null,
    averagePriceKrw: null,
    sellerCount: 0,
    sampleListings: [],
    soldOutListings: [],
    checkedAt: null,
    ...over,
  }) as JudgementSummarySource["domesticCompetition"];

/**
 * 🔵 MI-REVIEW-MATCH-DISPLAY-1 — `representativeVerdict` 가 **표시 분기 재료** 로 들어왔다.
 * 🔴 기본값은 `READY` 다(= 분기하지 않는 상태) — 그래야 기존 단언이 **그 분기와 무관하게** 산다.
 */
const representative = (code: string): JudgementSummarySource["representativeVerdict"] =>
  ({ code, icon: "🟢", title: "", description: "", reasons: [] }) as JudgementSummarySource["representativeVerdict"];

const source = (over: Partial<JudgementSummarySource> = {}): JudgementSummarySource => ({
  representativeVerdict: representative("READY"),
  cost: null,
  currentPrice: { sellingPriceKrw: null, costPriceKrw: null, costBasis: null },
  domesticCompetition: competition(),
  domesticMarketSplit: { basis: "NONE", exact: competition(), comparison: competition() },
  sellerDecision: {
    finalVerdict: "CONDITIONAL",
    priceVerdict: "CONDITIONAL",
    downgradedByMarket: false,
    outlook: "UNKNOWN",
    outlookSummary: "",
    knownSignalCount: 0,
    factors: [],
    reasons: [],
  },
  ...over,
});

/** 🔴 「근거가 하나라도 있다」를 만드는 최소 조건 — `hasAnyData` 와 **같은 축** 이다. */
const WITH_DATA = source({
  currentPrice: { sellingPriceKrw: 120_000, costPriceKrw: 60_000, costBasis: "KR_MARKET" },
  sellerDecision: { ...source().sellerDecision, finalVerdict: "RECOMMENDED" },
});

const row = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow =>
  ({
    source: "WEB_SEARCH",
    domain: "a.test",
    title: "후보",
    url: "https://a.test/p",
    market: "OVERSEAS",
    priceAmount: null,
    priceCurrency: null,
    ...over,
  }) as GeminiTransientRow;

const EMPTY_SOURCES = {
  overseasMarketEvidence: null,
  urlCandidateEvidence: null,
  geminiEvidence: null,
  overseasAutoEvidence: null,
  reviewedSameEvidence: null,
  domesticListingEvidence: null,
  webSearchEvidence: null,
} as const;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SJS §1 — 조립 owner 는 하나이고 값을 지어내지 않는다", () => {
  it("①-a 🔴 `data` 가 없으면 **null** 이다 — 빈 요약을 만들지 않는다", () => {
    expect(buildJudgementSummaryInput({ data: null, ...EMPTY_SOURCES })).toBeNull();
  });

  it("①-b 🔴 근거가 하나도 없으면 `verdictLabel` 이 **null** — 판정을 지어내지 않는다", () => {
    const out = buildJudgementSummaryInput({ data: source(), ...EMPTY_SOURCES });
    expect(out).not.toBeNull();
    expect(out!.verdictLabel).toBeNull();
  });

  it("①-c 🟢 근거가 있으면 **owner 의 문구를 그대로** 쓴다(사본 0)", () => {
    const out = buildJudgementSummaryInput({ data: WITH_DATA, ...EMPTY_SOURCES });
    expect(out!.verdictLabel).toBe(FINAL_VERDICT_COPY.RECOMMENDED.title);
  });

  it("①-d 🔴 출처 **여섯** 을 순서·라벨 그대로 센다(하나라도 빠지면 요약이 거짓말한다)", () => {
    const out = buildJudgementSummaryInput({
      data: WITH_DATA,
      overseasMarketEvidence: null,
      urlCandidateEvidence: [row()],
      geminiEvidence: [row(), row()],
      overseasAutoEvidence: [row()],
      reviewedSameEvidence: [row()],
      domesticListingEvidence: [row({ market: "KR" })],
      webSearchEvidence: [row()],
    });
    expect(out!.transient?.map((g) => g.sourceLabel)).toEqual([
      "직접 입력",
      "웹 검색",
      "해외 자동검색",
      "이전 확인 후보",
      "국내 목록 탐색",
      "AI 검색",
    ]);
    expect(out!.transient?.map((g) => g.rows.length)).toEqual([1, 2, 1, 1, 1, 1]);
  });

  /**
   * 🔴🔴 **CPO 추가 잠금 — 같은 분석 사이클에서 요약과 후보가 섞이지 않는다.**
   *
   * 「두 콜백이 각각 발화한다」만 보면 부족하다. 셀러가 보는 모순은 **「요약은 후보
   * 없음인데 아래 카드에는 행이 선다」** 이고, 그것을 막는 불변식은 하나다 —
   * **요약이 센 건수 == 카드가 받은 행 수.** 두 값이 같은 여섯 배열에서 나오므로
   * 출처를 하나 빠뜨리면 이 단언이 깨진다.
   */
  it("①-e 🔴🔴 요약이 센 건수 == 후보 카드가 받는 행 수(같은 사이클 · 모순 0)", () => {
    const six = {
      urlCandidateEvidence: [row()],
      geminiEvidence: [row(), row()],
      overseasAutoEvidence: [],
      reviewedSameEvidence: [row()],
      domesticListingEvidence: [row({ market: "KR" }), row({ market: "KR" })],
      webSearchEvidence: [row()],
    };
    /** 🟢 카드가 받는 배열 — 패널의 `marketComparisonInput.rows` 와 **같은 합성** 이다. */
    const cardRows = [
      ...six.geminiEvidence,
      ...six.urlCandidateEvidence,
      ...six.overseasAutoEvidence,
      ...six.reviewedSameEvidence,
      ...six.domesticListingEvidence,
      ...six.webSearchEvidence,
    ];
    const out = buildJudgementSummaryInput({ data: WITH_DATA, overseasMarketEvidence: null, ...six });
    const counted = (out!.transient ?? []).reduce((n, g) => n + g.rows.length, 0);
    expect(counted).toBe(cardRows.length);
    expect(counted).toBe(7);
  });

  it("①-f 🔴 가격 숫자를 **만들지 않는다** — 집계 금액이 없으면 요약에도 금액이 없다", async () => {
    const input = buildJudgementSummaryInput({ data: WITH_DATA, ...EMPTY_SOURCES });
    await act(async () => root.render(createElement(ProductJudgementSummary, input!)));
    expect(container.textContent ?? "").not.toMatch(/₩|원/);
  });
});

describe("SJS §2 — 마운트 DOM: 조립 결과가 실제로 화면이 된다", () => {
  it("②-a 🟢 조립 산출이 **그대로 요약 블록으로 렌더된다**(연결 증명)", async () => {
    const input = buildJudgementSummaryInput({
      data: WITH_DATA,
      overseasMarketEvidence: null,
      urlCandidateEvidence: [row()],
      geminiEvidence: null,
      overseasAutoEvidence: null,
      reviewedSameEvidence: null,
      domesticListingEvidence: null,
      webSearchEvidence: null,
    });
    await act(async () => root.render(createElement(ProductJudgementSummary, input!)));
    expect(container.textContent).toContain(JUDGEMENT_SUMMARY_TITLE);
    /** 🔴 판정 문구가 owner 의 그 글자여야 한다. */
    expect(container.textContent).toContain(FINAL_VERDICT_COPY.RECOMMENDED.title);
  });

  /**
   * 🔴🔴 **내 1차 단언이 틀렸고 코드가 맞았다 — 그대로 적는다.**
   *
   * 「근거가 없으면 블록을 세우지 않는다」로 단언했는데 **FAIL** 했다. 원인은 기존
   * 설계다 — `buildDomesticMarketEvidence` 는 **빈 요약도 같은 모양으로** 세운다
   * (패널 주석: 「블록이 조건부로 사라지면 셀러가 읽는 순서의 한 칸이 비고, 그 순간
   * 판정은 다시 근거 없이 내려온 숫자가 된다」). 🟢 그래서 단언을 **사실에 맞게 바꾸고
   * 더 강하게** 세운다 — 블록은 서지만 **판정을 지어내지 않아야** 한다.
   * 🔴 「분석 자체가 없다」(= `data` 없음)는 **다른 상태** 이고 ①-a / ④-b 가 잠근다.
   */
  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 **정보 손실 0 — 「비교 판매처 N곳」의 새 주인이 여기다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 이 WU 로 `mi-ux-final` · `product-tab-first-screen` 의 그 단언이
   *    **`toContain` → `not.toContain`** 으로 뒤집혔다(요약 블록이 그 트리를 떠났다).
   * 🔴🔴 그 둘만 고치면 **「아무도 그 줄을 세지 않는」** 상태가 된다 ⟹ 이 단언이
   *    그 하나를 **조립 owner 를 직접 불러** 센다. 🟢 두 파일을 같이 읽어야 손실 0 이다.
   * 🔴 「몇 곳을 봤는가」는 **금액이 아니다** — 지우면 셀러가 근거의 두께를 못 본다.
   */
  it("②-a2 🟢🟢 **근거의 두께가 보존된다** — 「비교 판매처 N곳」이 실제로 렌더된다", async () => {
    const three = competition({ tier: "SECONDARY", sellerCount: 3 });
    const input = buildJudgementSummaryInput({
      data: source({
        currentPrice: { sellingPriceKrw: 120_000, costPriceKrw: 60_000, costBasis: "KR_MARKET" },
        domesticCompetition: three,
        domesticMarketSplit: { basis: "COMPARISON", exact: competition(), comparison: three },
      }),
      ...EMPTY_SOURCES,
    });
    await act(async () => root.render(createElement(ProductJudgementSummary, input!)));
    expect(container.textContent ?? "").toContain("비교 판매처 3곳");
  });

  it("②-b 🔴 근거가 없으면 블록은 서되 **판정을 지어내지 않는다**", async () => {
    const input = buildJudgementSummaryInput({ data: source(), ...EMPTY_SOURCES });
    await act(async () => root.render(createElement(ProductJudgementSummary, input!)));
    const text = container.textContent ?? "";
    expect(text).toContain(JUDGEMENT_SUMMARY_TITLE);
    /** 🔴 판정 세 문구가 **하나도** 서지 않는다(`verdictLabel` 이 null 이므로). */
    for (const v of ["판매 추천", "조건부", "비추천"]) expect(text).not.toContain(v);
    /** 🔴 그리고 **모른다고 말한다** — 빈칸을 「0원」·「-」로 채우지 않는다. */
    expect(text).toMatch(/아직 판단에 필요한 정보가 모이지 않았습니다/);
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SJS §5 — SELLER-DECISION-UI-1 ⒝ **「팔지 말지 · 얼마에」가 헤드라인이다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CEO: 「하단의 모든 내용을 요약해서 **팔지말지, 가격은 어떻게 되는지** 가 보여야 해」.
 * 🔴🔴 가격 owner 는 **`recommendedPriceKrw`** 다 — `recommendation.recommendedPrice` 가
 *    **아니다**(그 값은 화면의 추천 판매가로 표시되지 않는다 · 실측 확정).
 */
describe("SJS §5 — ⒝ 헤드라인과 가격 안전 계약", () => {
  const headlineInput = (over: Partial<Parameters<typeof ProductJudgementSummary>[0]> = {}) =>
    ({
      ...buildJudgementSummaryInput({ data: WITH_DATA, ...EMPTY_SOURCES })!,
      ...over,
    }) as Parameters<typeof ProductJudgementSummary>[0];

  const renderHeadline = async (over: Parameters<typeof headlineInput>[0] = {}) => {
    await act(async () => root.render(createElement(ProductJudgementSummary, headlineInput(over))));
    return container;
  };

  it("⑤-a 🟢 판매 판단과 추천 판매가격이 **헤드라인** 에 선다", async () => {
    const c = await renderHeadline({ recommendedPriceKrw: 89_000 });
    expect(c.querySelector('[data-testid="judgement-summary-headline"]')).not.toBeNull();
    expect(c.querySelector('[data-testid="judgement-summary-verdict"]')?.textContent).toBe(
      FINAL_VERDICT_COPY.RECOMMENDED.title,
    );
    const price = c.querySelector('[data-testid="judgement-summary-recommended-price"]');
    expect(price?.textContent ?? "").toContain("89,000");
  });

  /** 🔴 **부정 ③** — 추천가가 없으면 후보 가격으로 **대체하지 않는다**(C-2-c). */
  it("⑤-b 🔴 추천가격이 없으면 **금액 자리를 비운다**(후보 가격 폴백 0)", async () => {
    const c = await renderHeadline({
      recommendedPriceKrw: null,
      transient: [{ sourceLabel: "직접 입력", rows: [row({ priceAmount: 117000, priceCurrency: "KRW" })] }],
    });
    expect(c.querySelector('[data-testid="judgement-summary-recommended-price"]')).toBeNull();
    expect(c.textContent ?? "").not.toContain("117,000");
  });

  /** 🔴 **부정 ④** — 요약 rows 에는 금액이 **한 글자도** 없다(C-2-a). */
  it("⑤-c 🔴 rows 에 금액이 **0** 이다 — 금액은 헤드라인 하나뿐", async () => {
    const c = await renderHeadline({ recommendedPriceKrw: 89_000 });
    const rowsText = [...c.querySelectorAll("dl dd")].map((n) => n.textContent ?? "").join(" ");
    expect(rowsText).not.toMatch(/\d{1,3},\d{3}|₩|KRW|GBP|EUR|USD|€|\$|£/);
  });

  it("⑤-d 🔴 유효하지 않은 값은 **금액으로 만들지 않는다**", async () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const c = await renderHeadline({ recommendedPriceKrw: bad });
      expect(c.querySelector('[data-testid="judgement-summary-recommended-price"]')).toBeNull();
    }
  });

  it("⑤-e 🟢 네 줄 구성이다 — 판매 판단 · 국내 가격 분석 · 해외 가격 분석 · 핵심 판단 이유", () => {
    const rows = buildJudgementSummary({
      ...buildJudgementSummaryInput({ data: WITH_DATA, ...EMPTY_SOURCES })!,
      decisionReason: "국내 동일상품 근거가 확인되었습니다",
    });
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("판매 판단");
    expect(labels).toContain("핵심 판단 이유");
    /** 🔴 옛 라벨은 **사라졌다**(의도된 변경 · 계약도 같이 갱신됐다). */
    expect(labels).not.toContain("시장 판단");
  });

  /** 🔴 **부정 ①** — 이유 문장에 금액이 섞이면 그 줄을 **쓰지 않는다**. */
  it("⑤-f 🔴 이유 문장에 금액이 있으면 **그 줄을 만들지 않는다**", () => {
    const rows = buildJudgementSummary({
      ...buildJudgementSummaryInput({ data: WITH_DATA, ...EMPTY_SOURCES })!,
      decisionReason: "국내 최저가가 ₩88,000 입니다",
    });
    expect(rows.map((r) => r.label)).not.toContain("핵심 판단 이유");
  });

  /** 🔴 **부정 ②·⑤** — 가격 owner 와 조립 owner 가 **각각 하나** 다. */
  it("⑤-g 🔴🔴 가격 owner 는 판매 가격 설정과 **같은 변수** 이고 조립 owner 는 하나다", () => {
    expect(WS).toContain(
      "<ProductJudgementSummary {...judgementSummary} recommendedPriceKrw={recommendedPriceKrw} />",
    );
    /** 🔴 요약이 `recommendation.recommendedPrice`(= marketPriceKrw)를 받으면 안 된다. */
    expect(WS).not.toContain("recommendedPriceKrw={marketComparison");
    /**
     * 🔴 Workspace 가 가격을 **다시 만들지 않는다**.
     * 🔴🔴 **기준선으로 고정한다** — 주석을 벗긴 실제 호출은 **2** 이고 **둘 다 기존 것** 이다
     *    (`recommendedPriceKrw` · 최종가 계산). ⒝ 가 더한 호출은 **0** 이다.
     *    🔴 숫자를 올리려면 「왜 세 번째 계산이 필요한가」를 먼저 설명해야 한다.
     */
    expect((WS.match(/resolveListingPrice\(/g) ?? []).length).toBe(2);
    /** 🔴 조립 owner 중복 금지 — 요약 조립 함수는 패널에 **하나** 다. */
    expect((PANEL.match(/export function buildJudgementSummaryInput\(/g) ?? []).length).toBe(1);
  });
});

describe("SJS §3 — 배치: 요약이 화면의 «첫 판단 블록» 이다", () => {
  const summarySlot = () => WS.indexOf('data-testid="seller-judgement-summary-slot"');
  const cardSlot = () => WS.indexOf('data-testid="seller-candidates-slot"');

  /**
   * 🔵🔵🔵 **SELLER-DECISION-UI-1 ⒜ 로 이 명제가 바뀌었다 — 이력을 남긴다.**
   * ```
   * STEP 2               요약 → **후보 카드** → 결론 영역   (요약이 카드보다 먼저)
   * SELLER-DECISION-UI-1 요약 → **결론 영역**              (🔴 카드가 화면에서 빠졌다)
   * ```
   * 🔴 그래서 「카드보다 먼저」는 **비교 대상이 사라져** 성립하지 않는다. 남는 명제는
   *    **「요약이 셀러 화면의 첫 판단 블록이다」** 이고, 그것을 ③-b(결론 영역·격자보다 앞) ·
   *    ③-c(내비게이션보다 뒤)가 **좌표로** 잠근다.
   * 🔴 여기서는 **카드가 실제로 빠졌다** 는 것을 같이 센다 — 되살아나면 요약 바로 아래에
   *    탐색 블록이 다시 서고, CEO 가 「별로」라 한 그 화면으로 되돌아간다.
   */
  it("③-a 🔴🔴 요약이 **첫 판단 블록** 이고 후보 카드는 화면에 **없다**", () => {
    expect(summarySlot()).toBeGreaterThan(-1);
    expect(cardSlot(), "🔴 소싱 후보 카드가 되살아났다(CEO 제거 지시)").toBe(-1);
  });

  it("③-b 🔴🔴 **격자 «밖»** 이다 — 「기둥 안 맨 위」는 「화면 맨 위」가 아니다(WU-140-R1)", () => {
    const grid = WS.indexOf("order-2 lg:order-1");
    const anchor = WS.indexOf("id={PRICE_COMPARISON_ANCHOR_ID}");
    /**
     * 🔴 **음성 대조가 이 줄을 요구했다** — 슬롯이 «없을» 때 `indexOf` 가 `-1` 을 주고
     *    `-1 < anchor` 가 참이라 M2(렌더 제거)에서 이 단언이 **통과했다**. 존재부터 센다.
     */
    expect(summarySlot()).toBeGreaterThan(-1);
    expect(summarySlot()).toBeLessThan(anchor);
    if (grid > -1) expect(summarySlot()).toBeLessThan(grid);
  });

  it("③-c 🔴 단계 표시/탭을 **위로 올리지 않았다**(내비게이션 불변)", () => {
    const wf = WS.indexOf("WorkflowPanel");
    expect(wf).toBeGreaterThan(-1);
    expect(summarySlot()).toBeGreaterThan(wf);
  });

  it("③-d 🔴 결론 영역과 **같은 게이트** 를 쓴다(커머스 탭에 판단 블록 0)", () => {
    /**
     * 🔴 좌표가 바뀌었다 — 전에는 「요약 ~ 카드 슬롯」 구간을 봤는데 카드가 빠졌다.
     *    🟢 이제 **요약 슬롯 «직전»** 구간을 본다(게이트는 그 줄에 있다).
     */
    const slice = WS.slice(summarySlot() - 220, summarySlot());
    expect(slice).toContain('workSurface !== "CHANNEL"');
  });
});

describe("SJS §4 — 렌더 주인은 하나, 재계산은 0", () => {
  it("④-a 🔴🔴 패널은 요약을 **그리지 않는다**(중복 0)", () => {
    expect(PANEL).not.toContain("<ProductJudgementSummary");
    /** 🔴 컴포넌트 import 도 남기지 않는다 — 남기면 다음 사람이 다시 꽂는다. */
    expect(PANEL).not.toContain('from "./ProductJudgementSummary"');
  });

  it("④-b 🔴🔴 Workspace 가 요약을 **다시 계산하지 않는다**", () => {
    /** 🔵 ⒝ — 렌더 줄에 **가격 prop 하나** 가 더해졌다(값은 Workspace 의 기존 변수). */
    expect(WS).toContain(
      "<ProductJudgementSummary {...judgementSummary} recommendedPriceKrw={recommendedPriceKrw} />",
    );
    /** 🔴 `null` 이면 **아무것도 그리지 않는다** — 「분석 없음」을 빈 블록으로 만들지 않는다. */
    expect(WS).toContain('workSurface !== "CHANNEL" && judgementSummary &&');
    for (const banned of [
      "buildJudgementSummary(",
      "buildDomesticMarketEvidence",
      "buildMarketContext",
      "hasAnyData",
    ]) {
      expect(WS, `🔴 Workspace 가 ${banned} 를 직접 쓴다 — 사본이 생긴다`).not.toContain(banned);
    }
  });

  it("④-c 🔴 조립 owner 는 **패널의 함수 하나** 다", () => {
    expect(PANEL).toContain("export function buildJudgementSummaryInput(");
    expect((PANEL.match(/sourceLabel: "직접 입력"/g) ?? []).length).toBe(1);
    expect((PANEL.match(/sourceLabel: "AI 검색"/g) ?? []).length).toBe(1);
  });

  it("④-d 🔴 `MarketComparisonInput` 계약에 요약 칸을 **더하지 않았다**(채널 둘)", () => {
    const at = PANEL.indexOf("export interface MarketComparisonInput");
    expect(at).toBeGreaterThan(-1);
    const body = PANEL.slice(at, PANEL.indexOf("\n}", at));
    expect(body).not.toContain("judgementSummary");
  });

  it("④-e 🔴 두 번째 채널이 **실제로 배선** 돼 있다(패널 → Workspace state)", () => {
    expect(PANEL).toContain("onJudgementSummaryChangeRef.current?.(judgementSummaryInput)");
    expect(WS).toContain("onJudgementSummaryChange={setJudgementSummary}");
    expect(WS).toContain("useState<JudgementSummaryInput | null>(null)");
  });

  /**
   * 🔴🔴 **stale state 방어 — `null` 을 «반드시» 올려보낸다.**
   *
   * 보고를 `if (judgementSummaryInput)` 으로 감싸면 상품을 바꿨을 때 **이전 상품의
   * 요약이 화면에 남는다**(`wu-030` 이 transient 누적에서 실제로 밟은 그 사고).
   * 🟢 그래서 effect 가 memo 값을 **조건 없이** 넘기는지 본다.
   */
  it("④-f 🔴🔴 요약 보고를 **조건으로 감싸지 않았다**(상품 전환 시 잔상 0)", () => {
    const at = PANEL.indexOf("onJudgementSummaryChangeRef.current?.(judgementSummaryInput)");
    expect(at).toBeGreaterThan(-1);
    const effect = PANEL.slice(PANEL.lastIndexOf("useEffect", at), at);
    expect(effect, "🔴 보고가 조건부다 — 이전 상품 요약이 남는다").not.toMatch(/\bif\s*\(/);
  });

  /**
   * 🔴🔴 **deps 누락 방어 — 두 memo 가 «같은 여섯 출처» 를 본다.**
   *
   * 이 파일이 네 번 밟은 함정이고, 여기서 깨지면 요약이 첫 응답 뒤 **갱신되지 않는다**.
   * 🔴 그리고 두 deps 가 어긋나면 요약과 후보가 **다른 시점** 값이 된다(CPO 추가 잠금).
   */
  it("④-g 🔴🔴 요약 memo 의 deps 에 출처 **여섯 + data** 가 전부 있다", () => {
    const call = PANEL.indexOf("buildJudgementSummaryInput({");
    expect(call).toBeGreaterThan(-1);
    const end = PANEL.indexOf("const onJudgementSummaryChangeRef", call);
    /**
     * 🔴🔴 **음성 대조가 내 1차 좌표를 반증했다 — 그대로 적는다.**
     *
     * 1차에는 `call` «부터» end 까지를 slice 했다. 그 구간에는 **호출 인자** 가 같은
     * 이름들을 들고 있어서, deps 에서 `webSearchEvidence` 를 **지워도 M4 가 통과** 했다.
     * 🟢 그래서 deps 배열 «만» 본다 — 호출이 닫히는 `}),` 뒤부터다.
     * 🔴 그리고 인자 쪽은 **따로** 센다(아래) — 두 구간이 같은 목록을 들어야 한다.
     */
    const depsStart = PANEL.indexOf("}),", call);
    expect(depsStart).toBeGreaterThan(-1);
    expect(depsStart).toBeLessThan(end);
    const deps = PANEL.slice(depsStart + 3, end);
    const args = PANEL.slice(call, depsStart);
    const SOURCES = [
      "data",
      "overseasMarketEvidence",
      "urlCandidateEvidence",
      "geminiEvidence",
      "overseasAutoEvidence",
      "reviewedSameEvidence",
      "domesticListingEvidence",
      "webSearchEvidence",
    ];
    for (const d of SOURCES) {
      expect(deps, `🔴 deps 에 ${d} 가 없다 — 그 출처가 도착해도 요약이 안 바뀐다`).toContain(d);
      expect(args, `🔴 조립 인자에 ${d} 가 없다 — 그 출처가 요약에 안 들어간다`).toContain(d);
    }
  });

  it("④-h 🟢 MI·가격·판정·수집 경로를 **건드리지 않았다**", () => {
    for (const banned of ["SAME_MIN_AXES", "priceTierFromLink", "threshold", "/api/"]) {
      expect(strip(PANEL_RAW.slice(PANEL_RAW.indexOf("export function buildJudgementSummaryInput"), PANEL_RAW.indexOf("export function DomesticPriceIntelligencePanel"))),
        `🔴 조립 함수에 ${banned} 가 있다`).not.toContain(banned);
    }
  });
});
