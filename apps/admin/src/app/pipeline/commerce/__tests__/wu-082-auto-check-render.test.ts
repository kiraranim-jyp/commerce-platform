// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MiPanelView } from "../DomesticPriceIntelligencePanel";
/** 🔴 WU-132 ③ — 🇰🇷/🌎 집계가 **옮겨 간** 자리. 화면의 유일한 가격비교 영역이다. */
import { MarketPriceComparison } from "../MarketPriceComparison";
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

  /**
   * 🔴🔴 WU-132 ③ — **🇰🇷 집계가 서는 «자리» 가 바뀌었다.** 가격 비교 영역을 둘 두지
   *    않기 위해 MI 패널의 `unified-price-comparison` 을 제거했고, 그 블록은
   *    「📊 동일상품 가격 비교」(`MarketPriceComparison`)로 **옮겼다**.
   *
   * 🟢 WU-082 가 잠그려던 성질은 **그대로** 다 — 「자동 1회차 값이 오면 화면이 선다」.
   *    🔴 그래서 **두 자리를 같이** 단언한다(한쪽만 보면 옮기는 과정에서 값을 흘려도
   *    통과한다): ⒜ 패널은 「조회가 돌았다」를 말하고 ⒝ 그 영역이 **숫자** 를 그린다.
   */
  it("🟢 AFTER — 자동 1회차 값이 오면 **🇰🇷 집계가 가격비교 영역에** 선다", async () => {
    /** ⒜ 패널 — 집계만 와도 「조회했다」를 말한다(WU-130 ② 계약). */
    await mount({ domesticReference: DOMESTIC_SUMMARY });
    expect(sec("domestic-review-empty")).toBeTruthy();
    /** 🔴 집계 블록은 **이제 패널에 없다** — 두 영역이 되면 FAIL 이다. */
    expect(sec("domestic-reference")).toBeNull();

    /** ⒝ 가격비교 영역 — 숫자는 여기서 선다. */
    await act(async () => {
      root.render(createElement(MarketPriceComparison, { domesticReference: DOMESTIC_SUMMARY } as never));
    });
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
    /**
     * 🔴🔴 WU-130 ② — **문구가 갱신됐다.** 전 문구(「국내 비교 후보가 없습니다.」)는
     *    「조회조차 안 했다」로도 읽혔다. 실측에서 국내 등록부는 **응답했고 후보도 왔지만**
     *    그 후보가 전부 다른 상품이어서 0 이 됐다 — 그 둘은 **다른 사실** 이다.
     * 🟢 성질은 그대로다 — **판정 의미를 부여하지 않는다.**
     */
    const text = sec("domestic-review-empty")?.textContent ?? "";
    expect(text).toContain("조회");
    expect(text).toContain("찾지 못했습니다");
    /** 🔴 「국내에 동일상품이 없다」로 **단정하지 않는다**(부재 ≠ 미발견). */
    expect(text).not.toMatch(/국내에 (동일상품|상품)이 없/);
  });

  /**
   * 🔴🔴 WU-130 ② — **조회가 돌았으면 🇰🇷 구역은 «참고 집계가 없어도» 선다.**
   *    전에는 집계가 없으면 구역 자체가 사라져서 셀러가 「국내는 조회조차 안 했나?」로
   *    읽었다 — 실측(두 상품)에서 국내 후보는 **전부 0** 이었으므로 그것이 곧 CEO 가
   *    본 「국내 한 줄」 화면이다.
   */
  it("🟢 WU-130 — 해외만 와도 🇰🇷 국내 구역이 **선다**(조회했다는 사실을 말한다)", async () => {
    await mount({ overseasAutoEvidence: [] });
    expect(sec("domestic-review-empty")).toBeTruthy();
  });
});
