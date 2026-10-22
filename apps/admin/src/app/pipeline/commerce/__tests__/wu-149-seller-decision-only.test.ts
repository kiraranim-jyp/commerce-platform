import { existsSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DomesticPriceIntelligencePanel } from "../DomesticPriceIntelligencePanel";
import { productTabElement, regionsOf, visibleText, type TabOptions } from "./product-tab-composition";
import { readSourceAt, stripComments } from "./source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-149 — **셀러 화면은 「후보 조사 화면」이 아니라 「가격 판단 화면」이다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-22) — 이 WU 가 바꾼 것은 **표시 층 하나** 다:
 * ```
 * 제거  seller-facing candidate research presentation
 * 보존  internal candidate engine (수집 · 보강 · MI · SAME · 판매상태 · 가격추출 · 이력 · API)
 * ```
 *
 * ── 이 파일이 잠그는 일곱 ──────────────────────────────────────────────────────
 * ```
 * M1  legacy candidate UI 를 seller surface 에 되살리면                 → FAIL
 * M2  SIMILAR / DIFFERENT / 보류 후보를 **행으로** 기본 화면에 세우면    → FAIL
 * M3  Seller Decision 밖에 **두 번째 가격 owner** 를 만들면             → FAIL
 * M4  통화별 상한을 전역 상한으로 바꾸면   → `wu-148-market-price-signal` D 가 잡는다
 * M5  SAME 건수를 상한으로 잘라 숨기면     → 같은 파일이 잡는다(**재구현 금지**)
 * M6  `PRICE_COMPARISON_ANCHOR_ID` 앵커를 지우면                        → FAIL
 * M7  컴포넌트 파일 둘 / backend API 둘 / 엔진 호출부를 지우면           → FAIL
 * ```
 * 🔴 M4·M5 를 여기서 **다시 구현하지 않는다** — 이미 검증된 계약이 있다(CPO §4·§14).
 *
 * 🔴🔴 **이 파일의 축은 「마운트한 DOM」과 「소스 배선」 둘이다.** 하나만으로는
 *    둘 중 한쪽이 조용히 뚫린다 — 이 저장소가 WU-136 에서 겪었다(JSX 가 깨진
 *    상태로 소스 문자열 계약이 통과했고 마운트 DOM 이 잡았다).
 */

const WORKSPACE = stripComments(readSourceAt(new URL("../../CommerceWorkspace.tsx", import.meta.url)));
const STAGE_BODY = stripComments(readSourceAt(new URL("../StageBody.tsx", import.meta.url)));
const FOCUS = stripComments(readSourceAt(new URL("../stage-focus.ts", import.meta.url)));
const RUNNER = stripComments(
  readSourceAt(new URL("../../../api/price-history/_lib/run-domestic-price-check.ts", import.meta.url)),
);

const COMMERCE_DIR = path.join(__dirname, "..");
const API_DIR = path.join(__dirname, "..", "..", "..", "api");

/** 셀러가 실제로 보는 기본 화면 — ② 시장 판단 · ③ 등록 준비 둘 다 본다. */
function screen(options: TabOptions = {}): string {
  return visibleText(renderToStaticMarkup(productTabElement(options)));
}
const MARKET_STAGE: TabOptions = { marketDone: false };
const PREPARE_STAGE: TabOptions = { marketDone: true };

/* ───────────────────────── A. M1 — 후보 연구 UI 가 없다 ───────────────────────── */

