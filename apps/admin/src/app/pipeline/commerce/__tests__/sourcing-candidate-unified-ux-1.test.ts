/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sellerSurfaceElement, SNAPSHOT_ID } from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import { candidatePriceUse, CANDIDATE_PRICE_USE_LABEL } from "../mi-same-candidates";
import { PRICE_DISQUALIFYING_BLOCKER_LIST } from "@/lib/price-disqualifying-blockers";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SOURCING-CANDIDATE-UNIFIED-UX-1 ④⑧ — **같은 카드 · 포함/제외를 카드가 말한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 검수 3항 중 이번에 닫는 둘:
 * ```
 * ① 국내·해외 후보가 **동일한 카드 템플릿** 으로 표시될 것        ← U-1(이미 충족 · 잠근다)
 * ③ 참고가격에 **포함된 후보와 제외된 후보** 가 카드에서 구분될 것 ← U-3~U-6(이번 구현)
 * ```
 * 🔴 ②(카드 항목 5개 제한)와 ⑦(선택 UI 제거)은 **이 세션에서 하지 않았다** — 미완료
 *    범위로 보고한다(CPO: 「완결할 수 없다면 clean 으로 중단하고 미완료 범위를 보고」).
 *
 * 🔴 가격 공식·제외 조건 **변경 0** · 후보 데이터 **보존** · human_verdict **보존**.
 */

