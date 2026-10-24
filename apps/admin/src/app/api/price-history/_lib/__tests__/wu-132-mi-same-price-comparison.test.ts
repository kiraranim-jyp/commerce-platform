// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MI_SAME_AREA_TITLE,
  /** 🔴 WU-136 — 영역 제목이 「시장 판매 판단」으로 바뀌었다(영역 수는 그대로 하나). */
  MARKET_JUDGEMENT_TITLE,
  MARKET_VERDICT_TEXT,
  MI_SAME_EMPTY,
  isNotSoldOut,
  isPriceConfirmed,
  selectMiSameCandidates,
  transientDisplayTier,
} from "../../../../pipeline/commerce/mi-same-candidates";
import { MarketPriceComparison } from "../../../../pipeline/commerce/MarketPriceComparison";
import {
  GeminiTransientCandidates,
  IMAGE_MISSING_TEXT,
  REVIEWED_SAME_HEADING,
  SOURCE_LABEL,
  STOCK_TEXT,
  stockText,
  type GeminiTransientRow,
} from "../../../../pipeline/commerce/GeminiTransientCandidates";
import { isTransientShopId, REVIEWED_SAME_SHOP_ID, TRANSIENT_SHOP_IDS } from "../transient-candidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-132 — **MI SAME → 가격 비교 / SAME 아님 → 사람 검토 / feedback → 재투입**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 WU 가 고친 것은 「영역 추가」가 아니다.** 전수검토가 찾은 구조적 사실:
 * ```
 * 「📊 시장 가격 비교」의 두 패널은 **클라이언트가 자기 검색을 돌려**
 * `mayShowCandidate` 로 거른다 ⟹ `/check` 의 **MI verdict 를 한 번도 보지 않았다.**
 * 그래서 「MI 가 SAME 이라 판정한 후보」가 가격 비교에 **구조적으로 닿지 못했다.**
 * ```
 * 🟢 그 영역에 **MI 산출을 공급** 하는 것이 이번 작업이고, 이 파일이 그 사슬을 잠근다.
 *
 * ── 🔴 데이터는 지어내지 않았다 ────────────────────────────────────────────
 * 아래 행들은 WU-130 E2E 실측값이다(원상품 `b226ac009`):
 * `junioredition.com GBP 37 VERIFIED_CURRENT PRESUMED_SAME` ·
 * `villagekids.co.uk GBP 21.2 UNVERIFIED_SEARCH PRESUMED_SAME` ·
 * `biskuit.kr KRW 88,000 VERIFIED_CURRENT`(WU-077 실측 국내 후보).
 */

const LIB = path.join(__dirname, "..");
const strip = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const COMMERCE = path.join(__dirname, "..", "..", "..", "..", "pipeline", "commerce");
const RUNNER = strip(path.join(LIB, "run-domestic-price-check.ts"));
const ROUTE = strip(path.join(LIB, "..", "check", "route.ts"));
const REVIEW_LIB = strip(path.join(LIB, "candidate-review.ts"));
const POOL = strip(path.join(LIB, "url-candidate-pool.ts"));
const AREA = strip(path.join(COMMERCE, "MarketPriceComparison.tsx"));
const SELECTOR = strip(path.join(COMMERCE, "mi-same-candidates.ts"));
const PANEL = strip(path.join(COMMERCE, "DomesticPriceIntelligencePanel.tsx"));
const WORKSPACE = strip(path.join(COMMERCE, "..", "CommerceWorkspace.tsx"));
/** 🔴 WU-140 — 「커머스 탭에 MI 를 표시하지 않는다」의 owner(CEO 지시 · 규칙 사본 금지). */
const FOCUS = strip(path.join(COMMERCE, "stage-focus.ts"));

/** 🟢 공통 기본값 — 각 테스트가 **보는 축만** 덮어쓴다(무엇을 재는지 흐려지지 않게). */
const base: GeminiTransientRow = {
  domain: "example.com",
  title: "후보",
  source: "OVERSEAS_AUTO",
  discoveredUrl: "https://example.com/products/x",
  priceStatus: "VERIFIED_CURRENT",
  priceAmount: 37,
  priceCurrency: "GBP",
  market: "OVERSEAS",
  soldOut: false,
  imageUrl: "https://example.com/i.jpg",
  matchTruth: "EXACT_IDENTIFIER",
};
const row = (over: Partial<GeminiTransientRow> = {}): GeminiTransientRow => ({ ...base, ...over });

/* ═════════════ A. 🔴 선별기 — 세 축을 «읽기만» 한다 (순수 · 네트워크 0) ═════════════ */

