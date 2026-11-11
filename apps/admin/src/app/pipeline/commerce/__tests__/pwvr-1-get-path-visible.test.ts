/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sellerSurfaceElement, SNAPSHOT_ID } from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { stripComments } from "./source-text";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 PRODUCTION-WORKSPACE-VISIBLE-RESULT — **페이지를 «열면» 보이는가**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 메우는 구멍을 먼저 적는다.** 기존 하니스 전부가 후보·참고가격을
 *    **`autoCheckResult`(= POST `/check` 응답)** 로 넣어 검증했다. 그래서
 *    **「페이지를 그냥 열었을 때」(GET)는 한 번도 테스트되지 않았다** —
 *    그 경로에서 두 가격 블록이 **보이지 않았는데** 계약은 전부 초록이었다.
 *
 * ```
 * 응답 칸        GET(MI 반환 그대로)         POST(`/check` 가 이름을 바꿔 싣는다)
 * 국내 참고가격   **candidateDomesticPrice**  domesticReference
 * 해외 참고가격   **candidateOverseasPrice**  overseasReference
 * 후보 행         **savedCandidateRows**      domesticShop.*Evidence
 * ```
 * 🔴 패널은 두 `set*Reference` 를 **POST 두 곳에서만** 불렀다 ⟹ GET 진입 시 `null`
 *    ⟹ 블록 **미렌더**. 🟢 후보 행은 이미 `savedCandidateRows` 로 폴백하고 있었다
 *    (그래서 **후보는 보이는데 가격 블록만 사라지는** 모양이었다).
 *
 * 🔴 실제 상품 숫자는 **운영 DB 실측**(§30-1 · 스냅샷 `7b16eecc` Bobo Choses B226AC009)
 *    을 그대로 쓴다 — 지어내지 않았다.
 * 🔴 집계·분모·자격·판정·CASE·A/B 정책 **변경 0** — 바뀐 것은 **읽는 이름** 하나다.
 */

/** 🔴 §30-1 실측 집계값 그대로. */
const DOMESTIC_SUMMARY = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88_000, highestAmount: 88_000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
  unverifiedCount: 0,
  observedDifferenceCount: 1,
  lowestKrw: null,
};
const OVERSEAS_SUMMARY = {
  count: 2,
  byCurrency: {
    EUR: { count: 1, lowestAmount: 40, highestAmount: 40 },
    USD: { count: 1, lowestAmount: 41, highestAmount: 41 },
  },
  byMarket: { OVERSEAS: 1, UNKNOWN: 1 },
  byPriceTier: { EXACT: 2 },
  unverifiedCount: 0,
  observedDifferenceCount: 0,
  lowestKrw: { amountKrw: 55_218, currency: "USD", amount: 41 },
};

/** 🔴 §30-1 의 그 후보 둘(가격이 확인된 행) — GET 복원 칸으로 넣는다. */
const SAVED_ROWS = [
  {
    source: "OVERSEAS_AUTO",
    domain: "bobochoses.com",
    title: "Bobo Choses Hug Hairy Monster T-shirt",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    matchTruth: "STRONG_IDENTIFIER",
    priceTier: "EXACT",
    crossSellerVerdict: "SAME",
    confidence: 0.9,
    matchReasons: ["품번 일치"],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: 40,
    priceCurrency: "EUR",
    priceStatus: "VERIFIED_CURRENT",
    market: "UNKNOWN",
    basis: "DOMAIN",
    priceKrwDerived: 60_298,
  },
  {
    source: "OVERSEAS_AUTO",
    domain: "donokids.com",
    title: "보보쇼즈 허그 헤어리 몬스터 티셔츠",
    imageUrl: null,
    soldOut: null,
    discoveredUrl: "https://www.donokids.com/product/detail.html?product_no=1",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerVerdict: "PRESUMED_SAME",
    confidence: 0.7,
    matchReasons: ["핵심 상품명 일치"],
    crossSellerBlockers: [],
    crossSellerConflicts: [],
    priceAmount: 88_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    market: "KR",
    basis: "DOMAIN",
    priceKrwDerived: 88_000,
  },
] as unknown as GeminiTransientRow[];