describe("A. 🔴🔴 M1 — seller surface 에 candidate research UI 가 없다", () => {
  /** 🔴 소스 축 — 배선이 되살아나는 것을 막는다(렌더 조건 뒤에 숨는 경우 포함). */
  it("A-1 CommerceWorkspace 가 두 패널을 **렌더하지 않는다**", () => {
    expect(WORKSPACE).not.toContain("<DomesticShopSearch");
    expect(WORKSPACE).not.toContain("<ComparisonShopSearch");
    /** 🔴 import 도 없다 — 남겨 두면 다음 사람이 한 줄로 되살린다. */
    expect(WORKSPACE).not.toContain('from "./commerce/DomesticShopSearch"');
    expect(WORKSPACE).not.toContain('from "./commerce/ComparisonShopSearch"');
  });

  /** 🔴 슬롯째 사라졌다 — 슬롯만 남기면 거기에 표를 다시 꽂는 길이 열린다. */
  it("A-2 `marketEvidence` 슬롯이 **양쪽에서** 사라졌다(Workspace · StageBody)", () => {
    expect(WORKSPACE).not.toContain("marketEvidence={");
    expect(STAGE_BODY).not.toContain("marketEvidence: React.ReactNode");
    expect(STAGE_BODY).not.toContain("{marketEvidence}");
    /** 🔴 `StageFocus` 의 그 칸도 없다(칸이 있으면 배선이 돌아온다). */
    expect(FOCUS).not.toContain("marketEvidence:");
  });

  /** 🟢 마운트 축 — 두 단계 모두에서 그 제목/표가 실제로 안 그려진다. */
  it("A-3 🟢 마운트한 화면에 두 후보 표가 **없다**(② · ③ 둘 다)", () => {
    for (const [label, options] of [
      ["② 시장 판단", MARKET_STAGE],
      ["③ 등록 준비", PREPARE_STAGE],
    ] as const) {
      const text = screen(options);
      expect(text, `${label}: 국내 후보 표`).not.toContain("🇰🇷 한국 시장 · 국내 비교상품");
      expect(text, `${label}: 해외 후보 표`).not.toContain("🌎 글로벌 시장 · 해외 판매처 가격");
      expect(text, `${label}: 재검색 버튼`).not.toContain("가격비교 다시 검색");
    }
  });
});

/* ──────────────────── B. M2 — 셀러에게 판단을 떠넘기지 않는다 ──────────────────── */

describe("B. 🔴🔴 M2 — SIMILAR / DIFFERENT / 보류 후보를 **행으로** 세우지 않는다", () => {
  /**
   * 🔴 **「후보별 판단 과정」이 기본 화면에 없다**(CPO §8). 측정 대상은 «행» 이다 —
   *    후보 한 건마다 등급 배지가 붙은 줄이 셀러 화면에 서는 상태.
   * 🟡 **분모를 정직하게 적는다**: MI 패널의 **1차 건수 한 줄**(「… 보류·충돌된 후보가
   *    N건」 · WU-133)은 **목록이 아니라 수** 이고, 그 줄은 화면이 거짓말을 멈추게 한
   *    장치다(WU-133 이 넣고 WU-145 가 1차/2차 층을 갈랐다). 🔴 그래서 이 계약은
   *    **그 한 줄을 금지하지 않는다** — 금지하는 것은 **후보 행** 이다.
   */
  it("B-1 기본 화면에 후보 등급 배지가 붙은 **행** 이 없다", () => {
    for (const options of [MARKET_STAGE, PREPARE_STAGE]) {
      const stage = regionsOf(renderToStaticMarkup(productTabElement(options))).stage;
      const text = visibleText(stage);
      /** 🔴 등급 어휘가 단계 본문에 **행으로** 서지 않는다. */
      expect(text).not.toContain("🟡 동일상품 추정");
      expect(text).not.toContain("⚪ 유사상품");
      expect(text).not.toContain("❌ 동일상품 아님");
      /** 🔴 표 자체가 없다 — 배지 글자만 바꿔 우회하는 길을 막는다. */
      expect(/<table/.test(stage), "🔴 단계 본문에 후보 표가 서 있다").toBe(false);
    }
  });

  /** 🔴 셀러에게 「직접 판단하라」고 요구하는 버튼이 기본 화면에 없다. */
  it("B-2 기본 화면에 후보 판정 버튼(동일/유사/다름/보류)이 없다", () => {
    for (const options of [MARKET_STAGE, PREPARE_STAGE]) {
      const text = screen(options);
      for (const label of ["동일상품입니다", "유사상품입니다", "다른 상품입니다", "판단 보류"]) {
        expect(text, `🔴 "${label}" 버튼이 기본 화면에 있다`).not.toContain(label);
      }
    }
  });
});

/* ─────────────────── C. M3 — 가격 owner 는 Seller Decision 하나 ─────────────────── */

