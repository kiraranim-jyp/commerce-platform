/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  sellerSurfaceElement,
  firstScreenText,
  wholeText,
  SNAPSHOT_ID,
} from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { computeReferenceProfitability } from "@commerce/pricing";
import {
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../../../api/price-history/_lib/candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 REFERENCE-PRICE-PROFITABILITY-**PRODUCTION-WIRING-1** — 끊긴 경계 특정
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 판정 — **Production UI FAIL**(2026-11-09 · CEO 스크린샷). 화면에
 * 「KRW 88,000 · 확인 1곳」은 뜨는데 **신규 「참고가격 기준 예상 수익성」 상자가 없다.**
 *
 * 🔴 **이 파일은 조사 전용이다** — 운영 코드 **변경 0**. 끊긴 **한 곳** 만 증명한다.
 *
 * ── 🔴🔴 결론(아래 네 단언이 증명한다) ─────────────────────────────────────────
 * ```
 * 끊긴 경계 = **입력이 서로 다른 두 통로였다.**
 *   화면의 ₩88,000  ← POST `/check` 응답(`domesticReference`) «또는» 저장분(`savedCandidateRows`)
 *   신규 축의 입력   ← `domesticTransientRecords`(= `geminiEvidence` 루프 산출)
 * 그런데 패널이 읽는 `data` 는 **GET** 응답이고, GET 은 `geminiEvidence` 를 **null 로**
 * 부른다(`[snapshotId]/route.ts:31` · B3-04 격리 원칙) ⟹ 그 배열이 **항상 비어 있다**
 * ⟹ `byCurrency.KRW` 가 **undefined** ⟹ `marginPercent === null` ⟹ **영역을 그리지 않는다.**
 * ⟹ 🔴 **「계산됐는데 화면에서 사라진다」가 아니라 «계산 단계부터 null» 이다.**
 * ```
 * 🔴 그래서 배선(prop·deps·Workspace)은 **전부 정상** 이다 — 그 축을 **빈 입력** 에 꽂았다.
 *    내 완료 보고가 그것을 못 본 이유는 계약이 **서버 산출을 손으로 넣어** 렌더를 쟀기
 *    때문이다(= 「값이 오면 그린다」까지만 증명했고 **「값이 오는가」를 안 쟀다**).
 */

const REPO = join(__dirname, "../../../../../../..");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const MI = strip(readFileSync(join(REPO, "apps/admin/src/app/api/price-history/_lib/market-intelligence.ts"), "utf8"));
const GET_ROUTE = strip(
  readFileSync(join(REPO, "apps/admin/src/app/api/price-history/[snapshotId]/route.ts"), "utf8"),
);
const PANEL = strip(
  readFileSync(join(REPO, "apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx"), "utf8"),
);

let container: HTMLDivElement;
let root: Root;

function stubFetch(data: PriceHistoryResponse): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
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
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
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

async function mount(data: PriceHistoryResponse, autoCheckResult?: unknown): Promise<void> {
  stubFetch(data);
  await act(async () => {
    root.render(sellerSurfaceElement({ marketDone: true, autoCheckResult }));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/**
 * 🟢 **자동 1회차 응답 모양** — CEO 화면의 「국내 참고가격 KRW 88,000 · 확인 1곳」이
 *    오는 **유일한 통로** 다. 🔴 GET 응답에는 이 칸이 **없다**.
 */
function autoCheckWithDomesticReference(): unknown {
  return {
    domesticReference: {
      count: 1,
      byCurrency: { KRW: { count: 1, lowestAmount: 88_000 } },
      byMarket: { KR: 1 },
      byPriceTier: { COMPARISON: 1 },
      unverifiedCount: 0,
      observedDifferenceCount: 0,
    },
    domesticShop: { domesticListingEvidence: [DONOKIDS_SAVED_ROW] },
  };
}

/**
 * 🟢 **DB 실측 그대로다**(`candidate_reviews` · 2026-11-09):
 * ```
 * donokids.com · KRW 88,000 · market KR · source DOMESTIC_LISTING
 * system_verdict **PRESUMED_SAME** · match_truth **TEXT_CONFIRMED** · price_tier **COMPARISON**
 * price_status VERIFIED_CURRENT · blockers [BRAND_UNCONFIRMED] · human_verdict **null**
 * ```
 * 🔴 **사람이 확인한 적이 없는 후보다** — human SAME 23건은 **다른 후보들** 에 있다.
 */
const DONOKIDS_SAVED_ROW = {
  domain: "donokids.com",
  title: "허그 헤어리 몬스터 티셔츠",
  discoveredUrl: "https://donokids.com/product/hug-hairy-monster",
  source: "DOMESTIC_LISTING" as const,
  market: "KR",
  priceAmount: 88_000,
  priceCurrency: "KRW",
  priceStatus: "VERIFIED_CURRENT",
  crossSellerVerdict: "PRESUMED_SAME",
  matchTruth: "TEXT_CONFIRMED",
  priceTier: "COMPARISON",
  crossSellerBlockers: ["BRAND_UNCONFIRMED"],
};

/** 🔴 GET 응답 모양 그대로 — 🔴 `referenceProfitability` 를 **넣지 않는다**(운영 GET 이 그렇다). */
function ceoScreenData(): PriceHistoryResponse {
  return {
    ...productionData(),
    savedCandidateRows: [DONOKIDS_SAVED_ROW],
  } as PriceHistoryResponse;
}

describe("W1. 🔴 서버 — 신규 축의 입력이 GET 에서 «구조적으로» 비어 있다", () => {
  it("W1-1 GET 라우트는 `geminiEvidence` 를 **null 로** 부른다", () => {
    expect(GET_ROUTE).toContain("computeMarketIntelligence(snapshotId, auth.user.workspaceId, null, {");
    expect(GET_ROUTE).toContain("restoreSavedCandidates: true");
  });

  it("W1-2 국내 transient 배열은 **그 루프 안에서만** 채워진다", () => {
    const loop = MI.indexOf("for (const e of geminiEvidence ?? [])");
    const push = MI.indexOf("domesticTransientRecords.push(");
    expect(loop, "🔴 루프가 없으면 이 추적이 성립하지 않는다").toBeGreaterThan(0);
    expect(push, "🔴 push 가 루프 «뒤» 에 하나뿐이어야 이 결론이 성립한다").toBeGreaterThan(loop);
    expect(MI.split("domesticTransientRecords.push(").length - 1).toBe(1);
    /** 🔴 저장분은 그 배열에 **들어가지 않는다**(B3-04 격리) — 그래서 복원해도 안 채워진다. */
    const between = MI.slice(loop, push);
    expect(between).not.toContain("savedCandidateRows");
  });

  it("W1-3 🔴🔴 그 결과 — **계산 단계부터 `null`** 이다(화면에서 사라지는 것이 아니다)", () => {
    /** 🟢 GET 모양 = 빈 배열(= `geminiEvidence ?? []`). 운영 집계기를 그대로 부른다. */
    const getShape = summarizeCandidateOverseasPrices([]);
    expect(getShape.byCurrency.KRW, "🔴 GET 에서는 KRW 칸이 아예 없다").toBeUndefined();
    const onGet = computeReferenceProfitability({
      referencePriceKrw: getShape.byCurrency.KRW?.lowestAmount ?? null,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: getShape.byCurrency.KRW?.count ?? 0,
      excludedUnverified: getShape.unverifiedCount,
      excludedObservedDifference: getShape.observedDifferenceCount,
    });
    expect(onGet.marginPercent, "🔴 이것이 CEO 화면에서 상자가 없는 이유다").toBeNull();
    expect(onGet.sellerCount).toBe(0);

    /** 🟢 **같은 코드** 에 POST 모양(그 후보)을 주면 **계산된다** — 로직은 정상이다. */
    const postShape = summarizeCandidateOverseasPrices([
      {
        domain: "donokids.com",
        market: "KR",
        currency: "KRW",
        amount: 88_000,
        priceTier: "COMPARISON",
        priceStatus: "VERIFIED_CURRENT",
        blockers: ["BRAND_UNCONFIRMED"],
      },
    ] as unknown as CandidateOverseasPriceRecord[]);
    const onPost = computeReferenceProfitability({
      referencePriceKrw: postShape.byCurrency.KRW?.lowestAmount ?? null,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: postShape.byCurrency.KRW?.count ?? 0,
      excludedUnverified: postShape.unverifiedCount,
      excludedObservedDifference: postShape.observedDifferenceCount,
    });
    expect(onPost.marginPercent, "🟢 입력만 주면 같은 코드가 비율을 낸다").toBe(23.5);
  });
});

describe("W2. 🔴 화면 — CEO 스크린샷을 «그대로» 재현한다", () => {
  it("W2-1 🔴🔴 **CEO 화면 그대로** — 「국내 참고가격 KRW 88,000」 은 뜨고 수익성 상자는 없다", async () => {
    await mount(ceoScreenData(), autoCheckWithDomesticReference());
    const first = firstScreenText(container);
    /** 🟢 CEO 스크린샷의 그 블록이 **1차에** 선다 — 통로는 POST 응답이다. */
    expect(first).toContain("국내 참고가격");
    expect(first).toContain("88,000");
    expect(
      container.querySelector('[data-testid="reference-profitability"]'),
      "🔴🔴 이 null 이 CEO 가 본 그 상태다 — 재현됐다",
    ).toBeNull();
  });

  it("W2-1b 🔴 **저장분(GET)만으로는 그 블록 자체가 서지 않는다** — 통로가 POST 임을 가른다", async () => {
    await mount(ceoScreenData());
    const text = wholeText(container);
    /** 🟢 금액은 후보 카드 안에 있다(접힘) — 그러나 「국내 참고가격」 집계 블록은 **없다**. */
    expect(text).toContain("88,000");
    expect(
      text,
      "🔴 이 차이가 「화면의 88,000 과 신규 축의 입력이 다른 통로」의 직접 증거다",
    ).not.toContain("국내 참고가격");
  });

  it("W2-2 🟢 그 상태에서 기존 판정 경로는 **막힌 채 남는다**(승인한 정책과 일치)", async () => {
    await mount(ceoScreenData(), autoCheckWithDomesticReference());
    const text = wholeText(container);
    /** 🔴 EXACT 가 아니므로 기존 수익성은 「확인 불가」로 남는다 — 이것은 **의도** 다. */
    expect(text).toContain("수익성");
  });

  it("W2-3 🔴🔴 **[A 로 뒤집혔다] GET 에 값을 넣어도 그리지 않는다** — 소유권 분리", async () => {
    /**
     * 🔵🔵 **조사 시점에는 이 단언이 `not.toBeNull()` 이었다.** 그때 화면은 GET 사본을
     *    읽었고, 그래서 「값만 오면 그린다(배선 정상)」를 증명하는 데 쓰였다.
     * 🔴 CPO 승인 A + 지시 ③(소유권 혼합 금지)로 출처를 **POST 로 옮겼다** ⟹ 이제
     *    GET 에 값이 있어도 **그리지 않는 것이 맞다.** 뜻을 바꾼 것이 아니라 **방향 전환** 이다.
     * 🟢 그리고 그 전환이 지키는 것 — 재진입에서 **POST 값이 GET 의 null 로 덮이지 않는다**.
     */
    await mount({
      ...ceoScreenData(),
      referenceProfitability: {
        basis: "REFERENCE_PRICE",
        marginPercent: 23.5,
        meetsTargetMargin: false,
        targetMarginPercent: 30,
        sellerCount: 1,
        excludedCount: 0,
        excludedUnverified: 0,
        excludedObservedDifference: 0,
        referencePriceKrw: 88_000,
      },
    });
    expect(
      container.querySelector('[data-testid="reference-profitability"]'),
      "🔴 GET 사본으로 그리기 시작하면 소유권이 둘이 된다 — W5-1 이 POST 경로를 증명한다",
    ).toBeNull();
  });
});

describe("W4. 🔴🔴 **내 1차 결론을 정정한다** — POST 에서는 «계산된다», 응답에서 버려진다", () => {
  const POST_ROUTE = strip(
    readFileSync(join(REPO, "apps/admin/src/app/api/price-history/check/route.ts"), "utf8"),
  );

  it("W4-1 POST 는 transient 후보를 MI 에 **넣는다**(국내 목록 포함)", () => {
    expect(POST_ROUTE).toContain("...(domesticShop.domesticListingEvidence ?? [])");
    expect(POST_ROUTE).toContain("intelligence = await computeMarketIntelligence(");
    /** 🟢 그 인자가 `transientEvidence` 다 ⟹ `domesticTransientRecords` 가 **채워진다**. */
    expect(POST_ROUTE).toContain("      transientEvidence,");
  });

  it("W4-2 🟢🟢 **[RPP-POST-WIRING-1 에서 뒤집혔다]** 응답이 그 칸을 내보낸다", () => {
    /** 🟢 같은 `intelligence` 의 **형제 칸 둘** 과 나란히 선다(WU-056 선례 그대로). */
    expect(POST_ROUTE).toContain("overseasReference: intelligence?.candidateOverseasPrice ?? null");
    expect(POST_ROUTE).toContain("domesticReference: intelligence?.candidateDomesticPrice ?? null");
    /**
     * 🔵🔵 **이 단언은 전에 `not.toContain` 이었고 CPO 승인 A 로 «뒤집혔다».**
     *    그 뒤집힘 자체가 수정의 증거다(이 리포의 쿠팡 고시 선례와 같은 모양).
     */
    expect(POST_ROUTE).toContain("referenceProfitability: intelligence?.referenceProfitability ?? null");
  });

  it("W4-3 🟢 패널이 **POST 에서** 그 값을 받는다 — GET 사본을 읽지 않는다", () => {
    expect(PANEL).toContain("setDomesticReference(j.domesticReference ?? null)");
    /** 🟢 자동 1회차 경로. */
    expect(PANEL).toContain("setReferenceProfitability(j.referenceProfitability ?? null)");
    /**
     * 🔴🔴 **CPO 지시 ③ — 소유권을 섞지 않는다.** 그 값을 `data`(GET)에서 읽으면
     *    재진입에서 **POST 값이 GET 의 null 로 조용히 덮일** 수 있다.
     */
    expect(
      PANEL,
      "🔴 GET 사본을 다시 읽기 시작하면 소유권이 둘이 된다",
    ).not.toContain("data?.referenceProfitability ?? null");
  });

  it("W4-4 🔴 **「🔄 다시 분석」 경로에도 같은 줄이 있다**(빠뜨리면 옛 값이 남는다)", () => {
    /**
     * 🔴 그 경로는 `j` 가 아니라 `json` 을 쓴다 — 자동 1회차 effect 와 **다른 자리** 다.
     *    여기를 빼먹으면 참고가격은 갱신되는데 **수익성만 옛 값** 으로 남는다.
     */
    expect(PANEL).toContain("setDomesticReference(json.domesticReference ?? null)");
    expect(PANEL).toContain(".referenceProfitability ?? null,");
    const recheck = PANEL.indexOf("setDomesticReference(json.domesticReference");
    expect(
      PANEL.slice(recheck, recheck + 600),
      "🔴 다시 분석 핸들러 안에 그 set 이 없으면 두 숫자가 갈린다",
    ).toContain("setReferenceProfitability(");
  });

  it("W4-4b 🔴 **deps 에도 있다** — 🔴 이 축은 «소스로만» 잡힌다(변이 N5 가 통과했다)", () => {
    /**
     * 🔴🔴 **변이 N5(deps 한 줄 제거)가 행동 계약 28건을 «전부» 통과했다.**
     *    POST state 가 바뀌는 그 렌더에서 **다른 deps 도 같이 바뀌어** memo 가 어차피
     *    다시 계산되기 때문이다 ⟹ 하니스로는 그 누락을 **구조적으로 볼 수 없다.**
     * 🔴 그런데 운영에서는 두 값이 **따로 도착할 수 있다** — 그때 이 줄이 없으면
     *    참고가격만 갱신되고 수익성이 **옛 값으로 멈춘다.**
     * 🟢 그래서 **소스 앵커로** 문다(이 리포가 「다섯 번 밟았다」고 적어 둔 그 함정).
     */
    const memoEnd = PANEL.indexOf("      referenceProfitability,\n    };\n  }, [");
    expect(memoEnd, "🔴 memo 가 그 값을 싣지 않으면 영역이 설 수 없다").toBeGreaterThan(0);
    const depsStart = PANEL.indexOf("  }, [", memoEnd);
    const depsEnd = PANEL.indexOf("]);", depsStart);
    expect(depsEnd).toBeGreaterThan(depsStart);
    expect(
      PANEL.slice(depsStart, depsEnd),
      "🔴 deps 에 없으면 두 숫자가 갈린 채 멈춘다",
    ).toContain("referenceProfitability,");
  });

  it("W4-5 🟢🟢 **같은 후보 집합임이 구조로 보장된다**(CPO 지시 ④)", () => {
    /**
     * 🔴 「같은 후보로 계산됐는가」를 숫자 비교로 확인하면 **그 순간의 표본** 만 본다.
     * 🟢 그래서 **구조** 로 단언한다 — 서버가 두 칸을 **같은 변수 하나** 에서 만든다
     *    ⟹ 분모가 갈릴 **경로 자체가 없다**.
     */
    expect(MI).toContain("candidateDomesticPrice: domesticCandidatePriceSummary,");
    expect(MI).toContain("referencePriceKrw: domesticCandidatePriceSummary.byCurrency.KRW?.lowestAmount");
    expect(MI).toContain("sellerCount: domesticCandidatePriceSummary.byCurrency.KRW?.count ?? 0");
    /** 🔴 그 집계를 **한 번만** 부른다(두 번 부르면 두 숫자가 갈릴 수 있다). */
    expect(MI.split("summarizeCandidateOverseasPrices(domesticTransientRecords)").length - 1).toBe(1);
  });
});

describe("W5. 🟢🟢 **[A 구현] POST 응답 → state → 컴포넌트 → DOM**(CPO 지시 ⑤)", () => {
  /**
   * 🔴🔴 **이 절이 이 WU 의 완료 기준이다**(CPO 문장) —
   *    「국내 참고가격이 ₩88,000 으로 표시되는 **순간**, 같은 화면에 참고가격 기준
   *     예상 마진이 **함께** 표시되어야 한다」.
   * 🟢 값을 prop 으로 밀어넣지 않는다 — **POST 응답 모양** 하나만 주고 DOM 에서 읽는다
   *    ⟹ 응답·effect·state·memo·Workspace·영역 **여섯 자리를 전부 통과해야** 뜬다.
   */
  function autoCheckWithBoth(): unknown {
    return {
      ...(autoCheckWithDomesticReference() as Record<string, unknown>),
      /** 🟢 서버가 `computeReferenceProfitability` 로 낸 모양 그대로(88,000 · 원가 67,290). */
      referenceProfitability: {
        basis: "REFERENCE_PRICE",
        marginPercent: 23.5,
        meetsTargetMargin: false,
        targetMarginPercent: 30,
        sellerCount: 1,
        excludedCount: 0,
        excludedUnverified: 0,
        excludedObservedDifference: 0,
        referencePriceKrw: 88_000,
      },
    };
  }

  it("W5-1 🟢🟢 ₩88,000 과 예상 마진이 **같은 화면에** 뜬다(완료 기준)", async () => {
    await mount(ceoScreenData(), autoCheckWithBoth());
    const first = firstScreenText(container);
    expect(first, "🔴 참고가격이 없으면 이 기준 자체가 성립하지 않는다").toContain("국내 참고가격");
    expect(first).toContain("88,000");
    const area = container.querySelector('[data-testid="reference-profitability"]');
    expect(area, "🔴🔴 이것이 CEO FAIL 의 정확한 반대 상태다").not.toBeNull();
    expect(area?.textContent ?? "").toContain("예상 마진 24%");
    expect(area?.textContent ?? "").toContain("근거 1곳");
  });

  it("W5-2 🟢 기존 판매 판단은 **그대로다**(CPO 완료 기준 후반)", async () => {
    const before = await (async () => {
      await mount(ceoScreenData(), autoCheckWithDomesticReference());
      return (
        container.querySelector('[data-testid="seller-decision"]')?.textContent ?? wholeText(container)
      );
    })();
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await mount(ceoScreenData(), autoCheckWithBoth());
    const after =
      container.querySelector('[data-testid="seller-decision"]')?.textContent ?? wholeText(container);
    /** 🔴 신규 축이 판정 문구를 **한 글자도** 바꾸지 않는다(CPO 경계 ①·②). */
    expect(after).toBe(before);
  });

  it("W5-3 🔴 값이 없거나 계산 불가면 **잘못된 마진을 적지 않는다**(CPO 지시 ⑥)", async () => {
    /** ⒜ POST 가 null 을 주는 경우 — 영역 0. */
    await mount(ceoScreenData(), {
      ...(autoCheckWithDomesticReference() as Record<string, unknown>),
      referenceProfitability: null,
    });
    expect(container.querySelector('[data-testid="reference-profitability"]')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    /** ⒝ 비율만 null 인 경우(원가 없음) — 참고가격은 떠도 **영역은 서지 않는다**. */
    await mount(ceoScreenData(), {
      ...(autoCheckWithDomesticReference() as Record<string, unknown>),
      referenceProfitability: {
        basis: "REFERENCE_PRICE",
        marginPercent: null,
        meetsTargetMargin: null,
        targetMarginPercent: 30,
        sellerCount: 1,
        excludedCount: 0,
        excludedUnverified: 0,
        excludedObservedDifference: 0,
        referencePriceKrw: null,
      },
    });
    expect(firstScreenText(container)).toContain("88,000");
    expect(
      container.querySelector('[data-testid="reference-profitability"]'),
      "🔴 「0%」를 만들지 않는다 — 측정불가는 침묵한다",
    ).toBeNull();
  });

  it("W5-4 🔴 **POST 가 없으면 전과 똑같다** — GET 만으로는 서지 않는다(수명 동일)", async () => {
    await mount(ceoScreenData());
    expect(
      container.querySelector('[data-testid="reference-profitability"]'),
      "🟢 참고가격 블록도 같이 없다 ⟹ 둘이 «항상 같이» 있거나 없다(모순 0)",
    ).toBeNull();
    expect(wholeText(container)).not.toContain("국내 참고가격");
  });
});

describe("W3. 🔴 두 통로가 다르다 — 그것이 경계다", () => {
  it("W3-1 화면의 참고가격 owner 는 **POST 응답/저장분** 이다", () => {
    /** 🔴 `domesticReference` 는 `autoCheckResult`(POST)에서 **따로** set 된다. */
    expect(PANEL).toContain("setDomesticReference(j.domesticReference ?? null)");
    /** 🔴 저장분도 **표시 전용 칸** 으로 들어온다. */
    expect(PANEL).toContain("const saved = data?.savedCandidateRows ?? null;");
  });

  it("W3-2 🟢🟢 **[A 로 뒤집혔다] 두 통로가 «하나» 가 됐다** — 둘 다 POST 응답이다", () => {
    /**
     * 🔵🔵 **조사 시점 단언은 `data?.referenceProfitability` 였다** — 그것이 경계였고
     *    화면에 뜬 ₩88,000(POST)과 신규 축(GET)의 **입력이 달랐다.**
     * 🟢 A 가 그 둘을 **같은 응답** 으로 합쳤다 ⟹ 같이 뜨거나 같이 없다.
     */
    expect(PANEL).toContain("setDomesticReference(j.domesticReference ?? null)");
    expect(PANEL).toContain("setReferenceProfitability(j.referenceProfitability ?? null)");
    /** 🔴 그리고 그 둘이 **나란히** 설정된다(한쪽만 갱신되는 자리가 없다). */
    const at = PANEL.indexOf("setDomesticReference(j.domesticReference");
    expect(
      PANEL.slice(at, at + 400),
      "🔴 떨어져 있으면 다음 사람이 한쪽만 고친다",
    ).toContain("setReferenceProfitability(");
  });
});
