// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MiPanelView } from "../DomesticPriceIntelligencePanel";
import { DOMESTIC_REVIEW_HEADING, type GeminiTransientRow } from "../GeminiTransientCandidates";
import { withDomesticComparable } from "./product-tab-composition";

/**
 * WU-082 — **「🔄 다시 분석」을 «누르지 않아도» 국내 축이 선다** (마운트 DOM)
 *
 * 🔴 `MiPanelView` 는 서버를 부르지 않는다(그리는 일만 한다). 그래서 여기서는
 *    **자동 1회차가 채워 줄 값이 props 로 왔을 때** 화면이 서는지를 본다.
 *    배선(page → workspace → panel)은 `wu-082-auto-check-wiring.test.ts` 가 잠근다.
 */

const KR_ROW: GeminiTransientRow = {
  domain: "biskuit.kr",
  title: "[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009 - 비스킷",
  source: "SELLER_URL",
  priceStatus: "VERIFIED_CURRENT",
  discoveredUrl: "https://biskuit.kr/product/x/8891/category/367/display/1/",
  crossSellerVerdict: "PRESUMED_SAME",
  priceTier: "COMPARISON",
  priceAmount: 88000,
  priceCurrency: "KRW",
  market: "KR",
  basis: "KR_TLD_AND_KRW",
};

const DOMESTIC_SUMMARY = {
  count: 1,
  byCurrency: { KRW: { count: 1, lowestAmount: 88000 } },
  byMarket: { KR: 1 },
  byPriceTier: { COMPARISON: 1 },
};

let container: HTMLDivElement;
let root: Root;

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
});

async function mount(extra: Record<string, unknown>): Promise<void> {
  await act(async () => {
    root.render(createElement(MiPanelView, { data: withDomesticComparable(), candidates: [], ...extra } as never));
  });
}

const sec = (id: string) => container.querySelector(`[data-testid="${id}"]`);

describe("WU-082 — 자동 1회차만으로 국내 축이 보인다", () => {
  it("🔴 BEFORE — 참고 축이 없으면 국내 구역이 **없다**(이것이 CEO 가 본 화면이다)", async () => {
    await mount({});
    expect(sec("domestic-reference")).toBeNull();
    expect(sec("domestic-review-transient")).toBeNull();
    expect(sec("domestic-review-empty")).toBeNull();
  });

  it("🟢 AFTER — 자동 1회차 값이 오면 **🇰🇷 국내 참고가격** 이 선다", async () => {
    await mount({ domesticReference: DOMESTIC_SUMMARY });
    expect(sec("domestic-reference")).toBeTruthy();
    expect(sec("domestic-lowest")?.textContent).toMatch(/88,?000/);
  });

  it("🟢 AFTER — 후보 행도 오면 **🇰🇷 국내 후보 검토** 구역이 선다", async () => {
    await mount({ domesticReference: DOMESTIC_SUMMARY, urlCandidateEvidence: [KR_ROW] });
    const s = sec("domestic-review-transient");
    expect(s?.textContent).toContain(DOMESTIC_REVIEW_HEADING);
    expect(s?.textContent).toContain("비스킷");
  });

  /**
   * 🔴🔴 **effect 자체는 여기서 마운트로 못 본다 — 정직하게 적는다.**
   *    effect 는 **바깥 패널**에 있는데 그 컴포넌트는 GET 데이터가 없으면 본문을
   *    그리지 않는다(P-18 「확인 중」 상태). fetch 를 막고 마운트해 봤고 **실패했다**.
   *    🟢 그래서 effect 는 `wu-082-auto-check-wiring.test.ts` 의 **소스 계약** 이 잠근다
   *       (가드 줄 · 네 setter · 의존성 배열). 🔴 「마운트로 봤다」고 적지 않는다.
   */
  it("🟢 후보가 0 이어도 집계가 있으면 **empty state** 로 선다(판정 의미 없음)", async () => {
    await mount({ domesticReference: DOMESTIC_SUMMARY });
    expect(sec("domestic-review-empty")?.textContent).toContain("국내 비교 후보가 없습니다");
  });
});