describe("C. 🔴🔴 M3 — 가격/판단 영역은 **하나** 다", () => {
  it("C-1 `MarketPriceComparison` 이 **정확히 한 번** 렌더된다", () => {
    expect(WORKSPACE.split("<MarketPriceComparison").length - 1).toBe(1);
  });

  /** 🔴 중복이던 「📊 시장 가격 비교」 접힘이 StageBody 에서 사라졌다. */
  it("C-2 StageBody 에 두 번째 가격 영역이 **없다**", () => {
    expect(STAGE_BODY).not.toContain('title="📊 시장 가격 비교"');
    expect(STAGE_BODY).not.toContain("🇰🇷 국내 경쟁 판매자 · 🌎 해외 판매처에서 관측된 가격");
    expect(STAGE_BODY).not.toContain("openMarketEvidenceRequest");
  });

  it("C-3 🟢 마운트한 화면에도 「📊 시장 가격 비교」가 없다(②·③ 둘 다)", () => {
    for (const options of [MARKET_STAGE, PREPARE_STAGE]) {
      expect(screen(options)).not.toContain("📊 시장 가격 비교");
    }
  });

  /**
   * 🔴🔴 **빈 단계를 만들지 않았다** — ② 의 본문을 통째로 지우면 `wu-058` 의
   *    「단계마다 본문 하나」가 뜻을 잃는다(focus 값은 통과하지만 화면이 빈다).
   * 🟢 그래서 ② 는 **결론이 어디 있는지** 를 한 줄로 말한다.
   */
  it("C-4 🟢 ② 시장 판단 단계가 **빈 본문이 아니다**", () => {
    const text = visibleText(regionsOf(renderToStaticMarkup(productTabElement(MARKET_STAGE))).stage);
    expect(text).toContain("지금 단계 · 2. 시장 판단");
    expect(text).toContain("결론은 화면 맨 위");
    expect(text).toContain("동일상품 여부는 시스템이 판단합니다");
    /** 🔴 그 한 줄이 **가격 숫자를 말하지 않는다** — 말하면 owner 가 둘이 된다. */
    expect(text).not.toMatch(/₩|\$|€|£/);
  });
});

/* ────────────────────────── D. M6 — 앵커 보존 계약 ────────────────────────── */

describe("D. 🔴 M6 — `PRICE_COMPARISON_ANCHOR_ID` 를 지우지 않았다", () => {
  /**
   * 🔴 WU-141-R3 이 「앵커는 보존 계약」이라 적었다. WU-149 는 그 앵커가 감싸는
   *    대상을 **원자료 두 패널 → 가격 owner 영역** 으로 옮겼을 뿐이다.
   */
  it("D-1 상수와 앵커 div 가 둘 다 살아 있다", () => {
    expect(WORKSPACE).toContain("PRICE_COMPARISON_ANCHOR_ID");
    expect(WORKSPACE).toContain("id={PRICE_COMPARISON_ANCHOR_ID}");
  });

  it("D-2 🔴 앵커가 **가격 owner 영역** 을 감싼다", () => {
    const anchor = WORKSPACE.indexOf("id={PRICE_COMPARISON_ANCHOR_ID}");
    const area = WORKSPACE.indexOf("<MarketPriceComparison");
    expect(anchor).toBeGreaterThan(-1);
    expect(anchor).toBeLessThan(area);
    expect(area - anchor, "🔴 앵커와 그 영역 사이에 다른 것이 들어왔다").toBeLessThan(200);
  });
});

/* ─────────────────────── E. M7 — 내부 엔진은 살아 있다 ─────────────────────── */

