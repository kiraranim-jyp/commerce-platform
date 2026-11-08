/** @vitest-environment jsdom */
/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SELLER-SURFACE-RENDER-HARNESS-1 — **「전」 기준선 덤프**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 **개선이 아니다.** 셀러 화면을 «볼 수 있게» 만들고 그 상태를 기준선으로
 *    고정하는 것이 전부다. 개선(②③④⑤)은 이 기준선이 커밋된 **뒤** 에 들어간다(CPO 확정).
 *
 * 🔴 **「Production UI PASS」로 쓰지 않는다** — 실제 따져 화면은 CTO 가 볼 수 없다.
 *    이것은 **마운트 DOM** 축이고 최종 확인은 CEO 1회다(헌장 §6).
 *
 * ── 측정 규칙(CPO 안전장치 넷) ───────────────────────────────────────────────
 * ```
 * ⚠️ **보이는 요소만** 센다 — 닫힌 <details> 자식도 DOM 에는 있다(`firstScreenText`)
 * ⚠️ 요약 ↔ ActionCenter 가 **같은 판정** 인지 대조
 * ⚠️ 로딩 / 무데이터 상태를 **따로** 검증
 * ⚠️ **REVIEW_MATCH 가 아니면 resolver 가 발화하지 않는다** 는 것도 단언
 * ```
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  blockOrder,
  firstScreenText,
  sellerSurfaceElement,
  SNAPSHOT_ID,
  surfaceRegions,
  wholeText,
  type SellerSurfaceOptions,
} from "./seller-surface-composition";
import { productionData, withDomesticComparable } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { NEEDS_MATCH_VERDICT_COPY, resolveSellVerdictCopy } from "../DomesticPriceIntelligencePanel";
/** 🔵 MI-INVESTIGATION-STATE-UX-2 — 🔴 **문구를 테스트가 다시 적지 않는다**(owner 에서 읽는다). */
import {
  CANDIDATE_LIST_EMPTY_NOTE,
  MARKET_RECHECK_EMPTY,
  MARKET_RECHECK_FAILED,
  MARKET_RECHECK_INVESTIGATING,
} from "../mi-same-candidates";
import {
  APPLY_RECOMMENDED_PRICE_LABEL,
  APPLY_SUPPRESSED_BY_VERDICT_NOTE,
  /** 🔵 MI-PRICE-BASIS-DISPLAY-1 — A/B 전제와 1차 기준 라벨. */
  PRICE_BASIS_A_NOTE,
  PRICE_BASIS_B_BASIS_LABEL,
  PRICE_BASIS_B_NOTE,
  PRICE_CALCULATION_LINK_TEXT,
  priceBasisVerdictLine,
  SELL_VERDICT_HEADING,
} from "../recommended-price-copy";

/** 🔴 **주석을 벗긴다** — 이 저장소에서 여덟 번 걸린 함정이다(헌장 §5). */
const COMMERCE = join(__dirname, "..");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const PANEL_SRC = strip(readFileSync(join(COMMERCE, "DomesticPriceIntelligencePanel.tsx"), "utf8"));
const WORKSPACE_SRC = strip(readFileSync(join(COMMERCE, "..", "CommerceWorkspace.tsx"), "utf8"));
const AREA_SRC = strip(readFileSync(join(COMMERCE, "MarketPriceComparison.tsx"), "utf8"));

let container: HTMLDivElement;
let root: Root;

/**
 * 🔴 패널은 **자기 데이터를 스스로 가져온다**(`snapshotId` → GET 셋). 그것이 운영
 *    경로이므로 하니스가 prop 으로 밀어넣지 않고 **그 세 경로를 stub** 한다.
 *    🔴 응답 모양은 `PriceHistoryResponse` 타입으로 못박는다(손으로 적은 모양이
 *       유니온 밖 값을 갖고 있어 화면이 죽은 선례가 있다).
 */