describe("A. 🔴 SAME + 현재 판매중 + 가격확인 (CPO ②)", () => {
  it("A-1 🟢 세 축을 전부 통과한 후보만 가격비교에 올라간다", () => {
    const sel = selectMiSameCandidates([row()], "OVERSEAS");
    expect(sel.priced).toHaveLength(1);
    expect(sel.sameButExcluded).toHaveLength(0);
  });

  it("A-2 🔴 SAME 이 아니면 가격비교에 **들어가지 않는다**", () => {
    /** 🔴 PRESUMED_SAME(보류)은 SAME 이 아니다 — WU-123/125 가 그 4건을 전부
     *  Human DIFFERENT 로 측정했고, 그것이 금액에 들어가던 모양이었다. */
    const sel = selectMiSameCandidates([row({ matchTruth: "TEXT_CONFIRMED" })], "OVERSEAS");
    expect(sel.priced).toHaveLength(0);
    /** 🟢 **사라지는 것은 아니다** — 출처별 후보 구역이 모든 행을 그대로 그린다
     *  (그 성질은 `mi-022`·`wu-081`·`wu-130 D-4` 가 「총 행 수 불변」으로 잠근다). */
    expect(sel.sameButExcluded).toHaveLength(0);
  });

  it("A-3 🔴 품절은 가격비교에서 **빠지고 이유가 남는다**(조용히 버리지 않는다)", () => {
    const sel = selectMiSameCandidates([row({ soldOut: true })], "OVERSEAS");
    expect(sel.priced).toHaveLength(0);
    expect(sel.sameButExcluded.map((x) => x.reason)).toEqual(["SOLD_OUT"]);
  });

  it("A-4 🔴 가격이 **검증되지 않았으면** 빠진다 — 숫자가 있어도 안 쓴다", () => {
    /** 🔴 `UNVERIFIED_SEARCH` 는 「판매처 표시가」다. 승격하지 않는다(P-4-DATA-4). */
    const sel = selectMiSameCandidates([row({ priceStatus: "UNVERIFIED_SEARCH", priceAmount: 21.2 })], "OVERSEAS");
    expect(sel.priced).toHaveLength(0);
    expect(sel.sameButExcluded.map((x) => x.reason)).toEqual(["PRICE_UNCONFIRMED"]);
    expect(isPriceConfirmed(row({ priceStatus: "UNVERIFIED_SEARCH" }))).toBe(false);
  });

  it("A-5 🔴🔴 `soldOut === null` 을 「품절」로도 「판매중」으로도 **단정하지 않는다**", () => {
    /**
     * 🔴 실측 근거(헌장 §12): 국내 관측 `sold_out` 은 **true 0행 · null 113행** 이다.
     *    `=== false` 를 요구하면 가격비교가 **구조적으로 항상 비어 있다**.
     * 🟢 그래서 운영 집계 owner 와 같은 규칙(`품절 확인된 것만 제외`)을 쓰고,
     *    화면은 **「재고 확인불가」** 라고 적는다(「판매중」이라 적지 않는다).
     */
    expect(isNotSoldOut(row({ soldOut: null }))).toBe(true);
    expect(stockText(null)).toBe(STOCK_TEXT.UNKNOWN);
    expect(stockText(null)).not.toContain("판매중");
    expect(selectMiSameCandidates([row({ soldOut: null })], "OVERSEAS").priced).toHaveLength(1);
  });

  it("A-6 🔴🔴 시장을 **추측하지 않는다** — UNKNOWN 은 어느 금액 축에도 안 들어간다", () => {
    /**
     * 🔴 WU-020 §4 의 그 계약이다 — `UNKNOWN` 을 국내로 승격하지 않는다.
     *    🟢 실측 선례: `m.luxboy.com KRW 59,000`(`.com`+KRW → UNKNOWN)이 어느 축에도
     *       들어가지 않았고, WU-077 이 그 금액을 **Human DIFFERENT** 로 측정했다
     *       — **안 넣은 것이 정답** 이었다.
     */
    const rows = [row({ market: "UNKNOWN", discoveredUrl: "https://a.com/1" })];
    expect(selectMiSameCandidates(rows, "KR").priced).toHaveLength(0);
    expect(selectMiSameCandidates(rows, "OVERSEAS").priced).toHaveLength(0);
    /** 🔴 「빠졌다」고 적지도 않는다 — 그 시장의 후보가 **아니기** 때문이다. */
    expect(selectMiSameCandidates(rows, "KR").sameButExcluded).toHaveLength(0);
  });

  it("A-7 🟢 국내/해외가 **갈린다**(한 배열이 두 칸을 채우지 않는다)", () => {
    const rows = [
      row({
        domain: "biskuit.kr",
        market: "KR",
        priceCurrency: "KRW",
        priceAmount: 88000,
        discoveredUrl: "https://biskuit.kr/p/1",
      }),
      row({ domain: "junioredition.com", market: "OVERSEAS", discoveredUrl: "https://junioredition.com/p/2" }),
    ];
    expect(selectMiSameCandidates(rows, "KR").priced.map((r) => r.domain)).toEqual(["biskuit.kr"]);
    expect(selectMiSameCandidates(rows, "OVERSEAS").priced.map((r) => r.domain)).toEqual(["junioredition.com"]);
  });

  it("A-8 🔴 같은 URL 은 **접는다** — 네 생산자가 같은 판매처를 낼 수 있다", () => {
    const dup = [row({ source: "OVERSEAS_AUTO" }), row({ source: "REVIEWED_SAME" })];
    expect(selectMiSameCandidates(dup, "OVERSEAS").priced).toHaveLength(1);
  });

  it("A-9 🔴 판정이 **없으면** SAME 이 아니다(지어내지 않는다)", () => {
    const none = row({ matchTruth: null, crossSellerVerdict: null });
    expect(transientDisplayTier(none)).toBeNull();
    expect(selectMiSameCandidates([none], "OVERSEAS").priced).toHaveLength(0);
  });

  it("A-10 🟢 등급 어휘를 **새로 만들지 않았다** — owner 둘만 읽는다", () => {
    expect(transientDisplayTier(row({ matchTruth: "STRONG_IDENTIFIER" }))).toBe("SAME");
    expect(transientDisplayTier(row({ matchTruth: null, crossSellerVerdict: "SAME" }))).toBe("SAME");
    expect(transientDisplayTier(row({ matchTruth: null, crossSellerVerdict: "CONFLICT" }))).toBe("CONFLICT");
    /** 🔴 모르는 값을 등급으로 쓰지 않는다. */
    expect(transientDisplayTier(row({ matchTruth: null, crossSellerVerdict: "WHATEVER" }))).toBeNull();
  });

  /** 🔴🔴 선별기가 **판정기가 아니다** — 점수/문턱/새 축이 그 파일에 없어야 한다. */
  it("A-11 🔴 선별기에 threshold·새 판단축이 **없다**", () => {
    for (const forbidden of [
      "SAME_MIN_AXES",
      "MIN_DISPLAY_SIMILARITY",
      "confidence >",
      "confidence >=",
      "compareCrossSeller",
      "deriveMatchTruth",
    ]) {
      expect(SELECTOR).not.toContain(forbidden);
    }
  });
});