describe("E. 🔴🔴 M7 — internal candidate engine 을 지우지 않았다", () => {
  /**
   * 🔴 A~C 가 「셀러 화면에 없다」만 단언하므로, 이 구역이 없으면 다음 사람이
   *    **컴포넌트와 API 를 삭제해도 전부 통과** 한다. 그것이 CPO §6 가 금지한 방향이다.
   */
  it("E-1 컴포넌트 파일 둘이 **그대로 있다**(렌더만 멈췄다)", () => {
    for (const f of ["DomesticShopSearch.tsx", "ComparisonShopSearch.tsx"]) {
      expect(existsSync(path.join(COMMERCE_DIR, f)), `🔴 ${f} 가 삭제됐다`).toBe(true);
    }
  });

  it("E-2 backend API 둘이 **그대로 있다**", () => {
    for (const route of [
      path.join(API_DIR, "domestic-price-sources", "search", "route.ts"),
      path.join(API_DIR, "comparison", "search", "route.ts"),
    ]) {
      expect(existsSync(route), `🔴 backend API 가 삭제됐다: ${route}`).toBe(true);
    }
  });

  /**
   * 🟢🟢 **그리고 서버 수집 경로가 살아 있다** — 셀러 화면이 자기 검색을 멈춘 뒤에도
   *    후보는 `/check` 에서 서버가 모은다(국내 등록부 + WU-130 해외 자동풀).
   * 🔴 이 단언이 없으면 「화면도 서버도 안 찾는다」와 구별되지 않는다.
   */
  it("E-3 🟢 서버 수집 호출부가 살아 있다(국내 등록부 · 해외 자동풀 · MI)", () => {
    expect(RUNNER).toContain("searchDomesticShops");
    expect(RUNNER).toContain("collectOverseasAutoPool");
    expect(RUNNER).toContain("judgeDomesticCandidate");
  });
});

/* ───────────── G. WU-152 — CEO 육안 FAIL 이 만든 계약(seller surface) ───────────── */

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 **WU-152 — CEO 육안 FAIL(2026-10-22)이 이 구역을 만들었다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * WU-149 는 격자 밖의 **후보 표 둘** 을 지웠다. 🔴 그런데 CEO 화면에는 여전히
 * **「Market Intelligence」 패널 안쪽** 이 통째로 서 있었다 — 조건부 판매 카드 ·
 * 수익성/환산 숫자 · 후보 구역들 · 📚 검토 이력 · 판단 근거.
 * ⟹ 🔴 「Seller Decision 하나」가 **육안 기준으로 달성되지 않았다**(CEO 판정 FAIL).
 *
 * 🟢 WU-152 의 수정은 **한 줄** 이다 — 그 패널을 셀러 화면에서 `HIDDEN` 으로 둔다.
 *    `presentation === "HIDDEN"` 은 **훅을 전부 돌린 뒤** `return null` 이므로
 *    계산·공급(`onMarketComparisonChange`)은 **그대로 산다**(엔진 보존).
 */