function stubFetch(data: PriceHistoryResponse | null): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data ?? { ok: false }) });
      }
      if (url.startsWith("/api/domestic-price-sources/links")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, links: [] }) });
      }
      if (url.includes("/alerts")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, alerts: [] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

beforeEach(() => {
  // @ts-expect-error — React 가 act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function mount(options: SellerSurfaceOptions = {}): Promise<void> {
  await act(async () => {
    root.render(sellerSurfaceElement(options));
  });
  /**
   * effect 가 띄운 promise(GET 셋)까지 flush — 그래야 콜백이 state 를 채운다.
   * 🔴 **한 번으로는 부족하다** — 패널은 ⒜ GET 응답 → ⒝ 파생 계산 → ⒞ 보고 effect 로
   *    사이클을 **여러 번** 돈다. 한 번만 돌리면 「ActionCenter 가 아직 판정을 못 받았다」가
   *    **하니스 artifact 인지 제품 사실인지 가를 수 없다**(이 WU 에서 실제로 걸린 자리다).
   */
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/**
 * 🔴 서버 «응답» 의 판정 칸만 바꾼다 — 이 하니스는 **표시** 를 재고 판정을 재계산하지 않는다.
 *
 * 🔴 **칸 타입을 응답 타입에서 «읽는다»** — 1차에 `Record<string, unknown>` 캐스트를 썼고
 *    **typecheck 가 TS2352 로 잡았다**(이 트랙 함정 ①의 재발을 타입이 막은 자리다).
 *    🟢 그래서 리터럴이 유니온 밖으로 나가면 **컴파일이 실패한다**(예: 존재하지 않는 code).
 */
function withVerdict(
  base: PriceHistoryResponse,
  finalVerdict: NonNullable<PriceHistoryResponse["sellerDecision"]>["finalVerdict"],
  representativeCode: NonNullable<PriceHistoryResponse["representativeVerdict"]>["code"],
): PriceHistoryResponse {
  const data = structuredClone(base);
  if (data.sellerDecision) data.sellerDecision.finalVerdict = finalVerdict;
  if (data.representativeVerdict) data.representativeVerdict.code = representativeCode;
  return data;
}

describe("SELLER-SURFACE-RENDER-HARNESS-1 — 셀러 화면이 실제로 서는가", () => {
  it("A. 격자 밖 두 블록이 «패널 공급» 으로 선다 — 그리고 순서가 요약 → 결론 → 격자다", async () => {
    stubFetch(productionData());
    await mount();

    const { summary, conclusion, grid } = surfaceRegions(container);
    /**
     * 🔴🔴 이 단언이 이 WU 의 핵심이다. 패널은 `HIDDEN` 이라 **렌더되지 않는데**
     *    그 콜백이 요약을 채웠다는 뜻이다 — 운영의 공급 경로가 살아 있다는 직접 증거다.
     */
    expect(summary, "요약 슬롯이 서지 않았다 = 패널 콜백이 발화하지 않았다").not.toBeNull();
    expect(conclusion, "결론 영역이 서지 않았다").not.toBeNull();
    expect(grid).not.toBeNull();

    expect(blockOrder(container)).toEqual(["SUMMARY", "CONCLUSION", "GRID"]);
  });

  it("B. 패널 자신은 셀러 화면에 «없다» — HIDDEN 게이트가 운영과 같이 작동한다", async () => {
    stubFetch(productionData());
    await mount();

    const { left } = surfaceRegions(container);
    /** 🔴 공급은 하는데 화면에는 없다 — 그것이 `presentation="HIDDEN"` 의 의미다. */
    expect(left!.textContent?.trim() ?? "").toBe("");
    /** 🔴 그래서 「Market Intelligence」 제목이 셀러 화면에 **없어야** 한다(CEO 지시). */
    expect(wholeText(container)).not.toContain("Market Intelligence");
  });

  it("C. 요약과 ActionCenter 가 «같은 판정» 을 말한다 — resolver 하나를 공유한다", async () => {
    stubFetch(productionData());
    await mount();

    const data = productionData();
    const expected = resolveSellVerdictCopy(
      data.sellerDecision!.finalVerdict,
      data.representativeVerdict!.code,
    )!;
    const { summary, right } = surfaceRegions(container);
    const summaryText = firstScreenText(summary!);
    const asideText = firstScreenText(right!);

    expect(summaryText, "요약이 판정 문구를 말하지 않는다").toContain(expected.title);
    expect(asideText, "ActionCenter 가 요약과 다른 판정을 말한다").toContain(expected.title);
  });

  it("D. REVIEW_MATCH 면 «동일상품 확인 필요» 다 — 그리고 그 외에는 발화하지 않는다", async () => {
    stubFetch(withVerdict(productionData(), "CONDITIONAL", "REVIEW_MATCH"));
    await mount();
    const needsMatch = firstScreenText(container);
    expect(needsMatch).toContain(NEEDS_MATCH_VERDICT_COPY.title);
    /** 🔴 「판단 불가」를 「조건부 판매」로 위장하지 않는다(그 둘은 다른 상태다). */
    expect(needsMatch).not.toContain("조건부 판매");

    /** 🔴 **음성 축** — REVIEW_MATCH 가 아니면 그 문구가 나오지 않아야 한다. */
    await act(async () => root.unmount());
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    stubFetch(withVerdict(productionData(), "CONDITIONAL", "REVIEW_PRICE"));
    await mount();
    expect(firstScreenText(container)).not.toContain(NEEDS_MATCH_VERDICT_COPY.title);
  });

  it("E. 커머스 탭에서는 격자 밖 두 블록이 서지 않는다 — 운영 게이트 그대로", async () => {
    stubFetch(productionData());
    await mount({ surface: "CHANNEL" });

    const { summary, conclusion } = surfaceRegions(container);
    expect(summary).toBeNull();
    expect(conclusion).toBeNull();
    expect(blockOrder(container)).toEqual(["GRID"]);
  });

  it("F. 로딩(자동 1회차 응답 전) 상태를 따로 본다 — 「없다」로 말하지 않는다", async () => {
    stubFetch(productionData());
    await mount({ autoChecking: true });
    /** 🔴 기준선으로 **그 순간의 글자를 기록** 한다. 개선 ②가 이 줄을 바꾼다. */
    expect(firstScreenText(container).length).toBeGreaterThan(0);
  });

  it("G. 무데이터(응답 실패) 상태 — 🔴 **시장** 숫자는 지어내지 않는다(권장가 A 는 원가 기반이라 «선다»)", async () => {
    stubFetch(null);
    await mount();
    const text = wholeText(container);

    /**
     * 🔴🔴 **내 1차 단언이 틀렸고 코드가 맞았다** — 이 자리를 기록으로 남긴다.
     *
     * 1차에 「응답이 실패하면 ₩115,200 이 서지 않아야 한다」로 단언했고 **FAIL** 했다.
     * 원인은 제품 결함이 아니다 — **권장 판매가격 A 는 MI 응답과 무관** 하다:
     * ```
     * A = 착지원가 + 수수료 + 목표마진   ← `resolveListingPrice(product …)` · **원가 기반**
     * B = 시장가격(`recommendation.recommendedPrice`)  ← 서버 MI 산출
     * ```
     * (CPO 확정 · 메모 `recommended-price-is-cost-based-a-not-market-b`)
     * ⟹ 🟢 MI 응답이 비어도 A 가 서는 것은 **설계대로** 다. 그래서 단언을 **A 가 선다** 로
     *    뒤집고, 지어내면 안 되는 것은 **시장 축 숫자** 라는 불변식으로 좁혔다.
     * 🟡 다만 「근거 없이 권장가만 보인다」가 셀러에게 어떻게 읽히는지는 **개선 ②의 범위** 다
     *    (조사중 ↔ 가격없음 ↔ 실패를 갈라서 말한다). 🔴 이 WU 에서 고치지 않았다.
     */
    expect(text, "A 는 원가 기반이라 MI 응답과 무관하게 선다").toContain("₩115,200");

    /** 🔴 시장 축은 **숫자를 만들지 않는다** — 국내/해외 동일상품은 0곳이어야 한다. */
    expect(text).toContain("동일상품 확인 0곳");
    /** 🔴 그리고 「시장 평균/적정가」류 어휘를 만들지 않는다(WU-146 계약과 같은 축). */
    expect(text).not.toContain("시장 평균가");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-INVESTIGATION-STATE-UX-2 — **같은 하니스로 「후」 를 잠근다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 블록이 기준선 덤프가 잡은 거짓말 넷 중 **셋** 을 계약으로 바꾼다.
 *    🔴 ②(판정 중복 제거)는 **구현하지 않았다** — `CORE-UX-SELLER-01`(CPO 2026-10-26 ·
 *       2026-11-02)이 「1차 첫 줄 = 판매판단」을 **정책으로** 못박고 있어 CPO 판정 사안이다.
 */
describe("MI-INVESTIGATION-STATE-UX-2 — 조사 상태·가격 표시", () => {
  it("④-a 조사 중에는 «조사 중» 이라 말한다 — 「결과가 없다」로 단정하지 않는다", async () => {
    stubFetch(productionData());
    await mount({ autoChecking: true });
    const first = firstScreenText(container);
    expect(first).toContain(MARKET_RECHECK_INVESTIGATING);
    /** 🔴 이것이 이 WU 의 핵심 — 조사 중에 「없다」를 말하면 안 된다. */
    expect(first).not.toContain(MARKET_RECHECK_EMPTY);
  });

  it("④-b 응답이 없으면 «마치지 못했다» 다 — 「결과 없음」과 가른다", async () => {
    stubFetch(null);
    await mount();
    const first = firstScreenText(container);
    expect(first).toContain(MARKET_RECHECK_FAILED);
    expect(first).not.toContain(MARKET_RECHECK_EMPTY);
    expect(first).not.toContain(MARKET_RECHECK_INVESTIGATING);
  });

  it("④-c 조사가 끝났고 후보가 없으면 «미조회» 문구다 — 세 상태가 서로 배타다", async () => {
    stubFetch(productionData());
    await mount();
    const first = firstScreenText(container);
    expect(first).toContain(MARKET_RECHECK_EMPTY);
    expect(first).not.toContain(MARKET_RECHECK_INVESTIGATING);
    expect(first).not.toContain(MARKET_RECHECK_FAILED);
  });

  it("③-a 판매 비추천이면 「이 가격으로 설정」이 **없고** 이유를 말한다", async () => {
    stubFetch(withVerdict(productionData(), "NOT_RECOMMENDED", "REVIEW_PRICE"));
    await mount();
    const first = firstScreenText(container);
    expect(first, "🔴 비추천인데 적용 CTA 가 남아 있다").not.toContain(APPLY_RECOMMENDED_PRICE_LABEL);
    expect(first, "🔴 버튼을 조용히 없앴다(이유를 말하지 않는다)").toContain(APPLY_SUPPRESSED_BY_VERDICT_NOTE);
  });

  it("③-b 🔴 **음성 축** — 비추천이 아니면 CTA 가 그대로 선다(기존 동작 불변)", async () => {
    stubFetch(withVerdict(productionData(), "CONDITIONAL", "REVIEW_PRICE"));
    await mount();
    const first = firstScreenText(container);
    expect(first).toContain(APPLY_RECOMMENDED_PRICE_LABEL);
    expect(first).not.toContain(APPLY_SUPPRESSED_BY_VERDICT_NOTE);
  });

  it("③-c 비추천에서도 **가격 계산과 편집 길은 남는다**(기능을 지우지 않았다)", async () => {
    stubFetch(withVerdict(productionData(), "NOT_RECOMMENDED", "REVIEW_PRICE"));
    await mount();
    const first = firstScreenText(container);
    /** 🔴 A 숫자 · ⓘ · 「가격 수정」 셋 다 남아야 한다 — CPO 「편집 기능 삭제 금지」. */
    expect(first).toContain("₩115,200");
    expect(first).toContain(PRICE_CALCULATION_LINK_TEXT);
    expect(first).toContain("가격 수정");
  });

  it("①  1차 빈 문장이 **세는 기준** 을 말한다 — 요약의 「비교 판매처」와 다른 축이다", async () => {
    stubFetch(withDomesticComparable());
    await mount();
    const first = firstScreenText(container);
    expect(first).toContain(CANDIDATE_LIST_EMPTY_NOTE);
    /** 🔴 그 문장이 범위를 밝힌다(「이번 조사」 + 「세는 기준이 다르다」). */
    expect(CANDIDATE_LIST_EMPTY_NOTE).toContain("이번 조사");
    expect(CANDIDATE_LIST_EMPTY_NOTE).toContain("세는 기준");
    /** 🔴 「동일상품이 없다」로 단정하지 않는다(부재 ≠ 미발견). */
    expect(CANDIDATE_LIST_EMPTY_NOTE).not.toContain("동일상품이 없");
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴 **배선 축** — 이 하니스는 `CommerceWorkspace` 를 마운트하지 않는다.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 그래서 **운영 배선을 끊어도 위 행동 계약은 전부 통과한다**(WU-110 교훈의 반복).
   *    `MarketComparisonInput` 주석이 적어 둔 **다섯 자리**(타입 · useMemo · deps ·
   *    Workspace 전달 · 영역 prop) 중 하나만 빠져도 **조용히** 사라진다.
   * 🟢 그래서 소스 앵커로 그 자리를 못박는다 — 🔴 **주석을 벗기고** 본다(헌장 §5).
   */
  it("🔴 배선 — 다섯 자리가 전부 이어져 있다(하나만 빠져도 조용히 사라진다)", () => {
    /** ① 타입 */
    expect(PANEL_SRC).toContain('investigation: "INVESTIGATING" | "READY" | "FAILED"');
    /** ② producer — 기존 `loadFailed` 술어를 그대로 쓴다(새 계산 0) */
    expect(PANEL_SRC).toMatch(/investigation:\s*autoChecking \|\| loading \? "INVESTIGATING"/);
    /** ③ deps — 빠지면 첫 응답 뒤 값이 갱신되지 않는다(이 파일이 네 번 밟은 함정) */
    expect(PANEL_SRC).toContain("data === null,");
    /** ④ Workspace 전달 — 폴백이 `INVESTIGATING` 이어야 첫 프레임이 거짓말하지 않는다 */
    expect(WORKSPACE_SRC).toContain('investigation={marketComparison?.investigation ?? "INVESTIGATING"}');
    /** ⑤ 영역 prop */
    expect(AREA_SRC).toMatch(/investigation\s*=\s*"READY"/);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🟢🟢 **⒝ 가 승인됐고 이 단언이 «뒤집혔다»**(CPO 2026-11-08)
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 직전 커밋(`deec1d41`)에서 이 자리는 「판정 줄이 **그대로** 있다」였다. CPO 가
   *    ⒝ 를 승인했고 **그 단언이 FAIL 로 뒤집히는 것이 변경의 증거** 였다(앵커 규약).
   * 🟢 이제 **반대 방향** 을 잠근다 — 결론 영역엔 **없고**, 요약과 Action Center 엔 **있다**.
   */
  it("⒝ 판정은 결론 영역에 **없고** 요약·ActionCenter 에 **있다**(위치 셋 → 둘)", async () => {
    stubFetch(productionData());
    await mount();
    const { summary, conclusion, right } = surfaceRegions(container);
    const data = productionData();
    const title = resolveSellVerdictCopy(
      data.sellerDecision!.finalVerdict,
      data.representativeVerdict!.code,
    )!.title;

    /** 🔴 결론 영역 — 판정 머리말·문구가 **없다**(중복 제거). */
    expect(firstScreenText(conclusion!), "🔴 결론 영역에 판정 머리말이 되돌아왔다").not.toContain(
      SELL_VERDICT_HEADING,
    );
    /** 🟢 그 자리에 **가격 근거** 가 선다 — 빈 자리를 두지 않았다. */
    expect(firstScreenText(conclusion!)).toContain(PRICE_BASIS_B_BASIS_LABEL);
    /** 🟢🟢 남은 **두 자리** 는 그대로 말한다(일관성 계약 유지). */
    expect(firstScreenText(summary!), "🔴 요약이 판정을 잃었다").toContain(title);
    expect(firstScreenText(right!), "🔴 ActionCenter 가 판정을 잃었다").toContain(title);
  });

  it("MI-PRICE-BASIS-DISPLAY-1 — A/B 의 **전제** 가 글로 적혀 있다(금액은 A 하나뿐)", async () => {
    stubFetch(withDomesticComparable());
    await mount();
    const whole = wholeText(container);
    /** 🟢 전제 두 줄(상세) — A 는 원가+목표마진 · B 는 관측값. */
    expect(whole).toContain(PRICE_BASIS_A_NOTE);
    expect(whole).toContain(PRICE_BASIS_B_NOTE);
    /**
     * 🔴 **판단 한 줄** 이 목표마진 충족 여부를 말한다.
     * 🔴 문구를 **owner 에서 읽는다** — 1차에 정규식 `목표마진 (…)` 으로 적었다가
     *    조사(「목표마진**을**」) 때문에 **내 단언이 틀렸다**(코드는 맞았다 · 이 트랙 함정 ⑥).
     */
    const expected = priceBasisVerdictLine({ recommendedPriceKrw: 115200, marketPriceKrw: 115200 })!;
    expect(whole).toContain(expected);
    expect(expected, "🔴 판단 문구가 목표마진을 말하지 않는다").toContain("목표마진");
    /**
     * 🔴🔴 **B 금액은 화면에 없다** — 계약 셋(`UX-04-c` · `core-next-step4 B-6`·`C-4`)이
     *    막는다. 🟡 CPO 예시는 B 금액을 포함했으나 **CTO 가 임의로 열지 않았다**(판정 사안).
     */
    expect(PRICE_BASIS_B_BASIS_LABEL, "🔴 기준 라벨에 금액이 들어갔다").not.toMatch(/[₩0-9]/);
  });
});

/**
 * ── 기준선 덤프 ────────────────────────────────────────────────────────────
 * 🔴 이 블록은 **단언이 아니라 관측** 이다. 개선 뒤 같은 하니스·같은 fixture 로 다시
 *    떠서 **전후 차이** 를 보고하기 위한 자료다(CPO: 「전 덤프를 기준선으로 커밋」).
 */
describe("SELLER-SURFACE-RENDER-HARNESS-1 — 기준선 덤프(관측)", () => {
  const CASES: { name: string; data: PriceHistoryResponse; options?: SellerSurfaceOptions }[] = [
    { name: "CASE D · REVIEW_PRICE (국내 0곳)", data: productionData() },
    { name: "REVIEW_MATCH (동일상품 미검증)", data: withVerdict(productionData(), "CONDITIONAL", "REVIEW_MATCH") },
    { name: "CASE A · 국내 동일상품 3곳", data: withVerdict(withDomesticComparable(), "RECOMMENDED", "READY") },
    {
      name: "CASE B · 목표마진 미달(정책 A)",
      data: withVerdict(productionData(), "NOT_RECOMMENDED", "REVIEW_PRICE"),
    },
    { name: "로딩 · 자동 1회차 응답 전", data: productionData(), options: { autoChecking: true } },
  ];

  for (const c of CASES) {
    it(`덤프 — ${c.name}`, async () => {
      stubFetch(c.data);
      await mount(c.options ?? {});

      const { summary, conclusion } = surfaceRegions(container);
      const lines = [
        `\n━━━━━━━━━━ ${c.name} ━━━━━━━━━━`,
        `① 요약 블록      : ${summary ? "선다" : "🔴 서지 않는다"}`,
        `② 결론 영역      : ${conclusion ? "선다" : "🔴 서지 않는다"}`,
        `③ 블록 순서      : ${blockOrder(container).join(" → ")}`,
        `④ 요약 1차 노출  : ${summary ? firstScreenText(summary) : "—"}`,
        `⑤ 결론 1차 노출  : ${conclusion ? firstScreenText(conclusion) : "—"}`,
        `⑥ 전체(접힘 포함): ${wholeText(container)}`,
      ];
      // eslint-disable-next-line no-console
      console.log(lines.join("\n"));
      expect(true).toBe(true);
    });
  }
});