/* ═════════════ B. 🔴 가격 비교 영역은 «하나» 다 (마운트 DOM) ═════════════ */

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

const sec = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const mountArea = async (props: Record<string, unknown>) => {
  await act(async () => {
    root.render(createElement(MarketPriceComparison, props as never));
  });
};

describe("B. 🔴 영역 (마운트 DOM)", () => {
  it("B-1 🔴 조회가 돌지 않았으면 **아무것도 그리지 않는다**(빈 테두리 금지)", async () => {
    await mountArea({});
    expect(sec("market-price-comparison")).toBeNull();
  });

  it("B-2 🔴🔴 조회가 돌았으면 후보가 0 이어도 **선다** — 「조회 안 함」과 다르다", async () => {
    await mountArea({ rows: [] });
    expect(sec("market-price-comparison")).toBeTruthy();
    /**
     * 🔴🔴 WU-136 — **앵커를 갱신하고 «강화» 했다.** 영역 제목이
     *    「📊 동일상품 가격 비교」 → **「📊 시장 판매 판단」** 으로 바뀌었다(CPO §A:
     *    셀러의 1순위는 「동일상품인가」가 아니라 **「팔아도 되는가」** 다).
     * 🟢 **영역은 여전히 «하나» 다** — 새로 만들지 않고 같은 영역의 순서를 뒤집었다.
     *
     * 🔴🔴 **WU-140 에서 이 주석을 정정한다.** 전에는 「판매 결론이 **제목 바로 뒤에**
     *    선다」고 적어 뒀는데, CPO 가 확정한 순서는 **🇰🇷 국내 → 🌎 해외 → 판매·가격
     *    판단 결과** 다 ⟹ 결론은 이제 **시장 블록 뒤** 다. 🔴 주석이 코드와 어긋난
     *    상태로 두면 다음 세션이 그 주석을 근거로 순서를 되돌린다.
     * 🟢 이 단언이 지키는 성질(「제목과 결론 문장이 **둘 다** 선다」)은 **그대로** 이고,
     *    **순서** 는 `wu-140-market-first` 가 마운트 DOM 으로 더 세게 잠근다.
     */
    expect(container.textContent).toContain(MARKET_JUDGEMENT_TITLE);
    expect(sec("market-verdict")?.textContent).toBe(MARKET_VERDICT_TEXT.NO_SAME);
    /** 🔴 「국내에 동일상품이 없다」로 적지 않는다(부재와 미발견은 다르다). */
    expect(container.textContent).toContain(MI_SAME_EMPTY);
    expect(container.textContent).not.toMatch(/국내에 (동일상품|상품)이 없/);
  });

  it("B-3 🟢 MI SAME 후보가 **금액과 함께** 선다 — 통화 그대로 · 환산 0", async () => {
    await mountArea({
      rows: [
        row({ domain: "junioredition.com", market: "OVERSEAS" }),
        row({
          domain: "biskuit.kr",
          market: "KR",
          priceCurrency: "KRW",
          priceAmount: 88000,
          discoveredUrl: "https://biskuit.kr/p/1",
        }),
      ],
    });
    const kr = sec("mi-same-domestic")!;
    const os = sec("mi-same-overseas")!;
    expect(kr.textContent).toContain("KRW 88,000");
    expect(os.textContent).toContain("GBP 37");
    /** 🔴 환산·기호 변환 0 — 이 영역 **안** 에 원화 환산이 없다(wu-056r1 과 같은 규칙). */
    expect(os.textContent).not.toMatch(/₩|원화|환산|≈|[€$£¥]/);
    expect(os.textContent).not.toMatch(/약\s*[0-9]/);
  });

  it("B-4 🔴 SAME 이 아닌 후보는 이 영역에 **없다**(가격비교 제외)", async () => {
    await mountArea({ rows: [row({ matchTruth: "SIMILAR", domain: "noise.com" })] });
    expect(sec("market-price-comparison")!.textContent).not.toContain("noise.com");
    expect(container.querySelectorAll('[data-testid="mi-same-row"]')).toHaveLength(0);
  });

  it("B-5 🔴 SAME 인데 빠진 후보는 **이유와 함께** 적힌다", async () => {
    await mountArea({ rows: [row({ domain: "villagekids.co.uk", priceStatus: "UNVERIFIED_SEARCH" })] });
    const excluded = sec("mi-same-excluded")!;
    expect(excluded.textContent).toContain("villagekids.co.uk");
    expect(excluded.textContent).toContain("가격 확인 필요");
  });

  it("B-6 🟢 두 참고가격 집계가 **이 영역 안** 에 선다(WU-130 ④ 에서 이동)", async () => {
    await mountArea({
      rows: [],
      domesticReference: { count: 1, byCurrency: { KRW: { count: 1, lowestAmount: 88000 } }, byMarket: { KR: 1 }, byPriceTier: { COMPARISON: 1 } },
      overseasReference: { count: 1, byCurrency: { GBP: { count: 1, lowestAmount: 37 } }, byMarket: { OVERSEAS: 1 }, byPriceTier: { EXACT: 1 } },
    });
    /**
     * 🔴🔴 CORE-2R-5 — **국내 집계만 「1차 🇰🇷 블록」으로 올라갔다**(해외는 그대로 2차).
     *    전에는 둘 다 `▸ MI 상세 분석` 접힘 안이라 셀러가 국내 가격을 볼 수 없었다.
     * 🟢 계약의 뜻(「두 집계가 **이 영역 안** 에 선다」)은 그대로다 — 영역을 떠나지 않았다.
     * 🔴 그리고 국내는 **한 곳에만** 있어야 한다(복제하면 가격 숫자가 둘이 된다).
     */
    expect(sec("market-block-domestic")!.querySelector('[data-testid="domestic-reference"]')).toBeTruthy();
    expect(sec("mi-same-domestic")!.querySelector('[data-testid="domestic-reference"]')).toBeNull();
    expect(
      sec("market-price-comparison")!.querySelectorAll('[data-testid="domestic-reference"]').length,
    ).toBe(1);
    /**
     * 🔴🔴🔴 **CORE-2S §5-④ — 해외 집계도 1차로 올라갔다. 이 단언이 뒤집혔다.**
     *
     * 🔴 CORE-2R-5 는 국내만 올려서 🇰🇷 는 첫 화면 · 🌎 는 **접힘을 열어야** 보였다 ⟹
     *    CPO §5-④ 가 지목한 **비대칭** 이다(「🌎 를 🇰🇷 와 같은 정보 구조로」).
     * 🟢 계약의 뜻(「두 집계가 **이 영역 안** 에 선다」)은 **그대로** 다 — 둘 다 영역을
     *    떠나지 않았고, 이제 **둘 다 1차** 다. 🔴 그리고 **각각 한 곳에만** 있어야 한다.
     */
    expect(sec("market-block-overseas")!.querySelector('[data-testid="overseas-reference"]')).toBeTruthy();
    expect(sec("mi-same-overseas")!.querySelector('[data-testid="overseas-reference"]')).toBeNull();
    expect(
      sec("market-price-comparison")!.querySelectorAll('[data-testid="overseas-reference"]').length,
    ).toBe(1);
    /** 🔴 아이콘이 겹치지 않는다(wu-056r1 §5 계약 그대로). */
    expect(sec("overseas-reference")!.textContent).toContain("🧾");
    expect(sec("overseas-reference")!.textContent).not.toContain("🌐");
  });
});