describe("G. 🔴🔴 WU-152 — seller surface 에 판단 영역이 **하나** 다", () => {
  /** 🔴 CPO STEP 9 — 이 글자들이 셀러 1차 화면에 있으면 FAIL 이다. */
  const FORBIDDEN = [
    "국내 비교상품",
    "글로벌 시장 · 해외 판매처 가격",
    "가격비교 다시 검색",
    "Market Intelligence",
  ];

  /**
   * ══════════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 **1차에 틀렸고 그 과정에서 «구조적 사실» 을 찾았다** — 그대로 적는다.
   * ══════════════════════════════════════════════════════════════════════════════
   *
   * 처음에는 이 단언을 `product-tab-composition` 하니스로 쓰려 했고 **FAIL 했다.**
   * 🔴 원인은 내 코드가 아니라 **하니스의 구조** 였다:
   * ```
   * 프로덕션   <DomesticPriceIntelligencePanel>   ← outer · 여기에 HIDDEN → return null
   * 하니스     <MiPanelView>                      ← inner · **그 게이트를 건너뛴다**
   * ```
   * ⟹ 🔴 **하니스는 「MI 패널이 화면에서 사라졌는가」를 측정할 수 없다.** 그것이
   *    CEO 육안 FAIL 이 계약에 한 번도 잡히지 않은 이유다(WU-110 교훈의 UI 판).
   * 🟢 그래서 **owner 를 직접 마운트** 한다 — `wu-056r1` 이 쓰는 그 방식 그대로다.
   * 🔴 하니스는 **건드리지 않았다**(기존 계약 수십 개가 그 트리를 본다).
   */
  it("G-1 🔴🔴 MI 패널은 `HIDDEN` 에서 **아무것도 그리지 않는다**(owner 직접 마운트)", async () => {
    const dom = new JSDOM("<!doctype html><div id=root></div>");
    const g = globalThis as unknown as Record<string, unknown>;
    /** 🔴 `navigator` 는 getter-only 라 건드리지 않는다(1차에 TypeError 가 났다). */
    const prev = { window: g.window, document: g.document };
    g.window = dom.window;
    g.document = dom.window.document;
    g.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      const container = dom.window.document.getElementById("root")!;
      const root = createRoot(container);
      await act(async () => {
        root.render(createElement(DomesticPriceIntelligencePanel, { snapshotId: "wu152", presentation: "HIDDEN" }));
      });
      /** 🔴 **빈 DOM** 이어야 한다 — 「Market Intelligence」도 후보 구역도 서지 않는다. */
      expect(container.innerHTML, "🔴 HIDDEN 인데 MI 패널이 무언가를 그렸다").toBe("");
      for (const needle of FORBIDDEN) {
        expect(container.textContent ?? "", `🔴 "${needle}" 이 남아 있다`).not.toContain(needle);
      }
      await act(async () => root.unmount());
    } finally {
      g.window = prev.window;
      g.document = prev.document;
    }
  });

  /** 🔴 StageBody 축 — 단계 본문에도 그 글자가 없다(후보 연구 UI 제거 · WU-149). */
  it("G-1b 🔴 단계 본문에도 금지 문자열이 없다(② · ③)", () => {
    for (const [label, options] of [
      ["② 시장 판단", MARKET_STAGE],
      ["③ 등록 준비", PREPARE_STAGE],
    ] as const) {
      const stage = visibleText(regionsOf(renderToStaticMarkup(productTabElement(options))).stage);
      for (const needle of FORBIDDEN) {
        expect(stage, `${label}: 🔴 "${needle}" 이 단계 본문에 있다`).not.toContain(needle);
      }
    }
  });

  /** 🔴 소스 축 — 패널이 다시 단계값을 받으면 CEO FAIL 구조가 그대로 돌아온다. */
  it("G-2 🔴 MI 패널이 셀러 화면에서 **HIDDEN 고정** 이다", () => {
    expect(WORKSPACE).toContain('presentation="HIDDEN"');
    expect(WORKSPACE).not.toContain("presentation={stageFocus.mi}");
  });

  /**
   * 🔴🔴 **엔진 보존 — 패널을 «지운» 것이 아니다.**
   *    마운트가 사라지면 `onMarketComparisonChange` 공급이 끊겨 결론 영역이 **빈다**.
   */
  it("G-3 🟢 패널은 여전히 **마운트된다**(공급선 보존)", () => {
    expect(WORKSPACE).toContain("<DomesticPriceIntelligencePanel");
    expect((WORKSPACE.match(/<DomesticPriceIntelligencePanel/g) ?? []).length).toBe(1);
    expect(WORKSPACE).toContain("onMarketComparisonChange={setMarketComparison}");
  });

  /** 🔴 커머스 탭 보호는 **그대로** 다 — 축만 `stageFocus.mi` → 탭으로 바뀌었다. */
  it("G-4 🔴 결론 영역에 커머스 탭 보호 게이트가 붙어 있다", () => {
    const area = WORKSPACE.indexOf("<MarketPriceComparison");
    const gate = WORKSPACE.lastIndexOf('workSurface !== "CHANNEL"', area);
    expect(gate).toBeGreaterThan(-1);
    expect(area - gate).toBeLessThan(200);
  });
});

/* ──────────────────────── F. 2-PRODUCT E2E (CPO §16) ──────────────────────── */

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 **F. 상품 둘로 실제 Seller Decision 흐름을 본다**(CPO §16)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 여기서 「가격 해석」 자체를 다시 단언하지 않는가** — 🇰🇷 가격대 · 🌎 최저
 *    확인가 · 1건은 「확정 불가」 · 환산 금지 · 추천가 0 은 **WU-146/148 이 계약
 *    30+ 건으로 이미 잠갔다**(CPO §4·§14 「재구현하지 않는다」). 여기서 보는 것은
 *    **WU-149 가 더한 성질** 이다 — 「그 결론 **하나만** 셀러에게 남았는가」.
 *
 * 🔴 **측정 한계를 먼저 적는다**: 실제 따져 화면은 CTO 가 볼 수 없다(로그인 뒤) ⟹
 *    화면 축은 **마운트한 DOM** 이다. 「Production UI PASS」로 적지 않는다.
 */
