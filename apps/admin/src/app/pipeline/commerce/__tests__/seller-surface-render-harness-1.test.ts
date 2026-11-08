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
