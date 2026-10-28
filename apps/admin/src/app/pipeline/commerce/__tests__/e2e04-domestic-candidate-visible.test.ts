// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TransientCandidateSections } from "../DomesticPriceIntelligencePanel";
import { AI_SEARCH_HEADING, DOMESTIC_LISTING_HEADING, type GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 DISCOVERY E2E-04 — **마운트한 DOM 으로 확인한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 소스 계약으로 끝내지 않는가 — **E2E-03 이 그렇게 끝냈다가 틀렸다.**
 *    그때 「수정 후 화면 3」이라고 적었지만 그건 **코드/계약** 이었고, CEO 실제
 *    화면에는 국내 후보가 **한 건도 없었다**. 헌장 §5 「Render PASS ≠ 소스 PASS」.
 *
 * 🔴 행 값은 **지어내지 않았다** — CEO 실행과 같은 질의(`"B226AC009"`)의 운영 산출이다
 *    (11st.co.kr · PRESUMED_SAME · TEXT_CONFIRMED · COMPARISON · market KR).
 * 🔴 네트워크 0 · DB 0.
 */

const krWebSearch: GeminiTransientRow = {
  source: "WEB_SEARCH",
  domain: "11st.co.kr",
  title: "보보쇼즈 키즈 긴팔티셔츠 B226AC009",
  imageUrl: null,
  soldOut: null,
  discoveredUrl: "https://www.11st.co.kr/products/9589851221",
  matchTruth: "TEXT_CONFIRMED",
  priceTier: "COMPARISON",
  crossSellerVerdict: "PRESUMED_SAME",
  confidence: 0.5,
  matchReasons: [],
  crossSellerBlockers: [],
  crossSellerConflicts: [],
  priceAmount: null,
  priceCurrency: null,
  priceStatus: "PRICE_UNAVAILABLE",
  market: "KR",
  basis: null,
};

const overseasWebSearch: GeminiTransientRow = {
  ...krWebSearch,
  domain: "answear.com",
  discoveredUrl:
    "https://answear.com/p/bobo-choses-longsleeve-dzieciecy-bawelniany-hug-hairy-monster-niebieski-b226ac009-1720719",
  market: "OVERSEAS",
};

const krListing: GeminiTransientRow = {
  ...krWebSearch,
  source: "DOMESTIC_LISTING",
  domain: "donokids.com",
  discoveredUrl: "https://donokids.com/product/x",
};

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

const mount = async (props: Record<string, unknown>) => {
  await act(async () => {
    root.render(createElement(TransientCandidateSections as never, props as never));
  });
};

const BASE = {
  web: null,
  supplied: null,
  overseasAuto: null,
  reviewedSame: null,
  domesticListing: null,
  webSearch: null,
  notice: null,
  domesticReview: {},
  reviewSaveState: {},
  reviewHistory: null,
  originImageUrl: null,
  originTitle: "Hug Hairy Monster T-shirt",
};

describe("E2E-04 — AI Search 국내 후보가 «화면에» 선다", () => {
  it("🔴🔴 AI Search 의 국내 행이 🇰🇷 구역 DOM 에 실제로 그려진다", async () => {
    await mount({ ...BASE, webSearch: [krWebSearch] });
    const kr = container.querySelector('[data-testid="domestic-review-transient"]');
    expect(kr, "🇰🇷 구역이 렌더되지 않았다").toBeTruthy();
    expect(kr?.textContent ?? "").toContain("11st.co.kr");
    /** 🔴 「후보를 찾지 못했습니다」가 동시에 서면 화면이 거짓말을 한다. */
    expect(container.querySelector('[data-testid="domestic-review-empty"]')).toBeNull();
  });

  it("🔴 국내 목록 탐색(CORE-2R-4)의 국내 행도 같은 구역에 선다", async () => {
    await mount({ ...BASE, domesticListing: [krListing] });
    const kr = container.querySelector('[data-testid="domestic-review-transient"]');
    expect(kr?.textContent ?? "").toContain("donokids.com");
  });

  it("🔴 KR 이 아닌 AI Search 행은 **자기 출처 구역** 에 선다(사라지지 않는다)", async () => {
    await mount({ ...BASE, webSearch: [overseasWebSearch] });
    const sec = container.querySelector('[data-testid="ai-search-transient"]');
    expect(sec, "AI 검색 구역이 없다").toBeTruthy();
    expect(sec?.textContent ?? "").toContain("answear.com");
    /** 🔴 해외 행이 🇰🇷 구역으로 새지 않는다(옮기는 것이지 복제가 아니다). */
    expect(container.querySelector('[data-testid="domestic-review-transient"]')).toBeNull();
  });

  it("🔴 총 행 수가 보존된다 — 두 구역에 **복제되지 않는다**", async () => {
    await mount({ ...BASE, webSearch: [krWebSearch, overseasWebSearch] });
    const rows = container.querySelectorAll('a[href="' + krWebSearch.discoveredUrl + '"]');
    expect(rows.length, "국내 행이 중복 렌더됐다").toBe(1);
  });

  it("🟢 머리 문구가 기존 출처들과 **겹치지 않는다**(출처 축 보존)", () => {
    expect(AI_SEARCH_HEADING).not.toBe(DOMESTIC_LISTING_HEADING);
    for (const h of [AI_SEARCH_HEADING, DOMESTIC_LISTING_HEADING]) {
      /** 🔴 「동일상품」이라고 단정하지 않는다 — 판정은 행마다 적힌다(WU-091 어휘 계약). */
      expect(h).not.toContain("동일상품");
      expect(h).toContain("후보");
    }
  });

  it("🔴 내부 출처 id 를 화면 글자로 노출하지 않는다", async () => {
    await mount({ ...BASE, webSearch: [krWebSearch], domesticListing: [krListing] });
    for (const id of ["__web_search__", "__domestic_listing__"]) {
      expect(container.textContent ?? "").not.toContain(id);
    }
  });

  /**
   * 🔴🔴🔴 CPO E2E-04 §「반드시 확인할 것」 — **내부값이 셀러 화면에 나오면 안 된다.**
   *    🔴 소스가 아니라 **마운트한 DOM 의 글자** 로 본다(소스에는 당연히 있다).
   *    🟢 셀러가 보는 것은 출처 배지(「AI 검색」)와 한국어 판정 문구뿐이어야 한다.
   */
  it("🔴🔴 셀러 화면에 **내부 어휘** 가 글자로 나오지 않는다", async () => {
    await mount({ ...BASE, webSearch: [krWebSearch, overseasWebSearch], domesticListing: [krListing] });
    const shown = container.textContent ?? "";
    const FORBIDDEN = [
      /** 판정 원문 */
      "PRESUMED_SAME",
      "TEXT_CONFIRMED",
      "COMPARISON",
      /** 내부 배열/공급자/질의 */
      "webSearchEvidence",
      "domesticListingEvidence",
      "Apify",
      "apify",
      "B226AC009\"",
      /** 점수·문턱 */
      "threshold",
      "score",
      "confidence",
    ];
    for (const token of FORBIDDEN) {
      expect(shown, `내부 어휘 노출: ${token}`).not.toContain(token);
    }
    /** 🟢 반대로 **있어야 하는 것** — 출처 배지가 「AI 검색」으로 말한다. */
    expect(shown).toContain("AI 검색");
  });
});