const AREA_SRC = readFileSync(join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

let container: HTMLDivElement;
let root: Root;

/** 🟢 CEO 화면과 같은 모양 — 국내 둘(반영 1 + 제외 1) · 해외 하나(반영). */
const ROWS = [
  {
    domain: "donokids.com",
    discoveredUrl: "https://donokids.com/product/a",
    title: "허그 헤어리 몬스터 티셔츠",
    market: "KR",
    priceAmount: 88_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: ["BRAND_UNCONFIRMED"],
    source: "DOMESTIC_LISTING",
  },
  {
    domain: "otherkids.kr",
    discoveredUrl: "https://otherkids.kr/product/b",
    title: "몬스터 반팔 티셔츠",
    market: "KR",
    priceAmount: 79_000,
    priceCurrency: "KRW",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: ["BRAND_MISMATCH"],
    source: "DOMESTIC_LISTING",
  },
  {
    domain: "junioredition.com",
    discoveredUrl: "https://junioredition.com/products/x",
    title: "Hug Hairy Monster T-Shirt",
    market: "OVERSEAS",
    priceAmount: 37,
    priceCurrency: "GBP",
    priceStatus: "VERIFIED_CURRENT",
    crossSellerVerdict: "PRESUMED_SAME",
    matchTruth: "TEXT_CONFIRMED",
    priceTier: "COMPARISON",
    crossSellerBlockers: [],
    source: "OVERSEAS_AUTO",
  },
];

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

/** 🔴 후보는 **POST 경로** 로 준다 — 운영이 그 통로다(GET 은 transient 를 안 싣는다). */
async function mount(): Promise<void> {
  stubFetch(productionData());
  await act(async () => {
    root.render(
      sellerSurfaceElement({
        marketDone: true,
        autoCheckResult: { domesticShop: { domesticListingEvidence: ROWS } },
      }),
    );
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("U. 🔵 후보 카드 — 같은 템플릿 · 참고가격 포함/제외", () => {
  it("U-1 🟢 국내·해외가 **같은 카드 컴포넌트** 를 쓴다(CPO 검수 ①)", () => {
    /**
     * 🟢 **이미 충족돼 있었다** — `MarketColumn` 하나를 두 시장이 공유하고 행도
     *    `mi-candidate-row` 하나다. 🔴 그래서 이번에 **다시 만들지 않았다**(중복 금지).
     * 🔴 이 계약은 그 사실을 **잠근다** — 시장별 분기 카드가 생기면 FAIL 한다.
     */
    const rows = AREA_SRC.split('data-testid="mi-candidate-row"').length - 1;
    expect(rows, "🔴 카드 마크업이 둘이 되면 한쪽만 고치는 날이 온다").toBe(1);
    /** 🔴 `MarketColumn` 호출이 둘(KR·OVERSEAS)이고 **같은 컴포넌트** 다. */
    expect(AREA_SRC.split("<MarketColumn").length - 1).toBeGreaterThanOrEqual(2);
    expect(AREA_SRC).toContain('market="KR"');
    expect(AREA_SRC).toContain('market="OVERSEAS"');
  });

  it("U-2 🔴 자격 술어는 **집계기와 같은 owner** 다 — 화면에 사본 0", () => {
    /** 🔴 화면 파일에 blocker 문자열이 박히면 두 집합이 갈린다. */
    for (const b of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      expect(AREA_SRC, `🔴 '${b}' 가 화면 파일에 박혔다 — 사본이다`).not.toContain(b);
    }
    expect(AREA_SRC).toContain("candidatePriceUse(row)");
  });

  it("U-3 🟢🟢 **반영된 후보가 「참고가격에 반영」을 말한다**(CPO 검수 ③)", async () => {
    await mount();
    const used = container.querySelectorAll('[data-testid="mi-candidate-price-use"][data-use="USED"]');
    expect(used.length, "🔴 0 이면 셀러는 여전히 어느 후보인지 모른다").toBeGreaterThan(0);
    expect(used[0].textContent).toContain("참고가격에 반영");
  });

  it("U-4 🟢🟢 **제외된 후보가 그 사실과 이유를 말한다**", async () => {
    await mount();
    const excluded = container.querySelectorAll(
      '[data-testid="mi-candidate-price-use"][data-use="EXCLUDED_OBSERVED_DIFFERENCE"]',
    );
    expect(excluded.length, "🔴 제외 사유가 후보 옆에 없으면 CEO 불만이 그대로다").toBe(1);
    expect(excluded[0].textContent).toContain("상품 차이가 확인됨");
    /** 🔴 **내부 토큰을 노출하지 않는다** — 사람의 말만 적는다. */
    for (const b of PRICE_DISQUALIFYING_BLOCKER_LIST) {
      expect(excluded[0].textContent ?? "").not.toContain(b);
    }
  });

  it("U-5 🔴 두 줄이 **접힘 밖** 에 있다 — 접으면 안 적는 것과 같다", async () => {
    await mount();
    const node = container.querySelector('[data-testid="mi-candidate-price-use"]');
    expect(node).not.toBeNull();
    /** 🔴 조상에 **닫힌** `details` 가 카드 목록(`mi-candidate-list`) 하나를 넘지 않는다. */
    let folds = 0;
    for (let el = node!.parentElement; el; el = el.parentElement) {
      if (el.tagName === "DETAILS" && !(el as HTMLDetailsElement).open) folds += 1;
    }
    expect(folds, "🔴 근거 접힘 «안» 으로 들어가면 셀러가 또 못 본다").toBeLessThanOrEqual(1);
  });

  it("U-6 🔴 「모른다」는 **줄을 만들지 않는다** — 제외로 적지 않는다", () => {
    /** 🟢 순수 함수 축 — 가격이 없거나 미확인이면 애초에 분모가 아니다. */
    expect(candidatePriceUse({ priceAmount: null })).toBe("NOT_PRICED");
    expect(candidatePriceUse({ priceAmount: 1000, priceStatus: "UNVERIFIED_SEARCH" })).toBe("NOT_PRICED");
    expect(CANDIDATE_PRICE_USE_LABEL.NOT_PRICED).toBeNull();
    /** 🔴 blocker 를 모르면(`undefined`) **반영** 이다(「모른다」를 제외로 적지 않는다). */
    expect(candidatePriceUse({ priceAmount: 1000, priceStatus: "VERIFIED_CURRENT" })).toBe("USED");
  });

  it("U-7 🔴 **후보는 숨기지 않는다** — 제외돼도 카드가 선다(CPO 문장)", async () => {
    await mount();
    const rows = container.querySelectorAll('[data-testid="mi-candidate-row"]');
    const text = Array.from(rows)
      .map((r) => r.textContent ?? "")
      .join("|");
    expect(text).toContain("donokids.com");
    expect(text, "🔴 제외된 후보가 사라지면 셀러가 분모를 못 센다").toContain("otherkids.kr");
  });
});