/* ═════════════ C. 🔴 공급 사슬 — 끊기면 「MI SAME 인데 화면에 없다」가 된다 ═════════════ */

describe("C. 🔴🔴 MI → 영역 공급 배선", () => {
  it("C-1 🔴 패널이 네 배열을 **합쳐 위로 올려보낸다**", () => {
    const start = PANEL.indexOf("const marketComparisonInput = useMemo");
    expect(start).toBeGreaterThan(-1);
    const expr = PANEL.slice(start, PANEL.indexOf("const onMarketComparisonChangeRef", start));
    for (const f of ["geminiEvidence", "urlCandidateEvidence", "overseasAutoEvidence", "reviewedSameEvidence"]) {
      expect(expr).toContain(`...(${f} ?? [])`);
    }
    /** 🔴 넷이 전부 `null` 이면 `null` — 「후보 0」과 「안 돌았다」를 가른다. */
    expect(expr).toContain("rows: anyEvidence");
    expect(PANEL).toContain("onMarketComparisonChangeRef.current?.(marketComparisonInput)");
  });

  it("C-2 🔴🔴 workspace 가 그 값을 받아 **가격비교 영역에 넘긴다**", () => {
    expect(WORKSPACE).toContain("onMarketComparisonChange={setMarketComparison}");
    const area = WORKSPACE.slice(WORKSPACE.indexOf("<MarketPriceComparison"));
    expect(area.slice(0, 400)).toContain("rows={marketComparison?.rows ?? null}");
    expect(area.slice(0, 400)).toContain("domesticReference={marketComparison?.domesticReference ?? null}");
    expect(area.slice(0, 400)).toContain("overseasReference={marketComparison?.overseasReference ?? null}");
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 WU-140 ① — **앵커를 갱신하고 «강화» 했다**(약화 아님)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 1차 단언은 「영역이 **앵커 div 안쪽** 에 있다」(`area > anchor`)였다. WU-140 이
   *    CPO 판정에 따라 그 영역을 **후보 패널 앞** 으로 옮겼으므로 그 좌표 단언은
   *    **의도적으로** 깨졌다. 🟢 그런데 이 계약이 **지키려던 성질은 좌표가 아니다**:
   * ```
   * ① 가격비교 영역은 화면에 **하나** 다(복제 금지)
   * ② **결론이 원자료보다 먼저** 온다
   * ```
   * 🟢 둘 다 그대로 유효하고, 이제 **더 세게** 단언한다 —
   *    ⒜ 그 JSX 가 **정확히 한 번** 나온다(이동인지 복제인지를 숫자로 가른다) ·
   *    ⒝ **후보 패널보다도 먼저** 온다(전에는 그 뒤였다 — 이것이 root cause 였다) ·
   *    ⒞ 앵커 div 와 원자료 두 패널은 **그 뒤에 그대로 남아 있다** ·
   *    ⒟ 🔴 **커머스 탭 보호 게이트가 붙어 있다**(아래 C-3b).
   */
  /**
   * 🔴🔴🔴 **WU-140-R1 — CEO UI FAIL 이 이 단언을 «강화» 시켰다**(2026-10-21).
   *
   * 1차 WU-140 은 결론 영역을 **왼쪽(내용) 기둥 안에서** 맨 위로 올렸고 이 계약은
   * **통과했다**. 🔴 그런데 CEO 화면에서는 최상단이 아니었다 — 계약이 **기둥 안의
   * 순서만** 보고 **기둥들 사이의 순서** 를 보지 않았기 때문이다:
   * ```
   * 왼쪽(내용)  order-2 lg:order-1
   * 오른쪽(Act) order-1 lg:order-2   ⟹ **`lg` 미만에서 Action Center 가 먼저 온다**
   * ```
   * 🟢 그래서 이제 **「격자 밖·격자 위」** 를 단언한다 — 그러면 폭·탭·기둥 소유와
   *    무관하게 첫 번째 판단 영역이 된다. 🔴 기둥 **안으로** 되돌리면 FAIL 한다.
   */
  it("C-3 🔴🔴 영역은 **하나** 이고 **격자 밖·맨 위** 에 선다(WU-140-R1)", () => {
    /** 🔴 좌표를 추측하지 않는다 — 전부 **위치로** 본다. */
    const anchor = WORKSPACE.indexOf("id={PRICE_COMPARISON_ANCHOR_ID}");
    const area = WORKSPACE.indexOf("<MarketPriceComparison");
    const panel = WORKSPACE.indexOf("<DomesticPriceIntelligencePanel");
    /** 🔴 두 기둥의 좌표 — 이 둘보다 **앞** 이어야 폭과 무관하게 최상단이다. */
    const contentCol = WORKSPACE.indexOf("order-2 min-w-0 space-y-4 lg:order-1");
    const actionCol = WORKSPACE.indexOf('order-1 lg:order-2"');
    const grid = WORKSPACE.indexOf('lg:grid-cols-[minmax(0,1fr)_300px]"');
    for (const i of [anchor, area, panel, contentCol, actionCol, grid]) {
      expect(i).toBeGreaterThan(-1);
    }
    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 **WU-149 STEP 1 — 원자료 두 패널이 셀러 화면에서 «사라졌다»**
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 전까지 이 계약은 ⒞ 로 「앵커 div 와 원자료 두 패널은 **그 뒤에 그대로 남아
     *    있다**」를 단언했다(`domestic > area` · `overseas > area`). WU-149 가 그 둘을
     *    **셀러 화면에서 제거** 했으므로 그 좌표 단언은 **의도적으로** 깨졌다.
     * 🟢 지키려던 성질 둘(①영역은 하나 ②결론이 먼저)은 **그대로 유효** 하고, 이제
     *    방향을 뒤집어 **「그 둘이 아예 없다」** 를 단언한다 — 되살리면 FAIL 이다.
     * 🔴 **약화가 아니다**: 아래 C-3c 가 「backend/API 와 컴포넌트 파일은 **살아
     *    있다**」를 같이 단언한다(제거는 **렌더 트리** 하나다).
     */
    expect(WORKSPACE, "🔴 국내 후보 연구 표가 셀러 화면에 되살아났다").not.toContain("<DomesticShopSearch");
    expect(WORKSPACE, "🔴 해외 후보 연구 표가 셀러 화면에 되살아났다").not.toContain("<ComparisonShopSearch");
    /** 🔴 슬롯 자체도 없다 — 슬롯만 되살려 두면 다음 사람이 거기에 표를 다시 꽂는다. */
    expect(WORKSPACE, "🔴 `marketEvidence` 슬롯이 되살아났다").not.toContain("marketEvidence={");
    /**
     * 🔴🔴🔴 **이 세 줄이 CEO FAIL 을 막는다.** 격자(두 기둥) 전체보다 앞이어야
     *    `order-1` 인 Action Center 가 좁은 폭에서 위로 올라와도 결론이 먼저다.
     */
    expect(area).toBeLessThan(grid);
    expect(area).toBeLessThan(contentCol);
    expect(area).toBeLessThan(actionCol);
    /**
     * 🟢 그러나 **내비게이션보다 위로는 올리지 않는다**(CPO: 「첫 번째 **판단** 영역」).
     *    단계 표시(WorkflowPanel)는 화면의 유일한 진행 표시이고 그 위에 결론을 꽂으면
     *    「지금 어느 단계인가」가 사라진다.
     */
    expect(area).toBeGreaterThan(WORKSPACE.indexOf("<WorkflowPanel"));
    /**
     * 🔴🔴 **이동이고 복제가 아니다.** 두 자리에 두면 셀러에게 가격비교 영역이 둘로
     *    보이고, 그것이 WU-128 이 지목한 중복 그 자체다.
     */
    expect(WORKSPACE.split("<MarketPriceComparison").length - 1).toBe(1);
    /** 🔴🔴 **결론 → MI 패널** 순서. 뒤집으면 CPO 가 NO-GO 한 그 화면으로 돌아간다. */
    expect(area).toBeLessThan(panel);
    /**
     * 🔴🔴 **WU-149 — 앵커는 이제 «그 영역 자신» 을 감싼다.**
     *
     * 🔴 전에는 앵커가 **원자료 두 패널** 을 감쌌고(`anchor > area`) 그래서 「결론이
     *    원자료보다 먼저」를 그 좌표로 쟀다. 그 두 패널이 사라졌으므로 앵커가 가리킬
     *    곳은 **가격의 유일한 owner** 인 이 영역이다 ⟹ 좌표 관계가 뒤집힌다.
     * 🟢 그래서 **앵커가 영역 바로 앞** 임을 단언한다(감싸고 있다는 뜻).
     * 🔴 앵커를 **지우지 않았다** — WU-141-R3 보존 계약이고 `wu-149 M6` 이 잠근다.
     */
    expect(anchor).toBeLessThan(area);
    expect(area - anchor, "🔴 앵커가 그 영역을 감싸지 않는다(사이에 다른 것이 들어왔다)").toBeLessThan(200);
    expect(WORKSPACE).toContain("PRICE_COMPARISON_ANCHOR_ID");
  });

  /**
   * 🔴🔴🔴 **WU-149 STEP 1 — 「셀러 화면에서 제거」와 「엔진 삭제」를 가른다.**
   *
   * 🔴 위 C-3 이 「두 패널이 셀러 화면에 없다」를 단언하므로, 그 단언만 두면 다음
   *    사람이 **컴포넌트 파일과 backend API 를 지워도 통과** 한다. 그것은 이 WU 가
   *    명시적으로 금지한 방향이다(CPO §6 「INTERNAL ENGINE 은 절대 제거하지 않는다」).
   * 🟢 그래서 **반대 방향 단언을 같이** 둔다 — `wu-149 M7` 이 그 삭제를 FAIL 로 잠근다.
   */
  it("C-3c 🔴🔴 엔진은 **살아 있다** — 컴포넌트 파일과 backend API 를 지우지 않았다", () => {
    for (const f of ["DomesticShopSearch.tsx", "ComparisonShopSearch.tsx"]) {
      expect(existsSync(path.join(COMMERCE, f)), `🔴 ${f} 가 삭제됐다(엔진 제거 금지)`).toBe(true);
    }
    /** `__dirname` = `…/api/price-history/_lib/__tests__` ⟹ 셋 올라가면 `…/api` 다. */
    const apiRoot = path.join(__dirname, "..", "..", "..");
    for (const route of [
      path.join(apiRoot, "domestic-price-sources", "search", "route.ts"),
      path.join(apiRoot, "comparison", "search", "route.ts"),
    ]) {
      expect(existsSync(route), `🔴 backend API 가 삭제됐다: ${route}`).toBe(true);
    }
  });

  /**
   * 🔴🔴🔴 **커머스 탭에 「시장 판매 판단」이 서지 않는다** — CEO 지시(stage-focus.ts).
   *
   * 영역을 탭 분기 **밖** 으로 올렸으므로, 게이트가 없으면 스마트스토어·쿠팡·롯데ON
   * 탭 본문 맨 위에 **「📊 시장 판매 판단」이 서 버린다.** 그것이 CEO 가 「MI 표시 =
   * 제거」로 지운 그 모양이다(「등록하러 온 화면에서 처음 읽는 문장이 『팔아도
   * 되는가』였다 — 등록을 막는 것이 판매 판단이라고 읽힐 수밖에 없다」).
   * 🔴 그래서 **게이트가 그 JSX 바로 앞에 붙어 있는지** 를 단언한다. 떼면 FAIL 이다.
   */
  it("C-3b 🔴🔴 그 영역에 **커머스 탭/수집중 보호 게이트** 가 붙어 있다", () => {
    const area = WORKSPACE.indexOf("<MarketPriceComparison");
    expect(area).toBeGreaterThan(-1);
    /**
     * 🔴🔴 **WU-152 — 게이트의 «식» 이 바뀌었다. 지키는 성질은 그대로다**(2026-10-22).
     * ```
     * 전  stageFocus.mi !== "HIDDEN"      후  workSurface !== "CHANNEL"
     * ```
     * 🔴 WU-152 가 **상품정보 탭에서도** MI 패널을 HIDDEN 으로 만들었다(CEO 육안 FAIL:
     *    「Market Intelligence 가 또 하나의 판단 화면으로 남아 있다」). 그러면 옛 식은
     *    **결론 영역까지 같이 지운다** — 그래서 보호의 **원래 축(탭)** 으로 직접 적는다.
     * 🟢 아래 「`HIDDEN` 의 owner 는 `resolveStageFocus` 하나」 단언은 **그대로 유지** 한다 —
     *    그 규칙이 여전히 커머스 탭에서 MI 를 끄고, 이 게이트는 그 조건과 **같은 축** 이다.
     */
    const gate = WORKSPACE.lastIndexOf('workSurface !== "CHANNEL"', area);
    expect(gate).toBeGreaterThan(-1);
    /** 🔴 **바로 앞** 이어야 한다 — 멀리 있는 다른 게이트를 내 근거로 쓰지 않는다. */
    expect(area - gate).toBeLessThan(200);
    /**
     * 🟢 `HIDDEN` 의 owner 는 `resolveStageFocus` **하나** 다 — 이 파일이 그 규칙을
     *    복제하지 않는다. 🔴 그 owner 에서 두 축 중 하나를 빼면 여기서 FAIL 한다.
     */
    const mi = FOCUS.slice(
      FOCUS.indexOf("const mi: MiPresentation"),
      FOCUS.indexOf("const bodyOwnsChecklist"),
    );
    expect(mi).toContain('surface === "CHANNEL"');
    expect(mi).toContain('stage === "COLLECTING"');
    expect(mi.match(/"HIDDEN"/g)?.length).toBe(2);
  });

  it("C-4 🔴 가격 **계산식** 을 건드리지 않았다 — 영역이 집계를 만들지 않는다", () => {
    for (const forbidden of [
      "summarizeCandidateOverseasPrices",
      "candidateDomesticPrice",
      "domesticTransientRecords",
      "computeMarketAlert",
      "convertToKrw",
      "exchange-rates",
    ]) {
      expect(AREA).not.toContain(forbidden);
    }
  });
});

/* ═════════════ D. 🔴 ④ 유사상품 육안 비교 (마운트 DOM) ═════════════ */

describe("D. 🔴 원본 ↔ 후보 이미지 비교 (CPO ④)", () => {
  it("D-1 🟢 원상품 이미지가 오면 **두 사진이 나란히** 선다", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: [row({ matchTruth: "SIMILAR" })],
        onReview: () => {},
        originImageUrl: "https://origin.example/o.jpg",
        originTitle: "원상품",
      }) as never,
    );
    expect(html).toContain("gt-image-pair");
    expect(html).toContain("gt-origin-image");
    expect(html).toContain("gt-candidate-image");
  });

  it("D-2 🔴🔴 후보 이미지가 없으면 **「이미지 없음」이라고 적는다**(대체 사진 금지)", () => {
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: [row({ imageUrl: null })],
        onReview: () => {},
        originImageUrl: "https://origin.example/o.jpg",
      }) as never,
    );
    expect(html).toContain("gt-candidate-image-missing");
    expect(html).toContain(IMAGE_MISSING_TEXT);
    /**
     * 🔴🔴 **후보 `<img>` 자체가 없어야 한다.** 원상품 사진을 그 칸에 끌어다 쓰면
     *    셀러는 **같은 사진 두 장** 을 보고 「동일상품」이라 판단한다 — 그 판단이
     *    GT 로 쌓이면 측정 전체가 오염된다(WU-099 에서 이미지 때문에 12건이
     *    측정불가로 돌아온 그 자리의 **반대쪽 사고** 다).
     * 🔴 개수로 세지 않는다 — 속성으로 본다(`coverage-is-a-property-not-a-filename`).
     */
    expect(html).not.toContain('data-testid="gt-candidate-image"');
  });

  it("D-3 🟢 원상품 이미지가 없으면 **비교 칸을 만들지 않는다**(기존 구역 불변)", () => {
    const html = renderToStaticMarkup(GeminiTransientCandidates({ evidence: [row()] }) as never);
    expect(html).not.toContain("gt-image-pair");
  });

  it("D-4 🔴 세 상태(동일/다름/보류)가 **저장 경로를 그대로** 쓴다", () => {
    /** 🟢 WU-131 의 네 버튼을 그대로 쓴다 — CPO 의 셋은 그 **부분집합** 이다. */
    const html = renderToStaticMarkup(
      GeminiTransientCandidates({ evidence: [row()], onReview: () => {} }) as never,
    );
    for (const v of ["same", "different", "undecided"]) expect(html).toContain(`gt-review-${v}`);
    /** 🔴 저장은 WU-131 의 그 엔드포인트 하나다 — 새 저장 경로를 만들지 않았다. */
    expect(PANEL).toContain("/candidate-reviews`");
    expect(PANEL.match(/candidate-reviews`/g) ?? []).toHaveLength(2);
  });

  it("D-5 🔴 후보 **이미지/재고를 서버가 공급한다**(화면이 지어내지 않는다)", () => {
    expect(RUNNER).toContain("imageUrl: best.imageUrl ?? null");
    expect(RUNNER).toContain("soldOut: best.soldOut ?? null");
    /** 🔴 추가 HTTP 0 — 판정이 고른 그 후보가 이미 들고 있던 값이다. */
    expect(RUNNER).not.toContain("fetchImage");
  });
});

/* ═════════════ E. 🔴 ⑥ 이전 판단 재투입 ═════════════ */

describe("E. 🔴🔴 feedback 재활용 (CPO ⑥)", () => {
  it("E-1 🔴🔴 **`SAME` 만** 재투입한다 — 과거 DIFFERENT 자동 편입 금지", () => {
    const fn = REVIEW_LIB.slice(
      REVIEW_LIB.indexOf("export async function listReviewedSameUrls"),
      REVIEW_LIB.indexOf("export async function recordSeenCandidates"),
    );
    expect(fn).toContain('r.humanVerdict !== "SAME"');
    for (const forbidden of ["DIFFERENT", "SIMILAR", "UNDECIDED"]) {
      expect(fn).not.toContain(`"${forbidden}"`);
    }
  });

  it("E-2 🔴 사람 판단을 **MI 판정으로 쓰지 않는다** — URL 만 넘긴다", () => {
    const fn = REVIEW_LIB.slice(
      REVIEW_LIB.indexOf("export async function listReviewedSameUrls"),
      REVIEW_LIB.indexOf("export async function recordSeenCandidates"),
    );
    expect(fn).toContain("Promise<string[]>");
    for (const forbidden of ["systemVerdict", "matchTruth", "priceTier", "verified"]) {
      expect(fn).not.toContain(forbidden);
    }
    /** 🔴 라우트도 URL 배열만 넘긴다. */
    expect(ROUTE).toContain("reviewedSameUrls: reviewedSameUrls.length > 0 ? reviewedSameUrls : undefined");
  });

  it("E-3 🔴🔴 재투입 후보도 **저장되지 않는다** — 일시 샵 술어가 막는다", () => {
    expect(isTransientShopId(REVIEWED_SAME_SHOP_ID)).toBe(true);
    expect(TRANSIENT_SHOP_IDS.has(REVIEWED_SAME_SHOP_ID)).toBe(true);
    /** 🔴 생산자가 그 id 를 **실제로 달아** 보낸다(상수만 있고 안 쓰면 의미가 없다). */
    expect(RUNNER).toContain("shopId: REVIEWED_SAME_SHOP_ID");
    /** 🔴 등록부 uuid 는 막지 않는다(진짜 샵의 저장이 멈추면 안 된다). */
    expect(isTransientShopId("743f72f4-a911-439a-b63b-ba8ae6bedcd0")).toBe(false);
  });

  it("E-4 🔴 **출처가 갈린다** — 「직접 입력」으로 적지 않는다", () => {
    expect(SOURCE_LABEL.REVIEWED_SAME).toBe("이전 확인 후보");
    expect(SOURCE_LABEL.REVIEWED_SAME).not.toBe(SOURCE_LABEL.SELLER_URL);
    expect(REVIEWED_SAME_HEADING).not.toContain("직접 입력");
    /** 🔴 sink 도 갈린다 — 한 배열에 담으면 보고가 거짓이 된다. */
    expect(RUNNER).toContain('evidenceSource === "REVIEWED_SAME"');
    expect(RUNNER).toContain("? reviewedSameEvidence");
  });

  it("E-5 🟢 **새 생산자 코드를 만들지 않았다** — WU-024 pool 을 그대로 쓴다", () => {
    expect(POOL).toContain("input.shopId ?? TRANSIENT_URL_SHOP_ID");
    /**
     * 🔴 기본값이 기존 값이라 기존 호출부는 **한 줄도 바뀌지 않는다**.
     * 🔴 CORE-2R-4 — 호출부가 **셋** 이 됐다(붙여넣기 · 재투입 · **국내 목록 탐색**).
     *    🟢 계약의 뜻은 그대로다 — 생산자가 늘어도 **후보 생성기는 이 함수 하나** 이고
     *       새 fetch/판정 사본이 없다(셋 다 `shopId` 만 갈아 끼운다).
     */
    expect(RUNNER.match(/collectUrlCandidatePool\(\{/g) ?? []).toHaveLength(3);
    expect(RUNNER).toContain("shopId: DOMESTIC_LISTING_SHOP_ID");
  });

  it("E-6 🔴 중복은 **HTTP 를 쓰지 않는다** — 이미 찾은 후보면 건너뛴다", () => {
    /**
     * 🔴 CORE-2R-4 — 슬라이스 끝을 **그 블록의 바로 다음 생산자** 로 좁힌다.
     *    전에는 `isGeminiDiscoveryEnabled()` 까지 잘랐는데 그 사이에 새 생산자가
     *    들어오면 **엉뚱한 블록의 문자열로 통과** 한다(이 트랙의 함정 ⑤).
     */
    const block = RUNNER.slice(
      RUNNER.indexOf("if (input.reviewedSameUrls"),
      RUNNER.indexOf("if (input.domesticListingHop)"),
    );
    expect(block).toContain("existingCanonicalUrls: alreadyCanonical");
    expect(block).toContain("[...searchResults, ...transientPools]");
  });

  it("E-7 🔴 재투입이 **이력의 `source` 를 덮지 않는다**(DB check 어휘 밖이다)", () => {
    const seen = ROUTE.slice(ROUTE.indexOf("const seen = ["), ROUTE.indexOf("if (seen.length > 0)"));
    expect(seen).not.toContain("reviewedSameEvidence");
    expect(ROUTE).not.toContain('"REVIEWED_SAME" as const');
  });
});

/* ═════════════ F. 🔴 금지 전수 — 이번 WU 가 열지 않은 것 ═════════════ */

describe("F. 🔴 범위 밖을 건드리지 않았다", () => {
  it("F-1 🔴 8축·threshold·판정 규칙 변경 0", () => {
    for (const f of [RUNNER, AREA, SELECTOR]) {
      for (const forbidden of ["SAME_MIN_AXES", "COLOR_VARIANT", "crossSellerReserved", "MIN_DISPLAY_SIMILARITY"]) {
        expect(f).not.toContain(forbidden);
      }
    }
  });

  it("F-2 🔴 새 AI/검색/Registry/schema 경로 0", () => {
    /**
     * 🔴 **문자열 `gemini` 로 검사하지 않는다** — 두 파일은 `GeminiTransientCandidates`
     *    (후보 **행 컴포넌트**)를 import 하고, 그 이름은 AI 호출과 **무관** 하다.
     *    🟢 1차 단언이 그 import 를 잡아 거짓 FAIL 을 냈다 — 금지의 **대상** 으로
     *       좁힌다(API 키 · provider endpoint · DB/Registry 쓰기).
     */
    for (const forbidden of [
      "GEMINI_API_KEY",
      "generativelanguage",
      "isGeminiDiscoveryEnabled",
      "openai",
      "anthropic",
      "comparison_shops",
      "domestic_price_sources",
      "create table",
      "alter table",
      "supabase",
      "fetch(",
    ]) {
      expect(AREA).not.toContain(forbidden);
      expect(SELECTOR).not.toContain(forbidden);
    }
  });

  it("F-3 🔴 사람 판단이 MI/가격/알림/등록 payload 로 **흘러가지 않는다**", () => {
    /** 🔴 재투입은 **URL** 만 넘긴다 — verdict 를 넘기는 줄이 없어야 한다. */
    const lines = ROUTE.split("\n").filter((l) => l.includes("reviewedSame"));
    for (const l of lines) {
      for (const forbidden of ["humanVerdict", "human_verdict", "matchTruth", "priceTier"]) {
        expect(l).not.toContain(forbidden);
      }
    }
  });
});
