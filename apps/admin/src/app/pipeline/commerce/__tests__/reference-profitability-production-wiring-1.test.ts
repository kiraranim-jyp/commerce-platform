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

  it("W2-3 🟢 **값만 오면 같은 화면이 상자를 그린다** — 배선은 정상이다", async () => {
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
      "🟢 prop·deps·Workspace 배선은 전부 살아 있다 — 모자란 것은 **입력** 하나다",
    ).not.toBeNull();
  });
});

describe("W3. 🔴 두 통로가 다르다 — 그것이 경계다", () => {
  it("W3-1 화면의 참고가격 owner 는 **POST 응답/저장분** 이다", () => {
    /** 🔴 `domesticReference` 는 `autoCheckResult`(POST)에서 **따로** set 된다. */
    expect(PANEL).toContain("setDomesticReference(j.domesticReference ?? null)");
    /** 🔴 저장분도 **표시 전용 칸** 으로 들어온다. */
    expect(PANEL).toContain("const saved = data?.savedCandidateRows ?? null;");
  });

  it("W3-2 신규 축 owner 는 **GET `data`** 다 — 그래서 둘이 만나지 않는다", () => {
    expect(PANEL).toContain("referenceProfitability: data?.referenceProfitability ?? null,");
    /**
     * 🔴🔴 **이 단언이 경계를 못박는다** — 그 값을 `domesticReference` 나 `rows` 에서
     *    만들지 않는다. 즉 화면에 뜬 ₩88,000 과 신규 축은 **입력이 다르다.**
     */
    const produce = PANEL.indexOf("referenceProfitability: data?.referenceProfitability");
    expect(PANEL.slice(produce, produce + 200)).not.toContain("domesticReference");
  });
});