describe("F. 🔴🔴 2-product E2E — 결론 하나 · 후보 연구 UI 0", () => {
  /**
   * **Product A** — SAME 있음 + 가격 있음(🌎 USD/GBP 혼재).
   * 🟢 기대: 셀러는 결론 영역에서 **통화별 최저 확인가** 를 읽고, 그 아래에
   *    후보 표가 **없다**.
   */
  it("F-1 A: SAME + 가격(USD·GBP) — 결론만 남고 후보 표가 없다", () => {
    const text = screen(MARKET_STAGE);
    /** 🔴 후보 연구 UI 0 — 이 단계에서 확인할 수 있는 WU-149 의 산출이다. */
    expect(text).not.toContain("🇰🇷 한국 시장 · 국내 비교상품");
    expect(text).not.toContain("🌎 글로벌 시장 · 해외 판매처 가격");
    expect(text).not.toContain("📊 시장 가격 비교");
    /** 🟢 셀러가 읽을 결론은 MI 판단 카드 + 그 위 가격 owner 하나다. */
    expect(text).toContain("Market Intelligence");
    /**
     * 🔴🔴 **환산 단언을 «범위» 로 쓴다 — 전면 금지로 쓰면 틀린다.**
     *
     * 🔴 1차 구현에서 `not.toContain("약 ₩")` 로 썼고 **FAIL 했다.** 그 글자는
     *    **「원본 상품」 줄의 원화 환산**(`EUR 50.00` + `약 ₩77,828 · 원화 환산`)이고,
     *    WU-056-R1 이 CEO 확인까지 거쳐 **「정상 · 제거하지 않았다」** 로 닫은 값이다.
     *    ⟹ 🔴 내 단언이 틀렸고 코드가 맞았다(이 저장소에서 같은 함정이 네 번째다 —
     *    WU-139·WU-144·WU-146 의 「평균」 리터럴 금지와 같은 계열).
     * 🟢 그래서 **개수** 로 잠근다: 환산은 **원본 상품 축 하나** 에만 있다. 시장 가격
     *    축이 환산을 시작하면 이 수가 올라가 FAIL 한다(환산 금지 계약의 실질).
     */
    expect(text).toContain("원화 환산");
    expect((text.match(/약 ₩/g) ?? []).length, "🔴 환산이 둘 이상이다 — 시장 가격 축이 환산을 시작했다").toBe(1);
  });

  /**
   * **Product B** — SAME 부족/가격 없음.
   * 🟢 기대: 가격대를 **억지로 만들지 않는다** · 후보를 셀러가 판정하지 않는다.
   * 🔴 「가격대 확정 불가」 문구 자체의 owner 는 `MarketPriceComparison`(WU-148)이고
   *    이 하니스 **밖** 이다 ⟹ 여기서는 **그 영역이 둘이 아님** 과 **판정 버튼 0** 을 본다.
   */
  it("F-2 B: SAME 부족/가격 없음 — 셀러에게 판정을 요구하지 않는다", () => {
    const text = screen(PREPARE_STAGE);
    for (const label of ["동일상품입니다", "유사상품입니다", "다른 상품입니다", "판단 보류"]) {
      expect(text, `🔴 "${label}" 이 ③ 단계에 있다`).not.toContain(label);
    }
    expect(text).not.toContain("가격비교 다시 검색");
    /** 🟢 ③ 에서도 가격 영역이 하나다(중복 접힘이 되살아나지 않았다). */
    expect(text).not.toContain("📊 시장 가격 비교");
  });

  /**
   * 🟢🟢 **mixed currency 는 WU-148 D-3 가 «숫자로» 지킨다**(USD 4 + GBP 1 →
   *    두 통화 **둘 다 생존** · 각 최저가 보존 · 통화별 상한). 🔴 그 계약을 여기서
   *    복제하지 않는다 — 복제하면 같은 성질의 owner 가 둘이 된다(이 트랙의 교훈).
   * 🔴 대신 **그 계약이 실재하는지** 를 확인해 둔다(지워지면 이 WU 의 전제가 사라진다).
   */
  it("F-3 🔴 통화별 상한 계약이 **다른 파일에 실재한다**(재구현 금지의 근거)", () => {
    const wu148 = stripComments(readSourceAt(new URL("./wu-148-market-price-signal.test.ts", import.meta.url)));
    expect(wu148).toContain("D-3 상한은 **통화별** 이다");
    expect(wu148).toContain("D-2 **건수는 자르지 않는다**");
  });
});