/** 🟢 **GET 응답 모양** — 🔴 `domesticReference`/`overseasReference` 는 **넣지 않는다**(POST 전용). */
function getShapedResponse(): PriceHistoryResponse {
  return {
    ...productionData(),
    savedCandidateRows: SAVED_ROWS,
    candidateDomesticPrice: DOMESTIC_SUMMARY,
    candidateOverseasPrice: OVERSEAS_SUMMARY,
  } as unknown as PriceHistoryResponse;
}

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
  vi.unstubAllGlobals();
});

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

/** 🔴 **`autoCheckResult` 를 넘기지 않는다** — 그것이 이 파일의 전부다(GET 진입 재현). */
async function mountGetOnly(data: PriceHistoryResponse): Promise<void> {
  stubFetch(data);
  await act(async () => {
    root.render(sellerSurfaceElement({ marketDone: true }));
  });
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/[^0-9]/g, "");
const textOf = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;

describe("PWVR-1 — 🔴 GET(페이지 열기)만으로 두 가격 블록이 보인다", () => {
  it("A-1 🔴🔴 **국내 참고가격 88,000 이 화면에 선다**(POST 없이)", async () => {
    await mountGetOnly(getShapedResponse());
    expect(
      container.querySelector('[data-testid="domestic-reference"]'),
      "🔴 GET 진입에서 국내 참고가격 블록이 없다 — 셀러가 「다시 분석」을 눌러야 한다",
    ).toBeTruthy();
    expect(digits(textOf("domestic-lowest")), "🔴 국내 금액이 집계와 다르다").toContain("88000");
  });

  it("A-2 🔴🔴 **해외 참고가격(EUR 40 · USD 41)이 화면에 선다**(POST 없이)", async () => {
    await mountGetOnly(getShapedResponse());
    /**
     * 🔴🔴 **1차에 내가 엉뚱한 subtree 를 봤다** — `mi-same-overseas`(후보 칸) 안에서
     *    금액을 찾았는데 참고가격 블록은 **결론 영역** 에 선다(`overseas-reference` ·
     *    금액 노드 `overseas-lowest` 가 **통화마다 하나씩**). 🟢 owner 로 단언한다.
     */
    expect(
      container.querySelector('[data-testid="overseas-reference"]'),
      "🔴 GET 진입에서 해외 참고가격 블록이 없다",
    ).toBeTruthy();
    const amounts = Array.from(container.querySelectorAll('[data-testid="overseas-lowest"]'))
      .map((n) => n.textContent ?? "")
      .join(" | ");
    expect(amounts, "🔴 EUR 40 이 보이지 않는다").toContain("EUR 40");
    expect(amounts, "🔴 두 번째 통화(USD 41)가 사라졌다 — 통화별 집계가 뭉개졌다").toContain("USD 41");
  });

  it("A-3 🔴 후보 카드는 **시장이 확정된 행만** 선다 — 측정된 사실을 기록한다", async () => {
    await mountGetOnly(getShapedResponse());
    /**
     * 🔴🔴 **실측 사실이고 이 WU 가 고치지 않는다.** 실제 상품(`7b16eecc`)의 EUR 40 후보는
     *    `market = "UNKNOWN"` 이다(§30-1 표의 그 줄). 그런데
     * ```
     * 해외 «집계»  `market !== "KR"`       ⟹ UNKNOWN 을 **포함** 한다 → EUR 40 이 금액에 든다
     * 후보 «카드»  `row.market === market`  ⟹ UNKNOWN 은 **어느 칸에도 없다**
     * ```
     * ⟹ 🔴 **금액은 뜨는데 그 근거 카드가 없다.** 고치려면 `selectCandidateList` 의 시장
     *    일치 규칙을 바꿔야 하고 그것은 **표시 정책 변경** 이다(계약 `cand-01` 이
     *    `expect(selectCandidateList([kr], "OVERSEAS")).toHaveLength(0)` 로 잠갔다)
     *    ⟹ 🟡 **CPO 판정 사안** 으로 올리고 여기서는 **숫자만** 남긴다.
     */
    expect(
      container.querySelectorAll('[data-testid="mi-candidate-row"]').length,
      "🔴 시장이 확정된 후보(KR 1건)가 카드로 서지 않았다",
    ).toBe(1);
    expect(
      container.querySelectorAll('[data-testid="mi-same-domestic"] [data-testid="mi-candidate-row"]').length,
      "🔴 국내 후보 카드가 없다",
    ).toBe(1);
    /** 🔴 UNKNOWN 행은 카드가 없다 — 그런데 그 금액은 A-2 에서 **화면에 떠 있다**. */
    expect(
      container.querySelectorAll('[data-testid="mi-same-overseas"] [data-testid="mi-candidate-row"]').length,
      "🔴 UNKNOWN 시장 후보가 카드로 섰다 — 표시 정책이 바뀌었다(계약 cand-01 과 충돌)",
    ).toBe(0);
  });

  it("A-4 🔴 **POST 가 GET 을 이긴다** — 「다시 분석」 값이 저장분으로 덮이지 않는다", async () => {
    /**
     * 🔴 `rows` 와 **같은 규칙** 이다(live 우선). POST 가 준 값이 있으면 그것이 서야 한다.
     * 🟢 POST 전용 이름으로 **다른 금액** 을 주고 그 값이 이기는지 본다.
     */
    stubFetch(getShapedResponse());
    await act(async () => {
      root.render(
        sellerSurfaceElement({
          marketDone: true,
          autoCheckResult: {
            domesticReference: {
              ...DOMESTIC_SUMMARY,
              byCurrency: { KRW: { count: 1, lowestAmount: 77_700, highestAmount: 77_700 } },
            },
            domesticShop: { domesticListingEvidence: SAVED_ROWS },
          },
        }),
      );
    });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(digits(textOf("domestic-lowest")), "🔴 POST 값이 GET 저장분에 덮였다").toContain("77700");
  });

  it("A-5 🔴 **없으면 만들지 않는다** — 두 칸이 다 비면 블록도 없다", async () => {
    await mountGetOnly({ ...productionData(), savedCandidateRows: [] } as unknown as PriceHistoryResponse);
    expect(
      container.querySelector('[data-testid="domestic-reference"]'),
      "🔴 값이 없는데 국내 참고가격 블록이 섰다 — 빈 칸을 만들었다",
    ).toBeNull();
  });

  it("B-1 🔴 **배선 앵커** — 소비처가 GET 이름을 읽고 deps 에도 들어 있다", () => {
    const SRC = stripComments(
      readFileSync(join(__dirname, "..", "DomesticPriceIntelligencePanel.tsx"), "utf8")
        .split("\r\n")
        .join("\n"),
    );
    expect(SRC, "🔴 국내 GET 폴백이 끊겼다").toContain(
      "domesticReference: domesticReference ?? data?.candidateDomesticPrice ?? null",
    );
    expect(SRC, "🔴 해외 GET 폴백이 끊겼다").toContain(
      "overseasReference: overseasReference ?? data?.candidateOverseasPrice ?? null",
    );
    /** 🔴 deps 에 없으면 응답이 와도 memo 가 다시 돌지 않는다(그러면 화면이 계속 빈다). */
    for (const dep of ["data?.candidateDomesticPrice,", "data?.candidateOverseasPrice,"]) {
      expect(SRC, `🔴 memo deps 에 ${dep} 가 없다`).toContain(dep);
    }
    /** 🟢 POST 배선은 **그대로** 다(기존 계약 셋이 보는 그 줄들). */
    expect(SRC).toContain("setDomesticReference(j.domesticReference ?? null)");
    expect(SRC).toContain("setOverseasReference(json.overseasReference ?? null)");
  });
});
